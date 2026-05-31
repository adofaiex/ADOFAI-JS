import type { AdofaiEvent } from '../structure/interfaces';

export interface SetParticle extends AdofaiEvent {
    eventType: 'SetParticle';
    tag?: string;
    duration?: number;
    positionOffset?: [number, number];
    rotationOffset?: number;
    scale?: number;
    opacity?: number;
    color?: string;
    colorTo?: string;
    colorToDuration?: number;
    colorToEasing?: string;
    easing?: string;
    angleOffset?: number;
}
