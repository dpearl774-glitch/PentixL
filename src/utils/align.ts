import { VectorPath } from '../types/vector';
import { BoundingBox, computePathsBoundingBox, translatePaths } from './transform';

/** Which edge or centre every selected object lines up with. */
export type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

const move = (path: VectorPath, dx: number, dy: number): VectorPath =>
  Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 ? path : translatePaths([path], dx, dy)[0];

/**
 * Lines objects up against a frame. One object aligns to the artboard, several
 * align to their shared bounds — the two behaviours a logo actually needs, and
 * the reason dragging until it looks close enough is no longer necessary.
 */
export function alignPaths(
  paths: VectorPath[],
  mode: AlignMode,
  frame: BoundingBox
): VectorPath[] {
  return paths.map((path) => {
    const box = computePathsBoundingBox([path]);
    if (!box) return path;

    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left':
        dx = frame.minX - box.minX;
        break;
      case 'center-x':
        dx = frame.centerX - box.centerX;
        break;
      case 'right':
        dx = frame.maxX - box.maxX;
        break;
      case 'top':
        dy = frame.minY - box.minY;
        break;
      case 'center-y':
        dy = frame.centerY - box.centerY;
        break;
      case 'bottom':
        dy = frame.maxY - box.maxY;
        break;
    }
    return move(path, dx, dy);
  });
}

/**
 * Equal gaps between neighbouring objects. The outermost two stay put, so the
 * arrangement keeps its footprint instead of collapsing toward the middle.
 */
export function distributePaths(paths: VectorPath[], axis: DistributeAxis): VectorPath[] {
  if (paths.length < 3) return paths;

  const horizontal = axis === 'horizontal';
  const entries = paths
    .map((path) => ({ path, box: computePathsBoundingBox([path]) }))
    .filter((entry): entry is { path: VectorPath; box: BoundingBox } => !!entry.box);

  if (entries.length < 3) return paths;

  const startEdge = (box: BoundingBox) => (horizontal ? box.minX : box.minY);
  const endEdge = (box: BoundingBox) => (horizontal ? box.maxX : box.maxY);
  const size = (box: BoundingBox) => (horizontal ? box.width : box.height);

  const sorted = [...entries].sort((a, b) => startEdge(a.box) - startEdge(b.box));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = endEdge(last.box) - startEdge(first.box);
  const occupied = sorted.reduce((sum, entry) => sum + size(entry.box), 0);
  const gap = (span - occupied) / (sorted.length - 1);

  const shifted = new Map<string, VectorPath>();
  let cursor = startEdge(first.box);
  for (const entry of sorted) {
    const delta = cursor - startEdge(entry.box);
    shifted.set(
      entry.path.id,
      move(entry.path, horizontal ? delta : 0, horizontal ? 0 : delta)
    );
    cursor += size(entry.box) + gap;
  }

  return paths.map((path) => shifted.get(path.id) ?? path);
}
