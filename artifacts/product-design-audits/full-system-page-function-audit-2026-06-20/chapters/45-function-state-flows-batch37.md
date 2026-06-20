# 功能状态流审计续篇（三十七）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：平台数据中心教师/管理员/学生角色状态、学生 `returnTo` 重定向、教师侧学生诊断/证据遗留路由跳转、规范学生详情/证据页和移动端数据中心/证据页。
截图目录：`screenshots/72-function-state-flows-batch37/`
Manifest：`screenshots/function-state-flows-batch37-manifest.json`
本批新增截图：14 张，全部带 DOM/a11y JSON 快照；关键步骤带焦点路径、真实 API 检查和路由响应。
账号：教师 `201300000012`、管理员 `admin`、学生 `demo`。
真实夹具：班级 `cmp1avdj30013e3jfje0h9aqp`，学生用户 `cmp1axwmk0014e3jfdn5p58kt`，学生姓名 `唐伟涵`。

## 1. 本批审计顺序

1. 教师打开 `/data-center`，检查数据中心展示、来源卡、图表和导出入口。
2. 教师点击数据中心“进入治理复核”，检查治理卡动作落点。
3. 教师点击“导出演示快照”，检查导出按钮与浮层关系。
4. 教师打开遗留 `/teacher/students/{studentId}/diagnosis`，检查跳转到规范学生详情页。
5. 教师在学生详情页点击“刷新数据”，检查刷新完成状态。
6. 教师打开遗留 `/teacher/students/{studentId}/evidence`，检查跳转到规范学生证据页。
7. 管理员打开 `/data-center`，检查同一数据中心表面在管理员角色下的动作。
8. 管理员点击“进入治理复核”，检查是否进入真实数据治理队列。
9. 学生打开 `/data-center`，检查默认拒绝后的学习证据落点。
10. 学生打开 `/data-center?returnTo=/dashboard`，检查内部 returnTo。
11. 学生打开 `/data-center?returnTo=https://example.com`，检查外部 returnTo 拒绝。
12. 学生打开教师诊断遗留路由，检查跨角色拒绝落点。
13. 移动端教师打开 `/data-center`，检查图表长页、导出按钮和浮层。
14. 移动端教师打开规范学生证据页，检查筛选和证据卡。

## 2. 数据中心角色边界

证据：

- `01-teacher-data-center-desktop.png`
- `07-admin-data-center-desktop.png`
- `09-student-data-center-default-redirect.png`
- `10-student-data-center-returnto-dashboard.png`
- `11-student-data-center-unsafe-returnto.png`
- `13-teacher-data-center-mobile.png`

API 与路由证据：

- 教师 `/api/auth/session` 返回 `role=TEACHER`。
- 管理员 `/api/auth/session` 返回 `role=ADMIN`。
- 学生 `/api/auth/session` 返回 `role=STUDENT`。
- 学生访问 `/data-center` 最终落到 `/profile/evidence`。
- 学生访问 `/data-center?returnTo=/dashboard` 最终落到 `/dashboard`。
- 学生访问外部 `returnTo=https://example.com` 最终落到 `/profile/evidence`。

观察：

- 教师和管理员都能打开同一套“平台数据中心”展示页，页面展示来源质量、新鲜度、隐私范围、状态图例、核心平台指标、月度趋势、模块结构和导出演示快照。
- 页面数据明确标注为“演示数据”，但指标卡、趋势图和导出区仍处在正式平台壳层中；用户能看见图表，但很难直接区分哪些数据可操作、哪些只是演示。
- 学生无法看到 `/data-center`，默认跳到 `/profile/evidence`，外部 returnTo 会被拒绝，内部 `/dashboard` returnTo 被接受。
- 学生被重定向后页面没有提示“数据中心仅教师/管理员可见”，用户只会看到学习证据或仪表盘。
- 移动端教师数据中心能完整显示来源卡、图表和导出按钮，但页面很长，底部控灵浮层贴近导出按钮。

问题：

- P1：学生访问数据中心被静默改道。默认落到学习证据，`returnTo=/dashboard` 落到仪表盘，但页面没有说明数据中心权限边界或替代入口。
- P1：数据中心演示数据与正式工作区边界不足。教师和管理员看到的是正式 AppShell 与正式指标卡，但主数据仍为演示场景。
- P2：移动端数据中心图表长页缺少章节锚点。教师需要滚过多张图表才能到达导出区，底部浮层又靠近主操作。

建议：

- 学生被拒绝后在目标页显示一次性提示，例如“数据中心仅教师/管理员可见，已转到你的学习证据”。
- 数据中心顶部应更明确地区分“演示数据/真实数据/受限数据”，并提供真实来源切换或治理状态入口。
- 移动端数据中心增加分区锚点或粘性目录，让教师能直接跳到来源质量、核心指标、图表和导出区。

## 3. 数据中心治理动作与导出

证据：

- `02-teacher-data-center-governance-link-target.png`
- `03-teacher-data-center-after-export-click.png`
- `08-admin-data-center-governance-link-target.png`

观察：

- 教师在数据中心点击“进入治理复核”后落到 `/teacher` 教师首页，而不是具体治理复核页面。
- 管理员点击同名动作后落到 `/admin/data-governance`，能看到数据治理看板、170 个待处理风险、3171 分钟数据新鲜度告警和风险清单。
- 教师点击“导出演示快照”时，Playwright 真实点击被右下控灵浮层截获；按钮可见且启用，但页面底部浮层占据同一区域，导致下载没有触发。
- 导出按钮没有成功/失败可见反馈，DOM 快照没有 `role=status` 或 `aria-live` 结果。

问题：

- P1：教师“进入治理复核”动作落点过于泛化。来源质量、隐私范围和状态图例都承诺治理复核，但教师只回到教师首页。
- P1：数据中心导出按钮被右下浮层干扰。桌面截图中按钮位于页面右下，控灵浮层与按钮区域重叠，真实点击没有产生下载。
- P1：导出操作缺少完成状态播报。下载成功、失败或被阻断时都没有页面内状态提示。
- P2：管理员治理落点正确，但风险清单仍是只读看板。进入治理页后能看到风险，但缺少就地处置、分派、忽略、导出或批量关闭动作。

建议：

- 教师治理链接应落到教师可用的复核页面，或明确说明教师只能查看聚合口径，管理员负责处置。
- 数据中心底部命令栏需要为全局浮层预留安全区；导出按钮应能被鼠标、触摸和键盘稳定触发。
- 导出完成后写入可见状态区，例如“已下载 data-center-snapshot-2025-2026.json”。
- 管理员治理页继续补风险处置动作，不要停在只读风险表。

## 4. 教师侧学生诊断与证据路由

证据：

- `04-teacher-legacy-diagnosis-redirect.png`
- `05-teacher-student-detail-after-refresh.png`
- `06-teacher-legacy-evidence-redirect.png`
- `12-student-legacy-teacher-diagnosis-denied.png`
- `14-teacher-student-evidence-mobile.png`

API 与路由证据：

- `/api/teacher/classes/cmp1avdj30013e3jfje0h9aqp/students/cmp1axwmk0014e3jfdn5p58kt/insights` 返回 200，学生 `唐伟涵`，综合指数 10，学习事实 1，风险标签“低风险”。
- `/api/teacher/classes/cmp1avdj30013e3jfje0h9aqp/students/cmp1axwmk0014e3jfdn5p58kt/evidence` 返回 200，证据 1 条，来源范围为 `Arena 预览结果`，缺失来源为“缺少官方 Arena 结果”。
- 教师访问 `/teacher/students/{studentId}/diagnosis` 最终落到 `/teacher/classes/{classId}/students/{studentId}`。
- 教师访问 `/teacher/students/{studentId}/evidence` 最终落到 `/teacher/classes/{classId}/students/{studentId}/evidence`。
- 学生访问教师诊断遗留路由最终落到 `/dashboard`。

观察：

- 教师遗留诊断路由能保留真实学生上下文并跳到规范学生详情页，页面显示班级、学生、综合指数、画像摘要、诊断、风险与证据摘要。
- 学生详情页有“刷新数据”，点击后页面保持同一学生上下文，但缺少明显的刷新中/刷新完成播报。
- 教师遗留证据路由能跳到规范证据页；证据列表显示 1 条“仿真操作证据”，来源为 Arena 预览结果，缺少官方 Arena 结果。
- 证据卡主动作是“留在学生证据审核”，但点击语义仍停留在当前证据浏览，没有形成审核、确认、标记缺失来源、分派补证或关闭的处置流。
- 学生访问教师遗留路由被拒绝后落到 `/dashboard`，同样没有说明“教师学生诊断不可访问”。
- 移动端证据页保留筛选栏和证据卡，但筛选项垂直占据大量空间，证据卡动作靠右，底部浮层仍接近内容区域。

问题：

- P1：教师学生详情刷新缺少完成状态。刷新是数据操作，但没有 `role=status` 或可见完成提示。
- P1：教师侧学生证据页仍缺审核闭环。证据卡已显示缺失官方 Arena 结果，但页面没有“确认缺失/请求补证/标记已处理/生成干预”的后续动作。
- P1：跨角色访问教师遗留路由被静默改道。学生落到 `/dashboard`，没有权限说明或安全事件提示。
- P2：移动端证据筛选占据首屏。筛选栏比证据卡更靠前，教师在手机上需要先处理筛选控件再看证据。

建议：

- 学生详情页刷新后显示更新时间、数据来源和完成状态。
- 证据页把“缺少官方 Arena 结果”转化为可处置项，给教师留痕动作。
- 学生越权访问被拒绝后，应在仪表盘或 toast 中说明权限边界。
- 移动端证据页默认收起筛选，优先展示证据卡、缺失来源和教师动作。

## 5. 本批新增优先问题

201. P1：学生访问数据中心被静默改道。
     `/data-center` 默认落到 `/profile/evidence`，`returnTo=/dashboard` 落到 `/dashboard`，但没有解释教师/管理员数据中心的权限边界。

202. P1：数据中心演示数据与正式工作区边界不足。
     页面在正式平台壳层内展示“演示场景生成的示例数据”，但缺少真实数据切换、数据不可用状态或更强的演示隔离标识。

203. P1：教师数据中心治理动作落点过于泛化。
     “进入治理复核”落到 `/teacher` 首页，而非具体数据治理、来源口径或复核任务页。

204. P1：数据中心导出按钮被全局浮层干扰。
     真实点击“导出演示快照”时右下控灵浮层截获指针事件，下载没有触发。

205. P1：数据中心导出缺少完成状态播报。
     无论下载是否触发，页面都没有 `role=status`、`aria-live` 或可见完成/失败提示。

206. P1：教师学生详情刷新缺少完成状态。
     点击“刷新数据”后仍保持原页面，但没有刷新中、完成、更新时间或错误恢复反馈。

207. P1：教师侧学生证据页仍缺审核处置闭环。
     证据卡显示“缺少官方 Arena 结果”，但没有确认、请求补证、标记已处理、生成干预或关闭动作。

208. P1：跨角色访问教师遗留路由被静默改道。
     学生访问 `/teacher/students/{studentId}/diagnosis` 最终落到 `/dashboard`，但没有权限说明。

209. P2：移动端数据中心长页缺少章节锚点。
     教师需要纵向滚动大量图表才能到达导出区，主命令与浮层靠得过近。

210. P2：移动端教师证据页筛选区优先级过高。
     筛选栏占据首屏左侧/上方主要空间，证据卡和处置动作被推后。

## 6. 本批脚本与统计备注

- 本批 manifest 为 14 张截图、14 条 DOM/a11y JSON、5 个 API 检查、0 条 errors、2 条 ignoredErrors。
- 2 条 ignoredErrors 均来自导出按钮点击：下载等待超时，以及控灵浮层截获指针事件；本批按产品体验问题记录，不按脚本失败处理。
- 本批没有修改业务数据，只检查角色路由、跳转、刷新、导出和浏览状态。
- 本批重新统计整份审计真实 PNG 数量后，当前总数为 810。
