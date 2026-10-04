import { AdofaiEvent, ActionData, LevelOptions, EventCallback, GuidCallback, Tile, ParseProvider, ParseProgressEvent, PrecomputedProgressEvents, LightweightPrecomputedData } from './interfaces';
import { CompactTileStore } from './CompactTileStore';
import pathData from '../pathdata';
import exportAsADOFAI from './format'
import BaseParser from '../parser';
import effectProcessor from '../filter/effectProcessor';
import { EffectCleanerType } from '../filter/effectProcessor';
import * as presets from '../filter/presets';
import { createTiles, changeAngles, filterActionsByEventType as filterActions, getActionsByIndex as getActions, calculateTilePositions, precomputePositions, resolveAngleOffset, flattenAngleDatas, flattenActionsWithFloor, flattenDecorationsWithFloor, isDecorationEvent } from './levelAngle';

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

export class Level {
    private _events: Map<string, EventCallback[]>;
    private guidCallbacks: Map<string, GuidCallback>;
    private _options: string | LevelOptions | Uint8Array | ArrayBuffer;
    private _provider?: ParseProvider;
    public angleData!: number[];
    public actions!: AdofaiEvent[];
    public settings!: Record<string, any>;
    public __decorations!: AdofaiEvent[];
    public tiles!: Tile[] | CompactTileStore;
    /**
     * 紧凑砖块存储选项（大物量谱面）：
     *   - `false`（默认）：对象模式，行为与旧版完全一致；
     *   - `true`：总是紧凑模式；
     *   - `number`：砖数超过该阈值时自动紧凑。
     * 紧凑模式下 `tiles` 是 CompactTileStore：保留 `length`，读取用 getAngle/getDirection/
     * getActions 等；`edit(i)` 只物化单块砖；`export()` 无损（Twirl 由差分还原）。
     */
    private _compactOption: boolean | number = false;
    /** 预计算的事件缓存 */
    private _precomputedEvents: PrecomputedProgressEvents | null = null;
    /** 是否启用预计算模式 */
    private _precomputeMode: boolean = false;
    /** 轻量级预计算数据（用于大物量渲染） */
    private _lightweightData: LightweightPrecomputedData | null = null;

    constructor(opt: string | LevelOptions | Uint8Array | ArrayBuffer, provider?: ParseProvider, options?: { compactTiles?: boolean | number }) {
        this._events = new Map();
        this.guidCallbacks = new Map();
        this._options = opt;
        this._provider = provider;
        this._compactOption = options?.compactTiles ?? false;
    }

    generateGUID(): string {
        return `event_${uuid()}`;
    }

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

        if (this._precomputeMode && this._precomputedEvents) {
            this._precomputedEvents[stage].push(progressEvent);
        } else {
            this.trigger('parse:progress', progressEvent);
            this.trigger(`parse:${stage}`, progressEvent);
        }
    }

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

    public disablePrecomputeMode(): void {
        this._precomputeMode = false;
    }

    public getPrecomputedEvents(): PrecomputedProgressEvents | null {
        return this._precomputedEvents;
    }

    public clearPrecomputedEvents(): void {
        this._precomputedEvents = null;
    }

    public getEventsAtPercent(percent: number, stage?: ParseProgressEvent['stage']): ParseProgressEvent[] {
        if (!this._precomputedEvents) return [];

        const result: ParseProgressEvent[] = [];
        const stages = stage ? [stage] : (['start', 'pathData', 'angleData', 'relativeAngle', 'tilePosition', 'complete'] as const);

        for (const s of stages) {
            const events = this._precomputedEvents[s];
            for (const event of events) {
                if (event.percent <= percent) {
                    if (result.length === 0 || result[result.length - 1].percent <= event.percent) {
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

    public getPrecomputedEventCount(stage?: ParseProgressEvent['stage']): number {
        if (!this._precomputedEvents) return 0;
        if (stage) return this._precomputedEvents[stage].length;
        return Object.values(this._precomputedEvents).reduce((sum, arr) => sum + arr.length, 0);
    }

    public getLightweightData(): LightweightPrecomputedData | null {
        return this._lightweightData;
    }

    public precomputeLightweight(skipPositionCalculation: boolean = false): LightweightPrecomputedData {
        const totalTiles = this.tiles.length;

        const angles = new Array<number>(totalTiles);
        const positions: [number, number][] = skipPositionCalculation ? [] : new Array<[number, number]>(totalTiles);
        const twirlFlags = new Array<boolean>(totalTiles);

        if (this.tiles instanceof CompactTileStore) {
            const store = this.tiles;
            for (let i = 0; i < totalTiles; i++) {
                angles[i] = store.getAngle(i) ?? 0;
                twirlFlags[i] = store.getTwirl(i) % 2 === 1;
            }
        } else {
            for (let i = 0; i < totalTiles; i++) {
                const tile = this.tiles[i];
                angles[i] = tile.angle ?? 0;
                twirlFlags[i] = (tile.twirl ?? 0) % 2 === 1;
            }
        }

        if (!skipPositionCalculation) {
            const result = precomputePositions(this.angleData, totalTiles, this.actions);
            for (let i = 0; i < totalTiles; i++) {
                positions[i] = result.positions[i];
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

    public getLightweightDataRange(startIndex: number, count: number): { angles: number[], positions: [number, number][], twirlFlags: boolean[] } | null {
        if (!this._lightweightData) return null;
        const end = Math.min(startIndex + count, this._lightweightData.totalTiles);
        return {
            angles: this._lightweightData.angles.slice(startIndex, end),
            positions: this._lightweightData.positions.slice(startIndex, end),
            twirlFlags: this._lightweightData.twirlFlags.slice(startIndex, end)
        };
    }

    public clearLightweightData(): void {
        this._lightweightData = null;
    }

    public getTileRenderData(index: number): { angle: number, position: [number, number] | null, hasTwirl: boolean } | null {
        if (index < 0 || index >= this.tiles.length) return null;
        if (this.tiles instanceof CompactTileStore) {
            const store = this.tiles;
            return {
                angle: store.getAngle(index) ?? 0,
                position: null,
                hasTwirl: store.getTwirl(index) % 2 === 1
            };
        }
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
            const isBuffer = typeof (globalThis as any).Buffer !== 'undefined' && (globalThis as any).Buffer.isBuffer(opt);

            if (typeof opt === 'string' || isArrayBuffer || isUint8Array || isBuffer) {
                try {
                    let input = isArrayBuffer ? new Uint8Array(opt as ArrayBuffer) : opt;
                    options = this._provider?.parse(input as any) as LevelOptions;
                } catch (e) {
                    reject("解析失败: " + e);
                    return;
                }
            } else if (typeof opt === 'object' && opt !== null) {
                options = Object.assign({}, opt) as LevelOptions;
            } else {
                reject("Options must be String, Buffer, ArrayBuffer or Object");
                return;
            }

            // 源数据（原始 JSON 字符串 / 构造对象引用）只在解析阶段需要，但此前一直由
            // `_options` 常驻在 Level 实例上（10MB 谱面 ≈ 20MB UTF-16 字符串；百万砖
            // 谱面下白白占内存）。解析完成后立即释放；本地 `opt` 同样置空，避免异步的
            // createTiles 期间闭包继续持有源字符串。如需重新 load，请用新的 Level 实例。
            this._options = null as any;
            opt = null as any;

            const hasPathData = options && typeof options === 'object' && options !== null && typeof options.pathData !== 'undefined';
            const hasAngleData = options && typeof options === 'object' && options !== null && typeof options.angleData !== 'undefined';

            if (hasPathData) {
                const pathDataStr = options['pathData']!;
                this._emitProgress('pathData', 0, pathDataStr.length, { source: pathDataStr });
                this.angleData = pathData.parseToangleData(pathDataStr);
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

            // Fallback: 早期谱面可能把装饰事件放在 actions 里，将其归入 decorations（单遍分离）
            if (this.actions.length > 0) {
                let hasDecoration = false;
                for (let i = 0; i < this.actions.length; i++) {
                    if (isDecorationEvent(this.actions[i])) {
                        hasDecoration = true;
                        break;
                    }
                }
                if (hasDecoration) {
                    const keptActions = new Array<AdofaiEvent>(this.actions.length);
                    const movedDecorations: AdofaiEvent[] = [];
                    let keptCount = 0;
                    for (const action of this.actions) {
                        if (isDecorationEvent(action)) {
                            movedDecorations.push(action);
                        } else {
                            keptActions[keptCount++] = action;
                        }
                    }
                    keptActions.length = keptCount;
                    this.__decorations = this.__decorations.concat(movedDecorations);
                    this.actions = keptActions;
                }
            }

            this.tiles = [];
            let twirlCount = 0;

            const compactOpt = this._compactOption;
            const compact = compactOpt === true
                || (typeof compactOpt === 'number' && this.angleData.length > compactOpt);
            if (compact) {
                console.log(`[adofai] compact tile store: ${this.angleData.length} tiles`);
            }

            createTiles(this.angleData.length, {
                angleData: this.angleData,
                actions: this.actions,
                decorations: this.__decorations
            }, {
                onProgress: (stage, current, total, data) => this._emitProgress(stage, current, total, data),
                onTwirl: (count) => { twirlCount = count; },
                getTwirl: () => twirlCount,
            }, compact).then(e => {
                this.tiles = e;
                if (compact && Array.isArray(this.actions)) {
                    // 紧凑模式：Twirl 的语义已完整保存在 store.twirl（累计计数）里，
                    // 这里把 600 万级的 Twirl 事件对象从 actions 中剥离（本谱约占
                    // 几百 MB 常驻堆）。导出时 CompactTileStore.flattenActions 会
                    // 从 twirl 差分无损还原成一条条 Twirl 事件。
                    const keptActions: AdofaiEvent[] = [];
                    for (let i = 0; i < this.actions.length; i++) {
                        const a = this.actions[i];
                        if (a.eventType !== 'Twirl') keptActions.push(a);
                    }
                    this.actions = keptActions;
                }
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
        const callbacks = this._events.get(eventName);
        if (callbacks === undefined) return;
        const length = callbacks.length;
        for (let i = 0; i < length; i++) {
            callbacks[i].callback(data);
        }
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

    public filterActionsByEventType(en: string): { index: number, action: ActionData }[] {
        if (this.tiles instanceof CompactTileStore) {
            const out: { index: number; action: ActionData }[] = [];
            const store = this.tiles;
            for (const [floor, actions] of store.actionsByFloor) {
                for (const a of actions) {
                    if (a.eventType === en) out.push({ index: floor, action: a });
                }
            }
            return out;
        }
        return filterActions(this.tiles, en);
    }

    public getActionsByIndex(en: string, index: number): { count: number, actions: ActionData[] } {
        if (this.tiles instanceof CompactTileStore) {
            const actions = this.tiles.getActions(index).filter(a => a.eventType === en);
            return { count: actions.length, actions };
        }
        return getActions(this.tiles, en, index);
    }

    /** 紧凑模式 → 对象数组（结构编辑或需要 Tile[] 的 API 前调用）。 */
    public toObjectTiles(): Tile[] {
        if (this.tiles instanceof CompactTileStore) {
            this.tiles = this.tiles.toTileArray();
        }
        return this.tiles as Tile[];
    }

    public isCompactTiles(): boolean {
        return this.tiles instanceof CompactTileStore;
    }

    public calculateTileCoordinates(): void {
        console.warn("calculateTileCoordinates is deprecated. Use calculateTilePosition instead.");
    }

    public calculateTilePosition(): number[][] {
        const tiles = this.toObjectTiles();
        return calculateTilePositions(
            this.angleData,
            tiles,
            this.actions,
            (stage, current, total, data) => this._emitProgress(stage as ParseProgressEvent['stage'], current, total, data)
        );
    }

    public floorOperation(info: { type: 'append' | 'insert' | 'delete', direction: number, id?: number } = { type: 'append', direction: 0 }): void {
        const tiles = this.toObjectTiles();
        switch (info.type) {
            case 'append':
                this.appendFloor(info);
                break;
            case 'insert':
                if (typeof info.id === 'number') {
                    tiles.splice(info.id, 0, {
                        direction: info.direction || 0,
                        angle: 0,
                        actions: [],
                        addDecorations: [],
                        _lastdir: tiles[info.id - 1].direction,
                        twirl: tiles[info.id - 1].twirl
                    });
                }
                break;
            case 'delete':
                if (typeof info.id === 'number') {
                    tiles.splice(info.id, 1);
                }
                break;
        }
        changeAngles(tiles);
    }

    public appendFloor(args: { direction: number }): void {
        const tiles = this.toObjectTiles();
        tiles.push({
            direction: args.direction,
            angle: 0,
            actions: [],
            addDecorations: [],
            _lastdir: tiles[tiles.length - 1].direction,
            twirl: tiles[tiles.length - 1].twirl,
            extraProps: {}
        });
        changeAngles(tiles);
    }

    public clearDeco(): boolean {
        const tiles = this.toObjectTiles();
        this.tiles = effectProcessor.clearDecorations(tiles) as Tile[];
        return true;
    }

    public clearEffect(presetName: string): void {
        this.clearEvent(presets[presetName as keyof typeof presets]);
    }

    public clearEvent(preset: { type: EffectCleanerType | string, events: string[] }): void {
        const tiles = this.toObjectTiles();
        if (preset.type == EffectCleanerType.include) {
            this.tiles = effectProcessor.keepEvents(preset.events, tiles) as Tile[];
        } else if (preset.type == EffectCleanerType.exclude) {
            this.tiles = effectProcessor.clearEvents(preset.events, tiles) as Tile[];
        }
    }

    public export(type: 'string' | 'object', indent: number, useAdofaiStyle: boolean = true, indentChar: string, indentStep: number): string | Record<string, any> {
        let ADOFAI: {
            angleData: number[];
            settings: Record<string, any>;
            actions: AdofaiEvent[];
            decorations: AdofaiEvent[];
        };
        if (this.tiles instanceof CompactTileStore && !this.tiles.hasEdits()) {
            // 紧凑快速导出：不物化 Tile 对象，Twirl 从 twirl 数组差分还原
            ADOFAI = {
                angleData: this.tiles.flattenAngleData(),
                settings: this.settings,
                actions: this.tiles.flattenActions(),
                decorations: this.tiles.flattenDecorations(),
            };
        } else {
            const tiles = this.toObjectTiles();
            ADOFAI = {
                angleData: flattenAngleDatas(tiles),
                settings: this.settings,
                actions: flattenActionsWithFloor(tiles),
                decorations: flattenDecorationsWithFloor(tiles)
            };
        }
        return type === 'object' ? ADOFAI : exportAsADOFAI(ADOFAI, indent, useAdofaiStyle, indentChar, indentStep);
    }
}
