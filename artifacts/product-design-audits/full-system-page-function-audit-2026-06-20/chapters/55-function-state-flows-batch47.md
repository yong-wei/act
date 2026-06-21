# 功能状态流续篇（四十七）

日期：2026-06-21
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：学习完成态、报告交付、导出下载、治理处置、证据后续动作、Prompt 评价和移动端完成态。

## 1. 证据清单

- 截图目录：`../screenshots/82-function-state-flows-batch47/`
- Manifest：`../screenshots/function-state-flows-batch47-manifest.json`
- 采集脚本：`../scripts/capture-batch47.mjs`
- 结果：24 张 PNG、24 个 DOM/a11y JSON、13 个路由响应、4 个 API 检查、19 个登录/可选动作、0 个下载事件、0 个 confirm dialog、0 个脚本错误、5 个忽略错误。

5 个忽略错误均为 Playwright context 关闭超时，发生在截图和 DOM 记录完成之后；它们说明页面存在持续请求或长轮询会延长采集收尾，但不影响本批截图、DOM/a11y JSON 与 manifest 完整性。

## 2. 路由、动作与 API 结果

| 类型 | 代表路径/动作 | 结果 | 关键观察 |
|---|---|---:|---|
| 学生自适应练习 | `/assessment/adaptive-practice` 选项/提交 | not-found | 默认页展示路径中心，但脚本未找到可提交的答题控件。 |
| Prompt 评价 | `/evaluation/prompt-assessment` 填写与评价 | attempted | 填写目标命中全局 AI 输入框，评价动作无完成状态。 |
| 学生证据 | `/profile/evidence` 后续动作 | attempted | 点击后进入 lessonId 过滤态，仍停留在证据列表视图。 |
| 教师历史 | `/teacher/history` 报告/复盘动作 | attempted | 7465px 长页，动作后没有报告交付状态变化。 |
| 课堂复盘 | `/classroom/teacher/cmqm6s1s1001f1wyf4ggkifs5/review` | attempted | 复盘可见 2 人课堂记录，但交付动作后画面不变。 |
| 班级分析 | `/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2` | attempted | 页面高 13192px，报告/补强动作没有状态闭环。 |
| 数据中心 | `/data-center` 导出/下载 | clicked-no-download | 点击导出/下载文本后没有下载事件，也无完成提示。 |
| 管理员概览 | `/admin` 治理/风险动作 | attempted | 概览可访问，但动作后没有明确转场或状态。 |
| 数据治理 | `/admin/data-governance` 处置/导出 | attempted | 风险清单真实可见，但缺查看证据、分派、标记处理、导出。 |
| 移动端 | Prompt、证据、复盘、治理 | 200 | 移动治理仍以 568px 宽视口呈现，完成态全部无 alert/live。 |
| API | latest path、teacher class、governance、overview | 200 | 后端能返回基础数据，UI 缺口主要在动作状态和交付链路。 |

## 3. 学生完成态与后续动作

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/assessment/adaptive-practice` 默认 | `01-student-adaptive-practice-default.png` | 页面显示自适应学习路径中心、进度和路径状态。 |
| 2 | 选择/提交尝试 | `02-student-adaptive-practice-after-submit.png` | 选项控件和提交按钮均未找到，动作后仍是路径中心。 |
| 3 | `/evaluation/prompt-assessment` 默认 | `03-student-prompt-assessment-default.png` | 元提示词评价页可见，但任务输入优先级不够清晰。 |
| 4 | Prompt 评价动作 | `04-student-prompt-assessment-after-action.png` | 填写命中“全局 AI 问题输入框”，评价动作后无完成或错误状态。 |
| 5 | `/profile/evidence` 默认 | `05-student-evidence-default.png` | 学习证据列表可见，包含课堂证据与筛选。 |
| 6 | 证据后续动作 | `06-student-evidence-after-follow-up.png` | 进入 `lessonId=unit-4-1-design-task-expression-v1` 过滤态，仍缺题目级复盘或补练闭环。 |

学生路径的问题不是路由不可达，而是“完成/提交/评价/后续练习”这些关键动词没有稳定落到可理解状态。

## 4. 教师报告交付与数据中心

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 7 | `/teacher/history` 默认 | `07-teacher-history-default.png` | 历史页高度 7465px，历史记录和报告语义混在长列表中。 |
| 8 | 历史报告/复盘动作 | `08-teacher-history-after-report-action.png` | 点击后没有明显交付、打开、导出或状态播报。 |
| 9 | 已结束课堂复盘 | `09-teacher-finished-class-review-default.png` | 可见 2 人课堂记录、学习事实和补强路径空态。 |
| 10 | 复盘交付动作 | `10-teacher-finished-class-review-after-delivery-action.png` | 动作后页面不变，仍只提供“前往评审聚合入口”。 |
| 11 | 班级分析 | `11-teacher-class-analytics-default.png` | 班级学情页高 13192px，风险/分析信息真实存在。 |
| 12 | 分析报告/补强动作 | `12-teacher-class-analytics-after-action.png` | 报告、补强、课前包相关动作无稳定状态。 |
| 13 | `/data-center` 默认 | `13-teacher-data-center-default.png` | 平台数据中心可访问，有数据和治理文本。 |
| 14 | 数据中心导出 | `14-teacher-data-center-after-export.png` | 点击导出/下载没有下载事件，也没有完成状态。 |

教师端仍缺从“看见数据”到“交付报告、发送学生、生成补强、导出存档”的闭环。

## 5. 管理员治理处置与移动状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 15 | `/admin` 默认 | `15-admin-overview-default.png` | 管理员概览可见系统概况、治理和风险信息。 |
| 16 | 概览动作 | `16-admin-overview-after-action.png` | 点击治理/风险/刷新类入口后没有明确状态变化。 |
| 17 | `/admin/data-governance` 默认 | `17-admin-data-governance-deep-default.png` | 桌面治理能展示真实风险、队列、事实分布和快照。 |
| 18 | 处置/导出尝试 | `18-admin-data-governance-after-disposition-action.png` | 风险清单仍是只读表格，缺行级处置。 |
| 19 | 撤销/破坏性确认尝试 | `19-admin-after-destructive-confirm-attempt.png` | 未找到撤销、重置、删除或清空确认入口。 |
| 23 | 移动治理默认 | `23-mobile-admin-governance-deep-default.png` | 移动端仍显示 568px 宽，风险表格和长页信息密度高。 |
| 24 | 移动治理动作 | `24-mobile-admin-governance-after-action.png` | 动作后画面不变，仍没有处置或完成播报。 |

管理员治理页能证明数据存在，但风险处置仍不是工作流，只是看板。

## 6. 主要问题

### 298. P1：自适应练习完成态没有可提交任务控件

`/assessment/adaptive-practice` 默认页可展示路径中心和进度，但本批未找到可选择的答题控件或提交按钮。用户进入“练习”后无法形成一个明确的完成动作。

建议：区分路径概览、练习题、提交结果和下一步路径四个状态；没有当前题时直接说明原因并提供生成/选择路径入口。

### 299. P1：Prompt 评价主输入被全局 AI 输入抢占

Prompt 评价页填写动作命中全局 AI 问题输入框，而不是页面自己的评价表单。评价动作后也没有完成、失败或结果写回状态。

建议：页面主任务输入应具有明确 label、placeholder 和焦点顺序；全局 AI 输入不能在此类任务页抢占第一个文本输入。

整改记录：`audit-remediation-ai-task-boundaries` 已为 Prompt 评价页主输入补充 `name`、`aria-label`、`data-primary-task-input` 和任务状态面板，全局 AI 输入不再作为该页面任务合同；证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 300. P1：学生证据后续动作仍停留在列表过滤

证据页点击后续动作后进入 lessonId 过滤态，但没有打开题目级证据详情、复盘解释或补练生成。学生看不到下一步如何从证据进入学习行动。

建议：证据卡应提供“查看本题反馈”“生成补练”“加入任务”的明确目标，并保持证据上下文传递。

### 301. P1：教师历史页报告/复盘动作缺少交付状态

`/teacher/history` 是 7465px 长页，点击报告/复盘类动作后没有可见状态变化、下载、发送或打开结果。教师无法判断动作是否成功。

建议：历史页应提供节次级报告状态、最近生成时间、发送对象、失败重试和导出入口。

### 302. P1：课堂复盘交付链路仍未形成

已结束课堂复盘页能展示 2 人课堂记录和能力追踪，但交付动作后画面不变，主要出口仍是内部评审聚合入口。

建议：复盘页直接提供导出报告、发送学生、复制摘要、生成补强路径和创建题单，并展示每个动作的完成状态。

### 303. P1：班级分析报告与补强动作不可执行

班级分析页高 13192px，风险和学情信息真实存在，但报告、补强、课前包或发送类动作点击后没有状态。数据没有进入教学行动。

建议：在诊断簇、风险学生和能力短板旁就地放置可执行动作，并展示生成进度、结果、发送状态和回滚入口。

### 304. P1：数据中心导出没有下载事件或完成反馈

教师数据中心点击导出/下载后没有浏览器下载事件，页面也没有导出中、完成、失败或重试状态。

建议：导出按钮应绑定真实下载或异步任务，并提供任务 ID、完成提示、失败重试和权限说明。

### 305. P1：管理员治理风险清单仍缺行级处置

桌面和移动治理页都能展示 170 个风险和最新风险表，但没有查看证据、分派、标记处理、创建待办、导出或撤销动作。管理员无法从风险列表进入治理闭环。

建议：每一行风险至少提供查看证据、指派、标记处理、创建补救任务和导出记录，并记录审计日志。

### 306. P2：移动治理视口仍不是 390px 级别的移动布局

移动治理 capture 在 390px 设备上下文中呈现为 568px 宽，页面高 5897px。风险表格和治理内容没有压缩成适合小屏的工作流结构。

建议：移动治理改为风险卡片、分段锚点和固定关键动作区，避免表格撑开布局。

### 307. P2：第 47 批完成态仍全部缺少 alert/live

24 个 DOM/a11y JSON 的 `alerts=0`。提交、评价、证据后续动作、报告交付、导出、治理处置和移动切换都没有读屏状态播报。

建议：建立完成态状态播报合同，覆盖提交中/成功/失败、下载生成、导出完成、报告发送、治理处置和补强生成。

## 7. 后续审计输入

- 学生端继续补真实题目提交、Prompt 评价结果写回、证据详情和补练生成链路。
- 教师端继续补报告交付、报告账本、班级短板到课前包/补强路径的闭环。
- 管理员端继续补风险行级处置、导出、撤销、审计日志和移动端治理卡片布局。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 304 非本变更关闭范围：数据中心导出被浮层阻断属于 `/data-center` 导出交互，保留给数据中心垂直修复。
- 305 已关闭：管理员治理风险列表增加行级处置/分派入口，并通过 `action/riskId/assignee` 深链生成对象化状态和审计摘要。

## #617 移动与可访问性整改记录（2026-06-21）

整改变更：`audit-remediation-mobile-a11y-shell`。证据：`../remediation/audit-remediation-mobile-a11y-shell/evidence.md`。

- 306 部分关闭：管理员数据治理页来源、课堂质量和风险表在 640px 以下卡片化，并通过 320px/390px DOM width 与截图验收；风险处置工作流、数据中心导出和治理闭环仍由对应垂直变更关闭。
- 307 部分关闭：本变更拥有的管理员治理、管理员用户、教师报告、教师班级详情、全局浮动工具和 Global AI 侧栏已补 `status/live` 或键盘 a11y 证据；本批其他提交、评价、证据后续动作和数据中心导出状态仍未关闭。
