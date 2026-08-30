# STATUS — ai-obe-platform

> Single source of truth for resuming work. Read this FIRST when starting a session.
> Update this file at the end of every work phase so the next `/clear` resumes in 1 read.
> Last updated: 2026-08-30

---

## ✅ Done

<!-- Move items here from "🚀 Next phase" when finished. Group by area. -->

- 2026-08-30：#1683 本地实现与 7.6 已闭合。Git `authority/current.json` 已是生产 v0.37；latest-cutover 绑定 candidate receipt、独立 `runtime-release-active-receipt.v1`、无三文件 memo，前任 generation 三方一致。下一步是开 PR 到 integration。

- 2026-08-30：修全课迁移残余。共享 `StudentCards` 与自定义作答表单在演示模式禁用提交和作答控件（频域/奈奎斯特滑动条仍可预览）；批量脚本残留的 JSX `\'` 已清除；独立 `/interactive-learning/multi-representation-linkage` 包进 `InteractiveLearningShell`，工作台嵌入路径不叠壳。未给 `rust-analysis` 伪造中心插件。未开新 Issue，未重开 #1573，未认领 #1683。

- 2026-08-30：按 #1574/#1575 共性合同把剩余互动课迁到 `LessonRuntimeShell`，并收口 `compute.panel` 中心分支。28 门 unit + cruise 去掉课级 `CourseHeader`；`LEGACY_LESSON_RUNTIME_ROUTE_SLUGS` 清空；catch-all 学生/教师路由改挂 `standardize-lesson-runtime-shell`。控制工作台与 interactive-figure 改为插件查找。#1573 live/evidence 不再按课复制；#1569 control-correction 映射不扩散。未开新 Issue，未重开 #1573，未认领 #1683。

- 2026-08-30：补完已归档 #1573（`separate-classroom-live-state-from-submission-evidence`）任务 5.5/5.6。Playwright 班级绑定课堂走通 submit/resubmit/refresh/reconnect/闭课复盘；preview 零写。4.5 仍未勾选（`course_review` 与 backfill 仍有消费者）。本机 `act_obe` 补齐 `InteractionLog.submissionIdentity`。学生页 Prisma 泄漏改为 control-correction evidence port 延迟绑定。未开新 Issue，未认领 #1683。

- 2026-08-26：知识工作区产品 QA 已具备受管三角色本地 fixture。`scripts/tests/run-knowledge-workspace-product-qa.mjs` 仅在 loopback 目标和 loopback 数据库下幂等确保学生、教师、管理员测试身份；非本地目标或数据库拒绝写入并要求显式完整凭据。OpenSpec 任务 10.8 和 `commercial-ui-governance-gates` delta 已写入，4 项边界测试、typecheck 与 strict validation 通过；测试工件未发现 credential 字段。
- 2026-08-25：通过 Buddy propose 建立受治理图谱数学呈现变更 `render-governed-math-across-knowledge-surfaces`，提交并推送 `integration@f1e2db5ac`，登记 Issue #1536。提案保留 ActKG rich-text/math span，使用只读适配器与共享严格 KaTeX 能力覆盖 2D/3D、预览、搜索/筛选、抽屉、知识卡、讲义和教材；只有 ActKG Authority sidecar 缺陷可进入离线审核账本，ACT 自有 Markdown 公式必须修复后发布。change strict validation、typecheck、managed push 门禁、独立终审、Issue 唯一映射与空原生关系均通过；未 claim、实现、切换选择器或发布生产。
- 2026-08-22：通过 Buddy propose 建立生产 blob-view 教材检索完整性修复变更 `fix-blob-view-textbook-cache-overlay-integrity`，提交并推送 `integration@596f6054e9d983ae5f982e5d004b9dc850ad6956`，登记 Issue #1498。变更限定知识控制面 overlay 允许集、overlay 后复验、active view 不改写 OSS 的重建与回归测试；已严格 OpenSpec 校验、typecheck 及 managed push 门禁通过，Issue 仅 `status:ready`，未 claim、实现或部署。
- 2026-08-21：通过 Buddy propose 整理微辅导系列并提出七项 OpenSpec，提交并推送 `integration@446b57b65`。#1394–#1396 复用原 Issue 并补齐唯一 change-id；新增规范整理 #1481，以及长期演进父项 #1477 和题库五阶段覆盖 #1478、微干预证据回流 #1479、AI 生成审核发布 #1480。#1390/#1477 原生 parent、blockedBy、Project 登记、七项 change strict validation、typecheck 和 push 门禁均通过；全部新变更保持 `status:ready`，未 claim 或实现。
- 2026-08-21：完成 Issue #1140 的 OpenSpec 收尾。按 A → B → C 顺序将 `improve-konling-path-generation-journey`、`persist-adaptive-path-candidate-batches`、`sync-konling-candidate-path-selection` 同步到 canonical specs 并归档；新增 `konling-candidate-path-selection` 正式规范，三个 change 的工件与任务均完整，244 项正式 spec 严格校验通过。Issue 的最终状态以 GitHub 完成评论和关闭状态为准。
- 2026-08-20：将既有 Issue #1012 登记为 Buddy change `add-version-bound-resource-context-questioning`，提交并推送 `integration@7ed862738`。首版固定 unified textbook reader runtime v2 单元及已登记公式/图/表锚点，服务端逐轮重读和鉴权、原子固定完整版本身份，并仅通过 exact-version 导航句柄提供可点击引用；普通段落选区只作提示，面板关闭保留 reader 最新 live reading state。两项独立审查 P1（旧引用可能打开新版、关闭面板覆盖新阅读位置）已修复并复审通过；change strict validation、typecheck 和 managed commit/push 门禁通过，Issue 唯一映射、ready 标签和空原生关系已确认，未 claim 或实现。
- 2026-08-20：将既有 Issue #1011 登记为 Buddy change `add-task-aware-simulation-control-debrief`，提交并推送 `integration@bbb6e2c7a`。提案首版只覆盖 Cruise 课程转向场景，固定“已计算事实 + 仅限权威任务阈值的逐项判断”两层复盘，禁止自由探索综合优劣、瞬时控制量冒充峰值/能量及未完成运行结论；change strict validation、正式 specs、typecheck 和 managed commit/push 门禁通过，Issue 唯一映射与 `status:ready` 已确认，未 claim 或实现。
- 2026-08-20：通过 Buddy propose 建立开发工作站共享只读 OSS runtime 变更 #1469，提交并推送 `integration@33c367a9e`。提案固定专用 RAM 用户 `act-runtime-dev-read`、v2 Blob/manifest 只读命名空间、生产 `/api/readyz` active 身份发现、Linux/WSL2/Lima 统一运行层及仓库外凭据分发与撤销边界；change strict validation、typecheck 与 managed commit/push 门禁通过，未 claim 或实现。
- 2026-08-20：用户已创建并绑定 `act-runtime-dev-read` AccessKey。凭据仅保存于仓库外 `/Users/YW/.config/act/runtime-dev-read.env`（父目录 0700、文件 0600）；STS caller identity 精确匹配目标 RAM 用户，v2 release list、manifest Get 与 Blob Get/hash/size 通过，PutObject、legacy release list 和 Bucket root list 均被 AccessDenied，Git 跟踪文件未发现凭据值。

- 2026-08-14：通过 Buddy propose 建立 ActKG v0.18 Authority 与中文显示投影接入系列 #1405 及七个可独立领取的变更 #1406–#1412，提交并推送 `integration@ff5457fc8`。系列依次覆盖 Bundle v2/Schema 0.3 接入、完整候选导入、中文展示与 Teaching Projection 并行重建、资格审计、cutover-capable runtime 发布和五 selector 原子生产切换；七项 change strict validation、正式 spec、typecheck、managed commit/push 门禁及 GitHub 原生父子/依赖关系均通过，未 claim、实现、部署或切换。

- 2026-08-13：通过 Buddy propose 建立 Authority 领域教学图谱工作区系列 #1368 与九个可独立领取的变更 #1369–#1377，提交并推送 `integration@e0d6aa852`。系列固定八领域加综合入口、增量 Teaching Projection 非阻断合同、三组领域教学语义与跨域汇总、服务端渐进分片、两级领域工作区及知识卡/信息图侧边栏；九项 change strict validation、正式 spec、typecheck 和 push 门禁通过，未认领或实现任何变更。
- 2026-08-12：以无冲突 merge commit `0e4743797` 将远端 `integration` 对齐至 `main@f69af271b`，保留原有 `integration@c0a3200e` 的 28 项后续提交；验证 `main...integration=0 29`，发布分支已成为集成分支祖先。
- 2026-08-12：发布 GitHub Release `v0.5.0`，冻结应用修订为 `b9c1d2207`，并以本机构建的 `localhost/act-obe-platform:v0.5.0-b9c1d22` 完成远端 cutover-aware refresh。生产 app/worker 均运行该 OCI config，显式 `cutover`；本机及公网 readyz、93 项 Prisma 迁移、Redis/worker 及控制面校验通过。生产知识工作区已实测当前 Authority 4,891 objects / 2,409 relations 与历史 Legacy 15 / 0 双向切换可用。
- 2026-08-12：提交 `f69af271b` 修复后续 refresh receipt 把未执行 recovery 错记为 `:recovery` 的问题；成功、恢复成功和恢复失败分别记录 null、原失败阶段和 `:recovery`。已存在的 v0.5.0 receipt 保持不可变，其中该字段历史异常仅作审计说明，不影响实际已验收的运行态。
- 2026-08-11：提交 `95aa3b0a7`，实现 `adopt-active-authority-knowledge-workspace` 的 active Authority API 与三模式知识工作区。`/knowledge` 默认解析已提交的 `engineering-graph` READY/use-combination Authority（snapshot/hash/release 严格匹配、null Teaching Projection），activation 缺失时不回退 global pointer 或 Legacy；历史 Legacy 保持独立，固定 candidate 仅管理员受控诊断。16 文件增量的 Grok 独立审查通过，相关 66 项测试与 typecheck 通过。
- 2026-08-11：提交 `5c6b0a7`，修复 Active Authority 把无 Teaching Projection 的 engineering snapshot 误走 candidate runtime Projection 校验而返回 503 的 P1。active canvas/node detail 改为直接投影 canonical objects/relations；candidate 的标准 Projection fail-closed 契约保持不变。Grok 限域复核无新增 P0/P1，10 项聚焦测试与 typecheck 通过。
- 2026-08-11：提交 `634ce64f` 与 `8778dd7`，完成 active Authority 工作区最终本地验收。真实三角色 QA 在干净 `634ce64f` 上捕获 29 个 Legacy 状态、4 个 active 响应式状态、7 项焦点与 3 个角色边界；active 为 4,891 nodes / 2,409 relations、`use-combination` / `READY`、null projection。Grok 4.5 独立视觉复核 14 个维度全部通过、无 P0/P1；`npm run test`、typecheck、lint、商业 UI 治理、切换 refresh/production cutover/Docker/Legacy deploy 门禁与 strict OpenSpec 均通过。
- 2026-08-11：提交 `f88bf56`，将冻结 integration 合并 revision `94b785a7` 上的新鲜三角色产品 QA、40 张截图与 Grok 4.5 独立视觉复核写入受管证据。29 个 Legacy、4 个 active、7 项焦点、3 个角色边界和 20 项源码哈希均绑定同一 capture commit/tree；商业 UI 治理通过。
- 2026-08-11：提交 `24c782e0c`，将 committed cutover 的后续应用 refresh 固化为 runtime env 的唯一持久 `cutover` 模式、同锁保护控制面、不可覆盖的独立 app-refresh receipt 和 cutover 模式失败恢复；OpenSpec strict validation 通过。
- 2026-08-11：完成冻结 `v0.4.0@58f70df257f493f7dc13b2dabfb0383b972ee017` 的真实生产图谱切换。事务 `production-v040-58f70df-20260811T083732Z` 已提交，四类 selector、production marker、receipt 与 journal 全部闭合；4,891 个 Authority objects、2,409 条 relations 和六个 versioned graph consumers 均验证 READY。app/worker 使用相同 OCI config digest 并显式运行 `cutover`，本机与公网 `readyz` 均通过。此前 AppleDouble Authority 残留已按 sealed archive 精确身份清理，历史 `first-cutover-*` journal/receipt 保留为审计证据。
- 2026-08-11：将生产图谱发布边界修复提交并推送至 `integration@86ae69adb`；普通部署默认 `legacy`，Docker、runtime rsync、host mount 和 Podman 预检共同拒绝四枚 `current.json`，候选 releases/receipts 可随版本发布但不隐式切换 production authority。完整 `npm run test`、typecheck、lint、部署门禁和独立发布复核均通过。
- 2026-08-10：单独提交并推送 `server-ops` 触发门禁至 `integration@7cf102538`；仅明确的本项目服务器发布/部署或必须访问远端服务器状态的任务可启用，Git/GitHub/ActKG Release、纯本地图谱切换与准备分析默认禁止触发。
- 2026-08-10：将 ActKG `control-theory-engineering-v0.12` 的当前 authority 知识卡与 1,236 张信息图纳入 `integration@a905f0c62`；952 张正常卡、284 张 `draft-blocked` 卡和 1,236 张 accepted 信息图的库存、状态与导出门禁一致。元数据改为可移植的仓库相对引用，默认 runtime 导出跳过 blocked 卡。
- 2026-08-03：根据 ACT–ActKG 分层切换路线提出 13 项可独立领取的 Buddy change，提交并推送至 `integration@66b191d67`；#1265–#1277 已登记为 #1173 子项并写入原生 `blockedBy` 依赖。系列明确 ActKG 工程权威与 ACT Teaching Projection 分治，4,880 项历史 `DEFER` 仅作冻结审计；33 项活动 change 严格校验、TypeScript 门禁和独立终审均通过。
- 2026-08-01：提交并推送 `server-ops` 发布经验更新至 `main@a8a344877`；将远端最新 `integration@3e2f408d6` 与 main 非改写合并为 `integration@8db2f3ba4` 并推送，最终 `main...integration=0 73`，integration 完整包含 main 且严格领先。
- 2026-08-01：将近期发布的内存门禁、revision/provenance、远端容量、图谱并存、runtime 目录权限和生产验收经验沉淀到项目 `server-ops` 技能；新增部署完成且无其他构建后退出 Docker Desktop 的强制收尾要求。
- 2026-08-01：e734 在快照 `84c12101c` 已推送后切回本地 `integration`，通过 fast-forward 对齐 `origin/integration@b74322460`；左右差异 `0 0`，工作区干净。
- 2026-08-01：将 e734 中旧 #1117 范围的 66 个遗留文件保存并推送到只读原型快照分支 `codex/snapshot-1117-superseded-prototype-20260801`，提交 `84c12101c`；#1173 已发布选择性移植交接，明确禁止整分支合并。
- 2026-08-01：完成纯文档归档 PR #1129 收口；补齐正式 spec Purpose，合入最新 `integration`，经严格 OpenSpec、managed Git hooks 与独立审查后合并为 `b74322460`；关联 Issue #1055 已标记 `status:archived` 并关闭。
- 2026-08-01：快进 `integration` 至远端 TypeScript 修复后，提交并推送七个 ActKG M1K v1d 公开 Bundle 镜像；98 个文件的 SHA-256、60 项 Bundle 完整性/隐私测试、typecheck 和 Git push 门禁均通过，提交为 `040cdd8c2`。
- 2026-07-31：提交并推送全局成本—能力路由对应的项目代理规则；将 `act-dev1`、`act-dev2`、`act-resource` 快进到同一 `integration` 修订，并同步共享 Codex 配置、环境链接和 managed Git hooks。
- 2026-07-26：将全局 OpenWolf CLI 及 9 个已登记项目从 `1.0.4` 升级并迁移到 `2.0.1`。
- 2026-07-26：为所有项目创建迁移备份，生成 `anatomy-index.json` 与 `STATUS.md`，更新 hooks、Claude 规则和无冲突端口。
- 2026-07-26：修复 ACT 共享 `.wolf/memory.md` 中一处非法 UTF-8 记录，并通过 UTF-8、JSON 和 OpenWolf 状态检查。
- 2026-07-26：为 ACT 显式登记 `claude`、`codex` 两类代理，刷新 `.codex/hooks.json`，启用 `[features] hooks = true`，并加入 `PreCompact` 钩子。
- 2026-07-26：实现事件驱动的 OpenWolf anatomy 完整扫描：仅在工作树初始化、提交、分支切换、合并和历史重写后执行，并更新全部已登记工作树的本地索引与受管 Git hooks。
- 2026-07-26：顺序升级 CodeGraph `0.9.7 → 1.5.0` 与 CRG `2.3.5 → 2.3.7`，并使用新引擎完整重建 ACT 主工作树的两套图谱。
- 2026-07-27：完成 ActKG 权威知识迁移访谈，形成 12 项 OpenSpec 变更并通过独立覆盖审查；提交 `75a584de5`，登记父系列 #1105 与子项 #1106–#1117。
- 2026-07-27：退役旧课程知识治理系列 #947–#955；删除九项未实施的活动 OpenSpec，保留历史提案与 #948 调查证据，并清理两个残留远端分支。
- 2026-07-28：针对 CTKG 0.2 聚合工程发布新增两项变基变更：#1125 固定公开协议与聚合候选底座，#1126 重建课程覆盖、ACT Crosswalk 与资源绑定；下游 #1112–#1117 已按新门禁修订。
- 2026-07-28：将 ActKG M1E v1b 的 `control-theory-integration-v0.1` 与 `control-theory-engineering-v0.3` 权威包逐字节镜像至 authoring knowledge releases；未修改 ACT ReleaseSet 锁或消费适配。
- 2026-07-28：根据 `docs/proposals/2026-07-28-KG.md` 将未来发布接入策划为五段边界：标准 Bundle 兼容、候选事务导入、候选运行时、ReleaseSet Delta、课程/资源增量治理；25 项活动 change 与 187 项正式 spec 严格校验通过。

---

## 🚀 Next phase

- 2026-08-30：#1683 本地 7.6 已清场。下一步：开 PR 到 `integration`，用用户身份 `@codex review`；清场后合 `integration` → `main`、打新版本、`scripts/build.sh`、`deploy:app --skip-build`，再勾 6.4–6.7。不要 archive，不要再跑 10.7，不要 `deploy:runtime`，不要写生产 selector。

**Governed graph mathematics presentation (2026-08-25):** #1536 / `render-governed-math-across-knowledge-surfaces` 已为 `status:ready`，尚未 claim。实现必须先 claim，再接通同版 Authority rich-text/math sidecar、有界服务端投影、共享严格 KaTeX 配置、2D/3D 语义标签层及全部 DOM/Markdown 消费表面；Authority 已登记缺陷与 ACT 自有 Markdown 失败必须分治，后者不得使用上游豁免。不得修改 ActKG Schema、Teaching Projection 或生产选择器。

**Micro-tutoring full coverage (2026-08-21):** #1390 跟踪已完成的 #1391/#1392、审查中的 #1393，以及 `status:ready` 的 #1481/#1394/#1395/#1396。执行时先完成 #1481 canonical 规范整理与 #1393 节点映射，再并行推进 #1394 资源注册和 #1395 验证题注册，最后由 #1396 验收 54/54 全链路；每项必须先 claim，禁止把提案当作已实现覆盖。

**Adaptive assessment lifecycle evolution (2026-08-21):** #1477 跟踪 #1478–#1480，分别治理五阶段题库覆盖、微干预证据回流和 AI/模板题目候选的人工审核与版本化发布。三项均为 `status:ready` 提案态，未 claim；原生跨系列门禁为 #1478 blocked by #1481、#1479 blocked by #1395（后者已传递依赖 #1393），不阻塞独立的 #1480，也不额外等待 #1396。不得用 `allowedStages` 冒充可运行覆盖，不得让 AI 自审自发，也不得把资源浏览或一次微辅导通过直接写成掌握。

**Version-bound resource context questioning (2026-08-20):** #1012 / `add-version-bound-resource-context-questioning` 已为 `status:ready`，尚未 claim。实现必须先 claim，再完成 textbook-only identity envelope、逐轮服务端鉴权/重读、原子会话固定、exact-version CitationAddress 导航、双 revision/锚点漂移失败关闭及 reader live reading state 验收；不得扩展到 TeachingResource、KnowledgeCard、`/knowledge`、PDF、视频或外部网页。

**Task-aware simulation control debrief (2026-08-20):** #1011 / `add-task-aware-simulation-control-debrief` 已为 `status:ready`，尚未 claim。实现必须先 claim，再完成 Cruise 完成事件门禁、纯 debrief projector、权威阈值 provenance、五类确定性验收及评价/证据边界回归；不得扩展到其他船型、重写指标算法或使用自由探索目标生成任务结论。

**Developer OSS runtime access (2026-08-20):** #1469 / `enable-read-only-oss-runtime-for-developer-workstations` 已为 `status:ready`，尚未 claim。RAM 用户、仓库外凭据和真实只读 OSS 边界已验证；后续仍必须先 claim，再实现 readiness active identity、受管凭据安装器、Linux 挂载与物化生命周期、三平台 smoke 和合作者文档。当前凭据不得在实现前分发。

**ActKG v0.22 composite cutover series (2026-08-17):** #1441 跟踪 #1442–#1446。20260817-pm 访谈收束：首页圆形领域入口间不画连接线（依据 20260812-am ADR 与 Legacy 先例）；入口数量以激活复合发布的领域目录为准。执行顺序 #1442 → #1443 → #1444 →（#1445 UI 恢复可并行）→ #1446；候选导入与生产激活保持独立发布动作，激活原子移动五选择器至同一 v0.22 包络。五项 change strict validation、typecheck、push 门禁与 GitHub 父子/blockedBy 关系已通过（integration@93d88e802），全部 `status:ready` 未 claim。

**Production app refresh (2026-08-17):** 现网 app/worker 跑 `v018-e4ba812982c`（`e4ba812982cdce9e1ffa7f3a3ab038fdf4e6bc63`）。runtime 仍是 blob-view `runtime-3dcc716…`，v0.18 五选择器哈希未变。未跑 `deploy:runtime`。Prisma 101 条迁移。开机仍依赖 blob + helper 两个 oneshot。

**Production OSS readiness repair (2026-08-22):** app-only 刷新已部署 `integration@37c597ba33c8f79ebabe4e3903a1b739daaf2b23`。`deploy/podman/deploy.sh` 现在把 `RUNTIME_DELIVERY_MODE=ossfs-blob-view` 注入 app 与 worker；公网 `/api/readyz` 已返回 `runtime.required=true`、`runtime.ready=true` 和 active identity `runtime-89fef308…` / manifest `fe378250…` / tree `67ce9c76…`。未发布、未激活或改写 OSS runtime。远端磁盘满曾阻止镜像装载，已仅删除未被任何容器引用的旧 `act-obe-platform:v018-e4ba812982c`，保留当前镜像与 runtime。

**Micro-tutoring runtime publication (2026-08-25):** 候选 `runtime-bb309e6…`（仅新增 6 个微辅导治理 JSON blob，1,154,283 bytes）已由不可变已发布工件恢复并激活。生产 `current`、host active、lifecycle active、localhost/domain readyz 与严格 materializer verify 均为该身份；rollback 保留 `runtime-89fef308…`。期间发现并修复容器内 `mktemp` 模板不可带 `.ts` 后缀，提交 `23e5956`；先以相同 active identity 重建旧 blob-view，消除遗留 regular overlay，再切换候选。身份装配保持分离：开发用 `runtime-dev-read-env.zsh`，发布只接受 `runtime-publisher.env` 的 `act-runtime-publisher-local` provider；Authority selector 未改动。

**Blob-view textbook cache integrity (2026-08-22):** #1498 / `fix-blob-view-textbook-cache-overlay-integrity` 已为 `status:ready`，尚未 claim。生产 active host view 的三份教材检索热缓存仍来自旧 `runtime-3dcc…`，但 current manifest 是 `runtime-89fef…`；根因为宽泛 host overlay restore 在候选校验后复制全部 regular file。实现必须采用显式知识控制面允许集、覆盖后 validation 和不改写 OSS release 的受锁 active-view 重建；不得用手工覆盖缓存或重新发布替代修复。

**Active Authority rollout:** 生产 authority 已是 v0.18 cutover；`v0.5.0` 之后又上过 `v018-94d585ae63a6`。后续应用更新应走 cutover-aware refresh；live view 缺少 `production-cutover-transactions/current.json`，标准 refresh 预检目前会失败。

**Graph governance series:** #1173 仍作为 ActKG Engineering Authority 与 ACT Teaching Projection 的后续治理跟踪父项。#1265–#1277 的工作继续按 GitHub 原生依赖、永久隔离工作树和各自验收条件推进；本次切换不自动完成未领取的教学语义、资源绑定或 KAQ 工作。

**Authority domain teaching workspace series:** #1368 跟踪 #1369–#1377。先完成领域展示目录与增量教学投影合同；三个领域内容增量可并行，跨域教学语义等待三者完成；分片服务只依赖目录与增量合同，随后依次实现分层工作区和知识卡/信息图侧边栏。该系列仍为 `status:ready` 提案态，未 claim、未进入实现。

**ActKG v0.18 cutover series:** #1405 跟踪 #1406–#1412。执行顺序为 #1406 → #1407 →（#1408 中文显示与 #1409 Teaching Projection 可并行）→ #1410 → #1411 → #1412；候选导入与生产激活必须保持为独立发布动作，最终事务同时校验 Authority、Teaching Projection、prerequisites、Authority domain shard 和 shared consumer activation 五个 selector。当前全部子项为 `status:ready`，尚未 claim。

---

## 📁 Active architecture

- **OpenWolf:** `2.0.1`
- **CodeGraph:** `1.5.0`
- **Code Review Graph:** `2.3.7`
- **结构化索引:** `.wolf/anatomy-index.json`
- **会话交接:** `.wolf/STATUS.md`
- **迁移备份:** `.wolf/backups/2026-07-26T0239/`

---

## ⚠️ External blockers (don't block coding)

- 上游针对长期历史文件轮转的 PR #63 尚未合并，现版本不会自动限制 `memory.md`、`cerebrum.md` 与 `buglog.json` 的增长。

---

## 🔧 Useful commands

```bash
rtk openwolf --version
rtk openwolf status
rtk openwolf update --list
rtk openwolf scan
```

---

## 📚 References (read IF needed)

- `.wolf/cerebrum.md` — User Preferences + Do-Not-Repeat + Decision Log
- `.wolf/anatomy.md` — token-efficient file index
- `.wolf/buglog.json` — known bugs + fixes
