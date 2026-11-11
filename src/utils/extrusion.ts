import type { AnchorPoint, Point, VectorPath } from '../types/vector';
import type { BoundingBox } from './transform';
import { pathToPolygon } from './bezier';

export const DEFAULT_EXTRUDE_ANGLE = 45;
/** Back-face shrink used when a path has no stored taper: a little perspective. */
export const DEFAULT_EXTRUDE_TAPER = 0.16;

/** Hard ceiling on wall segments for one object so traced art cannot stall the view. */
const MAX_WALL_SEGMENTS = 240;
/**
 * The key light sits in the room, not on the object: turning the solid must turn
 * it under a fixed light. It used to be derived from the pull angle (angle - 55),
 * which meant every change of direction re-lit the object the same way and the
 * solid read as sliding instead of rotating.
 */
const DEFAULT_EXTRUDE_LIGHT = 305;
/** Lambert value of a facet facing fully away from the light. */
const LIGHT_FLOOR = -0.62;
/** Flat facets used to approximate a smooth Lambert ramp around the silhouette. */
const SHADE_STEPS = 20;
// Walls must still read as the object's own material: below ~0.55 they turn
// black and the solid looks like a shadow instead of a painted surface.
const SHADE_FLOOR = 0.58;
const SHADE_CEILING = 1.02;
/**
 * A wall is one facet, built in a single quad from its front edge to its back
 * edge. Slicing it into depth bands painted parallel tone steps straight across
 * the solid, which is exactly what reads as a stack of flat cards — and no
 * amount of overlap hides a step, because each band is its own painted path. The
 * recede is one mid-depth tone now, so the lit and shaded facets alone describe
 * the body and the wall itself is continuous.
 */
const DEPTH_BANDS = 1;
/** How much darker the far edge of a wall is than the edge at the front face. */
const DEPTH_FALLOFF = 0.15;
/** Tone buckets around a chamfered front rim. */
const BEVEL_TONE_STEPS = 6;
/** Default chamfer width for an object that has never been beveled. */
export const DEFAULT_EXTRUDE_BEVEL = 7;
const MAX_BEVEL = 26;
/**
 * Rings across a round rim. Two is the ceiling: every extra ring is its own
 * tone band around the edge, and five of them read as stacked rims.
 */
const BEVEL_RINGS = 2;
/** Front-face highlight strength when the object has no stored gloss. */
export const DEFAULT_EXTRUDE_GLOSS = 0.18;
/** Points closer than this to their chord are curve-sampling noise. */
const SIMPLIFY_TOLERANCE = 0.08;
/** Beyond this the back face would collapse through itself. */
const MAX_TAPER = 0.45;

export interface ExtrusionFace {
  /** Wall quads sharing this tone, as one path. */
  d: string;
  /** Wall colour derived from the object's own fill. */
  fill: string;
  /** Back cap, side wall or front chamfer — bevels paint last. */
  part: 'cap' | 'wall' | 'bevel';
}

export interface ExtrusionShadow {
  id: string;
  /** Back silhouette; draw it with the face inside one blurred group. */
  d: string;
  blur: number;
  dx: number;
  dy: number;
  opacity: number;
}

const NO_FACES: ExtrusionFace[] = [];

/** Offset used by every side wall for one extrusion step. */
export function extrudeOffset(depth: number, angle = DEFAULT_EXTRUDE_ANGLE): Point {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.cos(radians) * depth,
    y: Math.sin(radians) * depth,
  };
}

/**
 * Key light, measured like the pull: 0° points right, angles run clockwise.
 * Objects that never set a light keep the historical look — the light rides
 * 55° around from the pull — while a stored value pins it in world space, which
 * is how a real light behaves when the solid is turned.
 */
export function extrudeLightAngle(path: VectorPath): number {
  if (typeof path.extrudeLight === 'number' && Number.isFinite(path.extrudeLight)) {
    return path.extrudeLight;
  }
  return DEFAULT_EXTRUDE_LIGHT;
}

/**
 * How far the artwork is tipped back into the screen, in degrees.
 *
 * 0 leaves the face flat and sends the depth straight at the viewer, where it
 * cannot be seen; 90 stands the card on edge. Between the two the face
 * foreshortens along the pull and the depth shows, which is the difference
 * between a solid and a flat shape with a thick shadow behind it.
 */
export const DEFAULT_EXTRUDE_TILT = 45;

export function extrudeTilt(path: VectorPath): number {
  const value = path.extrudeTilt;
  const tilt = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_EXTRUDE_TILT;
  return Math.min(85, Math.max(0, tilt));
}

/** How far the solid is turned about the vertical axis, in degrees. */
export const DEFAULT_EXTRUDE_TURN = 0;

export function extrudeTurn(path: VectorPath): number {
  const value = path.extrudeTurn;
  const turn = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_EXTRUDE_TURN;
  return Math.min(70, Math.max(-70, turn));
}

/**
 * Camera strength. 0 is a straight orthographic view — parallel edges, no
 * keystone; 1 puts the camera a little over one object-width away, where the
 * near side is visibly larger than the far one.
 */
export const DEFAULT_EXTRUDE_PERSPECTIVE = 0.25;

export function extrudePerspective(path: VectorPath): number {
  const value = path.extrudePerspective;
  const strength =
    typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_EXTRUDE_PERSPECTIVE;
  return Math.min(1, Math.max(0, strength));
}

interface ContourCache {
  closed: boolean;
  polygon: [number, number][];
}

/**
 * Sampling is the expensive half of an extrusion, and changing depth/fill keeps
 * the same points array. Caching on that array is what keeps the slider live.
 */
const contourCache = new WeakMap<AnchorPoint[], ContourCache>();

function simplifyPolygon(polygon: [number, number][]): [number, number][] {
  if (polygon.length <= 3) return polygon;

  const collapsed: [number, number][] = [];
  for (const point of polygon) {
    const last = collapsed[collapsed.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < SIMPLIFY_TOLERANCE) continue;
    collapsed.push(point);
  }

  // Prune only points that genuinely sit on the chord between their neighbours.
  // The tolerance is in artboard units, so a large arc keeps its points while a
  // flat stretch collapses — a coarse threshold faceted circles instead.
  const pruned: [number, number][] = [];
  for (let i = 0; i < collapsed.length; i += 1) {
    const current = collapsed[i];
    const previous = pruned[pruned.length - 1] ?? collapsed[(i - 1 + collapsed.length) % collapsed.length];
    const next = collapsed[(i + 1) % collapsed.length];
    const ux = current[0] - previous[0];
    const uy = current[1] - previous[1];
    const vx = next[0] - current[0];
    const vy = next[1] - current[1];
    const base = Math.hypot(ux + vx, uy + vy);
    if (base > 0 && Math.abs(ux * vy - uy * vx) / base < SIMPLIFY_TOLERANCE) continue;
    pruned.push(current);
  }

  return pruned.length >= 3 ? pruned : polygon;
}

function contourPolygon(points: AnchorPoint[], closed: boolean): [number, number][] {
  const cached = contourCache.get(points);
  if (cached && cached.closed === closed) return cached.polygon;

  const steps = points.length > 140 ? 6 : points.length > 40 ? 12 : 18;
  const stub = { points, closed } as VectorPath;
  let polygon = simplifyPolygon(pathToPolygon(stub, steps));

  if (polygon.length > MAX_WALL_SEGMENTS) {
    const stride = Math.ceil(polygon.length / MAX_WALL_SEGMENTS);
    const capped: [number, number][] = [];
    for (let i = 0; i < polygon.length; i += stride) capped.push(polygon[i]);
    polygon = capped;
  }

  contourCache.set(points, { closed, polygon });
  return polygon;
}

function signedArea(polygon: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function centerOf(polygon: [number, number][]): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function baseColor(path: VectorPath): string {
  const source =
    path.fill && path.fill !== 'none'
      ? path.fill
      : (path.fillGradient?.stops[0]?.color ?? '#4c8dff');
  return /^#[0-9a-fA-F]{6}$/.test(source) ? source : '#222831';
}

function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0.4;
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixColor(from: string, to: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.min(255, Math.max(0, Math.round(a + (b - a) * t)));
  });
  return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Tint toward white / shade toward black instead of scaling channels: a pure
 * red or blue has nothing to scale in two of its channels, so channel
 * multiplication would flatten the whole wall to one colour.
 */
function shadeColor(hex: string, tone: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#222831';
  if (tone >= 1) return mixColor(hex, '#ffffff', tone - 1);
  return mixColor(hex, '#000000', 1 - tone);
}

/**
 * Pure shading makes near-black fills invisible and near-white fills blend into
 * their own face; lift the dark end and duck the bright end so the walls always
 * separate from the object they belong to.
 */
function wallBaseColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#2a303b';
  const level = luminance(hex);
  if (level < 0.16) return mixColor(hex, '#7b8698', (0.16 - level) * 1.5);
  if (level > 0.78) return mixColor(hex, '#000000', 0.12);
  return hex;
}

interface FaceCache {
  key: string;
  faces: ExtrusionFace[];
}

const faceCache = new WeakMap<VectorPath, FaceCache>();

function backPoint(
  point: [number, number],
  center: [number, number],
  shrink: number,
  offset: Point
): [number, number] {
  return [
    center[0] + (point[0] - center[0]) * shrink + offset.x,
    center[1] + (point[1] - center[1]) * shrink + offset.y,
  ];
}

/** Moves a contour point toward the centre by `amount`, for a chamfered rim. */
function insetPoint(
  point: [number, number],
  center: [number, number],
  amount: number
): [number, number] {
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return point;
  const scale = Math.max(0, length - amount) / length;
  return [center[0] + dx * scale, center[1] + dy * scale];
}

/**
 * A chamfer wider than the artwork reads as a second, wrong shape. The limit is
 * a fraction of the contour's own size, so a 12px word mark still bevels.
 */
function clampBevel(requested: number, contour: [number, number][]): number {
  if (!Number.isFinite(requested) || requested <= 0.4) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of contour) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const smallest = Math.min(maxX - minX, maxY - minY);
  const limit = Math.min(MAX_BEVEL, smallest * 0.16);
  return Math.max(0, Math.min(requested, limit));
}

/**
 * Side walls shaded per edge like a real extrusion: one flat facet per wall,
 * brightness from a Lambert term, and only the facets turned toward the pull are
 * kept — the rest are hidden behind the face, and drawing them is what put dark
 * wedges in the notches of concave shapes.
 */
type Vec3 = [number, number, number];

interface Pose {
  center: [number, number];
  /** The card's own axes after rotation: local x, local y, and its normal. */
  ex: Vec3;
  ey: Vec3;
  en: Vec3;
  /** Screen direction of the extrusion — the normal flattened, for culling */
  pullX: number;
  pullY: number;
  /** Camera distance. Infinity is an orthographic view. */
  focal: number;
  depth: number;
  shrink: number;
  /** Nothing is rotated, so the face is the artwork itself. */
  flat: boolean;
}

/** Rodrigues rotation of a vector about an arbitrary unit axis. */
function rotateAxis(vector: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dot = vector[0] * axis[0] + vector[1] * axis[1] + vector[2] * axis[2];
  const cross: Vec3 = [
    axis[1] * vector[2] - axis[2] * vector[1],
    axis[2] * vector[0] - axis[0] * vector[2],
    axis[0] * vector[1] - axis[1] * vector[0],
  ];
  return [
    vector[0] * c + cross[0] * s + axis[0] * dot * (1 - c),
    vector[1] * c + cross[1] * s + axis[1] * dot * (1 - c),
    vector[2] * c + cross[2] * s + axis[2] * dot * (1 - c),
  ];
}

/** Rotation about the screen's vertical axis — the turn. */
function rotateY(vector: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [vector[0] * c + vector[2] * s, vector[1], -vector[0] * s + vector[2] * c];
}

function boundsOf(contour: [number, number][]): { width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of contour) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { width: maxX - minX, height: maxY - minY };
}

/**
 * The artwork's orientation in space.
 *
 * The lean is a rotation about the in-plane axis perpendicular to the pull, so
 * the depth still shows along the direction the slider names. The turn is a
 * second, independent rotation about the vertical axis — which is what makes
 * one side of the solid come toward the viewer and the other recede.
 */
function poseFor(path: VectorPath, contour: [number, number][]): Pose {
  const center = centerOf(contour);
  const radians = ((path.extrudeAngle ?? DEFAULT_EXTRUDE_ANGLE) * Math.PI) / 180;
  const tilt = (extrudeTilt(path) * Math.PI) / 180;
  const turn = (extrudeTurn(path) * Math.PI) / 180;
  const depth = path.extrudeDepth ?? 0;
  const taper = Math.min(MAX_TAPER, Math.max(0, path.extrudeTaper ?? DEFAULT_EXTRUDE_TAPER));

  const axis: Vec3 = [-Math.sin(radians), Math.cos(radians), 0];
  const ex = rotateY(rotateAxis([1, 0, 0], axis, tilt), turn);
  const ey = rotateY(rotateAxis([0, 1, 0], axis, tilt), turn);
  const en = rotateY(rotateAxis([0, 0, 1], axis, tilt), turn);

  const box = boundsOf(contour);
  const diagonal = Math.hypot(box.width, box.height) || 1;
  const strength = extrudePerspective(path);
  // Honest perspective: the camera sits a few object-widths away, so edges
  // converge instead of staying parallel. Orthographic at strength 0.
  const focal = strength < 0.001 ? Infinity : diagonal * (6 - strength * 4.5);

  return {
    center,
    ex,
    ey,
    en,
    pullX: Math.cos(radians),
    pullY: Math.sin(radians),
    focal,
    depth,
    shrink: 1 - taper,
    flat: Math.abs(tilt) < 0.002 && Math.abs(turn) < 0.002,
  };
}

/** Divides by depth: the same perspective the camera applies to everything. */
function toScreen(x: number, y: number, z: number, pose: Pose): [number, number] {
  const k = Number.isFinite(pose.focal) ? pose.focal / (pose.focal + z) : 1;
  return [pose.center[0] + x * k, pose.center[1] + y * k];
}

function projectPoint(point: [number, number], pose: Pose): [number, number] {
  const dx = point[0] - pose.center[0];
  const dy = point[1] - pose.center[1];
  return toScreen(
    dx * pose.ex[0] + dy * pose.ey[0],
    dx * pose.ex[1] + dy * pose.ey[1],
    dx * pose.ex[2] + dy * pose.ey[2],
    pose
  );
}

/** The same point on the back face, one depth along the card's normal. */
function backOf(point: [number, number], pose: Pose): [number, number] {
  const dx = (point[0] - pose.center[0]) * pose.shrink;
  const dy = (point[1] - pose.center[1]) * pose.shrink;
  return toScreen(
    dx * pose.ex[0] + dy * pose.ey[0] + pose.en[0] * pose.depth,
    dx * pose.ex[1] + dy * pose.ey[1] + pose.en[1] * pose.depth,
    dx * pose.ex[2] + dy * pose.ey[2] + pose.en[2] * pose.depth,
    pose
  );
}

/**
 * One shared geometry pass for everything the solid needs, so the painted face,
 * its walls, its rim and its shadow can never disagree about where an edge is.
 */
interface ExtrusionGeometry {
  pose: Pose;
  /** Projected silhouette */
  silhouette: [number, number][];
  holeSilhouettes: [number, number][][];
  /** Chamfer rings, outermost first — empty when there is no rim */
  rings: [number, number][][];
  holeRings: [number, number][][][];
  /** Front face: the innermost ring, so the rim stays visible under it */
  face: [number, number][];
  holeFaces: [number, number][][];
  outerSign: number;
  holeSigns: number[];
  /**
   * The same outline one depth back, already projected. Wall and cap geometry
   * must start from unprojected points: handing a projected point to the
   * back-face transform would rotate it twice.
   */
  backSilhouette: [number, number][];
  backHoleSilhouettes: [number, number][][];
}

const geometryCache = new WeakMap<VectorPath, { key: string; geometry: ExtrusionGeometry | null }>();

function extrusionGeometry(path: VectorPath): ExtrusionGeometry | null {
  const depth = path.extrudeDepth ?? 0;
  if (depth < 0.5 || !path.closed || path.text) return null;

  const tilt = extrudeTilt(path);
  const bevel = clampBevel(path.extrudeBevel ?? DEFAULT_EXTRUDE_BEVEL, contourPolygon(path.points, true));
  const key = `${depth.toFixed(2)}|${path.extrudeAngle ?? DEFAULT_EXTRUDE_ANGLE}|${tilt}|${extrudeTurn(path)}|${extrudePerspective(path)}|${path.extrudeTaper ?? 'd'}|${bevel}|${path.extrudeBevelStyle ?? 'chamfer'}|${path.points.length}|${path.holes?.length ?? 0}`;
  const cached = geometryCache.get(path);
  if (cached && cached.key === key) return cached.geometry;

  const outer = contourPolygon(path.points, true);
  if (outer.length < 3) {
    geometryCache.set(path, { key, geometry: null });
    return null;
  }

  const pose = poseFor(path, outer);
  const ringCount = path.extrudeBevelStyle === 'round' ? BEVEL_RINGS : 1;
  const ringsFor = (contour: [number, number][]) =>
    bevel > 0
      ? Array.from({ length: ringCount }, (_, ring) =>
          contour.map((point) => insetPoint(point, pose.center, (bevel * (ring + 1)) / ringCount))
        )
      : [];

  const silhouette = outer.map((point) => projectPoint(point, pose));
  const backSilhouette = outer.map((point) => backOf(point, pose));
  const rings = ringsFor(silhouette);
  const holeSilhouettes: [number, number][][] = [];
  const holeRings: [number, number][][][] = [];
  const holeSigns: number[] = [];
  const backHoleSilhouettes: [number, number][][] = [];
  for (const hole of path.holes ?? []) {
    const polygon = contourPolygon(hole, true);
    if (polygon.length < 3) continue;
    holeSigns.push(signedArea(polygon) >= 0 ? 1 : -1);
    const projected = polygon.map((point) => projectPoint(point, pose));
    holeSilhouettes.push(projected);
    backHoleSilhouettes.push(polygon.map((point) => backOf(point, pose)));
    holeRings.push(ringsFor(projected));
  }

  const geometry: ExtrusionGeometry = {
    pose,
    silhouette,
    holeSilhouettes,
    rings,
    holeRings,
    face: rings.length ? rings[rings.length - 1] : silhouette,
    holeFaces: holeRings.map((rings) => (rings.length ? rings[rings.length - 1] : [])),
    outerSign: signedArea(outer) >= 0 ? 1 : -1,
    holeSigns,
    backSilhouette,
    backHoleSilhouettes,
  };
  // Faces without a chamfer have no hole faces of their own; fall back below.
  for (let i = 0; i < geometry.holeFaces.length; i += 1) {
    if (!geometry.holeFaces[i].length) geometry.holeFaces[i] = holeSilhouettes[i];
  }

  geometryCache.set(path, { key, geometry });
  return geometry;
}

function ringPathData(contours: [number, number][][]): string {
  return contours
    .map((contour) => {
      const body = contour
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
        .join(' ');
      return `${body} Z`;
    })
    .join(' ');
}

/**
 * The front face of the solid as painted geometry. Null when the face is still
 * the artwork itself (an untitled, untilted object), so callers can keep the
 * original path and pay nothing.
 */
export function extrusionFrontPath(path: VectorPath): string | null {
  const geometry = extrusionGeometry(path);
  if (!geometry) return null;
  // A pose that is still face-on paints the artwork itself; do not flatten curves.
  if (geometry.pose.flat && geometry.rings.length === 0) return null;
  const d = ringPathData([geometry.face, ...geometry.holeFaces]);
  return d || null;
}

export function extrusionFaces(path: VectorPath): ExtrusionFace[] {
  const geometry = extrusionGeometry(path);
  if (!geometry) return NO_FACES;

  const depth = path.extrudeDepth ?? 0;
  const color = baseColor(path);
  const key = `${depth.toFixed(2)}|${extrudeTilt(path)}|${extrudeTurn(path)}|${extrudePerspective(path)}|${path.extrudeAngle ?? DEFAULT_EXTRUDE_ANGLE}|${path.extrudeTaper ?? 'd'}|${path.extrudeBevel ?? DEFAULT_EXTRUDE_BEVEL}|${path.extrudeBevelStyle ?? 'chamfer'}|${extrudeLightAngle(path)}|${path.points.length}|${path.holes?.length ?? 0}|${color}`;
  const cached = faceCache.get(path);
  if (cached && cached.key === key) return cached.faces;

  const { pose, silhouette, holeSilhouettes, rings, holeRings } = geometry;
  const lightAngle = (extrudeLightAngle(path) * Math.PI) / 180;
  const lightX = Math.cos(lightAngle);
  const lightY = Math.sin(lightAngle);

  const wallBase = wallBaseColor(color);
  const depthBands = DEPTH_BANDS;
  const walls: string[][] = Array.from({ length: SHADE_STEPS * depthBands }, () => []);
  const bevels: string[][] = Array.from({ length: BEVEL_TONE_STEPS * BEVEL_RINGS }, () => []);

  const toneIndexFor = (facing: number) => {
    const ramp = Math.min(1, Math.max(0, (facing - LIGHT_FLOOR) / (1 - LIGHT_FLOOR)));
    return {
      bevelTone: Math.min(BEVEL_TONE_STEPS - 1, Math.round(ramp * (BEVEL_TONE_STEPS - 1))),
      tone: Math.min(SHADE_STEPS - 1, Math.round(ramp * (SHADE_STEPS - 1))),
    };
  };

  const quad = (
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number]
  ) =>
    `M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} L ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} Z`;

  const addContour = (
    contour: [number, number][],
    ringsForContour: [number, number][][],
    dir: number,
    backs: [number, number][]
  ) => {
    if (contour.length < 3) return;

    for (let i = 0; i < contour.length; i += 1) {
      const a = contour[i];
      const b = contour[(i + 1) % contour.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (length < 0.3) continue;

      const nx = (dy / length) * dir;
      const ny = (-dx / length) * dir;
      const facing = nx * lightX + ny * lightY;
      const { tone, bevelTone } = toneIndexFor(facing);

      // Rim first: it sits on the front edge, so it ignores the pull culling.
      if (ringsForContour.length > 0) {
        let outerRing = contour;
        for (let ring = 0; ring < ringsForContour.length; ring += 1) {
          const innerRing = ringsForContour[ring];
          const nextIndex = (i + 1) % contour.length;
          bevels[bevelTone * BEVEL_RINGS + ring].push(
            quad(outerRing[i], outerRing[nextIndex], innerRing[nextIndex], innerRing[i])
          );
          outerRing = innerRing;
        }
      }

      // Hidden-line removal: a wall turned away from the pull sits behind the
      // face, so drawing it only leaks through concave notches.
      if (nx * pose.pullX + ny * pose.pullY <= 0) continue;

      const backA = backs[i] ?? backOf(a, pose);
      const backB = backs[(i + 1) % contour.length] ?? backOf(b, pose);

      for (let band = 0; band < depthBands; band += 1) {
        const t0 = band / depthBands;
        const t1 = Math.min(1, (band + 1) / depthBands);
        const startA: [number, number] = [a[0] + (backA[0] - a[0]) * t0, a[1] + (backA[1] - a[1]) * t0];
        const startB: [number, number] = [b[0] + (backB[0] - b[0]) * t0, b[1] + (backB[1] - b[1]) * t0];
        const endA: [number, number] = [a[0] + (backA[0] - a[0]) * t1, a[1] + (backA[1] - a[1]) * t1];
        const endB: [number, number] = [b[0] + (backB[0] - b[0]) * t1, b[1] + (backB[1] - b[1]) * t1];
        walls[tone * depthBands + band].push(quad(startA, startB, endB, endA));
      }
    }
  };

  const outerSign = geometry.outerSign;
  addContour(silhouette, rings, outerSign, geometry.backSilhouette);
  for (let i = 0; i < holeSilhouettes.length; i += 1) {
    const polygon = holeSilhouettes[i];
    // A hole's wall faces into the void, so it winds against the outline for the
    // normal — and therefore the culling — to come out right.
    const holeSign = geometry.holeSigns[i] ?? outerSign;
    const ordered = holeSign === outerSign ? [...polygon].reverse() : polygon;
    const orderedRings = (holeRings[i] ?? []).map((ring) =>
      holeSign === outerSign ? [...ring].reverse() : ring
    );
    const holeBacks = geometry.backHoleSilhouettes[i] ?? [];
    const orderedBacks = holeSign === outerSign ? [...holeBacks].reverse() : holeBacks;
    addContour(ordered, orderedRings, -outerSign, orderedBacks);
  }

  const faces: ExtrusionFace[] = [];

  // A real solid has a back face. Without it, concave outlines show the canvas
  // straight through the body between two wall quads.
  const capRing = (backContour: [number, number][], reverse: boolean) => {
    const ordered = reverse ? [...backContour].reverse() : backContour;
    return `${ordered
      .map((point, index) => {
        const [x, y] = point;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ')} Z`;
  };
  const capParts = [capRing(geometry.backSilhouette, false)];
  for (let i = 0; i < holeSilhouettes.length; i += 1) {
    const holeSign = geometry.holeSigns[i] ?? outerSign;
    // Opposite winding, so nonzero fill cuts the hole out instead of filling it.
    capParts.push(capRing(geometry.backHoleSilhouettes[i] ?? [], holeSign === outerSign));
  }
  faces.push({
    d: capParts.join(' '),
    fill: shadeColor(wallBase, SHADE_FLOOR - 0.12),
    part: 'cap',
  });

  walls.forEach((chunks, index) => {
    if (chunks.length === 0) return;
    const toneSlot = Math.floor(index / depthBands);
    const band = index % depthBands;
    const baseTone =
      SHADE_FLOOR + (toneSlot / (SHADE_STEPS - 1)) * (SHADE_CEILING - SHADE_FLOOR);
    // One facet spans the whole depth, so the tone is sampled at its middle:
    // the wall darkens away from the face without a step anywhere along it.
    const scaled = (band + 0.5) / depthBands;
    const tone = Math.max(0.3, baseTone - scaled * DEPTH_FALLOFF);
    faces.push({ d: chunks.join(' '), fill: shadeColor(wallBase, tone), part: 'wall' });
  });

  bevels.forEach((chunks, index) => {
    if (chunks.length === 0) return;
    const toneSlot = Math.floor(index / BEVEL_RINGS);
    const ring = index % BEVEL_RINGS;
    const ramp = toneSlot / (BEVEL_TONE_STEPS - 1);
    const wallTone = 0.66 + ramp * 0.34;
    const faceTone = 1.0 + ramp * 0.12;
    const tone = wallTone + (faceTone - wallTone) * ((ring + 0.5) / BEVEL_RINGS);
    faces.push({ d: chunks.join(' '), fill: shadeColor(wallBase, tone), part: 'bevel' });
  });

  faceCache.set(path, { key, faces });
  return faces;
}

/**
 * Soft specular sheen for the front face. A solid whose face is one flat colour
 * reads as a sticker; a light pool toward the key light reads as a surface.
 * Rendered as a radial gradient clipped to the face path, so it costs one
 * definition and one overlay per object.
 */
export interface ExtrusionSheen {
  id: string;
  /** Centre in objectBoundingBox units (0..1) */
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

export function extrusionSheen(path: VectorPath): ExtrusionSheen | null {
  if ((path.extrudeDepth ?? 0) < 0.5 || !path.closed || path.text) return null;
  const gloss = Math.min(1, Math.max(0, path.extrudeGloss ?? DEFAULT_EXTRUDE_GLOSS));
  if (gloss < 0.01) return null;
  // The pool sits toward the key light, so it moves when the light does.
  const radians = (extrudeLightAngle(path) * Math.PI) / 180;
  const clamp = (n: number) => Math.min(0.86, Math.max(0.14, n));
  return {
    id: `extrude-sheen-${path.id}`,
    cx: clamp(0.5 + Math.cos(radians) * 0.26),
    cy: clamp(0.5 + Math.sin(radians) * 0.26),
    r: 0.78,
    opacity: gloss,
  };
}

/**
 * Soft contact shadow under the solid. Returned separately because it has to be
 * painted before the walls and needs a blur filter, which the face list cannot
 * express.
 */
export function extrusionShadow(path: VectorPath): ExtrusionShadow | null {
  const depth = path.extrudeDepth ?? 0;
  if (path.extrudeShadow === false || depth < 1 || !path.closed || path.text) return null;

  const geometry = extrusionGeometry(path);
  if (!geometry) return null;

  const d = ringPathData([geometry.backSilhouette]);

  const soft = Math.min(2.5, Math.max(0.4, path.extrudeShadowSoft ?? 1));
  const lift = Math.min(2, Math.max(0, path.extrudeShadowLift ?? 1));
  return {
    id: `extrude-shadow-${path.id}`,
    d,
    blur: (2 + depth * 0.12) * soft,
    dx: (2 + depth * 0.18) * lift,
    dy: (3 + depth * 0.22) * lift,
    opacity: 0.32,
  };
}

/** Combined wall path — kept for callers that only need the silhouette. */
export function extrusionPathData(path: VectorPath): string {
  return extrusionFaces(path)
    .map((face) => face.d)
    .join(' ');
}

/** Exported selection bounds must include the walls and the shadow. */
export function includeExtrusionInBounds(
  paths: VectorPath[],
  box: BoundingBox
): BoundingBox {
  let minX = box.minX;
  let minY = box.minY;
  let maxX = box.maxX;
  let maxY = box.maxY;

  for (const path of paths) {
    if (!path.closed || path.text || (path.extrudeDepth ?? 0) <= 0) continue;
    const geometry = extrusionGeometry(path);
    if (geometry) {
      // The solid can lean outside the flat artwork: measure where it actually
      // lands, front and back, rather than guessing from the pull offset.
      for (const point of geometry.silhouette) {
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
      }
      for (const point of geometry.silhouette) {
        const back = backOf(point, geometry.pose);
        minX = Math.min(minX, back[0]);
        minY = Math.min(minY, back[1]);
        maxX = Math.max(maxX, back[0]);
        maxY = Math.max(maxY, back[1]);
      }
    } else {
      const offset = extrudeOffset(path.extrudeDepth!, path.extrudeAngle);
      minX = Math.min(minX, box.minX + offset.x);
      minY = Math.min(minY, box.minY + offset.y);
      maxX = Math.max(maxX, box.maxX + offset.x);
      maxY = Math.max(maxY, box.maxY + offset.y);
    }

    const shadow = extrusionShadow(path);
    if (shadow) {
      minX = Math.min(minX, box.minX - shadow.blur);
      minY = Math.min(minY, box.minY - shadow.blur);
      maxX = Math.max(maxX, box.maxX + shadow.dx + shadow.blur);
      maxY = Math.max(maxY, box.maxY + shadow.dy + shadow.blur);
    }
  }

  const width = Math.max(2, maxX - minX);
  const height = Math.max(2, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/** Mid-tone side colour, for flat callers such as the bounds preview. */
export function extrusionShade(path: VectorPath): string {
  return shadeColor(wallBaseColor(baseColor(path)), 0.52);
}
