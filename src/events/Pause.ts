import type { AdofaiEvent } from '../structure/interfaces';

export interface Pause extends AdofaiEvent {
    eventType: 'Pause';
    duration?: number;
    angleCorrectionDir?: 'None' | 'CW' | 'CCW';
    countdownTicks?: number;
    angleOffset?: number;
}
