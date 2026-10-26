import { AnchorPoint, ShapeOptions, VectorPath } from '../types/vector';

// Magic constant for cubic bezier circular arcs: 4/3 * (sqrt(2) - 1) ≈ 0.5522847498
const K_CIRCLE = 0.5522847498;

export function generateShapePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options: ShapeOptions,
  pathId: string,
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
  }
): VectorPath {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);
  const width = Math.max(4, right - left);
  const height = Math.max(4, bottom - top);
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  let points: AnchorPoint[] = [];
  let closed = true;

  switch (options.kind) {
    case 'rectangle': {
      points = [
        { id: `${pathId}-0`, x: left, y: top, type: 'corner' },
        { id: `${pathId}-1`, x: right, y: top, type: 'corner' },
        { id: `${pathId}-2`, x: right, y: bottom, type: 'corner' },
        { id: `${pathId}-3`, x: left, y: bottom, type: 'corner' },
      ];
      break;
    }

    case 'rounded-rect': {
      const radius = Math.min(options.cornerRadius || 24, width / 2, height / 2);
      const k = radius * K_CIRCLE;
      points = [
        { id: `${pathId}-0`, x: left + radius, y: top, type: 'smooth', handleIn: { x: left + radius - k, y: top } },
        { id: `${pathId}-1`, x: right - radius, y: top, type: 'smooth', handleOut: { x: right - radius + k, y: top } },
        { id: `${pathId}-2`, x: right, y: top + radius, type: 'smooth', handleIn: { x: right, y: top + radius - k } },
        { id: `${pathId}-3`, x: right, y: bottom - radius, type: 'smooth', handleOut: { x: right, y: bottom - radius + k } },
        { id: `${pathId}-4`, x: right - radius, y: bottom, type: 'smooth', handleIn: { x: right - radius + k, y: bottom } },
        { id: `${pathId}-5`, x: left + radius, y: bottom, type: 'smooth', handleOut: { x: left + radius - k, y: bottom } },
        { id: `${pathId}-6`, x: left, y: bottom - radius, type: 'smooth', handleIn: { x: left, y: bottom - radius + k } },
        { id: `${pathId}-7`, x: left, y: top + radius, type: 'smooth', handleOut: { x: left, y: top + radius - k } },
      ];
      break;
    }

    case 'circle': {
      const rx = width / 2;
      const ry = height / 2;
      const kx = rx * K_CIRCLE;
      const ky = ry * K_CIRCLE;
      points = [
        { id: `${pathId}-0`, x: centerX, y: top, type: 'smooth', handleIn: { x: centerX - kx, y: top }, handleOut: { x: centerX + kx, y: top } },
        { id: `${pathId}-1`, x: right, y: centerY, type: 'smooth', handleIn: { x: right, y: centerY - ky }, handleOut: { x: right, y: centerY + ky } },
        { id: `${pathId}-2`, x: centerX, y: bottom, type: 'smooth', handleIn: { x: centerX + kx, y: bottom }, handleOut: { x: centerX - kx, y: bottom } },
        { id: `${pathId}-3`, x: left, y: centerY, type: 'smooth', handleIn: { x: left, y: centerY + ky }, handleOut: { x: left, y: centerY - ky } },
      ];
      break;
    }

    case 'semicircle': {
      const rx = width / 2;
      const kx = rx * K_CIRCLE;
      points = [
        { id: `${pathId}-0`, x: left, y: bottom, type: 'corner' },
        { id: `${pathId}-1`, x: left, y: centerY, type: 'smooth', handleOut: { x: left, y: centerY - rx * K_CIRCLE } },
        { id: `${pathId}-2`, x: centerX, y: top, type: 'smooth', handleIn: { x: centerX - kx, y: top }, handleOut: { x: centerX + kx, y: top } },
        { id: `${pathId}-3`, x: right, y: centerY, type: 'smooth', handleIn: { x: right, y: centerY - rx * K_CIRCLE } },
        { id: `${pathId}-4`, x: right, y: bottom, type: 'corner' },
      ];
      break;
    }

    case 'triangle': {
      points = [
        { id: `${pathId}-0`, x: centerX, y: top, type: 'corner' },
        { id: `${pathId}-1`, x: right, y: bottom, type: 'corner' },
        { id: `${pathId}-2`, x: left, y: bottom, type: 'corner' },
      ];
      break;
    }

    case 'polygon': {
      const sides = Math.max(3, options.sides || 6);
      const rx = width / 2;
      const ry = height / 2;
      points = [];
      for (let i = 0; i < sides; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
        points.push({
          id: `${pathId}-${i}`,
          x: centerX + rx * Math.cos(angle),
          y: centerY + ry * Math.sin(angle),
          type: 'corner',
        });
      }
      break;
    }

    case 'octagon': {
      const rx = width / 2;
      const ry = height / 2;
      points = [];
      for (let i = 0; i < 8; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 8;
        points.push({
          id: `${pathId}-${i}`,
          x: centerX + rx * Math.cos(angle),
          y: centerY + ry * Math.sin(angle),
          type: 'corner',
        });
      }
      break;
    }

    case 'star':
    case 'star8': {
      const starPoints = options.kind === 'star8' ? 8 : 5;
      const outerRx = width / 2;
      const outerRy = height / 2;
      const innerRatio = options.innerRadiusRatio || 0.45;
      const innerRx = outerRx * innerRatio;
      const innerRy = outerRy * innerRatio;
      points = [];
      const totalSteps = starPoints * 2;
      for (let i = 0; i < totalSteps; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / starPoints;
        const isOuter = i % 2 === 0;
        const curRx = isOuter ? outerRx : innerRx;
        const curRy = isOuter ? outerRy : innerRy;
        points.push({
          id: `${pathId}-${i}`,
          x: centerX + curRx * Math.cos(angle),
          y: centerY + curRy * Math.sin(angle),
          type: 'corner',
        });
      }
      break;
    }

    case 'heart': {
      points = [
        { id: `${pathId}-0`, x: centerX, y: top + height * 0.28, type: 'broken', handleOut: { x: centerX + width * 0.2, y: top } },
        { id: `${pathId}-1`, x: right, y: top + height * 0.35, type: 'smooth', handleIn: { x: right, y: top + height * 0.15 }, handleOut: { x: right, y: top + height * 0.6 } },
        { id: `${pathId}-2`, x: centerX, y: bottom, type: 'corner' },
        { id: `${pathId}-3`, x: left, y: top + height * 0.35, type: 'smooth', handleIn: { x: left, y: top + height * 0.6 }, handleOut: { x: left, y: top + height * 0.15 } },
      ];
      break;
    }

    case 'shield': {
      points = [
        { id: `${pathId}-0`, x: left, y: top, type: 'corner' },
        { id: `${pathId}-1`, x: right, y: top, type: 'corner' },
        { id: `${pathId}-2`, x: right, y: top + height * 0.5, type: 'smooth', handleOut: { x: right, y: bottom - height * 0.2 } },
        { id: `${pathId}-3`, x: centerX, y: bottom, type: 'corner' },
        { id: `${pathId}-4`, x: left, y: top + height * 0.5, type: 'smooth', handleIn: { x: left, y: bottom - height * 0.2 } },
      ];
      break;
    }

    case 'arrow': {
      points = [
        { id: `${pathId}-0`, x: left, y: top + height * 0.3 },
        { id: `${pathId}-1`, x: left + width * 0.5, y: top + height * 0.3 },
        { id: `${pathId}-2`, x: left + width * 0.5, y: top },
        { id: `${pathId}-3`, x: right, y: centerY },
        { id: `${pathId}-4`, x: left + width * 0.5, y: bottom },
        { id: `${pathId}-5`, x: left + width * 0.5, y: bottom - height * 0.3 },
        { id: `${pathId}-6`, x: left, y: bottom - height * 0.3 },
      ].map((p, idx) => ({ id: `${pathId}-${idx}`, x: p.x, y: p.y, type: 'corner' }));
      break;
    }

    case 'diamond': {
      points = [
        { id: `${pathId}-0`, x: centerX, y: top, type: 'corner' },
        { id: `${pathId}-1`, x: right, y: centerY, type: 'corner' },
        { id: `${pathId}-2`, x: centerX, y: bottom, type: 'corner' },
        { id: `${pathId}-3`, x: left, y: centerY, type: 'corner' },
      ];
      break;
    }

    case 'pill': {
      const rx = height / 2;
      const k = rx * K_CIRCLE;
      points = [
        { id: `${pathId}-0`, x: left + rx, y: top, type: 'smooth', handleIn: { x: left + rx - k, y: top } },
        { id: `${pathId}-1`, x: right - rx, y: top, type: 'smooth', handleOut: { x: right - rx + k, y: top } },
        { id: `${pathId}-2`, x: right, y: centerY, type: 'smooth', handleIn: { x: right, y: centerY - k }, handleOut: { x: right, y: centerY + k } },
        { id: `${pathId}-3`, x: right - rx, y: bottom, type: 'smooth', handleIn: { x: right - rx + k, y: bottom } },
        { id: `${pathId}-4`, x: left + rx, y: bottom, type: 'smooth', handleOut: { x: left + rx - k, y: bottom } },
        { id: `${pathId}-5`, x: left, y: centerY, type: 'smooth', handleIn: { x: left, y: centerY + k }, handleOut: { x: left, y: centerY - k } },
      ];
      break;
    }

    case 'crescent': {
      points = [
        { id: `${pathId}-0`, x: centerX, y: top, type: 'smooth', handleOut: { x: right + width * 0.2, y: centerY - height * 0.2 } },
        { id: `${pathId}-1`, x: centerX, y: bottom, type: 'smooth', handleIn: { x: right + width * 0.2, y: centerY + height * 0.2 }, handleOut: { x: centerX + width * 0.2, y: bottom - height * 0.2 } },
        { id: `${pathId}-2`, x: left + width * 0.3, y: centerY, type: 'smooth', handleIn: { x: centerX + width * 0.2, y: centerY + height * 0.2 }, handleOut: { x: centerX + width * 0.2, y: centerY - height * 0.2 } },
      ];
      break;
    }

    case 'line': {
      closed = false;
      points = [
        { id: `${pathId}-0`, x: startX, y: startY, type: 'corner' },
        { id: `${pathId}-1`, x: endX, y: endY, type: 'corner' },
      ];
      break;
    }

    case 'ring':
    default: {
      const rx = width / 2;
      const ry = height / 2;
      const kx = rx * K_CIRCLE;
      const ky = ry * K_CIRCLE;
      points = [
        { id: `${pathId}-0`, x: centerX, y: top, type: 'smooth', handleIn: { x: centerX - kx, y: top }, handleOut: { x: centerX + kx, y: top } },
        { id: `${pathId}-1`, x: right, y: centerY, type: 'smooth', handleIn: { x: right, y: centerY - ky }, handleOut: { x: right, y: centerY + ky } },
        { id: `${pathId}-2`, x: centerX, y: bottom, type: 'smooth', handleIn: { x: centerX + kx, y: bottom }, handleOut: { x: centerX - kx, y: bottom } },
        { id: `${pathId}-3`, x: left, y: centerY, type: 'smooth', handleIn: { x: left, y: centerY + ky }, handleOut: { x: left, y: centerY - ky } },
      ];
      break;
    }
  }

  return {
    id: pathId,
    name: `${options.kind.charAt(0).toUpperCase() + options.kind.slice(1)}`,
    points,
    closed,
    fill: options.kind === 'line' ? 'none' : style.fill,
    fillOpacity: 1,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeOpacity: 1,
    strokeCap: 'round',
    strokeJoin: 'round',
    pressureProfile: 'uniform',
  };
}
