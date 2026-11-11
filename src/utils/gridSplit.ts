import polygonClipping from 'polygon-clipping';
import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { visibleClippingGeometry } from './shapeBuilder';
import { simplifyPoints } from './contourTracer';

type Ring = [number, number][];

/**
 * Turns one boolean-output ring into corner anchors. A grid cell is a cut, not
 * a re-fit: smoothing it the way Pathfinder results are smoothed would round
 * the straight edges that make a split readable as a grid.
 */
function ringToCornerAnchors(ring: Ring, idPrefix: string, tolerance: number): AnchorPoint[] {
  const closes =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const count = closes ? ring.length - 1 : ring.length;
  if (count < 3) return [];

  const raw: Point[] = [];
  for (let i = 0; i < count; i += 1) raw.push({ x: ring[i][0], y: ring[i][1] });
  const reduced = raw.length > 4 ? simplifyPoints(raw, tolerance) : raw;
  const usable = reduced.length >= 3 ? reduced : raw;

  return usable.map((point, index) => ({
    id: `${idPrefix}-${index}`,
    x: point.x,
    y: point.y,
    type: 'corner' as const,
  }));
}

export interface GridSplitOptions {
  rows: number;
  cols: number;
  /** Empty space kept between cells, in artboard units */
  gutter?: number;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function geometryBounds(geometry: ReturnType<typeof visibleClippingGeometry>): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of geometry) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity || maxX <= minX || maxY <= minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Cuts every selected object into a rows × cols grid of separate closed shapes.
 * Each cell is the intersection of the object's visible geometry with that cell
 * of its bounding box, so circles split into curved wedges rather than squares,
 * and clipped objects split only what is actually shown. This is the logo
 * construction step: split a mark, then rebuild it with Build or Pathfinder.
 */
export function splitPathsIntoGrid(
  paths: VectorPath[],
  allPaths: VectorPath[],
  options: GridSplitOptions
): VectorPath[] {
  const rows = Math.max(1, Math.min(24, Math.round(options.rows)));
  const cols = Math.max(1, Math.min(24, Math.round(options.cols)));
  if (rows * cols < 2) return [];
  const gutter = Math.max(0, options.gutter ?? 0);

  const byId = new Map(allPaths.map((path) => [path.id, path]));
  const result: VectorPath[] = [];

  for (const path of paths) {
    if (path.text || path.isClippingMask) continue;

    const geometry = visibleClippingGeometry(path, byId);
    const bounds = geometryBounds(geometry);
    if (!bounds || geometry.length === 0) continue;

    const cellW = (bounds.maxX - bounds.minX) / cols;
    const cellH = (bounds.maxY - bounds.minY) / rows;
    if (cellW <= 0 || cellH <= 0) continue;

    const inset = Math.min(gutter / 2, cellW / 3, cellH / 3);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cell: Ring = [
          [bounds.minX + col * cellW + inset, bounds.minY + row * cellH + inset],
          [bounds.minX + (col + 1) * cellW - inset, bounds.minY + row * cellH + inset],
          [bounds.minX + (col + 1) * cellW - inset, bounds.minY + (row + 1) * cellH - inset],
          [bounds.minX + col * cellW + inset, bounds.minY + (row + 1) * cellH - inset],
        ];

        let pieces;
        try {
          pieces = polygonClipping.intersection([cell], geometry);
        } catch {
          continue;
        }

        for (const piece of pieces) {
          const outer = piece[0];
          if (!outer || outer.length < 3) continue;

          const idPrefix = `${path.id}-grid-${row}-${col}`;
          const points = ringToCornerAnchors(outer, `${idPrefix}-p`, 0.35);
          if (points.length < 3) continue;

          const holes = piece
            .slice(1)
            .map((ring, index) => ringToCornerAnchors(ring, `${idPrefix}-h${index}`, 0.35))
            .filter((ring) => ring.length >= 3);

          result.push({
            ...path,
            id: `${idPrefix}-${result.length}-${Math.random().toString(36).slice(2, 6)}`,
            name: `${path.name} ${row + 1}·${col + 1}`,
            points,
            ...(holes.length ? { holes } : { holes: undefined }),
            closed: true,
            // The cut is already the visible geometry, so no mask can survive it.
            clipPathId: undefined,
            isClippingMask: false,
            cornerRadius: undefined,
            cornerRadii: undefined,
            cornerSource: undefined,
          });
        }
      }
    }
  }

  return result;
}
