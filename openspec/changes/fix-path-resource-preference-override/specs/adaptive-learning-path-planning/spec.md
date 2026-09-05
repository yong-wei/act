## ADDED Requirements

### Requirement: Resource preference resolution has explicit source priority
路径生成的资源偏好 SHALL 按显式来源优先级解析：用户显式选择（request）→ 画像推断（profile）→ 自然语言意图（intent）→ 系统默认（system-default），且生成结果 SHALL 标明实际生效来源。

#### Scenario: No explicit selection defers to portrait preference
- **WHEN** 生成请求不携带资源偏好且 learner-state 资源偏好特征达到证据门槛
- **THEN** 规划器 SHALL 使用画像推断的资源偏好
- **AND** 生成结果 SHALL 标注偏好来源为画像推断
- **AND** 对应资源类型在候选路径资源组合中的优先级 SHALL 可观察地提升。

#### Scenario: Portrait unavailable falls through to system default
- **WHEN** 生成请求不携带资源偏好且画像不可用或偏好特征未达门槛
- **THEN** 规划器 SHALL 使用注册 goal 的系统默认资源类型
- **AND** 生成结果 SHALL 标注偏好来源为系统默认，SHALL NOT 将默认值呈现为用户或画像选择。

#### Scenario: Explicit selection overrides portrait
- **WHEN** 学生通过面板切换或 URL 参数显式选择资源类型后生成
- **THEN** 显式选择 SHALL 覆盖画像偏好与系统默认
- **AND** 生成结果 SHALL 标注偏好来源为用户选择。

#### Scenario: Preference change alters path resource mix
- **WHEN** 同一学生在画像偏好（如视频/讲义）与无偏好下落两种状态下分别生成候选路径
- **THEN** 两组候选路径的资源组合 SHALL 存在与偏好对应的差异
- **AND** 差异 SHALL 在推荐依据中可解释。
