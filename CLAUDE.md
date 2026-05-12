## 项目进度保存与验证

- 当完成了重大功能更新后，需要及时提交并推送到当前分支。更新docs/ProjectDescription.md文档相关部分。
- 功能更新后，根据改动范围，运行 npm run lint、npm run test、npm run build以及相关集成测试。若有任一测试未通过，需继续修改直至全部通过。通过后提交项目状态。
- 项目运行日志位于.logs中，在分析问题时可以作为参考。

## MCP 资源

- **Serena**: 代码语义检索、符号级编辑（`find_symbol`、`find_referencing_symbols`、`replace_symbol_body`）
- **code-review-graph**: 知识图谱，优先用于代码探索和变更影响分析（见下方）
- **chrome-devtools / Playwright**: 浏览器调试与 E2E 测试
- **postgres**: 数据库直连操作
- **选型**: 代码分析→Serena/CRG，浏览器→chrome-devtools，数据库→postgres

## Communication Protocol

- 当业务需求存在任何不确定时，必须在执行前与需求方充分确认，获得明确共识后才能实施；该准则优先级高于其他规则。
- 对于每个不确定的内容，向用户说明需要澄清的内容，并向用户提供2-3各简短的选项，注明推荐项目，同时允许用户自定义回复。不确定内容按照数字编号，用户采用数字或自定义为本回复，如”1,1；2,1；3，使用Postgres“代表第一个内容选择1，第二个内容选择2，第三个内容选择Postgres。
- 根据用户的选择，启动规划代理（如有），将完整的执行计划写入docs/plans文件夹，并按照步骤执行、测试和验收。
- 在能够使用子代理执行的情况下，优先使用子代理并行完成独立的探索、实现与验证任务；主线程只负责任务规划、结果审阅与集成，避免把上下文浪费在过程性记录中。
- 总是使用中文沟通。

## Development Commands

```bash
# Development
npm run dev              # Start dev server (port 3001)
npm run startup          # Start as background service (with PostgreSQL check)
npm run shutdown         # Stop background service

# Build & Lint
npm run build            # Production build
npm run lint             # ESLint check

# Testing
npm test                 # Smoke test
npm run test:integration # Playwright E2E tests (port 3100)

# Database
npx prisma generate      # Generate Prisma client
npx prisma db push       # Push schema to database
npx prisma migrate dev   # Run migrations

# Data Seeding
npm run seed:missions    # Seed 7 learning missions
npm run seed:demo        # Create demo user (demo@example.com / demo123456)
npm run seed:admin       # Create admin user

# Logs
npm run logs             # Tail frontend.log
npm run logs:error       # Tail error.log
```

## Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **3D Graphics**: Three.js, React Three Fiber, Drei
- **AI**: Vercel AI SDK + SiliconFlow (OpenAI-compatible, DeepSeek model)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (Credentials provider)
- **State**: Zustand (client), React hooks
- **UI**: Tailwind CSS, Radix UI, shadcn/ui
- **Math**: KaTeX, Math.js
- **Graphs**: ReactFlow, Recharts

### Key Directories
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login/register pages
│   ├── (main)/            # Dashboard, missions, profile
│   ├── interactive-learning/  # 5 learning modules
│   ├── simulations/destroyer/ # 3D ship simulation
│   ├── ai/copilot/        # AI teaching assistant
│   ├── ethics/            # Ethics decision sandbox
│   └── api/               # API routes
├── components/
│   ├── interactive-learning/  # Learning module components
│   │   ├── lesson-02/     # BOPPPS teaching flow
│   │   ├── physics-modeling/  # Drag-drop physics builder
│   │   ├── argument-principle/
│   │   ├── control-map/
│   │   └── pid-simulator/
│   ├── simulations/       # 3D destroyer simulation
│   ├── ethics/            # Ethics sandbox components
│   ├── lesson-engine/     # Curriculum engine (Zustand store)
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── auth.ts               # NextAuth configuration
│   ├── prisma.ts             # Prisma client singleton
│   ├── ai-client.ts          # SiliconFlow AI client
│   ├── ai-tools.ts           # AI function calling tools
│   ├── ai-prompt-builder.ts  # AI prompt construction
│   ├── ai-context-resolver.ts # AI context resolution
│   ├── simulation-engine.ts  # Ship physics (Nomoto model, PID)
│   ├── data-governance/      # Learning data governance & event ingestion
│   ├── classroom-analytics/  # Classroom event tracking & analytics
│   ├── classroom-observability.ts # Session observability
│   └── course-runtime.ts     # Course content runtime utilities
├── hooks/
│   ├── useShipSimulation.ts  # Core simulation hook
│   └── useEthicalMonitor.ts  # Ethics violation detection
└── types/
    └── simulation.ts      # Simulation type definitions
```

### Core Systems

**1. Simulation Engine** (`lib/simulation-engine.ts`)
- Nomoto ship model: T=55s, K=0.08
- PID controller with integral windup protection
- 5-layer wave physics model
- Ethics violation detection (rudder rate, roll angle, collision)

**2. AI Integration** (`lib/ai-client.ts`, `src/lib/ai/`, `api/ai/chat/`)
- Provider: configured by `AI_PROVIDER` (currently SiliconFlow, OpenAI-compatible)
- Model: configured by `AI_MODEL` (currently `Qwen/Qwen3.6-35B-A3B`)
- Business routes use `getConfiguredAIModel()` and do not branch on provider
- Function calling tools: get_simulation_status, set_simulation_params, analyze_result

**3. Authentication** (`lib/auth.ts`)
- Credentials provider (email/username/student number)
- Roles: STUDENT, TEACHER, ADMIN
- JWT + Session strategy

**4. Learning Modules**
- Lesson 02: BOPPPS teaching flow (Bridge→Objective→Pre-test→Participatory→Post-test→Summary)
- Physics Modeling: Drag-drop mechanical/electrical system builder
- Argument Principle: Complex plane visualization
- Control Map: Knowledge graph with ReactFlow
- PID Simulator: Real-time parameter tuning

**5. Interactive Session Framework** (`src/features/interactive/session-framework/`)
- 统一课堂会话管理（学生/教师端同步）
- 事件追踪与分析系统 (`src/lib/classroom-analytics/`)
- L2D (三域联动) 和 L-sum (可行域设计) 课程实现

**6. Course Content System** (`course-content/`)
- 自动控制原理课程教学内容包
- 作者态 (`authoring/`) 与运行态 (`runtime/`) 分离
- 详见 `course-content/CLAUDE.md`

### Database Models (Prisma)
Key models: User, StudentProfile, Mission, UserProgress, SimulationLog, EthicalLog, LearningProfile

## Coding Conventions

- TypeScript required (.ts/.tsx)
- Tailwind CSS for styling
- Functional components with named exports
- Path alias: `@/*` maps to `./src/*`
- Run `npm run lint` before commits

## Environment Variables

Required in `.env`:
```
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="..."
AI_PROVIDER="siliconflow"
AI_BASE_URL="https://api.siliconflow.cn/v1"
AI_API_KEY="sk-..."
AI_MODEL="Qwen/Qwen3.6-35B-A3B"
```

## Python 控制系统仿真工具

用于生成教学用控制系统仿真图（时域、频域、根轨迹等）。

### Python 环境

**解释器**：`/Library/Frameworks/Python.framework/Versions/3.11/bin/python3`（系统默认 `python3` 指向 3.11）

已安装库（通过 `python3 -m pip install`）：
- `control 0.10.2` — 控制系统分析与仿真（传函、状态空间、Bode、根轨迹等）
- `schemdraw 0.22` — 绘制控制系统框图和信号流图
- `matplotlib` — 绘图
- `numpy` — 数值计算
- `scipy` — 科学计算（control 依赖）

> ⚠️ 系统存在多个 Python 版本（3.9 / 3.11）。`pip3` 默认指向 3.9，`python3` 指向 3.11。
> 安装新库时请使用 `python3 -m pip install <pkg>`，运行脚本用 `python3 <script>`。

### 生成仿真图

```bash
python3 scripts/generate_control_plots.py       # 8 张时域/频域/根轨迹图 → images/
python3 scripts/control_diagrams_matplotlib.py  # 4 张框图与信号流图 → images/
```

详细输出清单与样式说明见 `docs/python-diagrams.md`。

## Testing Requirements (MANDATORY)

After completing any development task, you MUST run ALL of the following tests before considering the task complete:

### Step 1: Static Testing
```bash
npm run lint              # Must pass with no errors (warnings OK)
npm run build             # Must complete successfully
npm test                  # Smoke tests must pass
```

### Step 2: Dynamic Testing (Runtime Verification)
Use Playwright MCP tools in headless mode to verify runtime behavior:

```
1. mcp__playwright__browser_navigate → Navigate to affected pages
2. mcp__playwright__browser_snapshot → Verify page renders correctly
3. mcp__playwright__browser_console_messages → Check for errors
```

For new pages/features, navigate to the page and verify:
- Page loads without 404 or ChunkLoaderError
- No errors in browser console (warnings OK)
- Core functionality is accessible

### Acceptance Criteria
- ✅ `npm run lint` passes (no errors)
- ✅ `npm run build` succeeds
- ✅ `npm test` passes
- ✅ Affected pages load without runtime errors
- ✅ Browser console has no errors (404, ChunkLoaderError, etc.)

### Why Both Static and Dynamic Tests?
- **Static tests** (lint/build) catch syntax, type, and module resolution errors
- **Dynamic tests** (Playwright) catch runtime issues that only appear in the browser:
  - Dynamic import failures (ChunkLoaderError)
  - Missing resources (404)
  - Client-side rendering errors
  - CSS loading issues

## 远端服务器调试
SSH_TARGET: root@121.40.124.135
REMOTE_PROJECT_DIR: /home/projects/act

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

**IMPORTANT: In Codex, some `code-review-graph` tools are lazily exposed.**
If the current session only shows a subset of CRG tools, do **not** assume
the others are unavailable or removed upstream. First use `tool_search` with
queries such as `code-review-graph semantic_search_nodes query_graph
get_impact_radius get_affected_flows list_flows get_flow
get_architecture_overview list_communities refactor_tool` to load the
deferred schemas, then call the corresponding `mcp__code_review_graph__.*_tool`.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. Start with `get_minimal_context`.
2. If a needed CRG tool is missing from the current session, use `tool_search`
   to load it before falling back.
3. Use `detect_changes` for code review.
4. Use `get_affected_flows` to understand impact.
5. Use `query_graph` pattern="tests_for" to check coverage.
