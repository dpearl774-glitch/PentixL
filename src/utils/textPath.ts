import { AnchorPoint, VectorPath } from '../types/vector';

/**
 * Type on a path, the way Illustrator's Type on a Path Options behave: the
 * string runs along the outline, the outline decides the direction, and the
 * text can sit on the baseline, be centred on the line, or hang above/below it.
 */

export type TextPathAlign = 'baseline' | 'center' | 'ascender' | 'descender';

export const TEXT_PATH_ALIGNS: { align: TextPathAlign; label: string }[] = [
  { align: 'baseline', label: 'Baseline' },
  { align: 'center', label: 'Centre' },
  { align: 'ascender', label: 'Top' },
  { align: 'descender', label: 'Bottom' },
];

/** How far the baseline moves per align mode, in ems of the label's size. */
const ALIGN_EM: Record<TextPathAlign, number> = {
  baseline: 0,
  center: 0.32,
  ascender: 0.72,
  descender: -0.21,
};

/**
 * Baseline shift for a label on a path: the user's own nudge plus the offset
 * its align mode asks for. One number feeds the canvas, the exporter and the
 * thumbnail, so the three can never disagree.
 */
export function textPathDy(path: VectorPath): number {
  const settings = path.textPath;
  if (!settings) return 0;
  const em = ALIGN_EM[settings.align ?? 'baseline'] ?? 0;
  return (settings.baselineOffset ?? 0) + em * (path.fontSize || 48);
}

/** Reverses an anchor list, swapping the handles so the curve is unchanged. */
export function reversedAnchors(points: AnchorPoint[]): AnchorPoint[] {
  return [...points].reverse().map((point) => ({
    ...point,
    handleIn: point.handleOut,
    handleOut: point.handleIn,
  }));
}

/**
 * The outline a label actually follows. Reversing the point order flips the
 * direction of travel, which is how text is moved to the other side of a path
 * — the geometry itself stays exactly where it was drawn.
 */
export function textPathSource(path: VectorPath, target: VectorPath): VectorPath {
  if (!path.textPath?.reverse) return target;
  return { ...target, points: reversedAnchors(target.points) };
}
