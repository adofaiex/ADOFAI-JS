import type { AdofaiEvent } from '../structure/interfaces';

export interface PlaySound extends AdofaiEvent {
    eventType: 'PlaySound';
    sound?: string;
    volume?: number;
    pan?: number;
    loop?: boolean;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
