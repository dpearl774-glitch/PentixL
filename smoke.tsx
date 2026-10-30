/**
 * Render-level smoke test for the new canvas features.
 * Run: bun smoke.tsx
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Canvas } from './src/components/Canvas';
import { CanvasSettingsSheet } from './src/components/CanvasSettingsSheet';
import { ColorSheet } from './src/components/ColorSheet';
import { AppMenu } from './src/components/AppMenu';
import { HelpSheet } from './src/components/HelpSheet';
import { ExportSheet } from './src/components/ExportSheet';
import { generateSvgCode } from './src/utils/svgExport';
import { generateProjectThumbnailSvg } from './src/utils/thumbnailGenerator';
import { computePathsBoundingBox } from './src/utils/transform';
import { alignPaths, distributePaths } from './src/utils/align';
import { fitSmoothBezierCurves, traceFieldRegions } from './src/utils/contourTracer';
import { sampleCubicBezier } from './src/utils/bezier';
import { executeBooleanOperation } from './src/utils/shapeBuilder';
import { defaultGradient, gradientCss, gradientCoords } from './src/utils/gradients';
import { Layer, SelectionState, VectorPath } from './src/types/vector';

const emptySelection: SelectionState = {
  selectedPathIds: [],
  selectedAnchorIndex: null,
  selectedHandleType: null,
};

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

const gradient = defaultGradient('#CDFF5C', '#7C6BFF');

const path: VectorPath = {
  id: 'p1',
  name: 'Grad shape',
  points: [
    { id: 'a', x: 0, y: 0, type: 'corner' },
    { id: 'b', x: 100, y: 0, type: 'corner' },
    { id: 'c', x: 100, y: 100, type: 'corner' },
  ],
  closed: true,
  fill: '#FF0000',
  fillOpacity: 1,
  fillGradient: gradient,
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
};

const backPath: VectorPath = {
  id: 'p0',
  name: 'Back shape',
  points: [
    { id: 'ba', x: 0, y: 0, type: 'corner' },
    { id: 'bb', x: 200, y: 0, type: 'corner' },
    { id: 'bc', x: 200, y: 60, type: 'corner' },
  ],
  closed: true,
  fill: '#00FF00',
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
};

const layer: Layer = {
  id: 'layer-1',
  name: 'Layer 1',
  visible: true,
  locked: false,
  opacity: 1,
  paths: [backPath, path],
};
const layers = [layer];

const noop = () => undefined;

/* ------------------------------- Canvas ------------------------------- */
console.log('Canvas');
const canvasHtml = renderToStaticMarkup(
  <Canvas
    view={{ zoom: 1, panX: 40, panY: 40, width: 640, height: 480 }}
    onViewChange={noop}
    layers={layers}
    activeLayerId="layer-1"
    onUpdatePath={noop}
    onAddPath={noop}
    tool="select"
    shapeKind="rectangle"
    shapeSides={6}
    modifiers={{ shift: false, ctrl: false, alt: false }}
    selection={emptySelection}
    onSelectionChange={noop}
    gridVisible
    gridSnapEnabled
    gridSpacingX={40}
    gridSpacingY={20}
    gridOpacity={0.55}
    artboardColor="#123456"
    rulersVisible
    guides={[
      { id: 'g1', axis: 'v', position: 120, locked: false },
      { id: 'g2', axis: 'h', position: 200, locked: true },
    ]}
    onAddGuide={noop}
    onUpdateGuide={noop}
    fillGradient={gradient}
    fillColor="#CDFF5C"
    strokeColor="#FFFFFF"
    strokeWidth={2}
    pressureConfig={{ source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 }}
    onCommitHistory={noop}
    activePathInProgress={null}
    setActivePathInProgress={noop}
  />
);

check('grid pattern uses per-axis spacing', /id="pentix-grid" width="40" height="20"/.test(canvasHtml));
check('grid opacity applied', /class="canvas-grid pointer-events-none" opacity="0.55"/.test(canvasHtml));
check('artboard background colour applied', /fill="#123456"/.test(canvasHtml));
check('vertical guide rendered', /guides-layer/.test(canvasHtml) && /x1="120"/.test(canvasHtml));
check('locked guide drawn dashed', /stroke-dasharray="6 4"/.test(canvasHtml));
check('gradient def emitted for path', /linearGradient id="pentix-grad-p1"/.test(canvasHtml));
check('gradient fill referenced', /url\(#pentix-grad-p1\)/.test(canvasHtml));
check('guides drawn as editing aids only', (canvasHtml.match(/guides-layer/g) ?? []).length === 1);
check(
  'closed shapes catch taps in their fill',
  (canvasHtml.match(/fill="transparent" stroke="transparent"/g) ?? []).length === 2
);
check(
  'paint order = hit order (back first, front last)',
  canvasHtml.indexOf('M 0.00 0.00 L 200.00 0.00 L 200.00 60.00') !== -1 &&
    canvasHtml.indexOf('M 0.00 0.00 L 100.00 0.00 L 100.00 100.00') >
      canvasHtml.indexOf('M 0.00 0.00 L 200.00 0.00 L 200.00 60.00')
);

/* --------------------------- Export excludes aids --------------------------- */
console.log('Export');
const svg = generateSvgCode(layers, { width: 640, height: 480, includeBackground: true, backgroundColor: '#123456' }, { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 });
check('exported SVG carries artboard colour', svg.includes('fill="#123456"'));
check('exported SVG contains gradient paint', svg.includes('<linearGradient id="pentix-grad-p1"') && svg.includes('stop-color="#CDFF5C"'));
check('exported SVG has NO gridlines', !svg.includes('pentix-grid') && !svg.includes('canvas-grid'));
check('exported SVG has NO guides/rulers', !svg.includes('guides-layer') && !svg.includes('ruler'));

const transparentSvg = generateSvgCode(layers, { width: 640, height: 480, includeBackground: false, backgroundColor: '#123456' }, { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 });
check('transparent export drops the background rect', !transparentSvg.includes('#123456'));

const monoExport = generateSvgCode(layers, { width: 640, height: 480, includeBackground: false, backgroundColor: '#123456', monoColor: '#000000' }, { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 });
check('one-colour export flattens every fill', monoExport.includes('fill="#000000"') && !monoExport.includes('linearGradient'));

const hiddenExport = generateSvgCode([{ ...layer, paths: [{ ...path, visible: false }] }], { width: 640, height: 480, includeBackground: false, backgroundColor: '#123456' }, { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 });
check('hidden objects stay out of the export', !hiddenExport.includes('path-p1'));

const croppedExport = generateSvgCode(layers, { width: 640, height: 480, includeBackground: false, backgroundColor: '#123456', pathIds: ['p1'], crop: { x: 0, y: 0, width: 100, height: 100 } }, { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 });
check('selection export crops and filters', croppedExport.includes('viewBox="0 0 100 100"') && croppedExport.includes('path-p1') && !croppedExport.includes('path-p0'));

const thumb = generateProjectThumbnailSvg(layers, 640, 480, '#123456');
check('thumbnail respects size + background + gradient', thumb.includes('viewBox="0 0 640 480"') && thumb.includes('#123456') && thumb.includes('linearGradient'));

/* ------------------------------- Units ------------------------------- */
console.log('Gradient geometry');
const lin = gradientCoords({ ...gradient, type: 'linear', angle: 0 });
check('angle 0 runs left→right', (lin as { x1: number }).x1 === 0 && (lin as { x2: number }).x2 === 1);
const rad = gradientCoords({ ...gradient, type: 'radial' });
check('radial is centred', (rad as { cx: number }).cx === 0.5 && (rad as { r: number }).r === 0.5);
const css = gradientCss({ ...gradient, type: 'linear', angle: 90 });
check('css preview built', css.startsWith('linear-gradient(180deg') && css.includes('rgba'));

/* ------------------------------ Align ------------------------------ */
console.log('Align & distribute');
const frame = { minX: 10, minY: 0, maxX: 210, maxY: 100, width: 200, height: 100, centerX: 110, centerY: 50 };
const rightAligned = computePathsBoundingBox(alignPaths([path], 'right', frame));
check('align right snaps to the frame edge', Math.abs((rightAligned?.maxX ?? -1) - 210) < 0.01);
const spread = distributePaths(
  [
    { ...path, id: 's1', points: [{ id: 's1a', x: 0, y: 0, type: 'corner' as const }, { id: 's1b', x: 10, y: 0, type: 'corner' as const }] },
    { ...path, id: 's2', points: [{ id: 's2a', x: 20, y: 0, type: 'corner' as const }, { id: 's2b', x: 30, y: 0, type: 'corner' as const }] },
    { ...path, id: 's3', points: [{ id: 's3a', x: 100, y: 0, type: 'corner' as const }, { id: 's3b', x: 110, y: 0, type: 'corner' as const }] },
  ],
  'horizontal'
);
const middle = computePathsBoundingBox([spread.find((p) => p.id === 's2')!]);
check('distribute evens the gaps', Math.abs((middle?.minX ?? -1) - 50) < 0.5);

/* ---------------------------- Curve fitting ---------------------------- */
console.log('Curve fitting');
const FW = 64;
const FH = 64;
const CX = 31.5;
const CY = 31.5;
const R = 20;

const discField = new Float32Array(FW * FH);
for (let y = 0; y < FH; y++) {
  for (let x = 0; x < FW; x++) {
    const d = Math.hypot(x - CX, y - CY);
    discField[y * FW + x] = Math.min(1, Math.max(0, 0.5 + (R - d) / 1.2));
  }
}
const discRegions = traceFieldRegions(discField, FW, FH, { iso: 0.5, simplify: 0.6, minArea: 20 });
check('disc traces as one region', discRegions.length === 1, `regions=${discRegions.length}`);
const discAnchors = discRegions.length ? fitSmoothBezierCurves(discRegions[0].points, 'disc', true, 0.8) : [];
check(
  'fitted circle needs only a handful of anchors',
  discAnchors.length >= 4 && discAnchors.length <= 14,
  `anchors=${discAnchors.length}`
);
check(
  'fitted circle nodes are smooth and carry handles',
  discAnchors.length > 0 && discAnchors.every((a) => a.handleIn && a.handleOut && a.type === 'smooth')
);
let radiusError = 0;
for (let i = 0; i < discAnchors.length; i++) {
  const a = discAnchors[i];
  const b = discAnchors[(i + 1) % discAnchors.length];
  for (const sample of sampleCubicBezier(a, a.handleOut ?? a, b.handleIn ?? b, b, 8)) {
    radiusError = Math.max(radiusError, Math.abs(Math.hypot(sample.x - CX, sample.y - CY) - R));
  }
}
check('fitted circle keeps its original shape', radiusError < 1.5, `error=${radiusError.toFixed(2)}`);
check(
  'anchors are far fewer than the polyline',
  discRegions.length > 0 && discRegions[0].points.length >= discAnchors.length * 4,
  `${discRegions[0]?.points.length ?? 0} pts → ${discAnchors.length} anchors`
);

const squareField = new Float32Array(FW * FH);
for (let y = 0; y < FH; y++) {
  for (let x = 0; x < FW; x++) {
    const inside = x >= 16 && x < 48 && y >= 16 && y < 48;
    squareField[y * FW + x] = inside ? 1 : 0;
  }
}
const squareRegions = traceFieldRegions(squareField, FW, FH, { iso: 0.5, simplify: 0.6, minArea: 20 });
const squareAnchors = squareRegions.length
  ? fitSmoothBezierCurves(squareRegions[0].points, 'sq', true, 0.8)
  : [];
check(
  'square keeps exactly four crisp corners',
  squareAnchors.length === 4 &&
    squareAnchors.every((a) => a.type === 'corner' && !a.handleIn && !a.handleOut),
  `anchors=${squareAnchors.length} types=${squareAnchors.map((a) => a.type).join(',')}`
);

const straightFit = fitSmoothBezierCurves(
  [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
  'line',
  false,
  0.5
);
check(
  'straight runs stay two plain anchors',
  straightFit.length === 2 && !straightFit[0].handleOut && !straightFit[1].handleIn,
  `anchors=${straightFit.length}`
);

const circlePoints = (cx: number, cy: number, r: number, count = 72) =>
  Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2;
    return { id: `c${cx}-${i}`, x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r, type: 'corner' as const };
  });
const circleA: VectorPath = {
  ...path,
  id: 'ca',
  name: 'A',
  fillGradient: undefined,
  points: circlePoints(100, 100, 60),
  closed: true,
};
const circleB: VectorPath = {
  ...circleA,
  id: 'cb',
  name: 'B',
  points: circlePoints(140, 100, 60),
};
const united = executeBooleanOperation([circleA, circleB], 'union');
const unionAnchors = united[0]?.points ?? [];
check(
  'shape builder output is sparse',
  unionAnchors.length > 0 && unionAnchors.length <= 20,
  `anchors=${unionAnchors.length} (from ${circleA.points.length + circleB.points.length} input points)`
);
check(
  'shape builder keeps rounded arcs curved',
  unionAnchors.filter((a) => a.type === 'smooth' && a.handleIn && a.handleOut).length >= 4,
  `smooth=${unionAnchors.filter((a) => a.type === 'smooth').length}`
);

/* --------------------------- Settings panel --------------------------- */
console.log('Canvas settings panel');
const sheetHtml = renderToStaticMarkup(
  <CanvasSettingsSheet
    open
    onClose={noop}
    width={1000}
    height={500}
    onResize={noop}
    gridVisible={false}
    onToggleGrid={noop}
    gridSnap
    onToggleGridSnap={noop}
    gridSpacingX={40}
    gridSpacingY={20}
    onSpacingChange={noop}
    gridOpacity={0.4}
    onGridOpacityChange={noop}
    gridLocked
    onToggleGridLock={noop}
    rulersVisible
    onToggleRulers={noop}
    guidesLocked
    onToggleGuidesLock={noop}
    guides={[
      { id: 'g1', axis: 'v', position: 120, locked: false },
      { id: 'g2', axis: 'h', position: 200, locked: true },
    ]}
    onUpdateGuide={noop}
    onRemoveGuide={noop}
    onClearGuides={noop}
    artboardColor="#123456"
    onEditBackground={noop}
    onFitArtwork={noop}
  />
);
check('unit switch has px, cm and in', sheetHtml.includes('>px<') && sheetHtml.includes('>cm<') && sheetHtml.includes('>in<'));
check('current pixel size shown', sheetHtml.includes('value="1000"') && sheetHtml.includes('value="500"'));
check('single global lock present', sheetHtml.includes('aria-label="Unlock grid"') && !/Lock grid<\/button>[^]*Lock grid</.test(sheetHtml));
check('locked spacing inputs disabled', /aria-label="Horizontal"[\s\S]{0,120}disabled/.test(sheetHtml));
check('snap toggle independent', sheetHtml.includes('aria-label="Snap to grid"'));
check('visibility toggle independent', sheetHtml.includes('aria-label="Show grid"'));
check('line visibility slider', sheetHtml.includes('aria-label="Grid line visibility"'));
check('guide rows with lock + remove', sheetHtml.includes('Unlock guide') && sheetHtml.includes('Remove guide') && sheetHtml.includes('120 px'));
check('rulers toggle', sheetHtml.includes('aria-label="Show rulers"'));
check('lock all guides toggle', sheetHtml.includes('aria-label="Lock all guides"'));
check('artboard colour row', sheetHtml.includes('#123456') && sheetHtml.includes('pick, hex or reset'));
check('size apply shows target dims', sheetHtml.includes('Apply') && sheetHtml.includes('1000 × 500 px'));
check('artboard presets for logo boards', sheetHtml.includes('1024²') && sheetHtml.includes('Fit artwork'));
check('settings panel is terse', !sheetHtml.includes('Locking freezes') && !sheetHtml.includes('Drag off a ruler'));

/* ---------------------------- Help / reference ---------------------------- */
console.log('Help sheet');
const helpHtml = renderToStaticMarkup(<HelpSheet open onClose={noop} />);
check('help owns the long instructions', helpHtml.includes('Drag off a ruler') && helpHtml.includes('never export'));
check('help covers grid, fonts and pressure', helpHtml.includes('line strength') && helpHtml.includes('Imported typefaces') && helpHtml.includes('Uniform is constant'));
check('help lists the text editing gesture', helpHtml.includes('Double-tap a label'));

/* ------------------------------ Colour panel ------------------------------ */
console.log('Colour panel');
const colorHtml = renderToStaticMarkup(
  <ColorSheet
    open
    onClose={noop}
    mode="fill"
    onModeChange={noop}
    fillColor="#CDFF5C"
    strokeColor="#FFFFFF"
    strokeWidth={2}
    strokeCap="round"
    strokeJoin="round"
    fillOpacity={1}
    strokeOpacity={1}
    onUpdateFill={noop}
    onUpdateStroke={noop}
    onUpdateFillOpacity={noop}
    onUpdateStrokeOpacity={noop}
    onUpdateStrokeWidth={noop}
    onUpdateStrokeCap={noop}
    onUpdateStrokeJoin={noop}
    fillType="gradient"
    fillGradient={gradient}
    onSetFillType={noop}
    onUpdateFillGradient={noop}
    stopIndex={0}
    onStopIndexChange={noop}
    artboardColor="#123456"
    onUpdateBackground={noop}
    onResetBackground={noop}
    onSample={noop}
    sampling={false}
    selectedCount={2}
  />
);
check('embedded saturation/value picker', colorHtml.includes('aria-label="Saturation and brightness"'));
check('hue control', colorHtml.includes('aria-label="Hue"'));
check('hex input', colorHtml.includes('aria-label="Hex value"'));
check('opacity (alpha) slider', colorHtml.includes('aria-label="Opacity"'));
check('eyedropper button', colorHtml.includes('Sample a colour from the artwork'));
check('solid / gradient switch', colorHtml.includes('>Solid<') && colorHtml.includes('>Gradient<'));
check('linear / radial switch', colorHtml.includes('>Linear<') && colorHtml.includes('>Radial<'));
check('stop bar with add/remove', colorHtml.includes('aria-label="Add stop"') && colorHtml.includes('aria-label="Remove stop"'));
check('stop position + angle controls', colorHtml.includes('aria-label="Stop position"') && colorHtml.includes('aria-label="Gradient angle"'));
check('no native colour dialog', !colorHtml.includes('type="color"'));

/* -------------------------------- Menu -------------------------------- */
console.log('Menu');
const menuHtml = renderToStaticMarkup(
  <AppMenu
    open
    onClose={noop}
    projectName="Logo"
    onSave={noop}
    onNewProject={noop}
    onOpenProjects={noop}
    onOpenCanvas={noop}
    canvasLabel="1000 × 500 px"
    gridLabel="40 × 20 px · snapping · locked"
    rulersVisible
    guidesCount={2}
    smartGuides
    onToggleSmartGuides={noop}
    panZoomLocked={false}
    onTogglePanZoomLock={noop}
    clipArtboard={false}
    onToggleClipArtboard={noop}
    showTransforms
    showPrecisionPad
    onTogglePrecisionPad={noop}
    onToggleTransforms={noop}
    onPanTool={noop}
    onOpenPressure={noop}
    onOpenFonts={noop}
    onOpenReferences={noop}
    onOpenTracer={noop}
    onOpenHelp={noop}
    canUndo
    canRedo={false}
    onUndo={noop}
    onRedo={noop}
  />
);
check('menu opens one artboard panel', menuHtml.includes('Artboard &amp; canvas') && !menuHtml.includes('Grid &amp; snapping'));
check('menu summarises grid state', menuHtml.includes('40 × 20 px · snapping · locked'));
check('menu summarises rulers/guides', menuHtml.includes('rulers · 2 guides'));
check('menu offers the optional precision pad', menuHtml.includes('Precision pad') && menuHtml.includes('Trackpad cursor'));
check('no duplicate grid toggles in menu', !menuHtml.includes('Snap to grid'));

/* ------------------------------ Export panel ------------------------------ */
console.log('Export panel');
const exportHtml = renderToStaticMarkup(
  <ExportSheet
    open
    onClose={noop}
    layers={layers}
    canvasWidth={1000}
    canvasHeight={500}
    pressureConfig={{ source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 }}
    projectName="Logo"
    backgroundColor="#123456"
    selectedPaths={[path]}
  />
);
check('export sheet shows artboard dims', exportHtml.includes('1000 × 500 px artboard'));
check('export sheet offers transparent output', exportHtml.includes('Alpha channel kept') && exportHtml.includes('Transparent background'));
check('export offers one-colour output', exportHtml.includes('Full colour') && exportHtml.includes('Black') && exportHtml.includes('White'));
check('export can crop to the selection', exportHtml.includes('Selection · 1'));

console.log('Background colour panel');
const bgHtml = renderToStaticMarkup(
  <ColorSheet
    open
    onClose={noop}
    mode="background"
    onModeChange={noop}
    fillColor="#CDFF5C"
    strokeColor="#FFFFFF"
    strokeWidth={2}
    strokeCap="round"
    strokeJoin="round"
    fillOpacity={1}
    strokeOpacity={1}
    onUpdateFill={noop}
    onUpdateStroke={noop}
    onUpdateFillOpacity={noop}
    onUpdateStrokeOpacity={noop}
    onUpdateStrokeWidth={noop}
    onUpdateStrokeCap={noop}
    onUpdateStrokeJoin={noop}
    fillType="solid"
    fillGradient={null}
    onSetFillType={noop}
    onUpdateFillGradient={noop}
    stopIndex={0}
    onStopIndexChange={noop}
    artboardColor="#123456"
    onUpdateBackground={noop}
    onResetBackground={noop}
    onSample={noop}
    sampling={false}
  />
);
check('background uses the same picker', bgHtml.includes('aria-label="Saturation and brightness"') && bgHtml.includes('aria-label="Hex value"'));
check('background reset button', bgHtml.includes('Reset') && bgHtml.includes('#123456'));
check('background hides stroke-only sections', !bgHtml.includes('aria-label="Stroke weight"'));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
if (failures > 0) process.exit(1);
