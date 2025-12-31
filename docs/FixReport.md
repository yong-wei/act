# 整改计划与进展跟踪

本文件用于记录“课程编排体系与资源体系割裂问题”的整改计划与阶段进展。

## 目标与原则

- 以数据库作为唯一资源源头，知识卡片与教学资源统一纳管。
- 互动资源拆解为单页应用，可在编排器中自由组合。
- 课程唯一入口为教师后台编排器与课堂码；固定结构课程播放器废弃。
- 每完成一个阶段必须进行全量测试，测试通过后提交变更，再进入下一阶段。

## 阶段规划

### 阶段 A：数据模型统一

- **范围**：
  - `LessonItem` 支持 `KnowledgeNode` 直引（`itemType` + `knowledgeNodeId`）。
  - 教学资源维持 `TeachingResource`，知识卡片维持 `KnowledgeNode`。
  - 知识卡片扩展媒体以路径/附件列表形式存储（DB 仅存路径或附件列表）。
- **产出**：
  - Prisma 迁移文件。
  - 类型定义与 API 结构对齐。
- **完成标准**：
  - `LessonItem` 可同时支持资源与知识卡片引用（互斥校验）。
  - DB 中知识卡片可关联附件路径。
- **进展**：
  - 已更新 `prisma/schema.prisma`：新增 `LessonItemType`，并支持 `TeachingResource` / `KnowledgeNode` 的互斥引用。
  - 已更新 `/api/lesson-plans` 与 `/api/lesson-plans/[id]` 支持 `itemType` 与 `knowledgeNodeId`。
  - 已生成 Prisma 迁移文件（`prisma/migrations/20251231000000_lesson_item_knowledge_node`）。
  - `prisma migrate dev --create-only` 因数据库权限不足失败，迁移文件改为手动生成。

### 阶段 B：编排器与播放器对齐

- **范围**：
  - 编排器资源库分为“教学资源”“知识卡片”两类入口。
  - 播放器渲染 `KnowledgeNode` 类型。
  - 课堂播放器保留；固定结构课程播放器下线。
- **产出**：
  - `/admin/lesson-plans` 资源库可直接拖拽知识卡片。
  - 学生/教师端播放正常。
- **完成标准**：
  - 教案保存后可按 `itemType` 正确播放。
- **进展**：
  - 编排器资源库支持知识卡片拖拽，保存时写入 `itemType/knowledgeNodeId`。
  - 播放器支持渲染 `KnowledgeNode`，课堂端资源包含 `knowledgeNode`。

### 阶段 C：互动资源单页化

- **范围**：
  - 拆解 `Lesson02System`、`PhysicsModelingSystem` 为单页互动组件。
  - DB 中登记互动资源，`registryId/componentKey` 指向组件目录表。
- **产出**：
  - 组件目录表仅做组件映射，不再注册内容。
- **完成标准**：
  - 编排器可组合单页互动资源完成课堂。
- **进展**：
  - 新增 Lesson 02 与 Physics Modeling 的单页资源封装组件。
  - 组件目录表补齐单页资源映射，供 `TeachingResource.registryId` 引用。

### 阶段 D：全量迁移旧内容

- **范围**：
  - 旧知识卡片（`lesson-knowledge-cards.ts`）全量导入 DB。
  - 旧互动组件转换为 DB 资源记录。
  - `content/concepts`、`content/quizzes` 作为知识点附件/引用。
- **产出**：
  - 迁移脚本与迁移日志。
- **完成标准**：
  - DB 与资源目录一致，无缺失或重复。
- **进展**：
  - 增加 `scripts/seed-legacy-content.mjs`，可一键同步知识卡片与教学资源。
  - 知识卡片附带 MDX/测验路径作为扩展媒体。

### 阶段 E：互动学习入口收敛

- **范围**：
  - 互动学习页面仅展示“单页互动资源”（不包含三维仿真）。
  - 多页面课程入口移除或降级为演示页。
- **产出**：
  - 互动学习入口与资源库一致。
- **完成标准**：
  - 互动学习不再作为课程入口。
- **进展**：
  - 互动学习入口改为从数据库加载单页互动资源列表。
  - 新增 `/interactive-learning/resources/[id]` 单页资源查看入口。

### 阶段 F：知识卡片数据源统一为数据库

- **范围**：
  - 互动学习 Lesson 02 的知识卡片从 `/api/knowledge/nodes` 拉取。
  - 移除前端对静态 `getKnowledgeCard` 的依赖。
  - 知识卡片入口增加加载/不可用状态。
- **产出**：
  - 互动学习阶段改为 `useKnowledgeCard` 钩子读取数据库。
  - `/api/knowledge/nodes/[id]` 提供单卡片读取。
- **完成标准**：
  - Lesson 02 的知识卡片全部来自数据库。
  - 编排器与互动学习不再依赖静态知识卡片数据。
- **进展**：
  - Lesson 02 各阶段改为 `useKnowledgeCard` 获取知识卡片。
  - 知识卡片按钮在加载/不可用时禁用展示。
  - 移除未使用的 `src/pages/_document.tsx` 以避免构建时的 pages 冲突。

## 测试与提交要求（每个阶段完成后执行）

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:integration`
- 所有测试通过后，提交并推送到当前分支。

## 进展追踪

| 阶段 | 状态 | 开始日期 | 完成日期 | 说明 |
| --- | --- | --- | --- | --- |
| A | 已完成 | 2025-12-31 | 2025-12-31 | 已补齐 schema、API 与迁移文件 |
| B | 已完成 | 2025-12-31 | 2025-12-31 | 编排器与播放器对齐 |
| C | 已完成 | 2025-12-31 | 2025-12-31 | 互动资源单页化 |
| D | 已完成 | 2025-12-31 | 2025-12-31 | 全量迁移旧内容 |
| E | 已完成 | 2025-12-31 | 2025-12-31 | 互动学习入口收敛 |
| F | 已完成 | 2025-12-31 | 2025-12-31 | 知识卡片数据源统一为数据库 |
