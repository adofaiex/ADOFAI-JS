import type { AdofaiEvent } from '../structure/interfaces';

export interface MoveTrack extends AdofaiEvent {
    eventType: 'MoveTrack';
    startTile?: number;
    floorCount?: number;
    duration?: number;
    positionOffset?: [number, number];
    rotation?: number;
    scale?: [number, number];
    opacity?: number;
    easing?: string;
    tag?: string;
    angleOffset?: number;
}
