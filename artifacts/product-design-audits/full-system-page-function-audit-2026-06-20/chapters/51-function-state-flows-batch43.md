# 功能状态流续篇（四十三）

日期：2026-06-20
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：报告账本、导出下载、教师复盘交付、数据中心快照导出、管理员模板下载、数据治理处置、学生文档反馈和移动端交付状态。

## 1. 证据清单

- 截图目录：`../screenshots/78-function-state-flows-batch43/`
- Manifest：`../screenshots/function-state-flows-batch43-manifest.json`
- 采集脚本：`../scripts/capture-batch43.mjs`
- 结果：12 张 PNG、12 个 DOM/a11y JSON、4 个 API 检查、2 个下载事件、12 个可选动作、0 个脚本错误、0 个忽略错误。

本批脚本显式等待登录后的 `sessionRole`，避免把尚未完成会话水合的 `/login` 误当成目标页面。教师、学生、管理员三类会话均确认成功；截图覆盖桌面和移动端关键报告/导出/治理交付状态。

## 2. API 与下载状态

| 检查项 | 路径 | 结果 | 关键观察 |
|---|---|---|---|
| 班级控制校正报告导出 | `/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/control-correction-report?export=true` | 200 JSON | API 返回完整 report/export 数据，但响应没有 `content-disposition`，教师 UI 也没有对应的可见导出/发送动作。 |
| 班级助手效果报告导出 | `/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/assistant-effect-report?export=true` | 404 JSON | 返回 `演示效果报告不存在`，dashboard 中仍出现助手效果报告槽位，状态需要更清楚地降级。 |
| 管理员用户模板 | `/api/admin/users/template` | 200 XLSX | 响应为 `attachment; filename="users-template.xlsx"`，页面触发 2 条下载事件。 |
| 管理员数据治理状态 | `/api/admin/data-governance/status` | 200 JSON | `activeRiskFlags=170`，快照新鲜度约 3286 分钟前且为 stale，但页面仍缺导出和逐行处置动作。 |

## 3. 教师报告与复盘交付

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/classroom/teacher/cmqm6s1s1001f1wyf4ggkifs5/review` | `01-teacher-review-delivery-desktop.png` | 复盘页显示班级、课堂状态、能力跟踪和补救建议，但首屏/底部只有“返回班级详情”和“前往评审聚合入口”，没有导出、发送、复制摘要或生成补强路径。 |
| 2 | `/review/extracurricular-showcase` | `02-teacher-review-linked-destination.png` | 复盘页外链进入内部课外展示聚合入口，丢失原课堂、班级和交付上下文。 |
| 3 | `/teacher` | `03-teacher-dashboard-report-ledger.png` | report ledger 同时出现课前包复核 deferred、助手效果报告 export available 和 unavailable 文案，状态组合复杂且缺下一步。 |
| 4 | `/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2` | `04-teacher-class-analytics-report-ledger.png` | 班级分析页有 restricted report ledger，但埋在 13192px 长页深处，主报告导出/交付动作不可见。 |
| 5 | `/teacher/arena/publications/cmqluwvqo0001pmyf34og34jy` | `05-teacher-arena-publication-report-delivery.png` | Arena 发布报告可读性较好，有状态和复制语义，但缺导出、发送、锁定、审核或归档交付命令。 |
| 6 | `/data-center` | `06-teacher-data-center-export-attempt.png` | 数据中心存在 platform snapshot 导出说明，但右下控灵浮层截获导出按钮点击，下载未触发；页面无完成/失败状态。 |

## 4. 学生、管理员与配置交付

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 7 | `/assessment/document-feedback?demo=1` | `07-student-document-feedback-delivery.png` | 报告反馈能展示评分解释和后续练习入口，但缺导出、提交边界、已读/已采用状态或 demo 边界。 |
| 8 | `/admin/users` | `08-admin-users-template-download-state.png` | 模板下载 API 和页面下载均成功，但 UI 下载后没有完成提示、批次预览、失败行导出、通知、撤销或审计记录。 |
| 9 | `/admin/data-governance` | `09-admin-governance-export-disposition-state.png` | 页面显示 170 个活跃风险、stale 新鲜度、队列、事实和风险分布；report ledger 为 deferred，风险列表仍没有导出/分派/标记处理/查看证据动作。 |
| 10 | `/admin/config` | `10-admin-config-save-export-state.png` | 保存、重置和测试控件可见，但缺配置差异、保存影响范围、完成状态、失败恢复和审计记录。 |

## 5. 移动端交付状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 11 | `/classroom/teacher/cmqm6s1s1001f1wyf4ggkifs5/review` | `11-mobile-teacher-review-delivery.png` | 移动复盘页仍没有固定交付动作区；返回、内部评审入口、AI 输入和浮层竞争主任务。 |
| 12 | `/admin/users` | `12-mobile-admin-users-template-import.png` | 390px viewport 下 full-page PNG 宽 945px，用户管理页仍横向溢出；导入/下载动作可见但缺移动端批次状态和审计入口。 |

## 6. 主要问题

### 254. P1：教师课堂复盘缺少真实报告交付动作

控制校正班级报告 API 返回 200，并包含 report/export 数据；但复盘页只提供返回班级详情和内部评审入口。教师无法在课堂复盘页完成导出、发送、复制摘要、锁定版本或生成补强路径。

建议：把 `/classroom/teacher/{sessionId}/review` 作为课堂报告交付主入口，接入报告导出、发送班级/学生、复制摘要、生成补强任务和交付状态。

### 255. P1：复盘外链丢失课堂与班级上下文

“前往评审聚合入口”跳到 `/review/extracurricular-showcase`，页面展示内部聚合视图，而不是本课堂的交付目的地。该入口不能承接教师课后复盘。

建议：内部 review 页面保留为审查面；教师复盘页应跳向班级/课堂 scoped 报告、补强、发布或归档页面。

### 256. P1：数据中心快照导出被浮动工具阻断

教师数据中心有导出说明和按钮，但实际点击因右下控灵浮层截获指针事件而超时，manifest 中记录 `teacher data center export download` 为 blocked。

建议：为数据中心导出区增加浮层避让或在导出区域禁用浮层命中；同时补下载开始、完成、失败和重试状态。

### 257. P1：管理员数据治理有高风险数据但缺导出和处置闭环

数据治理 API 返回 170 个活跃风险和 stale 新鲜度；页面能展示风险分布和最新风险，但 report ledger 仍为 deferred，风险行缺查看证据、分派、标记处理、创建待办和导出。

建议：把风险表从只读看板升级为治理工作台，至少提供按行处置、批量导出、状态筛选、负责人和审计历史。

### 258. P1：管理员用户模板下载成功但批量导入状态机缺失

模板下载真实触发 `users-template.xlsx`，但下载后页面没有完成提示；批量导入仍缺预览、失败行导出、通知、撤销/回滚、批次 ID 和审计记录。

建议：将模板下载、文件选择、预览、执行、失败处理、通知和撤销组织为一条可见状态机，下载完成也应进入状态区。

### 259. P2：教师首页报告账本状态组合不可执行

教师首页同时出现课前包复核 deferred、助手效果报告 export available 和 unavailable 文案；而助手效果 API 返回 404 `演示效果报告不存在`。教师难以判断可导出、待生成、不可用之间的差异。

建议：报告账本需要统一状态词和下一步动作：可导出、需生成、缺数据、暂不可用分别给明确原因和入口。

### 260. P2：班级分析报告账本埋藏过深且受限状态缺行动

班级分析页高度超过 13,000px，restricted report ledger 位于长页深处，缺少导出入口、解除限制条件或跳转到交付页。

建议：把报告交付状态提升到页首摘要区，并为 restricted 状态说明缺什么数据、谁可以解锁、下一步如何处理。

### 261. P2：Arena 发布报告缺少交付命令

Arena 发布报告正文和状态可读，但没有导出、发送给学生、锁定版本、教师审核或归档按钮。报告仍停留在查看状态。

建议：在发布报告页尾和页首固定区域加入交付命令，并把交付时间、接收对象和版本状态写入报告元数据。

### 262. P2：学生文档反馈后续动作多但状态不清

学生报告反馈页有评分解释和多个后续动作，但没有导出、提交边界、已读状态、练习采用状态或 demo 数据边界。反馈页像结果页，却缺少结果生命周期。

建议：增加“已查看/已加入练习/已提交修订/已归档”状态，并区分 demo 和真实作业反馈。

### 263. P2：系统配置保存缺少影响范围和审计反馈

管理员配置页保存、重置、测试控件可见，但没有 diff、影响范围、保存成功/失败、回滚入口和审计记录。配置类操作不应只有按钮。

建议：保存前显示变更摘要和影响模块；保存后展示状态、时间、操作者、回滚入口和测试结果。

### 264. P2：移动教师复盘缺少固定交付动作区

移动复盘页的核心交付动作不固定，返回、内部评审入口、AI 输入和浮动工具竞争首屏与底部区域。教师在手机上无法直接完成报告交付。

建议：移动复盘页底部固定一个报告交付动作条，包含导出、发送、补强和更多菜单，并与全局浮层互斥。

### 265. P2：移动管理员用户页仍横向溢出且导入状态未治理

移动截图在 390px viewport 下实际宽 945px，说明用户管理页仍由表格或控件撑宽。导入/下载动作可见，但没有移动端批次状态、失败处理和审计入口。

建议：移动端改为卡片化用户列表和可折叠批量导入状态区，表格只放在受控横向滚动容器内，并保证浮层按 viewport 定位。

## 7. 后续审计输入

- 报告交付修复后，优先回归教师复盘、班级分析、教师首页账本和 Arena 发布报告。
- 数据中心与管理员治理修复后，单独复核导出、风险处置、下载完成、失败恢复和 live/status 播报。
- 管理员用户移动页修复后，必须同时复核截图真实宽度、批量导入状态机和模板下载完成提示。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 257 已关闭：`/admin/data-governance` 增加对象化 `resolve/assign/export` 状态、缺失风险恢复、行级处置/分派入口、服务端导出文件与持久动作审计。
- 258 部分关闭：`/admin/users` 已补导入预览、确认提交、`batchId`、审计记录和失败行下载；自动回滚延期到持久 import-batch 存储。
