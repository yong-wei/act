## MODIFIED Requirements

### Requirement: Adaptive path center renders the approved generation interface
路径中心生成界面 SHALL 只在学生主动选择资源偏好时提交该偏好；默认态 SHALL NOT 以用户请求身份提交固定默认资源类型，并 SHALL 展示本次生成实际生效的偏好来源。

#### Scenario: Default panel does not submit resource preference
- **WHEN** 学生未通过面板切换或 URL 参数选择资源类型并直接生成
- **THEN** 生成请求体 SHALL NOT 携带 `resourcePreference`
- **AND** 面板默认提示仅作为展示态，不作为提交值。

#### Scenario: Generation result explains preference provenance
- **WHEN** 生成结果返回资源偏好来源（用户选择 / 画像推断 / 自然语言 / 系统默认）
- **THEN** 路径中心 SHALL 在生成结果或推荐依据区块展示来源说明
- **AND** 学生 SHALL 能区分自己主动选择的偏好与系统推断/默认的偏好。
