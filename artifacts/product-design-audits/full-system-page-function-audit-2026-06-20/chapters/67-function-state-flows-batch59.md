# 功能状态流续篇（五十九）：最终收口与剩余状态闭环复核

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch59-manifest.json`
- 截图目录：`../screenshots/95-function-state-flows-batch59-final-closure/`
- 采集脚本：`../scripts/capture-batch59.mjs`
- 采集时间：2026-06-21
- 本批覆盖：学生报告反馈修订入口、自适应练习 returnTo、任务大厅反馈任务、证据/成长/作品集写回目标；教师移动端班级详情、长报告、评分审批、学生证据 deep link；管理员 320px 用户 no-match 导出、治理 risk resolve、配置 model test、系统统计导出；并同步检查相关 API 合同。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 26 |
| DOM/a11y JSON | 26 |
| 路由响应 | 16 |
| API 检查 | 10 |
| 动作探测 | 16 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 3 |

3 条 ignoredErrors 均为 Playwright context close 超时；未发现硬错误。所有 26 个 DOM/a11y JSON 的 `alerts` 均为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 学生反馈修订 | `/assessment/document-feedback?demo=1&assignment=report-control-design&status=returned&intent=revise` | 200；显示报告、量规得分、证据胶囊和后续入口，但点击修订/采用类动作后仍停在同一反馈页。 |
| 学生自适应 returnTo | `/assessment/adaptive-practice?intent=document-feedback&assignment=...&returnTo=/assessment/document-feedback` | 200；仍显示通用自适应路径中心；`/api/learning-paths/latest?goal=control-correction&intent=document-feedback` 返回 `path:null`。 |
| 学生任务大厅 | `/missions?assignment=report-control-design&intent=start&status=returned&returnTo=/assessment/document-feedback` | 200；没有可见搜索输入；API `/api/missions?assignment=report-control-design&status=returned` 仍返回完整 missions 列表。 |
| 学生证据与作品集 | `/profile/evidence`、`/profile/growth`、`/profile/portfolio` 带 assignment/status/returnTo | 均 200；`/api/student/evidence?assignment=report-control-design&status=completed` 返回 4 条真实证据，但页面没有报告反馈来源、写回结果或作品集收录状态。 |
| 学习证据 API | `/api/learning-evidence?assignment=report-control-design&status=completed` | 404 HTML；与学生证据 API 的真实数据形成双轨合同。 |
| 教师移动班级详情 | `/teacher/classes/...` 390px | 200；页面高度 30,040px，显示 143 人班级、治理覆盖和课堂历史；搜索动作填入的是全局“搜索教案”输入，不是班级学生搜索。 |
| 教师移动长报告 | `/teacher/classes/.../analytics-v2?action=export` 390px | 200；页面高度 14,128px；控制校正报告 API `export=true` 返回 `report` 与 `export`，但 UI 点击导出/报告无 download event。 |
| 教师评分审批 | `/teacher/grading-workbench?demo=1&status=draft&action=approve` 390px | 200；显示草稿评分工作台，点击审批/写回类动作后无完成状态；`/api/teacher/document-grading/submissions` GET 返回 405。 |
| 教师学生证据 deep link | `/teacher/students/demo/evidence?returnTo=/teacher/grading-workbench` | 路由响应 200，但最终 URL 改到 `/teacher/classes`，教师评分上下文丢失。 |
| 管理员移动用户 | `/admin/users?role=STUDENT&q=zzzz-batch59-no-match&page=2&action=export` 320px | 页面实际 `scroll.width=945`，仍显示 298 个用户与真实学生表格；API 返回 `total:293`；导出无 download event。 |
| 管理员移动治理 | `/admin/data-governance?riskId=missing-batch59&action=resolve` 320px | 页面实际 `scroll.width=568`，显示 170 个待处理风险与 3,763 分钟 stale；点击处置类动作没有对象恢复或完成状态。 |
| 管理员配置与统计 | `/admin/config?...model=missing-batch59&action=test`、`/admin/states?...focus=usage-export` 320px | 均 200；缺失模型测试仍停留通用配置页；系统统计导出无 download event。 |

## 4. 主要问题

### 443. P1：学生报告反馈仍没有修订、采用、写回状态机

反馈页已经显示评分、证据胶囊、学情影响和后续入口，但 `intent=revise`、`status=returned` 和点击修订/采用类动作后仍停留原状态。页面没有“已读、已采用、修订中、已写回、教师可见”的状态变化，也没有失败说明。

建议：报告反馈页应把评分反馈变成可执行状态机，而不是静态证据页；每个后续动作都应产生明确状态、可恢复路径和教师端可见结果。

### 444. P1：反馈任务纵向链路没有承接 assignment 与 returnTo

自适应路径、任务大厅、证据、成长和作品集目标页都能打开，但它们没有把 `assignment=report-control-design` 解释成同一条反馈任务。任务大厅 API 返回完整 missions 列表，最新学习路径返回 `path:null`，作品集仍是普通档案页。

建议：建立统一的反馈任务上下文，至少包含 assignment、criterion、origin feedback、returnTo、completion target、evidence writeback 和 portfolio collection 状态。

### 445. P1：教师移动长报告有真实数据，但交付动作仍没有 UI 闭环

教师班级详情 390px 页面高度 30,040px，班级分析页 14,128px。API 已能返回控制校正报告和 export 对象，但移动 UI 点击导出/报告没有 download event，也没有发送、锁定版本、生成摘要或固定主动作区。

建议：教师长报告移动端应提供固定交付动作区，并把 API 的 report/export 结果转为可下载、可发送、可复制摘要和可回到学生证据链的明确状态。

整改记录：`audit-remediation-teacher-report-grading` 已在班级分析页增加顶部报告交付区和底部固定动作区，并接入控制校正报告导出、摘要复制、缺失学生发送和锁定状态；证据见 `../remediation/audit-remediation-teacher-report-grading/evidence.md`。

### 446. P1：评分审批在移动端仍停留草稿页，方法边界没有产品化

评分工作台显示 draft 与评分证据，但点击审批/写回类动作后没有状态变化。关联 API GET 返回 405，页面没有解释“此处需 POST、缺字段、缺评分运行或暂不支持”。

建议：评分工作台应把草稿、审批、退回、写回、学生可见和失败恢复作为一组显式状态，并把方法不支持转成教师可理解的错误。

整改记录：`audit-remediation-teacher-report-grading` 已把 `status=draft`、`action=approve/writeback`、`method=get` 和缺失 `gradingRunId` 映射为评分工作台可见状态；证据见 `../remediation/audit-remediation-teacher-report-grading/evidence.md`。

### 447. P1：教师学生证据 deep link 会丢失评分上下文

`/teacher/students/demo/evidence?returnTo=/teacher/grading-workbench` 最终落到 `/teacher/classes`。这意味着从评分工作台进入学生证据链时，教师无法保留当前报告、学生、评分 run 或 returnTo。

建议：教师学生证据页应支持稳定 deep link；无法解析学生时应留在教师上下文并显示缺失对象，而不是静默改到班级列表。

整改记录：`audit-remediation-teacher-report-grading` 已在班级学生证据页保留 `returnTo`、`gradingRunId`、`reportId` 和 `source` 上下文，并限制返回路径留在教师域；证据见 `../remediation/audit-remediation-teacher-report-grading/evidence.md`。

### 448. P1：管理员移动用户 no-match 仍返回真实用户并横向溢出

320px 请求下页面实际宽度为 945px，`q=zzzz-batch59-no-match` 仍显示 298 个用户和真实学生表格；API 返回 `total:293`。导出点击没有下载事件。

建议：用户列表的 URL、可见搜索、角色筛选、分页和 API 必须共享过滤合同；移动端应彻底去表格化，导出应以当前筛选集为范围并有下载/失败状态。

### 449. P1：管理员治理 risk resolve 仍是只读长看板

治理页显示 170 个待处理风险、数据新鲜度 3,763 分钟前和风险清单，但 `riskId=missing-batch59&action=resolve` 没有对象错误、处置面板、完成状态或审计记录。320px 页面实际宽 568px。

建议：治理风险需要从只读看板升级为对象化工作流：定位 risk、校验权限、选择处置、保存结果、撤销/审计，并在移动端提供可操作布局。

### 450. P1：管理员配置测试和统计导出仍缺状态反馈

缺失模型测试参数被通用配置页吞掉；系统使用量统计点击导出/下载/报告类动作没有 download event。两个页面均没有测试中、测试失败、导出完成、文件名或审计记录。

建议：配置测试和统计导出应纳入统一动作状态层，区分对象不存在、请求失败、测试成功、导出成功和权限不足。

### 451. P2：最终补采的 26 个状态仍全部缺少 alert/live

本批 26 个 DOM/a11y JSON 的 `alerts` 全部为 0。报告反馈、任务启动、写回目标、长报告导出、评分审批、用户筛选导出、治理处置、配置测试和统计导出都没有可读状态播报。

建议：后续修复阶段不应逐页补零散提示，而应建立跨角色 status/live 合同，覆盖提交、筛选、导出、下载、写回、审批、配置测试和治理处置。

整改记录：教师长报告导出、发送和评分审批已接入统一动作状态面板；学生反馈、任务启动、管理员导出、治理处置、配置测试和统计导出仍由后续垂直变更关闭。

## 5. 收口结论

至本批为止，`route-inventory.md` 中 205 个 App Router 页面模板已全部纳入截图证据，功能状态流已从 Batch1 延伸到 Batch59，覆盖学生、教师、管理员、公开入口、课程运行态、Arena、仿真、AI、学习路径、报告反馈、评分、作品集、数据中心和治理后台的关键正常态、空态、错误态、移动态、动作后状态与 API/UI 合同。

本批没有再提出“下一批输入”。剩余内容已经不是审计覆盖缺口，而是可进入设计治理和实现修复的产品缺陷清单：动作状态机、API/UI 过滤合同、移动长列表布局、下载/导出事件、报告交付、评分写回、作品集收录、治理处置和全站 status/live 语义。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 448 已关闭：用户页导出按当前 no-match 筛选集生成空 CSV；移动端表格限制在表格容器内滚动，页面主体不再由表格撑宽。
- 449 已关闭：治理 risk resolve 深链进入对象化状态；缺失 risk 显示恢复动作和审计记录。
- 450 已关闭：配置测试缺失 provider/model 与统计导出均显示明确状态；统计页提供使用量 JSON 下载和审计摘要。

## #617 移动与可访问性整改记录（2026-06-21）

整改变更：`audit-remediation-mobile-a11y-shell`。证据：`../remediation/audit-remediation-mobile-a11y-shell/evidence.md`。

- 448 的移动横向溢出部分已由本变更补充关闭：管理员用户表不再只是容器横向滚动，而是在 640px 以下卡片化，并通过 320px/390px 验收。
- 449 的移动治理宽度部分已由本变更补充关闭：治理来源、课堂质量和风险表在 640px 以下卡片化，并通过 320px/390px 验收。
- 451 部分关闭：本变更拥有的浮动工具、AI 侧栏、管理员用户/治理、教师报告/班级详情均已接入 `status/live`；报告反馈、任务启动、作品集写回、配置测试和统计导出等业务状态机仍归属对应垂直变更。

## #619 学生反馈闭环整改记录（2026-06-22）

整改变更：`audit-remediation-student-learning-closure`。证据：`../remediation/audit-remediation-student-learning-closure/evidence.md`。

- 443 已关闭：报告反馈页把修订、采用、完成、待写回、已写回和教师可见纳入反馈任务状态机，并提供缺失对象恢复信息；写回成功不再由 `action=writeback` 直接伪造。
- 444 已关闭：自适应练习、任务大厅、仿真任务、互动资源、证据、成长和作品集共用 `assignment/criterion/origin/returnTo/completionTarget` 上下文，作品集使用候选草稿表达收录前状态。
- 451 的学生反馈、任务启动和作品集候选部分已关闭：相关目标页通过统一状态面板呈现当前状态和下一步；真实持久化写回、配置测试、统计导出等仍由后续垂直变更关闭。

## #749 教师证据处置闭环整改记录（2026-06-30）

整改变更：`audit-remediation-teacher-evidence-intervention-closure`。证据：`../remediation/audit-remediation-teacher-evidence-intervention-closure/evidence.md`。

- 445、446、447 的教师后续处置部分已关闭：报告交付、评分审批和教师学生证据 deep link 现在共享 intervention action，学生侧目标、幂等键、来源证据和上下文恢复可追踪。
- 451 的教师处置状态部分已关闭：教师处置结果通过结构化状态和学生反馈任务 `teacherInterventionId` 贯通；管理员配置和统计导出仍由对应变更跟踪。
