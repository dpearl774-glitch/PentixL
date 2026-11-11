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
} from 'lucide-react';
import { PencilSmoothing, ShapeKind, ToolType } from '../types/vector';
import { BooleanOperation } from '../utils/shapeBuilder';
import { AlignMode, DistributeAxis } from '../utils/align';
import { Chip, IconButton, RangeInput } from './ui/primitives';

import { WARP_KINDS, WarpKind, WarpSpec } from '../utils/warp';
import { TEXT_PATH_ALIGNS, TextPathAlign } from '../utils/textPath';
import { PathAlignThumb, WarpThumb } from './EffectPreviews';
import { warpFold } from '../utils/warpFold';
import type { BlurEffect, PatternFill } from '../types/vector';
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
  onDistribute: (axis: DistributeAxis) => void;
  /** Cuts the selection into a rows × cols grid of separate closed shapes */
  onSplitGrid: (rows: number, cols: number, gap: number) => void;
  /** Outlines the selection at a distance; the original object stays put */
  onOffsetPath: (distance: number) => void;
  /** Blur every selected object; 'none' clears it */
  onBlurSelection: (kind: 'none' | 'gaussian' | 'motion', amount: number, angle: number) => void;
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
 * A number you can type. The steppers are for coarse nudges; badges need exact
 * values (radius 240, bend 36), so the value itself is a field — tap or
 * double-click it, type, Enter to commit.
 */
function EditableNumber({
  value,
  onChange,
  min = -400,
  max = 4000,
  label = 'Type a value',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, Math.round(next))));
  };
  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setDraft(String(Math.round(value)))}
        className="w-10 rounded-md text-center font-mono text-[10px] font-bold text-text"
      >
        {Math.round(value)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="number"
      inputMode="decimal"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setDraft(null);
      }}
      className="w-12 rounded-md bg-ink-3 px-1 text-center font-mono text-[10px] font-bold text-text"
    />
  );
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
  onDistribute,
  onSplitGrid,
  onOffsetPath,
  onBlurSelection,
  onPattern,
  onClearPattern,
  onSavePattern,
  onPreviewPattern,
  onOpenPatterns,
  selectionBlur = null,
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
  const [alignMenu, setAlignMenu] = React.useState(false);
  const [moreMenu, setMoreMenu] = React.useState(false);
  const [threeDMenu, setThreeDMenu] = React.useState(false);
  const [gridRows, setGridRows] = React.useState(2);
  const [gridCols, setGridCols] = React.useState(2);
  // A visible seam: cells cut flush share a fill and read as one object.
  const [gridGap, setGridGap] = React.useState(2);
  const [offsetDistance, setOffsetDistance] = React.useState(8);
  const [blurKind, setBlurKind] = React.useState<'none' | 'gaussian' | 'motion'>('gaussian');
  const [blurAmount, setBlurAmount] = React.useState(8);
  const [blurAngle, setBlurAngle] = React.useState(0);
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
   * A panel whose trigger has left the strip must not stay on screen: deleting
   * the selection hides the More chip, and without this the panel was left with
   * no way to close and the whole app read as frozen.
   */
  React.useEffect(() => {
    if (selectedCount === 0) {
      setMoreMenu(false);
      setAlignMenu(false);
      setThreeDMenu(false);
    }
  }, [selectedCount]);

  const closePanels = () => {
    setWarpPreviewOn(false);
    onWarpPreview?.(null);
    setMoreMenu(false);
    setAlignMenu(false);
    setThreeDMenu(false);
  };

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
        {/* ---------------- Reference image picked on canvas ---------------- */}
        {reference && (
          <>
            <span className="shrink-0 rounded bg-line-strong px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-wide text-dim">
              Reference
            </span>
            <span className="max-w-[92px] shrink-0 truncate text-[11px] font-semibold text-text">
              {reference.name}
            </span>
            <Divider />
            <span className="shrink-0 font-sans text-[9px] uppercase tracking-wider text-mute">Opacity</span>
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
            <span className="ml-1 hidden shrink-0 text-[11px] text-mute sm:block">
              {reference.locked ? 'Unlock to move and resize' : 'Drag to move · corners resize'}
            </span>
          </>
        )}

        {/* ---------------- Drawing a path ---------------- */}
        {isDrawing && (
          <>
            <span className="rounded-full bg-accent/15 px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-accent">
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
              <span className="shrink-0 whitespace-nowrap font-sans text-[9px] uppercase tracking-wider text-accent">
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
            <span className="shrink-0 font-sans text-[9px] uppercase tracking-wider text-mute">
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
        {!isDrawing && !reference && selectedCount > 0 && tool !== 'shape' && (
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
                    <Chip
                      icon={<Wand2 size={13} />}
                      aria-label="Create outlines"
                      onClick={onExpandText}
                    >
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
            {/* Same two swatches as Select, so switching between the two tools
                no longer clears the strip and moves everything around. */}
            <Swatch color={fillColor} label="Fill colour" onClick={() => onOpenColor('fill')} />
            <Swatch
              color={strokeColor}
              label="Stroke colour"
              hollow
              width={strokeWidth}
              onClick={() => onOpenColor('stroke')}
            />
            <Divider />
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
      {(alignMenu || moreMenu || threeDMenu) && (
        <div
          className="fixed inset-0 z-30"
          aria-hidden="true"
          onPointerDown={closePanels}
        />
      )}
      {alignMenu && (
        <div className="absolute bottom-[calc(100%+6px)] left-2 z-40 w-[186px] rounded-lg border border-line bg-ink-2 p-1.5 shadow-2xl">
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

      {moreMenu && (
        <div
          ref={morePanelRef}
          className="absolute bottom-[calc(100%+6px)] right-2 z-40 max-h-[38dvh] w-[196px] overflow-y-auto overscroll-contain rounded-lg border border-line bg-ink-2 p-1.5 shadow-2xl"
        >
          <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 flex gap-1 overflow-x-auto border-b border-line bg-ink-2/95 px-1.5 py-1.5">
            {[
              ['Corner', 'Corner'],
              ['Path', 'Pathfinder'],
              ['Blur', 'Blur'],
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

      {threeDMenu && (
        <div className="absolute bottom-[calc(100%+6px)] left-2 z-40 max-h-[38dvh] w-[216px] overflow-y-auto overscroll-contain rounded-lg border border-line bg-ink-2 p-2 shadow-2xl">
          <div className="flex items-center justify-between px-0.5">
            <span className="flex items-center gap-1 font-sans text-[9px] uppercase tracking-[0.08em] text-mute">
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
