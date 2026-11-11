import React from 'react';
import {
  PenTool,
  Pencil,
  Combine,
  MousePointer2,
  Hand,
  Type as TypeIcon,
  Grid3x3,
  Frame,
  Sparkles,
} from 'lucide-react';
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

export const HelpSheet: React.FC<HelpSheetProps> = ({ open, onClose }) => (
  <Sheet
    open={open}
    onClose={onClose}
    title="Gestures & shortcuts"
    eyebrow="Reference"
    subtitle="Everything the two-thumb layout gives you."
  >
    <div className="flex flex-col gap-2.5 pb-2">
      <Group icon={<Hand size={14} />} title="Canvas">
        <Item term="Two fingers">Pan and pinch to zoom. Disable in the menu if you keep nudging it.</Item>
        <Item term="One finger">
          Drags the active tool. Empty space on Select starts a marquee.
        </Item>
        <Item term="Tap canvas">Deselects. With the text tool it places a label.</Item>
        <Item term={<Key>space</Key>}>Hold to pan, release to return to the tool you were on.</Item>
        <Item term="Top bar">Undo and redo sit beside the document name. Layers open as a see-through panel.</Item>
      </Group>

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

      <Group icon={<span className="font-mono text-[13px]">⇧⌃⌥</span>} title="Thumb modifiers">
        <Item term={<Key>⇧ Shift</Key>}>Constrain pen segments to 45°, lock shapes to equal proportions, scale proportionally.</Item>
        <Item term={<Key>⌃ Ctrl</Key>}>Temporarily switch to direct selection.</Item>
        <Item term={<Key>⌥ Alt</Key>}>Break a bezier handle, or flip shape builder into erase.</Item>
      </Group>

      <Group icon={<PenTool size={14} />} title="Pen">
        <Item term="Tap">Corner node.</Item>
        <Item term="Tap + drag">Symmetric handles, pulled out as you drag.</Item>
        <Item term="Tap first node">Closes the path.</Item>
        <Item term="Tap a node">Reopens it for editing.</Item>
        <Item term="Alt + tap node">Deletes that node.</Item>
        <Item term="Check button">Commits the path — right thumb rail, or “Done” in the strip.</Item>
      </Group>

      <Group icon={<Pencil size={14} />} title="Pencil">
        <Item term="Draw">Freehand stroke, fitted to smooth curves with a handful of nodes when you lift.</Item>
        <Item term="Close">Finish where you started — the cue ring means it will close into a filled shape.</Item>
        <Item term="Smoothness">Tight follows your finger closest, Smooth evens out wobble, Loose is the softest.</Item>
        <Item term="Tap">Places a single dot in the stroke colour.</Item>
      </Group>

      <Group icon={<Combine size={14} />} title="Shape builder & pathfinder">
        <Item term="Build tool">With two or more shapes on the layer, drag across the regions you want to merge — release to commit.</Item>
        <Item term="Erase">Flip the Build strip to Erase, or hold Alt, then tap regions to remove them.</Item>
        <Item term="Pathfinder">
          Select two or more objects, then Unite, Minus, Intersect or Exclude from More in the strip above the dock.
        </Item>
      </Group>

      <Group icon={<MousePointer2 size={14} />} title="Selection">
        <Item term="Direct mode">Double-tap an object to edit its nodes. Select in the dock returns you to object mode.</Item>
        <Item term="Align">With objects selected, Align lines up edges or centres, or evens the gaps.</Item>
        <Item term="Objects panel">Eye hides an object, the lock freezes it, and the slider sets its opacity.</Item>
        <Item term="Reordering">Tap an arrow to step one place; hold it to send the object to the front or back.</Item>
        <Item term="Handles">Eight stretch handles plus a rotation handle above the box.</Item>
        <Item term="Right rail">Duplicate, delete and the nudge pad in 0.5, 1, 5 or 10 px steps.</Item>
      </Group>

      <Group icon={<TypeIcon size={14} />} title="Text">
        <Item term="Add text">Type tool or the Text chip in the options strip.</Item>
        <Item term="Edit text">Double-tap a label, or tap it with the type tool, to change it.</Item>
        <Item term="To curves">Select the text and use “To curves” to convert glyphs into editable paths.</Item>
      </Group>

      <Group icon={<Sparkles size={14} />} title="Studio">
        <Item term="Fonts">Imported typefaces are stored on this device and return after a refresh.</Item>
        <Item term="References">Saved with the document, and locked behind the artwork until unlocked.</Item>
        <Item term="Pressure">Auto uses stylus pressure or finger speed, Speed follows motion, Uniform is constant.</Item>
        <Item term="Simplify">Reduces anchors on paths and traces you have already made. Lives in More.</Item>
        <Item term="Preview">
          The eye in the top bar hides every panel, ruler, grid, guide and selection, leaving only
          the artboard. Drag to pan, pinch to zoom, and tap Exit or press Esc to come back.
        </Item>
        <Item term="Pad">
          Optional trackpad for pen, pencil, node and select work: steer the crosshair, click to press,
          drag to move what it landed on, scroll to pan and ⌘-scroll to zoom. Hide it from the menu.
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
    </div>
  </Sheet>
);
