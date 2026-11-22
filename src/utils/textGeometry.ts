import { Point, TextRange, VectorPath } from '../types/vector';
import { charWidth, styleAt } from './textRangeStyle';

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

/** Baseline distance: 1.2 × the type size unless the label overrides it. */
export function textLineHeight(fontSize?: number, multiplier?: number): number {
  const factor = multiplier && multiplier > 0 ? multiplier : 1.2;
  return Math.max(1, fontSize || 48) * factor;
}

export interface TextMetricsInput {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: number;
  /** Baseline distance as a multiple of the size; 1.2 when unset */
  lineHeight?: number;
  /** Characters that carry their own typeface, so a mixed line is measured right */
  ranges?: TextRange[];
  /** Index of `text`'s first character inside `ranges` */
  rangesOffset?: number;
}

const FALLBACK_ASCENT = 0.8;
const FALLBACK_DESCENT = 0.2;

/**
 * Ink above and below the baseline. A face with no descenders reports a descent
 * of 0, which is a real answer — padding it with a fallback made a box taller
 * than a display face's, so a label shrank when set in a bigger typeface.
 */
function inkBox(measured: TextMetrics, size: number, ink: string): { ascent: number; descent: number } {
  const ascent = measured.actualBoundingBoxAscent ?? 0;
  const descent = measured.actualBoundingBoxDescent ?? 0;
  if (ascent > 0 || descent > 0) return { ascent, descent };
  // A run of spaces has no ink to add, so it must not pad the box either.
  if (!ink.trim()) return { ascent: 0, descent: 0 };
  return { ascent: size * FALLBACK_ASCENT, descent: size * FALLBACK_DESCENT };
}
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
  void document.fonts.ready.then(() => {
    metricsCache.clear();
    advanceCache.clear();
  });
}

/**
 * Measures the label exactly as the SVG <text> node lays it out: left-aligned
 * on its baseline, with letter-spacing applied between glyphs. Falls back to a
 * deterministic estimate where a canvas is unavailable (SSR, smoke tests).
 */
/**
 * Width, ascent and descent of a label whose lines may mix typefaces. Each
 * character is measured in the font it is drawn in, so a refonted stretch
 * moves the width — and therefore the frame and the centring — with it.
 */
function rangedMetrics(lines: string[], input: TextMetricsInput): TextMetricsBox {
  const size = Math.max(1, input.fontSize || 48);
  const letterSpacing = input.letterSpacing ?? 0;
  const family = input.fontFamily || 'sans-serif';
  const weight = input.fontWeight || 'bold';
  const ctx = context();
  let absolute = input.rangesOffset ?? 0;
  let width = 2;
  // The box has to clear the tallest face on the line, not the label's own:
  // a range set in a face with a taller ascender would poke out of its frame.
  let ascent = 0;
  let descent = 0;
  for (const line of lines) {
    let lineWidth = 0;
    let runStart = 0;
    for (let index = 0; index < line.length; index += 1) {
      const style = styleAt(input.ranges, absolute + index);
      const font = style.fontFamily ?? family;
      lineWidth += charWidth(line[index], font, size, weight) + letterSpacing;
      const runEnds = index === line.length - 1 ||
        styleAt(input.ranges, absolute + index + 1).fontFamily !== style.fontFamily;
      if (runEnds) {
        if (ctx) {
          try {
            ctx.font = `${weight} ${size}px ${font}`;
            const measured = ctx.measureText(line.slice(runStart, index + 1));
            const box = inkBox(measured, size, line.slice(runStart, index + 1));
            ascent = Math.max(ascent, box.ascent);
            descent = Math.max(descent, box.descent);
          } catch {
            // keep the estimate for this run
          }
        }
        runStart = index + 1;
      }
    }
    width = Math.max(width, Math.max(0, lineWidth - (line.length ? letterSpacing : 0)));
    absolute += line.length + 1;
  }
  const extraLines = Math.max(0, lines.length - 1) * textLineHeight(size, input.lineHeight);
  return {
    width,
    ascent: ascent || size * FALLBACK_ASCENT,
    descent: (descent || size * FALLBACK_DESCENT) + extraLines,
  };
}

export function measureTextMetrics(input: TextMetricsInput): TextMetricsBox {
  const text = input.text ?? '';
  const size = Math.max(1, input.fontSize || 48);
  const letterSpacing = input.letterSpacing ?? 0;
  const family = input.fontFamily || 'sans-serif';
  const weight = input.fontWeight || 'bold';
  const rangeKey = input.ranges?.length ? JSON.stringify(input.ranges) + (input.rangesOffset ?? 0) : '';
  const key = `${weight}|${size}|${family}|${letterSpacing}|${text}|${rangeKey}`;
  // A font that is still loading can measure as a fallback face. Only cache
  // once the font set has settled, otherwise the box would stay stale.
  const cacheable = typeof document === 'undefined' || document.fonts?.status === 'loaded';

  const cached = cacheable ? metricsCache.get(key) : undefined;
  if (cached) return cached;

  const lines = textLines(text);
  if (input.ranges?.length) {
    const ranged = rangedMetrics(lines, { ...input, fontSize: size, letterSpacing, fontFamily: family, fontWeight: weight });
    if (cacheable) metricsCache.set(key, ranged);
    return ranged;
  }
  const lineHeight = textLineHeight(size, input.lineHeight);
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
        const box = inkBox(metrics, size, line);
        ascent = Math.max(ascent, box.ascent);
        descent = Math.max(descent, box.descent);
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

/**
 * Where each line starts, in the label's own space, so a stack of lines can be
 * centred or right-aligned under one anchor. The last line of a left-aligned
 * label (and any single-line label) stays exactly where it was.
 */
export function lineAlignOffsets(
  lines: string[],
  input: TextMetricsInput,
  align: 'left' | 'center' | 'right' = 'left'
): number[] {
  if (align === 'left' || lines.length < 2) return lines.map(() => 0);
  let absolute = input.rangesOffset ?? 0;
  const widths = lines.map((line) => {
    const width = measureTextMetrics({ ...input, text: line, rangesOffset: absolute }).width;
    absolute += line.length + 1;
    return width;
  });
  const widest = Math.max(...widths);
  return widths.map((width) => (align === 'center' ? (widest - width) / 2 : widest - width));
}

/**
 * Where each line of this label starts, alignment included. A wrapped label
 * already stores its own per-line offsets, so those win over alignment.
 */
export function textLineStarts(path: VectorPath): number[] {
  const lines = textLines(path.text);
  if (path.textLineX?.length) {
    const stored = path.textLineX;
    return lines.map((_, index) => stored[index] ?? 0);
  }
  return lineAlignOffsets(
    lines,
    {
      fontSize: path.fontSize,
      fontFamily: path.fontFamily,
      fontWeight: path.fontWeight,
      letterSpacing: path.letterSpacing,
      lineHeight: path.lineHeight,
      ranges: path.textRanges,
    },
    path.textAlign
  );
}

const advanceCache = new Map<string, number[]>();

/**
 * Left edge of every glyph on one line, in the label's local space. Prefix
 * widths keep the kerning the browser applies, so a warped string sits exactly
 * where the plain <text> node would have put each letter.
 */
export function measureLineOffsets(line: string, input: TextMetricsInput): number[] {
  const size = Math.max(1, input.fontSize || 48);
  const letterSpacing = input.letterSpacing ?? 0;
  const family = input.fontFamily || 'sans-serif';
  const weight = input.fontWeight || 'bold';
  const key = `${weight}|${size}|${family}|${letterSpacing}|${line}`;
  const cacheable = typeof document === 'undefined' || document.fonts?.status === 'loaded';
  const cached = cacheable ? advanceCache.get(key) : undefined;
  if (cached) return cached;

  const offsets: number[] = [];
  const ctx = context();
  if (ctx) {
    try {
      ctx.font = `${weight} ${size}px ${family}`;
      for (let index = 0; index < line.length; index += 1) {
        offsets.push(ctx.measureText(line.slice(0, index)).width + index * letterSpacing);
      }
    } catch {
      offsets.length = 0;
    }
  }
  if (!offsets.length) {
    for (let index = 0; index < line.length; index += 1) {
      offsets.push(index * (size * 0.6 + letterSpacing));
    }
  }

  if (cacheable) advanceCache.set(key, offsets);
  return offsets;
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
  // The frame has to know about ranged typefaces, or a refonted stretch hangs
  // outside its handles.
  const metrics = measureTextMetrics({ ...path, ranges: path.textRanges });
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
  // Ranges ride on the input when the caller has them; a label created from the
  // panel passes them so its first baseline is centred on the real ink.
  return originY + (metrics.descent - metrics.ascent) / 2;
}
