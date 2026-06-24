# 功能状态流续篇（五十五）：后续入口目标页与参数化动作回归

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch55-manifest.json`
- 截图目录：`../screenshots/91-function-state-flows-batch55-follow-up-targets/`
- 采集脚本：`../scripts/capture-batch55.mjs`
- 采集时间：2026-06-21
- 本批覆盖：报告反馈后续入口目标页、Prompt 真实历史模式、AI 工坊报告任务、Copilot 作品集反思、作品集反思创建意图，教师报告账本/补强/学生证据/评分工作台参数化深链，管理员治理 assign/resolve/export 带对象参数、配置 audit/model-test 参数，以及 320px/390px 移动端目标页。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 39 |
| DOM/a11y JSON | 39 |
| 路由响应 | 25 |
| API 检查 | 7 |
| 动作探测 | 23 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 5 |

5 条 ignoredErrors 均为 Playwright context close 超时；未发现硬错误。所有 39 个 DOM/a11y JSON 的 `alerts` 均为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 报告反馈目标页 | `/profile/evidence?assignment=report-control-design&criterion=model-assumptions&source=batch55` | 200；进入“学习证据”，但没有把 assignment/criterion 转成报告反馈落点、证据高亮或已采用状态；移动端高 4,279px。 |
| 报告反馈练习目标 | `/assessment/adaptive-practice?assignment=...` 与 `intent=practice` | 200；两者都进入“自适应学习路径中心”，没有区分报告反馈、练习意图或指标补强；`/api/learning-paths/latest?goal=control-correction` 仍返回 `path: null`。 |
| 报告反馈资源目标 | `/interactive-learning/resources/lesson09-correction-precheck?assignment=...` | 200；进入“校正前测”资源页，但未显示报告反馈来源、criterion 或完成后写回规则。 |
| Prompt 历史真实模式 | `/evaluation/prompt-assessment?autodemo=0&mode=history` | 200；动作仍填入 `global-ai-sidebar-input`，动作后同时出现 success/loading 信号；`/api/evaluation/prompt-history/demo` 仍为 `history: []`、`total: 0`。 |
| AI 报告任务 | `/ai?task=report-feedback&source=batch55` | 200；动作仍填入全局 AI 输入框，页面不形成三条练习任务或报告反馈回写状态。 |
| Copilot 反思 | `/ai/copilot?context=portfolio-reflection&source=batch55` | 200；动作后仍有 loading 信号，未形成作品集反思草稿或保存入口。 |
| 作品集反思创建 | `/profile/portfolio?category=reflection&intent=create&source=batch55` | 200；动作后仍停留同一路由，未出现草稿、保存、AI 协作记录或创建完成状态。 |
| 教师报告参数化深链 | `analytics-v2?surface=report-ledger&report=...`、`surface=remediation&cluster=...`、`surface=student-evidence&studentId=...` | 200；三者均仍是同一个 13,192px 班级分析页；动作后均跳到公开首页 `/`。 |
| 教师评分参数化深链 | `grading-workbench?assignment=...&status=ready`、`gradingRunId=missing-batch55&classId=...` | 200；均显示评分工作台但无草稿，动作后跳到 `/`；document grading submissions 带 assignment 的 GET 仍返回 405。 |
| 管理员治理参数化动作 | `action=assign/resolve&riskId=missing-batch55`、`tab=evidence-source&action=export` | 200；assign 默认和动作后仍 loading；resolve 动作后回到泛化看板；export 没有 download event。 |
| 管理员配置参数化动作 | `focus=audit&changed=ai-provider`、`focus=model-test&provider=missing-batch55` | 200；页面仍是通用系统配置，动作后无 diff、影响范围、缺失 provider 错误或审计记录。 |

API 关键结果：

- `/api/learning-evidence?assignment=report-control-design&criterion=model-assumptions&limit=5` 返回 404 HTML。
- `/api/learning-paths/latest?goal=control-correction` 返回 200，`path: null`。
- `/api/evaluation/prompt-history/demo` 返回 200，`history: []`、`total: 0`。
- `/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics` 返回 200。
- `/api/teacher/document-grading/submissions?classId=...&assignment=report-control-design` 返回 405。
- `/api/admin/data-governance/status` 返回 200，状态 healthy。
- `/api/admin/users?q=zzzz-batch55-no-match&page=1&pageSize=5` 返回 200，`total: 298`，仍包含真实用户样本。

## 4. 主要问题

### 395. P1：报告反馈证据目标页不承接 assignment/criterion

报告反馈页的“查看学情画像”目标能打开 `/profile/evidence?assignment=report-control-design&criterion=model-assumptions`，但页面仍是泛化学习证据；`/api/learning-evidence?assignment=...` 返回 404 HTML。用户无法看到该报告、该量规项或采用状态。

建议：证据目标页应解析 assignment/criterion，突出报告反馈来源、关联证据、当前处理状态和写回动作；API 不存在时应给产品化错误，而不是让页面与 API 语义分裂。

### 396. P1：报告反馈练习目标不区分自适应入口和补强练习

普通 adaptive target 与 `intent=practice` target 都进入同一个自适应学习路径中心，且真实 latest path 仍为 `path:null`。页面没有说明这是报告反馈带来的练习建议，也没有创建指标补强任务。

建议：报告反馈练习目标应展示 criterion、目标能力、推荐练习、完成条件和写回规则；空路径时不能伪装成已有路径。

### 397. P1：报告反馈资源目标缺来源和完成后写回

资源目标能打开“校正前测”，但没有显示来自报告反馈的 assignment/criterion，也没有完成后回写报告反馈、证据链或作品集的状态。

建议：资源页需要接受报告反馈来源参数，在页首显示目标和完成后去向，并在完成后写回对应报告项。

### 398. P1：Prompt 真实历史模式仍由全局 AI 输入驱动

`autodemo=0&mode=history` 下可见输入仍命中 `global-ai-sidebar-input`；动作后页面同时出现 success/loading 信号，Prompt 历史 API 仍为空。真实历史模式没有形成真正的提示词版本保存流程。

建议：Prompt 页应提供页面自有输入、版本保存、评价完成和历史空态；全局 AI 侧栏不能替代任务表单。

整改记录：`audit-remediation-ai-task-boundaries` 已为 Prompt 页建立页面自有输入和状态合同，包含主输入标识、任务模式、评价状态、停止/重试和结果清空动作；证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 399. P1：AI 报告任务不能生成练习任务或写回报告反馈

`/ai?task=report-feedback` 动作仍填入全局 AI 输入框，页面没有生成三条练习任务、引用报告反馈、采用/丢弃或写回学习证据。

建议：AI 工坊任务模式应把 task 参数转成结构化任务卡，生成结果必须有采用、编辑、保存和回写动作。

整改记录：`audit-remediation-ai-task-boundaries` 已将 `/ai?task=report-feedback` 的 task 参数转成结构化任务候选，并提供采用、丢弃和标记待写回状态；当前不声明已持久化写回，证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 400. P1：Copilot 反思上下文不生成作品集草稿

`context=portfolio-reflection` 提问后仍呈 loading 信号，没有出现反思草稿、保存入口、来源说明或作品集记录。

建议：反思上下文下 Copilot 的输出应直接进入作品集草稿，带来源、编辑、保存和撤销状态。

整改记录：`audit-remediation-ai-task-boundaries` 已为 `context=portfolio-reflection` 生成作品集反思草稿候选，并提供进入作品集候选预览路径；证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 401. P1：作品集反思 create 意图不创建对象

`/profile/portfolio?category=reflection&intent=create` 动作后仍停留同一路由，没有草稿、表单、保存状态或 AI 协作记录。

建议：create intent 应进入明确的创建工作流，至少显示草稿标题、正文、来源证据、保存/取消和完成状态。

整改记录：`audit-remediation-ai-task-boundaries` 已让作品集 `category=reflection&intent=create` 显示反思草稿候选、来源和候选状态，并提供返回反思页/重新生成候选路径；当前不声明已保存到学习档案，证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 402. P1：教师报告参数化深链仍是同一长分析页且动作跳首页

`surface=report-ledger&report=...`、`surface=remediation&cluster=...`、`surface=student-evidence&studentId=...` 均渲染同一个 13,192px 班级分析页；动作探测后全部跳到公开首页 `/`。

建议：教师分析页应把 surface/report/cluster/studentId 解析成对应工作区，动作失败也必须留在教师上下文。

### 403. P1：评分工作台参数化来源仍无草稿且动作跳首页

带 assignment 的 ready 工作台和带 missing gradingRunId 的工作台都没有形成草稿列表、缺失对象错误或恢复路径；动作后跳到 `/`，document grading GET 仍返回 405。

建议：评分工作台需要按 classId/assignment/gradingRunId 解析来源，给出草稿、缺失对象、可恢复动作和 API 方法边界。

### 404. P1：治理 riskId 和 export 参数不形成分派、处置或下载

`action=assign&riskId=missing-batch55` 默认和动作后都停在 loading；`action=resolve` 动作后回泛化看板；`action=export` 没有 download event。风险对象参数和导出意图没有产品状态。

建议：治理页应解析 riskId，区分对象不存在、可分派、可处置和可导出；导出必须有下载事件、失败提示和完成状态。

### 405. P1：配置 audit/model-test 参数被通用配置页吞掉

`focus=audit&changed=ai-provider` 与 `focus=model-test&provider=missing-batch55` 都打开通用系统配置，动作后没有 diff、影响范围、缺失 provider 错误、模型测试结果或审计记录。

建议：配置页应解析 focus/changed/provider 参数，形成审计工作区和模型测试错误状态。

### 406. P2：移动目标页仍由长页承接关键任务

390px 学生反馈证据目标高 4,279px；390px 教师补强 cluster 页高 14,128px；320px 管理员配置审计页高 4,119px。移动端仍缺固定主动作区和目标摘要。

建议：移动目标页应先显示当前对象、来源、状态和主动作，再展开详情列表。

### 407. P2：第 55 批 39 个状态仍全部缺少 alert/live

39 个 DOM/a11y JSON 均没有捕获到 `alert`。目标页跳转、API 404、空路径、全局 AI 抢占、教师动作跳首页、治理 loading/导出、配置参数忽略和移动长流程都缺少状态播报。

建议：把参数解析、目标页落点、空态/错误、动作跳转和下载/保存完成统一纳入 status/live 合同。

## 5. 下一批输入

下一批应继续追踪 API 与 UI 语义不一致的目标页：学习证据 API 404、管理员用户 no-match API 回归到 `total=298`、document grading GET/工作台方法边界、教师分析动作跳首页、治理 loading 与风险对象参数，以及这些状态在移动端的固定主动作区。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 404 已关闭：治理 `riskId`、`assign/resolve/export` 均进入对象化动作状态；export 提供文件名与下载入口。
- 405 已关闭：配置 `audit/model-test` 参数由模型测试状态面板承接，缺失 provider/model 有明确恢复路径。

## #619 学生反馈闭环整改记录（2026-06-22）

整改变更：`audit-remediation-student-learning-closure`。证据：`../remediation/audit-remediation-student-learning-closure/evidence.md`。

- 395/396/397 的学生反馈链路已关闭：报告反馈、证据、成长、作品集、任务大厅、自适应练习、仿真任务和资源详情共用反馈任务上下文，并保留 assignment、criterion、status 和 returnTo；资源完成回到报告反馈并进入 completed/待写回状态，不伪造已持久化写回。
- 400/401 的反馈收录相关部分已关闭：作品集在 `assignment=report-control-design&intent=collect` 下生成候选草稿，避免把候选误报为已保存档案。
