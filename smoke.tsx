/**
 * Render-level smoke test for the new canvas features.
 * Run: bun smoke.tsx
 */
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Canvas } from './src/components/Canvas';
import { ToolDock } from './src/components/ToolDock';
import { ToolOptions } from './src/components/ToolOptions';
import { TextSheet } from './src/components/TextSheet';
import { TopBar } from './src/components/TopBar';
import { FontsSheet } from './src/components/FontsSheet';
import { fitBezierPath } from './src/utils/curveFit';
import {
  compoundFromContours,
  fromVectorPaths,
  signedArea,
  toSVGPathData,
  toVectorPaths,
} from './src/utils/compoundPath';
import { simplifyAndFitCurves } from './src/utils/simplifyAndFit';
import { CanvasSettingsSheet } from './src/components/CanvasSettingsSheet';
import { ColorSheet } from './src/components/ColorSheet';
import { AppMenu } from './src/components/AppMenu';
import { BackupSheet } from './src/components/BackupSheet';
import { HelpSheet } from './src/components/HelpSheet';
import { ExportSheet } from './src/components/ExportSheet';
import { offsetPaths } from './src/utils/offsetPath';
import { splitPathsIntoGrid } from './src/utils/gridSplit';
import {
  computeAtomicSubRegions,
  executeShapeBuilderMerge,
  regionUnionOutline,
} from './src/utils/shapeBuilderRegions';
import { patternFromSwatch, patternLayout, syncPatternInstances } from './src/utils/effects';
import type { WarpSpec } from './src/utils/warp';
import {
  applyShapeWarp,
  clearShapeWarp,
  WARP_KINDS,
  warpPaths,
  warpPathsInBox,
  warpPoint,
} from './src/utils/warp';
import { warpLocalMatrix } from './src/utils/warpMath';
import { PathAlignThumb, WarpThumb } from './src/components/EffectPreviews';
import { warpFold } from './src/utils/warpFold';
import { reversedAnchors, textPathDy } from './src/utils/textPath';
import { measureTextMetrics, textWorldBox, textLineHeight } from './src/utils/textGeometry';
import { textInShapeLayout } from './src/utils/textInShape';
import {
  textWarpBounds,
  warpTextGlyphs,
  warpTextPlacements,
} from './src/utils/textWarp';
import { generateSvgCode } from './src/utils/svgExport';
import { generateProjectThumbnailSvg } from './src/utils/thumbnailGenerator';
import {
  computePathsBoundingBox,
  copyPathsWithNewIds,
  scalePaths,
  translatePaths,
} from './src/utils/transform';
import { alignPaths, distributePaths } from './src/utils/align';
import {
  expandTextToVectorPaths,
  traceImageToVectorPaths,
  fitSmoothBezierCurves,
  traceFieldRegions,
} from './src/utils/contourTracer';
import { registerOutlineFont, textOutlineSource, fontOutlinePaths, outlineFontWeight } from './src/utils/fontOutlines';
import { outlineLayoutText } from './src/utils/textOutlineConversion';
import opentype from 'opentype.js';
import { pathToSvgD, roundPathCorners, sampleCubicBezier, simplifyPath } from './src/utils/bezier';
import { computeSelectionOverlapD } from './src/utils/overlap';
import {
  sanitizeClipReferences,
  withClipSources,
  withClipSourcesForExport,
} from './src/utils/clipping';
import {
  extrudeLightAngle,
  extrusionFaces,
  extrusionFrontPath,
  extrusionShadow,
  extrusionSheen,
  includeExtrusionInBounds,
} from './src/utils/extrusion';
import {
  computeVisiblePathsBoundingBox,
  executeBooleanOperation,
} from './src/utils/shapeBuilder';
import { defaultGradient, gradientCss, gradientCoords } from './src/utils/gradients';
import { Layer, SelectionState, VectorPath, PatternFill, PatternSwatch} from './src/types/vector';

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
  onExtrudeTilt: noop,
  onExtrudeTurn: noop,
  onExtrudePerspective: noop,
  onExtrudeShadow: noop,
  onSimplify: noop,
  onExitPan: noop,
  onAlign: noop,
  onDistribute: noop,
  onSplitGrid: noop,
  onOffsetPath: noop,
  onBlurSelection: noop,
  onPattern: noop,
  onClearPattern: noop,
  onExtrudeBevel: noop,
  onExtrudeBevelStyle: noop,
  onExtrudeLight: noop,
  onExtrudeGloss: noop,
  onExtrudeShadowSoft: noop,
  onExtrudeShadowLift: noop,
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

const photoPath: VectorPath = {
  ...squarePath,
  id: 'photo',
  fill: 'none',
  stroke: 'none',
  strokeWidth: 0,
  image: { url: 'data:image/png;base64,iVBORw0KGgo=', width: 400, height: 400 },
};
const photoSvg = generateSvgCode(
  [{ id: 'photo-layer', name: 'Photo', visible: true, locked: false, opacity: 1, paths: [photoPath] }],
  { width: 600, height: 600, includeBackground: false, backgroundColor: 'transparent' },
  { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 }
);
check(
  'image paint exports cropped to its own shape',
  photoSvg.includes('<image href="data:image/png') &&
    photoSvg.includes('<clipPath id="pentix-image-photo"') &&
    photoSvg.includes('clip-path="url(#pentix-image-photo)"'),
  photoSvg.slice(0, 200)
);
check('image paint replaces the shape fill instead of stacking on it', !photoSvg.includes('fill="#'));

const blurOpts = {
  width: 600,
  height: 600,
  includeBackground: false,
  backgroundColor: 'transparent',
} as const;
const pressure = { source: 'fixed', minWidth: 2, maxWidth: 10, smoothing: 0.5, calligraphyAngle: 0 } as const;
const gaussianSvg = generateSvgCode(
  [
    {
      id: 'blur-layer',
      name: 'Blur',
      visible: true,
      locked: false,
      opacity: 1,
      paths: [{ ...squarePath, id: 'soft', blur: { kind: 'gaussian', amount: 8, angle: 0 } }],
    },
  ],
  blurOpts,
  pressure
);
check(
  'gaussian blur exports as a filter on the object',
  gaussianSvg.includes('id="pentix-blur-soft"') &&
    gaussianSvg.includes('stdDeviation="8.00 8.00"') &&
    gaussianSvg.includes('filter="url(#pentix-blur-soft)"'),
  gaussianSvg.slice(0, 160)
);
const motionSvg = generateSvgCode(
  [
    {
      id: 'motion-layer',
      name: 'Motion',
      visible: true,
      locked: false,
      opacity: 1,
      paths: [{ ...squarePath, id: 'smear', blur: { kind: 'motion', amount: 20, angle: 0 } }],
    },
  ],
  blurOpts,
  pressure
);
check(
  'motion blur smears along its angle',
  motionSvg.includes('stdDeviation="20.00 0.01"') && motionSvg.includes('id="pentix-blur-smear"'),
  motionSvg.slice(0, 160)
);
const patternSvg = generateSvgCode(
  [
    {
      id: 'pattern-layer',
      name: 'Pattern',
      visible: true,
      locked: false,
      opacity: 1,
      paths: [
        {
          ...squarePath,
          id: 'tiled',
          pattern: {
            paths: [{ ...squarePath, id: 'tile', fill: '#112233' }],
            tileW: 200,
            tileH: 200,
            scale: 0.5,
            rotation: 0,
          },
        },
      ],
    },
  ],
  blurOpts,
  pressure
);
check(
  'pattern fill exports a tile and paints with it',
  patternSvg.includes('<pattern id="pentix-pattern-tiled"') &&
    patternSvg.includes('width="100.00" height="100.00"') &&
    patternSvg.includes('fill="url(#pentix-pattern-tiled)"'),
  patternSvg.slice(0, 220)
);

// The preview rectangle sits on the canvas so the tiling can be judged, but it
// is scaffolding: a file or a project card must show the artwork alone.
const previewRect: VectorPath = {
  ...squarePath,
  id: 'pattern-preview-1',
  name: 'Pattern preview',
  pattern: {
    paths: [{ ...squarePath, id: 'tile', fill: '#112233' }],
    tileW: 200,
    tileH: 200,
    scale: 0.5,
    rotation: 0,
  },
};
const withPreview: Layer[] = [
  {
    id: 'preview-layer',
    name: 'Preview',
    visible: true,
    locked: false,
    opacity: 1,
    paths: [{ ...squarePath, id: 'artwork', fill: '#445566' }, previewRect],
  },
];
const previewExport = generateSvgCode(withPreview, blurOpts, pressure);
check(
  'the pattern preview never reaches an export',
  previewExport.includes('id="path-artwork"') &&
    !previewExport.includes('pattern-preview-1') &&
    !previewExport.includes('pentix-pattern-pattern-preview-1'),
  previewExport.slice(0, 200)
);
const previewThumb = generateProjectThumbnailSvg(withPreview);
check(
  'the pattern preview stays off project cards',
  // Thumbnails paint paths without ids, so prove the artwork is there and the
  // tiled rectangle is not.
  previewThumb.includes('pentix-grad-artwork') &&
    !previewThumb.includes('#112233') &&
    !previewThumb.includes('pattern-preview-1')
);

/* ------------------------- Type in shape (area type) ------------------------- */
console.log('Text in shape');
const areaCircle: VectorPath = {
  ...squarePath,
  id: 'area-circle',
  points: Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2;
    return {
      id: `area-circle-${index}`,
      x: 200 + Math.cos(angle) * 100,
      y: 200 + Math.sin(angle) * 100,
      type: 'corner' as const,
    };
  }),
  closed: true,
};
const areaLabel: VectorPath = {
  ...squarePath,
  id: 'area-label',
  text: 'Pentix school of art badge',
  textPath: undefined,
  warp: undefined,
  fontSize: 18,
  letterSpacing: 0,
  points: [{ id: 'area-anchor', x: 0, y: 0, type: 'corner' }],
  closed: false,
};
const areaLayout = textInShapeLayout(areaCircle, areaLabel, areaLabel.text!);
check('a circle wraps a sentence onto several lines', !!areaLayout && areaLayout.lines.length >= 3, JSON.stringify(areaLayout?.lines));
check('wrapping keeps every word in order', areaLayout?.lines.join(' ') === areaLabel.text, areaLayout?.lines.join(' '));
check(
  'every wrapped line stays inside the circle',
  !!areaLayout &&
    areaLayout.lines.every((line, index) => {
      const width = measureTextMetrics({
        text: line,
        fontSize: 18,
        fontFamily: areaLabel.fontFamily,
        fontWeight: areaLabel.fontWeight,
        letterSpacing: 0,
      }).width;
      const left = areaLayout.originX + (areaLayout.lineX[index] ?? 0);
      return left >= 99 && left + width <= 301;
    }),
  JSON.stringify(areaLayout?.lines.map((line, index) => [areaLayout?.lineX[index], line]))
);
check(
  'the block starts near the top of the shape',
  !!areaLayout && areaLayout.baseline > 100 && areaLayout.baseline < 200
);

const warpBox = { minX: 0, minY: 0, width: 100, height: 100 };
// An arch is a real circular bend: the bottom edge bows up by the amount in
// the middle, both ends stay pinned, and the letters turn with the curve.
const archBase = (x: number) => warpPoint(x, 100, warpBox, { kind: 'arch', amount: 20 }).y;
// The bend's circle runs a little past the box, so the ends lift slightly
// instead of sitting dead on the pivot — that margin is what keeps the outer
// letters from peeling away from the rest.
check(
  'arch warp lifts the middle far more than the ends',
  Math.abs(archBase(50) - 80) < 1e-9 &&
    archBase(0) > archBase(50) + 10 &&
    archBase(100) > archBase(50) + 10 &&
    Math.abs(archBase(0) - archBase(100)) < 1e-6,
  `${archBase(0)} / ${archBase(50)} / ${archBase(100)}`
);
check(
  'arch turns the letters at the ends so the word bends',
  Math.abs(warpLocalMatrix(2, 100, warpBox, { kind: 'arch', amount: 20 }).b) > 0.2 &&
    Math.abs(warpLocalMatrix(50, 100, warpBox, { kind: 'arch', amount: 20 }).b) < 0.01
);
check(
  'wave warp oscillates across the selection',
  Math.abs(warpPoint(25, 50, warpBox, { kind: 'wave', amount: 40, cycles: 1 }).y - 70) < 0.001
);
check(
  'bulge warp pushes the rim outward',
  warpPoint(75, 50, warpBox, { kind: 'bulge', amount: 25 }).x > 76
);
check(
  'slant warp narrows one edge into perspective',
  Math.abs(warpPoint(0, 0, warpBox, { kind: 'perspective', amount: 50 }).x - 25) < 0.001
);
const warpDensePath: VectorPath = {
  ...squarePath,
  id: 'dense',
  closed: false,
  points: [
    { id: 'dense-0', x: 0, y: 0, type: 'corner' },
    { id: 'dense-1', x: 50, y: 0, type: 'corner' },
    { id: 'dense-2', x: 100, y: 0, type: 'corner' },
  ],
};
const warpedDense = warpPaths([warpDensePath], { kind: 'arch', amount: 20 })[0];
check(
  'warp bakes into the points',
  Math.abs(warpedDense.points[1].y + 20) < 0.001 &&
    warpedDense.points[0].y > warpedDense.points[1].y + 10 &&
    Math.abs(warpedDense.points[0].y - warpedDense.points[2].y) < 1e-6 &&
    Math.abs(warpedDense.points[1].x - 50) < 0.001,
  JSON.stringify(warpedDense.points.map((point) => [point.x, point.y]))
);

const curvePath: VectorPath = { ...squarePath, id: 'curve', fill: 'none', stroke: 'none' };
const captionPath: VectorPath = {
  ...squarePath,
  id: 'caption',
  text: 'PENTIX',
  stroke: 'none',
  fill: '#ffffff',
  points: [{ id: 'caption-0', x: 10, y: 20, type: 'corner' }],
  textPath: { pathId: 'curve', offset: 10 },
};
const captionSvg = generateSvgCode(
  [
    {
      id: 'caption-layer',
      name: 'Caption',
      visible: true,
      locked: false,
      opacity: 1,
      paths: [curvePath, captionPath],
    },
  ],
  blurOpts,
  pressure
);
check(
  'type on a path exports a textPath over its outline',
  captionSvg.includes('<textPath href="#pentix-textpath-caption"') &&
    captionSvg.includes('startOffset="10.00%"') &&
    captionSvg.includes('id="pentix-textpath-caption"'),
  captionSvg.slice(0, 200)
);

const gridTile = { ...squarePath, id: 'grid-tile', fill: '#112233' };
const gridFill: PatternFill = {
  paths: [gridTile],
  tileW: 100,
  tileH: 100,
  scale: 1,
  rotation: 0,
  spacing: 10,
};
const gridLayout = patternLayout(gridFill);
check(
  'grid tiling sizes the box from the tile plus spacing',
  gridLayout.width === 110 && gridLayout.height === 110 && gridLayout.copies.length === 1
);
const brickLayout = patternLayout({ ...gridFill, tileType: 'brick-row' });
check(
  'brick tiling uses a w x 2h cell with a half-tile stagger',
  brickLayout.width === 110 &&
    brickLayout.height === 220 &&
    brickLayout.copies.some((c) => Math.abs(c.dx - 55) < 0.01 && Math.abs(c.dy - 110) < 0.01) &&
    brickLayout.copies.some((c) => Math.abs(c.dx + 55) < 0.01 && Math.abs(c.dy - 110) < 0.01)
);
const columnLayout = patternLayout({ ...gridFill, tileType: 'brick-column' });
check(
  'column tiling staggers sideways instead',
  columnLayout.width === 220 &&
    columnLayout.height === 110 &&
    columnLayout.copies.some((c) => Math.abs(c.dx - 110) < 0.01 && Math.abs(c.dy - 55) < 0.01) &&
    columnLayout.copies.some((c) => Math.abs(c.dx - 110) < 0.01 && Math.abs(c.dy + 55) < 0.01)
);
const brickSvg = generateSvgCode(
  [
    {
      id: 'brick-layer',
      name: 'Brick',
      visible: true,
      locked: false,
      opacity: 1,
      paths: [{ ...squarePath, id: 'brick', pattern: { ...gridFill, tileType: 'brick-row' } }],
    },
  ],
  blurOpts,
  pressure
);
check(
  'brick pattern exports wrapped copies, padded artwork and a pivoted rotation',
  (brickSvg.match(/<path d=/g) ?? []).length >= 3 &&
    brickSvg.includes('translate(-50.00 115.00)') &&
    brickSvg.includes('<g transform="scale(1.0000)">') &&
    /patternTransform="translate\([^)]*\) rotate\(0 /.test(brickSvg),
  brickSvg.slice(0, 240)
);
check(
  'pattern scale grows the tile artwork, not just the gap between tiles',
  (() => {
    const base = {
      paths: [squarePath],
      tileW: 100,
      tileH: 100,
      scale: 1,
      rotation: 0,
      tileType: 'grid' as const,
    };
    const one = patternLayout(base);
    const two = patternLayout({ ...base, scale: 2 });
    return (
      two.scale === 2 &&
      Math.abs(two.width - one.width * 2) < 0.001 &&
      two.copies.length === one.copies.length &&
      Math.abs(two.centerX - two.width / 2) < 0.001
    );
  })()
);
check(
  'shifted text on a path exports its baseline nudge',
  (() => {
    const nudged = generateSvgCode(
      [
        {
          id: 'nudge-layer',
          name: 'Nudge',
          visible: true,
          locked: false,
          opacity: 1,
          paths: [
            { ...squarePath, id: 'nudge-path', fill: 'none', stroke: 'none' },
            {
              ...squarePath,
              id: 'nudge-text',
              text: 'PENTIX',
              fill: '#ffffff',
              stroke: 'none',
              points: [{ id: 'nudge-0', x: 10, y: 20, type: 'corner' }],
              textPath: { pathId: 'nudge-path', offset: 0, baselineOffset: 12 },
            },
          ],
        },
      ],
      blurOpts,
      pressure
    );
    return nudged.includes('dy="12.00"');
  })()
);

const librarySwatch: PatternSwatch = {
  id: 'sw-lib',
  name: 'Library',
  paths: [{ ...squarePath, id: 'lib-tile', fill: '#112233' }],
  tileW: 100,
  tileH: 100,
  tileType: 'brick-row',
  spacing: 4,
};
const libraryFill = patternFromSwatch(librarySwatch, { scale: 2 });
check(
  'a swatch stamps its tile and settings onto a fill',
  libraryFill.swatchId === 'sw-lib' &&
    libraryFill.tileType === 'brick-row' &&
    libraryFill.scale === 2 &&
    libraryFill.paths.length === 1 &&
    libraryFill.spacing === 4
);
const linkedLayers: Layer[] = [
  {
    id: 'linked',
    name: 'Linked',
    visible: true,
    locked: false,
    opacity: 1,
    paths: [{ ...squarePath, id: 'p-linked', pattern: patternFromSwatch(librarySwatch) }],
  },
];
const editedLayers = syncPatternInstances(linkedLayers, [
  { ...librarySwatch, tileW: 50, tileType: 'grid', spacing: 0 },
]);
check(
  'editing a swatch repaints every shape that uses it',
  editedLayers[0].paths[0].pattern?.tileW === 50 &&
    editedLayers[0].paths[0].pattern?.tileType === 'grid' &&
    editedLayers[0].paths[0].pattern?.spacing === 0
);
const clearedLayers = syncPatternInstances(linkedLayers, []);
check('deleting a swatch clears the fills that used it', clearedLayers[0].paths[0].pattern === undefined);
const unlinkedLayers: Layer[] = [
  {
    id: 'unlinked',
    name: 'Unlinked',
    visible: true,
    locked: false,
    opacity: 1,
    paths: [
      {
        ...squarePath,
        id: 'p-legacy',
        pattern: { ...patternFromSwatch(librarySwatch), swatchId: undefined },
      },
    ],
  },
];
check(
  'a fill with no swatch link keeps its embedded tile',
  !!syncPatternInstances(unlinkedLayers, [])[0].paths[0].pattern
);
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
  '3D walls merge into shaded facets instead of one path per edge',
  wallFills.size >= 3 && wallFaces.length <= 24,
  `faces=${wallFaces.length} shades=${wallFills.size}`
);
check(
  '3D walls shade between a lit edge and a shaded one',
  (Math.max(...wallOnlyLums) - Math.min(...wallOnlyLums)) / Math.max(...wallOnlyLums) > 0.25,
  `range=${Math.min(...wallOnlyLums).toFixed(2)}..${Math.max(...wallOnlyLums).toFixed(2)}`
);
// One edge is visible on a flat bar pulled straight down. It must come out as a
// single facet: bands of tone across the depth are what look like stacked sheets.
const barPoints = [
  { id: 'bar-0', x: 100, y: 100, type: 'corner' as const },
  { id: 'bar-1', x: 400, y: 100, type: 'corner' as const },
  { id: 'bar-2', x: 400, y: 110, type: 'corner' as const },
  { id: 'bar-3', x: 100, y: 110, type: 'corner' as const },
];
const barPath: VectorPath = {
  ...squarePath,
  id: 'bar',
  points: barPoints,
  extrudeDepth: 36,
  extrudeAngle: 0,
};
const barFaces = extrusionFaces(barPath);
const barWallLums = barFaces
  .filter((f) => f.part === 'wall')
  .map((f) => luminanceOf(f.fill));
check(
  '3D wall is one continuous facet, not a stack of depth bands',
  barWallLums.length === 1,
  `wallFaces=${barWallLums.length}`
);
const bevelLums = barFaces.filter((f) => f.part === 'bevel').map((f) => luminanceOf(f.fill));
// The chamfer is a turned edge: it has to roll from a dark side into a lit one
// rather than reading as a flat, always-bright outline.
check(
  '3D chamfers the front rim',
  bevelLums.length >= 2 &&
    Math.max(...bevelLums) > Math.min(...bevelLums) * 1.15 &&
    Math.max(...bevelLums) > faceLum * 0.75,
  `bevelFaces=${bevelLums.length} range=${Math.min(...bevelLums).toFixed(2)}..${Math.max(...bevelLums).toFixed(2)}`
);
check(
  '3D bevel can be turned off',
  extrusionFaces({ ...barPath, id: 'bar-flat', extrudeBevel: 0 }).every((f) => f.part !== 'bevel')
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
const starWallQuads = starFaces
  .filter((f) => f.part === 'wall')
  .reduce((n, f) => n + (f.d.match(/M /g)?.length ?? 0), 0);
// One quad per surviving wall: all ten edges would be 10, so a lower count
// proves the hidden-line cull still drops the far walls.
check(
  '3D culls the walls hidden behind the face',
  starWallQuads > 0 && starWallQuads < 10,
  `wallQuads=${starWallQuads} for 10 edges`
);
const shadowOn = extrusionShadow({ ...extrudedPath, extrudeShadow: true });
check(
  '3D casts a soft shadow',
  !!shadowOn && shadowOn.blur > 1 && shadowOn.opacity > 0.1 && shadowOn.d.length > 10,
  shadowOn ? `blur=${shadowOn.blur.toFixed(1)}` : 'missing'
);
// The solid is a card tipped back in space: the face has to foreshorten along
// the pull, or the object reads as a flat shape with a thick edge behind it.
const projectBox = (d: string) => {
  const points = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
  };
};

// No bevel here: a chamfer insets the face, which is a different question from
// foreshortening, and the numbers are only clean on the bare rectangle.
const uprightPath: VectorPath = {
  ...squarePath,
  id: 'upright',
  extrudeDepth: 40,
  extrudeAngle: 0,
  extrudeBevel: 0,
};
const uprightBox = computePathsBoundingBox([uprightPath])!;
check(
  'a face with no tilt is still the artwork',
  extrusionFrontPath({ ...uprightPath, extrudeTilt: 0 }) === null
);
// Orthographic for the exact invariants: a perspective divide would shrink the
// far side of the face and no longer land on width × cos(tilt) to the pixel.
const orthoUpright: VectorPath = { ...uprightPath, extrudePerspective: 0 };
const tiltedFace = extrusionFrontPath({ ...orthoUpright, extrudeTilt: 60 });
check('a tilted solid paints its own face', !!tiltedFace);
if (tiltedFace) {
  const box = projectBox(tiltedFace);
  const squash = Math.cos((60 * Math.PI) / 180);
  check(
    'tilt foreshortens the face along the pull and nowhere else',
    Math.abs(box.width - uprightBox.width * squash) < 0.6 &&
      Math.abs(box.height - uprightBox.height) < 0.6,
    `${box.width.toFixed(1)}×${box.height.toFixed(1)}`
  );
}

// Depth shows as depth × sin(tilt): a card laid flat has nothing to show.
// Taper off: it shrinks the back face toward the centre, which would show up
// in this measurement as a shorter reach than the depth provides.
const uprightShadow = extrusionShadow({ ...orthoUpright, extrudeTilt: 60, extrudeTaper: 0 });
if (uprightShadow && tiltedFace) {
  const face = projectBox(tiltedFace);
  const back = projectBox(uprightShadow.d);
  const expected = 40 * Math.sin((60 * Math.PI) / 180);
  check(
    'the back face travels depth × sin(tilt) along the pull',
    Math.abs((back.maxX - face.maxX) - expected) < 1.2,
    `reach=${(back.maxX - face.maxX).toFixed(1)} expected=${expected.toFixed(1)}`
  );
}

// The turn is the second axis: it foreshortens across the vertical, and it is
// what brings one side of the solid toward the viewer.
const turnedFace = extrusionFrontPath({ ...orthoUpright, extrudeTilt: 0, extrudeTurn: 40 });
if (turnedFace) {
  const box = projectBox(turnedFace);
  check(
    'turn foreshortens across the vertical axis and leaves height alone',
    Math.abs(box.width - uprightBox.width * Math.cos((40 * Math.PI) / 180)) < 0.6 &&
      Math.abs(box.height - uprightBox.height) < 0.6,
    `${box.width.toFixed(1)}×${box.height.toFixed(1)}`
  );
}
const turnedBack = extrusionShadow({
  ...orthoUpright,
  extrudeTilt: 0,
  extrudeTurn: 40,
  extrudeTaper: 0,
});
check(
  'turn alone shows the depth sideways instead of hiding it',
  !!turnedBack && projectBox(turnedBack.d).maxX > uprightBox.maxX + 5,
  turnedBack ? projectBox(turnedBack.d).maxX.toFixed(1) : 'null'
);

// A tilt with perspective on must keystone: the near edge is taller than the
// far one, which is the giveaway that the camera is real and not a squash.
const keystoned = extrusionFrontPath({ ...uprightPath, extrudeTilt: 60, extrudePerspective: 0.9 });
if (keystoned) {
  const box = projectBox(keystoned);
  const ortho = projectBox(tiltedFace!);
  check(
    'perspective keystones the face instead of only squashing it',
    box.height > ortho.height + 4 && Math.abs(box.width - ortho.width) < 6,
    `${box.width.toFixed(1)}×${box.height.toFixed(1)} vs ${ortho.width.toFixed(1)}×${ortho.height.toFixed(1)}`
  );
}

check(
  'the key light stays in the room when the direction turns',
  extrudeLightAngle({ ...uprightPath, extrudeAngle: 10 }) ===
    extrudeLightAngle({ ...uprightPath, extrudeAngle: 250 }) &&
    extrudeLightAngle(uprightPath) === 305
);

check('3D keeps a shadow by default', extrusionShadow(extrudedPath) !== null);
check(
  '3D front face catches the light',
  extrusionSheen(barPath) !== null && extrusionSheen({ ...barPath, extrudeDepth: 0 }) === null
);
check('3D export paints the same light', extrudeSvg.includes('extrude-sheen-extruded'));
check(
  '3D thumbnail paints the same light',
  generateProjectThumbnailSvg(extrudeLayers).includes('extrude-sheen-extruded')
);
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
// Counts are not compared: the rim is bucketed by facing, so the number of tone
// groups legitimately changes with the direction. The walls themselves must.
check(
  '3D direction turns the walls',
  turnedWalls.filter((face) => face.part === 'wall').length ===
    wallFaces.filter((face) => face.part === 'wall').length &&
    turnedWalls.find((face) => face.part === 'wall')!.d !==
      wallFaces.find((face) => face.part === 'wall')!.d
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

const offsetSquare = offsetPaths(
  [
    {
      id: 'offset-square',
      name: 'Square',
      points: [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 },
        { id: 'c', x: 100, y: 100 },
        { id: 'd', x: 0, y: 100 },
      ],
      closed: true,
      fill: '#4c8dff',
      stroke: 'none',
      strokeWidth: 0,
    } as VectorPath,
  ],
  10
)[0];
check(
  'offset path grows the outline by exactly the distance',
  Math.max(...offsetSquare.points.map((p) => p.x)) === 110 &&
    Math.min(...offsetSquare.points.map((p) => p.y)) === -10,
  `maxX=${Math.max(...offsetSquare.points.map((p) => p.x))}`
);
// The cut has to leave a real seam: cells cut flush share a fill and read as one
// object, which is why the gap is carried all the way through the split call.
const gutterBase: VectorPath = {
  ...squarePath,
  id: 'gutter-base',
  points: [
    { id: 'g0', x: 0, y: 0, type: 'corner' },
    { id: 'g1', x: 200, y: 0, type: 'corner' },
    { id: 'g2', x: 200, y: 200, type: 'corner' },
    { id: 'g3', x: 0, y: 200, type: 'corner' },
  ],
  closed: true,
};
const gutterPieces = splitPathsIntoGrid([gutterBase], [gutterBase], {
  rows: 2,
  cols: 2,
  gutter: 4,
});
const pieceWidth = Math.max(...(gutterPieces[0]?.points ?? []).map((p) => p.x)) -
  Math.min(...(gutterPieces[0]?.points ?? []).map((p) => p.x));
check(
  'split grid leaves the gap that was asked for',
  gutterPieces.length === 4 && Math.abs(pieceWidth - 96) < 0.01,
  `cells=${gutterPieces.length} width=${pieceWidth.toFixed(2)} (want 96 = 200/2 - 4)`
);

// Building a logo out of a grid split: cells cut flush share their edges, so the
// shape builder can dissolve them into one silhouette. A gap is what stops that,
// which is why the panel warns about it.
const flushPieces = splitPathsIntoGrid([gutterBase], [gutterBase], {
  rows: 2,
  cols: 2,
  gutter: 0,
});
const flushRegions = computeAtomicSubRegions(flushPieces, flushPieces);
const flushMerged = executeShapeBuilderMerge(
  flushRegions.map((region) => region.id),
  flushRegions,
  flushPieces,
  { fill: '#4c8dff', stroke: 'none', strokeWidth: 0 }
);
check(
  'flush split cells merge back into one shape',
  flushRegions.length === 4 && flushMerged.length === 1 && flushMerged[0].points.length >= 4,
  `regions=${flushRegions.length} merged=${flushMerged.length}`
);

// Shape Builder used to show only the region under the cursor, so the shape you
// were building was invisible until the mouse came up. The union outline is that
// result, drawn live: one continuous ring for a merge, not one per region.
const sbA: VectorPath = {
  ...squarePath,
  id: 'sb-a',
  points: [
    { id: 'a0', x: 0, y: 0, type: 'corner' },
    { id: 'a1', x: 100, y: 0, type: 'corner' },
    { id: 'a2', x: 100, y: 100, type: 'corner' },
    { id: 'a3', x: 0, y: 100, type: 'corner' },
  ],
  closed: true,
};
const sbB: VectorPath = {
  ...sbA,
  id: 'sb-b',
  points: sbA.points.map((p, i) => ({ ...p, id: `b${i}`, x: p.x + 50, y: p.y + 50 })),
};
const sbRegions = computeAtomicSubRegions([sbA, sbB], [sbA, sbB]);
const sbIds = sbRegions.map((region) => region.id);
const sbUnionD = regionUnionOutline(sbRegions, sbIds);
check(
  'shape builder previews the merged result before release',
  sbRegions.length >= 3 &&
    sbUnionD.length > 0 &&
    (sbUnionD.match(/M /g)?.length ?? 0) === 1 &&
    regionUnionOutline(sbRegions, [sbIds[0]]) === '',
  `regions=${sbRegions.length} outlineRings=${(sbUnionD.match(/M /g)?.length ?? 0)}`
);

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
// The depth slices triple the wall quads, so the cap triples with them.
check('dense extrusion geometry stays bounded', denseQuads <= 240 * 3, `quads=${denseQuads}`);
check('dense extrusion builds without stalling', denseMs < 120, `${denseMs.toFixed(1)}ms`);
const ringHole = squarePath.points.map((p) => ({ ...p, id: `ring-${p.id}`, x: p.x * 0.4 + 30, y: p.y * 0.4 + 30 }));
const plainQuads = wallFaces.reduce((n, f) => n + (f.d.match(/M /g)?.length ?? 0), 0);
const ringQuads = extrusionFaces({ ...extrudedPath, id: 'ring', holes: [ringHole] }).reduce(
  (n, f) => n + (f.d.match(/M /g)?.length ?? 0),
  0
);
check('extrusion adds walls inside counter holes', ringQuads > plainQuads, `${plainQuads}->${ringQuads}`);
const ringFaces = extrusionFaces({ ...extrudedPath, id: 'ring-open', holes: [ringHole] });
const ringCap = ringFaces.find((f) => f.part === 'cap');
const ringCapSubpaths = ringCap?.d.match(/Z/g)?.length ?? 0;
check(
  '3D counters stay open through the solid',
  ringCapSubpaths === 2,
  `capSubpaths=${ringCapSubpaths}`
);
const litOneWay = extrusionFaces({ ...barPath, id: 'light-a', extrudeLight: 0 });
const litOtherWay = extrusionFaces({ ...barPath, id: 'light-b', extrudeLight: 180 });
check(
  '3D light direction moves the shading',
  litOneWay.map((f) => f.fill).join() !== litOtherWay.map((f) => f.fill).join()
);
const roundRim = extrusionFaces({ ...barPath, id: 'round-rim', extrudeBevelStyle: 'round' });
check(
  '3D round rim adds rings to the edge',
  roundRim.filter((f) => f.part === 'bevel').length >
    barFaces.filter((f) => f.part === 'bevel').length
);
const softShadow = extrusionShadow({
  ...extrudedPath,
  id: 'soft-shadow',
  extrudeShadowSoft: 2,
  extrudeShadowLift: 1.5,
});
const hardShadow = extrusionShadow({ ...extrudedPath, id: 'hard-shadow', extrudeShadowSoft: 0.5 });
check(
  '3D shadow softness and distance are adjustable',
  !!softShadow &&
    !!hardShadow &&
    softShadow.blur > hardShadow.blur &&
    softShadow.dx > extrusionShadow(extrudedPath)!.dx,
  softShadow ? `blur=${softShadow.blur.toFixed(1)} dx=${softShadow.dx.toFixed(1)}` : 'missing'
);
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
    gridVisible={false}
    onToggleGrid={noop}
    onOpenExport={noop}
    onPreview={noop}
  />
);
check('top bar offers artboard preview', topBarHtml.includes('aria-label="Preview artboard"'));
check('top bar toggles the grid in one tap', topBarHtml.includes('aria-label="Alignment grid"'));
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
  'traced output can be scaled back to artboard units',
  (() => {
    const imageData = { width: FW, height: FH, data: new Uint8ClampedArray(FW * FH * 4) } as ImageData;
    for (let i = 0; i < FW * FH; i++) {
      const coverage = discField[i];
      const level = Math.round((1 - coverage) * 255);
      imageData.data[i * 4] = level;
      imageData.data[i * 4 + 1] = level;
      imageData.data[i * 4 + 2] = level;
      imageData.data[i * 4 + 3] = 255;
    }
    const unit = traceImageToVectorPaths(imageData, { outputScale: 1 });
    const half = traceImageToVectorPaths(imageData, { outputScale: 0.5 });
    const span = (paths: VectorPath[]) => {
      const xs = paths.flatMap((path) => path.points.map((point) => point.x));
      return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    };
    const first = span(unit);
    const second = span(half);
    return first > 1 && Math.abs(second - first / 2) < 0.5;
  })()
);

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
    guidesVisible
    onToggleGuides={noop}
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
check('guides can be hidden without deleting them', sheetHtml.includes('aria-label="Show guides"'));
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
    onOpenPatterns={noop}
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

check(
  'warp bends outlined letterforms and keeps every path',
  (() => {
    // Headless runs have no glyph rasteriser, so real letters come back empty
    // here; the browser path uses the letters, this uses the same kind of
    // many-point outline they expand into.
    const letters = expandTextToVectorPaths('A', {
      originX: 0,
      originY: 0,
      fontSize: 64,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontWeight: 'bold',
      letterSpacing: 0,
      fillColor: '#000000',
      strokeColor: 'none',
      strokeWidth: 0,
    });
    const subject = letters.length ? letters : [warpDensePath];
    const spec: WarpSpec = { kind: 'arch', amount: 40 };
    const warped = warpPaths(subject, spec);
    if (warped.length !== subject.length) return false;
    const before = subject.flatMap((path) => path.points);
    const after = warped.flatMap((path) => path.points);
    if (before.length !== after.length) return false;
    return after.some((point, index) => Math.abs(point.y - before[index].y) > 0.5);
  })()
);


/* ------------------------------------------------------------------------ *
 * Non-destructive shape warps
 *
 * The Amount control has to be absolute: 20 after 10 is a 20 bend, not 30, and
 * zero has to put the artwork back. These numbers are the contract, and they
 * cover the preview too — what the artboard draws while dialling must be the
 * geometry Apply writes.
 * ------------------------------------------------------------------------ */
const warpSubject = (id: string): VectorPath =>
  ({
    id,
    name: id,
    points: [
      { id: `${id}-0`, x: 0, y: 0, type: 'corner' },
      { id: `${id}-1`, x: 50, y: 0, type: 'corner' },
      { id: `${id}-2`, x: 100, y: 0, type: 'corner' },
      { id: `${id}-3`, x: 100, y: 100, type: 'corner' },
      { id: `${id}-4`, x: 50, y: 100, type: 'corner' },
      { id: `${id}-5`, x: 0, y: 100, type: 'corner' },
    ],
    closed: true,
    fill: '#ffffff',
    fillOpacity: 1,
    stroke: 'none',
    strokeWidth: 0,
    strokeOpacity: 0,
    strokeCap: 'round',
    strokeJoin: 'round',
    pressureProfile: 'uniform',
  }) as VectorPath;

const maxDrift = (a: VectorPath, b: VectorPath) =>
  Math.max(
    ...a.points.map((point, index) =>
      Math.hypot(point.x - b.points[index].x, point.y - b.points[index].y)
    )
  );

const oneBend = (amount: number) =>
  applyShapeWarp([warpSubject('w')], { kind: 'arch', amount })[0];

check(
  'warp amount is absolute: 10 then 20 is one 20 bend',
  maxDrift(applyShapeWarp([oneBend(10)], { kind: 'arch', amount: 20 })[0], oneBend(20)) < 0.01
);
check(
  'warp amount is absolute when it comes back down: 20 then 10 is one 10 bend',
  maxDrift(applyShapeWarp([oneBend(20)], { kind: 'arch', amount: 10 })[0], oneBend(10)) < 0.01
);
check(
  'zero amount gives the artwork back',
  maxDrift(applyShapeWarp([oneBend(40)], { kind: 'arch', amount: 0 })[0], warpSubject('w')) < 0.01
);
check(
  'removing the warp drops its record',
  clearShapeWarp([oneBend(30)])[0].warpSource === undefined &&
    maxDrift(clearShapeWarp([oneBend(30)])[0], warpSubject('w')) < 0.01
);
check(
  'a bend survives being moved: the next amount bends it where it now is',
  maxDrift(
    applyShapeWarp(translatePaths([oneBend(20)], 120, 0), { kind: 'arch', amount: 30 })[0],
    translatePaths([oneBend(30)], 120, 0)[0]
  ) < 0.01
);
check(
  'an edited bent shape is not snapped back to the old geometry',
  (() => {
    const bent = oneBend(20);
    const edited = { ...bent, points: bent.points.map((point, index) =>
      index === 4 ? { ...point, y: point.y + 25 } : point
    ) };
    const rewarped = applyShapeWarp([edited], { kind: 'arch', amount: 40 })[0];
    // The edit is still in there, so this differs from bending the original.
    return maxDrift(rewarped, oneBend(40)) > 1;
  })()
);
// The bug that made this feel broken: the canvas previewed the shape that was
// already bent while Apply bent the original, so the artboard and the result
// disagreed. Render the real canvas and compare it with what Apply writes.
check(
  'the canvas preview bends the same geometry Apply commits',
  (() => {
    const bent = oneBend(20);
    const spec: WarpSpec = { kind: 'arch', amount: 40 };
    const layers: Layer[] = [
      { id: 'warp-preview-layer', name: 'Warp', visible: true, locked: false, opacity: 1, paths: [bent] },
    ];
    const html = renderToStaticMarkup(
      <Canvas
        {...canvasProps}
        layers={layers}
        warpPreview={spec}
        selection={{ selectedPathIds: [bent.id], selectedAnchorIndex: null, selectedHandleType: null }}
      />
    );
    const expected = pathToSvgD(applyShapeWarp([bent], spec)[0]);
    return !!expected && html.includes(expected);
  })()
);

check(
  'the preview and Apply agree for a multi-shape selection',
  (() => {
    const shapes = [warpSubject('a'), { ...warpSubject('b'), points: warpSubject('b').points.map((p) => ({ ...p, x: p.x + 150 })) }];
    const spec: WarpSpec = { kind: 'wave', amount: 30, cycles: 2 };
    // Canvas preview: same bases, same shared box, one path at a time.
    const bases = shapes;
    const box = computePathsBoundingBox(bases)!;
    const preview = bases.map((base) => warpPathsInBox([base], box, spec)[0]);
    const applied = applyShapeWarp(shapes, spec);
    return applied.every((path, index) => maxDrift(path, preview[index]) < 0.01);
  })()
);

/* ------------------------------------------------------------------------ *
 * Exact text outlines
 *
 * An imported font is converted from its own file instead of from a picture of
 * it. A font is generated here so the expected numbers are the font's numbers:
 * a stem from (100,0) to (100,700) in a 1000-upem face, scaled to 100px, has to
 * arrive as a point at (10,0) and one at (10,-70) — not somewhere near them.
 * ------------------------------------------------------------------------ */
const probeFontBytes = (() => {
  const stem = new opentype.Path();
  stem.moveTo(100, 0);
  stem.lineTo(100, 700);
  stem.quadraticCurveTo(300, 900, 500, 700);
  stem.lineTo(500, 0);
  stem.closePath();

  const bowl = new opentype.Path();
  bowl.moveTo(600, 0);
  bowl.lineTo(600, 700);
  bowl.lineTo(900, 700);
  bowl.lineTo(900, 0);
  bowl.closePath();
  bowl.moveTo(660, 60);
  bowl.lineTo(660, 640);
  bowl.lineTo(840, 640);
  bowl.lineTo(840, 60);
  bowl.closePath();

  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 620, path: new opentype.Path() }),
    new opentype.Glyph({ name: 'A', unicode: 65, advanceWidth: 620, path: stem }),
    new opentype.Glyph({ name: 'O', unicode: 79, advanceWidth: 360, path: bowl }),
  ];
  return new opentype.Font({
    familyName: 'Probe Sans',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  }).toArrayBuffer();
})();

const probe = registerOutlineFont('Probe Sans', probeFontBytes);
check('an imported font parses into outlines', !!probe, probe ? `weight=${probe.weightClass}` : 'unparsed');

const exactLabel = expandTextToVectorPaths('A', {
  originX: 0,
  originY: 0,
  fontSize: 100,
  fontFamily: 'Probe Sans, sans-serif',
  fontWeight: String(probe?.weightClass ?? 500),
  letterSpacing: 0,
  fillColor: '#000000',
  strokeColor: 'none',
  strokeWidth: 0,
});
check('exact outlines keep the font\'s own nodes', exactLabel.length === 1 && exactLabel[0].points.length === 4, `paths=${exactLabel.length} nodes=${exactLabel[0]?.points.length}`);
check(
  'exact outlines land on the font\'s coordinates',
  !!exactLabel[0] &&
    Math.abs(exactLabel[0].points[0].x - 10) < 0.01 &&
    Math.abs(exactLabel[0].points[1].y + 70) < 0.01 &&
    // opentype hands back its own rounded control points, so compare within
    // the precision the file itself carries rather than inventing more.
    Math.abs((exactLabel[0].points[1].handleOut?.x ?? 0) - 23.3) < 0.01 &&
    Math.abs((exactLabel[0].points[2].handleIn?.y ?? 0) + 83.3) < 0.01,
  JSON.stringify(exactLabel[0]?.points[1])
);

const exactCounter = expandTextToVectorPaths('O', {
  originX: 0,
  originY: 0,
  fontSize: 100,
  fontFamily: 'Probe Sans, sans-serif',
  fontWeight: String(probe?.weightClass ?? 500),
  fillColor: '#000000',
  strokeColor: 'none',
  strokeWidth: 0,
});
check(
  'exact outlines keep the counter as a hole',
  exactCounter.length === 1 && (exactCounter[0].holes?.length ?? 0) === 1,
  `paths=${exactCounter.length} holes=${exactCounter[0]?.holes?.length}`
);

const exactTracking = expandTextToVectorPaths('OA', {
  originX: 0,
  originY: 0,
  fontSize: 100,
  fontFamily: 'Probe Sans, sans-serif',
  fontWeight: String(probe?.weightClass ?? 500),
  letterSpacing: 10,
  fillColor: '#000000',
  strokeColor: 'none',
  strokeWidth: 0,
});
const secondGlyphX = exactTracking[1]?.points.reduce((min, point) => Math.min(min, point.x), Infinity);
check(
  'exact outlines follow the label\'s own tracking',
  // O advances 36px and the label adds 10px of tracking; A starts 10px in.
  Math.abs((secondGlyphX ?? 0) - 56) < 0.01,
  `x=${secondGlyphX}`
);

check(
  'a readable font file always supplies the outlines, whatever the weight',
  textOutlineSource({ fontFamily: 'Probe Sans, sans-serif', fontWeight: 'bold' }) === 'font' &&
    textOutlineSource({ fontFamily: 'Probe Sans, sans-serif', fontWeight: String(probe?.weightClass) }) === 'font'
);

check(
  'a family with no readable file still falls back to tracing',
  textOutlineSource({ fontFamily: 'Unregistered Display, sans-serif', fontWeight: 'bold' }) === 'trace'
);

// The default family ships with the app, so its type must convert from the
// font's own curves rather than from a traced picture of them.
for (const file of ['Regular', 'Bold']) {
  const bytes = fs.readFileSync(`public/fonts/PlusJakartaSans-${file}.woff`);
  registerOutlineFont(
    'Plus Jakarta Sans',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  );
}
const bundledOutlines = fontOutlinePaths({
  text: 'Pentix',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontWeight: 'bold',
  fontSize: 200,
}) ?? [];
const bundledAnchors = bundledOutlines.reduce(
  (total, path) => total + path.points.length + (path.holes?.reduce((count, hole) => count + hole.length, 0) ?? 0),
  0
);
check(
  'the bundled family converts to the file\u2019s own outlines, not a trace',
  // Six glyphs, seven shapes: P and e keep their counters as holes, and the
  // dot of the i is its own shape. A traced conversion needs hundreds of nodes
  // for the same word.
  bundledOutlines.length >= 6 &&
    bundledOutlines.length <= 8 &&
    bundledAnchors > 40 &&
    bundledAnchors < 220
);
check(
  'a bold label converts from the bold face, not the regular one',
  outlineFontWeight('Plus Jakarta Sans, sans-serif', 'bold') === 700 &&
    outlineFontWeight('Plus Jakarta Sans, sans-serif', 'regular') === 400
);

// Font conversion performs a guarded low-node fit up front, so a freshly
// outlined word is already manageable in node mode. Simplify remains usable
// for a second pass and must never add anchors or remove a glyph counter.
const heaviestGlyph = bundledOutlines.reduce((a, b) => (b.points.length > a.points.length ? b : a));
const simplifiedGlyph = simplifyPath(heaviestGlyph, 0.5);
const anchorTotal = (glyph: VectorPath) =>
  glyph.points.length + (glyph.holes?.reduce((count, hole) => count + hole.length, 0) ?? 0);
check(
  'font outlines arrive fitted and Simplify preserves their contours',
  heaviestGlyph.points.length <= 20 &&
    anchorTotal(simplifiedGlyph) <= anchorTotal(heaviestGlyph) &&
    (simplifiedGlyph.holes?.length ?? 0) === (heaviestGlyph.holes?.length ?? 0)
);

// A TrueType contour repeats points as zero-length lines. Each repeat used to
// arrive as two anchors on one spot — one with the incoming handle, one with the
// outgoing — so a converted glyph carried nearly twice the nodes it needs and
// the extra pairs sat exactly where it is hardest to grab a node.
const coincidentPairs = (anchors: { x: number; y: number }[]) => {
  let pairs = 0;
  for (let i = 1; i < anchors.length; i++) {
    if (Math.hypot(anchors[i].x - anchors[i - 1].x, anchors[i].y - anchors[i - 1].y) < 0.05) {
      pairs += 1;
    }
  }
  return pairs;
};
const repeatedPointOutlines = fontOutlinePaths({
  text: 'The',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontWeight: 'bold',
  fontSize: 96,
}) ?? [];
const repeatedPairs = repeatedPointOutlines.reduce(
  (total, path) =>
    total +
    coincidentPairs(path.points) +
    (path.holes?.reduce((count, hole) => count + coincidentPairs(hole), 0) ?? 0),
  0
);
check(
  'converted glyphs carry no two nodes on one spot',
  repeatedPairs === 0,
  `pairs=${repeatedPairs}`
);
const eOutline = repeatedPointOutlines.find((path) => path.name.includes('3'));
check(
  'a converted e is not doubled up',
  !!eOutline && eOutline.points.length <= 18 && eOutline.points.length >= 10,
  `anchors=${eOutline?.points.length}`
);

// A glyph's own contours touch where a stem meets a bowl, so the file's winding
// has to decide the fill: painted even-odd, a bold e closed its mouth into a
// wedge. Converted outlines therefore ask for nonzero, and their counters are
// wound against the outer contour so the rule still reads as holes.
check(
  'converted glyphs ask for the nonzero fill rule',
  !!eOutline && eOutline.fillRule === 'nonzero',
  `fillRule=${eOutline?.fillRule}`
);
{
  const signedArea = (ring: { x: number; y: number }[]) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum / 2;
  };
  const oOutline = fontOutlinePaths({
    text: 'o',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontWeight: 'bold',
    fontSize: 120,
    originX: 0,
    originY: 0,
  })?.[0];
  const outer = oOutline ? signedArea(oOutline.points) : 0;
  const hole = oOutline?.holes?.[0] ? signedArea(oOutline.holes[0]) : 0;
  check(
    'a nonzero counter is wound against its outer contour',
    !!oOutline?.holes?.length && Math.sign(outer) !== Math.sign(hole) && Math.abs(hole) > 1,
    `outer=${outer.toFixed(1)} hole=${hole.toFixed(1)}`
  );
}

// The bundled family has a real bold file, so a bold label must convert to that
// drawing unchanged. It used to be picked from the bold face and then grown
// again against the family's regular weight, which made every outlined bold
// word heavier than the type it replaced.
const inkWidthOf = (paths: { points: { x: number }[]; holes?: { x: number }[][] }[]) => {
  const xs = paths.flatMap((path) => [
    ...path.points.map((point) => point.x),
    ...(path.holes ?? []).flatMap((hole) => hole.map((point: { x: number }) => point.x)),
  ]);
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
};
const boldDirect =
  fontOutlinePaths({
    text: 'e',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontWeight: 'bold',
    fontSize: 200,
    originX: 0,
    originY: 0,
    fillColor: '#000000',
    strokeColor: 'none',
    strokeWidth: 0,
  }) ?? [];
const boldExpanded = expandTextToVectorPaths('e', {
  originX: 0,
  originY: 0,
  fontSize: 200,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontWeight: 'bold',
  fillColor: '#000000',
  strokeColor: 'none',
  strokeWidth: 0,
});
check(
  'a label with a real bold face is not inflated a second time',
  boldDirect.length === boldExpanded.length &&
    Math.abs(inkWidthOf(boldDirect) - inkWidthOf(boldExpanded)) < 0.01,
  `direct=${inkWidthOf(boldDirect).toFixed(2)} expanded=${inkWidthOf(boldExpanded).toFixed(2)}`
);

// A weight the file does not contain is faked by growing the contour. The ring
// is kept exactly as offset: refitting it thinned the letter back to regular.
// A weight the file *does* contain is not grown at all — see the check below.
const regularBytes = fs.readFileSync('public/fonts/PlusJakartaSans-Regular.woff');
registerOutlineFont(
  'Single Weight Probe',
  regularBytes.buffer.slice(
    regularBytes.byteOffset,
    regularBytes.byteOffset + regularBytes.byteLength
  ) as ArrayBuffer
);
const bakeFakedRegular = expandTextToVectorPaths('e', {
  originX: 0,
  originY: 0,
  fontSize: 200,
  fontFamily: 'Single Weight Probe, sans-serif',
  fontWeight: 'regular',
  fillColor: '#000000',
  strokeColor: 'none',
  strokeWidth: 0,
});
const bakeFakedBold = expandTextToVectorPaths('e', {
  originX: 0,
  originY: 0,
  fontSize: 200,
  fontFamily: 'Single Weight Probe, sans-serif',
  fontWeight: 'bold',
  fillColor: '#000000',
  strokeColor: 'none',
  strokeWidth: 0,
});
const inkWidth = (paths: VectorPath[]) => {
  const xs = paths.flatMap((path) => path.points.map((point) => point.x));
  return Math.max(...xs) - Math.min(...xs);
};
// A weight the file does not contain is grown, not approximated: the outline
// has to stay wider than the regular face it came from. Refitting the ring
// used to shave that growth away, so the check looks at the ink, not the count.
check(
  'a faked bold keeps the weight it drew',
  bakeFakedBold.length === 1 &&
    bakeFakedRegular.length === 1 &&
    inkWidth(bakeFakedBold) > inkWidth(bakeFakedRegular) + 2,
  `${inkWidth(bakeFakedRegular).toFixed(1)} -> ${inkWidth(bakeFakedBold).toFixed(1)} px`
);

// Type on a path has to be laid along the curve. A straight layout would put
// every glyph on one baseline; these follow the ring instead.
const KAPPA = 0.5522847498;
const bakeProbeRing: VectorPath = {
  id: 'ring-probe',
  name: 'Ring',
  points: [
    {
      id: 'ring-1',
      x: 300,
      y: 100,
      type: 'smooth',
      handleIn: { x: 300, y: 100 - 100 * KAPPA },
      handleOut: { x: 300, y: 100 + 100 * KAPPA },
    },
    {
      id: 'ring-2',
      x: 200,
      y: 200,
      type: 'smooth',
      handleIn: { x: 200 + 100 * KAPPA, y: 200 },
      handleOut: { x: 200 - 100 * KAPPA, y: 200 },
    },
    {
      id: 'ring-3',
      x: 100,
      y: 100,
      type: 'smooth',
      handleIn: { x: 100, y: 100 + 100 * KAPPA },
      handleOut: { x: 100, y: 100 - 100 * KAPPA },
    },
    {
      id: 'ring-4',
      x: 200,
      y: 0,
      type: 'smooth',
      handleIn: { x: 200 - 100 * KAPPA, y: 0 },
      handleOut: { x: 200 + 100 * KAPPA, y: 0 },
    },
  ],
  closed: true,
  fill: 'none',
  fillOpacity: 1,
  stroke: '#000000',
  strokeWidth: 1,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
};
const bakePathProbeLabel: VectorPath = {
  id: 'label-on-path',
  name: 'Label on a path',
  points: [{ id: 'label-on-path-anchor', x: 200, y: 100, type: 'corner' }],
  closed: false,
  fill: '#000000',
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
  text: 'abc',
  fontSize: 40,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontWeight: 'bold',
  letterSpacing: 0,
  textMatrix: [1, 0, 0, 1, 0, 0],
  textPath: { pathId: 'ring-probe', offset: 0 },
};
const bakeOnPathOutlines =
  outlineLayoutText(bakePathProbeLabel, (id) => (id === 'ring-probe' ? bakeProbeRing : null)) ?? [];
const bakeOnPathRadii = bakeOnPathOutlines.map((glyph) => {
  const cx = glyph.points.reduce((sum, point) => sum + point.x, 0) / glyph.points.length;
  const cy = glyph.points.reduce((sum, point) => sum + point.y, 0) / glyph.points.length;
  return Math.hypot(cx - 200, cy - 100);
});
check(
  'type on a path is baked along the curve, not along a straight line',
  bakeOnPathOutlines.length === 3 && bakeOnPathRadii.every((radius) => radius > 80 && radius < 140),
  `radii ${bakeOnPathRadii.map((radius) => radius.toFixed(0)).join(', ')}`
);
check(
  'a label on a path still falls back when the path is gone',
  outlineLayoutText(bakePathProbeLabel, () => null) === null
);

// Area type: every line keeps its own left edge and its own baseline.
const bakeAreaProbeLabel: VectorPath = {
  ...bakePathProbeLabel,
  id: 'area-probe',
  text: 'aa\naa',
  textLineX: [0, 30],
  textPath: undefined,
  points: [{ id: 'area-probe-anchor', x: 100, y: 300, type: 'corner' }],
  fontSize: 60,
};
const bakeAreaOutlines = outlineLayoutText(bakeAreaProbeLabel, () => null) ?? [];
const minXOf = (paths: VectorPath[]) =>
  Math.min(...paths.flatMap((glyph) => glyph.points.map((point) => point.x)));
const meanYOf = (paths: VectorPath[]) =>
  paths.reduce(
    (total, glyph) =>
      total + glyph.points.reduce((sum, point) => sum + point.y, 0) / glyph.points.length,
    0
  ) / Math.max(1, paths.length);
const rowGap = meanYOf(bakeAreaOutlines.slice(2)) - meanYOf(bakeAreaOutlines.slice(0, 2));
const lineIndent = minXOf(bakeAreaOutlines.slice(2)) - minXOf(bakeAreaOutlines.slice(0, 2));
check(
  'area type keeps its per-line left edges when baked',
  bakeAreaOutlines.length === 4 &&
    Math.abs(rowGap - textLineHeight(60)) < 3 &&
    Math.abs(lineIndent - 30) < 3,
  `gap ${rowGap.toFixed(1)}, indent ${lineIndent.toFixed(1)}`
);

const warpedLabel: VectorPath = {
  id: 'text-warp-check',
  name: 'Warped label',
  points: [{ id: 'text-warp-anchor', x: 100, y: 300, type: 'corner' }],
  closed: false,
  fill: '#111111',
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeCap: 'round',
  strokeJoin: 'round',
  pressureProfile: 'uniform',
  text: 'ABC',
  fontSize: 64,
  fontFamily: 'sans-serif',
  fontWeight: 'bold',
  letterSpacing: 0,
  warp: { kind: 'arch', amount: 40 },
};
const warpPlacements = warpTextPlacements(warpedLabel) ?? [];
check('a warped label still holds one glyph per letter', warpPlacements.length === 3);
check(
  'arch lifts the middle of the type',
  warpPlacements.length === 3 && warpPlacements[1].y < warpPlacements[0].y - 1
);
check(
  'the bend rotates letters along the curve',
  warpPlacements.some((glyph) => {
    const parts = glyph.transform.match(/matrix\(([^)]+)\)/)?.[1].split(' ').map(Number) ?? [];
    return Math.abs(parts[1] ?? 0) > 0.01;
  })
);
check('a label without a warp renders as plain text', warpTextGlyphs({ ...warpedLabel, warp: undefined }) === null);
check(
  'warped bounds reach past the straight box',
  (textWarpBounds(warpedLabel)?.minY ?? 0) < (textWorldBox(warpedLabel)?.minY ?? 0)
);

const spanOf = (placements: { x: number }[]) =>
  placements.length ? Math.max(...placements.map((g) => g.x)) - Math.min(...placements.map((g) => g.x)) : 0;
const bulgeSpan = spanOf(warpTextPlacements({ ...warpedLabel, warp: { kind: 'bulge', amount: 40 } }) ?? []);
const plainSpan = spanOf(warpTextPlacements({ ...warpedLabel, warp: { kind: 'perspective', amount: 40 } }) ?? []);
check('bulge opens the spacing around the centre of the line', bulgeSpan > plainSpan + 2);
const pinchSpan = spanOf(warpTextPlacements({ ...warpedLabel, warp: { kind: 'pinch', amount: 40 } }) ?? []);
check('pinch closes the spacing', pinchSpan < plainSpan - 2);

/* ------------------- Warp catalogue, type on a path, hex tiles ------------------- */
console.log('Illustrator parity');
check('the warp catalogue carries the full style set', WARP_KINDS.length >= 12);

const shapeBox = { minX: 0, minY: 0, width: 200, height: 100 };
const midY = warpPoint(100, 50, shapeBox, { kind: 'flag', amount: 40 }).y;
check(
  'flag sends the two ends opposite ways',
  warpPoint(0, 50, shapeBox, { kind: 'flag', amount: 40 }).y < midY &&
    warpPoint(200, 50, shapeBox, { kind: 'flag', amount: 40 }).y > midY
);
check(
  'rise lifts the far end of the selection',
  warpPoint(0, 50, shapeBox, { kind: 'rise', amount: 40 }).y -
    warpPoint(200, 50, shapeBox, { kind: 'rise', amount: 40 }).y > 30
);
check(
  'twist turns the artwork around its centre',
  Math.abs(warpPoint(100, 0, shapeBox, { kind: 'twist', amount: 60 }).x - 100) > 2
);
check(
  'inflate swells the body',
  warpPoint(150, 50, shapeBox, { kind: 'inflate', amount: 40 }).x > 150.5
);
check(
  'fisheye squeezes the rim',
  warpPoint(190, 50, shapeBox, { kind: 'fisheye', amount: 40 }).x < 189.5
);

const placementMatrix = (transform: string) =>
  transform.match(/matrix\(([^)]+)\)/)?.[1].split(' ').map(Number) ?? [];
const placementAngle = (transform: string) => {
  const parts = placementMatrix(transform);
  return Math.atan2(parts[1] ?? 0, parts[0] ?? 1);
};
const archApex = placementAngle((warpTextPlacements(warpedLabel) ?? [])[1]?.transform ?? '');
check(
  'an arch turns the middle letters less than the ends',
  Math.abs(archApex) < Math.abs(placementAngle((warpTextPlacements(warpedLabel) ?? [])[0]?.transform ?? ''))
);
const archEdge = placementMatrix((warpTextPlacements(warpedLabel) ?? [])[0]?.transform ?? '');
check('the same arch shears the letters at the ends', Math.abs(archEdge[1] ?? 0) > 0.01);

const perspectiveEdge = placementMatrix(
  (warpTextPlacements({ ...warpedLabel, warp: { kind: 'perspective', amount: 60 } }) ?? [])[0]?.transform ?? ''
);
check('perspective leans each letter instead of ignoring type', Math.abs(perspectiveEdge[2] ?? 0) > 0.05);
check(
  'the perspective lean keeps the line length',
  (warpTextPlacements({ ...warpedLabel, warp: { kind: 'perspective', amount: 60 } }) ?? []).every(
    (glyph) => Math.abs(glyph.x - glyph.anchorX) < 0.5
  )
);
const inflateSpan = spanOf(warpTextPlacements({ ...warpedLabel, warp: { kind: 'inflate', amount: 60 } }) ?? []);
check('inflate pushes the letters out from the middle', inflateSpan > spanOf(warpTextPlacements({ ...warpedLabel, warp: { kind: 'perspective', amount: 60 } }) ?? []) + 2);

const hexFill = patternFromSwatch({
  id: 'hex-swatch',
  name: 'Hex',
  paths: [],
  tileW: 100,
  tileH: 100,
  tileType: 'hex',
});
const hexLayout = patternLayout(hexFill);
check(
  'hex tiles stagger by half a tile and root 3 over 2 of a row',
  hexLayout.copies.some(
    (c) => Math.abs(c.dx - 50) < 0.01 && Math.abs(c.dy - 100 * (Math.sqrt(3) / 2)) < 0.01
  ) && Math.abs(hexLayout.width - 100) < 0.01
);
check('hex rows sit closer than square rows', hexLayout.height < 200);

// Spacing must pad the cell, keeping the art whole, rather than moving tiles
// apart where the neighbouring tile clips it.
check(
  'spacing pads the cell and centres the art inside it',
  gridLayout.artOffsetX === 5 &&
    gridLayout.cellW === 110 &&
    gridLayout.width === 110
);
check(
  'a motif that crosses the cell edge is cloned on the opposite side',
  gridLayout.copies.length === 1 &&
    brickLayout.copies.some((c) => c.dx < 0) &&
    brickLayout.copies.some((c) => c.dx > 0)
);

const pathLabel = { ...warpedLabel, textPath: { pathId: 'outline', offset: 0 } };
check(
  'centre alignment lifts the string by 0.32em',
  Math.abs(textPathDy({ ...pathLabel, textPath: { ...pathLabel.textPath, align: 'center' } }) - 0.32 * 64) < 0.01
);
check(
  'top alignment lifts it above centre',
  textPathDy({ ...pathLabel, textPath: { ...pathLabel.textPath, align: 'ascender' } }) >
    textPathDy({ ...pathLabel, textPath: { ...pathLabel.textPath, align: 'center' } })
);
check(
  'bottom alignment drops it under the baseline',
  textPathDy({ ...pathLabel, textPath: { ...pathLabel.textPath, align: 'descender' } }) < 0
);
const reversedPair = reversedAnchors([
  { id: 'a', x: 0, y: 0, type: 'corner', handleOut: { x: 1, y: 2 } },
  { id: 'b', x: 10, y: 0, type: 'corner' },
]);
check(
  'reversing a path flips the direction, not the shape',
  reversedPair[0].id === 'b' && reversedPair[1].handleIn?.x === 1
);

check(
  'every warp style draws its own preview instead of only a name',
  renderToStaticMarkup(<WarpThumb kind="arch" />).includes('<polyline') &&
    renderToStaticMarkup(<WarpThumb kind="twist" />).includes('<polyline')
);
check(
  'text-on-path alignments draw where the string sits',
  renderToStaticMarkup(<PathAlignThumb align="center" />).includes('center alignment') &&
    renderToStaticMarkup(<PathAlignThumb align="baseline" />).includes('baseline alignment')
);

const foldBox = { minX: 0, minY: 0, width: 200, height: 80 };
check(
  'a normal bend does not fold',
  !warpFold(foldBox, { kind: 'arch', amount: 24 }).folded &&
    !warpFold(foldBox, { kind: 'wave', amount: 30, cycles: 2 }).folded
);
check(
  'an over-driven bulge is reported as folding',
  warpFold(foldBox, { kind: 'bulge', amount: -140 }).folded
);
check(
  'the fold report says how much of the box is inverted',
  warpFold(foldBox, { kind: 'bulge', amount: -140 }).ratio > 0
);

/* ---------------- compound path engine ---------------- */

const engineOuter = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const engineHole = [
  { x: 30, y: 30 },
  { x: 30, y: 70 },
  { x: 70, y: 70 },
  { x: 70, y: 30 },
];
const engineCompounds = compoundFromContours([engineOuter, engineHole], { idPrefix: 'letter-o' });
check(
  'a glyph with a counter becomes one compound path',
  engineCompounds.length === 1 &&
    engineCompounds[0].subpaths.length === 2 &&
    engineCompounds[0].fillRule === 'nonzero',
  `compounds=${engineCompounds.length} subpaths=${engineCompounds[0]?.subpaths.length}`
);

const ringAreas = engineCompounds[0].subpaths.map((subpath) =>
  signedArea(subpath.points.map((point) => ({ x: point.x, y: point.y })))
);
check(
  'outer contour and counter wind opposite ways',
  Math.sign(ringAreas[0]) !== Math.sign(ringAreas[1]),
  ringAreas.map((area) => area.toFixed(0)).join(' / ')
);

const engineD = toSVGPathData(engineCompounds[0]);
check(
  'a compound path writes clean M, L and Z data',
  engineD.startsWith('M ') && engineD.endsWith('Z') && !engineD.includes('C'),
  engineD.slice(0, 42)
);

const enginePaint = {
  fill: '#000000',
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 0,
  strokeCap: 'round' as const,
  strokeJoin: 'round' as const,
  pressureProfile: 'uniform' as const,
  name: 'O',
};
const engineObjects = toVectorPaths(engineCompounds, enginePaint);
check(
  'compound paths come back as editable objects with their hole',
  engineObjects.length === 1 && engineObjects[0].points.length === 4 && engineObjects[0].holes?.length === 1
);
const engineRoundTrip = fromVectorPaths(engineObjects);
check(
  'converted objects round-trip through the engine model',
  engineRoundTrip[0].subpaths.length === 2 &&
    Math.abs(engineRoundTrip[0].subpaths[0].points[1].x - 100) < 0.001,
  `subpaths=${engineRoundTrip[0].subpaths.length}`
);

// A traced square arrives as dozens of collinear samples: four corners must
// survive as corner nodes and the samples between them must not survive at all.
const tracedSquare: { x: number; y: number }[] = [];
const squareRing = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 200 },
  { x: 0, y: 200 },
];
for (let edge = 0; edge < 4; edge++) {
  const from = squareRing[edge];
  const to = squareRing[(edge + 1) % 4];
  for (let step = 0; step < 12; step++) {
    tracedSquare.push({
      x: from.x + ((to.x - from.x) * step) / 12,
      y: from.y + ((to.y - from.y) * step) / 12,
    });
  }
}
const squareFit = simplifyAndFitCurves(tracedSquare, 1, { closed: true, idPrefix: 'square' });
const squareNodes = squareFit.subpaths[0].points;
check(
  'a traced square keeps exactly four corner nodes',
  squareNodes.length === 4 && squareNodes.every((node) => node.type === 'corner'),
  `nodes=${squareNodes.length} corners=${squareNodes.filter((node) => node.type === 'corner').length}`
);
check(
  'its corners stay on the traced geometry',
  squareNodes.every((node) =>
    squareRing.some((corner) => Math.hypot(corner.x - node.x, corner.y - node.y) < 0.5)
  ),
  squareNodes.map((node) => `${node.x},${node.y}`).join(' ')
);

const tracedCircle = Array.from({ length: 240 }, (_, index) => {
  const angle = (index / 240) * Math.PI * 2;
  return { x: 100 + 80 * Math.cos(angle), y: 100 + 80 * Math.sin(angle) };
});
const circleFit = simplifyAndFitCurves(tracedCircle, 0.6, { closed: true, idPrefix: 'circle' });
const circleNodes = circleFit.subpaths[0].points;
check(
  'a traced circle fits to a handful of smooth nodes',
  circleNodes.length >= 4 &&
    circleNodes.length <= 12 &&
    circleNodes.filter((node) => node.type === 'smooth').length >= 4,
  `nodes=${circleNodes.length}`
);
check(
  'fitted curves export as cubic segments',
  toSVGPathData(circleFit).includes('C '),
  toSVGPathData(circleFit).slice(0, 42)
);
check(
  'a closed fit does not repeat its first node',
  Math.hypot(circleNodes[0].x - circleNodes[circleNodes.length - 1].x, circleNodes[0].y - circleNodes[circleNodes.length - 1].y) > 0.001
);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
if (failures > 0) process.exit(1);
