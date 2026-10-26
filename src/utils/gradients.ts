import { GradientDef, GradientStop } from '../types/vector';

/** Two-stop starter gradient built from the current solid colours. */
export function defaultGradient(from: string, to: string): GradientDef {
  return {
    type: 'linear',
    angle: 90,
    stops: [
      { offset: 0, color: from === 'none' ? '#CDFF5C' : from, opacity: 1 },
      { offset: 1, color: to === 'none' || to === from ? '#5CE1C5' : to, opacity: 1 },
    ],
  };
}

/** Geometry for a gradient in objectBoundingBox units (0..1). */
export function gradientCoords(
  g: GradientDef
): { x1: number; y1: number; x2: number; y2: number } | { cx: number; cy: number; r: number } {
  if (g.type === 'radial') return { cx: 0.5, cy: 0.5, r: 0.5 };
  const rad = (g.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return {
    x1: r(0.5 - cos / 2),
    y1: r(0.5 - sin / 2),
    x2: r(0.5 + cos / 2),
    y2: r(0.5 + sin / 2),
  };
}

/** Markup for a <linearGradient>/<radialGradient> definition (string exports). */
export function gradientMarkup(g: GradientDef, id: string): string {
  const coords = gradientCoords(g);
  const tag = g.type === 'radial' ? 'radialGradient' : 'linearGradient';
  const attrs =
    g.type === 'radial'
      ? `cx="${(coords as { cx: number }).cx}" cy="${(coords as { cy: number }).cy}" r="${(coords as { r: number }).r}"`
      : `x1="${(coords as { x1: number }).x1}" y1="${(coords as { y1: number }).y1}" x2="${(coords as { x2: number }).x2}" y2="${(coords as { y2: number }).y2}"`;
  const stops = sortedStops(g.stops)
    .map(
      (s) =>
        `    <stop offset="${(clamp01(s.offset) * 100).toFixed(1)}%" stop-color="${s.color}" stop-opacity="${clamp01(s.opacity).toFixed(2)}" />`
    )
    .join('\n');
  return `<${tag} id="${id}" ${attrs}>\n${stops}\n  </${tag}>`;
}

/** CSS preview used by the colour panel. */
export function gradientCss(g: GradientDef): string {
  const stops = [...g.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${hexToRgba(s.color, clamp01(s.opacity))} ${(clamp01(s.offset) * 100).toFixed(1)}%`)
    .join(', ');
  // Our angle is clockwise from +x (screen space); CSS angles start at "up".
  const cssAngle = ((g.angle + 90) % 360 + 360) % 360;
  return g.type === 'radial'
    ? `radial-gradient(circle at 50% 50%, ${stops})`
    : `linear-gradient(${cssAngle}deg, ${stops})`;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

/** Linear blend between two hex colours, used when adding a stop by tapping. */
export function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return [205, 255, 92];
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const k = clamp01(t);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r1 + (r2 - r1) * k)}${toHex(g1 + (g2 - g1) * k)}${toHex(b1 + (b2 - b1) * k)}`.toUpperCase();
}

/** Sort helper that keeps stop ordering stable while editing. */
export function sortedStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.offset - b.offset);
}
