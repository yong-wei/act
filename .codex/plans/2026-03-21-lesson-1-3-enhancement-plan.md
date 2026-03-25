# 1-3 Enhanced Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `1-3` 互动课程补到“增强版”状态，重点提升 `step-07`、`step-09`、`step-13` 三个工作区的可视化与可操作性，并回填文档与验证记录。

**Architecture:** 保持现有 `unit-1-3-time-response` 课程骨架不变，在 `step-panels.tsx` 内扩展三处步骤级工作区配置，在 `time-response-math.ts` 与新/旧辅助模块中沉淀可测试纯函数，优先让复杂计算脱离 JSX。文档层同步更新课程进度、实现笔记与项目说明，保证“代码状态”和“文档状态”一致。

**Tech Stack:** Next.js 14, React 18, TypeScript, Vitest, Tailwind CSS

### Task 1: 建立增强版回归测试骨架

**Files:**
- Modify: `src/features/interactive/__tests__/unit-1-3-course.test.ts`
- Inspect: `src/features/interactive/unit-1-3-time-response/step-panels.tsx`
- Inspect: `src/features/interactive/unit-1-3-time-response/time-response-math.ts`

**Step 1: 写 step-07 / step-09 / step-13 的失败测试**

新增三个最小行为断言：
- `step-07` 暴露三列表或等价结构，且包含 `wn / zeta / wd`
- `step-09` 暴露四指标叠加配置，且默认含 `tr / tp / mp / ts`
- `step-13` 暴露例题计算顺序与中间量 `wd`

**Step 2: 运行测试确认失败**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`
Expected: FAIL，且失败原因指向新增结构/导出尚不存在。

**Step 3: 只实现最小导出结构让测试转绿**

先补最小数据结构与纯函数，不急着完成所有 JSX 表现。

**Step 4: 重跑测试确认通过**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`
Expected: PASS

### Task 2: 增强 `step-07` 参数-现象-公式三列表工作区

**Files:**
- Modify: `src/features/interactive/unit-1-3-time-response/step-panels.tsx`
- Modify: `src/features/interactive/unit-1-3-time-response/time-response-math.ts`
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Step 1: 写失败测试**

为参数卡片/三列表摘要新增断言，至少覆盖：
- 三个参数标签
- 每个参数对应一个公式表达
- 每个参数对应一个“控制的响应现象”说明

**Step 2: 跑测试确认失败**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Step 3: 最小实现**

实现方向：
- 抽出 `step-07` 的参数映射数据
- 在步骤面板中从“纯表单”升级为“说明 + 三列表 + 原表单”
- 保持教师/学生页现有提交流程不破坏

**Step 4: 重跑测试**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`

### Task 3: 增强 `step-09` 四指标叠加工作区

**Files:**
- Modify: `src/features/interactive/unit-1-3-time-response/step-panels.tsx`
- Modify: `src/features/interactive/unit-1-3-time-response/time-response-math.ts`
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Step 1: 写失败测试**

新增断言验证：
- 存在四指标叠加项
- 每项都含名称、作用说明与图上位置/层次描述
- 默认覆盖 `tr / tp / mp / ts`

**Step 2: 跑测试确认失败**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Step 3: 最小实现**

实现方向：
- 用 runtime 媒体图作底图
- 叠加四指标说明卡与层次切换
- 保留原有提交表单，增强为“看图 + 切换 + 填写”

**Step 4: 重跑测试**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`

### Task 4: 增强 `step-13` 例题计算面板

**Files:**
- Modify: `src/features/interactive/unit-1-3-time-response/step-panels.tsx`
- Modify: `src/features/interactive/unit-1-3-time-response/time-response-math.ts`
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Step 1: 写失败测试**

新增断言验证：
- 例题面板暴露“三步法”顺序
- 计算链显式包含 `wd`
- 至少一处敏感步骤说明

**Step 2: 跑测试确认失败**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Step 3: 最小实现**

实现方向：
- 在页面中加入“读参数 -> 求 `wd` -> 顺推指标”的分步面板
- 若需要计算演示，优先抽成纯函数并复用到 UI
- 继续保留原表单提交态

**Step 4: 重跑测试**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`

### Task 5: 回填文档与实现记录

**Files:**
- Modify: `course-content/authoring/lessons/2-2/notes/progress.md`
- Modify: `.codex/skills/interactive-lesson-implementation/notes/1-3.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: 回填进度文档**

把“前端尚未实现”的旧表述更新为当前增强版状态，并注明仍待真实课堂 session 验收。

**Step 2: 回填实现笔记**

补充三处增强的具体内容、测试命令与剩余风险。

**Step 3: 更新项目说明**

把 `1-3` 纳入当前已完成精品互动课清单或相关进展说明。

### Task 6: 完整验证

**Files:**
- Verify only

**Step 1: 运行定向单测**

Run: `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`
Expected: PASS

**Step 2: 运行 lint**

Run: `npm run lint`
Expected: PASS

**Step 3: 运行 build**

Run: `npm run build`
Expected: PASS

**Step 4: 汇总结论**

逐条对照：
- `step-07` 三列表增强是否落地
- `step-09` 四指标叠加是否落地
- `step-13` 例题计算面板是否落地
- 文档是否与代码状态一致
