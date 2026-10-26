import { Layer, VectorPath } from '../types/vector';

export interface LogoTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Geometric' | 'Monogram' | 'Abstract' | 'Golden Ratio' | 'Minimalist';
  layers: Layer[];
}

export const LOGO_TEMPLATES: LogoTemplate[] = [
  {
    id: 'golden-ratio-grid',
    name: 'Shape Builder Golden Grid',
    description: 'Intersecting golden ratio circles ready for merging or subtracting logo marks.',
    category: 'Golden Ratio',
    layers: [
      {
        id: 'layer-guide-circles',
        name: 'Golden Circles',
        visible: true,
        locked: false,
        opacity: 1,
        paths: [
          // Circle 1 - Left
          {
            id: 'c-1',
            name: 'Radius 140 (Left)',
            points: [
              { id: 'c1-0', x: 250, y: 160, type: 'smooth', handleIn: { x: 172.7, y: 160 }, handleOut: { x: 327.3, y: 160 } },
              { id: 'c1-1', x: 390, y: 300, type: 'smooth', handleIn: { x: 390, y: 222.7 }, handleOut: { x: 390, y: 377.3 } },
              { id: 'c1-2', x: 250, y: 440, type: 'smooth', handleIn: { x: 327.3, y: 440 }, handleOut: { x: 172.7, y: 440 } },
              { id: 'c1-3', x: 110, y: 300, type: 'smooth', handleIn: { x: 110, y: 377.3 }, handleOut: { x: 110, y: 222.7 } },
            ],
            closed: true,
            fill: '#00E5FF',
            fillOpacity: 1,
            stroke: '#00E5FF',
            strokeWidth: 3,
            strokeOpacity: 1,
            strokeCap: 'round',
            strokeJoin: 'round',
            pressureProfile: 'uniform',
          },
          // Circle 2 - Right
          {
            id: 'c-2',
            name: 'Radius 140 (Right)',
            points: [
              { id: 'c2-0', x: 350, y: 160, type: 'smooth', handleIn: { x: 272.7, y: 160 }, handleOut: { x: 427.3, y: 160 } },
              { id: 'c2-1', x: 490, y: 300, type: 'smooth', handleIn: { x: 490, y: 222.7 }, handleOut: { x: 490, y: 377.3 } },
              { id: 'c2-2', x: 350, y: 440, type: 'smooth', handleIn: { x: 427.3, y: 440 }, handleOut: { x: 272.7, y: 440 } },
              { id: 'c2-3', x: 210, y: 300, type: 'smooth', handleIn: { x: 210, y: 377.3 }, handleOut: { x: 210, y: 222.7 } },
            ],
            closed: true,
            fill: '#FFB800',
            fillOpacity: 1,
            stroke: '#FFB800',
            strokeWidth: 3,
            strokeOpacity: 1,
            strokeCap: 'round',
            strokeJoin: 'round',
            pressureProfile: 'uniform',
          },
          // Circle 3 - Center Inner
          {
            id: 'c-3',
            name: 'Center Core',
            points: [
              { id: 'c3-0', x: 300, y: 210, type: 'smooth', handleIn: { x: 250.3, y: 210 }, handleOut: { x: 349.7, y: 210 } },
              { id: 'c3-1', x: 390, y: 300, type: 'smooth', handleIn: { x: 390, y: 250.3 }, handleOut: { x: 390, y: 349.7 } },
              { id: 'c3-2', x: 300, y: 390, type: 'smooth', handleIn: { x: 349.7, y: 390 }, handleOut: { x: 250.3, y: 390 } },
              { id: 'c3-3', x: 210, y: 300, type: 'smooth', handleIn: { x: 210, y: 349.7 }, handleOut: { x: 210, y: 250.3 } },
            ],
            closed: true,
            fill: '#7C3AED',
            fillOpacity: 1,
            stroke: '#A78BFA',
            strokeWidth: 3,
            strokeOpacity: 1,
            strokeCap: 'round',
            strokeJoin: 'round',
            pressureProfile: 'uniform',
          },
        ],
      },
    ],
  },
  {
    id: 'cyber-falcon',
    name: 'Cyber Falcon Emblem',
    description: 'Sharp precision aerodynamic vector wings with geometric symmetry.',
    category: 'Geometric',
    layers: [
      {
        id: 'layer-falcon-wings',
        name: 'Falcon Mark',
        visible: true,
        locked: false,
        opacity: 1,
        paths: [
          // Left wing
          {
            id: 'w-left',
            name: 'Left Wing',
            points: [
              { id: 'wl-0', x: 300, y: 170, type: 'corner' },
              { id: 'wl-1', x: 130, y: 240, type: 'smooth', handleIn: { x: 190, y: 200 }, handleOut: { x: 100, y: 270 } },
              { id: 'wl-2', x: 170, y: 330, type: 'corner' },
              { id: 'wl-3', x: 240, y: 290, type: 'smooth', handleIn: { x: 210, y: 310 }, handleOut: { x: 260, y: 280 } },
              { id: 'wl-4', x: 200, y: 400, type: 'corner' },
              { id: 'wl-5', x: 300, y: 350, type: 'corner' },
            ],
            closed: true,
            fill: '#00E5FF',
            fillOpacity: 1,
            stroke: '#38BDF8',
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeCap: 'round',
            strokeJoin: 'round',
            pressureProfile: 'uniform',
          },
          // Right wing
          {
            id: 'w-right',
            name: 'Right Wing',
            points: [
              { id: 'wr-0', x: 300, y: 170, type: 'corner' },
              { id: 'wr-1', x: 470, y: 240, type: 'smooth', handleIn: { x: 410, y: 200 }, handleOut: { x: 500, y: 270 } },
              { id: 'wr-2', x: 430, y: 330, type: 'corner' },
              { id: 'wr-3', x: 360, y: 290, type: 'smooth', handleIn: { x: 390, y: 310 }, handleOut: { x: 340, y: 280 } },
              { id: 'wr-4', x: 400, y: 400, type: 'corner' },
              { id: 'wr-5', x: 300, y: 350, type: 'corner' },
            ],
            closed: true,
            fill: '#0284C7',
            fillOpacity: 1,
            stroke: '#38BDF8',
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeCap: 'round',
            strokeJoin: 'round',
            pressureProfile: 'uniform',
          },
          // Crown crest
          {
            id: 'w-crest',
            name: 'Falcon Crest',
            points: [
              { id: 'wc-0', x: 300, y: 120, type: 'corner' },
              { id: 'wc-1', x: 330, y: 165, type: 'corner' },
              { id: 'wc-2', x: 300, y: 200, type: 'corner' },
              { id: 'wc-3', x: 270, y: 165, type: 'corner' },
            ],
            closed: true,
            fill: '#F59E0B',
            fillOpacity: 1,
            stroke: '#FCD34D',
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeCap: 'round',
            strokeJoin: 'round',
            pressureProfile: 'uniform',
          },
        ],
      },
    ],
  },
  {
    id: 'infinity-loop',
    name: 'Aeterna Infinity Loop',
    description: 'Smooth harmonic continuous bezier curve with calligraphic depth.',
    category: 'Abstract',
    layers: [
      {
        id: 'layer-loop',
        name: 'Infinity Curves',
        visible: true,
        locked: false,
        opacity: 1,
        paths: [
          {
            id: 'inf-curve-1',
            name: 'Loop Ribbon',
            points: [
              { id: 'p0', x: 300, y: 300, type: 'smooth', handleIn: { x: 260, y: 240 }, handleOut: { x: 340, y: 360 } },
              { id: 'p1', x: 430, y: 370, type: 'smooth', handleIn: { x: 380, y: 400 }, handleOut: { x: 480, y: 340 } },
              { id: 'p2', x: 480, y: 260, type: 'smooth', handleIn: { x: 500, y: 300 }, handleOut: { x: 460, y: 220 } },
              { id: 'p3', x: 370, y: 220, type: 'smooth', handleIn: { x: 410, y: 200 }, handleOut: { x: 330, y: 240 } },
              { id: 'p4', x: 230, y: 360, type: 'smooth', handleIn: { x: 270, y: 340 }, handleOut: { x: 190, y: 380 } },
              { id: 'p5', x: 120, y: 340, type: 'smooth', handleIn: { x: 140, y: 390 }, handleOut: { x: 100, y: 290 } },
              { id: 'p6', x: 160, y: 230, type: 'smooth', handleIn: { x: 110, y: 250 }, handleOut: { x: 210, y: 210 } },
            ],
            closed: true,
            fill: '#10B981',
            fillOpacity: 1,
            stroke: '#10B981',
            strokeWidth: 10,
            strokeOpacity: 1,
            strokeCap: 'round',
            strokeJoin: 'round',
            pressureProfile: 'uniform',
          },
        ],
      },
    ],
  },
];
