# 2-1 课程审查报告

## 审查范围
- 课型：理论
- `course-content/authoring/lessons/2-1/design/2-1-handout.md`
- `course-content/authoring/lessons/2-1/design/2-1-interactive-page.md`
- `course-content/authoring/lessons/2-1/design/2-1-boppps.md`

## 文本技术审查
- `course-content/authoring/lessons/2-1/design/2-1-interactive-page.md`：发现疑似缺少 \right 的公式

## BOPPPS 对照
- 已将 `design/2-1-boppps.md` 作为 runtime/review 产物导出，供课程制作技能直接读取。

## 互动页覆盖审查
- 已检测到 `2-1` 的 V2 互动契约，步骤字段完整。
- 已检测到 `2-1` 的本地实现契约与作者态互动契约一致。
- 缺少“讲义核心内容映射”“讲义证据单元映射”或“证据单元升级决策表”章节
- 讲义映射合同缺少列：handout_anchor, core_item_type, must_appear_content, target_step, page_mode, interaction_upgrade, media_or_table_ref, acceptance_note
- 检测到旧版 runtime 审查产物但缺少新式互动设计/实现接受文件，当前按旧课兼容口径仅提示，不作为阻塞项。

## knowledge-card-check
- 知识卡片已全部存在，且均包含 `## 首页` / `## 详情` 基本结构。

## infograph-check
- 当前尚无已接受的知识点信息图。
- 尚缺信息图：微分方程_2_775c96a3, 拉氏变换工程动机_2_11001, 船舶航向控制对象_2_21004, 零初值传递函数_2_21001, 传递函数_1_5b0faf8b, 典型环节对象库_2_21002, 比例环节_2_11004, 积分环节_2_11005, 微分环节_2_11006, 惯性环节_2_11007, 振荡环节_5_d677d1e6, 结构图_2_3f312ccc, 闭环传递函数_2_5399c369, 信号流图_2_372d4084, 前向通路_1_7d1c792e, 回路_2_e1adbdfa, 余因子式_2_1da0d7e8, 梅森增益公式_2_419eab0c, 余子式接触判定_2_21003

## multimedia-check
- 已识别并确认存在 2 项正式媒体，未发现缺失。

## 导出结论
- authoring 已作为审查源保留；runtime 已输出 handout、media、review 索引，可直接供后续互动课程制作使用。
