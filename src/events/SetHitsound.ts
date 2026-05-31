import type { AdofaiEvent } from '../structure/interfaces';

export interface SetHitsound extends AdofaiEvent {
    eventType: 'SetHitsound';
    hitsound?: 'Kick' | 'Snare' | 'Hat' | 'Clap' | 'Custom';
    hitsoundVolume?: number;
    customHitsound?: string;
    ease?: boolean;
    angleOffset?: number;
}
