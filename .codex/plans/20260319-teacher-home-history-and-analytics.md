# 教师首页与上课历史改造实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 调整教师首页入口结构，新增“上课历史”总表与课堂统计入口，并把班级学情学生视图改成更适合教师使用的表格化展示。

**Architecture:** 复用现有教师首页、班级页、课堂复盘页和学情接口，在其上补充一条“教师维度的已结束课堂总表”链路。避免直接复用直播教师页做历史回放，本次统一落成“课堂统计/课堂记录”入口。样式优先接入全局 `globals.css` 语义类，避免继续在页面内写死深色按钮外观。

**Tech Stack:** Next.js 14 App Router、React、TypeScript、Prisma、Vitest、Tailwind CSS

### Task 1: 首页入口与样式配置整理

**Files:**
- Create: `src/features/teacher/teacher-dashboard-config.ts`
- Modify: `src/features/teacher/teacher-dashboard.tsx`
- Modify: `src/app/teacher/page.tsx`
- Modify: `src/app/globals.css`
- Test: `src/features/teacher/__tests__/teacher-dashboard-config.test.ts`

**Step 1: 写失败测试**

覆盖：
- 首页快捷操作保留 `新建班级 / 新建教案 / 预置教案 / 教学资源管理`
- 首页新增 `上课历史`
- 不再保留重复的 `/teacher/classes` 快捷卡片
- `我的班级` 统计卡配置为可点击跳转 `/teacher/classes`

**Step 2: 运行测试确认失败**

Run: `npm run test:unit -- src/features/teacher/__tests__/teacher-dashboard-config.test.ts`

Expected: FAIL，提示新配置或 helper 尚不存在。

**Step 3: 实现最小配置与首页改造**

实现内容：
- 抽取首页快捷操作/统计卡配置
- 首页第一行统计卡增加 `上课历史`
- `我的班级` 统计卡改为链接
- 删除重复快捷卡片
- 快捷操作第二行按 5 个按钮平均分布
- 全局新增适合浅色主题的教师按钮/图标填充语义类

**Step 4: 运行测试确认通过**

Run: `npm run test:unit -- src/features/teacher/__tests__/teacher-dashboard-config.test.ts`

Expected: PASS

### Task 2: 教师维度“上课历史”总表 API

**Files:**
- Create: `src/app/api/teacher/sessions/route.ts`
- Test: `src/app/api/teacher/sessions/__tests__/route.test.ts`

**Step 1: 写失败测试**

覆盖：
- 默认仅返回当前教师的 `FINISHED` 课堂
- 支持搜索教案标题
- 支持修改 `classId`
- 支持删除已结束课堂
- 非本人教师或未登录时拒绝访问

**Step 2: 运行测试确认失败**

Run: `npm run test:unit -- src/app/api/teacher/sessions/__tests__/route.test.ts`

Expected: FAIL，接口不存在或行为不匹配。

**Step 3: 实现最小接口**

实现内容：
- `GET /api/teacher/sessions`
- `PATCH /api/teacher/sessions?id=...`
- `DELETE /api/teacher/sessions?id=...`
- 严格限制只能操作当前教师自己的已结束课堂

**Step 4: 运行测试确认通过**

Run: `npm run test:unit -- src/app/api/teacher/sessions/__tests__/route.test.ts`

Expected: PASS

### Task 3: 教师“上课历史”总表页面

**Files:**
- Create: `src/app/teacher/history/page.tsx`
- Modify: `src/app/teacher/page.tsx`
- Modify: `src/features/teacher/teacher-dashboard.tsx`

**Step 1: 实现页面**

实现内容：
- 首页新增入口卡片跳转 `/teacher/history`
- 页面显示全部已结束课堂
- 每条可进入课堂统计页 `/classroom/teacher/[sessionId]/review`
- 每条支持通过编辑区下拉选择所属班级
- 每条支持删除

**Step 2: 手动验证页面链路**

验证：
- 首页进入历史页
- 历史页能加载
- 修改班级后页面刷新状态正确
- 删除后列表消失

### Task 4: 班级页课堂历史接入与课堂统计入口收敛

**Files:**
- Modify: `src/app/teacher/classes/[classId]/page.tsx`

**Step 1: 调整班级页**

实现内容：
- 保持班级内课堂历史仅显示本班 `classId` 命中的课堂
- 已结束课堂按钮统一文案为“课堂统计”或“查看课堂统计”
- 与教师总表链路保持一致

**Step 2: 手动验证**

验证：
- 班级页只看到本班历史
- 点击进入 `/classroom/teacher/[sessionId]/review`

### Task 5: 学情分析页表格化改造

**Files:**
- Modify: `src/app/api/teacher/classes/[classId]/heatmap/route.ts`
- Modify: `src/app/(main)/teacher/classes/[classId]/analytics-v2/page.tsx`
- Test: `src/features/teacher/__tests__/teacher-insights.test.ts`

**Step 1: 写失败测试**

覆盖：
- 学生显示标识优先 `studentNumber`
- 无学号时再回退 email / id

**Step 2: 运行测试确认失败**

Run: `npm run test:unit -- src/features/teacher/__tests__/teacher-insights.test.ts`

Expected: FAIL，helper 尚未扩展。

**Step 3: 实现最小改造**

实现内容：
- 热力图接口返回 `studentNumber`
- 学情页学生标识不再显示随机短码
- 学生清单改成固定表头表格
- 列包含：画像等级、综合指数、风险/趋势、成长档案、操作

**Step 4: 运行测试确认通过**

Run: `npm run test:unit -- src/features/teacher/__tests__/teacher-insights.test.ts`

Expected: PASS

### Task 6: 验证与文档

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 运行验证**

Run:
- `npm run test:unit -- src/features/teacher/__tests__/teacher-dashboard-config.test.ts src/app/api/teacher/sessions/__tests__/route.test.ts src/features/teacher/__tests__/teacher-insights.test.ts`
- `npm run lint`

**Step 2: 更新文档**

补充教师首页入口、上课历史总表、班级历史与学情表格的新行为。

**Step 3: 记录结果**

输出：
- 已完成改动
- 已运行验证
- 未覆盖风险（如未做浏览器级回放）
