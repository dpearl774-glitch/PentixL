import React from 'react';
import { X, Check } from 'lucide-react';
import { ShapeKind } from '../types/vector';

interface ShapePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedShape: ShapeKind;
  onSelectShape: (kind: ShapeKind) => void;
  onInsertShape: (kind: ShapeKind) => void;
}

const SHAPE_CATALOG: { kind: ShapeKind; label: string; svgD: string }[] = [
  { kind: 'rectangle', label: 'Square', svgD: 'M 10 10 H 90 V 90 H 10 Z' },
  { kind: 'rounded-rect', label: 'Rounded Rect', svgD: 'M 25 10 H 75 A 15 15 0 0 1 90 25 V 75 A 15 15 0 0 1 75 90 H 25 A 15 15 0 0 1 10 75 V 25 A 15 15 0 0 1 25 10 Z' },
  { kind: 'circle', label: 'Circle', svgD: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z' },
  { kind: 'semicircle', label: 'Semi-Circle', svgD: 'M 10 80 A 40 40 0 0 1 90 80 Z' },
  { kind: 'triangle', label: 'Triangle', svgD: 'M 50 10 L 90 90 H 10 Z' },
  { kind: 'polygon', label: 'Hexagon', svgD: 'M 50 10 L 88 32 L 88 78 L 50 100 L 12 78 L 12 32 Z' },
  { kind: 'octagon', label: 'Octagon', svgD: 'M 35 10 H 65 L 90 35 V 65 L 65 90 H 35 L 10 65 V 35 Z' },
  { kind: 'star', label: '5-Point Star', svgD: 'M 50 10 L 63 38 L 93 38 L 68 56 L 78 86 L 50 68 L 22 86 L 32 56 L 7 38 L 37 38 Z' },
  { kind: 'star8', label: '8-Point Star', svgD: 'M 50 10 L 61 27 L 78 12 L 73 33 L 93 38 L 77 50 L 93 62 L 73 67 L 78 88 L 61 73 L 50 90 L 39 73 L 22 88 L 27 67 L 7 62 L 23 50 L 7 38 L 27 33 L 22 12 L 39 27 Z' },
  { kind: 'heart', label: 'Heart', svgD: 'M 50 30 C 50 15, 20 10, 20 35 C 20 60, 50 80, 50 90 C 50 80, 80 60, 80 35 C 80 10, 50 15, 50 30 Z' },
  { kind: 'shield', label: 'Shield', svgD: 'M 15 15 H 85 V 50 C 85 75, 50 90, 50 90 C 50 90, 15 75, 15 50 Z' },
  { kind: 'arrow', label: 'Arrow', svgD: 'M 10 35 H 55 V 15 L 90 50 L 55 85 V 65 H 10 Z' },
  { kind: 'diamond', label: 'Diamond', svgD: 'M 50 10 L 90 50 L 50 90 L 10 50 Z' },
  { kind: 'pill', label: 'Pill Capsule', svgD: 'M 30 20 H 70 A 30 30 0 0 1 70 80 H 30 A 30 30 0 0 1 30 20 Z' },
  { kind: 'crescent', label: 'Crescent Moon', svgD: 'M 50 10 A 40 40 0 0 1 90 70 A 35 35 0 1 0 50 10 Z' },
  { kind: 'ring', label: 'Donut Ring', svgD: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 M 50 30 A 20 20 0 1 1 50 70 A 20 20 0 1 1 50 30 Z' },
  { kind: 'line', label: 'Line', svgD: 'M 10 50 H 90' },
];

export const ShapePickerModal: React.FC<ShapePickerModalProps> = ({
  isOpen,
  onClose,
  selectedShape,
  onSelectShape,
  onInsertShape,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0D1322] border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#070B14]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <h2 className="text-sm font-bold text-white">Select Vector Shape</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shapes Visual Grid */}
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {SHAPE_CATALOG.map((item) => {
            const isSelected = selectedShape === item.kind;

            return (
              <button
                key={item.kind}
                type="button"
                onClick={() => {
                  onSelectShape(item.kind);
                  onInsertShape(item.kind);
                  onClose();
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-lg'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <svg viewBox="0 0 100 100" className="w-10 h-10 mb-1.5 fill-current stroke-current" strokeWidth="3">
                  <path d={item.svgD} fill={item.kind === 'line' ? 'none' : 'currentColor'} fillOpacity={0.25} stroke="currentColor" />
                </svg>
                <span className="text-[11px] font-semibold text-center truncate w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-[#070B14] flex items-center justify-between text-xs text-slate-400">
          <span>Click any shape to add directly to canvas</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
