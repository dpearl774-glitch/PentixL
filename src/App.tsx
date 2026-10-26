import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';

import { TopBar } from './components/TopBar';
import { ToolDock } from './components/ToolDock';
import { ToolOptions } from './components/ToolOptions';
import { ThumbZone } from './components/ThumbZone';
import { Canvas } from './components/Canvas';
import { AppMenu } from './components/AppMenu';
import { LayersSheet } from './components/LayersSheet';
import { ColorSheet } from './components/ColorSheet';
import { ShapeSheet } from './components/ShapeSheet';
import { ProjectsSheet } from './components/ProjectsSheet';
import { ExportSheet } from './components/ExportSheet';
import { PressureSheet } from './components/PressureSheet';
import { FontsSheet } from './components/FontsSheet';
import { TextSheet } from './components/TextSheet';
import { TraceSheet } from './components/TraceSheet';
import { HelpSheet } from './components/HelpSheet';
import { StartSheet } from './components/StartSheet';
import { CanvasSettingsSheet } from './components/CanvasSettingsSheet';
import { Toast } from './components/ui/primitives';

import {
  CanvasView,
  GradientDef,
  Guide,
  Layer,
  ModifierState,
  Point,
  PressureConfig,
  ReferenceImage,
  SelectionState,
  ShapeKind,
  StrokeCap,
  StrokeJoin,
  ToolType,
  VectorPath,
} from './types/vector';
import { expandTextToVectorPaths } from './utils/contourTracer';
import { LOGO_TEMPLATES, LogoTemplate } from './data/templates';
import { roundPathCorners, toggleAnchorType } from './utils/bezier';
import { BooleanOperation, executeBooleanOperation } from './utils/shapeBuilder';
import { flipPaths } from './utils/transform';
import { StoredProject, saveProject, seedInitialProjectsIfEmpty } from './utils/projectStorage';
import { generateProjectThumbnailSvg } from './utils/thumbnailGenerator';
import { referenceImageFromFile, referenceImageFromSrc } from './utils/referenceImages';
import { defaultGradient } from './utils/gradients';
import { gradientIdFor, generateSvgCode } from './utils/svgExport';
import { CANVAS, haptic } from './theme';

type SheetName =
  | 'menu'
  | 'projects'
  | 'export'
  | 'color'
  | 'shapes'
  | 'layers'
  | 'pressure'
  | 'fonts'
  | 'text'
  | 'trace'
  | 'help'
  | 'canvas'
  | 'start';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const INITIAL_TEMPLATE = LOGO_TEMPLATES[0];
const INITIAL_LAYERS: Layer[] = clone(INITIAL_TEMPLATE.layers);
const HISTORY_LIMIT = 80;

const DEFAULT_PRESSURE: PressureConfig = {
  source: 'stylus-or-touch',
  minWidth: 2,
  maxWidth: 24,
  smoothing: 0.7,
  calligraphyAngle: 30,
};

const emptySelection: SelectionState = {
  selectedPathIds: [],
  selectedAnchorIndex: null,
  selectedHandleType: null,
};

export default function App() {
  /* ------------------------------------------------------------------ *
   * Document
   * ------------------------------------------------------------------ */
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
  const layersRef = useRef<Layer[]>(layers);
  /** Mirrors the guides so every history entry can snapshot them too */
  const guidesRef = useRef<Guide[]>([]);

  const [activeLayerId, setActiveLayerId] = useState<string>(INITIAL_LAYERS[0]?.id ?? 'layer-1');
  const [selection, setSelection] = useState<SelectionState>({ ...emptySelection });
  // Declared early because undo() unwinds an uncommitted stroke node by node
  const [activePathInProgress, setActivePathInProgress] = useState<VectorPath | null>(null);

  const [projectId, setProjectId] = useState(`template-${INITIAL_TEMPLATE.id}`);
  const [projectName, setProjectName] = useState(INITIAL_TEMPLATE.name);
  const [isSaved, setIsSaved] = useState(true);

  /* ------------------------------------------------------------------ *
   * History — ref based so commits made in the same tick stay correct.
   * Each entry snapshots the layers AND the guides, so one undo walks back
   * through artwork edits and guide edits alike.
   * ------------------------------------------------------------------ */
  type HistoryEntry = { layers: Layer[]; guides: Guide[] };
  const historyRef = useRef<{ stack: HistoryEntry[]; index: number }>({
    stack: [{ layers: clone(INITIAL_LAYERS), guides: [] }],
    index: 0,
  });
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });

  const syncHistoryFlags = useCallback(() => {
    const h = historyRef.current;
    setHistoryFlags({ canUndo: h.index > 0, canRedo: h.index < h.stack.length - 1 });
  }, []);

  const pushHistory = useCallback(
    (snapshot: Layer[]) => {
      const h = historyRef.current;
      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push({ layers: clone(snapshot), guides: clone(guidesRef.current) });
      if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
      h.index = h.stack.length - 1;
      syncHistoryFlags();
    },
    [syncHistoryFlags]
  );

  const pruneSelection = useCallback((nextLayers: Layer[]) => {
    const ids = new Set(nextLayers.flatMap((l) => l.paths.map((p) => p.id)));
    setSelection((prev) => {
      const kept = prev.selectedPathIds.filter((id) => ids.has(id));
      if (kept.length === prev.selectedPathIds.length) return prev;
      return { selectedPathIds: kept, selectedAnchorIndex: null, selectedHandleType: null };
    });
  }, []);

  /** Single funnel for every document mutation. */
  const applyLayers = useCallback(
    (
      next: Layer[] | ((prev: Layer[]) => Layer[]),
      options: { commit?: boolean; dirty?: boolean } = {}
    ) => {
      const { commit = true, dirty = true } = options;
      const prev = layersRef.current;
      const value = typeof next === 'function' ? (next as (p: Layer[]) => Layer[])(prev) : next;
      if (value === prev) return;
      layersRef.current = value;
      setLayers(value);
      if (dirty) setIsSaved(false);
      if (commit) pushHistory(value);
    },
    [pushHistory]
  );

  const commitHistory = useCallback(() => {
    pushHistory(layersRef.current);
    setIsSaved(false);
  }, [pushHistory]);

  const undo = useCallback(() => {
    // While a path is being drawn, undo removes the last node first
    if (activePathInProgress && activePathInProgress.points.length > 0) {
      setActivePathInProgress((current) => {
        if (!current) return null;
        if (current.points.length <= 1) return null;
        return { ...current, points: current.points.slice(0, -1) };
      });
      return;
    }

    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    const snapshot = clone(h.stack[h.index]);
    layersRef.current = snapshot.layers;
    setLayers(snapshot.layers);
    guidesRef.current = snapshot.guides;
    setGuides(snapshot.guides);
    setIsSaved(false);
    syncHistoryFlags();
    pruneSelection(snapshot.layers);
  }, [activePathInProgress, pruneSelection, syncHistoryFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    const snapshot = clone(h.stack[h.index]);
    layersRef.current = snapshot.layers;
    setLayers(snapshot.layers);
    guidesRef.current = snapshot.guides;
    setGuides(snapshot.guides);
    setIsSaved(false);
    syncHistoryFlags();
    pruneSelection(snapshot.layers);
  }, [pruneSelection, syncHistoryFlags]);

  /* ------------------------------------------------------------------ *
   * Tools, modifiers, style defaults
   * ------------------------------------------------------------------ */
  const [tool, setTool] = useState<ToolType>('select');
  /** Tool the space bar momentarily replaced, so a held space can hand it back */
  const toolBeforePan = useRef<ToolType | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('circle');
  const [shapeSides, setShapeSides] = useState(6);
  const [sbMode, setSbMode] = useState<'merge' | 'erase'>('merge');
  const [modifiers, setModifiers] = useState<ModifierState>({ shift: false, ctrl: false, alt: false });

  const [fillColor, setFillColor] = useState('#cdff5c');
  const [strokeColor, setStrokeColor] = useState('#e8eaed');
  const [fillOpacity, setFillOpacity] = useState(1);
  const [strokeOpacity, setStrokeOpacity] = useState(1);
  /** Fill paint style for the next object, and the gradient editor's source */
  const [fillType, setFillType] = useState<'solid' | 'gradient'>('solid');
  const [fillGradient, setFillGradient] = useState<GradientDef>(() =>
    defaultGradient('#cdff5c', '#5ce1c5')
  );
  /** Gradient stop the colour panel is editing (shared with the eyedropper) */
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  /** Eyedropper armed — the next canvas tap samples colour into this target */
  const [samplingTarget, setSamplingTarget] = useState<
    'fill' | 'stroke' | 'stop' | 'background' | null
  >(null);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeCap, setStrokeCap] = useState<StrokeCap>('round');
  const [strokeJoin, setStrokeJoin] = useState<StrokeJoin>('round');
  const [pressureConfig, setPressureConfig] = useState<PressureConfig>(DEFAULT_PRESSURE);

  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [selectedFontFamily, setSelectedFontFamily] = useState('Plus Jakarta Sans, sans-serif');
  const fontFacesRef = useRef<Map<string, FontFace>>(new Map());

  /* ------------------------------------------------------------------ *
   * Canvas view
   * ------------------------------------------------------------------ */
  const [view, setView] = useState<CanvasView>({ zoom: 1, panX: 0, panY: 0, width: 600, height: 600 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [gridVisible, setGridVisible] = useState(true);
  const [gridSnap, setGridSnap] = useState(false);
  const [gridSpacingX, setGridSpacingX] = useState(25);
  const [gridSpacingY, setGridSpacingY] = useState(25);
  const [gridOpacity, setGridOpacity] = useState(0.4);
  /** One global lock for the whole grid system: freezes spacing + appearance */
  const [gridLocked, setGridLocked] = useState(false);
  const [rulersVisible, setRulersVisible] = useState(true);
  const [guides, setGuides] = useState<Guide[]>([]);
  guidesRef.current = guides;
  const [artboardColor, setArtboardColor] = useState<string>(CANVAS.artboard);
  const [smartGuides, setSmartGuides] = useState(true);
  const [panZoomLocked, setPanZoomLocked] = useState(false);
  const [clipArtboard, setClipArtboard] = useState(false);

  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const fitArtboard = useCallback(() => {
    const rect = canvasWrapRef.current?.getBoundingClientRect();
    const w = rect?.width ?? window.innerWidth;
    const h = rect?.height ?? window.innerHeight;
    const { width: aw, height: ah } = viewRef.current;
    // Keep a small gutter so the artboard never hides under the thumb rails.
    const sideGutter = w < 640 ? 64 : 180;
    const verticalGutter = 28;
    const scale = Math.min(
      2.2,
      Math.max(0.2, Math.min((w - sideGutter) / aw, (h - verticalGutter) / ah))
    );
    setView((prev) => ({
      ...prev,
      zoom: scale,
      panX: (w - aw * scale) / 2,
      // Bias slightly upward so the lower corners stay free for thumb controls
      panY: Math.max(8, (h - ah * scale) / 2 - 18),
    }));
  }, []);

  useEffect(() => {
    fitArtboard();
    const onResize = () => fitArtboard();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [fitArtboard]);

  /* ------------------------------------------------------------------ *
   * Sheets & transient UI
   * ------------------------------------------------------------------ */
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const [colorMode, setColorMode] = useState<'fill' | 'stroke' | 'background'>('fill');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const [traceSrc, setTraceSrc] = useState<string | null>(null);
  const [textOrigin, setTextOrigin] = useState<Point | null>(null);
  const [textEditId, setTextEditId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<VectorPath[]>([]);

  /* ------------------------------------------------------------------ *
   * Derived selection data
   * ------------------------------------------------------------------ */
  const allPaths = useMemo(() => layers.flatMap((l) => l.paths), [layers]);
  const selectedPaths = useMemo(
    () => allPaths.filter((p) => selection.selectedPathIds.includes(p.id)),
    [allPaths, selection.selectedPathIds]
  );
  const hasTextSelected = selectedPaths.some((p) => !!p.text);
  const editingTextPath = selectedPaths.find((p) => !!p.text) ?? null;

  // Reflect the selected object's style in the swatches (on selection change only).
  useEffect(() => {
    if (selectedPaths.length === 0) return;
    const first = selectedPaths[0];
    setFillColor(first.fill);
    setStrokeColor(first.stroke);
    setFillOpacity(first.fillOpacity ?? 1);
    setStrokeOpacity(first.strokeOpacity ?? 1);
    if (first.strokeWidth > 0) setStrokeWidth(first.strokeWidth);
    if (first.fontFamily) setSelectedFontFamily(first.fontFamily);
    if (first.fillGradient && first.fillGradient.stops.length >= 1) {
      setFillType('gradient');
      setFillGradient(first.fillGradient);
    } else {
      setFillType('solid');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.selectedPathIds.join('|')]);

  /* ------------------------------------------------------------------ *
   * Path factories
   * ------------------------------------------------------------------ */
  const addPath = useCallback(
    (path: VectorPath) => {
      applyLayers(
        (prev) =>
          prev.map((l) =>
            l.id === activeLayerId ? { ...l, paths: [...l.paths, path] } : l
          ),
        { commit: false }
      );
    },
    [activeLayerId, applyLayers]
  );

  const updatePath = useCallback(
    (path: VectorPath) => {
      applyLayers(
        (prev) =>
          prev.map((l) => ({
            ...l,
            paths: l.paths.map((p) => (p.id === path.id ? path : p)),
          })),
        { commit: false }
      );
    },
    [applyLayers]
  );

  const patchSelection = useCallback(
    (patch: Partial<VectorPath>, commit = true) => {
      const ids = selection.selectedPathIds;
      if (ids.length === 0) return;
      applyLayers(
        (prev) =>
          prev.map((l) => ({
            ...l,
            paths: l.paths.map((p) => (ids.includes(p.id) ? { ...p, ...patch } : p)),
          })),
        { commit }
      );
    },
    [applyLayers, selection.selectedPathIds]
  );

  // Continuous controls (sliders, nudge pad) update live and commit once they settle.
  const pendingCommit = useRef<number | null>(null);
  const commitSoon = useCallback(() => {
    if (pendingCommit.current) window.clearTimeout(pendingCommit.current);
    pendingCommit.current = window.setTimeout(() => {
      commitHistory();
      pendingCommit.current = null;
    }, 420);
  }, [commitHistory]);

  const patchSelectionSoon = useCallback(
    (patch: Partial<VectorPath>) => {
      patchSelection(patch, false);
      commitSoon();
    },
    [commitSoon, patchSelection]
  );

  const deleteSelection = useCallback(() => {
    const ids = selection.selectedPathIds;
    if (ids.length === 0) return;

    if (selection.selectedAnchorIndex !== null) {
      const path = allPaths.find((p) => p.id === ids[0]);
      const idx = selection.selectedAnchorIndex;
      if (path && path.points[idx]) {
        if (path.points.length <= 2) {
          applyLayers((prev) =>
            prev.map((l) => ({ ...l, paths: l.paths.filter((p) => p.id !== path.id) }))
          );
          setSelection({ ...emptySelection });
        } else {
          const points = path.points.filter((_, i) => i !== idx);
          applyLayers((prev) =>
            prev.map((l) => ({
              ...l,
              paths: l.paths.map((p) => (p.id === path.id ? { ...p, points } : p)),
            }))
          );
          setSelection((prev) => ({ ...prev, selectedAnchorIndex: null }));
        }
        haptic(16);
        return;
      }
    }

    applyLayers((prev) =>
      prev.map((l) => ({ ...l, paths: l.paths.filter((p) => !ids.includes(p.id)) }))
    );
    setSelection({ ...emptySelection });
    haptic(16);
  }, [allPaths, applyLayers, selection]);

  const duplicateSelection = useCallback(() => {
    const ids = selection.selectedPathIds;
    if (ids.length === 0) return;
    const copies = allPaths
      .filter((p) => ids.includes(p.id))
      .map((p, i) => {
        const copy = clone(p);
        return {
          ...copy,
          id: `copy-${Date.now()}-${i}`,
          name: `${p.name} copy`,
          points: copy.points.map((pt) => ({
            ...pt,
            x: pt.x + 24,
            y: pt.y + 24,
            handleIn: pt.handleIn ? { x: pt.handleIn.x + 24, y: pt.handleIn.y + 24 } : undefined,
            handleOut: pt.handleOut ? { x: pt.handleOut.x + 24, y: pt.handleOut.y + 24 } : undefined,
          })),
        } as VectorPath;
      });
    if (!copies.length) return;
    applyLayers((prev) =>
      prev.map((l) =>
        l.id === activeLayerId ? { ...l, paths: [...l.paths, ...copies] } : l
      )
    );
    setSelection({ selectedPathIds: copies.map((c) => c.id), selectedAnchorIndex: null, selectedHandleType: null });
    notify(`Duplicated ${copies.length} object${copies.length > 1 ? 's' : ''}`);
  }, [activeLayerId, allPaths, applyLayers, notify, selection.selectedPathIds]);

  const copySelection = useCallback(() => {
    if (!selectedPaths.length) return;
    setClipboard(clone(selectedPaths));
    notify(`Copied ${selectedPaths.length} object${selectedPaths.length > 1 ? 's' : ''}`);
  }, [notify, selectedPaths]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard.length) return;
    const pasted = clipboard.map((p, i) => {
      const copy = clone(p);
      return {
        ...copy,
        id: `paste-${Date.now()}-${i}`,
        name: `${p.name} copy`,
        points: copy.points.map((pt) => ({
          ...pt,
          id: `${pt.id}-p-${i}`,
          x: pt.x + 28,
          y: pt.y + 28,
          handleIn: pt.handleIn ? { x: pt.handleIn.x + 28, y: pt.handleIn.y + 28 } : undefined,
          handleOut: pt.handleOut ? { x: pt.handleOut.x + 28, y: pt.handleOut.y + 28 } : undefined,
        })),
      } as VectorPath;
    });
    applyLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, paths: [...l.paths, ...pasted] } : l))
    );
    setSelection({ selectedPathIds: pasted.map((p) => p.id), selectedAnchorIndex: null, selectedHandleType: null });
  }, [activeLayerId, applyLayers, clipboard]);

  const flipSelection = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (!selectedPaths.length) return;
      let sx = 0;
      let sy = 0;
      let n = 0;
      selectedPaths.forEach((p) =>
        p.points.forEach((pt) => {
          sx += pt.x;
          sy += pt.y;
          n += 1;
        })
      );
      if (!n) return;
      const center = { x: sx / n, y: sy / n };
      const flipped = flipPaths(selectedPaths, center, direction);
      applyLayers((prev) =>
        prev.map((l) => ({
          ...l,
          paths: l.paths.map((p) => flipped.find((f) => f.id === p.id) ?? p),
        }))
      );
    },
    [applyLayers, selectedPaths]
  );

  const runBoolean = useCallback(
    (op: BooleanOperation) => {
      if (selectedPaths.length < 2) return;
      const result = executeBooleanOperation(selectedPaths, op);
      if (!result.length) return;
      const ids = selectedPaths.map((p) => p.id);
      applyLayers((prev) =>
        prev.map((l, index) => {
          const preserved = l.paths.filter((p) => !ids.includes(p.id));
          const isTarget = l.id === activeLayerId || (index === prev.length - 1 && !prev.some((x) => x.id === activeLayerId));
          return isTarget ? { ...l, paths: [...preserved, ...result] } : { ...l, paths: preserved };
        })
      );
      setSelection({ selectedPathIds: result.map((p) => p.id), selectedAnchorIndex: null, selectedHandleType: null });
      notify(`${op[0].toUpperCase()}${op.slice(1)} applied`);
    },
    [activeLayerId, applyLayers, notify, selectedPaths]
  );

  const replacePaths = useCallback(
    (removeIds: string[], newPaths: VectorPath[]) => {
      applyLayers((prev) =>
        prev.map((l) => {
          const preserved = l.paths.filter((p) => !removeIds.includes(p.id));
          return l.id === activeLayerId ? { ...l, paths: [...preserved, ...newPaths] } : { ...l, paths: preserved };
        })
      );
      setSelection({ selectedPathIds: newPaths.map((p) => p.id), selectedAnchorIndex: null, selectedHandleType: null });
    },
    [activeLayerId, applyLayers]
  );

  const togglePointType = useCallback(() => {
    const path = selectedPaths[0];
    if (!path) return;
    const idx = selection.selectedAnchorIndex ?? 0;
    const point = path.points[idx];
    if (!point) return;
    const points = [...path.points];
    points[idx] = toggleAnchorType(point);
    applyLayers((prev) =>
      prev.map((l) => ({
        ...l,
        paths: l.paths.map((p) => (p.id === path.id ? { ...p, points } : p)),
      }))
    );
  }, [applyLayers, selectedPaths, selection.selectedAnchorIndex]);

  const toggleClosePath = useCallback(() => {
    if (activePathInProgress) {
      if (activePathInProgress.points.length >= 2) {
        addPath({ ...activePathInProgress, closed: true });
        setActivePathInProgress(null);
        commitHistory();
      }
      return;
    }
    const path = selectedPaths[0];
    if (!path) return;
    applyLayers((prev) =>
      prev.map((l) => ({
        ...l,
        paths: l.paths.map((p) => (p.id === path.id ? { ...p, closed: !p.closed } : p)),
      }))
    );
  }, [activePathInProgress, addPath, applyLayers, commitHistory, selectedPaths]);

  const roundCorners = useCallback(
    (radius: number) => {
      if (!selectedPaths.length) return;
      const ids = selection.selectedPathIds;
      applyLayers((prev) =>
        prev.map((l) => ({
          ...l,
          paths: l.paths.map((p) => (ids.includes(p.id) ? roundPathCorners(p, radius) : p)),
        }))
      );
    },
    [applyLayers, selectedPaths.length, selection.selectedPathIds]
  );

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!selection.selectedPathIds.length) return;
      const ids = selection.selectedPathIds;
      const anchor = selection.selectedAnchorIndex;
      applyLayers(
        (prev) =>
          prev.map((l) => ({
            ...l,
            paths: l.paths.map((p) => {
              if (!ids.includes(p.id)) return p;
              if (anchor !== null && p.id === ids[0]) {
                const points = [...p.points];
                const pt = points[anchor];
                if (!pt) return p;
                points[anchor] = {
                  ...pt,
                  x: pt.x + dx,
                  y: pt.y + dy,
                  handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
                  handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
                };
                return { ...p, points };
              }
              return {
                ...p,
                points: p.points.map((pt) => ({
                  ...pt,
                  x: pt.x + dx,
                  y: pt.y + dy,
                  handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
                  handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
                })),
              };
            }),
          })),
        { commit: false }
      );
      // Rapid taps collapse into one history step instead of one per tap
      commitSoon();
    },
    [applyLayers, commitSoon, selection.selectedAnchorIndex, selection.selectedPathIds]
  );

  const finishPath = useCallback(() => {
    if (!activePathInProgress) return;
    if (activePathInProgress.points.length >= 2) {
      addPath(activePathInProgress);
      setSelection({
        selectedPathIds: [activePathInProgress.id],
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
      commitHistory();
    }
    setActivePathInProgress(null);
  }, [activePathInProgress, addPath, commitHistory]);

  const cancelPath = useCallback(() => {
    setActivePathInProgress(null);
    haptic(12);
  }, []);

  const changeTool = useCallback(
    (next: ToolType) => {
      if (activePathInProgress && activePathInProgress.points.length >= 2) {
        addPath(activePathInProgress);
        commitHistory();
        setActivePathInProgress(null);
      } else if (activePathInProgress) {
        setActivePathInProgress(null);
      }
      setTool(next);
      // A picked node belongs to direct select; leaving it clears the anchor
      if (next !== 'direct-select') {
        setSelection((prev) =>
          prev.selectedAnchorIndex === null && prev.selectedHandleType === null
            ? prev
            : { ...prev, selectedAnchorIndex: null, selectedHandleType: null }
        );
      }
      haptic(8);
    },
    [activePathInProgress, addPath, commitHistory]
  );

  /** Arms a shape tool without creating anything — the object appears only
   *  once the user drags its size out on the canvas. */
  const quickShape = useCallback(
    (kind: ShapeKind) => {
      setShapeKind(kind);
      changeTool('shape');
      setSheet(null);
    },
    [changeTool]
  );

  /* ------------------------------------------------------------------ *
   * Canvas settings: size, grid, rulers, guides, background
   * ------------------------------------------------------------------ */
  const resizeCanvas = useCallback(
    (width: number, height: number) => {
      setView((prev) => ({ ...prev, width, height }));
      setIsSaved(false);
      window.setTimeout(fitArtboard, 0);
      notify(`Artboard set to ${width} × ${height} px`);
    },
    [fitArtboard, notify]
  );

  /** Every committed guide change becomes one undo step. */
  const commitGuides = useCallback(
    (next: Guide[]) => {
      guidesRef.current = next;
      setGuides(next);
      pushHistory(layersRef.current);
      haptic(8);
    },
    [pushHistory]
  );

  const addGuide = useCallback(
    (axis: 'h' | 'v', position: number) => {
      commitGuides([
        ...guidesRef.current,
        { id: `guide-${Date.now()}-${guidesRef.current.length}`, axis, position, locked: false },
      ]);
    },
    [commitGuides]
  );

  /** Settings-panel edits (lock/unlock) — one history step each. */
  const updateGuide = useCallback(
    (id: string, patch: Partial<Guide>) => {
      commitGuides(
        guidesRef.current.map((g) => (g.id === id ? { ...g, ...patch } : g))
      );
    },
    [commitGuides]
  );

  /** Live repositioning during a drag — history is pushed once on release. */
  const moveGuideLive = useCallback((id: string, position: number) => {
    const next = guidesRef.current.map((g) => (g.id === id ? { ...g, position } : g));
    guidesRef.current = next;
    setGuides(next);
  }, []);

  const finishGuideDrag = useCallback(() => {
    pushHistory(layersRef.current);
  }, [pushHistory]);

  const removeGuide = useCallback(
    (id: string) => {
      commitGuides(guidesRef.current.filter((g) => g.id !== id));
    },
    [commitGuides]
  );

  /* ------------------------------------------------------------------ *
   * Eyedropper — rasterises the layer tree exactly as it composites on
   * screen, so overlapping objects and transparency resolve correctly.
   * ------------------------------------------------------------------ */
  const applySampled = useCallback(
    (hex: string) => {
      const target = samplingTarget;
      setSamplingTarget(null);
      if (target === 'background') {
        setArtboardColor(hex);
      } else if (target === 'stop') {
        setFillGradient((prev) => {
          const stops = [...prev.stops].sort((a, b) => a.offset - b.offset);
          const idx = Math.max(0, Math.min(stops.length - 1, activeStopIndex));
          stops[idx] = { ...stops[idx], color: hex };
          return { ...prev, stops };
        });
      } else if (target === 'stroke') {
        setStrokeColor(hex);
        patchSelection({ stroke: hex });
      } else {
        setFillColor(hex);
        patchSelection({ fill: hex });
      }
      setSheet('color');
      notify(`Sampled ${hex}`);
      haptic(10);
    },
    [activeStopIndex, notify, patchSelection, samplingTarget]
  );

  const sampleColorAt = useCallback(
    (point: Point) => {
      const { width, height } = viewRef.current;
      if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
        setSamplingTarget(null);
        notify('Pick a colour inside the artboard');
        return;
      }
      const svg = generateSvgCode(
        layersRef.current,
        { width, height, includeBackground: true, backgroundColor: artboardColor },
        pressureConfig
      );
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('no context');
          ctx.drawImage(img, 0, 0, width, height);
          const data = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
          const hex = `#${[data[0], data[1], data[2]]
            .map((n) => n.toString(16).padStart(2, '0'))
            .join('')}`.toUpperCase();
          applySampled(hex);
        } catch {
          setSamplingTarget(null);
          notify('Could not read that colour');
        }
      };
      img.onerror = () => {
        setSamplingTarget(null);
        notify('Could not read that colour');
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },
    [applySampled, artboardColor, notify, pressureConfig]
  );

  const startSampling = useCallback(
    (target: 'fill' | 'stroke' | 'stop' | 'background') => {
      setSamplingTarget(target);
      setSheet(null);
      notify('Tap the artwork to sample a colour');
    },
    [notify]
  );

  /* ------------------------------------------------------------------ *
   * Text
   * ------------------------------------------------------------------ */
  const openTextSheet = useCallback(
    (options?: { path?: VectorPath | null; origin?: Point | null }) => {
      const path = options?.path ?? null;
      setTextOrigin(options?.origin ?? null);
      // Placing at a tapped point always creates a new object
      setTextEditId(options?.origin ? null : (path?.id ?? null));
      if (path?.fontFamily) setSelectedFontFamily(path.fontFamily);
      setSheet('text');
    },
    []
  );

  const textEditPath = useMemo(
    () => (textEditId ? allPaths.find((p) => p.id === textEditId) ?? null : null),
    [allPaths, textEditId]
  );

  const saveText = useCallback(
    (data: {
      text: string;
      fontFamily: string;
      fontSize: number;
      fillColor: string;
      editingPathId: string | null;
    }) => {
      setSelectedFontFamily(data.fontFamily);
      if (data.editingPathId) {
        applyLayers((prev) =>
          prev.map((l) => ({
            ...l,
            paths: l.paths.map((p) =>
              p.id === data.editingPathId
                ? {
                    ...p,
                    text: data.text,
                    fontFamily: data.fontFamily,
                    fontSize: data.fontSize,
                    fill: data.fillColor,
                    name: `Text “${data.text.slice(0, 14)}”`,
                  }
                : p
            ),
          }))
        );
        notify('Text updated');
        return;
      }

      const { width: aw, height: ah } = viewRef.current;
      const origin = textOrigin ?? { x: aw / 2, y: ah / 2 };
      const fontSize = data.fontSize;
      const textPath: VectorPath = {
        id: `text-${Date.now()}`,
        name: `Text “${data.text.slice(0, 14)}”`,
        points: [
          {
            id: `text-pt-${Date.now()}`,
            x: origin.x - data.text.length * fontSize * 0.28,
            y: origin.y + fontSize * 0.34,
            type: 'corner',
          },
        ],
        closed: false,
        fill: data.fillColor,
        fillOpacity: 1,
        stroke: 'none',
        strokeWidth: 0,
        strokeOpacity: 0,
        strokeCap: 'round',
        strokeJoin: 'round',
        pressureProfile: 'uniform',
        text: data.text,
        fontSize,
        fontFamily: data.fontFamily,
        fontWeight: 'bold',
      };
      addPath(textPath);
      setSelection({ selectedPathIds: [textPath.id], selectedAnchorIndex: null, selectedHandleType: null });
      commitHistory();
      setTextOrigin(null);
    },
    [addPath, applyLayers, commitHistory, notify, textOrigin]
  );

  const expandSelectedText = useCallback(() => {
    const texts = selectedPaths.filter((p) => !!p.text);
    if (!texts.length) return;
    const generated: VectorPath[] = [];
    const removeIds: string[] = [];
    for (const textPath of texts) {
      removeIds.push(textPath.id);
      const origin = textPath.points[0] ?? { x: 100, y: 100 };
      generated.push(
        ...expandTextToVectorPaths(textPath.text!, {
          originX: origin.x,
          originY: origin.y,
          fontSize: textPath.fontSize || 64,
          fontFamily: textPath.fontFamily || 'Plus Jakarta Sans, sans-serif',
          fontWeight: textPath.fontWeight || 'bold',
          fillColor: textPath.fill || '#cdff5c',
          strokeColor: textPath.stroke !== 'none' ? textPath.stroke : 'none',
          strokeWidth: textPath.strokeWidth || 0,
        })
      );
    }
    if (!generated.length) {
      notify('That text could not be converted');
      return;
    }
    replacePaths(removeIds, generated);
    notify(`Text converted to ${generated.length} paths`);
  }, [notify, replacePaths, selectedPaths]);

  /* ------------------------------------------------------------------ *
   * Layers
   * ------------------------------------------------------------------ */
  const addLayer = useCallback(() => {
    const layer: Layer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layersRef.current.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      paths: [],
    };
    applyLayers((prev) => [...prev, layer]);
    setActiveLayerId(layer.id);
  }, [applyLayers]);

  const deleteLayer = useCallback(
    (id: string) => {
      if (layersRef.current.length <= 1) return;
      applyLayers((prev) => prev.filter((l) => l.id !== id));
      const rest = layersRef.current.filter((l) => l.id !== id);
      setActiveLayerId(rest[rest.length - 1]?.id ?? 'layer-1');
      setSelection({ ...emptySelection });
    },
    [applyLayers]
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const target = layersRef.current.find((l) => l.id === id);
      if (!target) return;
      const copy: Layer = {
        ...clone(target),
        id: `layer-${Date.now()}`,
        name: `${target.name} copy`,
      };
      applyLayers((prev) => [...prev, copy]);
      setActiveLayerId(copy.id);
    },
    [applyLayers]
  );

  const moveLayer = useCallback(
    (id: string, direction: 'up' | 'down') => {
      applyLayers((prev) => {
        const index = prev.findIndex((l) => l.id === id);
        const target = direction === 'up' ? index + 1 : index - 1;
        if (index < 0 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        return next;
      });
    },
    [applyLayers]
  );

  /* ------------------------------------------------------------------ *
   * References
   * ------------------------------------------------------------------ */
  const addReference = useCallback((image: ReferenceImage) => {
    setReferences((prev) => [...prev, image]);
    notify('Reference added');
  }, [notify]);

  const addReferenceFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        try {
          addReference(await referenceImageFromFile(file));
        } catch {
          notify('That image could not be added');
        }
      }
    },
    [addReference, notify]
  );

  const addReferenceFromSrc = useCallback(
    async (src: string) => {
      try {
        addReference(await referenceImageFromSrc(src));
      } catch {
        notify('That image could not be added');
      }
    },
    [addReference, notify]
  );

  /* ------------------------------------------------------------------ *
   * Fonts
   * ------------------------------------------------------------------ */
  const addFont = useCallback(async (family: string, file: File) => {
    const buffer = await file.arrayBuffer();
    const face = new FontFace(family, buffer);
    const loaded = await face.load();
    document.fonts.add(loaded);
    fontFacesRef.current.set(family, loaded);
    setCustomFonts((prev) => (prev.includes(family) ? prev : [...prev, family]));
    setSelectedFontFamily(family);
  }, []);

  const removeFont = useCallback((family: string) => {
    const face = fontFacesRef.current.get(family);
    if (face) {
      try {
        document.fonts.delete(face);
      } catch {
        /* ignore */
      }
      fontFacesRef.current.delete(family);
    }
    setCustomFonts((prev) => prev.filter((f) => f !== family));
    setSelectedFontFamily((prev) => (prev === family ? 'Plus Jakarta Sans, sans-serif' : prev));
  }, []);

  /* ------------------------------------------------------------------ *
   * Projects
   * ------------------------------------------------------------------ */
  const buildProject = useCallback(
    (overrides: Partial<StoredProject> = {}): StoredProject => {
      const now = Date.now();
      return {
        id: projectId,
        name: projectName,
        createdAt: now,
        updatedAt: now,
        layers: clone(layersRef.current),
        references: clone(references),
        view: viewRef.current,
        thumbnailSvg: generateProjectThumbnailSvg(
          layersRef.current,
          viewRef.current.width,
          viewRef.current.height,
          artboardColor
        ),
        pathsCount: layersRef.current.reduce((n, l) => n + l.paths.length, 0),
        layersCount: layersRef.current.length,
        ...overrides,
      };
    },
    [projectId, projectName, references, artboardColor]
  );

  const saveDocument = useCallback(
    async (nameOverride?: string, options: { silent?: boolean } = {}) => {
      const name = (nameOverride ?? projectName).trim() || 'Untitled';
      const id = projectId || `project-${Date.now()}`;
      try {
        await saveProject(buildProject({ id, name }));
        setProjectId(id);
        setProjectName(name);
        setIsSaved(true);
        if (!options.silent) notify('Saved to this device');
      } catch {
        if (!options.silent) notify('Could not save');
      }
    },
    [buildProject, notify, projectId, projectName]
  );

  // Autosave shortly after edits settle, so nothing depends on finding Save.
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (isSaved) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void saveDocument(undefined, { silent: true });
    }, 1400);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [layers, references, isSaved, saveDocument]);

  const openProject = useCallback(
    (project: StoredProject) => {
      const nextLayers = clone(project.layers);
      layersRef.current = nextLayers;
      setLayers(nextLayers);
      setProjectId(project.id);
      setProjectName(project.name);
      setReferences(clone(project.references ?? []));
      setActiveLayerId(nextLayers[0]?.id ?? 'layer-1');
      setSelection({ ...emptySelection });
      setActivePathInProgress(null);
      historyRef.current = { stack: [{ layers: clone(nextLayers), guides: [] }], index: 0 };
      guidesRef.current = [];
      setGuides([]);
      syncHistoryFlags();
      setIsSaved(true);
      if (project.view) setView(project.view);
      else window.setTimeout(fitArtboard, 0);
      notify(`Opened “${project.name}”`);
    },
    [fitArtboard, notify, syncHistoryFlags]
  );

  const newDocument = useCallback(async () => {
    const now = Date.now();
    const layer: Layer = {
      id: `layer-${now}`,
      name: 'Layer 1',
      visible: true,
      locked: false,
      opacity: 1,
      paths: [],
    };
    const project: StoredProject = {
      id: `project-${now}`,
      name: 'Untitled',
      createdAt: now,
      updatedAt: now,
      layers: [layer],
      references: [],
      thumbnailSvg: generateProjectThumbnailSvg([layer]),
      pathsCount: 0,
      layersCount: 1,
    };
    await saveProject(project);
    openProject(project);
  }, [openProject]);

  const openTemplate = useCallback(
    (template: LogoTemplate) => {
      openProject({
        id: `blueprint-${template.id}-${Date.now()}`,
        name: template.name,
        description: template.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        layers: clone(template.layers),
        references: [],
        thumbnailSvg: generateProjectThumbnailSvg(template.layers),
        pathsCount: template.layers.reduce((n, l) => n + l.paths.length, 0),
        layersCount: template.layers.length,
      });
    },
    [openProject]
  );

  useEffect(() => {
    seedInitialProjectsIfEmpty().catch(() => undefined);
    if (!localStorage.getItem('pentix.onboarded')) {
      setSheet('start');
      localStorage.setItem('pentix.onboarded', 'true');
    }
  }, []);

  /* ------------------------------------------------------------------ *
   * Keyboard
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setModifiers((p) => ({ ...p, shift: true }));
      if (e.key === 'Control' || e.key === 'Meta') setModifiers((p) => ({ ...p, ctrl: true }));
      if (e.key === 'Alt') setModifiers((p) => ({ ...p, alt: true }));
      if (isEditable(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
        if (key === 's') {
          e.preventDefault();
          void saveDocument();
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          copySelection();
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          pasteClipboard();
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          duplicateSelection();
          return;
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          if (sheet) setSheet(null);
          else if (activePathInProgress) setActivePathInProgress(null);
          else setSelection({ ...emptySelection });
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteSelection();
          return;
        case ' ':
          e.preventDefault();
          if (e.repeat || tool === 'hand') return;
          toolBeforePan.current = tool;
          setTool('hand');
          return;
        default:
          break;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          changeTool('select');
          break;
        case 'a':
          changeTool('direct-select');
          break;
        case 'p':
          changeTool('pen');
          break;
        case 'b':
          changeTool('pressure-brush');
          break;
        case 'm':
          changeTool('shape-builder');
          break;
        case 'u':
          changeTool('shape');
          break;
        case 't':
          changeTool('text');
          break;
        case 'h':
          changeTool('hand');
          break;
        default:
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setModifiers((p) => ({ ...p, shift: false }));
      if (e.key === 'Control' || e.key === 'Meta') setModifiers((p) => ({ ...p, ctrl: false }));
      if (e.key === 'Alt') setModifiers((p) => ({ ...p, alt: false }));
      if (e.key === ' ' && toolBeforePan.current) {
        setTool(toolBeforePan.current);
        toolBeforePan.current = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activePathInProgress,
    changeTool,
    copySelection,
    deleteSelection,
    duplicateSelection,
    pasteClipboard,
    redo,
    saveDocument,
    sheet,
    tool,
    undo,
  ]);

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */
  return (
    <div className="flex h-[100dvh] w-full justify-center bg-ink-0 text-text">
      <div className="relative flex h-full w-full max-w-[1280px] flex-col overflow-hidden md:border-x md:border-line">
      <TopBar
        projectName={projectName}
        isSaved={isSaved}
        layersCount={layers.length}
        canUndo={historyFlags.canUndo || (activePathInProgress?.points.length ?? 0) > 0}
        canRedo={historyFlags.canRedo}
        onUndo={undo}
        onRedo={redo}
        onRenameProject={(name) => {
          setProjectName(name);
          void saveDocument(name);
        }}
        onOpenMenu={() => setSheet('menu')}
        onOpenLayers={() => setSheet((current) => (current === 'layers' ? null : 'layers'))}
        onOpenExport={() => setSheet('export')}
      />

      <main ref={canvasWrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <Canvas
          view={view}
          onViewChange={setView}
          layers={layers}
          activeLayerId={activeLayerId}
          onUpdatePath={updatePath}
          onAddPath={addPath}
          tool={tool}
          shapeKind={shapeKind}
          shapeSides={shapeSides}
          modifiers={modifiers}
          selection={selection}
          onSelectionChange={setSelection}
          gridVisible={gridVisible}
          gridSnapEnabled={gridSnap}
          gridSpacingX={gridSpacingX}
          gridSpacingY={gridSpacingY}
          gridOpacity={gridOpacity}
          artboardColor={artboardColor}
          rulersVisible={rulersVisible}
          guides={guides}
          onAddGuide={addGuide}
          onUpdateGuide={moveGuideLive}
          onCommitGuides={finishGuideDrag}
          fillGradient={fillType === 'gradient' ? fillGradient : null}
          fillOpacity={fillOpacity}
          strokeOpacity={strokeOpacity}
          eyedropperActive={samplingTarget !== null}
          onSamplePoint={sampleColorAt}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          pressureConfig={pressureConfig}
          onCommitHistory={commitHistory}
          activePathInProgress={activePathInProgress}
          setActivePathInProgress={setActivePathInProgress}
          onReplacePaths={replacePaths}
          isPanZoomLocked={panZoomLocked}
          smartGuidesEnabled={smartGuides}
          referenceImages={references}
          onUpdateReference={(image) =>
            setReferences((prev) => prev.map((r) => (r.id === image.id ? image : r)))
          }
          sbMode={sbMode}
          clipArtboard={clipArtboard}
          onRequestText={(point) => openTextSheet({ origin: point, path: null })}
          onToolSwitch={changeTool}
        />

        {/* Zoom / fit pill */}
        <button
          type="button"
          onClick={fitArtboard}
          className="press absolute right-2 top-2 z-20 flex h-8 items-center gap-1.5 rounded-full border border-line bg-ink-2/90 px-2.5 font-mono text-[10px] font-bold text-dim backdrop-blur"
          aria-label="Fit artboard to screen"
        >
          <Maximize2 size={11} />
          {Math.round(view.zoom * 100)}%
        </button>

        <ThumbZone
          modifiers={modifiers}
          onModifierChange={setModifiers}
          onNudge={nudge}
          isDrawing={(activePathInProgress?.points.length ?? 0) > 0}
          onFinishPath={finishPath}
          hasSelection={selection.selectedPathIds.length > 0}
          onDuplicate={duplicateSelection}
          onDelete={deleteSelection}
          visible={sheet === null || sheet === 'layers'}
        />
      </main>

      <ToolOptions
        tool={tool}
        selectedCount={selection.selectedPathIds.length}
        hasTextSelection={hasTextSelected}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        shapeKind={shapeKind}
        sbMode={sbMode}
        drawingPointCount={activePathInProgress?.points.length ?? 0}
        hasSelectedNode={selection.selectedAnchorIndex !== null}
        onOpenColor={(mode) => {
          setColorMode(mode);
          setSheet('color');
        }}
        onChangeStrokeWidth={(w) => {
          setStrokeWidth(w);
          patchSelection({ strokeWidth: w });
        }}
        onDuplicate={duplicateSelection}
        onDelete={deleteSelection}
        onFlip={flipSelection}
        onBoolean={runBoolean}
        onEditText={() => openTextSheet({ path: editingTextPath })}
        onExpandText={expandSelectedText}
        onOpenText={() => openTextSheet({ path: null, origin: null })}
        onFinishPath={finishPath}
        onCancelPath={cancelPath}
        onClosePath={toggleClosePath}
        onToggleNodeType={togglePointType}
        onDeleteNode={deleteSelection}
        onQuickShape={quickShape}
        onPickShape={setShapeKind}
        onOpenShapes={() => {
          changeTool('shape');
          setSheet('shapes');
        }}
        onOpenPressure={() => setSheet('pressure')}
        onChangeSbMode={setSbMode}
        onExitPan={() => changeTool('select')}
        onCopy={copySelection}
        onPaste={pasteClipboard}
        canPaste={clipboard.length > 0}
        onRoundCorners={roundCorners}
      />

      <ToolDock
        currentTool={tool}
        onSelectTool={changeTool}
        onOpenShapes={() => {
          changeTool('shape');
          setSheet('shapes');
        }}
      />

      {/* ------------------------------ Sheets ------------------------------ */}
      <AppMenu
        open={sheet === 'menu'}
        onClose={closeSheet}
        projectName={projectName}
        savedLabel={isSaved ? 'Saved · autosave on' : 'Saving changes…'}
        onSave={() => {
          void saveDocument();
          closeSheet();
        }}
        onNewProject={() => {
          void newDocument();
          closeSheet();
        }}
        onOpenProjects={() => setSheet('projects')}
        onOpenExport={() => setSheet('export')}
        onOpenCanvas={() => setSheet('canvas')}
        canvasLabel={`${view.width} × ${view.height} px`}
        gridLabel={`${gridSpacingX} × ${gridSpacingY} px${gridSnap ? ' · snapping' : ''}${gridLocked ? ' · locked' : ''}${gridVisible ? '' : ' · hidden'}`}
        rulersVisible={rulersVisible}
        guidesCount={guides.length}
        smartGuides={smartGuides}
        onToggleSmartGuides={() => setSmartGuides((v) => !v)}
        panZoomLocked={panZoomLocked}
        onTogglePanZoomLock={() => {
          setPanZoomLocked((v) => !v);
          notify(panZoomLocked ? 'Pan & zoom unlocked' : 'Canvas locked');
        }}
        clipArtboard={clipArtboard}
        onToggleClipArtboard={() => setClipArtboard((v) => !v)}
        onOpenPressure={() => setSheet('pressure')}
        onOpenFonts={() => setSheet('fonts')}
        onOpenReferences={() => setSheet('layers')}
        onOpenTracer={() => {
          setTraceSrc(null);
          setSheet('trace');
        }}
        onOpenHelp={() => setSheet('help')}
        onPanTool={() => {
          changeTool('hand');
          closeSheet();
        }}
        canUndo={historyFlags.canUndo || (activePathInProgress?.points.length ?? 0) > 0}
        canRedo={historyFlags.canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      <LayersSheet
        open={sheet === 'layers'}
        onClose={closeSheet}
        layers={layers}
        activeLayerId={activeLayerId}
        selectedPathIds={selection.selectedPathIds}
        referenceImages={references}
        onSelectLayer={setActiveLayerId}
        onRenameLayer={(id, name) =>
          applyLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)))
        }
        onToggleLayerVisible={(id) =>
          applyLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)))
        }
        onToggleLayerLock={(id) =>
          applyLayers((prev) => prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)))
        }
        onAddLayer={addLayer}
        onDeleteLayer={deleteLayer}
        onDuplicateLayer={duplicateLayer}
        onMoveLayer={moveLayer}
        onUpdateLayerOpacity={(id, opacity) =>
          applyLayers(
            (prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)),
            { commit: false }
          )
        }
        onSelectPath={(id) =>
          setSelection({ selectedPathIds: [id], selectedAnchorIndex: null, selectedHandleType: null })
        }
        onDeletePath={(id) => {
          applyLayers((prev) =>
            prev.map((l) => ({ ...l, paths: l.paths.filter((p) => p.id !== id) }))
          );
          pruneSelection(layersRef.current);
        }}
        onUpdateReference={(image) =>
          setReferences((prev) => prev.map((r) => (r.id === image.id ? image : r)))
        }
        onDeleteReference={(id) => setReferences((prev) => prev.filter((r) => r.id !== id))}
        onAddReference={addReference}
        onTraceReference={(src) => {
          setTraceSrc(src);
          setSheet('trace');
        }}
        onSelectTool={changeTool}
      />

      <ColorSheet
        open={sheet === 'color'}
        onClose={closeSheet}
        mode={colorMode}
        onModeChange={setColorMode}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        strokeCap={strokeCap}
        strokeJoin={strokeJoin}
        fillOpacity={fillOpacity}
        strokeOpacity={strokeOpacity}
        selectedCount={selection.selectedPathIds.length}
        fillType={fillType}
        fillGradient={fillGradient}
        onSetFillType={(type) => {
          setFillType(type);
          if (selection.selectedPathIds.length) {
            patchSelectionSoon(
              type === 'gradient' ? { fillGradient } : { fillGradient: undefined }
            );
          }
        }}
        onUpdateFillGradient={(gradient) => {
          setFillGradient(gradient);
          if (selection.selectedPathIds.length) patchSelectionSoon({ fillGradient: gradient });
        }}
        stopIndex={activeStopIndex}
        onStopIndexChange={setActiveStopIndex}
        artboardColor={artboardColor}
        onUpdateBackground={setArtboardColor}
        onResetBackground={() => {
          setArtboardColor(CANVAS.artboard);
          notify('Artboard background reset');
        }}
        onSample={() =>
          startSampling(
            colorMode === 'fill' && fillType === 'gradient' ? 'stop' : colorMode
          )
        }
        sampling={samplingTarget !== null}
        onUpdateFillOpacity={(value) => {
          setFillOpacity(value);
          if (selection.selectedPathIds.length) patchSelectionSoon({ fillOpacity: value });
        }}
        onUpdateStrokeOpacity={(value) => {
          setStrokeOpacity(value);
          if (selection.selectedPathIds.length) patchSelectionSoon({ strokeOpacity: value });
        }}
        onUpdateFill={(color) => {
          setFillColor(color);
          patchSelection({ fill: color });
        }}
        onUpdateStroke={(color) => {
          setStrokeColor(color);
          patchSelection({ stroke: color });
        }}
        onUpdateStrokeWidth={(width) => {
          setStrokeWidth(width);
          patchSelectionSoon({ strokeWidth: width });
        }}
        onUpdateStrokeCap={(cap) => {
          setStrokeCap(cap);
          patchSelection({ strokeCap: cap });
        }}
        onUpdateStrokeJoin={(join) => {
          setStrokeJoin(join);
          patchSelection({ strokeJoin: join });
        }}
      />

      <ShapeSheet
        open={sheet === 'shapes'}
        onClose={closeSheet}
        selectedShape={shapeKind}
        sides={shapeSides}
        onSelectShape={setShapeKind}
        onChangeSides={setShapeSides}
      />

      <ProjectsSheet
        open={sheet === 'projects'}
        onClose={closeSheet}
        currentProjectId={projectId}
        onOpenProject={openProject}
        onCreateNewProject={() => void newDocument()}
        onOpenTemplate={openTemplate}
      />

      <ExportSheet
        open={sheet === 'export'}
        onClose={closeSheet}
        layers={layers}
        canvasWidth={view.width}
        canvasHeight={view.height}
        pressureConfig={pressureConfig}
        projectName={projectName}
        backgroundColor={artboardColor}
      />

      <PressureSheet
        open={sheet === 'pressure'}
        onClose={closeSheet}
        config={pressureConfig}
        onChange={setPressureConfig}
      />

      <FontsSheet
        open={sheet === 'fonts'}
        onClose={closeSheet}
        customFonts={customFonts}
        onAddFont={addFont}
        onRemoveFont={removeFont}
      />

      <TextSheet
        open={sheet === 'text'}
        onClose={closeSheet}
        initialText={textEditPath?.text ?? ''}
        initialFontFamily={textEditPath?.fontFamily ?? selectedFontFamily}
        initialFontSize={textEditPath?.fontSize ?? 64}
        initialFillColor={textEditPath?.fill ?? fillColor}
        customFonts={customFonts}
        editingPathId={textEditPath?.id ?? null}
        onSave={saveText}
      />

      <TraceSheet
        open={sheet === 'trace'}
        onClose={closeSheet}
        onTrace={(paths) => {
          const stamped = paths.map((p, i) => ({ ...p, id: `${p.id}-${Date.now()}-${i}` }));
          applyLayers((prev) =>
            prev.map((l) =>
              l.id === activeLayerId ? { ...l, paths: [...l.paths, ...stamped] } : l
            )
          );
          setSelection({
            selectedPathIds: stamped.map((p) => p.id),
            selectedAnchorIndex: null,
            selectedHandleType: null,
          });
          notify(`Traced ${stamped.length} path${stamped.length > 1 ? 's' : ''}`);
        }}
        onPlaceReference={(src) => void addReferenceFromSrc(src)}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        initialSrc={traceSrc}
      />

      <HelpSheet open={sheet === 'help'} onClose={closeSheet} />

      <CanvasSettingsSheet
        open={sheet === 'canvas'}
        onClose={closeSheet}
        width={view.width}
        height={view.height}
        onResize={resizeCanvas}
        gridVisible={gridVisible}
        onToggleGrid={() => setGridVisible((v) => !v)}
        gridSnap={gridSnap}
        onToggleGridSnap={() => setGridSnap((v) => !v)}
        gridSpacingX={gridSpacingX}
        gridSpacingY={gridSpacingY}
        onSpacingChange={(x, y) => {
          setGridSpacingX(x);
          setGridSpacingY(y);
        }}
        gridOpacity={gridOpacity}
        onGridOpacityChange={setGridOpacity}
        gridLocked={gridLocked}
        onToggleGridLock={() => {
          const next = !gridLocked;
          setGridLocked(next);
          notify(next ? 'Grid locked — spacing fixed' : 'Grid unlocked');
        }}
        rulersVisible={rulersVisible}
        onToggleRulers={() => setRulersVisible((v) => !v)}
        guides={guides}
        onUpdateGuide={updateGuide}
        onRemoveGuide={removeGuide}
        onClearGuides={() => commitGuides([])}
        artboardColor={artboardColor}
        onEditBackground={() => {
          setColorMode('background');
          setSheet('color');
        }}
      />

      <StartSheet
        open={sheet === 'start'}
        onStartBlank={() => {
          void newDocument();
          closeSheet();
        }}
        onChooseTemplate={(template) => {
          openTemplate(template);
          closeSheet();
        }}
        onClose={closeSheet}
      />

      <Toast message={toast} />
      </div>
    </div>
  );
}
