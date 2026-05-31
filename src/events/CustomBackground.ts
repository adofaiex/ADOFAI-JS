import type { AdofaiEvent } from '../structure/interfaces';

export interface CustomBackground extends AdofaiEvent {
    eventType: 'CustomBackground';
    bgImage?: string;
    bgImageColor?: string;
    parallax?: [number, number];
    bgDisplayMode?: 'FitToScreen' | 'Unscaled' | 'Tiled';
    lockRot?: boolean;
    loopBG?: boolean;
    scalingRatio?: number;
    imageSmoothing?: boolean;
    showDefaultBGIfNoImage?: boolean;
    showDefaultBGTile?: boolean;
    defaultBGTileColor?: string;
    defaultBGShapeType?: 'Disabled' | 'Tile' | 'Circle' | 'Diamond' | 'Triangle' | 'Hexagon' | 'Donut' | 'Pentagon' | 'Custom';
    defaultBGShapeColor?: string;
    duration?: number;
    easing?: string;
    colorTo?: string;
    colorToDuration?: number;
    colorToEasing?: string;
    angleOffset?: number;
}
