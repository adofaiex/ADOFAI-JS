import type { AdofaiEvent } from '../structure/interfaces';

export interface FreeRoamRemove extends AdofaiEvent {
    eventType: 'FreeRoamRemove';
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
