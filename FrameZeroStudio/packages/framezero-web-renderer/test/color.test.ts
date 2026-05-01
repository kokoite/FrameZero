import { describe, expect, it } from "vitest";
import { parseHexColor, visibleOpacity } from "../src/color";

describe("color helpers", () => {
  it("parses strict #RRGGBB colors", () => {
    expect(parseHexColor("#38BDF8")).toEqual({ r: 56, g: 189, b: 248 });
    expect(parseHexColor("invalid")).toBeNull();
    expect(parseHexColor("38BDF8")).toBeNull();
  });

  it("matches Swift visible opacity semantics", () => {
    expect(visibleOpacity(0.005)).toBe(0);
    expect(visibleOpacity(0.5)).toBe(0.5);
    expect(visibleOpacity(2)).toBe(1);
    expect(visibleOpacity(-1)).toBe(0);
  });
});
