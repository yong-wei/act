## ADDED Requirements

### Requirement: Production planning resolves engineering prerequisites into resource choices
生产 planLearningPath SHALL 在当前请求中消费工程学习先修。每个前驱知识点的多个绑定资源 SHALL 是替代候选；在资格过滤和排序之后，规划 SHALL 为未满足的前驱选择一个合适资源，递归解析依赖，再将确定资源身份交给既有 repair 与 assembly。各阶段 SHALL 使用同一请求级派生 registry。

#### Scenario: A prerequisite has multiple resources
- **WHEN** 前驱知识点与目标知识点各有多个合格绑定资源
- **THEN** 规划 SHALL 为未满足的前驱选择一个资源代表
- **AND** SHALL NOT 产生把全部资源都列为必修的笛卡尔依赖

#### Scenario: A shared resource covers multiple prerequisites
- **WHEN** 同一合格资源能覆盖多个所需前驱知识点
- **THEN** 规划 SHALL 允许该资源同时满足这些前驱，且不重复计入时间

#### Scenario: A dependency cannot be satisfied
- **WHEN** 依赖存在环、缺少合格前置资源或在预算中不可行
- **THEN** 规划 SHALL 返回明确限制或 fallback
- **AND** SHALL NOT 输出违反该依赖的 ready 路径

#### Scenario: A learner already completed the prerequisite
- **WHEN** 可信完成状态已满足该前驱知识点
- **THEN** 规划 SHALL 不重复插入学习资源，并保留完成依据

### Requirement: Path ordering explains original sources
路径证据 SHALL 保留工程 relation ID、snapshot 身份、方向和已选择资源的 binding。工程依赖与教学推荐 SHALL 以各自真实来源和强度解释。

#### Scenario: Engineering order is shown
- **WHEN** 一条已发布工程依赖影响实际生成顺序
- **THEN** 解释 SHALL 能追溯到该工程关系与对应资源选择
- **AND** SHALL NOT 声称其已经过不存在的 ACT_TEACHING 发布
