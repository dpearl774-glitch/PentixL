import {
  getAllProjects,
  sanitizeBackupProject,
  saveProject,
  type StoredProject,
} from './projectStorage';
import { referencesForBackup } from './referenceImages';
import { saveBlob } from './fileSave';
import type { SaveOutcome } from './fileSave';
import { loadAllFonts, saveFont, type StoredFont } from './fontStorage';
import {
  loadUserPrefs,
  sanitizeUserPrefs,
  saveUserPrefs,
  type UserPrefs,
} from './userPrefs';

const FORMAT = 'pentix-backup';
const VERSION = 1;
const MAX_BACKUP_BYTES = 250 * 1024 * 1024;
const MAX_FONT_BYTES = 40 * 1024 * 1024;

interface BackupFont {
  family: string;
  data: string;
  addedAt: number;
}

interface PentixBackup {
  format: typeof FORMAT;
  version: typeof VERSION;
  exportedAt: string;
  projects: StoredProject[];
  fonts: BackupFont[];
  prefs: UserPrefs;
}

export interface BackupSummary {
  projects: number;
  fonts: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function bytesToBase64(data: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('Could not encode the font data.'));
      else resolve(result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the font data.'));
    reader.readAsDataURL(new Blob([data]));
  });
}

function base64ToArrayBuffer(data: string): ArrayBuffer {
  const clean = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
  if (!clean) throw new Error('A font in this backup has no data.');
  if (clean.length > Math.ceil((MAX_FONT_BYTES * 4) / 3) + 8) {
    throw new Error('A font in this backup is too large.');
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createBackup(): Promise<PentixBackup> {
  const [projects, fonts] = await Promise.all([getAllProjects(), loadAllFonts()]);
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    projects: await Promise.all(
      projects.map(async (project) => ({
        ...project,
        references: await referencesForBackup(project.references),
      }))
    ),
    fonts: await Promise.all(
      fonts.map(async (font) => ({
        family: font.family,
        data: await bytesToBase64(font.data),
        addedAt: font.addedAt,
      }))
    ),
    prefs: loadUserPrefs(),
  };
}

function download(blob: Blob, name: string): Promise<SaveOutcome> {
  return saveBlob(blob, name);
}

/** Build and download one JSON file containing every local Pentix store. */
export async function downloadBackup(): Promise<BackupSummary> {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  download(blob, `pentix-backup-${new Date().toISOString().slice(0, 10)}.json`);
  return { projects: backup.projects.length, fonts: backup.fonts.length };
}

/**
 * Restore a backup by upserting project ids and font families. Existing records
 * not present in the file are left alone, so a restore never wipes the library.
 */
export async function restoreBackupFile(file: File): Promise<BackupSummary> {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error('That backup is too large for this device to restore.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  if (!isRecord(parsed) || parsed.format !== FORMAT || parsed.version !== VERSION) {
    throw new Error('That is not a supported Pentix backup.');
  }
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.fonts)) {
    throw new Error('That backup is missing its projects or fonts.');
  }

  // Validate the entire file before writing anything.
  const projects = parsed.projects.slice(0, 500).map((project) => sanitizeBackupProject(project));
  const fonts = new Map<string, { family: string; data: ArrayBuffer; addedAt: number }>();
  for (const value of parsed.fonts.slice(0, 100)) {
    if (!isRecord(value) || typeof value.family !== 'string' || typeof value.data !== 'string') {
      throw new Error('That backup contains an invalid font.');
    }
    const family = value.family.trim().slice(0, 120);
    if (!family) throw new Error('That backup contains a font without a name.');
    const addedAt =
      typeof value.addedAt === 'number' && Number.isFinite(value.addedAt)
        ? value.addedAt
        : Date.now();
    fonts.set(family, { family, data: base64ToArrayBuffer(value.data), addedAt });
  }

  const prefs = isRecord(parsed.prefs) ? sanitizeUserPrefs(parsed.prefs) : null;

  for (const project of projects) await saveProject(project);
  for (const font of fonts.values()) await saveFont(font.family, font.data);
  if (prefs) saveUserPrefs(prefs);

  return { projects: projects.length, fonts: fonts.size };
}
