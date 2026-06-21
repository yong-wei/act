# 功能状态流续篇（四十九）

日期：2026-06-21
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：学生自适应 demo 与提示词评价、学生个人中心下一步、教师班级报告/分析/课前包、管理员治理与数据中心，以及移动端对应状态。

## 1. 证据清单

- 截图目录：`../screenshots/85-function-state-flows-batch49-adaptive-report-governance/`
- Manifest：`../screenshots/function-state-flows-batch49-manifest.json`
- 采集脚本：`../scripts/capture-batch49.mjs`
- 结果：32 张 PNG、32 个 DOM/a11y JSON、20 个路由响应、9 个 API 检查、21 个登录/可选动作、0 个下载事件、0 个 confirm dialog、0 个脚本错误、6 个忽略错误。

6 个忽略错误中，5 个是截图和 DOM 记录完成后的 Playwright context 关闭超时；1 个是数据中心治理动作点击时定位到隐藏 `数据治理` 文本而超时。它们不影响本批 manifest、截图和 DOM/a11y JSON 的存在性与可解析性结论，但暴露了治理入口命中层级仍不稳定。

## 2. 路由、动作与 API 结果

| 类型 | 代表路径/动作 | 结果 | 关键观察 |
|---|---|---:|---|
| 学生自适应 demo | `/assessment/adaptive-practice?demo=1&scene=stable` | 200 / attempted | 练习题可展开并选择提交，但提交后仍保留“提交答案/换一题”，缺少稳定完成状态、结果写回和证据回看。 |
| 学生路径真源 | `/api/learning-paths/latest?goal=control-correction` | 200 | 返回 `{"path":null}`，真实路径缺失与 demo 路径展示之间仍没有清晰边界。 |
| 提示词评价 demo | `/evaluation/prompt-assessment?autodemo=1` | 200 / filled | 可见输入填充命中 `global-ai-sidebar-input`，结构化任务输入与全局 AI 输入继续相互抢占。 |
| 学生个人中心 | `/profile?from=batch49` | 200 / attempted | “执行下一步练习”等动作后仍停留原页，未带入 remediation/evidence 上下文。 |
| 教师首页 | `/teacher` | 200 / attempted | 报告/证据动作落到 `/teacher/classes`，没有进入具体报告账本或证据交付状态。 |
| 教师班级详情 | `/teacher/classes/cmma7g0590004g9q2nl2jyzdf` | 200 / attempted | 页面能显示 143 人班级与治理覆盖，但证据/报告动作没有明显状态变化。 |
| 教师班级分析 | `/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2` | 200 / attempted | API 有治理覆盖与质量数据，页面动作仍没有形成补强题单、报告锁定或学生分派。 |
| 控制校正报告 API | `control-correction-report?export=true` | 200 | 报告 JSON 可用，但直接访问仍是原始 API 内容，不是教师可交付页面。 |
| 助手效果报告 API | `assistant-effect-report?export=true` | 404 | 真实班级仍返回“演示效果报告不存在”。 |
| 教师课前包 | `/teacher/prep-packs?classId=...` | 500 | 桌面和移动都落到 Next 错误页，只有 Reload。 |
| 管理员治理 | `/admin/data-governance?surface=risk-flags` | 200 / attempted | 能展示 170 个风险，但 drilldown 仍无处置、分派、证据或撤销闭环。 |
| 管理员状态页 | `/admin/states` | 200 / attempted | 治理动作尝试后没有可见状态转移。 |
| 数据中心 | `/data-center?source=governance-admin` | 200 / clicked-no-download | 快照导出没有 download event；治理入口点击会命中隐藏文本。 |

## 3. 学生自适应、提示词与个人中心

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | 自适应 demo 稳定态 | `01-student-adaptive-stable-default.png` | 页面展示自适应学习路径中心、当前路径、证据记录和下一步入口。 |
| 2 | 展开练习 | `02-student-adaptive-stable-after-expand.png` | “完成频域到时域检查题”练习可展开，题目和 A/B/C/D 单选项出现。 |
| 3 | 提交练习 | `03-student-adaptive-stable-after-submit.png` | 选择并提交后仍显示“提交答案/换一题”，没有明确正确/错误、写回、完成或下一步状态。 |
| 4 | 生成态默认 | `04-student-adaptive-generate-default.png` | `scene=generate` 仍以 demo 路径展示为主。 |
| 5 | 生成动作后 | `05-student-adaptive-generate-after-action.png` | 动作后页面仍是路径中心，缺少生成请求的等待、完成、失败或候选差异反馈。 |
| 6 | Prompt autodemo 默认 | `06-student-prompt-autodemo-default.png` | 页面存在提示词评价表单、评分卡和版本历史。 |
| 7 | Prompt autodemo 动作后 | `07-student-prompt-autodemo-after-action.png` | 填充动作命中全局 AI 输入框；页面展示综合得分 90、一致性 46 和 V1-V4 历史，但主任务输入命中边界不可信。 |
| 8 | 个人中心默认 | `08-student-profile-default.png` | 页面聚合能力、推荐和证据入口。 |
| 9 | 个人中心下一步 | `09-student-profile-after-next-action.png` | 下一步动作后仍停留 `/profile?from=batch49`，没有携带薄弱能力、证据或目标到练习页面。 |

学生端最大问题不是页面缺数据，而是 demo 与真实路径真源分离、作答结果没有 durable 状态、跨页面动作没有上下文继承。

## 4. 教师报告、分析与课前包

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 10 | `/teacher` 默认 | `10-teacher-dashboard-default.png` | 教师首页有当前课堂、备课动作、证据与报告入口。 |
| 11 | 教师首页动作 | `11-teacher-dashboard-after-action.png` | 报告/证据动作落到 `/teacher/classes`，不是具体报告账本或证据队列。 |
| 12 | 班级详情默认 | `12-teacher-class-detail-default.png` | `2024自动化` 显示 143 名学生，治理覆盖 135/143。 |
| 13 | 班级详情动作 | `13-teacher-class-detail-after-action.png` | 动作后无明显状态变化，未打开学生证据、补强题单或报告交付。 |
| 14 | 班级分析默认 | `14-teacher-class-analytics-default.png` | 页面高度超过 13,000px，包含治理覆盖、课堂质量和诊断信息。 |
| 15 | 班级分析动作 | `15-teacher-class-analytics-after-action.png` | 报告/补强动作没有形成锁定、下载、分派或后续任务。 |
| 16 | 控制报告 API 路由 | `16-teacher-control-report-api-route.png` | 浏览器直接渲染报告 JSON；没有教师可阅读、可导出、可发送的产品页面。 |
| 17 | 助手效果报告 API 路由 | `17-teacher-assistant-effect-report-api-route.png` | 返回 `{"error":"演示效果报告不存在"}`。 |
| 18 | 教师课前包 | `18-teacher-prep-packs-class-default.png` | 路由返回 500，Next 错误页只有 Reload。 |

相关 API 同时确认：控制校正报告包含班级 143 人、路径采用、能力提升和来源覆盖；班级 insights 返回治理 warning、覆盖 135/143、ready/stale/missing 分布；助手效果报告仍没有真实班级产物。教师端缺的是把数据转换成可交付工作流，而不是单纯缺接口。

## 5. 管理员治理、状态与数据中心

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 19 | 治理风险默认 | `19-admin-governance-risk-default.png` | 治理页能加载风险、队列和数据概览。 |
| 20 | 治理 drilldown | `20-admin-governance-after-drilldown.png` | 动作后没有进入风险证据、分派、处置、撤销或审计记录。 |
| 21 | 管理员状态页默认 | `21-admin-states-default.png` | 状态页可展示平台状态与治理相关入口。 |
| 22 | 状态页动作后 | `22-admin-states-after-action.png` | 治理动作后没有可见状态变化。 |
| 23 | 数据中心默认 | `23-admin-data-center-default.png` | 管理员上下文可进入数据中心，显示治理入口和导出演示快照。 |
| 24 | 数据中心动作后 | `24-admin-data-center-after-actions.png` | 导出未产生 download event；治理点击命中隐藏 `数据治理` 文本并超时。 |

管理员 API 返回 `status: healthy`、`activeRiskFlags: 170`、`freshness: stale`、`learningFacts: 5006`；总览 API 返回 users 298、students 293、teachers 4、admins 1。界面已经有治理数据，但缺少可操作的治理闭环。

## 6. 移动端状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 25 | 移动自适应默认 | `25-mobile-student-adaptive-default.png` | 移动截图高度约 6184px，主任务和全局浮动工具距离过长。 |
| 26 | 移动自适应动作 | `26-mobile-student-adaptive-after-action.png` | 动作后高度约 6528px，仍缺作答完成与写回状态。 |
| 27 | 移动 Prompt autodemo | `27-mobile-student-prompt-autodemo-default.png` | 评分表单和全局 AI 输入仍竞争首屏注意力。 |
| 28 | 移动个人中心 | `28-mobile-student-profile-default.png` | 页面约 6074px，高优先级下一步动作不够固定。 |
| 29 | 移动教师班级分析 | `29-mobile-teacher-class-analytics-default.png` | 页面约 14128px，分析、治理和报告动作很难在移动端形成连续任务。 |
| 30 | 移动课前包 | `30-mobile-teacher-prep-packs-default.png` | 与桌面一致返回 500。 |
| 31 | 移动管理员治理 | `31-mobile-admin-governance-default.png` | 移动上下文实际宽度约 568px，仍有横向溢出风险。 |
| 32 | 移动数据中心 | `32-mobile-admin-data-center-default.png` | 390px 宽下仍是 5064px 长页，导出/治理动作不具备固定反馈。 |

移动端不只是长页问题；教师分析和管理员治理类页面缺少固定任务条、状态播报和窄屏表格/风险卡片重排，导致用户无法形成连续动作。

## 7. 主要问题

### 321. P1：自适应 demo 作答没有 durable 完成状态

`/assessment/adaptive-practice?demo=1&scene=stable` 能展开题目、选择选项并点击提交，但提交后仍保留“提交答案/换一题”，没有稳定的正确/错误反馈、写回确认、证据链接或下一步状态。与此同时 `/api/learning-paths/latest?goal=control-correction` 对真实学生返回 `path:null`，demo 路径和真实路径真源的边界仍未表达。

建议：把 demo 作答、真实路径空态和写回状态拆成明确状态机；提交后至少给出结果、证据记录、下一步和失败重试。

### 322. P1：Prompt autodemo 主输入仍被全局 AI 抢占

提示词评价页面的填充动作命中 `global-ai-sidebar-input`，而不是评价任务的结构化输入。页面随后仍显示得分和版本历史，容易造成“输入已评估”的假象。

建议：全局 AI 输入在任务表单聚焦时退出 Tab 顺序或延后；Prompt 评价主输入必须具备唯一可定位 label、name 和提交状态。

### 323. P1：学生个人中心下一步动作不继承补练上下文

个人中心“执行下一步练习”等动作后仍停留 `/profile?from=batch49`，未携带薄弱能力、证据 ID、推荐 ID 或目标到练习/路径页面。

建议：个人中心推荐卡需要使用明确的 `actionUrl` 与上下文参数，并在跳转失败时显示原因。

### 324. P1：教师首页报告/证据入口落到泛化班级列表

教师首页的报告或证据动作落到 `/teacher/classes`，没有进入具体班级报告账本、证据队列或待处理报告状态。

建议：首页入口应指向具体待办对象；没有待办时显示可解释空态，而不是泛化导航。

### 325. P1：教师班级详情和分析动作没有交付状态

班级详情与分析页有 143 人班级、治理覆盖和诊断数据，但证据/报告/补强动作后没有打开证据、题单、报告锁定、分派或发送状态。

建议：把班级 insights 的 ready/stale/missing、低置信和课堂质量结果转成可执行队列，并记录动作完成状态。

### 326. P1：控制校正报告仍停留在 raw JSON 交付

控制校正报告 API 返回 200 并包含可用报告数据，但浏览器访问仍是原始 JSON。教师无法在产品页面中导出、发送、复制摘要、锁定版本或创建补强任务。

建议：新增或打通教师报告交付页，使用 API 数据渲染报告摘要、方法说明、来源覆盖、导出和发送状态。

### 327. P1：助手效果报告真实班级仍返回 404

`/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/assistant-effect-report?export=true` 返回 `{"error":"演示效果报告不存在"}`，真实班级没有可交付的助手效果账本。

建议：真实班级没有报告时页面应说明缺少哪些数据、如何生成、是否仅支持 demo，而不是让教师遇到 API 404。

### 328. P0：教师课前包真实班级路由返回 500

`/teacher/prep-packs?classId=cmma7g0590004g9q2nl2jyzdf` 在桌面和移动都返回 500，只剩 Next 错误页和 Reload。

整改状态（2026-06-21，`audit-remediation-p0-stability`）：已修复。class-scoped 路由进入课前包复核空态/恢复态，不返回 500；证据见 `../remediation/audit-remediation-p0-stability/evidence.md`。

建议：先修复服务端异常；若课前包功能未启用，应显示产品化 feature-gated 状态和返回教师工作台路径。

### 329. P1：管理员治理风险仍不可处置

治理页和 API 都能展示 170 个风险，但 drilldown 后没有进入证据、分派、标记处理、批量处置、撤销或审计记录。

建议：风险行至少具备查看证据、标记处理、分派负责人、导出和撤销记录；批量动作需要状态播报。

### 330. P1：数据中心导出和治理入口命中不稳定

数据中心管理员态点击导出演示快照没有 download event；治理入口点击时定位到隐藏 `数据治理` 文本并超时。

建议：导出按钮使用真实下载或明确的异步生成状态；治理入口使用可见 button/link 和唯一 accessible name，避免隐藏文本抢占自动化与读屏命中。

### 331. P2：移动关键流程过长且缺固定任务动作

移动自适应、个人中心、教师分析和数据中心截图高度普遍超过 5000px，教师班级分析超过 14000px。主任务动作没有固定在用户当前决策点。

建议：移动端把路径执行、报告交付、治理处置等关键任务抽成固定任务条或分段导航，避免用户靠长滚动寻找下一步。

### 332. P2：移动管理员治理仍存在宽度异常

移动管理员治理在移动上下文下实际宽度约 568px，延续了此前治理/用户页的横向溢出风险。

建议：治理风险列表在移动端改为卡片或关键字段折叠，所有表格容器设置明确的窄屏 overflow 策略，并在 390px/320px 双宽度复核。

### 333. P2：第 49 批 32 个状态仍全部缺少 alert/live

本批 32 个 DOM/a11y JSON 均没有捕获到 `alert`。作答提交、Prompt 异步动作、报告入口、导出、治理 drilldown、课前包错误和移动状态变化都没有统一的状态播报。

建议：建立跨角色的 status/live 合同，覆盖提交、生成、下载、导出、错误恢复、筛选、处置和移动抽屉动作。

## 8. 下一批输入

- 继续优先复核教师报告交付链路：控制校正报告 UI、助手效果报告真实班级生成条件、课前包 500 修复后的页面状态。
- 管理员侧继续追踪风险处置、数据中心导出和治理入口命中层级。
- 学生侧继续追踪真实学习路径为空时的产品状态、demo 作答写回和个人中心推荐动作上下文。
- 移动端继续以 390px 与 320px 同时验证治理页、教师分析页和自适应路径页的宽度、首屏任务和状态播报。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 329 已关闭：治理风险不再只是只读行；风险行提供处置/分派入口，缺失或有效 riskId 均生成可读动作状态和审计记录。

## #617 移动与可访问性整改记录（2026-06-21）

整改变更：`audit-remediation-mobile-a11y-shell`。证据：`../remediation/audit-remediation-mobile-a11y-shell/evidence.md`。

- 331 已部分关闭：教师分析页已有移动固定报告交付动作区，本变更补充状态播报和按钮名称；自适应路径等业务页仍由对应变更关闭。
- 332 已关闭：管理员治理页移动表格卡片化，并通过 320px/390px 验收。
- 333 部分关闭：本变更拥有的浮动工具、AI 侧栏、管理员用户/治理、教师报告/班级详情页面已接入 `status/live`，其他业务动作状态机不在本变更中关闭。
