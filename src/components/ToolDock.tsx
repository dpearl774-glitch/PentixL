import React from 'react';
import { MousePointer2, PenTool, Square, Type, Brush, Crosshair } from 'lucide-react';
import { ToolType } from '../types/vector';
import { haptic } from '../theme';

interface ToolDockProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onOpenShapes: () => void;
}

const ShapeBuilderGlyph: React.FC<{ size?: number }> = ({ size = 20 }) => (
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

/** Every tool that matters is one tap away — nothing hides behind a long press. */
const SLOTS: Slot[] = [
  { id: 'select', label: 'Select', aria: 'Select and move', icon: <MousePointer2 size={20} /> },
  { id: 'direct-select', label: 'Direct', aria: 'Direct select nodes', icon: <Crosshair size={20} /> },
  { id: 'pen', label: 'Pen', aria: 'Pen tool', icon: <PenTool size={20} /> },
  { id: 'pressure-brush', label: 'Brush', aria: 'Pressure brush', icon: <Brush size={20} /> },
  {
    id: 'shape-builder',
    label: 'Build',
    aria: 'Shape builder',
    icon: <ShapeBuilderGlyph />,
  },
  { id: 'shape', label: 'Shapes', aria: 'Shape library', icon: <Square size={19} />, opensSheet: true },
  { id: 'text', label: 'Text', aria: 'Text tool', icon: <Type size={20} /> },
];

export const ToolDock: React.FC<ToolDockProps> = ({ currentTool, onSelectTool, onOpenShapes }) => (
  <div className="z-30 shrink-0 border-t border-line bg-ink-1">
    <div className="safe-bottom">
      <div className="mx-auto flex h-[58px] max-w-2xl items-stretch px-1">
        {SLOTS.map((slot) => {
          const active = currentTool === slot.id;
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
              <span
                className={`max-w-full truncate font-mono text-[8.5px] uppercase leading-none tracking-[0.06em] ${
                  active ? 'text-accent' : 'text-mute'
                }`}
              >
                {slot.label}
              </span>
              {active && <span className="absolute -top-px h-[2px] w-6 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
