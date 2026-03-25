# 个人中心能力画像与成长中枢收口 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让学生个人中心与成长中枢统一到现有六维实际能力模型，真实聚合学生活动，并输出可执行的个性化补强资源与自适应习题摘要。

**Architecture:** 以后端聚合接口为主收口数据来源：个人中心 `/api/user/profile` 改为读取数据治理快照、学习事实、互动埋点、课堂加入记录和现有推荐引擎；成长中枢 `/api/student/competency-snapshot` 对风险与建议做去重归并；前端个人中心页面改为消费统一结构并重排模块位置。

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Jest/Vitest 风格项目测试、现有数据治理与互动事件链路。

### Task 1: 定义目标数据结构与页面口径

**Files:**
- Modify: `src/app/api/user/profile/route.ts`
- Modify: `src/app/(main)/profile/page.tsx`
- Modify: `src/app/(main)/profile/growth/page.tsx`
- Reference: `src/lib/data-governance/competency-model.ts`
- Reference: `src/lib/data-governance/recommendation-engine.ts`

**Step 1: 明确页面目标结构**

- 个人中心能力画像统一为 `COMPETENCY_DIMENSIONS` 六维。
- 学生信息区显示姓名 + 学号；删除“学生”文案。
- 最近活动首页只显示前三条；“查看全部”展示所有活动并按类别分组。
- 能力追踪模块移除，最近活动上移到原能力追踪位置。
- 个性化补强路径包含资源卡和自适应习题诊断摘要。

**Step 2: 标注需要复用的数据源**

- `StudentCompetencySnapshot` / `StudentProfileSummary`
- `LearningFact`
- `InteractionLog`
- `SimulationLog`
- `StudentState` / `ClassSession`
- `student recommendations` 推荐引擎

### Task 2: 先写后端失败测试

**Files:**
- Create: `src/app/api/user/profile/__tests__/route.test.ts`
- Create: `src/app/api/student/competency-snapshot/__tests__/route.test.ts`

**Step 1: 为 `/api/user/profile` 写失败测试**

覆盖：
- 返回六维能力画像而非旧五维雷达结构
- 最近活动聚合课堂/仿真/互动/跨域探索，并按时间排序
- 最近活动摘要默认只暴露前三条，同时返回完整分类结构
- 个性化补强路径包含真实资源与自适应习题摘要

**Step 2: 为 `/api/student/competency-snapshot` 写失败测试**

覆盖：
- 重复 `riskFlags` 被按 `type + description` 去重
- 重复建议被按标题/动作去重
- 返回数量统计已反映去重后结果

**Step 3: 运行测试确认失败**

Run:
- `npm run test -- src/app/api/user/profile/__tests__/route.test.ts`
- `npm run test -- src/app/api/student/competency-snapshot/__tests__/route.test.ts`

Expected:
- 断言因字段缺失或去重未实现而失败

### Task 3: 实现用户画像接口聚合

**Files:**
- Modify: `src/app/api/user/profile/route.ts`
- Modify: `src/lib/data-governance/recommendation-engine.ts`
- Possibly Create: `src/lib/profile-activity.ts`

**Step 1: 收口六维能力数据**

- 使用最新 `StudentCompetencySnapshot` 作为能力画像主来源。
- 统一输出标签、得分、趋势、置信度和综合得分。

**Step 2: 聚合最近活动**

- 课堂加入：来自 `/api/session/join` 可见的 `StudentState` 首次提交时间或 `InteractionLog` 中 `sessionId + lesson_step_view/page_view` 首次出现。
- 仿真活动：`SimulationLog`
- 独立互动页面/知识卡片/跨域探索：`InteractionLog`、`LearningFact`
- 自适应习题：`LearningFact(question)` 与评测接口衍生信息
- 统一映射到 `{ category, title, description, timestamp, href, badge }`

**Step 3: 真实个性化补强路径**

- 使用 `generateRecommendations(userId)` 输出推荐动作。
- 将推荐动作映射到平台资源卡：知识卡片、互动模块、仿真、题目、自适应练习入口。
- 为自适应习题提供摘要：最近诊断表现、建议方向、继续练习入口。

### Task 4: 实现成长中枢去重逻辑

**Files:**
- Modify: `src/app/api/student/competency-snapshot/route.ts`
- Possibly Modify: `src/lib/data-governance/risk-detector.ts`
- Possibly Modify: `src/lib/data-governance/recommendation-engine.ts`

**Step 1: 风险去重**

- 对未解决 `StudentRiskFlag` 按 `flagType + description + severity` 做归并。
- 保留最新触发时间与可解释证据。

**Step 2: 建议去重**

- 对快照建议按 `type + title + actionUrl` 去重。
- 与推荐引擎输出口径对齐，避免“学习活跃度低 / 增加学习活跃度”重复刷屏。

**Step 3: 输出摘要计数**

- 返回原始数与去重后数，便于页面展示“待关注事项数”和“建议数”。

### Task 5: 改造前端个人中心与成长中枢

**Files:**
- Modify: `src/app/(main)/profile/page.tsx`
- Modify: `src/app/(main)/profile/growth/page.tsx`

**Step 1: 个人中心页面改版**

- 六维能力画像替换旧五维雷达说明。
- 姓名下显示学号，移除“学生”角色文案。
- 最近活动移动到原能力追踪位置，并提供“查看全部”展开/分类展示。
- 个性化补强路径显示资源推荐卡 + 自适应习题摘要卡。

**Step 2: 成长中枢页面收口**

- 关注事项与下一步建议展示去重结果。
- 顶部统计卡使用去重后数量。

### Task 6: 验证、文档与收尾

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 运行验证**

Run:
- `npm run test -- src/app/api/user/profile/__tests__/route.test.ts`
- `npm run test -- src/app/api/student/competency-snapshot/__tests__/route.test.ts`
- `npm run lint`
- `npm run build`

**Step 2: 更新文档**

- 在 `docs/ProjectDescription.md` 记录个人中心与成长中枢已统一到六维能力模型、活动聚合和补强路径真实推荐。

**Step 3: 检查最终结果**

- 页面不再显示旧五维能力口径
- 最近活动和补强路径都来自真实数据
- 重复风险与建议明显减少
