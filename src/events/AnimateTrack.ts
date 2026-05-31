import type { AdofaiEvent } from '../structure/interfaces';

export interface AnimateTrack extends AdofaiEvent {
    eventType: 'AnimateTrack';
    startTile?: number;
    floorCount?: number;
    duration?: number;
    easing?: string;
    tag?: string;
    positionOffset?: [number, number];
    rotation?: number;
    scale?: [number, number];
    opacity?: number;
    color?: string;
    colorTo?: string;
    colorToDuration?: number;
    colorToEasing?: string;
}
