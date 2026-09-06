## MODIFIED Requirements

### Requirement: Learner-state no-data states are explicit
The Learner State Service SHALL distinguish an unavailable service from an available service with sparse or missing learner data, and SHALL 把主画像不可用（含 cutover fence 未满足、迁移进行中、协调待定）作为显式状态与原因暴露给路径生成与读接口，消费方 SHALL 能区分「画像可用」「暂不可用（含原因）」与「无证据」。

#### Scenario: New learner has no evidence
- **WHEN** learner-state is requested for a learner with no relevant evidence rows
- **THEN** the service SHALL return an explicit low-confidence or no-evidence state
- **AND** it SHALL NOT present missing evidence as a failed learner-state read.

#### Scenario: Learner has no active path
- **WHEN** learner-state is requested for a goal that has no active path for the learner
- **THEN** the service SHALL return an explicit no-active-path state
- **AND** consumers SHALL be able to distinguish it from path read failure.

#### Scenario: Portrait unavailable reason is surfaced
- **WHEN** 主画像因 fence 未满足返回 `migration-in-progress` 或 `reconciliation-pending`
- **THEN** learner-state 读结果 SHALL 保留 `UNAVAILABLE` 状态与具体原因
- **AND** 路径生成输入与学习状态接口 SHALL 透出该状态与原因，供页面呈现「当前无法个性化推荐」。

#### Scenario: Legacy compatibility vector is not personalized output
- **WHEN** 主画像不可用而 learner-state 保留旧快照兼容向量
- **THEN** 该向量 SHALL 仅作为非权威兼容输出存在
- **AND** SHALL NOT 进入能力缺陷推断、推荐依据或任何个性化主张。

### Requirement: Learner portrait state uses portrait v2 as primary model
主画像 SHALL 以 portrait v2 为权威（canonical seven-dimensional portrait v2 payload as the primary learner portrait）；cutover fence 的版本演进 SHALL 提供可验证的收敛路径，使部署环境能从迁移中状态收敛到可读状态。

#### Scenario: Portrait v2 state is read
- **WHEN** the learner-state service returns current portrait data
- **THEN** it SHALL include all seven portrait v2 dimensions with score, confidence, freshness, evidence counts, source lineage, and calculation version
- **AND** it SHALL identify any migrated legacy values with limitation metadata.

#### Scenario: Legacy portrait state exists
- **WHEN** only legacy six-dimensional snapshot data exists for a learner
- **THEN** the service MAY derive portrait v2 compatibility values
- **AND** it SHALL mark the result as migrated or compatibility-derived rather than native portrait v2 evidence.

#### Scenario: Calculation version evolution converges
- **WHEN** `PORTRAIT_V2_CALCULATION_VERSION` 演进导致 fence 版本不匹配、画像读取进入 `migration-in-progress`
- **THEN** 仓库 SHALL 提供可执行的迁移收尾验证（脚本或治理面板状态），证明 fence 已指向同版本 `APPLY + COMPLETED` run 且学生画像恢复可读
- **AND** 该验证 SHALL 纳入发布验收清单，避免画像长期停留在不可用。
