import { WarpKind, WarpSpec } from '../types/vector';

/**
 * Pure warp maths. Kept apart from `warp.ts` so the text renderer can place
 * glyphs without importing the path/bbox helpers (which import the text
 * measure code) and closing a module cycle.
 */

export type WarpBox = { minX: number; minY: number; width: number; height: number };


/**
 * A real circular bend, which is what an arch (or an arc) has to be: the
 * bottom edge of the box becomes a piece of a circle and every point above it
 * travels onto the concentric circle at the same height. That radial fan is
 * what turns a stack of letters along the curve instead of sliding each whole
 * letter upwards by the same amount.
 *
 * The sagitta is how far the middle of the bottom edge moves: positive lifts
 * it (a bridge arch), negative drops it (a smile arc). Both ends stay put.
 */
function circularBend(
  x: number,
  y: number,
  box: WarpBox,
  sagitta: number
): { x: number; y: number } {
  const half = Math.max(0.5, (box.width || 1) / 2);
  const baseY = box.minY + (box.height || 0);
  if (!Number.isFinite(sagitta) || Math.abs(sagitta) < 0.5) return { x, y };
  const dir = sagitta > 0 ? 1 : -1;
  // A bend much deeper than half the width turns into a semicircle: the ends
  // dive back down and the letters there get shoved through their neighbours.
  // Capping the sagitta keeps the ends near the height they started.
  const lift = Math.min(Math.abs(sagitta), half * 0.85);
  // The circle runs on past the box, so the outermost artwork sits before the
  // steepest part of the curve and turns with the rest instead of peeling off.
  const span = half * 1.1;
  const radius = (span * span + lift * lift) / (2 * lift);
  const cx = box.minX + half;
  // Centre of the bend circle: below the baseline for an arch, above for a
  // smile arc, so both keep the two ends exactly where they were.
  const centreY = baseY + dir * (radius - lift);
  // Points past the two ends (a glyph hanging outside its own box) ride on the
  // last bit of the circle instead of hitting the square root of nothing.
  const dx = Math.max(-radius * 0.98, Math.min(radius * 0.98, x - cx));
  const across = Math.sqrt(Math.max(1e-6, radius * radius - dx * dx));
  // The baseline becomes this circle; every column stands on it, turned to the
  // local tangent, so a letter leans into the curve instead of sliding up.
  const arcY = centreY - dir * across;
  // Never lean a column past about 50 degrees: beyond that a tall letter's top
  // travels further than its own width and reads as a separate object.
  const slope = Math.max(-1.2, Math.min(1.2, (dir * dx) / across));
  const turn = 1 / Math.sqrt(1 + slope * slope);
  const height = y - baseY;
  return { x: x - height * slope * turn, y: arcY + height * turn };
}
/** Maps one point through the warp, in artboard space. */
export function warpPoint(x: number, y: number, box: WarpBox, spec: WarpSpec): { x: number; y: number } {
  const w = box.width || 1;
  const h = box.height || 1;
  const u = (x - box.minX) / w;
  const v = (y - box.minY) / h;
  const U = 2 * u - 1;
  const V = 2 * v - 1;
  const cx = box.minX + w / 2;
  const cy = box.minY + h / 2;
  const size = Math.max(w, h);

  // One hard rule for every style: a bend may never exceed 1.5x the object.
  // The old fields scaled radially, so 400 on a small shape could turn it
  // inside out; here the worst case is a strong but single-valued bend.
  const amount = Math.sign(spec.amount) * Math.min(Math.abs(spec.amount), size * 1.5);

  switch (spec.kind) {
    case 'arc':
      // A smile: the ends rise and the middle stays, bent on a circle.
      return circularBend(x, y, box, -amount);
    case 'arch':
      // Bridges on a circle: ends pinned, middle lifted, strokes radial.
      return circularBend(x, y, box, amount);
    case 'wave': {
      // A smooth corrugation. Amplitude is halved so a strong cycle count
      // undulates instead of throwing the line off the artboard.
      const cycles = Math.max(1, Math.min(6, spec.cycles ?? 1));
      // More cycles means a shorter wavelength, so the amplitude shrinks with
      // the count. Without this the slope flips sign every letter and the word
      // reads as scattered glyphs rather than a wave.
      return { x, y: y + (amount * 0.5 * Math.sin(2 * Math.PI * cycles * u)) / cycles };
    }
    case 'bulge':
      // Horizontal balloon: the middle rows push out, the top and bottom stay.
      return { x: x + amount * U * (1 - V * V), y };
    case 'pinch':
      // The same field inverted: a waist at the middle.
      return { x: x - amount * U * (1 - V * V), y };
    case 'perspective': {
      // A trapezoid: dx grows linearly with height, so the top widens as the
      // bottom narrows. Never allowed to invert through zero width.
      // Bend is a percentage here: 50 halves the narrow edge. The floor keeps
      // one edge from collapsing through zero width at extreme settings.
      const scale = Math.max(0.15, 1 + (amount / 100) * V);
      return { x: cx + (x - cx) * scale, y };
    }
    case 'flag':
      // One end lifts on a sine curve: a pennant, not a kink.
      return { x, y: y + amount * Math.sin((Math.PI * U) / 2) };
    case 'rise':
      // Asymmetric lift: the far (right) end rises on a parabola, the near
      // end stays put, so the object leans up rather than shearing flat.
      return { x, y: y - amount * (1 - Math.pow((1 - U) / 2, 2)) };
    case 'fisheye': {
      // Barrel lens: magnification peaks at the centre and dies at the corners.
      // Barrel remap: the centre magnifies and the rim is pulled inward. The
      // strength is capped at 1/8 so the radius stays monotonic — beyond that
      // the field folds and the rim overtakes the middle.
      const reach = Math.max(1, size / 2);
      const r = Math.min(1, Math.hypot(x - cx, y - cy) / reach);
      const strength = Math.max(-0.125, Math.min(0.125, amount / size));
      const factor = 1 + strength * (1 - 3 * r * r);
      return { x: cx + (x - cx) * factor, y: cy + (y - cy) * factor };
    }
    case 'inflate': {
      // Pincushion: the rim travels further than the centre, so the outline
      // swells outward instead of the middle exploding.
      const r2 = Math.min(1, (U * U + V * V) / 2);
      const scale = Math.max(0.15, 1 + (amount / size) * r2);
      return { x: cx + (x - cx) * scale, y: cy + (y - cy) * scale };
    }
    case 'twist': {
      // Rotation grows from the centre outwards, capping near 90 degrees at
      // the rim. Twisting hardest at the centre sheared the middle to nothing.
      const reach = Math.max(1, size / 2);
      const r = Math.min(1, Math.hypot(x - cx, y - cy) / reach);
      const angle = (amount / 100) * r * (Math.PI / 2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }
    case 'free': {
      const sway = spec.sway ?? 0;
      return {
        x: x + sway * (1 - V * V),
        y: y - amount * (1 - U * U),
      };
    }
    default:
      return { x, y };
  }
}

export interface WarpFrame {
  /** dx/dx — horizontal stretch */
  a: number;
  /** dy/dx — vertical shear */
  b: number;
  /** dx/dy — horizontal shear */
  c: number;
  /** dy/dy — vertical stretch */
  d: number;
}

const clampScale = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(-4, Math.min(4, value));
};

/** Shear is capped so a steep bend leans letters instead of flattening them. */
const clampShear = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-0.6, Math.min(0.6, value));
};

/**
 * The envelope's local derivative at one point. This is the difference between
 * a warp and a slide: feeding it to a glyph stretches, shears and turns the
 * letter the way the envelope does, while the string stays editable type.
 */
function frameAt(
  map: (x: number, y: number) => { x: number; y: number },
  x: number,
  y: number,
  box: WarpBox
): WarpFrame {
  const step = Math.max(0.25, Math.min(box.width || 1, box.height || 1) / 120);
  const origin = map(x, y);
  const along = map(x + step, y);
  const down = map(x, y + step);
  return {
    a: clampScale((along.x - origin.x) / step),
    b: clampShear((along.y - origin.y) / step),
    c: clampShear((down.x - origin.x) / step),
    d: clampScale((down.y - origin.y) / step),
  };
}

export function warpLocalMatrix(
  x: number,
  y: number,
  box: WarpBox,
  spec: WarpSpec
): WarpFrame {
  return frameAt((px, py) => warpPoint(px, py, box, spec), x, y, box);
}

/**
 * The warp a label actually follows. Type bows along its own baseline, so the
 * shape "arc" (a vertical shear of the whole box) would only slide a single
 * line sideways — on text it is the arch bow instead.
 */
export function textWarpKind(spec: WarpSpec): WarpKind {
  return spec.kind;
}

/**
 * Where a glyph's baseline point lands. Type sits on one line, so the shape
 * bulge (radial, measured from the middle of a tall box) would barely reach
 * letters near the baseline; on type the same setting opens or closes the
 * spacing around the centre of the line instead.
 */
export function textWarpPoint(x: number, y: number, box: WarpBox, spec: WarpSpec) {
  const kind = textWarpKind(spec);
  const w0 = box.width || 1;
  const center0 = box.minX + w0 / 2;
  // A single line has no top or bottom, so a trapezoid has nothing to taper:
  // perspective leaves type alone rather than fanning the letters apart.
  if (kind === 'perspective') return { x, y };
  // Radial styles have no radius to work with on a single baseline, so on type
  // they become tracking: the line widens or tightens evenly. A field that
  // stretched only the middle folded the centre letters over each other.
  if (kind === 'inflate' || kind === 'bulge' || kind === 'pinch') {
    const k = Math.max(-0.3, Math.min(0.3, (spec.amount ?? 0) / 100));
    const sign = kind === 'pinch' ? -1 : 1;
    return { x: center0 + (x - center0) * (1 + sign * k), y };
  }
  // Twist turns each letter in place; mapping the position through the rotation
  // threw glyphs far off the line, so only the angle changes.
  if (kind === 'twist') return { x, y };
  return warpPoint(x, y, box, { ...spec, kind });
}

/**
 * Radial styles are measured from the line for type, not from the tall glyph
 * box: letters sit on the baseline, near the bottom edge of that box, where a
 * box-centred radial warp would barely reach them.
 */
export function textWarpBox(box: WarpBox, spec: WarpSpec, baselineY: number, pad = 0): WarpBox {
  const kind = textWarpKind(spec);
  // A bend pivots on the ends of its box. Left on the metric box, the first
  // letter would sit exactly on that pivot — pinned, steeply turned and stuck
  // while the rest of the word lifts. Half a letter of margin each side puts
  // the first and last letters equally inside the curve.
  if ((kind === 'arch' || kind === 'arc') && pad > 0) {
    return { ...box, minX: box.minX - pad, width: box.width + pad * 2 };
  }
  if (kind === 'fisheye' || kind === 'inflate' || kind === 'twist') {
    return { ...box, minY: baselineY - box.height / 2, height: box.height };
  }
  return box;
}

/** The same derivative, measured on the field type is actually laid out on. */
export function textWarpLocalMatrix(
  x: number,
  y: number,
  box: WarpBox,
  spec: WarpSpec
): WarpFrame {
  return frameAt((px, py) => textWarpPoint(px, py, box, spec), x, y, box);
}
