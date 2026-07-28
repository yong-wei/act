---
status: accepted
context: smart-preparation
supersedes_in_part: docs/adr/0011-version-course-basis-documents-immutably.md
---

# 课程依据文档在首次实际引用时冻结

教师提交的课程依据文档在首次被备课资源包实际采用前保持可编辑；首次用于支撑知识点、教学目标或生成上下文时，系统原子地确认并冻结当前内容，后续编辑创建新版本。该决定以更少的重复确认换取更复杂的首次引用边界，但仍保证已经进入教案生成与引用链路的内容不可变。
