# 功能状态流续篇（四十八）

日期：2026-06-21
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：任务大厅启动、作品集空态动作、教师报告评分工作台、管理员用户模板下载/导入/筛选，以及移动端对应状态。

## 1. 证据清单

- 截图目录：`../screenshots/84-function-state-flows-batch48-delivery-governance/`
- Manifest：`../screenshots/function-state-flows-batch48-manifest.json`
- 采集脚本：`../scripts/capture-batch48.mjs`
- 结果：24 张 PNG、24 个 DOM/a11y JSON、9 个路由响应、8 个 API 检查、22 个登录/可选动作、1 个下载事件、0 个 confirm dialog、0 个脚本错误、5 个忽略错误。

5 个忽略错误均为 Playwright context 关闭超时，发生在截图和 DOM 记录完成之后；本批 manifest、截图和 DOM/a11y JSON 已逐项校验存在且可解析。

## 2. 路由、动作与 API 结果

| 类型 | 代表路径/动作 | 结果 | 关键观察 |
|---|---|---:|---|
| 学生任务大厅 | `/missions` 筛选/启动 | 200 / attempted | 启动后进入 `/simulations/destroyer?mission=...`，仿真页没有保留任务标题、目标和完成标准。 |
| 学生作品集 | `/profile/portfolio` 分类/作品动作 | 200 / not-found | 课堂作品空态只有“进入互动课程”，未找到作品级动作或收录解释。 |
| 作品证据 API | `/api/learning-evidence?limit=10` | 404 | 作品集没有可用的学习证据列表 API 作为页面真源。 |
| 教师评分工作台 | `/teacher/grading-workbench` | 200 | 空态说明等待草稿，但主动作没有打开来源、导入提交或恢复路径。 |
| 缺失评分草稿 | `gradingRunId=missing-grading-run` | 200 / API 404 | 页面仍显示普通空态，API 才返回“评分草稿不存在”。 |
| 教师报告 API | control-correction report | 200 | 控制校正报告可导出数据存在，但仍缺 UI 交付入口。 |
| 助手效果报告 API | assistant-effect-report | 404 | 真实班级继续返回“演示效果报告不存在”。 |
| 管理员模板下载 | `/admin/users` 下载模板 | downloaded | 浏览器得到 `users-template.xlsx`，但页面没有下载成功/失败状态播报。 |
| 管理员批量导入 | 批量导入 | clicked-no-filechooser | 点击未触发 file chooser，用户看不到下一步。 |
| 管理员搜索/角色筛选 | no-match / role API | UI/API 分歧 | no-match API 返回 0；教师角色 API 返回 4，但页面在连续筛选后仍显示 0 条。 |
| 移动管理员用户 | `/admin/users` | 200 | 390px 移动上下文中 DOM viewport 变成 945px，仍是桌面表格工作流。 |

## 3. 学生任务与作品集

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/missions` 默认 | `01-student-missions-default.png` | 任务大厅显示 7 个任务、5 个已完成、2 个可挑战。 |
| 2 | 任务筛选 | `02-student-missions-after-filter.png` | 筛选后仍呈现同一任务列表，缺少结果变化播报。 |
| 3 | 启动任务 | `03-student-missions-after-launch-action.png` | 进入 Destroyer 仿真，但页面首屏只有仿真控制面板，不显示任务名、目标、完成标准或回写规则。 |
| 4 | `/profile/portfolio` 默认 | `04-student-portfolio-default.png` | 作品集按课堂作品、提示词、仿真、伦理、反思分栏。 |
| 5 | 作品集分类动作 | `05-student-portfolio-after-category.png` | 分类切换后无状态播报，仍停留在空态。 |
| 6 | 作品动作尝试 | `06-student-portfolio-after-item-action.png` | 未找到作品级“查看/收录/继续/生成”动作。 |
| 16 | 移动 `/missions` 默认 | `16-mobile-student-missions-default.png` | 移动端任务大厅高 4477px，任务列表可访问但缺移动端结果播报。 |
| 17 | 移动任务动作 | `17-mobile-student-missions-after-action.png` | 移动任务动作后仍停留任务大厅，未形成任务启动或状态反馈。 |
| 18 | 移动 `/profile/portfolio` 默认 | `18-mobile-student-portfolio-default.png` | 移动作品集高度 871px，分类和空态可见。 |
| 19 | 移动作品集动作 | `19-mobile-student-portfolio-after-action.png` | 移动作品集动作后仍无作品级查看、收录或继续状态。 |

任务大厅能把学生送进仿真，但没有把“任务”带进仿真任务面；作品集能展示分类，但空态没有解释收录规则、证据来源或可执行下一步。

## 4. 教师评分与报告

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 7 | `/teacher/grading-workbench` 默认 | `07-teacher-grading-workbench-default.png` | 工作台显示“当前没有打开的文档评分草稿”。 |
| 8 | 工作台主动作 | `08-teacher-grading-workbench-after-primary-action.png` | 主动作后页面不变，无打开来源、导入提交或创建草稿状态。 |
| 9 | 缺失 gradingRunId | `09-teacher-grading-workbench-missing-run.png` | 坏 ID 仍显示普通空态，没有“草稿不存在”提示。 |
| 10 | 恢复动作 | `10-teacher-grading-workbench-after-recovery-action.png` | 点击恢复类动作后落到首页，而不是评分来源列表或教师报告入口。 |
| 20 | 移动评分工作台默认 | `20-mobile-teacher-grading-workbench-default.png` | 移动端同样只展示空草稿状态，没有固定来源入口。 |
| 21 | 移动评分动作 | `21-mobile-teacher-grading-workbench-after-action.png` | 动作后仍停留评分工作台，未出现状态播报或下一步。 |

API 同时确认：`/api/teacher/document-grading/writeback-preview` 返回 404“评分草稿不存在”，`/api/teacher/classes/.../control-correction-report?export=true` 返回 200，`assistant-effect-report` 返回 404。页面没有把这些状态转成教师可执行的交付工作流。

## 5. 管理员用户治理

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 11 | `/admin/users` 默认 | `11-admin-users-default.png` | 用户页显示 298 个账号、模板下载和批量导入入口。 |
| 12 | 下载模板 | `12-admin-users-after-template-download.png` | 浏览器下载 `users-template.xlsx`，页面没有可见成功状态。 |
| 13 | 批量导入入口 | `13-admin-users-after-import-entry.png` | 点击批量导入未触发 file chooser，也没有导入准备状态。 |
| 14 | 无匹配搜索 | `14-admin-users-after-no-match-search.png` | 页面显示 0 条结果，API 也返回 total 0。 |
| 15 | 角色筛选 | `15-admin-users-after-role-filter.png` | 教师角色 API 返回 total 4，但连续筛选后的 UI 仍显示 0 条。 |
| 22 | 移动用户页 | `22-mobile-admin-users-default.png` | 移动上下文宽度变成 945px，用户表格仍按桌面密度呈现。 |
| 23 | 移动导入入口 | `23-mobile-admin-users-after-import-entry.png` | 移动端点击批量导入同样没有 file chooser。 |
| 24 | 移动筛选动作 | `24-mobile-admin-users-after-filter-action.png` | 移动筛选后仍是超宽长表格，缺少移动治理动作区。 |

管理员模板下载本批首次捕获到真实下载事件，但下载后的状态机、导入 file chooser、移动表格和连续筛选一致性仍未闭环。

## 6. 主要问题

### 310. P1：任务启动没有带出完成和作品集回写合同

`/missions` 启动后进入 `/simulations/destroyer?mission=...`，但仿真页首屏只显示通用 Destroyer 仿真控制面板。任务标题、目标、完成标准、成绩回写和当前任务状态都没有保留。

建议：仿真页识别 `mission` 参数后展示任务条、目标清单、完成状态、提交/回写规则和失败恢复入口。

### 311. P1：作品集空态缺少收录规则和可执行动作

作品集分类可见，但课堂作品空态只提供“进入互动课程”，未找到作品级查看、收录、生成、继续或证据来源动作。

建议：作品集每个分类都应说明收录来源、满足条件、最近候选证据和可执行下一步；空态不应只给泛化入口。

### 312. P2：作品集与证据 API 真源不对齐

`/api/learning-evidence?limit=10` 返回 404，说明作品集回流不能依赖该路径作为统一证据真源；作品集、学生证据和任务回写之间仍缺清晰数据合同。

建议：明确作品集读取的资源和 evidence API，避免页面、任务和报告各自读取不同真源。

### 313. P1：评分工作台空态没有真实来源路径

`/teacher/grading-workbench` 只提示没有打开草稿，但不提供去提交列表、打开最近草稿、导入学生文档或回到报告账本等来源路径。

建议：空态直接列出可进入的提交来源、最近草稿、待审批数量和坏 run 错误原因。

### 314. P1：坏评分运行标识恢复路径错误

`gradingRunId=missing-grading-run` 后点击恢复类动作落到首页 `/`，而不是教师工作台、证据列表或报告账本。用户从错误状态被带离教师任务上下文。

建议：坏 run 状态应保持在评分工作台内，给出“评分草稿不存在”，并提供返回提交列表、刷新草稿和联系管理员的动作。

### 315. P1：报告 API 可用但 UI 未承接交付状态

控制校正教师报告 API 返回 200，并包含 143 人班级报告和 export 数据；助教效果报告对当前班级返回 404。评分工作台没有展示报告可用、不可用、导出、发送或写回状态。

建议：教师端把报告 API 状态接入工作台或报告账本，区分可导出报告、无报告原因和待补救动作。

### 316. P1：管理员批量导入入口不能进入文件选择或预览

桌面和移动 `/admin/users` 点击“批量导入”均记录为 `clicked-no-filechooser`，页面也没有打开导入模态、预览或错误状态。

建议：批量导入应形成明确状态机：选择文件、解析预览、失败行下载、确认提交、完成通知、撤销和批次审计。

### 317. P2：模板下载成功但没有页面状态

浏览器捕获到 `users-template.xlsx` 下载事件，但页面没有下载中、下载成功、失败重试或文件名提示。读屏状态同样为空。

建议：下载动作完成后保留页面内状态，并通过 `role=status` 或 `aria-live` 播报。

### 318. P1：用户搜索和角色筛选连续状态不一致

无匹配搜索 API 返回 `total:0`；教师角色 API 返回 `total:4`，但连续筛选后的 UI 仍显示 0 条，页面没有说明当前是组合条件还是未刷新。

建议：筛选栏应显示当前条件 chips、清空搜索入口、组合条件说明和结果计数，并让 UI 与 API 结果一致。

### 319. P1：移动管理员用户页仍存在 945px 横向布局，且动作状态缺少 alert/live

移动 `/admin/users` 三个状态在 390px viewport 下均导出为 945px 文档宽度，账号表格和操作区继续撑宽页面，批量导入也无移动状态。同时 24 个 DOM/a11y JSON 均为 `alerts=0`，任务筛选、任务启动、作品集分类、评分动作、坏 run 恢复、模板下载、导入入口、搜索和移动筛选都没有读屏状态播报。

建议：移动端改为账号卡片、固定批量导入/新建/筛选动作区和分段分页，避免表格撑开页面；同时建立共享状态播报合同，覆盖筛选、启动、下载、导入、错误恢复、空态和移动端关键动作。

## 7. 后续审计输入

- 继续补采自适应练习 demo 完成态、Prompt 自动演示页和学生画像下一步动作，避免与本批任务大厅/作品集证据混淆。
- 继续补教师控制校正报告 UI 交付入口、助手效果报告生成条件和评分草稿来源列表。
- 继续补管理员导入向导真实 file chooser、失败行预览、通知/撤销和移动账号治理卡片布局。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 316 已关闭：批量导入入口使用命名文件输入，导入先预览再确认提交，并展示批次、成功/失败统计、失败行下载和审计记录。
- 318 已关闭：用户页初始查询与 API 过滤合同一致；搜索、角色、分页和导出均复用当前筛选集。
