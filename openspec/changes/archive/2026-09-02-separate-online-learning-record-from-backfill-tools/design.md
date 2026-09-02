## Context

当前修订为 `957f367026d6d247ef79df2be081debe5c40a617`。既有 Learning Record current projection/read port 与 course-evidence backfill 规范分别存在，但部分命令、worker、报告刷新和在线 consumer 仍共享 `data-governance` 实现入口。C5–C8 负责 writer/owner/ingestion 边界；本变更只处理 online 与历史操作的运行边界。

## Goals / Non-Goals

**Goals:**

- 使 online runtime 只读 qualified current projection，并明确其不得调用历史 backfill。
- 使 backfill/materialization/report regeneration 具备独立的 operation、权限、冻结输入、receipt、重放和清理生命周期。
- 删除已证明的旧生产入口，保留必要的历史审计和专用 migration/cutover 能力。
- 保持 append-only facts、immutable snapshots、watermark、privacy、Arena official authority 和现有 report semantics。

**Non-Goals:**

- 不执行或重放生产 backfill，不移动 current selector，不改变 projection 算法。
- 不删除历史 LearningFact、snapshot、transition、outbox 或报告。
- 不对 projection/read-model 做 code-simplification；纯行为保持简化属于 B change。

## Decisions

### 1. Separate runtime entrypoints and permissions

普通页面/API/AI/Personalization 只能调用现有 role-safe current read ports。历史命令和 worker 使用单独的显式入口、operation reference、授权范围与执行模式；在线服务账户不继承 backfill apply 或 raw artifact 权限。

### 2. Backfill operation is explicit and receipted

每次 backfill 绑定稳定 operation identity、目标 scope、source revision/capture revision、冻结 cutoff、input digest、dry-run/apply 状态、每条输入的 accepted/duplicate/invalid/retryable/terminal outcome 和最终 deletion/retention receipt。dry-run 不写任何 fact、snapshot、report、outbox 或 pointer。

### 3. Ordinary backfill cannot publish online state

普通 backfill 只能生成历史 enrichment/correction 及其 receipt；不得推进 online current pointer、live processing/state watermark、online trigger 或来源 anchor。已有 cumulative/cutover migration 若需激活，必须继续使用其独立 generation/fence/cutover contract，不能从普通工具继承权限。

### 4. Delete only the old production entry after denominator closure

先清点 command、worker、scheduler、route、page、report、test 和动态调用，再迁移到新入口。只有零生产 required caller、replacement parity、ACL/privacy、crash/retry 和 rollback 证据齐全，才删除旧生产 backfill/fallback registration；审计/历史入口保留为显式授权路径。

## Risks / Trade-offs

- [Risk] 同一脚本既被历史 operator 使用又被 online route import。→ 按入口和权限拆分，保留历史命令但禁止在线导入。
- [Risk] 额外 receipt 使旧 backfill 操作需要迁移。→ 先提供 dry-run 和兼容只读检查，apply 必须显式 operation identity。
- [Risk] 普通 backfill 与专用 cutover 规则混淆。→ 用独立 command/mode、generation/fence receipt 和负例测试分开证明。
- [Risk] 删除旧生产入口后遗漏动态 scheduler/job。→ caller denominator 同时覆盖脚本字符串、调度注册、worker 和运行态 canary。

## Migration Plan

1. 固定当前 HEAD 的 online/backfill caller denominator 和权限矩阵。
2. 实现/迁移独立 backfill command/worker contract，先运行 dry-run，再运行受授权 apply；保存 frozen input、digest 和 per-input receipt。
3. 将 online consumer 切换为 current read port，删除其 backfill/raw fallback 调用。
4. 在 parity、zero-caller、ACL、retention、crash/retry 和 rollback 验证通过后删除旧生产入口；不修改历史数据。

回滚只恢复旧入口代码或 qualified pointer，并保留 operation/deletion receipt；不得恢复 online 对 backfill apply 或 raw payload 的权限。

## Open Questions

- C5/C8 之后需确认每个 backfill command 的真实 worker、scheduler、report regeneration caller 和 retention profile。
- 需要将专用 cumulative migration 与普通 course evidence backfill 的允许 pointer 行为写入各自测试，而非通过共享 flag 推断。
