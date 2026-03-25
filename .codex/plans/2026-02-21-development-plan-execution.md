# AI-OBE DevelopmentPlan 执行计划

## 目标
基于 `docs/DevelopmentPlan.md` 在当前 Next.js 项目中落地全部 6 个功能模块，采用“可运行 MVP + 可扩展接口”策略，优先保证端到端可用与可验证。

## 架构策略
- 前端：新增 5 个页面，均使用现有 UI 技术栈（React + Tailwind + Recharts）
- 后端：新增 14+ API 路由，优先规则引擎 + 数值计算，LLM 作为可选增强
- 数据层：扩展 Prisma schema，保持与现有模型兼容
- 验证：`npm run lint`、`npm run test`、`npm run build`

## 执行任务

### 任务 1：多表征联动模块
- 新增 `src/lib/control/linkage-engine.ts`（极点→时域/频域/稳定性计算）
- 新增 API：
  - `src/app/api/linkage/calculate-time-domain/route.ts`
  - `src/app/api/linkage/calculate-frequency-domain/route.ts`
  - `src/app/api/linkage/stability-analysis/route.ts`
- 新增页面：
  - `src/app/interactive-learning/multi-representation-linkage/page.tsx`

### 任务 2：自适应题库模块
- 新增题库与能力估计逻辑：
  - `src/features/assessment/adaptive-question-bank.ts`
  - `src/features/assessment/adaptive-engine.ts`
- 新增 API：
  - `src/app/api/assessment/diagnostic/route.ts`
  - `src/app/api/assessment/next-question/route.ts`
  - `src/app/api/assessment/generate-question/route.ts`
  - `src/app/api/assessment/submit-answer/route.ts`
  - `src/app/api/assessment/ability-report/[userId]/route.ts`
- 新增页面：
  - `src/app/assessment/adaptive-practice/page.tsx`

### 任务 3：AI伴随探究模块
- 新增引擎：`src/features/ai/companion/intervention-engine.ts`
- 新增 API：
  - `src/app/api/ai/intervention/check/route.ts`
  - `src/app/api/ai/intervention/generate/route.ts`
  - `src/app/api/ai/intervention/feedback/route.ts`
- 在新场景页中集成 AI 介入面板

### 任务 4：元提示词评价 + 过程一致性模块
- 新增评价引擎：`src/features/evaluation/prompt-quality.ts`
- 新增 API：
  - `src/app/api/evaluation/assess-prompt/route.ts`
  - `src/app/api/evaluation/track-consistency/route.ts`
  - `src/app/api/evaluation/prompt-history/[userId]/route.ts`
- 新增页面：
  - `src/app/evaluation/prompt-assessment/page.tsx`

### 任务 5：工程场景扩展
- 新增页面：
  - `src/app/simulations/cruise-comfort/page.tsx`
  - `src/app/simulations/icebreaker-robust/page.tsx`
- 复用现有仿真引擎并补充多目标/鲁棒评估看板

### 任务 6：数据层与文档
- 扩展 `prisma/schema.prisma`（LinkageSession、Question、UserAnswer、AbilityAssessment、AIIntervention、PromptAssessment、DesignSession）
- 更新 `docs/ProjectDescription.md`

### 任务 7：验证
- 运行 `npm run lint`
- 运行 `npm run test`
- 运行 `npm run build`
- 修复阻断问题后给出验收结论
