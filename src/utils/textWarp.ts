import { VectorPath, WarpSpec } from '../types/vector';
import {
  TextMatrix,
  TextWorldBox,
  applyTextMatrix,
  measureLineOffsets,
  measureTextMetrics,
  textLineHeight,
  textLines,
  textMatrixFor,
  textWorldBox,
} from './textGeometry';
import { WarpBox, textWarpBox, textWarpKind, textWarpPoint ,
  textWarpLocalMatrix,
} from './warpMath';

/**
 * Live text warp: every glyph is placed on its own, with the baseline bowed by
 * the warp and the letter rotated to the curve's tangent. The string never
 * becomes geometry, so it can be retyped, restyled or resized forever — and
 * the letters keep the font's real outlines instead of a traced approximation.
 *
 * Warps are evaluated in artboard space, the same box a shape warp uses, so a
 * label and a shape warped with the same setting bend together.
 */

export type TextGlyphMatrix = [number, number, number, number, number, number];

export interface TextGlyphPlacement {
  char: string;
  /** Warped baseline position of the glyph, in artboard space */
  x: number;
  y: number;
  /** Unwarped baseline position, where the glyph's own transform originates */
  anchorX: number;
  anchorY: number;
  /** Glyph space (0, 0 = the letter's own anchor) to artboard space */
  matrix: TextGlyphMatrix;
  /** The same matrix as a ready-to-use SVG transform */
  transform: string;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const degrees = (radians: number) => (radians * 180) / Math.PI;

/** Matrix product, `left` applied after `right`. */
function multiply(left: TextGlyphMatrix, right: TextGlyphMatrix): TextGlyphMatrix {
  const [la, lb, lc, ld, le, lf] = left;
  const [ra, rb, rc, rd, re, rf] = right;
  return [
    la * ra + lc * rb,
    lb * ra + ld * rb,
    la * rc + lc * rd,
    lb * rc + ld * rd,
    la * re + lc * rf + le,
    lb * re + ld * rf + lf,
  ];
}

const translation = (x: number, y: number): TextGlyphMatrix => [1, 0, 0, 1, x, y];
const rotation = (angle: number): TextGlyphMatrix => [
  Math.cos(angle),
  Math.sin(angle),
  -Math.sin(angle),
  Math.cos(angle),
  0,
  0,
];
const skewX = (slope: number): TextGlyphMatrix => [1, 0, slope, 1, 0, 0];

const glyphScale = (s: number): TextGlyphMatrix => [s, 0, 0, s, 0, 0];

const matrixCss = (matrix: TextGlyphMatrix) => `matrix(${matrix.map(round).join(' ')})`;

interface Sample {
  x: number;
  y: number;
  /** Distance travelled along the bent baseline up to this sample */
  length: number;
  /** Direction of the baseline here, in radians */
  angle: number;
}

/**
 * Walks the warped baseline of one line and measures it. Type has to be laid
 * out along the curve, not along the straight line it started on: otherwise a
 * bend pushes the letters apart instead of flowing them round it.
 */
function sampleBaseline(
  from: { x: number; y: number },
  along: { x: number; y: number },
  width: number,
  box: WarpBox,
  spec: WarpSpec
): Sample[] {
  if (!spec) return [];
  const steps = 96;
  const samples: Sample[] = [];
  let length = 0;
  let previous: { x: number; y: number } | null = null;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const world = {
      x: from.x + along.x * width * t,
      y: from.y + along.y * width * t,
    };
    const warped = textWarpPoint(world.x, world.y, box, spec);
    if (previous) {
      length += Math.hypot(warped.x - previous.x, warped.y - previous.y);
    }
    const before = index >= 1 ? samples[index - 1] : null;
    samples.push({
      x: warped.x,
      y: warped.y,
      length,
      // Filled in below; the tangent needs the next sample too.
      angle: before
        ? Math.atan2(warped.y - before.y, warped.x - before.x)
        : 0,
    });
    previous = warped;
  }
  // The first sample borrows the second one's direction.
  if (samples.length > 1) samples[0].angle = samples[1].angle;
  return samples;
}

/** Point and tangent at a distance along the sampled baseline. */
function pointAtLength(samples: Sample[], distance: number): Sample {
  if (distance <= 0) return samples[0];
  const last = samples[samples.length - 1];
  if (distance >= last.length) return last;
  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample.length < distance) continue;
    const previous = samples[index - 1];
    const span = sample.length - previous.length || 1;
    const t = (distance - previous.length) / span;
    return {
      x: previous.x + (sample.x - previous.x) * t,
      y: previous.y + (sample.y - previous.y) * t,
      length: distance,
      angle: previous.angle + (sample.angle - previous.angle) * t,
    };
  }
  return last;
}


/**
 * The circle a badge arc rides on.
 *
 * Badge lettering is type on a circle, not a generic bow: the letters advance
 * along the circumference and turn to the tangent, so the gaps stay even and
 * the first and last letters behave exactly like the ones in between. `radius`
 * puts the text on a chosen circle; without it the bend amount picks one.
 */
function bendCircle(
  lineWidth: number,
  spec: WarpSpec,
  kind: string,
  startX: number,
  baseY: number
) {
  const half = Math.max(1, lineWidth / 2);
  const dir = kind === 'arc' ? -1 : 1;
  // How much of the circle the string covers, in radians. A bend equal to half
  // the string's width wraps it into a full loop — the badge setting — and past
  // that the letters would lap each other, so it stops there.
  const wanted = Math.abs(spec.amount ?? 0);
  const turn =
    spec.radius && spec.radius > 0
      ? Math.min(Math.PI, half / spec.radius)
      : Math.PI * Math.min(1, wanted / half);
  const radius = half / Math.max(0.02, turn);
  // The middle of the string stays where it was typed; the ends ride up and the
  // curvature is free to go all the way round instead of stopping at a bow.
  return { radius, dir, centreX: startX + half, centreY: baseY + dir * radius };
}

export function warpTextPlacements(path: VectorPath): TextGlyphPlacement[] | null {
  if (!path.text || !path.warp || path.textPath) return null;
  const spec = path.warp;
  if (!spec.amount && !(spec.sway ?? 0)) return null;
  const box = textWorldBox(path);
  if (!box) return null;

  const local = textMatrixFor(path);
  const origin = path.points[0] ?? { x: 0, y: 0 };
  const lineHeight = textLineHeight(path.fontSize);
  const kind = textWarpKind(spec);
  const warped = { ...spec, kind };
  const width = Math.max(1, textWorldBox(path)?.width ?? 1);
  const placements: TextGlyphPlacement[] = [];

  textLines(path.text).forEach((line, row) => {
    if (!line) return;
    const offsets = measureLineOffsets(line, path);
    const baseline = applyTextMatrix(local, { x: 0, y: row * lineHeight });
    const start = { x: baseline.x + origin.x, y: baseline.y + origin.y };
    // A bend pivots on the ends of its box. A whole letter of margin each side
    // keeps the first and last letters off the steepest part of the curve, so
    // they turn and lift with the word instead of peeling away from it.
    const pad = Math.max(0, (offsets[1] ?? path.fontSize ?? 0) - (offsets[0] ?? 0));
    const field = textWarpBox(box, warped, start.y, pad);
    // One glyph at a time on a circle: the string's own length decides where
    // the letters land along the circumference.
    const lineWidth = Math.max(
      1,
      (offsets[offsets.length - 1] ?? 0) + (path.fontSize ?? 48) * 0.6
    );
    const circle =
      kind === 'arch' || kind === 'arc' ? bendCircle(lineWidth, warped, kind, start.x, start.y) : null;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (!char.trim()) continue;
      const offset = offsets[index] ?? 0;
      // Glyph space → its place on the straight line → the label's matrix → artboard.
      const toArtboard = multiply(
        translation(origin.x, origin.y),
        multiply(local, translation(offset, row * lineHeight))
      );
      const anchor = applyTextMatrix(local, { x: offset, y: row * lineHeight });
      const anchorX = anchor.x + origin.x;
      const anchorY = anchor.y + origin.y;

      // Map the letter's own point through the envelope. The old code stepped
      // along the bent baseline by arc length, and because a bend is longer than
      // a straight line that stretched the gaps between letters — the reason
      // every style except arch and arc read as broken spacing.
      const advance = (offsets[index + 1] ?? offset + (path.fontSize ?? 48) * 0.6) - offset;
      // A bend turns each letter about the middle of its own footprint. Turning
      // them about their left baseline point swings the ink sideways, which is
      // what tore the end letters away from the rest.
      const middle = applyTextMatrix(local, { x: offset + advance / 2, y: row * lineHeight });
      const pivotX = circle ? middle.x + origin.x : anchorX;
      const pivotY = circle ? middle.y + origin.y : anchorY;
      const placed = circle
        ? (() => {
            const along = offset + advance / 2 - (offsets[0] ?? 0);
            const theta = (along - lineWidth / 2) / circle.radius;
            return {
              x: circle.centreX + circle.radius * Math.sin(theta),
              y: circle.centreY - circle.dir * circle.radius * Math.cos(theta),
            };
          })()
        : textWarpPoint(anchorX, anchorY, field, warped);
      const frame = textWarpLocalMatrix(anchorX, anchorY, field, warped);
      // Twist rotates letters in place, hardest at the ends; every other style
      // takes its angle from the envelope's own derivative.
      const twistTurn =
        kind === 'twist'
          ? Math.max(-1, Math.min(1, (spec.amount ?? 0) / 100)) * (2 * (offset / width) - 1) * (Math.PI / 4)
          : null;
      // On a circle the tangent is simply the angle the glyph sits at.
      const circleAngle = circle
        ? circle.dir * ((offset + advance / 2 - (offsets[0] ?? 0) - lineWidth / 2) / circle.radius)
        : null;
      const angle = twistTurn ?? circleAngle ?? Math.atan2(frame.b, frame.a);
      // Letters must shrink with the gaps they are being squeezed into, or a
      // tightening style overlaps them. A uniform scale does that without the
      // shear that used to fold glyphs into each other.
      const along = Math.hypot(frame.a, frame.b) || 1;
      const across = Math.abs(frame.d) || 1;
      // A bend is a rigid turn: the letters keep their size along the curve.
      // Only the squeezing styles change it, or an arch would shrink whichever
      // letter happened to land nearest the pivot.
      const uniform =
        circle ? 1 : Math.max(0.7, Math.min(1.45, Math.sqrt(along * across)));
      // Perspective has no top or bottom to taper on a single line, so each
      // letter leans instead: a light italic shear that reads as depth without
      // fanning the word apart the way a positional fan did.
      const lean =
        kind === 'perspective' ? Math.max(-0.45, Math.min(0.45, (spec.amount ?? 0) / 220)) : 0;
      const shaped = multiply(lean ? skewX(lean) : rotation(angle), glyphScale(uniform));
      const warp = multiply(translation(placed.x, placed.y), multiply(shaped, translation(-pivotX, -pivotY)));
      const matrix = multiply(warp, toArtboard);

      placements.push({
        char,
        x: placed.x,
        y: placed.y,
        anchorX,
        anchorY,
        matrix,
        transform: matrixCss(matrix),
      });
    }
  });

  return placements.length ? placements : null;
}

export interface WarpGlyph {
  char: string;
  transform: string;
}

export function warpTextGlyphs(path: VectorPath): WarpGlyph[] | null {
  const placements = warpTextPlacements(path);
  if (!placements) return null;
  return placements.map(({ char, transform }) => ({ char, transform }));
}

/**
 * Box the warped label actually covers: the glyph anchors bow away from the
 * straight box, and each letter's ink reaches above its baseline.
 */
export function textWarpBounds(path: VectorPath): TextWorldBox | null {
  const placements = warpTextPlacements(path);
  if (!placements) return textWorldBox(path);
  const size = Math.max(1, path.fontSize || 48);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const glyph of placements) {
    minX = Math.min(minX, glyph.x);
    minY = Math.min(minY, glyph.y);
    maxX = Math.max(maxX, glyph.x);
    maxY = Math.max(maxY, glyph.y);
  }
  minX -= size * 0.6;
  maxX += size * 0.8;
  minY -= size * 1.1;
  maxY += size * 0.5;
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

export type { TextMatrix };
