import {
  AnchorPoint,
  CanvasView,
  Guide,
  Layer,
  ReferenceImage,
  VectorPath,
} from '../types/vector';
import { LOGO_TEMPLATES } from '../data/templates';
import { sanitizeClipReferences } from './clipping';
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

/** A named colour saved with the document */
export interface StoredSwatch {
  id: string;
  name: string;
  color: string;
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
  /** Named colours saved for this document */
  swatches?: StoredSwatch[];
}

const DB_NAME = 'pentix_vector_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      dbPromise = null;
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
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
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

const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function sanitizeHandle(value: unknown): { x: number; y: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const handle = value as { x?: unknown; y?: unknown };
  if (!Number.isFinite(handle.x) || !Number.isFinite(handle.y)) return undefined;
  return { x: Number(handle.x), y: Number(handle.y) };
}

function sanitizePoint(value: unknown, id: string): AnchorPoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<AnchorPoint>;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
  const allowed = ['corner', 'smooth', 'symmetric', 'broken'] as const;
  const type = allowed.includes(raw.type as (typeof allowed)[number])
    ? (raw.type as AnchorPoint['type'])
    : 'corner';
  return {
    id,
    x: Number(raw.x),
    y: Number(raw.y),
    type,
    ...(sanitizeHandle(raw.handleIn) ? { handleIn: sanitizeHandle(raw.handleIn) } : {}),
    ...(sanitizeHandle(raw.handleOut) ? { handleOut: sanitizeHandle(raw.handleOut) } : {}),
    ...(Number.isFinite(raw.pressure) ? { pressure: clamp(Number(raw.pressure), 0, 1) } : {}),
  };
}

function sanitizeLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) throw new Error('Invalid project format: missing layers');
  const usedIds = new Set<string>();
  const layers: Layer[] = [];

  value.slice(0, 80).forEach((rawLayer, layerIndex) => {
    if (!rawLayer || typeof rawLayer !== 'object') return;
    const raw = rawLayer as Partial<Layer>;
    const paths: VectorPath[] = [];
    const rawPaths = Array.isArray(raw.paths) ? raw.paths.slice(0, 5000) : [];

    rawPaths.forEach((rawPath, pathIndex) => {
      if (!rawPath || typeof rawPath !== 'object') return;
      const path = rawPath as Partial<VectorPath>;
      let pathId =
        typeof path.id === 'string' && path.id ? path.id.slice(0, 120) : `path-import-${layerIndex}-${pathIndex}`;
      while (usedIds.has(pathId)) pathId = `${pathId}-${pathIndex}`;
      usedIds.add(pathId);

      const points = (Array.isArray(path.points) ? path.points : [])
        .slice(0, 10000)
        .map((point, pointIndex) => sanitizePoint(point, `${pathId}-pt-${pointIndex}`))
        .filter((point): point is AnchorPoint => !!point);
      const text = typeof path.text === 'string' ? path.text.slice(0, 2000) : undefined;
      if (!points.length && !text) return;
      if (!points.length) points.push({ id: `${pathId}-pt-0`, x: 0, y: 0, type: 'corner' });

      const holes = Array.isArray(path.holes)
        ? path.holes
            .slice(0, 200)
            .map((hole, holeIndex) =>
              (Array.isArray(hole) ? hole : [])
                .slice(0, 10000)
                .map((point, pointIndex) =>
                  sanitizePoint(point, `${pathId}-h${holeIndex}-${pointIndex}`)
                )
                .filter((point): point is AnchorPoint => !!point)
            )
            .filter((hole) => hole.length > 2)
        : undefined;

      paths.push({
        ...path,
        id: pathId,
        name: typeof path.name === 'string' ? path.name.slice(0, 100) : `Object ${pathIndex + 1}`,
        points,
        ...(holes?.length ? { holes } : { holes: undefined }),
        closed: path.closed === true,
        fill: typeof path.fill === 'string' ? path.fill : 'none',
        fillOpacity: clamp(finite(path.fillOpacity, 1), 0, 1),
        stroke: typeof path.stroke === 'string' ? path.stroke : 'none',
        strokeWidth: clamp(finite(path.strokeWidth, 0), 0, 200),
        strokeOpacity: clamp(finite(path.strokeOpacity, 1), 0, 1),
        strokeCap: path.strokeCap === 'square' || path.strokeCap === 'butt' ? path.strokeCap : 'round',
        strokeJoin: path.strokeJoin === 'miter' || path.strokeJoin === 'bevel' ? path.strokeJoin : 'round',
        pressureProfile: path.pressureProfile === 'dynamic-touch' ? path.pressureProfile : 'uniform',
        text,
        ...(path.fillGradient && Array.isArray(path.fillGradient.stops)
          ? { fillGradient: path.fillGradient }
          : {}),
      } as VectorPath);
    });

    let layerId = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 120) : `layer-import-${layerIndex}`;
    while (usedIds.has(layerId)) layerId = `${layerId}-${layerIndex}`;
    usedIds.add(layerId);
    layers.push({
      id: layerId,
      name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : `Layer ${layerIndex + 1}`,
      visible: raw.visible !== false,
      locked: raw.locked === true,
      opacity: clamp(finite(raw.opacity, 1), 0, 1),
      paths,
    });
  });

  if (!layers.length) throw new Error('Invalid project format: no valid layers');
  return sanitizeClipReferences(layers);
}

function sanitizeView(value: unknown): CanvasView | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<CanvasView>;
  if (!Number.isFinite(raw.width) || !Number.isFinite(raw.height)) return undefined;
  return {
    width: clamp(Number(raw.width), 16, 20000),
    height: clamp(Number(raw.height), 16, 20000),
    zoom: clamp(finite(raw.zoom, 1), 0.04, 8),
    panX: finite(raw.panX, 0),
    panY: finite(raw.panY, 0),
  };
}

function sanitizeBackupGrid(value: unknown): GridSettings | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const grid = value as Record<string, unknown>;
  return {
    visible: grid.visible !== false,
    snap: grid.snap === true,
    spacingX: clamp(finite(grid.spacingX, 25), 1, 500),
    spacingY: clamp(finite(grid.spacingY, 25), 1, 500),
    opacity: clamp(finite(grid.opacity, 0.4), 0.05, 1),
    locked: grid.locked === true,
  };
}

/** Validate one project record read from a full backup before it is written. */
export function sanitizeBackupProject(value: unknown): StoredProject {
  if (!value || typeof value !== 'object') {
    throw new Error('The backup contains an invalid project.');
  }
  const raw = value as Record<string, unknown>;
  const layers = sanitizeLayers(raw.layers);
  const now = Date.now();
  const view = sanitizeView(raw.view);
  const artboardColor =
    typeof raw.artboardColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.artboardColor)
      ? raw.artboardColor
      : '#ffffff';

  const references = Array.isArray(raw.references)
    ? (raw.references as ReferenceImage[])
        .filter(
          (ref) =>
            !!ref &&
            typeof ref === 'object' &&
            typeof (ref as { url?: unknown }).url === 'string'
        )
        .slice(0, 50)
    : [];

  const swatches = Array.isArray(raw.swatches)
    ? (raw.swatches as unknown[])
        .filter((swatch): swatch is StoredSwatch => {
          if (!swatch || typeof swatch !== 'object') return false;
          const item = swatch as Partial<StoredSwatch>;
          return (
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.color === 'string'
          );
        })
        .slice(0, 100)
    : [];

  return {
    id:
      typeof raw.id === 'string' && raw.id
        ? raw.id.slice(0, 120)
        : `restored-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : 'Restored document',
    ...(typeof raw.description === 'string'
      ? { description: raw.description.slice(0, 240) }
      : {}),
    createdAt: finite(raw.createdAt, now),
    updatedAt: finite(raw.updatedAt, now),
    layers,
    guides: Array.isArray(raw.guides) ? (raw.guides as Guide[]).slice(0, 200) : [],
    grid: sanitizeBackupGrid(raw.grid),
    guidesLocked: typeof raw.guidesLocked === 'boolean' ? raw.guidesLocked : undefined,
    references,
    view,
    thumbnailSvg: generateProjectThumbnailSvg(layers, view?.width, view?.height, artboardColor),
    pathsCount: layers.reduce((sum, layer) => sum + layer.paths.length, 0),
    layersCount: layers.length,
    artboardColor,
    customFonts: Array.isArray(raw.customFonts)
      ? (raw.customFonts as unknown[])
          .filter((font): font is string => typeof font === 'string')
          .slice(0, 100)
      : [],
    selectedFontFamily:
      typeof raw.selectedFontFamily === 'string'
        ? raw.selectedFontFamily.slice(0, 160)
        : 'Plus Jakarta Sans, sans-serif',
    swatches,
  };
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

        const layers = sanitizeLayers(parsed.layers);

        const now = Date.now();
        const importedProject: StoredProject = {
          id: `imported-${now}-${Math.random().toString(36).substring(2, 6)}`,
          name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
          description: parsed.description || 'Imported project',
          createdAt: now,
          updatedAt: now,
          layers,
          guides: Array.isArray(parsed.guides) ? parsed.guides : [],
          grid: parsed.grid && typeof parsed.grid === 'object' ? parsed.grid : undefined,
          guidesLocked: typeof parsed.guidesLocked === 'boolean' ? parsed.guidesLocked : undefined,
          references: Array.isArray(parsed.references)
            ? parsed.references.filter(
                (ref: unknown) =>
                  !!ref &&
                  typeof ref === 'object' &&
                  typeof (ref as { url?: unknown }).url === 'string'
              )
            : [],
          view: sanitizeView(parsed.view),
          thumbnailSvg: generateProjectThumbnailSvg(layers),
          pathsCount: layers.reduce((sum, layer) => sum + layer.paths.length, 0),
          layersCount: layers.length,
          artboardColor:
            typeof parsed.artboardColor === 'string' ? parsed.artboardColor : '#ffffff',
          customFonts: Array.isArray(parsed.customFonts)
            ? parsed.customFonts.filter((font: unknown) => typeof font === 'string')
            : [],
          selectedFontFamily:
            typeof parsed.selectedFontFamily === 'string'
              ? parsed.selectedFontFamily
              : 'Plus Jakarta Sans, sans-serif',
          swatches: Array.isArray(parsed.swatches) ? parsed.swatches : [],
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
