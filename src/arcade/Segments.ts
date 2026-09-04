// Hand-built segment data (M1: two segments, craters + worms). GDD 3.
// No procedural randomness in M1-M3. Positions in meters from segment start
// (1 m = SessionConfig.pxPerMeter px). A segment is 20 s at 1.0x = 150 m.
//
// Geometry notes (see Physics.ts): the hopper jump covers 36 px. A crater of
// width 36 has exactly the timing window as tolerance; narrower craters are
// easier. Worms 8x8 are easy, 8x12 and 12x12 tighten the window.
import type { HazardType } from '../session/events';

export interface HazardDef {
  atMeter: number;
  type: HazardType;
  width: number;
  /** Height above ground; ignored for craters. */
  height?: number;
}

export interface SegmentDef {
  name: string;
  hazards: HazardDef[];
}

export const SEGMENTS: readonly SegmentDef[] = [
  {
    name: 'MARE TRANQUILLITATIS',
    hazards: [
      { atMeter: 14, type: 'crater', width: 24 },
      { atMeter: 26, type: 'worm', width: 8, height: 8 },
      { atMeter: 38, type: 'crater', width: 28 },
      { atMeter: 52, type: 'crater', width: 28 },
      { atMeter: 63, type: 'worm', width: 8, height: 8 },
      { atMeter: 75, type: 'crater', width: 32 },
      { atMeter: 88, type: 'worm', width: 8, height: 12 },
      { atMeter: 100, type: 'crater', width: 32 },
      { atMeter: 112, type: 'crater', width: 28 },
      { atMeter: 122, type: 'worm', width: 8, height: 8 },
      { atMeter: 136, type: 'crater', width: 34 },
    ],
  },
  {
    name: 'OCEANUS PROCELLARUM',
    hazards: [
      { atMeter: 12, type: 'worm', width: 12, height: 12 },
      { atMeter: 24, type: 'crater', width: 32 },
      { atMeter: 36, type: 'crater', width: 34 },
      { atMeter: 48, type: 'worm', width: 8, height: 12 },
      { atMeter: 58, type: 'crater', width: 36 },
      { atMeter: 70, type: 'worm', width: 12, height: 12 },
      { atMeter: 82, type: 'crater', width: 34 },
      { atMeter: 94, type: 'crater', width: 36 },
      { atMeter: 106, type: 'worm', width: 8, height: 12 },
      { atMeter: 116, type: 'crater', width: 36 },
      { atMeter: 128, type: 'worm', width: 12, height: 12 },
      { atMeter: 140, type: 'crater', width: 36 },
    ],
  },
];
