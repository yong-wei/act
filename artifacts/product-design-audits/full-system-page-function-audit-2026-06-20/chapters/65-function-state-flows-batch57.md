# 功能状态流续篇（五十七）：搜索筛选、导出与方法边界追踪

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch57-manifest.json`
- 截图目录：`../screenshots/93-function-state-flows-batch57-search-filter-methods/`
- 采集脚本：`../scripts/capture-batch57.mjs`
- 采集时间：2026-06-21
- 本批覆盖：学生报告反馈目标页、学习证据 assignment/lessonId/sourceEventId 过滤、自适应 writeback completed，教师报告导出、补强任务、评分草稿/缺失 run 与文档评分 GET/POST 方法边界，管理员用户角色筛选/分页/no-match、治理 resolve/export、配置缺失 model 测试，以及 320px/390px 移动端目标页。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 32 |
| DOM/a11y JSON | 32 |
| 路由响应 | 23 |
| API 检查 | 12 |
| 动作探测 | 15 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 5 |

5 条 ignoredErrors 均为 Playwright context close 超时；未发现硬错误。所有 32 个 DOM/a11y JSON 的 `alerts` 均为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 报告反馈目标页 | `/assessment/document-feedback?assignment=report-control-design&criterion=model-assumptions&status=actionable` | 200；页面显示“当前反馈尚未由教师批准返回”，但未解释 assignment/criterion，也没有目标证据、采用状态或补强写回。 |
| 学习证据完成筛选 | `/profile/evidence?assignment=...&status=completed` | 200；仍显示普通学习证据列表，可见搜索输入未找到；对应 API 返回 404 HTML。 |
| 学习证据缺失对象 | `lessonId=missing-batch57`、`sourceEventId=missing-batch57` | 200；lessonId 进入“当前筛选下暂无证据”，sourceEventId 仍显示普通证据列表；两个 API 均返回 404 HTML。 |
| 自适应 writeback completed | `/assessment/adaptive-practice?...&intent=writeback&status=completed` | 200；仍是普通学习路径中心，latest path API 继续返回 `path:null`。 |
| 教师报告导出 | `surface=report-ledger&action=export` | 200；仍是 13,192px 班级分析长页，点击导出/下载没有 download event。 |
| 教师补强任务 | `surface=remediation&action=create-task` | 200；仍是同一班级分析长页，动作后没有任务创建、发送范围或完成状态。 |
| 评分工作台草稿 | `/teacher/grading-workbench?...&status=draft&method=post-preview` | 200；仍显示“当前没有打开的文档评分草稿”；动作后跳公开首页 `/`。 |
| 评分方法边界 API | submissions/writeback-preview GET 与无效 POST | GET 均返回 405；submissions POST 返回 400 `缺少学生标识`，writeback-preview POST 返回 400 `缺少评分运行标识`，UI 不承接这些错误。 |
| 管理员用户角色筛选 | `/admin/users?role=STUDENT&q=zzzz-batch57-no-match`、`role=ADMIN&q=...` | 页面仍显示真实用户；API 分别返回 `total:293` 和 `total:1`，q 未参与过滤。 |
| 管理员用户分页 | `/admin/users?role=TEACHER&page=2&pageSize=2` | API 返回 `total:4`，页面仍是 2,241px 用户管理长页，没有清晰分页状态或结果播报。 |
| 管理员治理 resolve/export | `action=resolve&riskId=missing-batch57`、`action=export&format=json` | 缺失 risk 初始仍可能 loading；导出 JSON 无 download event，动作后仍是治理长页。 |
| 管理员配置缺失 model | `/admin/config?provider=missing-batch57&model=missing-batch57&action=test` | 200；仍显示通用系统配置和真实 SiliconFlow 模型，缺失 provider/model 参数被忽略。 |

## 4. 主要问题

### 420. P1：报告反馈 actionable 目标不形成 adopted/completed 状态

报告反馈页能打开并显示“document-assignment · hidden-unapproved”，但动作后仍停留原页，没有已采用、已完成、待写回、教师可见或学生下一步状态。移动端 390px 首屏也只显示未批准状态，不能进入可执行反馈闭环。

建议：报告反馈页应把 assignment/criterion 解析为任务摘要、量规项、教师反馈状态、可查看证据、可采用建议和后续练习写回。

### 421. P1：证据 completed assignment 仍缺页面和 API 合同

`status=completed` 的 assignment 证据目标仍显示泛化学习证据；`/api/learning-evidence?assignment=...&status=completed` 返回 404 HTML。页面没有报告、量规项、完成证据或可执行后续动作。

建议：建立学习证据查询 API，并让 URL、筛选控件、空态和 API 返回同一结果合同。

### 422. P1：缺失 lessonId/sourceEventId 被普通证据页吞掉

缺失 lessonId 和 sourceEventId 都返回 200 泛化证据页；lessonId 只显示“当前筛选下暂无证据”，sourceEventId 仍显示普通证据列表，没有对象不存在、链接过期、无权限或返回来源页的恢复动作。两个 API 均返回 404 HTML。

建议：缺失对象与真实空结果应分开表达，并提供返回来源页、修改筛选和联系教师的恢复路径。

### 423. P1：自适应 writeback completed 仍不写回报告反馈

`intent=writeback&status=completed` 仍显示“先建立入门路径”“本周完成 24%”和练习资源入口，latest path 仍为 `path:null`，没有报告反馈来源、完成结果或写回确认。

建议：writeback completed 应显示已完成/未完成、写回目标、证据链和下一步；无路径时必须显式说明不可写回原因。

### 424. P1：教师报告导出没有下载事件

报告账本 `action=export` 页面可打开，但仍呈现 13,192px 班级分析长页；点击导出/下载后没有 download event，也没有导出失败、空数据、权限或完成状态。

建议：报告导出应提供版本、范围、文件名、下载事件、失败提示和交付记录。

### 425. P1：教师补强建任务仍停在长分析页

`surface=remediation&action=create-task` 仍是长班级分析页，没有生成补强任务、学生范围、完成条件或回写规则；390px 移动端补强页高 14,128px。

建议：补强任务应从报告中生成可编辑草稿，明确学生范围、练习资源、完成条件、发送结果和写回规则。

### 426. P1：评分草稿和方法边界不能形成恢复路径

评分工作台 `status=draft&method=post-preview` 仍显示“没有打开的文档评分草稿”，点击动作后跳到公开首页。API GET 返回 405，无效 POST 返回 400 原始错误，但页面不说明需要学生标识、评分运行标识或如何创建草稿。

建议：评分工作台应显示缺失字段、草稿来源、支持的方法和恢复动作，并避免任何评分动作跳出教师上下文。

### 427. P1：管理员用户 no-match 与角色分页 API 仍不遵守同一过滤合同

STUDENT no-match API 返回 `total:293`，ADMIN no-match 返回 `total:1`，TEACHER page 2 返回真实教师样本。q、role、page 的口径仍不一致；320px 用户页仍导出为 945px 宽。

建议：用户列表 API、URL 参数、搜索框、角色筛选、分页和总览计数必须共用一个查询模型；no-match 应稳定返回 0。

### 428. P1：治理 resolve 缺失 riskId 没有恢复状态

`riskId=missing-batch57&action=resolve` 初始可停留 loading，动作后仍是泛化治理页，没有对象不存在、已解决、无权限或返回风险列表的说明。320px 数据治理 resolve 仍为 568px 宽、高 5,971px。

建议：治理 risk 动作应校验对象存在性，缺失时给出恢复路径，并把移动端风险列表改为可读的卡片或折叠布局。

### 429. P1：治理 JSON 导出没有下载事件

`action=export&format=json` 点击后没有 download event，也没有导出失败、空数据、权限或完成状态。

建议：治理导出应提供真实下载、文件名、失败提示、完成播报和导出审计记录。

### 430. P1：配置缺失 provider/model 测试参数被忽略

`provider=missing-batch57&model=missing-batch57&action=test` 仍显示当前 SiliconFlow 模型列表，点击测试没有缺失对象、运行结果、延迟、失败原因或配置建议。

建议：模型测试应从 URL 定位 provider/model，缺失时显示对象不存在，存在时展示测试状态、响应、失败原因和保存影响。

### 431. P2：第 57 批 32 个状态仍全部缺少 alert/live

32 个 DOM/a11y JSON 均没有捕获到 `alert`。未批准反馈、API 404、搜索结果变化、GET/POST 方法边界、导出无下载、缺失 provider/model 和移动宽度变化都没有状态播报。

建议：把目标页状态、筛选结果、方法错误、导出结果、配置测试和移动布局变化纳入统一 status/live 合同。

## 5. 下一批输入

下一批应继续补两类证据：一是修复后回归路径，包括报告反馈目标解析、学习证据 API、用户 q 过滤、评分草稿来源、治理导出与配置模型测试；二是更深的可访问性状态，包括 status/live、焦点恢复、移动表格替代布局和下载/错误状态的读屏语义。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 428 已关闭：治理 `resolve` 缺失 riskId/不存在 risk 显示 blocked 恢复状态和审计记录。
- 429 已关闭：治理导出提供可下载文件、文件名和 export-ready 审计记录。
- 430 已关闭：配置缺失 provider/model 测试显示明确对象不存在状态。
