# Runtime 输出契约

lesson 级运行时产物：
- `course-content/runtime/lessons/<lesson>/handout.md`
- `course-content/runtime/lessons/<lesson>/graph-overlay.json`
- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/media/*`
- `course-content/runtime/lessons/<lesson>/review/*`

其中 `review/` 至少包含：
- `boppps.md`
- `review-report.md`
- `knowledge-card-check.json`
- `multimedia-check.json`
- `source-manifest.json`

知识卡片运行时仍走全局目录：
- `course-content/runtime/knowledge/cards/nodes/*.md`
