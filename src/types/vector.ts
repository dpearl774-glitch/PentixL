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

export interface VectorPath {
  id: string;
  name: string;
  points: AnchorPoint[];
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
  | 'shape-builder'   // Interactive shape builder (Unite / Erase across regions)
  | 'shape'           // Rectangle, Circle, Polygon, Star
  | 'pressure-brush'  // Dynamic touch/stylus pressure vector stroke
  | 'text'            // Vector Typography tool
  | 'hand';           // Pan canvas

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
