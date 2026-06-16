# 自适应学习路径当前实现 Product Design 对照审计

日期: 2026-06-16
审计对象: `/assessment/adaptive-practice`
当前应用: `http://localhost:3001`
审计方式: Codex 内置 Browser 截图、DOM 摘要、设计 handoff 对照、实现代码核对

## 设计真源

期望设计说明:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`

期望视觉稿位置:

- 路径生成主界面: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`
- 路径选择与比较: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png`
- 当前路径执行: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png`
- 学习历史与证据记录: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png`

## 当前现状截图位置

- 默认生成页桌面: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/01-default-generation-desktop.png`
- 路径推荐页桌面: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/02-contextual-recommendation-desktop.png`
- 当前路径执行桌面: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/03-path-execution-desktop.png`
- 证据记录桌面: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/04-evidence-review-desktop.png`
- 路径推荐页移动端: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/05-contextual-recommendation-mobile.png`

## 步骤对照

### 1. 路径生成主界面

期望视觉稿:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`

当前截图:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/01-default-generation-desktop.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/02-contextual-recommendation-desktop.png`

健康度: weak

发现:

- 当前页面同时展示路径生成、目标选择、路径比较、练习入口和选择历史，没有形成清晰的生成主任务。
- 设计要求控灵生成面板包含可操作的学习目标、可用时间、难度节奏、资源偏好、检查节点、站外资源和自然语言输入；当前实现主要是只读参数摘要。
- 主按钮在捕获状态中为 `路径顾问准备中`，不是稳定可用的 `生成学习路径` 或 `请控灵生成路径`。

### 2. 路径选择与比较

期望视觉稿:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png`

当前截图:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/02-contextual-recommendation-desktop.png`

健康度: weak

发现:

- 当前实现包含预计时长、匹配资源、检查节点、适合场景、建议理由和预期结果，但位置过深，出现在生成概况和目标选择之后。
- 比较表格很密，资源标签和操作按钮被放在表格底部，弱化了路径本身的可读性。
- 设计中的核心是让学生在几条路线之间快速理解差异并选择；当前更像功能验收表，决策引导不足。

### 3. 当前路径执行

期望视觉稿:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png`

当前截图:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/03-path-execution-desktop.png`

健康度: partial

发现:

- 当前路径执行区域存在，包含当前节点、节点资源、学习动态和证据概览。
- 但该区域没有成为页面主状态，而是排在生成、目标选择和路径比较之后。
- 对学生而言，进入 `path-execution` 后仍要越过上游生成内容才能看到真正的当前路径，流程重点不清。

### 4. 学习历史与证据记录

期望视觉稿:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png`

当前截图:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/04-evidence-review-desktop.png`

健康度: partial

发现:

- 证据记录内容存在，能看到路径完成与证据、节点记录和学习动态。
- 但页面仍保留生成主界面、控灵参数、目标选择和路径比较，历史与证据不是独立主视图。
- Handoff 要求学生看到路径完成、回顾、继续互动、跳过和控灵干预如何影响后续推荐；当前证据内容可见，但层级被前置内容削弱。

### 5. 移动端路径推荐页

期望视觉稿:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png`

当前截图:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/05-contextual-recommendation-mobile.png`

健康度: poor

发现:

- 当前移动端是桌面长页面的窄屏堆叠版本，信息量过大，主要任务不突出。
- Handoff 要求移动端使用堆叠布局、底部面板、分段标签或纵向时间线，但当前没有形成任务优先的状态切换。
- 移动截图中首屏和后续内容都过密，不利于学生快速判断下一步。

## 汇总发现

1. 当前实现把四个设计状态折叠成一个长页面。
   - 设计应分为生成、选择、执行、历史四个主状态。
   - 当前页面把这些状态堆叠展示，导致流程不清。

2. 路径生成不是一个完整可操作的生成器。
   - 设计中的输入项和参数应能直接驱动生成。
   - 当前多为只读摘要，并依赖全局控灵入口。

3. 路径比较满足字段要求，但不满足决策体验要求。
   - 字段齐全不等于可用。
   - 当前比较区域视觉密度高，路径差异和主要操作不够突出。

4. 执行和历史视图没有成为独立主工作区。
   - `path-execution` 和 `evidence-review` 下仍保留上游生成/比较内容。
   - 这削弱了“当前节点”和“学习证据”的任务重心。

5. 移动端不符合 task-first。
   - 当前是全量信息纵向堆叠。
   - 应改为按当前任务组织的移动工作流。

6. 既有 QA 证据过度依赖结构标记。
   - 旧 QA 证明了截图存在、hash 绑定和标记通过。
   - 本次对照显示这些证据不能证明真实流程与视觉稿一致。

## 可访问性与审计限制

- 本次截图可以支持视觉层级、信息架构和流程问题判断。
- 本次没有声明完整 WCAG 合规性。
- Codex 内置 Browser 在连续捕获后崩溃；截图已成功保存，但后续交互没有继续展开。
- 首轮截图使用 Codex 内置 Browser；追加调查使用 Chrome 做了本地页面只读交互检查。Chrome 当前没有可接管的既有标签，且仓库未发现 `20230010102601` 的固定测试密码，因此该账号的个性化判断以数据库证据为准。
- 本次未修改业务代码。

## 建议修复方向

1. 将当前页面改为状态化工作区。
   - `contextual-recommendation`: 只聚焦生成与路径选择。
   - `path-execution`: 只聚焦当前学习路径、当前节点、节点详情和下一步。
   - `evidence-review`: 只聚焦历史、证据、回顾和继续互动。

2. 把控灵生成参数从只读摘要改为可编辑输入。
   - 学习目标、可用时间、难度节奏、资源偏好、检查节点、站外资源、自然语言输入应能形成一次生成请求。

3. 重做移动端为任务优先。
   - 首屏只保留当前任务、主要 CTA 和必要摘要。
   - 选择、路线图、证据记录使用分段视图或底部面板展开。

4. 升级 QA 门禁。
   - 不只校验 data marker 和截图 hash。
   - 需要按视觉稿逐项比对首屏层级、主操作、状态切换、移动端任务流和按钮可操作性。

## 追加调查: 路径生成可用性与学生状态匹配

调查时间: 2026-06-16

调查范围:

- 学生账号: `20230010102601`
- 页面: `/assessment/adaptive-practice`
- 目标: `control-correction`
- 数据表: `StudentEvidenceFeatureCache`、`LearningPath`、`LearningPathExecution`、`LearningPathDeviation`、`ArenaSubmission`、`AgentToolRun`
- 代码入口: `src/app/assessment/adaptive-practice/page.tsx`、`src/lib/adaptive-learning-path-planner.ts`、`src/lib/konling-agent-runtime.ts`、`src/lib/control-correction-resource-seed.ts`

关键证据:

- `20230010102601` 的证据缓存中 `controlModeling.score=0`、`parameterDesign.score=0`，对应证据数均为 0。
- 同一账号最新 `control-correction` 路径仍包含 `simulation:control-correction-step-response-lab` 与 `arena-task:task-second-order-lead-pid`。
- 该路径执行记录中，前测和仿真节点只有 `started` 或 `skip`，没有 `completedAt`，`simulationRef` 与 `arenaRef` 为空。
- 该账号存在一次 `ArenaSubmission`，但路径执行记录未绑定 `arenaRef`，路径闭环无法从执行记录判断 Arena 结果。
- 控灵 `generate_learning_path` 工具记录显示 `timeBudgetMinutes=null`、`difficultyRhythm=null`、`checkpointPreference=null`、`allowExternalResources=null`，页面没有把可调参数传入工具。
- 控灵工具默认资源偏好会回落到注册目标的 `starterPathPolicy.preferredResourceTypes`，控制校正目标默认包含 `simulation` 与 `arena_task`。

根因判断:

1. 规划器没有“能力阈值”概念。
   - `inferDeficits` 会把能力 0 转成高缺口。
   - `scoreNode` 会把高缺口转成较高收益。
   - `buildFeasiblePath` 只检查资源可见性、教师策略、设备、时间预算、前置节点链和终端节点位置。
   - 结果是能力越低，越可能被安排能提升该能力的重型节点，而不是先安排准备型节点。

2. 资源图只有节点前置关系，没有学生可执行性门槛。
   - 控制校正 Arena 只声明前置节点 `simulation:control-correction-step-response-lab`。
   - 仿真节点只声明前置节点 `registry:lesson09-correction-precheck`。
   - 没有声明 `minCompetency`、`readinessGate`、`unlockCondition` 或“建模/参数能力为 0 时禁止进入 Arena”的规则。

3. 页面生成区是静态摘要，不是表单。
   - Chrome 检查显示 `data-konling-generation-parameters="adaptive-path"` 区域内没有 `input`、`textarea` 或 `select`。
   - “告诉控灵你想达成什么”是 `span`，不是可输入控件。
   - 点击“请控灵生成路径”打开的是全局 AI 侧栏通用输入框，不是 Product Design 中的路径生成弹出面板。

4. 初始状态与目标状态割裂。
   - 未选目标时顶部“生成学习路径”只是跳转到 `#adaptive-path-generation-goals`。
   - 下方“生成该目标路径”只是进入 `?goal=control-correction&intent=contextual-recommendation`。
   - 进入目标后顶部按钮才切换成“请控灵生成路径”，当前路径区域同时出现，造成用户感知上的跳跃。

5. 预置路径只是假展示。
   - `buildAdaptivePathOptionDisplays([])` 会显示三条 starter 选项。
   - 这些 starter 选项没有 `writeOption`，因此“选择路径 / 调整 / 暂不采用 / 有帮助”按钮不可用。
   - 用户看到的不是可选预置路径，而是不可写的占位比较卡。

6. 多方案输出在低资源场景会退化成单路径。
   - `buildStudentSafePathOptions` 只有在 `policyBundle.status === 'ready'` 时才返回策略族多路径。
   - `low-resource-fallback` 时只返回 `recommended` 单一路径。
   - 这与“可比较方案”的视觉和文案不一致。

影响判断:

- 这是产品级路径生成闭环问题，不只是视觉偏差。
- 需要纳入 Product Design 重设计，并通过独立 OpenSpec 变更实现。
- 变更范围应覆盖设计交互、规划器可执行性约束、资源图元数据、控灵参数面板、路径执行结果绑定和页面状态机。
