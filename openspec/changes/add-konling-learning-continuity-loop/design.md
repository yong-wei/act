## Context

控灵已经具备用户级会话、跨页面上下文、受治理学习状态读取和结构化工具调用，自适应评估也已经具备题目选择、作答持久化、判题及学习事实写入能力。当前缺口不是新的画像或路径算法，而是缺少一个在控灵打开时组合这些既有能力、选择单一承接状态并在新证据产生后继续反馈的产品闭环。

该变更横跨控灵面板、学生学习状态读取和自适应评估，但必须保持三个既有边界：学习状态由服务端拥有，错因只能来自结构化证据，陪伴练习不得改变学习路径。

## Goals / Non-Goals

**Goals:**

- 使用学生本人可访问的受治理数据生成可解释的学习承接快照。
- 按固定优先级呈现一个承接状态，并在同一次访问中去重。
- 通过现有评估链路完成一道针对性检查题，并让正式结果进入学情。
- 仅在新学习证据支持时生成闭环反馈。

**Non-Goals:**

- 不新增画像维度、错因推断模型或第二套学习事实体系。
- 不改变学习路径规划、生成、排序、选择或执行合同。
- 不引入虚拟形象、情绪识别或以鼓励话术为主的陪伴机制。
- 不把普通聊天声明、页面浏览或关闭提示写成学习证据。

## Decisions

### 1. 使用服务端学习承接快照作为唯一状态真源

服务端组合当前学生可访问的最近有效学习记录、未完成任务、最近结构化错因、薄弱知识点和已有建议行动，返回带稳定 snapshotId 与 evidenceAsOf 的承接快照。快照只允许三种状态：

1. unfinished_task：存在可继续的未完成任务；
2. recent_mistake：没有未完成任务，但存在最近有效错题；
3. cold_start：不存在可用于承接的历史记录。

状态选择严格按上述顺序执行，一次只返回一个状态。客户端提示只能帮助定位页面，不能声明用户、任务、错因或学习状态。

选择服务端组合而不是让对话模型自行检索，是为了保证用户隔离、状态优先级和无数据回退可测试。现有累计画像不按时间失效；“最近”表示按受治理证据发生顺序取得最新记录，并同时显示证据截至时间。

### 2. 将主动承接呈现为确定性的结构化卡片

控灵打开后在可见聊天区域前呈现结构化承接卡片，卡片内容由快照字段确定，不先调用模型生成自由文本，也不把卡片本身写成学习事实。只有学生选择重新讲解或开始复盘后，才进入现有控灵会话和工具运行链路。

平台壳层在当前访问的内存状态中按 snapshotId 记录已呈现快照。关闭并重新打开控灵时不重复显示；完整刷新或重新进入应用视为新的访问。新学习事实使 snapshotId 变化后，可以呈现更新后的承接或闭环反馈。

该方案避免为简单开场新增持久化提醒表，同时保留跨页面面板内的去重行为。

### 3. 三种状态使用受限动作

- unfinished_task 提供“继续学习”“重新讲解”“暂时跳过”。继续学习只进入原任务的既有入口；重新讲解将经授权的任务上下文交给现有控灵会话；暂时跳过只关闭本次卡片。
- recent_mistake 显示知识点、证据时间和可用的结构化错因，并提供一次单题复盘入口。
- cold_start 询问当前学习目标，继续使用现有控灵输入与目标处理能力。

任何动作都不得将暂时跳过写成任务完成，也不得自动选择、推进或修改学习路径。

### 4. 陪伴练习复用现有自适应评估链路

复盘入口使用现有评估题目目录与选题接口，按目标知识概念和可用结构化错因请求一道低风险检查题。题目、提交、判题和结果均走现有持久化合同；陪伴来源、承接快照、目标知识概念和错因记录身份写入现有不可变尝试元数据。

没有结构化错因时仍可说明存在错题，但不得补写原因。没有合格题目时显示明确的练习不可用状态，不允许控灵临时生成一题并绕过正式判题。

### 5. 闭环反馈由新的正式结果触发

只有评估最终结果或其他符合现有治理规则的新学习事实能够触发反馈。反馈比较本次结果与承接快照中的相关证据，输出：

- 本次结果直接证明的改善；
- 累计状态仍显示不稳定的知识点；
- 一项下一次陪伴练习建议。

单次正确只能表述为“本题已正确”或等价事实，除非累计状态已经支持稳定掌握。下一次练习是建议或新的陪伴练习入口，不修改学习路径。

### 6. 用户隔离、权限和幂等沿用现有合同

承接快照、任务入口、错题和评估尝试均以认证学生为作用域，并在服务端重新校验。单题创建和提交继续使用现有幂等标识；重复打开、网络重试或组件重渲染不得创建重复尝试或学习事实。

## Risks / Trade-offs

- [学习状态或任务状态在打开后变化] → 快照携带身份与证据截至时间，执行动作时重新校验当前任务和用户权限。
- [一句闭环反馈夸大掌握程度] → 使用结构化结果与累计状态模板，单次结果不提升为稳定掌握结论。
- [题库无法覆盖特定错因] → 显示明确不可用状态，保留讲解入口，不绕过正式评估链路。
- [频繁打开造成机械打扰] → 同一次访问按 snapshotId 去重，只有新证据产生后才更新。
- [功能边界侵入学习路径] → 路径仅作为未完成任务的只读来源，所有陪伴练习保持独立身份。

## Migration Plan

该能力以新增读取合同和新增界面状态接入，不回填历史消息，也不改写既有学习事实、评估尝试或学习路径。上线时先启用服务端快照与契约测试，再启用控灵卡片和评估入口。回滚时关闭卡片入口和快照读取，既有评估结果继续按原合同保留。

### Database rollout and rollback

`AdaptiveAssessmentSession.metadata` uses `JSONB NOT NULL DEFAULT '{}'`. Existing sessions require no backfill: the default represents an ordinary assessment session with no companion-practice provenance, while new companion sessions write the immutable `origin`, `snapshotId`, `targetKnowledgeId`, and optional `structuredCauseId` fields when the session is created.

The forward-compatible deployment order is migration first, then application code. Older application versions ignore the additional column, and the new application treats `{}` as an ordinary non-companion session. Rollback disables the continuity card and companion-practice entry before deploying the previous application version. The metadata column and any recorded provenance remain in place during rollback; they MUST NOT be dropped until the governed assessment retention window has elapsed or the provenance has been exported, because removing it would detach existing assessment results from their continuity source.

Per-visit deduplication remains application-memory state. Closing and reopening Konling or navigating between pages in the same application visit does not repeat an unchanged `snapshotId`; a full reload or a later application visit may present it again. A newly governed result changes the snapshot identity and may therefore produce one new presentation.

### Browser evidence provenance

The browser acceptance generator fails closed unless the declared full commit SHA equals `HEAD`, the tracked worktree is clean at capture start, and every declared runtime input has the same bytes as its Git blob at that revision. The local development service must expose the development-only revision probe and return the same commit, tree, source fingerprint, and clean state. During capture, only files below the Issue 1168 evidence output directory may change; the generator repeats local and runtime checks after every screenshot and immediately before and after writing the manifest.

## Open Questions

无。首版状态、数据边界、练习数量和路径隔离均已确认。
