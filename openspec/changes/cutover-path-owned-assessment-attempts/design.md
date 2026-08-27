## Context

当前 `src/app/api/assessment/next-question/route.ts` 和 `submit-answer/route.ts` 都在路由层读取并校验 path/node/goal；两者再调用 `src/features/assessment/adaptive-persistence.ts`。后者默认使用 Prisma，但在环境值为 `false` 时分别回到 `selectNextQuestion`、`submitAnswer`、`getAbilityReport` 和 `getDiagnostic` 的进程内实现。`src/features/assessment/adaptive-engine.ts` 的 `sessions`、`answersByUser` 和 `generatedQuestions` 均是 `globalThis` 上的 Map。

canonical `adaptive-assessment-persistence` 已要求 durable session、asked state、immutable item ref、幂等和并发写入；canonical catalog 已要求 path-owned 选择使用 reviewed、path-eligible item。这个 change 把已有要求落到一个可删除的 Assessment public boundary，不另起题库或掌握度模型。

## Goals / Non-Goals

**Goals:**

- 以 Assessment public API 作为 path-owned attempt 的唯一跨域入口。
- 将服务器身份解析、catalog selection、session/item snapshot、评分、mastery 和 LearningFact 写入闭合在可验证的 use case 中。
- 让重复请求返回同一 durable result，并在并发 next-question/submit-answer 下保持稳定 asked set、评分顺序和 evidence dedupe。
- 迁移所有真实调用者后物理删除 Map、flag fallback、重复 parser 和非权威旧入口。

**Non-Goals:**

- 不删除仍被作业、课堂或历史报表消费的 `Question`、`UserAnswer` 或其他旧 Prisma 表。
- 不改评分公式、BKT 参数、mastery 置信规则、catalog stage policy 或 LearningFact privacy contract。
- 不让客户端提交的 userId、pathId、nodeId、goalId 或答案快照覆盖服务端身份。
- 不把 generic practice 的低风险策略误升级为 path-owned readiness/checkpoint 资格。
- 不部署、不执行生产回填或生产激活。

## Decisions

### 1. 一个 Assessment public API 承载完整纵向链路

在 Assessment domain 提供稳定的 `selectNextPathQuestion`、`submitPathAnswer`、`readAttemptContext`、`readAbilityReport` 等公开 use case；route 只负责认证、基础输入 schema 和响应映射。use case 通过 `AssessmentCatalogReadPort`、`AssessmentAttemptRepository`、`LearningRecordWritePort` 和 `MasteryPolicyPort` 完成应用编排，Prisma/Next 只出现在 adapters。

候选路径、普通 assessment、companion practice 可以使用不同 policy，但都不能直接调用 `adaptive-engine` 的 Map。跨域消费者不导入 route、`adaptive-persistence` 内部函数或 Prisma model。

### 2. 路径上下文只由服务器派生

use case 接收 authenticated actor、session key 和请求中的候选引用，随后在事务边界按 `LearningPath.userId`、当前 node、不可变 `pathPayload`、goal、node type 和 catalog revision 解析唯一 `PathAssessmentRef`。客户端只提供选择动作和答案；任何 ref 不属于该学生、当前路径或评估节点都 fail closed。

`next-question` 的结果先写 session-level asked item ref，再返回去掉标准答案的学生安全题面。`submit-answer` 只接受属于该 session 的 item ref，从其 immutable snapshot 评分，并把 mastery/LearningFact 的 server-derived authority 一并提交。

### 3. 用不可变快照与幂等键抵抗重试和并发

session、asked history、`AdaptiveAssessmentItemRef`、answer、score/mastery update 和 LearningFact 各保留唯一 identity、algorithm/catalog revision、content hash、时间和来源。submit 使用稳定 action/dedupe key；已有同 identity 且输入一致时返回原结果，输入冲突返回 conflict。next-question 对 persisted asked set 使用乐观版本或事务重试，直到不重复或明确无候选。

评分和学习事实写入必须在同一可重试的事务/use-case 协议中完成；重复执行不能追加答案、掌握度更新或 LearningFact。掌握度只消费满足 canonical assessment authority 的结果，低置信/未审题不解锁重路径。

### 4. 以 adapter 迁移而非双写第二套模型

先把当前 Prisma 记录映射到 Assessment ports，历史 answer/ref 可读但不重新解释；保留旧 `Question`/`UserAnswer` adapters 仅供仍有消费者的域。新的 path-owned session、item ref 和 answer 只由新 use case 写入，禁止同时保留一份 Map authority 或新旧两套评分结果。

### 5. 删除条件先于删除实现

建立调用者清单覆盖 assessment routes、profile、adaptive practice、path execution、Konling companion、diagnosis 和 report。所有调用者改用 public API、直接相关测试通过后，才删除 `globalThis.__adaptiveAssessmentStore`、`isAdaptiveAssessmentPersistenceEnabled`、`*WithPersistenceFallback`、重复 path-context parser 及仅用于旧入口的 exports；不能留下 re-export facade。

## Risks / Trade-offs

- [并发请求产生两个 asked item] → 对 session asked-set 使用数据库版本/唯一约束和有限重试，失败返回可重试 conflict，不静默复用错误题。
- [历史答案缺少完整 catalog linkage] → 读取历史 snapshot 并显式标记 compatibility limitation；只有新 path-owned selection 才要求完整 reviewed catalog。
- [迁移遗漏调用者] → 用生产 import graph、route contract tests 和负向断言证明旧导出及 Map 无调用；遗漏时不删除入口。
- [LearningFact 与评分事务边界不一致] → 让 use case 持有唯一写入编排和 dedupe identity，失败关闭并保留可重试状态。
- [删除 flag 后旧环境配置误导排障] → 将 flag 视为退役台账条目并更新配置示例；代码不再读取它。

## Migration Plan

1. 冻结 change0 的 catalog/generation identity，完成当前路线、parser、Map、flag 和消费者 characterization。
2. 建立 ports/adapters 与 Assessment public use cases，先迁移 next-question 和 submit-answer 的 path-owned slice。
3. 迁移诊断、报告、profile、companion 和路径调用者，保持响应兼容和历史 snapshot 读取。
4. 删除旧 fallback/Map/parser，运行 Assessment domain、数据治理、路径集成、typecheck、strict validation 和 diff check。
5. 回滚仅回退代码 revision；历史 durable attempt、item ref、answer 和 LearningFact 不删除、不重写。生产部署与激活不在本 change 内。

## Open Questions

无。具体数据库唯一键和事务隔离级别应以当前 Prisma schema 与 adapter 能力为准，但不能降低服务器派生身份、幂等、并发和不可变快照不变量。
