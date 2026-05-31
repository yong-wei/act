# 课程内容更新流程

状态: active
最后更新: 2026-03-20
摘要: 记录课程运行时内容、内容审查、预置教案、代码直出媒体和资源注册之间的基本更新顺序；当前 `1-1` 已验证互动课实现链，`1-2` 已验证新的课程审查导出链。
上游:
- [00-index.md](00-index.md)
下游:
- [35-lesson-content-review.md](35-lesson-content-review.md)
相关:
- [../40-domain/20-premium-courses.md](../40-domain/20-premium-courses.md)
- [35-lesson-content-review.md](35-lesson-content-review.md)

## 基本顺序

1. 明确课程目标和课堂步骤，并把正文、教案、多媒体说明与知识卡编排落到 `course-content/authoring`
2. 对新课或尚未审查的课，先执行 `python3 course-content/scripts/review_lesson_content.py --lesson <lesson>`
3. 在审查阶段优先修复 `authoring` 源文件；若存在代码直出媒体，先生成到 `course-content/authoring/lessons/<lesson>/media/processed` 做内容审核，不要直接写入 runtime
4. 确认 `course-content/runtime/lessons/<lesson>/review/*` 已生成，且 `review-report.md`、知识卡检查、多媒体检查结论可接受
5. 若进入互动课程实现，再由 `interactive-lesson` 基于 runtime 的 `lesson.json`、`handout.md`、`review/*`、知识图与知识卡继续制作页面与课堂流程
6. 对旧课如暂未补齐 `media/processed`，`export_runtime.py` 仍允许 `media/raw` fallback；但新课不要跳过审查直接依赖 fallback
7. 完成页面或内容改动后，跑针对性测试，以及 `lint/test/build` 并验证入口
