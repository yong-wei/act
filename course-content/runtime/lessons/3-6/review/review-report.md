# 3-6 课程审查报告

## 审查范围
- 课型：实践
- `course-content/authoring/lessons/3-6/design/handout.md`
- `course-content/authoring/lessons/3-6/design/interactive-page.md`
- `course-content/authoring/lessons/3-6/design/boppps.md`

## 文本技术审查
- 未发现阻塞导出的公式配对问题。

## BOPPPS 对照
- 已将 `design/boppps.md` 作为 runtime/review 产物导出，供课程制作技能直接读取。

## 互动页覆盖审查
- 缺少“讲义核心内容映射”或“讲义证据单元映射”章节
- 讲义映射合同缺少列：handout_anchor, core_item_type, must_appear_content, target_step, page_mode, interaction_upgrade, media_or_table_ref, acceptance_note
- 以下步骤缺少“静态承载内容”：## 步骤 01｜封面导入：目标必须先于工具, ## 步骤 02｜回到地图：从 `3-5` 的机理走向 `3-6` 的设计, ## 步骤 03｜五任务设计链与提交物总览, ## 步骤 04｜前测：三类目标分别从哪里进入, ## 步骤 05｜任务书：统一对象、三类装置与五任务入口, ## 步骤 06｜推导显影 A：时域指标如何变成设计可行域, ## 步骤 07｜任务 A：`PD` 时域设计, ## 步骤 08｜任务 B 的证据板：测速反馈为何不是“换位置的 `PD`”, ## 步骤 09｜任务 B：测速反馈时域设计, ## 步骤 10｜推导显影 B：频域目标如何进入超前设计, ## 步骤 11｜任务 C：超前频域设计, ## 步骤 12｜推导显影 C：为何同一频域指标下还要再做一次 `PD`, ## 步骤 13｜任务 D：同指标下的 `PD` 频域设计与并排比较, ## 步骤 14｜任务 E：右半平面零点下的边界与结构选择, ## 步骤 15｜后测与收束：从指标走到结构选择
- interactive-contract.yaml 不是有效的 JSON/YAML 子集：Expecting value

## knowledge-card-check
- 知识卡片已全部存在，且均包含 `## 首页` / `## 详情` 基本结构。

## multimedia-check
- 已识别并确认存在 2 项正式媒体，未发现缺失。

## 导出结论
- authoring 已作为审查源保留；runtime 已输出 handout、media、review 索引，可直接供后续互动课程制作使用。
