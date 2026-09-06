## REMOVED Requirements

### Requirement: Graph Center exposes role-scoped actions
**Reason**: Graph Center 产品页面已退役，内部按钮投影没有生产消费者。
**Migration**: 使用 `/knowledge` 和既有角色业务页面；保留 Konling 和教师证据查询的数据契约，不保留旧 actions 字段。

### Requirement: Graph Center actions preserve read-only graph body semantics
**Reason**: 旧 Graph Center action builder 不再存在。
**Migration**: 既有路径、资源和证据查询继续遵守各自只读图谱、权限和引用契约。

### Requirement: Action access is accessible and mobile-safe
**Reason**: 旧 Graph Center 操作界面已退役。
**Migration**: `/knowledge` 与现有角色业务页面继续遵守自身可访问性要求，本变更不删除这些页面的操作。

## ADDED Requirements

### Requirement: Retained evidence consumers omit retired graph actions
The system SHALL retain the evidence and resource coverage consumed by Konling and teacher K/A/Q trace without constructing or exposing retired Graph Center action arrays.

#### Scenario: Existing evidence consumers build graph context
- **WHEN** Konling or an authorized teacher requests the existing graph evidence context
- **THEN** resource coverage, learner and class overlays, SAR evidence and limitations SHALL retain their existing semantics
- **AND** the internal payload SHALL omit the retired action arrays and their route construction
- **AND** authorization, redaction and small-population suppression SHALL remain enforced.
