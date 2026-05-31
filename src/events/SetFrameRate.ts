import type { AdofaiEvent } from '../structure/interfaces';

export interface SetFrameRate extends AdofaiEvent {
    eventType: 'SetFrameRate';
    frameRate?: number;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
