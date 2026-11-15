import { CANVAS, DARK_CANVAS, LIGHT_CANVAS } from '../theme';

export type ThemeChoice = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'pentix.theme';

const CHOICES: ThemeChoice[] = ['dark', 'light', 'system'];

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return CHOICES.includes(stored as ThemeChoice) ? (stored as ThemeChoice) : 'dark';
  } catch {
    return 'dark';
  }
}

export function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? systemTheme() : choice;
}

/**
 * Puts a theme into effect: the CSS tokens flip from the `data-theme`
 * attribute, and the SVG surfaces take the matching palette.
 */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const mode = resolveTheme(choice);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  Object.assign(CANVAS, mode === 'light' ? LIGHT_CANVAS : DARK_CANVAS);

  // The browser chrome around an installed app follows the theme too.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'light' ? '#eef0f3' : '#08090b');
  return mode;
}

export function storeThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* private mode: the choice lasts the session */
  }
}

/** Calls back when the OS theme changes, for the "system" choice. */
export function watchSystemTheme(onChange: () => void): () => void {
  try {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}
