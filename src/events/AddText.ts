import type { AdofaiEvent } from '../structure/interfaces';

export interface AddText extends AdofaiEvent {
    eventType: 'AddText';
    decText?: string;
    decTextColor?: string;
    decTextFont?: string;
    decTextAnchor?: string;
    decTextScale?: number;
    decTextAngle?: number;
    decTextDepth?: number;
    decTextFontSize?: number;
    angleOffset?: number;
    position?: [number, number];
    rotation?: number;
    scale?: [number, number];
    parallax?: [number, number];
    opacity?: number;
    color?: string;
    depth?: number;
    tag?: string;
}
