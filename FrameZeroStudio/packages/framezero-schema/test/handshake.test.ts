import { describe, expect, it } from "vitest";
import { errorPayloadSchema, helloAckPayloadSchema, helloPayloadSchema } from "../src/index";

describe("helloPayloadSchema", () => {
  it("accepts a valid ios-simulator hello", () => {
    expect(helloPayloadSchema.safeParse({
      client: "ios-simulator",
      schemaVersions: [1]
    }).success).toBe(true);
  });

  it("accepts optional appVersion and lastAppliedRevision", () => {
    expect(helloPayloadSchema.safeParse({
      client: "studio-web",
      schemaVersions: [1],
      appVersion: "0.2.0",
      lastAppliedRevision: 42
    }).success).toBe(true);
  });

  it("rejects empty schemaVersions array", () => {
    expect(helloPayloadSchema.safeParse({
      client: "ios-simulator",
      schemaVersions: []
    }).success).toBe(false);
  });

  it("rejects unknown client kind", () => {
    expect(helloPayloadSchema.safeParse({
      client: "android",
      schemaVersions: [1]
    }).success).toBe(false);
  });

  it("rejects schemaVersions containing values other than 1", () => {
    expect(helloPayloadSchema.safeParse({
      client: "ios-simulator",
      schemaVersions: [2]
    }).success).toBe(false);
  });
});

describe("helloAckPayloadSchema", () => {
  it("accepts the negotiated ack shape", () => {
    expect(helloAckPayloadSchema.safeParse({
      studioVersion: "0.1.0",
      sessionName: "FrameZero Local",
      schemaVersion: 1,
      schemaVersions: [1],
      currentRevision: 0,
      heartbeatIntervalMs: 5000
    }).success).toBe(true);
  });

  it("rejects missing schemaVersion", () => {
    expect(helloAckPayloadSchema.safeParse({
      studioVersion: "0.1.0",
      sessionName: "FrameZero Local",
      schemaVersions: [1],
      currentRevision: 0,
      heartbeatIntervalMs: 5000
    }).success).toBe(false);
  });

  it("rejects non-positive heartbeatIntervalMs", () => {
    expect(helloAckPayloadSchema.safeParse({
      studioVersion: "0.1.0",
      sessionName: "FrameZero Local",
      schemaVersion: 1,
      schemaVersions: [1],
      currentRevision: 0,
      heartbeatIntervalMs: 0
    }).success).toBe(false);
  });
});

describe("errorPayloadSchema", () => {
  it.each([
    "schemaVersion.unsupported",
    "envelope.invalid",
    "payload.invalid"
  ] as const)("accepts error code %s", (code) => {
    expect(errorPayloadSchema.safeParse({
      code,
      message: "explained"
    }).success).toBe(true);
  });

  it("rejects unknown error codes", () => {
    expect(errorPayloadSchema.safeParse({
      code: "totally.made.up",
      message: "nope"
    }).success).toBe(false);
  });

  it("accepts an optional detail field of any shape", () => {
    expect(errorPayloadSchema.safeParse({
      code: "payload.invalid",
      message: "see detail",
      detail: { hint: "client must include schemaVersions" }
    }).success).toBe(true);
  });
});
