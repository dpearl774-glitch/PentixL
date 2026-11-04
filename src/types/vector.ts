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

export interface CornerSource {
  points: AnchorPoint[];
  holes?: AnchorPoint[][];
}

export interface VectorPath {
  id: string;
  name: string;
  points: AnchorPoint[];
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
  /** Soft contact shadow under the solid. Undefined draws one. */
  extrudeShadow?: boolean;
  /** Uniform live corner radius; 0 or absent means sharp. */
  cornerRadius?: number;
  /** Per-corner overrides keyed by the sharp source anchor id. */
  cornerRadii?: Record<string, number>;
  /** Sharp geometry behind a generated rounding, so radius changes are reversible. */
  cornerSource?: CornerSource;
  /** Counter shapes — the inside of an o, p, a — punched out of the fill */
  holes?: AnchorPoint[][];
  closed: boolean;
  fill: string;
  fillOpacity: number;
  /** Optional gradient paint for the fill; when set it wins over `fill` */
  fillGradient?: GradientDef;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeCap: StrokeCap;
  strokeJoin: StrokeJoin;
  pressureProfile: PressureProfile;
  text?: string;
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
