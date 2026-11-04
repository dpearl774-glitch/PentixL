import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Pentix recovered from a render error', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-ink-0 px-6 text-text">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-1 p-5">
          <div className="label-mono mb-2">Recovery</div>
          <h1 className="text-[17px] font-bold tracking-tight">This document hit an error.</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-mute">
            Your last saved copy is still on this device. Reload to reopen it, or clear only the
            last-opened link if the broken document keeps reopening.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="press h-10 rounded-xl bg-accent text-[12.5px] font-bold text-ink-0"
            >
              Reload Pentix
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('pentix.lastProjectId');
                window.location.reload();
              }}
              className="press h-10 rounded-xl border border-line bg-ink-2 text-[12.5px] font-semibold text-dim"
            >
              Clear last-opened link
            </button>
          </div>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // updateViaCache: 'none' keeps the browser from holding a stale worker
    // script, which would pin the old shell long after a deploy.
    // BASE_URL is "/" at the domain root and "/<repo>/" on GitHub project pages.
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .catch(() => {
      /* offline support is optional; the editor still works */
    });
  });
}
