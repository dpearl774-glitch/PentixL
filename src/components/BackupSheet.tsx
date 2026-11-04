import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Download,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button, SectionLabel, Sheet } from './ui/primitives';
import type { StorageProtection } from '../utils/storagePersistence';

interface BackupSheetProps {
  open: boolean;
  onClose: () => void;
  protection: StorageProtection;
  onProtect: () => Promise<void>;
  onExport: () => Promise<void>;
  onRestore: (file: File) => Promise<void>;
}

export const BackupSheet: React.FC<BackupSheetProps> = ({
  open,
  onClose,
  protection,
  onProtect,
  onExport,
  onRestore,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'restore' | 'protect' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'export' | 'restore' | 'protect', action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action could not be completed.');
    } finally {
      setBusy(null);
    }
  };

  const protectedStorage = protection === 'granted';
  const unsupported = protection === 'unsupported';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Backup"
      eyebrow="Local data"
      subtitle="Projects, fonts and preferences in one file."
      size="sm"
    >
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void run('restore', () => onRestore(file));
        }}
      />

      <div className="flex flex-col gap-5">
        <section className="rounded-xl border border-line bg-ink-2 p-3">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                protectedStorage
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-danger/35 bg-danger/10 text-danger'
              }`}
            >
              {protectedStorage ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <SectionLabel>Browser storage</SectionLabel>
              <p className="mt-1 text-[12.5px] font-semibold text-text">
                {protectedStorage
                  ? 'Protected'
                  : unsupported
                    ? 'Protection unavailable'
                    : 'Best effort only'}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-mute">
                {protectedStorage
                  ? 'The browser has marked this app’s local data as persistent. It can still be cleared by you or a device reset.'
                  : unsupported
                    ? 'This browser does not expose persistent storage. Keep a backup outside the browser.'
                    : 'The browser may clear local data under storage pressure. Protect it or keep a backup outside the browser.'}
              </p>
              {!protectedStorage && !unsupported && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  disabled={busy !== null}
                  onClick={() => void run('protect', onProtect)}
                >
                  <ShieldCheck size={13} />
                  {busy === 'protect' ? 'Requesting…' : 'Protect storage'}
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionLabel>Full backup</SectionLabel>
          <Button
            variant="primary"
            block
            disabled={busy !== null}
            onClick={() => void run('export', onExport)}
          >
            <Download size={14} />
            {busy === 'export' ? 'Building backup…' : 'Export backup'}
          </Button>
          <Button
            variant="secondary"
            block
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} />
            {busy === 'restore' ? 'Restoring…' : 'Restore backup'}
          </Button>
          <p className="px-1 text-[11px] leading-relaxed text-mute">
            Restore adds projects and fonts from the file and replaces matching project IDs or
            font names. Existing records not in the backup stay. Pentix reloads afterwards.
          </p>
        </section>

        {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{error}</p>}

        <div className="flex items-start gap-2 rounded-xl border border-line bg-ink-0 px-3 py-2.5">
          <Archive size={14} className="mt-0.5 shrink-0 text-dim" />
          <p className="text-[11px] leading-relaxed text-mute">
            A backup is the only copy that survives clearing browser data or moving to another
            device. Store it outside this browser.
          </p>
        </div>
      </div>
    </Sheet>
  );
};
