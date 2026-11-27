import React from 'react';
import {
  Brush,
  Crosshair,
  Hand,
  Layers,
  MousePointer2,
  Pencil,
  PenTool,
  Square,
  Type,
} from 'lucide-react';
import { ToolType } from '../types/vector';
import { haptic } from '../theme';

interface ToolDockProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onOpenShapes: () => void;
  onOpenLayers: () => void;
  layersOpen: boolean;
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

/** Tools that are one tap away once Draw is open. */
const DRAW_SLOTS: { id: ToolType; label: string; aria: string; icon: React.ReactNode }[] = [
  { id: 'pen', label: 'Pen', aria: 'Pen tool', icon: <PenTool size={20} /> },
  { id: 'pencil', label: 'Pencil', aria: 'Pencil tool', icon: <Pencil size={20} /> },
  { id: 'pressure-brush', label: 'Brush', aria: 'Pressure brush', icon: <Brush size={20} /> },
  { id: 'direct-select', label: 'Nodes', aria: 'Direct select nodes', icon: <Crosshair size={20} /> },
  {
    id: 'shape-builder',
    label: 'Build',
    aria: 'Shape builder',
    icon: <ShapeBuilderGlyph size={20} />,
  },
  { id: 'hand', label: 'Pan', aria: 'Pan canvas', icon: <Hand size={20} /> },
];

/**
 * The phone dock. Five fixed, labelled destinations — the same shape as a
 * shipped mobile editor — instead of a row of nine unlabelled desktop icons.
 * The drawing tools live one level down in the Draw tray.
 */
export const ToolDock: React.FC<ToolDockProps> = ({
  currentTool,
  onSelectTool,
  onOpenShapes,
  onOpenLayers,
  layersOpen,
}) => {
  const [drawOpen, setDrawOpen] = React.useState(false);
  const drawActive = DRAW_SLOTS.some((slot) => slot.id === currentTool);

  React.useEffect(() => {
    setDrawOpen(false);
  }, [currentTool, layersOpen]);

  const slots: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
    expanded?: boolean;
  }> = [
    {
      key: 'select',
      label: 'Select',
      icon: <MousePointer2 size={21} />,
      active: currentTool === 'select',
      onClick: () => onSelectTool('select'),
    },
    {
      key: 'shapes',
      label: 'Shapes',
      icon: <Square size={21} />,
      active: currentTool === 'shape',
      onClick: () => {
        onSelectTool('shape');
        onOpenShapes();
      },
    },
    {
      key: 'text',
      label: 'Text',
      icon: <Type size={21} />,
      active: currentTool === 'text',
      onClick: () => onSelectTool('text'),
    },
    {
      key: 'draw',
      label: 'Draw',
      icon: <Pencil size={21} />,
      active: drawActive,
      expanded: drawOpen,
      onClick: () => setDrawOpen((open) => !open),
    },
    {
      key: 'layers',
      label: 'Layers',
      icon: <Layers size={21} />,
      active: layersOpen,
      onClick: onOpenLayers,
    },
  ];

  return (
    <div className="relative z-40 shrink-0 border-t border-line bg-ink-1/95 backdrop-blur">
      {drawOpen && (
        <>
          <button
            type="button"
            aria-label="Close drawing tools"
            className="fixed inset-0 z-40 cursor-default bg-ink-0/45 backdrop-blur-[2px]"
            onClick={() => setDrawOpen(false)}
          />
          <div className="anim-rise absolute bottom-full left-2 right-2 z-50 mb-2 rounded-2xl border border-line bg-ink-2 p-2 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-mute">
                Drawing tools
              </span>
              <span className="font-sans text-[10px] text-mute">Pick one</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DRAW_SLOTS.map((slot) => {
                const active = currentTool === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-label={slot.aria}
                    aria-pressed={active}
                    onClick={() => {
                      haptic(8);
                      onSelectTool(slot.id);
                      setDrawOpen(false);
                    }}
                    className={`press flex h-14 flex-col items-center justify-center gap-1 rounded-xl border ${
                      active
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-transparent bg-ink-3 text-dim'
                    }`}
                  >
                    {slot.icon}
                    <span className="font-sans text-[10px] font-semibold leading-none">
                      {slot.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="px-2 pt-2 text-[9.5px] leading-snug text-mute">
              Build brushes shapes into one. It is also in Arrange whenever a shape
              is selected.
            </p>
          </div>
        </>
      )}

      <div className="safe-bottom relative z-50">
        <div className="mx-auto flex h-16 max-w-2xl items-stretch px-1.5">
          {slots.map((slot) => (
            <button
              key={slot.key}
              type="button"
              aria-label={slot.label}
              aria-pressed={slot.active}
              aria-expanded={slot.expanded}
              onClick={() => {
                haptic(8);
                slot.onClick();
              }}
              className={`press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl ${
                slot.active ? 'bg-accent/10 text-accent' : 'text-dim'
              }`}
            >
              {slot.active && (
                <span className="absolute top-1 h-[2px] w-5 rounded-full bg-accent" />
              )}
              <span className={slot.active ? 'text-accent' : 'text-dim'}>{slot.icon}</span>
              <span
                className={`max-w-full truncate font-sans text-[10px] font-semibold leading-none tracking-[0.01em] ${
                  slot.active ? 'text-accent' : 'text-dim'
                }`}
              >
                {slot.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
