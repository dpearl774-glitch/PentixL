/**
 * Feedback is only useful if it arrives with context. Everything here is read
 * from the browser at the moment of the report, so a tester on a phone never
 * has to answer "which device?" before their note is actionable.
 */

export const APP_VERSION = '1.0 (test build)';

export interface FeedbackContext {
  projectName: string;
  canvasWidth: number;
  canvasHeight: number;
  layers: number;
  objects: number;
}

const bytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

/** Synchronous estimate: what this origin currently holds in localStorage. */
const localStorageSize = (): string => {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
    return bytes(total * 2); // UTF-16 code units
  } catch {
    return 'unavailable';
  }
};

const isStandalone = (): boolean => {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS reports it on the navigator, not in a media query.
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

export const buildDiagnostics = (context: FeedbackContext): string => [
  `App: ${APP_VERSION}`,
  `When: ${new Date().toISOString()}`,
  `Screen: ${window.screen.width} × ${window.screen.height} css px @ ${window.devicePixelRatio}x`,
  `Viewport: ${window.innerWidth} × ${window.innerHeight}`,
  `Installed app: ${isStandalone() ? 'yes' : 'no'}`,
  `Canvas: ${context.canvasWidth} × ${context.canvasHeight} px`,
  `Document: ${context.projectName} · ${context.layers} layer${context.layers === 1 ? '' : 's'} · ${context.objects} object${context.objects === 1 ? '' : 's'}`,
  `Local storage: ${localStorageSize()}`,
  `User agent: ${navigator.userAgent}`,
].join('\n');

export const buildReport = (kind: string, message: string, context: FeedbackContext): string => {
  const note = message.trim() || '(no message)';
  return [
    'Pentix feedback',
    `Type: ${kind}`,
    '',
    note,
    '',
    '--- diagnostics ---',
    buildDiagnostics(context),
  ].join('\n');
};
