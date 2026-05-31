import type { AdofaiEvent } from '../structure/interfaces';

export interface AddDecoration extends AdofaiEvent {
    eventType: 'AddDecoration';
    decText?: string;
    decTextColor?: string;
    decTextFont?: string;
    decTextAnchor?: 'UpperLeft' | 'UpperCenter' | 'UpperRight' | 'MiddleLeft' | 'MiddleCenter' | 'MiddleRight' | 'LowerLeft' | 'LowerCenter' | 'LowerRight';
    decTextScale?: number;
    decTextAngle?: number;
    decTextDepth?: number;
    decorationImage?: string;
    angleOffset?: number;
    position?: [number, number];
    rotation?: number;
    scale?: [number, number];
    parallax?: [number, number];
    opacity?: number;
    color?: string;
    depth?: number;
    tag?: string;
    imageSmoothing?: boolean;
    hitbox?: 'None' | 'Kill' | 'PassThrough' | 'NoEffect';
    failsafe?: boolean;
}
