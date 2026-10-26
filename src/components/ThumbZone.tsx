import React, { useState } from 'react';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Move,
  Magnet,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ModifierState } from '../types/vector';

interface ThumbZoneProps {
  modifiers: ModifierState;
  onModifierChange: (mods: ModifierState) => void;
  onNudge: (dx: number, dy: number) => void;
  onTogglePointType: () => void;
  onDeleteSelectedPoint: () => void;
  onClosePath: () => void;
  gridSnapEnabled: boolean;
  onToggleGridSnap: () => void;
  hasSelectedPoint: boolean;
  isPenActive: boolean;
  activePathPointCount: number;
  onFinishPath?: () => void;
}

export const ThumbZone: React.FC<ThumbZoneProps> = ({
  modifiers,
  onModifierChange,
  onNudge,
  onTogglePointType,
  onDeleteSelectedPoint,
  onClosePath,
  gridSnapEnabled,
  onToggleGridSnap,
  hasSelectedPoint,
  isPenActive,
  activePathPointCount,
  onFinishPath,
}) => {
  const [nudgeStep, setNudgeStep] = useState<number>(1);
  const [showNudgePad, setShowNudgePad] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const toggleModifier = (key: keyof ModifierState) => {
    onModifierChange({
      ...modifiers,
      [key]: !modifiers[key],
    });
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-[98px] left-2 z-30">
        <button
          onClick={() => setIsMinimized(false)}
          className="h-7 px-2.5 rounded-lg bg-[#0D1322]/95 border border-slate-800 text-slate-300 font-semibold text-[11px] flex items-center gap-1.5 shadow-xl active:scale-95"
        >
          <Maximize2 size={12} className="text-cyan-400" />
          <span>Thumb Controls</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ================= LEFT THUMB ZONE ================= */}
      <aside 
        aria-label="Left Thumb Modifiers"
        className="fixed bottom-[98px] left-2 sm:left-4 z-30 flex flex-col gap-1 select-none pointer-events-none"
      >
        <div className="pointer-events-auto bg-[#0D1322]/95 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-xl flex flex-col gap-1 w-11">
          {/* SHIFT */}
          <button
            type="button"
            onClick={() => toggleModifier('shift')}
            className={`h-8 w-full rounded-lg flex flex-col items-center justify-center border text-[9px] font-bold transition-colors active:scale-95 ${
              modifiers.shift
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Shift modifier (45° snap / 1:1 aspect ratio)"
          >
            <span>SHIFT</span>
          </button>

          {/* CTRL */}
          <button
            type="button"
            onClick={() => toggleModifier('ctrl')}
            className={`h-8 w-full rounded-lg flex flex-col items-center justify-center border text-[9px] font-bold transition-colors active:scale-95 ${
              modifiers.ctrl
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Ctrl modifier (Direct selection)"
          >
            <span>CTRL</span>
          </button>

          {/* ALT */}
          <button
            type="button"
            onClick={() => toggleModifier('alt')}
            className={`h-8 w-full rounded-lg flex flex-col items-center justify-center border text-[9px] font-bold transition-colors active:scale-95 ${
              modifiers.alt
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Alt modifier (Subtract mode / Break handle)"
          >
            <span>ALT</span>
          </button>
        </div>
      </aside>

      {/* ================= RIGHT THUMB ZONE ================= */}
      <aside 
        aria-label="Right Thumb Actions"
        className="fixed bottom-[98px] right-2 sm:right-4 z-30 flex flex-col gap-1 select-none pointer-events-none items-end"
      >
        <div className="pointer-events-auto bg-[#0D1322]/95 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-xl flex flex-col gap-1 w-12">
          <div className="flex items-center justify-between pb-0.5 border-b border-slate-800 px-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-slate-500 hover:text-slate-200 mx-auto"
              title="Minimize thumb panel"
            >
              <Minimize2 size={11} />
            </button>
          </div>

          {/* Finish / Commit Path */}
          {isPenActive && activePathPointCount > 0 && (
            <button
              type="button"
              onClick={onFinishPath}
              className="h-10 w-full rounded-lg bg-cyan-400 text-slate-950 font-bold text-[10px] flex flex-col items-center justify-center active:scale-95 transition-all shadow-sm"
            >
              <Check size={14} />
              <span>Done ({activePathPointCount})</span>
            </button>
          )}

          {/* Smooth / Sharp Converter */}
          <button
            type="button"
            onClick={onTogglePointType}
            disabled={!hasSelectedPoint}
            className={`h-9 w-full rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center transition-colors ${
              hasSelectedPoint
                ? 'bg-slate-800 text-cyan-300 border-slate-700 hover:bg-slate-750'
                : 'bg-slate-900/50 text-slate-600 border-slate-850 cursor-not-allowed'
            }`}
            title="Convert Node (Smooth / Corner)"
          >
            <span>Node</span>
          </button>

          {/* Delete Node or Shape */}
          <button
            type="button"
            onClick={onDeleteSelectedPoint}
            className="h-9 w-full rounded-lg bg-slate-800 border border-slate-700 hover:border-rose-500/50 text-rose-300 font-semibold text-[10px] flex flex-col items-center justify-center transition-colors active:scale-95"
            title="Delete Selected Item"
          >
            <Trash2 size={12} />
            <span>Del</span>
          </button>

          {/* Precision Nudge D-Pad Toggle */}
          <button
            type="button"
            onClick={() => setShowNudgePad(!showNudgePad)}
            className={`h-8 w-full rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors ${
              showNudgePad
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Nudge Pad"
          >
            <Move size={11} />
          </button>

          {/* Grid Snap Toggle */}
          <button
            type="button"
            onClick={onToggleGridSnap}
            className={`h-7 w-full rounded-lg border flex items-center justify-center transition-colors ${
              gridSnapEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
            title="Snap to Grid"
          >
            <Magnet size={12} />
          </button>
        </div>

        {/* Precision Nudge D-Pad Flyout */}
        {showNudgePad && (
          <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl p-2 border border-slate-700 shadow-2xl flex flex-col items-center gap-1.5 animate-in fade-in duration-100">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onNudge(0, -nudgeStep)}
                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-cyan-600 rounded-t-lg active:scale-90 text-white"
              >
                <ChevronUp size={16} />
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onNudge(-nudgeStep, 0)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-cyan-600 rounded-l-lg active:scale-90 text-white"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="w-6 h-8 flex items-center justify-center bg-slate-950 text-[10px] font-mono text-cyan-400">
                  {nudgeStep}
                </div>
                <button
                  type="button"
                  onClick={() => onNudge(nudgeStep, 0)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-cyan-600 rounded-r-lg active:scale-90 text-white"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onNudge(0, nudgeStep)}
                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-cyan-600 rounded-b-lg active:scale-90 text-white"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Stepper buttons */}
            <div className="flex items-center gap-1 text-[9px] font-mono">
              {[0.5, 1, 5, 10].map((step) => (
                <button
                  key={step}
                  onClick={() => setNudgeStep(step)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    nudgeStep === step
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
