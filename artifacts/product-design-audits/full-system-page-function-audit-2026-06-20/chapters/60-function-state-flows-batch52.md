# 功能状态流续篇（五十二）：教师备课、资源治理与课程流创建回归

## 1. 证据范围

- Manifest：`../screenshots/function-state-flows-batch52-manifest.json`
- 截图目录：`../screenshots/88-function-state-flows-batch52-teacher-authoring-resource-prep/`
- 采集脚本：`../scripts/capture-batch52.mjs`
- 采集时间：2026-06-21
- 本批覆盖：教师预置教案、我的教案、新建教案、资源管理、ResourceNode 管理，管理员教案、新建教案、治理 authoring surface，学生课程目录搜索、课程流创建，以及 320px/390px 移动备课与资源状态。

## 2. 采集结果摘要

| 项目 | 数量 |
| --- | ---: |
| 页面状态截图 | 31 |
| DOM/a11y JSON | 31 |
| 路由响应 | 19 |
| API 检查 | 9 |
| 动作探测 | 24 |
| 下载事件 | 0 |
| 硬错误 | 0 |
| 忽略错误 | 5 |

5 条 ignoredErrors 均为 Playwright context close 超时。所有 31 个 DOM/a11y JSON 的 `alerts` 仍为 0。

## 3. 路由与 API 证据

| 组 | 路由/API | 结果 |
| --- | --- | --- |
| 教师预置教案 | `/teacher/preset-lessons?source=batch52` | 200，高 8,911px；动作后仍停留列表。 |
| 预置克隆 API | `/api/teacher/preset-lessons/clone` | GET 返回 405，页面没有说明克隆入口和方法要求。 |
| 教师教案 | `/teacher/lesson-plans?source=batch52` | 200，高 6,351px；未找到可填搜索输入或可解析 edit href。 |
| 教师新建教案 | `/teacher/lesson-plans/new?...` | 200；空标题动作后跳到公开首页 `/`。 |
| 教师资源 | `/teacher/resources?source=batch52` | 200；资源搜索能进入无匹配空态，但无状态播报，主动作仍停留资源页。 |
| ResourceNode | `/teacher/resources/resource-nodes?source=batch52` | 200，高 42,159px；搜索能显示 0 结果，但主动作回到资源列表。 |
| 管理员教案 | `/admin/lesson-plans?source=batch52` | 200，高 7,350px；未找到搜索输入或 edit href。 |
| 管理员新建教案 | `/admin/lesson-plans/new?source=batch52` | 200；动作后返回教案长列表，没有字段校验或保存结果。 |
| 管理员治理 | `/admin/data-governance?surface=authoring&tab=reports&source=batch52` | 桌面首屏可停留 loading；动作后显示治理页但没有 authoring 报告上下文。 |
| 学生课程目录 | `/interactive-learning/courses?source=batch52&q=zzzz-batch52-no-match` | 200，仍显示完整课程目录；未找到可填搜索输入。 |
| 学生课程流 | `/playlists/new?source=batch52` | 200，高 60,902px；填标题和点击动作后仍停留巨型知识库列表。 |

API 关键结果：

- `/api/lesson-plans` 在教师上下文返回 71 条，在管理员上下文返回 83 条。
- `/api/resources` 返回 112 条。
- `/api/teacher/resource-nodes` 返回 200。
- `/api/admin/data-governance/status` 返回 `healthy`。
- `/api/knowledge/playlists` 返回 3 条。
- `/api/knowledge/nodes` 返回 820 条。

## 4. 主要问题

### 361. P1：预置教案使用动作没有形成克隆状态

预置教案列表高 8,911px，卡片上有“预览”和“使用模板”，但点击后仍停留原列表；`/api/teacher/preset-lessons/clone` 的 GET 返回 405，页面没有展示克隆方法要求、目标教案、失败原因或完成入口。

建议：预置教案使用应进入明确的克隆确认、目标命名、成功跳转和失败恢复状态；API 方法限制应转成产品化提示。

### 362. P1：教师教案列表缺搜索、编辑定位和状态反馈

`/teacher/lesson-plans` 高 6,351px，脚本没有找到可填搜索输入，也没有解析到稳定 edit href；搜索探测后页面仍是完整长列表。

建议：教师教案需要关键词搜索、分页或虚拟列表、稳定编辑链接、结果数量、无匹配空态和状态播报。

### 363. P1：教师新建教案动作会丢到公开首页

教师新建教案页能显示资源库，但空标题动作后最终落到 `/` 的公开首页，当前作者态上下文和返回路径都被打断。

建议：空标题、保存、添加环节和返回动作必须留在作者态上下文，显示字段级错误、草稿状态或明确返回教案列表。

### 364. P1：资源管理搜索有空态但没有处理合同

教师资源页默认 112 个资源，搜索无匹配后出现“没有找到匹配的互动组件”，但没有结果数量、清除条件、恢复动作或 live/status；主动作探测后仍停留资源页。

建议：资源搜索应提供可读结果数、清除筛选、加入教案或预览的后置状态，并向读屏播报结果变化。

### 365. P1：ResourceNode 管理仍是巨型治理清单

ResourceNode 默认页高 42,159px，移动端高 92,909px；筛选后可显示 0 结果，但没有分页、虚拟列表、批量治理、导出或定位到具体资源的任务流。

建议：ResourceNode 管理应拆成搜索、筛选、详情、批量修复和导出链路，不能把 278 个节点和多组筛选控件一次性铺满页面。

### 366. P1：管理员教案管理仍缺搜索、编辑和创建闭环

管理员教案页高 7,350px，未找到可填搜索输入或 edit href；新建教案动作后返回长列表，没有字段校验、草稿创建、保存结果或审计记录。

建议：管理员教案管理需要搜索/分页、稳定编辑入口、创建表单校验、保存审计和返回上下文。

### 367. P1：治理 authoring surface 不能进入备课质量报告

`surface=authoring&tab=reports` 首屏停留“正在加载数据治理看板…”，动作后只进入通用治理内容；没有教案质量、资源映射、ResourceNode 异常、课程流规模或作者态修复入口。

建议：治理页需要识别 authoring surface，把教案、资源、知识节点和课程流问题转成可处置报告。

### 368. P1：学生课程目录 query 不形成搜索状态

`/interactive-learning/courses?q=zzzz-batch52-no-match` 仍显示完整课程目录，脚本也未找到可填搜索输入；用户无法确认当前是否筛选、无匹配或忽略 query。

建议：课程目录应支持可见搜索输入、URL 同步、结果数量、无匹配空态和清除条件。

### 369. P1：课程流创建器一次性暴露 820 个知识节点

`/playlists/new` 桌面高 60,902px，移动端高 61,359px；API 返回 820 个知识节点，填入标题和点击动作后仍停留知识库长列表，没有可见已选节点、保存结果或恢复动作。

建议：课程流创建器需要搜索、分组、已选区、保存前校验、成功跳转和移动端分步布局。

### 370. P2：移动备课与资源页长度不可操作

390px 下教师预置教案高 23,144px、教师教案高 18,670px、教师资源高 7,936px、ResourceNode 高 92,909px；320px 管理员教案高 24,697px；学生课程流移动端高 61,359px。

建议：移动备课页应采用分页、折叠、搜索优先、固定主动作和分步编辑，避免把桌面长列表直接输出到手机。

### 371. P2：作者态 API 有数据但 UI 缺任务化消费

`/api/lesson-plans`、`/api/resources`、`/api/teacher/resource-nodes`、`/api/knowledge/nodes` 均返回数据，但 UI 主要表现为长列表或静态清单，没有把 API 数据组织成可完成的编辑、治理、引用、保存或回滚任务。

建议：作者态 API 应服务明确任务单元，至少区分列表摘要、搜索结果、详情编辑和操作反馈。

### 372. P2：第 52 批 31 个状态仍全部缺少 alert/live

31 个 DOM/a11y JSON 均没有捕获到 `alert`。预置教案使用、教案搜索、新建教案、资源搜索、ResourceNode 筛选、治理加载、课程目录 query 和课程流创建都缺少状态播报。

建议：把搜索、筛选、创建、保存、克隆、治理加载和课程流节点选择统一纳入 status/live 合同。

## 5. 下一批输入

下一批应继续围绕作者态和资源治理补后置状态：预置教案克隆确认、教案新建字段校验、ResourceNode 分页/批量治理、课程流已选节点和保存、治理 authoring 报告，以及上述长列表移动端改造后的回归证据。
