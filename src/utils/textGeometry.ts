import { Point, VectorPath } from '../types/vector';

/** Affine matrix [a, b, c, d, e, f], mapping local (x, y) to world space. */
export type TextMatrix = [number, number, number, number, number, number];

export const IDENTITY_TEXT_MATRIX: TextMatrix = [1, 0, 0, 1, 0, 0];

export interface TextMetricsBox {
  width: number;
  ascent: number;
  descent: number;
}

/** Explicit line breaks are part of the label, not spacing between words. */
export function textLines(text?: string): string[] {
  return (text ?? '').split(/\r?\n/);
}

export function textLineHeight(fontSize?: number): number {
  return Math.max(1, fontSize || 48) * 1.2;
}

interface TextMetricsInput {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: number;
}

const FALLBACK_ASCENT = 0.8;
const FALLBACK_DESCENT = 0.2;
const metricsCache = new Map<string, TextMetricsBox>();
let measureContext: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext;
  if (typeof document === 'undefined') {
    measureContext = null;
    return null;
  }
  measureContext = document.createElement('canvas').getContext('2d');
  return measureContext;
}

// Fonts can finish loading after the first measurement; drop cached fallbacks
// once the font set settles so a typed label gets its real ink box.
if (typeof document !== 'undefined' && document.fonts?.ready) {
  void document.fonts.ready.then(() => metricsCache.clear());
}

/**
 * Measures the label exactly as the SVG <text> node lays it out: left-aligned
 * on its baseline, with letter-spacing applied between glyphs. Falls back to a
 * deterministic estimate where a canvas is unavailable (SSR, smoke tests).
 */
export function measureTextMetrics(input: TextMetricsInput): TextMetricsBox {
  const text = input.text ?? '';
  const size = Math.max(1, input.fontSize || 48);
  const letterSpacing = input.letterSpacing ?? 0;
  const family = input.fontFamily || 'sans-serif';
  const weight = input.fontWeight || 'bold';
  const key = `${weight}|${size}|${family}|${letterSpacing}|${text}`;
  // A font that is still loading can measure as a fallback face. Only cache
  // once the font set has settled, otherwise the box would stay stale.
  const cacheable = typeof document === 'undefined' || document.fonts?.status === 'loaded';

  const cached = cacheable ? metricsCache.get(key) : undefined;
  if (cached) return cached;

  const lines = textLines(text);
  const lineHeight = textLineHeight(size);
  const extraLines = Math.max(0, lines.length - 1) * lineHeight;
  const fallbackWidth = Math.max(
    2,
    ...lines.map(
      (line) => line.length * size * 0.6 + Math.max(0, line.length - 1) * letterSpacing
    )
  );
  let result: TextMetricsBox = {
    width: fallbackWidth,
    ascent: size * FALLBACK_ASCENT,
    descent: size * FALLBACK_DESCENT + extraLines,
  };

  const ctx = context();
  if (ctx) {
    try {
      ctx.font = `${weight} ${size}px ${family}`;
      let width = 2;
      let ascent = 0;
      let descent = 0;
      for (const line of lines) {
        const metrics = ctx.measureText(line);
        width = Math.max(
          width,
          metrics.width + Math.max(0, line.length - 1) * letterSpacing
        );
        ascent = Math.max(
          ascent,
          metrics.actualBoundingBoxAscent || size * FALLBACK_ASCENT
        );
        descent = Math.max(
          descent,
          metrics.actualBoundingBoxDescent || size * FALLBACK_DESCENT
        );
      }
      result = {
        width: Math.max(2, width),
        ascent: Math.max(1, ascent),
        descent: Math.max(0, descent) + extraLines,
      };
    } catch {
      /* keep the deterministic estimate */
    }
  }

  if (cacheable) metricsCache.set(key, result);
  return result;
}

export function normalizeTextMatrix(matrix?: readonly number[]): TextMatrix {
  if (!matrix || matrix.length !== 6 || matrix.some((n) => !Number.isFinite(n))) {
    return [...IDENTITY_TEXT_MATRIX];
  }
  return [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]];
}

export function textMatrixFor(path: VectorPath): TextMatrix {
  return normalizeTextMatrix(path.textMatrix);
}

export function isIdentityTextMatrix(matrix?: readonly number[]): boolean {
  if (!matrix) return true;
  return (
    matrix[0] === 1 &&
    matrix[1] === 0 &&
    matrix[2] === 0 &&
    matrix[3] === 1 &&
    matrix[4] === 0 &&
    matrix[5] === 0
  );
}

export function applyTextMatrix(matrix: readonly number[], point: Point): Point {
  const [a, b, c, d, e, f] = normalizeTextMatrix(matrix);
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
}

/** Returns leftMult * matrix, applying leftMult in world space. */
function composeTextMatrix(leftMult: TextMatrix, matrix?: readonly number[]): TextMatrix {
  const [a, b, c, d, e, f] = normalizeTextMatrix(matrix);
  const [la, lb, lc, ld, le, lf] = leftMult;
  return [
    la * a + lc * b,
    lb * a + ld * b,
    la * c + lc * d,
    lb * c + ld * d,
    la * e + lc * f + le,
    lb * e + ld * f + lf,
  ];
}

export function scaleTextMatrix(
  matrix: readonly number[] | undefined,
  scaleX: number,
  scaleY: number
): TextMatrix {
  return composeTextMatrix([scaleX, 0, 0, scaleY, 0, 0], matrix);
}

export function rotateTextMatrix(
  matrix: readonly number[] | undefined,
  angleRad: number
): TextMatrix {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return composeTextMatrix([cos, sin, -sin, cos, 0, 0], matrix);
}

export function flipTextMatrix(
  matrix: readonly number[] | undefined,
  direction: 'horizontal' | 'vertical'
): TextMatrix {
  return composeTextMatrix(
    direction === 'horizontal'
      ? [-1, 0, 0, 1, 0, 0]
      : [1, 0, 0, -1, 0, 0],
    matrix
  );
}

export function textMatrixCss(matrix?: readonly number[]): string {
  const [a, b, c, d, e, f] = normalizeTextMatrix(matrix);
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

export interface TextWorldBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Tight world-space box of a label, including rotation, scaling and flips
 * stored in its matrix. Local coordinates put the baseline at y = 0.
 */
export function textWorldBox(path: VectorPath): TextWorldBox | null {
  if (!path.text) return null;
  const origin = path.points[0] ?? { x: 0, y: 0 };
  const metrics = measureTextMetrics(path);
  const matrix = textMatrixFor(path);
  const corners = [
    { x: 0, y: -metrics.ascent },
    { x: metrics.width, y: -metrics.ascent },
    { x: metrics.width, y: metrics.descent },
    { x: 0, y: metrics.descent },
  ].map((p) => {
    const mapped = applyTextMatrix(matrix, p);
    return { x: mapped.x + origin.x, y: mapped.y + origin.y };
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = Math.max(2, maxX - minX);
  const height = Math.max(2, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/** Vertical offset that puts a label's ink box centre on `originY`. */
export function textBaselineForCenterY(path: TextMetricsInput, originY: number): number {
  const metrics = measureTextMetrics(path);
  return originY + (metrics.descent - metrics.ascent) / 2;
}
