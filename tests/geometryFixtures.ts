/**
 * Geometry fixtures for the shape builder.
 *
 * These check properties that must hold for any artwork — the result is one
 * object, its area is the union, its outline stays on the shapes it came from —
 * so a change to the boolean or fitting code fails here instead of on a phone.
 *
 * Run: npm run test:geometry
 */
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { insertPointOnSegment, pathToPolygon, removePointWithRefit } from '../src/utils/bezier';
import {
  computeAtomicSubRegions,
  executeShapeBuilderErase,
  executeShapeBuilderMerge,
} from '../src/utils/shapeBuilderRegions';
import { vectorPathToClippingPolygon } from '../src/utils/shapeBuilder';
import { generateShapePath } from '../src/utils/shapeGenerator';
import type { ShapeOptions, VectorPath } from '../src/types/vector';

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = ''): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const STYLE = { fill: '#4C8DFF', stroke: 'none', strokeWidth: 0 };
const KAPPA = 0.5522847498;

function circle(id: string, cx: number, cy: number, r: number): VectorPath {
  return {
    id,
    name: id,
    points: [
      { id: `${id}0`, x: cx, y: cy - r, type: 'smooth', handleIn: { x: cx - KAPPA * r, y: cy - r }, handleOut: { x: cx + KAPPA * r, y: cy - r } },
      { id: `${id}1`, x: cx + r, y: cy, type: 'smooth', handleIn: { x: cx + r, y: cy - KAPPA * r }, handleOut: { x: cx + r, y: cy + KAPPA * r } },
      { id: `${id}2`, x: cx, y: cy + r, type: 'smooth', handleIn: { x: cx + KAPPA * r, y: cy + r }, handleOut: { x: cx - KAPPA * r, y: cy + r } },
      { id: `${id}3`, x: cx - r, y: cy, type: 'smooth', handleIn: { x: cx - r, y: cy + KAPPA * r }, handleOut: { x: cx - r, y: cy - KAPPA * r } },
    ],
    closed: true,
    fill: '#4C8DFF',
    fillOpacity: 1,
    stroke: 'none',
    strokeWidth: 0,
    strokeOpacity: 1,
    pressureProfile: 'uniform',
  } as VectorPath;
}

function rect(id: string, x: number, y: number, w: number, h: number): VectorPath {
  return {
    id,
    name: id,
    points: [
      { id: `${id}0`, x, y, type: 'corner' },
      { id: `${id}1`, x: x + w, y, type: 'corner' },
      { id: `${id}2`, x: x + w, y: y + h, type: 'corner' },
      { id: `${id}3`, x, y: y + h, type: 'corner' },
    ],
    closed: true,
    fill: '#4C8DFF',
    fillOpacity: 1,
    stroke: 'none',
    strokeWidth: 0,
    strokeOpacity: 1,
    pressureProfile: 'uniform',
  } as VectorPath;
}

const SAMPLE = 40;

function pathArea(path: VectorPath): number {
  const poly = pathToPolygon(path, SAMPLE);
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

function ringArea(ring: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

function polygonArea(polygon: Polygon): number {
  const [outer, ...holes] = polygon;
  if (!outer) return 0;
  return holes.reduce((total, hole) => total - ringArea(hole), ringArea(outer));
}

function multipolygonArea(polys: MultiPolygon): number {
  return polys.reduce((total, polygon) => total + polygonArea(polygon), 0);
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function distanceToRect(px: number, py: number, x: number, y: number, w: number, h: number): number {
  const x1 = x + w;
  const y1 = y + h;
  const inside = px >= x && px <= x1 && py >= y && py <= y1;
  if (inside) return Math.min(px - x, x1 - px, py - y, y1 - py);
  const dx = Math.max(x - px, 0, px - x1);
  const dy = Math.max(y - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

const distanceToCircle = (px: number, py: number, cx: number, cy: number, r: number) =>
  Math.abs(Math.hypot(px - cx, py - cy) - r);

interface Fixture {
  name: string;
  a: VectorPath;
  b: VectorPath;
  /** Distance from a point to the nearest edge of either source shape. */
  boundary: (x: number, y: number) => number;
}

const FIXTURES: Fixture[] = [
  {
    name: 'circle + circle',
    a: circle('a', 200, 300, 150),
    b: circle('b', 380, 300, 150),
    boundary: (x, y) =>
      Math.min(distanceToCircle(x, y, 200, 300, 150), distanceToCircle(x, y, 380, 300, 150)),
  },
  {
    name: 'circle + rect',
    a: circle('a', 300, 300, 140),
    b: rect('b', 300, 180, 220, 240),
    boundary: (x, y) =>
      Math.min(distanceToCircle(x, y, 300, 300, 140), distanceToRect(x, y, 300, 180, 220, 240)),
  },
  {
    name: 'rect + rect',
    a: rect('a', 120, 160, 220, 220),
    b: rect('b', 240, 260, 220, 220),
    boundary: (x, y) =>
      Math.min(distanceToRect(x, y, 120, 160, 220, 220), distanceToRect(x, y, 240, 260, 220, 220)),
  },
];

const AREA_TOLERANCE = 0.004;
const OUTLINE_TOLERANCE = 0.35;

for (const fixture of FIXTURES) {
  console.log(fixture.name);
  const shapes = [fixture.a, fixture.b];
  const regions = computeAtomicSubRegions(shapes, shapes);
  const overlap = regions.find((region) => region.sourcePathIds.length === 2);
  check(`${fixture.name}: has an overlap region`, Boolean(overlap));
  if (!overlap) continue;

  const polyA = vectorPathToClippingPolygon(fixture.a);
  const polyB = vectorPathToClippingPolygon(fixture.b);
  let shared: MultiPolygon = [];
  try {
    shared = polygonClipping.intersection(polyA, polyB) as MultiPolygon;
  } catch {
    shared = [];
  }
  const expectedArea =
    Math.abs(pathArea(fixture.a)) + Math.abs(pathArea(fixture.b)) - multipolygonArea(shared);

  const merged = executeShapeBuilderMerge([overlap.id], regions, shapes, STYLE);
  check(`${fixture.name}: merge yields one object`, merged.length === 1, `objects=${merged.length}`);

  const mergedArea = merged.reduce((total, path) => total + pathArea(path), 0);
  check(
    `${fixture.name}: merged area is the union`,
    Math.abs(mergedArea - expectedArea) / expectedArea < AREA_TOLERANCE,
    `got=${mergedArea.toFixed(1)} expected=${expectedArea.toFixed(1)}`
  );

  let worst = 0;
  for (const path of merged) {
    for (const [x, y] of pathToPolygon(path, SAMPLE)) {
      worst = Math.max(worst, fixture.boundary(x, y));
    }
  }
  check(
    `${fixture.name}: outline stays on the artwork`,
    worst < OUTLINE_TOLERANCE,
    `worst=${worst.toFixed(3)} units`
  );

  // Erase deletes the brushed patch outright, so it is gone from both shapes:
  // what remains is A + B minus that patch twice.
  const erasedExpected =
    Math.abs(pathArea(fixture.a)) + Math.abs(pathArea(fixture.b)) - 2 * multipolygonArea(shared);
  const erased = executeShapeBuilderErase([overlap.id], regions, shapes);
  check(`${fixture.name}: erase leaves both shapes`, erased.length === 2, `objects=${erased.length}`);
  const erasedArea = erased.reduce((total, path) => total + pathArea(path), 0);
  check(
    `${fixture.name}: erase removes exactly the brushed area`,
    Math.abs(erasedArea - erasedExpected) / erasedExpected < AREA_TOLERANCE,
    `got=${erasedArea.toFixed(1)} expected=${erasedExpected.toFixed(1)}`
  );

  const ownRegion = regions.find((region) => region.sourcePathIds.length === 1);
  if (ownRegion) {
    const single = executeShapeBuilderMerge([ownRegion.id], regions, shapes, STYLE);
    check(
      `${fixture.name}: brushing one shape is not a merge`,
      single.length === 2,
      `objects=${single.length}`
    );
  }
}

// Circles drawn with the shape tool are four anchors with bezier handles, not
// sampled rings, so they go through a different flattening path. Erasing their
// shared region has to leave two objects that are each their own object: a
// repeated id is what a "duplicate" looks like in the document.
{
  const circle = (id: string, x1: number, y1: number, x2: number, y2: number) =>
    generateShapePath(x1, y1, x2, y2, { kind: 'circle' } as ShapeOptions, id, {
      fill: '#4a8cff',
      stroke: 'none',
      strokeWidth: 0,
    });
  const a = circle('circle-a', 120, 330, 270, 480);
  const b = circle('circle-b', 200, 400, 350, 550);
  const shapes = [a, b];
  const regions = computeAtomicSubRegions(shapes, shapes);
  const shared = regions.find((region) => region.sourcePathIds.length === 2);
  check('bezier circles: the two circles share a region', Boolean(shared));
  if (shared) {
    const erased = executeShapeBuilderErase([shared.id], regions, shapes);
    check('bezier circles: erase leaves two objects', erased.length === 2, `objects=${erased.length}`);
    check(
      'bezier circles: each remainder keeps its own id',
      new Set(erased.map((path) => path.id)).size === erased.length,
      erased.map((path) => path.id).join(', ')
    );
  }
}

/* ------------------------------------------------------------------------ *
 * Direct selection: adding and removing nodes
 *
 * Splitting a segment must not move the outline, and removing the node that
 * was just added has to give back the path that was there before — that pair
 * is the gesture users repeat most, and it used to leave the curve bent.
 * ------------------------------------------------------------------------ */
{
  const outline = (path: VectorPath): [number, number][] => pathToPolygon(path, 24);

  const drift = (from: [number, number][], to: [number, number][]): number => {
    let worst = 0;
    for (const [px, py] of from) {
      let best = Infinity;
      for (let i = 0; i < to.length; i++) {
        const [x1, y1] = to[i];
        const [x2, y2] = to[(i + 1) % to.length];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        best = Math.min(best, Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t)));
      }
      worst = Math.max(worst, best);
    }
    return worst;
  };

  const subjects: [string, VectorPath][] = [
    [
      'bezier circle',
      generateShapePath(120, 120, 320, 320, { kind: 'circle' } as ShapeOptions, 'node-circle', STYLE),
    ],
    [
      'rectangle',
      generateShapePath(120, 400, 320, 560, { kind: 'rectangle' } as ShapeOptions, 'node-square', STYLE),
    ],
  ];

  for (const [name, path] of subjects) {
    const before = outline(path);
    const segments = path.closed ? path.points.length : path.points.length - 1;
    let worstInsert = 0;
    let worstRoundTrip = 0;
    for (let segment = 0; segment < segments; segment++) {
      const split = insertPointOnSegment(path, segment, 0.5, `node-${segment}`);
      if (!split) continue;
      const inserted: VectorPath = { ...path, points: split.points };
      worstInsert = Math.max(worstInsert, drift(before, outline(inserted)));
      const back = removePointWithRefit(inserted, split.index);
      worstRoundTrip = Math.max(
        worstRoundTrip,
        drift(before, outline({ ...inserted, points: back ?? split.points.filter((_, i) => i !== split.index) }))
      );
    }
    check(`${name}: adding a node leaves the outline where it was`, worstInsert < OUTLINE_TOLERANCE, `worst ${worstInsert.toFixed(3)}`);
    check(`${name}: removing the added node restores the outline exactly`, worstRoundTrip < 0.01, `worst ${worstRoundTrip.toFixed(3)}`);

    // Removing a node that was always there changes the shape by definition —
    // the corner is gone — so the invariant is that the repair never drifts
    // further from the original outline than simply dropping the node did.
    let plainWorst = 0;
    let repairedWorst = 0;
    for (let i = 0; i < path.points.length; i++) {
      const plainPoints = path.points.filter((_, j) => j !== i);
      const repaired = removePointWithRefit(path, i) ?? plainPoints;
      plainWorst = Math.max(plainWorst, drift(before, outline({ ...path, points: plainPoints })));
      repairedWorst = Math.max(repairedWorst, drift(before, outline({ ...path, points: repaired })));
    }
    check(
      `${name}: deleting a node is never worse than a plain drop`,
      repairedWorst <= plainWorst + 0.01,
      `plain ${plainWorst.toFixed(2)} · repaired ${repairedWorst.toFixed(2)}`
    );
  }
}

console.log(
  failures === 0
    ? `\nALL ${checks} GEOMETRY FIXTURES PASSED`
    : `\n${failures} OF ${checks} GEOMETRY FIXTURES FAILED`
);
if (failures > 0) process.exit(1);
