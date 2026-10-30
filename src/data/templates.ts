import { Layer, VectorPath } from '../types/vector';

export interface LogoTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Geometric' | 'Monogram' | 'Abstract' | 'Golden Ratio' | 'Minimalist';
  layers: Layer[];
}

const SIZE = 600;
/** Guide ink — quiet enough to draw over */
const GUIDE = '#8a919b';
/** Accent used only for the primary axes */
const AXIS = '#4c8dff';

const line = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = GUIDE,
  width = 1,
  opacity = 0.4
): VectorPath => ({
  id,
  name: id,
  points: [
    { id: `${id}-0`, x: x1, y: y1, type: 'corner' },
    { id: `${id}-1`, x: x2, y: y2, type: 'corner' },
  ],
  closed: false,
  fill: 'none',
  fillOpacity: 1,
  stroke: color,
  strokeWidth: width,
  strokeOpacity: opacity,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
});

const circle = (
  id: string,
  cx: number,
  cy: number,
  r: number,
  color = GUIDE,
  width = 1,
  opacity = 0.4
): VectorPath => {
  const k = 0.5522847498 * r;
  return {
    id,
    name: id,
    points: [
      {
        id: `${id}-0`,
        x: cx + r,
        y: cy,
        type: 'smooth',
        handleIn: { x: cx + r, y: cy - k },
        handleOut: { x: cx + r, y: cy + k },
      },
      {
        id: `${id}-1`,
        x: cx,
        y: cy + r,
        type: 'smooth',
        handleIn: { x: cx + k, y: cy + r },
        handleOut: { x: cx - k, y: cy + r },
      },
      {
        id: `${id}-2`,
        x: cx - r,
        y: cy,
        type: 'smooth',
        handleIn: { x: cx - r, y: cy + k },
        handleOut: { x: cx - r, y: cy - k },
      },
      {
        id: `${id}-3`,
        x: cx,
        y: cy - r,
        type: 'smooth',
        handleIn: { x: cx - k, y: cy - r },
        handleOut: { x: cx + k, y: cy - r },
      },
    ],
    closed: true,
    fill: 'none',
    fillOpacity: 1,
    stroke: color,
    strokeWidth: width,
    strokeOpacity: opacity,
    strokeCap: 'round',
    strokeJoin: 'round',
    pressureProfile: 'uniform',
  };
};

const layer = (id: string, name: string, paths: VectorPath[]): Layer => ({
  id,
  name,
  visible: true,
  locked: false,
  opacity: 1,
  paths,
});

/* ----------------------------- Golden ratio ----------------------------- */
const goldenGrid = (): VectorPath[] => {
  const c = SIZE / 2;
  const paths: VectorPath[] = [];

  [240, 148, 91, 56, 35].forEach((r, i) =>
    paths.push(circle(`golden-ring-${i}`, c, c, r, GUIDE, 1, i === 0 ? 0.5 : 0.32))
  );

  // Golden-section divisions of the square
  [0.382, 0.618].forEach((f, i) => {
    const p = SIZE * f;
    paths.push(line(`golden-v-${i}`, p, 0, p, SIZE, GUIDE, 1, 0.38));
    paths.push(line(`golden-h-${i}`, 0, p, SIZE, p, GUIDE, 1, 0.38));
  });

  paths.push(line('golden-axis-v', c, 0, c, SIZE, AXIS, 1, 0.3));
  paths.push(line('golden-axis-h', 0, c, SIZE, c, AXIS, 1, 0.3));

  return paths;
};

/* ------------------------------- Modular -------------------------------- */
const modularGrid = (columns: number): VectorPath[] => {
  const paths: VectorPath[] = [];
  const step = SIZE / columns;
  const centre = SIZE / 2;

  for (let i = 0; i <= columns; i++) {
    const p = i * step;
    if (Math.abs(p - centre) < 0.001) {
      paths.push(line(`modular-v-${i}`, p, 0, p, SIZE, AXIS, 1, 0.32));
      paths.push(line(`modular-h-${i}`, 0, p, SIZE, p, AXIS, 1, 0.32));
      continue;
    }
    const major = Math.abs(p - SIZE / 3) < 0.001 || Math.abs(p - (SIZE * 2) / 3) < 0.001;
    const opacity = major ? 0.45 : 0.28;
    paths.push(line(`modular-v-${i}`, p, 0, p, SIZE, GUIDE, 1, opacity));
    paths.push(line(`modular-h-${i}`, 0, p, SIZE, p, GUIDE, 1, opacity));
  }

  return paths;
};

/* -------------------------------- Radial -------------------------------- */
const radialGrid = (): VectorPath[] => {
  const c = SIZE / 2;
  const paths: VectorPath[] = [];

  [72, 145, 217, 290].forEach((r, i) =>
    paths.push(circle(`radial-ring-${i}`, c, c, r, GUIDE, 1, i === 3 ? 0.45 : 0.3))
  );

  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const r = 290;
    const cardinal = i % 3 === 0;
    paths.push(
      line(
        `radial-spoke-${i}`,
        c,
        c,
        c + Math.cos(a) * r,
        c + Math.sin(a) * r,
        cardinal ? AXIS : GUIDE,
        1,
        cardinal ? 0.3 : 0.28
      )
    );
  }

  return paths;
};

/* ------------------------------- Diagonal ------------------------------- */
const diagonalGrid = (step: number): VectorPath[] => {
  const paths: VectorPath[] = [];
  let index = 0;

  // Lines of x - y = offset, then x + y = offset, both clipped to the square
  for (let offset = -SIZE + step; offset < SIZE; offset += step) {
    const startX = Math.max(0, offset);
    const startY = Math.max(0, -offset);
    const endX = Math.min(SIZE, SIZE + offset);
    const endY = Math.min(SIZE, SIZE - offset);
    paths.push(line(`diag-a-${index}`, startX, startY, endX, endY, GUIDE, 1, 0.26));

    const mirrorEndX = Math.min(SIZE, SIZE - offset);
    const mirrorEndY = Math.min(SIZE, SIZE + offset);
    paths.push(line(`diag-b-${index}`, startX, SIZE - startY, mirrorEndX, SIZE - mirrorEndY, GUIDE, 1, 0.26));
    index++;
  }

  paths.push(line('diag-axis-v', SIZE / 2, 0, SIZE / 2, SIZE, AXIS, 1, 0.28));
  paths.push(line('diag-axis-h', 0, SIZE / 2, SIZE, SIZE / 2, AXIS, 1, 0.28));

  return paths;
};

/**
 * Construction grids rather than finished artwork: thin stroke-only scaffolding
 * that sits behind the mark while you build it, and can be hidden or deleted
 * once the geometry is in place.
 */
export const LOGO_TEMPLATES: LogoTemplate[] = [
  {
    id: 'golden-ratio-grid',
    name: 'Golden Ratio Grid',
    description: 'Nested circles and golden-section divisions for balanced marks.',
    category: 'Golden Ratio',
    layers: [layer('layer-golden', 'Golden Ratio Guides', goldenGrid())],
  },
  {
    id: 'modular-grid',
    name: 'Modular Grid',
    description: 'Six-column modular grid for repeatable, consistent geometry.',
    category: 'Geometric',
    layers: [layer('layer-modular', 'Modular Guides', modularGrid(6))],
  },
  {
    id: 'radial-grid',
    name: 'Radial Grid',
    description: 'Twelve spokes and four rings for circular and rotational marks.',
    category: 'Geometric',
    layers: [layer('layer-radial', 'Radial Guides', radialGrid())],
  },
  {
    id: 'diagonal-grid',
    name: 'Diagonal Grid',
    description: 'A diamond lattice for angled, dynamic constructions.',
    category: 'Abstract',
    layers: [layer('layer-diagonal', 'Diagonal Guides', diagonalGrid(75))],
  },
];
