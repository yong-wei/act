# 3-4 剩余产物执行计划

**目标**：以现有 `3-4` 学生版讲义为基线收口，继续完成教师版讲义、双 PDF、知识图谱与卡片编排、BOPPPS、互动页、多媒体说明和项目文档更新。

**当前基线**

- 已有学生版讲义草稿：`course-content/authoring/lessons/3-4/design/handout.md`
- 已有作者态边界说明：`course-content/authoring/lessons/3-4/design/authoring-brief.md`
- 已有一组 `media/processed` 媒体可直接复用
- 尚缺：`teacher-handout.md`、双 PDF、`manifest.json`、`graph/*`、`sequence.json`、`boppps.md`、`interactive-page.md`、`multimedia.md`

**执行步骤**

1. 复核学生版讲义是否满足 `practice-lesson.md` 与 `step3-handout.md` 的最低结构约束，只做必要收口，不大改主线。
2. 基于学生版讲义生成教师版课堂讲义 `teacher-handout.md`，突出课堂组织、板书口径、教师介入点和实践段控制。
3. 使用统一导出脚本生成 `handout.pdf` 与 `teacher-handout.pdf`，并抽查首页、图表页、公式密集页、附录代码页。
4. 从 `3-4` 讲义中提炼 focus/reuse 节点与关系，补齐 `manifest.json`、`graph/nodes.jsonl`、`graph/relations.jsonl`。
5. 在 `course-content/authoring/knowledge/cards/lessons/3-4/sequence.json` 中建立分组与卡片顺序，并按需补节点卡片引用。
6. 依据实践课要求编写 `boppps.md`，明确不少于 45 分钟的学生实践训练时长与教师干预点。
7. 编写 `interactive-page.md`，把“关键节点读图 / 参数窗口 / 增益换算 / 三域验证”落成步骤化页面与工作区。
8. 编写 `multimedia.md`，登记现有媒体复用关系、缺失媒体与页面落点。
9. 更新 `docs/ProjectDescription.md` 中与 `3-4` 作者态推进相关的说明。
10. 对改动范围执行必要验证，并整理本次产物完成状态。

**验证清单**

- `python3 .codex/skills/lesson/scripts/export_handout_pdf.py ...handout.md`
- `python3 .codex/skills/lesson/scripts/export_handout_pdf.py ...teacher-handout.md`
- 抽查两版 PDF 的首页、图表页、公式页、附录代码页
- 视变更范围检查 JSON 语法与关键路径存在性
