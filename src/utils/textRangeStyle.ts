import type { TextRange } from '../types/vector';

/** What one character carries: its own paint and typeface, or the label's */
export interface RangeStyle {
  fill: string | null;
  fontFamily: string | null;
}

export function styleAt(ranges: TextRange[] | undefined, index: number): RangeStyle {
  if (ranges?.length) {
    for (const range of ranges) {
      if (index >= range.start && index < range.end) {
        return { fill: range.fill ?? null, fontFamily: range.fontFamily ?? null };
      }
    }
  }
  return { fill: null, fontFamily: null };
}

let measureCanvas: HTMLCanvasElement | null = null;
const widthCache = new Map<string, number>();

/**
 * Width of one character in the font it is drawn in. A line can mix typefaces,
 * so the label cannot be measured by setting one font and asking for the width
 * of the whole string.
 */
export function charWidth(char: string, fontFamily: string, fontSize: number, weight: string) {
  const key = `${weight}|${fontSize}|${fontFamily}|${char}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = fontSize * 0.6;
  if (typeof document !== 'undefined') {
    try {
      measureCanvas ??= document.createElement('canvas');
      const ctx = measureCanvas.getContext('2d');
      if (ctx) {
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        width = ctx.measureText(char).width;
      }
    } catch {
      // Fall through to the estimate; a run still starts within a letter.
    }
  }
  widthCache.set(key, width);
  return width;
}
