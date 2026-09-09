## Context

南昌舰 101 v2.1.3 已在驱逐舰仿真以版本化包激活。长恒 LNG、MSC Tessa、雪龙 2、爱达·魔都、海洋石油 981、天鲸号挖泥船已有 3DModels 更新包，但除驱逐舰外的仿真仍走旧单文件 registry：包围盒居中、按最大尺寸缩放、用水线补偿吃水，且没有舵/桨/吊舱/推进器语义绑定。

约束：ACT 不修补上游 GLB；数值内核与 `SimulationClock` 不变；旧 browser-delivery registry 只作 GLB 加载失败回退。本机 3DModels 工作树落后 `origin/main` 时，以远端树中的 `exports/v1.0.1` 为准，不得把早期程序化 `src/` 当最新包。

## Goals / Non-Goals

**Goals:**

1. 用同一接收脚本把商船新包写入 `public/assets/model-releases/<packageId>/v<version>/`，按 SHA-256 与字节 fail-closed；055 再跑既有接收脚本作 no-op 校验。
2. 生产激活指针覆盖全部七个 logicalId；`dredger` 指向 `dredger-tianjing` v1.0.1 三档 LOD。
3. 共享挂载：米制长度、设计水线、外层航向 `-heading + π/2`、内层 `basisYawRad`；质量档位映射三档 LOD。
4. 语义绑定：有舵船用舵角与航速；雪龙 2 用吊舱方位与显示 RPM；爱达把教学舵角映射到吊舱、雷达常开；981 用八台推进器；天鲸用舵叶、航速桨叶与作业绞刀；任务达标后随机播放 1 条或多条预定主舰 clip。
5. 首页预览改用已激活低档 LOD；海报按预览 URL 解析。981 生产激活为 v1.0.2（无损 Meshopt），v1.0.0 保留为不可变前一包。天鲸 v1.0.1 同样启用 MeshoptDecoder。

**Non-Goals:**

- 不修改 Rust/WASM 内核、控制器、Arena 评分。
- 不给无传统舵的船伪造舵叶网格。
- 不把天鲸程序化 0.1.0 源码迁入 ACT 当运行时模型。
- 不按活动包围盒或公开 127.5 m 总长拉伸天鲸 v1.0.1。
- 不生产部署。
- 不把 055 的 collision/payload/demo/interactive-systems 分母套到商船。
- 不把天鲸 LOD3 硬塞进三档分母；教学默认仍是 LOD0/1/2。

## Decisions

### D1: 商船分母是三档主舰 LOD

055 仍是七角色。商船包只强制 `ship-lod0/1/2`。校验器在无 demo/payload 且合同计数为 0 时跳过武器分母。天鲸上游有 LOD0–3；ACT 接收 LOD0/1/2，与爱达一样把最远档留给上游而不扩七角色分母。

备选：为每艘船补空 collision 角色。拒绝：会强迫 ACT 伪造资产。

### D2: 坐标基一次适配，禁止 bbox 居中

act-forward（+Z 艏：LNG、Tessa、981、天鲸）`basisYawRad = 0`。原生 +X 艏（055、雪龙 2、爱达）`basisYawRad = -π/2`。外层统一 `-headingRad + π/2`。版本化路径按 `sceneLength / modelLengthMeters` 缩放，水线用声明 `designWaterlineY`。回退路径才 bbox 居中并使用各船既有 yaw。天鲸 `modelLengthMeters = 120`，场景挂载同值，物理船长 127.5 m 保持不变。

### D3: 共享 `VersionedFleetShip`

六艘 GLB 仿真不再各自 clone/居中。描述符由 `matchActivatedFleetPackage(logicalId, resolveVersionedDefault(logicalId))` 解析。GLB 失败时 `FallbackGltfModel` 走旧候选链。

### D4: 实时绑定与达标彩蛋

`BindingTelemetrySource` 增加 `azipod`、`thrusters` 与 `cutterRpm`。雪龙 2 / 981 / 天鲸用 `live-rotation` / `live-spin`，禁止播放会覆盖姿态的演示 clip。达标计数从驱逐舰抽出到 `heading-attainment.ts`；无独立 demo 角色时在主舰 mixer 上 `pickRandomSubset` 播 LoopOnce。

雪龙 2 显示 RPM：`145 * sqrt(|thrust_N| / (MAX_SINGLE_THRUST_kN * 1000))`。981 推力已是 kN，额定 800 kN / 90 rpm；方位从度转弧度。作业视觉默认 Y=0，不用 `DRAFT_OPERATING=37` 下沉。天鲸舵叶 ±25°、桨与绞刀沿局部 X 积分；达标彩蛋只用吊机 clip，避开舵/桨/绞刀节点。

### D5: 首页预览与海报按同一预览路径解析

3D 预览用激活包 low LOD。海报按该预览 URL 查找：旧单文件走 `MODEL_POSTER`，版本化包按 `baseUrl` 前缀落到对应 PNG。981 v1.0.2 与天鲸 v1.0.1 使用无损 `EXT_meshopt_compression`，首页动态预览必须 `useGLTF(..., true, true)`。

### D6: 天鲸激活 v1.0.1 GLB 包

最新包在 `3DModels` `origin/main` 的 `models/act-dredger-tianjing/exports/v1.0.1/`，带 Meshopt 压缩与新哈希。ACT 用同一接收脚本写入三档 LOD，描述符与 981 同口径：`basisYawRad = 0`、DWL=0、fail-closed 哈希。旧 `dredger.glb` 仅作未激活时的 registry 回退。不得 vendor 程序化 `createDredgerModel`。

## Risks / Trade-offs

- [爱达 LOD0 ~58MB] → 首页只用 low LOD；仿真按质量档位选 LOD。
- [旧 bbox 视觉与新包水线不一致] → 这是目标行为；回退路径保留旧补偿。
- [981 作业吃水常量 37m 与模型合同 19m 冲突] → 视觉层按模型合同锚定，不改 DP 物理常量。
- [天鲸视觉 120 m 与物理 127.5 m] → 服从包合同，不拉伸网格。
- [接收脚本写入 git objects] → 沿用 055 既有 `git hash-object -w` 模式。

## Migration Plan

本地工作树接收资产 → 激活指针 → 仿真挂载 → 相关 vitest / typecheck。授权回滚删除 `SIMULATION_VERSIONED_DEFAULTS` 对应条目即可恢复旧默认，不必删 GLB。

## Open Questions

无。范围已由需求方确认：七个模型全部与 3DModels 最新发布包一致；天鲸最新是 v1.0.1 GLB，不是程序化重建。
