import type { AdofaiEvent } from '../structure/interfaces';

export interface SetFilterAdvanced extends AdofaiEvent {
    eventType: 'SetFilterAdvanced';
    filterType?: string;
    intensity?: number;
    duration?: number;
    easing?: string;
    angleOffset?: number;
    [key: string]: any;
}
