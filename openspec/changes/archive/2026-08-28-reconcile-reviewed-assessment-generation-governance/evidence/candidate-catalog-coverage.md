# Candidate/catalog coverage ledger — generation governance pipeline

| 流水线阶段 | 实现 | 针对测试 |
| --- | --- | --- |
| generation envelope + truthful kind | `createGeneratedCandidate` / `buildGeneratedQuestion` / generate-question route | template 排除与 truthful kind；路由断言 `source !== 'ai_generated'` |
| deterministic precheck | `runGeneratedCandidatePrecheck`（九类检查） | 通过不自动批准；precheck-failed 不可审 |
| awaiting-human-review 状态 | `createGeneratedCandidate` 状态机 + append-only events | 序列化重启后身份保持；私有 prompt 不进公开摘要 |
| 独立人工审核 | `reviewGeneratedCandidate`（逐项 accept、强制 rationale、自审/模型审拒绝） | 逐项缺失拒绝；生成者与生成服务拒绝 |
| stale-on-content-change | `reviseGeneratedCandidate` → `markReviewsStale` | 内容变更使旧批准 stale 且不改写旧回执身份 |
| versioned catalog publication | `publishGeneratedCandidate`（当前批准 + 预检仍有效 + 发布者≠生成者） | 无批准不可发布；重复发布阻断；回执 hash 64 位 hex |
| publication receipt 回读 | `generated-candidate-persistence.ts` RepeatableRead 往返 + `trustedGeneratedReceipt` | persistence round-trip 回读 receipt 且 catalog 信任同一 receiptHash |
| catalog 集成与阶段资格 | `buildGeneratedItems`、`applyGeneratedCandidateStoreToRuntimeOverlay` | 无回执 provisional；断裂 lineage 不冻结 overlay；stale 后目录不可见 |
| 退役与回滚 | `retireGeneratedPublication` / `rollbackGeneratedPublication`（域函数） | retire 后历史回执保留；rollback 保留 receiptHash |
| 运行时题目解析（本 change 补齐） | `findGeneratedRuntimeQuestionById` + `getAdaptiveQuestionById` 回退 | published 项可作答且 identity 不变；未发布/模板内容不可解析 |
| 阶段政策对齐（复审整改） | `assessment-evidence-authority.ts`（receipt 条件化 + rubric 豁免）、`adaptive-assessment-semantic-review.ts`（generated 家族证据集）、`generated-candidate-catalog.ts`（完整 metadataVersionRefs） | 端到端：catalog 选择 published 生成项 → 运行时解析 → 作答；provisional 仍限 practice |
| 水合 fail-closed（复审整改） | `generated-catalog-runtime.ts`：torn 快照安装空就绪 overlay，禁止静态 sidecar 回退，lineage 恢复后自动重读 | torn hydration 后 published 项不可解析；完整 lineage 重读后恢复 |
| 历史答案不可变 | `adaptive-persistence.ts` answer-time snapshot（`catalogBacked` 分支） | adaptive-persistence 测试；`AdaptiveAssessmentItemRef` 绑定 catalogItemId/contentHash |

测试基线：`src/features/adaptive-assessment`、`src/features/assessment`、`src/lib/adaptive-planning` 共 33 文件 390 例通过（含本 change 新增 6 例）。全量 `vitest run`：9968 通过 / 21 失败，失败全部位于 actkg/authority/知识图谱/commercial-ui 等无关域，stash 整改前后同样失败，属本工作树既有债务，单列不掩盖。
