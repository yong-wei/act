# Repository Guidelines

<Skill-use>
以下技能为本项目专用技能，无法使用superpowers using skill调用，需要直接读取技能文件，并按需读取参考文件或调用脚本。
- homework-problem-authoring：制作课后作业
- interactive-design：互动课程设计
- interactive-lesson-implementation：互动课程实现
- lesson：课程资料制作
- lesson-content-review：课程内容审核
- refine：讲义润色
- server-ops：服务器操作
- syllabus-refactor：大纲重构
- agent-evolver：子代理自进化
- infograph：为知识点生成信息图
- imagen：使用最新GPT生图模型制图
</Skill-use>

<Skill-evolve>
**重要：**在使用项目专属技能执行操作时，如果遇到了问题，在尝试解决后应该将解决思路沉淀在相应技能中，避免二次踩坑。
</Skill-evolve>

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

**JavaScript REPL（Node）**

- 在能明显提升开发、调试或验证效率的场景下，优先使用 `js_repl` 完成 Node 侧临时逻辑验证、快速数据处理、日志分析、Prisma 数据核对与 Playwright 辅助自动化。
- 本项目中，`scripts/tests`、`scripts/db`、`.logs`、`prisma/schema.prisma`、资源注册与预置教案一致性检查等场景，优先考虑使用 `js_repl` 做一次性检查或小范围验证。
- `js_repl` 适合快速读取文件、统计数据、拼装一次性脚本、验证 Node 依赖与数据库查询结果；不适合作为整个 Next.js/TypeScript 应用的通用运行入口。
- 已验证边界：`js_repl` 可稳定处理 Node 内置模块、项目文件读取和包依赖导入；但对本地 `.mjs/.js` 文件的直接导入存在限制，若文件内部依赖顶层静态 `import`，可能无法像常规 Node 一样直接执行。
- 因此，涉及仓库既有脚本、完整测试链路、Next.js 构建启动、`tsx`/`node` 直接执行更可靠的场景，优先使用 `npm run ...`、`node`、`npx tsx` 或 MCP 专用工具，不强行改写为 `js_repl`。

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

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. Use
`code-review-graph` as the default first-pass workbench for code review,
execution-flow tracing, impact analysis, and cross-file relationship
questions.** In this repository, CRG is most valuable when the task is
larger than a narrow single-symbol lookup: it surfaces affected flows,
untested hotspots, bridge nodes, and caller/callee structure faster than
manually stitching together `rg` output.

**IMPORTANT: In Codex, some `code-review-graph` tools are lazily exposed.**
If the current session only shows a subset of CRG tools, do **not** assume
the others are unavailable or removed upstream. First use `tool_search` with
queries such as `code-review-graph semantic_search_nodes query_graph
get_impact_radius get_affected_flows list_flows get_flow
get_architecture_overview list_communities refactor_tool` to load the
deferred schemas, then call the corresponding `mcp__code_review_graph__.*_tool`.

### When to use graph tools FIRST

- **Code review**: `detect_changes` + `get_review_context` should be the default first pass
- **Execution-flow questions**: `get_affected_flows`, `list_flows`, and `get_flow`
- **Cross-file tracing**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture and hotspots**: `get_architecture_overview`, `list_communities`, `get_bridge_nodes`
- **Impact triage**: `get_affected_flows` first, then `get_impact_radius` as a secondary estimate

### When direct `rg` is fine

- The target file and symbol are already known
- You only need to confirm a literal string, path, or one local helper
- The question is narrower than “which flow / which cross-file chain / what blast radius”

In other words: do not force CRG into trivial single-file lookups. Use it
to shrink search space and reveal structure; then switch to `rg`, `sed`,
`git diff`, and tests for the evidence pass.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_affected_flows` | Finding which execution paths are impacted |
| `get_flow` / `list_flows` | Inspecting actual execution paths |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |
| `get_impact_radius` | Secondary blast-radius estimate; verify manually when the worktree is noisy |

### Workflow

1. Start with `get_minimal_context`.
2. If a needed CRG tool is missing from the current session, use `tool_search`
   to load it before falling back.
3. For review tasks, use `detect_changes`, then `get_review_context`.
4. For impact questions, use `get_affected_flows` before `get_impact_radius`.
5. For relationship questions, use `query_graph`; for concrete paths, use `get_flow`.
6. Use `query_graph` pattern="tests_for" to check coverage gaps on changed logic.
7. After CRG narrows the search space, switch to `rg`, `sed`, `git diff`, and tests.

### Reliability Notes

- In this repository, `detect_changes`, `get_review_context`, `get_affected_flows`,
  `query_graph`, and `get_flow` were consistently the highest-value CRG tools.
- `get_impact_radius` can be noisy in a dirty worktree; treat it as a hint,
  not as the final answer.
- Narrow targeted lookups may still be faster with plain `rg`; CRG should win
  on structure, not on every trivial query.


<claude-mem-context>
# Memory Context

# [act.just.edu.cn] recent context, 2026-05-09 3:41pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,104t read) | 1,390,495t work | 99% savings

### Apr 7, 2026
S241 Created handout refinement skill with student-facing tone guidelines and course alignment (Apr 7 at 7:13 PM)
S242 Started processing 2-1 handout through refine skill with student-facing transformation (Apr 7 at 8:16 PM)
S245 Control systems course handout refinement completed and task marked as finished (Apr 7 at 8:28 PM)
S246 Refined 2-2 lecture handout with comprehensive enhancements (Apr 7 at 11:12 PM)
### Apr 8, 2026
S247 Authentication system investigation initiated (Apr 8 at 7:17 AM)
### Apr 12, 2026
S248 Chinese language request received - continue monitoring primary session (Apr 12 at 8:26 PM)
### Apr 16, 2026
S249 Session initiated with greeting (Apr 16 at 3:07 PM)
S250 Computer Use testing progress summary - application state access denied (Apr 16 at 7:41 PM)
### Apr 21, 2026
S251 User requested refinement (润色) of 5-1 lecture notes (讲义) for the Automatic Control Principles course; primary session completed targeted polishing of the handout.md file. (Apr 21 at 10:17 AM)
### May 2, 2026
S252 Continue polishing the 5-2 lecture handout (course-content/authoring/lessons/5-2/design/handout.md) for the Automatic Control Principles course, focusing on wording refinement, consistency, and formatting checks (May 2 at 1:50 PM)
### May 8, 2026
32184 11:04p 🔵 content-renderers.tsx 核心渲染逻辑提取：公式、表格、模块类型映射与公式提取逻辑确认
32195 " 🔵 activity-renderers.tsx核心互动活动渲染逻辑提取：学生/教师端渲染、参数控制、公式归一化与作答统计逻辑确认
32188 " 🔵 4-3互动运行时清单（interactive-manifest.json）片段提取：包含给定滤波结构图、活动卡与公式集配置
32189 " 🔵 4-3互动课实现目录下无独立activity-renderers测试文件，与前期tests_for查询结果一致
32199 " 🔵 4-3 Interactive Lesson Formula/Parameter Configurations Confirmed Across Contract, Manifest, and Implementation
32194 " 🔵 4-3 Related Test Files Limited to Two Course-Level Files, No Renderer-Specific Tests Found
32203 " 🔵 Major Uncommitted Changes to 4-3 Core Files Revealed via Git Diff: Contract Version Bump, Step Restructuring, and Teacher Control Updates
32205 " 🔵 content-renderers.tsx公式提取、表格查找与渐进显影逻辑提取：多源回退解析与渐进显影项构造确认
32204 " 🔵 activity-renderers.tsx 参数集与作答逻辑深度提取：parameter_set处理、学生端草稿管理、教师端控制按钮实现确认
32207 " 🔵 4-3 Core Files Show Pervasive Disturbance Feedforward Configuration, No Step-14 Defined, Partial Search Term Matches
32208 " 🔵 Interactive-Manifest-Runtime Tests for formula_set and parameter_set Directly Mirror 4-3 Lesson Content
32099 " 🔵 Lines 1515-1765 of interactive-manifest-runtime.test.tsx Validate Shared Reveal, Drag-Match, and Teacher Control Logic
32209 " 🔵 content-renderers.tsx公式注释、符号提取与课程目标/路径图组件逻辑提取：关联4-3公式渲染与步骤布局组件
32212 " 🔵 activity-renderers.tsx 活动卡生成、答案格式化与互动类型注册逻辑提取：覆盖4-3全互动场景
32211 " 🔵 4-3 interactive-manifest.json Step-14 完整定义确认：扰动前馈参数补偿配置与前后端实现完全对齐
32210 11:05p 🔵 Interactive-Manifest-Runtime Tests Validate formula-card Rendering and Teacher-Side Parameter Submission Formatting for 4-3 Scenarios
32219 " 🔵 content-renderers.tsx公式渲染全链路提取：类型定义、核心函数、组件实现与模块注册确认
32215 " 🔵 content-renderers.tsx Formula Rendering Logic Mapped: getFormulaItems, formulaNotes, FormulaCard, and Registry Registration Confirmed
32216 " 🔵 Interactive-Manifest-Runtime Tests Confirm formula-card Rendering Without Errors for 4-3-Aligned Formula Content
32218 " 🔵 4-3 Student Page Initialization and Activity Rendering Logic Confirmed: Workspace Params, AI Context, Step Manifest Alignment
32220 " 🔵 step-panels.tsx 扰动前馈面板默认参数与控件配置确认：与manifest、测试值完全对齐
32225 " 🔵 activity-renderers.tsx Answer Formatting and Teacher-Side Logic Mapped: Submission Sync, Parameter Set Handling, and Teacher Dashboard Support
32226 " 🔵 unit-4-3-course.ts Specified Line Range (2398-2420) Contains No Content
32229 " 🔵 unit-4-3-ai-contexts.ts 指定行范围无匹配：1508-1520行无内容，需调整行号定位
32231 " 🔵 Teacher-Side Answer Aggregation and Summary Logic in activity-renderers.tsx: TeacherCardOptions, aggregateCardAnswers, TeacherCardAnswerSummary Extracted for 4-3 Teacher Dashboard Support
32234 " 🔵 4-3 工作区参数状态仅在student-page.tsx匹配，扰动前馈参数关键词未在其他三核心文件命中
32233 " 🔵 unit-4-3-course.ts与unit-4-3-ai-contexts.ts实际行数确认：远小于此前查询的行号范围
32235 " 🔵 unit-4-3-ai-contexts.ts 全量内容提取：AI上下文生成逻辑、配置字段与依赖关系确认
32238 " 🔵 student-page.tsx 学生端权限控制与埋点逻辑提取：活动发布、浏览权限、教师揭示进度与步骤追踪
32105 11:06p 🔵 Audit of 4-3 Interactive Course Runtime Implementation Completed
32242 " 🔵 step-panels.tsx 参数面板回调链路确认：默认参数上报、滑块变更触发WorkspaceParameterChange
32243 11:26p 🔵 Primary session received new request to update 4-3 interactive course design per latest draft
32248 11:28p 🔵 Primary session receives request to update 4-3 interactive course design per latest draft
32281 11:36p 🟣 Implemented parameter_set answer parsing and formatting for activity renderers
32289 11:39p 🔵 4-3 lecture notes confirmed heavily revised, interactive course design restart requested
### May 9, 2026
32330 12:13p ✅ 检查并修正讲义4-4与之前内容的一致性
32331 12:18p ✅ 修正讲义4-4与4-2/4-3内容不一致问题
32332 12:21p ✅ 同步4-3互动课程作者态到运行态并修复旧资源引用
32333 12:24p ✅ 移除4-4课程审查清单中的交互组件并修正时间戳
32338 12:33p 🔵 课程4-4审查报告生成及检查
32336 " ✅ 讲义内容审查与修正
32339 1:03p 🔵 课程4-4审查报告显示所有检查通过
32349 1:55p 🔵 Untitled
32350 2:01p 🔵 [**title**: PDF抽查渲染方案更新]
32351 2:04p 🔵 [**title**: 发现技能使用文档]
32352 2:13p 🔴 修复课堂结束后治理数据的最终化遥测和快照入队
32353 " 🔵 新增调试技能文档 debug-issue
32354 2:51p 🔵 代码变更审查结果
32355 2:56p 🟣 实现基于课程标题的路由解析与链接生成
32356 3:06p ✅ 为表6添加PDF列宽注释

Access 1390k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>