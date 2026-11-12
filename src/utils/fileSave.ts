/**
 * Writing a file to the artist's device.
 *
 * Chromium exposes the File System Access API, so an export can reopen the file
 * the artist already chose instead of landing in Downloads again. The handle is
 * kept per filename for the life of the page. Everywhere else — Safari, Firefox,
 * or a browser that refuses — this falls back to an ordinary download, which is
 * the behaviour the app shipped with.
 */

export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled';

interface WritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface SaveHandle {
  name: string;
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
  createWritable: () => Promise<WritableFileStream>;
}

interface SavePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

type SavePicker = (options?: SavePickerOptions) => Promise<SaveHandle>;

/** Handles are per filename, so re-exporting overwrites the same file. */
const savedHandles = new Map<string, SaveHandle>();

function savePicker(): SavePicker | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { showSaveFilePicker?: SavePicker })
    .showSaveFilePicker;
  return typeof candidate === 'function' ? candidate : null;
}

/** True when this browser can write straight to a chosen file. */
export function canSaveToDisk(): boolean {
  return savePicker() !== null;
}

/** Drops remembered handles — used when the file may have moved or been denied. */
export function forgetSavedFile(filename?: string): void {
  if (filename) savedHandles.delete(filename);
  else savedHandles.clear();
}

const ACCEPT_BY_EXTENSION: Record<string, Record<string, string[]>> = {
  svg: { 'image/svg+xml': ['.svg'] },
  png: { 'image/png': ['.png'] },
  pdf: { 'application/pdf': ['.pdf'] },
  json: { 'application/json': ['.json'] },
};

export function acceptFor(filename: string): Record<string, string[]> | undefined {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPT_BY_EXTENSION[extension];
}

function extensionLabel(filename: string): string {
  const extension = filename.split('.').pop()?.toUpperCase() ?? 'File';
  return `${extension} file`;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Saves a blob, preferring a real file when the browser allows it.
 * A cancelled dialog reports 'cancelled' rather than silently downloading.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveOutcome> {
  const pick = savePicker();
  if (pick) {
    try {
      let handle = savedHandles.get(filename);
      if (handle?.queryPermission) {
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') handle = undefined;
      }
      if (!handle) {
        const accept = acceptFor(filename);
        handle = await pick({
          suggestedName: filename,
          ...(accept ? { types: [{ description: extensionLabel(filename), accept }] } : {}),
        });
        savedHandles.set(filename, handle);
      }
      const stream = await handle.createWritable();
      await stream.write(blob);
      await stream.close();
      return 'saved';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
      // A stale handle must not block the export: forget it and download.
      forgetSavedFile(filename);
    }
  }
  download(blob, filename);
  return 'downloaded';
}
