# 功能状态流续篇（五十六）：API/UI 语义不一致与恢复状态回归

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch56-manifest.json`
- 截图目录：`../screenshots/92-function-state-flows-batch56-api-ui-recovery/`
- 采集脚本：`../scripts/capture-batch56.mjs`
- 采集时间：2026-06-21
- 本批覆盖：学生报告反馈目标页的学习证据、自适应写回与资源 returnTo，教师报告交付、学生证据缺失对象与评分 GET 方法边界，管理员用户 no-match URL/可见搜索/API、治理 assign/export、配置缺失 provider 测试，以及 320px/390px 移动端目标页。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 27 |
| DOM/a11y JSON | 27 |
| 路由响应 | 19 |
| API 检查 | 8 |
| 动作探测 | 14 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 5 |

5 条 ignoredErrors 均为 Playwright context close 超时；未发现硬错误。所有 27 个 DOM/a11y JSON 的 `alerts` 均为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 学生证据 assignment 目标 | `/profile/evidence?assignment=report-control-design&criterion=model-assumptions&status=actionable` | 200；页面仍是“学习证据”，没有报告反馈目标摘要；可见搜索输入未找到；移动端高 4,279px。 |
| 学生证据缺失 assignment | `/profile/evidence?assignment=missing-batch56&criterion=missing-criterion` | 200；仍是同一学习证据页，未区分无效 assignment 与真实无结果。 |
| 学习证据 API | `/api/learning-evidence?assignment=...` | assignment actionable 与 missing assignment 两个请求均返回 404 HTML。 |
| 自适应写回目标 | `/assessment/adaptive-practice?assignment=...&intent=writeback` | 200；仍是自适应学习路径中心，`/api/learning-paths/latest?goal=control-correction` 返回 `path:null`。 |
| 资源 returnTo | `/interactive-learning/resources/lesson09-correction-precheck?...&returnTo=/assessment/document-feedback` | 200；进入“校正前测”，未显示 report feedback 来源或完成后回跳/写回。 |
| 教师报告交付 | `/teacher/classes/.../analytics-v2?surface=report-ledger&report=control-correction&action=deliver` | 200；仍是 13,192px 班级分析页，动作后仍停留同页；移动端高 14,128px。 |
| 教师缺失学生证据 | `surface=student-evidence&studentId=missing-batch56` | 200；仍是班级分析页，动作后跳到公开首页 `/`。 |
| 教师评分 GET 边界 | `/teacher/grading-workbench?...&method=get` | 200；仍无评分草稿，动作后跳到 `/`；submissions/writeback-preview GET 均返回 405。 |
| 管理员用户 no-match | `/admin/users?q=zzzz-batch56-no-match` | URL 初始页高 2,241px，可见搜索后高 1,147px；API 仍返回 `total:298`。 |
| 管理员用户角色 no-match | `/admin/users?role=TEACHER&q=zzzz-batch56-no-match` | 页面仍进入用户管理；API 返回 `total:4` 和教师样本，不是无匹配。 |
| 管理员治理 assign/export | `action=assign&riskId=missing-batch56`、`tab=evidence-source&action=export&format=csv` | assign 默认 loading，动作后泛化看板；export 无 download event。 |
| 管理员配置缺失 provider | `/admin/config?focus=model-test&provider=missing-batch56&action=test` | 200；仍是通用系统配置，动作后无缺失 provider 错误或模型测试结果。 |

## 4. 主要问题

### 408. P1：学习证据 assignment UI 与 API 同时缺目标合同

学生证据页能打开 `assignment=report-control-design&criterion=model-assumptions`，但页面不展示报告、量规项、采用状态或可执行后续动作；同参数 API 返回 404 HTML。UI 和 API 都没有形成报告反馈目标页合同。

建议：建立学习证据 assignment API，并让页面按 assignment/criterion 展示目标摘要、相关证据、采用状态、写回动作和无效参数恢复。

### 409. P1：缺失 assignment 被当作普通学习证据页

`assignment=missing-batch56&criterion=missing-criterion` 仍显示同一“学习证据”页面，没有对象不存在、权限、链接过期或返回反馈页的说明。

建议：缺失或无效 assignment 应进入产品化恢复状态，而不是与真实空结果混在一起。

### 410. P1：自适应 writeback intent 仍忽略报告反馈写回

`intent=writeback` 仍进入普通自适应学习路径中心，真实 latest path 为 `path:null`，没有报告反馈来源、练习生成、完成条件或写回目标。

建议：writeback intent 应把报告反馈转换成可执行练习任务，并明确完成后写回哪个报告项和证据链。

### 411. P1：资源 returnTo 不形成报告反馈回跳或完成后写回

资源页能打开“校正前测”，但没有展示 `returnTo=/assessment/document-feedback`、assignment/criterion 或完成后回跳/写回状态。

建议：资源目标页应显示来源和回跳目标，并在完成资源后写回报告反馈上下文。

### 412. P1：教师报告交付 action 仍停在长分析页

`action=deliver` 仍呈现 13,192px 班级分析页；动作后没有导出、发送、锁定版本、补强任务或交付确认，移动端仍高 14,128px。

建议：教师报告交付应从分析页拆出可执行状态，显示交付对象、版本、学生范围、发送/导出结果和补强入口。

### 413. P1：教师缺失学生证据动作跳公开首页

`studentId=missing-batch56` 没有出现学生不存在、班级不匹配或权限错误；动作后跳到公开首页 `/`，教师上下文丢失。

建议：学生证据深链必须保留教师上下文，缺失对象时提供返回班级、搜索学生、查看证据列表和权限解释。

### 414. P1：评分 GET 方法边界没有产品化

评分工作台页面仍无草稿，动作后跳首页；`/api/teacher/document-grading/submissions?...` 与 `/writeback-preview?...` 的 GET 都返回 405，但 UI 没有说明方法边界或如何加载草稿。

建议：评分工作台应显示接口不可用、草稿为空或来源缺失的产品状态，并给出刷新、返回报告账本和创建草稿入口。

### 415. P1：管理员用户 no-match URL、可见搜索和 API 口径继续分裂

no-match URL 初始页仍显示用户管理长页；可见搜索后页面高度缩短，但 API 仍返回 `total:298` 和真实用户样本。教师角色 no-match API 返回 `total:4`，说明 q 参数未参与筛选或被角色筛选覆盖。

建议：用户列表 URL、可见搜索、总览、表格、分页和 API 必须共用同一过滤合同，no-match 应稳定返回 0 并播报结果变化。

### 416. P1：治理导出 CSV 没有下载事件或完成状态

`tab=evidence-source&action=export&format=csv` 默认和动作后都停留治理 loading 状态，点击导出没有 download event，也没有失败或完成反馈。

建议：治理导出需要明确下载按钮、文件名、格式、失败提示、完成播报和导出审计记录。

### 417. P1：配置缺失 provider 测试参数被忽略

`focus=model-test&provider=missing-batch56&action=test` 仍是通用系统配置，动作后没有缺失 provider 错误、模型测试结果、配置建议或审计记录。

建议：模型测试参数应定位 provider，缺失时显示对象不存在和可恢复动作；存在时显示测试请求、响应时间、失败原因和保存建议。

### 418. P2：移动端仍暴露宽表和长页

320px 管理员用户 no-match 页面实际导出为 945px 宽；390px 学生证据目标高 4,279px，教师报告交付高 14,128px，管理员配置高 4,119px。移动端没有把目标摘要和主动作固定在首屏。

建议：移动目标页要先给对象摘要、状态和主动作，并避免表格撑宽文档。

### 419. P2：第 56 批 27 个状态仍全部缺少 alert/live

27 个 DOM/a11y JSON 均没有捕获到 `alert`。API 404、空路径、no-match 搜索、GET 405、治理导出、配置缺失 provider 和移动宽度变化都没有状态播报。

建议：把 API/UI 错位、搜索结果变化、方法边界、下载结果、缺失对象和移动布局变化纳入统一 status/live 合同。

## 5. 下一批输入

下一批应继续从用户可执行闭环角度追踪：学习证据目标页修复后的空态/高亮/写回、用户搜索 API 和 UI 统一后的分页/角色筛选、评分工作台 POST/草稿创建路径、治理导出下载和缺失 riskId 恢复，以及移动端 320px 宽度治理。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 416 已关闭：治理导出提供服务端 JSON/CSV/XLSX 下载、文件名、成功状态和审计摘要；格式、扩展名和内容类型保持一致。
- 417 已关闭：配置缺失 provider 测试显示 blocked 状态与恢复动作。

## #617 移动与可访问性整改记录（2026-06-21）

整改变更：`audit-remediation-mobile-a11y-shell`。证据：`../remediation/audit-remediation-mobile-a11y-shell/evidence.md`。

- 418 部分关闭：管理员用户页和教师报告页已通过 320px/390px DOM width 与截图验收，账号/学生长字符串在移动卡片中允许换行；学生证据目标、管理员配置和业务主动作固定区仍由对应变更关闭。
- 419 部分关闭：管理员用户搜索结果、治理状态、教师报告交付和教师班级详情补充 `status/live` 或键盘 a11y 证据；API 404、GET 405、治理导出和缺失对象完整状态仍保留。
