# 功能状态流续篇（五十三）：直达深链、坏对象与移动作者态回归

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch53-manifest.json`
- 截图目录：`../screenshots/89-function-state-flows-batch53-direct-deep-links/`
- 采集脚本：`../scripts/capture-batch53.mjs`
- 采集时间：2026-06-21
- 本批覆盖：教师教案编辑直达、缺失 template 新建教案、ResourceNode blocked query，管理员教案编辑直达、坏教案编辑、治理 authoring 缺失 lessonPlanId，学生播放列表列表、播放列表直达播放、知识节点直达，以及 320px/390px 移动端作者态与学生深链状态。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 24 |
| DOM/a11y JSON | 24 |
| 路由响应 | 15 |
| API 检查 | 7 |
| 动作探测 | 19 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 5 |

5 条 ignoredErrors 均为 Playwright context close 超时。所有 24 个 DOM/a11y JSON 的 `alerts` 仍为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 教师教案编辑直达 | `/teacher/lesson-plans/cmqlsyjrb0003vmyfz0ju3lqh/edit?source=batch53&direct=api` | 200；API 详情存在但 `items: 0`，页面仍进入资源库与 BOPPPS 编排壳层，动作后落到公开首页 `/`。 |
| 教师缺失模板新建 | `/teacher/lesson-plans/new?templateId=batch53-missing-template&source=batch53` | 200；缺失 templateId 没有产品化提示，动作后同样落到公开首页 `/`。 |
| ResourceNode blocked query | `/teacher/resources/resource-nodes?source=batch53&status=blocked` | 200，桌面高 42,159px；移动 390px 高 92,909px，query 没有形成可处理的 blocked 清单。 |
| 管理员教案编辑直达 | `/admin/lesson-plans/cmqlsyjrb0003vmyfz0ju3lqh/edit?source=batch53&direct=api` | 200；API 详情存在但 `items: 0`，动作后回到 `/admin/lesson-plans` 长列表。 |
| 管理员坏教案编辑 | `/admin/lesson-plans/missing-batch53/edit?source=batch53` | 404；页面只有默认 404 与控灵，没有返回教案列表、创建新教案或检查权限的恢复动作。 |
| 治理 authoring 缺失教案 | `/admin/data-governance?surface=authoring&tab=reports&lessonPlanId=missing-batch53&source=batch53` | 200；页面仍是通用“数据治理”，没有说明 lessonPlanId 缺失或生成备课质量报告失败。 |
| 学生播放列表 | `/playlists?source=batch53` | 200；列表展示 3 个公开播放列表，动作后仍停留列表。 |
| 播放列表直达播放 | `/playlists/cmkaxvc11000n11d46jntz6nf/play?source=batch53&direct=api` | 200 但最终落到 `/`；动作后进入 `/interactive-learning`，播放意图和 playlistId 均丢失。 |
| 知识节点直达 | `/knowledge?nodeId=鞍点_8_292242f6&source=batch53&direct=api` | 200；API detail 可返回该节点，但页面只呈现知识图谱壳层，动作后没有后置任务状态。 |

API 关键结果：

- `/api/lesson-plans` 在教师上下文返回 71 条，在管理员上下文返回 83 条。
- `/api/lesson-plans/cmqlsyjrb0003vmyfz0ju3lqh` 返回 200，`items: 0`。
- `/api/knowledge/playlists` 返回 3 条。
- `/api/knowledge/nodes` 返回 820 条。
- `/api/knowledge/nodes/鞍点_8_292242f6` 返回 200，并能定位到节点 id。

## 4. 主要问题

### 373. P1：教师教案编辑直达动作会丢到公开首页

教师教案编辑直达页能加载 `cmqlsyjrb0003vmyfz0ju3lqh`，API 也返回该教案；但该教案 `items: 0`，页面仍显示资源库与 BOPPPS 编排壳层。动作探测后最终落到公开首页 `/`，教师作者态上下文、教案 id 和恢复入口都丢失。

建议：编辑直达应识别空教案、保存/返回动作和权限上下文；任何失败或取消都应留在教师教案上下文，不能跳到公开首页。

### 374. P1：教师新建教案缺失 templateId 时仍丢失作者态上下文

`/teacher/lesson-plans/new?templateId=batch53-missing-template` 返回 200，但页面没有说明模板不存在、是否改为空白教案或如何重新选择模板；动作后同样落到公开首页 `/`。

建议：缺失模板应显示模板不可用、重新选择模板、创建空白草稿和返回教案列表四类明确动作，并保留教师作者态。

### 375. P1：ResourceNode blocked 过滤没有形成可处理清单

`status=blocked` query 下仍渲染 ResourceNode 管理长页，桌面高 42,159px，移动端高 92,909px；页面标题和列表仍以资源节点清单为主，没有 blocked 数量、原因、修复建议、批量处理或清除筛选。

建议：blocked query 应进入可处置列表，显示筛选条件、风险原因、批量修复、详情定位、导出和完成状态。

### 376. P1：管理员教案编辑直达动作只回到长列表

管理员教案编辑直达页能打开同一空教案，动作后回到 `/admin/lesson-plans`，页面高 7,350px；没有保留刚才的教案、编辑结果、空环节风险或审计入口。

建议：管理员编辑直达需要明确保存/取消/返回路径，并在空教案、编辑失败或权限边界时给出可恢复状态。

### 377. P1：管理员坏教案编辑缺产品化恢复

`/admin/lesson-plans/missing-batch53/edit` 返回 404，只显示默认 “This page could not be found.” 和控灵；动作后仍停留同一 404。管理员无法判断教案不存在、权限不足、已删除还是链接过期。

建议：管理员坏教案应给出对象不存在、权限、返回教案列表、新建教案、搜索相近教案和审计日志入口。

### 378. P1：治理 authoring 缺失 lessonPlanId 不形成质量报告或恢复动作

`surface=authoring&tab=reports&lessonPlanId=missing-batch53` 仍进入通用“数据治理”，没有识别 authoring surface，也没有说明 lessonPlanId 缺失、报告不可生成或如何回到教案治理。

建议：治理页需要把 authoring deep link 转成备课质量报告状态，缺失对象时应显示恢复动作和可审计原因。

### 379. P1：播放列表直达播放会丢失播放意图

公开播放列表 API 返回 3 条，直达 `/playlists/cmkaxvc11000n11d46jntz6nf/play` 时路由响应 200，但最终落到公开首页 `/`；动作后进入 `/interactive-learning`，仍没有播放列表标题、playlistId、继续播放或错误说明。

建议：播放列表播放深链应保留 playlistId，无法播放时给出权限、对象状态和返回列表动作；不能静默改道到首页或泛化学习入口。

### 380. P2：知识节点直达能打开但缺加入课程流或学习任务后置状态

知识节点 detail API 可返回 `鞍点_8_292242f6`，`/knowledge?nodeId=...` 也停留在知识图谱；但页面没有把该节点转成加入课程流、开始学习、查看关联资源或生成学习任务的后续状态，动作探测后仍无变化。

建议：节点 deep link 应显式选中节点、展示资源/关系摘要，并提供加入课程流、开始练习和返回图谱的任务化动作。

### 381. P2：移动直达状态仍依赖超长列表或静默改道

390px 教师教案编辑仍是作者态壳层，390px ResourceNode blocked 高 92,909px；320px 管理员教案编辑只呈资源库壳层，320px 治理 authoring 缺失教案仍显示通用治理；390px 播放列表直达播放仍落到公开首页。

建议：移动端深链应先给对象摘要、当前状态和主动作，避免把桌面长列表直接塞进移动端或在手机上静默改道。

### 382. P2：第 53 批 24 个状态仍全部缺少 alert/live

24 个 DOM/a11y JSON 均没有捕获到 `alert`。教案直达、缺失模板、blocked query、坏教案、治理缺失 lessonPlanId、播放列表直达、知识节点直达和移动深链状态都缺少状态播报。

建议：把深链加载、对象缺失、权限/模板错误、筛选结果、播放失败和移动改道统一纳入 status/live 合同。

## 5. 下一批输入

下一批应继续围绕深链和坏对象补全恢复合同：教师/管理员教案编辑保存与取消、模板缺失恢复、ResourceNode blocked 处置、authoring 报告对象缺失、播放列表播放失败、知识节点选中与加入课程流，以及这些状态在移动端的固定主动作区和 alert/live 播报。
