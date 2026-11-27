import type { TextRange, VectorPath } from '../types/vector';
import { textLineStarts, textLines } from './textGeometry';
import { charWidth, styleAt } from './textRangeStyle';

export { styleAt } from './textRangeStyle';

export function fillAt(ranges: TextRange[] | undefined, index: number): string | null {
  return styleAt(ranges, index).fill;
}

export function fontAt(ranges: TextRange[] | undefined, index: number): string | null {
  return styleAt(ranges, index).fontFamily;
}

/**
 * Part of a word, styled without converting it: a label keeps its string, and a
 * range says which characters paint — and read — differently. Indices are into
 * the label's whole text, newlines included, so editing the text later can only
 * leave a range covering characters that still exist.
 */

type GraphemeSegmenter = { segment(text: string): Iterable<{ index: number; segment: string }> };

/** Grapheme segmentation when the browser has it, kept off the hot path. */
const graphemeSegmenter = (() => {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (locales?: string, options?: { granularity: 'grapheme' }) => GraphemeSegmenter;
    }
  ).Segmenter;
  return Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;
})();

/**
 * A label's letters as a reader counts them: one entry per grapheme, carrying
 * the index it starts at in the same string the ranges count in. An emoji stays
 * one letter although it spans two units, and an accent that arrives as its own
 * character travels with the letter it sits on.
 */
export function graphemeLetters(text: string): { index: number; char: string }[] {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (part) => ({
      index: part.index,
      char: part.segment,
    }));
  }
  const letters: { index: number; char: string }[] = [];
  let index = 0;
  for (const char of text) {
    letters.push({ index, char });
    index += char.length;
  }
  return letters;
}

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
