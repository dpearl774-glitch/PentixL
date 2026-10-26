import React from 'react';
import {
  Copy,
  ClipboardPaste,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  Combine,
  Minus,
  Plus,
  CornerDownRight,
  Spline,
  Check,
  X,
  Type as TypeIcon,
  Wand2,
  SlidersHorizontal,
  Circle,
  Square,
  Triangle,
  Star,
  Hexagon,
  Hand,
  Minus as Line,
} from 'lucide-react';
import { ShapeKind, ToolType } from '../types/vector';
import { BooleanOperation } from '../utils/shapeBuilder';
import { Chip, IconButton } from './ui/primitives';

interface ToolOptionsProps {
  tool: ToolType;
  selectedCount: number;
  hasTextSelection: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  shapeKind: ShapeKind;
  sbMode: 'merge' | 'erase';
  drawingPointCount: number;
  onOpenColor: (mode: 'fill' | 'stroke') => void;
  onChangeStrokeWidth: (width: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFlip: (dir: 'horizontal' | 'vertical') => void;
  onBoolean: (op: BooleanOperation) => void;
  onEditText: () => void;
  onExpandText: () => void;
  onOpenText: () => void;
  onFinishPath: () => void;
  onCancelPath: () => void;
  onClosePath: () => void;
  onToggleNodeType: () => void;
  onDeleteNode: () => void;
  hasSelectedNode: boolean;
  /** Arms the shape tool for a kind — creation happens by dragging on canvas */
  onQuickShape: (kind: ShapeKind) => void;
  onPickShape: (kind: ShapeKind) => void;
  onOpenShapes: () => void;
  onOpenPressure: () => void;
  onChangeSbMode: (mode: 'merge' | 'erase') => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onRoundCorners: (radius: number) => void;
  onExitPan: () => void;
}

const QUICK_SHAPES: { kind: ShapeKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'circle', label: 'Circle', icon: <Circle size={14} /> },
  { kind: 'rectangle', label: 'Square', icon: <Square size={14} /> },
  { kind: 'triangle', label: 'Triangle', icon: <Triangle size={14} /> },
  { kind: 'star', label: 'Star', icon: <Star size={14} /> },
  { kind: 'polygon', label: 'Polygon', icon: <Hexagon size={14} /> },
  { kind: 'line', label: 'Line', icon: <Line size={14} /> },
];

const Swatch: React.FC<{
  color: string;
  label: string;
  onClick: () => void;
  hollow?: boolean;
  width?: number;
}> = ({ color, label, onClick, hollow, width }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="press relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-ink-2"
  >
    {hollow ? (
      <span
        className="h-4 w-4 rounded-[3px]"
        style={{ border: `${Math.min(3, Math.max(1.5, (width ?? 2) / 2))}px solid ${color}` }}
      />
    ) : (
      <span
        className="h-4 w-4 rounded-[3px]"
        style={{
          backgroundColor: color,
          backgroundImage:
            color === 'none'
              ? 'linear-gradient(45deg, #ff6b6b 1.5px, transparent 1.5px 50%, #ff6b6b 50%, #ff6b6b 51.5px, transparent 51.5px)'
              : undefined,
        }}
      />
    )}
  </button>
);

const Divider = () => <span className="mx-0.5 h-6 w-px shrink-0 bg-line" />;

/**
 * Contextual strip directly above the dock. Shows only what the current tool
 * and selection actually need — node actions for direct select, transform and
 * pathfinder for select.
 */
export const ToolOptions: React.FC<ToolOptionsProps> = ({
  tool,
  selectedCount,
  hasTextSelection,
  fillColor,
  strokeColor,
  strokeWidth,
  shapeKind,
  sbMode,
  drawingPointCount,
  onOpenColor,
  onChangeStrokeWidth,
  onDuplicate,
  onDelete,
  onFlip,
  onBoolean,
  onEditText,
  onExpandText,
  onOpenText,
  onFinishPath,
  onCancelPath,
  onClosePath,
  onToggleNodeType,
  onDeleteNode,
  hasSelectedNode,
  onQuickShape,
  onPickShape,
  onOpenShapes,
  onOpenPressure,
  onChangeSbMode,
  onCopy,
  onPaste,
  canPaste,
  onRoundCorners,
  onExitPan,
}) => {
  const isDrawing = drawingPointCount > 0 && (tool === 'pen' || tool === 'pressure-brush');
  const [roundMenu, setRoundMenu] = React.useState(false);

  if (tool === 'hand' && selectedCount === 0) {
    return (
      <div className="z-20 shrink-0 border-t border-line bg-ink-1/95">
        <div className="mx-auto flex h-11 max-w-3xl items-center gap-2 px-2">
          <Hand size={14} className="shrink-0 text-accent" />
          <span className="truncate text-[11px] text-mute">
            Drag to move the canvas · pinch with two fingers to zoom
          </span>
          <span className="flex-1" />
          <Chip onClick={onExitPan}>Back to Select</Chip>
        </div>
      </div>
    );
  }

  return (
    <div className="z-20 shrink-0 border-t border-line bg-ink-1/95">
      <div className="scroll-x mx-auto flex h-11 max-w-3xl items-center gap-1.5 px-2">
        {/* ---------------- Drawing a path ---------------- */}
        {isDrawing && (
          <>
            <span className="rounded-full bg-accent/15 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
              {drawingPointCount} {drawingPointCount === 1 ? 'node' : 'nodes'}
            </span>
            <Chip icon={<Check size={13} />} onClick={onFinishPath}>
              Done
            </Chip>
            {tool === 'pen' && drawingPointCount >= 2 && (
              <Chip onClick={onClosePath}>Close</Chip>
            )}
            <Chip icon={<X size={13} />} onClick={onCancelPath}>
              Cancel
            </Chip>
            <span className="ml-1 hidden shrink-0 text-[11px] text-mute sm:block">
              {tool === 'pen' ? 'Tap to place · drag to curve' : 'Drag to paint with pressure'}
            </span>
          </>
        )}

        {/* ---------------- Shape builder ---------------- */}
        {!isDrawing && tool === 'shape-builder' && (
          <>
            <Chip active={sbMode === 'merge'} onClick={() => onChangeSbMode('merge')}>
              Merge
            </Chip>
            <Chip active={sbMode === 'erase'} onClick={() => onChangeSbMode('erase')}>
              Erase
            </Chip>
            <Divider />
            <span className="shrink-0 whitespace-nowrap text-[11px] text-mute">
              Drag across regions · hold Alt to erase
            </span>
          </>
        )}

        {/* ---------------- Shapes ---------------- */}
        {!isDrawing && tool === 'shape' && (
          <>
            {QUICK_SHAPES.map((s) => (
              <Chip
                key={s.kind}
                active={shapeKind === s.kind}
                icon={s.icon}
                onClick={() => onPickShape(s.kind)}
              >
                {s.label}
              </Chip>
            ))}
            <Chip icon={<Plus size={13} />} onClick={onOpenShapes}>
              All 17
            </Chip>
            <Divider />
            <Swatch color={fillColor} label="Fill colour" onClick={() => onOpenColor('fill')} />
            <Swatch
              color={strokeColor}
              label="Stroke colour"
              hollow
              width={strokeWidth}
              onClick={() => onOpenColor('stroke')}
            />
            <span className="ml-1 hidden shrink-0 text-[11px] text-mute sm:block">
              Drag on canvas to size
            </span>
          </>
        )}

        {/* ---------------- Pen not drawing / brush ---------------- */}
        {!isDrawing && (tool === 'pen' || tool === 'pressure-brush') && (
          <>
            <span className="shrink-0 text-[11px] text-mute">
              {tool === 'pen' ? 'Tap to place, drag to pull curves' : 'Draw with pressure'}
            </span>
            <Divider />
            <Chip
              icon={<SlidersHorizontal size={13} />}
              onClick={onOpenPressure}
            >
              Pressure
            </Chip>
            {tool === 'pen' && hasSelectedNode && (
              <>
                <Divider />
                <Chip icon={<Spline size={13} />} onClick={onToggleNodeType}>
                  Node type
                </Chip>
                <Chip icon={<Trash2 size={13} />} onClick={onDeleteNode}>
                  Delete node
                </Chip>
                <Chip icon={<CornerDownRight size={13} />} onClick={onClosePath}>
                  Toggle close
                </Chip>
              </>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-line bg-ink-0 px-1">
              <IconButton
                label="Thinner stroke"
                size="sm"
                onClick={() => onChangeStrokeWidth(Math.max(0.5, strokeWidth - 1))}
              >
                <Minus size={12} />
              </IconButton>
              <span className="w-6 text-center font-mono text-[11px] font-bold text-dim">
                {strokeWidth}
              </span>
              <IconButton
                label="Thicker stroke"
                size="sm"
                onClick={() => onChangeStrokeWidth(strokeWidth + 1)}
              >
                <Plus size={12} />
              </IconButton>
            </div>
            <Swatch color={strokeColor} label="Stroke colour" hollow width={strokeWidth} onClick={() => onOpenColor('stroke')} />
          </>
        )}

        {/* ---------------- Direct select, nothing picked yet ---------------- */}
        {!isDrawing && tool === 'direct-select' && selectedCount === 0 && (
          <span className="text-[11px] text-mute">Tap a path to edit its nodes</span>
        )}

        {/* ---------------- Object selected ---------------- */}
        {!isDrawing && selectedCount > 0 && tool !== 'shape' && (
          <>
            <span className="shrink-0 rounded-full bg-ink-3 px-2 py-1 font-mono text-[10px] font-bold text-dim">
              {selectedCount} selected
            </span>

            {tool === 'direct-select' ? (
              /* Node editing: keep the strip about nodes, not transforms */
              <>
                <Swatch color={fillColor} label="Fill colour" onClick={() => onOpenColor('fill')} />
                <Swatch
                  color={strokeColor}
                  label="Stroke colour"
                  hollow
                  width={strokeWidth}
                  onClick={() => onOpenColor('stroke')}
                />
                <Divider />
                <Chip
                  icon={<Spline size={13} />}
                  onClick={onToggleNodeType}
                  disabled={!hasSelectedNode}
                >
                  Node type
                </Chip>
                <Chip
                  icon={<Trash2 size={13} />}
                  onClick={onDeleteNode}
                  disabled={!hasSelectedNode}
                >
                  Delete node
                </Chip>
                <Chip icon={<CornerDownRight size={13} />} onClick={onClosePath}>
                  Toggle close
                </Chip>
                <Divider />
                <IconButton label="Duplicate" size="sm" onClick={onDuplicate}>
                  <Copy size={14} />
                </IconButton>
                <IconButton label="Paste objects" size="sm" onClick={onPaste} disabled={!canPaste}>
                  <ClipboardPaste size={14} />
                </IconButton>
                <IconButton label="Delete" size="sm" tone="danger" onClick={onDelete}>
                  <Trash2 size={14} />
                </IconButton>
                {!hasSelectedNode && (
                  <span className="ml-1 shrink-0 text-[11px] text-mute">
                    Tap a node to move it
                  </span>
                )}
              </>
            ) : (
              <>
                <Swatch color={fillColor} label="Fill colour" onClick={() => onOpenColor('fill')} />
                <Swatch color={strokeColor} label="Stroke colour" hollow width={strokeWidth} onClick={() => onOpenColor('stroke')} />
                <Divider />
                <IconButton label="Duplicate" size="sm" onClick={onDuplicate}>
                  <Copy size={14} />
                </IconButton>
                <IconButton label="Paste objects" size="sm" onClick={onPaste} disabled={!canPaste}>
                  <ClipboardPaste size={14} />
                </IconButton>
                <div className="relative shrink-0">
                  <Chip active={roundMenu} icon={<Spline size={13} />} onClick={() => setRoundMenu((v) => !v)}>
                    Round
                  </Chip>
                  {roundMenu && (
                    <div className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-32 rounded-xl border border-line bg-ink-2 p-1 shadow-2xl">
                      {[0, 8, 16, 28, 48].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            onRoundCorners(r);
                            setRoundMenu(false);
                          }}
                          className="flex h-8 w-full items-center justify-between rounded-lg px-2 font-mono text-[11px] font-semibold text-dim hover:bg-ink-3 hover:text-text"
                        >
                          {r === 0 ? 'sharp' : `${r}px`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <IconButton label="Flip horizontal" size="sm" onClick={() => onFlip('horizontal')}>
                  <FlipHorizontal size={14} />
                </IconButton>
                <IconButton label="Flip vertical" size="sm" onClick={() => onFlip('vertical')}>
                  <FlipVertical size={14} />
                </IconButton>
                <IconButton label="Delete" size="sm" tone="danger" onClick={onDelete}>
                  <Trash2 size={14} />
                </IconButton>

                {hasTextSelection && (
                  <>
                    <Divider />
                    <Chip icon={<TypeIcon size={13} />} onClick={onEditText}>
                      Edit text
                    </Chip>
                    <Chip icon={<Wand2 size={13} />} onClick={onExpandText}>
                      To curves
                    </Chip>
                  </>
                )}

                {selectedCount >= 2 && (
                  <>
                    <Divider />
                    <span className="label-mono shrink-0 pl-0.5">Pathfinder</span>
                    {(
                      [
                        ['union', 'Unite'],
                        ['subtract', 'Minus'],
                        ['intersect', 'Intersect'],
                        ['exclude', 'Exclude'],
                        ['divide', 'Divide'],
                      ] as [BooleanOperation, string][]
                    ).map(([op, label]) => (
                      <Chip key={op} icon={<Combine size={12} />} onClick={() => onBoolean(op)}>
                        {label}
                      </Chip>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---------------- Text tool, nothing selected ---------------- */}
        {!isDrawing && tool === 'text' && selectedCount === 0 && (
          <>
            <Chip icon={<TypeIcon size={13} />} onClick={onOpenText}>
              Add text
            </Chip>
            <span className="text-[11px] text-mute">or tap the canvas to place a label</span>
          </>
        )}

        {/* ---------------- Idle select: quick tools ---------------- */}
        {!isDrawing && tool === 'select' && selectedCount === 0 && (
          <>
            <Chip icon={<Square size={13} />} onClick={() => onQuickShape('rectangle')}>
              Square
            </Chip>
            <Chip icon={<Circle size={13} />} onClick={() => onQuickShape('circle')}>
              Circle
            </Chip>
            <Chip icon={<Star size={13} />} onClick={() => onQuickShape('star')}>
              Star
            </Chip>
            <Chip icon={<TypeIcon size={13} />} onClick={onOpenText}>
              Text
            </Chip>
            <Divider />
            <Swatch color={fillColor} label="Fill colour" onClick={() => onOpenColor('fill')} />
            <Swatch color={strokeColor} label="Stroke colour" hollow width={strokeWidth} onClick={() => onOpenColor('stroke')} />
            <span className="ml-auto hidden shrink-0 pr-1 text-[11px] text-mute sm:block">
              Drag on canvas to draw
            </span>
          </>
        )}
      </div>
    </div>
  );
};
