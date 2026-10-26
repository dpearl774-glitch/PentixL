import React, { useState } from 'react';
import {
  Copy,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  Combine,
  Scissors,
  Sparkles,
  Layers,
  Palette,
  Minus,
  Plus,
  CornerUpRight,
  Ban,
  Spline,
  Pipette,
  Edit3,
} from 'lucide-react';
import { BooleanOperation } from '../utils/shapeBuilder';

interface ContextualBarProps {
  selectedCount: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  onUpdateFill: (color: string) => void;
  onUpdateStroke: (color: string) => void;
  onUpdateStrokeWidth: (width: number) => void;
  onRoundCorners?: (radius: number) => void;
  onOpenColorPicker: (mode: 'fill' | 'stroke') => void;
  onDuplicate: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  hasTextSelected?: boolean;
  onExpandText?: () => void;
  onEditText?: () => void;
  customFonts?: string[];
  onUpdateFontFamily?: (font: string) => void;
  selectedFontFamily?: string;
  onDelete: () => void;
  onFlip: (direction: 'horizontal' | 'vertical') => void;
  onBooleanOp: (op: BooleanOperation) => void;
  isShapeBuilderMode: boolean;
  isPathfinderMode?: boolean;
}

const QUICK_COLORS = [
  { name: 'None', hex: 'none' },
  { name: 'Cyan', hex: '#00E5FF' },
  { name: 'Sky', hex: '#38BDF8' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Crimson', hex: '#EF4444' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Dark', hex: '#0F172A' },
];

export const ContextualBar: React.FC<ContextualBarProps> = ({
  selectedCount,
  fillColor,
  strokeColor,
  strokeWidth,
  onUpdateFill,
  onUpdateStroke,
  onUpdateStrokeWidth,
  onRoundCorners,
  onOpenColorPicker,
  onDuplicate,
  onCopy,
  onPaste,
  canPaste = false,
  hasTextSelected = false,
  onExpandText,
  onEditText,
  customFonts = [],
  onUpdateFontFamily,
  selectedFontFamily,
  onDelete,
  onFlip,
  onBooleanOp,
  isShapeBuilderMode,
  isPathfinderMode = false,
}) => {
  const [showCornerMenu, setShowCornerMenu] = useState(false);

  if (selectedCount === 0 && !isShapeBuilderMode && !isPathfinderMode) return null;

  const hasStroke = strokeColor !== 'none' && strokeWidth > 0;
  const hasFill = fillColor !== 'none';

  return (
    <div className="fixed top-[52px] sm:top-[56px] left-1/2 -translate-x-1/2 z-30 max-w-[96vw] sm:max-w-2xl bg-[#0B0F19]/95 backdrop-blur-md border border-slate-800 rounded-lg px-2 py-1.5 shadow-xl flex items-center gap-1.5 sm:gap-2 select-none text-slate-100 overflow-x-auto no-scrollbar animate-in slide-in-from-top-1 duration-150">
      {/* Selected Objects Count */}
      <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 text-[11px] font-medium text-cyan-400 shrink-0 border border-slate-700/50">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
        <span className="whitespace-nowrap">{selectedCount} Selected</span>
      </div>

      {/* FONT SELECTOR FOR TEXT */}
      {(hasTextSelected || selectedFontFamily) && onUpdateFontFamily && (
        <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-2">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider hidden sm:inline">
            Font
          </span>
          <select
            value={selectedFontFamily || 'Inter, sans-serif'}
            onChange={(e) => onUpdateFontFamily(e.target.value)}
            className="bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:border-cyan-500 max-w-[130px] font-medium truncate"
          >
            <optgroup label="Standard Fonts">
              <option value="Inter, sans-serif">Inter</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Impact', sans-serif">Impact</option>
            </optgroup>
            {customFonts.length > 0 && (
              <optgroup label="Imported Custom Fonts">
                {customFonts.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* FILL CONTROL */}
      <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-1.5">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">
          Fill
        </span>
        <button
          type="button"
          onClick={() => onOpenColorPicker('fill')}
          className="relative w-6 h-6 rounded-md border border-slate-600 shadow-inner flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
          style={{
            backgroundColor: hasFill ? fillColor : 'transparent',
            backgroundImage: !hasFill
              ? 'linear-gradient(45deg, #ef4444 2px, transparent 2px, transparent 50%, #ef4444 50%, #ef4444 52%, transparent 52%)'
              : 'none',
          }}
          title="Open Fill Color Picker"
        />

        {/* Native Fill Color Input */}
        <label className="relative w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center cursor-pointer text-cyan-400" title="Pick Exact Fill Color">
          <Pipette size={11} />
          <input
            type="color"
            value={hasFill ? fillColor : '#00E5FF'}
            onChange={(e) => onUpdateFill(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>

        {/* Toggle No Fill */}
        <button
          type="button"
          onClick={() => onUpdateFill(hasFill ? 'none' : '#00E5FF')}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
            !hasFill
              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
              : 'border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
          title={hasFill ? 'Remove Fill (Make Transparent)' : 'Enable Fill'}
        >
          {hasFill ? 'No Fill' : '+ Fill'}
        </button>
      </div>

      {/* STROKE CONTROL */}
      <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-1.5">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">
          Stroke
        </span>
        <button
          type="button"
          onClick={() => onOpenColorPicker('stroke')}
          className="relative w-6 h-6 rounded-md border border-slate-600 shadow-inner flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
          style={{
            backgroundColor: 'transparent',
            borderColor: hasStroke ? strokeColor : '#ef4444',
            borderWidth: hasStroke ? Math.min(3, Math.max(1.5, strokeWidth)) : 1,
            backgroundImage: !hasStroke
              ? 'linear-gradient(45deg, #ef4444 2px, transparent 2px, transparent 50%, #ef4444 50%, #ef4444 52%, transparent 52%)'
              : 'none',
          }}
          title="Open Stroke Color Picker"
        />

        {/* Native Stroke Color Input */}
        <label className="relative w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center cursor-pointer text-cyan-400" title="Pick Exact Stroke Color">
          <Pipette size={11} />
          <input
            type="color"
            value={hasStroke ? strokeColor : '#38BDF8'}
            onChange={(e) => onUpdateStroke(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>

        {/* Toggle No Stroke / Stroke */}
        <button
          type="button"
          onClick={() => {
            if (hasStroke) {
              onUpdateStroke('none');
            } else {
              onUpdateStroke(strokeColor === 'none' ? '#38BDF8' : strokeColor);
              if (strokeWidth <= 0) onUpdateStrokeWidth(3);
            }
          }}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
            !hasStroke
              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
              : 'border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
          title={hasStroke ? 'Remove Stroke (No Outline)' : 'Enable Stroke'}
        >
          {hasStroke ? 'No Stroke' : '+ Stroke'}
        </button>

        {/* Stroke Width Stepper */}
        {hasStroke && (
          <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => onUpdateStrokeWidth(Math.max(0.5, strokeWidth - 1))}
              className="w-5 h-5 rounded hover:bg-slate-700 flex items-center justify-center text-slate-300"
              title="Decrease Width"
            >
              <Minus size={10} />
            </button>
            <span className="font-mono text-[10px] text-cyan-400 w-5 text-center font-bold">
              {strokeWidth}
            </span>
            <button
              type="button"
              onClick={() => onUpdateStrokeWidth(strokeWidth + 1)}
              className="w-5 h-5 rounded hover:bg-slate-700 flex items-center justify-center text-slate-300"
              title="Increase Width"
            >
              <Plus size={10} />
            </button>
          </div>
        )}
      </div>

      {/* ROUND CORNERS CONTROL */}
      {onRoundCorners && (
        <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-1.5 relative">
          <button
            type="button"
            onClick={() => setShowCornerMenu(!showCornerMenu)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-amber-300 flex items-center gap-1 active:scale-95"
            title="Round Corners"
          >
            <Spline size={12} className="text-amber-400" />
            <span>Round</span>
          </button>

          {showCornerMenu && (
            <div className="absolute top-10 left-0 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl flex flex-col gap-1 z-50 w-36">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Corner Radius
              </span>
              {[
                { label: 'Sharp (0px)', r: 0 },
                { label: 'Subtle (8px)', r: 8 },
                { label: 'Medium (16px)', r: 16 },
                { label: 'Round (24px)', r: 24 },
                { label: 'Pill (36px)', r: 36 },
              ].map((opt) => (
                <button
                  key={opt.r}
                  type="button"
                  onClick={() => {
                    onRoundCorners(opt.r);
                    setShowCornerMenu(false);
                  }}
                  className="px-2 py-1 rounded-lg text-left text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-300 transition-colors flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pathfinder Operations (when 2+ shapes selected, or pathfinder/shape builder tool) */}
      {(selectedCount >= 2 || isShapeBuilderMode || isPathfinderMode) && (
        <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Pathfinder
          </span>
          <button
            type="button"
            disabled={selectedCount < 2}
            onClick={() => onBooleanOp('union')}
            className="px-2 py-1 bg-cyan-600/30 border border-cyan-500/50 hover:bg-cyan-600/50 rounded-lg text-[10px] font-bold text-cyan-200 flex items-center gap-1 disabled:opacity-40"
            title="Unite / Combine (Union)"
          >
            <Combine size={12} />
            <span>Unite</span>
          </button>
          <button
            type="button"
            disabled={selectedCount < 2}
            onClick={() => onBooleanOp('subtract')}
            className="px-2 py-1 bg-rose-600/30 border border-rose-500/50 hover:bg-rose-600/50 rounded-lg text-[10px] font-bold text-rose-200 flex items-center gap-1 disabled:opacity-40"
            title="Minus Front (Subtract)"
          >
            <Scissors size={12} />
            <span>Minus</span>
          </button>
          <button
            type="button"
            disabled={selectedCount < 2}
            onClick={() => onBooleanOp('intersect')}
            className="px-2 py-1 bg-amber-600/30 border border-amber-500/50 hover:bg-amber-600/50 rounded-lg text-[10px] font-bold text-amber-200 flex items-center gap-1 disabled:opacity-40"
            title="Intersect"
          >
            <Sparkles size={12} />
            <span>Intersect</span>
          </button>
          <button
            type="button"
            disabled={selectedCount < 2}
            onClick={() => onBooleanOp('exclude')}
            className="px-2 py-1 bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600/50 rounded-lg text-[10px] font-bold text-blue-200 flex items-center gap-1 disabled:opacity-40"
            title="Exclude (XOR)"
          >
            <Ban size={12} />
            <span>Exclude</span>
          </button>
          <button
            type="button"
            disabled={selectedCount < 2}
            onClick={() => onBooleanOp('divide')}
            className="px-2 py-1 bg-purple-600/30 border border-purple-500/50 hover:bg-purple-600/50 rounded-lg text-[10px] font-bold text-purple-200 flex items-center gap-1 disabled:opacity-40"
            title="Divide Segments"
          >
            <Layers size={12} />
            <span>Divide</span>
          </button>
        </div>
      )}

      {/* EDIT & EXPAND TEXT */}
      {hasTextSelected && (
        <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-1.5">
          {onEditText && (
            <button
              type="button"
              onClick={onEditText}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
              title="Edit Selected Text String & Formatting"
            >
              <Edit3 size={12} />
              <span>Edit Text</span>
            </button>
          )}

          {onExpandText && (
            <button
              type="button"
              onClick={onExpandText}
              className="px-2.5 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-lg text-[10px] flex items-center gap-1.5 shadow-md shadow-cyan-500/25 active:scale-95 transition-all"
              title="Convert Text Glyph Outlines into Editable Vector Shapes & Bezier Nodes"
            >
              <Sparkles size={12} />
              <span>Convert to Curves (Expand)</span>
            </button>
          )}
        </div>
      )}

      {/* Quick Transforms & Actions */}
      <div className="flex items-center gap-1 shrink-0 border-l border-slate-800 pl-1.5">
        <button
          type="button"
          onClick={() => onFlip('horizontal')}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-90 transition-transform"
          title="Flip Horizontal"
        >
          <FlipHorizontal size={13} />
        </button>
        <button
          type="button"
          onClick={() => onFlip('vertical')}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-90 transition-transform"
          title="Flip Vertical"
        >
          <FlipVertical size={13} />
        </button>

        {/* Copy */}
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-90 transition-transform"
            title="Copy Selected Paths (Ctrl+C)"
          >
            <Copy size={13} />
          </button>
        )}

        {/* Paste */}
        {onPaste && (
          <button
            type="button"
            onClick={onPaste}
            disabled={!canPaste}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-90 ${
              canPaste
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed'
            }`}
            title="Paste Copied Paths (Ctrl+V)"
          >
            Paste
          </button>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold active:scale-90 transition-transform"
          title="Duplicate Object (Ctrl+D)"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 active:scale-90 transition-transform"
          title="Delete Object"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
