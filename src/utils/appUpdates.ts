/**
 * Service worker plumbing for the offline app and its updates.
 *
 * The worker does not call skipWaiting on install: a new build waits until the
 * page asks for it, so the editor is never swapped out from under a drawing.
 * The app then asks the registration whether a build is waiting, which is the
 * only reliable signal — `updatefound` and `statechange` both fire at moments
 * that race the registration promise.
 */
export type UpdateStatus = {
  /** A new build is installed and waiting for the page to take it */
  waiting: boolean;
  /** The page is controlled by a worker, so "waiting" means update, not install */
  controlled: boolean;
};

const UNSUPPORTED: UpdateStatus = { waiting: false, controlled: false };

let registration: ServiceWorkerRegistration | null = null;

export function registerAppUpdates(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const register = () => {
    // updateViaCache: 'none' keeps the browser from holding a stale worker
    // script, which would pin the old shell long after a deploy.
    // BASE_URL is "/" at the domain root and "/<repo>/" on GitHub project pages.
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg;
      })
      .catch(() => {
        /* offline support is optional; the editor still works */
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Whether a newer build is waiting, without touching the network. */
export async function updateStatus(): Promise<UpdateStatus> {
  if (!('serviceWorker' in navigator)) return UNSUPPORTED;
  try {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration());
    if (!reg) return UNSUPPORTED;
    registration = reg;
    return { waiting: Boolean(reg.waiting), controlled: Boolean(navigator.serviceWorker.controller) };
  } catch {
    return UNSUPPORTED;
  }
}

/**
 * Asks the browser whether a newer worker exists. Called when the app becomes
 * visible again, which is the cheap moment: one conditional request, no polling.
 */
export async function lookForUpdate(): Promise<UpdateStatus> {
  if (!('serviceWorker' in navigator)) return UNSUPPORTED;
  try {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration());
    if (!reg) return UNSUPPORTED;
    registration = reg;
    await reg.update().catch(() => {});
    return { waiting: Boolean(reg.waiting), controlled: Boolean(navigator.serviceWorker.controller) };
  } catch {
    return UNSUPPORTED;
  }
}

/** Swap the waiting worker in and reload once it takes control. */
export function applyPendingUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
