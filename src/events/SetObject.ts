import type { AdofaiEvent } from '../structure/interfaces';

export interface SetObject extends AdofaiEvent {
    eventType: 'SetObject';
    tag?: string;
    duration?: number;
    positionOffset?: [number, number];
    rotationOffset?: number;
    scale?: [number, number];
    opacity?: number;
    color?: string;
    colorTo?: string;
    colorToDuration?: number;
    colorToEasing?: string;
    easing?: string;
    angleOffset?: number;
}
