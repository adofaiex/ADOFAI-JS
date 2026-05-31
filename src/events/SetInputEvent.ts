import type { AdofaiEvent } from '../structure/interfaces';

export interface SetInputEvent extends AdofaiEvent {
    eventType: 'SetInputEvent';
    inputAction?: string;
    inputEventState?: 'Subscribe' | 'Unsubscribe';
    inputEventTarget?: 'Pressed' | 'Released' | 'Held' | 'Neutral';
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
