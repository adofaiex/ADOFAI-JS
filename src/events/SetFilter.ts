import type { AdofaiEvent } from '../structure/interfaces';

export interface SetFilter extends AdofaiEvent {
    eventType: 'SetFilter';
    filterType?: 'Grayscale' | 'Sepia' | 'Invert' | 'Pixellate' | 'Blur' | 'Glitch' | 'Bloom' | 'VHS' | 'Warp' | 'RadialBlur' | 'Custom';
    intensity?: number;
    duration?: number;
    easing?: string;
    angleOffset?: number;
    [key: string]: any;
}
