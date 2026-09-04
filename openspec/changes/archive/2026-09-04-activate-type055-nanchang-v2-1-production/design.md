# Design: activate-type055-nanchang-v2-1-production

## Goals / Non-Goals

**Goals:**

1. 根治共享相机竞态：控制器初始化后默认相机对象被替换时重新锚定，冷/热加载行为一致。
2. 模型装配保留 skinned 骨骼绑定（机库门、国旗等四个 skinned 网格正常渲染）。
3. QA 验收页整舰可见，视觉验证成为候选与激活的验收判据。
4. 接收 v2.1.0 发布包（meshopt 压缩 + GPU 实例化 + interactive-systems 角色），接收不变量与 v2.0.0 相同（逐文件 SHA-256、原子入位、漂移 fail closed）。
5. destroyer 场景默认模型切换为 v2.1.0 版本化模型包，旧 browser-delivery 链保留为回退，浏览器流量门禁通过后生效。

**Non-Goals:**

- 不修改 Rust/WASM 数值内核、SimulationClock、控制器、遥测、Arena 评分（驱动链不变合同沿用既有 spec）。
- 不修补上游模型字节；发现资产缺陷记录并返回 3DModels 发新版本。
- 不改动其他六个仿真场景的模型资产；相机修复对它们是行为纠正而非回归。
- 旧 `destroyer.glb` 文件不删除，仅降级为回退候选。
- interactive-systems 角色的教学交互消费（如座舱交互）不在本变更，仅完成接收、登记与按需加载边界。

## Key Decisions

### D1: 相机竞态修复点在控制器，不在模型加载侧

根因：`StayPutCameraController` 的一次性初始化（`initializedRef`）锚定的是初始化时刻的默认相机对象；v2 候选路径无模块级预载，GLB 挂起窗口内 drei `PerspectiveCamera makeDefault` 的替换晚于控制器首帧，机位永久停留在替换后相机的默认位置 `[0,200,500]`。

修复：控制器跟踪相机对象身份（`useThree((s) => s.camera)` 引用比较），发现身份变化且当前为预设视角时，按当前视角的标准机位（含该视角已捕获的用户偏移语义）重新锚定一次。替代方案（给 v2 路径也加模块级预载）只能缩短挂起窗口，不能消除竞态，且预载时机本身依赖模块求值顺序，不选。

风险：相机身份在正常会话中几乎只变一次（makeDefault 挂载）；重锚定只在身份变化帧发生，不影响"相机停留在用户离开的位置"合同——身份变化时旧相机对象已失效，保持其取景本来就不可达。

### D2: 骨骼感知克隆

`DestroyerModelScene` 与 QA 装配的 `scene.clone(true)` 改为 `SkeletonUtils.clone(scene)`。这是 three.js 对含 skins 场景的标准克隆路径；v2.1.0 的 meshopt 量化不改变这一要求。旧模型（无 skins）经 SkeletonUtils.clone 行为等价。

### D3: v2.1.0 接收适配新 schema

v2.1.0 与 v2.0.0 的差异需要显式处理：

- manifest schema 从 v1 升到 `type055-versioned-model-release/2`；接收脚本按 schema 版本分流校验，不放宽既有不变量。
- 七个角色：ship LOD0/1/2、collision、payload、demo、interactive-systems（新增，独立生命周期，仅明确消费者加载）。
- 压缩链变为 EXT_meshopt_compression + 量化 + EXT_mesh_gpu_instancing：加载链必须配置 meshopt 解码器（现有 `useGLTF(url, true, true)` 已具备），并把"量化空间包围球误剔除"的既有处理（主模型关闭 frustumCulled）延续到 v2.1.0。
- 接口合同（动画名、节点名、装填计数）以 v2.1.0 `runtime-interface.json` 和 `model-validation.json` 重新登记，不沿用 v2.0.0 的 127/8/112/24 数字。

### D4: 生产激活机制

destroyer 默认解析从旧 browser-delivery 候选链切换为 v2.1.0 模型包：registry/描述符层把 v2.1.0 设为默认主候选，旧 `models-opt/destroyer.glb` 链保留为有序回退；`?model=type055-v2` 开关随激活完成移除。GLB 资产按 browser-delivery 既有发布流程进入 Delivery 路径，发布与流量门禁沿用 `simulation-scene-visual-pipeline` 的质量降档与加载合同。激活失败或门禁不通过时回退到旧默认链，不产生半切换状态。

### D5: 视觉验证作为验收判据

数据层断言（请求账本、节点变换）保留但不再单独构成验收。新增视觉门禁：

- QA 页首帧整舰完整落入画面（包围盒投影断言 + 截图证据）。
- destroyer 场景在高/中/低三档下整舰可见（截图矩阵 + 舰体包围盒投影到视锥内的断言）。
- skinned 网格（机库门、国旗）渲染姿态正确（截图 + 骨骼绑定完整性断言）。
- 回退路径（候选全部失败 → 旧模型）整舰同样可见。

## Risks / Mitigations

- [v2.1.0 接口合同与 v2.0.0 漂移导致动画绑定失效] → 接收时按 runtime-interface.json 全量重新校验语义接口；漂移即 fail closed，返回 3DModels。
- [meshopt + instancing 在低配设备解码回归] → 三档 Playwright 视觉 + 帧时间验收复跑；decode 失败回退旧链。
- [相机重锚定影响其他场景既有视角持久化] → 只在相机身份变化帧触发一次；既有"停留语义"测试套件全部复跑。
- [激活后学生端流量切换到 3.8MB 包] → v2.1.0 LOD0 体积约为 v2.0.0 的 1/6，流量门禁按既有浏览器预算执行。
