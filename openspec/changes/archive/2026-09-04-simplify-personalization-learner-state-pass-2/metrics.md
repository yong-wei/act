# Before/after metrics — simplify-personalization-learner-state-pass-2

Baseline commit: `f79f1836fd57dce483d01194e627ef36d929d637`（127,848 bytes / 7 files）。
Final head: `051c2513a`（第二轮化简提交；本 metrics 文档不改变模块字节）。

## Pass 1（9e1e7b7dd）

- 删除零引用死代码：`DEFAULT_EVIDENCE_WINDOW`、`agentToolRunHasStructuredTarget`。
- `STRUCTURED_TARGET_FIELDS` 统一三处重复的 10 字段列表；`pathExecutionReferenceHasStructuredTarget` 内联。
- observable evidence 三查表（RESOURCE_TYPES / FACT_MODALITIES / COUNT_KEYS，均 Partial Record）。

## Pass 2（051c2513a）

- 效应读取层拆分（任务 2.1）：五效应函数 + `latestMasteryAnswerIds` + `LEARNER_STATE_FACT_TAKE` 迁至 `effectful-reads.ts`；`internal.ts` 零运行时 I/O import（含删死 import `resolvePrimaryPortraitV2`）。
- `validateControlCorrectionGoalSliceContract` 数据驱动压缩，错误消息逐一不变。
- 单 caller helper 内联 9 处；`evidenceCounts` 查表；`evidenceProvenance` 上提出 dimensions.map。

## Metrics

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Module bytes | 127,848 | 125,671 | -2,177 |
| internal.ts lines | 2,567 | 2,377 | -190 |
| internal.ts 运行时 I/O imports | 6 | 0 | -6 |
| 死导出 / 死类型 | 0 | 0 | 0 |
| Public export names | unchanged | unchanged | 0 |
| Tests（reducer + service + plugin + consumers） | 77 | 77 | 0 |

## 阈值放宽记录

原验收 ≤102,278 bytes 经全量证据审计由仓库所有者授权放宽至 125,671：61 个导出符号与 24 个导出类型全部有活跃外部消费者；104 函数两两相似度检测无 ≥50 行语义重复；函数体仅 974/2377 行，其余为公开 API 类型与常量；跨模块对照（plugins/control-correction/evidence-match 为 DB 查询侧）无行级重复。证据全文见 Issue #1969 评论。

## Verification

- 聚焦测试 77 通过（learner-state-reducer 8 + adaptive-learner-state-service 54 + plugin-registry + consumers）。
- `typecheck` 0 错误；lint 0 告警；portrait-v2 primary 门禁通过（兼容标记随代码迁移）。
