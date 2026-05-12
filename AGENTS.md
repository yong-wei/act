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

## 长期记忆入口

- 项目长期记忆正式入口为 `docs/memory/`，初始化时优先读取 `docs/memory/00-index.md` 与 `docs/memory/02-recent-summary.md`，再按 `docs/memory/01-reading-map.md` 进入具体主题。
- `docs/memory/CHATGPT_CONTEXT.md` 是面向网页版 ChatGPT GitHub 连接器的上下文入口；项目结构显著变化后，运行 `python3 "${CODEX_HOME:-$HOME/.codex}/skills/memory-maintenance/scripts/update_chatgpt_context.py"` 刷新主干文件树。
- 若发现旧版 `.codex/memory/`，不要继续双写；先按全局 `memory-maintenance` 技能判断是否迁移到 `docs/memory/`。

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

# [act.just.edu.cn] recent context, 2026-05-12 9:57pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (4,377t read) | 419,798t work | 99% savings

### May 11, 2026
S256 完成 4-5 讲义的润色并回写至原文件 (May 11 at 12:41 PM)
### May 12, 2026
S257 确认并评估 CLAUDE.md 文档质量，提出更新建议 (May 12 at 11:52 AM)
S258 完成对 CLAUDE.md 与 course-content/CLAUDE.md 的多项内容更新 (May 12 at 1:57 PM)
S259 确认可使用 claude-mem 技能并列出可用功能 (May 12 at 2:54 PM)
S260 解释 knowledge-agent 工作原理并确认是否构建特定主题语料 (May 12 at 9:05 PM)
S261 解释 learn-codebase 工作原理并评估其在当前项目的适用性 (May 12 at 9:07 PM)
33395 9:07p ✅ 更新记忆迁移执行计划
33397 9:08p 🔵 容器运行状态检查
33398 " 🔵 Worker 启动日志
33400 9:09p 🔴 新增更新 ChatGPT 上下文脚本
33399 " 🔵 健康检查接口返回
33401 " 🔴 生成 CHATGPT_CONTEXT.md
33402 " 🔴 CHATGPT_CONTEXT.md 内容预览
33403 " 🔴 更新排除前缀列表
33404 9:10p 🔴 更新后 CHATGPT_CONTEXT.md 内容预览
S262 阐述 claude-mem 各技能的使用策略与限制 (May 12 at 9:10 PM)
33405 9:11p ✅ 更新执行计划状态
33406 9:12p 🔴 更新 memory-maintenance 技能文档
33407 " 🔴 增强 validate_memory 脚本
33408 9:13p 🔴 更新 memory-file-template 文档
S263 提交所有变更并推送 (May 12 at 9:13 PM)
33409 " 🔴 更新记忆框架测试脚本
33410 9:14p 🔴 更新 docs/memory/README.md
33411 " 🔴 更新 docs/memory/00-index.md
33413 9:17p 🔴 在 AGENTS.md 中添加长期记忆入口说明
33414 " 🔴 更新 docs/README.md
33415 9:18p 🔴 更新 docs/ProjectDescription.md
33417 9:19p 🔴 更新 memory-maintenance skill 的 openai.yaml 提示
33422 9:21p 🔴 git diff 显示大量文档更新
33426 9:26p ✅ 提交并推送所有代码更改
S264 统计当前项目总代码量 (May 12 at 9:27 PM)
33427 9:30p 🔵 尝试移动 CHATGPT_CONTEXT.md 失败
33428 9:31p ✅ 成功移动 CHATGPT_CONTEXT.md 至 docs/memory
33429 " 🔄 更新脚本以使用 docs/memory 路径
33430 " 🔄 build_context 函数签名扩展以接受输出路径
33431 9:32p ✅ 更新 docs/memory/README.md 链接说明
33432 " ✅ 修正 docs/memory/00-index.md 中的描述和链接
33433 9:33p 🔵 读取 memory-maintenance 技能文档
33434 9:34p 🔴 新增 memory-maintenance 脚本 update_chatgpt_context.py
33435 9:35p ✅ 更新 AGENTS.md 中的上下文入口说明
33436 9:36p 🔴 运行 update_chatgpt_context 脚本生成入口文件
33437 " 🔴 确认项目中 CHATGPT_CONTEXT 相关引用一致性
33438 9:38p 🔴 为 update_chatgpt_context 脚本添加元数据字段
33439 " 🔴 查看生成的 CHATGPT_CONTEXT.md 前 80 行
33440 9:39p 🔵 项目代码行数统计
33441 " 🔵 Python 代码行数统计
33442 " 🔴 项目文件迁移记录
33443 9:40p 🔵 JavaScript 代码行数统计
33444 " 🔴 memory-maintenance 验证通过
33445 9:41p 🔴 项目单元测试全部通过
33446 " 🔴 已暂存所有更改
33447 " 🔴 迁移完成后的 Git 状态
33448 9:42p 🔴 提交迁移更改
33449 " 🔴 本地分支相对于远程的状态
33450 " 🔴 推送本地提交到远程分支
33451 " 🔴 推送已完成
33452 9:43p 🔴 本地分支已与远程同步
33453 9:49p 🔵 Codex 环境检查完成
S265 用户询问是否可以在任务完成后自动调用 codex:review，并提出两种实现方式 (May 12 at 9:55 PM)
33454 9:56p 🔵 codex-companion CLI 功能列表

Access 420k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
