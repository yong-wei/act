# 项目术语表

状态: active
最后更新: 2026-03-17
摘要: 统一项目内常见名词，避免跨会话时对“课程、教案、课堂、资源”等词义理解偏差。
上游:
- [00-overview.md](00-overview.md)
下游: []
相关:
- [../40-domain/10-lesson-framework.md](../40-domain/10-lesson-framework.md)

## 核心术语

- `TeachingResource`: 可注册、可编排、可被课堂播放的资源单元
- `LessonPlan`: 一份完整教案，包含多个 `LessonItem`
- `LessonItem`: 教案中的课堂环节，通常对应 BOPPPS 中的一个步骤
- `ClassSession`: 一次真实课堂会话，记录教师、教案、当前步骤与课堂状态
- `StudentState`: 学生在课堂中的实时或阶段状态，常用于双端同步与数据看板
- `Premium Course`: 通过课程标题映射到独立路由和独立课堂页的一类精品课程
