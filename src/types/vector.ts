export interface Point {
  x: number;
  y: number;
}

export type AnchorType = 'corner' | 'smooth' | 'symmetric' | 'broken';

export interface AnchorPoint {
  id: string;
  x: number;
  y: number;
  handleIn?: Point;   // Incoming Bezier control point relative or absolute
  handleOut?: Point;  // Outgoing Bezier control point
  type: AnchorType;
  pressure?: number;  // 0.0 to 1.0 (touch pressure or speed-derived)
}

export interface GradientStop {
  offset: number; // 0..1 along the gradient
  color: string;  // hex
  opacity: number; // 0..1
}

export interface GradientDef {
  type: 'linear' | 'radial';
  /** Degrees, measured clockwise from the +x axis (screen space) */
  angle: number;
  stops: GradientStop[];
}

/** Ruler guide — an editing aid, never exported with artwork */
export interface Guide {
  id: string;
  axis: 'h' | 'v';
  /** World-space coordinate along the artboard */
  position: number;
  locked: boolean;
}

export type StrokeCap = 'round' | 'butt' | 'square';
export type StrokeJoin = 'round' | 'miter' | 'bevel';
export type PressureProfile = 'uniform' | 'tapered' | 'dynamic-touch' | 'calligraphy';

/**
 * What a shape looked like before its current warp, and how it was bent. The
 * bend still bakes into the points so every downstream tool sees real
 * geometry; the source is kept so a new amount bends the original artwork
 * instead of stacking another bend on top of the last one.
 */
export interface WarpSource {
  points: AnchorPoint[];
  holes?: AnchorPoint[][];
  /** The selection box the bend was measured against */
  box: { minX: number; minY: number; width: number; height: number };
  spec: WarpSpec;
}

export interface CornerSource {
  points: AnchorPoint[];
  holes?: AnchorPoint[][];
}

export interface BlurEffect {
  kind: 'gaussian' | 'motion';
  /** Spread, in artboard units */
  amount: number;
  /** Smear direction, degrees, y-down */
  angle: number;
}

/** A named pattern in the document library, the way a pattern swatch works */
export interface PatternSwatch {
  id: string;
  name: string;
  /** Tile artwork, laid out inside 0..tileW × 0..tileH */
  paths: VectorPath[];
  tileW: number;
  tileH: number;
  tileType?: 'grid' | 'brick-row' | 'brick-column' | 'hex';
  spacing?: number;
}

export interface PatternFill {
  /** The swatch this fill follows; editing that swatch repaints every user */
  swatchId?: string;
  /** Tile artwork, laid out inside 0..tileW × 0..tileH */
  paths: VectorPath[];
  tileW: number;
  tileH: number;
  scale: number;
  rotation: number;
  /** Tile Type, as in Illustrator's Pattern Options */
  tileType?: 'grid' | 'brick-row' | 'brick-column' | 'hex';
  /** Gap between tiles, in artboard px */
  spacing?: number;
  /** Slides the tiling without moving the object */
  offsetX?: number;
  offsetY?: number;
}

export interface VectorPath {
  id: string;
  name: string;
  points: AnchorPoint[];
  /**
   * How the fill treats overlapping contours. Even-odd is the editor default
   * because a counter is drawn as a separate hole; converted type needs nonzero
   * instead, since a glyph's own contours touch and overlap where a stem meets
   * a bowl, and even-odd cancels those overlaps into notches.
   */
  fillRule?: 'nonzero' | 'evenodd';
  /** Path used as a live clipping mask for this object, if any. */
  clipPathId?: string;
  /** This object is a mask source: it clips others and is not painted alone. */
  isClippingMask?: boolean;
  /** Extrusion depth in artboard units; 0 or absent means flat. */
  extrudeDepth?: number;
  /** Extrusion direction in degrees; defaults to down-right. */
  extrudeAngle?: number;
  /** Perspective shrink of the back face, 0–0.45. Undefined uses the default. */
  extrudeTaper?: number;
  /**
   * How far the artwork is tipped back into the screen, in degrees: 0 paints it
   * flat with the depth hidden behind it, 85 stands it almost on edge. Undefined
   * uses the default, which shows both the face and the solid.
   */
  extrudeTilt?: number;
  /** Degrees the solid is turned about the vertical axis, ±70. */
  extrudeTurn?: number;
  /** Camera strength, 0 (orthographic) to 1 (close). Undefined uses the default. */
  extrudePerspective?: number;
  /** Chamfer width on the front rim, in artboard units. Undefined uses the default. */
  extrudeBevel?: number;
  /** Rim shape: a single chamfer or a rounded rollover. */
  extrudeBevelStyle?: 'chamfer' | 'round';
  /** Key light direction in degrees, like extrudeAngle. Absolute once set. */
  extrudeLight?: number;
  /** Front-face highlight strength, 0–1. */
  extrudeGloss?: number;
  /** Ground shadow blur multiplier, 0.4–2.5. */
  extrudeShadowSoft?: number;
  /** Ground shadow distance multiplier, 0–2. */
  extrudeShadowLift?: number;
  /** Soft contact shadow under the solid. Undefined draws one. */
  extrudeShadow?: boolean;
  /** Uniform live corner radius; 0 or absent means sharp. */
  cornerRadius?: number;
  /** Per-corner overrides keyed by the sharp source anchor id. */
  cornerRadii?: Record<string, number>;
  /** Sharp geometry behind a generated rounding, so radius changes are reversible. */
  cornerSource?: CornerSource;
  /** Geometry behind the current shape warp; see WarpSource. */
  warpSource?: WarpSource;
  /** Counter shapes — the inside of an o, p, a — punched out of the fill */
  holes?: AnchorPoint[][];
  closed: boolean;
  fill: string;
  fillOpacity: number;
  /** Optional gradient paint for the fill; when set it wins over `fill` */
  fillGradient?: GradientDef;
  /**
   * Raster paint: a photo cropped to this object's own outline. The image is
   * laid over the shape's bounds and clipped by its geometry, so a clipped
   * image is just this plus an ordinary clipping mask on top.
   */
  image?: { url: string; width: number; height: number };
  /** Soft focus or speed lines — paint only, the geometry never moves */
  blur?: BlurEffect;
  /** Tiled artwork used as this object's fill paint */
  pattern?: PatternFill;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeCap: StrokeCap;
  strokeJoin: StrokeJoin;
  pressureProfile: PressureProfile;
  text?: string;
  /** Area type: each line starts at its own left edge instead of a common one */
  textLineX?: number[];
  /** The closed shape this label was wrapped into, so it can be reflowed */
  areaShapeId?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  /** Extra space between letters, in artboard pixels */
  letterSpacing?: number;
  /**
   * Local-to-world affine transform for live text: [a, b, c, d, e, f].
   * The baseline stays in the first point; this keeps scale, rotation and
   * flips on the glyph box without rasterising or moving the anchor.
   */
  textMatrix?: [number, number, number, number, number, number];
  /** Runs the string along another object's outline */
  textPath?: {
    pathId: string;
    offset: number;
    baselineOffset?: number;
    /** Where the string sits on the outline, like Illustrator's Align to Path */
    align?: 'baseline' | 'center' | 'ascender' | 'descender';
    /** Runs the string the other way round the outline */
    reverse?: boolean;
  };
  /**
   * Live text warp. The glyphs bend on render while the string, font and size
   * stay editable type — nothing is converted to curves until the user asks.
   */
  warp?: WarpSpec;
  /** Per-object visibility — hidden objects stop rendering and stop catching taps */
  visible?: boolean;
  /** Per-object lock — locked objects render but cannot be picked or moved */
  locked?: boolean;
  /** Object opacity, multiplied with the fill and stroke alpha */
  opacity?: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  paths: VectorPath[];
  /** Grouped objects keep their own layer so they can move as one unit */
  isGroup?: boolean;
}

export type WarpKind =
  | 'arc'
  | 'arch'
  | 'wave'
  | 'bulge'
  | 'pinch'
  | 'perspective'
  | 'flag'
  | 'rise'
  | 'fisheye'
  | 'inflate'
  | 'twist'
  | 'free';

export interface WarpSpec {
  kind: WarpKind;
  /** Bend in artboard px, capped at 1.5x the object so it cannot fold itself */
  amount: number;
  /** Horizontal bend for the free warp, in artboard px */
  sway?: number;
  /** Wave cycles across the selection */
  cycles?: number;
  /**
   * Circle the text rides on, in artboard px (0 = derived from the bend).
   * Badges and school logos are arcs of a real circle, not a generic bow.
   */
  radius?: number;
}

export type ToolType = 
  | 'select'          // Move and transform paths
  | 'direct-select'   // Move individual anchor points or handles
  | 'pen'             // Illustrator bezier pen tool
  | 'pencil'          // Freehand pencil: fitted curves, closes on the start point
  | 'shape-builder'   // Interactive shape builder (Unite / Erase across regions)
  | 'shape'           // Rectangle, Circle, Polygon, Star
  | 'pressure-brush'  // Dynamic touch/stylus pressure vector stroke
  | 'text'            // Vector Typography tool
  | 'hand';           // Pan canvas

export type PencilSmoothing = 'tight' | 'smooth' | 'loose';

export type ShapeKind =
  | 'rectangle'
  | 'rounded-rect'
  | 'circle'
  | 'semicircle'
  | 'triangle'
  | 'polygon'
  | 'octagon'
  | 'star'
  | 'star8'
  | 'heart'
  | 'shield'
  | 'arrow'
  | 'diamond'
  | 'ring'
  | 'pill'
  | 'crescent'
  | 'line';

export interface ShapeOptions {
  kind: ShapeKind;
  sides?: number;      // For polygon (3 to 12)
  points?: number;     // For star
  innerRadiusRatio?: number; // For star (0.2 to 0.8)
  cornerRadius?: number; // For rounded rect
}

export interface CanvasView {
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
}

export interface ModifierState {
  shift: boolean;      // Constrain 45 deg or 1:1 aspect
  ctrl: boolean;       // Quick Direct Selection
  alt: boolean;        // Break handles / Subtract mode
}

export interface SelectionState {
  selectedPathIds: string[];
  selectedAnchorIndex: number | null;
  /** Additional anchors selected with Shift; selectedAnchorIndex is the last one. */
  selectedAnchorIndexes?: number[];
  selectedHandleType: 'in' | 'out' | null;
}

export interface PressureConfig {
  source: 'stylus-or-touch' | 'velocity' | 'fixed';
  minWidth: number;
  maxWidth: number;
  smoothing: number;
  calligraphyAngle: number; // degrees (e.g. 45)
}

export interface ReferenceImage {
  id: string;
  name: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
}
