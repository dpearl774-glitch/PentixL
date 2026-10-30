import React from 'react';
import { MousePointer2, PenTool, Square, Type, Brush } from 'lucide-react';
import { ToolType } from '../types/vector';
import { haptic } from '../theme';

interface ToolDockProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onOpenShapes: () => void;
}

const ShapeBuilderGlyph: React.FC<{ size?: number }> = ({ size = 21 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="9.5" r="5.5" />
    <circle cx="15" cy="14.5" r="5.5" strokeDasharray="2.4 2.2" />
    <path d="M12 9.5v5" />
    <path d="M9.5 12h5" />
  </svg>
);

interface Slot {
  id: ToolType;
  label: string;
  aria: string;
  icon: React.ReactNode;
  opensSheet?: boolean;
}

/**
 * Six tools, one tap each. Node editing is the second mode of Select — a
 * double-tap enters it — so it no longer costs a permanent slot.
 */
const SLOTS: Slot[] = [
  { id: 'select', label: 'Select', aria: 'Select and edit nodes', icon: <MousePointer2 size={21} /> },
  { id: 'pen', label: 'Pen', aria: 'Pen tool', icon: <PenTool size={21} /> },
  { id: 'pressure-brush', label: 'Brush', aria: 'Pressure brush', icon: <Brush size={21} /> },
  {
    id: 'shape-builder',
    label: 'Build',
    aria: 'Shape builder',
    icon: <ShapeBuilderGlyph />,
  },
  { id: 'shape', label: 'Shapes', aria: 'Shape library', icon: <Square size={20} />, opensSheet: true },
  { id: 'text', label: 'Text', aria: 'Text tool', icon: <Type size={21} /> },
];

export const ToolDock: React.FC<ToolDockProps> = ({ currentTool, onSelectTool, onOpenShapes }) => (
  <div className="z-30 shrink-0 border-t border-line bg-ink-1">
    <div className="safe-bottom">
      <div className="mx-auto flex h-[58px] max-w-2xl items-stretch px-1">
        {SLOTS.map((slot) => {
          // Select owns two modes, so it stays lit while nodes are being edited
          const active =
            slot.id === 'select'
              ? currentTool === 'select' || currentTool === 'direct-select'
              : currentTool === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              aria-label={slot.aria}
              aria-pressed={active}
              onClick={() => {
                haptic(8);
                if (slot.opensSheet) onOpenShapes();
                else onSelectTool(slot.id);
              }}
              className="press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl"
            >
              <span className={active ? 'text-accent' : 'text-dim'}>{slot.icon}</span>
              {/* Only the active tool is named — six labels at phone width read as noise */}
              {active && (
                <span className="max-w-full truncate font-mono text-[8.5px] uppercase leading-none tracking-[0.06em] text-accent">
                  {slot.label}
                </span>
              )}
              {active && <span className="absolute -top-px h-[2px] w-6 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
