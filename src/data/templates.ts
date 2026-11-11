import { AnchorPoint, GradientDef, Layer, Point, VectorPath } from '../types/vector';

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

/* ------------------------------------------------------------------------ *
 * Premium finish
 *
 * Every mark ships with the finish a client would actually be shown: a
 * gradient body, a rounded bevel, a lit glossy front face, a soft ground
 * shadow and a shallow extrusion for depth. All of it stays live, so the
 * sliders in the 3D panel keep working on a template instead of baking a
 * picture of one.
 * ------------------------------------------------------------------------ */

const gradient = (stops: Array<[number, string]>, angle = 118): GradientDef => ({
  type: 'linear',
  angle,
  stops: stops.map(([offset, color]) => ({ offset, color, opacity: 1 })),
});

const FINISH = {
  extrudeDepth: 16,
  extrudeAngle: 45,
  extrudeTaper: 0.08,
  extrudeTurn: -12,
  extrudePerspective: 0.25,
  extrudeBevel: 5,
  extrudeBevelStyle: 'round' as const,
  extrudeLight: 118,
  extrudeGloss: 0.62,
  extrudeShadow: true,
  extrudeShadowSoft: 1.35,
  extrudeShadowLift: 1,
};

interface MarkOptions {
  stops: Array<[number, string]>;
  angle?: number;
  holes?: AnchorPoint[][];
  /** Depth of the extrusion; 0 keeps the mark flat with just the gloss. */
  depth?: number;
  name: string;
}

const mark = (id: string, points: AnchorPoint[], options: MarkOptions): VectorPath => ({
  id,
  name: options.name,
  points,
  ...(options.holes?.length ? { holes: options.holes } : {}),
  closed: true,
  fillRule: 'nonzero',
  fill: options.stops[0][1],
  fillOpacity: 1,
  fillGradient: gradient(options.stops, options.angle ?? 118),
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
  ...(options.depth === 0
    ? { extrudeDepth: 0 }
    : { ...FINISH, extrudeDepth: options.depth ?? FINISH.extrudeDepth }),
});

/** Corner and edge helpers — handles are absolute points, like the editor's. */
const corner = (id: string, x: number, y: number, handleIn?: Point, handleOut?: Point): AnchorPoint => ({
  id,
  x,
  y,
  type: handleIn || handleOut ? 'smooth' : 'corner',
  ...(handleIn ? { handleIn } : {}),
  ...(handleOut ? { handleOut } : {}),
});

const KAPPA = 0.5522847498;

/** A rounded rectangle as eight nodes, so every arc stays a real curve. */
const roundedRect = (id: string, x: number, y: number, w: number, h: number, r: number): AnchorPoint[] => {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const k = radius * KAPPA;
  const right = x + w;
  const bottom = y + h;
  return [
    corner(`${id}-0`, x + radius, y, { x: x + radius - k, y }),
    corner(`${id}-1`, right - radius, y, undefined, { x: right - radius + k, y }),
    corner(`${id}-2`, right, y + radius, { x: right, y: y + radius - k }),
    corner(`${id}-3`, right, bottom - radius, undefined, { x: right, y: bottom - radius + k }),
    corner(`${id}-4`, right - radius, bottom, { x: right - radius + k, y: bottom }),
    corner(`${id}-5`, x + radius, bottom, undefined, { x: x + radius - k, y: bottom }),
    corner(`${id}-6`, x, bottom - radius, { x, y: bottom - radius + k }),
    corner(`${id}-7`, x, y + radius, undefined, { x, y: y + radius - k }),
  ];
};

const circle = (id: string, cx: number, cy: number, r: number, reverse = false): AnchorPoint[] => {
  const k = r * KAPPA;
  const points = [
    corner(`${id}-0`, cx + r, cy, { x: cx + r, y: cy - k }, { x: cx + r, y: cy + k }),
    corner(`${id}-1`, cx, cy + r, { x: cx + k, y: cy + r }, { x: cx - k, y: cy + r }),
    corner(`${id}-2`, cx - r, cy, { x: cx - r, y: cy + k }, { x: cx - r, y: cy - k }),
    corner(`${id}-3`, cx, cy - r, { x: cx - k, y: cy - r }, { x: cx + k, y: cy - r }),
  ];
  return reverse ? reverseRing(points) : points;
};

/** Counter-clockwise copy, so a counter reads as a hole under nonzero fill. */
const reverseRing = (points: AnchorPoint[]): AnchorPoint[] =>
  [...points].reverse().map((point) => ({
    ...point,
    handleIn: point.handleOut,
    handleOut: point.handleIn,
  }));

const polygon = (id: string, coords: Array<[number, number]>, reverse = false): AnchorPoint[] => {
  const points = coords.map(([x, y], index) => corner(`${id}-${index}`, x, y));
  return reverse ? reverseRing(points) : points;
};

/** Nudges a shape's ids so two marks in one document never collide. */
const reid = (path: VectorPath, suffix: string): VectorPath => ({
  ...path,
  id: `${path.id}-${suffix}`,
  points: path.points.map((point, index) => ({ ...point, id: `${point.id}-${suffix}-${index}` })),
  ...(path.holes
    ? {
        holes: path.holes.map((hole, holeIndex) =>
          hole.map((point, index) => ({ ...point, id: `${point.id}-${suffix}-${holeIndex}-${index}` }))
        ),
      }
    : {}),
});

const layer = (id: string, name: string, paths: VectorPath[]): Layer => ({
  id,
  name,
  visible: true,
  locked: false,
  opacity: 1,
  paths,
});

/* --------------------------- Construction grids -------------------------- */
/* Kept beside the marks: a grid is scaffolding, not a logo, and it still
   answers “I want to build this from scratch with guides”.                */

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

const guideCircle = (
  id: string,
  cx: number,
  cy: number,
  r: number,
  color = GUIDE,
  width = 1,
  opacity = 0.4
): VectorPath => ({
  id,
  name: id,
  points: circle(id, cx, cy, r),
  closed: true,
  fill: 'none',
  fillOpacity: 1,
  stroke: color,
  strokeWidth: width,
  strokeOpacity: opacity,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
});

const goldenGrid = (): VectorPath[] => {
  const c = SIZE / 2;
  const paths: VectorPath[] = [];
  [240, 148, 91, 56, 35].forEach((r, i) =>
    paths.push(guideCircle(`golden-ring-${i}`, c, c, r, GUIDE, 1, i === 0 ? 0.5 : 0.32))
  );
  [0.382, 0.618].forEach((f, i) => {
    const p = SIZE * f;
    paths.push(line(`golden-v-${i}`, p, 0, p, SIZE, GUIDE, 1, 0.38));
    paths.push(line(`golden-h-${i}`, 0, p, SIZE, p, GUIDE, 1, 0.38));
  });
  paths.push(line('golden-axis-v', c, 0, c, SIZE, AXIS, 1, 0.3));
  paths.push(line('golden-axis-h', 0, c, SIZE, c, AXIS, 1, 0.3));
  return paths;
};

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
    paths.push(line(`modular-v-${i}`, p, 0, p, SIZE, GUIDE, 1, major ? 0.45 : 0.28));
    paths.push(line(`modular-h-${i}`, 0, p, SIZE, p, GUIDE, 1, major ? 0.45 : 0.28));
  }
  return paths;
};

const radialGrid = (): VectorPath[] => {
  const c = SIZE / 2;
  const paths: VectorPath[] = [];
  [72, 145, 217, 290].forEach((r, i) =>
    paths.push(guideCircle(`radial-ring-${i}`, c, c, r, GUIDE, 1, i === 3 ? 0.45 : 0.3))
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const cardinal = i % 3 === 0;
    paths.push(
      line(
        `radial-spoke-${i}`,
        c,
        c,
        c + Math.cos(a) * 290,
        c + Math.sin(a) * 290,
        cardinal ? AXIS : GUIDE,
        1,
        cardinal ? 0.3 : 0.28
      )
    );
  }
  return paths;
};

const diagonalGrid = (step: number): VectorPath[] => {
  const paths: VectorPath[] = [];
  let index = 0;
  for (let offset = -SIZE + step; offset < SIZE; offset += step) {
    const startX = Math.max(0, offset);
    const startY = Math.max(0, -offset);
    const endX = Math.min(SIZE, SIZE + offset);
    const endY = Math.min(SIZE, SIZE - offset);
    paths.push(line(`diag-a-${index}`, startX, startY, endX, endY, GUIDE, 1, 0.26));
    paths.push(
      line(
        `diag-b-${index}`,
        startX,
        SIZE - startY,
        Math.min(SIZE, SIZE - offset),
        SIZE - Math.min(SIZE, SIZE + offset),
        GUIDE,
        1,
        0.26
      )
    );
    index++;
  }
  paths.push(line('diag-axis-v', SIZE / 2, 0, SIZE / 2, SIZE, AXIS, 1, 0.28));
  paths.push(line('diag-axis-h', 0, SIZE / 2, SIZE, SIZE / 2, AXIS, 1, 0.28));
  return paths;
};

/* ---------------------------------- Marks -------------------------------- */

const IRIS: Array<[number, string]> = [
  [0, '#6EA8FF'],
  [0.52, '#5B7CFF'],
  [1, '#8B5CF6'],
];
const MINT: Array<[number, string]> = [
  [0, '#5BF3C7'],
  [1, '#2AA8FF'],
];
const EMBER: Array<[number, string]> = [
  [0, '#FFC15E'],
  [1, '#FF6B6B'],
];
const ICE: Array<[number, string]> = [
  [0, '#E9EFF7'],
  [1, '#9FB6D4'],
];

/** A twelve-vertex cross, which reads as an x once it is turned 45°. */
const crossed = (
  id: string,
  cx: number,
  cy: number,
  half: number,
  width: number,
  angle: number
): AnchorPoint[] => {
  const outline: Array<[number, number]> = [
    [width, -width],
    [width, -half],
    [half, -width],
    [half, width],
    [width, width],
    [width, half],
    [-width, half],
    [-width, width],
    [-half, width],
    [-half, -width],
    [-width, -width],
    [-width, -half],
  ];
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return outline.map(([x, y], index) =>
    corner(`${id}-${index}`, cx + x * cos - y * sin, cy + x * sin + y * cos)
  );
};

/**
 * The studio monogram: a geometric Px. The P keeps its counter as a real hole
 * and the x is one closed cross, so the pair stays two editable objects — and
 * reads as Pentix rather than as a lone P.
 */
const pentixMark = (): VectorPath[] => {
  // Outer ring runs clockwise: top edge, around the bowl, down the stem, back up.
  const outer: AnchorPoint[] = [
    corner('p-0', 150, 156),
    corner('p-1', 288, 156, undefined, { x: 356, y: 156 }),
    corner('p-2', 384, 252, { x: 384, y: 200 }, { x: 384, y: 304 }),
    corner('p-3', 288, 348, { x: 356, y: 348 }),
    corner('p-4', 216, 348),
    corner('p-5', 216, 444),
    corner('p-6', 150, 444),
  ];
  // Counter runs the other way, so nonzero leaves the bowl hollow.
  const counter: AnchorPoint[] = [
    corner('p-h0', 216, 296),
    corner('p-h1', 288, 296, undefined, { x: 306, y: 296 }),
    corner('p-h2', 326, 252, { x: 326, y: 276 }, { x: 326, y: 228 }),
    corner('p-h3', 288, 208, { x: 306, y: 208 }),
    corner('p-h4', 216, 208),
  ];
  return [
    mark('mark-pentix', outer, { stops: IRIS, name: 'Pentix P', holes: [counter] }),
    reid(
      mark('mark-pentix-x', crossed('pentix-x', 492, 354, 92, 32, 45), {
        stops: IRIS,
        name: 'Pentix x',
        angle: 100,
      }),
      'x'
    ),
  ];
};

/** Orbit: a shaded ring and a bead, the classic “platform” mark. */
const orbitMark = (): VectorPath[] => [
  mark('mark-orbit-ring', circle('orbit-outer', 300, 300, 150), {
    stops: IRIS,
    name: 'Orbit ring',
    holes: [circle('orbit-inner', 300, 300, 78, true)],
  }),
  reid(
    mark('mark-orbit-bead', circle('bead', 404, 196, 40), {
      stops: MINT,
      name: 'Orbit bead',
      depth: 10,
      angle: 70,
    }),
    'orbit'
  ),
];

/** Prism: a triangular solid with a triangular window, lit from the top left. */
const prismMark = (): VectorPath[] => [
  mark(
    'mark-prism',
    polygon('prism-outer', [
      [300, 128],
      [470, 408],
      [130, 408],
    ]),
    {
      name: 'Prism body',
      stops: MINT,
      angle: 100,
      holes: [
        polygon(
          'prism-hole',
          [
            [300, 232],
            [374, 362],
            [226, 362],
          ],
          true
        ),
      ],
    }
  ),
];

/** Stack: three offset plates, each with its own gradient for facet interest. */
const stackMark = (): VectorPath[] => {
  const plates: Array<[number, number, number, Array<[number, string]>]> = [
    [96, 208, 0.42, ICE],
    [146, 268, 0.7, IRIS],
    [196, 328, 1, IRIS],
  ];
  return plates.map(([x, y, opacity, stops], index) => ({
    ...mark(
      `mark-stack-${index}`,
      roundedRect(`stack-${index}`, x, y, 238, 190, 46),
      { stops, name: `Stack plate ${index + 1}`, depth: 12, angle: 110 }
    ),
    fillOpacity: opacity,
    extrudeDepth: 12,
  }));
};

/** Pulse: four rounded bars on a shared baseline, the “analytics” mark. */
const pulseMark = (): VectorPath[] =>
  [
    [168, 268, 44, 190, 0.55],
    [250, 168, 44, 290, 0.75],
    [332, 216, 44, 242, 0.9],
    [414, 132, 44, 326, 1],
  ].map(([x, y, w, h, alpha], index) => ({
    ...mark(`mark-pulse-${index}`, roundedRect(`pulse-${index}`, x, y, w, h, 22), {
      stops: EMBER,
      name: `Pulse bar ${index + 1}`,
      depth: 10,
      angle: 95,
    }),
    fillOpacity: alpha,
  }));

/** Apex: a chevron with a cut-through channel, sharp and forward-leaning. */
const apexMark = (): VectorPath[] => [
  mark(
    'mark-apex',
    polygon('apex-outer', [
      [300, 118],
      [488, 372],
      [386, 372],
      [300, 254],
      [214, 372],
      [112, 372],
    ]),
    { stops: EMBER, name: 'Apex chevron', angle: 100, depth: 18 }
  ),
  reid(
    mark(
      'mark-apex-bar',
      roundedRect('apex-bar', 214, 404, 172, 42, 21),
      { stops: EMBER, name: 'Apex underline', depth: 8 }
    ),
    'apex'
  ),
];

/**
 * Finished marks first — a client-ready starting point with the premium finish
 * already applied — then the construction grids for anyone building from
 * scratch.
 */
export const LOGO_TEMPLATES: LogoTemplate[] = [
  {
    id: 'pentix-monogram',
    name: 'Pentix Px',
    description: 'Px monogram: a hollow P and a crossed x, with a glossy bevel.',
    category: 'Monogram',
    layers: [layer('layer-pentix', 'Monogram', pentixMark())],
  },
  {
    id: 'orbit',
    name: 'Orbit',
    description: 'Shaded ring with a floating bead. Reads at 16 px.',
    category: 'Geometric',
    layers: [
      layer('layer-orbit', 'Orbit', orbitMark()),
      layer('layer-orbit-bead', 'Bead', []),
    ],
  },
  {
    id: 'prism',
    name: 'Prism',
    description: 'Triangular solid with a cut window and a cool mint gradient.',
    category: 'Geometric',
    layers: [layer('layer-prism', 'Prism', prismMark())],
  },
  {
    id: 'stack',
    name: 'Stack',
    description: 'Three offset plates with a glass-to-iris gradient ramp.',
    category: 'Abstract',
    layers: [layer('layer-stack', 'Plates', stackMark())],
  },
  {
    id: 'pulse',
    name: 'Pulse',
    description: 'Four rounded bars on a shared baseline, in an ember finish.',
    category: 'Minimalist',
    layers: [layer('layer-pulse', 'Bars', pulseMark())],
  },
  {
    id: 'apex',
    name: 'Apex',
    description: 'Forward chevron with an underline, finished in warm ember.',
    category: 'Abstract',
    layers: [layer('layer-apex', 'Chevron', apexMark())],
  },
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
