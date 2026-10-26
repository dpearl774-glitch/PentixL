import React from 'react';
import { X, Sparkles, Combine, Scissors, Layers, CheckCircle } from 'lucide-react';
import { BooleanOperation } from '../utils/shapeBuilder';

interface ShapeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onExecute: (op: BooleanOperation) => void;
}

export const ShapeBuilderModal: React.FC<ShapeBuilderModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onExecute,
}) => {
  if (!isOpen) return null;

  const operations: {
    id: BooleanOperation;
    title: string;
    description: string;
    actionLabel: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: 'union',
      title: 'Unite / Combine',
      description: 'Merges all overlapping shapes into a single unified vector logo silhouette.',
      actionLabel: 'Unite Shapes',
      icon: <Combine size={20} />,
      color: 'text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10',
    },
    {
      id: 'subtract',
      title: 'Minus Front / Subtract',
      description: 'Subtracts the upper intersecting shapes from the bottom base shape to cut out geometric negative space.',
      actionLabel: 'Cut / Subtract',
      icon: <Scissors size={20} />,
      color: 'text-rose-400 border-rose-500/40 hover:bg-rose-500/10',
    },
    {
      id: 'intersect',
      title: 'Intersect Core',
      description: 'Extracts only the overlapping geometry where all selected shapes intersect.',
      actionLabel: 'Keep Overlap',
      icon: <Sparkles size={20} />,
      color: 'text-amber-400 border-amber-500/40 hover:bg-amber-500/10',
    },
    {
      id: 'divide',
      title: 'Divide Into Segments',
      description: 'Partitions overlapping shapes into individual atomic vector regions (the classic Shape Builder workflow).',
      actionLabel: 'Divide Regions',
      icon: <Layers size={20} />,
      color: 'text-purple-400 border-purple-500/40 hover:bg-purple-500/10',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-cyan-400" />
            <h2 className="text-sm font-bold tracking-tight">Shape Builder & Boolean Ops</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Selected Shapes Status Warning or Confirmation */}
        <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
          selectedCount >= 2
            ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className={selectedCount >= 2 ? 'text-cyan-400' : 'text-amber-400'} />
            <span>
              {selectedCount >= 2
                ? `${selectedCount} overlapping shapes selected and ready!`
                : `Select at least 2 shapes (currently ${selectedCount} selected).`}
            </span>
          </div>
        </div>

        {/* Operation Cards */}
        <div className="flex flex-col gap-2.5">
          {operations.map((op) => (
            <button
              key={op.id}
              disabled={selectedCount < 2}
              onClick={() => {
                onExecute(op.id);
                onClose();
              }}
              className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                op.color
              } ${selectedCount < 2 ? 'opacity-40 cursor-not-allowed border-slate-800' : 'active:scale-98'}`}
            >
              <div className="p-2 rounded-xl bg-slate-800 shrink-0">
                {op.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{op.title}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {op.actionLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {op.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Pro Tip */}
        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 text-[10px] text-slate-400 leading-normal">
          <strong className="text-cyan-300">Mobile Tip:</strong> With the Shape Builder tool (M) active, you can also hold or toggle the <strong className="text-rose-300">Alt</strong> button in the Thumb Zone to erase overlapping sections on the fly!
        </div>
      </div>
    </div>
  );
};
