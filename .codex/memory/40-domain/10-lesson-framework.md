# 课程框架语义

状态: active
最后更新: 2026-03-20
摘要: 解释 DB BOPPPS、教案、课堂会话之间的教学语义，是业务域的最小公共背景；当前新课还应先经过独立的内容审查，再进入互动课程实现。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/00-index.md)
下游:
- [20-premium-courses.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/20-premium-courses.md)
相关:
- [../20-architecture/20-course-runtime.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/20-course-runtime.md)

## 当前统一语义

- DB BOPPPS 是课堂编排的统一主干
- `LessonPlan` 表示一节课的整体设计
- `LessonItem` 对应课堂内的一个教学环节
- `ClassSession` 表示某次实际开出的课堂
- `course-content/authoring` 是课程正文、知识卡和媒体脚本的制作源；`course-content/runtime` 是运行时唯一来源
- 新课进入页面实现前，应先产出 `course-content/runtime/lessons/<lesson>/review/` 审查包，作为讲义、教案、知识卡和代码直出媒体已经校核过的输入

## 为什么这很重要

很多“看似只是前端页面”的需求，实际上是在改课堂主语义，不能只从组件层面理解。
