/**
 * The compound path model the outline engine works in.
 *
 * Handles are stored as offsets from their own anchor (`dx`/`dy`) because that
 * is how font contours and SVG's relative commands arrive, and it keeps a node
 * movable without touching two absolute points. The editor's own VectorPath
 * keeps absolute handle points, so utils/compoundPath.ts converts in both
 * directions — a converted glyph opens in the node editor exactly where the
 * font put it.
 */
export interface AnchorPoint {
  id: string;
  x: number;
  y: number;
  handleIn: { dx: number; dy: number };
  handleOut: { dx: number; dy: number };
  type: 'corner' | 'smooth';
}

export interface VectorSubpath {
  id: string;
  points: AnchorPoint[];
  closed: boolean;
}

export interface CompoundVectorPath {
  id: string;
  subpaths: VectorSubpath[];
  fillRule: 'nonzero' | 'evenodd';
}
