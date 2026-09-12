# canonical-knowledge-learning-fact-identity Specification

## Purpose
Defines fixed-identity contracts for knowledge-scoped LearningFacts: complete Canonical/Projection/resource identity on new writes, teaching admission gates, no dual-write, and Legacy-bound historical facts resolved through immutable crosswalk at read time.
## Requirements
### Requirement: New facts carry complete Canonical knowledge identity
After a Projection-bound path or resource activity is active, every new knowledge-scoped LearningFact MUST persist `canonicalId`, `authorityReleaseId`, `projectionId`, and `resourceId` alongside existing evidence/source identity. The producer MUST reject candidate, missing, or cross-scope combinations. After production authority cutover, every knowledge-scoped learning fact MUST also atomically record Canonical Object ID, active aggregate ReleaseSet/Release identity, projection or knowledge revision, and its governed source identity.

#### Scenario: Projection-bound fact is accepted
- **WHEN** a learner completes an eligible projected resource under the current Authority/Projection combination
- **THEN** the fact SHALL persist all four identities and the resource role/scope

#### Scenario: Canonical fact is accepted
- **WHEN** an authorized producer submits a fact for the active Canonical authority
- **THEN** the fact SHALL persist all required knowledge and source identities in one transaction

#### Scenario: Resource identity is incomplete
- **WHEN** a writer lacks canonical, Authority, Projection, or resource identity
- **THEN** the write SHALL fail closed without a partial fact

#### Scenario: Knowledge version is incomplete
- **WHEN** Canonical ID, aggregate ReleaseSet/Release, projection, or revision is missing or inconsistent
- **THEN** the producer SHALL fail closed without creating a partial fact

### Requirement: Candidate knowledge cannot receive formal facts
Candidate ReleaseSets MUST be excluded from every formal learning-fact writer.

#### Scenario: Candidate-aware page triggers an event
- **WHEN** a user views or asks about a candidate Canonical Object
- **THEN** no formal knowledge-scoped learning fact SHALL be written from that candidate context

### Requirement: Canonical facts obey teaching admission gates
A new Canonical fact MUST target a node admitted by the active ACT Teaching Projection and an accessible resource/path scope, and MUST also be admitted by the active aggregate CourseCoverage and supported by a current aggregate resource or KAQ producer contract. ActKG visibility alone, a RECOMMENDED edge, or an unprojected node MUST NOT authorize a fact.

#### Scenario: Object is browsable but outside coverage
- **WHEN** a producer targets an imported object that is not admitted for the course
- **THEN** the write SHALL be rejected even though the object is visible in the authoritative graph

#### Scenario: Node is browsable but not projected
- **WHEN** a learner interacts with an engineering-only node lacking a current teaching resource
- **THEN** the formal knowledge fact write SHALL be rejected
- **AND** engineering browsing telemetry SHALL remain separate

### Requirement: Historical facts remain Legacy-bound
Historical LearningFacts MUST remain unchanged and MUST be interpreted through their stored Legacy revision/identity and an immutable old-ID-to-Canonical crosswalk at read time. This change MUST NOT perform full backfill or create a Canonical sidecar fact. The migration MUST preserve historical facts, portraits, diagnoses, risks, growth records, class aggregations, and completed paths under their original Legacy revisions.

#### Scenario: Historical fact is read after cutover
- **WHEN** a reader loads a fact without Projection identity from a prior revision
- **THEN** it SHALL resolve the display Canonical/resource context through crosswalk metadata
- **AND** the original fact bytes and authority revision SHALL remain unchanged

#### Scenario: Canonical authority activates
- **WHEN** the platform begins writing Canonical facts
- **THEN** existing historical records SHALL remain unchanged and SHALL NOT receive a Canonical sidecar

#### Scenario: Historical portrait is read
- **WHEN** a user views a pre-cutover result
- **THEN** the system SHALL interpret it through its Legacy snapshot or revision rather than the current Canonical graph

### Requirement: New facts are not dual-written
The system MUST NOT write both Legacy and Canonical knowledge identities for a post-cutover fact.

#### Scenario: Writer selector is switched
- **WHEN** the cutover transaction activates the Canonical writer boundary
- **THEN** all governed producers SHALL use only the Canonical identity contract

### Requirement: 微干预学习事实绑定完整 Canonical 与来源身份

微干预 evidence producer 在写入知识范围 LearningFact 前 MUST 原子核验并保存 active Canonical Object、Authority ReleaseSet/Release、Teaching Projection、resource/path scope、学习目标、规范节点、source answer、intervention、validation item/content 和 capture identity。候选知识、混合修订、缺失 admission 或部分身份 SHALL fail closed。

#### Scenario: 当前投影上的验证事实被接受

- **WHEN** 微干预验证属于当前 active Authority/Teaching Projection、已准入节点和受治理资源/评估 scope
- **THEN** producer SHALL 在一个事实中保存完整知识与来源 lineage
- **AND** 该事实 SHALL 由唯一 outcome/evidence identity 幂等约束

#### Scenario: 节点或投影 identity 漂移

- **WHEN** outcome 的规范节点、Authority Release、Projection 或 capture revision 与当前写入边界不一致
- **THEN** producer SHALL 拒绝正式 LearningFact
- **AND** 仅记录私有 drift/limitation 供审计

### Requirement: Historical fact identity audit inventory
系统 SHALL 对历史 LearningFact 的知识身份产出可审计清单，按账号区分「可确定回填/映射」「只能映射到 legacy」「无法确定」三类；审计报告 SHALL 包含输入、规则、执行 revision、前后计数摘要与异常记录，且为只读不可变输出。

#### Scenario: Audit classifies historical facts
- **WHEN** 对同时包含旧版、当前版与缺失身份事实的学生账号执行身份审计
- **THEN** 报告 SHALL 逐事实给出三分类归属与判定依据（serving 投影与 crosswalk 索引）
- **AND** 报告 SHALL 记录执行 revision、前后计数摘要与异常记录
- **AND** 审计 SHALL NOT 修改任何事实行

#### Scenario: Audit is repeatable
- **WHEN** 同一账号在数据未变化时重复执行审计
- **THEN** 两次报告的分类结果与计数摘要 SHALL 一致

### Requirement: Unrecoverable-identity facts are isolated idempotently
无法可靠恢复知识身份的事实 SHALL 被隔离到零权重上下文集合，不得参与要求当前版本可比性的高置信度个性化；隔离操作 SHALL 幂等且可审计——重复执行不产生新事实、不重复计数、不改变已确认来源，且 SHALL NOT 向历史行写入 CANONICAL 身份列。

#### Scenario: Isolation is idempotent
- **WHEN** 对同一账号重复执行身份隔离
- **THEN** 第二次执行 SHALL 不产生新事实、不重复计数、不改变已确认来源
- **AND** 治理记录 SHALL 以 append-only 形式保留每次执行的输入与结果

#### Scenario: Isolated facts stay out of high-confidence personalization
- **WHEN** 事实被判定无法确定身份并隔离
- **THEN** 该事实 SHALL NOT 被伪装成当前版本证据
- **AND** SHALL NOT 进入要求单版本可比性的高置信度推荐

#### Scenario: Isolation is recoverable
- **WHEN** 需要回退隔离操作
- **THEN** 系统 SHALL 能依据治理记录恢复隔离前状态
- **AND** 恢复路径 SHALL 随迁移前后数据质量报告一并交付

# Delta 说明：本 change 不修改「Historical facts remain Legacy-bound」的禁回填条款；任何 CANONICAL 回填须单独立项并先修订该条款。

