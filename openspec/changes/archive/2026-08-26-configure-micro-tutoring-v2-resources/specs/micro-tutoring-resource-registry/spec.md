## ADDED Requirements

### Requirement: v2 资源投影覆盖全部当前错误选项错因

系统 SHALL 从 `micro-tutoring-option-attributions-v2`（工件版本 `micro-tutoring-option-attributions.v3`）派生独立的 v2 资源投影文件 `micro-tutoring-resource-projection-v2.json`，版本为 `micro-tutoring-resource-projection.v2`。投影 MUST 覆盖该目录中每个唯一 `knowledgeNodeId` 与 `misconceptionTag` 对，使 v2 分母中每个错误选项都能解析到至少一个当前有效、学生可见、可启动的学习资源。v1 资源投影文件 `micro-tutoring-resource-projection.json` 与资格回执 MUST 保持只读历史兼容，不得被原地扩写。

#### Scenario: 当前 v2 错因都有合格资源

- **WHEN** 加载当前 v2 选项归因目录与资源投影
- **THEN** 每个唯一节点/错因对都有一条学生可见资源关系
- **AND** 每个 v2 错误选项都能解析到至少一个合格资源动作

#### Scenario: 资源授权撤销

- **WHEN** 匹配资源的学生可见性被撤销或 registry 身份不再有效
- **THEN** 编排器 SHALL 返回稳定不可用原因
- **AND** 不得继续创建可启动的学习任务
