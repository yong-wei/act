# assignment-visual-evidence Specification

## Purpose
TBD - created by archiving change improve-assignment-grading-visual-evidence. Update Purpose after archive.

## Requirements

### Requirement: 视觉证据具有版本化来源
系统 MUST 为每条视觉证据保存源资产或规范 PDF 校验和、页码或区域、题目归属、处理器与策略版本、描述、置信度、局限性和生成时间。

#### Scenario: 视觉内容被成功理解
- **WHEN** 视觉处理器返回通过完整性检查的描述和定位
- **THEN** 系统 MUST 创建可追溯至源资产与题目的版本化视觉证据

### Requirement: Word、PDF 和独立图片使用规范审阅表示
系统 MUST 将 Word、PDF 和独立图片关联到不可变的规范 PDF 或受控源资产表示，并验证题号、公式、页码和图像完整性。

#### Scenario: Word 内嵌图片映射到题目
- **WHEN** Word 转换提供题号、段落和页面锚点
- **THEN** 系统 MUST 仅在归属唯一时将内嵌图片关联到对应题目

#### Scenario: 视觉内容无法唯一归题
- **WHEN** 图像或页面内容无法确定唯一题目归属
- **THEN** 系统 MUST 将其标记为待复核而不是分配给任意题目

### Requirement: 外部视觉处理受策略约束
系统 MUST 在调用外部视觉 Provider 前验证脱敏确认、最小化数据投影、课堂范围、策略版本、保留期限和删除能力；任一条件缺失时不得调用 Provider。

#### Scenario: 外部处理策略完整
- **WHEN** 视觉资产符合已冻结的外部处理策略
- **THEN** 系统可以调用已批准 Provider，并记录处理器、策略和删除定位符

#### Scenario: 外部处理策略缺失
- **WHEN** 视觉资产没有完整的外部处理策略
- **THEN** 系统 MUST 不调用 Provider，并将视觉证据状态置为待复核

### Requirement: 视觉不确定性阻断自动结论
系统 MUST 将视觉描述缺失、冲突、低置信度、定位失效或处理失败标记为 `REVIEW_REQUIRED`；该题不得产出可教师确认的自动评分结论。

#### Scenario: 手绘图描述低置信度
- **WHEN** 视觉处理器返回低于冻结阈值的描述
- **THEN** 系统 MUST 阻断该题自动评分并提供重试或人工批改路径

### Requirement: 可信视觉描述进入题目证据
系统 MUST 仅将通过完整性检查的视觉描述以带来源锚点的证据块并入题目级规范 Markdown；评分模型不得直接获得原始作答文件或未受控视觉资产。

#### Scenario: 评分请求包含可信视觉证据
- **WHEN** 题目具有完整的视觉证据
- **THEN** 评分输入 MUST 包含该视觉描述块及其定位和局限性
