# ADOFAI

零依赖的 JavaScript/TypeScript 库，用于解析、编辑和导出 ADOFAI 谱面文件。完全兼容浏览器环境。

## 功能特性

- **多种解析器** — `StringParser`、`BufferParser`、`ArrayBufferParser`、`LargeFileParser`（大文件增量解析）
- **谱面管理** — 加载、编辑和导出 `.adofai` 文件，完整访问 tile 和事件数据
- **类型化事件** — 57 个类型化事件接口，覆盖所有 ADOFAI 事件类型
- **共享类型** — const 枚举和工具类型，用于 ADOFAI 特有值（角度、碰撞箱、滤镜等）
- **PathData 转换** — 在 pathData 字符串和 angleData 数组之间互相转换
- **特效过滤** — 预设和自定义事件过滤（清除特效、保留/排除事件）
- **预计算模式** — 批量处理并缓存进度事件，适用于渲染管线
- **轻量级数据** — 为大谱面优化的内存高效 tile 数据提取

## 安装

```bash
npm install adofai
# 或
yarn add adofai
# 或
pnpm add adofai
```

## 导入

**ESM:**
```ts
import * as adofai from 'adofai';
import { Level, Parsers, Types, Events, Structure } from 'adofai';
```

**CommonJS:**
```ts
const adofai = require('adofai');
```

**子路径导入:**
```ts
import { StringParser } from 'adofai/parser/string';
import { BufferParser } from 'adofai/parser/buffer';
import { ArrayBufferParser } from 'adofai/parser/array-buffer';
import * as Types from 'adofai/types';
import * as Events from 'adofai/event';
```

---

## 解析器

四种解析器处理不同的输入格式。全部零依赖，浏览器兼容。

### StringParser

从字符串解析 ADOFAI JSON。支持非标准格式（尾逗号、字符串内原始换行）。

```ts
import { StringParser } from 'adofai';

const parser = new StringParser();
const data = parser.parse(`{ "angleData": [...], "settings": {...}, "actions": [...] }`);
```

### BufferParser (Uint8Array)

直接在 `Uint8Array` 二进制流上通过字节级状态机解析 ADOFAI JSON。无需中间字符串转换，自动处理 BOM 剥离。

```ts
import { BufferParser } from 'adofai';

const parser = new BufferParser();
const u8 = new Uint8Array(await file.arrayBuffer());
const data = parser.parse(u8);
```

### ArrayBufferParser

接受 `ArrayBuffer` 或 `string`。处理 BOM 剥离、尾逗号规范化和 UTF-8 解码。

```ts
import { ArrayBufferParser } from 'adofai';

const parser = new ArrayBufferParser();
const buffer = await response.arrayBuffer();
const data = parser.parse(buffer);
```

### LargeFileParser

针对大型 `.adofai` 文件优化的内存高效解析器。逐字节扫描 JSON 根级属性，然后增量解析各个区块，无需将整个文件加载为 JS 字符串。适用于具有大量 `angleData` 或 `action` 数组的文件。

```ts
import { LargeFileParser } from 'adofai';

const parser = new LargeFileParser((stage, percent) => {
  console.log(`[${stage}] ${percent}%`);
}, {
  skipLargeActions: false, // actions 超过 100MB 时跳过
  maxActions: 0            // 限制解析的 actions 数量
});

const result = parser.parse(arrayBuffer);
// result: { settings?, angleData?, pathData?, actions?, decorations? }
```

关键行为:
- **< 50MB** — 区块正常使用 JSON.parse 完整解析。
- **> 50MB** — `actions` 增量解析（每个对象独立解析）。
- **> 100MB** — 可通过 `skipLargeActions: true` 完全跳过 actions。
- **任意大小** — `angleData` 始终增量解析（逐数字解析）。
- 自动剥离 BOM。

---

## Level

`Level` 类是本库的核心数据结构。它接受 ADOFAI 文件内容（字符串、对象、ArrayBuffer、Uint8Array 或 Buffer），并提供 tile 管理和导出功能。

### 创建

```ts
import { Level } from 'adofai';

// 从字符串
const level = new Level(adofaiJsonString);

// 使用自定义解析器
const level = new Level(rawData, bufferParser);

// 从已解析的对象
const level = new Level({
  angleData: [...],
  settings: { ... },
  actions: [...],
  decorations: [...]
});
```

### 加载

加载是异步的。可以监听 `load` 事件或使用返回的 Promise：

```ts
// 事件方式
level.on('load', () => {
  console.log('谱面已加载:', level.tiles.length, '个 tile');
});
level.load();

// Promise 方式
await level.load();

// 进度事件
level.on('parse:progress', (event) => {
  // { stage: 'relativeAngle', current: 500, total: 1000, percent: 50 }
  console.log(`${event.stage}: ${event.percent}%`);
});
```

进度阶段: `start` → `pathData` | `angleData` → `relativeAngle` → `tilePosition` → `complete`

### 访问数据

```ts
// 原始角度数据
level.angleData;       // number[]

// 解析后的 tiles
level.tiles;           // Tile[] — 每个 tile 包含 direction, angle, actions 等

// 设置
level.settings;        // Record<string, any>

// Actions / Decorations（带有 floor 索引的扁平数组）
level.actions;         // AdofaiEvent[]
level.__decorations;   // AdofaiEvent[]
```

### 查询事件

```ts
// 查找所有包含指定事件类型的 tile
const results = level.filterActionsByEventType('Flash');
// 返回 { index: number, action: ActionData }[]

// 获取指定 tile 索引处的事件
const { count, actions } = level.getActionsByIndex('MoveTrack', 5);
```

### 计算 Tile 坐标

```ts
const positions = level.calculateTilePosition();
// 返回 number[][] — 每个 tile（包括终点）的 [x, y] 坐标
// 同时会更新每个 tile.position
```

### Tile 操作

```ts
// 追加一个新的 tile
level.floorOperation({ type: 'append', direction: 180 });

// 在指定索引处插入
level.floorOperation({ type: 'insert', direction: 90, id: 10 });

// 删除 tile
level.floorOperation({ type: 'delete', id: 10 });
```

### 导出

```ts
// 导出为格式化的 ADOFAI JSON 字符串
const str = level.export('string', 0, true);
// fs.writeFileSync('output.adofai', str);

// 导出为对象
const obj = level.export('object', 0, true);
// { angleData, settings, actions, decorations }
```

### 事件系统

```ts
// 监听自定义或生命周期事件
const guid = level.on('load', (level) => { /* ... */ });

// 通过 GUID 移除监听器
level.off(guid);

// 触发自定义事件
level.trigger('custom:event', data);
```

---

## Types

共享的 ADOFAI 特有类型和 const 枚举，通过 `Types.*` 或 `adofai/types` 导出。

### Const 枚举

```ts
import { Types } from 'adofai';

Types.TextAnchor.UpperLeft       // 'UpperLeft'
Types.Hitbox.None                // 'None'
Types.FilterType.Bloom           // 'Bloom'
Types.FlashStyle.Flash           // 'Flash'
Types.RelativeTo.Tile            // 'Tile'
Types.TargetPlanet.All           // 'All'
Types.AngleCorrectionDir.CW      // 'CW'
Types.InputEventState.Subscribe  // 'Subscribe'
Types.InputEventTarget.Pressed   // 'Pressed'
Types.Condition.IfPassed         // 'IfPassed'
Types.BgDisplayMode.FitToScreen  // 'FitToScreen'
Types.BgShapeType.Circle         // 'Circle'
Types.HitsoundType.Kick          // 'Kick'
Types.HoldMidSoundTimingRelativeTo.Start // 'Start'
```

### 工具类型

```ts
Types.Vec2                       // [number, number]
Types.ABoolean                   // boolean | 'Enabled' | 'Disabled' | 'true' | 'false'
Types.TileReference              // [number, TileReferenceType]
Types.TileReferenceType          // 'ThisTile' | 'Start' | 'End'
Types.Vec2Like                   // [number, number] | { x: number; y: number }
```

### 工具函数

```ts
// 评估 ABoolean 值
Types.isEventEnabled(value, defaultValue);  // boolean

// 解析相对 tile 引用
Types.resolveTileReference([2, 'End'], currentTileId, totalTiles);
// = totalTiles - 1 + 2

Types.resolveTileReference([-1, 'ThisTile'], 5, 100);
// = 4

// 标准化 ADOFAI 位置格式（数组和对象两种形式）
Types.normalizeVec2([3, 5]);           // [3, 5]
Types.normalizeVec2({ x: 3, y: 5 });   // [3, 5]
```

---

## PathData

将 pathData 字符串（如 `"REJW"`）转换为 angleData 数组。

```ts
import { pathData } from 'adofai';

// 字符→角度映射表
pathData.pathDataTable;
// { R: 0, p: 15, J: 30, E: 45, T: 60, ... }

// 将路径字符串转换为角度数字
const angleData = pathData.parseToangleData("REJW");
// [0, 45, 30, 165]
```

---

## 事件接口

57 个类型化事件接口覆盖所有 ADOFAI 事件类型。每个接口都扩展自 `AdofaiEvent`，包含 `floor` 和 `eventType` 字段。

```ts
import type { Events } from 'adofai';

// 每个事件类型都有对应的接口：
const flash: Events.Flash = {
  floor: 0,
  eventType: 'Flash',
  duration: 1,
  color: 'ffffff',
  flashStyle: Types.FlashStyle.Flash,
  opacity: 100,
};

const setSpeed: Events.SetSpeed = {
  floor: 0,
  eventType: 'SetSpeed',
  speed: 1.0,
};

const moveTrack: Events.MoveTrack = {
  floor: 5,
  eventType: 'MoveTrack',
  duration: 4,
  positionOffset: [0, 3],
  rotation: 90,
  easing: 'Linear',
};
```

完整事件类型列表: `SetSpeed`、`Twirl`、`Checkpoint`、`MoveCamera`、`CustomBackground`、`ChangeTrack`、`ColorTrack`、`AnimateTrack`、`RecolorTrack`、`MoveTrack`、`SetText`、`Flash`、`SetHitsound`、`SetFilter`、`SetFilterAdvanced`、`SetPlanetRotation`、`HallOfMirrors`、`ShakeScreen`、`MoveDecorations`、`PositionTrack`、`RepeatEvents`、`Bloom`、`Hold`、`SetHoldSound`、`SetConditionalEvents`、`ScreenTile`、`ScreenScroll`、`EditorComment`、`Bookmark`、`CallMethod`、`AddComponent`、`PlaySound`、`MultiPlanet`、`FreeRoam`、`FreeRoamTwirl`、`FreeRoamRemove`、`Pause`、`AutoPlayTiles`、`Hide`、`ScaleMargin`、`ScaleRadius`、`Multitap`、`TileDimensions`、`KillPlayer`、`ScalePlanets`、`SetFloorIcon`、`AddDecoration`、`AddText`、`AddObject`、`SetObject`、`SetDefaultText`、`SetFrameRate`、`AddParticle`、`SetParticle`、`EmitParticle`、`SetInputEvent`。

---

## 特效过滤

使用预设或自定义规则清理谱面特效。

### 预设

```ts
import { Presets } from 'adofai';

// 移除视觉特效（Flash, SetFilter, Bloom 等）
Presets.preset_noeffect;

// 移除 Hold
Presets.preset_noholds;

// 移除相机移动
Presets.preset_nomovecamera;

// 移除所有非游戏性相关内容
Presets.preset_noeffect_completely;
```

### 应用过滤

```ts
// 使用预设
level.clearEffect('preset_noeffect');

// 自定义过滤 — 只保留指定事件
level.clearEvent({ type: 'include', events: ['SetSpeed', 'Twirl'] });

// 自定义过滤 — 排除指定事件
level.clearEvent({ type: 'exclude', events: ['Flash', 'Bloom'] });

// 清除所有装饰
level.clearDeco();
```

---

## 高级：预计算模式

适用于需要确定性事件重放的渲染管线。加载过程中不会触发进度事件，而是缓存事件，之后可以按需轮询。

```ts
level.enablePrecomputeMode();
await level.load();
level.calculateTilePosition();

const events = level.getPrecomputedEvents();
// { start: [...], pathData: [...], angleData: [...], ... }

// 获取指定进度百分比之前的事件
const at50 = level.getEventsAtPercent(50);
```

---

## 高级：轻量级 Tile 数据

适用于大型谱面，存储完整 `Tile[]` 对象会占用过多内存。仅预计算渲染必需的数据。

```ts
// 预计算轻量级数据（角度 + 坐标 + twirl 标记）
level.precomputeLightweight();

// 访问压缩数据
const data = level.getLightweightData();
// { totalTiles, angles: number[], positions: [number,number][], twirlFlags: boolean[] }

// 批量获取一段 tile 数据（分块访问）
const chunk = level.getLightweightDataRange(0, 100);
// { angles: [...], positions: [...], twirlFlags: [...] }

// 获取单个 tile 的渲染数据
const tile = level.getTileRenderData(42);
// { angle, position, hasTwirl }
```

---

## 结构接口

通过 `adofai/structure` 导入：

```ts
import type { AdofaiEvent, LevelOptions, Tile, ParseProgressEvent } from 'adofai/structure';

// AdofaiEvent: { floor: number, eventType: string, [key: string]: any }
// LevelOptions: { pathData?: string, angleData?: number[], actions, settings, decorations }
// Tile: { direction?, angle?, actions, addDecorations?, position?, ... }
// ParseProgressEvent: { stage, current, total, percent, data? }
```

---

## 包导出

| 导入路径 | 内容 |
|---|---|
| `adofai` | 主入口: Level, Parsers, Types, Events, Structure, Presets, pathData |
| `adofai/parser` | 解析器类 |
| `adofai/parser/string` | StringParser |
| `adofai/parser/buffer` | BufferParser |
| `adofai/parser/array-buffer` | ArrayBufferParser |
| `adofai/types` | 类型（const 枚举、工具函数） |
| `adofai/event` | 所有事件类型接口 |
| `adofai/structure` | 核心接口（LevelOptions, Tile 等） |
| `adofai/filter` | 过滤预设 |
| `adofai/filter/effect-processor` | 底层特效处理器 |
| `adofai/pathdata` | PathData 转换表 |

---

## 许可证

BSD-3-Clause
