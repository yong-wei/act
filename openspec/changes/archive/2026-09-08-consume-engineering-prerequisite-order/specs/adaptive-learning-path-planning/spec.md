## ADDED Requirements

### Requirement: Planner ordering consumes adopted engineering learning order
路径规划 SHALL 消费经采用进入发布层的工程学习顺序边作为排序与就绪门控约束；路径解释与诊断 SHALL 区分「教学编排顺序」与「工程学习顺序」来源，使学生与教师能解释每条顺序约束的出处。

#### Scenario: Engineering order participates in ranking
- **WHEN** 某学习目标的节点集包含已采用的工程先后修边
- **THEN** 生成的路径顺序 SHALL 满足这些约束
- **AND** 路径解释 SHALL 标注各顺序约束来自教学编排还是工程学习顺序

#### Scenario: No adopted engineering edge exists
- **WHEN** 目标节点集中没有已采用的工程先后修边
- **THEN** 规划 SHALL 退化为仅教学编排约束
- **AND** 诊断 SHALL 如实显示工程学习顺序为零而非省略该维度
