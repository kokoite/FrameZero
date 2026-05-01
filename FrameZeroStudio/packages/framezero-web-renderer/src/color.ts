export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): RGBColor | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }

  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff
  };
}

export function visibleOpacity(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped < 0.01 ? 0 : clamped;
}

export function canvasColor(hex: string | undefined, alpha = 1): string | undefined {
  if (hex === undefined) {
    return undefined;
  }

  const rgb = parseHexColor(hex);
  if (rgb === null) {
    return undefined;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(Math.max(alpha, 0), 1)})`;
}

export function rgbaWithOpacity(hex: string, opacity: number): string {
  return canvasColor(hex, opacity) ?? "rgba(0, 0, 0, 0)";
}
