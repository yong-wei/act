## Context

`recommendationProvenance` 已解释薄弱项和偏好是否落实。#1561 要求把生成时的画像事实、候选差异和用户可读解释绑到同一批次，避免事后用最新画像重写。

## Decisions

1. 在 policy bundle 与每条候选 snapshot 上写入 `decisionEvidence`，版本 `personalized-path-decision-evidence.v1`。
2. 快照只读复制 learner-state 投影、薄弱目标、偏好、版本标识；不存原始答案或用户标识。
3. 候选影响相对同批次其他路径计算：独有节点、提前节点、已落实/未落实偏好。政策族差异标为 `rule`，薄弱点/偏好标为 `profile`，证据不足标为 `degraded`。
4. 每条解释同时保存 `code` 与生成时 `studentText`。前端只渲染 `studentText`。
5. 候选批次 metadata 保存同一份 bundle 级证据，刷新只读查看不得重生成。

## Non-Goals

不改候选选择主算法，不把比较结果说成最佳路径。
