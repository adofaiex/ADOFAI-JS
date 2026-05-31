import type { AdofaiEvent } from '../structure/interfaces';

export interface Hide extends AdofaiEvent {
    eventType: 'Hide';
    hideJudgment?: boolean;
    hideUI?: boolean;
    hidePlanet?: boolean;
    editorOnly?: boolean | 'Enabled';
    angleOffset?: number;
}
