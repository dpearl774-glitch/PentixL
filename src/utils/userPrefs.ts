import type { PencilSmoothing, PressureConfig, ShapeKind, StrokeCap, StrokeJoin, ToolType } from '../types/vector';

/**
 * Session settings — everything that is a preference rather than artwork.
 * Grid, rulers, snapping, tool state and paint defaults all live here so a
 * refresh (or coming back tomorrow) restores the workspace exactly as it was.
 * Document content still lives in IndexedDB with the project.
 */
export interface UserPrefs {
  /* Canvas editing aids */
  gridVisible: boolean;
  gridSnap: boolean;
  gridSpacingX: number;
  gridSpacingY: number;
  gridOpacity: number;
  gridLocked: boolean;
  rulersVisible: boolean;
  guidesLocked: boolean;
  smartGuides: boolean;
  panZoomLocked: boolean;
  clipArtboard: boolean;
  showTransforms: boolean;
  precisionPad: boolean;

  /* Tool state */
  tool: ToolType;
  /** Pencil fidelity: how closely the fitted curve follows the finger */
  pencilSmoothing: PencilSmoothing;
  shapeKind: ShapeKind;
  shapeSides: number;
  sbMode: 'merge' | 'erase';

  /* Paint defaults applied to new artwork */
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  strokeOpacity: number;
  fillType: 'solid' | 'gradient';
  strokeWidth: number;
  strokeCap: StrokeCap;
  strokeJoin: StrokeJoin;
  pressure: PressureConfig;
  selectedFontFamily: string;
  /** Newest-first colours applied from the picker, so they can be recalled */
  recentColors: string[];
  /** Newest-first typefaces chosen in the text sheet */
  recentFonts: string[];
}

export const DEFAULT_PREFS: UserPrefs = {
  gridVisible: true,
  gridSnap: false,
  gridSpacingX: 25,
  gridSpacingY: 25,
  gridOpacity: 0.4,
  gridLocked: false,
  rulersVisible: true,
  guidesLocked: false,
  smartGuides: true,
  panZoomLocked: false,
  clipArtboard: false,
  showTransforms: true,
  precisionPad: true,

  tool: 'select',
  pencilSmoothing: 'smooth',
  shapeKind: 'rectangle',
  shapeSides: 6,
  sbMode: 'merge',

  fillColor: '#4c8dff',
  strokeColor: '#e8eaed',
  fillOpacity: 1,
  strokeOpacity: 1,
  fillType: 'solid',
  strokeWidth: 2,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressure: {
    source: 'stylus-or-touch',
    minWidth: 2,
    maxWidth: 24,
    smoothing: 0.7,
    calligraphyAngle: 30,
  },
  selectedFontFamily: 'Plus Jakarta Sans, sans-serif',
  recentColors: [],
  recentFonts: ['Plus Jakarta Sans, sans-serif'],
};

const KEY = 'pentix.prefs.v1';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback: string, test?: RegExp) =>
  typeof v === 'string' && (!test || test.test(v)) ? v : fallback;

const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate any preference-shaped value, falling back field by field so a
 * stale record, or a restored backup, can never break startup.
 */
export function sanitizeUserPrefs(raw: unknown): UserPrefs {
  const d = DEFAULT_PREFS;
  if (!isRecord(raw)) return { ...d, pressure: { ...d.pressure } };

  const p = raw;
  const pressure = isRecord(p.pressure) ? p.pressure : {};

  return {
    gridVisible: bool(p.gridVisible, d.gridVisible),
    gridSnap: bool(p.gridSnap, d.gridSnap),
    gridSpacingX: num(p.gridSpacingX, d.gridSpacingX, 1, 500),
    gridSpacingY: num(p.gridSpacingY, d.gridSpacingY, 1, 500),
    gridOpacity: num(p.gridOpacity, d.gridOpacity, 0.05, 1),
    gridLocked: bool(p.gridLocked, d.gridLocked),
    rulersVisible: bool(p.rulersVisible, d.rulersVisible),
    guidesLocked: bool(p.guidesLocked, d.guidesLocked),
    smartGuides: bool(p.smartGuides, d.smartGuides),
    panZoomLocked: bool(p.panZoomLocked, d.panZoomLocked),
    clipArtboard: bool(p.clipArtboard, d.clipArtboard),
    showTransforms: bool(p.showTransforms, d.showTransforms),
    precisionPad: bool(p.precisionPad, d.precisionPad),

    pencilSmoothing: oneOf(p.pencilSmoothing, ['tight', 'smooth', 'loose'] as const, d.pencilSmoothing),
    tool: oneOf(
      p.tool,
      [
        'select',
        'direct-select',
        'pen',
        'pencil',
        'shape-builder',
        'shape',
        'pressure-brush',
        'text',
        'hand',
      ] as const,
      d.tool
    ),
    shapeKind: oneOf(
      p.shapeKind,
      [
        'rectangle',
        'rounded-rect',
        'circle',
        'semicircle',
        'triangle',
        'polygon',
        'octagon',
        'star',
        'star8',
        'heart',
        'shield',
        'arrow',
        'diamond',
        'ring',
        'pill',
        'crescent',
        'line',
      ] as const,
      d.shapeKind
    ),
    shapeSides: num(p.shapeSides, d.shapeSides, 3, 12),
    sbMode: oneOf(p.sbMode, ['merge', 'erase'] as const, d.sbMode),

    fillColor: str(p.fillColor, d.fillColor, HEX),
    strokeColor: str(p.strokeColor, d.strokeColor, HEX),
    fillOpacity: num(p.fillOpacity, d.fillOpacity, 0, 1),
    strokeOpacity: num(p.strokeOpacity, d.strokeOpacity, 0, 1),
    fillType: oneOf(p.fillType, ['solid', 'gradient'] as const, d.fillType),
    strokeWidth: num(p.strokeWidth, d.strokeWidth, 0, 200),
    strokeCap: oneOf(p.strokeCap, ['round', 'butt', 'square'] as const, d.strokeCap),
    strokeJoin: oneOf(p.strokeJoin, ['round', 'miter', 'bevel'] as const, d.strokeJoin),
    pressure: {
      source: oneOf(
        pressure.source,
        ['stylus-or-touch', 'velocity', 'fixed'] as const,
        d.pressure.source
      ),
      minWidth: num(pressure.minWidth, d.pressure.minWidth, 0, 60),
      maxWidth: num(pressure.maxWidth, d.pressure.maxWidth, 1, 120),
      smoothing: num(pressure.smoothing, d.pressure.smoothing, 0, 1),
      calligraphyAngle: num(pressure.calligraphyAngle, d.pressure.calligraphyAngle, 0, 360),
    },
    selectedFontFamily: str(p.selectedFontFamily, d.selectedFontFamily),
    recentColors: Array.isArray(p.recentColors)
      ? (p.recentColors as unknown[])
          .filter((c): c is string => typeof c === 'string' && HEX.test(c))
          .slice(0, 12)
      : d.recentColors,
    recentFonts: Array.isArray(p.recentFonts)
      ? (p.recentFonts as unknown[])
          .filter((f): f is string => typeof f === 'string' && f.length > 0)
          .slice(0, 8)
      : d.recentFonts,
  };
}

/** Read the stored preferences and validate them against the current schema. */
export function loadUserPrefs(): UserPrefs {
  let raw: unknown = null;
  try {
    const text = window.localStorage.getItem(KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  return sanitizeUserPrefs(raw);
}

/** Write the preferences back; storage failures (private mode, quota) are non-fatal. */
export function saveUserPrefs(prefs: UserPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* preferences simply do not persist in this context */
  }
}

/** Loaded once at module scope so every state hook reads the same values. */
export const userPrefs: UserPrefs = loadUserPrefs();
