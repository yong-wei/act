## Why

Issue #2014：教师班级页把已完成画像治理的学生误标为未覆盖（本地测试班级 121/121 显示为 82/121）。根因是 `src/features/learning-record/consumers/ports.ts` 的 `readLatestGovernedFactAt` 直接按 `LearningFact.startedAt` 取最新记录，未结合 `LearnerFactTransition` 的最终有效操作排除已撤销（REVOKE）事实；39 条时间晚于画像证据截止的已撤销学习事实被当作较新有效事实，触发 `markStale(..., 'newer-learning-fact')`，教师班级洞察只统计 `qualified` 学生，导致覆盖人数误降。

## What Changes

- `readLatestGovernedFactAt` 先按 `LearnerFactTransition` 按 factId 取最大 sequence 判定每个事实的最终操作，最终为 REVOKE 的事实从「最新治理事实」查询中排除；时间较新的已撤销事实不再触发画像过期。
- 保留既有保护：真正较新的有效事实仍触发 `newer-learning-fact`；处理水位领先（processing ahead of state）仍触发过期。
- db 注入缺少 `learnerFactTransition` 时保持既有行为（无可撤销信息即不排除），兼容现有消费者 mock 与最小 db 面。
- 教师班级页、学生清单、班级分析与诊断读取共用同一 ports helper，修复自动覆盖全部消费方。

## Capabilities

### New Capabilities

- `learning-fact-revocation-awareness`：治理事实撤销感知——已撤销事实不得触发画像过期，较新有效事实与水位领先保护保持不变。

### Modified Capabilities

无。

## Impact

- `src/features/learning-record/consumers/ports.ts`（`readLatestGovernedFactAt` 新增 transition 过滤）。
- `src/features/learning-record/consumers/__tests__/consumers.test.ts` 增补撤销/有效/混合场景。
- 不改变 `LearnerFactTransition` 模型、画像计算、教师洞察接口契约与其它数据治理规则。
