/**
 * Crash capture.
 *
 * Testers report from a phone with no console, so an unhandled error has to
 * turn into something they can send. Nothing leaves the device: the report is
 * prepared locally and the feedback sheet picks it up as a draft.
 */

export interface CrashDetail {
  message: string;
  stack?: string;
  at: string;
  userAgent: string;
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/** A paste-ready crash note, trimmed so it fits in a textarea. */
export function formatCrash(error: unknown): string {
  const { message, stack } = describe(error);
  const detail: CrashDetail = {
    message,
    stack,
    at: new Date().toISOString(),
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
  };

  const lines = [
    'Crash while using Pentix',
    '',
    `What happened: ${detail.message}`,
    `When: ${detail.at}`,
    `Browser: ${detail.userAgent}`,
  ];
  if (detail.stack) {
    // Three frames is enough to place the fault; a full stack drowns the report.
    const frames = detail.stack.split('\n').slice(0, 4).join('\n');
    lines.push('', 'Trace:', '```', frames, '```');
  }
  return lines.join('\n');
}

/**
 * Routes uncaught errors and rejected promises to a handler. Returns an
 * unsubscribe for React's cleanup; wrapping in a try/catch means a browser
 * without an event that matters cannot break startup.
 */
export function installCrashCapture(report: (text: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onError = (event: ErrorEvent) => {
    report(formatCrash(event.error ?? event.message));
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    report(formatCrash(event.reason));
  };

  try {
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
  } catch {
    return () => undefined;
  }

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
