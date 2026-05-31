import type { AdofaiEvent } from '../structure/interfaces';

export interface Flash extends AdofaiEvent {
    eventType: 'Flash';
    duration?: number;
    color?: string;
    colorTo?: string;
    colorToDuration?: number;
    colorToEasing?: string;
    flashStyle?: 'Flash' | 'Reverse' | 'StayBlack' | 'Kill' | 'FlashEx';
    opacity?: number;
    easing?: string;
    angleOffset?: number;
}
