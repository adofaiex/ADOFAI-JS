import type { AdofaiEvent } from '../structure/interfaces';

export interface Bookmark extends AdofaiEvent {
    eventType: 'Bookmark';
    bookmark?: string;
    editorOnly?: boolean;
    angleOffset?: number;
}
