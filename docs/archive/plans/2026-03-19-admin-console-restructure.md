# Admin Console Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将管理员后台重构为统一入口页，并把用户管理、使用量统计、数据治理拆为 `admin` 下一级路由，同时修复使用量真实数据 404、消除浅色模式下的深色硬编码，并增强数据治理页面的信息层级与中文表达。

**Architecture:** 保留现有管理员鉴权逻辑，新增一个轻量的后台入口页作为 `/admin`，把现有用户管理组件迁移到 `/admin/users` 使用。抽取一套全局 `admin` 视觉样式到 `src/app/globals.css`，让用户管理、后台入口与数据治理页共享主题变量。为 `/api/admin/system-usage` 新增真实聚合接口，并扩展数据治理状态接口以支撑更深入的可视化内容。

**Tech Stack:** Next.js App Router、React、TypeScript、Tailwind、Prisma、Vitest

### Task 1: 管理后台路由重构

**Files:**
- Modify: `src/app/admin/page.tsx`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/features/admin/admin-console-home.tsx`
- Modify: `src/features/admin/admin-dashboard.tsx`

**Step 1: 写失败测试**

- 新增管理员后台相关单测，覆盖：
  - `admin` 根入口的卡片配置存在 `用户管理`、`系统使用量统计`、`数据治理`
  - 用户管理页面入口路径迁移到 `/admin/users`

**Step 2: 运行测试并确认失败**

Run: `npm run test:unit -- src/features/admin/__tests__/admin-console.test.ts`

Expected: 因为配置和新页面尚不存在而失败。

**Step 3: 实现最小路由拆分**

- 新建后台入口组件，渲染三个统一入口卡片
- 新增 `/admin/users/page.tsx` 复用用户管理组件
- 将 `src/app/admin/page.tsx` 改为后台入口
- 在用户管理页增加“返回管理后台”按钮

**Step 4: 运行测试确认通过**

Run: `npm run test:unit -- src/features/admin/__tests__/admin-console.test.ts`

Expected: 路由与入口配置测试通过。

### Task 2: 全局管理员样式与用户管理浅色模式修复

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/features/admin/admin-dashboard.tsx`
- Modify: `src/features/admin/admin-console-home.tsx`

**Step 1: 写失败测试**

- 为管理员样式配置增加测试，覆盖用户管理页使用共享 `admin` 全局 class，而不是整页硬编码 `bg-slate-950 text-slate-100`

**Step 2: 运行测试并确认失败**

Run: `npm run test:unit -- src/features/admin/__tests__/admin-console.test.ts`

Expected: 因为仍使用硬编码深色 class 而失败。

**Step 3: 实现最小样式抽离**

- 在 `globals.css` 中新增管理员后台的全局组件类和 `.light` 覆盖
- 用户管理页面改为使用这些全局样式类，确保浅色模式下为浅色填充、浅色边框和可读文本
- 后台入口页同样复用这套样式，保证视觉一致

**Step 4: 运行测试确认通过**

Run: `npm run test:unit -- src/features/admin/__tests__/admin-console.test.ts`

Expected: 样式约束测试通过。

### Task 3: 系统使用量真实数据 API 回补

**Files:**
- Create: `src/app/api/admin/system-usage/route.ts`
- Create: `src/features/admin/states/system-usage-data.ts`
- Modify: `src/features/admin/states/admin-states-dashboard.tsx`
- Test: `src/features/admin/__tests__/system-usage-route.test.ts`

**Step 1: 写失败测试**

- 为 `system-usage` 聚合函数/路由写单测，覆盖：
  - 返回的数据结构满足页面需要
  - 用户规模来自真实用户表统计
  - 当交互/仿真数据为空时仍返回合法响应而非 404

**Step 2: 运行测试并确认失败**

Run: `npm run test:unit -- src/features/admin/__tests__/system-usage-route.test.ts`

Expected: 因缺少路由或聚合逻辑而失败。

**Step 3: 实现最小真实聚合**

- 用 Prisma 聚合 `User`、`InteractionLog`、`SimulationSession`、`SimulationLog`、`LearningFact`、`LlmSession` 等现有数据
- 生成页面所需的 `interactionByType`、`simulationVisits`、`moduleVisitShare`、`monthlyTrend` 和估算指标
- 页面继续保留演示模式，但关闭演示模式后应能拿到真实数据

**Step 4: 运行测试确认通过**

Run: `npm run test:unit -- src/features/admin/__tests__/system-usage-route.test.ts`

Expected: 路由聚合测试通过。

### Task 4: 数据治理页面中文化与信息层级增强

**Files:**
- Modify: `src/app/admin/data-governance/page.tsx`
- Modify: `src/app/api/admin/data-governance/status/route.ts`
- Test: `src/features/admin/__tests__/data-governance-transform.test.ts`

**Step 1: 写失败测试**

- 为数据治理展示数据写测试，覆盖：
  - 文案为中文
  - 除总量外还包含更深一层的结构，如风险清单、事实类型分布、快照明细或告警区块

**Step 2: 运行测试并确认失败**

Run: `npm run test:unit -- src/features/admin/__tests__/data-governance-transform.test.ts`

Expected: 现有页面字段不足、文案为英文而失败。

**Step 3: 实现最小增强**

- 扩展状态接口，补充最近风险、事实类型分布、快照排行/明细等可直接消费的数据
- 页面改为中文信息架构，加入返回上一级按钮、状态概览、队列健康、风险明细、事实分布和最近快照明细区块
- 页面入口从其他页面内嵌入口迁移到管理员后台统一入口

**Step 4: 运行测试确认通过**

Run: `npm run test:unit -- src/features/admin/__tests__/data-governance-transform.test.ts`

Expected: 数据转换与文案测试通过。

### Task 5: 验证与文档

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 运行静态验证**

Run: `npm run lint`
Expected: 通过

Run: `npm run test:unit`
Expected: 通过

**Step 2: 运行项目要求的验证**

Run: `npm run test`
Expected: 通过

Run: `npm run build`
Expected: 通过

**Step 3: 补充文档**

- 在 `docs/ProjectDescription.md` 增加管理员后台结构调整、数据治理增强与使用量真实数据接口说明

**Step 4: 记录结果**

- 汇总测试结果、已知风险和是否需要进一步集成测试
