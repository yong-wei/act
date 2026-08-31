# 阶段 B V5 视觉证据运行交接

## 冻结身份

- 配置：`experiment-config:1a1777643ba053db080c75dc7c368d02`
- 调优批次：`experiment-batch:14940002de16a5daac4dc62115e1b487`
- 调优幂等键：`t2-formal-first-round-20260813-stage-b-v5-visual-tuning-force-completion`
- 隐藏幂等键：`t2-formal-first-round-20260813-stage-b-v5-visual-hidden-force-completion`
- 重试策略：`until-valid-result`

隐藏验收未启动，状态保持 `SEALED`。V5 只可继续同一批次；不得新建配置、批次或并发 worker。

## 已确认的问题与修复

普通转换失败会进入 `RETRYABLE`。原领取逻辑仅按创建时间排序，使最早的失败执行在无限重试策略下持续被领取，阻塞其余新任务。

`claim` 已调整为以下优先级：

1. `raw-output` 恢复；
2. `persistence` 恢复；
3. `QUEUED`；
4. 其余 `RETRYABLE`。

前两类必须优先，以保持已持久化评分草稿及迟到写入的围栏语义。此改动不改变评分模型、视觉策略、结构化输出契约或冻结配置。

## 验证与当前运行证据

- `teacher-ai-grading-lab-run-store.test.ts`：16/16 通过。
- `npm run typecheck`：通过。
- 相关差异格式检查：通过。
- 同一批次重启为单 worker 后，成功执行数由 25 增至 27，`QUEUED` 从 308 降至 305；当前领取为新任务的首轮尝试。
- 未出现终态评分失败。
- 后续聚合观察到 `visual-evidence-diagram-contradiction`；它处于 Provider 阶段的 `RETRYABLE` 状态，继续依既定策略重试。

继续监控时只能读取批次聚合、执行状态计数、视觉证据状态计数与安全错误码。遇到过期 `RUNNING` 租约时，先执行 `recover_stage_b_v5_expired_leases.ts`，再保留或恢复唯一 worker。全部 336 条调优执行成功后，才按既定授权启动一次性隐藏批次。

运行事件与安全错误分类见 `docs/operations/teacher-ai-grading-stage-b-v5-incident-2026-08-30.md`。
