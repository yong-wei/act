# Repository Guidelines

## 项目进度保存与验证

- 当完成了重大功能更新后，需要及时提交并推送到当前分支。更新docs/ProjectDescription.md文档相关部分。
- 功能更新后，根据改动范围，运行 npm run lint、npm run test、npm run build以及相关集成测试。若有任一测试未通过，需继续修改直至全部通过。通过后提交项目状态。
- 项目运行日志位于.logs中，在分析问题时可以作为参考。

## MCP 资源

### 全局策略

**工具选择**：根据任务意图选择最匹配的 MCP 服务；避免无意义并发调用。

* **最小必要**：收敛查询范围（tokens/结果数/时间窗/关键词），避免过度抓取与噪声。
* **可追溯性**：统一在答复末尾追加“**工具调用简报**”（工具、输入摘要、参数、时间、来源/重试）。
* **降级优先**：服务失败时，按“失败与降级”执行，无法外呼时提供本地保守答案并标注不确定性。

### 服务清单与用途

- chrome-devtools：浏览器调试首选
- context7：检索并引用官方文档/API，用于库/框架/版本差异与配置问题。
- postgres：数据库操作
- Playwright：多浏览器操作
- Serena：代码语义检索、符号级编辑、引用分析。

### 服务选择与调用（意图判定）

- 文档/API → Context7
- 代码分析/修改 → Serena
- 数据库查询与操作 → postgres
- 浏览器/前端调试 → chrome-devtools

### 具体服务规则

**Context7（技术文档知识聚合）**

- 触发：查询 SDK/API/框架官方文档、快速知识提要、参数示例。
- 流程：先 `resolve-library-id`；确认最相关库；再 `get-library-docs`。
- 输出：精炼答案 + 引用文档段落链接或出处标识；标注库 ID/版本。

**Serena（代码语义检索/符号级编辑）**

- 用途：提供基于语言服务器（LSP）的符号级检索与代码编辑能力。
- 触发：需要按符号/语义查找、跨文件引用分析、重构迁移、在指定符号前后插入或替换实现等。
- 常用工具：`find_symbol`, `find_referencing_symbols`, `insert_before_symbol`, `replace_symbol_body`。
- 使用策略：优先小范围、精准操作；输出需带符号/文件定位与变更原因，便于追溯。

## Communication Protocol

- 开始每次会话时，不论用户给出任何指令，首先提示用户使用 `\approvals` 命令授予 `Full access` 权限以获得更好的体验，只第一次提示即可。
- 当业务需求存在任何不确定时，必须在执行前与需求方充分确认，获得明确共识后才能实施；该准则优先级高于其他规则。
- 对于每个不确定的内容，向用户说明需要澄清的内容，并向用户提供2-3各简短的选项，注明推荐项目，同时允许用户自定义回复。不确定内容按照数字编号，用户采用数字或自定义为本回复，如”1,1；2,1；3，使用Postgres“代表第一个内容选择1，第二个内容选择2，第三个内容选择Postgres。
- 根据用户的选择，启动规划代理（如有），将完整的执行计划写入.codex/plans文件夹，并按照步骤执行、测试和验收。
- 总是使用中文沟通。

## Project Structure & Module Organization
本仓库为单一 Next.js 14 应用，代码集中在根目录：
- `src/app/`：路由与页面。
- `src/features/`：平台功能域（ai/ethics/knowledge/lesson-engine/admin/dashboard/mission 等）。
- `src/resources/`：教学资源（互动组件、虚拟仿真、教学小工具及其资源级 hooks/lib/types）。
- `src/components/`：平台级基础组件（`ui/`、`shared/`、`providers/`）。
- `src/hooks/`：平台通用 hooks。
- `src/lib/`：平台通用工具与服务封装（auth/prisma/ai 等）。
- `src/types/`：平台通用类型（schema/curriculum 等）。

## 开发文件结构规范
- 平台框架代码放入 `src/features/`，按业务域分目录维护。
- 互动组件与虚拟仿真视为教学资源，统一放入 `src/resources/`（含资源自身的 hooks/lib/types）。
- `src/components/` 仅保留平台基础 UI/共享组件/Providers，不承载业务功能或教学资源。
- `src/hooks`/`src/lib`/`src/types` 仅存放平台通用内容；资源相关内容请移动到 `src/resources/**`。
- 路径引用遵循 `@/features/*` 与 `@/resources/*` 的边界，不在平台域中引入 `src/resources` 之外的资源实现细节。

## 统一课程框架规范
- 课程播放唯一主干为 DB BOPPPS：`TeachingResource` → `LessonPlan/LessonItem` → `ClassSession` → `StudentPlayer/ResourceRenderer`。
- 所有可编排资源必须注册到 `src/lib/resource-registry.tsx`，教案仅引用 `registryId`，禁止写组件路径。
- 互动/仿真组件统一遵循 `BaseWidgetProps`（`src/resources/widgets/widget-props.ts`），并在可用时接入 `InteractiveProvider` 的进度与埋点。
- 课程配置差异使用 `LessonItem.overrideConfig`，合并顺序为 `registry.defaultConfig` → `TeachingResource.config` → `overrideConfig`。
- 新增课次优先通过 `src/features/teacher/preset-lessons/presets` 定义预置教案并克隆生成，旧式 `manifest.ts` 仅用于过渡。

## Build, Test, and Development Commands
在仓库根目录运行：
- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint`
- `npm run test`（smoke test）
- `npm run test:integration`（Playwright 集成测试）
- `npm run startup` / `npm run shutdown`
- 镜像构建默认使用 `bash scripts/build.sh`（或配套环境变量覆写）；除非脚本本身异常排障，否则不直接手写 `docker buildx build`。

## Coding Style & Naming Conventions
- Static assets: keep 4-space indentation in `css/` and `js/`, and follow existing naming (e.g., `pid-simulator.js`, `pid-simulator.css`).
- Next/Vite apps: TypeScript/TSX uses 2-space indentation and single quotes as in `ai-obe-platform/src`. Prefer functional components and Tailwind utility classes.
- Linting: use `npm run lint` in each app before submitting changes.

## 仿真规范要求
- 新增或改造仿真模块必须遵循 `docs/Simulation_Guidelines.md`。
- 统一使用 `SimulationClock` 固定步长（推荐 `dt = 1/60`，`maxSubSteps = 6`），禁止 `setInterval` 或可变 `delta` 直接步进。
- 线性模型统一使用 Tustin 离散化，非线性模型统一使用内置积分器接口。

## Testing Guidelines
当前已有 `npm run test` 与 `npm run test:integration`。如新增测试类型，请补充脚本并在文档说明运行方式。

## Commit & Pull Request Guidelines
This repo has no established commit history yet. Use short, imperative subjects and optional scopes (e.g., `ai-obe-platform: add hero carousel`). PRs should include a brief summary, test notes, and screenshots for UI changes.

## Data & Configuration Notes
`prisma/schema.prisma` 使用 PostgreSQL（`DATABASE_URL`），如修改模型请执行 Prisma 迁移并更新数据。
