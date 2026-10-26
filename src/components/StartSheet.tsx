import React from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { LOGO_TEMPLATES, LogoTemplate } from '../data/templates';
import { generateProjectThumbnailSvg } from '../utils/thumbnailGenerator';
import { Button, Sheet } from './ui/primitives';

interface StartSheetProps {
  open: boolean;
  onStartBlank: () => void;
  onChooseTemplate: (template: LogoTemplate) => void;
  onClose: () => void;
}

/** Shown once, on the first launch. */
export const StartSheet: React.FC<StartSheetProps> = ({
  open,
  onStartBlank,
  onChooseTemplate,
  onClose,
}) => (
  <Sheet
    open={open}
    onClose={onClose}
    title="Pentix"
    eyebrow="Vector studio"
    subtitle="A pen tool, shape builder and pathfinder that fit under your thumbs."
  >
    <div className="flex flex-col gap-2.5 pb-1">
      <button
        type="button"
        onClick={onStartBlank}
        className="press flex items-center gap-3 rounded-xl border border-line bg-ink-2 px-3 py-3 text-left hover:border-accent/50"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent">
          <Plus size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-text">Start blank</span>
          <span className="block text-[11px] text-mute">Empty 600 × 600 artboard</span>
        </span>
        <ArrowRight size={15} className="text-mute" />
      </button>

      <div className="label-mono mt-2 px-1">Or open a blueprint</div>

      {LOGO_TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChooseTemplate(t)}
          className="press flex items-center gap-3 rounded-xl border border-line bg-ink-2 p-2 text-left hover:border-accent/40"
        >
          <span className="h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-0">
            <span
              className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: generateProjectThumbnailSvg(t.layers) }}
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold text-text">{t.name}</span>
            <span className="block text-[11px] leading-snug text-mute">{t.description}</span>
          </span>
        </button>
      ))}

      <Button variant="quiet" block onClick={onClose} className="mt-1">
        Skip
      </Button>
    </div>
  </Sheet>
);
