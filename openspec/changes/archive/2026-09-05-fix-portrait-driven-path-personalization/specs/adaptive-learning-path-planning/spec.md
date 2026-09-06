## ADDED Requirements

### Requirement: Capability deficits require portrait evidence
能力类目标缺陷 SHALL 由可用的画像维度证据支撑；画像不可用或维度证据缺失时，规划器 SHALL NOT 把能力目标伪造成 0 分缺陷并据此生成个性化主张。

#### Scenario: Portrait unavailable yields honest no-evidence deficits
- **WHEN** 主画像状态为 `UNAVAILABLE`（如 `migration-in-progress`）或能力维度无证据
- **THEN** 规划器 SHALL 将能力类目标标注为「无画像证据」的降级状态
- **AND** SHALL NOT 输出以 0 分能力缺陷为内容的个性化推荐依据
- **AND** 候选路径 SHALL 呈现通用学习路线语义，不呈现与画像耦合的目标薄弱项主张。

#### Scenario: Available portrait drives cited personalization
- **WHEN** 主画像权威可读且包含能力维度或知识掌握证据
- **THEN** 每个候选路径的 `targetDeficits` 或 `recommendationProvenance` SHALL 至少引用一个具体能力维度、知识缺口或学习证据
- **AND** 推荐依据 SHALL 能解释画像中的问题与路径安排的对应关系
- **AND** 不同画像数据 SHALL 产生与其一致的目标薄弱项差异。
