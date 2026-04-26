# AI-OBE 船舶智控平台 - 项目说明

## 1. 项目愿景

AI-OBE (Artificial Intelligence - Outcome Based Education) 船舶智控平台是一个结合了**工程教育认证 (OBE)** 理念与**人工智能辅助教学**的综合性教育平台。本项目旨在通过高保真的虚拟仿真、个性化的 AI 学习路径以及伦理意识的培养，解决传统船舶控制工程教育中理论与实践脱节、伦理教育缺失等痛点。

## 2. 项目状态

✅ **开发阶段**：主要功能已完成，系统可用于教学实践
📅 **最后更新**：2026-04-26
# 近期更新

🧩 **驱逐舰虚拟仿真实时步进迁入 Rust/WASM（2026-04-26）**：本轮围绕 [rust/control-engine/src/destroyer_hifi.rs](/Users/YW/Documents/Site/act.just.edu.cn/rust/control-engine/src/destroyer_hifi.rs)、[rust/control-engine/src/destroyer_hifi_runtime.rs](/Users/YW/Documents/Site/act.just.edu.cn/rust/control-engine/src/destroyer_hifi_runtime.rs)、[rust/control-engine/src/lib.rs](/Users/YW/Documents/Site/act.just.edu.cn/rust/control-engine/src/lib.rs)、[src/resources/simulations/rust/](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/rust)、[src/resources/simulations/simulations/destroyer-simulation.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/simulations/destroyer-simulation.tsx)、[rust/control-engine/tests/destroyer_hifi_runtime.rs](/Users/YW/Documents/Site/act.just.edu.cn/rust/control-engine/tests/destroyer_hifi_runtime.rs)、[src/features/interactive/__tests__/simulation-rust-runtime.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/simulation-rust-runtime.test.ts) 与 [tests/destroyer.spec.ts](/Users/YW/Documents/Site/act.just.edu.cn/tests/destroyer.spec.ts) 收口：新增 `compute_virtual_simulation_step` 统一虚拟仿真 WASM 入口，首批接入 `modelId=destroyer_hifi`，驱逐舰页面保留 3D 场景、任务切换、HUD、图表与控制面板，只把实时航向/位置/舵角步进从页面内 Nomoto 方程迁入 Rust 高保真 MMG stepper；前端新增仿真 Rust runtime 与适配层，统一按工程单位传递 `timeS / headingDeg / yawRateDegS / positionXM / positionYM / rudderDeg / speedMps`，并把 `positionYM` 映射回页面 `z` 轴。当前已显式通过 `cargo test --manifest-path rust/control-engine/Cargo.toml`、`npm run wasm:build:control-engine`、`npx vitest run src/features/interactive/__tests__/simulation-rust-runtime.test.ts`、`npm run lint`、`npm run test`、`npm run build` 与 `/simulations/destroyer` Playwright 回归验证。

🧩 **虚拟仿真第二批迁移：复杂船型实时步进迁入 Rust/WASM（2026-04-26）**：本轮围绕 [rust/control-engine/src/virtual_simulation_runtime.rs](/Users/YW/Documents/Site/act.just.edu.cn/rust/control-engine/src/virtual_simulation_runtime.rs)、[rust/control-engine/tests/virtual_simulation_runtime.rs](/Users/YW/Documents/Site/act.just.edu.cn/rust/control-engine/tests/virtual_simulation_runtime.rs)、[src/resources/simulations/physics/simulation-engine-facade.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/physics/simulation-engine-facade.ts)、[src/resources/simulations/rust/control-engine-runtime.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/rust/control-engine-runtime.ts)、[src/resources/simulations/simulations/dredger-simulation.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/simulations/dredger-simulation.tsx)、[src/resources/simulations/simulations/drilling-simulation.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/simulations/drilling-simulation.tsx)、[src/resources/simulations/simulations/icebreaker-simulation.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/simulations/icebreaker-simulation.tsx) 与 [src/features/interactive/__tests__/simulation-engine-facade.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/simulation-engine-facade.test.ts) 收口：`compute_virtual_simulation_step` 现在除 `destroyer_hifi` 外继续 dispatch `mmg3dof / semisub3dof / azipod3dof`，把挖泥船 MMG 3DOF、半潜平台 3DOF 与破冰船 Azipod 3DOF 的实时物理步进从 TypeScript stepper 迁入 Rust；`simulation-engine-facade` 保留原函数签名与页面状态形状，内部统一构造 `modelId` 请求并同步调用 WASM runtime，三个页面只负责预加载虚拟仿真内核、保留 3D 场景、控制器、HUD 与评估面板。当前已显式通过 `cargo test --manifest-path rust/control-engine/Cargo.toml`、`npm run wasm:build:control-engine`、`npx vitest run src/features/interactive/__tests__/simulation-engine-facade.test.ts src/features/interactive/__tests__/simulation-rust-runtime.test.ts`、`npm run lint`、`npm run test`、`npm run build` 与 `npx playwright test tests/complex-simulations.spec.ts` 验证。

🧩 **虚拟仿真剩余模型迁移：Nomoto 族、横摇耦合与数值 API 迁入 Rust/WASM（2026-04-26）**：本轮继续扩展 [rust/control-engine/src/virtual_simulation_runtime.rs](/Users/YW/Documents/Site/act.just.edu.cn/rust/control-engine/src/virtual_simulation_runtime.rs)、[src/resources/simulations/physics/simulation-engine-facade.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/physics/simulation-engine-facade.ts)、[src/resources/simulations/rust/control-engine-server-runtime.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/rust/control-engine-server-runtime.ts)、[src/app/api/simulation/cruise-comfort-analysis/route.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/app/api/simulation/cruise-comfort-analysis/route.ts)、[src/app/api/simulation/icebreaker-robust-analysis/route.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/app/api/simulation/icebreaker-robust-analysis/route.ts) 与 [src/resources/simulations/lib/monte-carlo-optimizer.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/simulations/lib/monte-carlo-optimizer.ts)：`compute_virtual_simulation_step` 新增 `nomoto1st / nomoto2nd_delay / nomoto_variable_mass / container_roll / roll_coupled_nomoto / cruise_comfort_analysis / icebreaker_robust_analysis / nomoto_quick_sim` 分支，集装箱船、LNG、邮轮主页面的实时步进经统一 facade 调用 Rust/WASM；邮轮舒适度分析、破冰船鲁棒性分析和 Monte Carlo 优化中的 Nomoto 快速物理评估也改由服务端 WASM runtime 执行。旧 TypeScript plant runtime、`useControlSystem`、通用船舶仿真 hook、`simulation-engine.ts` 与 `physics/models/*` 物理模型文件已删除，页面侧只保留控制器、扰动、状态装配与 3D/UI 展示壳层。LLM 评语类接口 `cruise-consistency-comment` 与 `cruise-summary-insight` 仍保持 TypeScript/LLM 路由，不纳入物理模型迁移；最终已通过 Rust、WASM、Vitest、lint、smoke、build 与 `/simulations/*`、Control Odyssey、三域联动 Playwright 验证。

🧩 **`4-6` 精品互动课按 runtime manifest 落地（2026-04-24）**：本轮围绕 [course-content/runtime/lessons/4-6/interactive-manifest.json](/Users/YW/Documents/Site/act.just.edu.cn/course-content/runtime/lessons/4-6/interactive-manifest.json)、[src/features/interactive/shared/manifest-content-renderers.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/shared/manifest-content-renderers.tsx)、[src/features/interactive/shared/manifest-activity-renderers.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/shared/manifest-activity-renderers.tsx)、[src/lib/unit-4-6-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-4-6-course.ts)、[src/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding/](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding) 与 [course-content/authoring/lessons/4-6/notes/implementation-mapping.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-6/notes/implementation-mapping.md) 收口：新增 `unit-4-6-fixed-structure-boundary-structural-encoding` 的入口页、学生页、教师页、课程适配器、步骤级隐藏式 AI 上下文、教师预置教案、课堂码路由、课程目录注册与实现验收文件；课程级 `step-panels.tsx` 只装配共享 manifest 模块和活动 registry，不再复制一份超大步骤页面分支；共享 manifest renderer 现在会把必显模块缺 renderer 的情况渲染为可见错误面板并由测试捕获。当前已通过 4 个定向 Vitest 文件、`review_lesson_content.py --lesson 4-6 --strict-implementation-contract`、4-6 既有 pytest、`npm run lint`、`npm run test`、`npm run build` 与本地 Playwright 浏览器验收。

🧩 **精品互动课编排化运行时清单试点（2026-04-23）**：本轮围绕 [course-content/scripts/export_runtime.py](/Users/YW/Documents/Site/act.just.edu.cn/course-content/scripts/export_runtime.py)、[course-content/runtime/lessons/4-3/interactive-manifest.json](/Users/YW/Documents/Site/act.just.edu.cn/course-content/runtime/lessons/4-3/interactive-manifest.json)、[src/lib/course-runtime.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/course-runtime.ts)、[src/lib/interactive-lesson-manifest.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/interactive-lesson-manifest.ts)、[src/features/interactive/shared/interactive-manifest-renderer.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/shared/interactive-manifest-renderer.tsx)、[src/lib/unit-4-3-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-4-3-course.ts)、[src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/student-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/student-page.tsx)、[src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/teacher-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/teacher-page.tsx) 与 [src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx) 收口：新增 `interactive-manifest.json` 作为新课运行时真源，由导出脚本把作者态 `interactive-contract.yaml` 编译进 runtime lesson bundle；`RuntimeLessonEntryBundle` 现可直接加载互动 manifest；运行时新增共享模板/模块/活动注册表，`4-3` 学生端与教师端已改为消费 runtime manifest 与共享渲染壳层，`unit-4-3-course.ts` 不再保存 14 步页面契约副本，只保留会话适配器、课程常量与步骤元数据；预置教案项额外写入 `stepId` 指针，便于后续真正按步骤编排。当前已显式通过 `npm run test:unit -- src/features/interactive/__tests__/interactive-manifest-runtime.test.tsx src/features/interactive/__tests__/unit-4-3-course.test.ts`、定向 `next lint --file ...` 与 `git diff --check` 验证；完整 `npm run build` 仍受 [src/app/interactive-learning/multi-representation-linkage/page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/app/interactive-learning/multi-representation-linkage/page.tsx:618) 既有类型错误阻塞，未在本轮处理范围内。

🧩 **`4-3` 精品互动课公式 / 显影 / 边界案例联动再修正（2026-04-20）**：继续围绕 [src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx)、[src/resources/control-system/analysis/unit-4-3-roll-boundary.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/control-system/analysis/unit-4-3-roll-boundary.ts)、[src/features/interactive/__tests__/unit-4-3-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-4-3-course.test.ts)、[src/features/interactive/__tests__/unit-4-3-analysis.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-4-3-analysis.test.ts) 与 [notes/4-3.md](/Users/YW/Documents/Site/act.just.edu.cn/notes/4-3.md) 收口：修正 `step-05/06/07/13` 静态公式的 JSX 字符串写法，避免 `BlockMath` 把双反斜杠当字面量渲染成 `dfrac` 文本；将 `step-09/11` 显影链继续对齐 `4-2` 的逐条 slice 显影模式，首屏只显示第一层且点击当前最下方条目后再展开下一层；同时把 `step-13` 的横摇减摇鳍边界案例改回专用扰动通道对比逻辑，补齐“原系统 / 当前参数”图例、动态纵轴和参数改动后的时域/Bode 双图联动。当前已显式通过 `npm run test:unit -- src/features/interactive/__tests__/unit-4-3-course.test.ts src/features/interactive/__tests__/unit-4-3-analysis.test.ts`、定向 `eslint` 与本地 Playwright 浏览器回归验证。

🧩 **`4-3` 精品互动课二轮整改收口（2026-04-20）**：本轮围绕 `course-content/authoring/lessons/4-3/design/interactive-page.md`、`course-content/authoring/lessons/4-3/design/interactive-contract.yaml`、`course-content/authoring/lessons/4-3/notes/interactive-implementation-acceptance.json`、`src/lib/unit-4-3-course.ts`、`src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx`、`src/resources/control-system/analysis/unit-4-3-fixtures.ts`、`src/resources/control-system/analysis/unit-4-3-request-builder.ts`、`src/resources/control-system/charts/control-bode-options.ts` 与 `src/features/interactive/__tests__/unit-4-3-course.test.ts`、`src/features/interactive/__tests__/unit-4-3-analysis.test.ts` 收口：将 `step-05/06/07/10/13` 全部校成 Rust/WASM 驱动的统一联动画板，补齐对象传函、实际控制器传函、控件区和校正前后性能指标对比；修正 `step-07` 的 PID 参数口径与有限值防守，阻断微分项 `NaN` 进入分析 worker；把 `step-09/11` 的显影链改回“逐步出现公式与结论”的真实 worked-example 形态，并让 `step-12` 的学生作答题面支持公式块渲染；同时把 `step-13` 收束为统一样式的双栏时域/Bode 对比面板，补齐轴预设与统一 tooltip。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-4-3-course.test.ts src/features/interactive/__tests__/unit-4-3-analysis.test.ts` 与定向 `eslint` 验证。

🧩 **`3-2` 精品互动课与互动流程硬闸门整改（2026-04-19）**：本轮围绕 `course-content/authoring/lessons/3-2/design/interactive-page.md`、`course-content/authoring/lessons/3-2/design/interactive-contract.yaml`、`course-content/authoring/lessons/3-2/design/interactive-design-acceptance.json`、`course-content/authoring/lessons/3-2/notes/interactive-implementation-acceptance.json`、`src/lib/unit-3-2-course.ts`、`src/lib/unit-3-2-ai-contexts.ts`、`src/features/interactive/unit-3-2-routh-stability-boundary/analysis-workspace.tsx`、`src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx`、`src/features/interactive/unit-3-2-routh-stability-boundary/student-page.tsx`、`src/features/interactive/unit-3-2-routh-stability-boundary/teacher-page.tsx` 与 `course-content/scripts/review_lesson_content.py` 收口：移除 3-2 页内 AI 助手，改为隐藏式控灵上下文与更明确的快捷提问；将 `step-06/09/10` 升级为 Rust/WASM 驱动的根轨迹、时域响应、幅频特性联动工作区；将 `step-04/05/07/08/11` 的教师显影从标签列表改为真实公式与推导步骤；新增互动设计/实现接受文件与 `runtime_review_stale`、`inline_ai_visibility`、`static_media_downgrade` 审查硬闸门，并把子代理驱动的设计、审查、整改闭环写回项目技能。当前已显式通过 `npm run lint`、`npm run test`、`npm run build`、`npm run test:unit -- src/features/interactive/__tests__/unit-3-2-remediation.test.ts src/features/interactive/__tests__/interactive-workflow-remediation.test.ts` 与 `python3 course-content/scripts/review_lesson_content.py --lesson 3-2 --strict-implementation-contract` 验证。

🧩 **`3-4` 精品互动课按 17 步双轨真源整改（2026-04-19）**：本轮围绕 [course-content/authoring/lessons/3-4/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-4/design/interactive-page.md)、[course-content/authoring/lessons/3-4/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-4/design/interactive-contract.yaml)、[src/lib/unit-3-4-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-4-course.ts)、[src/lib/unit-3-4-ai-contexts.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-4-ai-contexts.ts)、[src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts)、[src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx)、[src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx)、[src/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page.tsx)、[src/features/interactive/__tests__/unit-3-4-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-3-4-course.test.ts) 与 [course-content/authoring/lessons/3-4/notes/interactive-implementation.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-4/notes/interactive-implementation.md) 收口：将 `unit-3-4-root-locus-reading-validation` 从旧的 14 步实现整体校回作者态 17 步真源，补齐“关键节点证据板、窗口判断、增益换算显影、三域互证、广义根轨迹改写与参数窗口、后测、出口页”主线；同时移除页内显式 AI 助手，统一改为隐藏式页面上下文与全局课程 AI，补入教师四类控制、浏览开关与逐步显影同步状态，并将 `UNIT_3_4_PAGE_CONTRACTS` 改写为可静态校验的字面量结构，新增 `check_contract_alignment.py --lesson 3-4` 预设。当前已显式通过 `npm run test:unit -- src/features/interactive/__tests__/unit-3-4-course.test.ts`、`npm run test:unit -- src/features/interactive/__tests__/module-3-4-formula-rendering.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 3-4` 与 `npm run lint` 验证。

🧩 **`4-2` 精品互动课按 13 步整改并校回双轨真源（2026-04-19）**：本轮围绕 [course-content/authoring/lessons/4-2/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-2/design/interactive-page.md)、[course-content/authoring/lessons/4-2/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-2/design/interactive-contract.yaml)、[src/lib/unit-4-2-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-4-2-course.ts)、[src/lib/unit-4-2-ai-contexts.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-4-2-ai-contexts.ts)、[src/features/interactive/unit-4-2-controller-selection-first-start/entry-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-2-controller-selection-first-start/entry-page.tsx)、[src/features/interactive/unit-4-2-controller-selection-first-start/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-2-controller-selection-first-start/step-panels.tsx)、[src/features/interactive/unit-4-2-controller-selection-first-start/student-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-2-controller-selection-first-start/student-page.tsx)、[src/features/interactive/unit-4-2-controller-selection-first-start/teacher-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-4-2-controller-selection-first-start/teacher-page.tsx)、[src/features/interactive/__tests__/unit-4-2-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-4-2-course.test.ts) 与 [notes/4-2.md](/Users/YW/Documents/Site/act.just.edu.cn/notes/4-2.md) 收口：将 `unit-4-2-controller-selection-first-start` 从旧的 14 步实现校回作者态要求的 13 步版本，删除原信息图总结页，重写 `step-03/04/05-13` 的页面契约与静态承载；同时把客船与平台入口改为 Rust/WASM 驱动的原生统一面板，修正输入/扰动前馈页的公式双斜杠与 authoring 路径回读问题，并把起步卡工作区压缩为六字段最小卡片。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-4-2-course.test.ts`、`python3 course-content/scripts/review_lesson_content.py --lesson 4-2 --strict-implementation-contract`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/4-2/design/interactive-contract.yaml --implementation src/lib/unit-4-2-course.ts --page-contract-const UNIT_4_2_PAGE_CONTRACTS --step-const UNIT_4_2_LESSON_STEPS`、`npm run lint`、`npm run test` 与 `npm run build` 验证。

🧩 **`3-3` 精品互动课按 17 步双轨真源整改（2026-04-19）**：本轮围绕 [course-content/authoring/lessons/3-3/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-3/design/interactive-page.md)、[course-content/authoring/lessons/3-3/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-3/design/interactive-contract.yaml)、[src/lib/unit-3-3-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-3-course.ts)、[src/lib/unit-3-3-ai-contexts.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-3-ai-contexts.ts)、[src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx)、[src/features/interactive/__tests__/unit-3-3-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-3-3-course.test.ts) 与 [notes/3-3.md](/Users/YW/Documents/Site/act.just.edu.cn/notes/3-3.md) 收口：将 `unit-3-3-root-locus-rules` 从旧的 13 步实现全面校回作者态 17 步真源，补齐 `activity_cards / sequence_sort / classification_cards` 三类互动类型，并把“例题 3、七步读图法、三类开环极点、广义改写、动态翻译、后测、收束”重新拆回独立步骤；同时重写 `UNIT_3_3_PAGE_CONTRACTS`、`UNIT_3_3_LESSON_STEPS`、3-3 步骤级 AI 上下文与课堂页静态蓝图/学生作答区/教师参考锚点，避免旧版 13 步记录继续误导后续实现。当前已显式通过 `npm run test:unit -- src/features/interactive/__tests__/unit-3-3-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-3/design/interactive-contract.yaml --implementation src/lib/unit-3-3-course.ts --page-contract-const UNIT_3_3_PAGE_CONTRACTS --step-const UNIT_3_3_LESSON_STEPS`、`python3 course-content/scripts/review_lesson_content.py --lesson 3-3 --strict-implementation-contract`、`npm run lint` 与 `npm run build` 验证。

🧩 **`4-3` 复合校正实践讲义重构并补齐原生图链（2026-04-18）**：本轮围绕 [course-content/authoring/lessons/4-3/design/handout.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-3/design/handout.md)、[course-content/authoring/lessons/4-3/media/raw/generate_compound_design_data.m](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-3/media/raw/generate_compound_design_data.m)、[course-content/authoring/lessons/4-3/media/raw/render_compound_figures.py](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-3/media/raw/render_compound_figures.py) 与 `media/raw/generated-data/*`、`media/processed/*` 收口：将新的 `4-3` 学生讲义正式改写为“复合形式演示 -> 工程案例 -> 实践任务 -> 边界案例”的实践链路，去除对外部资源的显式依赖，新增 `PI + 超前 / 滞后 + 超前 / 带微分滤波 PID` 三组多联图、客船航向保持首轮超前校正案例，以及横摇减摇鳍的扰动通道二连图；同时把根轨迹视窗、子图标题、案例目标顺序、实践任务与附录参考设计过程按最新课堂要求重新整理，并已重新导出作者态 `handout.pdf` 供后续 runtime 复制与课堂入口下载。

🧩 **`3-1` 精品互动课按新版双轨真源重制（2026-04-18）**：本轮围绕 [course-content/authoring/lessons/3-1/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-1/design/interactive-page.md)、[course-content/authoring/lessons/3-1/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-1/design/interactive-contract.yaml)、[src/lib/unit-3-1-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-1-course.ts)、[src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/step-panels.tsx)、[src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/student-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/student-page.tsx)、[src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/teacher-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/teacher-page.tsx) 与 [src/features/interactive/__tests__/unit-3-1-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-3-1-course.test.ts) 收口：将 `unit-3-1-pure-pole-stability-and-dynamics` 的本地课程契约与 15 步标题、模板、区域、互动类型全面对齐作者态真源，把旧版 `tab_switch / comparison_workspace / parameter_workspace / short_response / formula_pair_check` 骨架切回 `activity_cards / worked_example_workspace / curve_compare_panel / ai_compare_workspace` 等新版页面语义；同时将学生端作答区改为按卡片独立提交，`step-08` 补入“显示下一步 / 重置步骤”的逐步显影区，`step-11` 和 `step-12` 恢复双卡布局，并移除正文中的显式页内 AI 面板，只保留步骤级隐藏式 AI 上下文与全局助手。当前已显式通过 `npm run test:unit -- src/features/interactive/__tests__/unit-3-1-course.test.ts`、`npm run lint`、`npm test`、`npm run build` 以及基于 Playwright 的本地浏览器脚本回归（覆盖入口页、`step-08` 显影区、`step-11` 双卡和 `step-12` 隐藏式 AI 约束）。

🛠️ **模块 4 课次压缩与 `4-3 / 4-4` 合并重构（2026-04-18）**：本轮按 [course-content/syllabus-refactor/blueprint.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/blueprint.md)、[course-content/syllabus-refactor/main.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/main.md)、[course-content/syllabus-refactor/module-skeletons.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/module-skeletons.md)、[course-content/syllabus-refactor/decisions.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/decisions.md) 与 [course-content/syllabus-refactor/unit-design-details/module4.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/unit-design-details/module4.md) 重新审视模块 4 的中段设计：正式合并原 `4-3（理论）` 与 `4-4（实践）`，将新的 `4-3` 固定为“初始方案落地实践：从对象分析到结构组合与首轮验证”；模块 4 因而由 `8` 个单元压缩为 `7` 个单元、由 `16h` 调整为 `14h`，并同步将后半链顺延改号为 `4-4` 多目标权衡、`4-5` 优化实践、`4-6` 场景迁移、`4-7` 双场景综合比较。与此同时，模块 4 细化文稿已删除旧的防御性分拆叙事，明确要求学生版讲义按“任务表达 -> 结构选型 -> 方案落地 -> 权衡修正 -> 迁移比较”直接展开；当前显性编排学时已由 `76h` 压到 `74h`，但距正式 `72h` 仍剩 `2h` 待后续继续收口。

🛠️ **模块 4 课程设计与 `4-2` 前馈讲义深化收口（2026-04-17）**：本轮围绕 [course-content/syllabus-refactor/blueprint.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/blueprint.md)、[course-content/syllabus-refactor/main.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/main.md)、[course-content/syllabus-refactor/decisions.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/decisions.md)、[course-content/syllabus-refactor/unit-design-details/module4.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/unit-design-details/module4.md) 继续收紧模块 4 的单元边界，并同步重写 [course-content/authoring/lessons/4-2/design/handout.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-2/design/handout.md)、[course-content/authoring/lessons/4-3/design/handout.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-3/design/handout.md) 与 [course-content/authoring/lessons/4-4/design/handout.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-4/design/handout.md)：`4-2` 重点补齐“为什么选 PI / PD”的计算与多结构比较，系统展开按输入补偿与按扰动补偿两类前馈，并新增四联对比图、结构对比图、讲义清单、图谱节点和知识卡；同时在 [docs/Feedforward.md](/Users/YW/Documents/Site/act.just.edu.cn/docs/Feedforward.md) 与 [/.codex/skills/lesson/references/step3-handout.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/lesson/references/step3-handout.md) 固化前馈讲授逻辑以及 `\omega_c` / `\omega_g` 术语约束，为后续模块 4 总和设计与复合控制场景保持一致表达。

🛠️ **`3-7` 精品互动课课堂反馈二次整改与公共约束固化（2026-04-17）**：本轮继续围绕 [course-content/authoring/lessons/3-7/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/interactive-page.md)、[course-content/authoring/lessons/3-7/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/interactive-contract.yaml)、[src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx)、[src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts)、[src/lib/unit-3-7-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-7-course.ts) 与 [src/features/interactive/__tests__/unit-3-7-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-3-7-course.test.ts) 收口：将 `step-04/05/06/07/09` 的关键公式与表格切换为原生 `LaTeX + HTML table` 承载；将 `step-05/07/10/11/13/14` 的逐步显影统一为“标题不重复写第 N 步、点击当前步骤继续显影下一层”；把 `step-07` 改成“第一行通栏结构图、第二行左传函右输入”的特殊布局；把 `step-09` 从本地手绘 SVG 曲线升级为共享 `useControlEngine + BodePanel` 的 Rust/WASM 统一 Bode 面板，并进一步把低频 Bode 的单选/多选坐标预设与浅深主题样式抽到 [src/resources/control-system/charts/control-bode-options.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/control-system/charts/control-bode-options.ts) 与 [src/resources/control-system/charts/control-chart-theme.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/resources/control-system/charts/control-chart-theme.ts)，避免切换选择时坐标跳变、同时消除浅色主题文字失配；把 `step-16` 改成顶部先显示后测名称卡、下方再进入题卡区；同时把“双题卡默认双栏半宽并排、标题直接写题面、单卡按钮统一写提交答案、逐步显影点击继续下一层、统一曲线面板默认采用 Rust/WASM 基线”等公共约束回写到 [/.codex/skills/interactive-design/references/page-sequence-and-activity-controls.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/references/page-sequence-and-activity-controls.md)、[/.codex/skills/interactive-design/references/worked-example-modules.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/references/worked-example-modules.md) 与 [/.codex/skills/interactive-lesson-implementation/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-lesson-implementation/SKILL.md)。当前已显式通过 `npm run test:unit -- src/features/interactive/__tests__/unit-3-7-course.test.ts src/features/interactive/__tests__/control-charts.test.tsx`、`npm run test`、`npm run lint` 与 `npm run build` 验证。

🛠️ **`3-7` 精品互动课按课堂反馈继续收口（2026-04-16）**：本轮继续对 [course-content/authoring/lessons/3-7/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/interactive-page.md)、[course-content/authoring/lessons/3-7/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/interactive-contract.yaml)、[src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx)、[src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts) 与 [src/lib/unit-3-7-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-7-course.ts) 收口：把 `step-03` 调整为“文本先、作答后”，把 `step-04` 从热点标注改成两张独立勾选卡，统一把 `step-05/06/07/09/10/11/12/13/14/15` 压到“每页最多两题、每卡单独提交”，为例题 / 方法页补上“显示下一步 / 重置步骤”的逐步显影链，并把 `step-09` 改成“公式与文案在前、左侧幅频特性 SVG 面板、右侧三曲线勾选控件、下方比较表与误判点”的结构；同时移除展示页多余的“无需提交”占位壳层，并把这些共性约束回写到 [.codex/skills/interactive-design/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/SKILL.md)、[.codex/skills/interactive-design/references/worked-example-modules.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/references/worked-example-modules.md)、[.codex/skills/interactive-design/references/page-sequence-and-activity-controls.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/references/page-sequence-and-activity-controls.md) 与 [.codex/skills/interactive-lesson-implementation/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-lesson-implementation/SKILL.md)。当前已显式通过 `vitest` 定向回归、`npm run test`、`npm run lint` 与 `npm run build` 验证。

🧩 **`3-7` 精品互动课重构到新版双轨 17 步（2026-04-16）**：本轮已将 `unit-3-7-steady-error-low-frequency-compensation` 从旧版 `12` 步实现切换到作者态双轨真源规定的 `17` 步结构，同步更新 [notes/3-7.md](/Users/YW/Documents/Site/act.just.edu.cn/notes/3-7.md)、[src/lib/unit-3-7-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-7-course.ts)、[src/lib/unit-3-7-ai-contexts.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-7-ai-contexts.ts)、[src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts) 与 [src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx)，把新版页面类型 `quiz_card_grid`、`hotspot_labeling`、`worked_example_workspace`、`activity_card_set` 全部接入学生端与教师端课堂壳，完成 `step-01` 至 `step-17` 的标题、提示语、媒体映射、AI 页面上下文与本地互动契约对齐；同时补强 [src/features/interactive/__tests__/unit-3-7-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-3-7-course.test.ts) 覆盖步骤数、activity-first 布局、契约字段、媒体资源、AI 提问与页面内容关键词。当前已显式通过 `npm run test:unit -- src/features/interactive/__tests__/unit-3-7-course.test.ts`、`npm run test`、`npm run lint` 与 `npm run build` 验证；构建中出现的多条 `DYNAMIC_SERVER_USAGE` 日志为仓库既有 API 路由静态化告警，本轮未新增构建失败。
🧩 **互动课程设计技能独立拆分（2026-04-16）**：本轮已将作者态互动课程设计从 [/.codex/skills/lesson/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/lesson/SKILL.md) 中剥离，新增独立技能 [/.codex/skills/interactive-design/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/SKILL.md) 及三份针对性参考：[worked-example-modules.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/references/worked-example-modules.md)、[curve-interaction-panels.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/references/curve-interaction-panels.md)、[page-sequence-and-activity-controls.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-design/references/page-sequence-and-activity-controls.md)。新的边界为：`lesson` 只负责讲义、图谱、BOPPPS 与多媒体；`interactive-design` 负责 `interactive-page.md` 与 `interactive-contract.yaml`；`interactive-lesson-implementation` 则补强了“不得把原理/例题/作答合并成统一壳、不得把教师控制退化成双开关、不得把多步骤作答收缩成统一表单”的实现侧约束。`AGENTS.md` 的项目专用技能清单也已同步更新。
🧩 **教师驾驶舱降级模式恢复链路修复（2026-04-15）**：针对教师进入 `/teacher` 后长期停留在降级模式的问题，本轮完成“主机名默认值回切 + 服务端有界重试 + 页面自动恢复”三层修复：线上实测确认 Podman 网络中的短主机名 `act-obe-postgres` / `act-obe-redis` 存在间歇性解析或连通抖动，而 `*.dns.podman` 全限定主机名稳定，因此 [deploy/podman/deploy.sh](/Users/YW/Documents/Site/act.just.edu.cn/deploy/podman/deploy.sh) 与 [deploy/podman/configure-service.sh](/Users/YW/Documents/Site/act.just.edu.cn/deploy/podman/configure-service.sh) 已改为默认写入 `act-obe-postgres.dns.podman` 与 `act-obe-redis.dns.podman`；教师工作台服务端数据加载现对数据库连通性错误做有界重试，仅在多次失败后才降级；[src/app/api/readyz/route.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/app/api/readyz/route.ts) 与 [src/app/teacher/page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/app/teacher/page.tsx) 已改为强制动态且 `no-store`，教师首页降级态会主动轮询健康检查并在数据库恢复后自动 `refresh`。当前已通过教师工作台单测、`readyz` 单测与部署脚本守卫测试验证。
🧩 **Rust/WASM 镜像部署链路补齐（2026-04-14）**：针对 `4-1` 控制分析内核引入 `Rust Wasm` 后的部署风险，本轮已补齐容器内构建链路：`Dockerfile` 的 builder 阶段现显式安装 Rust 工具链、`wasm32-unknown-unknown` 目标与 `wasm-pack`，并统一改为执行 `npm run build`，保证镜像在容器内完成 `control-engine` 的 Wasm 产物构建，而不再依赖宿主机预先生成 `src/resources/control-system/wasm/control_engine`；同时 `.dockerignore` 已放行 `scripts/wasm/` 进入构建上下文，避免容器内缺少 Wasm 构建脚本。当前已通过 `node scripts/tests/test-docker-migration-readiness.mjs` 与本地 `npm run build` 验证，镜像构建与远端部署将沿 `scripts/build.sh -> scripts/remote-deploy.sh` 的既有链路继续执行。
🧩 **`3-5` 精品互动课设计实现收束（2026-04-14）**：本轮将 `unit-3-5-zero-dynamic-improvement` 从旧的 `16` 步实现收束到作者态双轨真源规定的 `15` 步版本：同步更新了 [course-content/runtime/lessons/3-5/lesson.json](/Users/YW/Documents/Site/act.just.edu.cn/course-content/runtime/lessons/3-5/lesson.json)、[course-content/runtime/lessons/3-5/graph-overlay.json](/Users/YW/Documents/Site/act.just.edu.cn/course-content/runtime/lessons/3-5/graph-overlay.json)、[src/lib/unit-3-5-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-5-course.ts)、[src/lib/unit-3-5-ai-contexts.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-5-ai-contexts.ts) 以及 `step-panels/workspace/student-page`，删除旧的 `step-16`、`sentence_rebuild` 与 `exit_reflection`，并按新设计补入 `step-14` 的 `rule_check` 边界判断、`step-15` 的后测与收束合页，以及新的媒体映射与知识分组。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-5-course.test.ts` 验证。
🧩 **lesson 技能根轨迹复绘基线固化（2026-04-14）**：本轮已将根轨迹从 `Octave` 真值转入 `Python/matplotlib` 复绘时的分支匹配流程沉淀为通用脚本 [/.codex/skills/lesson/scripts/root_locus_branch_match.py](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/lesson/scripts/root_locus_branch_match.py)，并回写 `lesson` 技能正文、Step 3/Step 7 参考、模板脚手架与 `3-4` 课次出图链路。新的固定约束要求：独立根轨迹图、局部放大图以及多联/四联图中的根轨迹子图，统一先导出 `sample_idx,gain,re,im` 原始样本，再由该脚本做连续分支匹配、有限零点覆盖审计和视图报告，随后共用同一份匹配后分支 CSV 进行排版，不再允许各课次临时手写分支排序逻辑。当前已补齐对应单元测试，并在 `3-4` 课次上完成 `Octave -> 匹配脚本 -> matplotlib` 的完整验证链路。
🧩 **`4-1` 控制分析内核第一阶段落地（2026-04-14）**：本轮将 `4-1` 动态曲线区升级为“`Rust Wasm` 控制分析内核 + `Web Worker` 调度层 + `ECharts` 图形面板”的前端统一路线，并明确其定位为“统一仿真内核的第一阶段”，当前只覆盖控制分析核心，不替代既有固定步长仿真运行时。新增 `rust/control-engine/` 作为公共分析 crate，统一输出阶跃响应、根轨迹、幅频、相频、Nyquist 与 Bode 组合结果；前端新增 `src/resources/control-system/analysis/` 与 `src/resources/control-system/charts/` 公共层，封装统一请求协议、`fixture fallback`、Worker 调度、`use-control-engine` hook 与六类专业曲线面板；`unit-4-1-design-task-expression` 的 `step-04 / step-05` 已切换到该公共层，支持滑块参数和结构勾选直接驱动动态重算。随后又继续补齐了第二轮稳定性与图形修订：Rust 内核已移除导致 Wasm `unreachable` 的非有限时域路径，改为更稳的连续系统阶跃求解，并对零增益频响做有限值防御；根轨迹改为全局最优根归属匹配加自适应增益加密，解决分离点不交汇和后续复杂轨迹跳枝风险；四联图面板现固定数轴范围，按“左侧时域/根轨迹、右侧幅频/相频”重排，统一在标题栏标注两位小数的时域指标、裕度和当前闭环极点，同时绘出可行域边界参考，从而消除了滑块拖动时的整体闪动。最新一轮又进一步对齐讲义真源：`step-04` 的设计可行域已从错误的矩形近似恢复为阻尼线与 `σ` 边界组成的楔形区域，`step-05` 则恢复为“左上时域、右上合并 Bode、左下全览根轨迹、右下局部放大根轨迹”的讲义版式，并新增 `root_locus_full` 数据通道与客户端动态 ECharts 注册，消除了先前开发态 SSR 图表报错。当前已显式通过 `cargo test --manifest-path rust/control-engine/Cargo.toml`、`npx vitest run src/features/interactive/__tests__/control-analysis-core.test.ts src/features/interactive/__tests__/unit-4-1-course.test.ts`、`npm run lint`、`npm run test` 与 `npm run build` 验证，并在浏览器中复验 `step-04 / step-05` 无控制台错误、无 Wasm fallback、图组布局与滑块联动正常。
🧩 **课程内容审核技能补齐互动实现审查（2026-04-13）**：本轮已把 `lesson-content-review` 技能扩展为“设计稿 + 机读契约 + 本地实现契约”的三层互动页审查流程，并新增互动实现专项参考。`course-content/scripts/review_lesson_content.py` 现已把 `interactive-page-check.json` 扩展为元件级审查结果：除讲义映射、静态承载、公式覆盖外，还检查证据单元映射字段、`主阅读顺序`、曲线图“镜像说明”与 `interactive_figure_spec`、隐藏式 `ai_context_spec`、以及本地实现中的 `layout.reading_order`、`interaction_archetype`、教师聚合、埋点、图像布局镜像、控件位置与折叠状态。该能力用于防止互动课程在落地实现时出现布局漂移、交互降级或 AI 边界失真。
🧩 **互动课技能基线修订（2026-04-13）**：本轮已回写 `lesson` 技能、Step 6 互动页面参考与 `interactive-lesson-implementation` 技能的默认约束，正式把互动课程基线从“步骤化流程页 + 组件占位”调整为“证据单元映射 + 完整课件优先 + 曲线图默认动态化 + 隐藏式 AI 页面上下文”。新的 Step 6 规则要求：讲义中的对象、公式、图、表、结论、误判与任务卡以“证据单元”逐项落页；案例页默认遵守“对象/背景 -> 模型与公式 -> 推导或分析 -> 图像与曲线 -> 指标/边界 -> 判断与任务卡”的阅读顺序；可调参数曲线图默认升级为互动镜像图，初始状态必须与 handout 静态图一致，若 handout 为 `2×2` 图组则互动图默认保持 `2×2` 排布，控件栏统一放在图组下方折叠区；AI 信息默认只作为步骤级隐藏上下文供控灵浮动助手消费，不再默认要求页内显式 AI 模块。该修订当前属于技能与参考文档层基线更新，尚未批量回改已落地课程实现。
🧩 **互动课程总览与时长清理（2026-04-13）**：本轮收敛 `/interactive-learning/courses` 的“精品课程”栏目，仅保留 `cruise-comfort-boppps`《柔性之海：豪华邮轮舒适度控制课堂实录》，其余新主线互动课继续通过模块分区展示，避免精品栏目重复堆叠模块课程；同时把 `2-2 / 2-3 / 2-4 / 3-1` 在互动课程实现层与教师预置教案中的错误 `100 分钟` 统一改回作者态与 runtime 真源一致的 `90 分钟`，并补齐 `learning-catalog` 相关测试覆盖。当前已显式通过 `npx vitest run src/features/interactive/__tests__/learning-catalog.test.ts src/features/interactive/__tests__/unit-2-1-replacement.test.ts`、`npm run lint`、`npm run test` 与 `npm run build` 验证。
🧩 **`4-1` 精品互动课落地（2026-04-12）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/4-1/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-1/design/interactive-page.md) 与 [course-content/authoring/lessons/4-1/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-1/design/interactive-contract.yaml)，完成 `unit-4-1-design-task-expression` 的 runtime-first 互动课程实现：新增统一预习台入口页、教师页、学生页、`4-1` 专用步骤静态内容面板与任务卡工作区，将 `4-1`《双场景任务表达与设计起点》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览、模块 4 单元目录与教师预置教案，并把模块 4 精品课主线从这里起步。课程入口继续复用共享 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保持 runtime 媒体入口与课堂外资源埋点统一；课堂内严格对齐 `UNIT_4_1_PAGE_CONTRACTS` 与作者态契约，覆盖“双场景证据读取 -> 任务排序 -> 任务卡表达 -> 设计入口收束”的 12 步流程，并把新增 `task_card_workspace` 固定为结构化任务卡工作区，避免把契约式互动退化成普通自由问答。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-4-1-course.test.ts`、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-4-1-design-task-expression` 及其师生端动态路由。
🧩 **`3-9` 精品互动课落地（2026-04-11）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/3-9/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-9/design/interactive-page.md) 与 [course-content/authoring/lessons/3-9/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-9/design/interactive-contract.yaml)，完成 `unit-3-9-cross-domain-mapping-lab` 的 runtime-first 互动课程实现：新增统一预习台入口页、教师页、学生页、`3-9` 专用步骤静态内容面板与结构化工作区，将 `3-9`《稳定—动态—稳态综合映射实验》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览、模块 3 单元目录与教师预置教案，并把模块 3 精品课主线扩展为 `3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 3-6 / 3-7 / 3-8 / 3-9`。课程入口继续复用共享 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保持 runtime 媒体入口与课堂外资源埋点统一；课堂内严格对齐 `UNIT_3_9_PAGE_CONTRACTS` 与作者态契约，覆盖“基准对象对照 -> 零点线补强 -> 积分家族比较 -> 滞后对照判别 -> 综合映射表 -> 模块 4 去向判断”的 8 步流程，并将 `interaction_kind: none` 在实现层稳定映射为 `pageType: 'display'`，确保契约检查与前端渲染语义一致。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-9-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-9/design/interactive-contract.yaml --implementation src/lib/unit-3-9-course.ts --page-contract-const UNIT_3_9_PAGE_CONTRACTS --step-const UNIT_3_9_LESSON_STEPS`、`python3 course-content/scripts/review_lesson_content.py --lesson 3-9 --strict-implementation-contract`、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab` 及其师生端动态路由。
🧩 **`3-8` 精品互动课落地（2026-04-08）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/3-8/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-8/design/interactive-page.md) 与 [course-content/authoring/lessons/3-8/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-8/design/interactive-contract.yaml)，完成 `unit-3-8-frequency-domain-translation-judgment` 的 runtime-first 互动课程实现：新增统一预习台入口页、教师页、学生页、`3-8` 专用步骤静态内容面板与工作区，将 `3-8`《频域判别与跨域综合语言》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览、模块 3 单元目录与教师预置教案，并把模块 3 精品课主线扩展为 `3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 3-6 / 3-7 / 3-8`。课程入口继续复用共享 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保持 runtime 媒体入口与课堂外资源埋点统一；课堂内严格对齐 `UNIT_3_8_PAGE_CONTRACTS` 与作者态契约，覆盖“结构变化频域指纹 -> Nyquist/Bode 统一判稳 -> 三频段分工 -> 航向/平台工程案例读回 -> 3-9/4-1 去向收束”的 12 步流程，并把 AI 使用边界固定在 `step-09` 的 `ai_compare_workspace` 页面，避免把结构化互动降级成自由问答。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-8-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-8/design/interactive-contract.yaml --implementation src/lib/unit-3-8-course.ts --page-contract-const UNIT_3_8_PAGE_CONTRACTS --step-const UNIT_3_8_LESSON_STEPS`、`python3 course-content/scripts/review_lesson_content.py --lesson 3-8 --strict-implementation-contract`、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment` 及其师生端动态路由。
🧩 **`3-7` 精品互动课落地（2026-04-08）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/3-7/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/interactive-page.md) 与 [course-content/authoring/lessons/3-7/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/interactive-contract.yaml)，完成 `unit-3-7-steady-error-low-frequency-compensation` 的 runtime-first 互动课程实现：新增统一预习台入口页、教师页、学生页、`3-7` 专用步骤静态内容面板与工作区，将 `3-7`《型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览、模块 3 单元目录与教师预置教案，并把模块 3 精品课主线扩展为 `3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 3-6 / 3-7`。课程入口继续复用共享 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保持 runtime 媒体入口与课堂外资源埋点统一；课堂内严格对齐 `UNIT_3_7_PAGE_CONTRACTS` 与作者态契约，覆盖“双通道误差 -> 终值定理直接求 -> 型别快判边界 -> PI/滞后低频补偿比较 -> 频域过渡到 3-8”的 12 步流程，并补齐 `step-06` 到 `step-12` 的错因埋点标签以及 `step-11`“为什么 PI 更准、PD 更快”的频域桥接文案。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-7-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-7/design/interactive-contract.yaml --implementation src/lib/unit-3-7-course.ts --page-contract-const UNIT_3_7_PAGE_CONTRACTS --step-const UNIT_3_7_LESSON_STEPS`、`python3 course-content/scripts/review_lesson_content.py --lesson 3-7 --strict-implementation-contract`、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation` 及其师生端动态路由。
🧩 **`3-6` 精品互动课实现升级（2026-04-15）**：本轮继续将 `unit-3-6-zero-design-workshop` 从旧的 `13` 步实现收束到作者态双轨真源规定的 `15` 步版本：同步更新 [src/lib/unit-3-6-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-6-course.ts)、[src/lib/unit-3-6-ai-contexts.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-6-ai-contexts.ts)、[src/features/interactive/unit-3-6-zero-design-workshop/workspace.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-6-zero-design-workshop/workspace.ts)、[src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx) 与 [src/features/interactive/unit-3-6-zero-design-workshop/student-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-6-zero-design-workshop/student-page.tsx)，补入 `step-08` 证据板、`step-10/12` 推导显影、`step-14` 边界决策、`step-15` 后测与出口反思合页，并将步骤级 AI 上下文升级为 `X+C` 复合知识类型。同时扩展 [course-content/scripts/review_lesson_content.py](/Users/YW/Documents/Site/act.just.edu.cn/course-content/scripts/review_lesson_content.py) 对新版 `interactive-contract.yaml`、`upgrade_table` 与 `固定证据` 审查口径的兼容，确保严格审查链可直接重导出 `3-6` runtime review 产物。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-6-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-6/design/interactive-contract.yaml --implementation src/lib/unit-3-6-course.ts --page-contract-const UNIT_3_6_PAGE_CONTRACTS --step-const UNIT_3_6_LESSON_STEPS` 与 `python3 course-content/scripts/review_lesson_content.py --lesson 3-6 --strict-implementation-contract` 验证。
🧩 **`3-6` 作者态课程包同步整改（2026-04-15）**：基于已更新的学生版讲义与互动课程设计，本轮继续完成 `3-6` 剩余课程内容同步：修订 [course-content/authoring/lessons/3-6/design/multimedia.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-6/design/multimedia.md) 中的互动步骤落点与运行时说明，更新 [course-content/authoring/lessons/3-6/media/processed/3-6-media.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-6/media/processed/3-6-media.md) 的课程级媒体描述，补导出教师版课堂讲义 PDF，并重新执行 `review_lesson_content.py --lesson 3-6` 刷新 runtime/review 产物，使 `handout / teacher-handout / multimedia / runtime` 四层口径重新对齐到“目标翻译 -> A/B/C/D/E 五任务链 -> 边界收束”的最新作者态主线。
🧩 **`3-5` 精品互动课落地（2026-04-07）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/3-5/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/design/interactive-page.md) 与 [course-content/authoring/lessons/3-5/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/design/interactive-contract.yaml)，完成 `unit-3-5-zero-dynamic-improvement` 的 runtime-first 互动课程实现：新增统一预习台入口页、教师页、学生页、`3-5` 专用步骤静态内容面板与工作区，将 `3-5`《零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览、模块 3 单元目录与教师预置教案，并把模块 3 精品课主线扩展为 `3-1 / 3-2 / 3-3 / 3-4 / 3-5`。课程入口继续复用共享 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保持 runtime 媒体入口与课堂外资源埋点统一；课堂内严格对齐 `UNIT_3_5_PAGE_CONTRACTS` 与作者态契约，覆盖零点重排、PD/测速反馈、超前频域原则与非最小相边界的 16 步流程，同时落实 `step-03` 与 `step-15` 的“先提交、后解锁 AI”约束。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-5-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 3-5`、`python3 course-content/scripts/review_lesson_content.py --lesson 3-5 --strict-implementation-contract` 与 `npm run lint` 验证。
🧩 **`3-4` 精品互动课落地（2026-04-07）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/3-4/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-4/design/interactive-page.md) 与 [course-content/authoring/lessons/3-4/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-4/design/interactive-contract.yaml)，完成 `unit-3-4-root-locus-reading-validation` 的 runtime-first 互动课程实现：新增统一预习台入口页、教师页、学生页、步骤静态内容面板与 `3-4` 专用轻量工作区，将 `3-4`《根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览与教师预置教案，并把模块 3 精品课主线扩展为 `3-1 / 3-2 / 3-3 / 3-4`。课堂入口继续复用共享 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保持 runtime 媒体入口与课堂外资源埋点统一；课堂内则严格对齐 `UNIT_3_4_PAGE_CONTRACTS` 与作者态契约，覆盖关键节点读图、参数窗口判断、增益换算与三域验证的 14 步流程。当前已显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-4-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 3-4 --contract course-content/authoring/lessons/3-4/design/interactive-contract.yaml --implementation src/lib/unit-3-4-course.ts --page-contract-const UNIT_3_4_PAGE_CONTRACTS --step-const UNIT_3_4_LESSON_STEPS`、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-3-4-root-locus-reading-validation` 及其师生端动态路由。
🧩 **`3-3` 精品互动课落地（2026-04-07）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/3-3/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-3/design/interactive-page.md) 与 [course-content/authoring/lessons/3-3/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-3/design/interactive-contract.yaml)，完成 `unit-3-3-root-locus-rules` 的 runtime-first 互动课程实现：新增统一预习台入口页、教师页、学生页、步骤静态内容面板、根轨迹专用工作区与教师聚合区，将 `3-3`《根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览与教师预置教案，并把模块 3 精品课主线扩展为 `3-1 / 3-2 / 3-3`。同时补齐 [src/features/interactive/__tests__/unit-3-3-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-3-3-course.test.ts) 的课堂页守卫测试，显式通过 `npx vitest run src/features/interactive/__tests__/unit-3-3-course.test.ts`、`python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-3/design/interactive-contract.yaml --implementation src/lib/unit-3-3-course.ts --page-contract-const UNIT_3_3_PAGE_CONTRACTS --step-const UNIT_3_3_LESSON_STEPS`、`python3 course-content/scripts/review_lesson_content.py --lesson 3-3 --strict-implementation-contract`、`npm run lint` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-3-3-root-locus-rules` 及其师生端动态路由。
🧩 **`3-2` 精品互动课落地（2026-04-07）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/3-2/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-2/design/interactive-page.md) 与 [course-content/authoring/lessons/3-2/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-2/design/interactive-contract.yaml)，完成 `unit-3-2-routh-stability-boundary` 的 runtime-first 互动课程实现：新增独立入口页、教师页、学生页、步骤静态内容面板、学生活动区与教师聚合区，将 `3-2`《劳斯判据——从高阶系统稳定判定到参数可行域》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览与教师预置教案，并把模块 3 精品课主线扩展为 `3-1 / 3-2`。同时补齐 [src/features/interactive/__tests__/unit-3-2-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-3-2-course.test.ts)、[src/features/interactive/__tests__/learning-catalog.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/learning-catalog.test.ts) 与 [course-content/tests/test_interactive_contract_alignment_script.py](/Users/YW/Documents/Site/act.just.edu.cn/course-content/tests/test_interactive_contract_alignment_script.py) 的 3-2 覆盖，新增 [check_contract_alignment.py](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py) 的 `3-2` 预设，并已显式通过 `python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 3-2`、`python3 -m pytest course-content/tests/test_interactive_contract_alignment_script.py`、`npx vitest run src/features/interactive/__tests__/unit-3-2-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts`、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-3-2-routh-stability-boundary` 及其师生端动态路由。
🧩 **课堂外资源互动追踪主链路落地（2026-04-06）**：本轮为课堂外学习资源建立了统一追踪能力，覆盖入口页媒体资源、知识卡片/知识图谱节点、跨域探索模块、独立互动资源与自适应练习等场景。前端在 [src/features/interactive/hooks/useResourceInteractionTracking.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/hooks/useResourceInteractionTracking.ts) 基于既有 `useInteractiveTracking` 封装出资源级埋点助手，统一补齐 `surface/pageType/targetType/targetId/targetLabel/originPath` 等上下文；`LessonEntryMediaHub`、知识卡片、跨域探索页与 standalone `InteractiveProvider` 已接入 `resource_view / resource_open / resource_play / resource_progress / resource_download / resource_complete / knowledge_graph_node_focus / external_module_open` 等事件。后端 [src/app/api/interactive/events/route.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/app/api/interactive/events/route.ts) 现已调整为“所有 valid events 先进入 `InteractionLog`，再按 core/secondary 路由进入治理链”，避免课外 secondary 事件只进缓冲而不入活动流；个人中心 [src/app/api/user/profile/route.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/app/api/user/profile/route.ts) 也已补齐这些事件的标题、描述、链接和徽标映射。整体策略是“先全量进入行为日志与活动流，再把高价值事件升格为 `LearningFact`/能力贡献”，后续其他课堂外资源应沿用这一分层接入模式。
🧩 **`2-1` 入口页预习台与静态讲义下载落地（2026-04-06）**：本轮在 [src/features/interactive/unit-2-1-modeling-language/entry-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-2-1-modeling-language/entry-page.tsx) 保留原有“教师入口 / 自由浏览 / 学生入口”上半区不变的前提下，新增基于 runtime 媒体索引驱动的“课前预习台”，统一接入 `intro-video.mp4`、`audio.m4a`、`slides.pdf`、`course.mp4` 四类预习资源与讲义阅读/下载入口；入口页不再硬编码外链，而是读取 `course-content/runtime/lessons/2-1/media/2-1-media.md`。同时扩展 [src/lib/course-runtime.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/course-runtime.ts) 解析 runtime 媒体索引与静态 `handout.pdf` 路径，`download-handout-pdf` 默认优先下载 runtime 静态 PDF，不再依赖浏览器现场渲染；`course-content/scripts/review_lesson_content.py` 与 [export_runtime.py](/Users/YW/Documents/Site/act.just.edu.cn/course-content/scripts/export_runtime.py) 也已同步支持生成/保留 `media/<lesson>-media.md` 标题骨架、复制作者态 `handout.pdf` 到运行态并把路径写回 `lesson.json`，为后续所有课次复用“作者态 PDF + 运行态媒体索引”的统一入口模式打下基础。
🧩 **`2-4` 精品互动课落地（2026-04-06）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/2-4/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/2-4/design/interactive-page.md) 与 [course-content/authoring/lessons/2-4/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/2-4/design/interactive-contract.yaml)，完成 `unit-2-4-nyquist-margin-entry` 的 runtime-first 互动课程实现：新增独立入口页、教师页、学生页、步骤静态内容面板、学生活动区与教师聚合区，将 `2-4`《Nyquist 图与频域指标入口》正式接入课堂会话路由、课程级 AI 上下文、精品课程总览与教师预置教案，并把模块 2 精品课主线扩展为 `2-1 / 2-2 / 2-3 / 2-4`。同时补齐 [src/features/interactive/__tests__/unit-2-4-course.test.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/__tests__/unit-2-4-course.test.ts) 与目录测试，显式通过实现侧契约校验脚本、`vitest` 定向测试、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-2-4-nyquist-margin-entry` 及其师生端动态路由。
🧩 **`2-3` 精品互动课落地（2026-04-05）**：本轮基于作者态双轨真源 [course-content/authoring/lessons/2-3/design/interactive-page.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/2-3/design/interactive-page.md) 与 [course-content/authoring/lessons/2-3/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/2-3/design/interactive-contract.yaml)，完成 `unit-2-3-frequency-response-bode-intro` 的 runtime-first 互动课程实现：新增独立入口页、教师页、学生页、步骤静态内容面板与学生活动/教师聚合工作台，将 `2-3` 频率响应与 Bode 图初识课正式接入课堂会话路由、课程级 AI 上下文、精品课程总览与教师预置教案；模块 2 精品课主线现已从 `2-1 / 2-2` 扩展到 `2-1 / 2-2 / 2-3`。同时补齐 `unit-2-3-course.test.ts` 与目录测试，并已通过 `vitest` 定向测试、`npm run lint`、`npm run test` 与 `npm run build` 验证，构建产物中已出现 `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro` 及其师生端动态路由。
🧩 **`2-1` 双轨契约实现一致性校验落地（2026-04-05）**：本轮将 `2-1` 精品互动课实现重新收紧到作者态双轨真源，重点把 `step-05 / 06 / 07 / 09 / 15 / 16` 在本地 `UNIT_2_1_PAGE_CONTRACTS` 中漂移的页面区域、教师洞察、telemetry 字段、错因标签与学生演示页预览路径校回 [course-content/authoring/lessons/2-1/design/interactive-contract.yaml](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/2-1/design/interactive-contract.yaml)，并同步补齐 `step-panels.tsx` 对新区域 ID 的静态渲染映射，避免“字段对齐后页面丢内容”。同时为互动课程实现技能新增实现侧一致性校验链路：新增 [scripts/tests/test-interactive-contract-implementation-alignment.mjs](/Users/YW/Documents/Site/act.just.edu.cn/scripts/tests/test-interactive-contract-implementation-alignment.mjs) 负责读取作者态契约并比对本地课程定义；新增 [check_contract_alignment.py](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py) 作为技能固定调用入口；并在 [interactive-lesson-implementation/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-lesson-implementation/SKILL.md) 中明确“实现完成后必须通过该脚本测试”。当前已通过 `vitest` 定向测试、技能脚本测试、`python3` 包装脚本实跑、`npm run lint` 与 `npm run build` 验证，后续继续实现新课时可以直接复用这条“作者态契约 -> 本地实现 -> 技能脚本”闭环。
🧭 **模块3理论课 `3-7` 讲义与媒体定稿修订（2026-04-04）**：本轮直接落到作者态 [course-content/authoring/lessons/3-7/design/handout.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/handout.md) 与 [course-content/authoring/lessons/3-7/design/multimedia.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-7/design/multimedia.md)，把 `3-7` 正式写成“误差分析总入口课”：修正双通道框图，统一改成正式 LaTeX 公式编号，纠正输入作用下闭环传函应写为 `C(s)/R(s)`，补齐非单位反馈下的输入/扰动误差传函与“同分母、异分子”说明；在型别部分新增 `v` 与系统型别关系、静态误差系数表与稳态误差表及适用条件；新增“给定与扰动共同作用”例题；把 `2.6` 改写为“纯增益不改结构，因此必须引入 `PI/滞后`”的过渡逻辑；第三章则统一为“纯增益局限 -> `PI` 时域设计 -> 滞后时域设计 -> `PI` 频域设计 -> `PI`/`PD` 对比”的设计链。媒体侧新增根轨迹/时域/频域对比图，数值复现脚本统一收敛到 MATLAB/Octave `.m` 文件，附录不再把框图或 Python 脚本当作复现脚本。
🧭 **模块3理论课 `3-7` 边界再增强（2026-04-02）**：本轮继续在 `course-content/syllabus-refactor/unit-design-details/module3.md` 上收紧 `3-7`《型别、积分环节与稳态改善》的正式职责，把它从“稳态改善线入口课”进一步升级为“误差分析总入口课”：除原有型别、`Kp/Kv/Ka`、`PI/滞后` 外，现已明确将“系统结构来源 vs 输入信号来源”的两类误差来源、给定输入与扰动作用下的闭环传递函数、系统总输出/总误差、输入/扰动作用下的误差传递函数、终值定理与静态误差系数法统一纳入本课，并把 `pptx/3方框图_控制系统结构` 从可选补强提升为必融入资源，用于梳理比较点、双通道与总误差对象；同时进一步明确 `2-1` 只保留闭环对象求等效的结构表达入口，不再承担这组内容的正式分析主线，从而为后续作者态把 `3-7` 写成真正“讲透误差而非只给表”的课程提供稳定边界。
🧭 **模块3实践课 `3-9` 大纲增强收口（2026-04-01）**：本轮基于资源库正式输入规则，对 `course-content/syllabus-refactor/unit-design-details/module3.md` 中 `3-9`《稳定—动态—稳态综合映射实验》完成大纲层增强：将其从“模块3内容回顾填表”升级为“模块4入口前的结构判断闭环”，补齐“统一对象 -> 基准/积分/极点线或零点线补强 -> 滞后教师演示 -> 模块4入口判断”的课堂组织主线，新增资源融入评审单并正式固定 `pptx/15.2根轨迹分析综合`、`pptx/21三频段_各司其职`、`pptx/23滞后超前` 与船舶频域案例 `5.1` 为主资源，同时明确排除 `pptx/20宽备窄用_稳定裕度` 与 `pptx/10.1校正_实现控制的手段`，避免 `3-9` 退回稳定裕度专题或控制器名称分类；另外同步补齐讲义、教案、互动课与媒体清单的本课级约束，为后续作者态制作提供稳定边界。
🧭 **模块3理论课 `3-7` 大纲增强收口（2026-04-01）**：本轮基于资源库正式输入规则，对 `course-content/syllabus-refactor/unit-design-details/module3.md` 中 `3-7`《型别、积分环节与稳态改善》完成大纲层增强：补齐“误差对象建立 -> 直接求与快速判并列 -> 增益 vs 型别 -> `PI/滞后` 对照 -> 过渡到 `3-8`”的课堂组织主线，新增资源融入评审单并正式固定 `pptx/9稳态误差_准确性的度量`、`pptx/23滞后超前`、`pptx/21三频段_各司其职` 为主资源，同时将 `pptx/13时域分析习题2025`、`pptx/3`、`pptx/4` 与思政整合点降为可选补强，并明确排除船舶案例，避免 `3-7` 偏离型别与低频补偿主轴；另外同步补齐讲义、教案、互动课与媒体清单的本课级约束，为后续作者态制作提供稳定边界。
🧭 **模块3理论课 `3-5` 大纲增强收口（2026-04-01）**：本轮未下钻作者态成稿，而是先在 `course-content/syllabus-refactor/unit-design-details/module3.md` 完成 `3-5`《零点引入与动态改善》大纲层增强：补齐“只调增益为什么很快不够 -> 基准/PD/测速反馈/简单超前比较 -> 右半平面零点教师演示”的课堂组织主线，新增资源融入评审单并正式固定 `pptx/12根轨迹_基本形态`、`pptx/10.1校正_实现控制的手段`、`pptx/22串联校正` 为主资源，同时明确排除 `pptx/23滞后超前`、思政案例与船舶 `6.1-6.3`，避免 `3-5` 提前滑入组合校正、工程整定或模块4设计链；另外同步补齐讲义、教案、互动课与媒体清单的本课级约束，为后续作者态制作提供稳定边界。
🧭 **模块3实践课 `3-4` 作者态剩余产物已补齐（2026-04-01）**：本轮完成 `course-content/authoring/lessons/3-4` 的剩余制作收口：在现有学生版讲义基础上补齐封面漫画位与 `handout.pdf`，新增教师版课堂讲义 `teacher-handout.md` 与 `teacher-handout.pdf`，落地 `manifest.json`、`graph/nodes.jsonl`、`graph/relations.jsonl`、`knowledge/cards/lessons/3-4/sequence.json` 以及 `关键节点读图 / 参数窗口判断 / 根轨迹增益换算 / 对象化三域验证` 四个新节点卡片；同时补齐 `boppps.md`、`interactive-page.md`、`multimedia.md`，把 `3-4` 正式收束为“关键节点读图 -> 参数窗口判断 -> 增益换算 -> 三域验证”的实践课真源，并新增 `3-4-cover-comic.png` 与 `3-4-gain-conversion-card.png` 两个代码生成媒体，为后续 runtime 实现与互动课落地提供完整作者态输入。
🧭 **`2-2` 互动设计文档升级为 V2 双轨真源（2026-03-30）**：作者态 `course-content/authoring/lessons/2-2/design/interactive-page.md` 已从旧版叙述式页面稿重写为 V2 页面蓝图，补齐 `文档职责 / 表述规则 / 全课总览 / 页面骨架 / 模块清单 / 埋点与教师数据 / AI 边界 / 学生演示预览口径`；同时新增 `course-content/authoring/lessons/2-2/design/interactive-contract.yaml`，把 17 个步骤的模板、模块、内容块、互动规则、教师控制、聚合统计与验收条件收束为机读契约。`course-content/scripts/review_lesson_content.py --lesson 2-2` 已能在 runtime `review/` 中导出 `interactive_contract_source`、`contract_path`、完整 `contract_required_fields`，并确认 `missing_contract_fields`、`step_contract_issues`、`missing_target_steps` 全部为 `0`，后续 `unit-2-2-time-domain-response` 的实现应直接消费这组双轨真源。
🧭 **互动课设计文档 V2 与学生页预览对齐（2026-03-30）**：为主线 `2-1` 新增 `course-content/authoring/lessons/2-1/design/interactive-contract.yaml` 结构化互动契约，把页面布局、模块、互动类型、埋点、教师端聚合指标与页内 AI context 收紧为机器可读真源；同步扩展 `course-content/scripts/review_lesson_content.py` 与 `runtime/lessons/2-1/review/interactive-page-check.json`，开始校验 V2 契约字段完整性，同时保持旧课兼容路径；教师侧预置教案弹窗也已新增“学生页预览”入口，明确学生演示页为默认预览口径，避免教案骨架弹窗继续被误当作真实页面预览。
🧭 **2-1 精品互动课主线替换落地（2026-03-30）**：新增 `/interactive-learning/courses/unit-2-1-modeling-language` 精品互动课堂，并补齐教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]`、预置教案、课程目录卡片、会话标题识别与步骤级 AI 上下文；课程实现统一消费 `course-content/runtime/lessons/2-1` 的 `lesson.json`、`graph-overlay.json`、`handout.md`、`review/*` 与正式媒体资源，按 16 步流程覆盖“对象建立 -> 对象识别 -> 结构表达 -> 总体对象”的完整主线，并在课堂内实现前测/后测、页内 AI 对照、典型环节识别、结构连接判断、梅森术语配对与 `Delta_k` 接触关系辨析；同时将旧 `1-1 / 1-2` 从公开课程路由、精品课程目录、预置课注册与会话主线别名中下线，主线入口正式由 `2-1` 接管，并通过定向单测、`npm run lint`、`npm run build` 验证。
🧩 **2-1 双轨契约实现收口（2026-03-30）**：`src/lib/unit-2-1-course.ts` 现新增本地 `UNIT_2_1_PAGE_CONTRACTS`，把作者态 `interactive-page.md + interactive-contract.yaml` 中对运行时真正关键的模板、区域顺序、互动类型、教师聚合和预览路径收束成代码真源；`UNIT_2_1StepContentPanel` 不再固定“先公式后图片”，而是按契约区域顺序重排 `step-02 / step-13 / step-14` 等关键页面的首屏图像位置；学生端互动从旧的 `quiz/form/none` 升级为 `binary_choice / quiz_group / short_response / multi_check / reflection_form / drag_match / rule_judge / hotspot_labeling / bucket_sort / choice_check / path_highlight`，教师端同步补齐拖拽错位、热点命中、桶分类和路径高亮等轻量聚合卡；同时新增 `notes/2-1.md` 设计对照表，并继续保持 `/student/demo` 与真实学生页共用同一渲染链，避免预览与学生视图再次脱节。
🧹 **模块1正式课残留全面清理（2026-03-30）**：本轮进一步把所有已退役的 `1-*` 正式课链路从运行时实现中移除，包括 `unit-1-1`、`unit-1-2` 以及历史映射到 `1-1 ~ 1-5` 的 `l2a/l2b/l2c/l2d/lsum`。已同步删除对应的 Next 路由、互动课实现目录、课程元数据/AI 上下文、教师预置教案与课堂码 premium 解析别名；互动课程目录现仅保留模块 `2` 的 `2-1 / 2-2` 主线单元，`src` 侧不再保留模块1正式课活跃入口，避免旧课继续影响构建、会话跳转和课程展示。
🧩 **iCourse163 客观题自适应题库落库（2026-03-28）**：已将 `iCourse163 bankType=4` 导出的 `279` 道题整理为独立于解析题库的纯文本 objective-bank 流程，形成 `tmp/icourse-question-bank-repair/ -> tmp/icourse-formula-map.complete.json -> course-content/questions/objective-bank/icourse-bank-bankType4.{jsonl,index.json,overview.md,errors.json}` 的稳定链路；最终仅纳入 `226` 道客观题（单选 `96`、多选 `129`、填空 `1`），主观题全部排除，公式图片均已人工修正为纯文本/LaTeX 形式，并为每题补齐 `question_kind`、`choice_mode`、`correct_answers`、`knowledge_tags`、`source_bundle`、`adaptive_metadata` 等字段，作为后续数据库驱动自适应题库的原生基础制品。
🧭 **`2-2` 互动课硬切换为独立主线课次（2026-03-30）**：本轮将旧 `1-3` 时域响应精品课彻底切换为独立 `2-2` 课次实现：作者态 [interactive-page](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/2-2/design/interactive-page.md) 已补齐“讲义核心内容映射 + 步骤级静态承载内容/互动升级点”合同，课堂实现统一切到 `unit-2-2-*` 命名、真实 `2-2-td-*` runtime 媒体路径与 `unit-2-2-time-domain-response` 路由，`step-14/15` 也从过时的船舶对照口径校回讲义 `3.2/3.3` 的“由指标反推参数范围 + 方法总结/轻量桥接”主线；同时清理 `lesson-id-map` 中对当前课次的 `1-3` 请求入口，把 2-2 序列知识卡与 runtime review 包同步回写为新课次身份，并通过 `pytest`、`vitest`、`lint` 与 `review_lesson_content.py --lesson 2-2` 验证。
🧭 **模块2主线课 `2-2 / 2-3 / 2-4` 与频域知识图同步收口（2026-03-28）**：本轮把模块2中段主线进一步收束为“`2-2` 标准时域对象建立 → `2-3` 频域对象建立与 `Bode` 首轮进入 → `2-4` `Nyquist` 图与频域指标入口”，同步回写 `syllabus-refactor`、`authoring` 讲义/教案/互动页/媒体清单与 `runtime` 产物；其中 `2-2` 的运行时媒体统一切到课次前缀命名并补齐 `PDF + SVG` 套件，`2-3` 已导出完整 `runtime/lessons/2-3` 包，`2-4` 讲义与教师稿改为“`Bode` 收束为轨迹、裕度与反向识别”的表达；同时补齐频域知识卡与 `authoring/runtime` 知识图同步，新增 `Bode首轮骨架`、`交接频率（转折频率）`、`周期信号频谱` 等节点资源绑定，并把 objective-bank 概览 Markdown 中的公式片段自动包裹为 `$...$` 以提升可读性，相关 Python 测试已同步扩展。
🧭 **自动控制原理主线课 2-1 / 2-2 / 2-3 内容制作收口（2026-03-25）**：本轮完成主线 `2-1`《建模与变换语言——从真实对象到统一分析对象》学生版讲义、多媒体清单、TikZ 结构图组、导入视频提示词与 PDF 导出；同步修订 `2-2` 讲义的图片占位与版式后重新导出学生版 PDF；落地 `2-3` 讲义、配套频域代码直出图、封面漫画/信息图/视频等媒体包，并把知识图基础文件同步到最新状态。同时更新 `lesson` 技能与多媒体参考：导入视频提示词默认显式调用 `seedance`，用户未指定时允许随机选定一个最合适的单一风格，电影感方案默认弱化公式与板书；PDF 模板补充 `needspace` 以避免大图在页底被截断。
🧯 **数据治理 worker 故障收敛与低压调度改造（2026-03-25）**：针对远端 `act-obe-worker` 在 Redis `maxmemory` 命中后反复报错刷满 `ctr.log` 的事故，本轮已把 `scripts/workers/data-governance-worker.ts` 重构为“延迟启动 + 基础设施错误识别 + 日志节流聚合 + 冷却文件熔断 + 进程级未捕获异常收敛”的模式；`scripts/workers/scheduler.ts` 不再对白天每 5/10/15 分钟高频注册重复任务，而是改为“凌晨二次事件批处理 + 每小时活跃学生快照 + 每日班级快照”的 coordinator 调度；`src/lib/data-governance/worker-client.ts` 与 scheduler 注册逻辑统一补齐 `removeOnComplete/removeOnFail`，避免 BullMQ 历史任务在 Redis 中持续堆积；`deploy/podman/deploy.sh` 的默认 `REDIS_MAXMEMORY` 已提升到 `512mb` 并继续保持 `noeviction`。本轮明确只处理运行可靠性，`runtime` 课程资源映射仍暂缓，待资源补齐后再单独收口。
🧭 **lesson 技能切换到新课纲与主线/归档双轨资源（2026-03-23）**：`lesson` 技能与其参考脚本现统一以 `course-content/syllabus-refactor/module-skeletons.md`、`unit-design-details/` 和 `course-content/authoring/shared/lesson-id-map.json` 为真值来源，不再依赖旧 `docs/SyllabusRefactor.md` 或根目录 `note/`；`course-content/authoring` 与 `course-content/runtime` 已落地“主线 + legacy 归档”结构，其中旧 `1-1`、`1-2`、`L-2a/L-2b/L-2c/L-2d/L-sum` 统一迁入 `legacy/*`，主线 `2-2` 的 `manifest`、`sequence`、`review/*`、`lesson.json`、`graph-overlay.json` 与 handout 口径已全部改为新编号；同时补齐 `course-runtime` 读取映射、`kg_query.py`/`sync_overlays.py`/`export_runtime.py`/`review_lesson_content.py` 的新路径与无界面 Matplotlib 导出环境，互动课程总览页也改为“精品课程 + 归档课程”分组，避免 legacy 课次继续占据主线展示。
🧭 **1-3 时域响应精品互动课增强收口（2026-03-21）**：新增 `/interactive-learning/courses/unit-1-3-time-domain-response` 精品互动课堂入口，并补齐教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]`、预置教案、课堂码路由识别与步骤级 AI 上下文；首页统一消费 `course-content/runtime/lessons/2-2` 的 `lesson.json`、`graph-overlay.json`、`handout.md`、`review/*` 与 6 张代码直出 SVG；课堂内按 `course-content/authoring/lessons/2-2/design/interactive-page.md` 落地 17 步流程，并在本轮补强 `step-07` 参数-公式-现象三列表、`step-09` 四指标叠加总览和 `step-13` 例题三步法计算面板；同时新增定向守卫测试并通过 `npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`、`npm run lint`、`npm run build` 验证
🧭 **1-2 系统结构图精品互动课落地（2026-03-20）**：新增 `/interactive-learning/courses/unit-1-2-block-diagram-simplification` 精品互动课堂，并补齐教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]`、预置教案、课堂码路由识别与步骤级 AI 上下文；按 `course-content/authoring/lessons/legacy/1-2/design/interactive-page.md` 完成 17 步课堂流程，覆盖结构图四元素、串联/并联/反馈、等效变换练习、AI 对照页、信号流图与梅森公式、前后测和总结页；首页统一从 `course-content/runtime/lessons/legacy/1-2` 读取知识图、知识卡与讲义内容，并直接消费 `review/*` 审查产物和 4 个代码直出 SVG；同时通过 `test-1-2-course-registration`、`test-1-2-session-framework-adoption`、`test-1-2-entry-runtime-content`、`npm run lint`、`npm run test`、`npm run build`
🧭 **课程审查技能拆分与 1-2 试跑（2026-03-20）**：新增 `.codex/skills/lesson-content-review`，把互动课程制作前的正文、教案、知识卡与代码直出媒体审查从 `interactive-lesson-implementation` 中拆出；新增 `course-content/scripts/review_lesson_content.py`，按“正文 -> BOPPPS -> sequence/knowledge cards -> multimedia -> runtime review”顺序执行审查并汇总导出；`course-content/scripts/export_runtime.py` 现优先消费 `authoring/.../media/processed` 并把审查索引写入 `lesson.json.review`，同时保留 `media/raw` fallback 兼容旧课；已在 `1-2` 课次补齐 10 张知识卡和 4 个代码直出 SVG，生成 `handout.md`、`review/boppps.md`、`review/review-report.md` 等 runtime 产物，并通过定向测试与技能校验
🧭 **1-1 拉氏变换精品互动课落地（2026-03-20）**：新增 `/interactive-learning/courses/unit-1-1-laplace-transfer-function` 精品互动课堂，并补齐教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]`、预置教案、课堂码路由识别与步骤级 AI 上下文；按 `course-content/authoring/lessons/legacy/1-1` 设计稿完成 14 步课堂流程、零极点/典型环节工作区、文本词云与选择题统计反馈闭环；同时完成 `1-1` 课次 `authoring -> runtime` 导出，生成 `lesson.json`、`graph-overlay.json`、`handout.md` 与 6 个媒体资源，并通过定向测试、`npm run lint`、`npm run test`、`npm run build` 验证
🧭 **教师首页与上课历史整理（2026-03-19）**：教师首页第一行统计卡现支持直接进入核心入口，其中“我的班级”可点击进入班级管理，“上课历史”新增为教师维度的已结束课堂总表入口；首页第二行快捷操作删除与 `/teacher/classes` 重复的“开始上课 / 班级与学情”卡片，改为 5 个均分入口并统一接入全局 `teacher-home-*` 语义样式以适配浅色/深色主题；新增 `/teacher/history` 与 `/api/teacher/sessions`，教师可查看全部已结束课堂、将课堂归档到某个现有班级，或删除课堂；班级页课堂历史的已结束课堂入口统一收敛到课堂统计页 `/classroom/teacher/[sessionId]/review`
🧭 **教师端班级学情入口重构（2026-03-19）**：教师首页不再暴露无上下文的“班级能力驾驶舱”与管理员“数据治理”入口，统一改为从 `/teacher/classes` 进入班级；班级详情页重构为“班级学情总览 / 课堂历史 / 学生清单 / 重点关注”四类入口卡，学生清单不再只显示技术分和伦理分，而是显示画像等级、风险级别、近期趋势、成长档案数量等治理结果；新增教师聚合接口 `/api/teacher/classes/[classId]/insights` 与 `/api/teacher/classes/[classId]/students/[studentId]/insights`，并落地学生个体学情页 `/teacher/classes/[classId]/students/[studentId]`；`/teacher/classes/[classId]/analytics-v2` 现基于真实治理快照渲染能力维度、画像分布、能力矩阵与重点学生，同时修复 `heatmap` 接口因错误使用下划线列名导致的 500，相关页面样式统一接入全局 `teacher-insight-*` 语义类以适配浅色/深色主题
🧭 **管理员后台重构（2026-03-19）**：`/admin` 已调整为统一后台入口页，用户管理、系统使用量统计、数据治理三个能力统一收口到同一管理总台，并分别下沉到 `/admin/users`、`/admin/states`、`/admin/data-governance` 子路由；用户管理页改为复用后台全局浅色/深色样式，浅色模式不再混入深色硬编码组件；新增 `/api/admin/system-usage` 真实统计接口，关闭演示模式后可直接读取实际使用量；数据治理页完成中文化与信息层级增强，可直接查看事实分布、队列健康、风险清单与学生快照明细
🧪 **数据治理事实沉淀校验（2026-03-19）**：本地再次通过 `bash scripts/db/sync-remote-db-to-local.sh` 全量同步远端数据库，当前对齐后的关键计数为 `User=291`、`LearningFact=0`、`StudentCompetencySnapshot=1829`、`StudentProfileSummary=100`、`ClassCompetencySnapshot=2`、`LearningEventBatch=25`；随后基于新的事件归一化链路执行 `npx tsx scripts/db/backfill-learning-facts-from-event-batches.ts`，成功从 `25` 个事件批次中回放出 `55` 条 `LearningFact`（覆盖 `41` 个用户，类型均为 `question`），再次 dry-run 为 `0` 候选，说明本地回放脚本已具备幂等性；同时核查发现远端数据库中 `LearningEventBatch` 与 `StudentCompetencySnapshot` 仍在持续增长，但 `ClassCompetencySnapshot` 仅有 `2` 条、未体现出按 15 分钟持续产出的节奏，说明数据治理链路已部分开展，但“班级快照调度稳定落地”仍需继续跟进
🧰 **服务运维技能、本地数据同步与教师驾驶舱守卫修复（2026-03-19）**：已将生产库导出并同步回本地开发数据库，恢复后关键计数核对为 `User=291`、`StudentCompetencySnapshot=96`、`ClassCompetencySnapshot=2`、`StudentProfileSummary=96`，便于后续围绕真实课堂数据排查与分析；同时参考 `.claude/skills/server-ops` 在仓库内新增 `.codex/skills/server-ops`，采用“主入口只给总览、详细流程拆到 `references/`”的结构，覆盖远端调查、部署验收、数据库同步与测试账号核对；另外修复 `src/app/teacher/page.tsx` 与 `src/app/teacher/resources/page.tsx` 的服务端鉴权空会话崩溃，未登录时统一重定向 `/login`，管理员重定向 `/admin`，其他非教师角色重定向 `/dashboard`，并新增 `scripts/tests/test-teacher-auth-guards.mjs` 做回归校验
🚀 **服务器部署收口（2026-03-19）**：补齐 `prisma/migrations/20260319092000_add_data_governance_and_missing_schema_updates`，将此前只存在于 `schema.prisma` 的 `LearningFact`、`StudentCompetencySnapshot`、`StudentProfileSummary`、`ClassCompetencySnapshot`、`StudentRiskFlag`、`GrowthRecord`、`LearningRecommendation`、`EventDictionary`、`KonlingSession`、`LearningEventBatch` 等表正式纳入迁移；生产镜像重新打包 `Redis + worker + scheduler` 运行链路并部署到 `act.adapt-learn.online`，远端 `.env.server` 已对齐 `REDIS_URL`、`WORKER_NAME`、`WORKER_CONCURRENCY`、`DATABASE_URL(connection_limit=10&pool_timeout=20)` 与 `APP_PORT=8084`；验收确认公网首页与 `/api/auth/session` 正常、Redis 策略为 `noeviction`、BullMQ 重复任务已注册，数据治理 worker 已成功生成学生能力快照与画像摘要
🛠️ **课堂服务与导航回补（2026-03-19）**：按 `docs/server_optimize.md` 与 `docs/plans/nevplan.md` 重新校正课堂链路和导航统一方案；学生端课堂会话默认关闭 SSE，去除“实时连接失败，已降级到轮询模式”页面提示，修正 Redis 发布/订阅频道不一致问题，并进一步收窄 `student-view` 查询与 `/api/session/[sessionId]` Redis 快路径返回；L-2a/L-2b/L-2c/L-2d/L-sum 的互动提交补齐“提交成功”常驻提示与锁定逻辑，L-sum 第 10 页按钮文案改为“打开控灵助手”且页内控灵头像在消息气泡中恢复显示；知识图谱、评审入口、互动学习、互动课程、跨域探索、章节组件与 Lesson-02 页面重新接入 `UnifiedTopBar`，控灵浮动按钮位置下调；本地 `startup/shutdown` 同步纳入 Redis、`worker:dev` 与 `worker:scheduler`
🔧 **L-sum课程演示模式与教师页面错误修复（2026-03-18）**：修复 L-sum 课程演示模式 "Maximum update depth exceeded" 无限渲染错误（`step-panels.tsx` 使用 `useMemo` 缓存 `getStepActivity` 返回值）；修复教师页面不显示课堂码问题（显式构建包含 `joinCode` 的 session 对象）；优化课堂同步轮询错误处理（`use-session-progress-channel.ts` 添加错误退避、状态合并更新、5秒暂停机制，防止多轮询竞争导致的抖动和 fetch 失败）
🗃️ **数据治理系统（2026-03-18）**：新增数据治理核心模块（competency-engine, risk-detector, event-buffer），实现学生六维能力画像计算、风险学生检测、学习事实追踪；配套新增学生成长追踪页面（`/profile/growth`, `/profile/portfolio`）、教师分析 v2（`/teacher/classes/[classId]/analytics-v2`）、学生诊断（`/teacher/students/[studentId]/diagnosis`）及相关 API；管理员统计面板支持演示/真实数据切换；新增 vitest 单元测试配置与数据治理模块测试套件
🔧 **L-2d课堂服务稳定性整改（2026-03-18）**：针对L-2d课程期间出现的服务不稳定问题（数据库连接池耗尽、外键错误、页面回跳），实施P0级紧急整改：
- 调整Prisma连接池配置（limit=3→10, timeout=10s→20s）
- 修复InteractionLog外键错误，添加resourceId格式校验与降级处理
- 修复教师端页面回跳，实现基于时间戳的版本控制机制
- 添加sharp库解决图片处理警告
- 详见部署指南：`docs/L2D-STABILIZATION-DEPLOY.md`
🧠 **长期记忆骨架（2026-03-17）**：新增 `.codex/memory/` 分层长期记忆目录，按“项目总览 / 架构 / 运维 / 业务域 / 决策 / 事故 / 工作流 / 归档”组织跨会话知识，作为 `AGENTS.md` 规则与 `docs/ProjectDescription.md` 阶段进展之外的第三层项目记忆
🧩 **整改进展**：统一课程框架已确立为 DB BOPPPS 教案 + TeachingResource/registry + 互动埋点主链路（规范见 `docs/Unified_Lesson_Framework.md`），课次整改与预置教案对齐中；统一仿真内核（固定步长时钟 + Tustin 离散化 + 非线性积分器）覆盖 Control Odyssey 与虚拟仿真，Control Odyssey 关卡扩展至 15 关；仿真规范说明见 `docs/Simulation_Guidelines.md`
⚡ **首页与仿真加载优化（2026-03-02）**：首页船模改为“截图优先 + 3D 后台懒加载”，移除首屏一次性预加载全部 7 个 GLB（约 125MB）策略，改为按轮播仅预热“当前 + 下一”模型；仿真页改为“场景先渲染、船模独立 Suspense 加载”，在船模解析期间显示“模型加载中”占位动画，避免黑屏等待
🧰 **首页模型策略开关（2026-03-03）**：新增平台级配置 `PlatformSetting` 与管理接口 `/api/admin/platform-settings`、公开读取接口 `/api/platform/settings`；管理员可在 `/admin/config` 切换“首页动态模型渲染”，首页根据开关在静态截图与动态 3D 预览间切换
📉 **弱网与并发降载（2026-03-03）**：首页仿真入口与学生高频入口关闭仿真路由预取，船模预加载改为串行队列，并在 `saveData/2g/3g` 网络下自动静态回退；模型加载失败时自动重试并回落静态图
🧪 **邮轮仿真教学标定（2026-03-02）**：重构邮轮舒适度评估模型（横摇 + 横向加速度 + 转艏角速度耦合），并引入“满舵转向横倾激励”，使海况等级、波向、减摇鳍与陷波滤波器开关在状态监控与舒适度评级中具备显著可感知差异；同时新增单次仿真校验时长（180s）与到时自动结束机制，结束后锁定评估参数用于一次性一致性校验
🐘 **容器运行时兼容修复（2026-03-02）**：`prisma/schema.prisma` 增加 `binaryTargets = [\"native\", \"linux-musl\"]`，并将构建脚本调整为 `prisma generate && next build`，解决 Podman/Alpine 环境下 `linux-musl` Query Engine 缺失导致的课外展示页加载失败
🧱 **容器自动迁移（2026-03-04）**：镜像新增 `docker-entrypoint.sh`，容器启动时默认执行 `prisma migrate deploy`（可通过 `RUN_MIGRATIONS_ON_START=0` 关闭），并将 `prisma/migrations`、`@prisma`、`prisma` CLI 一并打包进运行镜像，避免部署后出现 `PlatformSetting` 等缺表问题
📊 **管理员统计页（2026-03-05）**：新增 ` /admin/states ` 静态统计面板（全量模拟数据），按教师 18 人、学生 1890 人规模展示互动类型拆分、7类仿真访问量、Control Odyssey 高访问量、月度访问趋势与完课率趋势图，支持管理后台直接跳转访问
🧭 **导航更新**：预置教案/教案新建与编辑/教学资源管理页面新增“返回教室工作台”入口（`http://localhost:3001/teacher`）；首页与认证导航新增“评审入口”（`/review`），汇总 DevelopmentPlan 用户备注对应的分支页面
📺 **课外展示班级落地（2026-03-01）**：演示学生数据并入 `2023自动化启航班`（30 人，`demo` 脱班保留账号），班级描述更新为“AI-OBE平台教改班”；课堂历史重建为 17 次（2025-03 至 2025-06 每周一节 + 当前展示课《柔性之海——豪华邮轮的舒适度控制》）；课堂记录详情页改为按当前课程 `course_review` 数据展示“课前/课后能力追踪 + 课后个性化补强路径”，柔性之海固定重点学生 `20230010102608/20230010102605`，其余课程重点学生按课次随机化
🛟 **仿真统一改造**：7 个船舶仿真统一为左侧监控、右侧“控制/评估/AI伴学”标签式面板，支持收起/展开与统一配色主题
🎥 **视角统一**：主视角统一为左舷后方约 45° 且默认跟随，统一相机距离与目标中心构图，跨仿真保持一致
🧩 **场景合并**：`/simulations/cruise-comfort` 与 `/simulations/icebreaker-robust` 能力合并入 `/simulations/cruise` 与 `/simulations/icebreaker` 主场景
🧠 **知识点同步**：启动脚本默认执行 `npm run seed:knowledge`，确保预置教案克隆所需 KnowledgeNode 已补齐
📘 **课程更新**：新增 Lesson 01「反馈：控制原理的核心思想」、Lesson 02「拉氏变换：工程直觉的数学实现」与 Lesson 05「方框图、信号流图与梅森公式」预置教案与互动学习入口，原 Lesson 02 建模课迁移为 Legacy；Lesson 03 预置教案与知识节点绑定已完成；新增 Lesson 16「非线性系统与描述函数基础」与 Lesson 17「描述函数分析法与自振判别」预置教案、互动学习入口与知识节点；新增 L-2a「三张面孔，同一系统 · 时域直觉速通」与 L-2b「根轨迹直觉速通 · 极点迁移的几何感知」两门精品互动课堂，按重构课程入口独立展示，其中 L-2b 已打通 `course-content/runtime` 运行时媒体链路与双端同步课堂页
🧾 **教案管理**：我的教案支持三点菜单删除并二次确认
🚀 **部署方式**：本地开发 + Docker 容器化部署
🚚 **远端部署脚本（2026-03-11）**：新增 `scripts/remote-deploy.sh`，在本机调用 `scripts/build.sh` 完成镜像构建后，自动上传 `deploy/images/act-obe.tar` 到服务器 `/home/projects/act/images/act-obe.tar`，执行远端 `/home/projects/act/scripts/0-one-key.sh`，并验证公网、数据库与 systemd/Podman 服务状态
🗂️ **课程内容目录迁移（2026-03-11）**：新增 `course-content/` 作为课程制作统一目录，采用 `authoring/` 与 `runtime/` 分层，沉淀 L-2a 课次设计稿、图谱增量、知识卡片、媒体目录骨架与面向 Claude 的迁移/闭环说明
🧠 **runtime 知识源接线（2026-03-13）**：新增 `course-content/scripts/export-runtime.sh` 导出链路，当前已完成 L-2b 试点：全局知识图谱改从 `course-content/runtime/knowledge/graph/{nodes.json,relations.jsonl}` 读取；`authoring/knowledge/cards/nodes/*.md` 与 `content/concepts/*.mdx` 会同步到 `course-content/runtime/knowledge/cards/`；L-2b 额外生成 `lesson.json`、`graph-overlay.json` 与 `handout.md`，为后续 L-2c 及新课次统一接入 runtime 奠定基础
🗺️ **L-2b 首页 runtime 导学（2026-03-13）**：L-2b 课程首页已接入 runtime lesson bundle，入口页可直接展示本课知识点网络、节点卡片正面与统一 `详情 / 概览` 视图、按 sequence 排列的知识卡片预览，以及支持 LaTeX/媒体渲染的讲义入口
🧾 **L-2b 首页二次收口（2026-03-13）**：按最新课程规范将教师入口/自由浏览/学生入口上移至首页最上方；知识点网络增加前置/后置箭头关系；讲义入口改为智能摘要并支持导出 PDF；学生页与教师页新增按 runtime 编排驱动的步骤知识卡抽屉，且仅在当前步骤存在知识卡时显示
🧩 **L-2b 知识卡统一框架（2026-03-13）**：首页节点卡片与步骤抽屉统一复用 `KnowledgeCard` runtime 分节渲染；`course-content/runtime/knowledge/cards/nodes/*.md` 只在概览态展示 `## 首页`，通过 `详情 / 概览` 切换到 `## 详情`，标题保持不变；非首页知识卡入口统一挂到页面标题模块右上角
🎨 **L-2b 主题框架收口（2026-03-13）**：L-2b 首页与课堂内页已统一切到精品课深浅主题语义类；深色模式下移除残留的深字深底与浅色突兀块，浅色模式保持原有高对比；同时新增 `test-l2b-theme-no-hardcoded-styles.ts`，明确禁止在课程模块继续新增 `dark:`、十六进制色和旧式色阶硬编码
🧾 **L-2b 讲义 PDF 服务端导出（2026-03-14）**：弃用首页讲义入口此前依赖 `window.print()` 的前端导出方式，新增 `/interactive-learning/lessons/[lessonId]/handout-print` 服务端讲义打印页与 `/api/course-runtime/lessons/[lessonId]/handout-pdf` 下载接口；当前由服务端使用 Playwright/Chromium 渲染 runtime 讲义并生成 PDF，前端仅负责触发下载，从而避免用户浏览器打印能力差异导致的空白页或无文件产出
📡 **L-2c 频域直觉课首轮落地（2026-03-14）**：新增 L-2c「频域直觉速通 · Bode图与相位裕度初识」精品互动课，完成 `course-content/authoring -> runtime` 导出、17 步课堂配置、首页 runtime 导学、页内 AI 助手、选择题/文本题教师汇总、步骤知识卡抽屉与教师/学生双端课堂页；同时将首页知识图/讲义/PDF 模块提炼为共享 `LessonEntryRuntimeSections`，供 L-2b/L-2c 统一复用，并补做浏览器级验收与共享知识卡链路的主题语义化收口，继续明确拒绝旧式颜色硬编码
🧪 **L-2d 三域联动实践课已接入验收链路（2026-03-14）**：`L-2d`「三域联动探索 · 平台操作初体验」现已完成 `practice-guide.md -> runtime/handout.md` 导出、14 步课堂配置、首页 runtime 导学、三面板联动工作区、任务一/二/三即时评分、步骤知识卡抽屉与教师/学生双端课堂页；同时补齐 `test-l2d-*` 定向验证脚本，并修复 runtime 导出测试在 ESM 执行下的路径兼容问题
🧠 **1-1 拉氏变换精品互动课（2026-03-20）**：新增 `/interactive-learning/courses/unit-1-1-laplace-transfer-function` 精品互动课堂入口，以及教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]` 同级隔离路由；首页接入 runtime lesson bundle，统一展示知识点网络、知识卡片预览、讲义入口与 PDF 导出；课堂内按 14 步落地页内 AI 助手、教师释放/显示答案、学生提交状态、词云与回复列表、零极点联动/零点作用/典型环节滑块工作区；`course-content/authoring/lessons/legacy/1-1/media/raw/*.py` 已补齐 `--output` 输出参数并通过 `processed` 审核后导出到 `course-content/runtime/lessons/legacy/1-1/media`
🧭 **L-sum 设计可行域课同步闭环落地（2026-03-15）**：`L-sum`「设计可行域——让约束成为指南针」在正式课堂框架基础上，本轮继续接入真实 `/api/session` 会话读取与步骤推进、教师端 `teacher:course-sync` 广播、学生端 `student:lsum:state` 持久化、首次对齐/不同步提示、课堂结束态提示，并修复课程总入口的精品课程过滤链路，使 `L-sum` 正式出现在 `/interactive-learning/courses` 的精品课程区；同时新增 `tests/lsum-premium-course.spec.ts` 与 `tests/lsum-live-classroom-sync.spec.ts` 浏览器回归，覆盖课程总入口卡片、demo 学生端知识卡抽屉/页内 AI、以及真实教师/学生双账号创建课堂、加入课堂、不同步跳转、前测释放与答案揭示链路；入口路由测试 `tests/interactive-learning-entry-routes.spec.ts` 也同步改为更稳的 `href + direct goto` 校验，避免 Next 开发态并行编译导致的伪失败；当前 `test-lsum-runtime-export.ts`、`test-lsum-course-registration.ts`、`test-lsum-step-knowledge-drawer.ts`、`test-lsum-assessment-controls.ts`、`test-lsum-teacher-session-sync.ts`、`test-lsum-student-session-sync.ts`、`npm run lint`、`npm run test`、`npm run build`、`npm run test:integration` 均已通过
📦 **运行时资源外置部署（2026-03-12）**：`scripts/build.sh` 现在要求通过 `.dockerignore` 排除 `course-content/runtime`，镜像不再打包运行时课程资源；`scripts/remote-deploy.sh` 会使用 `rsync` 将本地 `course-content/runtime/` 同步到服务器 `/home/projects/act/course-content/runtime/`，并同步最新 `deploy/podman/deploy.sh` 到远端 `scripts/4-deploy.sh`，由 Podman 以只读挂载方式映射到容器内 `/app/course-content/runtime`

## 3. 核心功能模块

### 3.1 用户认证与管理 ✅
- **NextAuth.js 认证系统**：支持邮箱/用户名登录，JWT 会话管理
- **角色权限管理**：学生、教师、管理员三级权限体系
- **自动档案创建**：新用户自动创建学生档案和解锁第一关
- **账号安全**：个人中心支持修改密码与退出登录
- **演示账号**：
- 演示教师账号：`test_teacher`，密码：`TestTeacher@Just2026!`
- 演示学生账号：`demo`，密码：`DemoStudent@Just2026!`

### 3.2 驱逐舰航向控制仿真 ✅
- **3D 可视化**：基于 Three.js / React Three Fiber 的沉浸式体验
- **仿真模块化**：各虚拟仿真模块已完成组件化与资源注册，支持按模块独立加载与复用
- **高保真 MMG 船舶模型**：实时航向、位置、舵角与速度步进由 `rust/control-engine` 的 `destroyer_hifi` WASM 运行时驱动
- **多种控制模式**：
  - 手动控制
  - P 控制器
  - PD 控制器
  - PID 控制器
- **多种视角**：追踪视角、俯视视角、战术视角
- **任务场景**：
  - 90° 直角转向
  - 绕圈航行
  - 避障机动
- **实时性能监控**：HUD 显示航向、偏航率、舵角、航迹误差
- **海况模拟**：5 级海况，动态风浪干扰

### 3.3 AI 虚拟总工 ✅
- **智能对话系统**：基于硅基流动 API + Qwen/Qwen3-Omni-30B-A3B-Thinking
- **Function Calling**：
  - `get_simulation_status` - 获取实时仿真状态
  - `set_simulation_params` - 修改 PID/环境参数
  - `analyze_result` - 分析仿真结果
- **PID 调参建议**：智能分析控制性能，提供优化建议
- **知识问答**：解答船舶动力学、PID 控制理论问题
- **流式响应**：使用 Vercel AI SDK 实现实时对话

### 3.4 伦理熔断系统 ✅
- **实时监控**：
  - 舵角速度限制：≤ 5°/s（CCS 规范）
  - 横摇角度限制：≤ 15°
- **全屏违规提示**：红色警告界面，强制暂停仿真
- **整改机制**：必须提交整改方案才能继续
- **伦理分扣减**：每次违规扣 5 分，最低 0 分
- **违规记录**：记录违规类型、阈值、实际值、AI 批评

### 3.5 任务链解锁系统 ✅
- **7 个渐进式任务**：
  1. **初识航向控制** (EASY) - 手动控制，平静海面
  2. **P 控制器入门** (EASY) - 理解比例控制
  3. **PD 控制器进阶** (MEDIUM) - 减少超调
  4. **PID 控制器精通** (MEDIUM) - 完整 PID
  5. **海况挑战：中浪** (HARD) - 3 级海况
  6. **海况挑战：大浪** (HARD) - 4 级海况
  7. **综合评估：专家认证** (EXPERT) - 5 级海况
- **解锁机制**：完成上一关（≥60 分）自动解锁下一关
- **进度追踪**：记录最佳成绩、尝试次数、完成时间

### 3.6 学生能力画像 ✅
- **五维能力评估**：
  - **稳态精度**：控制系统稳定后的误差控制能力
  - **动态响应**：对变化的快速响应能力
  - **鲁棒性**：应对环境干扰的稳定性
  - **安全性**：遵守安全规范的程度
  - **能耗控制**：舵机动作的能耗效率
- **雷达图可视化**：使用 Recharts 展示能力分布
- **综合评级**：卓越/优秀/良好/及格/待提升
- **学习统计**：
  - 完成仿真次数
  - 完成任务数
  - 伦理违规次数
  - 仿真总时长
  - 平均得分

### 3.7 Monte Carlo 参数优化 ✅
- **智能搜索**：随机采样 + 局部搜索混合策略
- **优化目标**：
  - 最小化航迹误差
  - 限制舵角速度
  - 减少超调量
  - 缩短调节时间
- **快速收敛**：提前停止机制，通常 50-100 次迭代
- **参数推荐**：返回最优 Kp、Ki、Kd 和性能指标

### 3.8 个人中心 ✅
- **用户信息管理**：查看和编辑个人资料
- **六维能力画像**：对齐数据治理真实能力维度，展示控制建模、参数设计、跨域迁移、工程决策、探究反思、自主学习
- **学习统计**：完成任务、仿真次数、技术分、伦理分
- **最近活动**：聚合课堂参与、仿真训练、互动页面、跨域探索模块与自适应题目，并支持前三条预览与查看全部分类
- **任务进度**：进度条和完成率
- **个性化补强路径**：根据当前状态推荐具体互动模块、知识卡片、仿真与自适应习题入口，并展示自适应诊断摘要

### 3.9 主控制台 (Dashboard) ✅
- **统计卡片**：完成任务、仿真次数、技术分、伦理分
- **功能模块网格**：
  - 🎯 任务大厅
  - 🚢 驱逐舰仿真
  - 🤖 AI 虚拟总工
  - 👤 个人中心
  - ⚠️ 伦理案例
  - 📚 知识库
- **快速开始**：一键进入主要功能
- **顶部导航**：用户信息、个人中心入口、登出

### 3.10 知识库 (Knowledge) 🚧
- **PID 控制理论**：比例、积分、微分原理
- **船舶动力学**：Nomoto 模型、操纵性
- **海洋环境**：风浪流影响
- **安全规范**：CCS 船舶操纵规范
- **状态**：知识图谱节点点击显示完整基础信息，知识卡片统一以模态展示，教师编排预览同渲染；MDX 附件支持 PPT 尺寸渲染
- **知识图谱融合（2026-02）**：接入 `data/knowledge_graph.json`（节点）与 `data/relations.jsonl`（关系），统一映射为现有图谱 API；支持关系类型、关系强度阈值筛选，并在侧栏/悬浮卡片展示节点 Bloom 分类

### 3.11 伦理案例库 (Ethics) 🚧
- **工程伦理场景**：两难决策模拟
- **案例分析**：海洋环保与开发平衡
- **伦理评估**：量化决策能力
- **状态**：框架已搭建，案例待补充

### 3.12 互动学习 (Interactive Learning) ✅
- **模块入口**：`/interactive-learning`
- **入口路由拆分（2026-02）**：
  - `/interactive-learning/cross-domain-exploration`（跨域探索，原“趣味探索”命名升级）
  - `/interactive-learning/courses`（互动课程，原“线下课程入口”命名升级）
  - `/interactive-learning/chapter-components`（各章节互动组件入口）
  - `/interactive-learning/chapter-components/[category]`（章节组件独立路由）
- **精品课程入口（2026-02-28）**：
  - `/interactive-learning/courses/cruise-comfort-boppps`（45 分钟课堂实录互动流程入口）
  - 新增课堂隔离路由：`/interactive-learning/courses/cruise-comfort-boppps/teacher/[sessionId]` 与 `/interactive-learning/courses/cruise-comfort-boppps/student/[sessionId]`
  - 教师端从入口创建课堂（自动克隆 `cruise-comfort-v1` 并创建 `ClassSession`），第一页展示课堂码；学生端输入课堂码加入，也可进入 `student/demo` 自由浏览
  - 入口按账号角色隔离显示：学生隐藏“开始上课（教师）”，教师隐藏“输入课堂码加入课堂”；两端保留演示模式
  - 教师/学生动态路由增加服务端角色守卫：学生访问教师页自动跳转学生页；教师访问学生页自动跳转教师页（`demo` 例外）
  - 课程导航统一为“返回 + 标题 + 环节下拉 + 下方左右箭头”；课程标题统一为“柔性之海：豪华邮轮舒适度控制”
  - 演示模式提示文案合并进课程导航栏中部，压缩竖向占用
  - 教师端保留完整环节；学生端从“工程目标设定”起进入“仿真 + 多表征联动”综合工作台（标签切换），可直接跳转收尾总结
  - B 阶段接入 `public/videos/luxury-liner-intro.mp4`（缺失时显示空白播放框）
  - O 阶段支持布鲁姆动词目标设计与个性化目标发布；P1 阶段支持能力点绑定前测与教师端统计
  - 教师端保留 NeuralODE 静态嵌入页，资源目录：`public/assets/cruise-comfort-boppps/`
  - 2026-02-28（二次迭代）：
    - 删除 `/interactive-learning` 顶部“课堂快速加入”入口；保留课程内独立入口流程
    - 修复教师“开始上课”`preset not found`：将 `cruise-comfort` 预置教案注册进 `ALL_PRESETS`
    - 教师/学生课堂页移除课堂码信息栏展示；课堂码发放环节改为“等待教师开始授课”+课堂思考提示
    - 教师与学生端课堂码页均新增“已加入学生名单 + 总人数”动态刷新显示
    - 课程导航压缩为三段式：左侧英中双行标题，中部 BOPPPS 阶段，右侧环节下拉 + 左右翻页
    - 学生端从工程目标设定起采用“仿真/多表征”常驻工作台；切换环节不重载 iframe，仅更新提示文案
    - 仿真控制面板修正：`PD` 模式下 `Kp/Kd` 可调、`Ki` 锁定；课程模式一致性评语保留在评估标签
    - 课堂总结新增 LLM 洞察接口：`POST /api/simulation/cruise-summary-insight`（教师班级洞察 / 学生个人洞察）
  - 2026-03-01（三次迭代：展示页重构）：
    - 新增课程显示单一配置源：`CRUISE_STEP_DURATION`、`TEACHER_STAGE_COPY`、结构化 `STUDENT_STAGE_TASKS`（bullets/keyQuestion/tips/checks）
    - 教师端 14 步显示页按 `docs/platform-display-design.md` 重构：Bridge 三约束卡片、Objective 布鲁姆动词高亮、Precheck 教学决策提示、NeuralODE 双栏对比、Summary 回环文案 + 达成总览
    - 学生端显示页重构：Bridge 场景卡与约束速览、Objective 薄弱点标签、Precheck 大字号引导、Summary 设计档案卡
    - 学生工作区任务条升级为统一结构组件（🔑关键问题 / ⚡提示 / ✅检查清单），并显示当前环节时长
    - 课程导航栏压缩并增强中部信息：BOPPPS 阶段 + 环节时长 + 当前环节标题，保持教师/学生端一致
  - 2026-03-01（四次迭代：仿真交互增强）：
    - 7 个仿真统一接入相机条速度控制（`- / +`，最高 `8x`），位于网格按钮右侧并直接作用于固定步长仿真推进
    - 邮轮仿真航线可视化强化：期望航线与当前航向改为同色系箭头、轨迹与航向主色统一，船体水线位置下调
    - 课堂综合工作台新增实时指标条：在“仿真/多表征”切换旁显示控制器参数与时域/频域关键指标，支持跨 iframe 实时同步
    - 邮轮课程模式新增“虚拟仿真观察”开关、学生侧评估约束手动填写、结构化提示词“发送+即时反馈”、一致性校验改为基于真实仿真数据（未运行时提示先运行）
    - NeuralODE 环节教师端/学生端公式改为 LaTeX 渲染（`react-katex`）
  - 2026-03-10（L-2a 精品课重构）：
    - 新增 `/interactive-learning/courses/l2a-time-domain-fasttrack` 精品互动课堂入口，以及教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]` 同级隔离路由
    - 互动课程页重组为“精品课程 + 默认折叠的旧版章节课程”；保留“柔性之海”精品入口，并将原 `lessonXX` 系列统一收纳到默认收起的折叠菜单
    - 新课采用与“柔性之海”一致的精品课程结构，围绕 L-2a 材料实现 18 步 BOPPPS 课堂流程，并提供左侧常驻双面板工作区（极点平面 + 时域响应）
    - 课堂状态与统计埋点复用现有 `/api/session`、`/api/session/[id]/state` 与 `useInteractiveTracking`，演示模式静默同步，避免为匿名访问新增接口
  - 2026-03-11（课堂链路稳定性修复）：
    - 统一课堂码跳转解析：`/api/session/join` 返回按课堂所属课程计算出的教师/学生目标地址；`/dashboard`、`/classroom/join`、精品课程入口页输入同一课堂码后会跳转到同一正确课堂页面
    - 旧 `/classroom/teacher/[sessionId]` 与 `/classroom/student/[sessionId]` 路由增加精品课程自动转发，教师后台与历史链接可继续复用旧入口
    - L-2a 与“柔性之海”教师页补齐“结束课堂”按钮；教师班级详情页支持直接停止进行中的课堂，避免残留 `ACTIVE` 课堂
    - 教师端翻页改为“本地权威 + 服务端确认”模式，消除轮询导致的偶发回跳；学生端改为“检测不同步并手动跳转”，不再强制追页
    - `/api/session/[sessionId]/state` 增加 `scope=self` 与 `scope=student-view` 查询范围，学生端不再轮询全班完整状态；课堂关键节点增加结构化日志（入课、翻页推进、结束课堂、到场、教师同步发布）
  - 2026-03-11（L-2b 精品课首轮落地）：
    - 新增 `/interactive-learning/courses/l2b-root-locus-fasttrack` 精品互动课堂入口，以及教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]` 同级隔离路由
    - `course-content/authoring/lessons/legacy/L-2b/media/raw/*.py` 补齐 `--output` 输出参数；新增 `scripts/generate_l2b_runtime_media.py`，把根轨迹性能区、45°射线定位图与三阶穿越图直出到 `course-content/runtime/lessons/legacy/L-2b/media`
    - 新增 `/course-runtime/[...assetPath]` 运行时资源路由，页面直接读取 `course-content/runtime` 下 SVG 产物，不再依赖 `public/` 占位图
    - L-2b 学生端保留首次对齐、后续不同步提示与手动跳转；教师端复用结束课堂回跳、课堂码解析与会话广播链路
    - 工作区按步骤分化为反馈框图认知卡、广播/独立根轨迹工作台、轨迹选点信息卡与 45° 射线几何定位区，补齐预测→验证→AI 对比→总结回看链路
- **跨域探索置顶组件**：`/interactive-learning/multi-representation-linkage` 作为跨域探索首个入口
- **资源来源**：动态加载教学资源库中 `INTERACTIVE_COMP` 单页互动资源
- **资源查看入口**：`/interactive-learning/resources/[id]`
- **定位**：以单页互动资源浏览为主，提供精选课程入口；课程编排与播放入口统一在管理员课堂流程
- **统一框架**：课程播放统一走 `TeachingResource` + `LessonPlan` + `ClassSession` 的 BOPPPS 编排链路
- **新增**：跨域探索分类与十滴水关卡进度/排行榜支持
- **Control Odyssey**：关卡扩展至 15 关与青铜/白银/黄金分级解锁，逐帧数值推进已迁入 `rust/control-engine` 的 `compute_simulation_step` WASM 实时仿真接口，覆盖 Tustin 传函离散、纯延时、P/PI/PD/PID、测速反馈、前馈、Smith 预估器、分项限幅与输出扰动；前端保留原玩法、地形、碰撞、商店、积分、排行榜、AI 建议与遥测展示，仅由 `PhysicsEngine` facade 同步调用 Rust stepper。其他能力包括控制商店积分换购与控制器升级体系、难度滑块与积分倍率、配置面板分区与控制框图高亮、暗流扰动（含惯性滤波）与通道包络生成、通关结算三指标（超调/稳态/平均相对误差）与分支得分基准、榜单分支标识与指标展示、全息能量壳层飞船外形与动态尾迹、AI 控制建议（20 积分调用，关卡/配置/指标上下文，关卡内最新建议共享与高分配置上下文，建议历史落库）、失败结算详情曲线入口
- **仿真规范**：统一仿真接口与时间步进规范入口 `docs/Simulation_Guidelines.md`
- **Lesson 01 反馈：控制原理的核心思想**：从生活场景引入反馈思想的 90 分钟预置教案，覆盖控制系统组成、开环/闭环与反馈价值
- **Lesson 02 拉氏变换：工程直觉的数学实现**：以 RLC 电路为切口的 90 分钟预置教案，覆盖 s 域直觉、常用定理与反变换路径
- **Lesson 03 微分方程与控制系统基础模型**：微分方程建模与系统基础模型的 90 分钟预置教案，覆盖建模方法、步骤、典型案例与线性化
- **Lesson 04 传递函数与控制系统数学模型**：传递函数定义、推导与零极点判读的 90 分钟预置教案，覆盖典型环节识别与传函推导演练
- **Lesson 05 方框图、信号流图与梅森公式**：结构图等效化简、信号流图拓扑建模与梅森公式应用的 90 分钟预置教案，覆盖结构图化简路线、信号流图速练与梅森公式数圈圈挑战
- **Lesson 06 指标裁判席**：基于 BOPPPS 的时域性能指标课程，包含指标速判、裁判手册、裁判席计分器与后测评估，并输出 AI 课堂报告
- **Lesson 07 衰减振荡**：欠阻尼二阶系统互动课程，覆盖标准型、极点关系、阶跃响应与参数挑战，“极点操纵器”支持 S 平面缩放/平移、等阻尼/等频率网格、三曲线挑战与课堂成绩大屏统计，并提供 90 分钟预置教案
- **Lesson 08 稳定性与稳态误差**：基于稳定判据与误差度量的 90 分钟预置教案，涵盖劳斯判据、终值定理与静态误差系数互动环节
- **Lesson 09 校正与时域综合**：基于校正手段与航向系统案例的 90 分钟预置教案，覆盖 PD/输出反馈、前馈/扰动补偿与时域综合验证
- **Lesson 10 根轨迹法**：根轨迹大局与细节修正的 90 分钟预置教案，涵盖模值/相角条件、分离点、渐近线与出射角挑战
- **Lesson 11 参数根轨迹与图形化思考**：以参数根轨迹广义定义为核心，聚焦稳定范围判断、主导极点选择与仿真验证流程
- **Lesson 12 频率特性与伯德图**：频率响应与伯德图的 90 分钟预置教案，覆盖对数频率特性、斜率叠加绘图与读图反推传函
- **Lesson 13 幅相特性与稳定判据**：Nyquist 图与对数稳定判据的 90 分钟预置教案，覆盖幅相特性特征点、幅角原理与判稳场景演练
- **Lesson 14 稳定裕度与三频段**：稳定裕度与三频段分工的 90 分钟预置教案，覆盖相角/幅值裕度估算、频段性能匹配与频域权衡策略
- **Lesson 15 串联校正与滞后超前**：超前/滞后与联合校正的 90 分钟预置教案，覆盖校正策略决策、参数估算与联合设计流程
- **Lesson 16 非线性系统与描述函数基础**：非线性现象与描述函数基础的 90 分钟预置教案，覆盖谐波线性化与典型非线性特性识别
- **Lesson 17 描述函数分析法与自振判别**：负倒描述函数与自振判别的 90 分钟预置教案，覆盖交点判别、稳定性判断与参数求解
- **知识卡片嵌入**：所有预置教案在参与式环节补齐知识卡片，并与知识图谱节点绑定，支持课堂内讲授与后续互动巩固

### 3.13 管理员后台 (Admin) ✅
- **统一后台入口**：`/admin` 作为管理总台，集中展示用户管理、系统使用量统计、数据治理三个入口
- **用户管理子路由**：`/admin/users` 负责新建/查看/改密/删除账号、角色区分与批量导入，视觉层统一复用后台全局样式
- **系统使用量统计子路由**：`/admin/states` 支持演示/真实数据切换，真实数据通过 `/api/admin/system-usage` 聚合用户、互动、仿真、LLM 与伦理日志
- **数据治理子路由**：`/admin/data-governance` 提供学习事实分布、队列健康、风险清单、最新快照与高值快照关注，并支持返回管理后台
- **批量导入**：Excel 模板支持账号批量导入/更新（前三列必填：账号/姓名/角色；其他字段选填），重复账号按账号更新，前端展示失败明细
- **权限控制**：仅管理员登录可访问

### 3.14 多表征联动可视化引擎 ✅
- **页面路径**：`/interactive-learning/multi-representation-linkage`
- **开环根轨迹联动**：复平面以开环极点配置为输入，实时绘制根轨迹并叠加闭环极点（不同颜色）
- **开环零点扩展**：支持添加开环零点（实零点 / 共轭零点对），并参与根轨迹、Bode、Nyquist 联动计算
- **闭环极点拖拽**：支持在根轨迹上拖拽闭环极点，自动联动等效增益，时域响应按闭环极点位置重算
- **共轭极点约束**：开环共轭极点联动移动；极点与图表关键数据均统一保留三位小数
- **刷新策略优化**：拖拽过程中仅本地预览，松开后触发后端重算，降低交互延迟
- **频域联动升级**：Bode 幅频/相频合并为同模块上下子图（共享十倍频程刻度），可勾选显示相角裕度与幅值裕度
- **Nyquist + 提示分区**：下方拆分为 Nyquist 图（含裕度标注）与跨域关联提示模块
- **后端计算 API**：
  - `POST /api/linkage/calculate-time-domain`
  - `POST /api/linkage/calculate-frequency-domain`
  - `POST /api/linkage/stability-analysis`
- **教学提示**：基于极点分布、增益裕度、相位裕度自动生成跨域关联提示
- **课程模式（2026-02-28）**：
  - 通过 query `courseMode=cruise-boppps` 启用课堂模式，默认注入“邮轮模型 + PID 控制器”近似开环
  - 课程模式禁用“添加极点/零点”和删除操作，仅保留本课所需联动操作
  - 与 `/simulations/cruise` 通过同源 `postMessage` 联动：仿真控制器模式与参数变化会更新开环/闭环极点，跨域页手动调整闭环极点（根轨迹）后会反向同步控制器参数
  - 课程模式下新增一致性评语接口：`POST /api/simulation/cruise-consistency-comment`（评估数值 + LLM 文本）

### 3.15 自适应跨域题库系统 ✅
- **页面路径**：`/assessment/adaptive-practice`
- **能力诊断**：计算型/跨域型/设计型三维能力估计与薄弱项识别
- **自适应出题 API**：
  - `GET /api/assessment/diagnostic`
  - `POST /api/assessment/next-question`
  - `POST /api/assessment/generate-question`
  - `POST /api/assessment/submit-answer`
  - `GET /api/assessment/ability-report/:userId`
- **题库能力**：内置 50 道跨域题，支持按薄弱知识点生成新题
- **结构化题库底座（2026-03-27）**：
  - 新增 `course-content/questions/` 作为自动控制习题结构化题库根目录
  - 原始总题库 DOCX 固定存放在 `course-content/questions/source/自动控制原理习题解析.docx`
  - 通过 `course-content/questions/scripts/extract_docx_question_bank.py` 将 DOCX 抽取为“每题一份 Markdown + 一份 JSON + 独立配图资产”
  - 单题 Markdown 固定分为 `题面 / 答案解析 / 行内得分点 / 评分指南 / 元数据`，便于课程制作时单独提取题面
  - 当前全量抽取稳定产出 `167` 道题，并已修复 `2-16不完整` 这类无空格题头切题失败问题
  - 抽取器现已支持提取题号后 `w:tbl` 表格中的内嵌图片，`AC-Q-0012/0013/0014` 不再被误报为“缺图需手工重绘”
  - 抽取器会保留已有 `usage_status != raw` 的人工精修内容，避免全量重建覆盖 `cleaned` 题目
  - `course-content/questions/indexes/questions.jsonl` 与 `course-content/questions/indexes/questions.sqlite` 用于快速检索
  - `course-content/questions/reports/` 记录裸 LaTeX 残留、仅标题无配图等异常，支持后续逐步精修
  - 命题技能 `homework-problem-authoring` 已扩展 `inline_score_points` 字段，并与 `rubric` 并存，保留题解中的行内标分方式

### 3.16 工程场景扩展（邮轮舒适度 / 破冰船鲁棒） ✅
- **页面路径**：
  - `/simulations/cruise`（右侧标签 `评估`）
  - `/simulations/icebreaker`（右侧标签 `评估`）
- **合并说明**：原 `cruise-comfort`、`icebreaker-robust` 变体页面已并入主仿真页面，不再单独维护
- **邮轮舒适度扩展**：多目标权衡（舒适度/性能/能耗）评分与建议
- **破冰船鲁棒扩展**：不确定参数区间 + 扰动场景 Monte Carlo 鲁棒评估
- **分析 API**：
  - `POST /api/simulation/cruise-comfort-analysis`
  - `POST /api/simulation/icebreaker-robust-analysis`

### 3.17 AI伴随探究系统 ✅
- **介入判定**：连续失败、停滞、约束违规三类触发规则
- **介入生成 API**：
  - `POST /api/ai/intervention/check`
  - `POST /api/ai/intervention/generate`
  - `POST /api/ai/intervention/feedback`
- **场景融合**：在 7 个仿真右侧“AI伴学”标签提供伴随探究面板，支持“记录尝试→判定介入→生成引导→反馈”

### 3.18 元提示词评价 + 过程一致性校验 ✅
- **页面路径**：`/evaluation/prompt-assessment`
- **提示词质量评价 API**：
  - `POST /api/evaluation/assess-prompt`
  - 评价维度：完整性、精确性、结构化、可执行性
- **过程一致性 API**：
  - `POST /api/evaluation/track-consistency`
  - `GET /api/evaluation/prompt-history/:userId`
- **一致性目标**：覆盖“提示结构—设计行为—结果达成”的过程化评价

### 3.19 教学创新报告配图支持（自适应测评三图） ✅
- **新增聚合页**：`/review/adaptive-assessment-figures`
  - 图 A：`/assessment/adaptive-practice?demo=1&scene=stable`（题库稳定性/标准化）
  - 图 B：`/assessment/adaptive-practice?demo=1&scene=generate`（差异化生成）
  - 图 C：`/evaluation/prompt-assessment?autodemo=1`（结构化评价常态化）
- **自适应题库页面增强**：
  - 支持报告演示模式（`demo=1` + `scene` 参数）用于稳定复现截图
  - 保留真实接口流程，不影响常规训练
- **提示词评价页面增强**：
  - 新增“常态化训练量化追踪”区块（提示词版本轨迹 + 能力成长轨迹）
  - 接入 `GET /api/evaluation/prompt-history/:userId` 与 `GET /api/assessment/ability-report/:userId`
  - 新增“生成常态化演示轨迹”能力，支持快速产出可展示数据

## 4. 技术架构

### 4.1 前端技术栈
- **框架**：Next.js 14 (App Router)
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **UI 组件**：shadcn/ui + Radix UI
- **3D 渲染**：React Three Fiber + Three.js
- **图表**：Recharts
- **图谱可视化**：React Flow
- **公式渲染**：KaTeX
- **数学计算**：mathjs
- **状态管理**：React Hooks

### 4.2 后端技术栈
- **API**：Next.js API Routes (Server Actions)
- **认证**：NextAuth.js (JWT 策略)
- **数据库**：PostgreSQL
- **ORM**：Prisma
- **密码加密**：bcryptjs

### 4.3 AI 技术栈
- **LLM 服务**：硅基流动 (SiliconFlow)
- **模型**：Qwen/Qwen3-Omni-30B-A3B-Thinking
- **SDK**：Vercel AI SDK v3.4
- **功能**：流式对话、Function Calling、参数优化建议

### 4.4 数据库模型
```prisma
User              # 用户账号
StudentProfile    # 学生档案（技术分、伦理分）
Mission           # 任务/关卡定义
UserProgress      # 用户任务进度
SimulationLog     # 仿真记录（参数、指标、轨迹）
EthicalLog        # 伦理违规记录
Session, Account  # NextAuth 会话
LinkageSession    # 多表征联动探索记录
Question          # 跨域题库
UserAnswer        # 学生答题记录
AbilityAssessment # 能力评估快照
AIIntervention    # AI 伴随介入记录
PromptAssessment  # 元提示词评价记录
DesignSession     # 设计行为与一致性记录
```

### 4.5 部署架构
- **开发环境**：Node.js 20+ + PostgreSQL 14+
- **启动脚本**：`npm run startup` (自动化启动)
- **停止脚本**：`npm run shutdown` (清理进程)
- **日志管理**：集中式日志 (`.logs/`)
- **容器化**：Docker + Docker Compose (生产环境)

## 5. 项目结构

```
act.just.edu.cn/
├── src/
│   ├── app/                      # Next.js 应用目录
│   │   ├── (auth)/              # 认证页面（登录、注册）
│   │   ├── (main)/              # 主要功能页面
│   │   │   ├── dashboard/       # 主控制台
│   │   │   ├── missions/        # 任务大厅
│   │   │   └── profile/         # 个人中心
│   │   ├── ai/copilot/          # AI 虚拟总工
│   │   ├── interactive-learning/ # 互动学习模块
│   │   │   ├── argument-principle/  # 幅角原理
│   │   │   └── control-map/         # 控制地图
│   │   ├── simulations/destroyer/  # 驱逐舰仿真
│   │   ├── api/                 # API 路由
│   │   │   ├── auth/            # 认证 API
│   │   │   ├── ai/chat/         # AI 聊天 API
│   │   │   ├── missions/        # 任务 API
│   │   │   ├── user/profile/    # 用户画像 API
│   │   │   ├── simulation/optimize/  # 参数优化 API
│   │   │   └── ethics/violation/     # 违规记录 API
│   │   └── actions/             # Server Actions
│   ├── features/                # 平台功能域组件
│   │   ├── ai/                  # AI 虚拟总工
│   │   ├── ethics/              # 伦理模块
│   │   ├── knowledge/           # 知识库
│   │   ├── lesson-engine/       # 课程引擎
│   │   ├── admin/               # 管理后台
│   │   ├── dashboard/           # 主控制台
│   │   └── mission/             # 任务模块
│   ├── resources/               # 教学资源
│   │   ├── interactive-learning/ # 互动学习组件
│   │   ├── simulations/         # 虚拟仿真与仿真工具
│   │   └── widgets/             # 教学小工具
│   ├── components/              # 平台基础组件
│   │   ├── providers/           # 全局 Provider
│   │   ├── shared/              # 共享组件
│   │   └── ui/                  # UI 基础组件
│   ├── hooks/                   # 平台通用 Hooks
│   │   └── useEthicalMonitor.ts # 伦理监控 Hook
│   ├── lib/                     # 平台工具库
│   │   ├── auth.ts              # 认证配置
│   │   ├── prisma.ts            # Prisma 客户端
│   │   ├── ai-client.ts         # AI 客户端
│   │   ├── ai-tools.ts          # AI Function 定义
│   │   ├── user-sync.ts         # 用户同步
│   │   ├── competency.ts        # 能力计算
│   │   └── constants/ethics.ts  # 伦理常量
│   └── types/                   # 平台 TypeScript 类型
│       ├── next-auth.d.ts       # NextAuth 类型扩展
│       └── curriculum.ts        # 课程结构
├── prisma/
│   └── schema.prisma            # 数据库架构
├── scripts/
│   ├── start.sh                 # 启动脚本
│   ├── stop.sh                  # 停止脚本
│   ├── seed-missions.mjs        # 任务数据种子
│   ├── seed-demo-user.mjs       # 演示用户种子
│   └── README.md                # 脚本使用说明
├── docs/
│   ├── ProjectDescription.md    # 本文档
│   ├── Developmant.md           # 开发计划
│   └── QUICKSTART.md            # 快速开始
└── QUICKSTART.md                # 快速开始指南
```

## 6. 快速开始

### 6.1 环境要求
- Node.js 20+
- PostgreSQL 14+
- npm 或 yarn

### 6.2 安装步骤

```bash
# 1. 克隆仓库
git clone <repository-url>
cd act.just.edu.cn

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库和 API 密钥

# 4. 创建数据库
psql -U postgres
CREATE USER act_user WITH PASSWORD 'act_pass';
CREATE DATABASE act_obe OWNER act_user;
GRANT ALL PRIVILEGES ON DATABASE act_obe TO act_user;

# 5. 推送数据库架构
npx prisma db push

# 6. 填充初始数据
npm run seed:missions  # 7 个任务
npm run seed:demo      # 演示账号

# 7. 启动服务
npm run startup
```

### 6.3 访问系统
- **前端地址**：http://localhost:3000
- **登录账号**：`demo`
- **密码**：`DemoStudent@Just2026!`

### 6.4 常用命令
```bash
npm run startup        # 启动服务
npm run shutdown       # 停止服务
npm run dev            # 开发模式
npm run build          # 构建生产版本
npm run logs           # 查看日志
npm test               # 运行测试
```

## 7. 核心特性

### 7.1 教学创新
1. **渐进式学习路径**：7 个任务从易到难，循序渐进
2. **即时反馈**：实时性能监控，AI 智能建议
3. **个性化学习**：能力画像分析，针对性提升
4. **游戏化设计**：任务解锁、成就系统、排行榜（待开发）

### 7.2 技术创新
1. **Hook 化仿真引擎**：React 风格，易于集成和扩展
2. **Function Calling**：AI 直接操作仿真参数
3. **Monte Carlo 优化**：智能参数搜索，快速收敛
4. **伦理熔断**：首创工程伦理实时监控

### 7.3 工程伦理
1. **安全第一**：强制遵守 CCS 船舶操纵规范
2. **过程监控**：实时检测违规行为
3. **反思机制**：强制整改，培养安全意识
4. **量化评估**：伦理分体系，记录成长轨迹

## 8. 未来规划

### 8.1 短期计划（1-3 个月）
- [ ] 完善知识库内容（PID 理论、船舶动力学）
- [ ] 补充伦理案例库（工程决策场景）
- [ ] 添加教师管理后台
- [ ] 实现班级排行榜
- [ ] 优化移动端适配

### 8.2 中期计划（3-6 个月）
- [ ] 支持更多船型（集装箱船、游轮）
- [ ] 多人协作仿真
- [ ] AI 自动出题系统
- [ ] 学习报告生成
- [ ] 导出数据分析功能

### 8.3 长期计划（6-12 个月）
- [ ] VR/AR 沉浸式体验
- [ ] 与实体设备联动
- [ ] 国际化支持
- [ ] 开放 API 接口
- [ ] 建立开发者社区

## 9. 团队与支持

### 9.1 开发团队
- **项目负责人**：YW
- **技术架构**：Claude (Anthropic AI Assistant)
- **开发框架**：Next.js + React + TypeScript

### 9.2 技术支持
- **文档**：[QUICKSTART.md](./QUICKSTART.md)
- **脚本文档**：[scripts/README.md](../scripts/README.md)
- **开发计划**：[Developmant.md](./Developmant.md)
- **问题反馈**：GitHub Issues

### 9.3 依赖项目
- Next.js: https://nextjs.org
- Prisma: https://www.prisma.io
- NextAuth.js: https://next-auth.js.org
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- Vercel AI SDK: https://sdk.vercel.ai
- 硅基流动: https://siliconflow.cn

## 10. 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

## 11. 近期更新（2026-03-01）

- 展示班级数据迁移到“2023自动化启航班”：移除展示班 `demo` 学生（保留账号）、30名演示学生并入启航班，启航班描述更新为“AI-OBE平台教改班”，并删除“2023自动化课外展示班”。
- 启航班课堂历史补齐：新增 17 次课堂记录（含本次课堂），可在班级“课堂历史”中查看。
- 新增课堂复盘页：`/classroom/teacher/[sessionId]/review`，用于展示“课前 vs 课后能力追踪”与“课后个性化补强路径”。
- `/review/extracurricular-showcase` 文案和班级定位更新为“2023启航班”。
- 新增课外展示数据填充脚本 `scripts/db/seed-extracurricular-showcase.mjs`：一键填充 `data/test_students.md` 全部 31 个学生账号（含 `demo`）的班级归属、前后测能力、题单作答、提示词评估、设计会话、补强路径与奥德赛进度数据。
- 新增展示班级（班级码 `ECSHOW`）主链路数据：重点演示账号 `20230010102608` 与 `20230010102605` 已构造差异化学习轨迹，用于脚本 A/B 镜头展示。
- 新增教师班级分析聚合能力：`/api/teacher/classes/[classId]/analytics`，统一输出班级热力图、推荐流程、前后测对比、A/B题单、补强路径和提示词结构-设计效果相关性（当前样本 `r≈0.834`）。
- 新增教师端班级分析页面：`/teacher/classes/[classId]/analytics`，并在班级详情页加入“学情热力图与展示分析”入口。
- 扩展学生个人中心与用户画像接口：`/api/user/profile` 与 `/profile` 新增“课前/课后能力追踪、个性化补强路径、推荐题单、结构分与设计效果分”展示。
- 个人中心与成长中枢进一步收口到数据治理主链路：`/api/user/profile` 与 `/profile` 已改为消费六维能力快照、聚合课堂/互动/仿真/题目活动，并在个人中心直接展示自适应练习诊断摘要与资源推荐；`/api/student/competency-snapshot` 对重复风险与建议做去重，减少成长中枢中的重复提醒。
- 新增评审聚合入口：`/review/extracurricular-showcase`，可从 `/review` 快速进入并定位脚本关键镜头页面。
- 展示分析入口职责收敛：`/teacher/classes/[classId]/analytics` 班级整体仅保留雷达热力图展示；重点名单、课前/课后追踪、个性化题单与课后补强统一下沉到单次课堂记录页 `/classroom/teacher/[sessionId]/review`。
- 邮轮仿真基础航线改为“先直航后转向”任务：默认航行约 `1800m` 后切换到 `30°` 目标航向。
- 邮轮仿真新增期望航线可视化：绿色虚线为期望航线，紫色实线为实际航迹，便于课堂对比。
- 多表征联动画布增强：支持 `+/-` 缩放与空白区域拖动画布平移，拖拽零极点后自动刷新坐标范围。
- 全部主仿真页面新增统一网格开关：在视角切换按钮组右侧提供“网格开/关”按钮。
- 各仿真网格样式统一（100m 细分 / 500m 主分区），用于相对位置判断与轨迹分析。
- 新增全局深色/浅色主题切换：在根布局注入主题初始化脚本，新增 `ThemeProvider` 与全局悬浮切换按钮，支持记忆用户选择并在全站生效。
- 主题体系升级为 class 模式：Tailwind `darkMode` 切换为 `class`，并补充 `.light` 主题变量；教师与登录布局已适配浅/深色双主题样式。
- 统一主入口视觉样式：主页 `/`、虚拟实验室 `/virtual-lab`、仿真入口 `/simulations`、互动学习 `/interactive-learning`、评审入口 `/review` 与课外展示入口 `/review/extracurricular-showcase` 已移除硬编码深色配色，改为主题语义色与统一卡片/按钮体系。
- 新增全链路主题桥接层（`globals.css`）：对历史页面中高频硬编码深色 token（`bg-slate-*`、`text-white`、`border-white/*`、`from/to-slate-*` 及知识图谱/AI/思政模块常见深色 hex 背景）在浅色模式下做统一映射，实现旧页面无需大改即可随主题切换并保持视觉一致性。
- 学生主工作流页面（`/dashboard`、`/missions`）完成语义化样式改造：统一使用 `surface-page` / `surface-card` / `cta-primary` 等主题组件类，提升跨页面一致性与可维护性。
- 新增主题覆盖回归测试 `scripts/tests/test-theme-coverage.ts`，用于防止主入口页面再次引入固定深色 token 导致切换失效。
- 新增高频链路主题回归测试 `scripts/tests/test-theme-workflow-pages.ts`（`npm run test:theme-workflow`）：覆盖 `profile`、班级详情、课堂复盘、提示词评估、多表征联动页面，强制要求页面具备主题语义基类。
- 主题统一改造扩展到高频业务页面：`/profile`、`/teacher/classes/[classId]`、`/classroom/teacher/[sessionId]/review`、`/evaluation/prompt-assessment`、`/interactive-learning/multi-representation-linkage` 已统一到 `surface-page` / `surface-topbar` / `surface-card` / `surface-card-soft` 语义样式体系。
- Chrome DevTools 实测通过：在学生端与教师端核心链路中验证了深浅主题切换（`body` 与 `surface-card` 计算样式在 dark/light 间正确切换），并确认改造页面无新增控制台报错。
- 修复知识图谱浅色可读性问题：`/knowledge` 的 2D 图谱节点标签由固定白字改为主题感知（浅色深字、深色浅字），并增加反差描边，避免浅色背景下文字不可读。
- 新增知识图谱主题回归测试 `scripts/tests/test-knowledge-graph-theme.ts`（`npm run test:knowledge-theme`），防止 2D 图谱标签颜色回退为固定白字。
- 知识图谱筛选器升级：新增章节（多选下拉）、`category`、`bloom_level`、关键词联合筛选；关系类型计数改为按当前筛选/搜索结果实时统计；默认仅展示“前置关系”。
- 知识图谱章节化展示升级：左侧节点列表改为按章节分组并默认折叠；图谱渲染中注入章节顶层节点并按顺序显示：`基本概念 → 系统模型 → 时域分析 → 根轨迹分析 → 频域分析 → 系统校正 → 离散系统 → 非线性系统 → 状态空间`。
- 知识图谱节点详情增强：点击节点后新增条件展示字段 `examples`、`difficulty`、`importance`、`keywords`、`formulas`；节点信息栏新增章节信息。
- 知识图谱浅色主题细化：关系筛选区与左侧节点标签完成浅色重配色；3D 视图节点标签在浅色模式改为深色文字，提升可读性。
- 精品课程浅色主题增强：在 `globals.css` 的统一桥接层补齐 `text-cyan-*`、`text-sky-*`、`text-emerald-*`、`text-amber-*`、`text-orange-*`、`text-rose-*`、`text-violet-*` 的浅色高对比映射，提升互动课程浅色模式下的文字可读性。
- 新增浅色对比回归测试 `scripts/tests/test-theme-light-contrast.ts`，防止精品课程中常见强调色在浅色主题下再次退回低对比度。
- 数据源补齐：`data/knowledge_graph.json` 全量 612 个节点新增 `chapter_name` 字段，前后端统一按数据文件中的章节名称渲染与排序。
- 新增知识图谱筛选回归测试 `scripts/tests/test-knowledge-graph-filters.ts`（`npm run test:knowledge-filters`），覆盖章节映射、默认前置关系选择与筛选范围内关系计数。
- 新增统一导航组件 `src/components/shared/feature-page-nav.tsx`，并接入知识图谱、虚拟仿真、思政沙盘、AI工坊、评审入口及其下层页面，统一“返回上一级”样式并固定在左上区域。
- 评审入口页简化文案：头部仅保留标题；下方入口卡片移除“来源文件”字段展示。
- 主页入口隐藏“思政沙盘”“AI工坊”：同步移除首页顶栏导航与入口矩阵中的两个入口，并调整入口矩阵说明为“三大核心模块”。
- 账号口令对齐：新增固定账号密码更新脚本 `scripts/db/update-fixed-account-passwords.mjs`，将工号 `201300000012` 密码设置为 `zyw1983@Just`，管理员账号 `admin` 密码设置为 `admin@Just`。
- 用户菜单主题统一：`src/components/shared/user-menu.tsx` 移除硬编码深色样式，改为语义主题样式（支持深/浅色统一）；同时提升下拉与弹窗层级，避免在 dashboard/teacher/admin 顶栏中被遮挡。
- 新增回归脚本：`scripts/tests/test-user-menu-theme.mjs`（菜单主题样式校验）、`scripts/tests/test-account-password-overrides.mjs`（固定账号密码校验），并在 `package.json` 增加 `seed:fixed-passwords`、`test:user-menu-theme`、`test:account-passwords`。
- 新增学期级学生使用数据填充脚本 `scripts/db/seed-semester-usage-for-test-students.mjs`：按 `data/test_students.md` 全量 142 个学生账号重建仿真日志、习题作答与关卡进度数据，满足“仿真每类 10-30 次（可缺席部分类型）、每类仿真时长 60-300 分钟、习题 300-500 次、游戏每关 1-30 次且积分 1000-2000”。
- 新增学期数据校验脚本 `scripts/tests/verify-semester-usage-for-test-students.mjs`（`npm run test:semester-usage`），用于自动核验上述数据区间约束。
- 新增模型渲染策略测试脚本 `scripts/tests/test-model-render-policy.ts`（`npm run test:model-render-policy`），覆盖“管理员开关 + 网络条件降级”的决策逻辑。
- 新增服务器配置指南 `docs/Server_Codex_Nginx_HTTP2_Guide_2026-03-03.md`，用于在 ECS 上由 Codex 执行 Nginx 配置加固（HTTP2/RSC/GLB 传输稳定性）。

## 12. 近期更新（2026-03-12）

- 新增项目内技能 `.codex/skills/homework-problem-authoring/`：支持按 `course-content/syllabus-refactor/homework-framework.md` 中的题号（如 `T1-1`、`T3-2`）执行“3 个出题智能体 + 裁判 + 3 个作答智能体”的出题闭环，并固化临时文件交接、防作弊文件访问限制、`C/X/D` 三类题一致性判定与二轮复核规则。
- 新增辅助脚本 `.codex/skills/homework-problem-authoring/scripts/extract_homework_question.py`：用于从作业框架中按题号提取最小题目规范，供主代理构造任务包时使用。
- 新增技能回归测试 `scripts/tests/test-homework-problem-authoring-skill.ts` 与脚本测试 `scripts/tests/test_extract_homework_question.py`，用于校验技能文本约束和题号抽取脚本行为。

## 13. 近期更新（2026-03-18）

- 修复 L-sum 课堂会话回归：`/api/session/[sessionId]` 在 Redis 快路径下重新返回 `joinCode/classId/planTitle`，教师端课堂码恢复显示。
- 修复课堂状态同步风暴：稳定化 `useSessionProgressChannel` 与 `useSessionStateChannel` 的返回值，并移除上层会话 hook 对整对象依赖导致的自激 GET/POST 循环。
- 修复 L-sum 学生端“跳到教师当前页”按钮只打点不跳转的问题，补齐实际翻页行为。
- 新增 L-sum 回归脚本 `scripts/tests/test-lsum-session-regression.mjs`，覆盖课堂码返回、会话 hook 稳定化与学生页跳转约束。
- 调整数据治理集成脚本 `scripts/tests/data-governance-integration-test.ts`，将 Redis 就绪和鉴权前置条件纳入验证，避免误报。
- 新增的成长中枢、学习档案、班级分析 V2、学生诊断页面已修复 `useEffect` 依赖告警，`npm run lint` 结果恢复干净。

## 14. 近期更新（2026-04-04）

- 完成 `course-content/authoring/lessons/3-7` 讲义二轮修订：将误差定义统一为比较点误差 `E(s)=R(s)-H(s)C(s)`，修正输入/扰动作用下误差传递函数，补充“四类传递函数共用特征式、分子反映信号通道”的说明。
- 重写 `2.5` 例题 2：前向通道显式拆为 `G_1(s)` 与 `G_2(s)` 两段，并增加“中间扰动”结构图与物理意义说明，避免把给定和扰动视为同一位置输入。
- 完成 `3.1` 与 `3.2` 的教学重构：新增 `PI/滞后/超前` 三子图说明转折频率差异；时域设计部分改为“先判稳态误差可行性，再看阻尼与根轨迹”，并给出从时域指标到复平面可行域的四步法。
- 新增/更新媒体与脚本：`3-7-error-dual-channel.tex`、`3-7-example2-structure.tex`、`3-7-generate-plots.m`、`3-7-steady-error-validation.m`、`3-7-render-block-diagram.py`，统一由 MATLAB/Octave/TikZ 生成最终图片。
- 讲义附录改为直接嵌入 `MATLAB/Octave` 复现代码，不再给出仅对本机有效的脚本路径；新增回归测试 `course-content/tests/test_3_7_handout_revision.py` 继续覆盖误差口径、图题、例题结构、附录代码与多媒体清单。

## 15. 近期更新（2026-04-05）

- 完成 `2-2` 互动课的实现契约对齐：`src/lib/unit-2-2-course.ts` 新增 `UNIT_2_2_PAGE_CONTRACTS`，并将 `UNIT_2_2_LESSON_STEPS` 的 `pageType` 升级为与作者态 `interactive-contract.yaml` 一致的契约粒度。
- 互动课程实现技能脚本 `.codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py` 已新增 `2-2` 预设，支持直接执行 `python3 ... --lesson 2-2`。
- `course-content/scripts/review_lesson_content.py` 已把 `2-2` 纳入严格实现契约注册表，并修复 TypeScript 导出提取器在 `node -e` 模式下的参数偏移问题，`--strict-implementation-contract` 可用于正式校验 `2-2`。
- 复核互动课程入口页后确认：`2-2` 继续与 `2-1` 一样保留在 `/interactive-learning/courses` 的精品课程和模块 2 单元入口中，并新增测试守卫其契约对齐状态。

## 16. 近期更新（2026-04-08）

- 完成 `3-7` 精品互动课 `unit-3-7-steady-error-low-frequency-compensation` 的 runtime-first 落地，正式把模块 3 精品课主线扩展到 `3-7`，并复用统一预习台入口与课堂外资源埋点模板。
- 完成 `3-8` 精品互动课 `unit-3-8-frequency-domain-translation-judgment` 的 runtime-first 落地，正式把模块 3 精品课主线扩展到 `3-8`，并将“结构变化频域指纹 -> Nyquist/Bode 统一判稳 -> 三频段分工 -> 工程案例读回 -> 3-9/4-1 去向”收束为 12 步课堂流程。
- `3-8` 新增 `src/lib/unit-3-8-course.ts`、`src/lib/unit-3-8-ai-contexts.ts` 与 `src/features/interactive/unit-3-8-frequency-domain-translation-judgment/` 整套课堂壳、步骤面板和工作区，并在 `src/features/interactive/__tests__/unit-3-8-course.test.ts` 中补齐课程注册、契约对齐、入口页模板、runtime 媒体索引和 AI 上下文守卫。
- `3-8` 已同步接入 `src/features/interactive/learning-catalog.ts`、`src/lib/classroom-session-route.ts`、`src/lib/course-ai-contexts.ts` 与 `src/features/teacher/preset-lessons/presets/`，课堂入口、师生端动态路由、课程级 AI 上下文和教师预置教案现已全部贯通。

## 17. 近期更新（2026-04-11）

- 已对模块 4 的上位设计做一次前半链重排：`4-1 / 4-2 / 4-3` 不再按“任务语言 -> 选型解释 -> 初始方案”的抽象链条平推，而改成“从双场景跨域证据读任务排序 -> 单结构首轮起步 -> 首版可验证方案”。
- 同步固定模块 4 后半链的统一落地框架：`4-4` 先做首轮验证与失败诊断，`4-5 / 4-6` 只围绕问题清单做权衡与修正，`4-7 / 4-8` 继续沿用同一任务书和证据链做场景迁移，不再另起空泛的比较语言。

## 18. 近期更新（2026-04-12）

- 完成 `4-1` 精品互动课 `unit-4-1-design-task-expression` 的 runtime-first 落地，正式把模块 4 精品课主线从“任务表达与设计入口”接入互动课程体系。
- `4-1` 入口页继续复用共享 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`，保持与 `2-1 / 2-4 / 3-7 / 3-8 / 3-9` 一致的 runtime 媒体入口和课堂外资源埋点形式。
- 新增 `src/lib/unit-4-1-course.ts`、`src/lib/unit-4-1-ai-contexts.ts` 与 `src/features/interactive/unit-4-1-design-task-expression/` 整套课堂壳、步骤面板和任务卡工作区，并在 `src/features/interactive/__tests__/unit-4-1-course.test.ts` 中补齐课程注册、契约对齐、入口页模板、runtime 媒体索引和 AI 上下文守卫。
- `4-1` 已同步接入 `src/features/interactive/learning-catalog.ts`、`src/lib/classroom-session-route.ts`、`src/lib/course-ai-contexts.ts` 与 `src/features/teacher/preset-lessons/presets/`，课堂入口、师生端动态路由、课程级 AI 上下文和教师预置教案现已全部贯通。

## 19. 近期更新（2026-04-13）

- 完成讲义生成技能与大纲重构真值文档的一轮联动修订：学生版讲义默认改为“问题/任务引入 -> 前置缺口 -> 能力产出 -> 原理主线 -> 锚点案例 -> 最小例题 -> 分层练习 -> 特殊情况 -> 总结扩展”结构，不再鼓励大段上一课回顾与下一课铺垫。
- `.codex/skills/lesson/SKILL.md`、`.codex/skills/lesson/references/step3-handout.md`、`.codex/skills/refine/SKILL.md` 与 `.codex/skills/syllabus-refactor/SKILL.md` 已统一口径：学生版正文去接口化，AI 练习默认移出正文主线，缺少问题引入/锚点案例/最小例题/分层练习将被视为生成阶段缺陷。
- `course-content/syllabus-refactor/unit-design-details.md`、`module-skeletons.md`、`main.md`、`blueprint.md` 与 `unit-design-details/module1-5.md` 已清理会污染生成器的“接口语言”，将单元边界改写为以学生版讲义优先的真值输入，统一使用“核心问题 / 前置缺口 / 能力产出 / 锚点案例 / 关键证据 / 边界情况”口径。

---

**最后更新日期**：2026-04-13
**版本**：v1.1.3
**状态**：开发完成，可用于教学实践
