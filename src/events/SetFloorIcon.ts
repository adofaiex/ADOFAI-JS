import type { AdofaiEvent } from '../structure/interfaces';

export interface SetFloorIcon extends AdofaiEvent {
    eventType: 'SetFloorIcon';
    floorIcon?: string;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
