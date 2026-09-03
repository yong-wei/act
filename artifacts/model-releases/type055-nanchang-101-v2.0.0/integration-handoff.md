# type055-nanchang-101 v2.0.0 候选接入交接（issue #1898）

## 接收事实

- 源发布：3DModels `assets/type_055_destroyer/exports/v2.0.0`（G08_MODEL_EXPORT_COMPLETE，model-validation PASS）
- 发布 manifest SHA-256：`5901a821f7f955d4cafb0cd7c40420df506e24914de4abfa12678c7643f594b6`
- 源 .blend SHA-256：`c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357`
- 接收脚本：`scripts/models/receive-type055-nanchang-101-v2.mjs`（接收不变量：已合格包目录一旦验证永不移动——同版本一致幂等 no-op、漂移 fail closed；首次接收经暂存目录校验后单次 rename 原子入位；候选包路径脏工作区 fail closed；收据不含本机绝对路径）
- 接收收据：`receipt.json`（同目录；可验证主绑定为候选包目录 git tree digest
  `packageTreeDigest`——任意克隆（含浅克隆/squash 合并）都可用 `git rev-parse HEAD:<包路径>`
  复核；捕获时 `packageDirty=false`）
- ACT 候选目录：`public/assets/model-releases/type055-nanchang-101/v2.0.0/`（manifest + 六 GLB）
- ACT 描述符：`src/resources/simulations/model-packages/type055-nanchang-101-v2.ts`

## 每档请求字节预算（任务 5.3，来自发布 manifest 声明值）

| 消费场景 | 请求资产 | 声明字节 |
| --- | --- | --- |
| 高档首屏 | ship-lod0.glb | 24,060,684 |
| 中档首屏 | ship-lod1.glb | 15,789,220 |
| 低档首屏 | ship-lod2.glb | 9,029,444 |
| 武器演示（按需） | weapon-demo.glb | 245,636 |
| 弹药载荷（按需） | weapon-payloads.glb | 242,964 |
| 碰撞查询（按需） | collision.glb | 92,524 |

普通航向仿真首屏恰好请求一个 ship LOD；候选启用时不再预取旧模型主候选
（`models-opt/destroyer.glb`），旧候选链保留为运行时回退。低档切换只替换主舰 GLB，
复用同一世界变换与场景状态，不触碰既有质量降档合同（阴影/水面/后处理/DPR）。

浏览器实测请求账本：`browser-acceptance/destroyer-candidate-requests.json`。

## 上游缺陷返版模板（任务 5.4）

若浏览器验收或后续运行暴露模型资产缺陷（网格、动画绑定、贴花、坐标、LOD 内容漂移）：

```text
上游缺陷记录
- 模型版本：type055-nanchang-101 v2.0.0（ship_id type_055_destroyer_101_nanchang）
- 缺陷工件：<角色>/<文件名>（SHA-256 <哈希>）
- 复现：<场景/页面、操作序列、预期 vs 实际>
- 归类：ACT 适配层缺陷 / 模型资产缺陷
处置：
- ACT 侧不修补模型字节；候选保持未激活或回退旧模型链。
- 资产缺陷返回 3DModels 发布新模型版本，重新走完整接收门禁
  （receive 脚本 + model-package-type055.test.ts + 浏览器验收）后才能再次候选。
```

## 边界确认（任务 5.5）

- 未发布到 ESA/Delivery Bucket；候选 GLB 只进入同源 `public/assets/model-releases/`。
- 未切换生产默认模型：`SIMULATION_MODEL_REGISTRY` 七模型解析不变，destroyer 默认仍走
  browser-delivery 候选链；候选仅由 `?model=type055-v2` 显式启用。
- 未删除/未修改 `public/assets/destroyer.glb` 与 `models-opt` 管线。
- 未修改 Rust/WASM 数值内核、`SimulationClock`、控制器、遥测与 Arena 评分
  （`simulation-scene-drive-chain.test.ts` 回归通过）。
- 未修改受保护旧式 `src/resources/simulations/destroyer-simulation.tsx`。
- 生产激活（Delivery manifest、发布、浏览器流量门禁）保留为独立授权变更。

## 验证索引（任务 5.1/5.2）

- 单元/守卫：`src/resources/simulations/__tests__/model-package-type055.test.ts`（12 用例：
  六文件分母、哈希/大小、篡改拒绝、接口契约 127/8/112/24/贴花、LOD 映射、坐标基）、
  `simulation-scene-type055-candidate.test.ts`（默认关闭、registry 不变、无武器角色预载、
  旧式文件未触碰、驱动链导入不变）。
- 浏览器验收：`tests/type055-model-candidate.spec.ts`（QA 路由
  `/simulations/type055-model-candidate` + 实景 `/simulations/destroyer?model=type055-v2`；
  证据落盘 `browser-acceptance/`）。
