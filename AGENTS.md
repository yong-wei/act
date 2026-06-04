# Repository Guidelines

<Skill-use>
以下技能为本项目专用技能，项目通用技能优先放在 `.agents/skills/`，仓库专属且尚未通用化的技能保留在 `.codex/skills/`；使用时需要直接读取技能文件，并按需读取参考文件或调用脚本。
- homework：制作课后作业
- interactive-design：互动课程设计
- interactive-lesson：互动课程实现
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


## 协作基线

- 全程中文。先查仓库事实、spec、脚本、日志和测试结果，再给结论或修改方案。
- Shell 命令默认加 `rtk` 前缀；运行 Python 脚本使用 `python3`。
- 大型文档分批修改；一次性写入文档长度不要超过 500 行。
- 项目运行日志位于 `.logs/`，排查运行态问题时优先纳入证据。

## 项目子代理工作流

- 项目级 Codex custom agents 位于 `.codex/agents/*.toml`，代理清单、路由规则和 harness 契约见 `.codex/agents/README.md`、`.codex/agents/ROUTING.md` 和 `.codex/agents/HARNESS.md`。
- 不得仅因代理配置存在就启动子代理；只有用户明确授权当前任务、会话、分支或 review 使用子代理后，主线程才可按需自主选择代理。
- 明确授权包括“按需使用子代理”“本任务允许使用子代理”“本会话允许你自主调度子代理”“spawn appropriate agents”“run the multi-agent workflow”等同义表达；用户明确禁止时不得调用。
- 用户未授权且任务可以由主线程完成时，保持单代理执行；只有委托本身是完成任务的必要条件时，才简短询问是否授权。
- 主线程是唯一调度者和最终裁决者。`agent-router` 只能提出子代理组合、执行批次和停止条件建议，不得直接派发代理，也不得代替主线程做最终判断。
- 主线程始终负责最终判断、补丁范围、验证结果和合并准备度。子代理输出是证据，不是最终裁决。
- 子代理深度固定为 1；子代理不得再启动子代理。普通任务使用 0-2 个代理，非平凡功能、重构或 bug 修复使用 2-4 个代理，完整分支、PR、发布或架构 review 才使用 4-6 个代理。
- 读代理可以并行，写代理原则上串行。不得让两个 `workspace-write` 代理同时修改同一工作树；实现、测试、文档改动都视为写操作。
- 派发子代理前，主线程必须提供 brief：目标、范围内/外、已知文件、允许权限、禁止事项、输出格式、验证命令或停止条件。
- 只读代理不得编辑文件；实现代理必须保持改动最小，并报告所有修改文件。
- `deep-debugger` 虽具备 `workspace-write`，但只用于诊断命令、临时产物或父任务明确授权的诊断性改动；正式修复交给 `patch-worker`。
- 代码类任务完成后，如用户已授权子代理且变更有实际风险，应使用 `critical-reviewer` 或对应专门审查代理复核；修复后再次复核，直到无重大问题。
- `critical-reviewer` 的 `xhigh` 只用于高风险终审、发布门禁、架构回归和用户明确要求的严格审查；不得把它当作普通 review 默认值。
- 涉及课程作者态/runtime、AI 上下文、数据治理、Arena、Rust/WASM、Prisma、课堂同步或生产部署的变更，必须触发对应领域 reviewer，或由主线程说明跳过理由。
- 声称完成前必须运行或说明未能运行的验证；不得把多个子代理意见机械平均，冲突结论必须由主线程明确取舍。

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
