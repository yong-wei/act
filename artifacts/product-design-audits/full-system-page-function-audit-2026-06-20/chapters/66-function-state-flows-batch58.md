# 功能状态流续篇（五十八）：动作闭环与状态播报追踪

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch58-manifest.json`
- 截图目录：`../screenshots/94-function-state-flows-batch58-action-closure-a11y/`
- 采集脚本：`../scripts/capture-batch58.mjs`
- 采集时间：2026-06-21
- 本批覆盖：学生报告反馈采用/写回、任务大厅和作品集回流，教师报告 PDF 下载/缺失学生发送、评分审批、班级学生 no-match 添加，管理员用户 no-match 重置/导出、治理缺失 risk 分派/XLSX 导出、配置已知 provider 下缺失 model 测试，以及 320px/390px 移动端同态状态。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 33 |
| DOM/a11y JSON | 33 |
| 路由响应 | 20 |
| API 检查 | 9 |
| 动作探测 | 19 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 5 |

5 条 ignoredErrors 均为 Playwright context close 超时；未发现硬错误。所有 33 个 DOM/a11y JSON 的 `alerts` 均为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 报告反馈采用/写回 | `/assessment/document-feedback?...&status=returned&action=adopt`、`status=completed&action=writeback` | 200；两者仍是报告反馈页，动作后仍停留原页，没有采用、完成、写回或教师可见状态。 |
| 学习证据 API | `/api/learning-evidence?assignment=...&status=returned` | 404 HTML；页面没有结构化证据结果或 API 不可用说明。 |
| 任务大厅 feedback returnTo | `/missions?q=report-control-design&status=completed&returnTo=/assessment/document-feedback` | 200；仍显示完整任务大厅，未找到可见搜索输入；API `/api/missions?...` 返回完整 missions 列表而不是 report-control-design no-match。 |
| 作品集反馈收录 | `/profile/portfolio?assignment=...&intent=collect&status=completed` | 200；仍是普通“我的学习档案”，动作后没有收录草稿、候选证据或反馈来源。 |
| 教师报告下载/发送 | `action=download&format=pdf`、`action=send&studentId=missing-batch58` | 200；下载没有 download event；缺失学生发送动作后跳到公开首页 `/`。 |
| 评分审批缺失 run | `/teacher/grading-workbench?...&gradingRunId=missing-batch58&action=approve` | 200；页面仍显示评分工作台空态，动作后跳到公开首页；submissions GET 返回 405，writeback POST 返回 404 HTML。 |
| 教师班级学生直达 | `/teacher/classes/.../students?q=zzzz...&action=add` | 页面 404；但 `/api/teacher/classes/.../students?q=zzzz...` 返回真实学生数组，UI/API 路由合同不一致。 |
| 管理员用户重置/导出 | `role=STUDENT&q=...&page=2&action=reset`、`role=TEACHER&q=...&action=export` | 页面仍显示真实用户；API 分别返回 `total:293` 和 `total:4`；导出点击无 download event。 |
| 管理员治理分派/导出 | `action=assign&riskId=missing...&assignee=missing-teacher`、`action=export&format=xlsx` | 缺失 risk/assignee 没有对象恢复；XLSX 导出没有 download event。 |
| 管理员配置缺失 model | `provider=SiliconFlow&model=missing-batch58&action=test` | 200；仍显示通用系统配置和真实模型列表，动作后无缺失 model 错误或测试结果。 |

## 4. 主要问题

### 432. P1：报告反馈采用和写回动作不改变状态

`status=returned&action=adopt` 与 `status=completed&action=writeback` 都只显示同一报告反馈页，点击采用/完成/写回类动作后仍停留原页。页面没有 adopted、completed、written-back、teacher-visible 或 next-action 状态。

建议：报告反馈页应建立反馈生命周期：已返回、已读、已采用、已完成、已写回、教师可见，并为每一步提供完成/失败播报。

### 433. P1：任务大厅不承接反馈任务查询和 returnTo

`/missions?q=report-control-design&status=completed&returnTo=/assessment/document-feedback` 仍显示普通任务大厅，未找到可见搜索输入；API 返回完整 missions 列表，不按 report-control-design 过滤，也没有返回反馈页路径。

建议：任务大厅应解析 q/status/returnTo，显示目标任务、无结果原因、返回反馈页和完成回写规则。

### 434. P1：作品集反馈收录没有形成候选证据或草稿

作品集 `assignment=report-control-design&intent=collect&status=completed` 仍是普通“我的学习档案”，动作后没有收录草稿、候选证据、反馈来源或保存结果。

建议：作品集收录应把反馈 assignment 转换为候选证据清单，显示可收录项、反思草稿、保存状态和回到报告反馈的路径。

### 435. P1：教师报告 PDF 下载仍没有真实下载事件

`action=download&format=pdf` 呈现 13,192px 班级分析页，点击下载/导出/报告类动作后没有 download event，也没有下载失败、文件名或完成反馈。

建议：报告下载应有明确文件格式、范围、版本、下载事件、失败状态和审计记录。

整改记录：`audit-remediation-teacher-report-grading` 已在 `analytics-v2` 接入控制校正报告导出 API，提供 JSON 下载、文件名、成功/失败状态和固定交付动作区；证据见 `../remediation/audit-remediation-teacher-report-grading/evidence.md`。

### 436. P1：教师报告发送缺失学生时会跳公开首页

`action=send&studentId=missing-batch58` 不显示学生不存在或权限说明；点击发送/交付类动作后跳到公开首页 `/`，教师上下文丢失。

建议：发送报告前必须校验学生对象，缺失时留在教师工作区并提供返回报告、选择学生和查看权限的恢复路径。

整改记录：`audit-remediation-teacher-report-grading` 已将缺失学生交付映射为教师工作区内的 `blocked` / `404` 状态，并限制 `returnTo` 留在 `/teacher` 范围；证据见 `../remediation/audit-remediation-teacher-report-grading/evidence.md`。

### 437. P1：评分审批缺失 run 的 UI、GET 和 POST 边界都不成立

评分工作台带 `gradingRunId=missing-batch58&action=approve` 仍显示空态，审批动作后跳公开首页；submissions GET 返回 405，writeback POST 返回 404 HTML。UI 没有说明评分运行不存在、方法不支持或审批需要的字段。

建议：评分审批应把缺失 run、未支持方法和无效写回分别产品化，并保留教师上下文。

整改记录：`audit-remediation-teacher-report-grading` 已在评分工作台空态、demo 态和真实工作台中渲染缺失 run、GET 方法边界、审批/写回缺字段和草稿等待状态；证据见 `../remediation/audit-remediation-teacher-report-grading/evidence.md`。

### 438. P1：教师班级学生直达页 404，但 API no-match 返回真实学生

`/teacher/classes/.../students` 页面返回 404，添加学生动作不可用；同一 q 的 API 却返回真实学生数组，说明教师学生管理的页面路由、搜索和 API 过滤合同不一致。

建议：为班级学生管理提供真实页面或正确入口，并让搜索 API 按 q 返回 no-match。

### 439. P1：管理员用户重置/导出动作继续忽略 q

学生 no-match page 2 API 返回 `total:293`，教师 no-match page 2 返回 `total:4`；页面仍显示真实用户，重置/导出动作无可理解状态，导出无 download event。

建议：q、role、page、reset、export 必须共享过滤合同，导出应以当前筛选集为范围并提供文件反馈。

### 440. P1：治理分派缺失对象和 XLSX 导出没有闭环

缺失 riskId/assignee 的分派仍是泛化治理页；`format=xlsx` 导出没有 download event 或完成/失败状态。

建议：治理动作应校验 risk 与 assignee，缺失时给恢复；导出应支持格式、文件名、下载状态和审计日志。

### 441. P1：已知 provider 下缺失 model 测试仍被通用配置页吞掉

`provider=SiliconFlow&model=missing-batch58&action=test` 仍显示真实模型列表，没有缺失 model、测试失败、响应延迟、配置建议或审计记录。

建议：配置模型测试应在已知 provider 下校验 model id，并给出缺失对象或测试结果。

### 442. P2：第 58 批 33 个动作闭环状态仍全部缺少 alert/live

33 个 DOM/a11y JSON 均没有捕获到 `alert`。采用、写回、任务查询、作品集收录、下载、发送、审批、重置、导出、分派和模型测试都没有可读状态播报。

建议：把所有动作闭环接入统一 status/live 合同，尤其是下载、发送、审批、筛选和配置测试。

整改记录：`audit-remediation-action-status-contract` 已建立统一状态面板；`audit-remediation-teacher-report-grading` 已把教师报告下载/发送和评分审批接入该面板。学生反馈、作品集、管理员治理和配置测试仍由后续垂直变更关闭。

## 5. 下一批输入

下一批应继续补两条线：一是对教师/管理员长列表和报表的移动端可操作性做更细采样，包括卡片替代表格、分页、导出和错误恢复；二是对学生反馈任务的真实可执行入口做纵向追踪，覆盖任务创建、完成、证据回写、作品集收录和教师可见状态。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 439 已关闭：用户重置/导出深链不再忽略筛选；导出按钮使用当前 `q/role` 过滤并通过服务端导出完整筛选集 CSV。
- 440 已关闭：治理分派校验缺失 risk/assignee，真实分派写入风险审计；治理导出提供 JSON/CSV/XLSX 文件名、下载入口和审计摘要。
- 441 已关闭：已知 provider 下缺失 model 显示 blocked 模型测试状态和恢复动作。

## #619 学生反馈闭环整改记录（2026-06-22）

整改变更：`audit-remediation-student-learning-closure`。证据：`../remediation/audit-remediation-student-learning-closure/evidence.md`。

- 432 已关闭：报告反馈页将 `action=adopt`、`intent=revise` 和 completed 状态映射为 adopted、revising、completed 等可见状态；`action=writeback` 只进入待写回，只有 `status=written-back/teacher-visible` 才展示成功。
- 433 已关闭：任务大厅页面/API 解析反馈 assignment/status/returnTo，并通过显式 assignment→mission order 映射收敛 PID 补强任务和返回路径。
- 434 已关闭：作品集收录入口生成反馈候选草稿，显示来源、候选状态和返回报告反馈路径。
- 442 的学生反馈任务状态部分已关闭：学生反馈目标页统一接入动作状态面板；教师、管理员和统计导出状态继续按对应变更跟踪。

## #749 教师证据处置闭环整改记录（2026-06-30）

整改变更：`audit-remediation-teacher-evidence-intervention-closure`。证据：`../remediation/audit-remediation-teacher-evidence-intervention-closure/evidence.md`。

- 435、436、437 的后续处置部分已关闭：教师报告、缺失学生发送和评分审批现在生成统一 intervention action，保留来源证据、上下文、学生侧目标和恢复动作。
- 442 的教师处置状态部分已关闭：教师报告和学生证据页输出结构化 action status，并在学生反馈任务中携带 `teacherInterventionId`；管理员和统计导出状态仍由对应变更跟踪。
