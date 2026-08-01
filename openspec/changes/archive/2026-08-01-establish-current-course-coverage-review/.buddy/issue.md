<!-- openspec-buddy change_id: establish-current-course-coverage-review -->

## Goal

从最新已接纳 Aggregate 生成当前 CourseCoverage worklist 和确定性审核批次 manifest，为后续逐批审核建立真实分母与调度边界。

## Scope

- 生成 `N_current` 完整 worklist、证据边界和 assembly receipt。
- 历史决定只保留为 prior references。
- 冻结互斥、无遗漏的 review-batch manifest；不执行批次内最终决定。

## Acceptance

- [ ] AC1 当前候选的每个可审核 Canonical 对象恰好出现一次。
- [ ] AC2 worklist 与批次 manifest 可确定性重生且绑定同一候选身份。
- [ ] AC3 批次并集等于 `N_current`、交集为空，profile-only 和强化复核策略没有遗漏。
- [ ] AC4 漂移失败关闭，Coverage 和生产 selector 保持不变。

## Evidence

- OpenSpec strict validation、定向测试、typecheck、worklist/manifest/assembly receipts。

## Reviewer Check

- 独立审核须核对 AC1–AC4，并确认后续 B1..Bn 只能由当前 manifest 产生。
