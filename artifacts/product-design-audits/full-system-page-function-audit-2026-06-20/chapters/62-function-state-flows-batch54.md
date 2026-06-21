# 功能状态流续篇（五十四）：报告反馈、AI 反馈与治理交接回归

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch54-manifest.json`
- 截图目录：`../screenshots/90-function-state-flows-batch54-report-ai-feedback/`
- 采集脚本：`../scripts/capture-batch54.mjs`
- 采集时间：2026-06-21
- 本批覆盖：学生文档反馈、Prompt 评价、AI 工坊、独立 Copilot、作品集反思，教师班级分析 report-ledger、评分工作台 ready、教师/管理员数据中心 returnTo，管理员治理 assign、系统配置 audit，以及 320px/390px 移动端报告、AI、评分、治理与配置状态。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 30 |
| DOM/a11y JSON | 30 |
| 路由响应 | 19 |
| API 检查 | 5 |
| 动作探测 | 20 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 6 |

6 条 ignoredErrors 中 5 条为 Playwright context close 超时；另 1 条为管理员数据中心 `returnTo=/admin/data-governance` 动作探测命中隐藏“数据治理”文本并超时。所有 30 个 DOM/a11y JSON 的 `alerts` 与 `liveRegions` 均为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 学生文档反馈 | `/assessment/document-feedback?demo=1&source=batch54` | 200；默认与动作后均停留报告反馈页，后续动作主要是 evidence 链接和练习入口。 |
| Prompt 评价 | `/evaluation/prompt-assessment?source=batch54&autodemo=1` | 200；页面显示 `STRUCTURE EVALUATED`，但 Prompt history API 返回 `total: 0`。 |
| AI 工坊 | `/ai?source=batch54` | 200；动作后焦点落到日志/详情按钮，未形成任务启动或写回状态。 |
| Copilot | `/ai/copilot?source=batch54&context=evidence` | 200；回答区仍暴露 `currentPathId: null`、`activeNodeId: null` 等上下文对象片段。 |
| 作品集反思 | `/profile/portfolio?source=batch54&category=reflection` | 200；默认仍显示“暂无课堂作品”，动作后才切到“暂无AI协作反思”。 |
| 教师 report-ledger | `/teacher/classes/.../analytics-v2?surface=report-ledger&source=batch54` | 200；仍是班级学情总览，动作后只切换指标，没有进入报告账本交付。 |
| 教师评分工作台 | `/teacher/grading-workbench?classId=...&source=batch54&status=ready` | 200；显示“当前没有打开的文档评分草稿”，动作后落到公开首页 `/`。 |
| 教师数据中心 returnTo | `/data-center?role=teacher&returnTo=/teacher/classes/.../analytics-v2` | 200；动作后仍停留数据中心，没有返回班级分析。 |
| 管理员数据中心 returnTo | `/data-center?role=admin&returnTo=/admin/data-governance` | 200；动作探测命中隐藏“数据治理”文本并超时，动作后仍停留数据中心。 |
| 管理员治理 assign | `/admin/data-governance?tab=risks&action=assign&source=batch54` | 200；默认首屏仍是治理页，动作后显示队列与风险清单，没有进入分派处置流。 |
| 管理员配置 audit | `/admin/config?source=batch54&focus=audit` | 200；默认与动作后均是系统配置页，没有审计 diff、影响范围或回滚入口。 |

API 关键结果：

- `/api/evaluation/prompt-history/demo` 返回 200，`total: 0`。
- `/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics` 返回 200。
- `/api/teacher/document-grading/submissions?classId=...` GET 返回 405。
- `/api/teacher/document-grading/writeback-preview` GET 返回 405。
- `/api/admin/data-governance/status` 返回 200，`status: healthy`。

## 4. 主要问题

### 383. P1：文档反馈后续动作仍是证据链接集合

报告反馈页能展示 `root-locus-report.pdf`、量规得分、模型假设、目标指标、校正方案、仿真验证和证据胶囊；动作后焦点落在“练习相关任务 compensator-design · evidence 1”。页面没有把教师反馈转成可提交修订、确认已读、生成补练或回到评分记录的闭环状态。

建议：文档反馈应有“采纳/修订/提交新版/已读确认/生成补练”状态机，并区分 evidence 链接、练习入口和教师评分记录。

### 384. P1：Prompt autodemo 与历史 API 口径不一致

`autodemo=1` 页面默认显示 `STRUCTURE EVALUATED` 和一致性报告，动作后仍停留同页；但 `/api/evaluation/prompt-history/demo` 返回 `total: 0`。用户无法判断当前结果是演示、临时计算、历史记录还是可保存反馈。

建议：Prompt 评价应把演示结果、真实历史、保存状态和趋势数据来源显式分开，避免 UI 完成态与 API 空历史并存。

整改记录：`audit-remediation-ai-task-boundaries` 已在 Prompt 评价页展示当前模式、输出目标、写回行为和 live 状态，补停止、重试、清空动作，并将 autodemo 隔离为页面本地演示 fixture；证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 385. P1：AI 工坊任务动作没有形成学习任务状态

AI 工坊显示学习任务、日志和实验档案，动作探测后焦点落在“查看日志 2”等控件；没有任务启动、完成记录、作品集写回或路径更新状态。

建议：AI 工坊的任务卡应进入可执行学习任务，显示开始/进行中/完成/写回/失败状态，并和作品集、学习路径或证据页形成稳定回流。

整改记录：`audit-remediation-ai-task-boundaries` 已将 `/ai?task=report-feedback` 转为报告反馈练习任务候选区，提供采用、丢弃和标记待写回状态；当前不声明已持久化写回，证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 386. P1：Copilot evidence 上下文仍暴露内部对象

`/ai/copilot?context=evidence` 默认与动作后都显示控灵页面；动作后页面文本包含 `currentPathId: null`、`activeNodeId: null`、`nextNodeIds: []` 等上下文对象片段，且焦点仍能落到全局 AI 输入和浮动工具。

建议：Copilot 应把证据上下文翻译成学生可理解的问题、证据来源和下一步建议，隐藏内部 JSON/null 字段，并收敛全局 AI 与页面 AI 的焦点竞争。

整改记录：`audit-remediation-ai-task-boundaries` 已为 `context=evidence` 显示学生可读证据边界，AI 消息和工具结果均隐藏内部 JSON/null 诊断；证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 387. P1：作品集 reflection query 与默认空态不一致

`category=reflection` 默认仍显示“暂无课堂作品”，动作后才切到“暂无AI协作反思”；页面没有说明当前分类、反思来源、创建入口或从 Copilot/AI 工坊写回的路径。

建议：作品集分类 query 应直接落到对应空态，并提供创建反思、导入 AI 对话、关联课堂证据和返回作品集总览的动作。

整改记录：`audit-remediation-ai-task-boundaries` 已让 `category=reflection` 直接进入反思页签，并为 `intent=create` 显示作品集反思草稿候选；证据见 `../remediation/audit-remediation-ai-task-boundaries/evidence.md`。

### 388. P1：教师 report-ledger surface 仍落到泛化班级分析

`surface=report-ledger` 进入的是“班级学情总览”，动作后只切换“能力分/近阶段变化”等分析维度；没有报告账本、交付状态、学生反馈、导出或评分写回入口。

建议：report-ledger surface 应直达报告交付工作区，至少展示报告列表、状态、接收对象、导出/发送/评分关联和异常恢复。

### 389. P1：评分工作台 ready 状态没有打开评分草稿

`status=ready` 与有效 `classId` 下仍显示“当前没有打开的文档评分草稿”；GET `/api/teacher/document-grading/submissions` 与 `/writeback-preview` 均返回 405；动作后落到公开首页 `/`。

建议：评分工作台应区分“无草稿”“有可评分提交”“方法不支持”和“来源参数失效”，并把返回动作留在教师上下文。

### 390. P1：数据中心 returnTo 没有形成返回或治理交接

教师 `returnTo=/teacher/classes/.../analytics-v2` 和管理员 `returnTo=/admin/data-governance` 均仍停留数据中心；管理员动作探测命中隐藏“数据治理”文本并超时，说明可见命令与隐藏导航文本存在冲突。

建议：数据中心 returnTo 应提供显式返回目标、治理交接、导出完成和不可达说明，并避免隐藏导航文本成为自动化和辅助技术优先命中对象。

### 391. P1：治理 assign query 不进入分派处置流

`tab=risks&action=assign` 默认仍是治理页，动作后显示队列健康度、事实类型分布、最新风险清单和快照明细；`/api/admin/data-governance/status` 为 healthy，但没有分派对象、负责人、截止时间、批量操作或完成状态。

建议：assign query 应直达风险分派工作流，提供风险行选择、负责人、优先级、保存、撤销和审计记录。

### 392. P1：系统配置 focus=audit 没有审计工作区

`focus=audit` 默认与动作后均停留“基础设置 / AI 供应商与模型 / 通知设置 / 伦理监测”；没有配置 diff、影响范围、审计日志、回滚、确认或失败恢复。

建议：系统配置 audit focus 应展示最近变更、待保存 diff、影响服务、回滚和审计链路，而不只是普通配置表单。

### 393. P2：移动报告、AI、评分和治理状态仍缺固定主动作

390px 文档反馈、Prompt、Copilot、教师 report-ledger、评分工作台，以及 320px 管理员数据中心、治理 assign、配置 audit 均能打开；但移动端仍以长内容、全局浮层或泛化页面为主，没有固定主动作区和清晰状态转场。

建议：移动端应为报告反馈、AI 建议、评分草稿、治理分派和配置审计提供固定主动作、分步结构和可回退导航。

### 394. P2：第 54 批 30 个状态仍全部缺少 alert/live

30 个 DOM/a11y JSON 的 `alerts` 与 `liveRegions` 均为 0。报告反馈动作、Prompt 评价、AI 任务、Copilot 上下文、作品集分类、报告账本、评分工作台、数据中心 returnTo、治理分派、配置审计和移动状态都缺少状态播报。

建议：把报告交付、评分写回、AI 反馈、治理分派、配置保存/审计和 returnTo 导航统一纳入 status/live 合同。

## 5. 下一批输入

下一批应继续围绕交付闭环做回归：文档反馈修订提交、Prompt 历史保存、AI 工坊任务启动写回、Copilot 证据摘要产品化、作品集反思写入、报告账本交付、评分草稿打开、数据中心 returnTo、治理分派保存、配置审计 diff，以及移动端固定主动作与 alert/live 播报。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 391 已关闭：治理 `assign` 深链校验 risk 与 assignee，缺失时显示 blocked 恢复状态。
- 392 已关闭：系统配置测试和审计反馈通过统一 `ActionStatusPanel` 展示，缺失 provider/model 不再被通用配置页吞掉。
