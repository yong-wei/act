## ADDED Requirements

### Requirement: Path center surfaces personalization availability
路径中心 SHALL 呈现本次路径生成的个性化可用性：个性化推荐与通用路线明确区分，画像不可用时展示原因与恢复预期，不输出看似个性化的结果。

#### Scenario: Personalization unavailable banner
- **WHEN** 学习状态或生成结果指示主画像不可用（`UNAVAILABLE` 及原因）
- **THEN** 路径中心 SHALL 显示「当前无法个性化推荐」的明确提示及原因说明
- **AND** 候选路径 SHALL 以通用学习路线语义呈现，目标薄弱项区块 SHALL 表明缺少画像证据
- **AND** 页面 SHALL NOT 展示引用退化能力向量（全 0）的个性化推荐依据。

#### Scenario: Personalization available shows evidence linkage
- **WHEN** 主画像可用且候选路径引用具体维度、缺口或证据
- **THEN** 推荐依据区块 SHALL 呈现「画像问题 → 路径安排」的解释链
- **AND** 学生 SHALL 能看到候选之间目标薄弱项与其画像的一致关系。
