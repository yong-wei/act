# Change: type055-v211-scene-integration

## Why

`activate-type055-nanchang-v2-1-production`（issue #1898 系列）完成 v2.1.0 生产激活后，destroyer 仿真场景暴露出四类缺陷：

1. **水线以下防锈漆未渲染**：经裸 three.js 隔离渲染证实为模型资产缺陷——v2.1.0 的 `MAT_ANTIFOULING_RED` 只覆盖球鼻艏、声呐罩与两片舵，舯部约 128m 水下船体（X -64~+64）全部是灰色 `HULL_MAIN` 直到 Y≈1。按资产不可变合同返 3DModels，后者已发布 **v2.1.1**（`MAT_ANTIFOULING_RED` 覆盖 X[-88.62,78.75]、Y[-0.79,7.05]，灰色从 Y=7.05 起，三档 LOD 一致，validation `PASS_WITH_BUDGET_WARNING`）。
2. **模型位置偏高约 1.8m**：ACT 适配层两根因叠加——(a) 船体垂荡采样使用均值 0 的独立正弦波场，而可视水面是基准 `GERSTNER_WATER_BASE_Y=-1` 的 Gerstner 波场，船不随可见波浪动且基准差 1m；(b) `DestroyerModelScene` 用 `waveY + modelHeight*0.5 - draft` 配 bbox 居中，隐含"bbox 底部=龙骨"假设，但 v2 模型 bbox 底部是低于龙骨 0.79m 的声呐罩，水线被抬高约 0.8m。
3. **双螺旋桨船只有单一舰艉航迹**：`wakeAnchors.stern` 手填舰艉中点 [0,0,-90]，而 v2 模型提供语义节点 `PROP_PORT`/`PROP_STARBOARD`（局部 (±4.8 横向, -82.97 艉向)），航迹应每桨一条并绑定桨位。
4. **仿真场景零动画**：v2 模型的 15 个主舰 clip（桨转、舵角、国旗、雷达、武器俯仰回旋、机库门）与 8 个 weapon-demo 演示片段全部未消费；11 组 `COMM_ANTENNA_GROUP_*_PIVOT` 天线节点无 clip，需程序化驱动。用户已裁决分层方案：L0 常开绑定（桨↔航速、舵↔`sim.rudderDeg`、旗/雷达循环、天线倾角↔航速），L1 达成控制指标后武器巡检循环，L2 达成后随机播放一条 weapon-demo。

同时把这类"仿真遥测 → 模型动画"的介入以声明式语义绑定（semanticBindings）固化进模型包合同，未来新参数化模型登记同名语义即可直接对接。

## What Changes

- **接收 v2.1.1 并生产切换**：接收脚本登记 v2.1.1 身份（manifest SHA-256 `24f7dfdb…2581430`，源 .blend 与已接受版相同）；模型包描述符登记 v2.1.1 七角色哈希；registry 激活指针切到 2.1.1，v2.1.0 降级为有序回退，旧 browser-delivery 链不变。
- **垂向锚定语义化**：模型包描述符声明设计水线局部 Y（type055 = 6.6）；版本化路径按声明水线锚定到波面参考，不再依赖 bbox 几何假设；无声明的旧链模型保持既有 bbox 推导行为。
- **波场统一**：船体垂荡/纵摇/横摇的五点采样从本地正弦波场切换到与可视水面、尾迹、overlay 同一 CPU Gerstner 采样（含基准 -1m），船随可见波浪运动；lerp 平滑语义不变。
- **双桨航迹**：模型包声明 propulsor 语义节点时，尾迹按节点逐帧世界位置每桨发射一条；无声明模型保持 profile 手填锚点的单航迹行为。
- **声明式动画绑定（semanticBindings）**：描述符声明绑定列表（节点名、clip 名、局部轴、角度范围、数据源、驱动方式）；运行时按声明装配 mixer 与程序化驱动。L0 常开：螺旋桨转速↔航速、舵角↔`sim.rudderDeg`（程序化，钳制到模型 ±30°）、国旗与导航雷达 clip 循环、天线倾角↔航速（程序化 pivot）。L1：达成既有任务 successCriteria 后主舰内武器巡检循环（零额外加载）。L2：每次达成随机选取一条 weapon-demo clip 播放（demo GLB 此时成为显式消费者按需加载）。
- **视觉验收**：QA 页与 destroyer 场景按既有视觉验收门禁执行，新增防锈漆水线、双航迹、L0 动画与彩蛋触发的视觉断言。

## Capabilities

### New Capabilities

（无新能力；全部落在既有能力的修改上。）

### Modified Capabilities

- `versioned-simulation-model-package-integration`: 包身份要求覆盖 v2.1.1 接收；新增语义动画绑定声明与设计水线锚定声明要求。
- `simulation-scene-visual-pipeline`: 新增船体共享波场、语义桨位航迹、声明式分层动画绑定三项要求。

## Impact

- 模型包接收与描述符：`scripts/models/receive-type055-nanchang-101-v2.mjs`、`src/resources/simulations/model-packages/type055-nanchang-101-v2.ts`（或新增 v2.1.1 描述符）、`public/assets/model-releases/type055-nanchang-101/v2.1.1/`、`artifacts/model-releases/type055-nanchang-101-v2.1.1/`。
- 激活指针：`src/lib/browser-delivery/versioned-defaults.ts`。
- 场景适配：`src/resources/simulations/simulations/destroyer-simulation.tsx`（波场采样、模型定位、尾迹 rig）、`src/resources/simulations/components/versioned-ship-model.tsx`、`src/resources/simulations/scene/wake/`。
- 动画绑定：新增语义绑定装配模块（版本化模型挂载点），数据源只读 `sim.rudderDeg`/`sim.speedMps`/任务达成状态。
- 输入模型发布：`type055-nanchang-101` v2.1.1；源 .blend SHA-256 `c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357`（与 v2.0.0/v2.1.0 同一接受版），LOD0 SHA-256 `36f22dd2…`（3536140 字节）。
- 不修改 Rust/WASM 数值内核、`SimulationClock`、控制器、遥测和 Arena 评分；ACT 不修补上游模型字节。
