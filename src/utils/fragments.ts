import type { Layer, VectorPath } from '../types/vector';

/**
 * Below this many square artboard units a filled shape cannot be seen or
 * tapped on the board. Boolean operations leave these hairline slivers where
 * two edges almost meet, and they survive in the document as real objects.
 */
const SLIVER_AREA = 0.75;

/** Area of the anchor polygon; handles only change the edges, not the sliver. */
function anchorArea(path: VectorPath): number {
  const points = path.points;
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return Math.abs(sum) / 2;
}

function hasVisibleStroke(path: VectorPath): boolean {
  return !!path.stroke && path.stroke !== 'none' && (path.strokeWidth ?? 0) > 0;
}

/**
 * True for artwork that is present but cannot be seen: empty paths, closed
 * shapes with no usable outline, and slivers of negligible area. Text runs,
 * masks and clipped objects are never fragments — they can be small or empty
 * and still be intentional.
 */
export function isInvisibleFragment(path: VectorPath): boolean {
  if (path.text || path.isClippingMask || path.clipPathId) return false;
  const points = path.points ?? [];
  if (points.length === 0) return true;
  // An open path is a stroke, whatever its anchors look like.
  if (!path.closed) return false;
  if (hasVisibleStroke(path)) return false;
  if (points.length < 3) return true;
  return anchorArea(path) < SLIVER_AREA;
}

/**
 * Removes invisible fragments from every layer. Layers with nothing to remove
 * come back as the same object, so the document identity is preserved when the
 * document is already clean.
 */
export function stripInvisibleFragments(layers: Layer[]): {
  layers: Layer[];
  removed: number;
} {
  let removed = 0;
  const next = layers.map((layer) => {
    const kept = layer.paths.filter((path) => {
      if (!isInvisibleFragment(path)) return true;
      removed += 1;
      return false;
    });
    return kept.length === layer.paths.length ? layer : { ...layer, paths: kept };
  });
  return removed ? { layers: next, removed } : { layers, removed: 0 };
}
