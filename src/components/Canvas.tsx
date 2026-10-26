import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Lock, Layers as LayersIcon, Magnet } from 'lucide-react';
import {
  AnchorPoint,
  CanvasView,
  Layer,
  ModifierState,
  Point,
  PressureConfig,
  ReferenceImage,
  SelectionState,
  ShapeKind,
  ShapeOptions,
  ToolType,
  VectorPath,
} from '../types/vector';
import {
  distance,
  pointsToSvgPath,
  snapAngle,
  snapToGrid,
  createSymmetricHandles,
  generateVariableStrokePolygon,
} from '../utils/bezier';
import { generateShapePath } from '../utils/shapeGenerator';
import {
  computePathsBoundingBox,
  scalePaths,
  rotatePaths,
  BoundingBox,
  HandleType,
} from '../utils/transform';
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

interface CanvasProps {
  view: CanvasView;
  onViewChange: (newView: CanvasView) => void;
  layers: Layer[];
  activeLayerId: string;
  onUpdatePath: (path: VectorPath) => void;
  onAddPath: (path: VectorPath) => void;
  tool: ToolType;
  shapeKind: ShapeKind;
  shapeSides: number;
  modifiers: ModifierState;
  selection: SelectionState;
  onSelectionChange: (newSelection: SelectionState) => void;
  gridVisible: boolean;
  gridSnapEnabled: boolean;
  gridSize: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  pressureConfig: PressureConfig;
  onCommitHistory: () => void;
  activePathInProgress: VectorPath | null;
  setActivePathInProgress: React.Dispatch<React.SetStateAction<VectorPath | null>>;
  onShapeBuilderAction: (op: 'union' | 'subtract' | 'intersect' | 'divide') => void;
  onReplacePaths?: (removePathIds: string[], newPaths: VectorPath[]) => void;
  isPanZoomLocked?: boolean;
  onToggleLockPanZoom?: () => void;
  onOpenLayers?: () => void;
  smartGuidesEnabled?: boolean;
  onToggleSmartGuides?: () => void;
  referenceImages?: ReferenceImage[];
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
  gridSize,
  fillColor,
  strokeColor,
  strokeWidth,
  pressureConfig,
  onCommitHistory,
  activePathInProgress,
  setActivePathInProgress,
  onShapeBuilderAction,
  onReplacePaths,
  isPanZoomLocked = false,
  onToggleLockPanZoom,
  onOpenLayers,
  smartGuidesEnabled = true,
  onToggleSmartGuides,
  referenceImages = [],
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
  } | null>(null);

  // Adobe Illustrator Shape Builder State
  const [sbMode, setSbMode] = useState<'merge' | 'erase'>('merge');
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

  // Vector Typography modal state
  const [textInputModal, setTextInputModal] = useState<{ open: boolean; point: Point; text: string } | null>(null);

  // Artboard boundary clipping toggle
  const [clipArtboardBounds, setClipArtboardBounds] = useState<boolean>(false);

  // Convert client screen coordinates to canvas coordinate space
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const rawX = (clientX - rect.left - view.panX) / view.zoom;
      const rawY = (clientY - rect.top - view.panY) / view.zoom;

      let pt: Point = { x: rawX, y: rawY };
      if (gridSnapEnabled) {
        pt = snapToGrid(pt, gridSize);
      }
      return pt;
    },
    [view, gridSnapEnabled, gridSize]
  );

  // Visible paths
  const currentLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
  const allPaths = layers.flatMap((l) => (l.visible ? l.paths : []));

  // Determine effective tool based on Modifier (Ctrl key toggles Direct Select)
  const effectiveTool: ToolType = modifiers.ctrl ? 'direct-select' : tool;

  // Selected paths for transformation
  const selectedPaths = allPaths.filter((p) => selection.selectedPathIds.includes(p.id));
  const selectedBBox = computePathsBoundingBox(selectedPaths);

  // Adobe Illustrator Shape Builder: Participating Paths & Planar Atomic Decomposition
  const participatingPaths = React.useMemo(() => {
    if (tool !== 'shape-builder') return [];
    if (selection.selectedPathIds.length >= 2) {
      return allPaths.filter((p) => selection.selectedPathIds.includes(p.id) && (p.closed || p.points.length >= 3));
    }
    const layerClosed = currentLayer.paths.filter((p) => p.closed || p.points.length >= 3);
    if (layerClosed.length >= 2) return layerClosed;
    const allClosed = allPaths.filter((p) => p.closed || p.points.length >= 3);
    if (allClosed.length >= 2) return allClosed;
    return [];
  }, [tool, selection.selectedPathIds, allPaths, currentLayer]);

  // Compute atomic planar sub-regions
  const atomicRegions = React.useMemo<SubRegion[]>(() => {
    if (tool !== 'shape-builder' || participatingPaths.length < 2) return [];
    try {
      return computeAtomicSubRegions(participatingPaths);
    } catch (err) {
      console.warn('Shape builder planar decomposition error:', err);
      return [];
    }
  }, [tool, participatingPaths]);

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

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
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
          fillOpacity: 1,
          stroke: strokeColor,
          strokeWidth,
          strokeOpacity: 1,
          strokeCap: 'round',
          strokeJoin: 'round',
          pressureProfile: 'uniform',
        };

        setActivePathInProgress(newPath);
        onSelectionChange({
          selectedPathIds: [newPathId],
          selectedAnchorIndex: 0,
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
        if (modifiers.shift) {
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

    // Direct Select: Click on an existing path's segment to INSERT a new anchor node!
    if (effectiveTool === 'direct-select' && selection.selectedPathIds.length > 0) {
      const activePath = allPaths.find((p) => p.id === selection.selectedPathIds[0]);
      if (activePath && activePath.points.length >= 2) {
        const threshold = 14 / view.zoom;
        const count = activePath.points.length;
        const segmentsCount = activePath.closed ? count : count - 1;
        let bestDist = threshold;
        let insertIdx = -1;
        let insertPoint: Point | null = null;

        for (let i = 0; i < segmentsCount; i++) {
          const a = activePath.points[i];
          const b = activePath.points[(i + 1) % count];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;

          const t = Math.max(0.05, Math.min(0.95, ((canvasPt.x - a.x) * dx + (canvasPt.y - a.y) * dy) / lenSq));
          const projX = a.x + t * dx;
          const projY = a.y + t * dy;
          const dist = Math.hypot(canvasPt.x - projX, canvasPt.y - projY);

          if (dist < bestDist) {
            bestDist = dist;
            insertIdx = i + 1;
            insertPoint = { x: projX, y: projY };
          }
        }

        if (insertIdx !== -1 && insertPoint) {
          const newAnchor: AnchorPoint = {
            id: `${activePath.id}-node-${Date.now()}`,
            x: insertPoint.x,
            y: insertPoint.y,
            type: 'smooth',
          };
          const newPoints = [...activePath.points];
          newPoints.splice(insertIdx, 0, newAnchor);
          const updatedPath = { ...activePath, points: newPoints };
          onUpdatePath(updatedPath);
          onSelectionChange({
            selectedPathIds: [updatedPath.id],
            selectedAnchorIndex: insertIdx,
            selectedHandleType: null,
          });
          onCommitHistory();
          setDraggingTarget({
            type: 'anchor',
            pathId: updatedPath.id,
            pointIndex: insertIdx,
            initialPoint: insertPoint,
          });
          return;
        }
      }
    }

    // Vector Typography Tool Logic
    if (effectiveTool === 'text') {
      setTextInputModal({
        open: true,
        point: canvasPt,
        text: 'Pentix Vector',
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
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // 2-Finger Pinch Zoom & Pan
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current !== null && !isPanZoomLocked) {
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = distance(pts[0], pts[1]);
      const zoomRatio = currentDist / initialPinchDistRef.current;
      const targetZoom = Math.min(5, Math.max(0.2, initialPinchZoomRef.current * zoomRatio));

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

      // Find all paths intersecting the marquee box
      const enclosedIds: string[] = [];
      allPaths.forEach((path) => {
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
        const otherPaths = allPaths.filter((p) => !selection.selectedPathIds.includes(p.id));
        const otherBBoxes: { id: string; bbox: BoundingBox; name?: string }[] = [];
        for (const p of otherPaths) {
          const b = computePathsBoundingBox([p]);
          if (b) otherBBoxes.push({ id: p.id, bbox: b, name: p.name });
        }

        const candidates = getSnapCandidates(view.width, view.height, otherBBoxes);
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
      transformed.forEach((p) => onUpdatePath(p));
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
      rotated.forEach((p) => onUpdatePath(p));
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

    // Pressure Brush dynamic sampling
    if (effectiveTool === 'pressure-brush' && (brushStrokeRef.current || activePathInProgress)) {
      const currentBrushPath = brushStrokeRef.current || activePathInProgress;
      if (!currentBrushPath) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastPointerTimeRef.current);
      const dist = distance(lastPointerPosRef.current, canvasPt);
      const velocity = dist / dt;

      let targetPressure = 0.5;
      if (e.pointerType === 'pen' && e.pressure > 0) {
        targetPressure = e.pressure;
      } else {
        const speedFactor = Math.min(1.5, Math.max(0.1, velocity));
        targetPressure = 1 - speedFactor / 1.8;
      }

      smoothedPressureRef.current = smoothedPressureRef.current * 0.7 + targetPressure * 0.3;

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
        const dx = canvasPt.x - (draggingTarget.initialPoint?.x || currPt.x);
        const dy = canvasPt.y - (draggingTarget.initialPoint?.y || currPt.y);

        newPoints[ptIdx] = {
          ...currPt,
          x: canvasPt.x,
          y: canvasPt.y,
          handleIn: currPt.handleIn ? { x: currPt.handleIn.x + dx, y: currPt.handleIn.y + dy } : undefined,
          handleOut: currPt.handleOut ? { x: currPt.handleOut.x + dx, y: currPt.handleOut.y + dy } : undefined,
        };
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
        const otherPaths = allPaths.filter((p) => !selection.selectedPathIds.includes(p.id));
        const otherBBoxes: { id: string; bbox: BoundingBox; name?: string }[] = [];
        for (const p of otherPaths) {
          const b = computePathsBoundingBox([p]);
          if (b) otherBBoxes.push({ id: p.id, bbox: b, name: p.name });
        }

        const candidates = getSnapCandidates(view.width, view.height, otherBBoxes);
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

      draggingTarget.initialSelectedPaths.forEach((path) => {
        const shiftedPoints = path.points.map((pt) => ({
          ...pt,
          x: pt.x + dx,
          y: pt.y + dy,
          handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
          handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
        }));
        onUpdatePath({ ...path, points: shiftedPoints });
      });
      return;
    }
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
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
            { fill: fillColor, stroke: strokeColor, strokeWidth }
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

    // Finalize Shape creation
    if (effectiveTool === 'shape' && draggingTarget?.type === 'shape-preview' && dragStartPoint && currentPointerPoint) {
      let startPt = dragStartPoint;
      let endPt = currentPointerPoint;
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 12) {
        const defaultRadius = 70;
        startPt = { x: dragStartPoint.x - defaultRadius, y: dragStartPoint.y - defaultRadius };
        endPt = { x: dragStartPoint.x + defaultRadius, y: dragStartPoint.y + defaultRadius };
      } else if (modifiers.shift) {
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        endPt = {
          x: startPt.x + Math.sign(dx || 1) * size,
          y: startPt.y + Math.sign(dy || 1) * size,
        };
      }

      const shapeOptions: ShapeOptions = {
        kind: shapeKind,
        sides: shapeSides,
        cornerRadius: 24,
      };

      const newShape = generateShapePath(
        startPt.x,
        startPt.y,
        endPt.x,
        endPt.y,
        shapeOptions,
        `shape-${Date.now()}`,
        { fill: fillColor, stroke: strokeColor, strokeWidth }
      );

      onAddPath(newShape);
      onSelectionChange({
        selectedPathIds: [newShape.id],
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
      onCommitHistory();
    }

    // Finalize Brush Stroke (Reliable commit with single-tap dot support)
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
      }
      brushStrokeRef.current = null;
      setActivePathInProgress(null);
    }

    if (
      draggingTarget &&
      draggingTarget.type !== 'pan' &&
      draggingTarget.type !== 'shape-preview' &&
      draggingTarget.type !== 'marquee'
    ) {
      onCommitHistory();
    }

    setDraggingTarget(null);
  };

  // Zoom with Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isPanZoomLocked) return;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(5, Math.max(0.2, view.zoom * zoomFactor));

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - view.panX) * (newZoom / view.zoom);
    const newPanY = mouseY - (mouseY - view.panY) * (newZoom / view.zoom);

    onViewChange({
      ...view,
      zoom: newZoom,
      panX: newPanX,
      panY: newPanY,
    });
  };

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

  // Render Grid
  const renderGrid = () => {
    if (!gridVisible) return null;
    return (
      <g className="canvas-grid pointer-events-none opacity-20">
        <defs>
          <pattern id="pentix-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#64748B" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width={view.width} height={view.height} fill="url(#pentix-grid)" />
      </g>
    );
  };

  // Paths list for anchors
  const pathsForAnchors = [
    ...allPaths,
    ...(activePathInProgress ? [activePathInProgress] : []),
  ];

  const getCanvasCursor = () => {
    if (effectiveTool === 'hand') return 'cursor-grab active:cursor-grabbing';
    if (effectiveTool === 'pen') return 'cursor-crosshair';
    if (effectiveTool === 'pressure-brush') return 'cursor-crosshair';
    if (effectiveTool === 'shape') return 'cursor-crosshair';
    if (effectiveTool === 'shape-builder') return 'cursor-crosshair';
    if (effectiveTool === 'direct-select') return 'cursor-default';
    return 'cursor-default';
  };

  const handleConfirmText = () => {
    if (!textInputModal) return;
    const phrase = textInputModal.text.trim();
    if (!phrase) {
      setTextInputModal(null);
      return;
    }

    const newPath: VectorPath = {
      id: `text-${Date.now()}`,
      name: `Text "${phrase.slice(0, 10)}"`,
      points: [
        { id: `p0-${Date.now()}`, x: textInputModal.point.x, y: textInputModal.point.y, type: 'corner' },
      ],
      closed: false,
      fill: fillColor && fillColor !== 'none' ? fillColor : '#00E5FF',
      fillOpacity: 1,
      stroke: 'none',
      strokeWidth: 0,
      strokeOpacity: 0,
      strokeCap: 'round',
      strokeJoin: 'round',
      pressureProfile: 'uniform',
      text: phrase,
      fontSize: 52,
      fontFamily: 'Impact, sans-serif',
      fontWeight: 'bold',
    };

    onAddPath(newPath);
    onSelectionChange({
      selectedPathIds: [newPath.id],
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });
    onCommitHistory();
    setTextInputModal(null);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative w-full h-full bg-[#070b14] overflow-hidden select-none touch-none"
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
            <line x1="0" y1="0" x2="0" y2="8" stroke="#00E5FF" strokeWidth="2.8" opacity="0.75" />
          </pattern>
          {/* Adobe Illustrator Shape Builder Diagonal Stipple Hatch for Erase (-) */}
          <pattern id="sb-stipple-erase" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#EF4444" strokeWidth="2.8" opacity="0.85" />
          </pattern>
          {/* Artboard Shadow */}
          <filter id="artboard-shadow" x="-5%" y="-5%" width="115%" height="115%">
            <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="#000000" floodOpacity="0.6" />
          </filter>
          {/* Artboard Content Clip */}
          <clipPath id="artboard-bounds-clip">
            <rect x="0" y="0" width={view.width} height={view.height} />
          </clipPath>
        </defs>

        <g transform={`translate(${view.panX}, ${view.panY}) scale(${view.zoom})`}>
          {/* Canvas Artboard Surface & Drop Shadow */}
          <rect
            x={0}
            y={0}
            width={view.width}
            height={view.height}
            fill="#0c1220"
            stroke="#334155"
            strokeWidth={1.5 / view.zoom}
            filter="url(#artboard-shadow)"
          />

          {/* Artboard Corner Registration Brackets */}
          <g className="artboard-corner-brackets pointer-events-none opacity-50">
            <path d="M -12 0 L 0 0 L 0 -12" stroke="#00E5FF" strokeWidth={1.5 / view.zoom} fill="none" />
            <path d={`M ${view.width + 12} 0 L ${view.width} 0 L ${view.width} -12`} stroke="#00E5FF" strokeWidth={1.5 / view.zoom} fill="none" />
            <path d={`M -12 ${view.height} L 0 ${view.height} L 0 ${view.height + 12}`} stroke="#00E5FF" strokeWidth={1.5 / view.zoom} fill="none" />
            <path d={`M ${view.width + 12} ${view.height} L ${view.width} ${view.height} L ${view.width} ${view.height + 12}`} stroke="#00E5FF" strokeWidth={1.5 / view.zoom} fill="none" />
          </g>

          {/* Artboard Header Badge */}
          <g className="artboard-header-badge pointer-events-none" transform={`translate(0, ${-22 / view.zoom})`}>
            <rect
              x={0}
              y={0}
              width={160 / view.zoom}
              height={18 / view.zoom}
              rx={4 / view.zoom}
              fill="#0F172A"
              stroke="#334155"
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
          <g clipPath={clipArtboardBounds ? 'url(#artboard-bounds-clip)' : undefined}>
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
                />
              );
            })}

            {layers.map((layer) => {
            if (!layer.visible) return null;

            return (
              <g key={layer.id} opacity={layer.opacity}>
                {layer.paths.map((path) => {
                  const isSelected = selection.selectedPathIds.includes(path.id);
                  const isShapeBuilder = tool === 'shape-builder';

                  // Vector Typography Path Rendering
                  if (path.text) {
                    const fontSize = path.fontSize || 48;
                    const fontFamily = path.fontFamily || 'Impact, sans-serif';
                    const fontWeight = path.fontWeight || 'bold';
                    const pt = path.points[0] || { x: 50, y: 50 };

                    return (
                      <g key={path.id}>
                        {/* Text Hitbox */}
                        <text
                          x={pt.x}
                          y={pt.y}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth={20 / view.zoom}
                          fontSize={fontSize}
                          fontFamily={fontFamily}
                          fontWeight={fontWeight}
                          className={effectiveTool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                          onPointerDown={(e) => {
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
                          {path.text}
                        </text>

                        {/* Visible Text */}
                        <text
                          x={pt.x}
                          y={pt.y}
                          fill={path.fill && path.fill !== 'none' ? path.fill : '#00E5FF'}
                          fillOpacity={path.fillOpacity ?? 1}
                          stroke={path.stroke !== 'none' ? path.stroke : undefined}
                          strokeWidth={path.strokeWidth}
                          fontSize={fontSize}
                          fontFamily={fontFamily}
                          fontWeight={fontWeight}
                          className="pointer-events-none select-none"
                        >
                          {path.text}
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
                        fill={path.stroke || '#00E5FF'}
                        opacity={path.strokeOpacity}
                        className={effectiveTool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                        onPointerDown={(e) => {
                          if (isShapeBuilder) {
                            handleShapeBuilderToggle(path, e);
                          } else if (effectiveTool === 'select') {
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

                  const pathD = pointsToSvgPath(path.points, path.closed);
                  if (!pathD) return null;

                  return (
                    <g key={path.id}>
                      {/* Generous touch hitbox */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(34, path.strokeWidth * 3) / view.zoom}
                        className={effectiveTool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                        onPointerDown={(e) => {
                          if (isShapeBuilder) {
                            handleShapeBuilderToggle(path, e);
                          } else if (effectiveTool === 'select') {
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

                      {/* Visible rendered path */}
                      <path
                        d={pathD}
                        fill={path.closed && path.fill !== 'none' ? path.fill : 'none'}
                        fillOpacity={path.fillOpacity}
                        stroke={path.stroke !== 'none' ? path.stroke : 'transparent'}
                        strokeWidth={path.strokeWidth}
                        strokeOpacity={path.strokeOpacity}
                        strokeLinecap={path.strokeCap}
                        strokeLinejoin={path.strokeJoin}
                        className={`pointer-events-none ${
                          isShapeBuilder && isSelected
                            ? 'stroke-cyan-400 stroke-[3] filter drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]'
                            : ''
                        }`}
                      />

                      {/* Selection Outline when not in transform mode */}
                      {isSelected && effectiveTool !== 'select' && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isShapeBuilder ? '#00E5FF' : '#38BDF8'}
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

          {/* Active Path in progress */}
          {activePathInProgress && (
            <g className="active-path-in-progress pointer-events-none">
              {activePathInProgress.pressureProfile !== 'uniform' ? (
                <path
                  d={generateVariableStrokePolygon(activePathInProgress.points, pressureConfig)}
                  fill={activePathInProgress.stroke}
                  opacity={activePathInProgress.strokeOpacity}
                />
              ) : (
                <>
                  <path
                    d={pointsToSvgPath(activePathInProgress.points, activePathInProgress.closed)}
                    fill={activePathInProgress.closed ? activePathInProgress.fill : 'none'}
                    stroke={activePathInProgress.stroke}
                    strokeWidth={activePathInProgress.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {effectiveTool === 'pen' && currentPointerPoint && activePathInProgress.points.length > 0 && (
                    <>
                      <line
                        x1={activePathInProgress.points[activePathInProgress.points.length - 1].x}
                        y1={activePathInProgress.points[activePathInProgress.points.length - 1].y}
                        x2={currentPointerPoint.x}
                        y2={currentPointerPoint.y}
                        stroke="#00E5FF"
                        strokeWidth={1.5 / view.zoom}
                        strokeDasharray="4 4"
                        className="opacity-70"
                      />
                      {activePathInProgress.points.length >= 2 &&
                        distance(currentPointerPoint, activePathInProgress.points[0]) < 28 / view.zoom && (
                          <g className="close-path-cue">
                            <circle
                              cx={activePathInProgress.points[0].x}
                              cy={activePathInProgress.points[0].y}
                              r={12 / view.zoom}
                              fill="rgba(0, 229, 255, 0.25)"
                              stroke="#00E5FF"
                              strokeWidth={2 / view.zoom}
                            />
                            <text
                              x={activePathInProgress.points[0].x + 16 / view.zoom}
                              y={activePathInProgress.points[0].y - 8 / view.zoom}
                              fill="#00E5FF"
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

          {/* ================= TRANSFORM BOUNDING BOX WITH 8 STRETCHING NODES ================= */}
          {effectiveTool === 'select' && selectedBBox && selectedPaths.length > 0 && (
            <g className="transform-bounding-box">
              {/* Outer Bounding Box Rectangle (drag to move all selected paths) */}
              <rect
                x={selectedBBox.minX}
                y={selectedBBox.minY}
                width={selectedBBox.width}
                height={selectedBBox.height}
                fill="rgba(0, 229, 255, 0.04)"
                stroke="#00E5FF"
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
                stroke="#00E5FF"
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
                stroke="#0F172A"
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
                    stroke="#00E5FF"
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
              fill="rgba(0, 229, 255, 0.15)"
              stroke="#00E5FF"
              strokeWidth={1.5 / view.zoom}
              strokeDasharray="4 4"
              className="pointer-events-none"
            />
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
                      fill={isActive ? (isErase ? 'rgba(239, 68, 68, 0.22)' : 'rgba(0, 229, 255, 0.22)') : 'rgba(255, 255, 255, 0.001)'}
                      stroke={isActive ? (isErase ? '#EF4444' : '#00E5FF') : 'transparent'}
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
                  stroke={modifiers.alt || sbMode === 'erase' ? '#EF4444' : '#00E5FF'}
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
                    fill={modifiers.alt || sbMode === 'erase' ? '#EF4444' : '#00E5FF'}
                    stroke="#0F172A"
                    strokeWidth={1.5 / view.zoom}
                  />
                  <text
                    x={0}
                    y={3.5 / view.zoom}
                    textAnchor="middle"
                    fill="#0F172A"
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

              if (!isSelected) return null;

              return (
                <g key={`anchors-${path.id}`}>
                  {path.points.map((pt, idx) => {
                    const isAnchorSelected = selection.selectedAnchorIndex === idx;

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
                              stroke="#00E5FF"
                              strokeWidth={1.5 / view.zoom}
                              className="pointer-events-none"
                            />
                            <circle
                              cx={pt.handleIn.x}
                              cy={pt.handleIn.y}
                              r={20 / view.zoom}
                              fill="transparent"
                              className="cursor-pointer"
                              onPointerDown={(e) => {
                                onSelectionChange({
                                  selectedPathIds: [path.id],
                                  selectedAnchorIndex: idx,
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
                            <circle
                              cx={pt.handleIn.x}
                              cy={pt.handleIn.y}
                              r={5 / view.zoom}
                              fill="#00E5FF"
                              stroke="#0f172a"
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
                              stroke="#00E5FF"
                              strokeWidth={1.5 / view.zoom}
                              className="pointer-events-none"
                            />
                            <circle
                              cx={pt.handleOut.x}
                              cy={pt.handleOut.y}
                              r={20 / view.zoom}
                              fill="transparent"
                              className="cursor-pointer"
                              onPointerDown={(e) => {
                                onSelectionChange({
                                  selectedPathIds: [path.id],
                                  selectedAnchorIndex: idx,
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
                            <circle
                              cx={pt.handleOut.x}
                              cy={pt.handleOut.y}
                              r={5 / view.zoom}
                              fill="#00E5FF"
                              stroke="#0f172a"
                              strokeWidth={1.5 / view.zoom}
                              className="pointer-events-none"
                            />
                          </g>
                        )}

                        {/* Anchor Hitbox */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={22 / view.zoom}
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
                                selectedHandleType: null,
                              });
                              onCommitHistory();
                              return;
                            }

                            // Alt + click OR clicking existing anchor with Pen tool when not creating: Delete Anchor Node!
                            if ((modifiers.alt || (effectiveTool === 'pen' && !activePathInProgress)) && path.points.length > 2) {
                              e.stopPropagation();
                              const newPoints = path.points.filter((_, i) => i !== idx);
                              onUpdatePath({ ...path, points: newPoints });
                              onSelectionChange({
                                selectedPathIds: [path.id],
                                selectedAnchorIndex: null,
                                selectedHandleType: null,
                              });
                              onCommitHistory();
                              return;
                            }

                            onSelectionChange({
                              selectedPathIds: [path.id],
                              selectedAnchorIndex: idx,
                              selectedHandleType: null,
                            });
                            startDragOperation(e, {
                              type: 'anchor',
                              pathId: path.id,
                              pointIndex: idx,
                              initialPoint: { x: pt.x, y: pt.y },
                            });
                          }}
                        />

                        {/* Anchor Node (Clean static square, NO pulsing animation) */}
                        <rect
                          x={pt.x - 5 / view.zoom}
                          y={pt.y - 5 / view.zoom}
                          width={10 / view.zoom}
                          height={10 / view.zoom}
                          fill={isAnchorSelected ? '#FFB800' : '#FFFFFF'}
                          stroke="#0F172A"
                          strokeWidth={2 / view.zoom}
                          className="pointer-events-none shadow-md"
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}

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
                  { fill: fillColor, stroke: strokeColor, strokeWidth }
                );

                return (
                  <path
                    d={pointsToSvgPath(previewShape.points, previewShape.closed)}
                    fill={previewShape.fill}
                    fillOpacity={0.4}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray="4 4"
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
                        stroke="#070B14"
                        strokeWidth={3 / view.zoom}
                        strokeOpacity={0.6}
                      />
                    ) : (
                      <line
                        x1={guide.start}
                        y1={guide.coordinate}
                        x2={guide.end}
                        y2={guide.coordinate}
                        stroke="#070B14"
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
                        stroke="#00E5FF"
                        strokeWidth={4 / view.zoom}
                        strokeOpacity={0.25}
                      />
                    ) : (
                      <line
                        x1={guide.start}
                        y1={guide.coordinate}
                        x2={guide.end}
                        y2={guide.coordinate}
                        stroke="#00E5FF"
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
                        stroke="#00E5FF"
                        strokeWidth={1 / view.zoom}
                        strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
                      />
                    ) : (
                      <line
                        x1={guide.start}
                        y1={guide.coordinate}
                        x2={guide.end}
                        y2={guide.coordinate}
                        stroke="#00E5FF"
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
                        stroke="#00E5FF"
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
                          stroke="#00E5FF"
                          strokeWidth={1.5 / view.zoom}
                        />
                        <line
                          x1={guide.coordinate - 4 / view.zoom}
                          y1={guide.end}
                          x2={guide.coordinate + 4 / view.zoom}
                          y2={guide.end}
                          stroke="#00E5FF"
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
                          stroke="#00E5FF"
                          strokeWidth={1.5 / view.zoom}
                        />
                        <line
                          x1={guide.end}
                          y1={guide.coordinate - 4 / view.zoom}
                          x2={guide.end}
                          y2={guide.coordinate + 4 / view.zoom}
                          stroke="#00E5FF"
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
                            fill="#0F172A"
                            stroke="#00E5FF"
                            strokeWidth={1 / view.zoom}
                            opacity={0.92}
                          />
                          <text
                            x={0}
                            y={3.5 / view.zoom}
                            fill="#00E5FF"
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

      {/* Floating Canvas Badges & HUD */}
      {/* Shape Builder Mode HUD (Merge / Erase) for Mobile & Desktop parity */}
      {tool === 'shape-builder' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center p-1 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-full shadow-2xl">
            <button
              type="button"
              onClick={() => setSbMode('merge')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                sbMode === 'merge' && !modifiers.alt
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="font-mono text-sm leading-none font-bold">+</span>
              <span>Merge</span>
            </button>

            <button
              type="button"
              onClick={() => setSbMode('erase')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                sbMode === 'erase' || modifiers.alt
                  ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30'
                  : 'text-slate-300 hover:text-red-400 hover:bg-slate-800'
              }`}
            >
              <span className="font-mono text-sm leading-none font-bold">−</span>
              <span>Erase (Alt)</span>
            </button>
          </div>

          <span className="text-[10px] text-cyan-300/80 font-mono tracking-tight bg-slate-950/80 px-2.5 py-0.5 rounded-md border border-slate-800 shadow-sm">
            {atomicRegions.length > 0
              ? `Drag across to merge • Tap in erase to delete (${atomicRegions.length} regions)`
              : 'Draw or select 2+ overlapping shapes to build'}
          </span>
        </div>
      )}

      {isPanZoomLocked && (
        <button
          type="button"
          onClick={onToggleLockPanZoom}
          className="hidden sm:flex absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded-full shadow-xl items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
          title="Click to Unlock Canvas Pan & Zoom"
        >
          <Lock size={12} />
          <span>View Locked &bull; Tap to Unlock</span>
        </button>
      )}

      {onToggleSmartGuides && (
        <button
          type="button"
          onClick={onToggleSmartGuides}
          className={`hidden sm:flex absolute top-3 ${onOpenLayers ? 'right-28' : 'right-3'} z-20 px-2.5 py-1.5 rounded-xl backdrop-blur-md border shadow-xl items-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
            smartGuidesEnabled
              ? 'bg-slate-900/90 border-cyan-500/50 text-cyan-300 hover:text-white hover:bg-slate-800'
              : 'bg-slate-900/70 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={smartGuidesEnabled ? 'Smart Guides: Active (Tap to Disable)' : 'Smart Guides: Disabled (Tap to Enable)'}
        >
          <Magnet size={13} className={smartGuidesEnabled ? 'text-cyan-400' : 'text-slate-500'} />
          <span className="hidden sm:inline">Guides</span>
          <span className={`w-2 h-2 rounded-full ${smartGuidesEnabled ? 'bg-cyan-400 shadow-[0_0_6px_#00E5FF]' : 'bg-slate-600'}`} />
        </button>
      )}

      {onOpenLayers && (
        <button
          type="button"
          onClick={onOpenLayers}
          className="hidden sm:flex absolute top-3 right-3 z-20 px-2.5 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 text-cyan-300 hover:text-white hover:bg-slate-800 shadow-xl items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
          title="Show Layers Panel"
        >
          <LayersIcon size={14} className="text-cyan-400" />
          <span>Layers</span>
          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center text-[10px] font-mono font-bold">
            {layers.length}
          </span>
        </button>
      )}

      {/* Artboard Bounds Clipping Toggle */}
      <button
        type="button"
        onClick={() => setClipArtboardBounds(!clipArtboardBounds)}
        className={`hidden sm:flex absolute top-3 ${onToggleSmartGuides ? (onOpenLayers ? 'right-52' : 'right-28') : 'right-3'} z-20 px-2.5 py-1.5 rounded-xl backdrop-blur-md border shadow-xl items-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
          clipArtboardBounds
            ? 'bg-slate-900/90 border-cyan-500/50 text-cyan-300 hover:text-white hover:bg-slate-800'
            : 'bg-slate-900/70 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title={clipArtboardBounds ? 'Artboard Bounds: Clipped (Click to show overflow)' : 'Artboard Bounds: Infinite (Click to clip to artboard)'}
      >
        <span>Bounds: {clipArtboardBounds ? 'Clip' : 'Full'}</span>
      </button>

      {/* Vector Typography Modal */}
      {textInputModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl w-full max-w-sm flex flex-col gap-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Vector Typography</span>
              <button
                type="button"
                onClick={() => setTextInputModal(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded-md hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 font-medium block mb-1">Enter Text Phrase</label>
              <input
                type="text"
                autoFocus
                value={textInputModal.text}
                onChange={(e) => setTextInputModal({ ...textInputModal, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmText();
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:border-cyan-500 focus:outline-none"
                placeholder="e.g. BRAND LOGO"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTextInputModal(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmText}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/30 hover:from-cyan-400 hover:to-blue-500 active:scale-95 transition-transform"
              >
                Create Vector Text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
