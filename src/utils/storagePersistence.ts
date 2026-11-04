export type StorageProtection = 'granted' | 'denied' | 'unsupported' | 'unknown';

/**
 * Ask the browser to keep this origin's IndexedDB/localStorage out of routine
 * cleanup. Browsers may grant silently or decline without a prompt.
 */
export async function requestStorageProtection(): Promise<StorageProtection> {
  if (typeof navigator === 'undefined' || !navigator.storage) return 'unsupported';
  try {
    if (
      typeof navigator.storage.persisted === 'function' &&
      (await navigator.storage.persisted())
    ) {
      return 'granted';
    }
    if (typeof navigator.storage.persist !== 'function') return 'unsupported';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function storageProtectionHint(state: StorageProtection): string {
  if (state === 'granted') return 'Protected against automatic cleanup';
  if (state === 'denied') return 'Not protected — keep a backup';
  if (state === 'unsupported') return 'Protection unavailable — keep a backup';
  return 'Checking storage…';
}
