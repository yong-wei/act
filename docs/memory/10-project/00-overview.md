# 项目总览

状态: active
最后更新: 2026-07-18
摘要: 用最小信息回答“这个项目是什么、主要目标是什么、当前主干体系是什么”；当前项目主干已经扩展为统一平台壳层、标准互动课、控制工作台、Arena、数据治理和智能助教闭环。
上游:
- [../00-index.md](../00-index.md)
下游:
- [10-current-state.md](10-current-state.md)
- [20-roadmap.md](20-roadmap.md)
- [30-glossary.md](30-glossary.md)
相关:
- [docs/ProjectDescription.md](../../ProjectDescription.md)

## 一句话定义

AI-OBE 船舶智控平台是一个面向自动控制与船舶智能控制教学的 Next.js 单体应用，核心目标是把课程内容、标准互动课、课堂会话、控制仿真、Arena 评测、学习证据、智能助教和教师治理工作台整合为可复审的教学闭环。

## 当前主干

- Web 框架: Next.js 16、React 19、TypeScript 单仓应用
- 数据层: Prisma 7 + PostgreSQL
- 鉴权: NextAuth JWT 会话
- 课堂主链路: `TeachingResource -> LessonPlan/LessonItem -> ClassSession -> StudentPlayer/ResourceRenderer`
- 课程组织: 作者态 `course-content/authoring` 导出到 runtime，标准互动课优先走 manifest runtime 与注册模块
- 平台主线: `AppShell` 角色导航、控制工作台、Arena、数据中心、文档批改、备课增强包和智能助教共享同一证据层

## 进入项目时最值得先知道的事

- 这是一个“课程框架 + 仿真评测 + 学习证据治理平台”，不是单一仿真项目
- `src/features` 和 `src/resources` 有明确边界
- `1-1` 标准互动课当前路由是 `/interactive-learning/courses/unit-1-1-see-the-full-picture`
- 当前 OpenSpec 列表中的四项 change 均已完成任务；需要继续验收和归档，而不是重复实现
- 线上部署历史上出现过 Prisma 迁移与运行镜像状态不一致的问题
