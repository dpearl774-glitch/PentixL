/**
 * Render-level smoke test for the new canvas features.
 * Run: bun smoke.tsx
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Canvas } from './src/components/Canvas';
import { ToolDock } from './src/components/ToolDock';
import { ToolOptions } from './src/components/ToolOptions';
import { TextSheet } from './src/components/TextSheet';
import { TopBar } from './src/components/TopBar';
import { FontsSheet } from './src/components/FontsSheet';
import { fitBezierPath } from './src/utils/curveFit';
import { CanvasSettingsSheet } from './src/components/CanvasSettingsSheet';
import { ColorSheet } from './src/components/ColorSheet';
import { AppMenu } from './src/components/AppMenu';
import { BackupSheet } from './src/components/BackupSheet';
import { HelpSheet } from './src/components/HelpSheet';
import { ExportSheet } from './src/components/ExportSheet';
import { generateSvgCode } from './src/utils/svgExport';
import { generateProjectThumbnailSvg } from './src/utils/thumbnailGenerator';
import { computePathsBoundingBox, copyPathsWithNewIds, scalePaths } from './src/utils/transform';
import { alignPaths, distributePaths } from './src/utils/align';
import { fitSmoothBezierCurves, traceFieldRegions } from './src/utils/contourTracer';
import { roundPathCorners, sampleCubicBezier } from './src/utils/bezier';
import { computeSelectionOverlapD } from './src/utils/overlap';
import {
  sanitizeClipReferences,
  withClipSources,
  withClipSourcesForExport,
} from './src/utils/clipping';
import { extrusionFaces, extrusionShadow, includeExtrusionInBounds } from './src/utils/extrusion';
import {
  computeVisiblePathsBoundingBox,
  executeBooleanOperation,
} from './src/utils/shapeBuilder';
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
const canvasProps: React.ComponentProps<typeof Canvas> = {
  view: { zoom: 1, panX: 40, panY: 40, width: 640, height: 480 },
  onViewChange: noop,
  layers,
  activeLayerId: 'layer-1',
  onUpdatePath: noop,
  onAddPath: noop,
  tool: 'select',
  shapeKind: 'rectangle',
  shapeSides: 6,
  modifiers: { shift: false, ctrl: false, alt: false },
  selection: emptySelection,
  onSelectionChange: noop,
  gridVisible: true,
  gridSnapEnabled: true,
  gridSpacingX: 40,
  gridSpacingY: 20,
  gridOpacity: 0.55,
  artboardColor: '#123456',
  rulersVisible: true,
  guides: [
    { id: 'g1', axis: 'v', position: 120, locked: false },
    { id: 'g2', axis: 'h', position: 200, locked: true },
  ],
  onAddGuide: noop,
  onUpdateGuide: noop,
  fillGradient: gradient,
  fillColor: '#CDFF5C',
  strokeColor: '#FFFFFF',
  strokeWidth: 2,
  pressureConfig: { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 30 },
  onCommitHistory: noop,
  activePathInProgress: null,
  setActivePathInProgress: noop,
};

const canvasHtml = renderToStaticMarkup(<Canvas {...canvasProps} />);

check('grid pattern uses per-axis spacing', /id="pentix-grid" width="40" height="20"/.test(canvasHtml));
check('grid opacity applied', /class="canvas-grid pointer-events-none" opacity="0.55"/.test(canvasHtml));
check('artboard background colour applied', /fill="#123456"/.test(canvasHtml));
check('vertical guide rendered', /guides-layer/.test(canvasHtml) && /x1="120"/.test(canvasHtml));
check('locked guide drawn dashed', /stroke-dasharray="6 4"/.test(canvasHtml));
check('gradient def emitted for path', /linearGradient id="pentix-grad-p1"/.test(canvasHtml));
check('gradient fill referenced', /url\(#pentix-grad-p1\)/.test(canvasHtml));
check('guides drawn as editing aids only', (canvasHtml.match(/guides-layer/g) ?? []).length === 1);

/* Pen paths with no stroke must still show their geometry while building */
const penLive: VectorPath = {
  ...path,
  id: 'pen-live',
  points: [
    { id: 'pa', x: 20, y: 20, type: 'corner' },
    { id: 'pb', x: 90, y: 70, type: 'corner' },
  ],
  closed: false,
  fill: 'none',
  fillGradient: undefined,
  stroke: 'none',
  strokeWidth: 0,
};
const penHtml = renderToStaticMarkup(
  <Canvas {...canvasProps} tool="pen" activePathInProgress={penLive} />
);
check('pen path with stroke off still draws a guide', penHtml.includes('stroke-dasharray="7 5"'));
check('the pen guide uses the accent colour', penHtml.includes('stroke="#4c8dff"'));
check(
  'pen keeps its own stroke when it has one',
  renderToStaticMarkup(
    <Canvas {...canvasProps} tool="pen" activePathInProgress={{ ...penLive, stroke: '#FFFFFF', strokeWidth: 2 }} />
  ).includes('stroke-dasharray="7 5"') === false
);

/* Pencil: the dock slot, the strip, and a sparse smooth fit */
console.log('Pencil');
const dockHtml = renderToStaticMarkup(
  <ToolDock currentTool="pencil" onSelectTool={noop} onOpenShapes={noop} />
);
check('dock has a pencil slot', dockHtml.includes('aria-label="Pencil tool"'));
check('the active pencil is named in the dock', dockHtml.includes('>Pencil<'));

const toolOptionsBase: React.ComponentProps<typeof ToolOptions> = {
  tool: 'pencil',
  selectedCount: 0,
  hasTextSelection: false,
  fillColor: '#CDFF5C',
  strokeColor: '#FFFFFF',
  strokeWidth: 2,
  pencilSmoothing: 'smooth',
  onChangePencilSmoothing: noop,
  shapeKind: 'rectangle',
  sbMode: 'merge',
  drawingPointCount: 0,
  onOpenColor: noop,
  onChangeStrokeWidth: noop,
  onDuplicate: noop,
  onDelete: noop,
  onFlip: noop,
  onBoolean: noop,
  onEditText: noop,
  onExpandText: noop,
  onOpenText: noop,
  onFinishPath: noop,
  onCancelPath: noop,
  onClosePath: noop,
  onToggleNodeType: noop,
  onDeleteNode: noop,
  hasSelectedNode: false,
  onQuickShape: noop,
  onPickShape: noop,
  onOpenShapes: noop,
  onOpenPressure: noop,
  onChangeSbMode: noop,
  onCopy: noop,
  onPaste: noop,
  canPaste: false,
  onRoundCorners: noop,
  cornerRadius: 0,
  onMakeClipMask: noop,
  onReleaseClipMask: noop,
  canMakeClipMask: false,
  hasClipMask: false,
  canDrawInside: false,
  drawInsideName: null,
  onStartDrawInside: noop,
  onExitDrawInside: noop,
  extrudeDepth: 0,
  canExtrude: true,
  onExtrudeDepth: noop,
  onExtrudeAngle: noop,
  onExtrudeTaper: noop,
  onExtrudeShadow: noop,
  onSimplify: noop,
  onExitPan: noop,
  onAlign: noop,
  onDistribute: noop,
};

const pencilOptions = renderToStaticMarkup(<ToolOptions {...toolOptionsBase} />);
check('pencil strip explains closing', pencilOptions.includes('end on the start to close'));
check(
  'pencil offers three smoothness levels',
  ['Tight', 'Smooth', 'Loose'].every((label) => pencilOptions.includes(`>${label}<`))
);
check(
  'pen warns when there is no stroke to see',
  renderToStaticMarkup(<ToolOptions {...toolOptionsBase} tool="pen" strokeColor="none" strokeWidth={0} />).includes(
    'Guide preview · no stroke'
  )
);

/* Corner rounding and overlap feedback */
console.log('Corner rounding & overlap');
const squarePath: VectorPath = {
  ...path,
  id: 'square-round',
  points: [
    { id: 'sq-a', x: 0, y: 0, type: 'corner' },
    { id: 'sq-b', x: 100, y: 0, type: 'corner' },
    { id: 'sq-c', x: 100, y: 100, type: 'corner' },
    { id: 'sq-d', x: 0, y: 100, type: 'corner' },
  ],
  closed: true,
};
const rounded20 = roundPathCorners(squarePath, 20);
check('square rounds each corner into a clean arc', rounded20.points.length === 8);
check(
  'square corner uses a true circular handle',
  Math.abs((rounded20.points[0].handleOut?.y ?? 0) - 8.955) < 0.02,
  `handle=${rounded20.points[0].handleOut?.y}`
);
const rounded30 = roundPathCorners(rounded20, 30);
check('changing radius does not double-round', rounded30.points.length === 8);
check(
  'changed radius rebuilds from sharp corners',
  Math.abs((rounded30.points[0].handleOut?.y ?? 0) - 13.431) < 0.02,
  `handle=${rounded30.points[0].handleOut?.y}`
);
const resetCorners = roundPathCorners(rounded30, 0);
check('radius zero restores the sharp square', resetCorners.points.length === 4 && !resetCorners.cornerSource);

const oneCorner = roundPathCorners(squarePath, 20, 'sq-a');
check(
  'one corner can be rounded independently',
  oneCorner.points.length === 5 && oneCorner.cornerRadii?.['sq-a'] === 20
);
const twoCorners = roundPathCorners(oneCorner, 30, 'sq-b');
check(
  'a second corner keeps the first override',
  twoCorners.points.length === 6 &&
    twoCorners.cornerRadii?.['sq-a'] === 20 &&
    twoCorners.cornerRadii?.['sq-b'] === 30
);
const zeroOneCorner = roundPathCorners(twoCorners, 0, 'sq-a');
check(
  'zeroing one corner keeps the other override',
  zeroOneCorner.points.length === 5 &&
    zeroOneCorner.cornerRadii?.['sq-a'] === 0 &&
    zeroOneCorner.cornerRadii?.['sq-b'] === 30
);
const uniformAgain = roundPathCorners(zeroOneCorner, 15);
check(
  'the all-corners slider clears overrides',
  uniformAgain.points.length === 8 && !uniformAgain.cornerRadii
);
const scaledCorners = scalePaths([oneCorner], { x: 0, y: 0 }, 2, 2)[0];
check(
  'individual radii scale with the object',
  scaledCorners.cornerRadii?.['sq-a'] === 40
);

const overlapSquare: VectorPath = {
  ...squarePath,
  id: 'square-overlap',
  points: squarePath.points.map((point) => ({ ...point, id: `${point.id}-o`, x: point.x + 50, y: point.y + 50 })),
};
const overlapD = computeSelectionOverlapD([squarePath, overlapSquare]);
check('two selected squares expose their overlap', !!overlapD && overlapD.includes('M '));

const clipMask: VectorPath = { ...squarePath, id: 'clip-mask', isClippingMask: true };
const clipChild: VectorPath = { ...squarePath, id: 'clip-child', clipPathId: 'clip-mask' };
const bboxSource: VectorPath = { ...overlapSquare, id: 'bbox-source' };
const bboxChild: VectorPath = { ...squarePath, id: 'bbox-child', clipPathId: 'bbox-source' };
const clippedBounds = computeVisiblePathsBoundingBox(
  [bboxChild],
  [bboxChild, bboxSource]
);
check(
  'selection bounds use the visible clipped region',
  !!clippedBounds && clippedBounds.minX >= 49.9 && clippedBounds.maxX <= 100.1,
  clippedBounds ? `bounds=${clippedBounds.minX}..${clippedBounds.maxX}` : 'no bounds'
);
const clipLayers: Layer[] = [
  { id: 'clip-layer', name: 'Mask', visible: true, locked: false, opacity: 1, paths: [clipChild, clipMask] },
];
const clipSvg = generateSvgCode(
  clipLayers,
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check('clip mask exports its source definition', clipSvg.includes('id="pentix-clip-clip-mask"'));
check('clipped object references the mask', clipSvg.includes('clip-path="url(#pentix-clip-clip-mask)"'));
check('mask source is not painted as artwork', !clipSvg.includes('id="path-clip-mask"'));
const clipThumb = generateProjectThumbnailSvg(clipLayers);
check('thumbnails keep clipping', clipThumb.includes('clip-path="url(#pentix-clip-clip-mask)"'));

const insideSource: VectorPath = { ...squarePath, id: 'inside-source' };
const insideChild: VectorPath = { ...squarePath, id: 'inside-child', clipPathId: 'inside-source' };
const insideLayers: Layer[] = [
  { id: 'inside-layer', name: 'Inside', visible: true, locked: false, opacity: 1, paths: [insideSource, insideChild] },
];
const insideSvg = generateSvgCode(
  insideLayers,
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check('draw-inside source remains painted', insideSvg.includes('id="path-inside-source"'));
check('draw-inside child references the source clip', insideSvg.includes('clip-path="url(#pentix-clip-inside-source)"'));

const clipSelectionLayers = withClipSourcesForExport(clipLayers, new Set(['clip-child']));
const clipSelectionSvg = generateSvgCode(
  clipSelectionLayers,
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check(
  'selection export keeps the clip source definition',
  clipSelectionSvg.includes('id="pentix-clip-clip-mask"')
);
check(
  'selection export clips the selected child',
  clipSelectionSvg.includes('clip-path="url(#pentix-clip-clip-mask)"')
);
check(
  'selection export keeps the source out of the paint',
  !clipSelectionSvg.includes('id="path-clip-mask"')
);

const insideSelectionLayers = withClipSourcesForExport(insideLayers, new Set(['inside-child']));
const insideSelectionSvg = generateSvgCode(
  insideSelectionLayers,
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check(
  'selection export keeps a draw-inside source in defs',
  insideSelectionSvg.includes('id="pentix-clip-inside-source"')
);
check(
  'selection export does not paint the draw-inside source',
  !insideSelectionSvg.includes('id="path-inside-source"')
);

const danglingLayers: Layer[] = [
  {
    id: 'dangling-layer',
    name: 'Dangling',
    visible: true,
    locked: false,
    opacity: 1,
    paths: [{ ...clipChild, clipPathId: 'missing-source' }],
  },
];
const danglingSvg = generateSvgCode(
  danglingLayers,
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check(
  'dangling clips get an empty definition',
  danglingSvg.includes('id="pentix-clip-missing-source"') &&
    danglingSvg.includes('clip-path="url(#pentix-clip-missing-source)"')
);

const hiddenSourceLayers: Layer[] = [
  { id: 'hidden-source', name: 'Hidden source', visible: false, locked: false, opacity: 1, paths: [clipMask] },
  { id: 'hidden-child', name: 'Visible child', visible: true, locked: false, opacity: 1, paths: [clipChild] },
];
const hiddenSourceSvg = generateSvgCode(
  hiddenSourceLayers,
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check(
  'hidden sources still define the clip',
  hiddenSourceSvg.includes('id="pentix-clip-clip-mask"') &&
    hiddenSourceSvg.includes('clip-path="url(#pentix-clip-clip-mask)"')
);

const duplicatedClip = copyPathsWithNewIds([clipMask, clipChild], 10, 10, 'dup');
const duplicatedMask = duplicatedClip.find((p) => p.isClippingMask);
const duplicatedChild = duplicatedClip.find((p) => !p.isClippingMask);
check(
  'copying a mask and child remaps the clip id',
  !!duplicatedMask && duplicatedChild?.clipPathId === duplicatedMask.id
);
check(
  'copying a mask source alone makes a visible copy',
  copyPathsWithNewIds([clipMask], 10, 10, 'solo')[0]?.isClippingMask === false
);

const clippedSource = { ...squarePath, id: 'clipped-source' };
const clippedPair = copyPathsWithNewIds(
  [{ ...clipChild, clipPathId: clippedSource.id }, clippedSource],
  0,
  0,
  'clipped'
);
const clippedChildCopy = clippedPair.find((p) => !p.isClippingMask && p.clipPathId);
const clippedSourceCopy = clippedPair.find((p) => p.id === clippedChildCopy?.clipPathId);
check('clip copies keep a resolvable source', !!clippedSourceCopy);

const booleanResult = executeBooleanOperation(
  [clipChild, overlapSquare],
  'union',
  [clipChild, clipMask, overlapSquare]
);
check(
  'boolean results do not inherit clip state',
  booleanResult.length > 0 && booleanResult.every((p) => !p.clipPathId && !p.isClippingMask)
);

const danglingRepair = sanitizeClipReferences(danglingLayers);
check(
  'normalization keeps dangling refs on the empty-clip fallback',
  danglingRepair[0].paths[0].clipPathId === 'missing-source'
);
const cycleA: VectorPath = { ...squarePath, id: 'cycle-a', clipPathId: 'cycle-b' };
const cycleB: VectorPath = { ...squarePath, id: 'cycle-b', clipPathId: 'cycle-a' };
const cycleRepair = sanitizeClipReferences([
  { id: 'cycle-layer', name: 'Cycle', visible: true, locked: false, opacity: 1, paths: [cycleA, cycleB] },
]);
check(
  'normalization breaks clip cycles',
  cycleRepair[0].paths.every((path) => !path.clipPathId)
);
check(
  'overlap ignores a dangling clipped shape',
  computeSelectionOverlapD(
    [{ ...clipChild, clipPathId: 'missing-source' }, overlapSquare],
    [{ ...clipChild, clipPathId: 'missing-source' }, overlapSquare]
  ) === null
);
check(
  'withClipSources adds a hidden source for copying',
  withClipSources([clipChild], [clipMask, clipChild]).some(
    (p) => p.id === clipMask.id && p.isClippingMask
  )
);

const extrudedPath: VectorPath = { ...squarePath, id: 'extruded', extrudeDepth: 24 };
const extrudeLayers: Layer[] = [
  { id: 'extrude-layer', name: '3D', visible: true, locked: false, opacity: 1, paths: [extrudedPath] },
];
const extrudeSvg = generateSvgCode(
  extrudeLayers,
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check('3D extrusion exports side walls', extrudeSvg.includes('id="extrude-extruded"'));
check('3D extrusion keeps thumbnails', generateProjectThumbnailSvg(extrudeLayers).includes('id="extrude-extruded"'));
const wallFaces = extrusionFaces(extrudedPath);
const wallFills = new Set(wallFaces.map((f) => f.fill));
const luminanceOf = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const wallLums = wallFaces.map((f) => luminanceOf(f.fill));
const faceLum = luminanceOf(squarePath.fill);
const wallOnlyLums = wallLums.slice(1);
check(
  '3D walls are flat facets, not depth slices',
  wallFills.size >= 3 && wallFaces.length <= 6,
  `faces=${wallFaces.length} shades=${wallFills.size}`
);
check(
  '3D walls shade between a lit edge and a shaded one',
  (Math.max(...wallOnlyLums) - Math.min(...wallOnlyLums)) / Math.max(...wallOnlyLums) > 0.25,
  `range=${Math.min(...wallOnlyLums).toFixed(2)}..${Math.max(...wallOnlyLums).toFixed(2)}`
);
check(
  '3D closes the solid with a back cap',
  wallLums[0] < Math.min(...wallOnlyLums) && faceLum > wallLums[0],
  `cap=${wallLums[0].toFixed(2)} wall=${Math.min(...wallOnlyLums).toFixed(2)} face=${faceLum.toFixed(2)}`
);
check('3D walls reuse the cached build', extrusionFaces(extrudedPath) === wallFaces);
const starPoints = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const radius = i % 2 ? 40 : 100;
  return {
    id: `star-${i}`,
    x: 300 + Math.cos(angle) * radius,
    y: 300 + Math.sin(angle) * radius,
    type: 'corner' as const,
  };
});
const starPath: VectorPath = { ...squarePath, id: 'star', points: starPoints, extrudeDepth: 40 };
const starFaces = extrusionFaces(starPath);
check(
  '3D culls the walls hidden behind the face',
  starFaces.length <= 7,
  `faces=${starFaces.length} for 10 edges`
);
const shadowOn = extrusionShadow({ ...extrudedPath, extrudeShadow: true });
check(
  '3D casts a soft shadow',
  !!shadowOn && shadowOn.blur > 1 && shadowOn.opacity > 0.1 && shadowOn.d.length > 10,
  shadowOn ? `blur=${shadowOn.blur.toFixed(1)}` : 'missing'
);
check('3D keeps a shadow by default', extrusionShadow(extrudedPath) !== null);
check(
  '3D shadow can be turned off',
  extrusionShadow({ ...extrudedPath, extrudeShadow: false }) === null
);
const tapered = extrusionFaces({ ...extrudedPath, id: 'taper', extrudeTaper: 0.4 });
check(
  '3D taper pulls the back face inward',
  tapered[1].d !== wallFaces[1].d && tapered[0].d !== wallFaces[0].d
);
const turnedWalls = extrusionFaces({ ...extrudedPath, id: 'turned', extrudeAngle: 225 });
check(
  '3D direction turns the walls',
  turnedWalls.length === wallFaces.length && turnedWalls[0].d !== wallFaces[0].d
);
const flatBox = computePathsBoundingBox([extrudedPath])!;
const turnedBox = includeExtrusionInBounds(
  [{ ...extrudedPath, id: 'turned', extrudeAngle: 225 }],
  flatBox
);
check(
  '3D direction reaches into the export bounds',
  turnedBox.minX < flatBox.minX && turnedBox.minY < flatBox.minY
);
const threeDStrip = renderToStaticMarkup(
  <ToolOptions {...toolOptionsBase} tool="select" selectedCount={1} extrudeDepth={32} />
);
check('3D has its own button in the strip', threeDStrip.includes('aria-label="3D settings"'));
check('3D button reports the current depth', threeDStrip.includes('3D · 32'));
const flatStrip = renderToStaticMarkup(
  <ToolOptions {...toolOptionsBase} tool="select" selectedCount={1} extrudeDepth={0} />
);
check('3D button reads as off when nothing is pulled', flatStrip.includes('>3D<'));
check(
  '3D walls are clipped with their object',
  extrudeSvg.includes('<g id="extrude-extruded"')
);
const densePoints = Array.from({ length: 900 }, (_, i) => {
  const angle = (i / 900) * Math.PI * 2;
  return {
    id: `dense-${i}`,
    x: 300 + Math.cos(angle) * 200,
    y: 300 + Math.sin(angle) * 200,
    type: 'corner' as const,
  };
});
const densePath: VectorPath = { ...squarePath, id: 'dense', points: densePoints, extrudeDepth: 60 };
const denseStart = performance.now();
const denseFaces = extrusionFaces(densePath);
const denseMs = performance.now() - denseStart;
const denseQuads = denseFaces.reduce((n, f) => n + (f.d.match(/M /g)?.length ?? 0), 0);
check('dense extrusion geometry stays bounded', denseQuads <= 240, `quads=${denseQuads}`);
check('dense extrusion builds without stalling', denseMs < 120, `${denseMs.toFixed(1)}ms`);
const ringHole = squarePath.points.map((p) => ({ ...p, id: `ring-${p.id}`, x: p.x * 0.4 + 30, y: p.y * 0.4 + 30 }));
const plainQuads = wallFaces.reduce((n, f) => n + (f.d.match(/M /g)?.length ?? 0), 0);
const ringQuads = extrusionFaces({ ...extrudedPath, id: 'ring', holes: [ringHole] }).reduce(
  (n, f) => n + (f.d.match(/M /g)?.length ?? 0),
  0
);
check('extrusion adds walls inside counter holes', ringQuads > plainQuads, `${plainQuads}->${ringQuads}`);
const flatExportBounds = computePathsBoundingBox([extrudedPath]);
check(
  'selection export bounds include extrusion side walls',
  !!flatExportBounds &&
    includeExtrusionInBounds([extrudedPath], flatExportBounds).maxX > flatExportBounds.maxX &&
    includeExtrusionInBounds([extrudedPath], flatExportBounds).maxY > flatExportBounds.maxY
);

const sourceOnlyLayers: Layer[] = [
  { id: 'inside-layer', name: 'Inside', visible: true, locked: false, opacity: 1, paths: [insideSource] },
];
const livePreviewHtml = renderToStaticMarkup(
  <Canvas
    {...canvasProps}
    layers={sourceOnlyLayers}
    tool="pen"
    drawInsideId="inside-source"
    activePathInProgress={{
      ...insideChild,
      id: 'live-preview',
      clipPathId: undefined,
      stroke: '#FFFFFF',
      strokeWidth: 2,
    }}
  />
);
check(
  'draw-inside clips the live pen preview',
  livePreviewHtml.includes('clip-path="url(#pentix-clip-inside-source)"')
);
check(
  'draw-inside mode is visible in the strip',
  renderToStaticMarkup(<ToolOptions {...toolOptionsBase} drawInsideName="Square" />).includes('Inside Square')
);

const noisyRing = Array.from({ length: 180 }, (_, i) => {
  const a = (i / 180) * Math.PI * 2;
  const r = 50 + Math.sin(i * 0.7) * 0.7;
  return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
});
const fitted = fitBezierPath(noisyRing, { closed: true, tolerance: 2.2 });
check('pencil fit keeps a handful of nodes', fitted.length >= 4 && fitted.length <= 16, `anchors=${fitted.length}`);
check(
  'pencil fit arrives smooth',
  fitted.filter((p) => p.handleOut).length >= fitted.length - 1,
  `handles=${fitted.filter((p) => p.handleOut).length}`
);

/* Fonts: searchable, with recent typefaces kept on top */
console.log('Fonts');
const manyFonts = ['Archivo Black', 'Bebas Neue', 'DM Serif Display', 'Inter Tight', 'Space Grotesk'];
const textSheetHtml = renderToStaticMarkup(
  <TextSheet
    open
    onClose={noop}
    initialText="PENTIX"
    initialFontFamily="Inter Tight"
    initialFontSize={64}
    initialLetterSpacing={0}
    initialFillColor="#CDFF5C"
    customFonts={manyFonts}
    recentFonts={['Space Grotesk', 'Impact, sans-serif']}
    editingPathId={null}
    onSave={noop}
  />
);
check('font search field present', textSheetHtml.includes('aria-label="Search fonts"'));
check(
  'recent fonts come before the full list',
  textSheetHtml.includes('>Recent<') &&
    textSheetHtml.indexOf('>Recent<') < textSheetHtml.indexOf('>All fonts<')
);
check('every imported font is reachable', manyFonts.every((f) => textSheetHtml.includes(f)));
check('the typeface count is shown', textSheetHtml.includes('>11<'), '6 system + 5 imported');

const fontsSheetHtml = renderToStaticMarkup(
  <FontsSheet
    open
    onClose={noop}
    customFonts={manyFonts}
    onAddFont={async () => undefined}
    onRemoveFont={noop}
  />
);
check(
  'imported fonts can be searched too',
  fontsSheetHtml.includes('aria-label="Search imported fonts"')
);

const topBarHtml = renderToStaticMarkup(
  <TopBar
    projectName="Untitled"
    isSaved
    layersCount={1}
    canUndo
    canRedo={false}
    onUndo={noop}
    onRedo={noop}
    onRenameProject={noop}
    onOpenMenu={noop}
    onOpenLayers={noop}
    onOpenExport={noop}
    onPreview={noop}
  />
);
check('top bar offers artboard preview', topBarHtml.includes('aria-label="Preview artboard"'));
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
check(
  'lock all guides reads locked on every row',
  (sheetHtml.match(/disabled="" aria-label="Locked by Lock all guides"/g) || []).length === 2 &&
    !sheetHtml.includes('Unlock guide') &&
    sheetHtml.includes('Remove guide') &&
    sheetHtml.includes('120 px')
);
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
    swatches={[
      { id: 's1', name: 'Signal', color: '#CDFF5C' },
      { id: 's2', name: 'Ink', color: '#0B0C0E' },
    ]}
    onAddSwatch={noop}
    onRemoveSwatch={noop}
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
check('named swatch library', colorHtml.includes('Apply swatch Signal') && colorHtml.includes('Apply swatch Ink'));
check('swatches can be removed', colorHtml.includes('Remove swatch Ink'));
check('current colour can be saved as a swatch', colorHtml.includes('Save this colour'));
check('done sits in the sheet header', colorHtml.includes('aria-label="Done"'));

/* -------------------------------- Menu -------------------------------- */
console.log('Menu');
const menuHtml = renderToStaticMarkup(
  <AppMenu
    open
    onClose={noop}
    projectName="Logo"
    onSave={noop}
    onOpenBackup={noop}
    storageHint="Not protected — keep a backup"
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
check('menu offers full backup', menuHtml.includes('Backup &amp; restore') && menuHtml.includes('keep a backup'));
check('no duplicate grid toggles in menu', !menuHtml.includes('Snap to grid'));

/* -------------------------------- Backup -------------------------------- */
console.log('Backup panel');
const backupHtml = renderToStaticMarkup(
  <BackupSheet
    open
    onClose={noop}
    protection="denied"
    onProtect={async () => {}}
    onExport={async () => {}}
    onRestore={async () => {}}
  />
);
check('backup offers export and restore', backupHtml.includes('Export backup') && backupHtml.includes('Restore backup'));
check('backup warns when storage is unprotected', backupHtml.includes('Best effort only') && backupHtml.includes('Protect storage'));
check('backup explains restore keeps unrelated records', backupHtml.includes('Existing records not in the backup stay'));

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
