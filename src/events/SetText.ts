import type { AdofaiEvent } from '../structure/interfaces';

export interface SetText extends AdofaiEvent {
    eventType: 'SetText';
    decText?: string;
    tag?: string;
    duration?: number;
    color?: string;
    colorTo?: string;
    colorToDuration?: number;
    colorToEasing?: string;
    fadeIn?: number;
    fadeOut?: number;
    easing?: string;
    positionOffset?: [number, number];
    rotationOffset?: number;
    scale?: [number, number];
    opacity?: number;
}
