# Repository Guidelines

<Skill-use>
需要发现项目技能时读取 .agents/skills/README.md 或 .agents/skills/manifest.json，技能统一以 `.agents/skills/` 为项目内唯一真源；`.claude/skills` 仅保留软链接入口以适配 Claude 发现机制。使用时需要直接读取技能文件，并按需读取参考文件或调用脚本。
</Skill-use>

<Skill-evolve>
技能改进以可复现问题和可复用经验为依据；仅在用户授权维护时修改技能，不把普通命令失败追加为永久规则。
非项目专属技能，例如常用的buddy技能，不得擅自修改。
</Skill-evolve>


## 协作基线

- 全程中文。先查仓库事实、spec、脚本、日志和测试结果，再给结论或修改方案。
- Shell 命令默认加 `rtk` 前缀；运行 Python 脚本使用 `python3`。
- 大型文档分批修改；一次性写入文档长度不要超过 500 行。
- 项目运行日志位于 `.logs/`，排查运行态问题时优先纳入证据。
- 需要项目历史且当前上下文不足时，定向读取 `docs/memory/02-recent-summary.md` 或相关任务记录；其中时效性信息应以当前事实核验。

## 子代理与审查

- 只有用户授权当前任务或会话使用子代理时才派发；选择是否委派与选择角色是两个决定。主线程可直接完成有界工作。
- 派发应带来明确的独立验证、并行或上下文隔离收益；采用完整、非重叠工作包，不轮询常规进度，不重复可信 worker 已完成的验证。
- Codex 派发时按 `.codex/agents/ROUTING.md` 选择匹配命名角色，权限和模型以 TOML 为准；调用合同见 `.codex/agents/HARNESS.md`，角色索引见 `.codex/agents/README.md`。仅派发或维护配置时读取这些文件。
- 顾问仅处理主线程不能从已有证据可靠解决的重要决策；不因任务涉及架构、数据库或部署就自动调用。
- 独立审查按实际风险与明确验收要求选择。文档、机械修改不自动触发 reviewer；授权后需要独立审查时使用匹配角色，不叠加重叠的完整审查。
- Cursor 会话使用 `.cursor/rules/subagent-routing.mdc` 与对应技能，不套用 Codex 模型参数。
- 已请求的 GitHub Codex Review 必须覆盖当前 HEAD 后才能合并；finding 按 ACCEPT / REJECT / DEFER 裁决，按根因修复。复核只覆盖整改及其直接影响，同一 diff 不因提交或推送阶段变化重新审核。
- 请求 GitHub `@codex review` 时先用 GitHub MCP `get_me` 确认用户身份，再用 `add_issue_comment` 发送；禁止 bot 代发，同一 HEAD 不重复触发。误用 bot 时，15 分钟后仍无回复才以用户身份补发一次。

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

## 图像制作

- 新图和图像编辑以 GPT Image 2.5 为目标；生成时按 `.agents/skills/imagen/references/gpt-image-2.5.md` 选择可用接口并记录真实模型信息。提示词不能切换后端，不静默使用旧模型；已接受历史资产不因默认型号变化重新生成或改写来源。

## 仿真与数值模型

- 新增或改造仿真必须遵循 `docs/Simulation_Guidelines.md`。
- 数值模型统一进入 `rust/control-engine`、浏览器 WASM 或服务端 WASM runtime；前端只保留固定步长调度、UI、图表和埋点。
- 页面使用 `SimulationClock({ dt: 1 / 60, maxSubSteps: 120 })` 推进模型（`SIMULATION_FIXED_STEP_SECONDS`/`SIMULATION_MAX_SUB_STEPS`，见 `src/resources/simulations/lib/simulation-timing.ts`；教学页可用更小的 maxSubSteps）；禁止用 `setInterval` 或可变 `delta` 直接驱动物理模型。
- 禁止新增 TypeScript 物理 stepper、传函离散化器、通用仿真 hook，或恢复旧的前端仿真主干。
- 学生可见文案不要暴露 Rust、WASM、积分器等实现细节。

## 常用命令与验证

- 在 Codex Cloud 或 GitHub Review 环境中，不使用 `rtk` 前缀
在仓库根目录运行：

- `rtk npm run dev` / `rtk npm run startup` / `rtk npm run shutdown`
- `rtk npm run typecheck`（当前零 TypeScript 错误基线；脚本自带 `--max-old-space-size=8192`。全量类型检查实测峰值约 6GB，高于默认 4GB V8 上限，冷 clone、大 merge 或分支切换使增量缓存失效时会回到全量路径，低内存协作机可用 `NODE_MAX_OLD_SPACE_SIZE` 覆盖）
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
- `rtk npm run deploy:app`（仅应用镜像；`remote-deploy.sh --app-only`）
- `rtk npm run runtime:publish` / `runtime:activate` / `runtime:rollback`（课程 Runtime CAS 发布与 `current`/`previous` 切换；发布不激活）
- `rtk npm run runtime:doctor` / `runtime:gc`（显式全量校验与回收；不得由发布或应用部署隐式调用）

按改动风险选择最小充分验证：文档只需结构和 diff 检查；共享逻辑、课程 runtime、DB、仿真或 UI 改动需要对应测试；影响用户页面时补充浏览器或 Playwright 验收。

## 代码风格

- TypeScript/TSX 使用 2 空格缩进、单引号、函数式组件，并沿用现有 Tailwind 与 shadcn/ui 风格。
- 静态 `css/`、`js/` 资源保持现有 4 空格缩进和命名风格。
- 路径别名使用 `@/*`；平台域通过公开接口引用资源，不跨边界读取资源内部实现。
- `prisma/schema.prisma` 使用 PostgreSQL（`DATABASE_URL`）；修改模型时必须处理迁移、数据回填与验证脚本。

## Code Review Rules

### 范围与证据
 - 首次审查范围为 PR base 到当前 HEAD；已有 Codex Review 时，仅审最近 Reviewed commit..HEAD 及此前未解决的已接受 finding。相同 HEAD 不重复全量扫描；无法可靠确定增量基线时应明确说明，不退化为全量复审。
- 仅报告当前 diff 引入或此前 finding 未完整修复的缺陷。既存问题、推测性强化、风格偏好、未来需求、一般重构和 OpenSpec 非目标不作为 finding。
- 每个 finding 必须给出违反的 spec 或仓库不变量、可达触发场景、实际影响和最短相关位置；仓库规则本身不能单独制造 finding。
- P0/P1 才阻断。P2 仅在明确违反本次验收条件或造成当前用户、数据或部署失败时报告，否则只列为残余风险；不报告 P3。
- 同一根因只报告一次。发现共享不变量缺口时，一次性审计完整风险面，避免后续轮次逐症状追加。
- 修复后只核验已接受 finding、修复提交以及由修复直接引入的新 P0/P1，不重新扫描未改动代码，也不为获得 clean 结论继续审核。

### 项目高风险不变量
- OpenSpec 的 proposal、design、tasks、spec delta、显式非目标和验收条件是审查范围真源；不得以更通用的架构偏好扩大交付边界。
- 治理清单、registry、schema、writer discovery、anchor、数据库 export/proof 与 manifest 必须绑定同一捕获 Git 修订；脏工作区、混合 worktree 或证据版本不一致必须显式产生 drift 或 fail closed。
- isolated/main worktree 的同路径异内容必须保留为独立 observation；不得静默覆盖。角色命中、逻辑记录、漂移和摘要必须从最终有效输入集一致重算。
- 数据治理必须闭合嵌套 JSON、关系表、decoder、version/discriminator、watermark 和生产者契约；公开证据不得包含原始答案、事件载荷、用户标识、本机绝对路径或解析器原文，小样本抑制按独立学习者而非行数计算。
- 课堂与发布链路必须保证学生作答持久、并发写入不丢失，教师预览不生成学生状态或证据，角色投影不泄露答案或教师数据，发布与课堂实例绑定不可变 revision 和 manifest hash。
- 影响生产运行时，应核验容器内浏览器、WASM、worker、依赖与版本门禁真实可用且相容；仅本地测试通过不能证明生产路径成立。

### 输出
- 全程中文，开头明确写出审查范围或增量范围。
- 只输出满足上述门槛的 finding；没有新的 P0/P1 时明确回复：本轮增量审查未发现新的 P0/P1 重大问题。
- 简要说明此前 finding 的解决状态，以及仍存在但不阻断合并的测试空白或残余风险。

## 验证与完成

按本次改动与验收条件运行最小充分验证，并完成项目强制门禁。文档做结构、链接和 diff 检查；代码执行直接回归及受影响测试。共享契约、迁移、认证、部署等风险需要对应领域验证，不能用局部测试冒充整体证明。

通过后，只有新增变更、失败、依赖/配置变化或未解决风险才扩大或重复验证。不因“准备 PR”“整改完成”“准备合并”机械重跑同一验证。最终交付应有覆盖当前内容的有效证据；TypeScript 提交/推送门禁仍按下节执行，不绕过 hooks。

不用镜像实现的测试证明可逆低影响修改。报告实际运行命令、结果和未覆盖事项；验证充分且本次验收满足后完成任务，不为获得额外确认继续搜索或测试。

## Git、CI 与发布边界

- 本仓库集成基线为 `integration`，发布分支为 `main`。
- 当前 `integration` 的 TypeScript 基线为零错误；任何代码提交和推送前都必须通过 `rtk npm run typecheck`，不得以“既有债务”为由引入新的 TypeScript 错误。
- `bash scripts/dev/sync-local-worktree-config.sh --apply --install-hooks` 会安装 managed `pre-commit` / `pre-push` hook，并分别执行 `verify:commit` / `verify:push`；新建或同步工作树时必须通过该脚本安装或修复 hooks。本工作树可使用 `--source <repo> --target <repo> --apply --install-hooks` 只安装 hooks。
- 用户只说“提交”时默认停在本地 commit，不推送；点名路径时按路径限域，明确“当前所有变动”时才按整棵工作树处理。
- 完成重大功能更新时，根据范围更新 `docs/ProjectDescription.md`，并提交可验证的项目状态。
- 当前 CI 只在 `main` push 与 `workflow_dispatch` 执行；PR 的 `statusCheckRollup: []` 不是阻塞项，但本地验证、评审线程、mergeability 与元数据门禁仍然有效。
- 镜像构建默认使用 `rtk bash scripts/build.sh`；除非排查脚本本身，不直接手写 `docker buildx build`。
- 应用发布与课程 Runtime 发布分离。应用只走 `deploy:app`；Runtime 只走 `runtime:publish` 之后的 `runtime:activate`（回滚用 `runtime:rollback`）。已删除 `deploy:runtime` 与 `deploy:all`，不得再同步本地 `course-content/runtime`。

## 工具与上下文

- 已知文件、符号或报错可直接定向读取、搜索或查看 `.logs/`。陌生模块关系用 codegraph，diff/执行流风险用 code-review-graph；只加载当前问题需要的工具。
- 图谱是定位辅助。使用前确认当前索引的修订与覆盖；不可用或过期时依赖源码、Git、日志与测试，不进行无结果的重复工具发现。图谱零结果不能证明实现不存在。
- 文档按对象选择：官方库/API 优先当前官方文档或 Context7；数据库核对用现有 Prisma/SQL 工具；项目构建和测试用仓库脚本。浏览器验收使用可用的 Browser、Chrome 或 Playwright。
- 续接任务或查询相关历史时读取 `.wolf/OPENWOLF.md`，再按需定位 STATUS、cerebrum 或 buglog。已知目标的小任务不先读取整份项目记忆或 anatomy。
- 技能支持用户任务，不新增授权或覆盖当前明确指令。按描述选最相关技能，仅加载当前工作流的参考；不因关键词相同叠加多个技能。遇到真正的授权缺口时说明具体动作和原因，普通实现选择自主处理。
