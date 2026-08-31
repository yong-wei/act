# 生产产品验收（v0.6.1 / #1683 6.4–6.7）

记录时间：2026-08-31。未写 selector，未 `deploy:runtime`，未重跑 10.7。

## 6.4 应用发布

| 项 | 值 |
| --- | --- |
| GitHub Release | https://github.com/yong-wei/act/releases/tag/v0.6.1 |
| 冻结修订 | `93a70aed4d51a366ecf5cb4e9a86d06c41c4bbed` |
| 镜像 | `localhost/act-obe-platform:v0.6.1-93a70ae` |
| tar SHA-256 | `bd05509871dbd0902c0f5cbab6c555e22bcda3783c46e5f5a6ee4f039c01b0b5` |
| provenance | `deploymentScope=app-only`，`appRevision` 与冻结 SHA 一致 |
| 部署 | `deploy:app --skip-build`；公网 `readyz` app/db/redis/runtime 均为 true |
| Runtime | 仍为 `runtime-150a505ac26b2130278fa269f41830f83a9d97658db4afd0aedddde` |
| 独立 Runtime receipt generation | 30（与 `act-runtime-selection.json` 一致；不是 10.7 当时的 44） |

构建工作树缺 gitignored 教材 runtime 时，必须 `BUILD_SCOPE=app-only`；`--app-only` 部署也要求该 provenance。不得沿用旧 `deploy/images/act-obe.tar`。

## Overlay（读取时 Teaching，不重物化 shards）

停服窗口只跑 successor control-plane overlay（含必填 `domain-fragments`），未做全量 ossfs verify。ECS 安装器先与冻结树 SHA 对齐后再 `--apply`。

| 指针 | hash |
| --- | --- |
| Teaching Projection | `c9a6f33eb88fff28f8934a25a627e38deffcbf331ee7f34bb4e9ff65b0d02c2e` |
| domain-fragments projection | `eb4d2d63aca6f3cca74fa18d3d1b548c44a34047442680a259386499ebff14fe` |
| shard set（密封仍 unavailable，未改） | `c462da19203700966fce21ad5f8d2d6fbc1832844872ca71f019f0a28e670c68` |
| catalog | `ae08809b60a065baf6586142c2aa6af3dbdaa453c634427b1afc6689a7217a1c` |
| consumer activation | `1f3e70d409b140e54badca4a0bf4c0aff685f33e35937fbcf49373aa1c927caa` |

`4-deploy --runtime-cutover-app-only` 曾出现一次 runc freeze，worker 重试后与 app 均运行 `v0.6.1-93a70ae`。

## 6.5 只读回读

学生会话请求生产 `/api/knowledge/shards/active` 与领域默认分片：

- `latestCutover.ready=true`，`combination=successor`，`reasons=[]`
- `composedDomainFragmentManifestSha256=eb4d2d63…`，`teachingProjectionSha256=c9a6f33e…`
- `root-locus`：`teaching.status=available`，`teachingRelations=1`，文案「该领域已发布可用的教学关系覆盖」
- `frequency-domain-analysis`：同样 available / 1 条关系
- `system-modeling`：`partial` / 4 条关系（不是 unavailable）
- 根分片与上述领域 JSON 均不含「教学关系暂不可用」
- 公网 `readyz.runtime.identity.releaseId` 与上述 Runtime 一致

## 6.6 浏览器

以学生 `demo` 登录 `https://act.adapt-learn.online/knowledge`：

- 根页 `[data-latest-cutover-ready]=true`，15 个领域入口，正文无「教学关系暂不可用」
- DOM `click` `[data-authority-domain-entry="root-locus"]` 进入根轨迹；覆盖文案为已发布教学关系
- 2D→3D 切换后 `3D` pressed；再切回 `2D` pressed，覆盖文案仍为「该领域已发布可用的教学关系覆盖」
- 筛选「结构」可按压；节点「根轨迹法」打开「关闭节点详情」抽屉；存在 KaTeX
- 「旧版」切到独立 Legacy 目录/筛选，不把 Legacy 数据当作 active Teaching；「新版」恢复同一领域会话（3D、结构筛选、根轨迹法仍选中）
- 根页 DOM `click` `[data-authority-domain-entry="frequency"]` 进入频域；2D 下覆盖文案同样为已发布教学关系，无「教学关系暂不可用」
- 个别跨域入口可出现「名称暂不可用」（unavailable-name 排除），这不是教学关系暂不可用

## 6.7 前任演练（未写 selector）

- 候选密封 `predecessorRuntimeLifecycleGeneration=42`
- 现行独立 Runtime receipt generation=30，因此 **不是** identity-matched predecessor
- 聚焦测试 `latest-cutover-live.test.ts` / `latest-cutover-verifier.test.ts` 21 项通过，覆盖：identity-matched predecessor 时 `ready=false` 且 `combination=predecessor`；前任 release 配漂移 generation 时 fail-closed，不得假报 predecessor 成功
- 未执行真实 selector 回滚；回滚仍归 provider

## 7.3 验证残余

冻结发布修订 `93a70ae`：

- `rtk npm run typecheck` 退出 0（web graph 既有 blocked 文档/工具边，脚本继续）
- `BUILD_SCOPE=app-only` 的 `scripts/build.sh` 成功，容器内已跑 production TypeScript / Next build
- 聚焦 `latest-cutover-live.test.ts` 与 `latest-cutover-verifier.test.ts` 21 项通过
- `rtk npm run lint` 在冻结 SHA 上有 2 个既有 error（`scripts/knowledge-cutover/verify-actkg-v018-host-shadow.ts` 解析、互动课测试给 `module` 赋值），本验收文档未改这些文件
- 未重跑全仓 `test:unit` 与第二次 docker build；`npm test` 在脏工作区会 `dirty-worktree` 失败关闭

7.3 不勾选。产品 6.4–6.7 不依赖这次全仓 lint/unit 转绿。
