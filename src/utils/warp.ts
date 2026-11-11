import { AnchorPoint, Point, VectorPath, WarpKind, WarpSpec } from '../types/vector';
import { computePathsBoundingBox } from './transform';
import { WarpBox, warpPoint } from './warpMath';

export type { WarpKind, WarpSpec } from '../types/vector';
export { warpPoint } from './warpMath';
export type { WarpBox } from './warpMath';

/**
 * Shape warps bake straight into the geometry: the points move, nothing stays
 * pending. That keeps hits, snapping, booleans and export honest — every tool
 * downstream sees the shape that is actually on screen. Type is the exception:
 * a label keeps its `warp` and bends glyph by glyph at render time, so the
 * string and the font stay editable.
 *
 * Baking alone made the Amount control destructive: each nudge bent the shape
 * that was already bent, so 10 then 20 was 30 and zero did nothing. Every bent
 * shape therefore keeps the geometry it started from, and each new amount is
 * that bend recomputed — previews included.
 */

export const WARP_KINDS: { kind: WarpKind; label: string }[] = [
  { kind: 'arc', label: 'Arc' },
  { kind: 'arch', label: 'Arch' },
  { kind: 'wave', label: 'Wave' },
  { kind: 'bulge', label: 'Bulge' },
  { kind: 'pinch', label: 'Pinch' },
  { kind: 'perspective', label: 'Slant' },
  { kind: 'flag', label: 'Flag' },
  { kind: 'rise', label: 'Rise' },
  { kind: 'fisheye', label: 'Fisheye' },
  { kind: 'inflate', label: 'Inflate' },
  { kind: 'twist', label: 'Twist' },
  { kind: 'free', label: 'Free' },
];

const warpAnchor = (point: AnchorPoint, box: WarpBox, spec: WarpSpec): AnchorPoint => {
  const moved = warpPoint(point.x, point.y, box, spec);
  return {
    ...point,
    x: moved.x,
    y: moved.y,
    handleIn: point.handleIn ? warpPoint(point.handleIn.x, point.handleIn.y, box, spec) : undefined,
    handleOut: point.handleOut
      ? warpPoint(point.handleOut.x, point.handleOut.y, box, spec)
      : undefined,
  };
};

/** Bakes the warp into copies of the paths, using an explicit warp box. */
export function warpPathsInBox(paths: VectorPath[], box: WarpBox, spec: WarpSpec): VectorPath[] {
  if (box.width <= 0 || box.height <= 0) return paths;
  if (!spec.amount && !(spec.sway ?? 0)) return paths;
  return paths.map((path) => ({
    ...path,
    points: path.points.map((point) => warpAnchor(point, box, spec)),
    ...(path.holes
      ? { holes: path.holes.map((hole) => hole.map((point) => warpAnchor(point, box, spec))) }
      : {}),
  }));
}

/** Bakes the warp into copies of the paths, sized to their own box. */
export function warpPaths(paths: VectorPath[], spec: WarpSpec): VectorPath[] {
  const box = computePathsBoundingBox(paths);
  if (!box || box.width <= 0 || box.height <= 0) return paths;
  return warpPathsInBox(paths, box, spec);
}

const sameHandle = (a?: Point, b?: Point) =>
  !a || !b ? a === b : Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

const sameContour = (a: AnchorPoint[], b: AnchorPoint[]) =>
  a.length === b.length &&
  a.every(
    (point, index) =>
      Math.abs(point.x - b[index].x) < 1e-6 &&
      Math.abs(point.y - b[index].y) < 1e-6 &&
      sameHandle(point.handleIn, b[index].handleIn) &&
      sameHandle(point.handleOut, b[index].handleOut)
  );

const sameGeometry = (a: VectorPath, b: VectorPath) =>
  sameContour(a.points, b.points) &&
  (a.holes?.length ?? 0) === (b.holes?.length ?? 0) &&
  (a.holes ?? []).every((hole, index) => sameContour(hole, (b.holes ?? [])[index] ?? []));

/**
 * The geometry a warp should start from.
 *
 * A stored source is only trusted while it still explains what is on screen:
 * regenerating the bend from it has to reproduce the current points exactly.
 * If something else edited the shape — a node dragged, a boolean, a simplify —
 * the source is stale, and the shape as it stands becomes the new starting
 * point rather than snapping back to geometry the user has moved past.
 */
export function preWarpGeometry(path: VectorPath): VectorPath {
  const source = path.warpSource;
  if (!source) return path;
  const candidate: VectorPath = { ...path, points: source.points, holes: source.holes };
  const regenerated = warpPathsInBox([candidate], source.box, source.spec)[0];
  if (!sameGeometry(regenerated, path)) return path;
  const restored = { ...path, points: source.points };
  if (source.holes) restored.holes = source.holes;
  else delete (restored as { holes?: AnchorPoint[][] }).holes;
  return restored;
}

/**
 * Bends the whole selection from scratch against one shared box — the same box
 * and the same starting geometry the live preview uses — and records what it
 * started from.
 */
export function applyShapeWarp(paths: VectorPath[], spec: WarpSpec): VectorPath[] {
  if (!spec.amount && !(spec.sway ?? 0)) return clearShapeWarp(paths);
  const bases = paths.map(preWarpGeometry);
  const box = computePathsBoundingBox(bases);
  if (!box || box.width <= 0 || box.height <= 0) return paths;
  return bases.map((base) => {
    const warped = warpPathsInBox([base], box, spec)[0];
    return {
      ...warped,
      warpSource: {
        points: base.points,
        ...(base.holes ? { holes: base.holes } : {}),
        box,
        spec: { ...spec },
      },
    };
  });
}

/** Puts the pre-warp geometry back and forgets the bend. */
export function clearShapeWarp(paths: VectorPath[]): VectorPath[] {
  return paths.map((path) => {
    if (!path.warpSource) return path;
    const restored = preWarpGeometry(path);
    const cleared = { ...restored };
    delete (cleared as { warpSource?: unknown }).warpSource;
    return cleared;
  });
}
