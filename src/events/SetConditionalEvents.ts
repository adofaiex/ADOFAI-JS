import type { AdofaiEvent } from '../structure/interfaces';

export interface SetConditionalEvents extends AdofaiEvent {
    eventType: 'SetConditionalEvents';
    eventTag?: string;
    condition?: 'IfPassed' | 'IfFailed';
    execution?: string;
    events?: any[];
}
