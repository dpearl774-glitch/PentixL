import type { AnchorPoint, VectorPath } from '../types/vector';
import { pathToPolygon } from './bezier';

/**
 * Offset Path, the Illustrator command: outline the object at a distance,
 * keeping the original. Positive grows, negative insets, holes move against the
 * outline so a ring stays a ring instead of filling in.
 *
 * Curves are sampled once and offset as a polygon. That is what the tool needs
 * in practice — the result is then rebuilt with Build or Pathfinder — and it
 * avoids the self-intersection bookkeeping of a true offset curve.
 */

/** Longer mitres than this are cut off: a sharp point would spike to infinity. */
const MITER_LIMIT = 2.6;
/** Below this the two edges fold back on each other; bevel instead. */
const MIN_MITER_COS = 0.35;
const STEPS_PER_CURVE = 18;

type Ring = [number, number][];

function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    sum += ax * by - bx * ay;
  }
  return sum / 2;
}

/** Drops the repeated closing point and any near-duplicates polygon clippers emit. */
function cleanRing(ring: Ring): Ring {
  const out: Ring = [];
  for (const point of ring) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const last = out[out.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.01) continue;
    out.push(point);
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.01) out.pop();
  }
  return out;
}

/**
 * Offsets one closed ring. `distance` is signed along the ring's outward
 * normal, where outward means away from its own interior — so the same call
 * with a negative distance insets, and a hole passed with a negated distance
 * shrinks as its shape grows.
 */
function offsetRing(input: Ring, distance: number): Ring {
  const ring = cleanRing(input);
  if (ring.length < 3) return [];
  // In a y-down coordinate system a positive signed area winds clockwise, and
  // the right-hand normal of travel points out of the shape.
  const side = signedArea(ring) >= 0 ? 1 : -1;

  const normalOf = (a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) return null;
    return { x: (dy / length) * side, y: (-dx / length) * side };
  };

  const out: Ring = [];
  for (let i = 0; i < ring.length; i += 1) {
    const previous = ring[(i - 1 + ring.length) % ring.length];
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    const before = normalOf(previous, current);
    const after = normalOf(current, next);
    if (!before || !after) continue;

    const sumX = before.x + after.x;
    const sumY = before.y + after.y;
    const sumLength = Math.hypot(sumX, sumY);
    // A hairpin has no usable mitre: treat it as two bevel corners.
    const cosHalf = sumLength > 1e-6 ? (sumX * before.x + sumY * before.y) / sumLength : 0;

    if (sumLength < 1e-6 || cosHalf < MIN_MITER_COS) {
      out.push([current[0] + before.x * distance, current[1] + before.y * distance]);
      out.push([current[0] + after.x * distance, current[1] + after.y * distance]);
      continue;
    }

    const miterX = sumX / sumLength;
    const miterY = sumY / sumLength;
    const scale = distance / cosHalf;
    if (Math.abs(scale) > Math.abs(distance) * MITER_LIMIT) {
      out.push([current[0] + before.x * distance, current[1] + before.y * distance]);
      out.push([current[0] + after.x * distance, current[1] + after.y * distance]);
      continue;
    }
    out.push([current[0] + miterX * scale, current[1] + miterY * scale]);
  }

  return cleanRing(out);
}

function ringToAnchors(ring: Ring, prefix: string): AnchorPoint[] {
  return ring.map((point, index) => ({
    id: `${prefix}-${index}`,
    x: point[0],
    y: point[1],
    type: 'corner' as const,
  }));
}

/** True when the object has an interior that can be outlined. */
function canOffset(path: VectorPath): boolean {
  return !!path.closed && !path.text && path.points.length >= 3;
}

/**
 * Outlines each path at `distance` and returns the new objects. Originals are
 * left alone, exactly like Illustrator, so an offset can be compared against
 * the artwork it came from.
 */
export function offsetPaths(paths: VectorPath[], distance: number): VectorPath[] {
  if (!Number.isFinite(distance) || Math.abs(distance) < 0.01) return [];

  const result: VectorPath[] = [];
  for (const path of paths) {
    if (!canOffset(path)) continue;

    const outer = offsetRing(pathToPolygon(path, STEPS_PER_CURVE), distance);
    if (outer.length < 3) continue;

    // A hole moves against the outline: a ring gets thicker, not filled in.
    const holes = (path.holes ?? [])
      .map((hole) => offsetRing(pathToPolygon({ points: hole, closed: true } as VectorPath, STEPS_PER_CURVE), -distance))
      .filter((ring) => ring.length >= 3);

    const id = `${path.id}-offset-${result.length}-${Math.random().toString(36).slice(2, 6)}`;
    result.push({
      ...path,
      id,
      name: `${path.name} ${distance > 0 ? 'offset' : 'inset'}`,
      points: ringToAnchors(outer, `${id}-p`),
      ...(holes.length ? { holes: holes.map((ring, index) => ringToAnchors(ring, `${id}-h${index}`)) } : { holes: undefined }),
      closed: true,
      clipPathId: undefined,
      isClippingMask: false,
      cornerRadius: undefined,
      cornerRadii: undefined,
      cornerSource: undefined,
    });
  }
  return result;
}
