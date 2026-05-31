import type { AdofaiEvent } from '../structure/interfaces';

export interface ScalePlanets extends AdofaiEvent {
    eventType: 'ScalePlanets';
    planetsScale?: number;
    scale?: number;
    duration?: number;
    easing?: string;
    targetPlanet?: 'All' | 'Current' | 'Specific';
    planetNumber?: number;
    angleOffset?: number;
}
