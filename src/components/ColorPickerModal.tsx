import React, { useState } from 'react';
import { X, Pipette, Ban, Check, Sliders } from 'lucide-react';
import { StrokeCap, StrokeJoin } from '../types/vector';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'fill' | 'stroke';
  onModeChange: (mode: 'fill' | 'stroke') => void;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeCap: StrokeCap;
  strokeJoin: StrokeJoin;
  onUpdateFill: (color: string) => void;
  onUpdateStroke: (color: string) => void;
  onUpdateStrokeWidth: (width: number) => void;
  onUpdateStrokeCap: (cap: StrokeCap) => void;
  onUpdateStrokeJoin: (join: StrokeJoin) => void;
}

const PALETTE = [
  '#00E5FF', '#38BDF8', '#0284C7', '#2563EB', '#4F46E5', '#7C3AED', '#9333EA',
  '#C026D3', '#DB2777', '#E11D48', '#EF4444', '#EA580C', '#D97706', '#CA8A04',
  '#16A34A', '#059669', '#0D9488', '#0891B2', '#FFFFFF', '#CBD5E1', '#64748B',
  '#334155', '#1E293B', '#0F172A', '#020617', '#FBBF24', '#F43F5E', '#10B981',
];

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  onClose,
  mode,
  onModeChange,
  fillColor,
  strokeColor,
  strokeWidth,
  strokeCap,
  strokeJoin,
  onUpdateFill,
  onUpdateStroke,
  onUpdateStrokeWidth,
  onUpdateStrokeCap,
  onUpdateStrokeJoin,
}) => {
  if (!isOpen) return null;

  const currentColor = mode === 'fill' ? fillColor : strokeColor;
  const isNone = currentColor === 'none';
  const effectiveColor = isNone ? '#00E5FF' : currentColor;

  const handleApplyColor = (hex: string) => {
    if (mode === 'fill') {
      onUpdateFill(hex);
    } else {
      onUpdateStroke(hex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 select-none">
        {/* Header with Fill / Stroke Tabs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => onModeChange('fill')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                mode === 'fill'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fill
            </button>
            <button
              type="button"
              onClick={() => onModeChange('stroke')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                mode === 'stroke'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stroke
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex flex-col gap-4">
          {/* Active Preview & Native Color Picker Button */}
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
              {isNone ? (
                <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
                  <div className="w-[120%] h-0.5 bg-rose-500 rotate-45 absolute" />
                </div>
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: currentColor }}
                />
              )}
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {mode === 'fill' ? 'Fill Color' : 'Stroke Color'}
                </span>
                {isNone && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                    NONE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Native Picker Trigger */}
                <label className="relative cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-semibold text-slate-200 transition-colors">
                  <Pipette size={13} className="text-cyan-400" />
                  <span>Color Spectrum</span>
                  <input
                    type="color"
                    value={effectiveColor}
                    onChange={(e) => handleApplyColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>

                {/* No Fill / No Stroke Button */}
                <button
                  type="button"
                  onClick={() => handleApplyColor('none')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isNone
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}
                  title={mode === 'fill' ? 'No Fill (Transparent)' : 'No Stroke (Zero Outline)'}
                >
                  <Ban size={12} className="text-rose-400" />
                  <span>{mode === 'fill' ? 'No Fill' : 'No Stroke'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stroke Width & Profile Settings (when mode === 'stroke') */}
          {mode === 'stroke' && (
            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Stroke Thickness</span>
                <span className="font-mono text-cyan-400 font-bold text-xs">{strokeWidth} px</span>
              </div>

              <input
                type="range"
                min="0.5"
                max="32"
                step="0.5"
                value={strokeWidth}
                onChange={(e) => onUpdateStrokeWidth(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span>Caps:</span>
                <div className="flex items-center gap-1">
                  {(['round', 'square', 'butt'] as StrokeCap[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateStrokeCap(c)}
                      className={`px-2 py-0.5 rounded capitalize text-[10px] font-semibold border ${
                        strokeCap === c
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preset Swatches Palette */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Logo Palette
            </span>
            <div className="grid grid-cols-7 gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleApplyColor(c)}
                  className={`w-full aspect-square rounded-lg border transition-transform active:scale-95 ${
                    currentColor.toLowerCase() === c.toLowerCase()
                      ? 'border-cyan-400 scale-110 shadow-md shadow-cyan-400/50'
                      : 'border-slate-700/80 hover:border-slate-500'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer Done Button */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-cyan-400/25 flex items-center justify-center gap-1.5 active:scale-98 transition-all"
          >
            <Check size={14} />
            <span>Apply Style</span>
          </button>
        </div>
      </div>
    </div>
  );
};
