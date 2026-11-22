import type { TextRange, VectorPath } from '../types/vector';
import { measureLineOffsets, textLineStarts, textLines } from './textGeometry';

/**
 * Part of a word, styled without converting it: a label keeps its string, and a
 * range says which characters paint differently. Indices are into the label's
 * whole text, newlines included, so editing the text later can only leave a
 * range covering characters that still exist.
 */

export interface TextRun {
  text: string;
  /** null means the label's own fill */
  fill: string | null;
  /** x of the run's first character, in the label's local space */
  x: number;
}

/** Clamps to the string, drops empties, and joins neighbours that share a fill. */
export function normalizeTextRanges(
  ranges: TextRange[] | undefined,
  length: number
): TextRange[] | undefined {
  const cleaned = (ranges ?? [])
    .filter((range) => !!range.fill)
    .map((range) => ({
      fill: range.fill,
      start: Math.max(0, Math.min(length, Math.round(range.start))),
      end: Math.max(0, Math.min(length, Math.round(range.end))),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (!cleaned.length) return undefined;

  const merged: TextRange[] = [];
  for (const range of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.fill === range.fill && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function fillAt(ranges: TextRange[] | undefined, index: number): string | null {
  if (!ranges?.length) return null;
  for (const range of ranges) {
    if (index >= range.start && index < range.end) return range.fill ?? null;
  }
  return null;
}

/**
 * Each line cut into runs that share one paint, with the x each run starts at.
 * The x comes from the same measurement the label itself is laid out with, so a
 * run starts exactly on its character rather than near it.
 */
export function textRuns(path: VectorPath): TextRun[][] {
  const lines = textLines(path.text);
  const starts = textLineStarts(path);
  const ranges = path.textRanges;
  const metrics = {
    fontSize: path.fontSize,
    fontFamily: path.fontFamily,
    fontWeight: path.fontWeight,
    letterSpacing: path.letterSpacing,
  };

  let absolute = 0;
  return lines.map((line, lineIndex) => {
    const offsets = ranges?.length ? measureLineOffsets(line, metrics) : [];
    const lineStart = starts[lineIndex] ?? 0;
    const runs: TextRun[] = [];
    for (let index = 0; index < line.length; index += 1) {
      const fill = fillAt(ranges, absolute + index);
      const x = lineStart + (offsets[index] ?? 0);
      const last = runs[runs.length - 1];
      if (last && last.fill === fill) last.text += line[index];
      else runs.push({ text: line[index], fill, x });
    }
    absolute += line.length + 1; // the newline between lines
    return runs;
  });
}

/** True when at least one character actually paints differently. */
export function hasRangedFill(path: VectorPath): boolean {
  return !!path.textRanges?.length && path.textRanges.some((range) => !!range.fill);
}
