import React from 'react';
import {
  FolderOpen,
  FilePlus2,
  Save,
  Upload,
  Grid3x3,
  Hand,
  Ruler,
  Lock,
  Crop,
  SlidersHorizontal,
  Type,
  Image as ImageIcon,
  Sparkles,
  HelpCircle,
  Check,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Sheet } from './ui/primitives';

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  savedLabel: string;
  onSave: () => void;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenExport: () => void;
  onOpenCanvas: () => void;
  canvasLabel: string;
  gridLabel: string;
  rulersVisible: boolean;
  guidesCount: number;
  smartGuides: boolean;
  onToggleSmartGuides: () => void;
  panZoomLocked: boolean;
  onTogglePanZoomLock: () => void;
  clipArtboard: boolean;
  onToggleClipArtboard: () => void;
  onPanTool: () => void;
  onOpenPressure: () => void;
  onOpenFonts: () => void;
  onOpenReferences: () => void;
  onOpenTracer: () => void;
  onOpenHelp: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const Row: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}> = ({ icon, label, hint, onClick, trailing }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`press flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left ${
      onClick ? 'hover:bg-ink-3' : ''
    }`}
  >
    <span className="grid h-7 w-7 shrink-0 place-items-center text-dim">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-semibold text-text">{label}</span>
      {hint && <span className="block truncate text-[11px] text-mute">{hint}</span>}
    </span>
    {trailing}
  </button>
);

const Switch: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
      on ? 'border-accent bg-accent/25' : 'border-line-strong bg-ink-0'
    }`}
  >
    <span
      className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${
        on ? 'left-[18px] bg-accent' : 'left-[3px] bg-line-strong'
      }`}
    />
  </span>
);

export const AppMenu: React.FC<AppMenuProps> = ({
  open,
  onClose,
  projectName,
  savedLabel,
  onSave,
  onNewProject,
  onOpenProjects,
  onOpenExport,
  onOpenCanvas,
  canvasLabel,
  gridLabel,
  rulersVisible,
  guidesCount,
  smartGuides,
  onToggleSmartGuides,
  panZoomLocked,
  onTogglePanZoomLock,
  clipArtboard,
  onToggleClipArtboard,
  onPanTool,
  onOpenPressure,
  onOpenFonts,
  onOpenReferences,
  onOpenTracer,
  onOpenHelp,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => (
  <Sheet open={open} onClose={onClose} title={projectName} subtitle={savedLabel} size="sm">
    <div className="flex flex-col gap-5 pb-2">
      <section>
        <div className="label-mono mb-1 px-2">Document</div>
        <Row
          icon={<Save size={16} />}
          label="Save"
          hint="Stored on this device"
          onClick={onSave}
        />
        <Row icon={<FolderOpen size={16} />} label="Projects" onClick={onOpenProjects} />
        <Row icon={<FilePlus2 size={16} />} label="New document" onClick={onNewProject} />
        <Row icon={<Upload size={16} />} label="Export" onClick={onOpenExport} />
      </section>

      <section>
        <div className="label-mono mb-1 px-2">History</div>
        <div className="flex gap-2 px-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-ink-2 text-[12px] font-semibold text-dim disabled:opacity-35"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-ink-2 text-[12px] font-semibold text-dim disabled:opacity-35"
          >
            <Redo2 size={14} /> Redo
          </button>
        </div>
      </section>

      <section>
        <div className="label-mono mb-1 px-2">Canvas</div>
        <Row
          icon={<Grid3x3 size={16} />}
          label="Grid & snapping"
          hint={gridLabel}
          onClick={onOpenCanvas}
        />
        <Row
          icon={<Ruler size={16} />}
          label="Size, rulers & guides"
          hint={`${canvasLabel} · ${rulersVisible ? 'rulers on' : 'rulers off'}${guidesCount ? ` · ${guidesCount} guide${guidesCount > 1 ? 's' : ''}` : ''}`}
          onClick={onOpenCanvas}
        />
        <Row
          icon={<Ruler size={16} />}
          label="Smart guides"
          onClick={onToggleSmartGuides}
          trailing={<Switch on={smartGuides} />}
        />
        <Row
          icon={<Lock size={16} />}
          label="Lock pan & zoom"
          onClick={onTogglePanZoomLock}
          trailing={<Switch on={panZoomLocked} />}
        />
        <Row
          icon={<Crop size={16} />}
          label="Clip to artboard"
          onClick={onToggleClipArtboard}
          trailing={<Switch on={clipArtboard} />}
        />
        <Row
          icon={<Hand size={16} />}
          label="Pan tool"
          hint="Or drag with two fingers"
          onClick={onPanTool}
        />
      </section>

      <section>
        <div className="label-mono mb-1 px-2">Studio</div>
        <Row
          icon={<SlidersHorizontal size={16} />}
          label="Brush pressure"
          hint="Taper, weight and nib angle"
          onClick={onOpenPressure}
        />
        <Row icon={<Type size={16} />} label="Fonts" onClick={onOpenFonts} />
        <Row icon={<ImageIcon size={16} />} label="References" onClick={onOpenReferences} />
        <Row
          icon={<Sparkles size={16} />}
          label="Trace an image"
          hint="Turn a silhouette into paths"
          onClick={onOpenTracer}
        />
      </section>

      <section>
        <Row icon={<HelpCircle size={16} />} label="Gestures & shortcuts" onClick={onOpenHelp} />
        <div className="mt-1 flex items-center justify-between px-2 pt-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
            Pentix · Studio
          </span>
          <span className="flex items-center gap-1 text-[10px] text-mute">
            <Check size={10} /> offline
          </span>
        </div>
      </section>
    </div>
  </Sheet>
);
