# Runtime 输出契约

lesson 级运行时产物：
- `course-content/runtime/lessons/<lesson>/handout.md`
- `course-content/runtime/lessons/<lesson>/handout.pdf`
- `course-content/runtime/lessons/<lesson>/graph-overlay.json`
- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/media/*`
- `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md`
- `course-content/runtime/lessons/<lesson>/review/*`

其中 `review/` 至少包含：
- `boppps.md`
- `review-report.md`
- `interactive-page-check.json`
- `knowledge-card-check.json`
- `multimedia-check.json`
- `source-manifest.json`

其中 `interactive-page-check.json` 不再只是“页面覆盖是否完整”的轻量结果，而是互动页专项审查主合同，至少应承载以下三类信息：
- 设计稿与讲义映射检查：
  - `mapping_contract_mode`
  - `mapping_columns_present`
  - `missing_mapping_columns`
  - `invalid_handout_anchors`
  - `missing_target_steps`
  - `formula_mapping_issues`
  - `step_static_blocks_missing`
  - `step_upgrade_blocks_missing`
  - `step_reading_order_missing`
  - `curve_figure_steps_missing_mirror`
  - `curve_figure_steps_missing_contract`
- 机读契约检查：
  - `contract_required_fields`
  - `step_contract_issues`
- 本地实现契约与元件级检查：
  - `implementation_contract_source`
  - `implementation_contract_summary`
  - `implementation_contract_issues`

判定口径：
- 若 `implementation_contract_source` 非空，则视为该课已进入“设计稿 + 契约 + 本地实现”的三层审查模式
- `implementation_contract_issues` 非空时，不得把互动页审查标记为通过
- 曲线图、隐藏式 AI 页面上下文、主阅读顺序与图像控件位置等本轮互动课修订重点，都应通过该 JSON 的字段和问题列表可追踪地落盘

知识卡片运行时仍走全局目录：
- `course-content/runtime/knowledge/cards/nodes/*.md`
