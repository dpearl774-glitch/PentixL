/**
 * Canvas rendering palette.
 *
 * The SVG surface is painted with these values, so they live in TS rather
 * than CSS. Keep them in sync with the tokens in index.css.
 */
export const CANVAS = {
  /** Artboard paper */
  artboard: '#101216',
  artboardEdge: '#2c3138',
  /** Page behind the artboard */
  page: '#08090b',
  grid: '#3c424b',
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
} as const;

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
