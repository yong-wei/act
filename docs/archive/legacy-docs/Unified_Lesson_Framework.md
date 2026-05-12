# 互动课程统一架构设计方案 (Unified Interactive Lesson Framework)

## 1. 复核结论与问题汇总

基于仓库现状复核，当前课程实现存在多套并行框架与契约：

- DB 版 BOPPPS 教案主干（`TeachingResource` + `LessonPlan` + `LessonItem` + `ClassSession`）
- LessonManifest 试验型清单引擎（`src/types/schema.ts` + `src/features/lesson-engine/LessonPlayer.tsx`）
- 课程级 `manifest.ts` 与 standalone 页面（`src/resources/interactive-learning/lesson-xx` + `/interactive-learning` 路由）

这导致流程编排、资源注册、配置覆盖与埋点协议无法统一。为支撑 30+ 课次规模扩展，必须确立唯一运行时主干，并对资源注册、组件契约、数据采集与 AI 上下文做一致性标准。

## 2. 统一框架目标与原则

### 2.1 目标
- 课次扩展主要集中于内容建设，不再重复搭建流程与外壳。
- 课堂编排、互动资源、仿真与 AI 协作具备统一协议与数据闭环。
- 课堂过程数据可追溯，用于班级状态聚合与个性化学习建议。

### 2.2 核心原则
1) **单一运行时主干**：以 DB BOPPPS 教案为唯一课堂播放主干。
2) **资源注册唯一标识**：所有可编排组件统一通过 `registryId` 注册与调用。
3) **组件契约统一**：互动组件遵循 `BaseWidgetProps` 与互动框架上下文协议。
4) **流程数据可追溯**：所有课堂互动必须可记录至 `InteractionLog`/`StudentState`。

## 3. 统一运行时主干（唯一真源）

### 3.1 数据链路
```
Resource Registry (src/lib/resource-registry.tsx)
        ↓ registryId
TeachingResource (DB)
        ↓ LessonItem.resourceId
LessonPlan (DB, BOPPPS)
        ↓ ClassSession
StudentPlayer + ResourceRenderer
        ↓
InteractionLog / StudentState / AI Context
```

### 3.2 关键实体与职责
- **Resource Registry**: 组件注册表，定义可用组件与默认配置。
- **TeachingResource**: 教学资源库，持久化资源元信息与默认配置。
- **LessonPlan / LessonItem**: BOPPPS 教学流程编排结果。
- **ClassSession**: 课堂运行时状态（当前环节、学生同步）。
- **InteractionLog / StudentState**: 数据采集与学习画像基石。

## 4. 资源注册与配置规范

### 4.1 Registry 规范
- 必须在 `src/lib/resource-registry.tsx` 注册组件。
- 以 `registryId` 作为唯一识别符，不允许在教案中直接使用文件路径。
- 课堂组件（视频/投票/目标/评估/AI 报告）同样以 `registryId` 注册。

### 4.2 TeachingResource 规范
- `type` 使用 Prisma `ResourceType`：`INTERACTIVE_COMP` / `SIMULATION_APP` / `STATIC_TEXT` / `STATIC_MEDIA` / `ETHICS_SCENARIO`。
- `config` 存默认 props，通用配置优先写入 `TeachingResource.config`。
- 课程内差异化配置写入 `LessonItem.overrideConfig`。

### 4.3 LessonItem.overrideConfig 合并规则
- `overrideConfig` 仅对当前教案生效。
- 运行时合并顺序：`registry.defaultConfig` → `TeachingResource.config` → `LessonItem.overrideConfig`。
- `titleOverride`/`descriptionOverride` 用于课堂引导语与标题覆盖。

## 5. 组件契约与互动协议

### 5.1 统一组件契约
所有互动/仿真组件必须支持 `BaseWidgetProps`：

- `embedded?: boolean`
- `lessonContext?: LessonContext`
- `onStateChange?: (state: WidgetState) => void`
- `onComplete?: (result?: WidgetResult) => void`

组件需在可用时接入 `InteractiveProvider`：
- 使用 `useOptionalInteractiveContext` 发送进度与事件。
- 在关键节点调用 `progress.setProgress()` / `progress.markComplete()`。
- 对于独立页面（standalone）必须保持兼容，避免依赖上下文硬失败。

### 5.2 事件与数据采集
- 事件类型统一：`view`/`interact`/`param_change`/`submit`/`complete`/`error`。
- 互动组件必须在关键操作上报 `tracking.emit()`。
- `WidgetState` 应包含阶段、进度、关键数据快照与时间戳。

## 6. 课程编排规范

### 6.1 BOPPPS 阶段统一
使用 Prisma `BopppsStage` 枚举：
- `BRIDGE_IN` / `OBJECTIVE` / `PRE_ASSESSMENT` / `PARTICIPATORY` / `POST_ASSESSMENT` / `SUMMARY`

### 6.2 预置教案
- 预置教案统一放在 `src/features/teacher/preset-lessons/presets`。
- 预置教案以 `PresetLessonConfig` 描述，可通过 API 克隆为教师教案。
- 预置教案必须只引用 `registryId`，严禁硬编码路径。

## 7. Legacy 与弃用策略

- `LessonManifest` 引擎只保留为实验/历史代码，不作为新增课次主干。
- `lesson-xx/manifest.ts` 仅用于内容原型或迁移过渡，不作为课堂运行入口。
- `/interactive-learning` 路由仅用于资源浏览与单页演示，真实课堂必须走教案播放链路。

## 8. Lesson 02/06/13 整改标准

- 以预置教案 + `TeachingResource` 作为标准入口，支持教师一键克隆。
- 所有课程组件适配 `BaseWidgetProps` 并接入互动上下文。
- 课程流程统一使用 `BopppsStage` 枚举并通过 `LessonItem` 编排。
- 课程内配置通过 `overrideConfig` 注入，不再写入散落的 `manifest.ts`。

## 9. 落地清单（未来新增课次必须遵循）

1) 开发互动/仿真组件并注册到 `resource-registry`。
2) 创建/更新 TeachingResource（脚本或后台）。
3) 编写预置教案（或通过编排器生成）并验证 `overrideConfig` 生效。
4) 确认组件事件与进度上报正常。
5) 课堂播放通过 `LessonPlan` + `ClassSession` 运行。
