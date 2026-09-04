// Hazard types and AABBs. GDD 3.
import type { HazardType } from '../session/events';

export interface Obstacle {
  /** Stable id: `L<loop>S<segment>:<index>`. Referenced by lane chips, manipulation and log. */
  id: string;
  type: HazardType;
  /** World x of the left edge in logic px. */
  x: number;
  width: number;
  /** Height above ground (0 for craters). */
  height: number;
  segment: number;
  loop: number;
  /** Set once the hopper is past it (or died at it). */
  resolved: boolean;
}

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
