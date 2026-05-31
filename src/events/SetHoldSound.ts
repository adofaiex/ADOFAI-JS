import type { AdofaiEvent } from '../structure/interfaces';

export interface SetHoldSound extends AdofaiEvent {
    eventType: 'SetHoldSound';
    holdStartSound?: string;
    holdStartSoundVolume?: number;
    holdMidSound?: string;
    holdMidSoundVolume?: number;
    holdMidSoundTiming?: number;
    holdMidSoundTimingRelativeTo?: 'Start' | 'End';
    holdEndSound?: string;
    holdEndSoundVolume?: number;
    angleOffset?: number;
}
