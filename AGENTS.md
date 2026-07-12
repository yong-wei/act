# Repository Guidelines

<Skill-use>
优先读取 .agents/skills/README.md 或 .agents/skills/manifest.json 获取本项目专属完整项目技能清单，技能统一以 `.agents/skills/` 为项目内唯一真源；`.claude/skills` 仅保留软链接入口以适配 Claude 发现机制。使用时需要直接读取技能文件，并按需读取参考文件或调用脚本。
</Skill-use>

<Skill-evolve>
**重要：**在使用项目专属技能执行操作时，如果遇到了问题，在尝试解决后应该将解决思路沉淀在相应技能中，避免二次踩坑。
非项目专属技能，例如常用的buddy技能，不得擅自修改。
</Skill-evolve>


## 协作基线

- 全程中文。先查仓库事实、spec、脚本、日志和测试结果，再给结论或修改方案。
- Shell 命令默认加 `rtk` 前缀；运行 Python 脚本使用 `python3`。
- 大型文档分批修改；一次性写入文档长度不要超过 500 行。
- 项目运行日志位于 `.logs/`，排查运行态问题时优先纳入证据。

## 项目子代理工作流

- 项目命名子代理位于 `.codex/agents/*.toml`；角色、权限和路由真源见 `.codex/agents/README.md`、`.codex/agents/ROUTING.md` 与 `.codex/agents/HARNESS.md`。
- 用户已授权子代理时，只要存在匹配的项目命名角色，就必须使用该角色；不得以自由派发替代命名角色。自由派发仅用于没有匹配角色且运行时能够显式控制模型与推理强度的情况。
- 写任务优先交给 `spark-coder`、`patch-worker` 或 `test-engineer`，以隔离实现上下文；写代理必须串行，并报告全部修改文件和验证结果。
- `long-context-investigator` 只处理 Luna 已不足以承载的仓库级探索、大文件审阅和长上下文证据汇集，不承担日常实现。
- 普通代码产出由 `independent-reviewer` 独立审查；`critical-reviewer` 仅用于高风险、架构回归、安全敏感或发布关键终审。
- 课程作者态/runtime、AI 上下文、数据治理、Arena、Rust/WASM、Prisma、课堂同步与生产部署按 `.codex/agents/ROUTING.md` 追加对应领域 reviewer；领域事实优先于通用审查意见。
- 派发时必须确认子线程元数据中的 `agent_role` 非空且模型、推理强度符合对应 TOML；若运行时无法调用命名角色，应停止派发并报告，不得静默退化为继承主线程配置的自由代理。

## OpenSpec 工作流

- 本项目使用 OpenSpec 管理功能开发。已完成变更会沉淀到 `openspec/specs/`，后续相关变更必须先阅读并遵循对应 spec。
- 开始新变更前，先检查 `openspec/specs/` 与 `openspec/changes/`，避免与已归档能力或进行中变更冲突。
- 当任务已由 OpenSpec 接管时，以 `proposal.md`、`design.md`、`tasks.md` 和 spec delta 为计划真源；不要再创建第二套计划，除非用户明确要求。
- 提案或归档工作优先使用 `openspec validate <change> --type change --strict`、`openspec validate --specs --strict` 或 `openspec validate --changes --strict`。`validate --all` 可能暴露无关旧债，不作为默认门槛。

## 项目结构

本仓库是单一 Next.js 16 应用，核心目录如下：

- `src/app/`：App Router 路由、页面与 API。
- `src/features/`：平台业务域；`src/features/interactive/` 承载当前精品互动课、课堂同步、manifest runtime 与 `unit-*` 课程实现。
- `src/resources/`：可复用教学资源、仿真资源、旧式 widget、资源级 hooks/lib/types。
- `src/components/`：基础 UI、providers、共享桥接组件；不再新增业务主实现，既有 `ai/`、`classroom/`、`teacher/` 视为遗留或桥接边界。
- `src/hooks/`、`src/lib/`、`src/types/`：平台通用 hooks、服务封装与类型。
- `course-content/`：课程内容真源与运行态内容。
- `openspec/`：开发工作流与已归档能力规范。
- `rust/control-engine/`：控制与仿真数值内核。

## 课程与互动课边界

- 课程播放主干为 DB BOPPPS：`TeachingResource` → `LessonPlan/LessonItem` → `ClassSession` → `StudentPlayer` / `ResourceRenderer`。
- 内容链路为 `course-content/authoring/` → `review_lesson_content.py` → `course-content/runtime/`；正式页面读取 runtime，不直接读取 authoring media。
- 可编排资源注册到 `src/lib/resource-registry.tsx`，教案引用 `registryId`，不要写组件路径。
- 配置合并顺序为 `registry.defaultConfig` → `TeachingResource.config` → `LessonItem.overrideConfig`。
- 新 DB/BOPPPS 渲染主线使用 `src/features/lesson-engine/resource-renderer.tsx`；旧式大写 `ResourceRenderer.tsx` 仅按遗留路径维护。
- 新互动课实现优先落在 `src/features/interactive/`；只有可跨课复用的资源、仿真或 widget 才下沉到 `src/resources/`。

## 仿真与数值模型

- 新增或改造仿真必须遵循 `docs/Simulation_Guidelines.md`。
- 数值模型统一进入 `rust/control-engine`、浏览器 WASM 或服务端 WASM runtime；前端只保留固定步长调度、UI、图表和埋点。
- 页面使用 `SimulationClock({ dt: 1 / 60, maxSubSteps: 6 })` 推进模型；禁止用 `setInterval` 或可变 `delta` 直接驱动物理模型。
- 禁止新增 TypeScript 物理 stepper、传函离散化器、通用仿真 hook，或恢复旧的前端仿真主干。
- 学生可见文案不要暴露 Rust、WASM、积分器等实现细节。

## 常用命令与验证

在仓库根目录运行：

- `rtk npm run dev` / `rtk npm run startup` / `rtk npm run shutdown`
- `rtk npm run typecheck`（当前零 TypeScript 错误基线）
- `rtk npm run verify:commit` / `rtk npm run verify:push`（Git hook 使用的 TypeScript 门禁）
- `rtk npm run lint`
- `rtk npm run test`（smoke + Arena 路由）
- `rtk npm run test:unit`（Vitest）
- `rtk npm run test:integration`（Playwright）
- `rtk npm run test:data-governance`（数据治理集成）
- `rtk npm run build`（包含 `wasm:build:control-engine`、`prisma generate`、`next build`）
- `rtk npm run wasm:build:control-engine`
- `rtk npm run worker:dev` / `rtk npm run worker:scheduler`
- `rtk npm run db:session-data-quality` / `rtk npm run db:evidence-source-coverage`

按改动风险选择最小充分验证：文档只需结构和 diff 检查；共享逻辑、课程 runtime、DB、仿真或 UI 改动需要对应测试；影响用户页面时补充浏览器或 Playwright 验收。

## 代码风格

- TypeScript/TSX 使用 2 空格缩进、单引号、函数式组件，并沿用现有 Tailwind 与 shadcn/ui 风格。
- 静态 `css/`、`js/` 资源保持现有 4 空格缩进和命名风格。
- 路径别名使用 `@/*`；平台域通过公开接口引用资源，不跨边界读取资源内部实现。
- `prisma/schema.prisma` 使用 PostgreSQL（`DATABASE_URL`）；修改模型时必须处理迁移、数据回填与验证脚本。

## Git、CI 与发布边界

- 本仓库集成基线为 `integration`，发布分支为 `main`。
- 当前 `integration` 的 TypeScript 基线为零错误；任何代码提交和推送前都必须通过 `rtk npm run typecheck`，不得以“既有债务”为由引入新的 TypeScript 错误。
- `scripts/dev/sync-local-worktree-config.sh --apply --install-hooks` 会安装 managed `pre-commit` / `pre-push` hook，并分别执行 `verify:commit` / `verify:push`；新建或同步工作树时必须通过该脚本安装或修复 hooks。本工作树可使用 `--source <repo> --target <repo> --apply --install-hooks` 只安装 hooks。
- 用户只说“提交”时默认停在本地 commit，不推送；点名路径时按路径限域，明确“当前所有变动”时才按整棵工作树处理。
- 完成重大功能更新时，根据范围更新 `docs/ProjectDescription.md`，并提交可验证的项目状态。
- 当前 CI 只在 `main` push 与 `workflow_dispatch` 执行；PR 的 `statusCheckRollup: []` 不是阻塞项，但本地验证、评审线程、mergeability 与元数据门禁仍然有效。
- 镜像构建默认使用 `rtk bash scripts/build.sh`；除非排查脚本本身，不直接手写 `docker buildx build`。

## MCP 与工具选择

- 官方库/API/框架文档：优先 Context7。
- 代码语义检索与符号级编辑：优先 Serena 或 codegraph。
- 代码 review、执行流、跨文件风险：优先 code-review-graph。
- 浏览器调试与 E2E：使用 chrome-devtools、Browser 或 Playwright。
- 数据库核对：使用 postgres、Prisma 脚本或 `js_repl` 的一次性 Node 检查。
- 需要完整项目脚本、Next.js 构建、`tsx` 或测试链路时，使用仓库命令，不强行改写为 `js_repl`。

## OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.

## Code Graph Tool Split

- `codegraph` 和 `code-review-graph` 是两套本地图谱工具；前者偏代码索引与符号级查询，后者偏 review、执行流、影响面和架构风险分析。
- `codegraph` CLI 用于 `init/index/sync/status/query/files/context` 等索引维护和脚本化查询；`codegraph` MCP 用于会话内直接查询 `search/context/callers/callees/impact/node/explore/files/status`。
- 快速定位符号、目录、调用者/被调用者或单点影响时优先用 `codegraph`；审查 diff、追踪流程、找测试缺口或评估跨文件风险时优先用 `code-review-graph`。

<!-- codegraph MCP tools -->
## MCP Tools: codegraph

若项目存在 `.codegraph/`，代码理解类问题优先使用 `mcp__codegraph__`，避免先用 `rg`/文件读取做大范围探索。

- 架构、功能、bug 上下文：先用 `codegraph_context`。
- 符号定位：用 `codegraph_search`；目录结构：用 `codegraph_files`。
- 调用关系：用 `codegraph_callers` / `codegraph_callees`。
- 改动影响：用 `codegraph_impact`；单符号详情：用 `codegraph_node`。
- 多符号源码巡检：在已有明确符号名后，用一次 `codegraph_explore`。

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

本项目有 code-review-graph 知识图谱。CRG 适合 review、执行流、影响面、测试缺口和跨文件关系问题；单文件字面量确认可直接用 `rg`。

- 若 CRG 工具未显示，先用 `tool_search` 加载 `detect_changes`、`get_review_context`、`query_graph`、`get_affected_flows`、`get_flow`、`get_impact_radius` 等工具。
- Review：先 `detect_changes`，再 `get_review_context`。
- 影响面：先 `get_affected_flows`，再把 `get_impact_radius` 作为辅助估计。
- 关系追踪：用 `query_graph`；具体执行路径用 `list_flows` / `get_flow`。
- 图谱缩小范围后，再用 `rg`、`sed`、`git diff` 和测试做证据确认。
