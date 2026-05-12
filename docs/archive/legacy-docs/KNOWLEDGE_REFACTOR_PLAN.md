# 知识图谱原子化与互动课程流重构计划

## 📅 项目元数据
- **开始日期**: 2025-12-30
- **当前状态**: Phase 1 (进行中)
- **分支**: `feature/knowledge-playlist-refactor`

## 🎯 目标
1. **原子化 (Atomicity)**: 将知识点转化为带有布鲁姆认知维度和多媒体元数据的独立卡片。
2. **编排 (Orchestration)**: 实现“互动课程流 (Playlist)”，允许教师组合知识卡片和仿真任务。
3. **复用 (Reuse)**: 将现有的 3D 知识图谱组件改为从数据库动态加载数据。

---

## 🏗 Phase 1: 数据层重构 (Database & Schema)
*目标：建立支持复杂知识属性和课程编排的数据库模型。*

- [x] **1.1 Prisma Schema 升级**
    - [x] 添加 `BloomLevel` (布鲁姆认知维度) 和 `KnowledgeDimension` (知识维度) 枚举。
    - [x] 更新 `KnowledgeNode` 模型，增加 `metadata` (JSON), `tags` 字段。
    - [x] 新增 `CoursePlaylist` 和 `PlaylistItem` 模型，支持有序排列知识点和任务。
    - [x] **验收标准**: `npx prisma migrate dev` 成功执行，生成的 SQL 符合预期。

- [x] **1.2 数据迁移脚本 (Seeding)**
    - [x] 编写 `scripts/db/seed-knowledge.ts` (实际使用 .mjs)。
    - [x] 将 `src/components/knowledge/data/lesson-knowledge-cards.ts` 中的静态数据迁移到数据库。
    - [x] **验收标准**: 运行脚本后，数据库中 `KnowledgeNode` 表有数据，且包含正确的元数据。

- [x] **1.3 后端 API 开发**
    - [x] 创建 `src/app/api/knowledge/nodes/route.ts` (GET: 获取所有节点, 支持筛选)。
    - [x] 创建 `src/app/api/knowledge/playlists/route.ts` (CRUD 播放列表)。
    - [x] **验收标准**: Postman 测试通过，能按 `bloomLevel` 筛选节点。

## 🧩 Phase 2: 前端原子化组件 (Frontend Atomicity)
*目标：创建通用的知识展示组件，并对接图谱。*

- [x] **2.1 通用知识卡片组件 (`KnowledgeCard`)**
    - [x] 设计支持 Markdown、视频、公式 (LaTeX) 的渲染组件。
    - [x] 集成 Shadcn/ui 的 `Card` 组件。
    - [x] **验收标准**: 在 Storybook 或测试页中能正确渲染包含复杂公式和图片的卡片。

- [x] **2.2 知识图谱动态化**
    - [x] 重构 `KnowledgeGraphSystem`，移除硬编码数据，改为使用 SWR 或 React Query 调用 API (使用了 useEffect)。
    - [x] 更新侧边栏筛选逻辑，支持新的维度筛选 (API支持，前端基础支持)。
    - [x] **验收标准**: 页面加载时无报错，3D 图谱正确显示数据库中的节点。

## 🎬 Phase 3: 互动课程流 (Interactive Playlist)
*目标：实现教师编排和学生播放功能。*

- [x] **3.1 课程流编辑器 (Builder)**
    - [x] 创建拖拽式界面 (简化版排序)，左侧为知识库，右侧为时间轴。
    - [x] 支持添加知识点和仿真任务 (`Mission`) (UI已支持，逻辑已连接)。
    - [x] **验收标准**: 能创建一个包含3个知识点和1个仿真任务的 Playlist 并保存。

- [x] **3.2 课堂播放器 (Player)**
    - [x] 开发全屏播放模式。
    - [x] 实现简单的“上一页/下一页”导航。
    - [x] **验收标准**: 能流畅播放 Phase 3.1 创建的 Playlist。

---

## ✅ 测试与发布
- [ ] **集成测试**: 验证从数据库读取 -> 图谱展示 -> 点击详情的全链路。
- [ ] **性能测试**: 确保加载 500+ 个节点时页面不卡顿。
- [ ] **文档更新**: 更新 `README.md` 和 API 文档。

---

## 📝 变更日志 (Changelog)
- 2025-12-30: 创建计划文档，初始化分支。
