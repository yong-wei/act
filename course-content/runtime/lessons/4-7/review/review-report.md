# 4-7 课程审查报告

## 审查范围
- 课型：实践
- `course-content/authoring/lessons/4-7/design/4-7-handout.md`
- `course-content/authoring/lessons/4-7/design/4-7-interactive-page.md`
- `course-content/authoring/lessons/4-7/design/4-7-boppps.md`

## 文本技术审查
- 未发现阻塞导出的公式配对问题。

## BOPPPS 对照
- 已将 `design/4-7-boppps.md` 作为 runtime/review 产物导出，供课程制作技能直接读取。

## 互动页覆盖审查
- 已检测到 `4-7` 的 V2 互动契约，步骤字段完整。
- 已检测到 `4-7` 的本地实现契约与作者态互动契约一致。
- manifest audit fail: 12 steps, 71 modules, 4 issues
- 互动设计接受文件已通过校验。
- 互动实现接受文件已通过校验。
- 以下 handout_anchor 未在讲义标题中命中：已有固定结构设计链, 基础知识回顾
- manifest 模块消费审计失败：{"content_block": "figure_requirements", "issue": "image_explanation_not_consumed", "step_id": "step-06"}
- manifest 模块消费审计失败：{"content_block": "figure_reading", "issue": "image_explanation_not_consumed", "step_id": "step-10"}
- manifest 模块消费审计失败：{"content_block": "formula_explanation", "issue": "image_explanation_not_consumed", "step_id": "step-10"}
- manifest 模块消费审计失败：{"content_block": "figure_explanations", "issue": "image_explanation_not_consumed", "step_id": "step-12"}

## knowledge-card-check
- 知识卡片已全部存在，且均包含 `## 首页` / `## 详情` 基本结构。

## infograph-check
- 已接受 10 张知识点信息图。

## multimedia-check
- 已识别并确认存在 2 项正式媒体，未发现缺失。

## 导出结论
- authoring 已作为审查源保留；runtime 已输出 handout、media、review 索引，可直接供后续互动课程制作使用。
