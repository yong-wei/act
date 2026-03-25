# 项目总览

状态: active
最后更新: 2026-03-17
摘要: 用最小信息回答“这个项目是什么、主要目标是什么、当前主干体系是什么”。
上游:
- [../00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/00-index.md)
下游:
- [10-current-state.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/10-current-state.md)
- [20-roadmap.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/20-roadmap.md)
- [30-glossary.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/30-glossary.md)
相关:
- [docs/ProjectDescription.md](/Users/YW/Documents/Site/act.just.edu.cn/docs/ProjectDescription.md)

## 一句话定义

AI-OBE 船舶智控平台是一个面向自动控制与船舶控制教学的 Next.js 单体应用，核心目标是将 DB BOPPPS 教案、互动资源、课堂会话和 AI 辅学整合为可用于真实教学的统一课堂框架。

## 当前主干

- Web 框架: Next.js 14 单仓应用
- 数据层: Prisma + PostgreSQL
- 鉴权: NextAuth JWT 会话
- 课堂主链路: `TeachingResource -> LessonPlan/LessonItem -> ClassSession -> StudentPlayer/ResourceRenderer`
- 课程组织: 普通课堂页与精品课程页并存，后者通过课程标题映射到独立路由

## 进入项目时最值得先知道的事

- 这是一个“课程框架 + 互动资源平台”，不是单一仿真项目
- `src/features` 和 `src/resources` 有明确边界
- 课堂同步、学生态持久化和精品课程入口是近阶段重点
- 线上部署历史上出现过 Prisma 迁移与运行镜像状态不一致的问题
