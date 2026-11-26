import React, { useEffect, useState } from 'react';
import {
  PenTool,
  Pencil,
  Combine,
  MousePointer2,
  Hand,
  Type as TypeIcon,
  Grid3x3,
  Frame,
  Layers,
  BookOpen,
  Download,
  Gauge,
} from 'lucide-react';
import { medianMs, PerfSample, readSamples } from '../utils/perfTrace';
import { SectionLabel, Sheet } from './ui/primitives';

interface HelpSheetProps {
  open: boolean;
  onClose: () => void;
}

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-grid h-6 min-w-6 place-items-center rounded-md border border-line-strong bg-ink-2 px-1.5 font-mono text-[11px] font-bold text-text">
    {children}
  </span>
);

const Item: React.FC<{ term: React.ReactNode; children: React.ReactNode }> = ({ term, children }) => (
  <div className="flex gap-3 py-1.5">
    <div className="w-[104px] shrink-0 text-[11.5px] font-semibold text-dim">{term}</div>
    <div className="text-[12px] leading-relaxed text-mute">{children}</div>
  </div>
);

const Group: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <section className="rounded-lg border border-line bg-ink-2 px-3 py-2.5">
    <div className="mb-1 flex items-center gap-2 text-accent">
      {icon}
      <span className="font-sans text-[10px] uppercase tracking-[0.08em] text-accent">
        {title}
      </span>
    </div>
    <div className="divide-y divide-line/60">{children}</div>
  </section>
);

/**
 * The tester's claim is a multiple, so the numbers behind it are shown where
 * she already looks for answers instead of living in a developer's console.
 */
const SpeedSection: React.FC<{ open: boolean }> = ({ open }) => {
  const [samples, setSamples] = useState<PerfSample[]>([]);

  // Read on open, so the row is current without a subscription to every draw.
  useEffect(() => {
    if (open) setSamples(readSamples());
  }, [open]);

  const rows = [
    ['One shape', 'shape'],
    ['One word', 'word'],
    ['One export', 'export'],
  ] as const;
  const format = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
  const timed = rows.some(([, task]) => samples.some((s) => s.task === task));

  return (
    <Group icon={<Gauge size={14} />} title="Speed on this device">
      {timed ? (
        rows.map(([label, task]) => {
          const median = medianMs(samples, task);
          const runs = samples.filter((s) => s.task === task).length;
          return (
            <Item key={task} term={label}>
              {median === null ? 'Not timed yet' : `${format(median)} median of ${runs}`}
            </Item>
          );
        })
      ) : (
        <Item term="Nothing timed yet">
          Draw a shape, place a word or export once, and these fill in.
        </Item>
      )}
      <p className="pt-1.5 text-[10.5px] leading-snug text-mute">
        From pressing the tool to the thing landing, made on this device. Kept here, never
        uploaded.
      </p>
    </Group>
  );
};

export const HelpSheet: React.FC<HelpSheetProps> = ({ open, onClose }) => (
  <Sheet
    open={open}
    onClose={onClose}
    title="Gestures & shortcuts"
    eyebrow="Reference"
    subtitle="Everything the dock, canvas and panels give you."
  >
    <div className="flex flex-col gap-2.5 pb-2">
      <Group icon={<Hand size={14} />} title="Canvas">
        <Item term="Two fingers">Pan and pinch to zoom. Disable in the menu if you keep nudging it.</Item>
        <Item term="One finger">
          Drags the active tool. Empty space on Select starts a marquee.
        </Item>
        <Item term="Tap canvas">Deselects. With the text tool it places a label.</Item>
        <Item term={<Key>space</Key>}>Hold to pan, release to return to the tool you were on.</Item>
        <Item term="Top bar">Undo and redo sit beside the document name. Layers is the last tab in the dock; the ⇧⌃⌥ and Precise pills sit under the zoom control.</Item>
      </Group>

      {/* Near the top: the numbers answer a question the tester asks about the
          app as a whole, not a detail of one tool. */}
      <SpeedSection open={open} />

      <Group icon={<Grid3x3 size={14} />} title="Grid & guides">
        <Item term="Grid">
          Show/hide, spacing and line strength live in Canvas settings. The lock freezes spacing and
          appearance only — snapping, visibility and artwork editing keep working.
        </Item>
        <Item term="Snap">Independent of the grid, so you can snap with the grid hidden.</Item>
        <Item term="Rulers">
          Drag off a ruler to add a guide; a tap on the ruler does nothing. Undo removes the last
          one, and Lock all freezes every guide.
        </Item>
        <Item term="Export">Grid, rulers and guides are editing aids and never export.</Item>
      </Group>

      <Group icon={<Frame size={14} />} title="Canvas & export">
        <Item term="Size">Width and height in px, cm or in. Presets cover the square boards a mark is delivered at.</Item>
        <Item term="Fit artwork">Trims the board to the artwork and shifts it to a small margin.</Item>
        <Item term="One colour">Export can flatten every fill to black or white for reversed and mono uses, or crop to the selection.</Item>
        <Item term="Background">Artboard colour is separate from artwork colour; Reset restores the default.</Item>
        <Item term="Transparent">Off in the export panel drops the background entirely.</Item>
      </Group>

      <Group icon={<span className="font-mono text-[13px]">⇧⌃⌥</span>} title="Modifiers">
        <Item term="On screen">
          Tap the ⇧⌃⌥ pill under the zoom control and arm one or more. Tap Done, then drag; the active
          glyphs stay lit on the pill. Clear is the release action — tapping the pill only opens or
          closes this tray.
        </Item>
        <Item term={<Key>⇧ Shift</Key>}>Constrain pen segments to 45°, lock shapes to equal proportions, scale proportionally.</Item>
        <Item term={<Key>⌃ Ctrl</Key>}>Switch to direct selection while armed.</Item>
        <Item term={<Key>⌥ Alt</Key>}>Break a bezier handle, or flip shape builder into erase.</Item>
        <Item term="Keyboard">Holding the physical Shift, Ctrl or Alt key arms the same modifier.</Item>
      </Group>

      <Group icon={<PenTool size={14} />} title="Pen">
        <Item term="Tap">Corner node.</Item>
        <Item term="Tap + drag">Symmetric handles, pulled out as you drag.</Item>
        <Item term="Tap first node">Closes the path.</Item>
        <Item term="Tap a node">Reopens it for editing.</Item>
        <Item term="Alt + tap node">Deletes that node.</Item>
        <Item term="Check button">Commits the path — “Done” in the options bar.</Item>
      </Group>

      <Group icon={<Pencil size={14} />} title="Pencil">
        <Item term="Draw">Freehand stroke, fitted to smooth curves with a handful of nodes when you lift.</Item>
        <Item term="Close">Finish where you started — the cue ring means it will close into a filled shape.</Item>
        <Item term="Smoothness">Tight follows your finger closest, Smooth evens out wobble, Loose is the softest.</Item>
        <Item term="Tap">Places a single dot in the stroke colour.</Item>
      </Group>

      <Group icon={<Combine size={14} />} title="Shape builder & pathfinder">
        <Item term="Build tool">With two or more shapes on the layer, drag across the regions you want to merge — release to commit.</Item>
        <Item term="Erase">Flip the Build row to Erase, or hold Alt, then tap regions to remove them.</Item>
        <Item term="Pathfinder">
          Select two or more objects, then Unite, Minus, Intersect or Exclude from Effects → Pathfinder.
        </Item>
      </Group>

      <Group icon={<MousePointer2 size={14} />} title="Selection">
        <Item term="Direct mode">Double-tap an object to edit its nodes. Select in the dock returns you to object mode.</Item>
        <Item term="Groups">Tap any member and the whole group comes with it, so a drag moves the group as one. For a single piece, open Layers and switch Group to Object, then tap that row.</Item>
        <Item term="Arrange">With objects selected, Arrange lines up edges or centres, or evens the gaps.</Item>
        <Item term="Layers panel">Eye hides an object, the lock freezes it, and the slider sets its opacity.</Item>
        <Item term="Reordering">Tap an arrow to step one place; hold it to send the object to the front or back.</Item>
        <Item term="Handles">Eight stretch handles plus a rotation handle above the box.</Item>
        <Item term="Object sheet">
          Duplicate and delete sit in its header; X/Y give exact nudges, and the precision pad gives free
          movement.
        </Item>
      </Group>

      <Group icon={<TypeIcon size={14} />} title="Text">
        <Item term="Add text">The Text tab in the dock, or the Text chip in the options bar.</Item>
        <Item term="Edit text">Double-tap a label, or tap it with the type tool, to change it.</Item>
        <Item term="To curves">Select the text and use “To curves” to convert glyphs into editable paths.</Item>
      </Group>

      <Group icon={<Layers size={14} />} title="Studio">
        <Item term="Fonts">Imported typefaces are stored on this device and return after a refresh.</Item>
        <Item term="References">Saved with the document, and locked behind the artwork until unlocked.</Item>
        <Item term="Pressure">Auto uses stylus pressure or finger speed, Speed follows motion, Uniform is constant.</Item>
        <Item term="Simplify">Reduces anchors on paths and traces you have already made. Lives in Effects.</Item>
        <Item term="Preview">
          More actions (⋯) → Preview hides every panel, ruler, grid, guide and selection, leaving only
          the artboard. Drag to pan, pinch to zoom, and tap Exit or press Esc to come back.
        </Item>
        <Item term="Precision pad">
          The “Precise” pill under the zoom control opens an optional trackpad for pen, pencil, node and
          select work: steer the crosshair, click to press, drag to move what it landed on, scroll to pan
          and ⌘-scroll to zoom. Hide it from the menu.
        </Item>
      </Group>

      <section className="rounded-lg border border-line bg-ink-2 px-3 py-2.5">
        <div className="mb-1.5">
          <SectionLabel>Desktop keys</SectionLabel>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
          <Key>V</Key> select
          <Key>A</Key> direct
          <Key>P</Key> pen
          <Key>N</Key> pencil
          <Key>B</Key> brush
          <Key>M</Key> build
          <Key>U</Key> shapes
          <Key>T</Key> text
          <Key>H</Key> pan tool
          <Key>space</Key> hold to pan
          <Key>⌘Z</Key> undo
          <Key>⇧⌘Z</Key> redo
          <Key>⌘D</Key> duplicate
          <Key>⌘S</Key> save
          <Key>⌘C</Key>/<Key>⌘V</Key> copy / paste
          <Key>esc</Key> cancel
          <Key>⌫</Key> delete
        </div>
      </section>

      {/* The manual is the next step from here, so the sheet hands it over
          rather than telling the reader to go and find it in the menu. */}
      <a
        href="manual.html"
        target="_blank"
        rel="noreferrer"
        className="press flex items-center gap-3 rounded-lg border border-accent/35 bg-accent/10 px-3 py-3"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <BookOpen size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-text">Read the full manual</span>
          <span className="block text-[11px] text-mute">Every tool, step by step, with screenshots</span>
        </span>
        <Download size={14} className="shrink-0 text-mute" />
      </a>
    </div>
  </Sheet>
);
