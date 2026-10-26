import React from 'react';
import { PenTool, Combine, MousePointer2, Hand, Type as TypeIcon } from 'lucide-react';
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
  <section className="rounded-xl border border-line bg-ink-2 px-3 py-2.5">
    <div className="mb-1 flex items-center gap-2 text-accent">
      {icon}
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
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

      <Group icon={<Combine size={14} />} title="Shape builder & pathfinder">
        <Item term="Build tool">With two or more shapes on the layer, drag across the regions you want to merge — release to commit.</Item>
        <Item term="Erase">Flip the Build strip to Erase, or hold Alt, then tap regions to remove them.</Item>
        <Item term="Pathfinder">
          Select two or more objects, then Unite, Minus, Intersect or Exclude from the strip above the dock.
        </Item>
      </Group>

      <Group icon={<MousePointer2 size={14} />} title="Selection">
        <Item term="Double-tap object">Switches you to direct select on that path.</Item>
        <Item term="Handles">Eight stretch handles plus a rotation handle above the box.</Item>
        <Item term="Right rail">Duplicate, delete and the nudge pad in 0.5, 1, 5 or 10 px steps.</Item>
      </Group>

      <Group icon={<TypeIcon size={14} />} title="Text">
        <Item term="Add text">Type tool or the Text chip in the options strip.</Item>
        <Item term="To curves">Select the text and use “To curves” to convert glyphs into editable paths.</Item>
      </Group>

      <section className="rounded-xl border border-line bg-ink-2 px-3 py-2.5">
        <div className="mb-1.5">
          <SectionLabel>Desktop keys</SectionLabel>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
          <Key>V</Key> select
          <Key>A</Key> direct
          <Key>P</Key> pen
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
