import { Layer, CanvasView, Guide, ReferenceImage } from '../types/vector';
import { LOGO_TEMPLATES } from '../data/templates';
import { generateProjectThumbnailSvg } from './thumbnailGenerator';

/** Per-document grid system — visibility, spacing, appearance and lock */
export interface GridSettings {
  visible: boolean;
  snap: boolean;
  spacingX: number;
  spacingY: number;
  opacity: number;
  locked: boolean;
}

export interface StoredProject {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  layers: Layer[];
  /** Ruler guides are editing aids, but they belong to the document. */
  guides?: Guide[];
  /** So does the grid system — each document keeps its own spacing and lock. */
  grid?: GridSettings;
  /** One switch that locks (or unlocks) every guide in the document */
  guidesLocked?: boolean;
  /** Tracing references travel with the document. */
  references?: ReferenceImage[];
  view?: CanvasView;
  thumbnailSvg: string;
  pathsCount: number;
  layersCount: number;
  /** Artboard background colour for export and on-load restoration */
  artboardColor: string;
  /** Custom fonts loaded and selected in this project */
  customFonts: string[];
  /** Selected font family for text objects */
  selectedFontFamily: string;
}

const DB_NAME = 'pentix_vector_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Retrieve all projects ordered by most recently updated
 */
export async function getAllProjects(): Promise<StoredProject[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as StoredProject[]) || [];
        // Sort descending by updatedAt
        results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get projects from IndexedDB', err);
    return [];
  }
}

/**
 * Retrieve a single project by ID
 */
export async function getProject(id: string): Promise<StoredProject | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get project by ID', err);
    return null;
  }
}

/**
 * Save or update a project in IndexedDB
 */
export async function saveProject(project: StoredProject): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Ensure thumbnail and counts are fresh
    const pathsCount = project.layers.reduce((sum, l) => sum + (l.paths ? l.paths.length : 0), 0);
    const layersCount = project.layers.length;
    const thumbnailSvg = project.thumbnailSvg || generateProjectThumbnailSvg(project.layers);

    const projectToStore: StoredProject = {
      ...project,
      pathsCount,
      layersCount,
      thumbnailSvg,
      updatedAt: Date.now(),
    };

    const request = store.put(projectToStore);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a project by ID
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Duplicate an existing project with a new ID
 */
export async function duplicateProject(id: string): Promise<StoredProject> {
  const source = await getProject(id);
  if (!source) throw new Error('Source project not found');

  const now = Date.now();
  const cloned: StoredProject = {
    ...JSON.parse(JSON.stringify(source)),
    id: `project-${now}-${Math.random().toString(36).substring(2, 7)}`,
    name: `${source.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  await saveProject(cloned);
  return cloned;
}

/**
 * Seed initial showcase projects if the IndexedDB is empty on first app load
 */
export async function seedInitialProjectsIfEmpty(): Promise<StoredProject[]> {
  try {
    const existing = await getAllProjects();
    if (existing.length > 0) return existing;

    const seeded: StoredProject[] = [];
    const now = Date.now();

    for (let i = 0; i < Math.min(3, LOGO_TEMPLATES.length); i++) {
      const tmpl = LOGO_TEMPLATES[i];
      const pathsCount = tmpl.layers.reduce((sum, l) => sum + (l.paths ? l.paths.length : 0), 0);
      const thumbnailSvg = generateProjectThumbnailSvg(tmpl.layers);

      const proj: StoredProject = {
        id: `template-${tmpl.id}`,
        name: tmpl.name,
        description: tmpl.description,
        createdAt: now - (3 - i) * 3600000,
        updatedAt: now - (3 - i) * 1800000,
        layers: JSON.parse(JSON.stringify(tmpl.layers)),
        guides: [],
        pathsCount,
        layersCount: tmpl.layers.length,
        thumbnailSvg,
        artboardColor: '#ffffff',
        customFonts: [],
        selectedFontFamily: 'Plus Jakarta Sans, sans-serif',
      };

      await saveProject(proj);
      seeded.push(proj);
    }

    return seeded;
  } catch (err) {
    console.error('Error seeding initial projects', err);
    return [];
  }
}

/**
 * Export a project as a downloadable .pentix JSON file
 */
export function exportProjectFile(project: StoredProject): void {
  const data = JSON.stringify(project, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'project'}.pentix`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a project from a .pentix or .json file
 */
export function importProjectFromFile(file: File): Promise<StoredProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.layers || !Array.isArray(parsed.layers)) {
          throw new Error('Invalid project format: missing layers');
        }

        const now = Date.now();
        const importedProject: StoredProject = {
          id: `imported-${now}-${Math.random().toString(36).substring(2, 6)}`,
          name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
          description: parsed.description || 'Imported project',
          createdAt: now,
          updatedAt: now,
          layers: parsed.layers,
          guides: Array.isArray(parsed.guides) ? parsed.guides : [],
          view: parsed.view,
          thumbnailSvg: generateProjectThumbnailSvg(parsed.layers),
          pathsCount: parsed.layers.reduce((sum: number, l: Layer) => sum + (l.paths?.length || 0), 0),
          layersCount: parsed.layers.length,
          artboardColor: '#ffffff',
          customFonts: [],
          selectedFontFamily: 'Plus Jakarta Sans, sans-serif',
        };

        await saveProject(importedProject);
        resolve(importedProject);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Human readable relative time format
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Recently';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
