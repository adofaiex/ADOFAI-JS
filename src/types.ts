export type Vec2 = [number, number];

export type ABoolean = boolean | 'Enabled' | 'Disabled' | 'true' | 'false';

export const enum TextAnchor {
  UpperLeft = 'UpperLeft',
  UpperCenter = 'UpperCenter',
  UpperRight = 'UpperRight',
  MiddleLeft = 'MiddleLeft',
  MiddleCenter = 'MiddleCenter',
  MiddleRight = 'MiddleRight',
  LowerLeft = 'LowerLeft',
  LowerCenter = 'LowerCenter',
  LowerRight = 'LowerRight',
}

export const enum Hitbox {
  None = 'None',
  Kill = 'Kill',
  PassThrough = 'PassThrough',
  NoEffect = 'NoEffect',
}

export const enum FilterType {
  Grayscale = 'Grayscale',
  Sepia = 'Sepia',
  Invert = 'Invert',
  Pixellate = 'Pixellate',
  Blur = 'Blur',
  Glitch = 'Glitch',
  Bloom = 'Bloom',
  VHS = 'VHS',
  Warp = 'Warp',
  RadialBlur = 'RadialBlur',
  Custom = 'Custom',
}

export const enum FlashStyle {
  Flash = 'Flash',
  Reverse = 'Reverse',
  StayBlack = 'StayBlack',
  Kill = 'Kill',
  FlashEx = 'FlashEx',
}

export const enum RelativeTo {
  Tile = 'Tile',
  LastPosition = 'LastPosition',
  Player = 'Player',
}

export const enum TargetPlanet {
  All = 'All',
  Current = 'Current',
  Specific = 'Specific',
}

export const enum AngleCorrectionDir {
  None = 'None',
  CW = 'CW',
  CCW = 'CCW',
}

export const enum InputEventState {
  Subscribe = 'Subscribe',
  Unsubscribe = 'Unsubscribe',
}

export const enum InputEventTarget {
  Pressed = 'Pressed',
  Released = 'Released',
  Held = 'Held',
  Neutral = 'Neutral',
}

export const enum Condition {
  IfPassed = 'IfPassed',
  IfFailed = 'IfFailed',
}

export const enum BgDisplayMode {
  FitToScreen = 'FitToScreen',
  Unscaled = 'Unscaled',
  Tiled = 'Tiled',
}

export const enum BgShapeType {
  Disabled = 'Disabled',
  Tile = 'Tile',
  Circle = 'Circle',
  Diamond = 'Diamond',
  Triangle = 'Triangle',
  Hexagon = 'Hexagon',
  Donut = 'Donut',
  Pentagon = 'Pentagon',
  Custom = 'Custom',
}

export const enum HitsoundType {
  Kick = 'Kick',
  Snare = 'Snare',
  Hat = 'Hat',
  Clap = 'Clap',
  Custom = 'Custom',
}

export const enum HoldMidSoundTimingRelativeTo {
  Start = 'Start',
  End = 'End',
}

export function isEventEnabled(value: ABoolean | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return value === 'Enabled' || value === 'true';
}
