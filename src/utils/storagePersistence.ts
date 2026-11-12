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

export interface StorageUsage {
  usage: number;
  quota: number;
}

/**
 * How much room this origin is using, when the browser will say. Used by the
 * backup sheet so someone with a lot of imported references can see the number
 * instead of guessing.
 */
export async function estimateStorage(): Promise<StorageUsage | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number') return null;
    return { usage, quota };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 10 || exponent === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[exponent]}`;
}
