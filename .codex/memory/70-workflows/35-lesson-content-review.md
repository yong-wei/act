# 课程内容审查流程

状态: active
最后更新: 2026-03-20
摘要: 记录 `lesson-content-review` 技能对应的稳定执行流程，覆盖正文技术审查、BOPPPS 覆盖检查、知识卡核对、代码直出媒体审核，以及 runtime `review/` 审查包导出。
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
2. 理论课先审 `design/handout.md`；实践课先审 `design/practice-guide.md` 与 `design/assessment-spec.md`
3. 再审 `design/boppps.md`，确认其覆盖正文核心知识点或实践任务，且阶段划分中的事实、公式和工程结论正确
4. 读取 `course-content/authoring/knowledge/cards/lessons/<lesson>/sequence.json`，核对 `groups[].node_ids`、`card_order` 与 `course-content/authoring/knowledge/cards/nodes/*.md`
5. 按 `design/multimedia.md` 补齐 `media/raw/*.py`，先生成到 `media/processed/` 审核，再导出 runtime
6. 运行 `python3 course-content/scripts/review_lesson_content.py --lesson <lesson>`，生成 `course-content/runtime/lessons/<lesson>/review/*`

## 修复边界

- 技术问题一律先回写 `course-content/authoring`
- 允许修公式、事实、例题计算、图片描述、知识卡缺失和媒体脚本错误
- 不主动润色文风，不把 runtime 当作唯一修补位置
- 旧课可继续依赖 `media/raw` fallback 导出，但新课默认应该走 `media/processed`

## 运行后最少检查

- `course-content/runtime/lessons/<lesson>/review/review-report.md`
- `course-content/runtime/lessons/<lesson>/review/knowledge-card-check.json`
- `course-content/runtime/lessons/<lesson>/review/multimedia-check.json`
- `course-content/runtime/lessons/<lesson>/lesson.json` 中是否带 `review` 索引

## 当前已验证样例

- `1-2` 已作为首个样例跑通，补齐了 10 张知识卡和 4 个代码直出 SVG
- `interactive-lesson-implementation` 现在默认消费 `runtime/review` 审查产物，不再在实现阶段顺手修改正文或知识卡
