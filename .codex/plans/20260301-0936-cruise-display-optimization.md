# 柔性之海课程显示页文案与视觉优化执行计划

## Goal
- 基于 `docs/platform-display-design.md` 与当前实现，系统优化“柔性之海：豪华邮轮舒适度控制”教师/学生端各显示页面（14步）文案和视觉层次，保持现有功能与数据联动不回退。

## Scope
- In scope:
  - `src/features/interactive/cruise-classroom/teacher-page.tsx`
  - `src/features/interactive/cruise-classroom/student-page.tsx`
  - `src/features/interactive/cruise-classroom/course-header.tsx`
  - `src/lib/cruise-course.ts`（新增/调整显示配置结构）
  - 必要时 `workspace.tsx` 轻量视觉调整
  - `docs/ProjectDescription.md` 更新本次改动记录
- Out of scope:
  - 仿真物理模型与控制算法（除文案映射外）
  - 新增后端接口与数据库结构
  - 新增全新路由页面

## 现状-设计差距检查
1) 全局展示层
- 差距：教师端工作区步骤文案仍以 `title/body` 两段短文为主，缺少设计文档要求的“学生任务/教师口令/巡视关注”结构化分区。
- 差距：学生端任务条为单行描述，缺少“关键问题/提示/检查项”等分层。
- 差距：步骤时长（⏱）与递进层（结构可见/可用/可评）未系统展示。

2) 关键步骤文案
- 差距：Bridge 教师端未呈现三列约束卡片；学生端未完整呈现场景卡和约束速览表。
- 差距：Objective 教师端未对布鲁姆动词做高亮；学生端缺“薄弱能力点”标签与更明确引导。
- 差距：Precheck 教师统计页缺“教学决策提示”；学生端前测前引导不足。
- 差距：NeuralODE 教师端未完成“传统建模 vs 数据驱动”并排呈现；学生端前沿说明可读性可提升。
- 差距：Summary 教师端缺“回到开场问题”回环展示和更强结构；学生端缺“设计档案”信息块。

3) 视觉层次
- 差距：部分页面字号偏小，不满足投影演示风格（3xl-4xl）和学生端重点提示（lg-xl）。
- 差距：告警/提示语义色彩（red/amber/cyan/emerald/violet）未形成稳定模式。

## 优化后的执行计划（含防遗漏检查点）
1) 建立显示配置骨架（单一真源）
- 在 `cruise-course.ts` 增加：
  - 步骤时长映射
  - 教师端结构化文案配置（阶段层/学生任务/教师口令/巡视关注）
  - 学生端任务条结构化配置（任务说明/关键问题/提示/检查项）
- 检查点：14步均有配置，禁止遗漏。

2) 重构教师端步骤渲染
- 替换纯字符串 `getTeacherCopyTitle/body` 渲染为结构化卡片。
- 单独强化 Step1/2/3/6/9/13 页面布局与文案。
- 检查点：每个步骤至少包含“阶段信息+核心任务”，工作区步骤额外包含口令或巡视项。

3) 重构学生端步骤渲染
- 文案页改为大字号分层卡片；工作区页任务条改为结构化分组（🔑/⚡/✅）。
- 强化 Step1/2/3/6/13 内容密度与可读性。
- 检查点：从 engineering-target 到 group-compare 的任务条全部走统一组件。

4) 导航与视觉微调
- 在 header 中补充当前步骤时长显示与层次优化，压缩空间占用。
- 统一关键颜色语义与卡片边框风格。
- 检查点：教师/学生端导航视觉一致，不影响现有翻页与下拉切换逻辑。

5) 文档与验证
- 更新 `docs/ProjectDescription.md`。
- 运行：`npm run lint`、`npm run test`、`npm run build`。
- 检查点：全部通过后再汇报。

## Tests
- `npm run lint`
- `npm run test`
- `npm run build`

## Acceptance
- 教师端 14 步页面文案符合 `platform-display-design.md` 的结构化表达要求。
- 学生端 14 步页面具备统一任务条风格与大字号阅读体验。
- 现有教师/学生分端与数据联动不回退。
- 构建与基础测试通过。
