# Teacher Class Insights Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复教师端 500/404 路由问题，并将教师班级页重构为围绕班级学情与学生个体学情的统一入口。

**Architecture:** 保留教师端 `/teacher/classes/[classId]` 作为班级总入口，移除教师视角下独立的数据治理入口与无上下文的班级驾驶舱入口。新增面向教师的班级学情聚合接口与学生个体画像接口，复用现有数据治理快照、画像摘要、风险标记、成长档案与推荐数据，在班级总览页和学生详情页中统一展示。旧版 `/teacher/classes/[classId]/analytics` 入口重定向到新版班级学情页以保持兼容。

**Tech Stack:** Next.js 14 App Router、React、TypeScript、NextAuth、Prisma、Tailwind 语义主题样式、Playwright、Next lint/build。

### Task 1: 固化复现并建立回归基线

**Files:**
- Modify: `docs/ProjectDescription.md`
- Test: 浏览器回归 `http://localhost:3000/teacher`

**Step 1: 记录当前失败路径**

- `/teacher/classes/analytics-v2` 被解析为 `classId=analytics-v2`
- `/teacher/classes/[classId]/students/[studentId]` 页面不存在
- `/teacher/students/[studentId]/diagnosis` 误用当前登录学生快照接口
- 教师访问 `/admin/data-governance` 只会触发管理员 API 401，不应作为教师入口

**Step 2: 在实现后重新验证这些路径**

- 教师首页不再出现无上下文驾驶舱入口
- 班级页入口和学生详情都能正确打开
- 教师端不再暴露管理员数据治理入口

### Task 2: 建立教师班级学情聚合 API

**Files:**
- Modify: `src/app/api/teacher/classes/[classId]/dashboard/route.ts`
- Modify: `src/app/api/teacher/classes/[classId]/heatmap/route.ts`（仅在复用时微调）
- Create: `src/app/api/teacher/classes/[classId]/insights/route.ts`

**Step 1: 写失败验证**

- 直接请求 `GET /api/teacher/classes/:classId/insights`
- 预期返回：
  - 班级基本信息
  - 最新 `ClassCompetencySnapshot`
  - 风险摘要
  - 数据治理进度/新鲜度摘要
  - 学生清单概览（画像摘要、风险级别、成长档案计数、推荐计数）

**Step 2: 最小实现**

- 校验教师/管理员权限
- 以 `StudentProfile`, `StudentCompetencySnapshot`, `StudentProfileSummary`, `StudentRiskFlag`, `GrowthRecord`, `LearningRecommendation`, `ClassCompetencySnapshot` 聚合班级信息
- 提供适合前端卡片、榜单、入口卡、能力图的结构化字段，避免页面继续堆 mock 数据

**Step 3: 验证接口**

- 用浏览器或 `curl` 验证返回 200
- 用不存在班级验证 404
- 用无权限用户验证 403/401

### Task 3: 建立教师学生画像详情 API

**Files:**
- Create: `src/app/api/teacher/classes/[classId]/students/[studentId]/insights/route.ts`
- Modify: `src/app/api/student/competency-snapshot/route.ts`（仅在抽共用逻辑时）

**Step 1: 写失败验证**

- 请求 `GET /api/teacher/classes/:classId/students/:studentId/insights`
- 预期教师可查看本班学生，而不是当前登录者自身数据

**Step 2: 最小实现**

- 校验班级归属与学生属于该班级
- 返回：
  - 学生基本信息
  - 最新能力快照与趋势
  - 画像摘要（strengths / weaknesses / riskLevel / recommendedScaffolding）
  - 风险标记
  - 成长档案时间线
  - 推荐任务
  - 必要的班级对比信息

**Step 3: 验证接口**

- 教师查看本班学生返回 200
- 查看非本班学生返回 403/404

### Task 4: 重构教师首页与班级总览入口

**Files:**
- Modify: `src/features/teacher/teacher-dashboard.tsx`
- Modify: `src/app/teacher/classes/[classId]/page.tsx`
- Modify: `src/app/teacher/classes/[classId]/analytics/page.tsx`

**Step 1: 修复错误入口**

- 删除或改写 `/teacher/classes/analytics-v2` 快捷入口，改为引导进入班级列表/最近班级
- 旧 `/teacher/classes/[classId]/analytics` 统一跳转到新版班级学情页

**Step 2: 重构班级总览页**

- 顶部展示班级学情摘要与治理进度简报
- 将“课堂历史”“学生清单”“能力图/班级学情”设计为独立入口卡
- 学生列表不再只显示技术分和伦理分，改为显示画像等级、风险、近期趋势、成长记录数量等治理结果

**Step 3: 统一主题样式**

- 使用现有 `surface-*` 全局语义类和必要的全局扩展变量
- 保证浅色/深色模式视觉一致

### Task 5: 重构班级学情页与学生详情页

**Files:**
- Modify: `src/app/(main)/teacher/classes/[classId]/analytics-v2/page.tsx`
- Modify: `src/app/(main)/teacher/students/[studentId]/diagnosis/page.tsx`
- Create or Modify: 视需要新增教师学情组件，放入 `src/features/teacher/`

**Step 1: 班级学情页**

- 去掉 mock 数据
- 用真实聚合接口渲染班级学情总览、能力分布、风险分层、重点学生、数据新鲜度
- 将热力图改为符合当前数据框架的能力矩阵/分层视图，不再只强调旧版技术-伦理二元标签

**Step 2: 学生详情页**

- 改为请求教师学生画像详情 API
- 展示能力画像、风险标记、成长档案、推荐动作、近期证据摘要
- 处理无数据状态和权限状态

**Step 3: 修复链接**

- 班级页学生卡片与箭头统一指向可用详情页
- 班级学情页中的重点学生链接保持一致

### Task 6: 回归验证与文档同步

**Files:**
- Modify: `docs/ProjectDescription.md`
- Test: `npm run lint`
- Test: `npm run build`
- Test: Playwright 手工回归教师路径

**Step 1: 运行验证**

- `npm run lint`
- `npm run build`
- 教师登录后验证：
  - `/teacher`
  - `/teacher/classes/:classId`
  - `/teacher/classes/:classId/analytics-v2`
  - `/teacher/students/:studentId/diagnosis`

**Step 2: 更新文档**

- 在 `docs/ProjectDescription.md` 追加教师端学情入口重构记录
- 如产出稳定结论，补充 `.codex/memory/`
