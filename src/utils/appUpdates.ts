/**
 * Update plumbing for the service worker.
 *
 * The worker no longer calls skipWaiting on install: a new build waits until a
 * page asks for it, so the editor is never swapped out from under a drawing.
 * That leaves exactly one job here — notice the waiting worker, and say so.
 */
export const UPDATE_READY_EVENT = 'pentix:update-ready';

let registration: ServiceWorkerRegistration | null = null;
let announced = false;

const announce = () => {
  if (announced) return;
  announced = true;
  window.dispatchEvent(new Event(UPDATE_READY_EVENT));
};

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

        // A worker already waiting when the page opens — a deploy landed while
        // the app was closed — is an update the user has not seen.
        if (reg.waiting && navigator.serviceWorker.controller) announce();

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // No controller means this is the first install, not an update.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) announce();
          });
        });

        // Coming back to the tab is the cheap moment to look for a new build.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* offline support is optional; the editor still works */
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
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
