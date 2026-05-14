PR Review：Request changes

PR #5 的目标是把 Arena 从已有大厅和提交雏形推进为“竞技场选择挑战 → 工作台加载上下文 → ControllerArtifact → 官方评测 → 排行榜”的完整闭环。这个方向正确，现有 PR 也确实扩展了工作台上下文、模型能力矩阵、多表征接入、提交面板、评测协议和榜单服务等模块。PR 描述中的目标和改动范围见 PR body。

但当前实现仍有几个阻塞问题。

P1：工作台预评测使用的开环增益 K 没有进入官方提交工件

这个问题已有 Codex 自动 review 提出，我同意它应作为阻塞项处理。现有多表征模型会把 gain 放进 baseRequestInput，参与工作台分析请求；也就是说学生在工作台中调节的 K 会影响预评测曲线和指标。 但 ArenaSubmitPanel 构造提交工件时只把 arenaContext.task 和 correctionState 传给 buildArenaArtifactFromMultiRepresentationState，没有传入当前 gain。 buildArenaArtifactFromMultiRepresentationState 的输入类型也确实只有 task、correctionState、now，没有 gain 字段。

后果是：学生在工作台中优化的是包含 K 的方案，但提交到 /api/arena/evaluate 的官方工件丢失了 K，排行榜成绩可能和工作台预评测不一致。这个问题已经在 PR 评论中被标为 P1。

建议修复方式二选一：

在 Arena challenge mode 下禁用独立开环增益 K，只允许通过控制器工件改变控制效果；
或把 gain 显式传入 ArenaSubmitPanel 和 buildArenaArtifactFromMultiRepresentationState，并定义其进入官方工件的规则。

如果选择方案 2，建议：

buildArenaArtifactFromMultiRepresentationState({
  task,
  correctionState,
  gain,
})

对于 PID，可以明确 gain 是否等价于整体控制器比例放大；对于串联校正，应将 K 和校正器增益统一进入 serial-compensator.params.gain，避免出现“工作台 K + 校正器 gain”双重但不可复现的语义。

P1：无效 arenaTask 只显示错误头，但仍继续渲染默认工作台

PR 目标中明确写了：arenaTask 加载失败不能回退默认模型。当前实现没有完全做到。

page-client.tsx 在 model.arenaContextMissing 时确实显示了“挑战上下文加载失败”的错误头，但随后仍继续渲染 ParameterDrawer、图表区、控制分析结果和浮动参数按钮。 同时 model.ts 在 arenaTaskId 无法解析出 arenaContext 时，会继续构造 openLoopSeed，并用 effectiveSeed = arenaSeed ?? openLoopSeed 进入默认分析逻辑。

这意味着：

/interactive-learning/multi-representation-linkage?arenaTask=bad-id

页面会显示错误提示，但下方仍可能出现默认模型图表和参数抽屉。这实际上仍然是“回退默认模型”。

建议修复：

if (model.arenaContextMissing) {
  return <ArenaChallengeContextError ... />;
}

或者在 useMultiRepresentationLinkageModel 内部返回一个强错误态，并让 UI 早退，不再启动 useControlEngine。

P1/P2：whitebox-v2 协议名已经升级，但官方白箱评测仍然走旧的启发式估算

PR 新增了 protocol.ts，把所有非黑箱任务协议版本设为 whitebox-v2。 但 evaluateArenaSubmission 仍然直接分发到 evaluateWhiteBoxSubmission。 当前 evaluateWhiteBoxSubmission 内部仍然调用 estimateMetrics(object.model, controller)，而 estimateMetrics 是基于 controller summary 的启发式指标估算，并不是从 ControlAnalysisResult 提取真实响应指标。

PR 新增了 WhiteBoxMetricProvider、controller-to-analysis-request.ts、metric-extraction.ts、metric-profile-evaluator.ts，但这些模块并没有接入官方白箱评测主链路。createHeuristicWhiteBoxMetricProvider 也只是继续包装 estimateMetrics。

这会造成两个问题：

协议版本从 whitebox-v1 变成 whitebox-v2，旧缓存会失效，但结果口径并没有真正升级；
PR 描述中的“白箱评测协议重构”容易被误解为官方评测已使用控制分析结果，实际仍然是旧启发式评测。

建议：

如果本 PR 只完成接口抽象，不完成真实评测接入：
  protocolVersion 不应直接升级为 whitebox-v2，或者命名为 heuristic-whitebox-v2。

如果本 PR 声称完成 whitebox-v2：
  evaluateWhiteBoxSubmission 必须接入 metric provider / analysis adapter / metric profile evaluator。

更合理的是：

getArenaEvaluationProtocolVersion(taskId, method)

而不是只按对象是否黑箱区分。PID/串联校正、复合校正、MPC、优化 PID 的评测口径不同，不应都使用同一个 whitebox-v2。

P2：多表征工作台没有拒绝不兼容的有效 arenaTask

resolveArenaWorkbenchContext 会对任意合法 taskId 返回上下文，包括黑箱任务、奥德赛任务、预测控制任务等。 但多表征工作台自身没有检查：

arenaContext.recommendedWorkspaceMode === 'multi-representation-linkage'

也没有检查：

capabilities.supportsRootLocus && capabilities.supportsBode && capabilities.hasTransferFunction

结果是，用户如果手动访问：

/interactive-learning/multi-representation-linkage?arenaTask=task-cruise-roll-blackbox-identification

上下文能解析成功，但该对象没有 model 和 workbenchSeed。当前 model.ts 会让 arenaSeed 为 null，arenaPlant 为 undefined，然后继续回落到 openLoopSeed。 这会出现“页面标题是黑箱任务，但图表实际是默认模型”的错误状态。

建议在多表征入口处加硬门槛：

const isSupportedByMultiRepresentation =
  context.recommendedWorkspaceMode === 'multi-representation-linkage'
  && context.capabilities.hasTransferFunction
  && context.capabilities.supportsRootLocus
  && context.capabilities.supportsBode;

if (!isSupportedByMultiRepresentation) {
  return <UnsupportedWorkbenchForTask ... />;
}

这比“解析出上下文后继续默认模型”安全得多。

P2：基础模型选择面板的自由探索模式目前基本不可用

PR 新增了 ArenaModelSelectorPanel，但 page-client.tsx 只在 model.arenaContext 存在时渲染它。 这意味着真正的自由探索入口，即没有 arenaTask 的多表征工作台，不会显示这个模型选择面板。

即使进入了 ArenaModelSelectorPanel 的 unlocked 分支，也没有实际接入 onSelectObject；page-client.tsx 传入该组件时没有传 onSelectObject。 因此兼容模型按钮点击后不会改变模型。

此外，不兼容对象的跳转链接目前被硬编码为：

getArenaWorkspaceHref({ id: 'task-cruise-roll-blackbox-identification', workspaceMode: 'black-box-identification' } as any)

也就是说，所有不兼容对象都会跳到邮轮黑箱辨识任务，而不是跳到该对象自己的推荐工作台。

建议：

自由探索模式也渲染模型选择面板；
给 ArenaModelSelectorPanel 接入 onSelectObject；
不兼容对象应根据对象关联任务或推荐工作台生成跳转，不能硬编码到 task-cruise-roll-blackbox-identification；
不要使用 as any 构造假的 ChallengeTask。
P2：Arena barrel 混合导出领域逻辑、评测逻辑和 client component，后续会增加边界风险

src/features/arena/index.ts 现在同时导出领域类型、评测器、持久化、教师配置、工作台工具、ArenaModelSelectorPanel client component、artifact mapper 和 plant adapter。

这对当前 PR 可能还能 build，但长期不稳。原因是：

1. server route 可能从 @/features/arena 引入 client component；
2. client hook 可能从 @/features/arena 引入评测/持久化相关模块；
3. tree-shaking 之外，模块边界会越来越模糊；
4. 后续一旦某个被 re-export 的模块引入 Prisma、fs、BullMQ 或 Node API，client bundle 可能出问题。

建议拆分 barrel：

src/features/arena/domain.ts       // types, seed selectors, capabilities, context
src/features/arena/client.ts       // telemetry, client panels
src/features/arena/server.ts       // evaluator, persistence, prisma store, adapters

至少不要从主 index.ts 导出 ArenaModelSelectorPanel 这类 'use client' 组件。

P3：新增 .claude/settings.json 不应随业务 PR 合入，除非项目明确接受

本 PR 新增 .claude/settings.json，其中配置了 SessionStart、PostToolUse、Edit/Write/Bash hooks，会在本地执行 code-review-graph status/update/build 等命令。

这类本地 agent 配置会影响开发者工作站行为，不属于 Arena V2 业务改造本身。建议：

1. 从本 PR 移除；
2. 或移动到模板/说明文档，例如 docs/agent-config.md；
3. 或明确项目所有维护者都接受该 hook 行为。

它不是安全漏洞，但不应混在 Arena 功能 PR 中。

其他观察

PR 声称 “Arena 单元测试 14 文件，136 全部通过；Lint 零警告；Build 通过”。我检查到 PR 当前有 GitHub Actions CI run，但我查看时该 run 仍在进行中，Build step 尚未结束。这个不等于失败，只是不能用 PR body 的本地描述替代远端 CI 状态。合并前应以 GitHub Actions 最终结果为准。

建议处理顺序

我建议先修以下 4 个问题，再考虑合并：

修复 P1：把 Arena 工作台中的 gain 进入官方提交工件，或禁用 Arena challenge mode 的独立 K；
修复 P1：arenaContextMissing 必须早退，不得继续渲染默认模型；
修复 P1/P2：明确 whitebox-v2 是否真的接入 ControlAnalysisResult；若没有，不要用 whitebox-v2 表示真实评测升级；
修复 P2：多表征工作台必须拒绝不兼容的合法 Arena task，不能让黑箱/奥德赛/MPC 任务在多表征页回退默认模型。

其余如模型选择面板、barrel 边界、.claude/settings.json 可以在同一轮修，也可以拆后续小 PR，但前 4 个会直接影响 Arena 闭环可信度。

可复制到 PR 的简短 Review 版本
Request changes.

总体方向正确，但当前实现仍有几个会影响 Arena 官方闭环可信度的问题：

1. [P1] 多表征工作台预评测使用的开环增益 K 没有进入官方提交工件。学生调 K 后看到的预评测和 /api/arena/evaluate 的排行榜成绩会不一致。需要把 gain 传入 artifact mapper，或在 Arena challenge mode 禁用独立 K。

2. [P1] arenaTask 无效时页面只显示错误头，但仍继续渲染 ParameterDrawer 和默认图表，相当于仍回退默认模型。应在 arenaContextMissing 时早退，不启动默认模型分析。

3. [P1/P2] 协议版本已升级为 whitebox-v2，但 official evaluateWhiteBoxSubmission 仍调用 estimateMetrics，新增 metric provider / analysis request / metric extraction 没有接入官方评测主链路。要么接入真实评测，要么不要用 whitebox-v2 表示协议升级。

4. [P2] 多表征工作台没有拒绝合法但不兼容的 arenaTask。手动传入黑箱或非多表征任务时会解析上下文，但由于没有 model/workbenchSeed 又回退到默认模型。应检查 workspaceMode 和 capabilities。

5. [P2] ArenaModelSelectorPanel 的自由探索模式当前未实际接入：无 arenaContext 时不渲染，兼容模型按钮没有 onSelectObject，不兼容对象还硬编码跳到 task-cruise-roll-blackbox-identification。

6. [P3] .claude/settings.json 是本地 agent hook 配置，不应和 Arena 业务 PR 混合提交，除非项目明确接受该工作站行为。

建议先修 1-4 再合并。

PR #5 已确认是实际代码变更，范围含 24 个提交、49 个文件，并夹带 session/data-governance 改动。初步发现白箱 v2 未接入新指标链，且无效 arenaTask 仍可能落回默认工作台。