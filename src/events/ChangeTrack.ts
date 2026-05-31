import type { AdofaiEvent } from '../structure/interfaces';

export interface ChangeTrack extends AdofaiEvent {
    eventType: 'ChangeTrack';
    startTile?: number;
    floorCount?: number;
    duration?: number;
    positionOffset?: [number, number];
    angleOffset?: number;
    easing?: string;
    tag?: string;
}
