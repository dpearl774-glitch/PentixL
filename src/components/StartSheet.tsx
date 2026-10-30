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

      <div className="label-mono mt-2 px-1">Or start from a grid</div>

      <div className="grid grid-cols-2 gap-2">
        {LOGO_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChooseTemplate(t)}
            className="press overflow-hidden rounded-xl border border-line bg-ink-2 p-1.5 text-left hover:border-accent/40"
          >
            <span className="block h-[74px] w-full overflow-hidden rounded-lg border border-line bg-ink-0 [&>svg]:h-full [&>svg]:w-full">
              <span
                className="block h-full w-full"
                dangerouslySetInnerHTML={{ __html: generateProjectThumbnailSvg(t.layers) }}
              />
            </span>
            <span className="mt-1.5 block truncate px-0.5 text-[12px] font-semibold text-text">
              {t.name}
            </span>
            <span className="block px-0.5 pb-0.5 text-[10.5px] leading-snug text-mute">
              {t.description}
            </span>
          </button>
        ))}
      </div>

      <Button variant="quiet" block onClick={onClose} className="mt-1">
        Skip
      </Button>
    </div>
  </Sheet>
);
