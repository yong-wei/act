# type055-nanchang-101 v2.1.0 生产激活交接（issue #1953）

## 接收事实

- 源发布：3DModels `assets/type_055_destroyer/exports/v2.1.0`（schema `type055-versioned-model-release/2`，model-validation `PASS_WITH_BUDGET_WARNING`，visual_gate PASS）
- 发布 manifest SHA-256：`c4dcf49ab7c23ca1d0a269800f29a9dcd180f1e2795dc2db882e87575586f7c8`
- 源 .blend SHA-256：`c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357`（与 v2.0.0 同一接受版）
- LOD0 SHA-256：`7cde4ffc671307a18815175d9e2cdb496b8326602ac5747d169c50a8184c5c6c`（3,782,868 bytes）
- 接收脚本：`scripts/models/receive-type055-nanchang-101-v2.mjs`（schema/1 六角色与 schema/2 七角色分流；已合格包目录一旦验证永不移动）
- 接收收据：`receipt.json`（同目录；`packageTreeDigest` 为可验证主绑定）
- ACT 目录：`public/assets/model-releases/type055-nanchang-101/v2.1.0/`（manifest + 七 GLB）
- ACT 描述符：`src/resources/simulations/model-packages/type055-nanchang-101-v2.ts`

## 接口合同（按 v2.1.0 runtime-interface / model-validation 重新登记）

| 项 | v2.1.0 |
| --- | --- |
| 主舰动画数 | 15 |
| 演示片段 | 8（名称集合与 v2.0.0 相同） |
| VLS loaded | 112 |
| HQ10 loaded | 24 |
| 贴花 | `g07-hull-number-101-rgba`、`g07-flight-deck-markings-rgba` |
| 新增角色 | `interactive-systems`（独立生命周期，默认首屏不请求） |

## 每档请求字节预算

| 消费场景 | 请求资产 | 声明字节 |
| --- | --- | --- |
| 高档首屏 | ship-lod0.glb | 3,782,868 |
| 中档首屏 | ship-lod1.glb | 1,786,884 |
| 低档首屏 | ship-lod2.glb | 1,149,624 |
| 武器演示（按需） | weapon-demo.glb | 185,324 |
| 弹药载荷（按需） | weapon-payloads.glb | 200,896 |
| 碰撞查询（按需） | collision.glb | 52,472 |
| 交互系统（按需） | interactive-systems.glb | 14,648 |

普通航向仿真默认请求恰好一个 ship LOD；payload/demo/collision/interactive-systems 不进入首屏。

## 激活机制

- destroyer 默认主候选：v2.1.0 版本化模型包。
- 旧 browser-delivery 七模型 registry 不变；`models-opt/destroyer.glb` + `destroyer.glb` 仍是有序回退。
- `?model=type055-v2` 候选开关已移除。
- v2.1.0 已是 meshopt 压缩包，不进入七模型 optimizer / ESA 发布键集。静态交付走应用 `public/assets/model-releases/`。
- v2.0.0 目录保留为仅历史可审计，不删除。

## 视觉与装配修复

- `StayPutCameraController` 在默认相机对象身份变化后按当前预设（含用户偏移）重锚定。
- 模型装配改用 `SkeletonUtils.clone`。
- QA 页按包围盒取景；验收以包围盒投影断言 + 截图矩阵为准。

## 上游缺陷返版模板

```text
上游缺陷记录
- 模型版本：type055-nanchang-101 v2.1.0（ship_id type_055_destroyer_101_nanchang）
- 缺陷工件：<角色>/<文件名>（SHA-256 <哈希>）
- 复现：<场景/页面、操作序列、预期 vs 实际>
- 归类：ACT 适配层缺陷 / 模型资产缺陷
处置：
- ACT 侧不修补模型字节；激活失败则 fail closed 回退旧默认链。
- 资产缺陷返回 3DModels 发布新模型版本，重新走完整接收门禁后才能再次激活。
```

## 视觉验收证据

Playwright `tests/type055-model-candidate.spec.ts` 通过。JSON 账本在 `browser-acceptance/`：

- `qa-visual.json`：QA 页 `boxInView=true`、`skinnedIntact=true`
- `destroyer-candidate-requests.json`：默认首屏只请求当前档位 ship LOD2（1,149,624 bytes），无 demo/payload/collision/interactive-systems
- `ship-animations.json` / `decals.json` / `demo-clips.json` / `payload-lifecycle.json`
- 截图矩阵（gitignore `artifacts/**/*.png`，仅本地）：`qa-lod0/1/2.png`、`destroyer-default.png`、`destroyer-low.png`、`qa-fallback-legacy.png`

## 边界确认

- 未修改 Rust/WASM 数值内核、`SimulationClock`、控制器、遥测与 Arena 评分。
- 未修改受保护旧式 `src/resources/simulations/destroyer-simulation.tsx`。
- 未删除 `public/assets/destroyer.glb`。
- 未改生产知识选择器，未 `deploy:app` / `deploy:runtime`。
