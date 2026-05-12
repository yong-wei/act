# 关键数据模型

状态: active
最后更新: 2026-03-17
摘要: 只记录课堂主链路的关键模型，帮助快速回忆 Prisma 中最常用的实体关系。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [prisma/schema.prisma](../../../prisma/schema.prisma)

## 当前最关键的模型

- `LessonPlan`: 教案
- `LessonItem`: 教案步骤
- `ClassSession`: 真实课堂会话
- `StudentState`: 学生课堂状态
- `PlatformSetting`: 平台级开关配置

## 课堂相关最重要的关系

- `ClassSession.planId -> LessonPlan`
- `ClassSession.teacherId -> User`
- `StudentState.sessionId -> ClassSession`
- `StudentState.userId -> User`
