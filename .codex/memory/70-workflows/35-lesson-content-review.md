# 课程内容审查流程

状态: active
最后更新: 2026-04-06
摘要: 记录 `lesson-content-review` 技能对应的稳定执行流程，覆盖讲义正文技术审查、`interactive-page.md` 与 `interactive-contract.yaml` 双轨互动设计审查、BOPPPS 覆盖检查、知识卡核对、代码直出媒体审核，以及 runtime `review/` 审查包与运行态讲义/PDF/媒体索引导出。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
- [30-content-update-flow.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/30-content-update-flow.md)
下游: []
相关:
- [../10-project/10-current-state.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/10-current-state.md)
- [../40-domain/10-lesson-framework.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/10-lesson-framework.md)

## 适用场景

- 新课准备进入互动课程实现前
- 既有课次只有 `authoring` 初稿，还没有 `runtime/review` 审查产物
- 需要确认讲义、教案、知识卡和代码直出图的技术正确性，但不打算重写文风

## 标准顺序

1. 读取 `course-content/authoring/lessons/<lesson>/manifest.json`，判断是理论课还是实践课
2. 所有课型都先审 `design/handout.md`，确认讲义本体中的核心概念、公式、图表、例题、结论完整、正确且可独立阅读
3. 所有课型都必须审 `design/interactive-page.md`，核对其是否把讲义核心内容逐项映射到具体页面，并检查 `静态承载内容` / `互动升级点` 是否完整；允许静态页，不要求每一步都互动
4. 若存在 `design/interactive-contract.yaml`，把它视为 `interactive-page.md` 的机读真源，对齐检查每一步是否具备 `layout / modules / content_blocks / interaction_spec / teacher_controls / telemetry_spec / teacher_insight_spec / ai_context_spec / preview_contract / acceptance_checks`，并确认默认预览入口是学生演示页而非教师模板弹窗
5. 若课型为实践，继续补审 `design/practice-guide.md` 与 `design/assessment-spec.md`（如存在），确认实践任务、提交物与评分边界与讲义、互动页一致
6. 再审 `design/boppps.md`，确认其覆盖正文核心知识点或实践任务，且阶段划分中的事实、公式和工程结论正确
7. 读取 `course-content/authoring/knowledge/cards/lessons/<lesson>/sequence.json`，核对 `groups[].node_ids`、`card_order` 与 `course-content/authoring/knowledge/cards/nodes/*.md`
8. 按 `design/multimedia.md` 补齐 `media/raw/*.py`，先生成到 `media/processed/` 审核，再导出 runtime
9. 若作者态已提供 `design/handout.pdf`，将其视为正式下载讲义源，要求 runtime 导出时同时保留 `handout.md` 在线阅读版与 `handout.pdf` 静态下载版
10. 运行 `python3 course-content/scripts/review_lesson_content.py --lesson <lesson>`，生成 `course-content/runtime/lessons/<lesson>/review/*`，并确保 `media/<lesson>-media.md` 被创建或按标准顺序规范化

## 修复边界

- 技术问题一律先回写 `course-content/authoring`
- 允许修公式、事实、例题计算、图片描述、知识卡缺失和媒体脚本错误
- 不主动润色文风，不把 runtime 当作唯一修补位置
- 旧课可继续依赖 `media/raw` fallback 导出，但新课默认应该走 `media/processed`
- runtime 媒体外链不应硬编码在前端页面；统一由 `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md` 提供
- `media/<lesson>-media.md` 允许人工补链；脚本只能规范文件名标题顺序并保留已有 URL，不应在导出时清空

## 运行后最少检查

- `course-content/runtime/lessons/<lesson>/review/review-report.md`
- `course-content/runtime/lessons/<lesson>/review/interactive-page-check.json`
- `course-content/runtime/lessons/<lesson>/review/knowledge-card-check.json`
- `course-content/runtime/lessons/<lesson>/review/multimedia-check.json`
- `course-content/runtime/lessons/<lesson>/review/source-manifest.json` 中是否显式记录 `interactive_contract_source`
- `interactive-page-check.json` 中 `missing_contract_fields` 是否为空、`step_contract_issues` 是否为 `0`
- `course-content/runtime/lessons/<lesson>/lesson.json` 中是否带 `review` 索引
- `course-content/runtime/lessons/<lesson>/handout.pdf` 是否存在，且 `lesson.json` 中已带 `handout_pdf_path`
- `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md` 是否存在，且 `lesson.json` 中已带 `media_index_path`

## 当前已验证样例

- `1-2` 已作为首个样例跑通，补齐了 10 张知识卡和 4 个代码直出 SVG
- `interactive-lesson-implementation` 现在默认消费 `runtime/review` 审查产物，不再在实现阶段顺手修改正文或知识卡
- `2-1` 暴露出“互动页未承接讲义核心内容、理论课未把 `interactive-page.md` 视为必审源”的链路失配；修订后，`interactive-page.md` 已提升为所有课型的主审对象之一
- `2-1` 现已建立互动设计 V2 双轨真源：人读 `interactive-page.md`，机读 `interactive-contract.yaml`；`review_lesson_content.py` 会把契约路径、必需字段、缺失字段、步骤级契约问题和 `interactive_contract_source` 一并导出到 runtime `review/`，并要求默认预览与学生页对齐
- `2-2` 现已作为第二个模块 2 主线样例完成 V2 双轨升级：`interactive-page.md` 既保留 `页面骨架 / 模块清单 / 埋点与教师数据 / AI 边界 / 预览口径`，也通过兼容性的 `步骤 xx / 静态承载内容 / 互动升级点` 标题满足当前审查脚本解析；`interactive-contract.yaml` 已被 runtime `review/` 正式识别，`missing_contract_fields`、`step_contract_issues`、`missing_target_steps` 均为 `0`
- `2-1` 入口页现已成为“runtime 媒体索引 + 静态 PDF 讲义下载”的首个消费样例：页面不再硬编码外链，而是统一读取 `course-content/runtime/lessons/2-1/media/2-1-media.md`；其中 `2-1-course.mp4` 作为主预习资源，`intro-video/audio/slides` 作为次级资源，`handout.md` 继续承担在线阅读，`handout.pdf` 负责直接下载
