import type { AdofaiEvent } from '../structure/interfaces';

export interface PositionTrack extends AdofaiEvent {
    eventType: 'PositionTrack';
    startTile?: number;
    floorCount?: number;
    positionOffset?: [number, number];
    easing?: string;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
