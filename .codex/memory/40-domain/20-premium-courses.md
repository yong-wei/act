# 精品课程体系

状态: active
最后更新: 2026-03-20
摘要: 记录精品课程与普通课堂路由的差异，以及当前已经接入的主要课程类型；当前除 L-2 系列与 L-sum 外，`1-1` 也已作为 runtime-first 精品课接入。
上游:
- [10-lesson-framework.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/10-lesson-framework.md)
下游: []
相关:
- [../20-architecture/30-auth-and-session.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/30-auth-and-session.md)

## 定义

精品课程是指根据课程标题映射到独立路由段、拥有专用入口页和专用教师/学生课堂页的一类课程。

## 当前已知课程族

- L-2a
- L-2b
- L-2c
- L-2d
- L-sum
- 1-1
- Cruise comfort

## 记忆重点

- 课程标题归一化会影响路由映射
- 同一套 `/api/session` 与 `/state` 能被多门精品课程复用，但前端课堂页实现彼此独立
- `1-1` 的固定路由段是 `unit-1-1-laplace-transfer-function`
- `1-1` 的入口、教师页、学生页都位于 `/interactive-learning/courses/unit-1-1-laplace-transfer-function/*`
- `1-1` 的运行时内容位于 `course-content/runtime/lessons/1-1`
- 对于存在代码直出媒体的精品课程，当前稳定做法是先把输出落到 `authoring/.../media/processed` 审核，再走 runtime 导出链
