import { AdofaiEvent, ActionData, LevelOptions, EventCallback, GuidCallback, Tile, ParseProvider, ParseProgressEvent, PrecomputedProgressEvents, LightweightPrecomputedData } from './interfaces';
import pathData from '../pathdata';
import exportAsADOFAI from './format'
import BaseParser from '../parser';
import effectProcessor from '../filter/effectProcessor';
import { EffectCleanerType } from '../filter/effectProcessor';
function uuid(): string {
    const r = new Uint8Array(16);
    const crypto = globalThis.crypto ?? (globalThis as any)?.msCrypto;
    if (crypto?.getRandomValues) {
        crypto.getRandomValues(r);
    } else {
        for (let i = 0; i < 16; i++) r[i] = Math.floor(Math.random() * 256);
    }
    r[6] = (r[6] & 0x0f) | 0x40;
    r[8] = (r[8] & 0x3f) | 0x80;
    const h = (b: number) => (b >>> 4).toString(16) + (b & 0x0f).toString(16);
    return h(r[0]) + h(r[1]) + h(r[2]) + h(r[3]) + '-'
        + h(r[4]) + h(r[5]) + '-'
        + h(r[6]) + h(r[7]) + '-'
        + h(r[8]) + h(r[9]) + '-'
        + h(r[10]) + h(r[11]) + h(r[12]) + h(r[13]) + h(r[14]) + h(r[15]);
}
import * as presets from '../filter/presets';

export class Level {
    private _events: Map<string, EventCallback[]>;
    private guidCallbacks: Map<string, GuidCallback>;
    private _options: string | LevelOptions;
    private _provider?: ParseProvider;
    public angleData!: number[];
    public actions!: AdofaiEvent[];
    public settings!: Record<string, any>;
    public __decorations!: AdofaiEvent[];
    public tiles!: Tile[];
    private _angleDir!: number;
    private _twirlCount!: number;
    /** 预计算的事件缓存 */
    private _precomputedEvents: PrecomputedProgressEvents | null = null;
    /** 是否启用预计算模式 */
    private _precomputeMode: boolean = false;
    /** 轻量级预计算数据（用于大物量渲染） */
    private _lightweightData: LightweightPrecomputedData | null = null;

    constructor(opt: string | LevelOptions, provider?: ParseProvider) {
        this._events = new Map();
        this.guidCallbacks = new Map();

        this._options = opt;
        this._provider = provider;
    }

    generateGUID(): string {
        return `event_${uuid()}`;
    }

    /**
     * 触发进度事件
     */
    private _emitProgress(
        stage: ParseProgressEvent['stage'],
        current: number,
        total: number,
        data?: ParseProgressEvent['data']
    ): void {
        const progressEvent: ParseProgressEvent = {
            stage,
            current,
            total,
            percent: total > 0 ? Math.round((current / total) * 100) : 0,
            data
        };

        // 如果是预计算模式，存储事件而不是触发
        if (this._precomputeMode && this._precomputedEvents) {
            this._precomputedEvents[stage].push(progressEvent);
        } else {
            this.trigger('parse:progress', progressEvent);
            this.trigger(`parse:${stage}`, progressEvent);
        }
    }

    /**
     * 启用预计算模式 - 在 load() 和 calculateTilePosition() 过程中不触发事件，
     * 而是将所有事件缓存起来，之后可以通过 getPrecomputedEvents() 获取
     */
    public enablePrecomputeMode(): void {
        this._precomputeMode = true;
        this._precomputedEvents = {
            start: [],
            pathData: [],
            angleData: [],
            relativeAngle: [],
            tilePosition: [],
            complete: []
        };
    }

    /**
     * 禁用预计算模式
     */
    public disablePrecomputeMode(): void {
        this._precomputeMode = false;
    }

    /**
     * 获取预计算的事件缓存
     * 返回所有缓存的进度事件，可以用于渲染器按帧播放
     */
    public getPrecomputedEvents(): PrecomputedProgressEvents | null {
        return this._precomputedEvents;
    }

    /**
     * 清除预计算的事件缓存
     */
    public clearPrecomputedEvents(): void {
        this._precomputedEvents = null;
    }

    /**
     * 按进度百分比获取事件（用于渲染器按帧渲染）
     * @param percent 0-100 的百分比
     * @param stage 可选，指定阶段
     */
    public getEventsAtPercent(percent: number, stage?: ParseProgressEvent['stage']): ParseProgressEvent[] {
        if (!this._precomputedEvents) return [];

        const result: ParseProgressEvent[] = [];
        const stages = stage ? [stage] : (['start', 'pathData', 'angleData', 'relativeAngle', 'tilePosition', 'complete'] as const);

        for (const s of stages) {
            const events = this._precomputedEvents[s];
            for (const event of events) {
                if (event.percent <= percent) {
                    // 获取不超过目标百分比的最后一个事件
                    if (result.length === 0 || result[result.length - 1].percent <= event.percent) {
                        // 避免重复添加相同百分比的事件
                        const lastEvent = result[result.length - 1];
                        if (!lastEvent || lastEvent.stage !== event.stage || lastEvent.current !== event.current) {
                            result.push(event);
                        }
                    }
                }
            }
        }

        return result;
    }

    /**
     * 获取指定阶段的总事件数
     */
    public getPrecomputedEventCount(stage?: ParseProgressEvent['stage']): number {
        if (!this._precomputedEvents) return 0;

        if (stage) {
            return this._precomputedEvents[stage].length;
        }

        return Object.values(this._precomputedEvents).reduce((sum, arr) => sum + arr.length, 0);
    }


    /**
     * 获取轻量级预计算数据
     * 只包含渲染必需的数据：angles, positions, twirlFlags
     * 内存占用极低，适合大物量谱面
     */
    public getLightweightData(): LightweightPrecomputedData | null {
        return this._lightweightData;
    }

    /**
     * 轻量级预计算 - 只计算渲染必需的数据
     * 不存储完整的 tile 对象，极大减少内存占用
     * 
     * @param skipPositionCalculation 是否跳过坐标计算（如果只需要角度数据）
     */
    public precomputeLightweight(skipPositionCalculation: boolean = false): LightweightPrecomputedData {
        const totalTiles = this.tiles.length;

        // 预分配数组
        const angles = new Array<number>(totalTiles);
        const positions: [number, number][] = skipPositionCalculation ? [] : new Array<[number, number]>(totalTiles);
        const twirlFlags = new Array<boolean>(totalTiles);

        // 提取角度和 twirl 标记
        for (let i = 0; i < totalTiles; i++) {
            const tile = this.tiles[i];
            angles[i] = tile.angle ?? 0;
            twirlFlags[i] = (tile.twirl ?? 0) % 2 === 1;
        }

        // 计算坐标（如果需要）
        if (!skipPositionCalculation) {
            const startPos = [0, 0];
            const angleData = this.angleData;

            // 预构建 PositionTrack 索引
            const positionTrackMap = new Map<number, AdofaiEvent>();
            for (const action of this.actions) {
                if (action.eventType === 'PositionTrack' && action.positionOffset) {
                    if (action.editorOnly !== true && action.editorOnly !== 'Enabled') {
                        positionTrackMap.set(action.floor, action);
                    }
                }
            }

            for (let i = 0; i < totalTiles; i++) {
                // 处理 PositionTrack
                const posTrack = positionTrackMap.get(i);
                if (posTrack?.positionOffset) {
                    startPos[0] += posTrack.positionOffset[0] as number;
                    startPos[1] += posTrack.positionOffset[1] as number;
                }

                positions[i] = [startPos[0], startPos[1]];

                // 计算下一个位置（向前回溯连续999）
                let angle: number;
                if (angleData[i] === 999) {
                    let minus = 1;
                    while (i - minus >= 0 && angleData[i - minus] === 999) {
                        minus++;
                    }
                    const realAngle = i - minus >= 0 ? angleData[i - minus] : 0;
                    angle = realAngle + (minus - 1) * 180;
                } else {
                    angle = angleData[i];
                }
                const rad = angle * Math.PI / 180;
                startPos[0] += Math.cos(rad);
                startPos[1] += Math.sin(rad);
            }
        }

        this._lightweightData = {
            totalTiles,
            angles,
            positions,
            twirlFlags,
            computed: true
        };

        return this._lightweightData;
    }

    /**
     * 获取指定范围内的轻量级渲染数据（分片获取，避免一次性加载全部）
     * @param startIndex 起始索引
     * @param count 数量
     */
    public getLightweightDataRange(startIndex: number, count: number): { angles: number[], positions: [number, number][], twirlFlags: boolean[] } | null {
        if (!this._lightweightData) return null;

        const end = Math.min(startIndex + count, this._lightweightData.totalTiles);

        return {
            angles: this._lightweightData.angles.slice(startIndex, end),
            positions: this._lightweightData.positions.slice(startIndex, end),
            twirlFlags: this._lightweightData.twirlFlags.slice(startIndex, end)
        };
    }

    /**
     * 清除轻量级预计算数据
     */
    public clearLightweightData(): void {
        this._lightweightData = null;
    }

    /**
     * 获取单个 tile 的渲染数据（按需获取，不预加载全部）
     */
    public getTileRenderData(index: number): { angle: number, position: [number, number] | null, hasTwirl: boolean } | null {
        if (index < 0 || index >= this.tiles.length) return null;

        const tile = this.tiles[index];
        return {
            angle: tile.angle ?? 0,
            position: tile.position ? [tile.position[0], tile.position[1]] as [number, number] : null,
            hasTwirl: (tile.twirl ?? 0) % 2 === 1
        };
    }

    load(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let opt = this._options;
            let options: LevelOptions;

            this._emitProgress('start', 0, 0);

            const isArrayBuffer = opt instanceof ArrayBuffer;
			const isUint8Array = opt instanceof Uint8Array;
			const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(opt);

            if (typeof opt === 'string' || isArrayBuffer || isUint8Array || isBuffer) {
				try {
					let input = isArrayBuffer ? new Uint8Array(opt as ArrayBuffer) : opt;
                
					// 确保此时 input 是 string, Uint8Array 或 Buffer
					options = this._provider?.parse(input as any) as LevelOptions;
				} 
				catch (e) {
					reject("解析失败: " + e);
					return;
				}
			} 
			else if (typeof opt === 'object' && opt !== null) {
				options = Object.assign({}, opt) as LevelOptions;
			} 
			else {
				reject("Options must be String, Buffer, ArrayBuffer or Object");
				return;
			}

            // 阶段2: 处理 pathData 或 angleData
            const hasPathData = options && typeof options === 'object' && options !== null && typeof options.pathData !== 'undefined';
            const hasAngleData = options && typeof options === 'object' && options !== null && typeof options.angleData !== 'undefined';

            if (hasPathData) {
                const pathDataStr = options['pathData']!;
                // 开始转换 pathData
                this._emitProgress('pathData', 0, pathDataStr.length, { source: pathDataStr });
                this.angleData = pathData.parseToangleData(pathDataStr);
                // 转换完成，返回结果
                this._emitProgress('pathData', pathDataStr.length, pathDataStr.length, {
                    source: pathDataStr,
                    processed: this.angleData
                });
            } else if (hasAngleData) {
                this.angleData = options['angleData']!;
                this._emitProgress('angleData', this.angleData.length, this.angleData.length, {
                    processed: this.angleData
                });
            } else {
                reject("There is not any angle datas.");
                return;
            }

            // 阶段3: 提取其他数据
            if (options && typeof options === 'object' && options !== null && Array.isArray(options.actions)) {
                this.actions = options['actions']!;
            } else {
                this.actions = [];
            }
            if (options && typeof options === 'object' && options !== null && typeof options.settings !== 'undefined') {
                this.settings = options['settings']!;
            } else {
                reject("There is no ADOFAI settings.");
                return;
            }
            if (options && typeof options === 'object' && options !== null && Array.isArray(options.decorations)) {
                this.__decorations = options['decorations']!;
            } else {
                this.__decorations = [];
            }

            this.tiles = [];
            this._angleDir = -180;
            this._twirlCount = 0;

            // 阶段4: 创建 Tile 数组（带进度回调）
            this._createArray(this.angleData.length, { angleData: this.angleData, actions: this.actions, decorations: this.__decorations })
                .then(e => {
                    this.tiles = e;
                    this._emitProgress('complete', this.angleData.length, this.angleData.length);
                    this.trigger('load', this);
                    resolve(true);
                }).catch(e => {
                    reject(e);
                });

        });
    }

    on(eventName: string, callback: Function): string {
        if (!this._events.has(eventName)) {
            this._events.set(eventName, []);
        }

        const guid = this.generateGUID();
        const eventCallbacks = this._events.get(eventName)!;

        eventCallbacks.push({ guid, callback });
        this.guidCallbacks.set(guid, { eventName, callback });

        return guid;
    }

    trigger(eventName: string, data: any): void {
        if (!this._events.has(eventName)) return;

        const callbacks = this._events.get(eventName)!;
        callbacks.forEach(({ callback }) => callback(data));
    }

    off(guid: string): void {
        if (!this.guidCallbacks.has(guid)) return;

        const { eventName } = this.guidCallbacks.get(guid)!;
        this.guidCallbacks.delete(guid);

        if (!this._events.has(eventName)) return;

        const callbacks = this._events.get(eventName)!;
        const index = callbacks.findIndex(cb => cb.guid === guid);

        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    private async _createArray(xLength: number, opt: { angleData: number[], actions: AdofaiEvent[], decorations: AdofaiEvent[] }): Promise<Tile[]> {
        const tiles: Tile[] = new Array(xLength);
        const batchSize = Math.max(100, Math.floor(xLength / 100)); // 每批处理的数量，提高最小批量

        // 性能优化：预先按 floor 分组 actions 和 decorations
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

        for (let i = 0; i < xLength; i++) {
            // 从 Map 中直接获取当前 floor 的 actions
            const floorActions = actionsByFloor.get(i) || [];
            const floorDecos = decorationsByFloor.get(i) || [];

            // 更新 _twirlCount
            for (const action of floorActions) {
                if (action.eventType === 'Twirl') {
                    this._twirlCount++;
                }
            }

            // 计算相对角度
            const angle = this._parseAngle(opt.angleData, i, this._twirlCount % 2);

            // 移除 floor 属性并创建 tile
            const tileActions = floorActions.map(({ floor, ...rest }) => rest);
            const tileDecos = floorDecos.map(({ floor, ...rest }) => rest);

            tiles[i] = {
                direction: opt.angleData[i],
                _lastdir: opt.angleData[i - 1] || 0,
                actions: tileActions,
                angle: angle,
                addDecorations: tileDecos,
                twirl: this._twirlCount,
                extraProps: {}
            };

            // 降低进度汇报和让出循环的频率
            if (i % batchSize === 0 || i === xLength - 1) {
                this._emitProgress('relativeAngle', i + 1, xLength, {
                    tileIndex: i,
                    angle: opt.angleData[i],
                    relativeAngle: angle
                });

                // 每 10% 让出一次，或者对于超大谱面增加频率
                if (i % (batchSize * 10) === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }
        return tiles;
    }

    private _changeAngle(): Tile[] {
        let y = 0;
        let m = this.tiles.map(t => {
            y++;
            t.angle = this._parsechangedAngle(t.direction!, y, t.twirl!, t._lastdir!);
            return t;
        });
        return m;
    }

    private _normalizeAngle(v: number): number {
        return ((v % 360) + 360) % 360;
    }

    private _parsechangedAngle(agd: number, i: number, isTwirl: number, lstagd: number): number {
        let prev = 0;
        if (i === 0) { this._angleDir = 180; }
        if (agd === 999) {
            // 向前回溯（1-based i → tiles 0-based index: i-1 是当前tile）
            let minus = 1;
            while (i - minus - 1 >= 0 && this.tiles[i - minus - 1]?.direction === 999) {
                minus++;
            }
            const realAngle = i - minus - 1 >= 0 ? this.tiles[i - minus - 1].direction! : 0;
            this._angleDir = this._normalizeAngle(realAngle + (minus - 1) * 180);
            if (isNaN(this._angleDir)) {
                this._angleDir = 0;
            }
            prev = 0;
        } else {
            const delta = this._normalizeAngle(this._angleDir - agd);
            if (isTwirl === 0) {
                prev = delta;
            } else {
                prev = this._normalizeAngle(360 - delta);
            }
            if (prev === 0) {
                prev = 360;
            }
            this._angleDir = this._normalizeAngle(agd + 180);
        }
        return prev;
    }


    private _filterByFloor(arr: AdofaiEvent[], i: number): ActionData[] {
        if (!Array.isArray(arr)) return [];
        let actionT = arr.filter(item => item.floor === i);
        this._twirlCount += actionT.filter(t => t.eventType === 'Twirl').length;
        return actionT.map(({ floor, ...rest }) => rest);
    }

    private _flattenAngleDatas(arr: Tile[]): number[] {
        return arr.map(item => item.direction!);
    }
    private _flattenActionsWithFloor(arr: Tile[]): AdofaiEvent[] {
        return arr.flatMap((tile, index) =>
            (Array.isArray(tile?.actions) ? tile.actions : []).map(({ floor, ...rest }) => ({ floor: index, ...rest } as AdofaiEvent))
        );
    }
    private _filterByFloorwithDeco(arr: AdofaiEvent[], i: number): ActionData[] {
        if (!Array.isArray(arr)) return [];
        let actionT = arr.filter(item => item.floor === i);
        return actionT.map(({ floor, ...rest }) => rest);
    }

    private _flattenDecorationsWithFloor(arr: Tile[]): AdofaiEvent[] {
        return arr.flatMap((tile, index) =>
            (Array.isArray(tile?.addDecorations) ? tile.addDecorations : []).map(({ floor, ...rest }) => ({ floor: index, ...rest } as AdofaiEvent))
        );
    }
    private _parseAngle(agd: number[], i: number, isTwirl: number): number {
        let prev = 0;
        if (i === 0) { this._angleDir = 180; }
        if (agd[i] === 999) {
            // 向前回溯，找到第一个非999的真实角度
            let minus = 1;
            while (i - minus >= 0 && agd[i - minus] === 999) {
                minus++;
            }
            const realAngle = i - minus >= 0 ? agd[i - minus] : 0;
            this._angleDir = this._normalizeAngle(realAngle + (minus - 1) * 180);
            if (isNaN(this._angleDir)) {
                this._angleDir = 0;
            }
            prev = 0;
        } else {
            const delta = this._normalizeAngle(this._angleDir - agd[i]);
            if (isTwirl === 0) {
                prev = delta;
            } else {
                prev = this._normalizeAngle(360 - delta);
            }
            if (prev === 0) {
                prev = 360;
            }
            this._angleDir = this._normalizeAngle(agd[i] + 180);
        }
        return prev;
    }

    public filterActionsByEventType(en: string): { index: number, action: ActionData }[] {
        return Object.entries(this.tiles)
            .flatMap(([index, a]) =>
                (Array.isArray(a.actions) ? a.actions : []).map(b => ({ b, index }))
            )
            .filter(({ b }) => b.eventType === en)
            .map(({ b, index }) => ({
                index: Number(index),
                action: b
            }));
    }

    public getActionsByIndex(en: string, index: number): { count: number, actions: ActionData[] } {
        const filtered = this.filterActionsByEventType(en);
        const matches = filtered.filter(item => item.index === index);

        return {
            count: matches.length,
            actions: matches.map(item => item.action)
        };
    }

    public calculateTileCoordinates(): void {
        console.warn("calculateTileCoordinates is deprecated. Use calculateTilePosition instead.");
    }

    /**
     * 计算所有 Tile 的坐标位置
     * 触发 parse:tilePosition 和 parse:progress 事件报告进度
     * 
     * 性能优化：预先构建 PositionTrack 索引，避免循环内重复遍历
     */
    public calculateTilePosition(): number[][] {
        const angles = this.angleData;
        const totalTiles = this.tiles.length;
        const positions: number[][] = [];
        const startPos = [0, 0];

        // 性能优化：预先构建 PositionTrack 索引 Map，O(n) 预处理
        const positionTrackMap = new Map<number, AdofaiEvent>();
        for (const action of this.actions) {
            if (action.eventType === 'PositionTrack' && action.positionOffset) {
                if (action.editorOnly !== true && action.editorOnly !== 'Enabled') {
                    positionTrackMap.set(action.floor, action);
                }
            }
        }

        // 触发开始事件
        this._emitProgress('tilePosition', 0, totalTiles);

        // 预处理 floats 数组（向前回溯连续999）
        const floats = new Array<number>(totalTiles);
        for (let i = 0; i < totalTiles; i++) {
            if (angles[i] === 999) {
                let minus = 1;
                while (i - minus >= 0 && angles[i - minus] === 999) {
                    minus++;
                }
                const realAngle = i - minus >= 0 ? angles[i - minus] : 0;
                floats[i] = realAngle + (minus - 1) * 180;
            } else {
                floats[i] = angles[i];
            }
        }

        // 进度事件触发频率：每 1% 或最少每 100 个 tile 触发一次
        const progressInterval = Math.max(100, Math.floor(totalTiles / 100));

        for (let i = 0; i <= totalTiles; i++) {
            const isLastTile = i === totalTiles;
            const angle1 = isLastTile ? (floats[i - 1] || 0) : floats[i];
            const angle2 = i === 0 ? 0 : (floats[i - 1] || 0);
            const currentTile = this.tiles[i];

            // 使用索引 Map 直接查询，O(1) 复杂度
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

            // 更新位置
            const rad = angle1 * Math.PI / 180;
            startPos[0] += Math.cos(rad);
            startPos[1] += Math.sin(rad);

            // 触发进度事件（降低频率，轻量级数据）
            if (i % progressInterval === 0 || isLastTile) {
                this._emitProgress('tilePosition', i, totalTiles, {
                    tileIndex: i,
                    position: [tempPos[0], tempPos[1]],
                    angle: angle1
                });
            }
        }

        // 触发完成事件
        this._emitProgress('tilePosition', totalTiles, totalTiles, {
            processed: positions.flat()
        });

        return positions;
    }
    public floorOperation(info: { type: 'append' | 'insert' | 'delete', direction: number, id?: number } = { type: 'append', direction: 0 }): void {
        switch (info.type) {
            case 'append':
                this.appendFloor(info);
                break;
            case 'insert':
                if (typeof info.id === 'number') {
                    this.tiles.splice(info.id, 0, {
                        direction: info.direction || 0,
                        angle: 0,
                        actions: [],
                        addDecorations: [],
                        _lastdir: this.tiles[info.id - 1].direction,
                        twirl: this.tiles[info.id - 1].twirl
                    });
                }
                break;
            case 'delete':
                if (typeof info.id === 'number') {
                    this.tiles.splice(info.id, 1);
                }
                break;
        }
        this._changeAngle();
    }

    public appendFloor(args: { direction: number }): void {
        this.tiles.push({
            direction: args.direction,
            angle: 0,
            actions: [],
            addDecorations: [],
            _lastdir: this.tiles[this.tiles.length - 1].direction,
            twirl: this.tiles[this.tiles.length - 1].twirl,
            extraProps: {}
        });
        this._changeAngle();
    }

    public clearDeco(): boolean {
        this.tiles = effectProcessor.clearDecorations(this.tiles) as Tile[];
        return true;
    }

    public clearEffect(presetName: string): void {
        this.clearEvent(presets[presetName as keyof typeof presets]);
    }

    public clearEvent(preset: { type: EffectCleanerType | string, events: string[] }): void {
        if (preset.type == EffectCleanerType.include) {
            this.tiles = effectProcessor.keepEvents(preset.events, this.tiles) as Tile[];
        } else if (preset.type == EffectCleanerType.exclude) {
            this.tiles = effectProcessor.clearEvents(preset.events, this.tiles) as Tile[];
        }
    }
    public export(type: 'string' | 'object', indent: number, useAdofaiStyle: boolean = true, indentChar: string, indentStep: number): string | Record<string, any> {
        const ADOFAI = {
            angleData: this._flattenAngleDatas(this.tiles),
            settings: this.settings,
            actions: this._flattenActionsWithFloor(this.tiles),
            decorations: this._flattenDecorationsWithFloor(this.tiles)
        };
        return type === 'object' ? ADOFAI : exportAsADOFAI(ADOFAI, indent, useAdofaiStyle, indentChar, indentStep);
    }
}
