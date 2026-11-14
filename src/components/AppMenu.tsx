import React from 'react';
import {
  Eraser,
  FolderOpen,
  FilePlus2,
  Save,
  Database,
  Grid3x3,
  Hand,
  Ruler,
  Frame,
  Lock,
  Crop,
  SlidersHorizontal,
  Type,
  Image as ImageIcon,
  Sparkles,
  HelpCircle,
  BookOpen,
  MessageSquarePlus,
  Move,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Sheet } from './ui/primitives';
import { BrandMark } from './BrandMark';

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  onSave: () => void;
  onOpenBackup: () => void;
  storageHint: string;
  onNewProject: () => void;
  onOpenProjects: () => void;
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
  showTransforms: boolean;
  onToggleTransforms: () => void;
  showPrecisionPad: boolean;
  onTogglePrecisionPad: () => void;
  onPanTool: () => void;
  onOpenPressure: () => void;
  onOpenFonts: () => void;
  onOpenReferences: () => void;
  onOpenPatterns: () => void;
  onOpenTracer: () => void;
  onOpenHelp: () => void;
  onOpenFeedback: () => void;
  onCleanUpFragments: () => void;
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
  /** When set the row is a real link, so the browser downloads rather than a tap doing nothing. */
  href?: string;
  download?: string;
}> = ({ icon, label, hint, onClick, trailing, href, download }) => {
  const content = (
    <>
      <span className="grid h-7 w-7 shrink-0 place-items-center text-dim">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-text">{label}</span>
        {hint && <span className="block truncate text-[11px] text-mute">{hint}</span>}
      </span>
      {trailing}
    </>
  );
  const className = `press flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left ${
    onClick || href ? 'hover:bg-ink-3' : ''
  }`;

  if (href) {
    return (
      // No target: a new window makes the browser ignore `download`, so the file
      // would be saved under its URL name instead of the one given here.
      <a
        href={href}
        download={download}
        onClick={onClick}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={className}>
      {content}
    </button>
  );
};

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
  onSave,
  onOpenBackup,
  storageHint,
  onNewProject,
  onOpenProjects,
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
  showTransforms,
  onToggleTransforms,
  showPrecisionPad,
  onTogglePrecisionPad,
  onPanTool,
  onOpenPressure,
  onOpenFonts,
  onOpenReferences,
  onOpenPatterns,
  onOpenTracer,
  onOpenHelp,
  onOpenFeedback,
  onCleanUpFragments,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => (
  <Sheet open={open} onClose={onClose} title={projectName} subtitle={canvasLabel} size="sm">
    <div className="flex flex-col gap-5 pb-2">
      <section>
        <div className="label-mono mb-1 px-2">Document</div>
        <Row
          icon={<Save size={16} />}
          label="Save"
          hint="Stored on this device"
          onClick={onSave}
        />
        <Row
          icon={<Database size={16} />}
          label="Backup & restore"
          hint={storageHint}
          onClick={onOpenBackup}
        />
        <Row icon={<FolderOpen size={16} />} label="Projects" onClick={onOpenProjects} />
        <Row icon={<FilePlus2 size={16} />} label="New document" onClick={onNewProject} />
        <Row
          icon={<Eraser size={16} />}
          label="Clean up fragments"
          hint="Delete invisible leftovers"
          onClick={onCleanUpFragments}
        />
      </section>

      <section>
        <div className="label-mono mb-1 px-2">History</div>
        <div className="flex gap-2 px-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-ink-2 text-[12px] font-semibold text-dim disabled:opacity-35"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-ink-2 text-[12px] font-semibold text-dim disabled:opacity-35"
          >
            <Redo2 size={14} /> Redo
          </button>
        </div>
      </section>

      <section>
        <div className="label-mono mb-1 px-2">Canvas</div>
        <Row
          icon={<Grid3x3 size={16} />}
          label="Artboard & canvas"
          hint={`${canvasLabel} · ${gridLabel} · ${rulersVisible ? 'rulers' : 'no rulers'}${guidesCount ? ` · ${guidesCount} guide${guidesCount > 1 ? 's' : ''}` : ''}`}
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
          icon={<Frame size={16} />}
          label="Transform box"
          hint="Selection box and handles"
          onClick={onToggleTransforms}
          trailing={<Switch on={showTransforms} />}
        />
        <Row
          icon={<Move size={16} />}
          label="Precision pad"
          hint="Trackpad cursor"
          onClick={onTogglePrecisionPad}
          trailing={<Switch on={showPrecisionPad} />}
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
          label="Patterns"
          hint="Named pattern swatches"
          onClick={onOpenPatterns}
        />
        <Row
          icon={<Sparkles size={16} />}
          label="Trace an image"
          hint="Turn a silhouette into paths"
          onClick={onOpenTracer}
        />
      </section>

      <section>
        <Row icon={<HelpCircle size={16} />} label="Gestures & shortcuts" onClick={onOpenHelp} />
        <Row
          icon={<BookOpen size={16} />}
          label="Tutorial PDF"
          hint="The full manual, with screenshots"
          // Relative to the document, so it resolves under "/" on a domain
          // deploy and under "/<repo>/" on GitHub project pages.
          href="pentix-tutorial.pdf"
          download="Pentix tutorial.pdf"
          onClick={onClose}
        />
        <Row
          icon={<MessageSquarePlus size={16} />}
          label="Send feedback"
          hint="Bug, idea or anything odd"
          onClick={onOpenFeedback}
        />
        <div className="mt-1 flex items-center gap-2 px-2 pt-2">
          <BrandMark size={20} />
          <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-mute">
            Pentix · Vector studio
          </span>
        </div>
      </section>
    </div>
  </Sheet>
);
