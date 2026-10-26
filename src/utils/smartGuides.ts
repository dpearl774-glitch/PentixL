import { BoundingBox } from './transform';

export interface SmartGuideLine {
  id: string;
  orientation: 'vertical' | 'horizontal';
  coordinate: number;
  start: number;
  end: number;
  label: string;
  sourceType: 'artboard' | 'object';
  targetBBox?: BoundingBox;
}

export interface SmartSnapResult {
  snappedDeltaX: number;
  snappedDeltaY: number;
  guideLines: SmartGuideLine[];
}

export interface SnapCandidate {
  id: string;
  bbox: BoundingBox;
  type: 'artboard' | 'object';
  name?: string;
}

/**
 * Computes snap candidates from the artboard and other visible paths/objects
 */
export function getSnapCandidates(
  artboardWidth: number,
  artboardHeight: number,
  otherBBoxes: { id: string; bbox: BoundingBox; name?: string }[]
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [
    {
      id: 'artboard',
      type: 'artboard',
      name: 'Artboard',
      bbox: {
        minX: 0,
        minY: 0,
        maxX: artboardWidth,
        maxY: artboardHeight,
        width: artboardWidth,
        height: artboardHeight,
        centerX: artboardWidth / 2,
        centerY: artboardHeight / 2,
      },
    },
  ];

  for (const item of otherBBoxes) {
    if (item.bbox && item.bbox.width > 1 && item.bbox.height > 1) {
      candidates.push({
        id: item.id,
        type: 'object',
        name: item.name,
        bbox: item.bbox,
      });
    }
  }

  return candidates;
}

/**
 * Computes snapping and active smart guide lines when moving an object with initial bounding box
 * by an unconstrained delta (dx, dy).
 */
export function calculateMoveSmartGuides(
  initialBBox: BoundingBox,
  rawDx: number,
  rawDy: number,
  candidates: SnapCandidate[],
  threshold: number,
  padding: number = 40
): SmartSnapResult {
  const currentMinX = initialBBox.minX + rawDx;
  const currentCenterX = initialBBox.centerX + rawDx;
  const currentMaxX = initialBBox.maxX + rawDx;

  const currentMinY = initialBBox.minY + rawDy;
  const currentCenterY = initialBBox.centerY + rawDy;
  const currentMaxY = initialBBox.maxY + rawDy;

  // --- VERTICAL GUIDES (X AXIS) ---
  let bestXDiff = Infinity;
  let snapDx = rawDx;
  let activeVerticalGuides: SmartGuideLine[] = [];

  // Source test points on the moving object
  const movingXPoints: { val: number; name: 'left' | 'center' | 'right' }[] = [
    { val: currentCenterX, name: 'center' },
    { val: currentMinX, name: 'left' },
    { val: currentMaxX, name: 'right' },
  ];

  for (const cand of candidates) {
    const targetXPoints: { val: number; name: 'left' | 'center' | 'right'; isArtboard: boolean }[] = [
      { val: cand.bbox.centerX, name: 'center', isArtboard: cand.type === 'artboard' },
      { val: cand.bbox.minX, name: 'left', isArtboard: cand.type === 'artboard' },
      { val: cand.bbox.maxX, name: 'right', isArtboard: cand.type === 'artboard' },
    ];

    for (const moving of movingXPoints) {
      for (const target of targetXPoints) {
        const diff = target.val - moving.val;
        const absDiff = Math.abs(diff);

        if (absDiff <= threshold) {
          if (absDiff < Math.abs(bestXDiff) - 0.001) {
            bestXDiff = diff;
            snapDx = rawDx + diff;

            const yStart = Math.min(currentMinY, cand.bbox.minY) - padding;
            const yEnd = Math.max(currentMaxY, cand.bbox.maxY) + padding;

            let label = target.isArtboard
              ? target.name === 'center' ? 'Canvas Center' : 'Canvas Edge'
              : moving.name === 'center' && target.name === 'center'
              ? 'Center Align'
              : 'Edge Align';

            activeVerticalGuides = [
              {
                id: `v-${cand.id}-${target.name}-${moving.name}`,
                orientation: 'vertical',
                coordinate: target.val,
                start: yStart,
                end: yEnd,
                label,
                sourceType: cand.type,
                targetBBox: cand.bbox,
              },
            ];
          } else if (Math.abs(absDiff - Math.abs(bestXDiff)) <= 0.001 && activeVerticalGuides.length > 0) {
            // Simultaneous alignment with another object on same X line
            const yStart = Math.min(activeVerticalGuides[0].start, cand.bbox.minY - padding);
            const yEnd = Math.max(activeVerticalGuides[0].end, cand.bbox.maxY + padding);
            activeVerticalGuides[0].start = yStart;
            activeVerticalGuides[0].end = yEnd;
          }
        }
      }
    }
  }

  // --- HORIZONTAL GUIDES (Y AXIS) ---
  let bestYDiff = Infinity;
  let snapDy = rawDy;
  let activeHorizontalGuides: SmartGuideLine[] = [];

  const movingYPoints: { val: number; name: 'top' | 'center' | 'bottom' }[] = [
    { val: currentCenterY, name: 'center' },
    { val: currentMinY, name: 'top' },
    { val: currentMaxY, name: 'bottom' },
  ];

  for (const cand of candidates) {
    const targetYPoints: { val: number; name: 'top' | 'center' | 'bottom'; isArtboard: boolean }[] = [
      { val: cand.bbox.centerY, name: 'center', isArtboard: cand.type === 'artboard' },
      { val: cand.bbox.minY, name: 'top', isArtboard: cand.type === 'artboard' },
      { val: cand.bbox.maxY, name: 'bottom', isArtboard: cand.type === 'artboard' },
    ];

    for (const moving of movingYPoints) {
      for (const target of targetYPoints) {
        const diff = target.val - moving.val;
        const absDiff = Math.abs(diff);

        if (absDiff <= threshold) {
          if (absDiff < Math.abs(bestYDiff) - 0.001) {
            bestYDiff = diff;
            snapDy = rawDy + diff;

            const xStart = Math.min(currentMinX, cand.bbox.minX) - padding;
            const xEnd = Math.max(currentMaxX, cand.bbox.maxX) + padding;

            let label = target.isArtboard
              ? target.name === 'center' ? 'Canvas Center' : 'Canvas Edge'
              : moving.name === 'center' && target.name === 'center'
              ? 'Center Align'
              : 'Edge Align';

            activeHorizontalGuides = [
              {
                id: `h-${cand.id}-${target.name}-${moving.name}`,
                orientation: 'horizontal',
                coordinate: target.val,
                start: xStart,
                end: xEnd,
                label,
                sourceType: cand.type,
                targetBBox: cand.bbox,
              },
            ];
          } else if (Math.abs(absDiff - Math.abs(bestYDiff)) <= 0.001 && activeHorizontalGuides.length > 0) {
            // Simultaneous alignment with another object on same Y line
            const xStart = Math.min(activeHorizontalGuides[0].start, cand.bbox.minX - padding);
            const xEnd = Math.max(activeHorizontalGuides[0].end, cand.bbox.maxX + padding);
            activeHorizontalGuides[0].start = xStart;
            activeHorizontalGuides[0].end = xEnd;
          }
        }
      }
    }
  }

  return {
    snappedDeltaX: snapDx,
    snappedDeltaY: snapDy,
    guideLines: [...activeVerticalGuides, ...activeHorizontalGuides],
  };
}

/**
 * Computes snapping and active smart guide lines when resizing with a handle
 */
export function calculateResizeSmartGuides(
  handleType: string,
  currentPoint: { x: number; y: number },
  initialBBox: BoundingBox,
  candidates: SnapCandidate[],
  threshold: number,
  padding: number = 40
): { snappedPoint: { x: number; y: number }; guideLines: SmartGuideLine[] } {
  let snappedX = currentPoint.x;
  let snappedY = currentPoint.y;
  let bestVerticalGuide: SmartGuideLine | null = null;
  let bestHorizontalGuide: SmartGuideLine | null = null;

  const affectsX = handleType === 'tl' || handleType === 'bl' || handleType === 'ml' ||
                   handleType === 'tr' || handleType === 'br' || handleType === 'mr';
  const affectsY = handleType === 'tl' || handleType === 'tr' || handleType === 'tc' ||
                   handleType === 'bl' || handleType === 'br' || handleType === 'bc';

  // Check X snap
  if (affectsX) {
    let bestXDiff = Infinity;
    for (const cand of candidates) {
      const targets: { val: number; name: 'min' | 'center' | 'max' }[] = [
        { val: cand.bbox.minX, name: 'min' },
        { val: cand.bbox.centerX, name: 'center' },
        { val: cand.bbox.maxX, name: 'max' },
      ];
      for (const target of targets) {
        const diff = target.val - currentPoint.x;
        if (Math.abs(diff) <= threshold && Math.abs(diff) < Math.abs(bestXDiff) - 0.001) {
          bestXDiff = diff;
          snappedX = target.val;

          const yStart = Math.min(currentPoint.y, cand.bbox.minY) - padding;
          const yEnd = Math.max(currentPoint.y, cand.bbox.maxY) + padding;

          bestVerticalGuide = {
            id: `resize-v-${cand.id}-${target.name}`,
            orientation: 'vertical',
            coordinate: target.val,
            start: yStart,
            end: yEnd,
            label: cand.type === 'artboard' ? (target.name === 'center' ? 'Canvas Center' : 'Canvas Edge') : 'Align',
            sourceType: cand.type,
            targetBBox: cand.bbox,
          };
        }
      }
    }
  }

  // Check Y snap
  if (affectsY) {
    let bestYDiff = Infinity;
    for (const cand of candidates) {
      const targets: { val: number; name: 'min' | 'center' | 'max' }[] = [
        { val: cand.bbox.minY, name: 'min' },
        { val: cand.bbox.centerY, name: 'center' },
        { val: cand.bbox.maxY, name: 'max' },
      ];
      for (const target of targets) {
        const diff = target.val - currentPoint.y;
        if (Math.abs(diff) <= threshold && Math.abs(diff) < Math.abs(bestYDiff) - 0.001) {
          bestYDiff = diff;
          snappedY = target.val;

          const xStart = Math.min(currentPoint.x, cand.bbox.minX) - padding;
          const xEnd = Math.max(currentPoint.x, cand.bbox.maxX) + padding;

          bestHorizontalGuide = {
            id: `resize-h-${cand.id}-${target.name}`,
            orientation: 'horizontal',
            coordinate: target.val,
            start: xStart,
            end: xEnd,
            label: cand.type === 'artboard' ? (target.name === 'center' ? 'Canvas Center' : 'Canvas Edge') : 'Align',
            sourceType: cand.type,
            targetBBox: cand.bbox,
          };
        }
      }
    }
  }

  const guides: SmartGuideLine[] = [];
  if (bestVerticalGuide) guides.push(bestVerticalGuide);
  if (bestHorizontalGuide) guides.push(bestHorizontalGuide);

  return {
    snappedPoint: { x: snappedX, y: snappedY },
    guideLines: guides,
  };
}
