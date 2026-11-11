import type { VectorPath } from '../types/vector';
import { fontOutlinePaths, fontOutlinePathsOnPath, matchesOutlineWeight } from './fontOutlines';
import { textPathDy, textPathSource } from './textPath';

/**
 * Outlines for the labels whose geometry is not a plain line of type.
 *
 * Type on a path follows another object, and area type starts each line at the
 * shape's own left edge. Both already know their layout on the object itself —
 * the path id and the per-line offsets are stored with the label — so baking
 * has to read those instead of laying the string out as a straight line.
 *
 * Returns null for ordinary labels, and for a font whose bytes we cannot read:
 * there the caller keeps its own fallback.
 */
export function outlineLayoutText(
  label: VectorPath,
  resolve: (id: string) => VectorPath | null
): VectorPath[] | null {
  const text = label.text ?? '';
  if (!text.trim()) return null;

  const common = {
    text,
    fontSize: label.fontSize || 64,
    letterSpacing: label.letterSpacing ?? 0,
    fontFamily: label.fontFamily,
    fontWeight: label.fontWeight,
    fillColor: label.fill,
    strokeColor: label.stroke === 'none' ? 'none' : label.stroke,
    strokeWidth: label.strokeWidth || 0,
  };

  if (label.textPath) {
    if (!matchesOutlineWeight(label.fontFamily, label.fontWeight)) return null;
    const target = resolve(label.textPath.pathId);
    if (!target) return null;
    return fontOutlinePathsOnPath({
      ...common,
      target: textPathSource(label, target),
      offsetPercent: label.textPath.offset ?? 0,
      dy: textPathDy(label),
    });
  }

  // Area type carries its own wrapped lines, exactly as the canvas draws them.
  if (label.textLineX?.length) {
    const origin = label.points[0] ?? { x: 0, y: 0 };
    return fontOutlinePaths({
      ...common,
      lineX: label.textLineX,
      originX: origin.x,
      originY: origin.y,
      matrix: label.textMatrix,
    });
  }

  return null;
}
