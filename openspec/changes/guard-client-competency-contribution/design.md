## Context

互动事件 API 接收的 payload 是不可信输入。当前 LearningFact 物化代码按照 payload、派生指标、事件类型静态映射的顺序解析能力贡献，随后 Portrait v2 直接消费已持久化的 `competencyContribution`。因此，客户端既能显式提供贡献，也能通过伪造带有静态映射的事件类型间接提升画像。

本变更不改变事件接收、InteractionLog、学生作答或学习事实的留存规则。服务端自适应测评在答案持久化、计分和 K/A/Q 治理核验完成后，仍需能够产生画像贡献。教师审核写回直接创建已审核事实，不经过该物化边界。

## Goals / Non-Goals

**Goals:**

- 默认拒绝 HTTP 互动事件进入 Portrait v2 的能力贡献。
- 保留客户端事件的作答、得分、时长、进度、上下文和可追溯性。
- 保留经过服务端核验的自适应测评贡献，以及教师审核贡献。
- 保持 HTTP API 与数据库结构兼容。

**Non-Goals:**

- 不识别、撤销或重建历史 LearningFact 与 Portrait v2 数据。
- 不修改教师审核、Arena 正式结果、仿真正式证据等直接服务端写入路径。
- 不以客户端 payload、事件类型或 `source` 字段表达信任等级。

## Decisions

### 在 LearningFact 物化边界采用内存授权标记

`learning-fact-materialization` 使用模块私有 `WeakSet` 保存获得能力贡献资格的 `LearningEvent` 对象。物化时，未被标记的事件始终写入空贡献；被标记的事件才调用既有贡献解析逻辑。

选择 `WeakSet` 是因为标记不属于可序列化数据，不能通过 HTTP payload 伪造，也不会改变 `LearningEvent`、HTTP 或数据库契约。仅删除 `payload.competencyContribution` 的读取不成立：攻击者仍可触发静态 `competencyMapping` 回退。使用 `source: 'system'`、事件类型或 payload 布尔标志也不成立：这些值可由客户端提交或在事件转换中携带。

### 仅在已核验测评完成后授予资格

自适应测评持久化路径在答案、计分、算法版本和 K/A/Q 治理条件全部满足后，构造并授权其内存事件，再调用 `persistCoreLearningFact`。授权函数只在服务端模块间传递内存对象，不在请求、响应或持久化数据中出现。

教师审核路径直接写入已审核事实，不调用客户端互动事件物化逻辑，保持现状。其他服务端直接物化路径也不因本变更改变。

### 以事实和 Portrait 两层断言验证阻断

物化层测试验证伪造贡献被清空且学习事实其他字段保留；Portrait v2 增量测试以该事实验证没有可应用证据和分数增量。自适应测评测试验证已授权事件仍保留有效贡献，教师审核路由测试回归其写回结果。

## Risks / Trade-offs

- [遗漏可信服务端调用点] → 仅为已审计的自适应测评调用点授予资格；任何遗漏会安全地降级为空贡献，并由回归测试暴露。
- [测试夹具默认构造普通事件] → 明确将未经授权的夹具断言为零贡献；可信测评夹具显式走授权路径。
- [历史污染仍影响画像] → 本变更只阻断新写入；历史审计、撤销和画像重建须在独立 Issue 中制定可验证的数据处置方案。

## Migration Plan

部署后无需数据库迁移。新客户端互动事件继续产生 LearningFact，但贡献为空；已核验服务端测评和教师审核结果按既有记录继续生效。回滚仅回退本次代码提交；本次代码不会修改历史记录。

## 审查修正

历史证据物化器只会在来源目录完成来源分类、真实性和资格判定后构造候选事实。该边界对服务端已核验来源采用显式白名单授权：`StudentStepResponse`、`SimulationLog`、`UserAnswer`、`AbilityAssessment`、`PromptAssessment`、`DesignSession` 与 `ArenaSubmission`。`InteractionLog` 是原始互动遥测，即使历史分类为 eligible 也不得获得能力贡献授权；它仍保留为可追溯的空贡献事实。

回填脚本通过同一 `buildHistoricalEvidenceMaterializationPlan` 生成和应用候选事实，因此无需新增脚本分支；上述授权规则会同时约束 dry-run 与 `--apply`。

## Open Questions

无。历史污染处理已明确排除在 Issue #1296 之外。
