import React, { useMemo, useState } from 'react';
import { Bug, Copy, ExternalLink, Lightbulb, Palette, Upload } from 'lucide-react';
import { Button, Chip, SectionLabel, Sheet } from './ui/primitives';
import { APP_VERSION, buildDiagnostics, buildReport, FeedbackContext } from '../utils/diagnostics';

interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  context: FeedbackContext;
  onCopied: (message: string) => void;
}

const ISSUE_URL = 'https://github.com/dpearl774-glitch/PentixL/issues/new';

const KINDS = [
  { id: 'Bug', icon: <Bug size={13} /> },
  { id: 'Idea', icon: <Lightbulb size={13} /> },
  { id: 'Look & feel', icon: <Palette size={13} /> },
  { id: 'Export', icon: <Upload size={13} /> },
];

const copy = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard permissions vary wildly on a phone; fall back to a selection.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
};

/**
 * Testers report from the phone they are holding, so the sheet keeps one
 * textarea, one copy button and the diagnostics already attached. No account,
 * no network call: the app stays usable offline.
 */
export const FeedbackSheet: React.FC<FeedbackSheetProps> = ({
  open,
  onClose,
  context,
  onCopied,
}) => {
  const [kind, setKind] = useState('Bug');
  const [message, setMessage] = useState('');
  const diagnostics = useMemo(
    () => (open ? buildDiagnostics(context) : ''),
    [open, context]
  );
  const report = buildReport(kind, message, context);

  const handleCopy = async () => {
    const ok = await copy(report);
    onCopied(ok ? 'Report copied — paste it anywhere' : 'Could not copy — select the text below');
  };

  const issueHref = `${ISSUE_URL}?title=${encodeURIComponent(
    `[${kind}] ${message.split('\n')[0].slice(0, 60) || 'Feedback'}`
  )}&body=${encodeURIComponent(`${message.trim() || '(describe the issue)'}\n\n\`\`\`\n${diagnostics}\n\`\`\``)}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Send feedback"
      eyebrow="Help us fix it"
      subtitle="Nothing leaves this device until you copy or send it yourself."
    >
      <div className="flex flex-col gap-3 pb-2">
        <div>
          <SectionLabel>What is it?</SectionLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {KINDS.map((option) => (
              <Chip
                key={option.id}
                active={kind === option.id}
                icon={option.icon}
                onClick={() => setKind(option.id)}
              >
                {option.id}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>What happened?</SectionLabel>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            placeholder={
              kind === 'Bug'
                ? 'What you did, what you expected, what happened instead.'
                : 'What would make this better?'
            }
            className="mt-1.5 w-full resize-none rounded-lg border border-line bg-ink-0 px-3 py-2.5 text-[13px] leading-relaxed text-text outline-none placeholder:text-mute focus:border-accent/60"
          />
        </div>

        <details className="rounded-lg border border-line bg-ink-2 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-dim">
            Attached automatically
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-mute">
            {diagnostics}
          </pre>
        </details>

        <Button variant="primary" size="lg" block onClick={handleCopy}>
          <Copy size={15} /> Copy report
        </Button>

        <a
          href={issueHref}
          target="_blank"
          rel="noreferrer"
          className="press flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-ink-2 text-[12.5px] font-semibold text-dim hover:border-line-strong hover:text-text"
        >
          <ExternalLink size={14} /> Open as a GitHub issue
        </a>

        <p className="px-1 text-[11px] leading-relaxed text-mute">
          Copy packs your note with device details into one block — paste it into a message, an
          issue or an email. Version {APP_VERSION}
        </p>
      </div>
    </Sheet>
  );
};
