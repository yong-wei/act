# 课程运行时主链路

状态: active
最后更新: 2026-03-17
摘要: 说明课堂如何从教案定义一路落到教师/学生端页面，是理解课堂同步与资源渲染的核心入口。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/00-index.md)
下游:
- [30-auth-and-session.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/30-auth-and-session.md)
- [50-resource-registry.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/50-resource-registry.md)
相关:
- [../40-domain/10-lesson-framework.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/10-lesson-framework.md)

## 核心链路

项目当前认可的课堂播放主干是：

`TeachingResource -> LessonPlan / LessonItem -> ClassSession -> StudentPlayer / ResourceRenderer`

这条链路的含义是：

- 资源先在资源注册表中被定义
- 教案通过 `LessonItem` 组织资源与阶段顺序
- 开课后由 `ClassSession` 保存当前课堂进度
- 教师端推进课堂，学生端轮询会话状态并渲染当前资源

## 配置覆盖顺序

资源配置的推荐合并顺序为：

`registry.defaultConfig -> TeachingResource.config -> LessonItem.overrideConfig`

## 当前演进方向

- 优先通过预置教案与运行时内容驱动精品课程
- 逐步减少 legacy 路径和硬编码组件直连
