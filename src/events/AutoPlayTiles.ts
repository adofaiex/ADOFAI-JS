import type { AdofaiEvent } from '../structure/interfaces';

export interface AutoPlayTiles extends AdofaiEvent {
    eventType: 'AutoPlayTiles';
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
