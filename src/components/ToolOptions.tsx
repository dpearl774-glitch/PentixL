import React from 'react';
import {
  Copy,
  ClipboardPaste,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  Minus,
  Plus,
  CornerDownRight,
  Spline,
  Box,
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
  Crop,
  Minus as Line,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
} from 'lucide-react';
import { PencilSmoothing, ShapeKind, ToolType } from '../types/vector';
import { BooleanOperation } from '../utils/shapeBuilder';
import { AlignMode, DistributeAxis } from '../utils/align';
import { Chip, IconButton, RangeInput } from './ui/primitives';

interface ToolOptionsProps {
  tool: ToolType;
  selectedCount: number;
  hasTextSelection: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  pencilSmoothing: PencilSmoothing;
  onChangePencilSmoothing: (level: PencilSmoothing) => void;
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
  onRoundCorners: (radius: number, cornerId?: string) => void;
  cornerRadius: number;
  /** Per-corner overrides keyed by the sharp source anchor id */
  cornerRadii?: Record<string, number>;
  /** Sharp corner anchors, in node order, available for individual editing */
  cornerIds?: string[];
  onMakeClipMask: () => void;
  onReleaseClipMask: () => void;
  canMakeClipMask: boolean;
  hasClipMask: boolean;
  canDrawInside: boolean;
  drawInsideName?: string | null;
  onStartDrawInside: () => void;
  onExitDrawInside: () => void;
  extrudeDepth: number;
  /** The current selection contains something an extrusion can actually pull */
  canExtrude?: boolean;
  onExtrudeDepth: (depth: number) => void;
  /** Degrees, y-down: 45 pulls down-right, 225 up-left */
  extrudeAngle?: number;
  onExtrudeAngle: (angle: number) => void;
  /** Back-face shrink, 0–0.45; undefined means the default perspective */
  extrudeTaper?: number;
  onExtrudeTaper: (taper: number) => void;
  extrudeShadow?: boolean;
  onExtrudeShadow: (on: boolean) => void;
  onSimplify: (tolerance: number) => void;
  /** Turns a stroke into a closed fill so the shape builder can use it */
  onExpandStroke?: () => void;
  canExpandStroke?: boolean;
  onExitPan: () => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: DistributeAxis) => void;
}

const QUICK_SHAPES: { kind: ShapeKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'circle', label: 'Circle', icon: <Circle size={14} /> },
  { kind: 'rectangle', label: 'Square', icon: <Square size={14} /> },
  { kind: 'triangle', label: 'Triangle', icon: <Triangle size={14} /> },
  { kind: 'star', label: 'Star', icon: <Star size={14} /> },
  { kind: 'polygon', label: 'Polygon', icon: <Hexagon size={14} /> },
  { kind: 'line', label: 'Line', icon: <Line size={14} /> },
];

const ALIGN_BUTTONS: { mode: AlignMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'left', label: 'Align left', icon: <AlignHorizontalJustifyStart size={14} /> },
  { mode: 'center-x', label: 'Align centres', icon: <AlignHorizontalJustifyCenter size={14} /> },
  { mode: 'right', label: 'Align right', icon: <AlignHorizontalJustifyEnd size={14} /> },
  { mode: 'top', label: 'Align top', icon: <AlignVerticalJustifyStart size={14} /> },
  { mode: 'center-y', label: 'Align middles', icon: <AlignVerticalJustifyCenter size={14} /> },
  { mode: 'bottom', label: 'Align bottom', icon: <AlignVerticalJustifyEnd size={14} /> },
];

const DISTRIBUTE_BUTTONS: { axis: DistributeAxis; label: string; short: string; icon: React.ReactNode }[] = [
  { axis: 'horizontal', label: 'Distribute across', short: 'Even H', icon: <AlignHorizontalSpaceAround size={13} /> },
  { axis: 'vertical', label: 'Distribute down', short: 'Even V', icon: <AlignVerticalSpaceAround size={13} /> },
];

const EXTRUDE_DIRECTIONS: { angle: number; glyph: string; label: string }[] = [
  { angle: 225, glyph: '↖', label: 'Extrude up left' },
  { angle: 270, glyph: '↑', label: 'Extrude up' },
  { angle: 315, glyph: '↗', label: 'Extrude up right' },
  { angle: 180, glyph: '←', label: 'Extrude left' },
  { angle: 0, glyph: '→', label: 'Extrude right' },
  { angle: 135, glyph: '↙', label: 'Extrude down left' },
  { angle: 90, glyph: '↓', label: 'Extrude down' },
  { angle: 45, glyph: '↘', label: 'Extrude down right' },
];

/** Compass laid out row-major; the null cell is the hub. */
const EXTRUDE_DIRECTION_GRID: (number | null)[] = [225, 270, 315, 180, null, 0, 135, 90, 45];

const EXTRUDE_DEPTH_PRESETS = [
  { label: 'Thin', value: 6 },
  { label: 'Mid', value: 24 },
  { label: 'Deep', value: 56 },
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
  pencilSmoothing,
  onChangePencilSmoothing,
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
  cornerRadius,
  cornerRadii,
  cornerIds = [],
  onMakeClipMask,
  onReleaseClipMask,
  canMakeClipMask,
  hasClipMask,
  canDrawInside,
  drawInsideName,
  onStartDrawInside,
  onExitDrawInside,
  extrudeDepth,
  canExtrude = true,
  extrudeAngle = 45,
  extrudeTaper = 0.16,
  extrudeShadow = true,
  onExtrudeDepth,
  onExtrudeAngle,
  onExtrudeTaper,
  onExtrudeShadow,
  onSimplify,
  onExpandStroke,
  canExpandStroke,
  onExitPan,
  onAlign,
  onDistribute,
}) => {
  const isDrawing = drawingPointCount > 0 && (tool === 'pen' || tool === 'pressure-brush');
  const [alignMenu, setAlignMenu] = React.useState(false);
  const [moreMenu, setMoreMenu] = React.useState(false);
  const [threeDMenu, setThreeDMenu] = React.useState(false);
  // Remembered so the Flat/3D toggle can bring the last depth back
  const [lastExtrudeDepth, setLastExtrudeDepth] = React.useState(24);
  const [cornerTarget, setCornerTarget] = React.useState<string | null>(null);
  const cornerTargetIndex = cornerTarget ? cornerIds.indexOf(cornerTarget) : -1;
  const activeCornerRadius = cornerTarget
    ? cornerRadii?.[cornerTarget] ?? cornerRadius
    : cornerRadius;
  const activeExtrudeAngle = ((Math.round(extrudeAngle / 45) * 45) % 360 + 360) % 360;

  React.useEffect(() => {
    if (cornerTarget && !cornerIds.includes(cornerTarget)) setCornerTarget(null);
  }, [cornerIds, cornerTarget]);

  if (tool === 'hand' && selectedCount === 0) {
    return (
      <div className="relative z-20 shrink-0 border-t border-line bg-ink-1/95">
        <div className="mx-auto flex h-11 max-w-3xl items-center gap-2 px-2">
          <Hand size={14} className="shrink-0 text-accent" />
          <span className="truncate text-[11px] text-mute">
            Drag to pan · pinch to zoom
          </span>
          <span className="flex-1" />
          <Chip onClick={onExitPan}>Back to Select</Chip>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 shrink-0 border-t border-line bg-ink-1/95">
      <div className="scroll-x mx-auto flex h-11 max-w-3xl items-center gap-1.5 px-2">
        {drawInsideName && (
          <>
            <Chip active icon={<Crop size={13} />} onClick={onExitDrawInside}>
              Inside {drawInsideName.length > 12 ? `${drawInsideName.slice(0, 12)}…` : drawInsideName}
            </Chip>
            <Divider />
          </>
        )}
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
            {(strokeColor === 'none' || strokeWidth === 0) && (
              <span className="shrink-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-wider text-accent">
                Guide preview · no stroke
              </span>
            )}
          </>
        )}

        {/* ---------------- Pencil ---------------- */}
        {tool === 'pencil' && (
          <>
            <span className="shrink-0 text-[11px] text-mute">
              Draw freehand · end on the start to close · fills when closed
            </span>
            <Divider />
            {(['tight', 'smooth', 'loose'] as const).map((level) => (
              <Chip
                key={level}
                active={pencilSmoothing === level}
                onClick={() => onChangePencilSmoothing(level)}
              >
                {level === 'tight' ? 'Tight' : level === 'smooth' ? 'Smooth' : 'Loose'}
              </Chip>
            ))}
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
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-mute">
              Stroke
            </span>
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
                <Chip
                  active={alignMenu}
                  icon={<AlignHorizontalJustifyStart size={13} />}
                  onClick={() => {
                    setMoreMenu(false);
                    setThreeDMenu(false);
                    setAlignMenu((v) => !v);
                  }}
                >
                  Align
                </Chip>
                <Chip
                  active={moreMenu}
                  icon={<SlidersHorizontal size={13} />}
                  onClick={() => {
                    setAlignMenu(false);
                    setThreeDMenu(false);
                    setMoreMenu((v) => !v);
                  }}
                >
                  More
                </Chip>
                {/* Named, because two bare mirror glyphs beside More read as
                    decoration nobody could identify. */}
                <Chip icon={<FlipHorizontal size={13} />} onClick={() => onFlip('horizontal')}>
                  Flip H
                </Chip>
                <Chip icon={<FlipVertical size={13} />} onClick={() => onFlip('vertical')}>
                  Flip V
                </Chip>
                {/* 3D used to be the second slider inside More, where it read as
                    a buried extra. It is its own panel now. */}
                <Chip
                  active={threeDMenu || extrudeDepth > 0}
                  icon={<Box size={13} />}
                  aria-label="3D settings"
                  onClick={() => {
                    setAlignMenu(false);
                    setMoreMenu(false);
                    setThreeDMenu((v) => !v);
                  }}
                >
                  3D{extrudeDepth > 0 ? ` · ${Math.round(extrudeDepth)}` : ''}
                </Chip>
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
            <span className="text-[11px] text-mute">or tap the canvas</span>
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

      {/* Panels live outside the scrolling strip — inside it their tops were
          clipped, which made Align and More look dead. */}
      {alignMenu && (
        <div className="absolute bottom-[calc(100%+6px)] left-2 z-40 w-[186px] rounded-xl border border-line bg-ink-2 p-1.5 shadow-2xl">
          <div className="grid grid-cols-3 gap-1">
            {ALIGN_BUTTONS.map((b) => (
              <button
                key={b.mode}
                type="button"
                aria-label={b.label}
                onClick={() => {
                  onAlign(b.mode);
                  setAlignMenu(false);
                }}
                className="press grid h-9 place-items-center rounded-lg bg-ink-3 text-dim hover:text-accent"
              >
                {b.icon}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {DISTRIBUTE_BUTTONS.map((b) => (
              <button
                key={b.axis}
                type="button"
                aria-label={b.label}
                onClick={() => {
                  onDistribute(b.axis);
                  setAlignMenu(false);
                }}
                className="press flex h-8 items-center justify-center gap-1 rounded-lg bg-ink-3 font-mono text-[9px] font-bold uppercase text-dim hover:text-accent"
              >
                {b.icon} {b.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {moreMenu && (
        <div className="absolute bottom-[calc(100%+6px)] right-2 z-40 max-h-[72dvh] w-[196px] overflow-y-auto rounded-xl border border-line bg-ink-2 p-1.5 shadow-2xl">
          <div className="flex items-center justify-between px-1 py-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-mute">
              {cornerTarget ? `Corner ${cornerTargetIndex + 1}` : 'Corner radius'}
            </span>
            <span className="font-mono text-[10px] font-bold text-accent">
              {Math.round(activeCornerRadius)}
            </span>
          </div>
          <div className="px-1">
            <RangeInput
              type="range"
              min={0}
              max={Math.max(240, Math.ceil(activeCornerRadius))}
              step={1}
              value={Math.round(activeCornerRadius)}
              onChange={(e) =>
                onRoundCorners(Number(e.target.value), cornerTarget ?? undefined)
              }
              aria-label={cornerTarget ? `Corner ${cornerTargetIndex + 1} radius` : 'Corner radius'}
            />
          </div>
          {cornerIds.length > 0 && (
            <div className="mt-1 flex max-h-14 flex-wrap gap-1 overflow-y-auto px-1">
              <button
                type="button"
                onClick={() => setCornerTarget(null)}
                aria-pressed={!cornerTarget}
                className={`press h-6 rounded-md px-1.5 font-mono text-[9px] font-bold uppercase ${
                  !cornerTarget ? 'bg-accent/15 text-accent' : 'bg-ink-3 text-dim'
                }`}
              >
                All
              </button>
              {cornerIds.map((id, index) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCornerTarget(id)}
                  aria-label={`Select corner ${index + 1}`}
                  aria-pressed={cornerTarget === id}
                  className={`press h-6 w-6 rounded-md font-mono text-[9px] font-bold ${
                    cornerTarget === id ? 'bg-accent/15 text-accent' : 'bg-ink-3 text-dim'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          )}
          <p className="px-1 pb-0.5 text-[9.5px] leading-snug text-mute">
            All corners, or pick a number to edit one · 0 restores sharp
          </p>
          <span className="mt-1.5 block px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-mute">
            Simplify
          </span>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 4, 8].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onSimplify(t);
                  setMoreMenu(false);
                }}
                className="press h-7 rounded-md bg-ink-3 font-mono text-[9px] font-bold text-dim hover:text-accent"
              >
                {t}
              </button>
            ))}
          </div>
          {canExpandStroke && onExpandStroke && (
            <button
              type="button"
              onClick={() => {
                onExpandStroke();
                setMoreMenu(false);
              }}
              className="press mt-1.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
            >
              <Spline size={12} /> Outline stroke
            </button>
          )}
          {selectedCount >= 2 && (
            <>
              <span className="mt-1.5 block px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-mute">
                Pathfinder
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ['union', 'Unite'],
                    ['subtract', 'Minus'],
                    ['intersect', 'Intersect'],
                    ['exclude', 'Exclude'],
                    ['divide', 'Divide'],
                  ] as [BooleanOperation, string][]
                ).map(([op, label]) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => {
                      onBoolean(op);
                      setMoreMenu(false);
                    }}
                    className="press h-8 rounded-lg bg-ink-3 text-[10px] font-semibold text-dim hover:text-accent"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {(canMakeClipMask || hasClipMask) && (
            <>
              <span className="mt-1.5 block px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-mute">
                Clipping
              </span>
              <div className="grid grid-cols-2 gap-1">
                {canMakeClipMask && (
                  <button
                    type="button"
                    onClick={() => {
                      onMakeClipMask();
                      setMoreMenu(false);
                    }}
                    className="press h-8 rounded-lg bg-accent/15 text-[10px] font-semibold text-accent"
                  >
                    Make mask
                  </button>
                )}
                {hasClipMask && (
                  <button
                    type="button"
                    onClick={() => {
                      onReleaseClipMask();
                      setMoreMenu(false);
                    }}
                    className="press h-8 rounded-lg bg-ink-3 text-[10px] font-semibold text-dim hover:text-accent"
                  >
                    Release
                  </button>
                )}
              </div>
            </>
          )}
          {(canDrawInside || drawInsideName) && (
            <div className="mt-1.5 grid grid-cols-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  if (drawInsideName) onExitDrawInside();
                  else onStartDrawInside();
                  setMoreMenu(false);
                }}
                className={`press flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-semibold ${
                  drawInsideName ? 'bg-accent/15 text-accent' : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                <Crop size={12} /> {drawInsideName ? 'Exit draw inside' : 'Draw inside'}
              </button>
            </div>
          )}
        </div>
      )}

      {threeDMenu && (
        <div className="absolute bottom-[calc(100%+6px)] left-2 z-40 max-h-[72dvh] w-[216px] overflow-y-auto rounded-xl border border-line bg-ink-2 p-2 shadow-2xl">
          <div className="flex items-center justify-between px-0.5">
            <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-mute">
              <Box size={11} /> 3D extrusion
            </span>
            <span className="font-mono text-[10px] font-bold text-accent">
              {Math.round(extrudeDepth)}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <button
              type="button"
              aria-pressed={extrudeDepth <= 0}
              onClick={() => onExtrudeDepth(0)}
              className={`press h-7 rounded-md font-mono text-[9px] font-bold uppercase ${
                extrudeDepth <= 0 ? 'bg-accent/15 text-accent' : 'bg-ink-3 text-dim'
              }`}
            >
              Flat
            </button>
            <button
              type="button"
              aria-pressed={extrudeDepth > 0}
              onClick={() => onExtrudeDepth(extrudeDepth > 0 ? extrudeDepth : lastExtrudeDepth)}
              className={`press h-7 rounded-md font-mono text-[9px] font-bold uppercase ${
                extrudeDepth > 0 ? 'bg-accent/15 text-accent' : 'bg-ink-3 text-dim'
              }`}
            >
              3D
            </button>
          </div>
          <div className="mt-1.5 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={160}
              step={1}
              value={Math.round(extrudeDepth)}
              disabled={!canExtrude}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (next > 0) setLastExtrudeDepth(next);
                onExtrudeDepth(next);
              }}
              aria-label="3D extrusion depth"
            />
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {EXTRUDE_DEPTH_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                aria-pressed={Math.round(extrudeDepth) === preset.value}
                onClick={() => {
                  setLastExtrudeDepth(preset.value);
                  onExtrudeDepth(preset.value);
                }}
                className={`press h-6 rounded-md font-mono text-[9px] font-bold uppercase ${
                  Math.round(extrudeDepth) === preset.value
                    ? 'bg-accent/15 text-accent'
                    : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-mute">
              Direction
            </span>
            <span className="font-mono text-[9px] text-dim">
              {EXTRUDE_DIRECTIONS.find((d) => d.angle === activeExtrudeAngle)?.label.replace(
                'Extrude ',
                ''
              )}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {EXTRUDE_DIRECTION_GRID.map((angle) => {
              if (angle === null) {
                return (
                  <span
                    key="hub"
                    className="grid h-7 place-items-center rounded-md bg-ink-3/50 text-mute"
                  >
                    <Box size={10} />
                  </span>
                );
              }
              const direction = EXTRUDE_DIRECTIONS.find((d) => d.angle === angle);
              return (
                <button
                  key={angle}
                  type="button"
                  aria-label={direction?.label}
                  aria-pressed={activeExtrudeAngle === angle}
                  onClick={() => onExtrudeAngle(angle)}
                  className={`press grid h-7 place-items-center rounded-md text-[12px] leading-none ${
                    activeExtrudeAngle === angle
                      ? 'bg-accent/15 text-accent'
                      : 'bg-ink-3 text-dim hover:text-accent'
                  }`}
                >
                  {direction?.glyph}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-mute">
              Taper
            </span>
            <span className="font-mono text-[9px] text-dim">
              {Math.round(extrudeTaper * 100)}%
            </span>
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={45}
              step={1}
              value={Math.round(extrudeTaper * 100)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudeTaper(Number(e.target.value) / 100)}
              aria-label="3D taper"
            />
          </div>
          <button
            type="button"
            aria-pressed={extrudeShadow}
            onClick={() => onExtrudeShadow(!extrudeShadow)}
            className={`press mt-1.5 flex h-7 w-full items-center justify-center gap-1.5 rounded-md font-mono text-[9px] font-bold uppercase ${
              extrudeShadow ? 'bg-accent/15 text-accent' : 'bg-ink-3 text-dim'
            }`}
          >
            Shadow {extrudeShadow ? 'on' : 'off'}
          </button>
          <p className="mt-1 px-0.5 text-[9.5px] leading-snug text-mute">
            {canExtrude
              ? 'Pulls the solid along the arrow · lit from the top left'
              : 'Closed shapes only — outline a stroke or convert text to curves first'}
          </p>
        </div>
      )}
    </div>
  );
};
