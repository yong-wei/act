## Why

3DModels 已发布长恒 LNG、MSC Tessa、雪龙 2、爱达·魔都、海洋石油 981 与天鲸号挖泥船的版本化更新包，南昌舰 101 也已在 ACT 以 v2.1.3 激活。除驱逐舰外，其余仿真仍加载旧单文件 GLB：包围盒居中、按最大尺寸缩放、用水线补偿吃水，且没有舵/桨/吊舱/推进器的语义绑定。旧加载路径会破坏新包的米制原点与设计水线合同；雪龙 2 与爱达没有传统舵叶，不能伪造舵角网格。天鲸最新包是 `exports/v1.0.1` 的 act-forward Meshopt GLB，不是早期程序化工厂，也不是 ACT 旧生成式 `dredger.glb`。

需要把七艘更新包按同一接收、描述符、质量档位 LOD 与有序回退流程接入 ACT，并把仿真默认模型切到各船最新包。

## What Changes

- 扩展既有 `versioned-simulation-model-package-integration`：船队包只强制三档主舰 LOD；collision/payload/demo/interactive-systems 仍为 055 可选角色，不得把 055 的武器分母套到商船。
- 用通用接收脚本把商船新包（及 055 再校验）写入 `public/assets/model-releases/<packageId>/v<version>/`，按 SHA-256 与字节 fail-closed；981 从 GitHub ACT zip 接收；天鲸从 `3DModels:models/act-dredger-tianjing/exports/v1.0.1` 接收 LOD0/1/2。
- 生产激活指针覆盖 `destroyer`、`lng-carrier`、`container`、`icebreaker`、`luxury-liner`、`drilling-rig`、`dredger`；旧 browser-delivery registry 仅作 GLB 加载失败回退。
- 共享挂载：米制、DWL 原点、外层航向 `-heading + π/2`、内层 `basisYawRad`（+X 艏 −90°，act-forward 为 0）；禁止 bbox 居中与按总高归一化。天鲸按包内 120 m 船壳近似缩放，不按公开 127.5 m 或活动包围盒拉伸。
- 语义绑定：有舵船用舵角驱动舵叶、航速耦合螺旋桨；雪龙 2 用实际吊舱方位与显示 RPM，禁止播放会覆盖姿态的演示 clip；爱达把教学舵角映射到吊舱方位，雷达常开；981 用八台推进器方位/转速；天鲸用 `TJ_RUDDER_*` / `TJ_PROP_*` / `TJ_CUTTER` 实时姿态，不得与 GLB 演示 clip 同时写同一组节点。达标后随机播放 1 条或多条预定主舰 clip。
- 首页预览改用已激活版本化 LOD（低档），不再指向旧 `originalUrl`；海报随预览 URL 解析。981 默认激活 GitHub `HYSY981-ACT-v1.0.2`。天鲸 v1.0.1 与 981 一样需要 MeshoptDecoder。

## Capabilities

### New Capabilities

（无新顶层能力；全部落在既有能力的修改上。）

### Modified Capabilities

- `versioned-simulation-model-package-integration`：从 055 专用七角色包扩展为船队版本化包（三 LOD 分母、可选武器角色、act-forward/+X 两种坐标基、吊舱/推进器实时绑定、主舰内达标彩蛋）。
- `simulation-scene-visual-pipeline`：LNG/集装箱/破冰船/邮轮/钻井/挖泥船默认模型走版本化挂载与语义绑定；旧 bbox 加载仅保留为 GLB 回退。

## Impact

- 描述符与校验：`src/resources/simulations/model-packages/`
- 接收脚本：`scripts/models/receive-fleet-model-release.mjs`；055 既有脚本保持
- 资产：`public/assets/model-releases/{lng-changheng,msc-tessa,xue-long-2,adora-magic-city,hysy-981,dredger-tianjing,type055-nanchang-101}/`
- 激活指针：`src/lib/browser-delivery/versioned-defaults.ts`
- 仿真：`lng-simulation.tsx`、`container-simulation.tsx`、`icebreaker-simulation.tsx`、`cruise-simulation.tsx`、`drilling-simulation.tsx`、`dredger-simulation.tsx`；驱逐舰逻辑保持，仅再校验接收
- 首页：`src/app/page.tsx`
- 不修改 Rust/WASM 数值内核、`SimulationClock`、Arena 评分；不修补上游 GLB；不生产部署
