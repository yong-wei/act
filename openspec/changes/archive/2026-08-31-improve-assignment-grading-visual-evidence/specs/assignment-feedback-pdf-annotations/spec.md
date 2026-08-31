## ADDED Requirements

### Requirement: 批改痕迹逐级形成
系统 MUST 将题目得分、文本化总评、分段评语、证据锚点和 PDF 页内批注作为可独立审核的渐进层级；后一级不得抹除前一级的确认版本。

#### Scenario: 只有题目得分已确认
- **WHEN** 教师仅确认题目得分和总评
- **THEN** 系统 MUST 可以发布该确认版本的允许结果，而不伪造分段或 PDF 批注

### Requirement: PDF 批注引用确认快照
教师审阅 PDF MUST 只从教师确认的评分、评语和证据锚点生成，并保存规范 PDF 与结果快照的版本和校验和。

#### Scenario: 生成精确页内批注
- **WHEN** 确认锚点具有有效页面和区域
- **THEN** 系统 MUST 在对应规范 PDF 位置生成可追溯的批注

#### Scenario: 锚点无法精确定位
- **WHEN** 确认锚点缺少有效区域或页面映射
- **THEN** 系统 MUST 按块、页的顺序退化定位并向教师显示退化原因

### Requirement: 学生结果保持发布隔离
学生 MUST 仅在教师确认并逐份发布后读取最终分数、确认后的评语、参考答案和评分标准；视觉处理内部描述、AI 草稿、Provider 信息和教师历史不得进入学生结果包。

#### Scenario: 未发布的审阅 PDF
- **WHEN** 教师尚未发布某学生的确认结果
- **THEN** 学生 MUST 无法读取该学生的审阅 PDF、批注或评分细节

### Requirement: Word 作业以规范 PDF 返回

学生上传 Word 作业时，系统 MUST 在转换成功后冻结其规范 PDF，并以该 PDF 作为教师批注和学生反馈的唯一文档载体。Markdown 仅用于保存经确认的批改内容和锚点语义，不得重新排版为学生可下载的作业正文，也不得以带批注 Word 代替最终结果。

#### Scenario: Word 作业完成确认并发布

- **WHEN** 学生 Word 作业的转换记录已成功生成规范 PDF，教师确认评分、评语和批注
- **THEN** 系统 MUST 对该冻结的规范 PDF 生成 `REVIEWED_PDF`，并在逐份发布后将该 PDF 返回给对应学生

#### Scenario: Word 作业缺少可校验的规范 PDF

- **WHEN** Word 作业没有已成功转换、对象键和校验和均完整的规范 PDF
- **THEN** 系统 MUST 阻断派生结果生成，并不得伪造 Markdown、Word 或 PDF 作为已批改作业

#### Scenario: Word 批注不能精确映射到 PDF 页内位置

- **WHEN** 经确认的 Markdown 锚点没有可验证的 PDF 页码和区域映射
- **THEN** 系统 MUST 保留原规范 PDF，并将批注附在结果 PDF 的汇总页中，同时记录定位退化原因
