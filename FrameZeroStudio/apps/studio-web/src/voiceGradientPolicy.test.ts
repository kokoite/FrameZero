import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = fileURLToPath(new URL("./main.tsx", import.meta.url));
const source = readFileSync(sourcePath, "utf8");

function functionBody(name: string) {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);

  let depth = 0;
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (bodyStart === -1) {
      if (char === "(") parenDepth += 1;
      if (char === ")") parenDepth -= 1;
    }
    if (char === "{" && (bodyStart !== -1 || parenDepth === 0)) {
      depth += 1;
      if (bodyStart === -1) bodyStart = index;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && bodyStart !== -1) {
        return source.slice(bodyStart, index + 1);
      }
    }
  }

  throw new Error(`Could not locate function body for ${name}`);
}

describe("Voice Gradient fidelity export policy", () => {
  const body = functionBody("voiceGradientComponent");

  it("keeps Planet 1 as a native FrameZero layer with no image or SVG fallback", () => {
    expect(source).toContain("figmaPlanetOneLayer");
    expect(source).toContain("function figmaEllipseLayerToFrameZeroNode");
    expect(source).toContain("function figmaRenderBoundsTransformToFilterBoxTransform");
    expect(source).toContain("transform[4] + cropX");
    expect(body).toContain("planetOne: figmaEllipseLayerToFrameZeroNode(figmaPlanetOneLayer");
    expect(body).toContain("native-layer:planet-1");
    expect(body).toContain("figma:250-475");
    expect(body).not.toContain("/figma/voice/planet-1.svg");
  });

  it("keeps the root frame native and editable", () => {
    expect(body).toContain("voiceGradientNode(\"voiceFrame\"");
    expect(body).toContain("clip: true");
    expect(body).toContain("linearGradient");
    expect(body).toContain("cornerRadius");
    expect(body).toContain("plusLighter");
    expect(body).toContain("screen");
  });
});

describe("Hotel Active Gradient fidelity export policy", () => {
  const body = functionBody("hotelActiveGradientComponent");

  it("keeps the 375x250 active Figma frame as the native layered source of truth", () => {
    expect(body).toContain("Hotel Active Gradient");
    expect(body).toContain("voiceGradientNode(\n      \"hotelActiveGradientFrame\"");
    expect(body).toContain("375,\n      250");
    expect(body).toContain("clip: true");
    expect(body).toContain("\"figma.source.id\": \"5013:45996\"");
    expect(body).toContain("\"figma.variant.type\": \"xSmall\"");
    expect(body).toContain("[\"hotelActiveGradientSource\"]");
    expect(body).toContain("nodeIds: [\"hotelActiveGradientFrame\", \"hotelActiveGradientSource\", \"hotelActivePlanetTwo\", \"hotelActivePlanetOne\"]");
  });

  it("keeps child layers native and selectable instead of using a single procedural approximation", () => {
    expect(body).toContain("hotelActiveGradientSource: voiceGradientNode");
    expect(body).toContain("[\"hotelActivePlanetTwo\", \"hotelActivePlanetOne\"]");
    expect(body).toContain("hotelActivePlanetTwo: voiceEllipseNode");
    expect(body).toContain("hotelActivePlanetOne: figmaEllipseLayerToFrameZeroNode(figmaHotelPlanetOneLayer");
    expect(body).toContain("native-layer:hotel-planet-2");
    expect(body).toContain("native-layer:hotel-planet-1");
    expect(body).not.toContain("procedural");
    expect(body).not.toContain("/figma/");
    expect(body).not.toContain(".png");
    expect(body).not.toContain(".svg");
  });

  it("uses the active 375x250 component for the preset preview", () => {
    const previewBody = functionBody("presetAssetPreviewComponent");
    expect(previewBody).toContain("id === \"hotelActiveGradient\"");
    expect(previewBody).toContain("hotelActiveGradientComponent(\"hotelActiveGradient\")");
    expect(previewBody).toContain("id === \"hotelGradient\"");
    expect(previewBody).toContain("hotelGradientComponent(\"hotelGradient\")");
  });

  it("places the active gradient without removing unrelated asset instances", () => {
    const placeBody = functionBody("createHotelActiveGradientComponent");
    expect(placeBody).toContain("hotelActiveGradientComponent(componentId)");
    expect(placeBody).toContain("replaceLayeredPresetInstance(draft, component)");
    expect(placeBody).not.toContain("removeComponentInstances(draft, \"hotelGradient\")");
    expect(placeBody).not.toContain("removeComponentInstances(draft, \"voiceGradient\")");
    expect(placeBody).not.toContain("removeComponentInstances(draft, \"hotelPlanetOne\")");
    expect(placeBody).not.toContain("removeComponentInstances(draft, \"hotelPlanetTwo\")");
  });
});

describe("Hotel Active Gradient 500 fidelity export policy", () => {
  const body = functionBody("hotelActiveGradientTallComponent");

  it("adds a separate continuous 375x500 native composition without changing the 375x250 baseline", () => {
    const baselineBody = functionBody("hotelActiveGradientComponent");
    expect(baselineBody).toContain("375,\n      250");
    expect(baselineBody).toContain("hotelActiveGradientFrame");
    expect(baselineBody).not.toContain("Hotel Active Gradient 500");

    expect(body).toContain("Hotel Active Gradient 500");
    expect(body).toContain("375,\n      500");
    expect(body).toContain("resizePolicy: \"locked-375x500\"");
    expect(body).toContain("compositionPolicy: \"continuous-375x500-native-field\"");
  });

  it("uses Figma-derived continuous native lobes instead of stacked baseline tiles or patches", () => {
    expect(body).toContain("hotelActiveTallPlanetTwoField");
    expect(body).toContain("native-layer:hotel-active-500-planet-2-field");
    expect(body).toContain("derivationPolicy: \"scaled-from-planet-2\"");
    expect(body).toContain("#7FDEFF");
    expect(body).toContain("hotelActiveTallPlanetOneField");
    expect(body).toContain("native-layer:hotel-active-500-planet-1-field");
    expect(body).toContain("derivationPolicy: \"scaled-from-planet-1\"");
    expect(body).toContain("#FF46D6");
    expect(body).toContain("hotelActiveTallCyanLowerField");
    expect(body).toContain("hotelActiveTallPinkLowerField");
    expect(body).toContain("hotelActiveTallWarmLowerField");
    expect(body).toContain("colorPolicy: \"lower-right-contained\"");
    expect(body).toContain("#FFAA00");
    expect(body).toContain("resizePolicy: \"locked-continuous-field-layer\"");
    expect(body).not.toContain("/figma/");
    expect(body).not.toContain(".png");
    expect(body).not.toContain(".svg");
    expect(body).not.toContain("imageUrl");
  });

  it("does not include the rejected stacked bridge, clipped baseline, wash, or overlap patch workaround nodes", () => {
    expect(body).not.toContain("hotelActiveTallAtmosphereSource");
    expect(body).not.toContain("hotelActiveTallAtmospherePlanetTwo");
    expect(body).not.toContain("hotelActiveTallAtmospherePlanetOne");
    expect(body).not.toContain("hotelActiveTallBaselineFrame");
    expect(body).not.toContain("hotelActiveTallSource");
    expect(body).not.toContain("hotelActiveTallPlanetTwo: voiceEllipseNode");
    expect(body).not.toContain("hotelActiveTallPlanetOne: figmaEllipseLayerToFrameZeroNode");
    expect(body).not.toContain("hotelActiveTallCyanOverlap");
    expect(body).not.toContain("hotelActiveTallPinkOverlap");
    expect(body).not.toContain("hotelActiveTallSeamWash");
    expect(body).not.toContain("bottom-250-baseline-clip");
    expect(body).not.toContain("upward-duplicate-of-375x250-source");
    expect(body).not.toContain("native-layer:hotel-active-500-seam-wash");
    expect(body).not.toContain("roundedRectangle");
  });

  it("keeps every continuous 500 lobe native, selectable, and protected by effect bounds", () => {
    const continuousLayerNames = [
      "hotelActiveTallPlanetTwoField",
      "hotelActiveTallPlanetOneField",
      "hotelActiveTallCyanLowerField",
      "hotelActiveTallPinkLowerField",
      "hotelActiveTallWarmLowerField"
    ];
    for (const layerName of continuousLayerNames) {
      const layerStart = body.indexOf(`${layerName}: voiceEllipseNode`);
      expect(layerStart).toBeGreaterThanOrEqual(0);
      const layerEnd = body.indexOf("),", layerStart);
      const layerBody = body.slice(layerStart, layerEnd);
      expect(layerBody).toContain("figmaBlur:");
      expect(layerBody).toContain("blendMode: \"normal\"");
      expect(layerBody).toContain("\"effectBounds.top\":");
      expect(layerBody).toContain("\"effectBounds.right\":");
      expect(layerBody).toContain("\"effectBounds.bottom\":");
      expect(layerBody).toContain("\"effectBounds.left\":");
    }
    expect(body).toContain("\"hotelActiveTallPlanetTwoField\",\n      \"hotelActiveTallPlanetOneField\",\n      \"hotelActiveTallCyanLowerField\",\n      \"hotelActiveTallPinkLowerField\",\n      \"hotelActiveTallWarmLowerField\"");
  });

  it("is exposed as its own preset and preview component", () => {
    const previewBody = functionBody("presetAssetPreviewComponent");
    const placeBody = functionBody("createHotelActiveGradientTallComponent");
    expect(source).toContain("id: \"hotelActiveGradientTall\"");
    expect(source).toContain("place: createHotelActiveGradientTallComponent");
    expect(previewBody).toContain("id === \"hotelActiveGradientTall\"");
    expect(previewBody).toContain("hotelActiveGradientTallComponent(\"hotelActiveGradientTall\")");
    expect(placeBody).toContain("hotelActiveGradientTallComponent(componentId)");
    expect(placeBody).toContain("replaceLayeredPresetInstance(draft, component)");
  });
});

describe("Web semantic rendering parity", () => {
  it("maps native-supported blend modes in both canvas and CSS previews", () => {
    expect(source).toContain("return \"color-dodge\"");
    expect(source).toContain("return \"plus-lighter\"");
    expect(source).toContain("return \"lighter\"");
  });
});
