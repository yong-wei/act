---
status: accepted
context: authoritative-knowledge-graph-migration
supersedes_in_part: docs/adr/0032-bound-the-knowledge-base-to-the-formal-course.md
---

# 完整导入 ActKG Release 并以 ACT Overlay 管理课程使用范围

ACT 对 ReleaseSet 锁定清单中的正式 ActKG Release 执行 Release 级完整导入，不因当前课程尚未采用部分对象而裁剪权威内容。所有正式发布对象均可在新版知识图谱中浏览。

具体课程通过 CourseCoverage Overlay 声明哪些 ActKG Canonical Object 可以进入资源推荐、KAQ、学习路径、评价和新学习事实。未被当前课程纳入的权威对象只承担知识浏览和未来扩展，不自动参与教学运行。

对象进入 CourseCoverage Overlay 必须具有 `formal_objective`、`necessary_prerequisite` 或 `explicit_extension` 之一的显式课程依据。资源绑定、教材出现和模型建议只能形成候选，不能自动扩大课程教学范围。

该决定把跨教材、跨资源的权威知识范围与 ACT 当前课程教学范围分离，在保持 Release 无损的同时延续课程边界治理。
