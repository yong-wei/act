## Why

`integrate-type055-nanchang-v2-model-release` 已把南昌舰 101 号 v2.0.0 模型包以候选方式接入（issue #1898），但候选路径暴露了两个视觉缺陷和一个装配缺陷：QA 验收页无相机取景（默认相机位于 180 米舰体内部，只能看到舰底）；冷加载时共享相机控制器在 R3F 初始默认相机上完成一次性锚定，drei `makeDefault` 相机随后替换导致机位永远停留在默认位置、舰体不可见；4 个 skinned 网格（机库门×2、国旗×2）经 `clone(true)` 后骨骼绑定断裂。此前验收只覆盖数据层断言，没有视觉可见性验证，导致缺陷漏出。

3DModels 已发布 v2.1.0 模型包（schema `type055-versioned-model-release/2`，EXT_meshopt_compression + 量化 + EXT_mesh_gpu_instancing，LOD0 从 24MB 降到 3.8MB，新增 interactive-systems 角色）。现在执行上一变更明确保留的生产激活：修复上述缺陷、接收 v2.1.0、把 destroyer 场景默认模型切换为版本化模型包，并以视觉验证作为切换成功的验收判据。

## What Changes

- 修复共享场景相机竞态：默认相机对象身份在控制器初始化后被替换时，相机控制器 SHALL 重新锚定到当前预设机位，覆盖全部管线挂载场景。
- 修复版本化模型装配：模型场景克隆必须使用骨骼感知克隆（SkeletonUtils.clone），保持 skinned 网格绑定完整。
- 修复候选 QA 页取景：按模型包围盒配置相机，使整舰在首帧完整可见。
- 接收并登记 `type055-nanchang-101` v2.1.0 发布包：新 schema/2、七个 GLB 角色（新增 interactive-systems）、meshopt 解码链、逐文件 SHA-256 与字节数、运行时接口合同。
- 生产激活：destroyer 场景默认模型从旧单文件 GLB 链切换为 v2.1.0 版本化模型包，旧链降级为回退；按 browser-delivery 既有流程完成发布与门禁。
- 视觉验收门禁：切换成功必须通过浏览器视觉验证（各质量档位下整舰完整可见、动画可见、回退可见），数据层断言不再单独构成验收。
- 旧 v2.0.0 候选目录退役到仅历史可审计；`?model=type055-v2` 候选开关在完成激活后移除或改指内部回归用途。

## Capabilities

### New Capabilities

（无新能力；全部落在既有能力的修改上。）

### Modified Capabilities

- `versioned-simulation-model-package-integration`: 候选保留规则升级为授权激活与可逆回退；新增 meshopt 压缩包解码、interactive-systems 角色和视觉验收门禁要求。
- `simulation-scene-visual-pipeline`: 新增相机身份替换重锚定、骨骼感知模型克隆和验收页取景要求。

## Impact

- 共享相机控制器 `src/resources/simulations/scene/camera/stay-put-camera-controller.tsx`（7+ 仿真场景共用）。
- 版本化模型装配 `src/resources/simulations/components/versioned-ship-model.tsx`、`destroyer-simulation.tsx`、QA 页 `src/app/simulations/type055-model-candidate/page.tsx`。
- 模型包描述符与接收脚本：`src/resources/simulations/model-packages/`、`scripts/models/`、`public/assets/model-releases/type055-nanchang-101/v2.1.0/`。
- browser-delivery registry 与发布流程：`src/lib/browser-delivery/`、`scripts/browser-delivery.ts`。
- 输入模型发布：`type055-nanchang-101` v2.1.0；源 .blend SHA-256 `c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357`（与 v2.0.0 同一接受版），LOD0 SHA-256 `7cde4ffc671307a18815175d9e2cdb496b8326602ac5747d169c50a8184c5c6c`。
- 不修改 Rust/WASM 数值内核、`SimulationClock`、控制器、遥测和 Arena 评分；ACT 不修补上游模型字节，资产缺陷仍返回 3DModels 发新版本。
