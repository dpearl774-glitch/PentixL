import type { Guide } from '../types/vector';
import type { BoundingBox } from './transform';

/** A line the drag landed on, so the canvas can draw what it snapped to. */
export interface SnapLine {
  orientation: 'vertical' | 'horizontal';
  coordinate: number;
}

export interface SnapOptions {
  /** Snap to the grid lines */
  grid: boolean;
  /** Snap to the guides the user pulled off a ruler */
  guides: boolean;
  spacingX: number;
  spacingY: number;
  /**
   * How close a guide has to be, in artboard units. The grid needs none: with
   * snapping on, the nearest line is the answer whether it is one unit away or
   * twelve, and a tolerance would strand an object that started off the grid.
   */
  tolerance: number;
}

/** Nearest multiple of `spacing`. */
function gridTarget(value: number, spacing: number): number | null {
  if (!(spacing > 0)) return null;
  return Math.round(value / spacing) * spacing;
}

/** Closest guide to any of `values`, with the offset that lands on it. */
function guideTarget(
  values: number[],
  guides: Guide[],
  axis: 'v' | 'h',
  tolerance: number
): { delta: number; coordinate: number } | null {
  let best: { delta: number; coordinate: number } | null = null;
  for (const guide of guides) {
    if (guide.axis !== axis) continue;
    for (const value of values) {
      const delta = guide.position - value;
      if (Math.abs(delta) > tolerance) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = { delta, coordinate: guide.position };
      }
    }
  }
  return best;
}

/**
 * The offset that puts one edge or the centre of something on a guide, or
 * failing that on the nearest grid line. A guide wins: it was placed on
 * purpose, so a coarser grid must not pull the object off it.
 */
function axisAdjust(
  values: number[],
  guides: Guide[],
  axis: 'v' | 'h',
  spacing: number,
  options: SnapOptions
): { delta: number; line: SnapLine | null } {
  if (options.guides) {
    const hit = guideTarget(values, guides, axis, options.tolerance);
    if (hit) {
      return {
        delta: hit.delta,
        line: {
          orientation: axis === 'v' ? 'vertical' : 'horizontal',
          coordinate: hit.coordinate,
        },
      };
    }
  }
  if (options.grid) {
    let best: number | null = null;
    for (const value of values) {
      const target = gridTarget(value, spacing);
      if (target === null) continue;
      const delta = target - value;
      if (best === null || Math.abs(delta) < Math.abs(best)) best = delta;
    }
    if (best !== null) return { delta: best, line: null };
  }
  return { delta: 0, line: null };
}

/**
 * Where a dragged selection should actually sit. Edges and centres are all
 * tested, because a shape lined up by its middle is as snapped as one lined up
 * by its side.
 */
export function snapBoxMove(
  box: BoundingBox,
  dx: number,
  dy: number,
  guides: Guide[],
  options: SnapOptions
): { dx: number; dy: number; lines: SnapLine[] } {
  const x = axisAdjust(
    [box.minX + dx, box.centerX + dx, box.maxX + dx],
    guides,
    'v',
    options.spacingX,
    options
  );
  const y = axisAdjust(
    [box.minY + dy, box.centerY + dy, box.maxY + dy],
    guides,
    'h',
    options.spacingY,
    options
  );
  return {
    dx: dx + x.delta,
    dy: dy + y.delta,
    lines: [x.line, y.line].filter((line): line is SnapLine => line !== null),
  };
}

/** The same rule for the one point a resize handle is dragging. */
export function snapPoint(
  point: { x: number; y: number },
  guides: Guide[],
  options: SnapOptions
): { x: number; y: number; lines: SnapLine[] } {
  const x = axisAdjust([point.x], guides, 'v', options.spacingX, options);
  const y = axisAdjust([point.y], guides, 'h', options.spacingY, options);
  return {
    x: point.x + x.delta,
    y: point.y + y.delta,
    lines: [x.line, y.line].filter((line): line is SnapLine => line !== null),
  };
}

/**
 * A grid line and a guide are both axis-aligned, so the only turn either one
 * can describe is a quarter turn: the box lands square to the board when the
 * angle is close, and keeps the free angle when it is not.
 */
export function snapAngleToAxes(angle: number, toleranceDeg: number): number {
  const step = Math.PI / 2;
  const target = Math.round(angle / step) * step;
  return Math.abs(target - angle) <= (toleranceDeg * Math.PI) / 180 ? target : angle;
}
