import type { TextRange, VectorPath } from '../types/vector';
import { textLineStarts, textLines } from './textGeometry';

/**
 * Part of a word, styled without converting it: a label keeps its string, and a
 * range says which characters paint — and read — differently. Indices are into
 * the label's whole text, newlines included, so editing the text later can only
 * leave a range covering characters that still exist.
 */

export interface TextRun {
  text: string;
  /** null means the label's own fill */
  fill: string | null;
  /** null means the label's own typeface */
  fontFamily: string | null;
  /** x of the run's first character, in the label's local space */
  x: number;
}

interface RangeStyle {
  fill: string | null;
  fontFamily: string | null;
}

const sameStyle = (a: RangeStyle, b: RangeStyle) =>
  a.fill === b.fill && a.fontFamily === b.fontFamily;

/** Clamps to the string, drops empties, and joins neighbours that share a style. */
export function normalizeTextRanges(
  ranges: TextRange[] | undefined,
  length: number
): TextRange[] | undefined {
  const cleaned = (ranges ?? [])
    .filter((range) => !!(range.fill || range.fontFamily))
    .map((range) => ({
      fill: range.fill,
      fontFamily: range.fontFamily,
      start: Math.max(0, Math.min(length, Math.round(range.start))),
      end: Math.max(0, Math.min(length, Math.round(range.end))),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (!cleaned.length) return undefined;

  const merged: TextRange[] = [];
  for (const range of cleaned) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.fill === range.fill &&
      last.fontFamily === range.fontFamily &&
      range.start <= last.end
    ) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/** The style a character carries: its range, or the label's own */
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

export function fillAt(ranges: TextRange[] | undefined, index: number): string | null {
  return styleAt(ranges, index).fill;
}

export function fontAt(ranges: TextRange[] | undefined, index: number): string | null {
  return styleAt(ranges, index).fontFamily;
}

let measureCanvas: HTMLCanvasElement | null = null;
const widthCache = new Map<string, number>();

/**
 * Width of one character in the font that character is drawn in. Ranges can mix
 * typefaces on one line, so a run's start cannot be read off the label's own
 * font — each stretch advances by its own letters.
 */
function charWidth(char: string, fontFamily: string, fontSize: number, weight: string) {
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

/** Each line cut into runs that share one style, with the x each run starts at. */
export function textRuns(
  path: VectorPath,
  weight = path.fontWeight || 'bold'
): TextRun[][] {
  const lines = textLines(path.text);
  const starts = textLineStarts(path);
  const ranges = path.textRanges;
  const size = path.fontSize || 64;
  const letterSpacing = path.letterSpacing ?? 0;

  let absolute = 0;
  return lines.map((line, lineIndex) => {
    const runs: TextRun[] = [];
    let x = starts[lineIndex] ?? 0;
    for (let index = 0; index < line.length; index += 1) {
      const style = styleAt(ranges, absolute + index);
      const last = runs[runs.length - 1];
      if (last && sameStyle(last, style)) {
        last.text += line[index];
      } else {
        runs.push({ text: line[index], fill: style.fill, fontFamily: style.fontFamily, x });
      }
      x += charWidth(line[index], style.fontFamily ?? path.fontFamily ?? 'sans-serif', size, weight) + letterSpacing;
    }
    absolute += line.length + 1; // the newline between lines
    return runs;
  });
}

/** True when at least one character carries a style of its own. */
export function hasTextRanges(path: VectorPath): boolean {
  return !!path.textRanges?.length;
}
