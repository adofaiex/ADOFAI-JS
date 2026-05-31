import type { AdofaiEvent } from '../structure/interfaces';

export interface AddObject extends AdofaiEvent {
    eventType: 'AddObject';
    object?: string;
    position?: [number, number];
    rotation?: number;
    scale?: [number, number];
    opacity?: number;
    parallax?: [number, number];
    tag?: string;
    depth?: number;
    color?: string;
    imageSmoothing?: boolean;
    angleOffset?: number;
}
