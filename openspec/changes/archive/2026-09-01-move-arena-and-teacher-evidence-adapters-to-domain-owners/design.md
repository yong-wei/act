## Context

C5 已确定 Learning Record 的唯一写边界。当前 Arena 的 `evidence-writeback-persistence.ts`、submission/evaluation 相关模块以及 Teacher 的诊断/报告模块仍与 `src/lib/data-governance` 中的 summary、materialization 和 class aggregation 交叉；前端或通用治理层可能因此重新计算 official validity 或跨班级读取事实。

本变更只迁移 Arena/Teacher 证据 adapter。Assignment、Assessment、Personalization 的 adapter 不在此变更中；C6 与 C8 通过依赖关系串行衔接。

## Goals / Non-Goals

**Goals:**

- Arena 是 official submission/evaluation 与 preview boundary 的唯一业务 owner，并通过既有 writer 请求 compact LearningFact/evidence。
- Teacher 是 class-scoped diagnosis/report/insight evidence read adapter 的唯一业务 owner，并从授权 read model 获取数据。
- 保留 official/preview 分离、Arena hidden internals、教师 class scope、small-sample suppression、provenance、版本和幂等。
- 迁移真实 route、worker、报告脚本和测试后，删除或隔离旧 data-governance business adapter。

**Non-Goals:**

- 不改 Arena evaluator、分数、排行榜、提交资格、Simulation 数值模型或 Teacher 报告内容规则。
- 不把预览、普通仿真、Agent narrative 或教师预览变成官方结果或学生任务完成。
- 不重建 Learning Record event contract、事实 schema、projection pointer 或 backfill authority。

## Decisions

### 1. Arena owns official evidence mapping

Arena submission/evaluation owner 从已持久化的 `ArenaSubmission` 和其受保护的 evaluation artifact 生成官方/预览 summary。官方分数、validity、hard constraints、leaderboard 和 hidden-scenario 边界均由 Arena 保持；Learning Record 只接收规范化辅助证据。

候选方案是让 data-governance 继续重算 official meaning，或让页面从 leaderboard markup 解析结果。两者都会复制权威；因此仅迁移 adapter，保留现有 server-side Arena authority。

### 2. Teacher owns class-scoped evidence reads

Teacher application/read API 根据认证教师与当前 class membership 读取 report/insight projection，并交付 coverage、freshness、provenance、independent learner count 与 suppression 状态。教师 adapter 不通过 raw event 重新组装学生画像，也不接受 URL/user/class hint 扩大范围。

### 3. Shared Learning Record ports remain the seam

Arena 和 Teacher 只使用 C5 确认的 Learning Record writer/read ports。Arena 同事务写回或 outbox 交付保持原 transport；Teacher 只读 current projection，不能为报告刷新直接写 LearningFact 或 current pointer。

### 4. Migrate by authority and preserve historical rows

逐一记录旧入口、新 owner、生产调用者、测试、backfill/audit 例外和删除条件。历史 Arena facts、报告和审计记录不迁移身份、不重算为新官方结果；旧 adapter 仅在 zero caller、parity、privacy 和 rollback 证据成立后删除。

## Risks / Trade-offs

- [Risk] Preview 与 official summary 在同一 model 中混用。→ 保留显式 `preview/official`、ineligible、submission reference 和 policy version，增加 promotion 负例。
- [Risk] Teacher route 通过学生 URL 或 class id 越权。→ 服务器派生 subject/class scope，class membership 与 small-sample 测试在 owner API 内闭合。
- [Risk] Arena outbox 重试产生双事实。→ 复用 C5 dedupe/anchor/trigger，测试并发和 crash-before-ack。
- [Risk] data-governance 文件同时承载共享投影。→ 只删除业务 adapter；稳定的 projection/read primitive 与历史审计入口保留并登记。

## Migration Plan

1. 导入 C5 的 writer denominator，锁定 Arena 与 Teacher adapter 的实际 caller、transport 和 deletion set。
2. 在 Arena/Teacher public/application 层建立等价 owner API，先运行新旧结果 parity。
3. 迁移官方评测写回、预览验证、profile/class insight、诊断报告、worker 和脚本，验证权限、幂等、版本和隐私。
4. 在所有生产调用者迁移后删除或隔离旧 adapter，并保存历史 rows 与审计权限。

回滚恢复旧业务入口或 qualified projection pointer，但不得允许预览升级为官方、跨班级读取、raw fallback 或重复写入。

## Open Questions

- C5 需确认 `EvidenceOutbox` 与 Arena/Teacher worker 的真实 consumer、lease、retry 和 terminal receipt；未闭合前不删除任何队列入口。
- Teacher diagnosis report 与 cumulative class projection 的最终 owner 需以调用图和现有 active change 为准；本设计不覆盖 Assignment grading adapter。
