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
  Lock,
  LockOpen,
  Maximize2,
  Minus as Line,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Pipette,
  Move,
  Layers as LayersIcon,
  Combine,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { PencilSmoothing, ShapeKind, ToolType } from '../types/vector';
import { BooleanOperation } from '../utils/shapeBuilder';
import { AlignMode, DistributeAxis } from '../utils/align';
import { Chip, IconButton, RangeInput } from './ui/primitives';
import { ToolPanel, readClosedPanels, writeClosedPanels } from './ToolPanel';
import { NumberField as EditableNumber } from './ui/primitives';

/**
 * One-tap shadow colours. They are shortcuts, not the whole story: the picker
 * beside them reaches every colour the device can show.
 */
const SHADOW_PRESET_COLORS: Array<{ color: string; name: string }> = [
  { color: '#0b1220', name: 'ink' },
  { color: '#2f6fdb', name: 'blue' },
  { color: '#7a5cff', name: 'violet' },
  { color: '#ffffff', name: 'white' },
];

import { WARP_KINDS, WarpKind, WarpSpec } from '../utils/warp';
import { TEXT_PATH_ALIGNS, TextPathAlign } from '../utils/textPath';
import { PathAlignThumb, WarpThumb } from './EffectPreviews';
import { warpFold } from '../utils/warpFold';
import type { BlurEffect, PatternFill, ShadowEffect } from '../types/vector';
import { patternLayout,
  patternTransform, PatternSettings } from '../utils/effects';
import { pathToSvgD } from '../utils/bezier';

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
  /** Group the selection into one object, as the Objects panel does */
  onGroup: () => void;
  /** Merge the selection into one editable path */
  onMerge: () => void;
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
  /** Degrees the artwork is tipped back into the screen */
  extrudeTilt?: number;
  extrudeTurn?: number;
  extrudePerspective?: number;
  onExtrudeTaper: (taper: number) => void;
  onExtrudeTilt: (tilt: number) => void;
  onExtrudeTurn: (turn: number) => void;
  onExtrudePerspective: (perspective: number) => void;
  /** Chamfer width on the front rim, in artboard units */
  extrudeBevel?: number;
  onExtrudeBevel: (bevel: number) => void;
  /** Rim profile: a single chamfer or a rounded rollover */
  extrudeBevelStyle?: 'chamfer' | 'round';
  onExtrudeBevelStyle: (style: 'chamfer' | 'round') => void;
  /** Key light direction in degrees; undefined rides 55° off the pull */
  extrudeLight?: number;
  onExtrudeLight: (angle: number) => void;
  /** Front-face highlight strength, 0–1 */
  extrudeGloss?: number;
  onExtrudeGloss: (gloss: number) => void;
  /** Ground shadow blur multiplier */
  extrudeShadowSoft?: number;
  onExtrudeShadowSoft: (soft: number) => void;
  /** Ground shadow distance multiplier */
  extrudeShadowLift?: number;
  onExtrudeShadowLift: (lift: number) => void;
  extrudeShadow?: boolean;
  onExtrudeShadow: (on: boolean) => void;
  onSimplify: (tolerance: number) => void;
  /** Turns a stroke into a closed fill so the shape builder can use it */
  onExpandStroke?: () => void;
  canExpandStroke?: boolean;
  onExitPan: () => void;
  onAlign: (mode: AlignMode) => void;
  /** The selection's frame in artboard units, for exact X/Y/W/H fields */
  transformBox?: { x: number; y: number; width: number; height: number } | null;
  onTransformPosition?: (axis: 'x' | 'y', value: number) => void;
  onTransformSize?: (axis: 'w' | 'h', value: number) => void;
  /** Turns the selection by an exact number of degrees */
  onTurnSelection?: (degrees: number) => void;
  /** The angle the selection is currently turned to, in degrees */
  selectionRotation?: number;
  /** Turns the selection to an angle, so 0 restores its original orientation */
  onSetRotation?: (degrees: number) => void;
  onDistribute: (axis: DistributeAxis) => void;
  /** Cuts the selection into a rows × cols grid of separate closed shapes */
  onSplitGrid: (rows: number, cols: number, gap: number) => void;
  /** Outlines the selection at a distance; the original object stays put */
  onOffsetPath: (distance: number) => void;
  /** Blur every selected object; 'none' clears it */
  onBlurSelection: (kind: 'none' | 'gaussian' | 'motion', amount: number, angle: number) => void;
  /** Paint a drop shadow behind every selected object; null clears it */
  onShadowSelection: (shadow: ShadowEffect | null) => void;
  /** Tiles the selection as each object's own fill */
  onPattern: (settings: PatternSettings) => void;
  onClearPattern: () => void;
  /** Saves the selection into the pattern library */
  onSavePattern?: () => void;
  /** Adds the tile to the library without filling the selection */
  /** Drops the pattern on the canvas, unclipped, as a swatch shape */
  onPreviewPattern?: () => void;
  onOpenPatterns?: () => void;
  /** The selection's current paint, so the panels open on what you see */
  selectionBlur?: BlurEffect | null;
  selectionShadow?: ShadowEffect | null;
  selectionPattern?: PatternFill | null;
  /** The shape paint preview: the selected outline plus its artboard box */
  patternMask?: { d: string; x: number; y: number; width: number; height: number } | null;
  onWarp?: (spec: WarpSpec) => void;
  /** Live canvas preview while the warp is being adjusted */
  onWarpPreview?: (spec: WarpSpec | null) => void;
  /** The selected label's live warp, set while its glyphs are bent on screen */
  textWarp?: WarpSpec | null;
  onClearWarp?: () => void;
  /** The selected shape's own warp, so the panel opens on its real amount */
  shapeWarp?: WarpSpec | null;
  /** Extra pixels between letters on the selected label */
  textTracking?: number;
  /** Tightens or opens the gaps without retyping the string */
  onTextTracking?: (value: number) => void;
  /** Wraps a label's words inside the selected closed shape */
  onTextInShape?: () => void;
  canTextInShape?: boolean;
  onTextOnPath?: () => void;
  onDetachTextPath?: () => void;
  onTextPathOffset?: (offset: number) => void;
  hasTextPath?: boolean;
  textPathOffset?: number;
  textPathNudge?: number;
  onTextPathNudge?: (offset: number) => void;
  /** Where the string sits on the outline */
  textPathAlign?: TextPathAlign;
  onTextPathAlign?: (align: TextPathAlign) => void;
  /** Runs the string the other way round the outline */
  textPathReverse?: boolean;
  onTextPathReverse?: (reverse: boolean) => void;
  /** The reference image picked on the canvas, if any */
  reference?: { name: string; opacity: number; locked: boolean } | null;
  onReferenceOpacity?: (opacity: number) => void;
  onToggleReferenceLock?: () => void;
  onFitReference?: () => void;
  onDeleteReference?: () => void;
}


/**
 * The two arrow buttons that change a stroke's width. Pen and pencil both need
 * it, and it used to be pasted into each block.
 */
const StrokeStepper: React.FC<{ width: number; onChange: (width: number) => void }> = ({
  width,
  onChange,
}) => (
  <div className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-line bg-ink-0 px-1">
    <IconButton label="Thinner stroke" size="sm" onClick={() => onChange(Math.max(0.5, width - 1))}>
      <Minus size={12} />
    </IconButton>
    <span className="w-6 text-center font-mono text-[11px] font-bold text-dim">{width}</span>
    <IconButton label="Thicker stroke" size="sm" onClick={() => onChange(width + 1)}>
      <Plus size={12} />
    </IconButton>
  </div>
);

/**
 * One labelled, fixed slot per job, as PixelLab's phone bar does: icon over a
 * short name, equal widths, never a horizontal scroll. Tabs replace the old
 * chip row only while an object is selected, so they stay predictable.
 */
const PanelTab: React.FC<{
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, icon, active, disabled = false, onClick }) => (
  <button
    type="button"
    // Omitted for action tabs (Text): only the toggles report a pressed state.
    aria-pressed={active}
    disabled={disabled}
    onClick={onClick}
    className={`press relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border ${
      active ? 'border-accent/40 bg-accent/10 text-accent' : 'border-transparent text-dim'
    } disabled:pointer-events-none disabled:opacity-30`}
  >
    {active && <span className="absolute top-0 h-[2px] w-5 rounded-full bg-accent" />}
    {icon}
    <span className="max-w-full truncate font-sans text-[9.5px] font-semibold uppercase leading-none tracking-[0.02em]">
      {label}
    </span>
  </button>
);

/**
 * One name per job. The panel title is the tool's, not the selection's, so the
 * same tool always opens the same panel in the same place.
 */
const TOOL_PANELS: Record<ToolType, { name: string; hint: string; icon: React.ReactNode }> = {
  select: {
    name: 'Select',
    hint: 'Tap an object to act on it · drag to marquee',
    icon: <Move size={13} />,
  },
  'direct-select': {
    name: 'Node edit',
    hint: 'Tap a path, then a node to move it',
    icon: <Spline size={13} />,
  },
  pen: {
    name: 'Pen',
    hint: 'Tap to place a point · drag to pull curves',
    icon: <CornerDownRight size={13} />,
  },
  pencil: {
    name: 'Pencil',
    hint: 'Draw freehand · end on the start to close',
    icon: <Spline size={13} />,
  },
  'pressure-brush': {
    name: 'Pressure brush',
    hint: 'Drag to paint · pressure changes the width',
    icon: <Spline size={13} />,
  },
  shape: {
    name: 'Shape',
    hint: 'Pick a shape, then drag on the canvas',
    icon: <Square size={13} />,
  },
  'shape-builder': {
    name: 'Shape builder',
    hint: 'Drag across regions · hold Alt to erase',
    icon: <Combine size={13} />,
  },
  text: {
    name: 'Type',
    hint: 'Add a label, or tap one to edit it',
    icon: <TypeIcon size={13} />,
  },
  hand: {
    name: 'Pan',
    hint: 'Drag to pan · pinch to zoom',
    icon: <Hand size={13} />,
  },
};

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
    title={color === 'none' ? `${label} — none` : label}
    className="press relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-ink-2"
  >
    {hollow ? (
      <span
        className="h-[18px] w-[18px] rounded-[4px]"
        style={{
          border:
            color === 'none'
              ? '1.5px dashed #8b93a7'
              : `${Math.min(3, Math.max(1.5, (width ?? 2) / 2))}px solid ${color}`,
        }}
      />
    ) : (
      <span
        className="h-[18px] w-[18px] rounded-[4px]"
        style={{
          backgroundColor: color === 'none' ? 'transparent' : color,
        }}
      />
    )}
    {/* A red stroke through the chip: at a glance, none means none — not a
        very dark colour or an empty slot that failed to paint. */}
    {color === 'none' && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid place-items-center"
      >
        <span className="h-[2px] w-[26px] -rotate-45 rounded-full bg-danger shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
      </span>
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
  onGroup,
  onMerge,
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
  extrudeTilt = 45,
  extrudeTurn = 0,
  extrudePerspective = 0.25,
  extrudeBevel = 7,
  onExtrudeBevel,
  extrudeBevelStyle = 'chamfer',
  onExtrudeBevelStyle,
  extrudeLight,
  onExtrudeLight,
  extrudeGloss = 0.18,
  onExtrudeGloss,
  extrudeShadowSoft = 1,
  onExtrudeShadowSoft,
  extrudeShadowLift = 1,
  onExtrudeShadowLift,
  extrudeShadow = true,
  onExtrudeDepth,
  onExtrudeAngle,
  onExtrudeTaper,
  onExtrudeTilt,
  onExtrudeTurn,
  onExtrudePerspective,
  onExtrudeShadow,
  onSimplify,
  onExpandStroke,
  canExpandStroke,
  onExitPan,
  onAlign,
  transformBox,
  onTransformPosition,
  onTransformSize,
  onTurnSelection,
  selectionRotation = 0,
  onSetRotation,
  onDistribute,
  onSplitGrid,
  onOffsetPath,
  onBlurSelection,
  onShadowSelection,
  onPattern,
  onClearPattern,
  onSavePattern,
  onPreviewPattern,
  onOpenPatterns,
  selectionBlur = null,
  selectionShadow = null,
  selectionPattern = null,
  patternMask = null,
  onWarp,
  onWarpPreview,
  textWarp = null,
  onClearWarp,
  shapeWarp = null,
  textTracking = 0,
  onTextTracking,
  onTextInShape,
  canTextInShape = false,
  onTextOnPath,
  onDetachTextPath,
  onTextPathOffset,
  hasTextPath = false,
  textPathOffset = 0,
  textPathNudge = 0,
  textPathAlign = 'baseline',
  onTextPathAlign,
  textPathReverse = false,
  onTextPathReverse,
  onTextPathNudge,
  reference = null,
  onReferenceOpacity,
  onToggleReferenceLock,
  onFitReference,
  onDeleteReference,
}) => {
  const isDrawing = drawingPointCount > 0 && (tool === 'pen' || tool === 'pressure-brush');

  /** The selection row: object chips in select mode, node chips in node editing. */
  const selectionStripVisible =
    !isDrawing && !reference && selectedCount > 0 && tool !== 'shape';

  /** Object, Arrange, Effects and 3D — the tabs that open a panel in the chrome. */
  const objectChipsVisible = selectionStripVisible && tool !== 'direct-select';

  /** Nothing selected in Select: the bar becomes the Add palette. */
  const addChipsVisible = tool === 'select' && selectedCount === 0 && !isDrawing && !reference;

  /** Transform also needs a frame; it is the one object chip that can vanish alone. */
  const transformChipVisible =
    objectChipsVisible && Boolean(transformBox) && Boolean(onTransformPosition && onTransformSize);

  /**
   * The strip never re-arranges itself: every tool shows the same five slots,
   * and its options live in a named panel that stays open until it is closed.
   * The choice is remembered per panel, so a tool you have already arranged
   * does not reopen a panel you dismissed every time you return to it.
   */
  const [closedPanels, setClosedPanels] = React.useState<string[]>(() => readClosedPanels());
  const panel = reference
    ? { name: 'Reference', hint: 'Drag to move · corners resize', icon: <Crop size={13} /> }
    : TOOL_PANELS[tool];

  /**
   * The panel body as a list of blocks. A list rather than a run of
   * `{condition && …}` lets the panel ask whether it has anything to show: a
   * Select panel with an object picked used to render as an empty card.
   */
  const panelBlocks = [
    drawInsideName && (
      <Chip key="inside" active icon={<Crop size={13} />} onClick={onExitDrawInside}>
        Inside {drawInsideName.length > 12 ? `${drawInsideName.slice(0, 12)}…` : drawInsideName}
      </Chip>
    ),
    reference && (
      <React.Fragment key="reference">
        <span className="max-w-[92px] shrink-0 truncate text-[11px] font-semibold text-text">
          {reference.name}
        </span>
        <span className="shrink-0 font-sans text-[9px] uppercase tracking-wider text-mute">
          Opacity
        </span>
        <RangeInput
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={reference.opacity}
          onChange={(e) => onReferenceOpacity?.(parseFloat(e.target.value))}
          aria-label="Reference opacity"
          className="w-20 shrink-0"
        />
        <span className="w-7 shrink-0 text-right font-mono text-[10px] font-bold text-dim">
          {Math.round(reference.opacity * 100)}%
        </span>
        <Chip
          active={reference.locked}
          icon={reference.locked ? <Lock size={13} /> : <LockOpen size={13} />}
          onClick={onToggleReferenceLock}
        >
          {reference.locked ? 'Locked' : 'Unlocked'}
        </Chip>
        <Chip icon={<Maximize2 size={13} />} onClick={onFitReference}>
          Fit
        </Chip>
        <IconButton label="Remove reference" size="sm" tone="danger" onClick={onDeleteReference}>
          <Trash2 size={14} />
        </IconButton>
      </React.Fragment>
    ),
    isDrawing && (
      <React.Fragment key="drawing">
        <span className="rounded-full bg-accent/15 px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-accent">
          {drawingPointCount} {drawingPointCount === 1 ? 'node' : 'nodes'}
        </span>
        <Chip icon={<Check size={13} />} onClick={onFinishPath}>
          Done
        </Chip>
        {tool === 'pen' && drawingPointCount >= 2 && <Chip onClick={onClosePath}>Close</Chip>}
        <Chip icon={<X size={13} />} onClick={onCancelPath}>
          Cancel
        </Chip>
      </React.Fragment>
    ),
    !isDrawing && tool === 'shape-builder' && (
      <React.Fragment key="shape-builder">
        <Chip active={sbMode === 'merge'} onClick={() => onChangeSbMode('merge')}>
          Merge
        </Chip>
        <Chip active={sbMode === 'erase'} onClick={() => onChangeSbMode('erase')}>
          Erase
        </Chip>
      </React.Fragment>
    ),
    !isDrawing && tool === 'shape' && (
      <React.Fragment key="shape">
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
      </React.Fragment>
    ),
    !isDrawing && (tool === 'pen' || tool === 'pressure-brush') && (
      <React.Fragment key="pen">
        <Chip icon={<SlidersHorizontal size={13} />} onClick={onOpenPressure}>
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
        <StrokeStepper width={strokeWidth} onChange={onChangeStrokeWidth} />
        {(strokeColor === 'none' || strokeWidth === 0) && (
          <span className="shrink-0 whitespace-nowrap font-sans text-[9px] uppercase tracking-wider text-accent">
            Guide preview · no stroke
          </span>
        )}
      </React.Fragment>
    ),
    tool === 'pencil' && (
      <React.Fragment key="pencil">
        {(['tight', 'smooth', 'loose'] as const).map((level) => (
          <Chip
            key={level}
            active={pencilSmoothing === level}
            onClick={() => onChangePencilSmoothing(level)}
          >
            {level === 'tight' ? 'Tight' : level === 'smooth' ? 'Smooth' : 'Loose'}
          </Chip>
        ))}
        <StrokeStepper width={strokeWidth} onChange={onChangeStrokeWidth} />
      </React.Fragment>
    ),
    !isDrawing && tool === 'text' && selectedCount === 0 && (
      <Chip key="text" icon={<TypeIcon size={13} />} onClick={onOpenText}>
        Add text
      </Chip>
    ),
    !isDrawing && tool === 'select' && selectedCount === 0 && (
      <React.Fragment key="select">
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
      </React.Fragment>
    ),
  ].filter((block): block is React.ReactElement => Boolean(block));

  const hasPanelContent = panelBlocks.length > 0;
  // A panel's presence is the user's choice and nothing else. It used to be
  // forced open while a stroke was in flight, so a panel you had closed
  // appeared the moment you touched the canvas and vanished on release.
  const panelIsOpen = hasPanelContent && !closedPanels.includes(panel.name);
  const togglePanel = () => {
    if (!hasPanelContent) return;
    const next = panelIsOpen
      ? [...closedPanels, panel.name]
      : closedPanels.filter((name) => name !== panel.name);
    setClosedPanels(next);
    writeClosedPanels(next);
  };

  const [alignMenu, setAlignMenu] = React.useState(false);
  const [moreMenu, setMoreMenu] = React.useState(false);
  const [threeDMenu, setThreeDMenu] = React.useState(false);
  const [transformMenu, setTransformMenu] = React.useState(false);
  const [gridRows, setGridRows] = React.useState(2);
  const [gridCols, setGridCols] = React.useState(2);
  // A visible seam: cells cut flush share a fill and read as one object.
  const [gridGap, setGridGap] = React.useState(2);
  const [offsetDistance, setOffsetDistance] = React.useState(8);
  const [blurKind, setBlurKind] = React.useState<'none' | 'gaussian' | 'motion'>('gaussian');
  const [blurAmount, setBlurAmount] = React.useState(8);
  const [blurAngle, setBlurAngle] = React.useState(0);

  // Shadow: offsets and softness in artboard units, painted behind the object.
  // The defaults are the shadow a logo usually wants — down and right, soft,
  // and dark enough to read on white without turning into a smudge.
  const [shadowOn, setShadowOn] = React.useState(false);
  const [shadowDx, setShadowDx] = React.useState(6);
  const [shadowDy, setShadowDy] = React.useState(10);
  const [shadowBlur, setShadowBlur] = React.useState(18);
  const [shadowOpacity, setShadowOpacity] = React.useState(0.35);
  const [shadowColor, setShadowColor] = React.useState('#0b1220');
  const [shadowInset, setShadowInset] = React.useState(false);
  const shadowColorIsPreset = SHADOW_PRESET_COLORS.some(
    ({ color }) => color === shadowColor.toLowerCase()
  );
  // A colour input only accepts #rrggbb; anything else would silently show black.
  const shadowPickerValue = /^#[0-9a-f]{6}$/i.test(shadowColor) ? shadowColor : '#0b1220';
  const [patternScale, setPatternScale] = React.useState(100);
  const [patternRotation, setPatternRotation] = React.useState(0);
  const [patternTileType, setPatternTileType] = React.useState<
    'grid' | 'brick-row' | 'brick-column' | 'hex'
  >(
    'grid'
  );
  const [patternSpacing, setPatternSpacing] = React.useState(0);
  const [patternOffsetX, setPatternOffsetX] = React.useState(0);
  const [patternOffsetY, setPatternOffsetY] = React.useState(0);
  const [pathNudge, setPathNudge] = React.useState(textPathNudge);
  const [warpPreviewOn, setWarpPreviewOn] = React.useState(false);
  const morePanelRef = React.useRef<HTMLDivElement | null>(null);

  // One panel was a long scroll of unrelated controls, so every feature now
  // gets its own named section and a switcher to jump straight to it.
  const jumpToMoreSection = (match: string) => {
    const panel = morePanelRef.current;
    if (!panel) return;
    const heading = Array.from(panel.querySelectorAll('span')).find((node) =>
      (node.textContent ?? '').trim().startsWith(match)
    );
    heading?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const [warpKind, setWarpKind] = React.useState<WarpKind>('arch');
  const [warpAmount, setWarpAmount] = React.useState(24);
  const [warpSway, setWarpSway] = React.useState(0);
  const [warpCycles, setWarpCycles] = React.useState(1);
  // 0 keeps the bend's own circle; a value puts the arc on a badge circle.
  const [warpRadius, setWarpRadius] = React.useState(0);
  const [pathOffset, setPathOffset] = React.useState(textPathOffset);
  const [pathAlign, setPathAlign] = React.useState<TextPathAlign>(textPathAlign);
  const [pathReverse, setPathReverse] = React.useState(textPathReverse);

  // Panels open on the selection's real paint instead of on stale defaults.
  React.useEffect(() => {
    if (!selectionBlur) {
      setBlurKind('none');
      return;
    }
    setBlurKind(selectionBlur.kind);
    setBlurAmount(Math.round(selectionBlur.amount));
    setBlurAngle(Math.round(selectionBlur.angle));
  }, [selectionBlur?.kind, selectionBlur?.amount, selectionBlur?.angle]);

  React.useEffect(() => {
    if (!selectionShadow) {
      setShadowOn(false);
      return;
    }
    setShadowOn(true);
    setShadowDx(Math.round(selectionShadow.dx));
    setShadowDy(Math.round(selectionShadow.dy));
    setShadowBlur(Math.round(selectionShadow.blur));
    setShadowOpacity(selectionShadow.opacity);
    setShadowColor(selectionShadow.color);
    setShadowInset(selectionShadow.inset === true);
  }, [
    selectionShadow?.dx,
    selectionShadow?.dy,
    selectionShadow?.blur,
    selectionShadow?.opacity,
    selectionShadow?.color,
    selectionShadow?.inset,
  ]);

  /** A shadow stepper whose buttons name the effect they change. */
  const shadowStepper = (
    label: string,
    value: string,
    onMinus: () => void,
    onPlus: () => void
  ) => (
    <div className="mt-1 flex items-center justify-between px-1" key={label}>
      <span className="font-sans text-[9px] uppercase tracking-wider text-mute">{label}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={`Decrease shadow ${label.toLowerCase()}`}
          onClick={onMinus}
          className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
        >
          <Minus size={10} />
        </button>
        <span className="w-12 text-center font-mono text-[10px] font-bold text-text">{value}</span>
        <button
          type="button"
          aria-label={`Increase shadow ${label.toLowerCase()}`}
          onClick={onPlus}
          className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
        >
          <Plus size={10} />
        </button>
      </div>
    </div>
  );

  const pushShadow = (patch: Partial<ShadowEffect>) => {
    onShadowSelection({
      dx: shadowDx,
      dy: shadowDy,
      blur: shadowBlur,
      opacity: shadowOpacity,
      color: shadowColor,
      ...(shadowInset ? { inset: true } : {}),
      ...patch,
    });
  };

  // The panel opens on whatever warp the selection already carries — a label's
  // spec, or a shape's recorded one — so the amount shown is the amount in use.
  const activeWarp = textWarp ?? shapeWarp;

  React.useEffect(() => {
    if (!activeWarp) return;
    setWarpKind(activeWarp.kind);
    setWarpAmount(Math.round(activeWarp.amount));
    setWarpSway(Math.round(activeWarp.sway ?? 0));
    setWarpCycles(activeWarp.cycles ?? 1);
    setWarpRadius(Math.round(activeWarp.radius ?? 0));
  }, [activeWarp?.kind, activeWarp?.amount, activeWarp?.sway, activeWarp?.cycles, activeWarp?.radius]);

  React.useEffect(() => {
    setPathAlign(textPathAlign);
    setPathReverse(textPathReverse);
  }, [textPathAlign, textPathReverse]);

  // The artboard follows the panel: picking a style or pushing Bend repaints the
  // selection immediately, the way a Preview checkbox works. Nothing is
  // committed until Apply, and closing the panel drops the preview.
  React.useEffect(() => {
    if (!moreMenu || !warpPreviewOn) {
      onWarpPreview?.(null);
      return;
    }
    onWarpPreview?.({ kind: warpKind, amount: warpAmount, sway: warpSway, cycles: warpCycles });
  }, [moreMenu, warpPreviewOn, warpKind, warpAmount, warpSway, warpCycles, onWarpPreview]);

  React.useEffect(() => {
    if (!selectionPattern) return;
    setPatternTileType(selectionPattern.tileType ?? 'grid');
    setPatternSpacing(selectionPattern.spacing ?? 0);
    setPatternOffsetX(selectionPattern.offsetX ?? 0);
    setPatternOffsetY(selectionPattern.offsetY ?? 0);
  }, [selectionPattern?.tileType, selectionPattern?.spacing, selectionPattern?.offsetX, selectionPattern?.offsetY]);

  React.useEffect(() => {
    setPathNudge(Math.round(textPathNudge));
  }, [textPathNudge]);

  React.useEffect(() => {
    if (selectionPattern) {
      setPatternScale(Math.round(selectionPattern.scale * 100));
      setPatternRotation(Math.round(selectionPattern.rotation));
    }
  }, [selectionPattern?.scale, selectionPattern?.rotation]);

  React.useEffect(() => {
    setPathOffset(Math.round(textPathOffset));
  }, [textPathOffset]);
  // Remembered so the Flat/3D toggle can bring the last depth back
  const [lastExtrudeDepth, setLastExtrudeDepth] = React.useState(24);
  const [cornerTarget, setCornerTarget] = React.useState<string | null>(null);
  const cornerTargetIndex = cornerTarget ? cornerIds.indexOf(cornerTarget) : -1;
  const activeCornerRadius = cornerTarget
    ? cornerRadii?.[cornerTarget] ?? cornerRadius
    : cornerRadius;
  const patternValue: PatternSettings = {
    scale: patternScale / 100,
    rotation: patternRotation,
    tileType: patternTileType,
    spacing: patternSpacing,
    offsetX: patternOffsetX,
    offsetY: patternOffsetY,
  };

  const pushPattern = (patch: Partial<PatternSettings>) => {
    if (!selectionPattern) return;
    onPattern({ ...patternValue, ...patch });
  };

  const stepperRow = (label: string, value: string, onMinus: () => void, onPlus: () => void) => (
    <div className="mt-1 flex items-center justify-between px-1" key={label}>
      <span className="font-sans text-[9px] uppercase tracking-wider text-mute">{label}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={`Less ${label}`}
          onClick={onMinus}
          className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
        >
          <Minus size={10} />
        </button>
        <span className="w-10 text-center font-mono text-[10px] font-bold text-text">{value}</span>
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={onPlus}
          className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
        >
          <Plus size={10} />
        </button>
      </div>
    </div>
  );

  const patternSwatch = (() => {
    if (!selectionPattern || !selectionPattern.paths.length) return null;
    const fill = { ...selectionPattern, ...patternValue };
    const layout = patternLayout(fill);
    const tiles = layout.copies.flatMap((copy, copyIndex) =>
      selectionPattern.paths.map((tile, tileIndex) => {
        const d = pathToSvgD(tile);
        if (!d) return null;
        return (
          <path
            key={`${copyIndex}-${tileIndex}`}
            d={d}
            transform={`translate(${copy.dx} ${copy.dy})`}
            fill={tile.fill}
            fillOpacity={tile.fillOpacity ?? 1}
            fillRule="evenodd"
          />
        );
      })
    );
    // The preview is a working surface, not a thumbnail: the cell box, the
    // repeat edges and the stagger are the three things that decide whether a
    // tiling reads as a pattern or as a mistake.
    const cellW = layout.width;
    const cellH = layout.height;
    const span = Math.max(cellW, cellH);
    const pad = span * 0.16;
    const view = `${-pad} ${-pad} ${cellW * 2 + pad * 2} ${cellH * 2 + pad * 2}`;
    const artCX = (layout.artOffsetX + Math.max(1, fill.tileW) / 2) * layout.scale;
    const artCY = (layout.artOffsetY + Math.max(1, fill.tileH) / 2) * layout.scale;
    const stagger = fill.tileType === 'brick-row' || fill.tileType === 'brick-column' || fill.tileType === 'hex';
    const label = span * 0.075;
    const edges = [
      `M ${0} ${-pad} V ${cellH * 2 + pad}`,
      `M ${cellW} ${-pad} V ${cellH * 2 + pad}`,
      `M ${cellW * 2} ${-pad} V ${cellH * 2 + pad}`,
      `M ${-pad} ${0} H ${cellW * 2 + pad}`,
      `M ${-pad} ${cellH} H ${cellW * 2 + pad}`,
      `M ${-pad} ${cellH * 2} H ${cellW * 2 + pad}`,
    ];
    return (
      <div className="mt-1">
        <svg
          viewBox={view}
          preserveAspectRatio="xMidYMid meet"
          className="h-44 w-full rounded-md border border-line bg-ink-0"
          aria-label="Pattern editing preview"
        >
          <rect
            x={-pad}
            y={-pad}
            width={cellW * 2 + pad * 2}
            height={cellH * 2 + pad * 2}
            fill="#0b0e14"
          />
          <rect
            x={-pad}
            y={-pad}
            width={cellW * 2 + pad * 2}
            height={cellH * 2 + pad * 2}
            fill="url(#pattern-panel-tiles)"
          />
          {edges.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="#5b6478"
              strokeWidth={span * 0.006}
              strokeDasharray={`${label * 0.42} ${label * 0.3}`}
            />
          ))}
          <rect
            x={0}
            y={0}
            width={cellW}
            height={cellH}
            fill="#7aa2ff"
            fillOpacity={0.06}
            stroke="#7aa2ff"
            strokeWidth={span * 0.013}
          />
          <text x={cellW / 2} y={-pad * 0.3} fill="#8b93a7" fontSize={label} textAnchor="middle">
            one cell · {Math.round(layout.cellW)} × {Math.round(layout.cellH)}
          </text>
          {stagger && (
            <>
              <path
                d={`M ${artCX} ${artCY} L ${artCX + cellW / 2} ${artCY + cellH / 2}`}
                fill="none"
                stroke="#f0b45a"
                strokeWidth={span * 0.009}
                strokeDasharray={`${label * 0.34} ${label * 0.26}`}
              />
              <circle cx={artCX} cy={artCY} r={label * 0.3} fill="#7aa2ff" />
              <circle cx={artCX + cellW / 2} cy={artCY + cellH / 2} r={label * 0.3} fill="#f0b45a" />
              <text
                x={artCX + cellW / 4}
                y={artCY + cellH / 4 - label * 0.55}
                textAnchor="middle"
                fill="#f0b45a"
                fontSize={label * 0.92}
              >
                {fill.tileType === 'hex' ? 'hex stagger · half a tile' : 'brick offset · half a tile'}
              </text>
            </>
          )}
        </svg>
        <p className="mt-0.5 px-1 text-[9px] leading-snug text-mute">
          Accent box is one cell · dashed lines are the repeat edges
          {stagger ? ' · amber is the offset between rows' : ' · an aligned grid, no offset'}
        </p>
        {patternMask && (
          <svg
            viewBox={`${patternMask.x} ${patternMask.y} ${patternMask.width} ${patternMask.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="mt-1 h-12 w-full rounded-md border border-line bg-ink-0"
            aria-label="Pattern on this shape"
          >
            <defs>
              <pattern
                id="pattern-panel-on-shape"
                patternUnits="userSpaceOnUse"
                width={layout.width}
                height={layout.height}
                patternTransform={patternTransform(fill, { x: patternMask.x, y: patternMask.y })}
              >
                <g transform={`scale(${layout.scale})`}>{tiles}</g>
              </pattern>
            </defs>
            <path d={patternMask.d} fill="url(#pattern-panel-on-shape)" fillRule="evenodd" />
          </svg>
        )}
      </div>
    );
  })();

  const activeExtrudeAngle = ((Math.round(extrudeAngle / 45) * 45) % 360 + 360) % 360;

  React.useEffect(() => {
    if (cornerTarget && !cornerIds.includes(cornerTarget)) setCornerTarget(null);
  }, [cornerIds, cornerTarget]);

  /**
   * A panel closes only when the selection it belongs to is gone, never because
   * a handle went under a finger for a moment. Closing the Object panel on
   * every transient frame change made a panel flicker shut mid-transform.
   */
  React.useEffect(() => {
    if (objectChipsVisible) return;
    setMoreMenu(false);
    setAlignMenu(false);
    setThreeDMenu(false);
    setTransformMenu(false);
  }, [objectChipsVisible]);

  const closePanels = () => {
    setWarpPreviewOn(false);
    onWarpPreview?.(null);
    setMoreMenu(false);
    setAlignMenu(false);
    setThreeDMenu(false);
    setTransformMenu(false);
  };

  const toggleTransformMenu = () => {
    if (transformMenu) {
      setTransformMenu(false);
      return;
    }
    setAlignMenu(false);
    setMoreMenu(false);
    setThreeDMenu(false);
    setTransformMenu(true);
  };

  // The arrangement actions live in the Arrange panel now, with names on them.
  const arrangeActions: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  }> = [
    { label: 'Duplicate', icon: <Copy size={12} />, onClick: onDuplicate },
    { label: 'Paste', icon: <ClipboardPaste size={12} />, onClick: onPaste, disabled: !canPaste },
    { label: 'Delete', icon: <Trash2 size={12} />, onClick: onDelete, danger: true },
    {
      label: 'Group',
      icon: <LayersIcon size={12} />,
      onClick: onGroup,
      disabled: selectedCount < 2,
    },
    {
      label: 'Merge',
      icon: <Combine size={12} />,
      onClick: onMerge,
      disabled: selectedCount < 2 || hasTextSelection,
    },
    { label: 'Flip H', icon: <FlipHorizontal size={12} />, onClick: () => onFlip('horizontal') },
    { label: 'Flip V', icon: <FlipVertical size={12} />, onClick: () => onFlip('vertical') },
    ...(hasTextSelection
      ? [
          { label: 'Edit text', icon: <TypeIcon size={12} />, onClick: onEditText },
          { label: 'To curves', icon: <Wand2 size={12} />, onClick: onExpandText },
        ]
      : []),
  ];

  if (tool === 'hand' && selectedCount === 0 && !reference) {
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

  const activePanelOpen =
    objectChipsVisible && (alignMenu || moreMenu || threeDMenu || transformMenu);

  return (
    <div className="relative z-20 flex shrink-0 flex-col border-t border-line bg-ink-1/95">
      {panelIsOpen && !addChipsVisible && !activePanelOpen && (
        <ToolPanel name={panel.name} hint={panel.hint} onClose={togglePanel}>
          {panelBlocks}
        </ToolPanel>
      )}
      {/* PixelLab's phone pattern: fixed, labelled categories instead of a
          scrolling chip row. The tool panel keeps an icon slot so its options
          stay one tap away without crowding the tabs. */}
      <div
        data-tour="strip"
        className="scroll-x order-3 mx-auto flex h-14 w-full max-w-3xl items-center gap-1 px-2.5"
      >
        {objectChipsVisible ? (
          <>
            <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
              {hasTextSelection && (
                <PanelTab
                  label="Text"
                  icon={<TypeIcon size={14} />}
                  onClick={() => {
                    closePanels();
                    onEditText();
                  }}
                />
              )}
              {transformChipVisible && (
                <PanelTab
                  label="Object"
                  icon={<Move size={14} />}
                  active={transformMenu}
                  onClick={toggleTransformMenu}
                />
              )}
              <PanelTab
                label="Arrange"
                icon={<AlignHorizontalJustifyStart size={14} />}
                active={alignMenu}
                onClick={() => {
                  setMoreMenu(false);
                  setThreeDMenu(false);
                  setTransformMenu(false);
                  setAlignMenu((v) => !v);
                }}
              />
              <PanelTab
                label="Effects"
                icon={<SlidersHorizontal size={14} />}
                active={moreMenu}
                onClick={() => {
                  setAlignMenu(false);
                  setThreeDMenu(false);
                  setTransformMenu(false);
                  setMoreMenu((v) => !v);
                }}
              />
              <PanelTab
                label="3D"
                icon={<Box size={14} />}
                active={threeDMenu || extrudeDepth > 0}
                onClick={() => {
                  setAlignMenu(false);
                  setMoreMenu(false);
                  setTransformMenu(false);
                  setThreeDMenu((v) => !v);
                }}
              />
            </div>
          </>
        ) : addChipsVisible ? (
          <>
            {/* Colours before a shape exists: the next stroke/fill uses these. */}
            <Swatch color={fillColor} label="Fill colour" onClick={() => onOpenColor('fill')} />
            <Swatch
              color={strokeColor}
              label="Stroke colour"
              hollow
              width={strokeWidth}
              onClick={() => onOpenColor('stroke')}
            />
            <Divider />
            <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
              <PanelTab label="Text" icon={<TypeIcon size={14} />} onClick={onOpenText} />
            <PanelTab
              label="Square"
              icon={<Square size={14} />}
              onClick={() => onQuickShape('rectangle')}
            />
            <PanelTab
              label="Circle"
              icon={<Circle size={14} />}
              onClick={() => onQuickShape('circle')}
            />
            <PanelTab
              label="Star"
              icon={<Star size={14} />}
              onClick={() => onQuickShape('star')}
            />
              <PanelTab label="Shapes" icon={<Hexagon size={14} />} onClick={onOpenShapes} />
            </div>
          </>
        ) : (
          <>
            <Chip
              active={panelIsOpen}
              disabled={!hasPanelContent}
              icon={panel.icon}
              aria-label={`${panel.name} options`}
              onClick={togglePanel}
            >
              {panel.name}
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
            <Divider />
            {/* Node editing keeps its own operations; object tabs never appear here. */}
            {selectionStripVisible && (
              <>
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
            )}
            {selectedCount === 0 && !isDrawing && (
              <span className="min-w-0 truncate text-[11px] text-mute">{panel.hint}</span>
            )}
          </>
        )}
      </div>

      {/* Panels sit in the chrome flow, not over the canvas: the artboard
          shrinks instead of disappearing under a sheet, and the canvas's
          thumb helpers stay reachable. */}
      {alignMenu && objectChipsVisible && (
        <div className="order-2 w-full max-h-[28dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-ink-2 px-3 pb-2">
          <div className="sticky top-0 z-30 -mx-3 mb-2 flex h-11 items-center justify-between border-b border-line bg-ink-2/95 px-3 backdrop-blur">
            <span className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text">
              <AlignHorizontalJustifyStart size={13} className="text-accent" /> Arrange
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-mute">{selectedCount} selected</span>
              <button
                type="button"
                aria-label="Close arrange"
                onClick={() => setAlignMenu(false)}
                className="press grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-ink-3 hover:text-text"
              >
                <X size={16} />
              </button>
            </span>
          </div>
          <div className="mb-1.5 grid grid-cols-3 gap-1">
            {arrangeActions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                onClick={action.onClick}
                className={`press flex h-8 items-center justify-center gap-1 rounded-md bg-ink-3 font-sans text-[9px] font-bold uppercase tracking-[0.04em] disabled:opacity-35 ${
                  action.danger ? 'text-danger' : 'text-dim hover:text-accent'
                }`}
              >
                {action.icon} {action.label}
              </button>
            ))}
          </div>
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
                className="press flex h-8 items-center justify-center gap-1 rounded-lg bg-ink-3 font-sans text-[9px] font-bold uppercase text-dim hover:text-accent"
              >
                {b.icon} {b.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {moreMenu && objectChipsVisible && (
        <div
          ref={morePanelRef}
          className="order-2 w-full max-h-[28dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-ink-2 px-3 pb-2"
        >
          <div className="sticky top-0 z-30 -mx-3 mb-2 flex h-11 items-center justify-between border-b border-line bg-ink-2/95 px-3 backdrop-blur">
            <span className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text">
              <SlidersHorizontal size={13} className="text-accent" /> Effects
            </span>
            <button
              type="button"
              aria-label="Close effects"
              onClick={() => setMoreMenu(false)}
              className="press grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-ink-3 hover:text-text"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mb-1 flex gap-1 overflow-x-auto border-b border-line px-1.5 py-1.5">
            {[
              ['Corner', 'Corner'],
              ['Path', 'Pathfinder'],
              ['Blur', 'Blur'],
              ['Shadow', 'Shadow'],
              ['Pattern', 'Pattern fill'],
              ['Warp', 'Warp'],
              ['Text path', 'Text on a path'],
              ['Grid', 'Split into grid'],
              ['Offset', 'Offset path'],
            ]
              .filter(([label]) =>
                hasTextSelection ? label === 'Warp' || label === 'Text path' : label !== 'Text path'
              )
              .map(([label, match]) => (
              <button
                key={label}
                type="button"
                onClick={() => jumpToMoreSection(match)}
                className="press shrink-0 rounded-md bg-ink-3 px-1.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-wider text-dim hover:text-accent"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-1 py-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
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
                className={`press h-6 rounded-md px-1.5 font-sans text-[9px] font-bold uppercase ${
                  !cornerTarget ? 'bg-line-strong text-text' : 'bg-ink-3 text-dim'
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
                    cornerTarget === id ? 'bg-line-strong text-text' : 'bg-ink-3 text-dim'
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
          <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
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
              <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
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
          {/* Blur paints live, so the canvas itself is the preview. */}
          <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
            Blur
          </span>
          <div className="grid grid-cols-3 gap-1">
            {(['none', 'gaussian', 'motion'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setBlurKind(kind);
                  onBlurSelection(kind, blurAmount, blurAngle);
                }}
                className={`press h-7 rounded-md text-[10px] font-semibold ${
                  blurKind === kind ? 'bg-accent/20 text-accent' : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                {kind === 'none' ? 'None' : kind === 'gaussian' ? 'Gaussian' : 'Motion'}
              </button>
            ))}
          </div>
          {blurKind !== 'none' && (
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Amount</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Less blur"
                  onClick={() => {
                    const next = Math.max(1, blurAmount - 1);
                    setBlurAmount(next);
                    onBlurSelection(blurKind, next, blurAngle);
                  }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Minus size={10} />
                </button>
                <span className="w-10 text-center font-mono text-[10px] font-bold text-text">
                  {blurAmount} px
                </span>
                <button
                  type="button"
                  aria-label="More blur"
                  onClick={() => {
                    const next = Math.min(80, blurAmount + 1);
                    setBlurAmount(next);
                    onBlurSelection(blurKind, next, blurAngle);
                  }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          )}
          {blurKind === 'motion' && (
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Direction</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Turn blur direction left"
                  onClick={() => {
                    const next = (blurAngle - 15 + 360) % 360;
                    setBlurAngle(next);
                    onBlurSelection(blurKind, blurAmount, next);
                  }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Minus size={10} />
                </button>
                <span className="w-10 text-center font-mono text-[10px] font-bold text-text">
                  {blurAngle}°
                </span>
                <button
                  type="button"
                  aria-label="Turn blur direction right"
                  onClick={() => {
                    const next = (blurAngle + 15) % 360;
                    setBlurAngle(next);
                    onBlurSelection(blurKind, blurAmount, next);
                  }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          )}

          {/* Shadow paints behind the object, so it never touches geometry:
              the object still snaps, aligns and booleans on its own outline. */}
          <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
            Shadow
          </span>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                ['none', 'None'],
                ['outer', 'Outer'],
                ['inner', 'Inner'],
              ] as const
            ).map(([mode, label]) => {
              const active = mode === 'none' ? !shadowOn : shadowOn && (mode === 'inner') === shadowInset;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-label={`${label} shadow`}
                  onClick={() => {
                    if (mode === 'none') {
                      setShadowOn(false);
                      onShadowSelection(null);
                      return;
                    }
                    const inset = mode === 'inner';
                    setShadowOn(true);
                    setShadowInset(inset);
                    pushShadow({ ...(inset ? { inset: true } : { inset: undefined }) });
                  }}
                  className={`press h-7 rounded-md text-[10px] font-semibold ${
                    active ? 'bg-accent/20 text-accent' : 'bg-ink-3 text-dim hover:text-accent'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {shadowOn && (
            <>
              {shadowStepper(
                'X',
                `${shadowDx} px`,
                () => {
                  const next = Math.max(-200, shadowDx - 2);
                  setShadowDx(next);
                  pushShadow({ dx: next });
                },
                () => {
                  const next = Math.min(200, shadowDx + 2);
                  setShadowDx(next);
                  pushShadow({ dx: next });
                }
              )}
              {shadowStepper(
                'Y',
                `${shadowDy} px`,
                () => {
                  const next = Math.max(-200, shadowDy - 2);
                  setShadowDy(next);
                  pushShadow({ dy: next });
                },
                () => {
                  const next = Math.min(200, shadowDy + 2);
                  setShadowDy(next);
                  pushShadow({ dy: next });
                }
              )}
              {shadowStepper(
                'Softness',
                `${shadowBlur} px`,
                () => {
                  const next = Math.max(0, shadowBlur - 2);
                  setShadowBlur(next);
                  pushShadow({ blur: next });
                },
                () => {
                  const next = Math.min(120, shadowBlur + 2);
                  setShadowBlur(next);
                  pushShadow({ blur: next });
                }
              )}
              {shadowStepper(
                'Opacity',
                `${Math.round(shadowOpacity * 100)}%`,
                () => {
                  const next = Math.max(0.05, Math.round((shadowOpacity - 0.05) * 100) / 100);
                  setShadowOpacity(next);
                  pushShadow({ opacity: next });
                },
                () => {
                  const next = Math.min(1, Math.round((shadowOpacity + 0.05) * 100) / 100);
                  setShadowOpacity(next);
                  pushShadow({ opacity: next });
                }
              )}
              <div className="mt-1 flex items-center justify-between px-1">
                <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Colour</span>
                <div className="flex items-center gap-1">
                  {SHADOW_PRESET_COLORS.map(({ color, name }) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Shadow colour ${name} ${color}`}
                      onClick={() => {
                        setShadowColor(color);
                        pushShadow({ color });
                      }}
                      style={{ background: color }}
                      className={`press h-6 w-6 rounded-md border ${
                        shadowColor.toLowerCase() === color ? 'border-accent' : 'border-line'
                      }`}
                    />
                  ))}
                  {/* The presets above are shortcuts; this is the whole palette.
                      It shows the current colour when that is not a preset, so
                      the row never has a swatch that looks unselected. */}
                  <label
                    className={`press relative h-6 w-6 cursor-pointer overflow-hidden rounded-md border ${
                      shadowColorIsPreset ? 'border-line' : 'border-accent'
                    }`}
                    style={{ background: shadowColorIsPreset ? undefined : shadowColor }}
                    title={`Shadow colour ${shadowColor} — pick any colour`}
                  >
                    {shadowColorIsPreset && <span className="absolute inset-0 bg-ink-3" />}
                    <Pipette
                      size={11}
                      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${
                        shadowColorIsPreset ? 'text-dim' : 'text-white mix-blend-difference'
                      }`}
                    />
                    <input
                      type="color"
                      value={shadowPickerValue}
                      onChange={(event) => {
                        const colour = event.target.value.toLowerCase();
                        setShadowColor(colour);
                        pushShadow({ color: colour });
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="Shadow colour: pick any colour"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Pattern: captured once from the selection, then every control
              edits it live. Tile Type, spacing and offset follow Illustrator's
              Pattern Options instead of only scaling a square grid. */}
          {!hasTextSelection && (
            <>
<span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
            Pattern fill
          </span>
          {!selectionPattern && (
            <div className="px-1 pb-1">
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => onPattern({ scale: 1, rotation: 0 })}
                className="press flex h-8 w-full items-center justify-center rounded-lg bg-accent/20 text-[11px] font-semibold text-accent disabled:opacity-40"
              >
                Make pattern from this shape
              </button>
              <p className="mt-1 text-[9.5px] leading-snug text-mute">
                The shape becomes a tile. Then pick a Tile type — Grid, Brick ↓, Brick → or Hex — and
                tune the sliders; the preview above them updates as you tap.
              </p>
            </div>
          )}
          <div className={selectionPattern ? '' : 'pointer-events-none opacity-40'}>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                ['grid', 'Grid'],
                ['brick-row', 'Brick ↓'],
                ['brick-column', 'Brick →'],
                ['hex', 'Hex'],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setPatternTileType(type);
                  pushPattern({ tileType: type });
                }}
                className={`press h-7 rounded-md text-[10px] font-semibold ${
                  patternTileType === type
                    ? 'bg-accent/20 text-accent'
                    : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {patternSwatch}
          {stepperRow(
            'Scale',
            `${patternScale}%`,
            () => {
              const next = Math.max(10, patternScale - 10);
              setPatternScale(next);
              pushPattern({ scale: next / 100 });
            },
            () => {
              const next = Math.min(400, patternScale + 10);
              setPatternScale(next);
              pushPattern({ scale: next / 100 });
            }
          )}
          <p className="px-1 pb-0.5 text-[9px] leading-snug text-mute">Scale — how big each tile is.</p>
          {stepperRow(
            'Rotate',
            `${patternRotation}°`,
            () => {
              const next = (patternRotation - 15 + 360) % 360;
              setPatternRotation(next);
              pushPattern({ rotation: next });
            },
            () => {
              const next = (patternRotation + 15) % 360;
              setPatternRotation(next);
              pushPattern({ rotation: next });
            }
          )}
          <p className="px-1 pb-0.5 text-[9px] leading-snug text-mute">Rotate — the angle of the tile.</p>
          {stepperRow(
            'Spacing',
            `${patternSpacing}`,
            () => {
              const next = Math.max(0, patternSpacing - 2);
              setPatternSpacing(next);
              pushPattern({ spacing: next });
            },
            () => {
              const next = Math.min(400, patternSpacing + 2);
              setPatternSpacing(next);
              pushPattern({ spacing: next });
            }
          )}
          <p className="px-1 pb-0.5 text-[9px] leading-snug text-mute">
            Spacing — the gap between tiles. It pads the tile, it does not shrink the art.
          </p>
          {stepperRow(
            'Shift X',
            `${patternOffsetX}`,
            () => {
              const next = Math.max(-4000, patternOffsetX - 4);
              setPatternOffsetX(next);
              pushPattern({ offsetX: next });
            },
            () => {
              const next = Math.min(4000, patternOffsetX + 4);
              setPatternOffsetX(next);
              pushPattern({ offsetX: next });
            }
          )}
          <p className="px-1 pb-0.5 text-[9px] leading-snug text-mute">Shift X — slides the tiling sideways.</p>
          {stepperRow(
            'Shift Y',
            `${patternOffsetY}`,
            () => {
              const next = Math.max(-4000, patternOffsetY - 4);
              setPatternOffsetY(next);
              pushPattern({ offsetY: next });
            },
            () => {
              const next = Math.min(4000, patternOffsetY + 4);
              setPatternOffsetY(next);
              pushPattern({ offsetY: next });
            }
          )}
          <p className="px-1 pb-0.5 text-[9px] leading-snug text-mute">Shift Y — slides it up or down.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (selectionPattern) {
                onClearPattern();
              } else {
                onSavePattern?.();
              }
              closePanels();
            }}
            className="press mt-1.5 flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
          >
            {selectionPattern ? 'Clear pattern' : 'Save as pattern'}
          </button>
          <p className="px-1 pb-0.5 text-[9px] leading-snug text-mute">
            Saving keeps this shape's own fill. The tile lands in the library and appears in a preview
            beside it, so you can judge the repeat before painting anything.
          </p>
          {selectionPattern && onPreviewPattern && (
            <button
              type="button"
              onClick={() => {
                onPreviewPattern();
                closePanels();
              }}
              className="press mt-1 flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
            >
              Preview on canvas
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onOpenPatterns?.();
              closePanels();
            }}
            className="press mt-1 flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
          >
            Pattern library…
          </button>

          {/* Shapes bake the bend into their points. Type keeps a live warp:
              the glyphs bend on screen and the string stays editable. */}
                      </>
          )}
          <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
            Warp
          </span>
          <div
            className="mt-1 rounded-md border border-line bg-ink-0 px-1 py-0.5 text-accent"
            aria-label="Warp preview"
          >
            <WarpThumb kind={warpKind} amount={warpAmount} className="h-10 w-full" showFold />
          </div>
          {warpFold(
            { minX: -17, minY: -10, width: 34, height: 20 },
            { kind: warpKind, amount: warpAmount, sway: warpSway, cycles: warpCycles }
          ).folded && (
            <p className="px-1 pb-0.5 text-[9px] font-semibold leading-snug text-accent">
              Folds at this strength — the highlighted area turns inside out. Ease Bend back to keep
              letters apart.
            </p>
          )}
          <div className="mt-1 grid grid-cols-3 gap-1">
            {WARP_KINDS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                aria-label={`Warp ${label}`}
                aria-pressed={warpKind === kind}
                onClick={() => {
                  setWarpPreviewOn(true);
                  setWarpKind(kind);
                }}
                className={`press flex h-11 flex-col items-center justify-center gap-0.5 rounded-md ${
                  warpKind === kind ? 'bg-accent/20 text-accent' : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                <WarpThumb kind={kind} amount={warpAmount} className="h-5 w-8" />
                <span className="text-[8.5px] font-semibold leading-none">{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between px-1">
            <span className="font-sans text-[9px] uppercase tracking-wider text-mute">
              {warpKind === 'bulge' || warpKind === 'pinch' || warpKind === 'perspective'
                ? 'Strength %'
                : hasTextSelection && (warpKind === 'arch' || warpKind === 'arc')
                  ? 'Bend (half the line = full circle)'
                  : 'Bend px'}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Less warp"
                onClick={() => {
                  setWarpPreviewOn(true);
                  setWarpAmount((v) => Math.max(-400, v - 8));
                }}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Minus size={10} />
              </button>
              <span className="w-10 text-center font-mono text-[10px] font-bold text-text">
                {warpAmount}
              </span>
              <button
                type="button"
                aria-label="More warp"
                onClick={() => {
                  setWarpPreviewOn(true);
                  setWarpAmount((v) => Math.min(400, v + 8));
                }}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
          {/* Badges ride a chosen circle: 0 lets the bend pick one. */}
          {(warpKind === 'arch' || warpKind === 'arc') && (
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="font-sans text-[9px] uppercase tracking-wider text-mute">
                Circle radius
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Smaller circle"
                  onClick={() => {
                    setWarpPreviewOn(true);
                    setWarpRadius((v) => Math.max(0, v - 20));
                  }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Minus size={10} />
                </button>
                <EditableNumber
                  value={warpRadius}
                  label="Circle radius"
                  min={0}
                  max={4000}
                  onChange={setWarpRadius}
                />
                <button
                  type="button"
                  aria-label="Bigger circle"
                  onClick={() => {
                    setWarpPreviewOn(true);
                    setWarpRadius((v) => Math.min(4000, v + 20));
                  }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          )}
          {warpKind === 'free' && (
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Sideways</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Less sideways warp"
                  onClick={() => {
                  setWarpPreviewOn(true);
                  setWarpSway((v) => Math.max(-400, v - 8));
                }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Minus size={10} />
                </button>
                <span className="w-10 text-center font-mono text-[10px] font-bold text-text">
                  {warpSway}
                </span>
                <button
                  type="button"
                  aria-label="More sideways warp"
                  onClick={() => {
                  setWarpPreviewOn(true);
                  setWarpSway((v) => Math.min(400, v + 8));
                }}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          )}
          {warpKind === 'wave' && (
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Cycles</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Fewer waves"
                  onClick={() => setWarpCycles((v) => Math.max(1, v - 1))}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Minus size={10} />
                </button>
                <span className="w-10 text-center font-mono text-[10px] font-bold text-text">
                  {warpCycles}
                </span>
                <button
                  type="button"
                  aria-label="More waves"
                  onClick={() => setWarpCycles((v) => Math.min(6, v + 1))}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          )}
          {/* A bend changes how far apart the letters read, so spacing stays
              adjustable here while the warp is live. */}
          {hasTextSelection && onTextTracking && (
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Spacing</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Tighter letters"
                  onClick={() => onTextTracking(Math.max(-40, Math.round(textTracking) - 1))}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Minus size={10} />
                </button>
                <EditableNumber
                  value={textTracking}
                  label="Letter spacing"
                  min={-40}
                  max={120}
                  onChange={onTextTracking}
                />
                <button
                  type="button"
                  aria-label="Wider letters"
                  onClick={() => onTextTracking(Math.min(120, Math.round(textTracking) + 1))}
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              onWarp?.({
                kind: warpKind,
                amount: warpAmount,
                sway: warpSway,
                cycles: warpCycles,
                radius: warpRadius > 0 ? warpRadius : undefined,
              });
              setWarpPreviewOn(false);
              onWarpPreview?.(null);
              closePanels();
            }}
            className="press mt-1.5 flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
          >
            {activeWarp ? 'Update warp' : 'Apply warp'}
          </button>
          {activeWarp && (
            <button
              type="button"
              onClick={() => {
                onClearWarp?.();
                setWarpPreviewOn(false);
                onWarpPreview?.(null);
                closePanels();
              }}
              className="press mt-1 flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
            >
              Remove warp
            </button>
          )}

          {canTextInShape && (
            <>
              <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
                Text in shape
              </span>
              <button
                type="button"
                onClick={() => {
                  onTextInShape?.();
                  closePanels();
                }}
                className="press flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
              >
                Fill shape with text
              </button>
            </>
          )}

          {/* Type on a path binds the text to the outline it should follow. */}
          {hasTextSelection && (
            <>
<span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
            Text on a path
          </span>
          <button
            type="button"
            onClick={() => {
              onTextOnPath?.();
              closePanels();
            }}
            className="press flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
          >
            Text on path
          </button>
          {hasTextPath && (
            <>
              <div className="mt-1 flex items-center justify-between px-1">
                <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Start</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Earlier on the path"
                    onClick={() => {
                      const next = Math.max(-100, pathOffset - 5);
                      setPathOffset(next);
                      onTextPathOffset?.(next);
                    }}
                    className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="w-10 text-center font-mono text-[10px] font-bold text-text">
                    {pathOffset}%
                  </span>
                  <button
                    type="button"
                    aria-label="Later on the path"
                    onClick={() => {
                      const next = Math.min(100, pathOffset + 5);
                      setPathOffset(next);
                      onTextPathOffset?.(next);
                    }}
                    className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </div>
              {stepperRow(
                'Nudge',
                `${pathNudge}`,
                () => {
                  const next = Math.max(-500, pathNudge - 2);
                  setPathNudge(next);
                  onTextPathNudge?.(next);
                },
                () => {
                  const next = Math.min(500, pathNudge + 2);
                  setPathNudge(next);
                  onTextPathNudge?.(next);
                }
              )}
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {TEXT_PATH_ALIGNS.map(({ align, label }) => (
                  <button
                    key={align}
                    type="button"
                    aria-label={`Align text ${label}`}
                    aria-pressed={pathAlign === align}
                    onClick={() => {
                      setPathAlign(align);
                      onTextPathAlign?.(align);
                    }}
                    className={`press flex h-12 flex-col items-center justify-center gap-0.5 rounded-md ${
                      pathAlign === align
                        ? 'bg-accent/20 text-accent'
                        : 'bg-ink-3 text-dim hover:text-accent'
                    }`}
                  >
                    <PathAlignThumb align={align} className="h-4 w-7" />
                    <span className="text-[8px] font-semibold leading-none">{label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !pathReverse;
                  setPathReverse(next);
                  onTextPathReverse?.(next);
                }}
                className={`press mt-1 flex h-8 w-full items-center justify-center rounded-lg text-[11px] font-semibold ${
                  pathReverse
                    ? 'bg-accent/20 text-accent'
                    : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                {pathReverse ? 'Flip back to start' : 'Flip direction'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDetachTextPath?.();
                  closePanels();
                }}
                className="press mt-1 flex h-8 w-full items-center justify-center rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent"
              >
                Detach text
              </button>
            </>
          )}

          {/* Split into grid: a logo build starts by cutting a mark into
              pieces you can rebuild with Build or Pathfinder. */}
                      </>
          )}
          <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
            Split into grid
          </span>
          <div className="flex items-center justify-between px-1">
            <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Down</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Fewer rows"
                onClick={() => setGridRows((v) => Math.max(1, v - 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Minus size={10} />
              </button>
              <span className="w-5 text-center font-mono text-[10px] font-bold text-text">{gridRows}</span>
              <button
                type="button"
                aria-label="More rows"
                onClick={() => setGridRows((v) => Math.min(12, v + 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between px-1">
            <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Across</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Fewer columns"
                onClick={() => setGridCols((v) => Math.max(1, v - 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Minus size={10} />
              </button>
              <span className="w-5 text-center font-mono text-[10px] font-bold text-text">{gridCols}</span>
              <button
                type="button"
                aria-label="More columns"
                onClick={() => setGridCols((v) => Math.min(12, v + 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between px-1">
            <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Gap</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Smaller gap"
                onClick={() => setGridGap((v) => Math.max(0, v - 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Minus size={10} />
              </button>
              <span className="w-8 text-center font-mono text-[10px] font-bold text-text">{gridGap} px</span>
              <button
                type="button"
                aria-label="Larger gap"
                onClick={() => setGridGap((v) => Math.min(24, v + 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSplitGrid(gridRows, gridCols, gridGap);
              closePanels();
            }}
            disabled={gridRows * gridCols < 2}
            className="press mt-1.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent disabled:opacity-40"
          >
            Split {gridRows} × {gridCols}
          </button>
          {gridRows * gridCols < 2 && (
            <p className="px-1 pt-1 text-[9.5px] leading-snug text-mute">
              Raise rows or columns above 1 to cut the selection apart.
            </p>
          )}
          {gridGap > 0 && (
            <p className="px-1 pt-1 text-[9.5px] leading-snug text-mute">
              The gap keeps the cells apart. Set it to 0 to build a logo across them
              with Shape Builder, which can only join shapes that touch.
            </p>
          )}

          {/* Offset: an outlined copy at a distance, for badges, rings and
              the shapes you then rebuild with Build or Pathfinder. */}
          <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
            Offset path
          </span>
          <div className="flex items-center justify-between px-1">
            <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Distance</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Offset inward"
                onClick={() => setOffsetDistance((v) => Math.max(-60, v - 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Minus size={10} />
              </button>
              <span className="w-8 text-center font-mono text-[10px] font-bold text-text">{offsetDistance} px</span>
              <button
                type="button"
                aria-label="Offset outward"
                onClick={() => setOffsetDistance((v) => Math.min(60, v + 1))}
                className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onOffsetPath(offsetDistance);
              closePanels();
            }}
            disabled={offsetDistance === 0}
            className="press mt-1.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-ink-3 text-[11px] font-semibold text-dim hover:text-accent disabled:opacity-40"
          >
            Offset {offsetDistance > 0 ? '+' : ''}
            {offsetDistance} px
          </button>

          {(canMakeClipMask || hasClipMask) && (
            <>
              <span className="mt-1.5 block px-1 py-0.5 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
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
                  drawInsideName ? 'bg-line-strong text-text' : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                <Crop size={12} /> {drawInsideName ? 'Exit draw inside' : 'Draw inside'}
              </button>
            </div>
          )}
        </div>
      )}

      {transformMenu &&
        transformChipVisible &&
        transformBox &&
        onTransformPosition &&
        onTransformSize && (
        <div className="order-2 w-full max-h-[32dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-ink-2 px-3 pb-2">
          <div className="sticky top-0 z-30 -mx-3 mb-2 flex h-11 items-center justify-between border-b border-line bg-ink-2/95 px-3 backdrop-blur">
            <span className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text">
              <Move size={13} className="text-accent" /> Object
            </span>
            <span className="flex items-center gap-0.5">
              <span className="mr-1 font-mono text-[10px] text-mute">px</span>
              <IconButton label="Duplicate object" size="sm" onClick={onDuplicate}>
                <Copy size={14} />
              </IconButton>
              <IconButton label="Delete object" size="sm" tone="danger" onClick={onDelete}>
                <Trash2 size={14} />
              </IconButton>
              <button
                type="button"
                aria-label="Close transform"
                onClick={() => setTransformMenu(false)}
                className="press grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-ink-3 hover:text-text"
              >
                <X size={16} />
              </button>
            </span>
          </div>
          {/* PixelLab keeps colour with the object's properties, not as a chip
              in the bar, so the tabs stay equal-width and thumb-sized. */}
          <div className="mt-0 flex h-11 items-center gap-2 rounded-xl bg-ink-3 px-2.5">
            <Swatch color={fillColor} label="Fill colour" onClick={() => onOpenColor('fill')} />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.04em] text-dim">
              Fill
            </span>
            <span className="flex-1" />
            <Swatch
              color={strokeColor}
              label="Stroke colour"
              hollow
              width={strokeWidth}
              onClick={() => onOpenColor('stroke')}
            />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.04em] text-dim">
              Stroke
            </span>
          </div>
          {/* Typed values sit beside the handles, so a badge can be placed at an
              exact X rather than near one. */}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {(
              [
                ['x', 'X', Math.round(transformBox.x), -4000, 4000],
                ['y', 'Y', Math.round(transformBox.y), -4000, 4000],
                ['w', 'W', Math.round(transformBox.width), 1, 4000],
                ['h', 'H', Math.round(transformBox.height), 1, 4000],
              ] as ['x' | 'y' | 'w' | 'h', string, number, number, number][]
            ).map(([key, label, value, min, max]) => (
              <label
                key={key}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-ink-3 px-2"
              >
                <span className="w-3.5 shrink-0 font-mono text-[10px] font-bold text-mute">
                  {label}
                </span>
                <span className="flex-1 text-right">
                  <EditableNumber
                    value={value}
                    min={min}
                    max={max}
                    label={`${label === 'X' || label === 'Y' ? 'Position' : 'Size'} ${label}`}
                    onChange={(next) =>
                      key === 'x' || key === 'y'
                        ? onTransformPosition(key, next)
                        : onTransformSize(key, next)
                    }
                  />
                </span>
              </label>
            ))}
          </div>
          {onTurnSelection && (
            <div className="mt-1.5 flex h-9 items-center gap-1.5 rounded-lg bg-ink-3 px-1.5">
              <button
                type="button"
                aria-label="Turn left 90 degrees"
                onClick={() => onTurnSelection(-90)}
                className="press grid h-7 w-7 place-items-center rounded-md text-dim hover:text-accent"
              >
                <RotateCcw size={13} />
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mute">
                Angle
              </span>
              <span className="flex-1" />
              <EditableNumber
                value={Math.round(selectionRotation)}
                min={-180}
                max={180}
                label="Angle in degrees"
                onChange={(next) => (onSetRotation ? onSetRotation(next) : onTurnSelection(next))}
              />
              <span className="font-mono text-[10px] text-mute">°</span>
              <button
                type="button"
                aria-label="Turn right 90 degrees"
                onClick={() => onTurnSelection(90)}
                className="press grid h-7 w-7 place-items-center rounded-md text-dim hover:text-accent"
              >
                <RotateCw size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {threeDMenu && objectChipsVisible && (
        <div className="order-2 w-full max-h-[28dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-ink-2 px-3 pb-2">
          <div className="sticky top-0 z-30 -mx-3 mb-2 flex h-11 items-center justify-between border-b border-line bg-ink-2/95 px-3 backdrop-blur">
            <span className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text">
              <Box size={13} className="text-accent" /> 3D extrusion
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-bold text-accent">
                {Math.round(extrudeDepth)}
              </span>
              <button
                type="button"
                aria-label="Close 3D"
                onClick={() => setThreeDMenu(false)}
                className="press grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-ink-3 hover:text-text"
              >
                <X size={16} />
              </button>
            </span>
          </div>
          {/* A label has no closed shape to pull, so every control below would
              sit dead without saying why. Extruding is the one effect that
              needs the outline, and here that is worth saying out loud. */}
          {!canExtrude && (
            <div className="mt-1.5 rounded-md border border-line bg-ink-0 p-1.5">
              <p className="text-[9.5px] leading-snug text-mute">
                {hasTextSelection
                  ? 'A live label has no closed shape to pull. Convert it to curves, then extrude.'
                  : 'Nothing here has a closed shape to pull.'}
              </p>
              {hasTextSelection && (
                <button
                  type="button"
                  onClick={onExpandText}
                  className="press mt-1.5 h-7 w-full rounded-md bg-ink-3 font-sans text-[9px] font-bold uppercase text-dim hover:text-accent"
                >
                  Convert to curves
                </button>
              )}
            </div>
          )}
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <button
              type="button"
              aria-pressed={extrudeDepth <= 0}
              onClick={() => onExtrudeDepth(0)}
              className={`press h-7 rounded-md font-sans text-[9px] font-bold uppercase ${
                extrudeDepth <= 0 ? 'bg-line-strong text-text' : 'bg-ink-3 text-dim'
              }`}
            >
              Flat
            </button>
            <button
              type="button"
              aria-pressed={extrudeDepth > 0}
              onClick={() => onExtrudeDepth(extrudeDepth > 0 ? extrudeDepth : lastExtrudeDepth)}
              className={`press h-7 rounded-md font-sans text-[9px] font-bold uppercase ${
                extrudeDepth > 0 ? 'bg-line-strong text-text' : 'bg-ink-3 text-dim'
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
                className={`press h-6 rounded-md font-sans text-[9px] font-bold uppercase ${
                  Math.round(extrudeDepth) === preset.value
                    ? 'bg-line-strong text-text'
                    : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
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
                      ? 'bg-line-strong text-text'
                      : 'bg-ink-3 text-dim hover:text-accent'
                  }`}
                >
                  {direction?.glyph}
                </button>
              );
            })}
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(extrudeAngle)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudeAngle(Number(e.target.value))}
              aria-label="3D direction angle"
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
              Tilt
            </span>
            <span className="font-mono text-[9px] text-dim">{Math.round(extrudeTilt)}°</span>
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={85}
              step={1}
              value={Math.round(extrudeTilt)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudeTilt(Number(e.target.value))}
              aria-label="3D tilt"
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
              Turn
            </span>
            <span className="font-mono text-[9px] text-dim">{Math.round(extrudeTurn)}°</span>
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={-70}
              max={70}
              step={1}
              value={Math.round(extrudeTurn)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudeTurn(Number(e.target.value))}
              aria-label="3D turn"
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
              Perspective
            </span>
            <span className="font-mono text-[9px] text-dim">
              {Math.round(extrudePerspective * 100)}%
            </span>
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(extrudePerspective * 100)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudePerspective(Number(e.target.value) / 100)}
              aria-label="3D perspective"
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
              Light
            </span>
            <span className="font-mono text-[9px] text-dim">
              {Math.round(extrudeLight ?? 305)}°
            </span>
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(extrudeLight ?? 305)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudeLight(Number(e.target.value))}
              aria-label="3D light angle"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
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
          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
              Gloss
            </span>
            <span className="font-mono text-[9px] text-dim">
              {Math.round(extrudeGloss * 100)}%
            </span>
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={60}
              step={1}
              value={Math.round(extrudeGloss * 100)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudeGloss(Number(e.target.value) / 100)}
              aria-label="3D gloss"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
              Bevel
            </span>
            <span className="font-mono text-[9px] text-dim">{Math.round(extrudeBevel)}</span>
          </div>
          <div className="mt-1 px-0.5">
            <RangeInput
              type="range"
              min={0}
              max={26}
              step={1}
              value={Math.round(extrudeBevel)}
              disabled={!canExtrude}
              onChange={(e) => onExtrudeBevel(Number(e.target.value))}
              aria-label="3D bevel width"
            />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {(['chamfer', 'round'] as const).map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={extrudeBevelStyle === style}
                onClick={() => onExtrudeBevelStyle(style)}
                className={`press h-6 rounded-md font-sans text-[9px] font-bold uppercase ${
                  extrudeBevelStyle === style
                    ? 'bg-line-strong text-text'
                    : 'bg-ink-3 text-dim hover:text-accent'
                }`}
              >
                {style === 'chamfer' ? 'Chamfer' : 'Round'}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={extrudeShadow}
            onClick={() => onExtrudeShadow(!extrudeShadow)}
            className={`press mt-1.5 flex h-7 w-full items-center justify-center gap-1.5 rounded-md font-sans text-[9px] font-bold uppercase ${
              extrudeShadow ? 'bg-line-strong text-text' : 'bg-ink-3 text-dim'
            }`}
          >
            Shadow {extrudeShadow ? 'on' : 'off'}
          </button>
          {extrudeShadow && (
            <>
              <div className="mt-1.5 flex items-center justify-between px-0.5">
                <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
                  Softness
                </span>
                <span className="font-mono text-[9px] text-dim">
                  {extrudeShadowSoft.toFixed(1)}×
                </span>
              </div>
              <div className="mt-1 px-0.5">
                <RangeInput
                  type="range"
                  min={40}
                  max={250}
                  step={5}
                  value={Math.round(extrudeShadowSoft * 100)}
                  disabled={!canExtrude}
                  onChange={(e) => onExtrudeShadowSoft(Number(e.target.value) / 100)}
                  aria-label="3D shadow softness"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between px-0.5">
                <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
                  Distance
                </span>
                <span className="font-mono text-[9px] text-dim">
                  {extrudeShadowLift.toFixed(1)}×
                </span>
              </div>
              <div className="mt-1 px-0.5">
                <RangeInput
                  type="range"
                  min={0}
                  max={200}
                  step={5}
                  value={Math.round(extrudeShadowLift * 100)}
                  disabled={!canExtrude}
                  onChange={(e) => onExtrudeShadowLift(Number(e.target.value) / 100)}
                  aria-label="3D shadow distance"
                />
              </div>
            </>
          )}
          <p className="mt-1 px-0.5 text-[9.5px] leading-snug text-mute">
            {canExtrude
              ? 'Pulls the solid along the arrow · chamfered rim · lit from the top left'
              : 'Closed shapes only — outline a stroke or convert text to curves first'}
          </p>
        </div>
      )}
    </div>
  );
};
