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

# [act.just.edu.cn] recent context, 2026-05-12 3:02pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (6,176t read) | 561,335t work | 99% savings

### Apr 12, 2026
S248 Chinese language request received - continue monitoring primary session (Apr 12 at 8:26 PM)
### Apr 16, 2026
S249 Session initiated with greeting (Apr 16 at 3:07 PM)
S250 Computer Use testing progress summary - application state access denied (Apr 16 at 7:41 PM)
### Apr 21, 2026
S251 User requested refinement (润色) of 5-1 lecture notes (讲义) for the Automatic Control Principles course; primary session completed targeted polishing of the handout.md file. (Apr 21 at 10:17 AM)
### May 2, 2026
S252 Continue polishing the 5-2 lecture handout (course-content/authoring/lessons/5-2/design/handout.md) for the Automatic Control Principles course, focusing on wording refinement, consistency, and formatting checks (May 2 at 1:27 PM)
S254 竞技场报错修复并完成计划W (May 2 at 1:50 PM)
### May 11, 2026
S255 用户请求注销登录状态 (May 11 at 8:31 AM)
S256 完成 4-5 讲义的润色并回写至原文件 (May 11 at 12:41 PM)
### May 12, 2026
S257 确认并评估 CLAUDE.md 文档质量，提出更新建议 (May 12 at 11:52 AM)
33162 1:30p 🔵 数据库完整性验证通过
33163 " 🔵 4-4 章节活动卡定义已完整列出
33164 " 🔵 StudentStepResponse 数据结构在前后端统一使用
33165 1:31p 🔴 TypeScript 编译错误阻断构建
33166 1:32p 🔵 完成 4-4 单元数据治理阻断检查
33167 1:33p ✅ 本地仓库出现多项未提交修改
33168 1:39p 🔵 4-4 单元数据治理分析报告要点
33169 1:40p 🔵 Prisma 模式验证通过
33170 " 🔵 session-reports.ts 中关键数据治理概念实现
33171 1:42p 🔵 读取 review-changes 技能文档
33172 " 🔵 读取 review-changes 技能文档
33173 " 🔵 获取代码图统计信息
33174 " 🔵 工作区文件变更状态
33175 " 🔵 获取代码审查上下文
33176 " 🔵 获取审查上下文高风险概览
33178 1:43p 🔵 课堂画像与长期画像字段实现细节
33177 " 🔵 搜索 Prisma 模型定义
33179 " 🔵 检查 InteractionLog 与 StudentStepResponse 关联定义
33180 " 🔵 4-4 课堂数据治理分析报告概览
33181 1:44p 🔵 数据治理 ingest 测试用例概览
33182 " 🔵 单元测试全部通过
33183 " 🔵 扩展单元测试全部通过
33184 " 🔵 单元测试全部通过
33185 1:45p 🔴 运行临时 TypeScript 脚本失败
33186 " 🔵 课堂会话与治理报告数据核对
33187 1:46p 🔵 Session PATCH API 实现概览
33188 1:48p 🔵 StudentStepResponse 与 InteractionLog 的阻断与非阻断问题定位
33190 " 🔴 单元测试发现 InteractionLog 仍保留伪造 sourceLogId
33189 " 🔵 不可变答题事实源实现确认
33191 1:49p 🔵 InteractionLog 伪造 sourceLogId 剥离测试通过
33192 " 🔵 课堂画像与长期画像分离目标已达成
33194 " ⚖️ D 项收口判断
33193 1:50p 🔵 LearningFact 与 sourceLogId 追踪链路文档化
33195 " 🔵 InteractionLog 入库前剥离不可信 sourceLogId 实现确认
33196 1:51p 🟣 attachSourceLogIds 实现可信 sourceLogId 绑定
33197 " 🔵 InteractionLog、StudentStepResponse 与 LearningFact 均已剥离伪造 sourceLogId
33198 1:55p 🔵 全局 CLAUDE.md 内容已检视
33199 1:56p 🔵 关键源码目录仍然存在
33200 1:57p ✅ 代码变更已提交并部署到服务器
33201 " 🔵 读取 server-ops 技能文档
33202 " 🔵 读取 remote-deploy.sh 部署脚本
33203 1:58p 🔵 读取 backfill-unit-4-4-governance.ts 脚本
33204 2:51p 🔵 检查 CLAUDE.md 第7行的空白字符
33206 " 🔵 检查 course-content/CLAUDE.md 快速命令章节的字符显示
33205 " 🟣 完成远端数据库导出并导入本地用于数据治理分析
33207 2:52p ✅ 执行项目构建命令
33209 2:53p ✅ 更新 course-content/CLAUDE.md 日期与快速命令章节
33208 " 🔵 项目完整构建并生成 WASM 包
33210 2:54p 🔵 更新 CLAUDE.md 文档内容
33211 " ✅ 批量更新 CLAUDE.md 中的 MCP、Python 示例与 lib 结构章节
S258 完成对 CLAUDE.md 与 course-content/CLAUDE.md 的多项内容更新 (May 12 at 2:54 PM)
**Investigated**: 检查了文档中日期、Quick Commands、MCP 资源、Python 仿真图章节以及 lib 目录结构的现有内容并定位了需要替换的文本块。

**Learned**: 文档中存在过时的日期、乱码的快速命令示例以及冗余的 MCP 规则；同时发现 lib 目录缺少若干关键模块，需要补全。

**Completed**: 1) 将 `currentDate` 更新为 2026-05-12。2) 为 Quick Commands 区块添加 `validate-manifest.py` 与 `check-media-refs.py`。3) 将 MCP 资源章节浓缩为关键要点并更新资源列表。4) 替换 Python 仿真图章节为统一的脚本入口并简化输出说明。5) 扩展 lib 目录结构，新增 6 个模块（data-governance、classroom-analytics、classroom-observability、course-runtime 等）。6) 所有修改已写回文件并确认行数变化。

**Next Steps**: 正在验证文档更新后的渲染效果，确保新增脚本路径可执行；随后计划同步更新相关 README 与 CI 配置，以便新模块在构建流水线中被正确引用。


Access 561k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>