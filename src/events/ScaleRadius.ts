import type { AdofaiEvent } from '../structure/interfaces';

export interface ScaleRadius extends AdofaiEvent {
    eventType: 'ScaleRadius';
    scale?: number;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
