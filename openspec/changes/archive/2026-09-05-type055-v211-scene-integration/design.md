# Design: type055-v211-scene-integration

## Goals / Non-Goals

**Goals:**

1. 接收 v2.1.1 模型包（防锈漆修复），接收不变量与既有版本相同（逐文件 SHA-256、原子入位、漂移 fail closed），并把 destroyer 默认模型切到 2.1.1。
2. 消除模型位置偏高：版本化模型按声明设计水线锚定；船体波浪运动与可视 Gerstner 水面统一为同一 CPU 波场。
3. 双桨航迹：每条语义螺旋桨节点一条尾迹，逐帧绑定桨位。
4. 声明式动画绑定：L0 常开（桨/舵/旗/雷达/天线），L1 达标武器巡检，L2 达标随机 weapon-demo；绑定合同固化为 spec，供未来参数化模型直接对接。
5. 视觉验收作为切换成功判据（沿用既有门禁并扩展新断言）。

**Non-Goals:**

- 不修改 Rust/WASM 数值内核、`SimulationClock`、控制器、扰动、遥测、Arena 评分；动画绑定只读遥测，不回写仿真状态。
- 不修补上游模型字节；后续资产缺陷仍返回 3DModels 发新版本。
- 不改动其他六个仿真场景的模型资产与波场行为；波场统一只作用于 destroyer 场景的船体采样。
- VLS 舱盖、武器发射的教学交互（interactive-systems 消费）不在本变更；L2 仅播放 weapon-demo 演示片段，不做弹道与命中。
- payload GLB 不引入本变更的消费路径。
- v2.1.0 资产目录保留为回退候选，不删除。

## Key Decisions

### D1: v2.1.1 接收走既有 RELEASES 登记，不放宽身份不变量

v2.1.1 与 v2.1.0 同 schema（`type055-versioned-model-release/2`）、同源 .blend SHA-256，差异是三个 ship LOD 与 demo 的文件字节。接收脚本新增 `2.1.1` 条目（expectedManifestSha `24f7dfdb2ec362d3fb4ac9fe0b1b6c63ce15d5c1f34b8603ddf5638932581430`，validation 接受 `PASS`/`PASS_WITH_BUDGET_WARNING`），逐文件哈希、原子入位、脏目录拒绝等不变量原样沿用。描述符按既有模式登记 v2.1.1 七角色身份与接口合同（15 主舰 clip、8 demo clip、装填计数与 v2.1.0 一致，已用脚本核验）。

### D2: 垂向锚定按声明水线，不按 bbox 几何

现状 `DestroyerModelScene` 把模型 bbox 居中后用 `waveY + modelHeight*0.5 - draft` 定位，隐含"bbox 底部=龙骨"。v2 模型 bbox 底部是声呐罩（Y=-0.79），龙骨在 Y=0，设计水线在 Y=6.6，导致水线抬高约 0.8m。

描述符新增 `verticalAnchor: { designWaterlineY: 6.6 }`（模型局部米）。定位公式改为 `groupY = waveY + (centerY - designWaterlineY) * scale`，使声明水线精确落在波面参考上。无声明的旧链模型走默认推导 `bbox.min.y + draft`，与现行行为逐位等价，回归风险为零。

### D3: 船体波场采样并入共享 Gerstner CPU 采样

`SimulationEngine` 的五点波浪采样（destroyer-simulation.tsx:728-732）当前调用本地正弦 `getWaveHeight`（均值 0），与可视水面（`GERSTNER_WATER_BASE_Y=-1` + `computeGerstnerDisplacement`）不是同一波场：船不随可见波浪动，且基准差 1m。`WakeTrailRig`（同文件 :441）与 overlay 已在用共享 CPU 采样。

修复：船体五点采样切换到同一共享采样函数（Gerstner 位移 + 基准 -1m），采样点、lerp 平滑（heaveLerp/rotLerp=0.02）与 pitch/roll 推导不变。这是对齐既有 spec「Scene overlays hug the water surface」的同一 CPU 波场语义，不是新增物理：数值内核不感知波浪，波浪只影响视觉位姿。

### D4: 双桨航迹按语义节点逐帧解析，不改 WakeTrail 内核

模型包描述符声明 propulsor 节点：`[{ id: 'prop-port', node: 'PROP_PORT' }, { id: 'prop-starboard', node: 'PROP_STARBOARD' }]`。尾迹 rig 在版本化路径按声明挂载每条桨一个 `WakeTrail`，逐帧 `getObjectByName(node).getWorldPosition()` 换算为发射锚点（含 basis yaw 与船体位姿），左右舷 shoulder 锚点按桨横向偏移对称生成。无声明的旧链模型保持 `wakeAnchors` 单航迹。`WakeTrail` 粒子/渲染内核不动，只增加锚点来源。

### D5: semanticBindings 声明式动画绑定

描述符新增 `semanticBindings` 数组，每项声明：

- `id`（语义名）、`drive: 'clip-loop' | 'procedural'`；
- `nodes`（语义节点名列表，按名解析，不用 glTF 索引）；
- `clip`（clip-loop 时的 clip 名）；
- `axis`/`rangeDeg`（procedural 时的局部轴与角度范围）；
- `source`（procedural 数据源：`telemetry.rudderDeg` | `telemetry.speedMps`）。

绑定映射（v2.1.1 已核验的接口）：

| 绑定 | 驱动 | 节点/clip | 映射 |
| --- | --- | --- | --- |
| 螺旋桨转速 | clip-loop | `prop_port_spin`/`prop_starboard_spin` | timeScale ∝ `sim.speedMps`/设计航速，停机静止 |
| 舵角 | procedural | `RUDDER_PORT`/`RUDDER_STARBOARD`，局部 Y，±30° | `sim.rudderDeg` 钳制映射（profile 上限 35°→模型 30°） |
| 国旗 | clip-loop | `national_flag_wind` | 常开循环 |
| 导航雷达 | clip-loop | `nav_radar_spin` | 常开循环 |
| 天线倾角 | procedural | 11 组 `COMM_ANTENNA_GROUP_*_PIVOT` | 倾角随 `sim.speedMps` 增大（0→设计航速映射 0→声明上限） |

舵角与天线不用 clip scrub：舵角 clip 的 time→angle 为 0→+30→0→-30→0 非单调，无法按角度反查时间；程序化直接驱动节点更正确也更便宜。节点解析失败或绑定源缺失 fail closed（该绑定不挂载，模型其余正常），不阻断仿真。

### D6: 彩蛋分层与触发源

- **L0 常开**：D5 表中全部绑定，随模型挂载即生效。
- **L1 武器巡检**：达成既有任务 successCriteria（destroyer-055 profile 每任务声明 targets/successCriteria）后，主舰内武器 clip（主炮/CIWS/HQ-10 俯仰回旋、机库门开合）进入循环巡检；全部来自主舰 GLB，零额外加载。
- **L2 随机演示**：每次达成从 8 条 weapon-demo clip 中随机选取一条播放一次；再次达成重新随机。demo GLB 此时成为显式消费者按需加载，不进入首屏请求账本（沿用「Model roles remain separate」）。
- 彩蛋是纯视觉层：触发只读达成状态，不影响评分、遥测与证据。

### D7: 驱动链不变

全部改动位于视觉层（模型挂载、波场视觉采样、尾迹锚点、动画 mixer/程序化节点）。`SimulationClock` 固定步长、Rust/WASM 步进、控制器、遥测语义不动；不引入任何 TypeScript 物理 stepper。回归证据：驱动链测试 + 同输入遥测等价。

## Risks / Trade-offs

- **波场切换改变视觉运动**：船体开始随可见波浪起伏，幅度由既有 Gerstner 波组决定；这是用户明确裁决的目标行为，lerp 参数保留避免突变。
- **彩蛋达成判定复用既有 successCriteria**：若某任务无 successCriteria，则该任务不触发彩蛋，不补造判定逻辑。
- **L2 随机性**：随机只在达成时刻发生一次，不影响可重放性（遥测与评分不依赖演示片段）。
- **v2.1.0 → v2.1.1 回退链**：激活指针切换后 v2.1.0 仍在有序回退中；v2.1.1 接口校验失败时 fail closed 到 v2.1.0/旧链。
