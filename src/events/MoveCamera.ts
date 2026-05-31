import type { AdofaiEvent } from '../structure/interfaces';

export interface MoveCamera extends AdofaiEvent {
    eventType: 'MoveCamera';
    duration?: number;
    relativeTo?: 'Tile' | 'LastPosition' | 'Player';
    position?: [number, number];
    rotation?: number;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    easing?: string;
    editorOnly?: boolean | 'Enabled';
}
