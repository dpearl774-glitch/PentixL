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
  LayoutGrid,
  ScanLine,
  Newspaper,
  Download,
  RefreshCw,
  HelpCircle,
  BookOpen,
  MessageSquarePlus,
  Send,
  MessageCircle,
  Move,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Chip, Sheet } from './ui/primitives';
import type { ThemeChoice } from '../utils/appearance';
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
  onOpenWhatsNew: () => void;
  /** A downloaded build is waiting for the user to take it */
  updateReady: boolean;
  onApplyUpdate: () => void;
  theme: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  /** A changelog entry the user has not opened yet */
  hasUnseenChanges?: boolean;
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
  /** Open away from the editor — a page the user reads, not a download */
  newTab?: boolean;
}> = ({ icon, label, hint, onClick, trailing, href, download, newTab }) => {
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
    // A download stays in place: a new window makes the browser ignore `download`,
    // so the file gets saved under its URL name instead of the one given here.
    // An outside destination is the opposite case, and opens away from the app.
    const external = newTab || /^https?:/i.test(href);
    return (
      <a
        href={href}
        download={download}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
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
  onOpenWhatsNew,
  hasUnseenChanges,
  updateReady,
  onApplyUpdate,
  theme,
  onThemeChange,
  onOpenFeedback,
  onCleanUpFragments,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => (
  <Sheet open={open} onClose={onClose} title={projectName} subtitle={canvasLabel} size="sm">
    <div className="flex flex-col gap-5 pb-2">
      {/* A waiting build stays visible here until it is taken: dismissing the
          floating banner must not make the update disappear. */}
      {updateReady && (
        <section>
          <button
            type="button"
            onClick={onApplyUpdate}
            className="press flex w-full items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-2 text-left"
          >
            <RefreshCw size={16} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-text">Update ready</span>
              <span className="block truncate text-[11px] text-dim">
                Downloaded — tap to finish
              </span>
            </span>
            <span className="shrink-0 rounded-md bg-accent/20 px-2 py-1 text-[11px] font-bold text-accent">
              Reload
            </span>
          </button>
        </section>
      )}

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
        <div className="label-mono mb-1 px-2">Appearance</div>
        <div className="flex gap-1.5 px-1">
          {(
            [
              ['dark', 'Dark'],
              ['light', 'Light'],
              ['system', 'System'],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={value}
              active={theme === value}
              onClick={() => onThemeChange(value)}
              className="flex-1 justify-center"
            >
              {label}
            </Chip>
          ))}
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
          icon={<LayoutGrid size={16} />}
          label="Patterns"
          hint="Named pattern swatches"
          onClick={onOpenPatterns}
        />
        <Row
          icon={<ScanLine size={16} />}
          label="Trace an image"
          hint="Turn a silhouette into paths"
          onClick={onOpenTracer}
        />
      </section>

      <section>
        <Row icon={<HelpCircle size={16} />} label="Gestures & shortcuts" onClick={onOpenHelp} />
        <Row
          icon={<Newspaper size={16} />}
          label="What's new"
          hint="What changed in the latest builds"
          onClick={onOpenWhatsNew}
          trailing={
            hasUnseenChanges ? (
              <span
                aria-label="Unread changes"
                className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_6px_rgba(205,255,92,0.7)]"
              />
            ) : undefined
          }
        />
        {/* The manual is a page now: it opens instantly, is stored on the
            device after the first read, and does not download 2 MB each time.
            The PDF stays for printing and sharing. */}
        <Row
          icon={<BookOpen size={16} />}
          label="Manual"
          hint="Read it in the browser — stored for offline"
          // Relative to the document, so it resolves under "/" on a domain
          // deploy and under "/<repo>/" on GitHub project pages.
          href="manual.html"
          newTab
          onClick={onClose}
        />
        <Row
          icon={<Download size={16} />}
          label="Download PDF"
          hint="For printing or sending to someone"
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
        <Row
          icon={<Send size={16} />}
          label="Telegram updates"
          hint="Builds, fixes and downtime"
          href="https://t.me/pentixapp"
          onClick={onClose}
        />
        <Row
          icon={<MessageCircle size={16} />}
          label="Testers' chat"
          hint="Ask, report, compare notes"
          href="https://t.me/pentixchat"
          onClick={onClose}
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
