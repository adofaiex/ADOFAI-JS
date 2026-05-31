import type { AdofaiEvent } from '../structure/interfaces';

export interface MoveDecorations extends AdofaiEvent {
    eventType: 'MoveDecorations';
    duration?: number;
    tag?: string;
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
    parallaxOffset?: [number, number];
    pivotOffset?: [number, number];
}
