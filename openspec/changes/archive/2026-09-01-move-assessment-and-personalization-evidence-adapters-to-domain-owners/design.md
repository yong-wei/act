## Context

C1/C4 负责 Assessment 与 Personalization canonical owner 的前置收口，C5 负责核对当前 Learning Record writer。当前仓库仍可见 `src/lib/data-governance` 中按业务语义编排 Assessment、路径、推荐和微干预的代码；Assessment route/worker、Personalization reducer/path planner 和 Learning Record writer 因而存在交叉责任。

本变更是职责迁移，不是算法简化。迁移完成前不得删除仍有调用者的旧 adapter；迁移完成后再由 C8 处理 ingestion 的行为保持简化。

## Goals / Non-Goals

**Goals:**

- 让 Assessment 成为 attempt、scoring、review/provisional 状态及 assessment-to-evidence 适配的唯一业务 owner。
- 让 Personalization 成为 learner-state、path、recommendation/intervention 的证据组合、plugin 映射和 policy 适配 owner。
- 让两个 owner 通过 C5 已确认的 Learning Record read/write ports 交互，并保留 provenance、版本、幂等和隐私。
- 迁移真实调用者并删除或隔离旧 `data-governance` business adapter。

**Non-Goals:**

- 不重写评分、题库审核、路径排序、画像公式或干预资格。
- 不重建 Learning Record event contract、事实 schema、projection pointer 或 backfill 工具。
- 不删除仍被历史报告、课外功能或审计使用的表和只读兼容适配器。

## Decisions

### 1. Assessment owns assessment evidence semantics

Assessment public API 负责从认证上下文和 durable attempt snapshot 读取题目、评分、审核状态与结果，并在需要时请求 Learning Record writer。题目版本/hash、provisional/under-reviewed 限制和同事务写入由 Assessment 保持；`data-governance` 不再决定 assessment meaning。

候选方案是把所有证据继续集中到 data-governance，或把 Assessment 事件全部异步化。前者延续 owner 越界，后者会改变已验证的同事务语义，因此不采用。

### 2. Personalization owns evidence adaptation

Personalization application 层通过 Learning Record/Assessment read ports 获取规范化输入，由纯 reducer、path planner、registered plugin 和 intervention policy 组合。课程/目标具体映射留在插件；generic Learning Record 不识别 Assessment 题型或 control-correction 标识。

不允许 Personalization 直接读 Prisma/raw payload，也不允许 adapter 自己写第二份 fact、mastery、path 或 intervention 状态。

### 3. 迁移按调用者而不是按文件夹一次完成

先建立 C5 producer/consumer ledger，逐个迁移 route、worker、脚本和测试；每个 adapter 记录旧入口、新 public API、保留的只读例外和 deletion condition。只有静态导入、动态导入、运行时 canary、输出 parity 和 rollback 检查均通过，才移除旧导出。

### 4. 证据权限不随 owner 迁移扩大

新接口只传最小字段：opaque subject/scope、canonical refs、normalized result、confidence/coverage、source/revision/time、dedupe 和 governance receipt。原始答案、prompt、模型文本、教师私有数据及 Arena hidden internals 仍按既有 contract 隔离。

## Risks / Trade-offs

- [Risk] C1/C4 尚有旧调用者未完成迁移。→ 将它们设为硬依赖，未归档或未有 parity receipt 时 C6 不可执行。
- [Risk] 同一提交在 Assessment direct 与 worker outbox 双写。→ 复用 C5 的 stable identity/trigger 证明；保留一种 transport，不靠 unique constraint 掩盖双路径。
- [Risk] Personalization 迁移时把低置信度或预览输入提升为 mastery。→ 由 Assessment review/provisional 状态、Learning Record quality 和 plugin policy 共同门控，并添加负例测试。
- [Risk] 旧 `data-governance` 文件同时承载共享 read model。→ 删除前按导入/调用者和 capability 分类；共享稳定 port 保留，只有业务 adapter 移出。

## Migration Plan

1. 读取 C1/C4/C5 的最终 owner、调用者与 writer ledger，锁定本次迁移的精确 adapter 集合。
2. 在 Assessment 和 Personalization 各自的 public/application 层建立等价 adapter 入口，先保留旧调用者并比较结果。
3. 串行迁移 route、worker、脚本、报告与测试；验证认证 scope、幂等、重启、版本/锚点和错误状态。
4. 在零生产调用、parity、隐私和回滚证据成立后，删除旧业务 adapter 和仅为其服务的 re-export；历史只读路径单独登记。

回滚恢复旧实现入口或 qualified projection pointer，但不恢复第二个事实 writer、不改历史 LearningFact、Assessment 结果或 Personalization 状态。

## Open Questions

- C5 的 producer denominator 需要给出每个 `EvidenceOutbox`、Assessment micro-intervention 和 Personalization outbox 的最终消费者/lease 证据。
- C1/C4 的 canonical public API 名称以已归档实现为准；本 change 不新造平行 facade 来规避前置依赖。
