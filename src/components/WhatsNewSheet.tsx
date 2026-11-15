import React from 'react';
import { Sheet } from './ui/primitives';
import { CHANGELOG } from '../data/changelog';

interface WhatsNewSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The changelog, newest first. Entries are prose, not commit subjects: the
 * point is that someone who has been away a week can see what changed.
 */
export const WhatsNewSheet: React.FC<WhatsNewSheetProps> = ({ open, onClose }) => (
  <Sheet
    open={open}
    onClose={onClose}
    onDone={onClose}
    title="What's new"
    eyebrow="Pentix"
    subtitle="Every build, newest first"
  >
    <div className="space-y-2.5">
      {CHANGELOG.map((entry, index) => (
        <section
          key={entry.id}
          className={`rounded-lg border px-3 py-2.5 ${
            index === 0 ? 'border-accent/40 bg-accent/[0.06]' : 'border-line bg-ink-2'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[12.5px] font-bold text-text">{entry.title}</h3>
            <span className="shrink-0 font-mono text-[10px] text-mute">{entry.date}</span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {entry.items.map((item) => (
              <li key={item} className="flex gap-2 text-[11.5px] leading-relaxed text-dim">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </Sheet>
);
