import { AdofaiEvent, ActionData, Tile, ParseProgressEvent } from './interfaces';

export function normalizeAngle(v: number): number {
  return ((v % 360) + 360) % 360;
}

export function resolveAngleOffset(v: number): number | null {
  if (v === 555) return 72;
  if (v === 666) return -72;
  if (v === 777) return 52;
  if (v === 888) return -52;
  return null;
}

export interface AngleState {
  value: number;
}

export function parseAngle(
  agd: number[],
  i: number,
  angleDir: AngleState,
  isTwirl: number
): number {
  let prev = 0;
  if (i === 0) angleDir.value = 180;

  const offset = resolveAngleOffset(agd[i]);
  if (offset !== null) {
    const prevDir = normalizeAngle(angleDir.value - 180);
    const actualDir = normalizeAngle(prevDir + offset);
    const delta = normalizeAngle(angleDir.value - actualDir);
    prev = isTwirl === 0 ? delta : normalizeAngle(360 - delta);
    if (prev === 0) prev = 360;
    angleDir.value = normalizeAngle(actualDir + 180);
  } else if (agd[i] === 999) {
    let minus = 1;
    while (i - minus >= 0 && agd[i - minus] === 999) minus++;
    const realAngle = i - minus >= 0 ? agd[i - minus] : 0;
    angleDir.value = normalizeAngle(realAngle + (minus - 1) * 180);
    if (isNaN(angleDir.value)) angleDir.value = 0;
    prev = 0;
  } else {
    const delta = normalizeAngle(angleDir.value - agd[i]);
    prev = isTwirl === 0 ? delta : normalizeAngle(360 - delta);
    if (prev === 0) prev = 360;
    angleDir.value = normalizeAngle(agd[i] + 180);
  }
  return prev;
}

export function parseChangedAngle(
  agd: number,
  i: number,
  angleDir: AngleState,
  isTwirl: number,
  tiles: Tile[]
): number {
  let prev = 0;
  if (i === 0) angleDir.value = 180;

  const offset = resolveAngleOffset(agd);
  if (offset !== null) {
    const prevDir = normalizeAngle(angleDir.value - 180);
    const actualDir = normalizeAngle(prevDir + offset);
    const delta = normalizeAngle(angleDir.value - actualDir);
    prev = isTwirl === 0 ? delta : normalizeAngle(360 - delta);
    if (prev === 0) prev = 360;
    angleDir.value = normalizeAngle(actualDir + 180);
  } else if (agd === 999) {
    let minus = 1;
    while (i - minus - 1 >= 0 && tiles[i - minus - 1]?.direction === 999) minus++;
    const realAngle = i - minus - 1 >= 0 ? tiles[i - minus - 1].direction! : 0;
    angleDir.value = normalizeAngle(realAngle + (minus - 1) * 180);
    if (isNaN(angleDir.value)) angleDir.value = 0;
    prev = 0;
  } else {
    const delta = normalizeAngle(angleDir.value - agd);
    prev = isTwirl === 0 ? delta : normalizeAngle(360 - delta);
    if (prev === 0) prev = 360;
    angleDir.value = normalizeAngle(agd + 180);
  }
  return prev;
}

export function filterActionsByEventType(tiles: Tile[], eventType: string): { index: number; action: ActionData }[] {
  return tiles
    .flatMap((tile, idx) =>
      (Array.isArray(tile.actions) ? tile.actions : []).map(a => ({ a, idx }))
    )
    .filter(({ a }) => a.eventType === eventType)
    .map(({ a, idx }) => ({ index: idx, action: a }));
}

export function getActionsByIndex(tiles: Tile[], eventType: string, index: number): { count: number; actions: ActionData[] } {
  const filtered = filterActionsByEventType(tiles, eventType);
  const matches = filtered.filter(item => item.index === index);
  return {
    count: matches.length,
    actions: matches.map(item => item.action),
  };
}

function filterByFloor(arr: AdofaiEvent[], i: number): ActionData[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item.floor === i).map(({ floor, ...rest }) => rest);
}

function filterByFloorWithDeco(arr: AdofaiEvent[], i: number): ActionData[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item.floor === i).map(({ floor, ...rest }) => rest);
}

export interface CreateTilesOptions {
  angleData: number[];
  actions: AdofaiEvent[];
  decorations: AdofaiEvent[];
}

export interface CreateTilesCallbacks {
  onProgress: (stage: ParseProgressEvent['stage'], current: number, total: number, data?: ParseProgressEvent['data']) => void;
  onTwirl: (count: number) => void;
  getTwirl: () => number;
}

export async function createTiles(
  xLength: number,
  opt: CreateTilesOptions,
  cbs: CreateTilesCallbacks
): Promise<Tile[]> {
  const tiles: Tile[] = new Array(xLength);
  const batchSize = Math.max(100, Math.floor(xLength / 100));

  const actionsByFloor = new Map<number, AdofaiEvent[]>();
  if (Array.isArray(opt.actions)) {
    for (const action of opt.actions) {
      if (!actionsByFloor.has(action.floor)) {
        actionsByFloor.set(action.floor, []);
      }
      actionsByFloor.get(action.floor)!.push(action);
    }
  }

  const decorationsByFloor = new Map<number, AdofaiEvent[]>();
  if (Array.isArray(opt.decorations)) {
    for (const deco of opt.decorations) {
      if (!decorationsByFloor.has(deco.floor)) {
        decorationsByFloor.set(deco.floor, []);
      }
      decorationsByFloor.get(deco.floor)!.push(deco);
    }
  }

  const angleDir: AngleState = { value: 180 };

  for (let i = 0; i < xLength; i++) {
    const floorActions = actionsByFloor.get(i) || [];
    const floorDecos = decorationsByFloor.get(i) || [];

    for (const action of floorActions) {
      if (action.eventType === 'Twirl') {
        cbs.onTwirl(cbs.getTwirl() + 1);
      }
    }

    const angle = parseAngle(opt.angleData, i, angleDir, cbs.getTwirl() % 2);
    const tileActions = floorActions.map(({ floor, ...rest }) => rest);
    const tileDecos = floorDecos.map(({ floor, ...rest }) => rest);

    tiles[i] = {
      direction: opt.angleData[i],
      _lastdir: opt.angleData[i - 1] || 0,
      actions: tileActions,
      angle: angle,
      addDecorations: tileDecos,
      twirl: cbs.getTwirl(),
      extraProps: {},
    };

    if (i % batchSize === 0 || i === xLength - 1) {
      cbs.onProgress('relativeAngle', i + 1, xLength, {
        tileIndex: i,
        angle: opt.angleData[i],
        relativeAngle: angle,
      });
      if (i % (batchSize * 10) === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }
  return tiles;
}

export function changeAngles(tiles: Tile[]): Tile[] {
  const angleDir: AngleState = { value: 180 };
  return tiles.map((t, i) => {
    t.angle = parseChangedAngle(t.direction!, i + 1, angleDir, t.twirl!, tiles);
    return t;
  });
}

export function flattenAngleDatas(tiles: Tile[]): number[] {
  return tiles.map(item => item.direction!);
}

export function flattenActionsWithFloor(tiles: Tile[]): AdofaiEvent[] {
  return tiles.flatMap((tile, idx) =>
    (Array.isArray(tile?.actions) ? tile.actions : []).map(a => ({ floor: idx, ...a } as unknown as AdofaiEvent))
  );
}

export function flattenDecorationsWithFloor(tiles: Tile[]): AdofaiEvent[] {
  return tiles.flatMap((tile, idx) =>
    (Array.isArray(tile?.addDecorations) ? tile.addDecorations : []).map(d => ({ floor: idx, ...d } as unknown as AdofaiEvent))
  );
}

export interface AngleDataRef {
  [index: number]: number;
  length: number;
}

export function calculateTilePositions(
  angleData: number[],
  tiles: Tile[],
  actions: AdofaiEvent[],
  emitProgress: (stage: string, current: number, total: number, data?: any) => void
): number[][] {
  const totalTiles = tiles.length;
  const positions: number[][] = [];
  const startPos = [0, 0];

  const positionTrackMap = new Map<number, AdofaiEvent>();
  for (const action of actions) {
    if (action.eventType === 'PositionTrack' && action.positionOffset) {
      if (action.editorOnly !== true && action.editorOnly !== 'Enabled') {
        positionTrackMap.set(action.floor, action);
      }
    }
  }

  emitProgress('tilePosition', 0, totalTiles);

  const floats = new Array<number>(totalTiles);
  for (let i = 0; i < totalTiles; i++) {
    const offset = resolveAngleOffset(angleData[i]);
    if (offset !== null) {
      floats[i] = (i > 0 ? floats[i - 1] : 0) + offset;
    } else {
      floats[i] = angleData[i];
    }
  }
  for (let i = 0; i < totalTiles; i++) {
    if (floats[i] === 999) {
      let minus = 1;
      while (i - minus >= 0 && floats[i - minus] === 999) minus++;
      const realAngle = i - minus >= 0 ? floats[i - minus] : 0;
      floats[i] = realAngle + (minus - 1) * 180;
    }
  }

  const progressInterval = Math.max(100, Math.floor(totalTiles / 100));

  for (let i = 0; i <= totalTiles; i++) {
    const isLastTile = i === totalTiles;
    const angle1 = isLastTile ? (floats[i - 1] || 0) : floats[i];
    const angle2 = i === 0 ? 0 : (floats[i - 1] || 0);
    const currentTile = tiles[i];

    const posTrack = positionTrackMap.get(i);
    if (posTrack?.positionOffset) {
      startPos[0] += posTrack.positionOffset[0] as number;
      startPos[1] += posTrack.positionOffset[1] as number;
    }

    const tempPos = [startPos[0], startPos[1]];
    positions.push(tempPos);

    if (currentTile) {
      currentTile.position = tempPos;
      currentTile.extraProps!.angle1 = angle1;
      currentTile.extraProps!.angle2 = angle2 - 180;
      currentTile.extraProps!.cangle = isLastTile ? floats[i - 1] + 180 : floats[i];
    }

    const rad = angle1 * Math.PI / 180;
    startPos[0] += Math.cos(rad);
    startPos[1] += Math.sin(rad);

    if (i % progressInterval === 0 || isLastTile) {
      emitProgress('tilePosition', i, totalTiles, {
        tileIndex: i,
        position: [tempPos[0], tempPos[1]],
        angle: angle1,
      });
    }
  }

  emitProgress('tilePosition', totalTiles, totalTiles, {
    processed: positions.flat(),
  });

  return positions;
}

export function precomputePositions(
  angleData: number[],
  totalTiles: number,
  actions: AdofaiEvent[]
): { positions: [number, number][]; angles: number[] } {
  const positions: [number, number][] = new Array<[number, number]>(totalTiles);
  const resolvedAngles = new Array<number>(totalTiles);
  const startPos = [0, 0];

  const positionTrackMap = new Map<number, AdofaiEvent>();
  for (const action of actions) {
    if (action.eventType === 'PositionTrack' && action.positionOffset) {
      if (action.editorOnly !== true && action.editorOnly !== 'Enabled') {
        positionTrackMap.set(action.floor, action);
      }
    }
  }

  for (let i = 0; i < totalTiles; i++) {
    const posTrack = positionTrackMap.get(i);
    if (posTrack?.positionOffset) {
      startPos[0] += posTrack.positionOffset[0] as number;
      startPos[1] += posTrack.positionOffset[1] as number;
    }

    positions[i] = [startPos[0], startPos[1]];

    const offset = resolveAngleOffset(angleData[i]);
    if (offset !== null) {
      resolvedAngles[i] = (i > 0 ? resolvedAngles[i - 1] : 0) + offset;
    } else if (angleData[i] === 999) {
      let minus = 1;
      while (i - minus >= 0 && angleData[i - minus] === 999) minus++;
      const realAngle = i - minus >= 0 ? angleData[i - minus] : 0;
      resolvedAngles[i] = realAngle + (minus - 1) * 180;
    } else {
      resolvedAngles[i] = angleData[i];
    }

    const rad = resolvedAngles[i] * Math.PI / 180;
    startPos[0] += Math.cos(rad);
    startPos[1] += Math.sin(rad);
  }

  return { positions, angles: resolvedAngles };
}
