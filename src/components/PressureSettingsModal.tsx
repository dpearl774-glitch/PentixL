import React from 'react';
import { X, Brush, Sliders, Smartphone, PenTool, Check } from 'lucide-react';
import { PressureConfig } from '../types/vector';

interface PressureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PressureConfig;
  onChangeConfig: (newConfig: PressureConfig) => void;
}

export const PressureSettingsModal: React.FC<PressureSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Brush size={18} className="text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Touch & Stylus Pressure Engine</h2>
              <p className="text-[11px] text-slate-400">Pro vector tapering for fingers & pens alike</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Source Modes */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-300">Input Pressure Engine:</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onChangeConfig({ ...config, source: 'stylus-or-touch' })}
              className={`p-3 rounded-2xl border text-left transition-all ${
                config.source === 'stylus-or-touch'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <Smartphone size={16} className="text-cyan-400" />
                {config.source === 'stylus-or-touch' && <Check size={14} className="text-cyan-400" />}
              </div>
              <div className="text-xs font-bold mt-2">Touch Velocity & Stylus</div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Dynamic speed-to-taper curves for fingers + native Apple Pencil / S-Pen support.
              </p>
            </button>

            <button
              onClick={() => onChangeConfig({ ...config, source: 'fixed' })}
              className={`p-3 rounded-2xl border text-left transition-all ${
                config.source === 'fixed'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <PenTool size={16} className="text-cyan-400" />
                {config.source === 'fixed' && <Check size={14} className="text-cyan-400" />}
              </div>
              <div className="text-xs font-bold mt-2">Uniform Monoline</div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Precise constant thickness for architectural and technical logo emblems.
              </p>
            </button>
          </div>
        </div>

        {/* Min & Max Width Sliders */}
        <div className="flex flex-col gap-3 pt-1">
          {/* Min Width */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Minimum Stroke Taper (Fast Flick)</span>
              <span className="font-mono text-cyan-400">{config.minWidth} px</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={config.minWidth}
              onChange={(e) => onChangeConfig({ ...config, minWidth: parseInt(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Max Width */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Maximum Stroke Weight (Slow Press)</span>
              <span className="font-mono text-cyan-400">{config.maxWidth} px</span>
            </div>
            <input
              type="range"
              min="8"
              max="50"
              step="1"
              value={config.maxWidth}
              onChange={(e) => onChangeConfig({ ...config, maxWidth: parseInt(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Calligraphic Slant Angle */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Calligraphic Nib Angle</span>
              <span className="font-mono text-cyan-400">{config.calligraphyAngle}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={config.calligraphyAngle}
              onChange={(e) => onChangeConfig({ ...config, calligraphyAngle: parseInt(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Visual Stroke Preview */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Live Stroke Profile</span>
          <svg width="240" height="40" viewBox="0 0 240 40" className="overflow-visible">
            <path
              d={`M 10 20 Q 70 ${20 - config.maxWidth / 3}, 120 20 T 230 20`}
              fill="none"
              stroke="#00E5FF"
              strokeWidth={(config.minWidth + config.maxWidth) / 2}
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors shadow-lg shadow-cyan-400/20 active:scale-98"
        >
          Apply Pressure Config
        </button>
      </div>
    </div>
  );
};
