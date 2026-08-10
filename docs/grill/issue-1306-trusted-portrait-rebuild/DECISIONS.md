# P0-02 可信 Portrait v2 重建：决策

## 1. 可信 LearningFact 如何判定

问题：现有 LearningFact 没有可信布尔字段，不能靠事后标记洗白历史事实。

结论：新增 `trusted-learning-fact-policy.v1`，用服务端证据锚点和受控来源特征判断：

- `sourceEventId` 为空的事实不可信。
- `sourceEventId` 以 `historical:`、`interaction-log:`、`yangfan-diagnostic-fixture:`、`backfill:`、`recompute:` 等非可信特征开头的事实不可信。
- `sourceLogId` 非空是服务端证据锚点；正式生产事件入口会剥离客户端伪造 `sourceLogId`，只替换为服务端持久化 InteractionLog id。
- `simulation-agent-evidence:` 必须同时带非空 `sourceLogId`。
- 受控服务端 producer 的明确前缀可增强判定，但不单独作为充分条件。

不新增数据库字段，不修改 LearningFact schema。

## 2. 过滤放在哪里

问题：只放在重建脚本会让后续增量物化重新吸收污染事实。

结论：过滤进入 `materializeIncrementalPortraitV2` 核心，在 `learningFact.findMany` 之后、`planMissingLearningFactUpserts` 之前执行。全量 rebuild、增量更新和 legacy compatible snapshot 路径共用同一过滤器。

`PortraitLearningFactDelta` 必须携带 `sourceEventId`、`sourceLogId`、`knowledgeRevisionRef`，累计状态序列化、校正重建和 clone 必须保留这些字段，否则 CORRECT 重建会丢失可信判定输入。

## 3. 如何触发历史重建与当前指针切换

问题：已有 Portrait v2 快照可能由污染事实生成，必须被替换。

结论：提升 `PORTRAIT_V2_CALCULATION_VERSION` 与 `PORTRAIT_V2_MIGRATION_VERSION`，通过 `requiresFullLearnerRebuild` 在物化时自动触发全量重建。保留旧快照和 LearningFact，不删除历史数据；当前指针由现有 `publishState` 原子更新。

## 4. 无可信事实时如何表达

问题：只有非可信历史事实的学生可能被重建为空。

结论：复用现有 `publishState` 发布 `NO_EVIDENCE` 状态，并写入明确的 `availabilityReason`。该状态是当前可信 Portrait 的有效结果，不是读取失败。

## 5. 路径规划如何 fail closed

问题：NO_EVIDENCE 时推荐引擎仍可能读取旧画像。

结论：可信 Portrait 仅指当前 cumulative SNAPSHOT 且至少一个维度有证据。NO_EVIDENCE 或无有效 Portrait 时，禁止回退到 legacy snapshot、feature cache、旧 StudentCompetencySnapshot、旧 competency vector。允许默认学习路径或非个性化路径，但禁止基于非可信能力画像生成个性化推荐。

## 6. 确定性如何定义

相同可信事实集、相同策略版本、相同计算版本和相同 asOf 下，`inputDigest` 与画像 payload digest 必须相同；重复执行不得产生新的逻辑当前状态。仅比较 createdAt 或快照 ID 没有意义。

## 7. 本次不做哪些事

- 不做完整 fact lineage 审计。
- 不做密码学证明。
- 不做全局 Portrait 消费方治理。
- 不扩大路径优化算法。
