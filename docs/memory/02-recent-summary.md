# 最近摘要

状态: active
最后更新: 2026-09-09
摘要: 生产应用 `v0.7.5-e1c25ff`（main `e1c25fffe…`，app-only，tar SHA256 `fb6dd807…`）已发布并验收通过：integration（42 个提交，含 graph-path 重设计、#2043 教材出处映射、#2054 图谱缺陷修复等）合入 main，版本 0.7.4→0.7.5。部署期热修一处发布构建阻断：`published-resource-index.ts` 与 `engineering-textbook-mapping/coordinates.ts` 三处动态 `join(process.cwd(), …)` 触发 Turbopack「whole project tracing」门禁，按仓库惯例补 `/*turbopackIgnore: true*/`（`e1c25fffe6`，已同步 main 与 integration）。注意：`scripts/build.sh` 的 `BUILD_SCOPE` 默认 `runtime-bound` 会校验本地外置教材索引（本机 manifest `resourceSetId: null` 不过），app 发布必须显式 `BUILD_SCOPE=app-only`；发布命令经管道时必须 `pipefail`+回显 EXIT，tail 会掩盖失败。生产容器 app/worker 均已切到新镜像，readyz app/db/redis 全 true，画像 fence 收敛，authority 维持 LEGACY，runtime 保持远端现有 blob-view 未动。生产知识面维持 Authority v0.37；Runtime active 仍为 `runtime-150a505a…`，lifecycle `desired=runtime-18187f40…` 待激活（#2045 学习清单 closure 门禁未过，「教学关系 0 条」根因仍是新指针未发布）。Wolfram Cloud 仍 503，远端 `.env.server` 保留 `SKIP_WOLFRAM_READY_CHECK=1`。已知残余：demo 学生（`cmjtgw3ov00008f1njzx4bg7l`）画像 current state 停留 v2/gen1，待对账；远端 `deploy/images/` 残留旧 tar（v0.7.2 等）会被 `2-load-images.sh` 一并装载，占用磁盘但不影响绑定目标镜像。
上游:
- [00-index.md](00-index.md)
- [README.md](README.md)
下游:
- [10-project/10-current-state.md](10-project/10-current-state.md)
- [20-architecture/00-index.md](20-architecture/00-index.md)
- [30-operations/00-index.md](30-operations/00-index.md)
- [70-workflows/00-index.md](70-workflows/00-index.md)
相关:
- [docs/ProjectDescription.md](../ProjectDescription.md)

## 最近最重要的稳定变化

- 2026-09-07 上游 ActKG 发布 r6 bundle `ctb:control-theory-engineering-v0.37:r6`（digest `ca20b912cd84a57a…`，publication tag `control-theory-engineering-v0.37-r6`，source-r7/5037964，本地克隆 `~/Documents/Project/ActKG`；release report `docs/design/20260907-ctkg-m4-u2u5-v037-r6-release-report-v1.md`）。实测核验：U2 已修——新增 79 条 `prerequisite` ProjectedLink（DomainConcept–DomainConcept、有向、无环，`ctkg:m4-u2u5:prerequisite:*`）；U3 已修——303 个超长 DomainConcept zh 名改名词短语（zh name>16 字符 4373→4070，剩余多为 Formula LaTeX 源码与 KnowledgeStatement 长句，内部记录公式 218 个进 hidden_entities）；U4 已修——`ctc:c782502fe412ef828c662650` 更名「闭环传递函数伴随概念」；U5 已修——683 实体新增 alias（zh/en 对称，localized-content `field_path=alias`）。上游把 U1（family 分片必须与关系端点同交付，bundle 内 3047 边 0 dangling）与 U6（teachingCoverage.relationCount 取最终 payload，Coverage v0.34≠教学关系）退回 ACT 侧。r6 已镜像入 `course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r6/`（25 文件 SHA256SUMS 全过）。接入需 OpenSpec 变更（超 #1741 规模）：新 authority 快照、catalog 须裁决退役 4 个 v0.22 继承成员（ctc:modeling-423b8453…、ctc:modeling-f6940765…、ctf:68d4b357…、ctf:8f245a09…；build-v037-r4-domain-catalog.ts 零退役断言必 fail）、v037-adapter.ts:33 硬编码 r5 路径、registry `multilingualLabelCount: 2330` vs 实际 7472 的既有语义债、r6 `prerequisite` 谓词在 families.ts:22-31 无族映射（materialize.ts:79-89 不在 SUPPORTED_PREDICATES）、alias 行不进快照（build-v037-authority-snapshot.ts:366,373-380 只收 name/canonical_preferred）、课程投影 projection/current.json（proj-b0b02692 绑 snap-e2d8b92f）是否随权重绑是决策点。先后修消费（R1）独立立项：#1270 合约+planner 只认 ACT_TEACHING 层。

- 2026-09-07 图谱全面缺陷梳理（基于 v0.37 shard set ads-294a0616 全量数据实测）：#2052 五+一问题已由 PR #2054 实现合并（integration，待发布验收）。新增量化结论：① 关系端点交付断裂——3063 条 ENGINEERING 关系中 2462 条（80%）至少一端不在概览层交付内（2289 个唯一对象仅存在于 node-neighborhood 分片，类型分布 KnowledgeStatement 1496/Formula 650/其他；view-model authority-graph-view-model.ts:148 按 visibleIds 丢弃悬空边）——这是「进入领域关系稀少」除教学指针外的另一半根因。② 长句标签是系统性数据问题：details 7476 节点中 4350 个 label>16 字符（DomainConcept 303、KnowledgeStatement 2342、Formula 1446 为 LaTeX 源码）；1921 对象 90% 无 aliases（root-locus 检索索引 104 条全无别名）。③ 治理备注污染 label 实例：ctc:c782502fe412ef828c662650（评审备注入展示字段，3 个 family 分片重复交付）。④ 工程图谱无知识先后修谓词（8 种谓词无 learning-order 类）；本仓库三层断点：#1270 合约只允许 ACT_TEACHING 层发布 PREREQUISITE（ENGINEERING_RELATION 等 8 类来源只做候选永不自动发布）、当前发布 proj-d55c3ac4 全部 139 条 ACT_TEACHING/RECOMMENDED 且 candidates=0、planner.ts:130-141 硬性过滤 layer=ACT_TEACHING。⑤ 教学关系双通道漂移：shard set current.json 内嵌 teachingProjectionId=proj-eb4d2d63（8-13 密封快照），domain-fragments/current 已 proj-05984a0f（9-05，374 条）；运行时读分片内嵌快照（shard-store.ts:340），分片不重建则指针切换不生效。⑥ teachingCoverage 收据与载荷不一致（root-locus 声称 1 条实际 0 条，stability-analysis 声称 3 条实际 0 条）。

- 2026-09-07 新版知识图谱五个生产问题完成根因调查并立项 #2052（buddy propose，待其他代理实现）：① hover 全图漂移=hover 重渲染使 graphData memo 失效（runtime-canvas 每次新建 materializedNodeIds/默认参数数组）+ force-graph 摄入即 `stop().alpha(1)` 全量重热 + fx/fy 沉降冻结被坐标续承刻意丢弃；`computeKnowledgeForceStructureSignature` 设计未接线。② 22/85 根轨迹节点标签是定义长句（v0.37 上游数据）。③ 「教学关系 0 条」=生产 domain-fragments 指针停在 proj-eb4d2d63（其唯一关系端点不在概览内）；#2032 的新指针 proj-05984a0f（root-locus 37 条可用）从未发布——view 切换保留选择器，指针切换是独立手术（参照 runtime-24535a192 artifact 的 apply-on-host.sh 模式）。④ 进入领域 16→27→85 三段跳变=visibleKeys 渐进并入+逐段重热重取景。⑤ 跨领域横幅=boundaryCues 顶部 section。deploy:runtime 运维教训：候选激活曾因 act-obe.env 持久化的 ACT_COORDINATED_ACTIVE_RECEIPT_PATH 与候选 mktemp 目录错位而失败回滚（修复 `a3c6498`/`4279c0038`）；resume 预检 staged 动作被 bash 门禁误判（修复 `e4fc5db6`）；`desired` 选择器需 `set-desired` 显式设置后 resume 才接受；发布命令经管道时必须回显真实 EXIT（tail 会掩盖失败）。

- 2026-09-06 生产应用 `v0.7.4-8d661f5` 已发布并验收通过（`deploymentScope=app-only`，main `8d661f58e…`，tar SHA256 `fa7f6a62…`，app/worker OCI revision 与冻结 main 一致）：integration fe9343dd2 合入 main，版本 0.7.2→0.7.4；ActKG/CourseCoverage/资源绑定影子 verify-only 通过，知识图谱同步 838 节点/16571 关系，readyz app/db/redis 全 true，Redis noeviction，DATABASE_URL 连接池参数正确。部署期发现并热修：#2005 新增的画像 fence 验收脚本抽样「最早创建的 STUDENT」，在生产命中零事实账户（backfill 候选只含有 LearningFact 的学生，零事实账户按设计无 current state），改为抽样迁移覆盖学生（`48741377f`，已回传 integration）。操作教训：`remote-deploy.sh --skip-build` 默认读取 `deploy/images/act-obe.tar`，指定版本化 tar 必须显式传 `LOCAL_IMAGE_TAR`，且 `REMOTE_APP_IMAGE` 必须显式传目标标签（默认 `20260301-amd64` 会在装载后报 image not known）。生产数据残余：119/293 学生有画像 current state，175 个零事实账户无（按设计），1 个学生滞留 v2/gen1。

- 2026-09-04 #1942 生产图谱加载失败已修复（PR #1981 合并）：根因是生产 blob 视图激活分片集 ads-c462da19… 为 #1738 之前物化、无 coverage.json，根入口按规格 fail-closed 404；修复为内容侧切换——把仓库已封印的 ads-294a0616…（含 coverage 收据，15045 文件哈希校验一致）上传到视图 `sets/` 并把 `knowledge/authority-domain-shards/current.json` 覆盖为仓库字节（备份 `.bak-1942`），激活侧本已是 r4-c6（activation-0b72f577），无需 redeploy。注意：该分片集以宿主机常规文件存在于视图中（属 overlay payload 豁免），下次发布新 runtime release 会自带该分片集。英文不可切换的第二根因：`.dockerignore` 排除且 Dockerfile 未 COPY `cutover/envelopes/locale-manifests/`，已修复（含构建断言），并重封 v0.37 资格包（界面文案目录 digest 与包绑定，新增文案键后必须重跑 `scripts/knowledge-cutover/build-v037-r5-locale-qualification.ts`）。英文生产验收（archived tasks 4.2/4.3）待下次镜像部署，#1942 保持开放跟踪。呈现层同步修复：分片失败按 code 分「内容未就绪/暂时故障」两态，未就绪态提供旧版入口且无空重试。
- 2026-09-04 生产应用 `v0.7.2-b5d3768` 已发布并完成验收（`deploymentScope=app-only`，tar SHA256 `650e0ee6…`，app/worker OCI revision `b5d37686…`）：ActKG/CourseCoverage/资源绑定影子 verify-only 通过，知识图谱 838 节点/16571 关系，readyz app/db/redis/runtime 全 true。驱逐舰仿真生产切换视觉验证通过：默认页加载 `assets/model-releases/type055-nanchang-101/v2.1.0/type055-nanchang-101-ship-lod0.glb`（200），整舰完整可见。部署期发现并修复 `scripts/remote-deploy.sh` 验证段 Wolfram 探针不读 `SKIP_WOLFRAM_READY_CHECK` 的缺口（`050f8f9f7`，已回传 integration）。部署过程中服务器云盘由 49G 扩容至 99G；此前三次失败的根因均为磁盘耗尽，教训已沉淀到 server-ops 技能：`2-load-images.sh` 会装载 images/ 下全部 tar（目录只放目标 tar）、`podman load` 需要约 2 倍镜像空间（/var/tmp 暂存+overlay 写入）、清理孤儿 overlay 目录必须与 `overlay-layers/layers.json` 记录联动（否则装载报幽灵层 Stat 失败）。
- 2026-09-04 开发者网关（runtime-dev.adapt-learn.online）读取超时已修复并重启上线：根因是租约持久化风暴——每条租约内联 3.7 万条 allowlist（约 5MB），heartbeat 与每次 blob GET 都在全局锁内全量重写 `leases.json`（实测 399MB/82 租约、累计 1.2TB 磁盘写），所有请求排队超过客户端 30s 超时。修复在 `scripts/runtime-release/developer-oss/gateway_service.py`：持久化前驱逐死亡/超宽限租约、心跳类持久化 30s 去抖、同 checkout 重签发取代旧活租约。运维配套：重启前按同规则裁剪租约库（备份 `.bak-lease-storm`）。修复后 heartbeat 2ms、issue 5.3s（3.7 万文件清单校验）。排障方法已沉淀到 `.agents/skills/server-ops/references/remote-investigation.md`。
- 2026-09-04 生产应用 `v0.7.1-51ed935`（`deploymentScope=app-only`，app/worker OCI revision `51ed935b8d…`，tar SHA256 `e712a399…`）已完成部署与验收：25 个 Prisma 迁移应用，ActKG/CourseCoverage/资源绑定影子 verify-only 通过，知识图谱 seed 838 节点/16571 关系，readyz app/db/redis 全 true。部署时 Wolfram Cloud 计划维护全站 503，当时经用户授权对远端 `4-deploy.sh`、`5-configure-service.sh` 打了三处临时补丁。该跳过机制已收敛为仓库受控实现：`deploy/podman/deploy.sh` 在 `SKIP_WOLFRAM_READY_CHECK=1` 时透传容器并跳过 smoke 预检，标志放在远端 `.env.server`，v0.7.2 部署重同步脚本后临时补丁自动失效。Wolfram 恢复后从远端 `.env.server` 移除该标志即恢复完整门禁；在此之前公式计算功能不可用。
- 2026-09-04 驱逐舰 v2 模型调查结论：默认界面显示旧模型是 #1898 既定范围（候选接入，`?model=type055-v2` 显式启用，生产激活为独立授权变更）。两个真实缺陷待修：① QA 页 `/simulations/type055-model-candidate` 的 Canvas 无相机取景（默认相机在 180m 舰体内部，只看到舰底）；② 冷加载时 `StayPutCameraController` 存在相机对象竞态——v2 路径无模块级预载，GLB 挂起期间控制器在 R3F 初始默认相机上完成一次性初始化，drei `PerspectiveCamera makeDefault` 随后替换相机对象，`initialized` 已置位导致机位永远钉在 `[0,200,500]`（距船 6.5km），船不可见；热缓存刷新后正常。修复方向：控制器跟踪相机对象身份变化时重新锚定。另发现 4 个 skinned 网格（机库门×2、国旗×2）经 `clone(true)` 后骨骼绑定断裂，需 `SkeletonUtils.clone`。验收测试只断言数据层（请求账本、节点变换），未断言视觉可见性，导致两类问题漏出。→ 两个缺陷已由 #1953 修复，v2.1.0 参数化模型已随 v0.7.2 生产切换并视觉验收通过。
- 2026-08-31 #1683 生产应用 `v0.6.1-93a70ae`（`deploymentScope=app-only`）已 `deploy:app --skip-build`。successor Teaching/domain-fragments overlay 已安装；密封 shard set 未重物化。公网 `/knowledge` 合格领域不再显示「教学关系暂不可用」。独立 Runtime receipt generation=30。不要再 apply overlay，不要 `deploy:runtime`，不要重跑 10.7。
- 2026-08-27 #1554 纠正：PR 质量门禁是本地可审计证据，不是 GitHub Actions PR CI。`integration` PR 不增加 `pull_request` 触发器，也不要求 GitHub status check。GitHub Actions 只保留现有 `main` push、明确授权的 `workflow_dispatch`，以及后续单独授权的发布验证。已删除 `.github/workflows/quality-gates.yml`，并恢复 `ci.yml` 的 main 基线。
- 2026-08-18 31 课导入片已增量发布到生产 v2 blob-view。active `runtime-7b907428f…`（source `71bbc2db4`），rollback `runtime-3dcc716…`；v0.18 选择器通过 parent overlay 保留。公网媒体走 `/api/course-runtime/assets/lessons/<unit>/media/<unit>-intro-video.mp4`，验收为 307。`remote-deploy.sh` 的 `legacy-rsync` 已退役，不得再 rsync `course-content/runtime`。
- 2026-08-18 SiliconFlow 主力模型已切到 `Qwen/Qwen3.5-35B-A3B`。运行时真源是 `PlatformSetting.ai_provider_settings.selectedModel`，不是容器里残留的 `AI_MODEL`。切换前本地和生产 siliconflow 实际都是 `deepseek-ai/DeepSeek-V4-Flash`；代码回退默认此前是 Qwen3.6。未因这次切模型重建生产镜像。
- 2026-08-17 31 课闲聊自控导入片已发布到作者态 `course-content/authoring/lessons/<unit>/media/processed/<unit>-intro-video.mp4`，并用 `course-content/scripts/export-runtime.sh --all` 加单独导出 `1-3` 同步到本地 runtime。成片文件被 `*.mp4` 忽略，不进 Git；清单回写在各课 `design/<unit>-multimedia.md` 与 `media/processed/<unit>-media.md`。生产 runtime 仍走 `deploy:runtime` / OSS blob-view，不会因本地 export 自动上线。
- 2026-08-17 Issue #1379 `deduplicate-runtime-releases-with-content-blobs` 已完成 4.4 验证并归档。生产默认 `ossfs-blob-view`；`deploy:app` 不再 rsync runtime。
- 2026-08-16 生产 runtime 已切到 OSS v2 blob-view。`deploy:app` / `remote-deploy.sh` 默认 `ossfs-blob-view`，只绑定已物化 view，不再 rsync `course-content/runtime`。runtime 内容更新走 `deploy:runtime`。
- 2026-08-16 `dev1` 永久工作树已从 `~/.codex/worktrees/e734/act.just.edu.cn` 迁到 `/Users/YW/.codex/worktrees/act-dev1`。Buddy 认领真源是最新 Claim 的 `worktree_alias: act-dev1` 加 `git config --worktree buddy.worktreealias`。用户要求手工修复认领/进度并按参考流程继续，不要被 lite 的 partial-claim 脚本决策挡住。
- 2026-08-16 用户授权选项 1 后，v0.18 邻域 25 个对象通过 snapshot 绑定 overlay 获得分类器安全 zh-CN preferred。密封 `multilingual-label-index.jsonl` 仍是 1909 行。正式 qualify CLI 写出真实 READY（文件 sha256 `1444318cc2…`），发布器 pin 已改到该哈希。五个生产选择器仍是 v0.9。用户随后授权完成 #1405 系列（含 #1411/#1412），仍不要认领 parent `#1405`。

- 2026-07-28 Issue #1125 `adopt-ctkg-0-2-aggregate-release-contract` 已完成实现与验证：候选权威知识底座锁定 CTKG 0.2 聚合工程包 `control-theory-engineering-v0.2`（841 release entries、744 投影节点、97 投影关系、1302 条唯一上游 crosswalk、九种谓词），候选 Repository、三项投影、候选图谱与候选态控灵绑定同一聚合 ReleaseSet、`projectionDigest` 与 `sourceDatasetHash`。公共 bundle 字节级往返成立；私有 CTKGDataset 明确不可用且不得重建；CTKG 0.1 仅历史可审计；Legacy 仍是生产权威；旧 inventory/crosswalk/candidate/decision/binding 仅 historical/stale。干净 Git HEAD 上的 PostgreSQL 迁移、导入、幂等、冲突回滚、字节往返、Repository、部署 CLI 与 canonical binding shadow 全流程通过；下游 CourseCoverage/ACT crosswalk、资源教学角色、RAG/KAQ/SAR、路径、学习事实与生产切换仍受后续依赖门禁。

- 2026-07-18 `openspec list --json` 中的四项 change 均已完成任务：知识图谱根节点气泡与 inspector 持久化、评估检查点资源语义、教师审核与学生反馈闭环、互动课组件样式统一。它们尚未全部归档，因此“目录仍在 `openspec/changes/`”不等于仍有未实现任务。

- 2026-07-18 资源语义闭环已经覆盖完整资源 readiness、可追踪语义审核和评估检查点权威边界。消费端应保持 fail-closed，并按阶段和权威来源解释证据；不要恢复仅凭字段存在或宽松默认值判定资源就绪的旧行为。

- 2026-07-18 知识图谱已完成根节点气泡布局、形状感知边界几何、请求与清理归属、inspector 状态持久化等治理。图谱后续改动应继续使用 canonical domain validation 和明确的请求生命周期。

- 2026-06-17 `1-2` 新主线互动课当前路由是 `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system`，预设键是 `unit-1-2-modeling-from-object-to-system-v1`，资源键是 `unit-1-2-modeling-from-object-to-system`。该实现以 `course-content/runtime/lessons/1-2/interactive-manifest.json` 为真源，14 步 manifest-first 闭环已完成；第 9 步通过共享 `static-surface-3d` 显示三维幅值曲面，第 10/11 步通过共享 `interactive-figure` 保持交互节点，不恢复旧版 `unit-1-2-block-diagram-simplification`。实现合同位于 `course-content/authoring/lessons/1-2/notes/interactive-implementation-acceptance.json`，浏览器证据位于 `artifacts/interactive-learning/unit-1-2-implementation-acceptance-2026-06-17/`。

- 2026-06-19 教材 RAG 真源开始进入主工作树本地 `course-content/authoring/resources/textbooks/`。Dorf/Bishop《Modern Control Systems》前三章已按 `dorf-modern-control-systems/chapter-XX/textbook.md + assets/` 结构导入，根 manifest 位于 `course-content/authoring/resources/textbooks/dorf-modern-control-systems/manifest.json`；该教材数据目录通过主工作树 `.git/info/exclude` 本地排除，不进入 Git 跟踪。具体导出规则见 [70-workflows/textbook-rag-resource-export.md](70-workflows/textbook-rag-resource-export.md)。

- 2026-06-12 曾建立永久资源工作树用于课程资源制作。该记录只说明“永久工作树内不再嵌套 worktree”的原则；当前可用工作树和分支必须以任务授权与 Git 实际状态为准。

- 2026-06-13 React Doctor 错误清理系列已归档到 specs，覆盖 server、aria role、shared state/effect、interactive state/effect 和 resource state/effect；AppShell 折叠导航合同 #413、学生二级路线壳层迁移 #414、知识图谱壳层迁移 #415 和数据中心角色可见性 #416 均已完成。相关视觉证据保存在 `artifacts/commercial-ui/`；这些项目不再是当前待实现事项。

- 2026-06-12 平台 UI 已从分散页面推进到 `AppShell`、角色导航、状态证据组件和页面族治理。`src/lib/platform-role-navigation.ts` 现在覆盖课程、任务空间、数据中心、教师治理、Arena/控制工作台等入口。`AppShell` 在测试中会被纯函数调用，顶层不要直接引入 runtime hook；桌面折叠导航应使用注册图标、aria/title 标签和 72px 窄栏，不再使用首字截断文本。

- 2026-06-12 `1-1` 标准互动课的当前路由是 `/interactive-learning/courses/unit-1-1-see-the-full-picture`，不再使用旧的 `unit-1-1-laplace-transfer-function` 记忆。作者态材料、互动契约和 acceptance 已齐备，manifest audit 已达到 15 steps、91 modules、0 issues；后续重点是严格实现契约注册和互动课程验收。

- 2026-06-12 数据治理与智能助教能力已经包含角色化诊断、学习证据 RAG、文档 rubric 批改、教师备课增强包、智能助教 demo、控制校正诊断画像、教师报告和评估 demo。Prisma 模型已包含 `DiagnosisReportSnapshot`、`CourseEnhancementPack`、路径执行/偏差/干预和证据 outbox 相关表。

- 2026-06-04 项目依赖链已完成大版本迁移，当前基线是 Next.js 16、React 19、Prisma 7、Tailwind CSS 4、Vercel AI SDK 6、Vitest 4、Playwright 1.60。构建链路需要先构建 `rust/control-engine` WASM，再执行 `prisma generate` 与 Next build。涉及 R3F/Three 的组件不能在 App Router SSR 入口顶层静态导入。

- 2026-06-04 综合仿真工作台成为互动学习核心入口之一。`/interactive-learning/control-workbench` 承载经典四视图、复合校正、预测控制、黑箱辨识和 Arena/workbench 路由。Arena 任务、控制工作台和虚拟仿真需要区分本地预演与官方评测。

- 2026-06-04 Arena 已从单页竞技入口扩展为对象、任务、允许方法、评测协议、榜单规则和教师发布报告的统一评测层。正式排名只消费服务端官方评测写入的 `ArenaSubmission`；`LearningFact` 中的 Arena 上下文只能作为辅助证据。

- 2026-06-04 子代理工作流已经迁移到项目级 `.codex/agents/*.toml` 与 `.codex/agents/README.md`、`ROUTING.md`、`HARNESS.md`。未获用户显式授权时，不要因为配置存在就启动子代理。

- 2026-06-04 OpenWolf 知识文件在多工作树间共享，派生工作树只链接长期知识文件，运行态文件保留本地。不要把派生工作树的 `.wolf/` 整体软链接到主工作树。

## 当前需要优先记住的运行事实

- 本项目基线分支是 `integration`，发布分支是 `main`。只说“提交”默认本地提交；明确“推送”才推送；明确“当前所有变动”才按整棵当前工作树处理。
- 主工作树主要用于 OpenSpec 提案生成和集成测试；在本工作树完成提案后，默认流程是先审核、提交并推送到 `integration`，之后再创建或登记 GitHub issue，避免 issue 指向未进入远端集成基线的本地工件。
- OpenSpec 校验默认使用 `rtk openspec validate --changes --strict`；仓库级 `--all` 可能混入旧债，不作为普通提案或实现的默认门槛。
- 新建或修复派生工作树时，优先使用 `scripts/dev/sync-local-worktree-config.sh`，并开启依赖安装、Prisma generate、Git hooks、CodeGraph/CRG 和 OpenWolf 知识链接等显式选项。
- 已经进入永久隔离工作树执行功能开发时，直接在该工作树完成 claim、实现、验证、提交和 PR，不要再嵌套创建临时隔离工作树。
- Tailwind/Turbopack 扫描边界只应覆盖业务代码与必要 helper，不能把系统环境配置、缓存或工作树运行态带入扫描。
- 处理控制校正 goal slice 时，目标归属必须来自显式 canonical scope，例如 `goalId`/`goal`/`targetGoal`/`learningGoal` 等于 `control-correction`，不要用中文“校正”或英文 `correction` 关键词猜测。
- 处理 1-1 内容链路时，`sync_runtime_knowledge.py --check` 的 legacy `concepts/*.mdx` 缺失不等于当前 1-1 authoring、runtime 或 manifest 未就绪。
- 生产和本地运行问题优先查 `.logs/`、端口监听、`/api/readyz`、Prisma generate、worker/scheduler 日志和容器状态，不要只看配置文件。
- Next dev 视觉证据和交互验收优先使用 `http://localhost:<port>`。当前环境中 `127.0.0.1:3001` 可能走代理路径，导致 HMR WebSocket 失败、客户端 hydration 不执行，进而把可收起导航或图谱加载误判为页面问题。

## 初始化后的建议下一跳

- 想快速了解项目现状：读 [10-project/10-current-state.md](10-project/10-current-state.md) 和 [docs/ProjectDescription.md](../ProjectDescription.md)。
- 要做 OpenSpec 提案或实现：先查 `openspec/changes/`、`openspec/specs/` 和相关 GitHub issue；使用 `rtk openspec validate --changes --strict`。
- 要继续 1-1 互动课程制作：先读 `course-content/authoring/lessons/1-1`、`course-content/runtime/lessons/1-1`、`src/lib/unit-1-1-course.ts` 和 `src/features/interactive/unit-1-1-see-the-full-picture/*`。
- 要改平台 UI 壳层：先读 `src/components/platform/*`、`src/lib/platform-role-navigation.ts` 和 `openspec/changes/archive/2026-06-12-harden-unified-ui-governance-gates/`。
- 要改 Arena 或控制工作台：先读 `src/features/arena/`、`src/features/control-workbench/`、`src/app/interactive-learning/control-workbench/page.tsx`。
- 要排查部署、依赖、启动或工作树环境：先读 [30-operations/00-index.md](30-operations/00-index.md) 和 `scripts/dev/sync-local-worktree-config.sh`。
