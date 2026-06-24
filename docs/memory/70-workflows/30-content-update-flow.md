# 课程内容更新流程

状态: active
最后更新: 2026-06-12
摘要: 记录课程运行时内容、内容审查、互动 manifest、预置教案、代码直出媒体和资源注册之间的基本更新顺序；当前 `1-1` 已验证材料、互动契约和 manifest audit，可以继续进入互动课程制作与课堂页验收。
上游:
- [00-index.md](00-index.md)
下游:
- [35-lesson-content-review.md](35-lesson-content-review.md)
相关:
- [../40-domain/20-premium-courses.md](../40-domain/20-premium-courses.md)
- [35-lesson-content-review.md](35-lesson-content-review.md)

## 基本顺序

1. 明确课程目标和课堂步骤，并把正文、教案、多媒体说明、互动设计与知识卡编排落到 `course-content/authoring/lessons/<lesson>`。
2. 对新课或尚未审查的课，先执行 `rtk python3 course-content/scripts/review_lesson_content.py --lesson <lesson>`；需要严格检查实现契约时追加 `--strict-implementation-contract`。
3. 在审查阶段优先修复 `authoring` 源文件；若存在代码直出媒体，先生成到 `course-content/authoring/lessons/<lesson>/media/processed` 做内容审核，不要直接写入 runtime。
4. 确认 `course-content/runtime/lessons/<lesson>/review/*`、`lesson.json`、`interactive-manifest.json`、讲义、媒体说明、知识图和知识卡已经生成，且 review 结论可接受。
5. 进入互动课程实现前，运行 manifest audit，例如 `rtk python3 course-content/scripts/audit_interactive_manifest.py --lesson <lesson> --write-review`，确认步骤数、模块数、题型、媒体和知识链接没有阻断问题。
6. 互动课程实现应优先使用 `src/features/interactive/shared/manifest-runtime/` 和注册模块；确实需要课程私有逻辑时，放在 `src/features/interactive/<unit-route>/` 并保持课程边界清晰。
7. 完成页面或内容改动后，按影响范围跑定向测试；涉及课程 runtime、课堂页或 AI 上下文时，补充相关 Vitest、Playwright 或脚本验收。

## 当前 1-1 注意事项

- `1-1` 当前 route 是 `unit-1-1-see-the-full-picture`，运行态位于 `course-content/runtime/lessons/1-1`。
- `1-1` 作者态材料、互动契约和 acceptance 已齐备；manifest audit 已达到 15 steps、91 modules、0 issues。
- `review_lesson_content.py --lesson 1-1 --skip-export --strict-implementation-contract` 当前能够通过，但 `IMPLEMENTATION_CONTRACT_REGISTRY` 尚未显式纳入 `1-1`，因此还不能把它等同于三方实现契约已覆盖。
- `sync_runtime_knowledge.py --check` 当前可能报告 legacy `concepts/*.mdx` 缺失；对 1-1 来说，这不等于当前 `cards/nodes/*.md` 与 runtime knowledge cards 未就绪。
