import { ActionData, AdofaiEvent, Tile } from './interfaces';

/** 共享空数组（紧凑模式下绝大多数砖没有 actions/decorations）。 */
const EMPTY_ACTIONS: ActionData[] = [];
const EMPTY_DECOS: ActionData[] = [];

/**
 * 紧凑砖块存储（大物量谱面用）。
 *
 * 对象模式下每砖一个 `{ direction, _lastdir, actions: [], angle, addDecorations: [], twirl, extraProps: {} }`
 * —— 百万砖级别就是数百万个对象 + 数组（数 GB）。紧凑模式改为：
 *   - direction/angle/_lastdir: Float32Array
 *   - twirl（累计翻转计数）: Int32Array
 *   - actions/decorations: 只保留"真的有事"的 floor 的稀疏 Map（Twirl 完全不存，
 *     导出时从 twirl 数组的差分无损还原）
 *   - extraProps: 用到才建（稀疏 Map）
 *
 * 编辑接口：
 *   - `edit(i)` 只把第 i 块砖物化成普通 Tile 对象（存覆盖层），get* 读取覆盖层优先；
 *   - `toTileArray()` 全量物化（结构编辑/导出需要时由 Level 调用）。
 */
export class CompactTileStore {
    length: number;
    direction: Float32Array;
    angle: Float32Array;
    lastdir: Float32Array;
    /** 累计 Twirl 计数（第 i 砖处理完自身 Twirl 事件后的值；差分即该砖的 Twirl 数） */
    twirl: Int32Array;
    /** floor -> 非 Twirl actions（已去掉 floor 字段） */
    readonly actionsByFloor: Map<number, ActionData[]>;
    /** floor -> decorations（已去掉 floor 字段） */
    readonly decorationsByFloor: Map<number, ActionData[]>;
    /** floor -> extraProps（用到才建） */
    private extraPropsByFloor: Map<number, Record<string, any>> | null = null;
    /** 被 edit() 物化的砖（读取优先、导出覆盖） */
    private overlay: Map<number, Tile> | null = null;

    constructor(length: number) {
        this.length = length;
        this.direction = new Float32Array(length);
        this.angle = new Float32Array(length);
        this.lastdir = new Float32Array(length);
        this.twirl = new Int32Array(length);
        this.actionsByFloor = new Map();
        this.decorationsByFloor = new Map();
    }

    // ── 读取（覆盖层优先）──────────────────────────────────────
    getDirection(i: number): number {
        const o = this.overlay?.get(i);
        return o?.direction !== undefined ? o.direction : this.direction[i];
    }

    getAngle(i: number): number {
        const o = this.overlay?.get(i);
        return o?.angle !== undefined ? o.angle : this.angle[i];
    }

    getTwirl(i: number): number {
        const o = this.overlay?.get(i);
        return o?.twirl !== undefined ? o.twirl : this.twirl[i];
    }

    getLastdir(i: number): number {
        const o = this.overlay?.get(i);
        return o?._lastdir !== undefined ? o._lastdir : this.lastdir[i];
    }

    getActions(i: number): ActionData[] {
        const o = this.overlay?.get(i);
        if (o && Array.isArray(o.actions)) return o.actions as ActionData[];
        return this.actionsByFloor.get(i) ?? EMPTY_ACTIONS;
    }

    getDecorations(i: number): ActionData[] {
        const o = this.overlay?.get(i);
        if (o && Array.isArray(o.addDecorations)) return o.addDecorations as ActionData[];
        return this.decorationsByFloor.get(i) ?? EMPTY_DECOS;
    }

    getExtraProps(i: number): Record<string, any> {
        const o = this.overlay?.get(i);
        if (o?.extraProps) return o.extraProps;
        if (!this.extraPropsByFloor) this.extraPropsByFloor = new Map();
        let p = this.extraPropsByFloor.get(i);
        if (!p) {
            p = {};
            this.extraPropsByFloor.set(i, p);
        }
        return p;
    }

    /** 是否有未写回的编辑（导出时需要走全量物化，保证正确性）。 */
    hasEdits(): boolean {
        return !!this.overlay && this.overlay.size > 0;
    }

    /** 只物化一块砖用于编辑；返回对象后续修改由覆盖层保留。 */
    edit(i: number): Tile {
        if (i < 0 || i >= this.length) throw new RangeError(`tile index out of range: ${i}`);
        if (!this.overlay) this.overlay = new Map();
        let t = this.overlay.get(i);
        if (!t) {
            t = {
                direction: this.direction[i],
                angle: this.angle[i],
                twirl: this.twirl[i],
                _lastdir: this.lastdir[i],
                actions: this.getActions(i),
                addDecorations: this.getDecorations(i),
                extraProps: this.extraPropsByFloor?.get(i) ?? {},
            };
            this.overlay.set(i, t);
        }
        return t;
    }

    /**
     * 末尾追加一块砖（Player 的 appendExtraTile 用）。
     * 只在末尾扩展：typed array 复制一次，O(n) 但仅发生一次。
     */
    appendTile(direction: number, angle: number, lastdir: number, twirl: number): number {
        const n = this.length;
        const growF32 = (arr: Float32Array): Float32Array => {
            const a = new Float32Array(n + 1);
            a.set(arr);
            return a;
        };
        const growI32 = (arr: Int32Array): Int32Array => {
            const a = new Int32Array(n + 1);
            a.set(arr);
            return a;
        };
        this.direction = growF32(this.direction);
        this.angle = growF32(this.angle);
        this.lastdir = growF32(this.lastdir);
        this.twirl = growI32(this.twirl);
        this.direction[n] = direction;
        this.angle[n] = angle;
        this.lastdir[n] = lastdir;
        this.twirl[n] = twirl;
        this.length = n + 1;
        return this.length;
    }

    /** 全量物化成普通 Tile 数组（结构编辑/导出用；内存回到对象模式水平）。 */
    toTileArray(): Tile[] {        const n = this.length;
        const out: Tile[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const o = this.overlay?.get(i);
            out[i] = o ?? {
                direction: this.direction[i],
                angle: this.angle[i],
                twirl: this.twirl[i],
                _lastdir: this.lastdir[i],
                actions: this.actionsByFloor.get(i) ?? EMPTY_ACTIONS,
                addDecorations: this.decorationsByFloor.get(i) ?? EMPTY_DECOS,
                extraProps: this.extraPropsByFloor?.get(i) ?? {},
            };
        }
        return out;
    }

    // ── 快速遍历（不建对象）────────────────────────────────────
    forEach(cb: (index: number, store: CompactTileStore) => void): void {
        for (let i = 0; i < this.length; i++) cb(i, this);
    }

    // ── 导出（编辑过的砖走覆盖层；Twirl 从差分还原）──────────────
    flattenAngleData(): number[] {
        const n = this.length;
        const out: number[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const o = this.overlay?.get(i);
            out[i] = o?.direction !== undefined ? o.direction : this.direction[i];
        }
        return out;
    }

    flattenActions(): AdofaiEvent[] {
        const out: AdofaiEvent[] = [];
        const n = this.length;
        // 1) Twirl：twirl 数组差分（覆盖层里改过 twirl 的砖以覆盖层为准）
        let prev = 0;
        for (let i = 0; i < n; i++) {
            const o = this.overlay?.get(i);
            const cur = o?.twirl !== undefined ? o.twirl : this.twirl[i];
            for (let k = prev; k < cur; k++) out.push({ floor: i, eventType: 'Twirl' });
            prev = cur;
        }
        // 2) 稀疏非 Twirl actions
        for (const [floor, actions] of this.actionsByFloor) {
            const o = this.overlay?.get(floor);
            if (o && Array.isArray(o.actions)) continue; // 覆盖层优先
            for (const a of actions) out.push({ floor, ...a } as AdofaiEvent);
        }
        // 3) 覆盖层里被编辑过的砖
        if (this.overlay) {
            for (const [floor, t] of this.overlay) {
                if (Array.isArray(t.actions)) {
                    for (const a of t.actions) out.push({ floor, ...(a as ActionData) } as AdofaiEvent);
                }
            }
        }
        out.sort((a, b) => a.floor - b.floor);
        return out;
    }

    flattenDecorations(): AdofaiEvent[] {
        const out: AdofaiEvent[] = [];
        for (const [floor, decos] of this.decorationsByFloor) {
            const o = this.overlay?.get(floor);
            if (o && Array.isArray(o.addDecorations)) continue;
            for (const d of decos) out.push({ floor, ...d } as AdofaiEvent);
        }
        if (this.overlay) {
            for (const [floor, t] of this.overlay) {
                if (Array.isArray(t.addDecorations)) {
                    for (const d of t.addDecorations) out.push({ floor, ...(d as ActionData) } as AdofaiEvent);
                }
            }
        }
        out.sort((a, b) => a.floor - b.floor);
        return out;
    }
}
