# 功能状态流续篇（五十）

日期：2026-06-21
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：真实自适应学习路径空态与意图态、教师班级报告/证据/评分入口、管理员治理风险与数据中心导出，以及 320/390px 移动回归。

## 1. 证据清单

- 截图目录：`../screenshots/86-function-state-flows-batch50-path-report-governance-regression/`
- Manifest：`../screenshots/function-state-flows-batch50-manifest.json`
- 采集脚本：`../scripts/capture-batch50.mjs`
- 结果：32 张 PNG、32 个 DOM/a11y JSON、20 个路由响应、11 个 API 检查、19 个登录/可选动作、0 个下载事件、0 个脚本错误、6 个忽略错误。

6 个忽略错误中，5 个是截图和 DOM 记录完成后的 Playwright context 关闭超时；1 个是数据中心治理动作点击时定位到隐藏 `数据治理` 文本而超时。manifest、截图和 DOM/a11y JSON 已逐项校验存在且可解析；教师学生证据页本轮使用真实学生 `cmma7hcro000hg9q2hx1k4b7b`，不再使用错误夹具。

## 2. 路由、动作与 API 结果

| 类型 | 代表路径/动作 | 结果 | 关键观察 |
|---|---|---:|---|
| 真实学习路径 | `/assessment/adaptive-practice?goal=control-correction` | 200 | 页面显示“本周完成 24%”“先建立入门路径”，但 API latest path 返回 `path:null`。 |
| 路径生成设置 | `intent=contextual-recommendation` | 200 / attempted | 点击生成后只显示“路径生成上下文还在准备，请稍后重试”，没有解决班级/账号前置条件。 |
| 路径选择与执行 | `intent=path-selection` / `intent=path-execution` | 200 / attempted | 没有真实 path 时仍展示可执行路径/练习资源入口。 |
| 坏 path 执行 | `pathId=missing-control-correction-path` | 200 | 坏 pathId 未触发错误或恢复路径，仍按普通学习路径中心呈现。 |
| 学习路径 API | latest / learner-state / advisor-context | 200 / 503 / 403 | latest path 为 null；learner-state disabled；advisor-context 因账号缺少班级信息返回 403。 |
| 教师班级分析旧入口 | `/teacher/classes/.../analytics` | 200 -> analytics-v2 | 旧入口重定向到 v2，但没有说明兼容跳转。 |
| 教师报告 surface | `analytics-v2?surface=report-ledger` | 200 / attempted | query 参数没有把页面切到报告账本，仍是 13,192px 班级分析长页。 |
| 教师学生证据 | `/students/cmma7hcro.../evidence?source=report-ledger` | 200 | 真实学生证据可直达，但从报告 surface 的动作没有自动进入该证据链。 |
| 报告评分工作台 | `/teacher/grading-workbench?classId=...&source=report-ledger` | 200 / attempted | 仍显示“当前没有打开的文档评分草稿”，忽略 classId/source 上下文。 |
| 教师报告 API | control-correction / assistant-effect | 200 / 404 | 控制校正报告数据存在；助手效果报告仍返回“演示效果报告不存在”。 |
| 管理员治理风险 | `/admin/data-governance?surface=risk-flags&tab=risks` | 200 / attempted | 默认采集先停在 loading；动作后加载风险，但风险行仍只读。 |
| 数据中心导出 | `/data-center?source=batch50&returnTo=/admin/data-governance` | 200 / clicked-no-download | returnTo 不形成可见返回/治理交接；导出无下载事件，治理入口命中隐藏文本。 |
| 移动 320/390 | 学生路径、教师分析/证据、管理员治理/数据中心 | 200 | 学生 320px 宽度正常；管理员治理 320px 上下文实际变成 568px，教师分析 390px 高 14,128px。 |

## 3. 学生真实学习路径

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | 默认真实路径 | `01-student-real-path-default.png` | 页面显示 24% 进度、当前节点“入门诊断”和“生成控制校正学习路径”。 |
| 2 | contextual intent | `02-student-real-path-contextual-default.png` | 生成设置出现目标、时间、难度、资源偏好和检查点密度。 |
| 3 | contextual action | `03-student-real-path-contextual-after-action.png` | 生成动作后显示“路径生成上下文还在准备，请稍后重试”，但无前置条件修复动作。 |
| 4 | path-selection | `04-student-real-path-selection-default.png` | 无真实 path 时仍进入选择意图。 |
| 5 | selection action | `05-student-real-path-selection-after-action.png` | 采用/比较类动作后没有形成候选路径或错误解释。 |
| 6 | path-execution | `06-student-real-path-execution-default.png` | 进入路径资源入口，显示练习题已准备。 |
| 7 | execution action | `07-student-real-path-execution-after-action.png` | 动作后仍停留练习资源入口，缺少选中路径、节点状态和写回说明。 |
| 8 | evidence-review | `08-student-real-path-evidence-review.png` | 证据回看意图没有形成真实证据复盘面。 |
| 9 | bad pathId | `09-student-real-path-missing-path.png` | 坏 pathId 未进入“路径不存在/已过期”状态。 |

API 同时确认：`/api/learning-paths/latest?goal=control-correction` 返回 `path:null`，`/api/adaptive/learner-state?goal=control-correction` 返回 503 `LEARNER_STATE_SERVICE_DISABLED`，`/api/adaptive/path-advisor-context?goal=control-correction` 返回 403“当前账号缺少班级信息”。真实路径 UI 仍比 API 状态更乐观。

## 4. 教师报告、证据与评分入口

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 10 | `/analytics` 旧入口 | `10-teacher-class-analytics-legacy-default.png` | 路由最终落到 `/analytics-v2`，但页面没有兼容跳转说明。 |
| 11 | 旧入口动作 | `11-teacher-class-analytics-legacy-after-action.png` | 报告/学生/证据动作后仍在班级分析页。 |
| 12 | `analytics-v2?surface=report-ledger` | `12-teacher-class-analytics-v2-report-surface.png` | query 没有打开报告账本，仍是完整班级分析长页。 |
| 13 | heatmap/刷新动作 | `13-teacher-class-analytics-v2-after-heatmap-action.png` | 动作后没有明确刷新完成、报告生成或补强队列。 |
| 14 | 学生 drilldown 动作 | `14-teacher-class-analytics-v2-after-student-action.png` | 动作后没有从分析页进入学生证据。 |
| 15 | 真实学生证据直达 | `15-teacher-student-evidence-from-report-ledger.png` | 真实学生周守运证据可直达，包含旧证据、新鲜度、置信度和缺失来源。 |
| 16 | 评分工作台 class/source | `16-teacher-grading-workbench-class-report-source.png` | 带 classId/source 仍显示无草稿空态。 |
| 17 | 评分动作后 | `17-teacher-grading-workbench-class-after-action.png` | 动作后没有打开评分来源、报告写回或审批工作台。 |

教师 API 侧可用信息比 UI 更强：班级学生 API 返回 143 人，insights/heatmap/risk-students 均 200，控制校正报告非导出 API 200；助手效果报告非导出 API 仍 404。教师端缺少的是把这些状态组织成报告交付、证据审核和评分写回的连续工作流。

## 5. 管理员治理与数据中心

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 18 | 管理员首页 | `18-admin-dashboard-risk-actions-default.png` | 首页有数据治理入口和风险相关信息。 |
| 19 | 首页风险动作 | `19-admin-dashboard-after-risk-action.png` | 风险动作后仍停在管理员首页，没有打开风险队列。 |
| 20 | 治理风险默认 | `20-admin-governance-risk-tab-default.png` | 等待后仍停在“正在加载数据治理看板…”。 |
| 21 | 治理风险动作后 | `21-admin-governance-risk-tab-after-action.png` | 风险数据加载，显示 170 个风险，但风险行仍无查看证据/分派/处置动作。 |
| 22 | 治理质量 tab | `22-admin-governance-quality-tab-default.png` | 页面可展示治理质量相关数据。 |
| 23 | 刷新治理状态 | `23-admin-governance-quality-after-refresh.png` | 刷新动作无 alert/live，完成状态不稳定。 |
| 24 | 管理员状态页 | `24-admin-states-governance-default.png` | 状态页有治理/证据相关入口。 |
| 25 | 状态页动作后 | `25-admin-states-governance-after-action.png` | 动作后无可见治理交接状态。 |
| 26 | 数据中心 returnTo | `26-admin-data-center-return-target-default.png` | returnTo 参数没有形成可见返回治理或复核交接。 |
| 27 | 数据中心动作后 | `27-admin-data-center-return-target-after-actions.png` | 导出无 download event；治理入口点击命中隐藏文本。 |

管理员 API 返回 `status: healthy`，但界面仍把治理风险作为只读清单；刷新和导出均缺可验证完成状态。

## 6. 移动回归

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 28 | 320px 学生路径执行 | `28-mobile-320-student-real-path-execution.png` | 宽度保持 320px，但真实路径仍是空路径下的练习资源入口。 |
| 29 | 390px 教师分析报告 | `29-mobile-390-teacher-analytics-v2-report.png` | 宽度 390px，高度 14,128px，报告动作埋在极长分析页。 |
| 30 | 390px 教师学生证据 | `30-mobile-390-teacher-student-evidence.png` | 真实学生证据可读，但仍缺审核处置动作和状态播报。 |
| 31 | 320px 管理员治理 | `31-mobile-320-admin-governance-risk-tab.png` | 320px 移动上下文实际 viewport/scroll 宽变成 568px，横向策略仍失效。 |
| 32 | 320px 数据中心 | `32-mobile-320-admin-data-center-return-target.png` | 宽度保持 320px，但页面高 5155px，导出/治理动作没有固定反馈区。 |

## 7. 主要问题

### 334. P1：真实学习路径 API 为空时 UI 仍展示进度和执行入口

真实 latest path 返回 `path:null`，learner-state 返回 503，path-advisor-context 返回 403，但页面仍显示 24% 进度、入门诊断和路径执行入口。

建议：把真实空路径、服务关闭、缺少班级信息分别渲染为明确状态，不再展示进度或执行入口。

### 335. P1：路径生成动作没有解决前置条件

路径生成设置可见，点击后只提示“路径生成上下文还在准备，请稍后重试”，没有解释缺少班级信息、服务不可用或需要教师绑定。

建议：生成按钮应直接连接 advisor-context 的错误语义，并给出加入班级、刷新数据或联系教师的可执行动作。

### 336. P1：path-selection、path-execution 和坏 pathId 状态仍被普通页面吞掉

无真实 path 时，选择和执行 intent 仍显示路径/练习资源；坏 pathId 也没有“路径不存在/已过期/重新生成”状态。

建议：intent 必须先校验真实 path；坏 pathId 应阻断执行并提供重新生成或回到路径中心。

### 337. P1：教师报告 surface query 没有切换到报告账本

`analytics-v2?surface=report-ledger` 仍展示完整班级分析页。旧 `/analytics` 入口也静默落到 v2，没有提示兼容跳转。

建议：报告 surface 应定位到报告账本、锁定版本、导出/发送和补强入口；旧入口重定向需要保留语义提示或 canonical 链接。

### 338. P1：班级分析动作不能进入学生证据或补强任务

分析页可显示治理覆盖、能力矩阵和重点学生，但点击报告/学生/证据相关动作后不进入学生证据链；真实学生证据页必须靠直达 URL 才能访问。

建议：分析页重点学生、风险行和报告条目应显式链接到学生证据、题单创建和补强任务，并记录返回上下文。

### 339. P1：评分工作台忽略 classId/source 上下文

`/teacher/grading-workbench?classId=...&source=report-ledger` 仍显示“当前没有打开的文档评分草稿”，没有根据班级或报告来源列出可评分材料。

建议：评分工作台应读取 class/source，展示对应提交、报告候选和空态原因。

### 340. P1：教师报告 API 与 UI 交付仍断开

控制校正报告 API 返回 200，assistant-effect 报告返回 404；UI 没有把可用报告和不可用原因接入教师报告账本。

建议：报告账本应显示每类报告的可用性、生成条件、导出/发送状态和错误恢复。

### 341. P1：管理员治理风险页加载状态不稳定

同一路由默认等待后仍可停在 loading，后续动作后才出现风险数据。数据加载完成没有稳定 status/live。

建议：治理看板应有明确的加载超时、重试、局部骨架和完成播报，避免用户误判页面卡死。

### 342. P1：治理风险清单仍是只读表

加载后可见 170 个风险和风险说明，但风险行没有查看证据、分派、标记处理、批量处置、导出或撤销。

建议：每条风险至少提供证据、处置、分派和审计动作；批量动作要有执行状态和撤销记录。

### 343. P1：数据中心 returnTo、导出和治理交接都未闭环

`returnTo=/admin/data-governance` 没有形成可见返回治理交接；导出没有 download event；治理入口仍命中隐藏文本。

建议：returnTo 应显示返回/继续治理动作，导出应有真实下载或异步任务状态，治理入口需要唯一可见可点击名称。

### 344. P2：移动治理与教师报告页仍不适合窄屏连续任务

320px 管理员治理实际宽度变成 568px；390px 教师分析报告页高 14,128px。移动用户无法在当前屏幕内完成风险处置或报告交付。

建议：治理风险和教师报告移动端改为任务卡片、固定动作条和分段导航，并继续用 320px 与 390px 双宽度回归。

### 345. P2：第 50 批 32 个状态仍全部缺少 alert/live

本批 32 个 DOM/a11y JSON 均没有捕获到 `alert`。路径生成失败、报告/证据动作、治理刷新、数据中心导出和移动状态变化都无可访问状态播报。

建议：延续统一 status/live 合同，覆盖路径生成、报告交付、评分来源、治理加载、风险处置、导出和移动导航。

## 8. 下一批输入

- 继续追踪学习路径真实 path 生成前置条件：班级绑定、advisor-context、learner-state disabled 与 UI 空态的一致性。
- 继续追踪教师报告账本：报告 surface、评分工作台 class/source、学生证据返回上下文和助手效果报告真实生成条件。
- 继续追踪管理员治理：风险行处置、导出、returnTo 交接和加载完成状态。
- 移动端继续把 320px 管理员治理横向溢出和 390px 教师分析超长页作为回归重点。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 341 已关闭：治理页保留加载/失败状态，并对 action 深链提供对象缺失恢复。
- 342 已关闭：风险清单增加行级处置/分派入口与动作审计摘要。
- 343 非本变更关闭范围：数据中心 returnTo 与导出属于数据中心垂直修复；治理交接部分已由本变更关闭。

## #617 移动与可访问性整改记录（2026-06-21）

整改变更：`audit-remediation-mobile-a11y-shell`。证据：`../remediation/audit-remediation-mobile-a11y-shell/evidence.md`。

- 344 部分关闭：管理员治理页通过 320px/390px DOM width 与截图验收；教师分析报告页保留移动固定报告交付动作区，并通过 320px/390px DOM width 与截图验收。风险处置、报告发送/补强的业务闭环仍由管理员治理和教师报告垂直变更关闭。
- 345 部分关闭：本变更补齐代表页面的 `status/live`、移动固定动作和弹窗/AI 键盘证据；路径生成、数据中心导出、风险处置和评分来源等业务状态仍保留。
