import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import {
  documentUpdatePayloadSchema,
  errorPayloadSchema,
  helloAckPayloadSchema,
  helloPayloadSchema,
  makePreviewEnvelope,
  parseMotionDocument,
  previewEnvelopeSchema,
  type DocumentUpdatePayload,
  type MotionDocument,
  type PreviewEnvelope
} from "@framezero/schema";
import WebSocket, { WebSocketServer } from "ws";

type ClientKind = "studio" | "ios-simulator" | "unknown";

type Client = {
  id: string;
  kind: ClientKind;
  sessionId: string;
  socket: WebSocket;
};

type BridgeState = {
  revision: number;
  latestUpdate: DocumentUpdatePayload | null;
  latestResult: unknown;
  clients: Map<string, Client>;
};

const host = process.env.FRAMEZERO_BRIDGE_HOST ?? "127.0.0.1";
const port = Number(process.env.FRAMEZERO_BRIDGE_PORT ?? 8787);
const state: BridgeState = {
  revision: 0,
  latestUpdate: null,
  latestResult: null,
  clients: new Map()
};

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestURL = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

  try {
    if (request.method === "GET" && requestURL.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        revision: state.revision,
        previewClients: clientsByKind("ios-simulator").length,
        studioClients: clientsByKind("studio").length
      });
      return;
    }

    if (request.method === "GET" && requestURL.pathname === "/latest") {
      writeJson(response, 200, {
        revision: state.revision,
        update: state.latestUpdate,
        result: state.latestResult
      });
      return;
    }

    if (request.method === "POST" && requestURL.pathname === "/document") {
      const body = await readJson(request);
      const update = prepareDocumentUpdate(body, "http-post");
      installLatest(update);
      broadcast("ios-simulator", "document.update", update);
      writeJson(response, 200, {
        ok: true,
        revision: update.revision,
        documentHash: update.documentHash,
        previewClients: clientsByKind("ios-simulator").length
      });
      return;
    }

    writeJson(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeJson(response, 400, { ok: false, error: message });
  }
});

const wsServer = new WebSocketServer({
  server,
  path: "/framezero/preview"
});

wsServer.on("connection", (socket, request) => {
  const requestURL = new URL(request.url ?? "/framezero/preview", `http://${request.headers.host ?? `${host}:${port}`}`);
  const client: Client = {
    id: randomUUID(),
    kind: parseClientKind(requestURL.searchParams.get("client")),
    sessionId: requestURL.searchParams.get("session") ?? "local",
    socket
  };

  state.clients.set(client.id, client);
  log(`client connected kind=${client.kind} id=${client.id} session=${client.sessionId}`);

  socket.on("message", (raw) => {
    handleSocketMessage(client, raw.toString()).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      send(client, "error", errorPayloadSchema.parse({ code: "envelope.invalid", message }));
    });
  });

  socket.on("close", () => {
    state.clients.delete(client.id);
    log(`client disconnected kind=${client.kind} id=${client.id}`);
  });

  socket.on("error", (error) => {
    log(`client error kind=${client.kind} id=${client.id} error=${error.message}`);
  });
});

server.listen(port, host, () => {
  log(`listening on ws://${host}:${port}/framezero/preview and http://${host}:${port}`);
});

async function handleSocketMessage(client: Client, raw: string) {
  const envelope = previewEnvelopeSchema.parse(JSON.parse(raw));

  if (envelope.type === "hello") {
    const helloParse = helloPayloadSchema.safeParse(envelope.payload);
    if (!helloParse.success) {
      send(client, "error", errorPayloadSchema.parse({
        code: "payload.invalid",
        message: `hello payload invalid: ${helloParse.error.issues[0]?.message ?? "unknown"}`
      }));
      client.socket.close();
      return;
    }
    if (!helloParse.data.schemaVersions.includes(1)) {
      send(client, "error", errorPayloadSchema.parse({
        code: "schemaVersion.unsupported",
        message: `Bridge supports schemaVersion 1; client offered: ${JSON.stringify(helloParse.data.schemaVersions)}`
      }));
      client.socket.close();
      return;
    }

    send(client, "hello.ack", helloAckPayloadSchema.parse({
      studioVersion: "0.1.0",
      sessionName: "FrameZero Local",
      schemaVersion: 1,
      schemaVersions: [1],
      currentRevision: state.revision,
      heartbeatIntervalMs: 5000
    }));

    if (state.latestUpdate !== null) {
      send(client, "document.update", state.latestUpdate);
    }
    return;
  }

  if (envelope.type === "document.update") {
    const update = prepareDocumentUpdate(envelope.payload, "websocket");
    installLatest(update);
    broadcast("ios-simulator", "document.update", update);
    broadcast("studio", "document.update", update, client.id);
    return;
  }

  if (envelope.type === "document.result" || envelope.type === "playback.result") {
    state.latestResult = envelope.payload;
    broadcast("studio", envelope.type, envelope.payload, client.id);
    log(`runtime result kind=${client.kind} payload=${JSON.stringify(envelope.payload)}`);
    return;
  }

  if (envelope.type === "playback.command") {
    broadcast("ios-simulator", "playback.command", envelope.payload);
  }
}

function prepareDocumentUpdate(input: unknown, reason: string): DocumentUpdatePayload {
  const record = isRecord(input) ? input : {};
  const rawDocument = "json" in record ? record.json : input;
  const document = parseMotionDocument(rawDocument);
  const revision = state.revision + 1;
  const documentHash = hashDocument(document);

  return documentUpdatePayloadSchema.parse({
    revision,
    documentId: typeof record.documentId === "string" ? record.documentId : document.root,
    documentHash,
    reason: typeof record.reason === "string" ? record.reason : reason,
    autoPlay: typeof record.autoPlay === "boolean" ? record.autoPlay : true,
    resetBeforePlay: typeof record.resetBeforePlay === "boolean" ? record.resetBeforePlay : true,
    json: document
  });
}

function installLatest(update: DocumentUpdatePayload) {
  state.revision = update.revision;
  state.latestUpdate = update;
  log(`document revision=${update.revision} hash=${update.documentHash} nodes=${update.json.nodes.length}`);
}

function broadcast(kind: ClientKind, type: PreviewEnvelope["type"], payload: unknown, exceptClientId?: string) {
  for (const client of state.clients.values()) {
    if (client.kind === kind && client.id !== exceptClientId) {
      send(client, type, payload);
    }
  }
}

function send(client: Client, type: PreviewEnvelope["type"], payload: unknown) {
  if (client.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const envelope = makePreviewEnvelope(type, payload, { sessionId: client.sessionId });
  client.socket.send(JSON.stringify(envelope));
}

function clientsByKind(kind: ClientKind) {
  return [...state.clients.values()].filter((client) => client.kind === kind);
}

function parseClientKind(value: string | null): ClientKind {
  if (value === "studio" || value === "ios-simulator") {
    return value;
  }
  return "unknown";
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim().length === 0) {
    return {};
  }
  return JSON.parse(text);
}

function writeJson(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function setCorsHeaders(response: http.ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function hashDocument(document: MotionDocument) {
  return `sha256:${createHash("sha256").update(JSON.stringify(document)).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function log(message: string) {
  console.log(`[FrameZeroBridge] ${message}`);
}
