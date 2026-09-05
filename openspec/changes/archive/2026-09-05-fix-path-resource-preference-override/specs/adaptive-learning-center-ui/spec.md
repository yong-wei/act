## MODIFIED Requirements

### Requirement: Adaptive path center renders the approved generation interface
The adaptive learning center SHALL render a generic path generation interface aligned with the accepted design handoff, and SHALL only submit resource preferences that the student actively selected while showing the provenance of the preference that actually took effect.

#### Scenario: Student opens path generation
- **WHEN** a student opens `/assessment/adaptive-practice`
- **THEN** the page SHALL identify itself as `自适应学习路径中心`
- **AND** the primary action SHALL be `生成学习路径`
- **AND** it SHALL show current goal, current node, learned time, estimated total time, weekly completion, and cold-start product language where applicable.

#### Scenario: Student configures path generation
- **WHEN** the generation panel is open
- **THEN** it SHALL offer learning goal, available time, difficulty rhythm, resource preference, checkpoint, external-resource, and natural-language input controls
- **AND** Konling SHALL remain the shared right-bottom floating dock rather than a page-local right rail.

#### Scenario: Default panel does not submit resource preference
- **WHEN** 学生未通过面板切换或 URL 参数选择资源类型并直接生成
- **THEN** 生成请求体 SHALL NOT 携带 `resourcePreference`
- **AND** 面板默认提示仅作为展示态，不作为提交值。

#### Scenario: Generation result explains preference provenance
- **WHEN** 生成结果返回资源偏好来源（用户选择 / 画像推断 / 自然语言 / 系统默认）
- **THEN** 路径中心 SHALL 在生成结果或推荐依据区块展示来源说明
- **AND** 学生 SHALL 能区分自己主动选择的偏好与系统推断/默认的偏好。
