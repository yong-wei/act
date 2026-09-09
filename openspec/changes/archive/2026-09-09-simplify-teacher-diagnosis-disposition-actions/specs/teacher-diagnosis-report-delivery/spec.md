## MODIFIED Requirements

### Requirement: Teaching actions use existing authorized destinations only

The teacher delivery surface SHALL offer student detail and preparation links only when the destination is server-authorized and already exists. The teacher delivery read SHALL NOT query or match teacher-registered teaching resources for findings and SHALL NOT generate remediation-resource entries. Opening a destination SHALL NOT create a preparation pack, remediation task, intervention, or assignment.

#### Scenario: Registered remediation resource exists

- **WHEN** a finding has a governed knowledge-node binding and an accessible registered teaching resource
- **THEN** the teacher delivery read SHALL NOT query or match that resource
- **AND** the findings disposition area SHALL NOT render a remediation-resource entry or an intervention marker for it.

#### Scenario: No registered resource exists

- **WHEN** no accessible registered resource is bound to the finding
- **THEN** the report SHALL NOT render a registered-remediation empty-state placeholder
- **AND** it SHALL NOT manufacture a link.

#### Scenario: Finding offers the preparation entry only

- **WHEN** a finding has a governed knowledge-node binding
- **THEN** the teacher MAY open the existing smart preparation workspace from that finding
- **AND** the delivery read SHALL NOT query teaching resources registered to the teacher.

## ADDED Requirements

### Requirement: Disposition action buttons carry distinct visual hierarchy

教师处置操作按钮 SHALL 呈现明确的默认、悬停、键盘聚焦、禁用与记录中状态。「待处理」SHALL 使用较深的警示色，「已完成处置」SHALL 使用较深的成功色，「已查看」与备课/学生详情入口 SHALL 使用清晰的主色或中性色。操作语义 SHALL NOT 只依赖颜色表达。打印输出 SHALL NOT 包含处置控件。

#### Scenario: Teacher scans disposition controls

- **WHEN** an authorized teacher opens the teacher delivery version
- **THEN** the disposition controls SHALL be visually stronger than the previous ghost styling and distinguishable from each other by tone and label
- **AND** each control SHALL expose visible hover, keyboard-focus, disabled, and recording states without losing its action semantics.

#### Scenario: Printing keeps excluding disposition controls

- **WHEN** the teacher prints the report deliverable
- **THEN** the print output SHALL NOT contain disposition buttons or delivery action links.
