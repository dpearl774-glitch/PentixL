import { pathToPolygon } from './bezier';
import { measureTextMetrics, textLineHeight } from './textGeometry';
import type { VectorPath } from '../types/vector';

/**
 * Type inside a shape, the way Illustrator's "Type in shape" works: the words
 * wrap to the width the shape has at that height, every line starts at the
 * shape's own left edge, and the block stops before it leaves the outline.
 */
export interface TextInShapeLayout {
  /** The wrapped string, one line per entry */
  text: string;
  lines: string[];
  /** Each line's left edge, measured from the label's origin x */
  lineX: number[];
  /** Origin x for the label, in artboard space */
  originX: number;
  /** Baseline of the first line, in artboard space */
  baseline: number;
}

/**
 * The horizontal span the outline covers at one height. Concave shapes report
 * their widest extent, which keeps the block inside the shape without needing
 * a full inside test on every word.
 */
function spanAt(polygon: [number, number][], y: number): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[(index + 1) % polygon.length];
    if (y1 === y2) continue;
    const low = Math.min(y1, y2);
    const high = Math.max(y1, y2);
    // A half-open test, so a vertex shared by two edges is counted once.
    if (y < low || y >= high) continue;
    const t = (y - y1) / (y2 - y1);
    const x = x1 + (x2 - x1) * t;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return min === Infinity ? null : [min, max];
}

export function textInShapeLayout(
  shape: VectorPath,
  label: VectorPath,
  text: string
): TextInShapeLayout | null {
  const polygon = pathToPolygon(shape, 24);
  if (polygon.length < 3) return null;

  const ys = polygon.map((point) => point[1]);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  const size = Math.max(1, label.fontSize || 48);
  const metrics = measureTextMetrics({
    text: 'Hxg',
    fontSize: size,
    fontFamily: label.fontFamily,
    fontWeight: label.fontWeight,
    letterSpacing: label.letterSpacing,
  });
  const lineHeight = textLineHeight(size);
  // Padding keeps ink off the outline; it scales with the type, not the shape.
  const pad = Math.max(2, size * 0.08);

  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const lines: string[] = [];
  const lineX: number[] = [];
  let baseline = top + metrics.ascent + pad;
  let firstBaseline = 0;
  let cursor = 0;

  while (cursor < words.length && baseline + metrics.descent <= bottom - pad * 0.5) {
    // Measure where the line will sit, not where its baseline sits: on a circle
    // the width changes a lot over one line's height.
    const band = baseline - metrics.ascent * 0.55;
    const span = spanAt(polygon, band) ?? spanAt(polygon, band - metrics.ascent * 0.3);
    if (!span) {
      baseline += lineHeight;
      continue;
    }
    const left = span[0] + pad;
    const width = span[1] - pad - left;
    if (width < size * 0.8) {
      baseline += lineHeight;
      continue;
    }

    let line = '';
    while (cursor < words.length) {
      const candidate = line ? `${line} ${words[cursor]}` : words[cursor];
      const candidateWidth = measureTextMetrics({
        text: candidate,
        fontSize: size,
        fontFamily: label.fontFamily,
        fontWeight: label.fontWeight,
        letterSpacing: label.letterSpacing,
      }).width;
      // Always keep one word per line, even if it overhangs a narrow band.
      if (line && candidateWidth > width) break;
      line = candidate;
      cursor += 1;
      if (candidateWidth > width) break;
    }
    if (!line) break;
    if (!lines.length) firstBaseline = baseline;
    lines.push(line);
    lineX.push(left);
    baseline += lineHeight;
  }

  if (!lines.length) return null;
  const originX = Math.min(...lineX);
  return {
    text: lines.join('\n'),
    lines,
    lineX: lineX.map((x) => x - originX),
    originX,
    baseline: firstBaseline,
  };
}
