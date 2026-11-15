/**
 * Canvas rendering palette.
 *
 * The SVG surface is painted with these values, so they live in TS rather
 * than CSS. Keep them in sync with the tokens in index.css.
 */
export interface CanvasPalette {
  artboard: string;
  artboardEdge: string;
  page: string;
  grid: string;
  accent: string;
  accentSoft: string;
  erase: string;
  eraseSoft: string;
  node: string;
  nodeActive: string;
  nodeEdge: string;
  handle: string;
  ink: string;
}

export const DARK_CANVAS: CanvasPalette = {
  /** Artboard paper */
  artboard: '#101216',
  /** Hairline around the paper — a border, not a drawn shape */
  artboardEdge: '#23272f',
  /** Page behind the artboard */
  page: '#08090b',
  /** Alignment grid: present when asked for, never competing with artwork */
  grid: '#2e343c',
  /** Single accent used for selection, handles, smart guides */
  accent: '#4c8dff',
  accentSoft: 'rgba(76, 141, 255, 0.16)',
  /** Destructive / erase mode */
  erase: '#ff6b6b',
  eraseSoft: 'rgba(255, 107, 107, 0.18)',
  /** Anchor nodes */
  node: '#f5f7f2',
  nodeActive: '#4c8dff',
  nodeEdge: '#08090b',
  /** Secondary curve handle colour */
  handle: '#5b8de0',
  /** Ink text on light chips */
  ink: '#0b0d10',
};

/**
 * Light theme: paper is the page, the workspace is a soft grey. The accent and
 * the erase red stay put — a selection reads the same in either mode.
 */
export const LIGHT_CANVAS: CanvasPalette = {
  artboard: '#ffffff',
  artboardEdge: '#ccd2da',
  page: '#eef0f3',
  grid: '#c9cfd8',
  accent: '#2f6fdb',
  accentSoft: 'rgba(47, 111, 219, 0.16)',
  erase: '#cf4444',
  eraseSoft: 'rgba(207, 68, 68, 0.16)',
  node: '#14171c',
  nodeActive: '#2f6fdb',
  nodeEdge: '#ffffff',
  handle: '#3f6fc0',
  ink: '#ffffff',
};

/**
 * The palette the SVG surface paints with. Mutated in place on a theme change:
 * the palettes are read during render, and the switch always comes with a
 * re-render of the editor, so every surface picks the new values up.
 */
export const CANVAS: CanvasPalette = { ...DARK_CANVAS };

export const KEYBOARD_LABEL: Record<'shift' | 'ctrl' | 'alt', string> = {
  shift: '⇧',
  ctrl: '⌃',
  alt: '⌥',
};

/** Light haptic tap where the platform supports it. */
export function haptic(pattern: number | number[] = 8): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* not supported — silent */
  }
}
