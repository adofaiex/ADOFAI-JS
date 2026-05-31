import type { AdofaiEvent } from '../structure/interfaces';

export interface FreeRoamTwirl extends AdofaiEvent {
    eventType: 'FreeRoamTwirl';
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
