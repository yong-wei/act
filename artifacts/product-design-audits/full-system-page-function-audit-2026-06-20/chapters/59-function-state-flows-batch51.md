# 功能状态流续篇（五十一）：交付、批量、治理与完成态回归

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch51-manifest.json`
- 截图目录：`../screenshots/87-function-state-flows-batch51-delivery-batch-governance-completion/`
- 采集脚本：`../scripts/capture-batch51.mjs`
- 采集时间：2026-06-21
- 本批覆盖：学生任务/证据/成长/作品集完成态，教师报告交付/学生证据/评分/课前包，管理员用户批量导入/搜索/配置/治理处置，以及 320px/390px 移动回归。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 35 |
| DOM/a11y JSON | 35 |
| 路由响应 | 21 |
| API 检查 | 13 |
| 动作探测 | 21 |
| 下载事件 | 1 |
| 硬错误 | 0 |
| 忽略错误 | 5 |

`admin users template download batch51` 真实触发 `users-template.xlsx`。所有 35 个 DOM/a11y JSON 的 `alerts` 仍为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 学生任务 | `/missions?source=batch51&status=active` | 200，任务大厅显示 7 个任务、5 个已完成、完成率 71%。 |
| 学生证据 | `/profile/evidence?status=completed&source=batch51` | 200，但 `status=completed` 未改变筛选，仍显示失败/成功混合证据。 |
| 学生成长 | `/profile/growth?source=batch51&focus=completion` | 200，下一步建议可见，但动作后仍停留成长中枢。 |
| 学生作品集 | `/profile/portfolio?category=coursework&source=batch51` | 200，课堂作品仍为空，动作后无收录/提交状态。 |
| 教师首页 | `/teacher?source=batch51&surface=report-delivery` | 200，报告/证据入口动作后仍停留教师首页。 |
| 班级详情 | `/teacher/classes/{classId}?source=batch51&surface=delivery` | 200，高 15,783px，交付动作仍停留详情长页。 |
| 学生画像 | `/teacher/classes/{classId}/students/{studentId}?source=batch51` | 200，推荐动作和证据摘要可见，但无补强任务创建。 |
| 学生证据 | `/teacher/classes/{classId}/students/{studentId}/evidence?source=batch51&status=completed` | 200，证据卡只提供“留在学生证据审核”。 |
| 评分工作台 | `/teacher/grading-workbench?classId={classId}&source=batch51&status=ready` | 200，仍显示“当前没有打开的文档评分草稿”。 |
| 课前包 | `/teacher/prep-packs?classId={classId}&source=batch51` | 500，仍为 Next error 页。 |
| 管理员用户 | `/admin/users?source=batch51` | 200，模板下载成功；批量导入未触发 file chooser。 |
| 用户无匹配 | `/admin/users?q=zzzz-batch51-no-match` | URL 初始态仍显示 298 用户；填入可见搜索框后页面列表变为 0 条，但 API 仍返回 `total:298`。 |
| 管理员配置 | `/admin/config?source=batch51` | 200，动作后显示“已重置为默认配置”，无影响范围/审计。 |
| 治理处置 | `/admin/data-governance?tab=risks&action=resolve&source=batch51` | 桌面采集可停留 loading；移动采集显示 170 风险但无处置动作。 |
| 教案搜索 | `/admin/lesson-plans?q=zzzz-batch51-no-match` | 200，仍显示全量长列表；页面没有搜索输入可填。 |

API 关键结果：

- `/api/missions` 返回任务列表。
- `/api/student/evidence` 返回 7 条 evidence items。
- `/api/student/growth-records` 返回 `total:1`。
- `/api/student/recommendations` 返回 `total:2`。
- `/api/teacher/document-grading/submissions?classId=...` 返回 405。
- `/api/teacher/document-grading/writeback-preview` 返回 405。
- `/api/teacher/classes/{classId}/control-correction-report?export=true` 返回 200。
- `/api/admin/users?q=zzzz-batch51-no-match&page=1&pageSize=5` 返回 `total:298`。
- `/api/admin/users/template` 返回 200 XLSX。
- `/api/admin/data-governance/status` 返回 `healthy`。

## 4. 主要问题

### 346. P1：学生任务完成态仍不能形成学习回流

任务大厅显示 5/7 已完成和“再次挑战”，动作后仍停留在任务列表；没有把完成任务转入证据、作品集收录、下一步建议或新任务目标。

建议：任务卡的已完成、再次挑战和未完成状态应写明下一步合同，并在动作后显示任务结果、证据引用、作品集收录和推荐任务更新。

### 347. P1：学生证据完成筛选不生效

`status=completed` 页面仍展示失败/成功混合证据；点击复盘/补练类动作仍停留列表，没有进入题目级复盘或补练路径。

建议：结果筛选应与 URL、控件状态和列表内容一致；证据动作应打开题目复盘、补练或教师反馈流。

### 348. P1：成长中枢下一步建议没有行动落点

页面有“提升参数设计能力”“巩固基础能力”等建议，动作后仍停留成长页，没有携带能力维度、证据 id 或推荐 id 进入练习、路径或任务。

建议：下一步建议需要稳定 actionUrl 和完成/失败状态，不能只作为静态卡片。

### 349. P1：作品集课堂作品仍缺收录状态机

`category=coursework` 页面显示“暂无课堂作品”，动作后仍没有创建、收录、提交、反思或回到来源课堂/证据的状态。

建议：作品集空态应说明可收录来源，提供导入证据、撰写反思、提交草稿和查看收录规则。

### 350. P1：教师报告交付入口仍停留在列表和长页

教师首页与班级详情的报告/证据/交付动作仍停留当前页；班级详情高 15,783px，交付相关动作没有进入报告锁定、导出、发送、学生分派或补强任务。

建议：报告入口应成为明确的交付工作流，而不是长页中的普通文本或泛化导航。

### 351. P1：教师学生画像推荐动作不能创建补强任务

学生画像显示低风险、待提升点和多个推荐动作，但点击后不创建补强任务、不锁定证据、不回写教师报告。

建议：推荐动作需要连接到任务创建、证据选择、学生通知和回到班级报告的闭环。

### 352. P1：教师学生证据审核仍只有停留动作

证据页能显示真实学生和证据质量标签，但卡片动作仍为“留在学生证据审核”，没有采用、驳回、补强、注释、分派或返回报告账本。

建议：证据审核要有明确处理状态和来源任务，尤其是从报告或班级画像进入时。

### 353. P1：评分 API 与评分工作台仍断开

评分工作台带 `classId/source/status` 仍显示无草稿；两个文档评分 API 的 GET 返回 405，页面没有解释“需要从哪里打开草稿”或提供候选提交。

建议：评分工作台应读取来源参数并展示候选材料；API 不支持 GET 时，页面需要产品化空态和正确入口。

整改记录：`audit-remediation-teacher-evidence-intervention-closure` 已把教师报告、学生画像推荐、学生证据审核和评分工作台的后续动作统一为 intervention action，记录来源证据、学生侧目标、写回状态和恢复动作；证据见 `../remediation/audit-remediation-teacher-evidence-intervention-closure/evidence.md`。

### 354. P1：管理员用户无匹配搜索口径仍不一致

`/admin/users?source=batch51&q=zzzz-batch51-no-match` 初始态仍显示 298 用户；填入可见搜索框后页面列表变为 0 条，但 `/api/admin/users?q=zzzz-batch51-no-match&page=1&pageSize=5` 仍返回 `total:298`。此前 Batch48 曾观察到 API no-match 改善，本批说明 URL、页面筛选和 API 结果没有共享同一合同。

建议：搜索口径必须在 API、统计卡和列表间一致，无匹配时显示 0 结果、清除筛选和状态播报。

### 355. P1：管理员批量导入仍没有导入状态机

模板下载成功，但批量导入点击没有 file chooser；页面也没有预览、失败行导出、通知、撤销、批次 ID 或审计入口。

建议：批量导入需要从选择文件到预览、确认、失败修复、批次审计和撤销的完整状态机。

### 356. P1：管理员配置动作缺影响范围和审计

点击配置动作后显示“已重置为默认配置”，但没有 diff、影响服务、保存/重置确认、回滚或审计记录；所有状态也缺少 alert/live。

建议：配置页的保存、重置、模型测试应显示影响范围、结果状态、错误恢复和审计 id。

### 357. P1：治理处置 query 不形成处置流

`tab=risks&action=resolve` 在桌面可停留 loading；移动能显示 170 个风险，但没有处置、分派、证据、导出、撤销或完成状态。

建议：治理 URL 应能直达风险处置上下文；加载、处置、撤销和导出都需要明确状态。

### 358. P2：管理员教案搜索缺输入与无匹配状态

`/admin/lesson-plans?q=zzzz-batch51-no-match` 仍显示 7,350px 长列表，脚本未找到搜索输入可填。

建议：管理员教案页需要搜索/分页/无匹配空态，避免长列表成为唯一导航。

### 359. P2：移动管理页继续横向溢出

320px 管理员用户页实际宽 945px；320px 管理员治理页实际宽 568px。配置页保持 320px，但高度 4,119px，缺固定操作区。

建议：管理员用户表、治理风险表和配置表单应按窄屏拆成任务卡片，并保留固定主动作和返回位置。

### 360. P2：第 51 批 35 个状态仍全部缺少 alert/live

35 个 DOM/a11y JSON 均没有捕获到 `alert`。任务启动、证据筛选、报告交付、评分空态、模板下载、导入失败、配置重置、治理加载和移动宽度变化均缺少可读状态播报。

建议：统一 status/live 合同需要覆盖完成态、批量导入、报告交付、配置变更、治理处置和移动布局变化。

## 5. 下一批输入

下一批应继续沿着“状态机不是静态页面”的主线，优先补真实动作后的后置状态：任务启动后的任务/证据写回、教师报告交付的版本锁定/发送/补强、评分工作台的来源草稿、管理员批量导入的文件选择与批次审计、治理风险的处置/撤销/导出，以及 320px 管理端修复后的回归。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 355 已关闭：用户导入返回预览、批次、失败行和审计记录，页面展示批次结果、确认导入和失败行下载；自动回滚延期到持久批次存储。
- 356 已关闭：配置页识别 `provider/model/action=test`，并显示缺失对象、成功、失败和恢复状态。
- 357 已关闭：治理 `action/riskId` 深链形成对象化处置状态，不再被通用治理页吞掉。

## #617 移动与可访问性整改记录（2026-06-21）

整改变更：`audit-remediation-mobile-a11y-shell`。证据：`../remediation/audit-remediation-mobile-a11y-shell/evidence.md`。

- 359 部分关闭：管理员用户页和管理员治理页均通过 320px/390px DOM width 与截图验收；配置页移动固定操作区不在本变更关闭范围。
- 360 部分关闭：管理员用户/治理、教师报告/班级详情、全局浮动工具和 Global AI 侧栏补充状态播报或键盘 a11y 证据；任务启动、证据筛选、配置重置和治理处置完整状态机仍由对应变更关闭。
