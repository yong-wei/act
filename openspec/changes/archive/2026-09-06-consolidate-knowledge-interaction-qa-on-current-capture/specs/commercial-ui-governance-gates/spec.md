## MODIFIED Requirements

### Requirement: Knowledge graph interaction QA blocks jitter regressions
Commercial UI governance SHALL verify that knowledge graph hover, selection, inspector, and drag interactions do not create visible layout jitter. 当前校验 SHALL 复用现有产品 QA 的实际交互状态，删除对旧 #485 独立证据文件、固定初始版本与旧 harness 格式的依赖。

#### Scenario: Knowledge graph interaction evidence is captured
- **WHEN** governance validates `/knowledge` interaction states
- **THEN** evidence SHALL include hover preview, node selection, inspector open/close, user drag, and explicit relayout states
- **AND** the evidence SHALL prove that hover and selection do not trigger unintended graph redistribution.

#### Scenario: Jitter regression is detected
- **WHEN** pointer hover, node click, or inspector updates visibly reset layout, move unrelated nodes, or remount the graph surface
- **THEN** governance SHALL fail or report a blocking interaction-stability regression.

#### Scenario: Old evidence is absent but current observations are complete
- **WHEN** 旧 #485 文件缺失，而当前产品 QA 提供同模式、同次运行的完整有效交互观测
- **THEN** 交互校验 SHALL 根据当前观测决定结果
- **AND** 旧截图尺寸、初始布局版本或历史 harness 字段 SHALL NOT 成为失败原因

#### Scenario: Current observations are missing or fabricated
- **WHEN** 操作未执行、前后观测缺失、来源不一致，或只有硬编码成功布尔值
- **THEN** 当前交互校验 SHALL 失败
- **AND** 历史证据或跳过旧 reader SHALL NOT 代替实际行为验证
