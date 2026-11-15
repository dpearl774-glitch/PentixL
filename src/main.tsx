import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ensureBundledFonts } from './utils/bundledFonts';
import { registerAppUpdates } from './utils/appUpdates';
import { applyTheme, readThemeChoice } from './utils/appearance';
import { formatCrash } from './utils/crashReport';

// Before the first paint: a light-mode user must never see a dark flash.
applyTheme(readThemeChoice());

// Start the bundled faces loading immediately; conversion awaits the same promise.
void ensureBundledFonts();

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean; report: string }
> {
  state = { failed: false, report: '' };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Pentix recovered from a render error', error);
    // Kept in state so the fallback can hand it over; the console is invisible
    // to someone holding a phone.
    this.setState({ report: formatCrash(error) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-ink-0 px-6 text-text">
        <div className="w-full max-w-sm rounded-xl border border-line bg-ink-1 p-5">
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
              className="press h-10 rounded-lg bg-accent text-[12.5px] font-bold text-ink-0"
            >
              Reload Pentix
            </button>
            {this.state.report && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(this.state.report).catch(() => undefined);
                }}
                className="press h-10 rounded-lg border border-line bg-ink-2 text-[12.5px] font-semibold text-dim"
              >
                Copy crash report
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('pentix.lastProjectId');
                window.location.reload();
              }}
              className="press h-10 rounded-lg border border-line bg-ink-2 text-[12.5px] font-semibold text-dim"
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

// Registers the offline shell and listens for a new build waiting to take over.
registerAppUpdates();
