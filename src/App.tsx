import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Maximize2 } from 'lucide-react';

import { TopBar } from './components/TopBar';
import { ToolDock } from './components/ToolDock';
import { ToolOptions } from './components/ToolOptions';
import { ThumbZone } from './components/ThumbZone';
import { Canvas } from './components/Canvas';
import { AppMenu } from './components/AppMenu';
import { LayersSheet } from './components/LayersSheet';
import { ReferencesSheet } from './components/ReferencesSheet';
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
import { BackupSheet } from './components/BackupSheet';
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
import { LogoTemplate } from './data/templates';
import {
  clearCornerRounding,
  roundPathCorners,
  simplifyPath,
  toggleAnchorType,
} from './utils/bezier';
import { BooleanOperation, executeBooleanOperation } from './utils/shapeBuilder';
import {
  computePathsBoundingBox,
  copyPathsWithNewIds,
  flipPaths,
  translatePaths,
} from './utils/transform';
import { sanitizeClipReferences, withClipSources } from './utils/clipping';
import { measureTextMetrics, textBaselineForCenterY } from './utils/textGeometry';
import { AlignMode, DistributeAxis, alignPaths, distributePaths } from './utils/align';
import { GridSettings, StoredProject, getProject, saveProject, seedInitialProjectsIfEmpty } from './utils/projectStorage';
import { generateProjectThumbnailSvg } from './utils/thumbnailGenerator';
import { referenceImageFromFile, referenceImageFromSrc } from './utils/referenceImages';
import { defaultGradient } from './utils/gradients';
import { gradientIdFor, generateSvgCode } from './utils/svgExport';
import { outlineStroke } from './utils/strokeOutline';
import { userPrefs, saveUserPrefs } from './utils/userPrefs';
import {
  requestStorageProtection,
  storageProtectionHint,
  type StorageProtection,
} from './utils/storagePersistence';
import { downloadBackup, restoreBackupFile } from './utils/backup';
import { saveFont, loadAllFonts, deleteFont } from './utils/fontStorage';
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
  | 'refs'
  | 'backup'
  | 'start';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A new session opens on an empty artboard — grids are opt-in from Projects. */
const blankLayers = (): Layer[] => [
  { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 1, paths: [] },
];
const INITIAL_LAYERS: Layer[] = blankLayers();
const HISTORY_LIMIT = 80;

interface DocumentSettings {
  width: number;
  height: number;
  artboardColor: string;
  gridVisible: boolean;
  gridSnap: boolean;
  gridSpacingX: number;
  gridSpacingY: number;
  gridOpacity: number;
  gridLocked: boolean;
}

const initialDocumentSettings = (): DocumentSettings => ({
  width: 600,
  height: 600,
  artboardColor: CANVAS.artboard,
  gridVisible: userPrefs.gridVisible,
  gridSnap: userPrefs.gridSnap,
  gridSpacingX: userPrefs.gridSpacingX,
  gridSpacingY: userPrefs.gridSpacingY,
  gridOpacity: userPrefs.gridOpacity,
  gridLocked: userPrefs.gridLocked,
});
/** Remembers the document so a refresh reopens it instead of a blank sheet */
const LAST_PROJECT_KEY = 'pentix.lastProjectId';


const emptySelection: SelectionState = {
  selectedPathIds: [],
  selectedAnchorIndex: null,
  selectedAnchorIndexes: [],
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

  const [projectId, setProjectId] = useState(`untitled-${Date.now()}`);
  const [projectName, setProjectName] = useState('Untitled');
  const [isSaved, setIsSaved] = useState(true);
  const isSavedRef = useRef(isSaved);
  isSavedRef.current = isSaved;
  /** Bumped for every document mutation; saveDocument uses it to reject stale writes. */
  const editTickRef = useRef(0);
  const [saveTick, setSaveTick] = useState(0);
  /**
   * Bumped for every layer/guide mutation. commitHistory only pushes when this
   * has moved since the last snapshot, so a selection tap cannot fill history.
   */
  const editVersionRef = useRef(0);
  const historyVersionRef = useRef(0);
  const autosaveTimer = useRef<number | null>(null);

  const markDirty = useCallback(() => {
    editTickRef.current += 1;
    setIsSaved(false);
    setSaveTick((n) => n + 1);
  }, []);

  /* ------------------------------------------------------------------ *
   * History — ref based so commits made in the same tick stay correct.
   * Each entry snapshots the layers AND the guides, so one undo walks back
   * through artwork edits and guide edits alike.
   * ------------------------------------------------------------------ */
  type HistoryEntry = { layers: Layer[]; guides: Guide[]; settings: DocumentSettings };
  const settingsRef = useRef<DocumentSettings>(initialDocumentSettings());
  const historyRef = useRef<{ stack: HistoryEntry[]; index: number }>({
    stack: [{ layers: clone(INITIAL_LAYERS), guides: [], settings: initialDocumentSettings() }],
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
      // Layer, path and guide state is updated immutably, so snapshots can
      // share unchanged objects. Deep-cloning the whole document here made
      // every brush release scale with total artwork size.
      h.stack.push({
        layers: snapshot,
        guides: guidesRef.current,
        settings: { ...settingsRef.current },
      });
      if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
      h.index = h.stack.length - 1;
      historyVersionRef.current = editVersionRef.current;
      syncHistoryFlags();
    },
    [syncHistoryFlags]
  );

  const pruneSelection = useCallback((nextLayers: Layer[]) => {
    const byId = new Map(
      nextLayers.flatMap((l) => l.paths).map((path) => [path.id, path])
    );
    setSelection((prev) => {
      const kept = prev.selectedPathIds.filter((id) => byId.has(id));
      // A path can survive undo while losing points. Validate the anchor
      // against the restored path instead of leaving a dangling index that
      // points at a different node (or past the end).
      const firstPathUnchanged = prev.selectedPathIds[0] === kept[0];
      const owner = firstPathUnchanged && kept.length > 0 ? byId.get(kept[0]) : undefined;
      const requested =
        owner && prev.selectedAnchorIndex !== null
          ? prev.selectedAnchorIndexes?.includes(prev.selectedAnchorIndex)
            ? prev.selectedAnchorIndexes
            : [prev.selectedAnchorIndex]
          : [];
      const valid = owner
        ? requested.filter(
            (index) => Number.isInteger(index) && index >= 0 && index < owner.points.length
          )
        : [];
      const primary =
        valid.length > 0
          ? prev.selectedAnchorIndex !== null && valid.includes(prev.selectedAnchorIndex)
            ? prev.selectedAnchorIndex
            : valid[valid.length - 1]
          : null;
      const anchorsSame =
        primary === prev.selectedAnchorIndex &&
        valid.length === (prev.selectedAnchorIndexes?.length ?? 0) &&
        valid.every((index, i) => prev.selectedAnchorIndexes?.[i] === index);

      if (kept.length === prev.selectedPathIds.length && anchorsSame) return prev;
      return {
        selectedPathIds: kept,
        selectedAnchorIndex: primary,
        selectedAnchorIndexes: valid,
        selectedHandleType: primary === null ? null : prev.selectedHandleType,
      };
    });
  }, []);

  /** Undo/redo can remove the layer that was active; fall back to the top layer. */
  const reconcileActiveLayer = useCallback((nextLayers: Layer[]) => {
    setActiveLayerId((current) =>
      nextLayers.some((layer) => layer.id === current)
        ? current
        : (nextLayers[nextLayers.length - 1]?.id ?? 'layer-1')
    );
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
      editVersionRef.current += 1;
      if (dirty) markDirty();
      if (commit) pushHistory(value);
    },
    [markDirty, pushHistory]
  );

  const commitHistory = useCallback(() => {
    // A selection tap or any other no-op pointer-up must not fill the stack.
    if (editVersionRef.current === historyVersionRef.current) return;
    pushHistory(layersRef.current);
    markDirty();
  }, [markDirty, pushHistory]);

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
    reconcileActiveLayer(snapshot.layers);
    guidesRef.current = snapshot.guides;
    setGuides(snapshot.guides);
    const settings = snapshot.settings;
    settingsRef.current = settings;
    setView((prev) => ({ ...prev, width: settings.width, height: settings.height }));
    setArtboardColor(settings.artboardColor);
    setGridVisible(settings.gridVisible);
    setGridSnap(settings.gridSnap);
    setGridSpacingX(settings.gridSpacingX);
    setGridSpacingY(settings.gridSpacingY);
    setGridOpacity(settings.gridOpacity);
    setGridLocked(settings.gridLocked);
    editVersionRef.current += 1;
    historyVersionRef.current = editVersionRef.current;
    markDirty();
    syncHistoryFlags();
    pruneSelection(snapshot.layers);
  }, [activePathInProgress, markDirty, pruneSelection, reconcileActiveLayer, syncHistoryFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    const snapshot = clone(h.stack[h.index]);
    layersRef.current = snapshot.layers;
    setLayers(snapshot.layers);
    reconcileActiveLayer(snapshot.layers);
    guidesRef.current = snapshot.guides;
    setGuides(snapshot.guides);
    const settings = snapshot.settings;
    settingsRef.current = settings;
    setView((prev) => ({ ...prev, width: settings.width, height: settings.height }));
    setArtboardColor(settings.artboardColor);
    setGridVisible(settings.gridVisible);
    setGridSnap(settings.gridSnap);
    setGridSpacingX(settings.gridSpacingX);
    setGridSpacingY(settings.gridSpacingY);
    setGridOpacity(settings.gridOpacity);
    setGridLocked(settings.gridLocked);
    editVersionRef.current += 1;
    historyVersionRef.current = editVersionRef.current;
    markDirty();
    syncHistoryFlags();
    pruneSelection(snapshot.layers);
  }, [markDirty, pruneSelection, reconcileActiveLayer, syncHistoryFlags]);

  /* ------------------------------------------------------------------ *
   * Tools, modifiers, style defaults
   * ------------------------------------------------------------------ */
  const [tool, setTool] = useState<ToolType>(userPrefs.tool);
  /** Tool the space bar momentarily replaced, so a held space can hand it back */
  const toolBeforePan = useRef<ToolType | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>(userPrefs.shapeKind);
  const [shapeSides, setShapeSides] = useState(userPrefs.shapeSides);
  const [sbMode, setSbMode] = useState<'merge' | 'erase'>(userPrefs.sbMode);
  const [modifiers, setModifiers] = useState<ModifierState>({ shift: false, ctrl: false, alt: false });

  const [fillColor, setFillColor] = useState(userPrefs.fillColor);
  const [recentColors, setRecentColors] = useState<string[]>(userPrefs.recentColors);
  // Named colours belong to the document, not to session preferences.
  const [swatches, setSwatches] = useState<NonNullable<StoredProject['swatches']>>([]);
  const [strokeColor, setStrokeColor] = useState(userPrefs.strokeColor);
  const [fillOpacity, setFillOpacity] = useState(userPrefs.fillOpacity);
  const [strokeOpacity, setStrokeOpacity] = useState(userPrefs.strokeOpacity);
  /** Fill paint style for the next object, and the gradient editor's source */
  const [fillType, setFillType] = useState<'solid' | 'gradient'>(userPrefs.fillType);
  const [fillGradient, setFillGradient] = useState<GradientDef>(() =>
    defaultGradient('#4c8dff', '#5ce1c5')
  );
  /** Gradient stop the colour panel is editing (shared with the eyedropper) */
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  /** Eyedropper armed — the next canvas tap samples colour into this target */
  const [samplingTarget, setSamplingTarget] = useState<
    'fill' | 'stroke' | 'stop' | 'background' | null
  >(null);
  const [strokeWidth, setStrokeWidth] = useState(userPrefs.strokeWidth);
  const [strokeCap, setStrokeCap] = useState<StrokeCap>(userPrefs.strokeCap);
  const [strokeJoin, setStrokeJoin] = useState<StrokeJoin>(userPrefs.strokeJoin);
  const [pressureConfig, setPressureConfig] = useState<PressureConfig>(userPrefs.pressure);

  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [selectedFontFamily, setSelectedFontFamily] = useState(userPrefs.selectedFontFamily);
  const [recentFonts, setRecentFonts] = useState<string[]>(userPrefs.recentFonts);
  const fontFacesRef = useRef<Map<string, FontFace>>(new Map());

  /* ------------------------------------------------------------------ *
   * Canvas view
   * ------------------------------------------------------------------ */
  const [view, setView] = useState<CanvasView>({ zoom: 1, panX: 0, panY: 0, width: 600, height: 600 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [gridVisible, setGridVisible] = useState(userPrefs.gridVisible);
  const [gridSnap, setGridSnap] = useState(userPrefs.gridSnap);
  const [gridSpacingX, setGridSpacingX] = useState(userPrefs.gridSpacingX);
  const [gridSpacingY, setGridSpacingY] = useState(userPrefs.gridSpacingY);
  const [gridOpacity, setGridOpacity] = useState(userPrefs.gridOpacity);
  /** One global lock for the whole grid system: freezes spacing + appearance */
  const [gridLocked, setGridLocked] = useState(userPrefs.gridLocked);
  const [rulersVisible, setRulersVisible] = useState(userPrefs.rulersVisible);
  const [guidesLocked, setGuidesLocked] = useState(userPrefs.guidesLocked);
  const [guides, setGuides] = useState<Guide[]>([]);
  guidesRef.current = guides;
  const [artboardColor, setArtboardColor] = useState<string>(CANVAS.artboard);
  const settingsHistoryTimer = useRef<number | null>(null);

  /** Document settings share the same undo stack as layers and guides. */
  const commitSettings = useCallback(
    (patch: Partial<DocumentSettings>, defer = false) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setView((prev) => ({ ...prev, width: next.width, height: next.height }));
      setArtboardColor(next.artboardColor);
      setGridVisible(next.gridVisible);
      setGridSnap(next.gridSnap);
      setGridSpacingX(next.gridSpacingX);
      setGridSpacingY(next.gridSpacingY);
      setGridOpacity(next.gridOpacity);
      setGridLocked(next.gridLocked);
      editVersionRef.current += 1;
      markDirty();
      if (defer) {
        if (settingsHistoryTimer.current) window.clearTimeout(settingsHistoryTimer.current);
        settingsHistoryTimer.current = window.setTimeout(() => {
          settingsHistoryTimer.current = null;
          pushHistory(layersRef.current);
        }, 420);
      } else {
        if (settingsHistoryTimer.current) {
          window.clearTimeout(settingsHistoryTimer.current);
          settingsHistoryTimer.current = null;
        }
        pushHistory(layersRef.current);
      }
    },
    [markDirty, pushHistory]
  );

  const updateArtboardColor = useCallback(
    (color: string) => commitSettings({ artboardColor: color }, true),
    [commitSettings]
  );
  const [smartGuides, setSmartGuides] = useState(userPrefs.smartGuides);
  const [panZoomLocked, setPanZoomLocked] = useState(userPrefs.panZoomLocked);
  const [clipArtboard, setClipArtboard] = useState(userPrefs.clipArtboard);
  const [showTransforms, setShowTransforms] = useState(userPrefs.showTransforms);
  /** The precision pad is a tool, never a requirement — it can be switched off */
  const [showPrecisionPad, setShowPrecisionPad] = useState(userPrefs.precisionPad);
  /** Pencil fidelity — how closely the drawn curve follows the finger */
  const [pencilSmoothing, setPencilSmoothing] = useState(userPrefs.pencilSmoothing);

  /* Preferences follow the workspace, so a refresh restores every toggle,
     spacing value and paint default rather than starting from stock. */
  const currentPrefs = useMemo(
    () => ({
      gridVisible,
      gridSnap,
      gridSpacingX,
      gridSpacingY,
      gridOpacity,
      gridLocked,
      rulersVisible,
      guidesLocked,
      smartGuides,
      panZoomLocked,
      clipArtboard,
      showTransforms,
      precisionPad: showPrecisionPad,
      pencilSmoothing,
      tool,
      shapeKind,
      shapeSides,
      sbMode,
      fillColor,
      strokeColor,
      fillOpacity,
      strokeOpacity,
      fillType,
      strokeWidth,
      strokeCap,
      strokeJoin,
      pressure: pressureConfig,
      selectedFontFamily,
      recentColors,
      recentFonts,
    }),
    [
      gridVisible,
      gridSnap,
      gridSpacingX,
      gridSpacingY,
      gridOpacity,
      gridLocked,
      rulersVisible,
      guidesLocked,
      smartGuides,
      panZoomLocked,
      clipArtboard,
      showTransforms,
      showPrecisionPad,
      pencilSmoothing,
      tool,
      shapeKind,
      shapeSides,
      sbMode,
      fillColor,
      strokeColor,
      fillOpacity,
      strokeOpacity,
      fillType,
      strokeWidth,
      strokeCap,
      strokeJoin,
      pressureConfig,
      selectedFontFamily,
      recentColors,
      recentFonts,
    ]
  );
  const prefsTimer = useRef<number | null>(null);
  useEffect(() => {
    if (prefsTimer.current) window.clearTimeout(prefsTimer.current);
    prefsTimer.current = window.setTimeout(() => {
      saveUserPrefs(currentPrefs);
    }, 300);
    return () => {
      if (prefsTimer.current) window.clearTimeout(prefsTimer.current);
    };
  }, [currentPrefs]);

  /* Ask once on boot; a browser may grant silently or simply decline. */
  const [storageProtection, setStorageProtection] = useState<StorageProtection>('unknown');
  useEffect(() => {
    let active = true;
    void requestStorageProtection().then((state) => {
      if (active) setStorageProtection(state);
    });
    return () => {
      active = false;
    };
  }, []);
  /** The nudge pad hides the selection rectangle while it is open */
  const [nudgePadOpen, setNudgePadOpen] = useState(false);

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
      Math.max(0.04, Math.min((w - sideGutter) / aw, (h - verticalGutter) / ah))
    );
    setView((prev) => ({
      ...prev,
      zoom: scale,
      panX: (w - aw * scale) / 2,
      // Bias slightly upward so the lower corners stay free for thumb controls
      panY: Math.max(8, (h - ah * scale) / 2 - 18),
    }));
  }, []);

  /**
   * Artboard preview. Chrome, editing aids and selection step away so the
   * artwork is judged on its own; the toggle brings the workspace straight back.
   */
  const [previewMode, setPreviewMode] = useState(false);
  const prePreviewViewRef = useRef<CanvasView | null>(null);
  const togglePreview = useCallback(() => {
    setPreviewMode((on) => {
      if (!on) {
        prePreviewViewRef.current = viewRef.current;
        return true;
      }
      const saved = prePreviewViewRef.current;
      if (saved) setView(saved);
      return false;
    });
  }, []);

  useEffect(() => {
    if (!previewMode) return;
    setSheet(null);
    setNudgePadOpen(false);
    haptic(8);
    const id = window.setTimeout(fitArtboard, 80);
    return () => window.clearTimeout(id);
  }, [previewMode, fitArtboard]);

  // Fit once on boot. Resizing or rotating must not overwrite a view the user
  // has deliberately zoomed and panned; Fit remains one tap away.
  useEffect(() => {
    fitArtboard();
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
  /** While set, new artwork is clipped to this closed shape. */
  const [drawInsideId, setDrawInsideId] = useState<string | null>(null);

  /* ------------------------------------------------------------------ *
   * Derived selection data
   * ------------------------------------------------------------------ */
  const allPaths = useMemo(() => layers.flatMap((l) => l.paths), [layers]);
  const selectedPaths = useMemo(
    () => allPaths.filter((p) => selection.selectedPathIds.includes(p.id)),
    [allPaths, selection.selectedPathIds]
  );
  const drawInsidePath = useMemo(() => {
    if (!drawInsideId) return null;
    const path = allPaths.find((p) => p.id === drawInsideId) ?? null;
    if (!path || path.visible === false) return null;
    const owner = layers.find((layer) => layer.paths.some((p) => p.id === path.id));
    return owner?.visible === false ? null : path;
  }, [allPaths, drawInsideId, layers]);
  useEffect(() => {
    if (!drawInsideId) return;
    if (!drawInsidePath || !drawInsidePath.closed || drawInsidePath.isClippingMask) {
      setDrawInsideId(null);
    }
  }, [drawInsideId, drawInsidePath]);
  const cornerIds = useMemo(() => {
    if (selectedPaths.length !== 1) return [];
    const path = selectedPaths[0];
    if (!path || path.text) return [];
    const source = path.cornerSource?.points ?? path.points;
    return source
      .filter(
        (point, index) =>
          !point.handleIn &&
          !point.handleOut &&
          (point.type === 'corner' || point.type === 'broken') &&
          (path.closed || (index > 0 && index < source.length - 1))
      )
      .map((point) => point.id);
  }, [selectedPaths]);
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
    // Follow the objects' own paint as well, so undo and redo reach the
    // picker instead of leaving it showing a colour the artwork no longer has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selection.selectedPathIds.join('|'),
    selectedPaths
      .map((p) => `${p.fill}|${p.stroke}|${p.fillOpacity}|${p.fillGradient ? 'g' : '-'}`)
      .join('~'),
  ]);

  // Selecting an object follows it to its layer. Duplicate, paste and a new
  // shape then land beside the object you are working on, not on the layer
  // that happened to be active before.
  useEffect(() => {
    const firstId = selection.selectedPathIds[0];
    if (!firstId) return;
    const owner = layersRef.current.find((layer) =>
      layer.paths.some((path) => path.id === firstId)
    );
    if (owner) {
      setActiveLayerId((current) => (current === owner.id ? current : owner.id));
    }
  }, [selection.selectedPathIds]);

  /** New artwork must never disappear into a hidden or locked layer. */
  const resolveWritableLayerId = useCallback(() => {
    const current = layersRef.current.find((layer) => layer.id === activeLayerId);
    if (current && current.visible !== false && !current.locked) return current.id;
    const fallback = [...layersRef.current]
      .reverse()
      .find((layer) => layer.visible !== false && !layer.locked);
    if (!fallback) {
      notify('Show or unlock a layer before adding artwork');
      return null;
    }
    setActiveLayerId(fallback.id);
    return fallback.id;
  }, [activeLayerId, notify]);

  /* ------------------------------------------------------------------ *
   * Path factories
   * ------------------------------------------------------------------ */
  const addPath = useCallback(
    (path: VectorPath) => {
      const targetLayerId = resolveWritableLayerId();
      if (!targetLayerId) return;
      const next =
        drawInsideId && drawInsidePath
          ? { ...path, clipPathId: drawInsideId }
          : path;
      applyLayers(
        (prev) =>
          prev.map((l) =>
            l.id === targetLayerId ? { ...l, paths: [...l.paths, next] } : l
          ),
        { commit: false }
      );
    },
    [applyLayers, drawInsideId, drawInsidePath, resolveWritableLayerId]
  );

  const updatePath = useCallback(
    (path: VectorPath, options: { preserveCornerSource?: boolean } = {}) => {
      // Moving, rotating, scaling and flipping keep the sharp source so the
      // radius control stays reversible. Hand-editing a node no longer matches
      // that source, so clear the rounding history in that case.
      const next = options.preserveCornerSource ? path : clearCornerRounding(path);
      applyLayers(
        (prev) =>
          prev.map((l) => ({
            ...l,
            paths: l.paths.map((p) => (p.id === next.id ? next : p)),
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

  const setExtrudeDepth = useCallback(
    (depth: number) => {
      patchSelectionSoon({ extrudeDepth: Math.max(0, depth) });
    },
    [patchSelectionSoon]
  );

  const setExtrudeAngle = useCallback(
    (angle: number) => {
      patchSelectionSoon({ extrudeAngle: angle });
    },
    [patchSelectionSoon]
  );

  const setExtrudeTaper = useCallback(
    (taper: number) => {
      patchSelectionSoon({ extrudeTaper: Math.min(0.45, Math.max(0, taper)) });
    },
    [patchSelectionSoon]
  );

  const setExtrudeShadow = useCallback(
    (on: boolean) => {
      patchSelectionSoon({ extrudeShadow: on });
    },
    [patchSelectionSoon]
  );

  const addSwatch = useCallback((name: string, color: string) => {
    const hex = color.toUpperCase();
    const swatch: NonNullable<StoredProject['swatches']>[number] = {
      id: `swatch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || hex,
      color: hex,
    };
    setSwatches((prev) => [...prev, swatch]);
    markDirty();
  }, [markDirty]);

  const removeSwatch = useCallback((id: string) => {
    setSwatches((prev) => prev.filter((s) => s.id !== id));
    markDirty();
  }, [markDirty]);

  /** Newest first, deduped, capped — the picker's own colour history. */
  const recentColorTimer = useRef<number | null>(null);
  const rememberColor = useCallback((color: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    const hex = color.toUpperCase();
    // A picker drag emits a shade per pointer move. Remember only the value
    // that survives the gesture instead of filling all twelve slots with it.
    if (recentColorTimer.current) window.clearTimeout(recentColorTimer.current);
    recentColorTimer.current = window.setTimeout(() => {
      setRecentColors((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 12));
      recentColorTimer.current = null;
    }, 420);
  }, []);

  const deleteSelection = useCallback(() => {
    const ids = selection.selectedPathIds;
    if (ids.length === 0) return;

    const anchorIndex =
      selection.selectedAnchorIndex !== null &&
      selection.selectedAnchorIndexes?.includes(selection.selectedAnchorIndex)
        ? selection.selectedAnchorIndexes
        : selection.selectedAnchorIndex !== null
          ? [selection.selectedAnchorIndex]
          : [];

    if (anchorIndex.length > 0) {
      const path = allPaths.find((p) => p.id === ids[0]);
      const remove = new Set(anchorIndex);
      if (path && path.points.some((_, i) => remove.has(i))) {
        const points = path.points.filter((_, i) => !remove.has(i));
        if (points.length <= 1) {
          applyLayers((prev) =>
            prev.map((l) => ({ ...l, paths: l.paths.filter((p) => p.id !== path.id) }))
          );
          setSelection({ ...emptySelection });
        } else {
          applyLayers((prev) =>
            prev.map((l) => ({
              ...l,
              paths: l.paths.map((p) => (p.id === path.id ? { ...p, points } : p)),
            }))
          );
          setSelection((prev) => ({
            ...prev,
            selectedAnchorIndex: null,
            selectedAnchorIndexes: [],
          }));
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
    const targetLayerId = resolveWritableLayerId();
    if (!targetLayerId) return;
    const sourcePaths = allPaths.filter((p) => ids.includes(p.id));
    const copies = copyPathsWithNewIds(
      withClipSources(sourcePaths, allPaths),
      24,
      24,
      `copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    );
    if (!copies.length) return;
    applyLayers((prev) =>
      prev.map((l) =>
        l.id === targetLayerId ? { ...l, paths: [...l.paths, ...copies] } : l
      )
    );
    const copiedArtwork = copies.filter((copy) => !copy.isClippingMask);
    setSelection({
      selectedPathIds: copiedArtwork.map((c) => c.id),
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });
    notify(`Duplicated ${sourcePaths.length} object${sourcePaths.length > 1 ? 's' : ''}`);
  }, [allPaths, applyLayers, notify, resolveWritableLayerId, selection.selectedPathIds]);

  const copySelection = useCallback(() => {
    if (!selectedPaths.length) return;
    setClipboard(clone(withClipSources(selectedPaths, allPaths)));
    notify(`Copied ${selectedPaths.length} object${selectedPaths.length > 1 ? 's' : ''}`);
  }, [allPaths, notify, selectedPaths]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard.length) return;
    const targetLayerId = resolveWritableLayerId();
    if (!targetLayerId) return;
    const pasted = copyPathsWithNewIds(
      clipboard,
      28,
      28,
      `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    );
    applyLayers((prev) =>
      prev.map((l) => (l.id === targetLayerId ? { ...l, paths: [...l.paths, ...pasted] } : l))
    );
    const pastedArtwork = pasted.filter((p) => !p.isClippingMask);
    setSelection({
      selectedPathIds: pastedArtwork.map((p) => p.id),
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });
  }, [applyLayers, clipboard, resolveWritableLayerId]);

  const flipSelection = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      const ids = selection.selectedPathIds;
      if (!ids.length) return;

      // Resolve the objects inside the update, so the tap acts on the artwork
      // as it is now rather than on a snapshot taken before the last render.
      applyLayers((prev) => {
        const targets = prev.flatMap((l) => l.paths).filter((p) => ids.includes(p.id));
        if (!targets.length) return prev;

        // Mirror about the bounds, not the anchor cloud. A traced shape carries
        // far more anchors on one side than the other, and a density-weighted
        // pivot slides the artwork sideways instead of flipping it in place.
        const bounds = computePathsBoundingBox(targets);
        let cx = bounds?.centerX ?? 0;
        let cy = bounds?.centerY ?? 0;
        if (!bounds) {
          let sx = 0;
          let sy = 0;
          let n = 0;
          targets.forEach((p) =>
            p.points.forEach((pt) => {
              sx += pt.x;
              sy += pt.y;
              n += 1;
            })
          );
          if (!n) return prev;
          cx = sx / n;
          cy = sy / n;
        }

        const flipped = new Map(
          flipPaths(targets, { x: cx, y: cy }, direction).map((p) => [p.id, p])
        );
        return prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) => flipped.get(p.id) ?? p),
        }));
      });
    },
    [applyLayers, selection.selectedPathIds]
  );

  const runBoolean = useCallback(
    (op: BooleanOperation) => {
      if (selectedPaths.length < 2) return;
      const targetLayerId = resolveWritableLayerId();
      if (!targetLayerId) return;
      const result = executeBooleanOperation(selectedPaths, op, allPaths);
      if (!result.length) return;
      const ids = selectedPaths.map((p) => p.id);
      applyLayers((prev) =>
        prev.map((l) => {
          const preserved = l.paths.filter((p) => !ids.includes(p.id));
          return l.id === targetLayerId
            ? { ...l, paths: [...preserved, ...result] }
            : { ...l, paths: preserved };
        })
      );
      setSelection({ selectedPathIds: result.map((p) => p.id), selectedAnchorIndex: null, selectedHandleType: null });
      notify(`${op[0].toUpperCase()}${op.slice(1)} applied`);
    },
    [allPaths, applyLayers, notify, resolveWritableLayerId, selectedPaths]
  );

  const makeClippingMask = useCallback(() => {
    const drawable = selectedPaths.filter((path) => path.closed && !path.text);
    if (drawable.length < 2) return;
    // Paint order is back-to-front, so the last selected closed object is the
    // top shape and becomes the mask source.
    const mask = drawable[drawable.length - 1];
    const clippedIds = new Set(drawable.slice(0, -1).map((path) => path.id));
    applyLayers((prev) =>
      prev.map((layer) => ({
        ...layer,
        paths: layer.paths.map((path) => {
          if (path.id === mask.id) {
            return { ...path, isClippingMask: true, clipPathId: undefined };
          }
          if (clippedIds.has(path.id)) {
            return { ...path, clipPathId: mask.id, isClippingMask: false };
          }
          return path;
        }),
      }))
    );
    setSelection({
      selectedPathIds: [...clippedIds],
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });
    notify(`Clipping mask · ${clippedIds.size} object${clippedIds.size === 1 ? '' : 's'}`);
  }, [applyLayers, notify, selectedPaths]);

  const releaseClippingMask = useCallback(() => {
    const selected = new Set(selection.selectedPathIds);
    const maskIds = new Set(
      selectedPaths.filter((path) => path.isClippingMask).map((path) => path.id)
    );
    applyLayers((prev) =>
      prev.map((layer) => ({
        ...layer,
        paths: layer.paths.map((path) => {
          if (maskIds.has(path.id)) {
            return { ...path, isClippingMask: false, clipPathId: undefined };
          }
          if (path.clipPathId && (selected.has(path.id) || maskIds.has(path.clipPathId))) {
            return { ...path, clipPathId: undefined };
          }
          return path;
        }),
      }))
    );
    notify('Clipping mask released');
  }, [applyLayers, notify, selectedPaths, selection.selectedPathIds]);

  const replacePaths = useCallback(
    (removeIds: string[], newPaths: VectorPath[]) => {
      const targetLayerId = resolveWritableLayerId();
      if (!targetLayerId) return;
      applyLayers((prev) =>
        prev.map((l) => {
          const preserved = l.paths.filter((p) => !removeIds.includes(p.id));
          return l.id === targetLayerId ? { ...l, paths: [...preserved, ...newPaths] } : { ...l, paths: preserved };
        })
      );
      setSelection({ selectedPathIds: newPaths.map((p) => p.id), selectedAnchorIndex: null, selectedHandleType: null });
    },
    [applyLayers, resolveWritableLayerId]
  );

  const togglePointType = useCallback(() => {
    const path = selectedPaths[0];
    if (!path) return;
    const indexes =
      selection.selectedAnchorIndex !== null &&
      selection.selectedAnchorIndexes?.includes(selection.selectedAnchorIndex)
        ? selection.selectedAnchorIndexes
        : [selection.selectedAnchorIndex ?? 0];
    const toggle = new Set(indexes.filter((i) => !!path.points[i]));
    if (!toggle.size) return;
    const points = path.points.map((point, index) =>
      toggle.has(index) ? toggleAnchorType(point) : point
    );
    applyLayers((prev) =>
      prev.map((l) => ({
        ...l,
        paths: l.paths.map((p) =>
          p.id === path.id
            ? { ...p, points, cornerRadius: undefined, cornerSource: undefined }
            : p
        ),
      }))
    );
  }, [
    applyLayers,
    selectedPaths,
    selection.selectedAnchorIndex,
    selection.selectedAnchorIndexes,
  ]);

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
    (radius: number, cornerId?: string) => {
      if (!selectedPaths.length) return;
      const ids = selection.selectedPathIds;
      applyLayers(
        (prev) =>
          prev.map((l) => ({
            ...l,
            paths: l.paths.map((p) =>
              ids.includes(p.id) ? roundPathCorners(p, radius, cornerId) : p
            ),
          })),
        { commit: false }
      );
      // A slider emits a value per pointer move; the whole drag is one undo step.
      commitSoon();
    },
    [applyLayers, commitSoon, selectedPaths.length, selection.selectedPathIds]
  );

  /**
   * Thins out already-drawn geometry — over-traced logos, converted glyphs and
   * boolean results — without re-running the trace that produced it.
   */
  const simplifySelection = useCallback(
    (tolerance: number) => {
      if (!selectedPaths.length) return;

      const drawable = selectedPaths.filter((p) => !p.text);
      if (!drawable.length) {
        notify('Convert the text to curves first');
        return;
      }

      const ids = selection.selectedPathIds;
      const anchorCount = (p: VectorPath) =>
        p.points.length + (p.holes?.reduce((n, h) => n + h.length, 0) ?? 0);

      let before = 0;
      let after = 0;
      const simplified = new Map<string, VectorPath>();

      for (const path of drawable) {
        const next = simplifyPath(path, tolerance);
        before += anchorCount(path);
        after += anchorCount(next);
        if (next !== path) simplified.set(path.id, next);
      }

      if (!simplified.size) {
        notify('No spare anchors to remove');
        return;
      }

      applyLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) =>
            ids.includes(p.id) ? simplified.get(p.id) ?? p : p
          ),
        }))
      );
      commitHistory();
      notify(`Anchors ${before} → ${after}`);
    },
    [applyLayers, commitHistory, notify, selectedPaths, selection.selectedPathIds]
  );

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!selection.selectedPathIds.length) return;
      const ids = selection.selectedPathIds;
      const anchors =
        selection.selectedAnchorIndex !== null &&
        selection.selectedAnchorIndexes?.includes(selection.selectedAnchorIndex)
          ? selection.selectedAnchorIndexes
          : selection.selectedAnchorIndex !== null
            ? [selection.selectedAnchorIndex]
            : [];
      const anchorSet = new Set(anchors);
      applyLayers(
        (prev) =>
          prev.map((l) => ({
            ...l,
            paths: l.paths.map((p) => {
              if (!ids.includes(p.id)) return p;
              if (anchorSet.size > 0 && p.id === ids[0]) {
                const points = p.points.map((pt, index) =>
                  anchorSet.has(index)
                    ? {
                        ...pt,
                        x: pt.x + dx,
                        y: pt.y + dy,
                        handleIn: pt.handleIn
                          ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy }
                          : undefined,
                        handleOut: pt.handleOut
                          ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy }
                          : undefined,
                      }
                    : pt
                );
                return { ...p, points };
              }
              // Outline and counters move together
              return translatePaths([p], dx, dy)[0];
            }),
          })),
        { commit: false }
      );
      // Rapid taps collapse into one history step instead of one per tap
      commitSoon();
    },
    [
      applyLayers,
      commitSoon,
      selection.selectedAnchorIndex,
      selection.selectedAnchorIndexes,
      selection.selectedPathIds,
    ]
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

  const startDrawInside = useCallback(() => {
    const target = selectedPaths.find(
      (path) => path.closed && !path.text && !path.isClippingMask
    );
    if (!target) {
      notify('Select one closed shape to draw inside');
      return;
    }
    setDrawInsideId(target.id);
    setSelection({ ...emptySelection });
    changeTool('pencil');
    setSheet(null);
    notify(`Drawing inside ${target.name}`);
  }, [changeTool, notify, selectedPaths]);

  const exitDrawInside = useCallback(() => {
    setDrawInsideId(null);
    notify('Draw inside off');
  }, [notify]);

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
      commitSettings({ width, height });
      window.setTimeout(fitArtboard, 0);
      notify(`Artboard set to ${width} × ${height} px`);
    },
    [commitSettings, fitArtboard, notify]
  );

  /** Every committed guide change becomes one undo step. */
  const commitGuides = useCallback(
    (next: Guide[]) => {
      editVersionRef.current += 1;
      guidesRef.current = next;
      setGuides(next);
      pushHistory(layersRef.current);
      markDirty();
      haptic(8);
    },
    [markDirty, pushHistory]
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
    editVersionRef.current += 1;
    setGuides(next);
  }, []);

  const finishGuideDrag = useCallback(() => {
    commitHistory();
  }, [commitHistory]);

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
        updateArtboardColor(hex);
      } else if (target === 'stop') {
        const stops = [...fillGradient.stops].sort((a, b) => a.offset - b.offset);
        const idx = Math.max(0, Math.min(stops.length - 1, activeStopIndex));
        stops[idx] = { ...stops[idx], color: hex };
        const next = { ...fillGradient, stops };
        setFillGradient(next);
        // The picker shows a gradient stop, but the artwork only changes if
        // the selected object receives the updated gradient too.
        patchSelection({ fillGradient: next });
      } else if (target === 'stroke') {
        setStrokeColor(hex);
        patchSelection({ stroke: hex });
      } else {
        setFillColor(hex);
        patchSelection({ fill: hex });
      }
      rememberColor(hex);
      setSheet('color');
      notify(`Sampled ${hex}`);
      haptic(10);
    },
    [
      activeStopIndex,
      fillGradient,
      notify,
      patchSelection,
      rememberColor,
      samplingTarget,
      updateArtboardColor,
    ]
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
      letterSpacing: number;
      fillColor: string;
      editingPathId: string | null;
    }) => {
      setSelectedFontFamily(data.fontFamily);
      setRecentFonts((prev) =>
        prev[0] === data.fontFamily
          ? prev
          : [data.fontFamily, ...prev.filter((f) => f !== data.fontFamily)].slice(0, 8)
      );
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
                    letterSpacing: data.letterSpacing,
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
      const metrics = measureTextMetrics({
        text: data.text,
        fontSize,
        fontFamily: data.fontFamily,
        fontWeight: 'bold',
        letterSpacing: data.letterSpacing,
      });
      const textPath: VectorPath = {
        id: `text-${Date.now()}`,
        name: `Text “${data.text.slice(0, 14)}”`,
        points: [
          {
            id: `text-pt-${Date.now()}`,
            x: origin.x - metrics.width / 2,
            y: textBaselineForCenterY(
              {
                text: data.text,
                fontSize,
                fontFamily: data.fontFamily,
                fontWeight: 'bold',
                letterSpacing: data.letterSpacing,
              },
              origin.y
            ),
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
        letterSpacing: data.letterSpacing,
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
          letterSpacing: textPath.letterSpacing ?? 0,
          fillColor: textPath.fill || '#4c8dff',
          strokeColor: textPath.stroke !== 'none' ? textPath.stroke : 'none',
          strokeWidth: textPath.strokeWidth || 0,
          matrix: textPath.textMatrix,
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

  /** A visible stroke that can be turned into a fill, e.g. to use the shape builder */
  const canExpandStroke = selectedPaths.some(
    (p) => !p.text && p.stroke !== 'none' && (p.strokeWidth ?? 0) > 0
  );

  const expandStrokeSelection = useCallback(() => {
    const targets = selectedPaths.filter(
      (p) => !p.text && p.stroke !== 'none' && (p.strokeWidth ?? 0) > 0
    );
    if (!targets.length) {
      notify('Select a stroked path first');
      return;
    }

    const outlined: VectorPath[] = [];
    for (const path of targets) outlined.push(...outlineStroke(path));

    if (!outlined.length) {
      notify('That stroke could not be outlined');
      return;
    }

    replacePaths(targets.map((p) => p.id), outlined);
    notify(`Outlined ${targets.length} stroke${targets.length > 1 ? 's' : ''}`);
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
      const target = layersRef.current.find((layer) => layer.id === id);
      if (target?.locked) {
        notify('Unlock the layer before deleting it');
        return;
      }
      applyLayers((prev) => prev.filter((l) => l.id !== id));
      const rest = layersRef.current.filter((l) => l.id !== id);
      setActiveLayerId(rest[rest.length - 1]?.id ?? 'layer-1');
      // Only objects from the deleted layer leave the selection; work selected
      // on other layers should survive a layer cleanup.
      pruneSelection(layersRef.current);
    },
    [applyLayers, notify, pruneSelection]
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const target = layersRef.current.find((l) => l.id === id);
      if (!target) return;
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // A layer copy needs fresh path, point and hole IDs. Reusing them made
      // selecting or editing the copy edit the original as well. Clip IDs need
      // the same treatment when both source and child live in this layer.
      const nextIds = new Map(
        target.paths.map((path, pathIndex) => [path.id, `path-${stamp}-${pathIndex}`])
      );
      const paths = target.paths.map((path, pathIndex) => {
        const pathId = nextIds.get(path.id)!;
        const clipPathId = path.clipPathId
          ? nextIds.get(path.clipPathId) ?? path.clipPathId
          : undefined;
        return {
          ...clone(path),
          id: pathId,
          ...(clipPathId ? { clipPathId } : { clipPathId: undefined }),
          points: path.points.map((point, pointIndex) => ({
            ...point,
            id: `${pathId}-pt-${pointIndex}`,
          })),
          ...(path.holes
            ? {
                holes: path.holes.map((hole, holeIndex) =>
                  hole.map((point, pointIndex) => ({
                    ...point,
                    id: `${pathId}-h${holeIndex}-${pointIndex}`,
                  }))
                ),
              }
            : {}),
        };
      });
      const copy: Layer = {
        ...clone(target),
        id: `layer-${stamp}`,
        name: `${target.name} copy`,
        paths,
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

  /** Objects reorder inside their own layer; holding an arrow jumps to an end. */
  const movePath = useCallback(
    (id: string, direction: 'up' | 'down' | 'front' | 'back') => {
      applyLayers((prev) => {
        let changed = false;
        const next = prev.map((layer) => {
          const index = layer.paths.findIndex((p) => p.id === id);
          if (index < 0) return layer;
          const last = layer.paths.length - 1;
          const target =
            direction === 'front'
              ? last
              : direction === 'back'
                ? 0
                : direction === 'up'
                  ? index + 1
                  : index - 1;
          if (target < 0 || target > last || target === index) return layer;
          const paths = [...layer.paths];
          const [moved] = paths.splice(index, 1);
          paths.splice(target, 0, moved);
          changed = true;
          return { ...layer, paths };
        });
        // Same array back when the object is already at the end, so no empty
        // history step is pushed for a move that changes nothing.
        return changed ? next : prev;
      });
    },
    [applyLayers]
  );

  const dropFromSelection = useCallback((id: string) => {
    setSelection((prev) =>
      prev.selectedPathIds.includes(id)
        ? {
            selectedPathIds: prev.selectedPathIds.filter((x) => x !== id),
            selectedAnchorIndex: null,
            selectedHandleType: null,
          }
        : prev
    );
  }, []);

  const setPathVisible = useCallback(
    (id: string, visible: boolean) => {
      applyLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) => (p.id === id ? { ...p, visible } : p)),
        }))
      );
      if (!visible) dropFromSelection(id);
    },
    [applyLayers, dropFromSelection]
  );

  const setPathLock = useCallback(
    (id: string, locked: boolean) => {
      applyLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) => (p.id === id ? { ...p, locked } : p)),
        }))
      );
      if (locked) dropFromSelection(id);
    },
    [applyLayers, dropFromSelection]
  );

  const setPathOpacity = useCallback(
    (id: string, opacity: number) => {
      applyLayers(
        (prev) =>
          prev.map((layer) => ({
            ...layer,
            paths: layer.paths.map((p) => (p.id === id ? { ...p, opacity } : p)),
          })),
        { commit: false }
      );
      commitSoon();
    },
    [applyLayers, commitSoon]
  );

  /* ------------------------------------------------------------------ *
   * Align & distribute
   * One object lines up with the artboard; several line up with each other.
   * ------------------------------------------------------------------ */
  const alignSelection = useCallback(
    (mode: AlignMode) => {
      if (!selectedPaths.length) return;
      const artboard = {
        minX: 0,
        minY: 0,
        maxX: view.width,
        maxY: view.height,
        width: view.width,
        height: view.height,
        centerX: view.width / 2,
        centerY: view.height / 2,
      };
      const frame = selectedPaths.length > 1 ? computePathsBoundingBox(selectedPaths) : artboard;
      if (!frame) return;
      const aligned = alignPaths(selectedPaths, mode, frame);
      applyLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) => aligned.find((a) => a.id === p.id) ?? p),
        }))
      );
      haptic(8);
    },
    [applyLayers, selectedPaths, view.height, view.width]
  );

  const distributeSelection = useCallback(
    (axis: DistributeAxis) => {
      if (selectedPaths.length < 3) {
        notify('Select three or more objects');
        return;
      }
      const spaced = distributePaths(selectedPaths, axis);
      applyLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) => spaced.find((a) => a.id === p.id) ?? p),
        }))
      );
      haptic(8);
    },
    [applyLayers, notify, selectedPaths]
  );

  /** Trims the artboard to the artwork, then shifts it to a small margin. */
  const fitArtworkToArtboard = useCallback(() => {
    const visible = layersRef.current.flatMap((layer) =>
      layer.visible ? layer.paths.filter((p) => p.visible !== false) : []
    );
    const box = computePathsBoundingBox(visible);
    if (!box) {
      notify('Nothing to fit yet');
      return;
    }
    const pad = Math.max(8, Math.round(Math.max(box.width, box.height) * 0.06));
    const width = Math.max(16, Math.round(box.width + pad * 2));
    const height = Math.max(16, Math.round(box.height + pad * 2));
    const nextSettings = { ...settingsRef.current, width, height };
    settingsRef.current = nextSettings;
    setView((prev) => ({ ...prev, width, height }));
    applyLayers((prev) =>
      prev.map((layer) => ({
        ...layer,
        paths: layer.paths.map((p) => translatePaths([p], -box.minX + pad, -box.minY + pad)[0]),
      }))
    );
    markDirty();
    window.setTimeout(fitArtboard, 0);
    notify(`Artboard fitted to ${width} × ${height} px`);
  }, [applyLayers, fitArtboard, markDirty, notify]);

  /* ------------------------------------------------------------------ *
   * References
   * ------------------------------------------------------------------ */
  const addReference = useCallback((image: ReferenceImage) => {
    setReferences((prev) => [...prev, image]);
    markDirty();
    notify('Reference added');
  }, [markDirty, notify]);

  const updateReference = useCallback((image: ReferenceImage) => {
    setReferences((prev) => prev.map((r) => (r.id === image.id ? image : r)));
    markDirty();
  }, [markDirty]);

  const removeReference = useCallback((id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id));
    markDirty();
  }, [markDirty]);

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
    // Keep the file itself, not just the name, so the typeface survives a refresh.
    try {
      await saveFont(family, buffer.slice(0));
    } catch {
      /* still usable for this session */
    }
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
    void deleteFont(family);
  }, []);

  /* ------------------------------------------------------------------ *
   * Projects
   * ------------------------------------------------------------------ */
  const buildProject = useCallback(
    (overrides: Partial<StoredProject> = {}): StoredProject => {
      const now = Date.now();
      const grid: GridSettings = {
        visible: gridVisible,
        snap: gridSnap,
        spacingX: gridSpacingX,
        spacingY: gridSpacingY,
        opacity: gridOpacity,
        locked: gridLocked,
      };
      return {
        id: projectId,
        name: projectName,
        createdAt: now,
        updatedAt: now,
        layers: layersRef.current,
        guides: guidesRef.current,
        references,
        view: viewRef.current,
        thumbnailSvg: generateProjectThumbnailSvg(
          layersRef.current,
          viewRef.current.width,
          viewRef.current.height,
          artboardColor
        ),
        pathsCount: layersRef.current.reduce((n, l) => n + l.paths.length, 0),
        layersCount: layersRef.current.length,
        artboardColor: artboardColor,
        customFonts: customFonts,
        selectedFontFamily: selectedFontFamily,
        swatches: clone(swatches),
        grid,
        guidesLocked,
        ...overrides,
      };
    },
    [
      projectId,
      projectName,
      references,
      artboardColor,
      customFonts,
      selectedFontFamily,
      swatches,
      gridVisible,
      gridSnap,
      gridSpacingX,
      gridSpacingY,
      gridOpacity,
      gridLocked,
      guidesLocked,
    ]
  );

  const saveDocument = useCallback(
    async (nameOverride?: string, options: { silent?: boolean } = {}) => {
      const name = (nameOverride ?? projectName).trim() || 'Untitled';
      const id = projectId || `project-${Date.now()}`;
      const revision = editTickRef.current;
      try {
        await saveProject(buildProject({ id, name }));
        // A newer edit (or a different document) made this write stale. Leave
        // the dirty state to the pending autosave instead of overwriting it.
        if (editTickRef.current !== revision) return;
        setProjectId(id);
        setProjectName(name);
        localStorage.setItem(LAST_PROJECT_KEY, id);
        if (autosaveTimer.current) {
          window.clearTimeout(autosaveTimer.current);
          autosaveTimer.current = null;
        }
        setIsSaved(true);
        if (!options.silent) notify('Saved to this device');
      } catch {
        notify(options.silent ? 'Could not autosave — check device storage' : 'Could not save');
      }
    },
    [buildProject, notify, projectId, projectName]
  );

  const protectStorage = useCallback(async () => {
    const next = await requestStorageProtection();
    setStorageProtection(next);
    notify(
      next === 'granted'
        ? 'Browser storage is now protected'
        : 'Browser did not grant persistent storage — keep a backup'
    );
  }, [notify]);

  const exportBackup = useCallback(async () => {
    await saveDocument(undefined, { silent: true });
    // The preference writer is debounced; make the file match what is on screen.
    saveUserPrefs(currentPrefs);
    const summary = await downloadBackup();
    notify(
      `Backup saved · ${summary.projects} project${summary.projects === 1 ? '' : 's'} · ${summary.fonts} font${summary.fonts === 1 ? '' : 's'}`
    );
  }, [currentPrefs, notify, saveDocument]);

  const restoreBackup = useCallback(
    async (file: File) => {
      // Preserve the open document even if the backup does not contain it.
      await saveDocument(undefined, { silent: true });
      const summary = await restoreBackupFile(file);
      notify(
        `Restored ${summary.projects} project${summary.projects === 1 ? '' : 's'} and ${summary.fonts} font${summary.fonts === 1 ? '' : 's'} — reloading`
      );
      window.setTimeout(() => window.location.reload(), 900);
    },
    [notify, saveDocument]
  );

  // Autosave shortly after edits settle, so nothing depends on finding Save.
  // Deliberately no cleanup here: completing an older save must not cancel the
  // timer for a newer edit. The unmount effect below owns cancellation.
  useEffect(() => {
    if (isSaved) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      void saveDocument(undefined, { silent: true });
    }, 1400);
  }, [saveTick, isSaved, saveDocument]);

  const saveDocumentRef = useRef(saveDocument);
  saveDocumentRef.current = saveDocument;

  // Flush pending work when the tab is backgrounded or closed; the page may
  // disappear before the 1.4s debounce fires.
  useEffect(() => {
    const flush = () => {
      if (isSavedRef.current) return;
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      void saveDocumentRef.current(undefined, { silent: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, []);

  const openProject = useCallback(
    (project: StoredProject, options: { silent?: boolean } = {}) => {
      const nextLayers = sanitizeClipReferences(clone(project.layers));
      layersRef.current = nextLayers;
      setLayers(nextLayers);
      setProjectId(project.id);
      setProjectName(project.name);
      setReferences(clone(project.references ?? []));
      const initialLayer =
        [...nextLayers].reverse().find((layer) => layer.visible !== false && !layer.locked) ??
        nextLayers[nextLayers.length - 1];
      setActiveLayerId(initialLayer?.id ?? 'layer-1');
      setSelection({ ...emptySelection });
      setActivePathInProgress(null);
      const nextGuides = clone(project.guides ?? []);
      const nextSettings: DocumentSettings = {
        width: project.view?.width ?? viewRef.current.width,
        height: project.view?.height ?? viewRef.current.height,
        artboardColor: project.artboardColor ?? CANVAS.artboard,
        gridVisible: project.grid?.visible ?? gridVisible,
        gridSnap: project.grid?.snap ?? gridSnap,
        gridSpacingX: project.grid?.spacingX ?? gridSpacingX,
        gridSpacingY: project.grid?.spacingY ?? gridSpacingY,
        gridOpacity: project.grid?.opacity ?? gridOpacity,
        gridLocked: project.grid?.locked ?? gridLocked,
      };
      settingsRef.current = nextSettings;
      historyRef.current = {
        stack: [
          { layers: clone(nextLayers), guides: clone(nextGuides), settings: nextSettings },
        ],
        index: 0,
      };
      guidesRef.current = nextGuides;
      setGuides(nextGuides);
      // The grid is part of the document. Documents saved before this field
      // existed simply keep whatever grid is currently active.
      if (project.grid) {
        const g = project.grid;
        setGridVisible(g.visible);
        setGridSnap(g.snap);
        setGridSpacingX(g.spacingX);
        setGridSpacingY(g.spacingY);
        setGridOpacity(g.opacity);
        setGridLocked(g.locked);
      }
      if (typeof project.guidesLocked === 'boolean') setGuidesLocked(project.guidesLocked);
      setSwatches(clone(project.swatches ?? []));
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      editVersionRef.current += 1;
      historyVersionRef.current = editVersionRef.current;
      // Invalidate any save of the previous document that is still in flight.
      editTickRef.current += 1;
      localStorage.setItem(LAST_PROJECT_KEY, project.id);
      syncHistoryFlags();
      setIsSaved(true);
      if (project.view) setView(project.view);
      else window.setTimeout(fitArtboard, 0);
      // Restore artboard color and fonts from saved project. Fonts are a global
      // library, so anything the document names is merged into it rather than
      // replacing what is already installed.
      if (project.artboardColor) setArtboardColor(project.artboardColor);
      if (project.customFonts?.length) {
        setCustomFonts((prev) => [
          ...new Set([...prev, ...project.customFonts!]),
        ]);
      }
      if (project.selectedFontFamily) setSelectedFontFamily(project.selectedFontFamily);
      if (!options.silent) notify(`Opened “${project.name}”`);
    },
    [fitArtboard, notify, syncHistoryFlags]
  );

  const newDocument = useCallback(async () => {
    // Stop the previous document's pending write before creating this one.
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
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
      artboardColor: CANVAS.artboard,
      customFonts: [],
      selectedFontFamily: 'Plus Jakarta Sans, sans-serif',
    };
    await saveProject(project);
    openProject(project);
  }, [openProject]);

  const openTemplate = useCallback(
    async (template: LogoTemplate) => {
      const project: StoredProject = {
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
        artboardColor: CANVAS.artboard,
        customFonts: [],
        selectedFontFamily: 'Plus Jakarta Sans, sans-serif',
      };
      // A blueprint is a real saved document, not a preview. Without this it
      // opened with isSaved=true and vanished on the next reload.
      try {
        await saveProject(project);
        openProject(project);
      } catch {
        notify('Could not open that blueprint');
      }
    },
    [notify, openProject]
  );

  // Boot: reopen the document that was last on the artboard. Autosave keeps it
  // current, so a refresh (or a detour to another app) never loses the work.
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    let cancelled = false;

    const boot = async () => {
      try {
        await seedInitialProjectsIfEmpty();
      } catch {
        /* starting empty is fine */
      }

      // Re-register every imported typeface from long-term storage, so text
      // keeps its real font instead of falling back after a reload.
      try {
        const storedFonts = await loadAllFonts();
        if (cancelled) return;
        const families: string[] = [];
        for (const font of storedFonts) {
          try {
            const face = new FontFace(font.family, font.data.slice(0));
            const loaded = await face.load();
            document.fonts.add(loaded);
            fontFacesRef.current.set(font.family, loaded);
            families.push(font.family);
          } catch {
            /* an unreadable file should not block the rest */
          }
        }
        if (families.length) {
          setCustomFonts((prev) => [...new Set([...families, ...prev])]);
        }
      } catch {
        /* no stored fonts yet */
      }

      const lastId = localStorage.getItem(LAST_PROJECT_KEY);
      if (!cancelled && lastId) {
        const project = await getProject(lastId).catch(() => null);
        if (!cancelled && project) openProject(project, { silent: true });
      }

      if (!localStorage.getItem('pentix.onboarded')) {
        setSheet('start');
        localStorage.setItem('pentix.onboarded', 'true');
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [openProject]);

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

      // Preview owns the screen: nothing edits, deletes or switches tools
      // until it closes. Escape is the only way out from the keyboard.
      if (previewMode) {
        if (e.key === 'Escape') setPreviewMode(false);
        return;
      }

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
          else if (drawInsideId) setDrawInsideId(null);
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
        case 'n':
          changeTool('pencil');
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
    drawInsideId,
    duplicateSelection,
    pasteClipboard,
    redo,
    previewMode,
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
      {!previewMode && (
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
        onPreview={togglePreview}
      />
      )}

      <main ref={canvasWrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <Canvas
          view={view}
          onViewChange={setView}
          layers={layers}
          activeLayerId={activeLayerId}
          onUpdatePath={updatePath}
          onAddPath={addPath}
          tool={previewMode ? 'hand' : tool}
          shapeKind={shapeKind}
          shapeSides={shapeSides}
          modifiers={modifiers}
          selection={previewMode ? emptySelection : selection}
          onSelectionChange={setSelection}
          gridVisible={previewMode ? false : gridVisible}
          gridSnapEnabled={gridSnap}
          gridSpacingX={gridSpacingX}
          gridSpacingY={gridSpacingY}
          gridOpacity={gridOpacity}
          artboardColor={artboardColor}
          rulersVisible={previewMode ? false : rulersVisible}
          guides={previewMode ? [] : guides}
          guidesLocked={guidesLocked}
          onAddGuide={addGuide}
          onUpdateGuide={moveGuideLive}
          onCommitGuides={finishGuideDrag}
          fillGradient={fillType === 'gradient' ? fillGradient : null}
          fillOpacity={fillOpacity}
          strokeOpacity={strokeOpacity}
          eyedropperActive={!previewMode && samplingTarget !== null}
          onSamplePoint={sampleColorAt}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          pencilSmoothing={pencilSmoothing}
          pressureConfig={pressureConfig}
          onCommitHistory={commitHistory}
          activePathInProgress={previewMode ? null : activePathInProgress}
          setActivePathInProgress={setActivePathInProgress}
          drawInsideId={previewMode ? null : drawInsideId}
          onReplacePaths={replacePaths}
          isPanZoomLocked={panZoomLocked}
          smartGuidesEnabled={smartGuides}
          referenceImages={previewMode ? [] : references}
          onUpdateReference={updateReference}
          sbMode={sbMode}
          clipArtboard={previewMode ? true : clipArtboard}
          onRequestText={(point) => openTextSheet({ origin: point, path: null })}
          onEditText={(path) => openTextSheet({ path })}
          onToolSwitch={changeTool}
          hideTransformBox={previewMode || nudgePadOpen || !showTransforms}
          showPrecisionPad={previewMode ? false : showPrecisionPad}
        />

        {previewMode && (
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            aria-label="Exit preview"
            className="press absolute right-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-full border border-line bg-ink-2/85 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-dim shadow-lg shadow-black/30 backdrop-blur"
          >
            <EyeOff size={13} />
            Exit preview
          </button>
        )}

        {!previewMode && (
        <>
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
          onNudgeOpenChange={setNudgePadOpen}
        />
        </>
        )}
      </main>

      {!previewMode && (
      <>
      <ToolOptions
        tool={tool}
        selectedCount={selection.selectedPathIds.length}
        hasTextSelection={hasTextSelected}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        pencilSmoothing={pencilSmoothing}
        onChangePencilSmoothing={setPencilSmoothing}
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
        onSimplify={simplifySelection}
        onExpandStroke={expandStrokeSelection}
        canExpandStroke={canExpandStroke}
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
        cornerRadius={selectedPaths[0]?.cornerRadius ?? 0}
        cornerRadii={selectedPaths[0]?.cornerRadii}
        cornerIds={cornerIds}
        onMakeClipMask={makeClippingMask}
        onReleaseClipMask={releaseClippingMask}
        canMakeClipMask={selectedPaths.filter((p) => p.closed && !p.text).length >= 2}
        hasClipMask={selectedPaths.some((p) => !!p.clipPathId || p.isClippingMask === true)}
        canDrawInside={
          selectedPaths.filter((p) => p.closed && !p.text && !p.isClippingMask).length === 1
        }
        drawInsideName={drawInsidePath?.name ?? null}
        onStartDrawInside={startDrawInside}
        onExitDrawInside={exitDrawInside}
        extrudeDepth={selectedPaths[0]?.extrudeDepth ?? 0}
        extrudeAngle={selectedPaths[0]?.extrudeAngle ?? 45}
        extrudeTaper={selectedPaths[0]?.extrudeTaper ?? 0.16}
        extrudeShadow={selectedPaths[0]?.extrudeShadow !== false}
        canExtrude={selectedPaths.some((p) => p.closed && !p.text)}
        onExtrudeDepth={setExtrudeDepth}
        onExtrudeAngle={setExtrudeAngle}
        onExtrudeTaper={setExtrudeTaper}
        onExtrudeShadow={setExtrudeShadow}
        onAlign={alignSelection}
        onDistribute={distributeSelection}
      />

      <ToolDock
        currentTool={tool}
        onSelectTool={changeTool}
        onOpenShapes={() => {
          changeTool('shape');
          setSheet('shapes');
        }}
      />
      </>
      )}

      {/* ------------------------------ Sheets ------------------------------ */}
      <AppMenu
        open={sheet === 'menu'}
        onClose={closeSheet}
        projectName={projectName}
        onSave={() => {
          void saveDocument();
          closeSheet();
        }}
        onOpenBackup={() => setSheet('backup')}
        storageHint={storageProtectionHint(storageProtection)}
        onNewProject={() => {
          void newDocument();
          closeSheet();
        }}
        onOpenProjects={() => setSheet('projects')}
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
        showTransforms={showTransforms}
        onToggleTransforms={() => setShowTransforms((v) => !v)}
        showPrecisionPad={showPrecisionPad}
        onTogglePrecisionPad={() => setShowPrecisionPad((v) => !v)}
        onOpenPressure={() => setSheet('pressure')}
        onOpenFonts={() => setSheet('fonts')}
        onOpenReferences={() => setSheet('refs')}
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
        onSelectLayer={setActiveLayerId}
        onRenameLayer={(id, name) => {
          const layer = layersRef.current.find((l) => l.id === id);
          if (!layer || layer.name === name) return;
          applyLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
        }}
        onToggleLayerVisible={(id) => {
          const layer = layersRef.current.find((l) => l.id === id);
          if (!layer) return;
          const hiding = layer.visible !== false;
          applyLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
          );
          if (!hiding) return;

          // Hidden objects cannot be selected or exported, so drop them from
          // the selection instead of leaving an invisible transform target.
          const frozen = new Set(layer.paths.map((p) => p.id));
          setSelection((prev) => {
            const kept = prev.selectedPathIds.filter((pid) => !frozen.has(pid));
            if (kept.length === prev.selectedPathIds.length) return prev;
            return {
              selectedPathIds: kept,
              selectedAnchorIndex: null,
              selectedAnchorIndexes: [],
              selectedHandleType: null,
            };
          });
          if (activeLayerId === id) {
            const next = [...layersRef.current]
              .reverse()
              .find((l) => l.id !== id && l.visible !== false && !l.locked);
            if (next) setActiveLayerId(next.id);
          }
        }}
        onToggleLayerLock={(id) => {
          const layer = layersRef.current.find((l) => l.id === id);
          if (!layer) return;
          const locking = !layer.locked;
          applyLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
          );
          if (!locking) return;

          // Locking a layer freezes its objects, so they can no longer sit in
          // the selection and be moved out from under the lock.
          const frozen = new Set(layer.paths.map((p) => p.id));
          setSelection((prev) => {
            const kept = prev.selectedPathIds.filter((pid) => !frozen.has(pid));
            if (kept.length === prev.selectedPathIds.length) return prev;
            return {
              selectedPathIds: kept,
              selectedAnchorIndex: null,
              selectedAnchorIndexes: [],
              selectedHandleType: null,
            };
          });
          if (activeLayerId === id) {
            const next = [...layersRef.current]
              .reverse()
              .find((l) => l.id !== id && l.visible !== false && !l.locked);
            if (next) setActiveLayerId(next.id);
          }
        }}
        onAddLayer={addLayer}
        onDeleteLayer={deleteLayer}
        onDuplicateLayer={duplicateLayer}
        onMoveLayer={moveLayer}
        onMovePath={movePath}
        onUpdateLayerOpacity={(id, opacity) => {
          applyLayers(
            (prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)),
            { commit: false }
          );
          // A slider drag is one undo step, not one per pointer event.
          commitSoon();
        }}
        onSelectPath={(id) =>
          setSelection({ selectedPathIds: [id], selectedAnchorIndex: null, selectedHandleType: null })
        }
        onDeletePath={(id) => {
          applyLayers((prev) =>
            prev.map((l) => ({ ...l, paths: l.paths.filter((p) => p.id !== id) }))
          );
          pruneSelection(layersRef.current);
        }}
        onTogglePathVisible={(id, visible) => setPathVisible(id, visible)}
        onTogglePathLock={(id, locked) => setPathLock(id, locked)}
        onUpdatePathOpacity={(id, opacity) => setPathOpacity(id, opacity)}
      />

      <ReferencesSheet
        open={sheet === 'refs'}
        onClose={closeSheet}
        references={references}
        onUpdate={updateReference}
        onDelete={removeReference}
        onAdd={addReference}
        onTrace={(src) => {
          setTraceSrc(src);
          setSheet('trace');
        }}
        onTraceWithPen={() => changeTool('pen')}
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
        onUpdateBackground={updateArtboardColor}
        onResetBackground={() => {
          updateArtboardColor(CANVAS.artboard);
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
          rememberColor(color);
          // A drag through the picker is one undo step, not one per pixel.
          if (selection.selectedPathIds.length) patchSelectionSoon({ fill: color });
        }}
        onUpdateStroke={(color) => {
          setStrokeColor(color);
          rememberColor(color);
          if (selection.selectedPathIds.length) patchSelectionSoon({ stroke: color });
        }}
        recentColors={recentColors}
        previewPath={selectedPaths[0] ?? null}
        swatches={swatches}
        onAddSwatch={addSwatch}
        onRemoveSwatch={removeSwatch}
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

      <BackupSheet
        open={sheet === 'backup'}
        onClose={closeSheet}
        protection={storageProtection}
        onProtect={protectStorage}
        onExport={exportBackup}
        onRestore={restoreBackup}
      />

      <ProjectsSheet
        open={sheet === 'projects'}
        onClose={closeSheet}
        currentProjectId={projectId}
        onOpenProject={openProject}
        onRenameProject={(id, name) => {
          if (id !== projectId) return;
          setProjectName(name);
          markDirty();
        }}
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
        selectedPaths={selectedPaths}
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
        initialLetterSpacing={textEditPath?.letterSpacing ?? 0}
        initialFillColor={textEditPath?.fill ?? fillColor}
        customFonts={customFonts}
        recentFonts={recentFonts}
        editingPathId={textEditPath?.id ?? null}
        onSave={saveText}
      />

      <TraceSheet
        open={sheet === 'trace'}
        onClose={closeSheet}
        onTrace={(paths) => {
          const targetLayerId = resolveWritableLayerId();
          if (!targetLayerId) return;
          const stamped = paths.map((p, i) => ({ ...p, id: `${p.id}-${Date.now()}-${i}` }));
          applyLayers((prev) =>
            prev.map((l) =>
              l.id === targetLayerId ? { ...l, paths: [...l.paths, ...stamped] } : l
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
        onToggleGrid={() => commitSettings({ gridVisible: !gridVisible })}
        gridSnap={gridSnap}
        onToggleGridSnap={() => commitSettings({ gridSnap: !gridSnap })}
        gridSpacingX={gridSpacingX}
        gridSpacingY={gridSpacingY}
        onSpacingChange={(x, y) => commitSettings({ gridSpacingX: x, gridSpacingY: y })}
        gridOpacity={gridOpacity}
        onGridOpacityChange={(value) => commitSettings({ gridOpacity: value }, true)}
        gridLocked={gridLocked}
        onToggleGridLock={() => {
          const next = !gridLocked;
          commitSettings({ gridLocked: next });
          notify(next ? 'Grid locked — spacing fixed' : 'Grid unlocked');
        }}
        rulersVisible={rulersVisible}
        onToggleRulers={() => setRulersVisible((v) => !v)}
        guidesLocked={guidesLocked}
        onToggleGuidesLock={() => {
          const next = !guidesLocked;
          setGuidesLocked(next);
          markDirty();
          notify(next ? 'All guides locked' : 'Guides unlocked');
        }}
        guides={guides}
        onUpdateGuide={updateGuide}
        onRemoveGuide={removeGuide}
        onClearGuides={() => commitGuides([])}
        artboardColor={artboardColor}
        onEditBackground={() => {
          setColorMode('background');
          setSheet('color');
        }}
        onFitArtwork={fitArtworkToArtboard}
      />

      <StartSheet
        open={sheet === 'start'}
        onStartBlank={() => {
          void newDocument();
          closeSheet();
        }}
        onChooseTemplate={(template) => {
          void openTemplate(template);
          closeSheet();
        }}
        onClose={closeSheet}
      />

      <Toast message={toast} />
      </div>
    </div>
  );
}
