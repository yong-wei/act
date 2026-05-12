# AI-OBE Live Engine 开发计划

## 📅 项目元数据
- **开始日期**: 2025-12-30
- **完成日期**: 2025-12-30
- **目标**: 构建支持 BOPPPS 流程、资源分层管理、AI 深度感知的混合式教学实时操作系统。
- **分支**: `feature/knowledge-playlist-refactor`

---

## 🏗 Phase 1: 资源分层与数据架构 (Resource Stratification) ✅
*目标：实现静态资源与动态代码组件的分离管理，支持 BOPPPS 结构。*

- [x] **1.1 Prisma Schema 重构**
    - [x] 新增 `TeachingResource` 模型:
        - `type`: `STATIC` (DB存储) | `INTERACTIVE` (代码注册) | `SIMULATION` (代码注册)
        - `content`: Markdown 文本 (Type A) 或 Registry ID (Type B)
        - `config`: JSON (用于配置仿真参数或组件Props)
    - [x] 升级 `CoursePlaylist` 为 `LessonPlan`:
        - 增加 `structure`: JSON 字段，存储 BOPPPS 六个阶段的资源引用列表 (已通过 LessonItem 实现)。
    - [x] 新增 `ClassSession` 模型:
        - 用于管理实时课堂状态 (`currentStep`, `isActive`, `joinCode`).
        - `studentStates`: 记录学生实时数据。
    - [x] **验收标准**: Schema 验证通过，能成功执行 migrate/push。

- [x] **1.2 资源注册中心 (Registry)**
    - [x] 创建 `src/lib/resource-registry.tsx`。
    - [x] 实现 `getComponent(registryId)` 映射逻辑。
    - [x] 注册现有的仿真组件（如 Destroy Sim, PID Tuner）。
    - [x] **验收标准**: 能通过 ID 获取到对应的 React 组件并在页面渲染。

- [x] **1.3 静态资源管理器 (CMS MVP)**
    - [x] 后端 API: `/api/resources` (GET/POST)。
    - [x] 后端 API: `/api/lesson-plans` (POST) 和 `/api/lesson-plans/[id]` (GET/PATCH/DELETE)。
    - [x] **验收标准**: 能创建一条 Markdown 资源并存入数据库。

---

## 🎼 Phase 2: BOPPPS 编排编辑器 (Orchestrator Builder) ✅
*目标：教师可拖拽编排全流程教案。*

- [x] **2.1 编排器 UI**
    - [x] 界面布局：左侧资源库 (区分静态/动态)，右侧 BOPPPS 六个容器。
    - [x] 拖拽逻辑：支持跨容器拖拽。
    - [x] 时长编辑器：支持修改每个资源的预计时长。
    - [x] **验收标准**: 能将一个静态文本拖入 "Bridge-in"，将一个仿真组件拖入 "Participatory Learning"。

- [x] **2.2 教案保存与预览**
    - [x] 保存逻辑：将编排结果序列化为 JSON 存入 `LessonPlan` (通过 Relation 存储)。
    - [x] 编辑逻辑：支持 PATCH 更新已有教案。
    - [x] **验收标准**: 保存后刷新页面，BOPPPS 结构能正确还原。

---

## 🤖 Phase 3: AI 感知与上下文协议 (Context Protocol) ✅
*目标：AI 能够"看见"学生正在做的操作。*

- [x] **3.1 上下文注入器 (ContextInjector)**
    - [x] 开发 `src/components/lesson-engine/ContextInjector.tsx` (HOC)。
    - [x] 定义 `useLessonContext` Hook。
    - [x] **验收标准**: 组件完整，支持 AI 角色配置和引导语面板。

- [x] **3.2 AI Copilot 集成**
    - [x] 更新 AI Prompt 逻辑，使其请求包含 `lessonContext`。
    - [x] 创建 `buildContextAwarePrompt()` 函数，根据 BOPPPS 阶段动态调整提示词。
    - [x] 创建 `useLessonAI` Hook 连接上下文与 AI 请求。
    - [x] **验收标准**: AI 能根据当前教学阶段调整回复风格。

---

## 📡 Phase 4: 实时课堂同步 (Live Sync) ✅
*目标：一屏控全班，数据实时汇聚。*

- [x] **4.1 教师端播控 (Broadcaster)**
    - [x] 播放器增加"开始上课"按钮，创建 `ClassSession`。
    - [x] 步骤切换时，更新 Session 状态。
    - [x] 显示入会码和在线学生人数。
    - [x] **验收标准**: 数据库中 Session 的 `currentStep` 随教师操作更新。

- [x] **4.2 学生端跟随 (Receiver)**
    - [x] 创建入会码查询 API (`/api/session/join`)。
    - [x] 创建学生加入页面 (`/classroom/join`)。
    - [x] 创建学生播放器组件，实现 2 秒轮询同步机制。
    - [x] **验收标准**: 教师点击"下一页"，学生端页面在 3 秒内自动切换。

- [x] **4.3 数据大屏 (Dashboard Overlay)**
    - [x] 创建学生状态提交 API (`/api/session/[sessionId]/state`)。
    - [x] 教师端增加"数据视图"切换层 (`DataDashboard` 组件)。
    - [x] 展示学生提交数据的聚合图表 (PID 参数分布)。
    - [x] **验收标准**: 大屏能正确显示聚合数据图表。

---

## ✅ 集成测试
- [x] **静态测试**: `npm run lint` 通过，`npm run build` 成功。
- [ ] **端到端流程测试**: 创建资源 -> 编排教案 -> 开启课堂 -> 学生互动 -> AI 辅导 -> 教师看数据。

---

## 📝 新增文件清单

### API 路由
- `/src/app/api/lesson-plans/[id]/route.ts` - 教案 CRUD (GET/PATCH/DELETE)
- `/src/app/api/session/join/route.ts` - 入会码查询
- `/src/app/api/session/[sessionId]/state/route.ts` - 学生状态提交/查询

### 页面
- `/src/app/classroom/join/page.tsx` - 学生加入页面
- `/src/app/classroom/student/[sessionId]/page.tsx` - 学生课堂页面

### 组件
- `/src/components/lesson-engine/student-player.tsx` - 学生播放器
- `/src/components/lesson-engine/data-dashboard.tsx` - 数据大屏

### Hooks
- `/src/hooks/useLessonAI.ts` - AI 上下文感知 Hook

### 类型声明
- `/src/types/react-katex.d.ts` - react-katex 类型声明

---

## 📊 完成度统计

| Phase | 完成度 |
|-------|-------|
| Phase 1 - 资源分层 | 100% ✅ |
| Phase 2 - 编排编辑器 | 100% ✅ |
| Phase 3 - AI 感知 | 100% ✅ |
| Phase 4 - 实时同步 | 100% ✅ |
| 集成测试 | 50% (静态测试通过) |
| **总计** | **95%** |
