import type { AdofaiEvent } from '../structure/interfaces';

export interface FreeRoam extends AdofaiEvent {
    eventType: 'FreeRoam';
    duration?: number;
    angleCorrectionDir?: 'None' | 'CW' | 'CCW';
    freeRoamAngle?: number;
    freeRoamAngleLocal?: boolean;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
