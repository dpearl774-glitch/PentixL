/**
 * Captures the 16 screens used by the manual at phone size.
 *
 * Each state is seeded as a normal Pentix document in IndexedDB, so the shots
 * are reproducible and do not depend on the order a person happened to tap.
 * The PNGs land in artifacts/tutorial; make-manual-html.cjs turns them into
 * the WebP files shipped beside the page.
 *
 * Run: npx tsx tools/capture-manual.ts [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnchorPoint, Layer, VectorPath } from '../src/types/vector';
import { LOGO_TEMPLATES } from '../src/data/templates';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts', 'tutorial');
const BASE = process.argv[2] || 'http://127.0.0.1:3107/';
const VIEWPORT = { width: 390, height: 844 };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const KAPPA = 0.5522847498;

const point = (
  id: string,
  x: number,
  y: number,
  handleIn?: { x: number; y: number },
  handleOut?: { x: number; y: number }
): AnchorPoint => ({
  id,
  x,
  y,
  type: handleIn || handleOut ? 'smooth' : 'corner',
  ...(handleIn ? { handleIn } : {}),
  ...(handleOut ? { handleOut } : {}),
});

const circle = (id: string, cx: number, cy: number, r: number): AnchorPoint[] => {
  const k = r * KAPPA;
  return [
    point(`${id}-0`, cx + r, cy, { x: cx + r, y: cy - k }, { x: cx + r, y: cy + k }),
    point(`${id}-1`, cx, cy + r, { x: cx + k, y: cy + r }, { x: cx - k, y: cy + r }),
    point(`${id}-2`, cx - r, cy, { x: cx - r, y: cy + k }, { x: cx - r, y: cy - k }),
    point(`${id}-3`, cx, cy - r, { x: cx - k, y: cy - r }, { x: cx + k, y: cy - r }),
  ];
};

const rect = (id: string, x: number, y: number, w: number, h: number): AnchorPoint[] => [
  point(`${id}-0`, x, y),
  point(`${id}-1`, x + w, y),
  point(`${id}-2`, x + w, y + h),
  point(`${id}-3`, x, y + h),
];

const shape = (
  id: string,
  name: string,
  points: AnchorPoint[],
  fill: string,
  stroke = 'none',
  strokeWidth = 0
): VectorPath => ({
  id,
  name,
  points,
  closed: true,
  fill,
  fillOpacity: 1,
  stroke,
  strokeWidth,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
});

const textPath = (
  id: string,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string
): VectorPath => ({
  id,
  name: text,
  points: [point(`${id}-0`, x, y)],
  closed: false,
  fill,
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
  text,
  fontSize: size,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  letterSpacing: 2,
});

const layer = (id: string, name: string, paths: VectorPath[], isGroup = false): Layer => ({
  id,
  name,
  visible: true,
  locked: false,
  opacity: 1,
  paths,
  ...(isGroup ? { isGroup: true } : {}),
});

const project = (id: string, name: string, layers: Layer[]) => ({
  id,
  name,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  layers,
  guides: [],
  references: [],
  thumbnailSvg: '',
  pathsCount: layers.reduce((n, l) => n + l.paths.length, 0),
  layersCount: layers.length,
  artboardColor: '#f6f4ef',
  customFonts: [],
  selectedFontFamily: 'Plus Jakarta Sans, sans-serif',
  grid: { visible: false, snap: false, spacingX: 25, spacingY: 25, opacity: 0.4, locked: false },
});

const blank = project('manual-blank', 'Untitled', [layer('manual-blank-layer', 'Layer 1', [])]);

const markCircle = shape('manual-circle', 'Circle', circle('manual-circle', 285, 270, 145), '#4c8dff');
const markSquare = shape('manual-square', 'Square', rect('manual-square', 270, 255, 220, 220), '#ffb45e');
const overlap = project('manual-overlap', 'Circle + square', [
  layer('manual-overlap-layer', 'Layer 1', [markCircle, markSquare]),
]);

const grouped = project('manual-grouped', 'Orbit lockup', [
  layer(
    'manual-mark',
    'Logo mark',
    [
      shape('manual-group-circle', 'Circle', circle('manual-group-circle', 260, 240, 132), '#4c8dff'),
      shape(
        'manual-group-square',
        'Square',
        rect('manual-group-square', 282, 258, 190, 190),
        '#ffb45e'
      ),
    ],
    true
  ),
]);

const shapes = project('manual-shapes', 'Circle + square', [
  layer('manual-shapes-layer', 'Layer 1', [
    shape('manual-shapes-circle', 'Circle', circle('manual-shapes-circle', 205, 285, 125), '#4c8dff'),
    shape('manual-shapes-square', 'Square', rect('manual-shapes-square', 345, 175, 190, 190), '#ffb45e'),
  ]),
]);

const single = project('manual-colour', 'Circle', [
  layer('manual-colour-layer', 'Mark', [
    shape('manual-colour-circle', 'Circle', circle('manual-colour-circle', 300, 300, 165), '#4c8dff'),
  ]),
]);

const type = project('manual-text', 'Wordmark', [
  layer('manual-text-layer', 'Type', [
    textPath('manual-text-path', 'PENTIX', 60, 345, 122, '#4c8dff'),
  ]),
]);

const pentixMark = (): Layer[] =>
  JSON.parse(JSON.stringify(LOGO_TEMPLATES[0].layers)) as Layer[];

const hero = project('manual-hero', 'Pentix Px', pentixMark());

const prefs = {
  gridVisible: false,
  gridSnap: false,
  gridSpacingX: 25,
  gridSpacingY: 25,
  gridOpacity: 0.4,
  gridLocked: false,
  rulersVisible: true,
  guidesVisible: true,
  guidesLocked: false,
  smartGuides: true,
  panZoomLocked: false,
  clipArtboard: false,
  showTransforms: true,
  precisionPad: true,
  tool: 'select',
  pencilSmoothing: 'smooth',
  shapeKind: 'rectangle',
  shapeSides: 6,
  sbMode: 'merge',
  groupSelectMode: 'group',
  fillColor: '#4c8dff',
  strokeColor: '#4c8dff',
  fillOpacity: 1,
  strokeOpacity: 1,
  fillType: 'solid',
  strokeWidth: 3,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressure: {
    source: 'stylus-or-touch',
    minWidth: 2,
    maxWidth: 24,
    smoothing: 0.7,
    calligraphyAngle: 30,
  },
  selectedFontFamily: 'Plus Jakarta Sans, sans-serif',
  recentColors: [],
  recentFonts: ['Plus Jakarta Sans, sans-serif'],
  savedGradients: [],
  savedTextStyles: [],
};

const FIRST_RUN = {
  'pentix.onboarded': 'true',
  'pentix.tutorialPrompted': 'true',
  'pentix.tourSeen': 'true',
  'pentix.theme': 'dark',
  'pentix.toolPanels': JSON.stringify({ closed: [], scroll: {} }),
  'pentix.prefs.v1': JSON.stringify(prefs),
};

async function seed(page: import('playwright').Page, doc: ReturnType<typeof project>) {
  await page.evaluate(
    async ({ doc, prefs, firstRun }) => {
      for (const [key, value] of Object.entries(firstRun)) localStorage.setItem(key, value);
      localStorage.setItem('pentix.prefs.v1', JSON.stringify(prefs));
      localStorage.setItem('pentix.lastProjectId', doc.id);
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('pentix_vector_db', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('projects')) {
            const store = db.createObjectStore('projects', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
            store.createIndex('name', 'name', { unique: false });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('projects', 'readwrite');
          tx.objectStore('projects').put(doc);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { doc, prefs: JSON.parse(FIRST_RUN['pentix.prefs.v1']), firstRun: FIRST_RUN }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('main svg.w-full').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(1100);
}

async function artboard(page: import('playwright').Page) {
  const box = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll('main svg g rect')) as SVGRectElement[];
    const el = rects.find(
      (r) => Number(r.getAttribute('width')) === 600 && Number(r.getAttribute('height')) === 600
    );
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  if (!box) throw new Error('artboard not found');
  return {
    ...box,
    at: (x: number, y: number) => ({
      x: box.x + (x / 600) * box.width,
      y: box.y + (y / 600) * box.height,
    }),
  };
}

async function draw(page: import('playwright').Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

/** One pointer-down through every point, so it makes one freehand path. */
async function stroke(page: import('playwright').Page, points: { x: number; y: number }[]) {
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 6 });
  await page.mouse.up();
}

async function openLayers(page: import('playwright').Page) {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Layers and objects' }).click();
  await page.waitForTimeout(450);
}

async function closePanel(page: import('playwright').Page) {
  const close = page.locator('[aria-label="Close panel"]').last();
  if (await close.count()) await close.click();
  await page.waitForTimeout(350);
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // The start sheet is a first-launch state, so it gets its own clean context.
  const fresh = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const welcome = await fresh.newPage();
  await welcome.goto(BASE, { waitUntil: 'domcontentloaded' });
  await welcome.waitForTimeout(1800);
  await welcome.screenshot({
    path: path.join(OUT, '01-welcome.png'),
    animations: 'disabled',
  });
  await fresh.close();

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const shot = async (name: string) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
    console.log('captured', name);
  };

  // 02 — blank shell
  await seed(page, blank);
  await shot('02-blank.png');

  // 03 — pencil, one continuous freehand stroke
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Pencil tool' }).click();
  const blankBox = await artboard(page);
  // A long open arc: the fitted result should read as one smooth curve, which
  // a tight zigzag does not.
  const arc = Array.from({ length: 48 }, (_, index) => {
    const t = 1 - index / 47;
    const angle = (-40 + t * 250) * (Math.PI / 180);
    return blankBox.at(300 + Math.cos(angle) * 155, 300 + Math.sin(angle) * 155);
  });
  await stroke(page, arc);
  await shot('03-pencil.png');

  // 04 — pen, mid-path with the rubber band visible
  await seed(page, blank);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Pen tool' }).click();
  const penBox = await artboard(page);
  for (const [x, y] of [
    [150, 185],
    [205, 375],
    [335, 300],
  ]) {
    const p = penBox.at(x, y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(180);
  }
  const next = penBox.at(470, 180);
  await page.mouse.move(next.x, next.y);
  await page.waitForTimeout(300);
  await shot('04-pen.png');

  // 05 — circle and square as separate objects
  await seed(page, shapes);
  await shot('05-shapes.png');

  // 06 — shape builder with one region collected
  await seed(page, overlap);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Shape builder' }).click();
  const buildBox = await artboard(page);
  // Brush the square's own area: the merge hatch is drawn in the accent blue,
  // which disappears against the blue circle but reads clearly on the orange.
  const squareOnly = buildBox.at(470, 430);
  await page.mouse.click(squareOnly.x, squareOnly.y);
  await page.waitForTimeout(500);
  await shot('06-build.png');

  // 07 — brush across both shapes and let go: one union replaces them.
  // A drag is a real build; a single tapped region would only be the circle's
  // own area, and merging one shape is by definition not a merge.
  await draw(page, buildBox.at(165, 250), buildBox.at(470, 430));
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.mouse.click(buildBox.at(70, 565).x, buildBox.at(70, 565).y);
  await page.waitForTimeout(350);
  await shot('07-merge.png');

  // 08 — erase preview on the square's free corner, caught mid-brush
  await seed(page, overlap);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Shape builder' }).click();
  const eraseBox = await artboard(page);
  await page.getByRole('button', { name: 'Build mode: erase' }).click();
  const squareCorner = eraseBox.at(455, 445);
  await page.mouse.move(squareCorner.x, squareCorner.y);
  await page.mouse.down();
  await page.mouse.move(eraseBox.at(505, 485).x, eraseBox.at(505, 485).y, { steps: 5 });
  await page.waitForTimeout(400);
  await shot('08-erase.png');
  await page.mouse.up();
  await page.waitForTimeout(300);

  // 09 — layers sheet with a group and a wordmark
  await seed(page, grouped);
  await openLayers(page);
  await shot('09-layers.png');
  await closePanel(page);

  // 10 — colour sheet, fill set to none so the red slash is on screen.
  // The row is the reliable way to select on a phone-sized canvas.
  await seed(page, single);
  await openLayers(page);
  await page
    .locator('[data-path-id="manual-colour-circle"]')
    .getByRole('button', { name: 'Circle', exact: true })
    .click();
  await page.waitForTimeout(300);
  await closePanel(page);
  // Colour lives in the Object tab of the options bar once something is selected.
  await page.getByRole('button', { name: 'Object', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Fill colour' }).click();
  await page.waitForTimeout(550);
  await page.locator('button[title="No colour"]').click();
  await page.waitForTimeout(500);
  await shot('10-colour.png');
  await closePanel(page);

  // 11 — the type sheet on a committed wordmark
  await seed(page, type);
  await openLayers(page);
  await page
    .locator('[data-path-id="manual-text-path"] button', { hasText: 'PENTIX' })
    .click();
  await page.waitForTimeout(300);
  await closePanel(page);
  await page.getByRole('button', { name: 'Text', exact: true }).last().click();
  await page.waitForTimeout(450);
  await page
    .locator('[data-tour="strip"]')
    .getByRole('button', { name: 'Text', exact: true })
    .click();
  await page.waitForTimeout(650);
  await shot('11-text.png');
  await closePanel(page);

  // 12 — export sheet. A board-sized mark so the preview is not cropped.
  await seed(page, single);
  await page.getByRole('button', { name: 'Export' }).click();
  await page.waitForTimeout(700);
  await shot('12-export.png');
  await closePanel(page);

  // 13 — the app menu
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(550);
  await shot('13-menu.png');

  // 14 — gestures and shortcuts, from the menu
  await page.getByText('Gestures & shortcuts', { exact: true }).click();
  await page.waitForTimeout(650);
  await shot('14-help.png');
  await closePanel(page);

  // 15 — preview mode, on a finished mark
  await seed(page, hero);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Preview artboard' }).click();
  await page.waitForTimeout(700);
  await shot('15-preview.png');

  // 13b — pathfinder, with two grouped objects selected
  await seed(page, grouped);
  const pfBox = await artboard(page);
  await page.mouse.click(pfBox.at(230, 220).x, pfBox.at(230, 220).y);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Effects', exact: true }).click();
  await page.waitForTimeout(500);
  // The panel's own Path chip jumps to the section; it aligns the heading with
  // the scroll container's top, which the sticky header covers, so nudge back.
  await page.getByRole('button', { name: 'Path', exact: true }).click();
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('span')).find(
      (el) => el.textContent === 'Pathfinder'
    );
    let scroller = heading?.parentElement ?? null;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
      scroller = scroller.parentElement;
    }
    if (scroller) scroller.scrollTop = Math.max(0, scroller.scrollTop - 96);
  });
  await page.waitForTimeout(500);
  await shot('13b-pathfinder.png');

  await context.close();
  await browser.close();

  const files = fs.readdirSync(OUT).sort();
  console.log(`\n${files.length} screenshots in ${OUT}`);
  for (const file of files) {
    const bytes = fs.statSync(path.join(OUT, file)).size;
    console.log(`  ${file} ${(bytes / 1024).toFixed(0)} kB`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
