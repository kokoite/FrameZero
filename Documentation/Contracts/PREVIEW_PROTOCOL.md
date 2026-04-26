# Preview Protocol Contract

## Purpose

FrameZero Studio sends generated `.motion.json` to an iOS preview app running in the simulator. The preview app loads the JSON through `MotionEngineKit` and reports whether the runtime accepted it.

The iOS simulator is the source of truth. The browser preview is advisory.

## Transport

Use WebSocket first:

```text
ws://127.0.0.1:<port>/framezero/preview?session=<id>&client=ios-simulator&protocol=1
```

For iOS Simulator, `127.0.0.1` points to the Mac host. Physical device discovery can come later through Bonjour or QR pairing.

## Envelope

Every message uses a versioned envelope:

```json
{
  "protocolVersion": 1,
  "sessionId": "local",
  "messageId": "uuid",
  "type": "document.update",
  "sentAt": "2026-04-26T12:00:00Z",
  "payload": {}
}
```

## Handshake

iOS sends:

```json
{
  "type": "hello",
  "payload": {
    "client": "ios-simulator",
    "appVersion": "0.1.0",
    "engineVersion": "MotionEngineKit",
    "supportedSchemaVersions": [1],
    "lastAppliedRevision": 0
  }
}
```

Studio replies:

```json
{
  "type": "hello.ack",
  "payload": {
    "studioVersion": "0.1.0",
    "sessionName": "Untitled Motion",
    "currentRevision": 1,
    "heartbeatIntervalMs": 5000
  }
}
```

## Document Update

Studio sends full documents in v1. Patches can be added later after full-document correctness is boring.

```json
{
  "type": "document.update",
  "payload": {
    "revision": 14,
    "documentId": "untitled",
    "documentHash": "sha256...",
    "reason": "editor-change",
    "autoPlay": true,
    "resetBeforePlay": true,
    "json": { "schemaVersion": 1 }
  }
}
```

iOS responds:

```json
{
  "type": "document.result",
  "payload": {
    "revision": 14,
    "documentHash": "sha256...",
    "status": "applied",
    "runtime": {
      "root": "screen",
      "nodeCount": 8,
      "machineCount": 1
    }
  }
}
```

Failure response:

```json
{
  "type": "document.result",
  "payload": {
    "revision": 15,
    "status": "rejected",
    "error": {
      "code": "validation_failed",
      "message": "Root node 'screen' does not exist"
    },
    "keptRevision": 14
  }
}
```

## Playback Commands

Studio may send:

```json
{
  "type": "playback.command",
  "payload": {
    "command": "replay",
    "revision": 14,
    "resetBeforePlay": true
  }
}
```

Supported commands for v1:

- `replay`
- `reset`
- `pause`
- `step`
- `setSpeed`

Commands must return `playback.result`.

## Failure Behavior

- Invalid JSON is rejected.
- The previous valid document stays visible.
- Studio shows the iOS runtime error.
- Connection loss does not clear the simulator.
- On reconnect, Studio sends only the latest full document.
- Stale revisions are ignored.
- Schema mismatch is reported clearly.
- Frequent updates are debounced and coalesced.

## Logging

Studio logs:

- server start and port;
- client connect and disconnect;
- sent revision and hash;
- apply result;
- rejection reason.

iOS logs:

- socket open, close, retry;
- received revision, hash, and size;
- decode and apply result;
- playback command result.

The Studio UI should show a compact event timeline with actionable errors.

## Test Strategy

Protocol tests:

- encode/decode all message types;
- reject unsupported protocol versions;
- ignore stale revisions;
- latest revision wins after reconnect.

iOS preview tests:

- valid update applies;
- invalid update keeps previous document;
- playback command replays;
- schema mismatch is visible.

End-to-end smoke:

- start local Studio server;
- launch simulator app;
- connect over `127.0.0.1`;
- send valid JSON;
- observe `document.result: applied`;
- send invalid JSON;
- observe previous render remains and Studio shows rejection.

