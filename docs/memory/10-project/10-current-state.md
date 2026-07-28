# 当前状态

状态: active
最后更新: 2026-07-18
摘要: 记录项目当前的重要现状，帮助跨会话快速回答“现在做到哪里了、最近重点在哪”；当前重点是已完成 OpenSpec 的验收归档、资源语义治理、知识图谱交互、互动课 runtime 和数据治理闭环。
上游:
- [00-overview.md](00-overview.md)
下游:
- [20-roadmap.md](20-roadmap.md)
相关:
- [docs/ProjectDescription.md](../../ProjectDescription.md)
- [../02-recent-summary.md](../02-recent-summary.md)
- [../30-operations/50-known-deploy-risks.md](../30-operations/50-known-deploy-risks.md)

## 当前高优先级现状

- 项目当前是 Next.js 16、React 19、Prisma 7、Tailwind CSS 4、Vercel AI SDK 6 的单体应用。依赖链已大版本迁移，后续新增功能必须留意 SSR、R3F、Prisma generate、Tailwind source 边界和测试脚本噪声。
- 基线分支为 `integration`，发布分支为 `main`。永久工作树本身就是隔离边界，不要在其中再为同一任务创建第二层临时 worktree；具体工作树授权以当前任务说明为准，不从旧文档推断可用工作树。
- OpenSpec/Buddy 仍是功能推进主线。2026-07-18 的 `openspec list --json` 中，知识图谱根节点与 inspector、评估检查点资源语义、教师审核与学生反馈闭环、互动课组件样式统一四项 change 都已完成任务，当前工作是验收和归档，不应继续沿用“二级导航视觉治理仍是主要 active change”的旧判断。
- 资源语义治理已经形成 fail-closed 的 readiness、审核跟踪和评估检查点权威边界；知识图谱已补齐根节点气泡布局、形状感知边界几何、请求清理归属和 inspector 持久化。后续改动应复用这些合同，不要恢复宽松回退或组件私有语义。
- 平台 UI 正在以 `AppShell`、角色导航、证据状态组件和页面族治理为统一壳层。`src/lib/platform-role-navigation.ts` 已经把课程、任务空间、数据中心、教师治理、Arena/控制工作台等入口纳入角色导航。`AppShell` 会被测试纯函数调用，顶层不要直接引入 runtime hook；折叠导航应渲染注册图标，不显示首字标签，相关视觉证据由 `appShellNavigationContract: collapsed-icon-rail` 治理字段约束。
- `1-1` 标准互动课已经完成首轮实现，路由为 `/interactive-learning/courses/unit-1-1-see-the-full-picture`。作者态材料、互动契约和 acceptance 已齐备，manifest audit 已达到 15 steps、91 modules、0 issues。当前剩余工程口径是把 `1-1` 纳入严格实现契约注册，避免新标准课被旧 migrated-lesson 语义遗漏。
- 互动学习入口以控制工作台、互动课程、跨域探索和互动组件为主。综合仿真工作台 `/interactive-learning/control-workbench` 已承载经典四视图、复合校正、预测控制、黑箱辨识等控制设计流，并与 Arena 路由和提交面板衔接。
- Arena 已形成对象、任务、允许方法、评测协议、榜单规则、教师发布和班级报告链路。正式排名以 `ArenaSubmission` 为准，不能用前端预览或 `LearningFact` 上下文替代官方提交。
- 数据治理从课堂事件回放推进到 session data quality、evidence source coverage、学生证据特征缓存、互动提交重算和报告指标口径。画像与报告排障必须分清原始事件、学习事实、特征缓存、快照和页面聚合。
- 控制校正学习路径和全课程智能助教已经从提案推进到 specs 与实现。当前稳定能力覆盖 goal slice registry、角色化诊断、学习证据 RAG、文档 rubric 批改、教师备课增强包、智能助教 demo、控制校正诊断画像、教师报告和评估 demo。
- Prisma 模型已经包含 `DiagnosisReportSnapshot`、`CourseEnhancementPack`、`LearningPathExecution`、`LearningPathDeviation`、`LearningPathIntervention`、`AIIntervention`、`LearningEvidenceDraft`、`EvidenceOutbox` 等与诊断、路径、证据和助教闭环相关的表。

## 近期已落地的关键事实

- `1-1` 不再应记为旧的 `unit-1-1-laplace-transfer-function`。当前课程定位是“看见系统全貌”，固定路由段是 `unit-1-1-see-the-full-picture`，运行态内容位于 `course-content/runtime/lessons/1-1`。
- `src/lib/unit-1-1-course.ts`、`src/lib/lesson-1-1-ai-contexts.ts`、`src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/page.tsx` 和 `src/features/interactive/unit-1-1-see-the-full-picture/*` 是当前 1-1 实现入口。
- `course-content/scripts/sync_runtime_knowledge.py --check` 当前会报告全局知识冲突以及旧式 `concepts/*.mdx` 缺失。对 `1-1` 来说，这不是作者态或 manifest 就绪失败，而是知识同步脚本仍含 legacy concept 路径预期。
- 平台 UI 重构系列已经把 Mission workspace shell、AppShell 折叠导航合同、学生二级路线壳层、知识图谱壳层、数据中心角色可见性、教师工作台、状态证据组件和角色导航推进到实现与归档阶段；这些既有治理合同仍是防止页面族回退的维护基线。
- `src/lib/ai/model-provider-compatibility.ts`、provider registry/settings 和 provider runtime smoke 组成当前模型供应商兼容边界。新增供应商时不要只改聊天接口，还要纳入兼容矩阵、配置和 smoke。
- 文档 rubric 批改工作台中，MarkItDown 只承担 PDF/Office 到 Markdown 的转换适配器职责；评分、教师审核、学生反馈、证据定位和画像回写需要平台契约与 UI 工作台。
- OpenWolf 多工作树共享采用“长期知识文件软链接、运行态本地化”的策略。不要把派生工作树的 `.wolf/` 整体软链接到主工作树。
- 子代理配置以 `.codex/agents/*.toml` 和 `.codex/agents/README.md`、`ROUTING.md`、`HARNESS.md` 为真源。没有用户显式授权时，不因为配置存在就启动子代理。

## 当前主要风险

- 旧记忆和旧路由仍可能把 `1-1` 指向 Laplace 课程或 legacy runtime；遇到 1-1 相关任务时，优先以当前 authoring/runtime、route 和实现文件为准。
- 当前主要风险不在未实现任务数量，而在已完成 change 尚未全部归档、旧文档仍把阶段计划写成现状，以及资源语义和知识图谱治理发生回退。判断状态时先核对 `openspec list --json`、任务文件和最终代码。
- 控制校正学习路径与全课程智能助教存在继承关系。后续设计应默认已有控制校正样例可复用，但不应复制其目标切片专用逻辑。
- `openspec list --json` 若出现已归档 change 的 `no-tasks` 幽灵项，通常是本地空目录残留；先查文件，再清理空目录，避免误判 active 状态。
- 当前 TypeScript 基线为零错误；代码提交和推送前必须通过项目 typecheck，不得把新增错误解释为既有债务。
- 生产运行问题不能只看配置文件。优先查 `.logs/`、端口监听、`/api/readyz`、worker/scheduler 日志、Prisma generate、容器和 systemd 状态。
- 本地 Next dev 交互证据优先用 `localhost` 而不是 `127.0.0.1`。在当前主机上，`127.0.0.1:3001` 可能经过代理路径，HMR WebSocket 失败且客户端 hydration 不执行；用它验收会误判 AppShell 收起按钮、主题按钮和知识图谱数据加载。

## 建议下一跳

- 做 OpenSpec 提案或实现：先查当前 change 列表、`openspec/specs/`、任务完成度和相关 issue；使用 `rtk openspec validate --changes --strict` 或对单个 change 做 strict validation。
- 改平台 UI 壳层：先读 `src/components/platform/*`、`src/lib/platform-role-navigation.ts` 和已归档的 `openspec/changes/archive/2026-06-12-harden-unified-ui-governance-gates/`，注意 `AppShell` 顶层 hook 边界。
- 改 `1-1` 或继续互动课制作：先读 `course-content/authoring/lessons/1-1`、`course-content/runtime/lessons/1-1`、`src/lib/unit-1-1-course.ts` 和 `src/features/interactive/unit-1-1-see-the-full-picture/*`。
- 改控制工作台或 Arena：先读 `src/features/control-workbench/`、`src/features/arena/` 和相关测试；注意官方评测与本地预演边界。
- 改数据治理或画像：先定位数据层级，明确原始事件、学习事实、特征缓存、快照和页面 DTO 各自职责。
- 改智能助教：先读已归档 specs、`src/lib/data-governance/*teaching*`、`*diagnosis*`、`*rubric*`、`*prep-pack*` 和 provider 兼容实现，不要把控灵聊天框当作唯一入口。
