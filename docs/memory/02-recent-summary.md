# 最近摘要

状态: active
最后更新: 2026-09-04
摘要: 生产图谱加载失败（#1942）已修复并合并（PR #1981）：生产分片指针已切到带 coverage 收据的 ads-294a0616…，图谱视觉验收通过；英文切换待含 Dockerfile 修复的镜像部署后验收（Issue 保持开放跟踪 4.2/4.3）。生产应用仍为 `v0.7.2-b5d3768`（main `b5d37686…`，部署期 remote-deploy 验证段修复 `050f8f9f7` 已回传 integration `a32e6d9ab`）。Wolfram Cloud 仍维护 503，远端 `.env.server` 保留 `SKIP_WOLFRAM_READY_CHECK=1`，Wolfram 恢复后删除该行即恢复完整门禁。开发者网关（runtime-dev）租约风暴超时已修复并上线。生产知识面维持 Authority v0.37；Runtime 仍为 `runtime-150a505a…`。
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
