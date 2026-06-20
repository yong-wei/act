# 功能状态流审计续篇（十一）

日期：2026-06-20
范围：课堂加入、Arena 工作台、教师复盘页的可访问性与读屏语义抽查。
截图证据：`screenshots/46-function-state-flows-batch11/`。
采集清单：`screenshots/function-state-flows-batch11-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、live region、SVG/canvas 命名和 accessibility snapshot。

## 1. 覆盖范围

本轮新增 3 张功能状态截图和 3 份结构化 a11y 快照：

- 学生课堂加入页：`/classroom/join`，输入不存在的 6 位课堂码。
- 学生 Arena 官方工作台：`/interactive-learning/control-workbench?publicationId=cmqluwvqo0001pmyf34og34jy&preset=multi-representation-linkage&arenaTask=task-second-order-lead-pid`。
- 教师真实已结束课堂复盘页：`/classroom/teacher/cmplw3180000kuhvl8qzopj5j/review`，课堂含 82 条 student state、494 条 step response、81 份学生报告。

本轮不是完整 WCAG 审计，只针对前几轮报告中缺证的三类关键面：表单错误 live region、图表替代文本和全局浮层读屏顺序。

## 2. 课堂加入错误态：可见，但不会被主动播报

证据：

- `screenshots/46-function-state-flows-batch11/01-student-classroom-join-invalid-a11y.png`
- `screenshots/46-function-state-flows-batch11/01-student-classroom-join-invalid-a11y.a11y.json`

健康度：视觉错误态成立，读屏错误反馈不足。

观察：

- 输入 `111111` 后，页面显示红色错误提示“未找到该入会码对应的课堂”。
- 错误提示位于输入框和“查询课堂”按钮之间，视觉位置清楚。
- DOM 抽查记录 `liveRegions: []`，错误节点没有 `role="alert"`，也没有 `aria-live`。
- 全局控灵浮层作为 fixed 元素出现在页面末端，包含可聚焦按钮和输入框。

问题：

- P1：课堂码错误只靠视觉颜色和位置反馈，读屏用户不会在查询后被主动告知错误。
- P2：当前页面存在两个无可访问名称按钮，来源为全局浮层/辅助控制；读屏顺序可能先遇到无名控件。

建议：

- 错误容器应使用 `role="alert"` 或 `aria-live="polite"`，并通过 `aria-describedby` 绑定课堂码输入框。
- 全局控灵浮层的关闭、展开、发送等图标按钮必须有稳定 `aria-label`，并避免在主表单提交后抢占读屏上下文。

## 3. Arena 官方工作台：图表信息丰富，但结构语义不足

证据：

- `screenshots/46-function-state-flows-batch11/02-student-arena-workbench-a11y.png`
- `screenshots/46-function-state-flows-batch11/02-student-arena-workbench-a11y.a11y.json`

健康度：视觉信息完整，图表读屏语义不成立。

观察：

- 工作台保留官方评价上下文、任务目标、提交按钮、指标卡、时域响应、Bode、根轨迹、Nyquist、设计流程和提交流。
- DOM 抽查记录 `unlabeledCharts: 30`，大量 `svg` 没有 `role`、`aria-label`、`title` 或 `desc`。
- “未达标”状态以文本出现，但没有 live region。
- fixed 元素包含“打开参数抽屉”和控灵浮层；控灵浮层在页面结构中带入可聚焦输入与按钮。

问题：

- P1：时域、Bode、根轨迹和 Nyquist 图是完成任务的核心证据，但图表 SVG/canvas 未提供替代文本或数据摘要。
- P1：提交结果中的达标/未达标状态没有通过 live region 传递，键盘或读屏用户需要重新遍历页面才能发现变化。
- P2：全局控灵浮层和参数抽屉按钮进入焦点序列，但与当前 Arena 任务的主路径关系不清。

建议：

- 每个图表组件提供屏幕阅读摘要，例如“阶跃响应最终值、超调量、调节时间、是否满足约束”。
- 状态变化区域使用 `role="status"` 或 `aria-live="polite"`，提交完成后将焦点移至结果摘要。
- 工作台浮层入口应有明确名称和区域归属，避免读屏用户把辅助工具误认为任务必填步骤。

## 4. 教师复盘页：报告可读，但图表与下降解释缺少等价语义

证据：

- `screenshots/46-function-state-flows-batch11/03-teacher-session-review-a11y.png`
- `screenshots/46-function-state-flows-batch11/03-teacher-session-review-a11y.a11y.json`

健康度：复盘内容可见，图表与异常值解释不足。

观察：

- 页面展示课堂状态、课堂记录人数、互动日志人数、提交人数、课程聚焦、课前/课后能力追踪、个性化补强路径、学生摘要和雷达图。
- DOM 抽查记录 `unlabeledCharts: 9`，其中包含雷达图与图标 SVG。
- 五个能力维度均显示 `-39`，但红色下降值没有结构化解释、数据口径或 live/status 语义。
- 页面底部有“前往评审聚合入口”，但复盘主流程没有导出、返回历史、回到教案等教师下一步入口。

问题：

- P1：能力雷达图缺少等价文本，教师使用读屏时无法获得课前/课后能力变化的完整摘要。
- P1：`-39` 这类关键异常值只作为视觉文本存在，缺少口径解释、数据来源和是否可信的说明。
- P2：控灵浮层继续进入 fixed 结构，报告页面没有定义其与复盘主内容的读屏顺序关系。

建议：

- 雷达图旁提供表格化摘要：维度、课前均值、课后均值、变化、样本数、置信或降级状态。
- 对下降幅度增加口径说明，至少说明来自哪些学生、哪些记录、是否受缺失提交影响。
- 教师复盘的下一步入口应进入主内容语义区域，而不是仅依赖页面底部按钮。

## 5. 本轮结论

- 课堂加入、Arena 工作台和教师复盘三处均已补实际截图与结构化 a11y 证据。
- 当前关键结论不是“缺少截图”，而是“可见状态存在，但读屏和键盘用户获得的状态变化、图表含义、浮层顺序不完整”。
- 全站 a11y 风险应继续保留为 P1：表单错误缺少 live region，核心图表缺少替代文本，全局控灵/浮层存在无名按钮与读屏顺序风险。
