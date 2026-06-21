# 功能状态流审计续篇（十二）

日期：2026-06-20
范围：截止后 Arena 发布报告、管理员统计页、学生成长页、教师班级分析页的图表与读屏语义扩展抽查。
截图证据：`screenshots/47-function-state-flows-batch12/`。
采集清单：`screenshots/function-state-flows-batch12-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、live region、SVG/canvas 命名和 fixed/sticky 浮层记录。

## 1. 覆盖范围

本轮新增 6 张截图和 6 份结构化 a11y 快照：

- 教师已截止 Arena 发布报告：桌面与移动端各一张。
- 管理员系统使用量统计页：`/admin/states`。
- 学生成长中枢：`/profile/growth`。
- 教师班级分析：`/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics` 与 `/analytics-v2`。

已截止 Arena 报告使用本地审计夹具：

- publicationId：`audit-publication-expired-full-system-2026-06-20`
- sourcePublicationId：`cmqluwvqo0001pmyf34og34jy`
- deadline：`2026-06-19T15:59:00.000Z`
- copiedSubmissions：2
- 标记：`config.auditFixture=true`

教师班级分析的 `/analytics` 实际落到 `/analytics-v2`，本轮将它记录为路由归并现象；两张截图不应视为两套独立体验。

## 2. 已截止 Arena 报告：有截止时间，没有截止后状态解释

证据：

- `screenshots/47-function-state-flows-batch12/01-teacher-arena-expired-report-desktop.png`
- `screenshots/47-function-state-flows-batch12/02-teacher-arena-expired-report-mobile.png`
- 对应 `.a11y.json`

健康度：报告可访问，但截止后语义不足。

观察：

- 页面显示截止时间为 `2026年6月19日 23:59`，当前采集时间已在截止后。
- 主标题仍是技术 id：`task-second-order-lead-pid`。
- 2 条复制提交都被计入有效提交，优秀方案数量为 2。
- 夹具提交被标记为 late，但页面没有展示“逾期提交”或“已截止后提交”的解释。
- 桌面和移动端均记录 `liveRegions: 0`，图标类 SVG 均无命名。

问题：

- P1：教师无法从报告首屏确认“该发布已截止”，只能自己比较日期。
- P1：逾期提交没有在报告中暴露，教师看不到哪些结果应纳入成绩、哪些只适合教学复盘。
- P1：0 分有效提交继续进入“优秀方案”，在截止后报告中更容易被理解为最终优秀成果。
- P2：移动端报告信息纵向堆叠可读，但控灵浮层仍压近优秀方案区域。

建议：

- 报告标题区应显示状态徽标：未开始、进行中、已截止、已归档。
- 提交列表和统计卡应拆分“有效且截止前提交 / 逾期提交 / 无效提交”。
- “优秀方案”应改名为“高分有效方案”或“可展示方案”，并过滤或标注 0 分和逾期提交。

整改记录：`audit-remediation-arena-classroom-evidence` 已在教师 Arena 报告中展示有效尝试、迟交、零分和无效提交口径；迟交和零分提交不会进入共享榜单、荣誉展示或优秀方案候选。已截止状态徽标和报告标题任务中文名仍未在本变更关闭。证据见 `../remediation/audit-remediation-arena-classroom-evidence/evidence.md`。

## 3. 管理员统计页：图表完整，但替代语义不完整

证据：

- `screenshots/47-function-state-flows-batch12/03-admin-states-chart-a11y.png`
- `screenshots/47-function-state-flows-batch12/03-admin-states-chart-a11y.a11y.json`

健康度：视觉统计完整，读屏替代摘要不足。

观察：

- 页面展示数据治理概览、用户规模、互动总量、仿真访问总量、月度访问趋势、模块访问占比、互动环节统计、仿真访问分项和学习活跃趋势。
- DOM 抽查记录 `chartCount: 34`，其中 `unlabeledCharts: 18`。
- 页面存在 5 个 live/status 区域，说明部分状态反馈已有语义基础。
- 控灵 fixed 浮层仍出现在页面结构末端，且压近图表区域边缘。

问题：

- P1：统计图对管理员判断很关键，但折线、饼图、柱状图缺少统一文本摘要。
- P2：页面“演示数据”标记视觉可见，但读屏用户需要明确听到哪些图表是演示数据、哪些是实时数据。
- P2：无名图标按钮仍会污染辅助技术的控件列表。

建议：

- 每个图表区域补 `aria-describedby` 指向短摘要，例如“月度访问总量从 15k 增至 35k，2026-02 最高”。
- 演示数据状态放入图表区标题或状态文本，而不只依赖角标。
- 统计页的控灵浮层应在读屏顺序中放到主内容之后，且图标按钮必须有可访问名称。

## 4. 学生成长页：诊断可见，但雷达/条形图仍缺等价文本

证据：

- `screenshots/47-function-state-flows-batch12/04-student-profile-growth-chart-a11y.png`
- `screenshots/47-function-state-flows-batch12/04-student-profile-growth-chart-a11y.a11y.json`

健康度：诊断信息可读，图表等价语义不足。

观察：

- 页面明确提示当前诊断处于降级状态，说明不会把低置信度内容伪装成真实分数。
- 能力雷达和能力详情条形图可见。
- DOM 抽查记录 `chartCount: 26`、`unlabeledCharts: 24`、`liveRegions: 0`。
- 下一步建议、成长档案时间线和证据链在同页可见。

问题：

- P1：能力雷达和条形图缺少可朗读摘要，读屏用户难以获得维度对比。
- P2：降级状态是关键风险提示，但没有 status/live 语义，状态更新后不会主动通知。
- P2：控灵 fixed 浮层继续进入焦点结构，对学生个人中心这种长页面形成重复干扰。

建议：

- 雷达图旁提供维度表：维度名、当前值、证据数、限制原因。
- 降级状态使用 `role="status"` 或固定文本区域，并和诊断卡建立语义关联。
- 建议卡和证据链应提供跳转锚点，帮助键盘用户绕过图表区域。

## 5. 教师班级分析：路由归并清楚，但长表格与图表语义压力很高

证据：

- `screenshots/47-function-state-flows-batch12/05-teacher-class-analytics-chart-a11y.png`
- `screenshots/47-function-state-flows-batch12/06-teacher-class-analytics-v2-chart-a11y.png`
- 对应 `.a11y.json`

健康度：信息量充足，辅助技术负担高。

观察：

- `/analytics` 最终 URL 为 `/analytics-v2`，两条路由指向同一新版班级学情页面。
- 页面显示 `2024自动化 · 143 名学生`，治理覆盖为 `135/143`。
- 页面有能力维度概览、画像等级分布、能力矩阵、长学生表格和底部重点学生信息。
- DOM 抽查记录 `chartCount: 120`、`unlabeledCharts: 60`，其中包含大量图标 SVG 和可视化标记。
- 长表格移动与读屏成本高，当前报告只覆盖桌面结构。

问题：

- P1：能力矩阵和学生长表格对教师决策重要，但缺少按维度/风险等级的文字摘要入口。
- P1：图标和可视化标记大量进入 SVG 统计，说明页面需要区分装饰图标、状态图标和核心图表语义。
- P2：`/analytics` 到 `/analytics-v2` 的路由归并没有在页面内说明，教师书签旧路径时不会知道已进入新版分析。

建议：

- 能力矩阵前增加“本班 3 个主要短板、3 名优先关注学生、覆盖缺口”的文本摘要。
- 装饰性图标使用 `aria-hidden="true"`；状态图标提供名称；核心图表提供标题、描述和数据表。
- 旧路径重定向到 v2 时保留轻量提示或在导航中统一只暴露一个入口。

## 6. 本轮结论

- 截止后 Arena 报告缺口已补证：页面显示截止日期，但没有显式“已截止/逾期提交/最终成绩口径”。
- 图表语义缺口已扩展到管理员统计、学生成长和教师班级分析：问题不只存在于 Arena 工作台和教师复盘。
- 全局控灵/浮层仍是跨角色、跨页面的读屏与焦点顺序风险；后续应从组件合同层统一治理，而不是逐页补丁。
