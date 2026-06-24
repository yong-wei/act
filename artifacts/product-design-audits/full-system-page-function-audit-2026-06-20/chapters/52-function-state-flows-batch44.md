# 功能状态流续篇（四十四）

日期：2026-06-20
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：无效深链、失效对象、坏 ID 路由、恢复入口、状态播报和移动端错误页状态。

## 1. 证据清单

- 截图目录：`../screenshots/79-function-state-flows-batch44/`
- Manifest：`../screenshots/function-state-flows-batch44-manifest.json`
- 采集脚本：`../scripts/capture-batch44.mjs`
- 结果：18 张 PNG、18 个 DOM/a11y JSON、18 个路由响应、4 个 API 检查、6 个登录/可选动作、0 个脚本错误、0 个忽略错误。

本批覆盖公开未知路由、学生资源/课程/仿真/Arena/播放列表/证据/学习路径坏参数，教师班级/班级分析/学生详情/教案编辑/Arena 报告/课堂复盘坏 ID，以及管理员教案编辑坏 ID。移动端补学生坏资源、教师坏班级和管理员坏教案三类代表状态。

## 2. 路由与 API 结果

| 类型 | 代表路径 | 响应 | 关键观察 |
|---|---|---:|---|
| 默认 404 | `/this-route-does-not-exist`、坏课程、坏仿真、坏 Arena、坏播放列表、坏教案、坏报告、坏复盘 | 404 | 直接显示 Next 默认 `404 This page could not be found.`，没有品牌壳层、返回入口或任务恢复。 |
| 学生资源坏 ID | `/interactive-learning/resources/not-a-real-resource` | 200 | 显示“资源不存在或无法访问”，但主体大面积空白，缺少推荐恢复路径。 |
| 学生证据坏筛选 | `/profile/evidence?lessonId=not-a-real-lesson` | 200 | 课次筛选直接显示 raw id，空态与“无证据”混在一起。 |
| 学习路径坏上下文 | `/assessment/adaptive-practice?...pathId=not-a-real-path&nodeId=not-a-real-node` | 200 | 无视坏 pathId/nodeId，继续展示“入门路径”和 24% 进度。 |
| 教师班级坏 ID | `/teacher/classes/not-a-real-class` | 200 | 显示“班级不存在”和“返回班级列表”，但没有状态播报。 |
| 教师分析/学生坏 ID | `/teacher/classes/not-a-real-class/analytics-v2`、`/students/not-a-real-student` | 200 | 显示“获取班级学情总览失败”或“获取学生学情失败”，只有重试，不说明对象不存在或返回上级。 |
| API 坏目标/坏班级 | `/api/learning-paths/latest?goal=not-a-real-goal`、教师班级 insights/report API | 400/404 | API 能返回明确 JSON 错误，如“学习路径目标未注册”“班级不存在”。 |
| 管理员用户无匹配搜索 | `/api/admin/users?q=not-a-real-user-zzzz` | 200 | 返回 `total=298` 和全量用户样本，说明 q 没有过滤或无结果状态被破坏。 |

## 3. 学生侧失效状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/this-route-does-not-exist` | `01-public-not-found-desktop.png` | 公开未知路由为原生 Next 404，只有全局 AI 输入和工具浮层，没有首页/登录/返回入口。 |
| 2 | `/interactive-learning/resources/not-a-real-resource` | `02-student-invalid-resource.png` | 保留 AppShell 和返回互动学习按钮，但主体只有“资源不存在或无法访问”，没有解释、推荐资源或状态播报。 |
| 3 | `/interactive-learning/courses/not-a-real-course` | `03-student-invalid-course.png` | 课程坏 slug 直接落默认 404，丢失课程目录恢复路径。 |
| 4 | `/simulations/not-a-real-simulation` | `04-student-invalid-simulation.png` | 仿真坏 slug 直接落默认 404，目录/搜索/推荐仿真都不可见。 |
| 5 | `/arena/challenges/not-a-real-task` | `05-student-invalid-arena-task.png` | Arena 坏 taskId 直接落默认 404，挑战大厅或任务列表入口不可见。 |
| 6 | `/playlists/not-a-real-playlist/play` | `06-student-invalid-playlist-play.png` | 失效播放列表播放链接直接落默认 404，没有回课程流列表或说明播放列表已删除。 |
| 7 | `/profile/evidence?lessonId=not-a-real-lesson` | `07-student-evidence-invalid-lesson-filter.png` | 空态有重置筛选和返回成长中心，但左侧课次筛选直接显示 raw id，用户无法区分无证据和课次不存在。 |
| 8 | `/assessment/adaptive-practice?...bad path/node` | `08-student-invalid-adaptive-path-context.png` | 页面继续显示入门路径、当前节点和 24% 本周完成，坏 pathId/nodeId 没有被解释或清除。 |

## 4. 教师与管理员失效状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 9 | `/teacher/classes/not-a-real-class` | `09-teacher-invalid-class-detail.png` | 有“班级不存在”和返回班级列表，属于相对可恢复状态，但没有 live/status。 |
| 10 | `/teacher/classes/not-a-real-class/analytics-v2` | `10-teacher-invalid-class-analytics.png` | 显示“获取班级学情总览失败”和重试；不说明班级不存在，也没有返回班级列表。 |
| 11 | `/teacher/classes/{classId}/students/not-a-real-student` | `11-teacher-invalid-student-insight.png` | 显示“获取学生学情失败”和重试；不区分学生不存在、班级不匹配或权限问题。 |
| 12 | `/teacher/lesson-plans/not-a-real-plan/edit` | `12-teacher-invalid-lesson-plan-edit.png` | 默认 404，教师教案列表入口和恢复说明缺失。 |
| 13 | `/teacher/arena/publications/not-a-real-publication` | `13-teacher-invalid-arena-publication.png` | 默认 404，缺发布列表、班级 Arena 或过期/删除说明。 |
| 14 | `/classroom/teacher/not-a-real-session/review` | `14-teacher-invalid-classroom-review.png` | 默认 404，缺课堂历史和报告交付恢复入口。 |
| 15 | `/admin/lesson-plans/not-a-real-plan/edit` | `15-admin-invalid-lesson-plan-edit.png` | 默认 404，管理员教案列表和治理说明缺失。 |
| 16 | 移动学生坏资源 | `16-mobile-student-invalid-resource.png` | 移动端保留资源不存在说明，但仍缺恢复路径和状态播报。 |
| 17 | 移动教师坏班级 | `17-mobile-teacher-invalid-class.png` | 移动端能看到“班级不存在”，但全局浮层仍竞争底部区域。 |
| 18 | 移动管理员坏教案 | `18-mobile-admin-invalid-lesson-plan.png` | 移动端仍是默认 404，仅有全局 AI 和浮层控件。 |

## 5. 主要问题

### 266. P1：多数坏 ID 页面落到默认 Next 404，缺少产品级恢复

公开未知路由、坏课程、坏仿真、坏 Arena 挑战、坏播放列表、教师坏教案、坏 Arena 发布报告、坏课堂复盘和管理员坏教案都显示默认 `404 This page could not be found.`。这些状态没有平台品牌壳层、角色上下文、返回首页、返回列表、重新搜索或联系教师/管理员说明。

建议：建立统一产品级 Not Found/Error shell，根据当前角色和路由族提供恢复路径，例如课程目录、仿真目录、Arena 大厅、播放列表、教师教案列表、课堂历史或管理员教案列表。

### 267. P1：错误页上的全局 AI 与浮动工具成为仅有操作入口

默认 404 页面没有任务恢复控件，却仍显示全局 AI 输入、关闭按钮和工具浮层。用户在失效链接中最容易点击的是与当前错误无关的浮动工具，而不是回到正确工作流。

建议：错误页应先提供主恢复动作；全局 AI 若保留，必须接收错误上下文并给出“回到课程目录/班级列表”等恢复建议，否则应弱化或隐藏。

### 268. P1：教师坏分析/坏学生路由返回 200 但只给泛化失败

教师班级分析坏 ID 和学生坏 ID 都返回 200，页面只显示“获取班级学情总览失败”或“获取学生学情失败”和“重试”。同一批 API 检查能返回“班级不存在”，但 UI 没有把对象不存在、无权限、班级不匹配或网络失败区分开。

建议：教师数据页应把 404 对象不存在、403 权限、500 服务错误分开呈现，并提供返回班级列表、返回学生清单、检查链接和刷新重试。

### 269. P1：学习路径坏 pathId/nodeId 被忽略，页面仍显示正常进度

`pathId=not-a-real-path&nodeId=not-a-real-node&intent=path-execution` 时，页面仍显示“当前节点 入门诊断”“本周完成 24%”和“检查节点练习已准备”。用户会误以为失效链接仍指向一个有效路径节点。

建议：学习路径页应校验 pathId/nodeId 是否存在且归属当前用户；无效时清除上下文并显示“路径不存在或已更新”，提供回到路径中心和重新生成入口。

### 270. P1：管理员用户无匹配搜索 API 返回全量用户

`/api/admin/users?q=not-a-real-user-zzzz` 返回 200，但 `total=298` 并包含真实用户样本。这说明搜索参数没有生效，或无匹配时退回全量列表。对管理员而言，这会造成错误操作目标风险。

建议：用户搜索必须严格过滤 q；无匹配时返回 `total=0` 和空数组，并让页面展示可清除条件的空态。

### 271. P2：互动资源坏 ID 空态过弱

互动资源坏 ID 保留了 AppShell 和返回互动学习按钮，但主体大卡只有“资源不存在或无法访问”，大量空白，没有原因、资源目录、相近资源、重试或报告失效链接入口。

建议：资源错误页应解释可能原因，并提供返回资源目录、课程目录、最近使用资源和问题反馈。

### 272. P2：学生证据坏课次筛选暴露 raw id

`lessonId=not-a-real-lesson` 时，筛选栏直接显示 `not-a-real-lesson`，空态只说“当前筛选下暂无证据”。这会把无效课次和真实课次暂无证据混在一起。

建议：证据页应先解析 lessonId；未解析时显示“课次不存在或已更新”，并提供清除筛选、返回课程/成长中心。

### 273. P2：教师班级详情坏 ID 虽可恢复但缺状态播报

教师班级详情坏 ID 显示“班级不存在”和“返回班级列表”，这是本批较好的恢复状态。但 DOM 中 `alerts=0`，读屏用户无法感知页面状态变化。

建议：把“班级不存在”放入 `role=status` 或页面主标题，并在进入错误状态时播报。

### 274. P2：移动端错误页仍缺恢复动作

移动学生坏资源和教师坏班级保留部分产品壳层，但移动管理员坏教案仍是默认 404；三类移动状态都没有明显固定恢复动作。全局浮层仍出现在错误页底部。

建议：移动错误页应固定展示返回上一级/回列表主按钮，并与全局浮层互斥或降低浮层优先级。

### 275. P2：所有失效状态都缺 live/status

本批 18 个 DOM/a11y JSON 的 `alerts=0`。404、资源不存在、班级不存在、获取失败、空筛选和坏路径上下文都没有 `role=alert`、`role=status` 或 `aria-live`。

建议：建立错误状态播报合同，覆盖路由级 404、对象不存在、权限不足、筛选无结果、服务失败和上下文失效。

### 276. P2：API 与 UI 的错误语义没有对齐

API 能返回“学习路径目标未注册”“班级不存在”等明确错误；UI 层要么默认 404，要么泛化为“获取失败”，要么继续展示正常状态。错误语义在服务端和界面之间断开。

建议：动态路由和数据页应复用 API 错误枚举，把 `not-found`、`forbidden`、`invalid-parameter`、`stale-link` 和 `service-failed` 映射到统一错误组件。

## 6. 后续审计输入

- 产品级错误页修复后，应回归课程、仿真、Arena、播放列表、教师教案、课堂复盘和管理员教案的坏 ID 状态。
- 教师数据页修复后，应补班级不存在、学生不存在、无权限和服务失败四类状态。
- 管理员用户搜索修复后，应复核 API、页面空态、筛选重置和移动端列表宽度。
