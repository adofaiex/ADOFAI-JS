import type { AdofaiEvent } from '../structure/interfaces';

export interface ScaleMargin extends AdofaiEvent {
    eventType: 'ScaleMargin';
    scale?: number;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
