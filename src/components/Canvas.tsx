import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CANVAS } from '../theme';
import {
  AnchorPoint,
  CanvasView,
  GradientDef,
  Guide,
  Layer,
  ModifierState,
  PencilSmoothing,
  Point,
  PressureConfig,
  ReferenceImage,
  SelectionState,
  ShapeKind,
  ShapeOptions,
  ToolType,
  VectorPath,
} from '../types/vector';
import { gradientCoords } from '../utils/gradients';
import { gradientIdFor } from '../utils/svgExport';
import {
  distance,
  pointsToSvgPath,
  snapAngle,
  createSymmetricHandles,
  generateVariableStrokePolygon,
  insertPointOnSegment,
  nearestPointOnSegment,
  pathToSvgD,
} from '../utils/bezier';
import { generateShapePath } from '../utils/shapeGenerator';
import { fitBezierPath } from '../utils/curveFit';
import {
  computePathsBoundingBox,
  scalePaths,
  rotatePaths,
  translatePaths,
  BoundingBox,
  HandleType,
} from '../utils/transform';
import { textLineHeight, textLines, textMatrixCss } from '../utils/textGeometry';
import {
  SmartGuideLine,
  getSnapCandidates,
  calculateMoveSmartGuides,
  calculateResizeSmartGuides,
} from '../utils/smartGuides';
import {
  computeAtomicSubRegions,
  findSubRegionAtPoint,
  executeShapeBuilderMerge,
  executeShapeBuilderErase,
  SubRegion,
} from '../utils/shapeBuilderRegions';
import { computeVisiblePathsBoundingBox } from '../utils/shapeBuilder';
import { PrecisionPad } from './PrecisionPad';
import { computeSelectionOverlapD } from '../utils/overlap';
import { extrusionFaces, extrusionShadow } from '../utils/extrusion';
import {
  clipPathIdFor,
  clippingUrlFor,
  collectClipIds,
  collectClippingMasks,
} from '../utils/clipping';

const RULER_SIZE = 26;

/** Pointer id used for the synthetic presses the precision pad sends. */
const PAD_POINTER_ID = 8301;

const PadGlyph: React.FC = () => (
  <svg
    width={11}
    height={11}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <circle cx="6" cy="6" r="2.6" />
    <path d="M6 0.6v2.4M6 9v2.4M0.6 6h2.4M9 6h2.4" />
  </svg>
);

/** Radius, in canvas units, of the hit target around an anchor node. */
const ANCHOR_HIT_RADIUS = 26;

/** Screen-pixel fidelity per pencil setting — lower follows the finger closer */
const PENCIL_TOLERANCE: Record<PencilSmoothing, number> = {
  tight: 0.9,
  smooth: 2.6,
  loose: 5.2,
};

/** Low-pass passes applied before fitting. Tight stays close to the finger. */
const PENCIL_BLEND: Record<PencilSmoothing, { passes: number; weight: number }> = {
  tight: { passes: 0, weight: 0 },
  smooth: { passes: 2, weight: 0.32 },
  loose: { passes: 3, weight: 0.4 },
};

/**
 * Removes hand jitter before the Bezier fit. Sharp reversals are left alone so
 * corners and deliberate hooks do not turn into soft curves.
 */
function smoothPencilSamples(points: Point[], level: PencilSmoothing): Point[] {
  const { passes, weight } = PENCIL_BLEND[level];
  if (passes === 0 || points.length < 3) return points.map((p) => ({ x: p.x, y: p.y }));
  let current = points.map((p) => ({ x: p.x, y: p.y }));
  for (let pass = 0; pass < passes; pass++) {
    current = current.map((point, index) => {
      if (index === 0 || index === current.length - 1) return point;
      const prev = current[index - 1];
      const next = current[index + 1];
      const ax = point.x - prev.x;
      const ay = point.y - prev.y;
      const bx = next.x - point.x;
      const by = next.y - point.y;
      const lengths = Math.hypot(ax, ay) * Math.hypot(bx, by);
      const turn = lengths > 0 ? (ax * bx + ay * by) / lengths : 1;
      // Preserve genuine corners rather than rounding them away.
      if (turn < 0.25) return point;
      return {
        x: point.x * (1 - 2 * weight) + prev.x * weight + next.x * weight,
        y: point.y * (1 - 2 * weight) + prev.y * weight + next.y * weight,
      };
    });
  }
  return current;
}

/** How near the start point the stroke must end to close the shape */
const PENCIL_CLOSE_RADIUS = 22;

/**
 * Nearest point on a path's outline to `pt`, within `threshold` canvas units.
 * Returns the index a node would be inserted at, so the + marker on the canvas
 * always points at the same spot a tap would use.
 */
const segmentInsertAt = (
  path: VectorPath,
  pt: Point,
  threshold: number
): { segmentIndex: number; t: number; point: Point } | null => {
  if (path.points.length < 2) return null;

  const count = path.points.length;
  const segments = path.closed ? count : count - 1;
  let bestDist = threshold;
  let best: { segmentIndex: number; t: number; point: Point } | null = null;

  for (let i = 0; i < segments; i++) {
    const hit = nearestPointOnSegment(path, i, pt);
    if (!hit) continue;
    if (hit.distance < bestDist) {
      bestDist = hit.distance;
      best = { segmentIndex: i, t: hit.t, point: hit.point };
    }
  }

  return best;
};

interface CanvasProps {
  view: CanvasView;
  onViewChange: (newView: CanvasView) => void;
  layers: Layer[];
  activeLayerId: string;
  onUpdatePath: (path: VectorPath, options?: { preserveCornerSource?: boolean }) => void;
  onAddPath: (path: VectorPath) => void;
  tool: ToolType;
  shapeKind: ShapeKind;
  shapeSides: number;
  modifiers: ModifierState;
  selection: SelectionState;
  onSelectionChange: (newSelection: SelectionState) => void;
  gridVisible: boolean;
  gridSnapEnabled: boolean;
  gridSpacingX: number;
  gridSpacingY: number;
  /** 0..1 line visibility of the grid */
  gridOpacity: number;
  artboardColor: string;
  rulersVisible: boolean;
  guides: Guide[];
  onAddGuide: (axis: 'h' | 'v', position: number) => void;
  onUpdateGuide: (id: string, position: number) => void;
  /** Called once when a guide drag ends, so the move becomes one undo step */
  onCommitGuides?: () => void;
  /** One global lock that freezes every guide and stops new ones */
  guidesLocked?: boolean;
  /** Gradient paint for newly created fills, when the gradient style is active */
  fillGradient?: GradientDef | null;
  fillOpacity?: number;
  strokeOpacity?: number;
  eyedropperActive?: boolean;
  onSamplePoint?: (point: Point) => void;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  /** Pencil fidelity, chosen in the tool options strip */
  pencilSmoothing?: PencilSmoothing;
  pressureConfig: PressureConfig;
  onCommitHistory: () => void;
  activePathInProgress: VectorPath | null;
  setActivePathInProgress: React.Dispatch<React.SetStateAction<VectorPath | null>>;
  /** The draw-inside source also clips the live stroke before it is committed. */
  drawInsideId?: string | null;
  onReplacePaths?: (removePathIds: string[], newPaths: VectorPath[]) => void;
  isPanZoomLocked?: boolean;
  smartGuidesEnabled?: boolean;
  referenceImages?: ReferenceImage[];
  onUpdateReference?: (image: ReferenceImage) => void;
  sbMode?: 'merge' | 'erase';
  clipArtboard?: boolean;
  onRequestText?: (point: Point) => void;
  /** Opens the type editor for an existing text object */
  onEditText?: (path: VectorPath) => void;
  onToolSwitch?: (tool: ToolType) => void;
  /** While the nudge pad is open the selection rectangle steps out of the way */
  hideTransformBox?: boolean;
  /** The precision pad is optional; when off, its launcher is hidden */
  showPrecisionPad?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({
  view,
  onViewChange,
  layers,
  activeLayerId,
  onUpdatePath,
  onAddPath,
  tool,
  shapeKind,
  shapeSides,
  modifiers,
  selection,
  onSelectionChange,
  gridVisible,
  gridSnapEnabled,
  gridSpacingX,
  gridSpacingY,
  gridOpacity,
  artboardColor,
  rulersVisible,
  guides,
  onAddGuide,
  onUpdateGuide,
  onCommitGuides,
  fillGradient = null,
  fillOpacity = 1,
  strokeOpacity = 1,
  eyedropperActive = false,
  onSamplePoint,
  fillColor,
  strokeColor,
  strokeWidth,
  pencilSmoothing = 'smooth',
  pressureConfig,
  onCommitHistory,
  activePathInProgress,
  setActivePathInProgress,
  drawInsideId = null,
  onReplacePaths,
  isPanZoomLocked = false,
  smartGuidesEnabled = true,
  referenceImages = [],
  onUpdateReference,
  sbMode = 'merge',
  clipArtboard = false,
  onRequestText,
  onEditText,
  guidesLocked = false,
  onToolSwitch,
  hideTransformBox = false,
  showPrecisionPad = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Interaction Drag States
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [currentPointerPoint, setCurrentPointerPoint] = useState<Point | null>(null);

  // Marquee selection box
  const [marqueeBox, setMarqueeBox] = useState<{ start: Point; current: Point } | null>(null);

  // Smart Guides: Temporary alignment lines active during move or transform
  const [activeSmartGuides, setActiveSmartGuides] = useState<SmartGuideLine[]>([]);

  // Dragging Target: can be anchor, handle, path, transform stretch handle, pan, or shape-builder-drag
  const [draggingTarget, setDraggingTarget] = useState<{
    type: 'anchor' | 'handle-in' | 'handle-out' | 'path' | 'shape-preview' | 'pan' | 'transform-handle' | 'rotate-handle' | 'marquee' | 'shape-builder-drag';
    pathId?: string;
    pointIndex?: number;
    initialPoint?: Point;
    initialPathPoints?: AnchorPoint[];
    transformHandle?: HandleType;
    initialBBox?: BoundingBox;
    initialSelectedPaths?: VectorPath[];
    pointIndexes?: number[];
  } | null>(null);

  // Shape Builder region selection (the merge/erase mode lives in the app shell)
  const [sbSelectedRegionIds, setSbSelectedRegionIds] = useState<string[]>([]);
  const [sbHoveredRegionId, setSbHoveredRegionId] = useState<string | null>(null);
  const [sbDragPoints, setSbDragPoints] = useState<Point[]>([]);

  // Multi-touch gestures (Pinch-to-zoom & two-finger pan)
  const activePointersRef = useRef<Map<number, Point>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);
  const initialPinchPanRef = useRef<Point>({ x: 0, y: 0 });

  // Velocity tracking for Touch Pressure simulation
  const lastPointerTimeRef = useRef<number>(0);
  const lastPointerPosRef = useRef<Point>({ x: 0, y: 0 });
  const smoothedPressureRef = useRef<number>(0.5);

  // Synchronous brush reference to prevent dropped strokes
  const brushStrokeRef = useRef<VectorPath | null>(null);

  // Pencil: raw finger samples live in a ref until the stroke is fitted
  const pencilPointsRef = useRef<Point[]>([]);
  const [pencilStroke, setPencilStroke] = useState<Point[] | null>(null);

  // Double tap on an object switches to direct selection
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const registerTap = (id: string) => {
    const now = performance.now();
    const last = lastTapRef.current;
    lastTapRef.current = { id, time: now };
    return !!last && last.id === id && now - last.time < 340;
  };

  // Dragging an unlocked reference image
  const referenceDragRef = useRef<{ id: string; grab: Point; origin: Point } | null>(null);

  // Guide interactions — dragged either from a ruler or on the canvas
  const guideDragRef = useRef<{ id: string; axis: 'h' | 'v' } | null>(null);
  /** Mirrored into state so the guide being moved can be highlighted */
  const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null);
  const guideDragStartRef = useRef<number | null>(null);
  const [rulerDraft, setRulerDraft] = useState<{ axis: 'h' | 'v'; position: number } | null>(null);
  const rulerAxisRef = useRef<'h' | 'v' | null>(null);

  // Precision pad: crosshair position (container-relative px) and the element
  // the current synthetic press landed on
  const [padOpen, setPadOpen] = useState(false);
  const [padCursor, setPadCursor] = useState<Point | null>(null);
  const padCursorRef = useRef<Point | null>(null);
  const padTargetRef = useRef<Element | null>(null);
  /** True from a synthetic press until its release */
  const padPressRef = useRef(false);
  /** True while the pad is open, when the canvas refuses direct touch */
  const padOpenRef = useRef(false);
  /** Two real fingers tracked by the pad's guard, for pan and pinch-zoom */
  const guardPointersRef = useRef<Map<number, Point>>(new Map());
  const guardPinchRef = useRef<{ dist: number; zoom: number; panX: number; panY: number } | null>(
    null
  );

  // Convert client screen coordinates to canvas coordinate space
  const rawCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - view.panX) / view.zoom,
        y: (clientY - rect.top - view.panY) / view.zoom,
      };
    },
    [view]
  );

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      const raw = rawCanvasPoint(clientX, clientY);
      if (!gridSnapEnabled) return raw;
      return {
        x: Math.round(raw.x / gridSpacingX) * gridSpacingX,
        y: Math.round(raw.y / gridSpacingY) * gridSpacingY,
      };
    },
    [rawCanvasPoint, gridSnapEnabled, gridSpacingX, gridSpacingY]
  );

  /* ------------------------------------------------------------------ *
   * Precision pad
   *
   * A trackpad between the thumb clusters steers a crosshair, so the finger
   * never sits on the node. Its gestures are replayed as real pointer events
   * at the crosshair, which means every tool behaves exactly as it does under
   * a fingertip — there is no second copy of the hit-testing to keep in sync.
   * ------------------------------------------------------------------ */
  /** Topmost artwork element at a screen point, ignoring the editor's overlays */
  const padHitElement = (clientX: number, clientY: number): Element | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      if (node === svg || svg.contains(node)) return node;
    }
    return svg;
  };

  const padClientPoint = (): Point | null => {
    const el = containerRef.current;
    const cur = padCursorRef.current;
    if (!el || !cur) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + cur.x, y: rect.top + cur.y };
  };

  const movePadCursor = (dx: number, dy: number) => {
    const el = containerRef.current;
    if (!el) return;
    const cur = padCursorRef.current ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    const next = {
      x: Math.min(Math.max(cur.x + dx, 1), Math.max(1, el.clientWidth - 1)),
      y: Math.min(Math.max(cur.y + dy, 1), Math.max(1, el.clientHeight - 1)),
    };
    padCursorRef.current = next;
    setPadCursor(next);

    // Keep the + / − node markers following the crosshair, not the finger
    const rect = el.getBoundingClientRect();
    setCurrentPointerPoint(screenToCanvas(rect.left + next.x, rect.top + next.y));
  };

  const dispatchPadPointer = (type: 'pointerdown' | 'pointermove' | 'pointerup') => {
    const pt = padClientPoint();
    if (!pt) return;

    // A press picks its own target; moves and the release follow it, falling
    // back to the canvas if that element has since been re-rendered away.
    const target =
      type === 'pointerdown'
        ? padHitElement(pt.x, pt.y)
        : padTargetRef.current?.isConnected
          ? padTargetRef.current
          : svgRef.current;
    if (!target) return;
    if (type === 'pointerdown') {
      padTargetRef.current = target;
      padPressRef.current = true;
    }

    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: pt.x,
        clientY: pt.y,
        pointerId: PAD_POINTER_ID,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
      })
    );

    if (type === 'pointerup') {
      padTargetRef.current = null;
      padPressRef.current = false;
    }
  };

  /** Wheel or two-finger scroll over the pad: pan, or zoom with ⌘/ctrl held. */
  const handlePadWheel = (dx: number, dy: number, zoomIntent: boolean) => {
    if (isPanZoomLocked) return;
    if (!zoomIntent) {
      onViewChange({ ...view, panX: view.panX - dx, panY: view.panY - dy });
      return;
    }
    const rect = svgRef.current?.getBoundingClientRect();
    const pt = padClientPoint();
    if (!rect || !pt) return;
    // Anchor the zoom on the crosshair so the node being worked on stays put.
    const cx = pt.x - rect.left;
    const cy = pt.y - rect.top;
    const ratio = Math.exp(-dy * 0.0018);
    const zoom = Math.min(5, Math.max(0.05, view.zoom * ratio));
    onViewChange({
      ...view,
      zoom,
      panX: cx - (cx - view.panX) * (zoom / view.zoom),
      panY: cy - (cy - view.panY) * (zoom / view.zoom),
    });
  };

  const openPad = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const start = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    padCursorRef.current = start;
    padOpenRef.current = true;
    setPadCursor(start);
    setCurrentPointerPoint(screenToCanvas(rect.left + start.x, rect.top + start.y));
    setPadOpen(true);
  };

  const closePad = () => {
    padOpenRef.current = false;
    setPadOpen(false);
    setPadCursor(null);
    padCursorRef.current = null;
    padTargetRef.current = null;
    padPressRef.current = false;
    guardPointersRef.current.clear();
    guardPinchRef.current = null;
  };

  /* ------------------------------------------------------------------ *
   * Pad guard
   *
   * While the pad is open the artwork must not react to a finger, but two
   * fingers still need to pan and zoom. One finger is swallowed by the guard
   * layer; two are measured here with the same maths the canvas uses, so the
   * gesture feels identical to the one outside the pad.
   * ------------------------------------------------------------------ */
  const handlePadGuardDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the gesture still tracks inside the layer */
    }
    guardPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (guardPointersRef.current.size === 2 && !isPanZoomLocked) {
      const [a, b] = Array.from(guardPointersRef.current.values());
      guardPinchRef.current = {
        dist: distance(a, b),
        zoom: view.zoom,
        panX: view.panX,
        panY: view.panY,
      };
    }
  };

  const handlePadGuardMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!guardPointersRef.current.has(e.pointerId)) return;
    guardPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pinch = guardPinchRef.current;
    if (!pinch || guardPointersRef.current.size !== 2 || pinch.dist === 0) return;

    const pts = Array.from(guardPointersRef.current.values());
    const ratio = distance(pts[0], pts[1]) / pinch.dist;
    if (!Number.isFinite(ratio)) return;

    const zoom = Math.min(5, Math.max(0.05, pinch.zoom * ratio));
    const rect = svgRef.current?.getBoundingClientRect();
    const midX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
    const midY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);

    onViewChange({
      ...view,
      zoom,
      panX: midX - (midX - pinch.panX) * (zoom / pinch.zoom),
      panY: midY - (midY - pinch.panY) * (zoom / pinch.zoom),
    });
  };

  const handlePadGuardUp = (e: React.PointerEvent<HTMLDivElement>) => {
    guardPointersRef.current.delete(e.pointerId);
    if (guardPointersRef.current.size < 2) guardPinchRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  // Visible paths
  const currentLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
  // Hidden objects stop existing for selection, snapping and transforms
  const allPaths = layers.flatMap((l) =>
    l.visible ? l.paths.filter((p) => p.visible !== false) : []
  );

  // Determine effective tool based on Modifier (Ctrl key toggles Direct Select)
  const effectiveTool: ToolType = modifiers.ctrl ? 'direct-select' : tool;

  // Selected paths for transformation
  const selectedPaths = allPaths.filter((p) => selection.selectedPathIds.includes(p.id));
  const selectedBBox = computeVisiblePathsBoundingBox(
    selectedPaths,
    layers.flatMap((layer) => layer.paths)
  );
  const drawInsideSource = React.useMemo(() => {
    if (!drawInsideId) return null;
    for (const layer of layers) {
      if (!layer.visible) continue;
      const source = layer.paths.find(
        (path) =>
          path.id === drawInsideId &&
          path.visible !== false &&
          path.closed &&
          !path.text &&
          !path.isClippingMask
      );
      if (source) return source;
    }
    return null;
  }, [drawInsideId, layers]);
  const clippingMasks = React.useMemo(() => {
    const masks = collectClippingMasks(layers);
    if (!drawInsideSource || masks.some((mask) => mask.id === drawInsideSource.id)) {
      return masks;
    }
    return [...masks, drawInsideSource];
  }, [drawInsideSource, layers]);
  const clipIds = React.useMemo(() => collectClipIds(layers), [layers]);
  const missingClipIds = React.useMemo(() => {
    const present = new Set(clippingMasks.map((mask) => mask.id));
    return [...clipIds].filter((id) => !present.has(id));
  }, [clipIds, clippingMasks]);
  const drawInsideClipUrl = drawInsideSource
    ? `url(#${clipPathIdFor(drawInsideSource.id)})`
    : undefined;
  const selectionOverlapD = React.useMemo(() => {
    if (selection.selectedPathIds.length < 2) return null;
    const selected = layers
      .filter((layer) => layer.visible)
      .flatMap((layer) => layer.paths)
      .filter(
        (path) => path.visible !== false && selection.selectedPathIds.includes(path.id)
      );
    return computeSelectionOverlapD(
      selected,
      layers.flatMap((layer) => layer.paths)
    );
  }, [layers, selection.selectedPathIds]);
  const selectedAnchors =
    selection.selectedAnchorIndex !== null
      ? selection.selectedAnchorIndexes?.includes(selection.selectedAnchorIndex)
        ? selection.selectedAnchorIndexes
        : [selection.selectedAnchorIndex]
      : [];

  /**
   * Shift constrains the next pen anchor to the nearest 45° ray from the last
   * one, which pulls the node off your finger. That is the point of the
   * constraint, but it is invisible until the node has already landed — so
   * preview exactly where it will go.
   */
  const penSnapPreview = React.useMemo(() => {
    if (effectiveTool !== 'pen' || !modifiers.shift) return null;
    if (!activePathInProgress || !currentPointerPoint) return null;
    const from = activePathInProgress.points[activePathInProgress.points.length - 1];
    if (!from) return null;
    return { from, snapped: snapAngle(from, currentPointerPoint) };
  }, [effectiveTool, modifiers.shift, activePathInProgress, currentPointerPoint]);

  // Adobe Illustrator Shape Builder: Participating Paths & Planar Atomic Decomposition
  const participatingPaths = React.useMemo(() => {
    if (tool !== 'shape-builder') return [];
    if (selection.selectedPathIds.length >= 2) {
      return allPaths.filter(
        (p) =>
          !p.isClippingMask &&
          selection.selectedPathIds.includes(p.id) &&
          (p.closed || p.points.length >= 3)
      );
    }
    const layerClosed = currentLayer.paths.filter(
      (p) => !p.isClippingMask && (p.closed || p.points.length >= 3)
    );
    if (layerClosed.length >= 2) return layerClosed;
    const allClosed = allPaths.filter(
      (p) => !p.isClippingMask && (p.closed || p.points.length >= 3)
    );
    if (allClosed.length >= 2) return allClosed;
    return [];
  }, [tool, selection.selectedPathIds, allPaths, currentLayer]);

  // Compute atomic planar sub-regions
  const atomicRegions = React.useMemo<SubRegion[]>(() => {
    if (tool !== 'shape-builder' || participatingPaths.length < 2) return [];
    try {
      return computeAtomicSubRegions(
        participatingPaths,
        layers.flatMap((layer) => layer.paths)
      );
    } catch (err) {
      console.warn('Shape builder planar decomposition error:', err);
      return [];
    }
  }, [tool, participatingPaths, layers]);

  // Anything locked cannot be picked: an object by its own lock, or every
  // object in a locked layer. The canvas used to ignore layer.locked entirely.
  const lockedPathIds = React.useMemo(() => {
    const ids = new Set<string>();
    layers.forEach((layer) => {
      layer.paths.forEach((p) => {
        if (layer.locked || p.locked === true) ids.add(p.id);
      });
    });
    return ids;
  }, [layers]);

  // Other objects do not move while a transform is dragged, so their boxes can
  // be measured once per selection instead of once per pointer event.
  const otherSnapBBoxes = React.useMemo(() => {
    const boxes: { id: string; bbox: BoundingBox; name?: string }[] = [];
    for (const path of allPaths) {
      if (selection.selectedPathIds.includes(path.id)) continue;
      const box = computePathsBoundingBox([path]);
      if (box) boxes.push({ id: path.id, bbox: box, name: path.name });
    }
    return boxes;
  }, [allPaths, selection.selectedPathIds]);

  // Unified helper for initiating drags on SVG child elements with pointer capture
  const startDragOperation = (
    e: React.PointerEvent,
    target: {
      type: 'anchor' | 'handle-in' | 'handle-out' | 'path' | 'shape-preview' | 'pan' | 'transform-handle' | 'rotate-handle' | 'marquee' | 'shape-builder-drag';
      pathId?: string;
      pointIndex?: number;
      initialPoint?: Point;
      initialPathPoints?: AnchorPoint[];
      transformHandle?: HandleType;
      initialBBox?: BoundingBox;
      initialSelectedPaths?: VectorPath[];
      pointIndexes?: number[];
    }
  ) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (_) {}
    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    setIsPointerDown(true);
    setDragStartPoint(canvasPt);
    setCurrentPointerPoint(canvasPt);
    lastPointerTimeRef.current = performance.now();
    lastPointerPosRef.current = canvasPt;
    setDraggingTarget(target);
  };

  /**
   * Grabs a node for dragging. Shared by the node itself and by the handle
   * grabbers, so a press that lands on the node always moves the node.
   */
  const grabAnchor = (
    pathId: string,
    index: number,
    point: Point,
    e: React.PointerEvent
  ) => {
    const samePath =
      selection.selectedPathIds.length === 1 && selection.selectedPathIds[0] === pathId;
    const additive = modifiers.shift && samePath && selection.selectedAnchorIndex !== null;
    const current = additive
      ? selection.selectedAnchorIndexes?.includes(selection.selectedAnchorIndex!)
        ? selection.selectedAnchorIndexes
        : [selection.selectedAnchorIndex!]
      : [];
    const indexes = additive
      ? current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index]
      : [index];

    // Shift-clicking the last selected node removes it without starting a drag.
    if (indexes.length === 0) {
      onSelectionChange({
        selectedPathIds: [pathId],
        selectedAnchorIndex: null,
        selectedAnchorIndexes: [],
        selectedHandleType: null,
      });
      return;
    }

    onSelectionChange({
      selectedPathIds: [pathId],
      selectedAnchorIndex: additive ? indexes[indexes.length - 1] : index,
      selectedAnchorIndexes: indexes,
      selectedHandleType: null,
    });
    startDragOperation(e, {
      type: 'anchor',
      pathId,
      pointIndex: index,
      pointIndexes: indexes,
      initialPoint: { x: point.x, y: point.y },
    });
  };

  /** While set, taps near the outline select instead of inserting a node. */
  const insertBlockedUntilRef = useRef(0);

  /**
   * Adds a node where the pointer is, splitting the segment so the outline does
   * not move. The new node is handed to the drag, so pulling its handles works
   * immediately — and the same call serves the + badge and a plain tap.
   */
  const insertNodeAt = (
    path: VectorPath,
    hit: { segmentIndex: number; t: number; point?: Point },
    e?: React.PointerEvent
  ) => {
    // Right after a delete the same tap must not put the node straight back
    if (performance.now() < insertBlockedUntilRef.current) return;

    // Inserting beside an existing node stacks a second node on top of the
    // first, which reads as "the node won't delete" — select it instead.
    if (hit.point) {
      const tapped = hit.point;
      const near = path.points.findIndex(
        (p) =>
          Math.hypot(p.x - tapped.x, p.y - tapped.y) <= ANCHOR_HIT_RADIUS / view.zoom
      );
      if (near >= 0) {
        onSelectionChange({
          selectedPathIds: [path.id],
          selectedAnchorIndex: near,
          selectedAnchorIndexes: [near],
          selectedHandleType: null,
        });
        return;
      }
    }

    const result = insertPointOnSegment(
      path,
      hit.segmentIndex,
      hit.t,
      `${path.id}-node-${Date.now()}`
    );
    if (!result) return;

    const updated: VectorPath = { ...path, points: result.points };
    onUpdatePath(updated);
    onSelectionChange({
      selectedPathIds: [updated.id],
      selectedAnchorIndex: result.index,
      selectedAnchorIndexes: [result.index],
      selectedHandleType: null,
    });
    onCommitHistory();

    if (e) {
      const node = result.points[result.index];
      startDragOperation(e, {
        type: 'anchor',
        pathId: updated.id,
        pointIndex: result.index,
        initialPoint: { x: node.x, y: node.y },
      });
    }
  };

  /**
   * Removes one anchor. A path that would be left with fewer than two nodes is
   * removed with it, so a delete never looks like it did nothing.
   */
  const deleteNodeAt = (path: VectorPath, index: number) => {
    if (!path.points[index]) return;
    insertBlockedUntilRef.current = performance.now() + 420;

    if (path.points.length <= 2) {
      if (onReplacePaths) onReplacePaths([path.id], []);
      else onUpdatePath({ ...path, points: path.points.slice(1) });
      onSelectionChange({
        selectedPathIds: [],
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
    } else {
      onUpdatePath({ ...path, points: path.points.filter((_, i) => i !== index) });
      onSelectionChange({
        selectedPathIds: [path.id],
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
    }
    onCommitHistory();
  };

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // With the pad open the canvas is not a drawing surface, and a pad press
    // owns it until it lifts: a stray touch must not become a node, a stroke,
    // a pinch, a pan or a second selection
    if (padOpenRef.current && e.pointerId !== PAD_POINTER_ID) return;
    if (padPressRef.current && e.pointerId !== PAD_POINTER_ID) return;

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle 2-Finger Pinch / Pan
    if (activePointersRef.current.size === 2) {
      if (isPanZoomLocked) {
        setIsPointerDown(false);
        setDraggingTarget(null);
        setMarqueeBox(null);
        return;
      }
      const pts = Array.from(activePointersRef.current.values());
      const dist = distance(pts[0], pts[1]);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = view.zoom;
      initialPinchPanRef.current = { x: view.panX, y: view.panY };
      setIsPointerDown(false);
      setDraggingTarget(null);
      setMarqueeBox(null);
      // A pinch is a view gesture, not a pencil stroke
      pencilPointsRef.current = [];
      setPencilStroke(null);
      return;
    }

    if (activePointersRef.current.size > 2) return;

    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (_) {}

    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    setIsPointerDown(true);
    setDragStartPoint(canvasPt);
    setCurrentPointerPoint(canvasPt);

    lastPointerTimeRef.current = performance.now();
    lastPointerPosRef.current = canvasPt;
    smoothedPressureRef.current = 0.5;

    // Eyedropper: sample the artwork under the finger and hand it back
    if (eyedropperActive) {
      onSamplePoint?.(rawCanvasPoint(e.clientX, e.clientY));
      return;
    }

    // Pan Tool or Middle Mouse Button
    if (effectiveTool === 'hand' || e.button === 1) {
      if (!isPanZoomLocked) {
        setDraggingTarget({ type: 'pan', initialPoint: { x: e.clientX, y: e.clientY } });
      }
      return;
    }

    // Pen Tool Logic
    if (effectiveTool === 'pen') {
      if (!activePathInProgress) {
        const newPathId = `path-${Date.now()}`;
        const newPoint: AnchorPoint = {
          id: `${newPathId}-0`,
          x: canvasPt.x,
          y: canvasPt.y,
          type: 'corner',
        };

        const newPath: VectorPath = {
          id: newPathId,
          name: `Path ${currentLayer.paths.length + 1}`,
          points: [newPoint],
          closed: false,
          fill: fillColor,
          fillOpacity,
          ...(fillGradient ? { fillGradient } : {}),
          stroke: strokeColor,
          strokeWidth,
          strokeOpacity,
          strokeCap: 'round',
          strokeJoin: 'round',
          pressureProfile: 'uniform',
        };

        setActivePathInProgress(newPath);
        onSelectionChange({
          selectedPathIds: [newPathId],
          selectedAnchorIndex: 0,
          selectedAnchorIndexes: [0],
          selectedHandleType: null,
        });

        setDraggingTarget({
          type: 'anchor',
          pathId: newPathId,
          pointIndex: 0,
          initialPoint: canvasPt,
        });
      } else {
        // Check if user clicked on first point to close
        const firstPt = activePathInProgress.points[0];
        const distToFirst = distance(canvasPt, firstPt);

        if (activePathInProgress.points.length >= 2 && distToFirst < 28 / view.zoom) {
          const closedPath = { ...activePathInProgress, closed: true };
          onAddPath(closedPath);
          setActivePathInProgress(null);
          onSelectionChange({
            selectedPathIds: [closedPath.id],
            selectedAnchorIndex: 0,
            selectedHandleType: null,
          });
          onCommitHistory();
          return;
        }

        // Add new anchor point to path
        const newIdx = activePathInProgress.points.length;
        let ptPos = canvasPt;
        if (modifiers.shift && newIdx > 0) {
          const prevPt = activePathInProgress.points[newIdx - 1];
          ptPos = snapAngle(prevPt, ptPos);
        }

        const newPoint: AnchorPoint = {
          id: `${activePathInProgress.id}-${newIdx}`,
          x: ptPos.x,
          y: ptPos.y,
          type: 'corner',
        };

        const updatedPoints = [...activePathInProgress.points, newPoint];
        const updatedPath = { ...activePathInProgress, points: updatedPoints };
        setActivePathInProgress(updatedPath);

        onSelectionChange({
          selectedPathIds: [updatedPath.id],
          selectedAnchorIndex: newIdx,
          selectedAnchorIndexes: [newIdx],
          selectedHandleType: null,
        });

        setDraggingTarget({
          type: 'anchor',
          pathId: updatedPath.id,
          pointIndex: newIdx,
          initialPoint: ptPos,
        });
      }
      return;
    }

    // Direct select: drag a box over the nodes of the selected path. With no
    // path selected there is nothing to marquee, so a tap clears.
    if (effectiveTool === 'direct-select') {
      if (selection.selectedPathIds.length === 1) {
        setMarqueeBox({ start: canvasPt, current: canvasPt });
        setDraggingTarget({ type: 'marquee', initialPoint: canvasPt });
      } else {
        onSelectionChange({
          selectedPathIds: [],
          selectedAnchorIndex: null,
          selectedHandleType: null,
        });
      }
      return;
    }

    // Vector Typography Tool Logic
    if (effectiveTool === 'text') {
      onRequestText?.(canvasPt);
      return;
    }

    // Pencil: collect raw samples, fit them to curves on release
    if (effectiveTool === 'pencil') {
      const start = { x: canvasPt.x, y: canvasPt.y };
      pencilPointsRef.current = [start];
      setPencilStroke([start]);
      onSelectionChange({
        selectedPathIds: [],
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
      return;
    }

    // Pressure Brush Tool Logic
    if (effectiveTool === 'pressure-brush') {
      const newPathId = `brush-${Date.now()}`;
      let initialPressure = e.pressure > 0 ? e.pressure : 0.5;

      const newPoint: AnchorPoint = {
        id: `${newPathId}-0`,
        x: canvasPt.x,
        y: canvasPt.y,
        type: 'smooth',
        pressure: initialPressure,
      };

      const newPath: VectorPath = {
        id: newPathId,
        name: `Brush ${currentLayer.paths.length + 1}`,
        points: [newPoint],
        closed: false,
        fill: strokeColor,
        fillOpacity: 1,
        stroke: strokeColor,
        strokeWidth,
        strokeOpacity: 1,
        strokeCap: 'round',
        strokeJoin: 'round',
        pressureProfile: 'dynamic-touch',
      };

      brushStrokeRef.current = newPath;
      setActivePathInProgress(newPath);
      setDraggingTarget({ type: 'path', pathId: newPathId });
      return;
    }

    // Shape Tool Logic
    if (effectiveTool === 'shape') {
      setDraggingTarget({ type: 'shape-preview', initialPoint: canvasPt });
      return;
    }

    // Shape Builder Tool: Root canvas pointer down fallback
    if (effectiveTool === 'shape-builder' && atomicRegions.length > 0) {
      const hitRegion = findSubRegionAtPoint(canvasPt, atomicRegions);
      if (hitRegion) {
        setSbSelectedRegionIds([hitRegion.id]);
        setSbDragPoints([canvasPt]);
        setDraggingTarget({ type: 'shape-builder-drag' });
        return;
      }
    }

    // Select Tool: Clicked empty canvas -> start marquee multi-selection box!
    if (effectiveTool === 'select') {
      if (!modifiers.shift && !modifiers.ctrl) {
        onSelectionChange({
          selectedPathIds: [],
          selectedAnchorIndex: null,
          selectedHandleType: null,
        });
      }
      setMarqueeBox({ start: canvasPt, current: canvasPt });
      setDraggingTarget({ type: 'marquee', initialPoint: canvasPt });
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (padPressRef.current && e.pointerId !== PAD_POINTER_ID) return;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Guide being dragged on the canvas
    if (guideDragRef.current) {
      const raw = rawCanvasPoint(e.clientX, e.clientY);
      const guide = guides.find((g) => g.id === guideDragRef.current!.id);
      if (guide && !guide.locked) {
        const snapped = gridSnapEnabled
          ? guide.axis === 'v'
            ? Math.round(raw.x / gridSpacingX) * gridSpacingX
            : Math.round(raw.y / gridSpacingY) * gridSpacingY
          : guide.axis === 'v'
            ? raw.x
            : raw.y;
        onUpdateGuide(guide.id, snapped);
      }
      return;
    }

    // Unlocked reference images can be repositioned under the artwork
    if (referenceDragRef.current) {
      const drag = referenceDragRef.current;
      const pt = screenToCanvas(e.clientX, e.clientY);
      const target = referenceImages.find((r) => r.id === drag.id);
      if (target && onUpdateReference) {
        onUpdateReference({
          ...target,
          x: drag.origin.x + (pt.x - drag.grab.x),
          y: drag.origin.y + (pt.y - drag.grab.y),
        });
      }
      return;
    }

    // 2-Finger Pinch Zoom & Pan
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current !== null && !isPanZoomLocked) {
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = distance(pts[0], pts[1]);
      const zoomRatio = currentDist / initialPinchDistRef.current;
      const targetZoom = Math.min(5, Math.max(0.05, initialPinchZoomRef.current * zoomRatio));

      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      onViewChange({
        ...view,
        zoom: targetZoom,
        panX: midX - (midX - initialPinchPanRef.current.x) * (targetZoom / initialPinchZoomRef.current),
        panY: midY - (midY - initialPinchPanRef.current.y) * (targetZoom / initialPinchZoomRef.current),
      });
      return;
    }

    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    setCurrentPointerPoint(canvasPt);

    // Shape Builder Tool: Real-time region hover and connecting drag trail
    if (effectiveTool === 'shape-builder') {
      const hitRegion = findSubRegionAtPoint(canvasPt, atomicRegions);
      setSbHoveredRegionId(hitRegion ? hitRegion.id : null);

      if (draggingTarget?.type === 'shape-builder-drag') {
        setSbDragPoints((prev) => [...prev, canvasPt]);
        if (hitRegion && !sbSelectedRegionIds.includes(hitRegion.id)) {
          setSbSelectedRegionIds((prev) => [...prev, hitRegion.id]);
        }
        return;
      }
    }

    if (!isPointerDown) return;

    // Pan Canvas
    if (draggingTarget?.type === 'pan' && draggingTarget.initialPoint) {
      const dx = e.clientX - draggingTarget.initialPoint.x;
      const dy = e.clientY - draggingTarget.initialPoint.y;
      onViewChange({ ...view, panX: view.panX + dx, panY: view.panY + dy });
      setDraggingTarget({ ...draggingTarget, initialPoint: { x: e.clientX, y: e.clientY } });
      return;
    }

    // Marquee Selection Box
    if (draggingTarget?.type === 'marquee' && marqueeBox) {
      setMarqueeBox({ start: marqueeBox.start, current: canvasPt });

      const x1 = Math.min(marqueeBox.start.x, canvasPt.x);
      const y1 = Math.min(marqueeBox.start.y, canvasPt.y);
      const x2 = Math.max(marqueeBox.start.x, canvasPt.x);
      const y2 = Math.max(marqueeBox.start.y, canvasPt.y);

      if (effectiveTool === 'direct-select') {
        const path = allPaths.find((p) => p.id === selection.selectedPathIds[0]);
        if (!path) return;
        const indexes = path.points.flatMap((point, index) =>
          point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2
            ? [index]
            : []
        );
        onSelectionChange({
          selectedPathIds: [path.id],
          selectedAnchorIndex: indexes[indexes.length - 1] ?? null,
          selectedAnchorIndexes: indexes,
          selectedHandleType: null,
        });
        return;
      }

      // Find all paths intersecting the marquee box
      const enclosedIds: string[] = [];
      allPaths.forEach((path) => {
        // Locked objects are not marquee-selectable either.
        if (lockedPathIds.has(path.id)) return;
        const box = computePathsBoundingBox([path]);
        if (box) {
          const intersects = !(box.maxX < x1 || box.minX > x2 || box.maxY < y1 || box.minY > y2);
          if (intersects) enclosedIds.push(path.id);
        }
      });

      onSelectionChange({
        selectedPathIds: modifiers.shift
          ? Array.from(new Set([...selection.selectedPathIds, ...enclosedIds]))
          : enclosedIds,
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
      return;
    }

    // Stretch Transform Node Dragging!
    if (
      draggingTarget?.type === 'transform-handle' &&
      draggingTarget.initialBBox &&
      draggingTarget.initialSelectedPaths &&
      draggingTarget.transformHandle
    ) {
      const bbox = draggingTarget.initialBBox;
      const h = draggingTarget.transformHandle;

      let effectivePt = canvasPt;

      if (smartGuidesEnabled && !modifiers.alt) {
        const candidates = getSnapCandidates(view.width, view.height, otherSnapBBoxes);
        const snapThreshold = 7 / view.zoom;

        const resizeSnap = calculateResizeSmartGuides(
          h,
          canvasPt,
          bbox,
          candidates,
          snapThreshold,
          40 / view.zoom
        );
        effectivePt = resizeSnap.snappedPoint;
        setActiveSmartGuides(resizeSnap.guideLines);
      } else {
        if (activeSmartGuides.length > 0) setActiveSmartGuides([]);
      }

      let anchorPoint: Point = { x: bbox.centerX, y: bbox.centerY };
      let scaleX = 1;
      let scaleY = 1;

      if (h === 'br') {
        anchorPoint = { x: bbox.minX, y: bbox.minY };
        scaleX = Math.max(0.05, (effectivePt.x - bbox.minX) / Math.max(1, bbox.width));
        scaleY = Math.max(0.05, (effectivePt.y - bbox.minY) / Math.max(1, bbox.height));
      } else if (h === 'tl') {
        anchorPoint = { x: bbox.maxX, y: bbox.maxY };
        scaleX = Math.max(0.05, (bbox.maxX - effectivePt.x) / Math.max(1, bbox.width));
        scaleY = Math.max(0.05, (bbox.maxY - effectivePt.y) / Math.max(1, bbox.height));
      } else if (h === 'tr') {
        anchorPoint = { x: bbox.minX, y: bbox.maxY };
        scaleX = Math.max(0.05, (effectivePt.x - bbox.minX) / Math.max(1, bbox.width));
        scaleY = Math.max(0.05, (bbox.maxY - effectivePt.y) / Math.max(1, bbox.height));
      } else if (h === 'bl') {
        anchorPoint = { x: bbox.maxX, y: bbox.minY };
        scaleX = Math.max(0.05, (bbox.maxX - effectivePt.x) / Math.max(1, bbox.width));
        scaleY = Math.max(0.05, (effectivePt.y - bbox.minY) / Math.max(1, bbox.height));
      } else if (h === 'mr') {
        anchorPoint = { x: bbox.minX, y: bbox.centerY };
        scaleX = Math.max(0.05, (effectivePt.x - bbox.minX) / Math.max(1, bbox.width));
        scaleY = 1;
      } else if (h === 'ml') {
        anchorPoint = { x: bbox.maxX, y: bbox.centerY };
        scaleX = Math.max(0.05, (bbox.maxX - effectivePt.x) / Math.max(1, bbox.width));
        scaleY = 1;
      } else if (h === 'bc') {
        anchorPoint = { x: bbox.centerX, y: bbox.minY };
        scaleX = 1;
        scaleY = Math.max(0.05, (effectivePt.y - bbox.minY) / Math.max(1, bbox.height));
      } else if (h === 'tc') {
        anchorPoint = { x: bbox.centerX, y: bbox.maxY };
        scaleX = 1;
        scaleY = Math.max(0.05, (bbox.maxY - effectivePt.y) / Math.max(1, bbox.height));
      }

      // Shift key constrains aspect ratio 1:1 for corner handles
      if (modifiers.shift && (h === 'tl' || h === 'tr' || h === 'bl' || h === 'br')) {
        const s = Math.max(scaleX, scaleY);
        scaleX = s;
        scaleY = s;
      }

      const transformed = scalePaths(draggingTarget.initialSelectedPaths, anchorPoint, scaleX, scaleY);
      transformed.forEach((p) => onUpdatePath(p, { preserveCornerSource: true }));
      return;
    }

    // Rotate Transform Node Dragging!
    if (
      draggingTarget?.type === 'rotate-handle' &&
      draggingTarget.initialBBox &&
      draggingTarget.initialSelectedPaths
    ) {
      const bbox = draggingTarget.initialBBox;
      const center = { x: bbox.centerX, y: bbox.centerY };
      const startAngle = Math.atan2((draggingTarget.initialPoint?.y || bbox.minY) - center.y, (draggingTarget.initialPoint?.x || bbox.centerX) - center.x);
      const currentAngle = Math.atan2(canvasPt.y - center.y, canvasPt.x - center.x);
      let deltaAngle = currentAngle - startAngle;

      if (modifiers.shift) {
        const snap = (15 * Math.PI) / 180;
        deltaAngle = Math.round(deltaAngle / snap) * snap;
      }

      const rotated = rotatePaths(draggingTarget.initialSelectedPaths, center, deltaAngle);
      rotated.forEach((p) => onUpdatePath(p, { preserveCornerSource: true }));
      return;
    }

    // Pen Tool dragging out Bezier curve handles!
    if (effectiveTool === 'pen' && activePathInProgress && draggingTarget?.type === 'anchor') {
      const idx = draggingTarget.pointIndex ?? activePathInProgress.points.length - 1;
      const anchor = activePathInProgress.points[idx];
      if (!anchor) return;

      let handleTarget = canvasPt;
      if (modifiers.shift) {
        handleTarget = snapAngle(anchor, handleTarget);
      }

      const { handleIn, handleOut } = createSymmetricHandles(anchor, handleTarget);

      const updatedPoints = [...activePathInProgress.points];
      updatedPoints[idx] = {
        ...anchor,
        type: modifiers.alt ? 'broken' : 'smooth',
        handleIn,
        handleOut,
      };

      setActivePathInProgress({
        ...activePathInProgress,
        points: updatedPoints,
      });
      return;
    }

    // Pencil sampling: keep the trail light, but never skip real corners
    if (effectiveTool === 'pencil' && pencilPointsRef.current.length > 0) {
      const pts = pencilPointsRef.current;
      const lastSample = pts[pts.length - 1];
      const minStep = Math.max(0.6, 1.1 / view.zoom);
      if (distance(lastSample, canvasPt) < minStep) return;
      pts.push({ x: canvasPt.x, y: canvasPt.y });
      setPencilStroke(pts.slice());
      return;
    }

    // Pressure Brush dynamic sampling
    if (effectiveTool === 'pressure-brush' && (brushStrokeRef.current || activePathInProgress)) {
      const currentBrushPath = brushStrokeRef.current || activePathInProgress;
      if (!currentBrushPath) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastPointerTimeRef.current);
      const distanceMoved = distance(lastPointerPosRef.current, canvasPt);
      const velocity = distanceMoved / dt;

      // Skip micro-samples so long strokes stay light on mobile
      const minStep = Math.max(0.9, 1.5 / view.zoom);
      if (distanceMoved < minStep) return;

      const source = pressureConfig.source;
      let targetPressure: number;
      if (source === 'fixed') {
        targetPressure = 0.62;
      } else if (source === 'stylus-or-touch' && e.pointerType === 'pen' && e.pressure > 0) {
        targetPressure = e.pressure;
      } else {
        const speedFactor = Math.min(1.5, Math.max(0.1, velocity));
        targetPressure = 1 - speedFactor / 1.8;
      }

      const smoothing = Math.min(0.92, Math.max(0, pressureConfig.smoothing));
      smoothedPressureRef.current =
        smoothedPressureRef.current * smoothing + targetPressure * (1 - smoothing);

      const newPoint: AnchorPoint = {
        id: `${currentBrushPath.id}-${currentBrushPath.points.length}`,
        x: canvasPt.x,
        y: canvasPt.y,
        type: 'smooth',
        pressure: Math.max(0.1, Math.min(1.0, smoothedPressureRef.current)),
      };

      lastPointerTimeRef.current = now;
      lastPointerPosRef.current = canvasPt;

      const updatedPath = {
        ...currentBrushPath,
        points: [...currentBrushPath.points, newPoint],
      };
      brushStrokeRef.current = updatedPath;
      setActivePathInProgress(updatedPath);
      return;
    }

    // A trackpad click lands with a pixel of travel. Until the pointer has
    // moved a few screen pixels, a press is a selection, not a drag — otherwise
    // picking a node nudged it off its corner.
    if (
      draggingTarget &&
      dragStartPoint &&
      (draggingTarget.type === 'anchor' ||
        draggingTarget.type === 'handle-in' ||
        draggingTarget.type === 'handle-out' ||
        draggingTarget.type === 'path') &&
      distance(canvasPt, dragStartPoint) * view.zoom < 3
    ) {
      return;
    }

    // Direct Select: Dragging an Anchor Point or Bezier Handle
    if (effectiveTool === 'direct-select' && draggingTarget && selection.selectedPathIds.length > 0) {
      const pathId = selection.selectedPathIds[0];
      const targetPath = allPaths.find((p) => p.id === pathId);
      if (!targetPath) return;

      const ptIdx = draggingTarget.pointIndex;
      if (ptIdx === undefined || !targetPath.points[ptIdx]) return;

      const currPt = targetPath.points[ptIdx];
      let newPoints = [...targetPath.points];

      if (draggingTarget.type === 'anchor') {
        const anchorPoint = draggingTarget.initialPoint ?? currPt;
        const dx = canvasPt.x - anchorPoint.x;
        const dy = canvasPt.y - anchorPoint.y;
        // A Shift-built node selection moves as one block, with every selected
        // node's handles following it.
        const moving = new Set(draggingTarget.pointIndexes ?? [ptIdx]);
        newPoints = targetPath.points.map((point, index) =>
          moving.has(index)
            ? {
                ...point,
                x: point.x + dx,
                y: point.y + dy,
                handleIn: point.handleIn
                  ? { x: point.handleIn.x + dx, y: point.handleIn.y + dy }
                  : undefined,
                handleOut: point.handleOut
                  ? { x: point.handleOut.x + dx, y: point.handleOut.y + dy }
                  : undefined,
              }
            : point
        );
        setDraggingTarget({ ...draggingTarget, initialPoint: canvasPt });
      } else if (draggingTarget.type === 'handle-out') {
        let hOut = canvasPt;
        if (modifiers.shift) hOut = snapAngle(currPt, hOut);

        let hIn = currPt.handleIn;
        if (currPt.type === 'smooth' && !modifiers.alt) {
          const dx = hOut.x - currPt.x;
          const dy = hOut.y - currPt.y;
          hIn = { x: currPt.x - dx, y: currPt.y - dy };
        }

        newPoints[ptIdx] = {
          ...currPt,
          type: modifiers.alt ? 'broken' : currPt.type,
          handleOut: hOut,
          handleIn: hIn,
        };
      } else if (draggingTarget.type === 'handle-in') {
        let hIn = canvasPt;
        if (modifiers.shift) hIn = snapAngle(currPt, hIn);

        let hOut = currPt.handleOut;
        if (currPt.type === 'smooth' && !modifiers.alt) {
          const dx = hIn.x - currPt.x;
          const dy = hIn.y - currPt.y;
          hOut = { x: currPt.x - dx, y: currPt.y - dy };
        }

        newPoints[ptIdx] = {
          ...currPt,
          type: modifiers.alt ? 'broken' : currPt.type,
          handleIn: hIn,
          handleOut: hOut,
        };
      }

      onUpdatePath({ ...targetPath, points: newPoints });
      return;
    }

    // Select Tool: Moving entire selected paths
    if (effectiveTool === 'select' && draggingTarget?.type === 'path' && dragStartPoint && draggingTarget.initialSelectedPaths) {
      const rawDx = canvasPt.x - dragStartPoint.x;
      const rawDy = canvasPt.y - dragStartPoint.y;

      let dx = rawDx;
      let dy = rawDy;

      const currentInitialBBox =
        draggingTarget.initialBBox || computePathsBoundingBox(draggingTarget.initialSelectedPaths);

      if (smartGuidesEnabled && !modifiers.alt && currentInitialBBox) {
        const candidates = getSnapCandidates(view.width, view.height, otherSnapBBoxes);
        const snapThreshold = 7 / view.zoom;

        const snapResult = calculateMoveSmartGuides(
          currentInitialBBox,
          rawDx,
          rawDy,
          candidates,
          snapThreshold,
          40 / view.zoom
        );

        dx = snapResult.snappedDeltaX;
        dy = snapResult.snappedDeltaY;
        setActiveSmartGuides(snapResult.guideLines);
      } else {
        if (activeSmartGuides.length > 0) setActiveSmartGuides([]);
      }

      // Counters travel with their outline: without this a traced logo leaves a
      // letter bowl or a logo cut-out behind when the group is dragged.
      for (const path of translatePaths(draggingTarget.initialSelectedPaths, dx, dy)) {
        onUpdatePath(path, { preserveCornerSource: true });
      }
      return;
    }
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (padPressRef.current && e.pointerId !== PAD_POINTER_ID) return;

    activePointersRef.current.delete(e.pointerId);

    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
    }

    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    setIsPointerDown(false);
    setMarqueeBox(null);
    setActiveSmartGuides([]);
    referenceDragRef.current = null;
    if (guideDragRef.current) {
      const moved = guideDragStartRef.current;
      const guide = guides.find((g) => g.id === guideDragRef.current!.id);
      guideDragRef.current = null;
      guideDragStartRef.current = null;
      setDraggingGuideId(null);
      // Only a guide that actually moved becomes an undo step
      if (moved !== null && guide && guide.position !== moved) onCommitGuides?.();
    }

    // Adobe Illustrator Shape Builder: Commit Merge or Erase upon drag/click release
    if (draggingTarget?.type === 'shape-builder-drag') {
      const effectiveMode = modifiers.alt || sbMode === 'erase' ? 'erase' : 'merge';
      if (sbSelectedRegionIds.length > 0 && participatingPaths.length > 0) {
        if (effectiveMode === 'erase') {
          const newPaths = executeShapeBuilderErase(sbSelectedRegionIds, atomicRegions, participatingPaths);
          onReplacePaths?.(participatingPaths.map((p) => p.id), newPaths);
        } else {
          const newPaths = executeShapeBuilderMerge(
            sbSelectedRegionIds,
            atomicRegions,
            participatingPaths,
            { fill: fillColor, stroke: 'none', strokeWidth: 0 }
          );
          onReplacePaths?.(participatingPaths.map((p) => p.id), newPaths);
        }
      }
      setSbSelectedRegionIds([]);
      setSbDragPoints([]);
      setDraggingTarget(null);
      setIsPointerDown(false);
      return;
    }

    // Finalize Shape creation — only a real drag commits a shape, so a tap
    // on the canvas can never drop an accidental object
    if (effectiveTool === 'shape' && draggingTarget?.type === 'shape-preview' && dragStartPoint && currentPointerPoint) {
      const startPt = dragStartPoint;
      const endPt = currentPointerPoint;
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Smaller than 8 screen pixels: treat it as a tap, not a draw
      if (dist * view.zoom >= 8) {
        let a = startPt;
        let b = endPt;
        if (modifiers.shift) {
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          b = {
            x: a.x + Math.sign(dx || 1) * size,
            y: a.y + Math.sign(dy || 1) * size,
          };
        }

        const shapeOptions: ShapeOptions = {
          kind: shapeKind,
          sides: shapeSides,
          cornerRadius: 24,
        };

        const newShape = {
          ...generateShapePath(
            a.x,
            a.y,
            b.x,
            b.y,
            shapeOptions,
            `shape-${Date.now()}`,
            { fill: fillColor, stroke: 'none', strokeWidth: 0 }
          ),
          fillOpacity,
          strokeOpacity,
          ...(fillGradient ? { fillGradient } : {}),
        };

        onAddPath(newShape);
        onSelectionChange({
          selectedPathIds: [newShape.id],
          selectedAnchorIndex: null,
          selectedHandleType: null,
        });
        onCommitHistory();
      }
    }

    // Pencil: fit the samples, close the shape when it ends on its start
    if (effectiveTool === 'pencil' && pencilPointsRef.current.length > 0) {
      const raw = pencilPointsRef.current;
      pencilPointsRef.current = [];
      setPencilStroke(null);

      const first = raw[0];
      const lastSample = raw[raw.length - 1];
      let travelled = 0;
      for (let i = 1; i < raw.length; i++) travelled += distance(raw[i - 1], raw[i]);

      if (raw.length >= 2) {
        const closed =
          travelled > 60 / view.zoom &&
          distance(first, lastSample) <= PENCIL_CLOSE_RADIUS / view.zoom;
        const id = `pencil-${Date.now()}`;
        const points = fitBezierPath(smoothPencilSamples(raw, pencilSmoothing), {
          idPrefix: id,
          closed,
          tolerance: PENCIL_TOLERANCE[pencilSmoothing] / view.zoom,
        });

        // The fitted seam has to land exactly on the start or a closed fill
        // shows a notch where the two ends meet
        if (closed && points.length > 1) {
          points[0] = { ...points[0], x: first.x, y: first.y };
        }

        const newPath: VectorPath = {
          id,
          name: `Pencil ${currentLayer.paths.length + 1}`,
          points,
          closed,
          fill: closed ? fillColor : 'none',
          fillOpacity,
          ...(closed && fillGradient ? { fillGradient } : {}),
          stroke: strokeColor,
          strokeWidth,
          strokeOpacity,
          strokeCap: 'round',
          strokeJoin: 'round',
          pressureProfile: 'uniform',
        };

        onAddPath(newPath);
        onSelectionChange({
          selectedPathIds: [newPath.id],
          selectedAnchorIndex: null,
          selectedHandleType: null,
        });
        onCommitHistory();
      } else if (raw.length === 1) {
        // A tap is a dot, matching the brush's single-tap behaviour
        const r = Math.max(1, strokeWidth / 2);
        const dot = generateShapePath(
          first.x - r,
          first.y - r,
          first.x + r,
          first.y + r,
          { kind: 'circle' },
          `pencil-dot-${Date.now()}`,
          { fill: strokeColor === 'none' ? fillColor : strokeColor, stroke: 'none', strokeWidth: 0 }
        );
        onAddPath(dot);
        onSelectionChange({
          selectedPathIds: [dot.id],
          selectedAnchorIndex: null,
          selectedHandleType: null,
        });
        onCommitHistory();
      }
    }

    // Finalize Brush Stroke (Reliable commit with single-tap dot support)
    let committedStroke = false;
    if (effectiveTool === 'pressure-brush' && (brushStrokeRef.current || activePathInProgress)) {
      const strokeToCommit = brushStrokeRef.current || activePathInProgress;
      if (strokeToCommit && strokeToCommit.points.length > 0) {
        // If single tap, create a second adjacent point to ensure the variable ribbon forms a round dot
        if (strokeToCommit.points.length === 1) {
          const p0 = strokeToCommit.points[0];
          strokeToCommit.points.push({
            id: `${p0.id}-dot`,
            x: p0.x + 0.5,
            y: p0.y + 0.5,
            type: 'smooth',
            pressure: p0.pressure || 0.6,
          });
        }
        onAddPath(strokeToCommit);
        onCommitHistory();
        committedStroke = true;
      }
      brushStrokeRef.current = null;
      setActivePathInProgress(null);
    }

    if (
      !committedStroke &&
      draggingTarget &&
      draggingTarget.type !== 'pan' &&
      draggingTarget.type !== 'shape-preview' &&
      draggingTarget.type !== 'marquee'
    ) {
      onCommitHistory();
    }

    setDraggingTarget(null);
  };

  // Wheel zoom. Registered natively so preventDefault works (React's wheel
  // listener is passive and silently drops it).
  const viewStateRef = useRef(view);
  viewStateRef.current = view;
  const viewChangeRef = useRef(onViewChange);
  viewChangeRef.current = onViewChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (isPanZoomLocked) return;
      const current = viewStateRef.current;
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(5, Math.max(0.05, current.zoom * zoomFactor));
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      viewChangeRef.current({
        ...current,
        zoom: newZoom,
        panX: mouseX - (mouseX - current.panX) * (newZoom / current.zoom),
        panY: mouseY - (mouseY - current.panY) * (newZoom / current.zoom),
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isPanZoomLocked]);

  // Shape Builder selection
  const handleShapeBuilderToggle = (path: VectorPath, e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    const alreadySelected = selection.selectedPathIds.includes(path.id);
    let newSelected: string[];

    if (modifiers.shift || modifiers.ctrl) {
      newSelected = alreadySelected
        ? selection.selectedPathIds.filter((id) => id !== path.id)
        : [...selection.selectedPathIds, path.id];
    } else {
      newSelected = alreadySelected
        ? selection.selectedPathIds.filter((id) => id !== path.id)
        : [...selection.selectedPathIds, path.id];
    }

    onSelectionChange({
      selectedPathIds: newSelected,
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });
  };

  // Render Grid — a general alignment system: one spacing per axis, one lock,
  // one snap toggle. Editing aid only; it lives outside the layer tree.
  const renderGrid = () => {
    if (!gridVisible) return null;
    const stroke = Math.max(0.5, 1 / view.zoom);
    return (
      <g className="canvas-grid pointer-events-none" opacity={gridOpacity}>
        <defs>
          <pattern
            id="pentix-grid"
            width={gridSpacingX}
            height={gridSpacingY}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSpacingX} 0 L 0 0 0 ${gridSpacingY}`}
              fill="none"
              stroke={CANVAS.grid}
              strokeWidth={stroke}
            />
          </pattern>
        </defs>
        <rect width={view.width} height={view.height} fill="url(#pentix-grid)" />
      </g>
    );
  };

  const gradientFill = (path: VectorPath): string | null =>
    path.fillGradient && path.fillGradient.stops.length >= 2
      ? `url(#${gradientIdFor(path.id)})`
      : null;

  const gradientDefNodes = allPaths
    .filter((p) => gradientFill(p))
    .map((p) => {
      const g = p.fillGradient!;
      const id = gradientIdFor(p.id);
      const coords = gradientCoords(g);
      return g.type === 'radial' ? (
        <radialGradient
          key={id}
          id={id}
          cx={(coords as { cx: number }).cx}
          cy={(coords as { cy: number }).cy}
          r={(coords as { r: number }).r}
        >
          {[...g.stops]
            .sort((a, b) => a.offset - b.offset)
            .map((st, i) => (
              <stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity} />
            ))}
        </radialGradient>
      ) : (
        <linearGradient
          key={id}
          id={id}
          x1={(coords as { x1: number }).x1}
          y1={(coords as { y1: number }).y1}
          x2={(coords as { x2: number }).x2}
          y2={(coords as { y2: number }).y2}
        >
          {[...g.stops]
            .sort((a, b) => a.offset - b.offset)
            .map((st, i) => (
              <stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity} />
            ))}
        </linearGradient>
      );
    });

  /* --------------------------- Rulers & guides --------------------------- */
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Major tick step that keeps labels at least ~64 screen px apart. */
  const niceStep = (target: number) => {
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, target))));
    const n = target / pow;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * pow;
  };

  const startRulerDrag = (axis: 'h' | 'v') => (e: React.PointerEvent) => {
    // A locked grid of guides is frozen: no new ones can be pulled out.
    if (guidesLocked) {
      e.stopPropagation();
      return;
    }
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    rulerAxisRef.current = axis;
    const raw = rawCanvasPoint(e.clientX, e.clientY);
    setRulerDraft({ axis, position: axis === 'v' ? raw.x : raw.y });
    e.stopPropagation();
  };

  const moveRulerDrag = (e: React.PointerEvent) => {
    const axis = rulerAxisRef.current;
    if (!axis) return;
    const raw = rawCanvasPoint(e.clientX, e.clientY);
    const spacing = axis === 'v' ? gridSpacingX : gridSpacingY;
    const value = axis === 'v' ? raw.x : raw.y;
    setRulerDraft({
      axis,
      position: gridSnapEnabled ? Math.round(value / spacing) * spacing : value,
    });
    e.stopPropagation();
  };

  const endRulerDrag = (e: React.PointerEvent) => {
    const axis = rulerAxisRef.current;
    rulerAxisRef.current = null;
    setRulerDraft(null);
    if (!axis) return;
    const raw = rawCanvasPoint(e.clientX, e.clientY);
    const spacing = axis === 'v' ? gridSpacingX : gridSpacingY;
    const value = axis === 'v' ? raw.x : raw.y;
    const position = gridSnapEnabled ? Math.round(value / spacing) * spacing : value;
    const inside =
      axis === 'v' ? position >= 0 && position <= view.width : position >= 0 && position <= view.height;
    // A tap on the ruler creates nothing: the pointer has to leave the ruler
    // strip first, and the guide has to land on the artboard. A horizontal
    // guide comes off the top ruler, so leaving it means moving down.
    const draggedOff = axis === 'h' ? e.clientY > RULER_SIZE : e.clientX > RULER_SIZE;
    if (inside && draggedOff) onAddGuide(axis, position);
    e.stopPropagation();
  };

  const renderGuides = () => {
    if (!guides.length && !rulerDraft) return null;
    const over = 32 / view.zoom;
    const items: { key: string; axis: 'h' | 'v'; position: number; locked: boolean; draft?: boolean }[] = [
      ...guides.map((g) => ({
        key: g.id,
        axis: g.axis,
        position: g.position,
        locked: guidesLocked || g.locked,
      })),
      ...(rulerDraft
        ? [{ key: '__draft', axis: rulerDraft.axis, position: rulerDraft.position, locked: false, draft: true }]
        : []),
    ];
    return (
      <g className="guides-layer">
        {items.map((g) => {
          const coords =
            g.axis === 'v'
              ? { x1: g.position, y1: -over, x2: g.position, y2: view.height + over }
              : { x1: -over, y1: g.position, x2: view.width + over, y2: g.position };
          return (
            <g key={g.key}>
              {!g.draft && (
                <line
                  {...coords}
                  stroke="transparent"
                  strokeWidth={22 / view.zoom}
                  className={g.locked ? '' : 'cursor-move'}
                  style={{ pointerEvents: g.locked ? 'none' : 'stroke' }}
                  onPointerDown={(e) => {
                    if (g.locked) return;
                    e.stopPropagation();
                    try {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    } catch {
                      /* ignore */
                    }
                    guideDragRef.current = {
                      id: g.key,
                      axis: g.axis,
                    };
                    guideDragStartRef.current = g.position;
                    setDraggingGuideId(g.key);
                  }}
                />
              )}
              {(() => {
                const isActive = !!g.draft || g.key === draggingGuideId;
                const stroke = isActive ? CANVAS.accent : g.locked ? '#8A919B' : '#FF9F45';
                const px = currentPointerPoint?.x ?? view.width / 2;
                const py = currentPointerPoint?.y ?? view.height / 2;
                const label = `${g.axis === 'v' ? 'X' : 'Y'} ${Math.round(g.position)} px`;
                const bw = (label.length * 5.6 + 12) / view.zoom;
                const bh = 15 / view.zoom;
                const bx = g.axis === 'v' ? g.position + 9 / view.zoom : px;
                const by = g.axis === 'v' ? py : g.position - 9 / view.zoom;
                return (
                  <>
                    <line
                      {...coords}
                      stroke={stroke}
                      strokeWidth={(isActive ? 1.8 : 1) / view.zoom}
                      strokeDasharray={g.draft ? '6 5' : g.locked ? '6 4' : 'none'}
                      opacity={isActive ? 1 : g.locked ? 0.55 : 0.95}
                      className="pointer-events-none"
                    />
                    {isActive && (
                      <g
                        transform={`translate(${bx}, ${by})`}
                        className="pointer-events-none"
                      >
                        <rect
                          x={g.axis === 'v' ? 0 : -bw / 2}
                          y={-bh / 2}
                          width={bw}
                          height={bh}
                          rx={3 / view.zoom}
                          fill={CANVAS.accent}
                        />
                        <text
                          x={g.axis === 'v' ? bw / 2 : 0}
                          y={3.4 / view.zoom}
                          textAnchor="middle"
                          fontSize={9 / view.zoom}
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill={CANVAS.ink}
                        >
                          {label}
                        </text>
                      </g>
                    )}
                  </>
                );
              })()}
            </g>
          );
        })}
      </g>
    );
  };

  const renderRulers = () => {
    if (!rulersVisible || boxSize.w === 0) return null;
    const strip = RULER_SIZE;
    const step = niceStep(72 / view.zoom);
    const minor = step / 5;

    const ticks: { axis: 'h' | 'v'; pos: number; major: boolean; label?: number }[] = [];

    // Horizontal (top) strip
    const x0 = Math.floor((-view.panX / view.zoom) / minor) * minor;
    const x1 = (boxSize.w - view.panX) / view.zoom;
    for (let i = Math.floor(x0 / minor); i * minor <= x1 + minor; i++) {
      const world = i * minor;
      const screen = world * view.zoom + view.panX;
      if (screen < -20 || screen > boxSize.w + 20) continue;
      const major = i % 5 === 0;
      ticks.push({ axis: 'h', pos: screen, major, label: major ? Math.round(world) : undefined });
    }

    // Vertical (left) strip
    const y0 = Math.floor((-view.panY / view.zoom) / minor) * minor;
    const y1 = (boxSize.h - view.panY) / view.zoom;
    for (let i = Math.floor(y0 / minor); i * minor <= y1 + minor; i++) {
      const world = i * minor;
      const screen = world * view.zoom + view.panY;
      if (screen < -20 || screen > boxSize.h + 20) continue;
      const major = i % 5 === 0;
      ticks.push({ axis: 'v', pos: screen, major, label: major ? Math.round(world) : undefined });
    }

    return (
      <>
        {/* Top ruler — drag down and the guide runs across, the way a top
            ruler reads in every other editor. */}
        <div
          className="absolute left-0 right-0 top-0 z-10 touch-none select-none border-b border-line bg-ink-1/95 backdrop-blur"
          style={{ height: strip }}
          onPointerDown={startRulerDrag('h')}
          onPointerMove={moveRulerDrag}
          onPointerUp={endRulerDrag}
          onPointerCancel={endRulerDrag}
        >
          <svg width="100%" height={strip} className="block">
            {ticks
              .filter((t) => t.axis === 'h')
              .map((t, i) => (
                <g key={`h-${i}`}>
                  <line
                    x1={t.pos}
                    y1={t.major ? 4 : 10}
                    x2={t.pos}
                    y2={strip}
                    stroke={t.major ? '#8A919B' : '#4B5158'}
                    strokeWidth={1}
                  />
                  {t.label !== undefined && t.pos < boxSize.w - 26 && (
                    <text
                      x={t.pos + 3}
                      y={9}
                      fontSize={8}
                      fontFamily="monospace"
                      fill="#8A919B"
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              ))}
          </svg>
        </div>

        {/* Left ruler — drag right and the guide runs down the artwork. */}
        <div
          className="absolute left-0 top-0 bottom-0 z-10 w-[18px] touch-none select-none border-r border-line bg-ink-1/95 backdrop-blur"
          onPointerDown={startRulerDrag('v')}
          onPointerMove={moveRulerDrag}
          onPointerUp={endRulerDrag}
          onPointerCancel={endRulerDrag}
        >
          <svg width={strip} height="100%" className="block">
            {ticks
              .filter((t) => t.axis === 'v')
              .map((t, i) => (
                <g key={`v-${i}`}>
                  <line
                    x1={t.major ? 4 : 10}
                    y1={t.pos}
                    x2={strip}
                    y2={t.pos}
                    stroke={t.major ? '#8A919B' : '#4B5158'}
                    strokeWidth={1}
                  />
                  {t.label !== undefined && t.pos < boxSize.h - 26 && (
                    <text
                      x={9}
                      y={t.pos + 3}
                      fontSize={8}
                      fontFamily="monospace"
                      fill="#8A919B"
                      transform={`rotate(-90 9 ${t.pos + 3})`}
                      textAnchor="end"
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              ))}
          </svg>
        </div>

        {/* Corner where the two rulers meet */}
        <div
          className="absolute left-0 top-0 z-20 h-[18px] w-[18px] border-b border-r border-line bg-ink-2"
        />
      </>
    );
  };

  // Paths list for anchors
  const pathsForAnchors = [
    ...allPaths,
    ...(activePathInProgress ? [activePathInProgress] : []),
  ];

  /* ------------------------------------------------------------------ *
   * Node markers
   *
   * Only two things follow the pointer, and neither redraws the artwork:
   *   · +  the point on the outline where a tap inserts a node
   *   · −  the node a tap removes
   * Nodes keep their normal size and colour while the finger moves.
   * ------------------------------------------------------------------ */
  const nodeTargetPath =
    selection.selectedPathIds.length > 0
      ? allPaths.find((p) => p.id === selection.selectedPathIds[0]) ?? null
      : null;

  /** Where a tap would insert a node on the selected path */
  const addNodeHint = (() => {
    if (effectiveTool !== 'direct-select' || !currentPointerPoint || !nodeTargetPath) return null;

    // A tap that lands on a node selects it instead of inserting, so the +
    // stays hidden inside the node's own hit target
    const onNode = nodeTargetPath.points.some(
      (p) =>
        Math.hypot(p.x - currentPointerPoint.x, p.y - currentPointerPoint.y) <=
        ANCHOR_HIT_RADIUS / view.zoom
    );

    return onNode ? null : segmentInsertAt(nodeTargetPath, currentPointerPoint, 14 / view.zoom);
  })();

  const deleteNodeArmed =
    !!nodeTargetPath &&
    nodeTargetPath.points.length >= 2 &&
    (modifiers.alt || (effectiveTool === 'pen' && !activePathInProgress));

  /** The node a tap would remove */
  const deleteNodeHintIndex = (() => {
    if (!deleteNodeArmed || !currentPointerPoint || !nodeTargetPath) return null;

    const reach = ANCHOR_HIT_RADIUS / view.zoom;
    let bestIndex: number | null = null;
    let bestDistance = Infinity;

    for (let i = 0; i < nodeTargetPath.points.length; i++) {
      const p = nodeTargetPath.points[i];
      const d = Math.hypot(p.x - currentPointerPoint.x, p.y - currentPointerPoint.y);
      if (d <= reach && d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    return bestIndex;
  })();

  /**
   * A pen path with no stroke would build invisibly, so its geometry is drawn
   * as a thin accent guide until a stroke is applied. Guides are editing aids
   * only — they are never part of the artwork or the export.
   */
  const penGuideOnly =
    !!activePathInProgress &&
    effectiveTool === 'pen' &&
    (activePathInProgress.stroke === 'none' || activePathInProgress.strokeWidth <= 0);

  /* --------------------------- Precision pad --------------------------- */
  // Pen, nodes and plain selection: the pad is how you aim without covering
  // the thing you are about to grab, so it belongs in Select too.
  const padAvailable =
    (effectiveTool === 'pen' ||
      effectiveTool === 'pencil' ||
      effectiveTool === 'direct-select' ||
      effectiveTool === 'select') &&
    showPrecisionPad;

  useEffect(() => {
    if (padAvailable) return;
    padOpenRef.current = false;
    setPadOpen(false);
    setPadCursor(null);
    padCursorRef.current = null;
    padTargetRef.current = null;
    padPressRef.current = false;
    guardPointersRef.current.clear();
    guardPinchRef.current = null;
  }, [padAvailable]);

  const getCanvasCursor = () => {
    if (effectiveTool === 'hand') return 'cursor-grab active:cursor-grabbing';
    if (effectiveTool === 'pen') return 'cursor-crosshair';
    if (effectiveTool === 'pencil') return 'cursor-crosshair';
    if (effectiveTool === 'pressure-brush') return 'cursor-crosshair';
    if (effectiveTool === 'shape') return 'cursor-crosshair';
    if (effectiveTool === 'shape-builder') return 'cursor-crosshair';
    if (effectiveTool === 'direct-select') return 'cursor-default';
    return 'cursor-default';
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-ink-0"
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full ${getCanvasCursor()}`}
      >
        <defs>
          {/* Adobe Illustrator Shape Builder Diagonal Stipple Hatch for Merge (+) */}
          <pattern id="sb-stipple-merge" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke={CANVAS.accent} strokeWidth="2.8" opacity="0.75" />
          </pattern>
          {/* Adobe Illustrator Shape Builder Diagonal Stipple Hatch for Erase (-) */}
          <pattern id="sb-stipple-erase" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke={CANVAS.erase} strokeWidth="2.8" opacity="0.85" />
          </pattern>
          <pattern id="selection-overlap-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="rgba(205, 255, 92, 0.10)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke={CANVAS.accent} strokeWidth="1.4" opacity="0.7" />
          </pattern>
          {clippingMasks.map((mask) => {
            const d = pathToSvgD(mask);
            return d ? (
              <clipPath
                key={`clip-${mask.id}`}
                id={clipPathIdFor(mask.id)}
                clipPathUnits="userSpaceOnUse"
              >
                <path d={d} fillRule="evenodd" />
              </clipPath>
            ) : null;
          })}
          {missingClipIds.map((id) => (
            <clipPath
              key={`missing-clip-${id}`}
              id={clipPathIdFor(id)}
              clipPathUnits="userSpaceOnUse"
            />
          ))}
          {/* Artboard Shadow */}
          <filter id="artboard-shadow" x="-5%" y="-5%" width="115%" height="115%">
            <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="#000000" floodOpacity="0.6" />
          </filter>
          {/* Artboard Content Clip */}
          <clipPath id="artboard-bounds-clip">
            <rect x="0" y="0" width={view.width} height={view.height} />
          </clipPath>
          {/* Gradient paints for fills */}
          {gradientDefNodes}
        </defs>

        <g transform={`translate(${view.panX}, ${view.panY}) scale(${view.zoom})`}>
          {/* Canvas Artboard Surface & Drop Shadow */}
          <rect
            x={0}
            y={0}
            width={view.width}
            height={view.height}
            fill={artboardColor}
            stroke={CANVAS.artboardEdge}
            strokeWidth={1.5 / view.zoom}
            filter="url(#artboard-shadow)"
          />

          {/* Artboard Corner Registration Brackets */}
          <g className="artboard-corner-brackets pointer-events-none opacity-50">
            <path d="M -12 0 L 0 0 L 0 -12" stroke={CANVAS.accent} strokeWidth={1.5 / view.zoom} fill="none" />
            <path d={`M ${view.width + 12} 0 L ${view.width} 0 L ${view.width} -12`} stroke={CANVAS.accent} strokeWidth={1.5 / view.zoom} fill="none" />
            <path d={`M -12 ${view.height} L 0 ${view.height} L 0 ${view.height + 12}`} stroke={CANVAS.accent} strokeWidth={1.5 / view.zoom} fill="none" />
            <path d={`M ${view.width + 12} ${view.height} L ${view.width} ${view.height} L ${view.width} ${view.height + 12}`} stroke={CANVAS.accent} strokeWidth={1.5 / view.zoom} fill="none" />
          </g>

          {/* Artboard Header Badge */}
          <g className="artboard-header-badge pointer-events-none" transform={`translate(0, ${-22 / view.zoom})`}>
            <rect
              x={0}
              y={0}
              width={160 / view.zoom}
              height={18 / view.zoom}
              rx={4 / view.zoom}
              fill={CANVAS.ink}
              stroke={CANVAS.artboardEdge}
              strokeWidth={1 / view.zoom}
            />
            <text
              x={8 / view.zoom}
              y={12.5 / view.zoom}
              fill="#94A3B8"
              fontSize={10 / view.zoom}
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              Artboard 1 • {view.width} × {view.height} px
            </text>
          </g>

          {/* Grid */}
          {renderGrid()}

          {/* Render All Committed Layers & Paths (Optional Clipping to Artboard Bounds) */}
          <g clipPath={clipArtboard ? 'url(#artboard-bounds-clip)' : undefined}>
            {/* Reference Sketch Background Images for Pen Tracing */}
            {referenceImages.map((img) => {
              if (!img.visible) return null;
              return (
                <image
                  key={img.id}
                  href={img.url}
                  x={img.x}
                  y={img.y}
                  width={img.width}
                  height={img.height}
                  opacity={img.opacity}
                  className={img.locked ? 'pointer-events-none' : 'cursor-move'}
                  preserveAspectRatio="none"
                  onPointerDown={(e) => {
                    if (img.locked || !onUpdateReference) return;
                    e.stopPropagation();
                    const pt = screenToCanvas(e.clientX, e.clientY);
                    referenceDragRef.current = {
                      id: img.id,
                      grab: pt,
                      origin: { x: img.x, y: img.y },
                    };
                    try {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              );
            })}

            {layers.map((layer) => {
            if (!layer.visible) return null;
            const layerLocked = layer.locked === true;

            return (
              <g key={layer.id} opacity={layer.opacity}>
                {layer.paths.map((path) => {
                  if (path.visible === false) return null;
                  // One lock is enough: the object's own, or its layer's.
                  const pathLocked = path.locked === true || layerLocked;
                  const isSelected = selection.selectedPathIds.includes(path.id);
                  const isShapeBuilder = tool === 'shape-builder';
                  const clipPath = clippingUrlFor(path);

                  // A mask source clips other artwork but does not paint itself.
                  if (path.isClippingMask) {
                    if (!isSelected) return null;
                    const maskD = pathToSvgD(path);
                    return maskD ? (
                      <path
                        key={path.id}
                        d={maskD}
                        fill="none"
                        stroke={CANVAS.accent}
                        strokeWidth={1.6 / view.zoom}
                        strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
                        opacity={0.8}
                        className="pointer-events-none"
                      />
                    ) : null;
                  }

                  // Vector Typography Path Rendering
                  if (path.text) {
                    const fontSize = path.fontSize || 48;
                    const fontFamily = path.fontFamily || 'Impact, sans-serif';
                    const fontWeight = path.fontWeight || 'bold';
                    const lines = textLines(path.text);
                    const lineHeight = textLineHeight(fontSize);
                    const pt = path.points[0] || { x: 50, y: 50 };
                    // Keep the glyphs' own scale/rotation/flip in the same node
                    // as the label, so the visible text and its hitbox agree.
                    const textTransform = `translate(${pt.x} ${pt.y}) ${textMatrixCss(path.textMatrix)}`;

                    return (
                      <g key={path.id} opacity={path.opacity ?? 1} clipPath={clipPath}>
                        {/* Text Hitbox */}
                        <text
                          x={0}
                          y={0}
                          transform={textTransform}
                          fill="transparent"
                          pointerEvents={pathLocked ? 'none' : undefined}
                          stroke="transparent"
                          strokeWidth={20 / view.zoom}
                          fontSize={fontSize}
                          fontFamily={fontFamily}
                          fontWeight={fontWeight}
                          letterSpacing={path.letterSpacing ?? 0}
                          className={effectiveTool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                          onPointerDown={(e) => {
                            // The type tool taps an existing label to re-edit it.
                            if (effectiveTool === 'text' && onEditText) {
                              e.stopPropagation();
                              onSelectionChange({
                                selectedPathIds: [path.id],
                                selectedAnchorIndex: null,
                                selectedHandleType: null,
                              });
                              onEditText(path);
                              return;
                            }
                            // Second tap on the same label opens the editor instead
                            // of dragging it across the artboard.
                            if (
                              effectiveTool === 'select' &&
                              onEditText &&
                              registerTap(`text:${path.id}`)
                            ) {
                              e.stopPropagation();
                              onSelectionChange({
                                selectedPathIds: [path.id],
                                selectedAnchorIndex: null,
                                selectedHandleType: null,
                              });
                              onEditText(path);
                              return;
                            }
                            if (effectiveTool === 'select') {
                              const isAlready = selection.selectedPathIds.includes(path.id);
                              let newSelected = modifiers.shift || modifiers.ctrl
                                ? (isAlready ? selection.selectedPathIds.filter((id) => id !== path.id) : [...selection.selectedPathIds, path.id])
                                : (isAlready ? selection.selectedPathIds : [path.id]);

                              onSelectionChange({
                                selectedPathIds: newSelected,
                                selectedAnchorIndex: null,
                                selectedHandleType: null,
                              });

                              const pathsToDrag = allPaths.filter((p) => newSelected.includes(p.id));
                              const pathsBBox = computePathsBoundingBox(pathsToDrag);

                              startDragOperation(e, {
                                type: 'path',
                                pathId: path.id,
                                initialBBox: pathsBBox || undefined,
                                initialSelectedPaths: JSON.parse(JSON.stringify(pathsToDrag)),
                              });
                            }
                          }}
                        >
                          {lines.map((line, index) => (
                            <tspan key={index} x={0} dy={index === 0 ? 0 : lineHeight}>
                              {line || ' '}
                            </tspan>
                          ))}
                        </text>

                        {/* Visible Text */}
                        <text
                          x={0}
                          y={0}
                          transform={textTransform}
                          fill={
                            gradientFill(path) ??
                            (path.fill && path.fill !== 'none' ? path.fill : CANVAS.accent)
                          }
                          fillOpacity={path.fillOpacity ?? 1}
                          stroke={path.stroke !== 'none' ? path.stroke : undefined}
                          strokeWidth={path.strokeWidth}
                          fontSize={fontSize}
                          fontFamily={fontFamily}
                          fontWeight={fontWeight}
                          letterSpacing={path.letterSpacing ?? 0}
                          className="pointer-events-none select-none"
                        >
                          {lines.map((line, index) => (
                            <tspan key={index} x={0} dy={index === 0 ? 0 : lineHeight}>
                              {line || ' '}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    );
                  }

                  // Variable stroke outline
                  if (path.pressureProfile !== 'uniform') {
                    const ribbonD = generateVariableStrokePolygon(path.points, pressureConfig);
                    return (
                      <path
                        key={path.id}
                        d={ribbonD}
                        fill={path.stroke || CANVAS.accent}
                        opacity={path.strokeOpacity * (path.opacity ?? 1)}
                        clipPath={clipPath}
                        pointerEvents={pathLocked ? 'none' : undefined}
                        className={effectiveTool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                        onPointerDown={(e) => {
                          if (isShapeBuilder) {
                            handleShapeBuilderToggle(path, e);
                          } else if (effectiveTool === 'direct-select') {
                            // A click only selects. Nodes are inserted with the +
                            // badge, so a press never quietly rewrites the path.
                            e.stopPropagation();
                            const already = selection.selectedPathIds.includes(path.id);
                            onSelectionChange({
                              selectedPathIds:
                                modifiers.shift && !already
                                  ? [...selection.selectedPathIds, path.id]
                                  : [path.id],
                              selectedAnchorIndex: null,
                              selectedHandleType: null,
                            });
                          } else if (effectiveTool === 'select') {
                            if (registerTap(path.id) && onToolSwitch) {
                              e.stopPropagation();
                              onSelectionChange({
                                selectedPathIds: [path.id],
                                selectedAnchorIndex: null,
                                selectedHandleType: null,
                              });
                              onToolSwitch('direct-select');
                              return;
                            }
                            const isAlready = selection.selectedPathIds.includes(path.id);
                            let newSelected: string[];
                            if (modifiers.shift || modifiers.ctrl) {
                              newSelected = isAlready
                                ? selection.selectedPathIds.filter((id) => id !== path.id)
                                : [...selection.selectedPathIds, path.id];
                            } else {
                              newSelected = isAlready ? selection.selectedPathIds : [path.id];
                            }

                            onSelectionChange({
                              selectedPathIds: newSelected,
                              selectedAnchorIndex: null,
                              selectedHandleType: null,
                            });

                            const pathsToDrag = allPaths.filter((p) => newSelected.includes(p.id));
                            startDragOperation(e, {
                              type: 'path',
                              pathId: path.id,
                              initialSelectedPaths: JSON.parse(JSON.stringify(pathsToDrag)),
                            });
                          }
                        }}
                      />
                    );
                  }

                  const pathD = pathToSvgD(path);
                  if (!pathD) return null;

                  return (
                    <g key={path.id} opacity={path.opacity ?? 1} clipPath={clipPath}>
                      {/* Generous touch hitbox. Closed shapes also catch taps inside
                          their fill, so the object you see on top is the one you
                          select — interior taps used to fall through to objects behind. */}
                      <path
                        d={pathD}
                        fill={path.closed ? 'transparent' : 'none'}
                        stroke="transparent"
                        pointerEvents={pathLocked ? 'none' : undefined}
                        strokeWidth={Math.max(34, path.strokeWidth * 3) / view.zoom}
                        className={effectiveTool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                        onPointerDown={(e) => {
                          if (isShapeBuilder) {
                            handleShapeBuilderToggle(path, e);
                          } else if (effectiveTool === 'direct-select') {
                            // A click only selects. Nodes are inserted with the +
                            // badge, so a press never quietly rewrites the path.
                            e.stopPropagation();
                            const already = selection.selectedPathIds.includes(path.id);
                            onSelectionChange({
                              selectedPathIds:
                                modifiers.shift && !already
                                  ? [...selection.selectedPathIds, path.id]
                                  : [path.id],
                              selectedAnchorIndex: null,
                              selectedHandleType: null,
                            });
                          } else if (effectiveTool === 'select') {
                            if (registerTap(path.id) && onToolSwitch) {
                              e.stopPropagation();
                              onSelectionChange({
                                selectedPathIds: [path.id],
                                selectedAnchorIndex: null,
                                selectedHandleType: null,
                              });
                              onToolSwitch('direct-select');
                              return;
                            }
                            const isAlready = selection.selectedPathIds.includes(path.id);
                            let newSelected: string[];
                            if (modifiers.shift || modifiers.ctrl) {
                              newSelected = isAlready
                                ? selection.selectedPathIds.filter((id) => id !== path.id)
                                : [...selection.selectedPathIds, path.id];
                            } else {
                              newSelected = isAlready ? selection.selectedPathIds : [path.id];
                            }

                            onSelectionChange({
                              selectedPathIds: newSelected,
                              selectedAnchorIndex: null,
                              selectedHandleType: null,
                            });

                            const pathsToDrag = allPaths.filter((p) => newSelected.includes(p.id));
                            const pathsBBox = computePathsBoundingBox(pathsToDrag);

                            startDragOperation(e, {
                              type: 'path',
                              pathId: path.id,
                              initialBBox: pathsBBox || undefined,
                              initialSelectedPaths: JSON.parse(JSON.stringify(pathsToDrag)),
                            });
                          }
                        }}
                      />

                      {(() => {
                        const faces = extrusionFaces(path);
                        if (faces.length === 0) return null;
                        const shadow = extrusionShadow(path);
                        return (
                          <>
                            {shadow && (
                              <>
                                <defs>
                                  <filter id={shadow.id} x="-40%" y="-40%" width="180%" height="180%">
                                    <feGaussianBlur stdDeviation={shadow.blur} />
                                  </filter>
                                </defs>
                                <g
                                  className="pointer-events-none path-extrusion-shadow"
                                  transform={`translate(${shadow.dx} ${shadow.dy})`}
                                  filter={`url(#${shadow.id})`}
                                  opacity={shadow.opacity}
                                  clipPath={clipPath}
                                >
                                  <path d={pathD} fill="#000" />
                                  <path d={shadow.d} fill="#000" />
                                </g>
                              </>
                            )}
                            <g className="pointer-events-none path-extrusion" clipPath={clipPath}>
                              {faces.map((face, index) => (
                                <path
                                  key={`${face.fill}-${index}`}
                                  d={face.d}
                                  fill={face.fill}
                                  stroke={face.fill}
                                  strokeWidth={1}
                                  strokeLinejoin="round"
                                  vectorEffect="non-scaling-stroke"
                                  fillOpacity={path.fillOpacity}
                                  fillRule="nonzero"
                                />
                              ))}
                            </g>
                          </>
                        );
                      })()}

                      {/* Visible rendered path */}
                      <path
                        d={pathD}
                        fill={
                          path.closed
                            ? gradientFill(path) ?? (path.fill !== 'none' ? path.fill : 'none')
                            : 'none'
                        }
                        fillOpacity={path.fillOpacity}
                        fillRule="evenodd"
                        stroke={path.stroke !== 'none' ? path.stroke : 'transparent'}
                        strokeWidth={path.strokeWidth}
                        strokeOpacity={path.strokeOpacity}
                        strokeLinecap={path.strokeCap}
                        strokeLinejoin={path.strokeJoin}
                        className={`pointer-events-none ${
                          isShapeBuilder && isSelected ? 'stroke-accent stroke-[3]' : ''
                        }`}
                      />

                      {/* Selection Outline when not in transform mode */}
                      {isSelected && effectiveTool !== 'select' && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke={CANVAS.accent}
                          strokeWidth={2 / view.zoom}
                          strokeDasharray={path.closed ? 'none' : '4 4'}
                          className="pointer-events-none"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          </g>

          {/* Where the selected objects overlap. This is live editing feedback,
              never artwork, and it is the same region a clipping mask will use. */}
          {selectionOverlapD &&
            (effectiveTool === 'select' || effectiveTool === 'shape-builder') && (
              <g className="selection-overlap pointer-events-none">
                <path
                  d={selectionOverlapD}
                  fill="url(#selection-overlap-hatch)"
                  stroke={CANVAS.accent}
                  strokeWidth={1.8 / view.zoom}
                  strokeDasharray={`${5 / view.zoom} ${4 / view.zoom}`}
                />
              </g>
            )}

          {/* Active Path in progress */}
          {activePathInProgress && (
            <g className="active-path-in-progress pointer-events-none">
              {activePathInProgress.pressureProfile !== 'uniform' ? (
                <path
                  d={generateVariableStrokePolygon(activePathInProgress.points, pressureConfig)}
                  fill={activePathInProgress.stroke}
                  opacity={activePathInProgress.strokeOpacity}
                  clipPath={drawInsideClipUrl}
                />
              ) : (
                <>
                  <path
                    d={pointsToSvgPath(activePathInProgress.points, activePathInProgress.closed)}
                    fill={activePathInProgress.closed ? activePathInProgress.fill : 'none'}
                    stroke={penGuideOnly ? CANVAS.accent : activePathInProgress.stroke}
                    strokeWidth={penGuideOnly ? 1.5 / view.zoom : activePathInProgress.strokeWidth}
                    strokeDasharray={penGuideOnly ? '7 5' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    clipPath={penGuideOnly ? undefined : drawInsideClipUrl}
                  />
                  {effectiveTool === 'pen' && currentPointerPoint && activePathInProgress.points.length > 0 && (
                    <>
                      <line
                        x1={activePathInProgress.points[activePathInProgress.points.length - 1].x}
                        y1={activePathInProgress.points[activePathInProgress.points.length - 1].y}
                        x2={currentPointerPoint.x}
                        y2={currentPointerPoint.y}
                        stroke={CANVAS.accent}
                        strokeWidth={1.5 / view.zoom}
                        strokeDasharray="4 4"
                        className="opacity-70"
                      />

                      {/* Shift constraint: rail, landing ring, finger crosshair */}
                      {penSnapPreview && (
                        <g className="pen-snap-preview">
                          <line
                            x1={penSnapPreview.from.x}
                            y1={penSnapPreview.from.y}
                            x2={penSnapPreview.snapped.x}
                            y2={penSnapPreview.snapped.y}
                            stroke={CANVAS.accent}
                            strokeWidth={1.5 / view.zoom}
                            strokeDasharray="2 3"
                            className="opacity-90"
                          />
                          <circle
                            cx={penSnapPreview.snapped.x}
                            cy={penSnapPreview.snapped.y}
                            r={7 / view.zoom}
                            fill="none"
                            stroke={CANVAS.accent}
                            strokeWidth={2 / view.zoom}
                          />
                          <circle
                            cx={penSnapPreview.snapped.x}
                            cy={penSnapPreview.snapped.y}
                            r={2 / view.zoom}
                            fill={CANVAS.accent}
                          />
                          <g stroke={CANVAS.grid} strokeWidth={1.5 / view.zoom}>
                            <line
                              x1={currentPointerPoint.x - 5 / view.zoom}
                              y1={currentPointerPoint.y}
                              x2={currentPointerPoint.x + 5 / view.zoom}
                              y2={currentPointerPoint.y}
                            />
                            <line
                              x1={currentPointerPoint.x}
                              y1={currentPointerPoint.y - 5 / view.zoom}
                              x2={currentPointerPoint.x}
                              y2={currentPointerPoint.y + 5 / view.zoom}
                            />
                          </g>
                        </g>
                      )}
                      {activePathInProgress.points.length >= 2 &&
                        distance(currentPointerPoint, activePathInProgress.points[0]) < 28 / view.zoom && (
                          <g className="close-path-cue">
                            <circle
                              cx={activePathInProgress.points[0].x}
                              cy={activePathInProgress.points[0].y}
                              r={12 / view.zoom}
                              fill="rgba(205, 255, 92, 0.25)"
                              stroke={CANVAS.accent}
                              strokeWidth={2 / view.zoom}
                            />
                            <text
                              x={activePathInProgress.points[0].x + 16 / view.zoom}
                              y={activePathInProgress.points[0].y - 8 / view.zoom}
                              fill={CANVAS.accent}
                              fontSize={11 / view.zoom}
                              fontWeight="bold"
                            >
                              Close Path
                            </text>
                          </g>
                        )}
                    </>
                  )}
                </>
              )}
            </g>
          )}

          {/* Pencil: live trail, plus a cue when releasing would close the shape */}
          {pencilStroke && pencilStroke.length > 1 && (() => {
            const first = pencilStroke[0];
            const lastSample = pencilStroke[pencilStroke.length - 1];
            const smoothed = smoothPencilSamples(pencilStroke, pencilSmoothing);
            const path = smoothed.map((p) => `${p.x},${p.y}`).join(' ');
            const closing =
              pencilStroke.length > 8 &&
              distance(first, lastSample) <= PENCIL_CLOSE_RADIUS / view.zoom;

            return (
              <g className="pencil-preview pointer-events-none">
                <polyline
                  points={path}
                  fill="none"
                  stroke={strokeColor === 'none' ? CANVAS.accent : strokeColor}
                  strokeWidth={Math.max(strokeWidth, 1.4 / view.zoom)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                  clipPath={drawInsideClipUrl}
                />
                {closing && (
                  <g className="pencil-close-cue">
                    <circle
                      cx={first.x}
                      cy={first.y}
                      r={12 / view.zoom}
                      fill="rgba(205, 255, 92, 0.22)"
                      stroke={CANVAS.accent}
                      strokeWidth={2 / view.zoom}
                    />
                    <text
                      x={first.x + 16 / view.zoom}
                      y={first.y - 8 / view.zoom}
                      fill={CANVAS.accent}
                      fontSize={11 / view.zoom}
                      fontWeight="bold"
                    >
                      Close Shape
                    </text>
                  </g>
                )}
              </g>
            );
          })()}

          {/* ================= TRANSFORM BOUNDING BOX WITH 8 STRETCHING NODES ================= */}
          {effectiveTool === 'select' &&
            selectedBBox &&
            selectedPaths.length > 0 &&
            !hideTransformBox && (
            <g className="transform-bounding-box">
              {/* Outer Bounding Box Rectangle (drag to move all selected paths) */}
              <rect
                x={selectedBBox.minX}
                y={selectedBBox.minY}
                width={selectedBBox.width}
                height={selectedBBox.height}
                fill="rgba(205, 255, 92, 0.05)"
                stroke={CANVAS.accent}
                strokeWidth={1.5 / view.zoom}
                strokeDasharray="4 4"
                className="cursor-move"
                onPointerDown={(e) => {
                  startDragOperation(e, {
                    type: 'path',
                    initialBBox: selectedBBox,
                    initialSelectedPaths: JSON.parse(JSON.stringify(selectedPaths)),
                  });
                }}
              />

              {/* Rotation Handle Stem */}
              <line
                x1={selectedBBox.centerX}
                y1={selectedBBox.minY}
                x2={selectedBBox.centerX}
                y2={selectedBBox.minY - 26 / view.zoom}
                stroke={CANVAS.accent}
                strokeWidth={1.5 / view.zoom}
                strokeDasharray="2 2"
                className="pointer-events-none opacity-80"
              />

              {/* Rotation Handle Hitbox & Visual */}
              <g>
                <title>Rotate Selection (Hold Shift for 15° snap)</title>
                <circle
                  cx={selectedBBox.centerX}
                  cy={selectedBBox.minY - 26 / view.zoom}
                  r={16 / view.zoom}
                  fill="transparent"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    const pt = screenToCanvas(e.clientX, e.clientY);
                    startDragOperation(e, {
                      type: 'rotate-handle',
                      initialPoint: pt,
                      initialBBox: selectedBBox,
                      initialSelectedPaths: JSON.parse(JSON.stringify(selectedPaths)),
                    });
                  }}
                />
              </g>
              <circle
                cx={selectedBBox.centerX}
                cy={selectedBBox.minY - 26 / view.zoom}
                r={7 / view.zoom}
                fill="#F59E0B"
                stroke={CANVAS.ink}
                strokeWidth={2 / view.zoom}
                className="pointer-events-none shadow-md"
              />

              {/* 8 Round Stretch Handles (TL, TR, BL, BR, TC, BC, ML, MR) */}
              {[
                { id: 'tl', x: selectedBBox.minX, y: selectedBBox.minY, cursor: 'nwse-resize' },
                { id: 'tr', x: selectedBBox.maxX, y: selectedBBox.minY, cursor: 'nesw-resize' },
                { id: 'bl', x: selectedBBox.minX, y: selectedBBox.maxY, cursor: 'nesw-resize' },
                { id: 'br', x: selectedBBox.maxX, y: selectedBBox.maxY, cursor: 'nwse-resize' },
                { id: 'tc', x: selectedBBox.centerX, y: selectedBBox.minY, cursor: 'ns-resize' },
                { id: 'bc', x: selectedBBox.centerX, y: selectedBBox.maxY, cursor: 'ns-resize' },
                { id: 'ml', x: selectedBBox.minX, y: selectedBBox.centerY, cursor: 'ew-resize' },
                { id: 'mr', x: selectedBBox.maxX, y: selectedBBox.centerY, cursor: 'ew-resize' },
              ].map((h) => (
                <g key={h.id}>
                  {/* Wide Touch Target */}
                  <circle
                    cx={h.x}
                    cy={h.y}
                    r={18 / view.zoom}
                    fill="transparent"
                    style={{ cursor: h.cursor }}
                    onPointerDown={(e) => {
                      startDragOperation(e, {
                        type: 'transform-handle',
                        transformHandle: h.id as HandleType,
                        initialBBox: selectedBBox,
                        initialSelectedPaths: JSON.parse(JSON.stringify(selectedPaths)),
                      });
                    }}
                  />
                  {/* Crisp round stretch node */}
                  <circle
                    cx={h.x}
                    cy={h.y}
                    r={6 / view.zoom}
                    fill="#FFFFFF"
                    stroke={CANVAS.accent}
                    strokeWidth={2 / view.zoom}
                    className="pointer-events-none shadow-md"
                  />
                </g>
              ))}

                          </g>
          )}

          {/* Marquee Selection Dragging Box */}
          {marqueeBox && (
            <rect
              x={Math.min(marqueeBox.start.x, marqueeBox.current.x)}
              y={Math.min(marqueeBox.start.y, marqueeBox.current.y)}
              width={Math.abs(marqueeBox.current.x - marqueeBox.start.x)}
              height={Math.abs(marqueeBox.current.y - marqueeBox.start.y)}
              fill="rgba(205, 255, 92, 0.12)"
              stroke={CANVAS.accent}
              strokeWidth={1.5 / view.zoom}
              strokeDasharray="4 4"
              className="pointer-events-none"
            />
          )}

          {/* Build: the objects it is about to work on. A wash on the whole
              object, under the region overlay, so picking Build shows its
              subject immediately instead of only lighting up on hover. */}
          {tool === 'shape-builder' && participatingPaths.length >= 2 && (              <g className="shape-builder-participants pointer-events-none">
              {participatingPaths.filter((p) => !p.isClippingMask).map((p) => {
                const d = pathToSvgD(p);
                if (!d) return null;
                const picked = selection.selectedPathIds.includes(p.id);
                return (
                  <path
                    key={`sb-participant-${p.id}`}
                    d={d}
                    fill={p.closed ? CANVAS.accent : 'none'}
                    fillOpacity={picked ? 0.13 : 0.06}
                    stroke={CANVAS.accent}
                    strokeOpacity={picked ? 0.85 : 0.35}
                    strokeWidth={(picked ? 2 : 1) / view.zoom}
                    strokeDasharray={picked ? undefined : `${4 / view.zoom} ${4 / view.zoom}`}
                    clipPath={clippingUrlFor(p)}
                  />
                );
              })}
            </g>
          )}

          {/* ================= ADOBE ILLUSTRATOR SHAPE BUILDER INTERACTIVE OVERLAY ================= */}
          {tool === 'shape-builder' && atomicRegions.length > 0 && (
            <g className="shape-builder-overlay">
              {atomicRegions.map((region) => {
                const isSelected = sbSelectedRegionIds.includes(region.id);
                const isHovered = sbHoveredRegionId === region.id;
                const isActive = isSelected || (isHovered && sbSelectedRegionIds.length === 0);
                const isErase = modifiers.alt || sbMode === 'erase';

                return (
                  <g key={region.id} className="shape-builder-subregion">
                    {/* Interactive Sub-region boundary & background hitbox */}
                    <path
                      d={region.pathD}
                      fill={isActive ? (isErase ? 'rgba(255, 107, 107, 0.2)' : 'rgba(205, 255, 92, 0.18)') : 'rgba(255, 255, 255, 0.001)'}
                      stroke={isActive ? (isErase ? CANVAS.erase : CANVAS.accent) : 'transparent'}
                      strokeWidth={(isActive ? 2.5 : 0) / view.zoom}
                      strokeDasharray={undefined}
                      opacity={isActive ? 1 : 0}
                      className="cursor-crosshair"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        try {
                          (e.target as Element).setPointerCapture?.(e.pointerId);
                        } catch (_) {}
                        const pt = screenToCanvas(e.clientX, e.clientY);
                        setIsPointerDown(true);
                        setDragStartPoint(pt);
                        setCurrentPointerPoint(pt);
                        setSbSelectedRegionIds([region.id]);
                        setSbDragPoints([pt]);
                        setDraggingTarget({ type: 'shape-builder-drag' });
                      }}
                    />

                    {/* Authentic Adobe Illustrator Diagonal Stipple/Hatch Mesh Overlay */}
                    {isActive && (
                      <path
                        d={region.pathD}
                        fill={isErase ? 'url(#sb-stipple-erase)' : 'url(#sb-stipple-merge)'}
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}

              {/* Illustrator Signature Connecting Drag Trail Polyline */}
              {sbDragPoints.length >= 2 && (
                <polyline
                  points={sbDragPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={modifiers.alt || sbMode === 'erase' ? CANVAS.erase : CANVAS.accent}
                  strokeWidth={3.5 / view.zoom}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none drop-shadow-md"
                />
              )}

              {/* Dynamic Cursor Mode (+ / -) Indicator */}
              {currentPointerPoint && (
                <g
                  transform={`translate(${currentPointerPoint.x + 14 / view.zoom}, ${currentPointerPoint.y - 14 / view.zoom})`}
                  className="pointer-events-none"
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={9 / view.zoom}
                    fill={modifiers.alt || sbMode === 'erase' ? CANVAS.erase : CANVAS.accent}
                    stroke={CANVAS.ink}
                    strokeWidth={1.5 / view.zoom}
                  />
                  <text
                    x={0}
                    y={3.5 / view.zoom}
                    textAnchor="middle"
                    fill={CANVAS.ink}
                    fontSize={11 / view.zoom}
                    fontWeight="bold"
                    fontFamily="system-ui, sans-serif"
                  >
                    {modifiers.alt || sbMode === 'erase' ? '−' : '+'}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* ================= DIRECT SELECT ANCHORS & BEZIER HANDLES ================= */}
          {(effectiveTool === 'direct-select' || effectiveTool === 'pen') &&
            pathsForAnchors.map((path) => {
              const isSelected =
                selection.selectedPathIds.includes(path.id) ||
                (activePathInProgress && activePathInProgress.id === path.id);

              // A locked object shows no nodes to grab either.
              if (!isSelected || lockedPathIds.has(path.id)) return null;

              return (
                <g key={`anchors-${path.id}`}>
                  {path.points.map((pt, idx) => {
                    const isAnchorSelected =
                      selection.selectedPathIds[0] === path.id && selectedAnchors.includes(idx);

                    return (
                      <g key={pt.id}>
                        {/* Incoming Handle */}
                        {pt.handleIn && (
                          <g>
                            <line
                              x1={pt.x}
                              y1={pt.y}
                              x2={pt.handleIn.x}
                              y2={pt.handleIn.y}
                              stroke={CANVAS.accent}
                              strokeWidth={1.5 / view.zoom}
                              className="pointer-events-none"
                            />
                            <circle
                              cx={pt.handleIn.x}
                              cy={pt.handleIn.y}
                              r={7 / view.zoom}
                              fill={CANVAS.accent}
                              stroke={CANVAS.ink}
                              strokeWidth={1.5 / view.zoom}
                              className="pointer-events-none"
                            />
                          </g>
                        )}

                        {/* Outgoing Handle */}
                        {pt.handleOut && (
                          <g>
                            <line
                              x1={pt.x}
                              y1={pt.y}
                              x2={pt.handleOut.x}
                              y2={pt.handleOut.y}
                              stroke={CANVAS.accent}
                              strokeWidth={1.5 / view.zoom}
                              className="pointer-events-none"
                            />
                            <circle
                              cx={pt.handleOut.x}
                              cy={pt.handleOut.y}
                              r={7 / view.zoom}
                              fill={CANVAS.accent}
                              stroke={CANVAS.ink}
                              strokeWidth={1.5 / view.zoom}
                              className="pointer-events-none"
                            />
                          </g>
                        )}

                        {/* Anchor Hitbox */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={ANCHOR_HIT_RADIUS / view.zoom}
                          fill="transparent"
                          className="cursor-pointer"
                          onPointerDown={(e) => {
                            if (effectiveTool === 'pen' && activePathInProgress && idx === 0 && path.points.length >= 2) {
                              e.stopPropagation();
                              const closedPath = { ...activePathInProgress, closed: true };
                              onAddPath(closedPath);
                              setActivePathInProgress(null);
                              onSelectionChange({
                                selectedPathIds: [closedPath.id],
                                selectedAnchorIndex: 0,
                                selectedAnchorIndexes: [0],
                                selectedHandleType: null,
                              });
                              onCommitHistory();
                              return;
                            }

                            // Alt + click OR clicking existing anchor with Pen tool when not creating: Delete Anchor Node!
                            if (modifiers.alt || (effectiveTool === 'pen' && !activePathInProgress)) {
                              e.stopPropagation();
                              deleteNodeAt(path, idx);
                              return;
                            }

                            grabAnchor(path.id, idx, pt, e);
                          }}
                        />

                        {/* Curve handles are grabbed from here, after the anchor
                            hitbox, so a handle sitting close to its node still
                            catches the finger instead of losing to the node */}
                        {pt.handleIn && (
                          <circle
                            cx={pt.handleIn.x}
                            cy={pt.handleIn.y}
                            r={26 / view.zoom}
                            fill="transparent"
                            className="cursor-pointer"
                            onPointerDown={(e) => {
                              // A handle sitting over its node used to swallow the
                              // delete gesture; keep delete on the node itself.
                              if (modifiers.alt) {
                                e.stopPropagation();
                                deleteNodeAt(path, idx);
                                return;
                              }
                              // A handle near its node used to win the press, so
                              // the node felt unclickable. The node wins now.
                              if (
                                distance(screenToCanvas(e.clientX, e.clientY), pt) * view.zoom <=
                                ANCHOR_HIT_RADIUS
                              ) {
                                e.stopPropagation();
                                grabAnchor(path.id, idx, pt, e);
                                return;
                              }
                              onSelectionChange({
                                selectedPathIds: [path.id],
                                selectedAnchorIndex: idx,
                                selectedAnchorIndexes: [idx],
                                selectedHandleType: 'in',
                              });
                              startDragOperation(e, {
                                type: 'handle-in',
                                pathId: path.id,
                                pointIndex: idx,
                                initialPoint: pt.handleIn,
                              });
                            }}
                          />
                        )}
                        {pt.handleOut && (
                          <circle
                            cx={pt.handleOut.x}
                            cy={pt.handleOut.y}
                            r={26 / view.zoom}
                            fill="transparent"
                            className="cursor-pointer"
                            onPointerDown={(e) => {
                              if (modifiers.alt) {
                                e.stopPropagation();
                                deleteNodeAt(path, idx);
                                return;
                              }
                              // A handle near its node used to win the press, so
                              // the node felt unclickable. The node wins now.
                              if (
                                distance(screenToCanvas(e.clientX, e.clientY), pt) * view.zoom <=
                                ANCHOR_HIT_RADIUS
                              ) {
                                e.stopPropagation();
                                grabAnchor(path.id, idx, pt, e);
                                return;
                              }
                              onSelectionChange({
                                selectedPathIds: [path.id],
                                selectedAnchorIndex: idx,
                                selectedAnchorIndexes: [idx],
                                selectedHandleType: 'out',
                              });
                              startDragOperation(e, {
                                type: 'handle-out',
                                pathId: path.id,
                                pointIndex: idx,
                                initialPoint: pt.handleOut,
                              });
                            }}
                          />
                        )}

                        {/* Anchor Node (Clean static square, NO pulsing animation) */}
                        <rect
                          x={pt.x - 5 / view.zoom}
                          y={pt.y - 5 / view.zoom}
                          width={10 / view.zoom}
                          height={10 / view.zoom}
                          fill={isAnchorSelected ? CANVAS.nodeActive : CANVAS.node}
                          stroke={CANVAS.ink}
                          strokeWidth={2 / view.zoom}
                          className="pointer-events-none shadow-md"
                        />

                        {/* The node a tap removes — the badge is also the button */}
                        {nodeTargetPath?.id === path.id && deleteNodeHintIndex === idx && (
                          <g
                            transform={`translate(${pt.x + 11 / view.zoom}, ${pt.y - 11 / view.zoom})`}
                          >
                            <circle
                              r={20 / view.zoom}
                              fill="transparent"
                              className="cursor-pointer"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                deleteNodeAt(path, idx);
                              }}
                            />
                            <circle
                              r={7.5 / view.zoom}
                              fill={CANVAS.erase}
                              stroke={CANVAS.ink}
                              strokeWidth={1.25 / view.zoom}
                              className="pointer-events-none"
                            />
                            <text
                              y={2.8 / view.zoom}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill={CANVAS.ink}
                              fontSize={9 / view.zoom}
                              fontWeight="bold"
                              fontFamily="system-ui, sans-serif"
                            >
                              −
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}

          {/* The point a tap adds a node to — the badge is also the button */}
          {addNodeHint && nodeTargetPath && (
            <g transform={`translate(${addNodeHint.point.x}, ${addNodeHint.point.y})`}>
              <circle
                r={16 / view.zoom}
                fill="transparent"
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  insertNodeAt(nodeTargetPath, addNodeHint, e);
                }}
              />
              <g className="pointer-events-none">
                <circle
                  r={11 / view.zoom}
                  fill={CANVAS.accentSoft}
                  stroke={CANVAS.accent}
                  strokeWidth={2 / view.zoom}
                />
                <circle
                  r={4 / view.zoom}
                  fill={CANVAS.accent}
                  stroke={CANVAS.ink}
                  strokeWidth={1.25 / view.zoom}
                />
                <text
                  y={-18 / view.zoom}
                  textAnchor="middle"
                  fill={CANVAS.accent}
                  fontSize={14 / view.zoom}
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                >
                  +
                </text>
              </g>
            </g>
          )}

          {/* Guides — editing aids, drawn above the artwork, never exported */}
          {renderGuides()}

          {/* Shape Preview */}
          {effectiveTool === 'shape' && isPointerDown && dragStartPoint && currentPointerPoint && (
            <g className="shape-creation-preview pointer-events-none">
              {(() => {
                let startPt = dragStartPoint;
                let endPt = currentPointerPoint;
                const dx = endPt.x - startPt.x;
                const dy = endPt.y - startPt.y;

                if (modifiers.shift) {
                  const size = Math.max(Math.abs(dx), Math.abs(dy));
                  endPt = {
                    x: startPt.x + Math.sign(dx || 1) * size,
                    y: startPt.y + Math.sign(dy || 1) * size,
                  };
                }

                const previewShape = generateShapePath(
                  startPt.x,
                  startPt.y,
                  endPt.x,
                  endPt.y,
                  { kind: shapeKind, sides: shapeSides, cornerRadius: 24 },
                  'preview-shape',
                  { fill: fillColor, stroke: 'none', strokeWidth: 0 }
                );

                return (
                  <path
                    d={pointsToSvgPath(previewShape.points, previewShape.closed)}
                    fill={previewShape.fill}
                    fillOpacity={0.4}
                    stroke={CANVAS.accent}
                    strokeWidth={1.5 / view.zoom}
                    strokeDasharray="4 4"
                    clipPath={drawInsideClipUrl}
                  />
                );
              })()}
            </g>
          )}
          {/* ================= SMART GUIDES SYSTEM ================= */}
          {activeSmartGuides.length > 0 && (
            <g className="smart-guides-layer pointer-events-none">
              {activeSmartGuides.map((guide, idx) => {
                const isVertical = guide.orientation === 'vertical';

                return (
                  <g key={`${guide.id}-${guide.orientation}-${idx}`}>
                    {/* Contrast backdrop stroke so guide is visible on both dark artboard and vibrant fills */}
                    {isVertical ? (
                      <line
                        x1={guide.coordinate}
                        y1={guide.start}
                        x2={guide.coordinate}
                        y2={guide.end}
                        stroke={CANVAS.page}
                        strokeWidth={3 / view.zoom}
                        strokeOpacity={0.6}
                      />
                    ) : (
                      <line
                        x1={guide.start}
                        y1={guide.coordinate}
                        x2={guide.end}
                        y2={guide.coordinate}
                        stroke={CANVAS.page}
                        strokeWidth={3 / view.zoom}
                        strokeOpacity={0.6}
                      />
                    )}

                    {/* Subtle outer cyan bloom */}
                    {isVertical ? (
                      <line
                        x1={guide.coordinate}
                        y1={guide.start}
                        x2={guide.coordinate}
                        y2={guide.end}
                        stroke={CANVAS.accent}
                        strokeWidth={4 / view.zoom}
                        strokeOpacity={0.25}
                      />
                    ) : (
                      <line
                        x1={guide.start}
                        y1={guide.coordinate}
                        x2={guide.end}
                        y2={guide.coordinate}
                        stroke={CANVAS.accent}
                        strokeWidth={4 / view.zoom}
                        strokeOpacity={0.25}
                      />
                    )}

                    {/* Crisp Primary Smart Guide Line */}
                    {isVertical ? (
                      <line
                        x1={guide.coordinate}
                        y1={guide.start}
                        x2={guide.coordinate}
                        y2={guide.end}
                        stroke={CANVAS.accent}
                        strokeWidth={1 / view.zoom}
                        strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
                      />
                    ) : (
                      <line
                        x1={guide.start}
                        y1={guide.coordinate}
                        x2={guide.end}
                        y2={guide.coordinate}
                        stroke={CANVAS.accent}
                        strokeWidth={1 / view.zoom}
                        strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
                      />
                    )}

                    {/* Target Object Bounding Box Highlight when snapping to other elements */}
                    {guide.targetBBox && guide.sourceType === 'object' && (
                      <rect
                        x={guide.targetBBox.minX}
                        y={guide.targetBBox.minY}
                        width={guide.targetBBox.width}
                        height={guide.targetBBox.height}
                        fill="none"
                        stroke={CANVAS.accent}
                        strokeWidth={1 / view.zoom}
                        strokeDasharray={`${3 / view.zoom} ${3 / view.zoom}`}
                        strokeOpacity={0.5}
                      />
                    )}

                    {/* End Ticks / Snap Markers */}
                    {isVertical ? (
                      <>
                        <line
                          x1={guide.coordinate - 4 / view.zoom}
                          y1={guide.start}
                          x2={guide.coordinate + 4 / view.zoom}
                          y2={guide.start}
                          stroke={CANVAS.accent}
                          strokeWidth={1.5 / view.zoom}
                        />
                        <line
                          x1={guide.coordinate - 4 / view.zoom}
                          y1={guide.end}
                          x2={guide.coordinate + 4 / view.zoom}
                          y2={guide.end}
                          stroke={CANVAS.accent}
                          strokeWidth={1.5 / view.zoom}
                        />
                      </>
                    ) : (
                      <>
                        <line
                          x1={guide.start}
                          y1={guide.coordinate - 4 / view.zoom}
                          x2={guide.start}
                          y2={guide.coordinate + 4 / view.zoom}
                          stroke={CANVAS.accent}
                          strokeWidth={1.5 / view.zoom}
                        />
                        <line
                          x1={guide.end}
                          y1={guide.coordinate - 4 / view.zoom}
                          x2={guide.end}
                          y2={guide.coordinate + 4 / view.zoom}
                          stroke={CANVAS.accent}
                          strokeWidth={1.5 / view.zoom}
                        />
                      </>
                    )}

                    {/* Floating Alignment Pill Badge */}
                    {(() => {
                      const badgeX = isVertical ? guide.coordinate : (guide.start + guide.end) / 2;
                      const badgeY = isVertical ? (guide.start + guide.end) / 2 : guide.coordinate;
                      const charWidth = 6.2 / view.zoom;
                      const badgeWidth = Math.max(50 / view.zoom, guide.label.length * charWidth + 14 / view.zoom);
                      const badgeHeight = 16 / view.zoom;

                      return (
                        <g transform={`translate(${badgeX}, ${badgeY})`}>
                          <rect
                            x={-badgeWidth / 2}
                            y={-badgeHeight / 2}
                            width={badgeWidth}
                            height={badgeHeight}
                            rx={3 / view.zoom}
                            fill={CANVAS.ink}
                            stroke={CANVAS.accent}
                            strokeWidth={1 / view.zoom}
                            opacity={0.92}
                          />
                          <text
                            x={0}
                            y={3.5 / view.zoom}
                            fill={CANVAS.accent}
                            fontSize={8.5 / view.zoom}
                            fontWeight="bold"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            {guide.label}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>

      {renderRulers()}

      {/* Precision pad — crosshair over the artwork, surface between the thumbs */}
      {padAvailable && (
        <>
          {/* While the pad is open, one finger stops here instead of drawing.
              Two fingers are measured here and pan or zoom the canvas. */}
          {padOpen && (
            <div
              aria-hidden
              className="absolute inset-0 z-10 touch-none"
              onPointerDown={handlePadGuardDown}
              onPointerMove={handlePadGuardMove}
              onPointerUp={handlePadGuardUp}
              onPointerCancel={handlePadGuardUp}
            />
          )}
          {padOpen && padCursor && (
            <div
              className="pointer-events-none absolute z-20"
              style={{ left: padCursor.x, top: padCursor.y, transform: 'translate(-50%, -50%)' }}
            >
              <svg width={36} height={36} viewBox="-18 -18 36 36" className="overflow-visible">
                <g stroke={CANVAS.ink} strokeOpacity={0.6} strokeWidth={3.2} strokeLinecap="round">
                  <circle r={8} fill="none" />
                  <path d="M0 -16V-10 M0 10V16 M-16 0H-10 M10 0H16" />
                </g>
                <g stroke={CANVAS.accent} strokeWidth={1.4} strokeLinecap="round">
                  <circle r={8} fill="none" />
                  <path d="M0 -16V-10 M0 10V16 M-16 0H-10 M10 0H16" />
                </g>
                <circle r={1.7} fill={CANVAS.accent} />
              </svg>
            </div>
          )}

          {padOpen ? (
            <PrecisionPad
              onMove={movePadCursor}
              onPress={() => dispatchPadPointer('pointerdown')}
              onDrag={() => dispatchPadPointer('pointermove')}
              onRelease={() => dispatchPadPointer('pointerup')}
              onWheel={handlePadWheel}
              onClose={closePad}
            />
          ) : (
            <button
              type="button"
              onClick={openPad}
              aria-label="Open precision pad: steer a crosshair instead of covering a node or an object with your finger"
              className="press absolute bottom-2 left-1/2 z-20 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-ink-2/85 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-dim shadow-lg shadow-black/40 backdrop-blur"
            >
              <PadGlyph />
              Pad
            </button>
          )}
        </>
      )}
    </div>
  );
};
