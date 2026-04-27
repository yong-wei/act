# 4-3 课程审查报告

## 审查范围
- 课型：实践
- `course-content/authoring/lessons/4-3/design/handout.md`
- `course-content/authoring/lessons/4-3/design/interactive-page.md`
- `course-content/authoring/lessons/4-3/design/boppps.md`

## 文本技术审查
- 未发现阻塞导出的公式配对问题。

## BOPPPS 对照
- 已将 `design/boppps.md` 作为 runtime/review 产物导出，供课程制作技能直接读取。

## 互动页覆盖审查
- 已检测到 `4-3` 的 V2 互动契约，步骤字段完整。
- 已检测到 `4-3` 的本地实现契约与作者态互动契约一致。
- manifest audit fail: 14 steps, 43 modules, 19 issues
- 互动设计接受文件已通过校验。
- 互动实现接受文件已通过校验。
- manifest 模块消费审计失败：{"diagnostic": "empty_required_content_module", "is_empty": true, "issue": "empty_required_content_module", "kind": "summary-card", "module_id": "responsibility-summary", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-04"}
- manifest 模块消费审计失败：{"diagnostic": "empty_required_content_module", "is_empty": true, "issue": "empty_required_content_module", "kind": "formula-card", "module_id": "pi-lead-formula", "renderer_owner": "content", "resolved_content_source": "implicit:key_formulas_by_formula_card_order", "resolved_content_type": "formula", "step_id": "step-05"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "rust-analysis-panel", "module_id": "pi-lead-native-panel", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-05"}
- manifest 模块消费审计失败：{"diagnostic": "empty_required_content_module", "is_empty": true, "issue": "empty_required_content_module", "kind": "formula-card", "module_id": "lag-lead-formula", "renderer_owner": "content", "resolved_content_source": "implicit:key_formulas_by_formula_card_order", "resolved_content_type": "formula", "step_id": "step-06"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "rust-analysis-panel", "module_id": "lag-lead-native-panel", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-06"}
- manifest 模块消费审计失败：{"diagnostic": "empty_required_content_module", "is_empty": true, "issue": "empty_required_content_module", "kind": "formula-card", "module_id": "pid-filter-formula", "renderer_owner": "content", "resolved_content_source": "implicit:key_formulas_by_formula_card_order", "resolved_content_type": "formula", "step_id": "step-07"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "rust-analysis-panel", "module_id": "pid-filter-native-panel", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-07"}
- manifest 模块消费审计失败：{"diagnostic": "empty_required_content_module", "is_empty": true, "issue": "empty_required_content_module", "kind": "step-reveal-chain", "module_id": "heading-derivation", "renderer_owner": "content", "resolved_content_source": "content_blocks.reveal_layers", "resolved_content_type": "reveal", "step_id": "step-09"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "rust-analysis-panel", "module_id": "heading-validation-panel", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-10"}
- manifest 模块消费审计失败：{"diagnostic": "empty_required_content_module", "is_empty": true, "issue": "empty_required_content_module", "kind": "step-reveal-chain", "module_id": "mini-reveal", "renderer_owner": "content", "resolved_content_source": "content_blocks.reveal_layers", "resolved_content_type": "reveal", "step_id": "step-11"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "template-card", "module_id": "analysis-template", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-12"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "template-card", "module_id": "scheme-template", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-12"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "template-card", "module_id": "issue-template", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-12"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "figure-note", "module_id": "roll-structure-note", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "image", "step_id": "step-13"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "rust-time-compare-panel", "module_id": "roll-native-time-compare", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-13"}
- manifest 模块消费审计失败：{"diagnostic": "missing_shared_content_renderer", "is_empty": true, "issue": "missing_shared_content_renderer", "kind": "rust-bode-compare-panel", "module_id": "roll-native-bode-compare", "renderer_owner": "content", "resolved_content_source": "unresolved", "resolved_content_type": "summary", "step_id": "step-13"}
- manifest 模块消费审计失败：{"issue": "activity_prompt_repeated_in_content_blocks", "prompt": "对象已有积分时，为什么不一定先补低频能力。", "step_id": "step-14"}
- manifest 模块消费审计失败：{"issue": "activity_prompt_repeated_in_content_blocks", "prompt": "参数方向至少应包含哪三项内容。", "step_id": "step-14"}
- manifest 模块消费审计失败：{"issue": "activity_prompt_repeated_in_content_blocks", "prompt": "首轮验证为何必须同时写收益、代价和下一轮优先项。", "step_id": "step-14"}

## knowledge-card-check
- 知识卡片已全部存在，且均包含 `## 首页` / `## 详情` 基本结构。

## multimedia-check
- 已识别并确认存在 2 项正式媒体，未发现缺失。

## 导出结论
- authoring 已作为审查源保留；runtime 已输出 handout、media、review 索引，可直接供后续互动课程制作使用。
