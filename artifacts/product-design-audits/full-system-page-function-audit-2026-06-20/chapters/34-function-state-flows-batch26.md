# 功能状态流审计续篇（二十六）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：教师 Arena 正式发布、学生挑战榜单、教师发布报告、active/expired publication 状态。
截图目录：`screenshots/61-function-state-flows-batch26/`
Manifest：`screenshots/function-state-flows-batch26-manifest.json`
本批新增截图：10 张，全部带 DOM/a11y JSON 快照。
教师账号：`201300000012`，张永韡。
学生账号：`demo`。
班级：`cmma7g0590004g9q2nl2jyzdf`，`2024自动化`。
active publication：`cmqluwvqo0001pmyf34og34jy`。
expired publication：`audit-publication-expired-full-system-2026-06-20`。

## 1. 本批审计顺序

本批复用已有 Arena 真实发布和提交记录，不新建发布、不提交评测：

1. 教师进入 `/teacher/arena`，检查发布配置、发布预览和已发布挑战列表。
2. 教师查看 active publication 报告。
3. 教师查看 expired publication 报告。
4. 学生进入 `/arena`，检查挑战大厅和榜单入口。
5. 学生进入 active publication challenge。
6. 学生进入 expired publication challenge。
7. 调用教师发布列表 API、学生 publication submissions API 和任务全局 submissions API。
8. 补教师配置页、教师报告和学生 challenge 的移动端状态。

## 2. 教师发布配置与已发布挑战列表

证据：

- `01-teacher-arena-publications-list-desktop.png`
- `07-teacher-arena-publications-list-mobile.png`
- `function-state-flows-batch26-manifest.json`

观察：

- 教师发布配置页能展示配置模板、挑战任务、班级范围、可见性、截止时间、榜单策略、硬约束和指标权重。
- 页面底部“已发布挑战”列出 3 条 active publication，并提供“查看报告”“暂停”“重开”“归档”动作。
- 已发布挑战列表中 taskId 可见，但班级显示为内部 id `cmma7g0590004g9q2nl2jyzdf`，未显示 `2024自动化` 或班级码 `ZXVBP6`。
- active publication 与 expired publication 都显示为 `active`，列表层没有突出已截止、逾期提交或最终榜单状态。
- 教师发布预览区仍默认使用 `class-2026-control`，与真实班级发布列表中的 `2024自动化` 不一致。

API 证据：

- `/api/teacher/arena/publications?status=active` 返回 200，共 3 条 active publication，包含 active 与 expired 两个审计 publication。
- `/api/teacher/arena/publications/cmqluwvqo0001pmyf34og34jy/status` 用 GET 返回 405；本批只确认该 endpoint 不支持只读 GET。

问题：

- P1：已发布挑战列表暴露内部 classId。教师需要看到班级名、班级码和学生范围，而不是 `cmma...`。
- P1：已截止 publication 在列表中仍与 active publication 同级呈现。教师无法从列表判断哪条已经截止、是否有逾期提交、是否应结算榜单。
- P2：发布预览默认班级仍是 `class-2026-control`。真实发布列表和预览上下文不一致，容易让教师误发布到错误班级。

建议：

- 已发布挑战列表显示班级名、班级码、截止状态、提交数、逾期数、最后提交时间和报告生成状态。
- expired publication 需要单独状态标签：已截止、最终榜单、逾期提交已排除或保留。
- 发布预览默认班级应来自教师真实班级或明确要求选择，不能保留不存在的静态 id。

## 3. 教师 Arena 发布报告

证据：

- `02-teacher-arena-publication-report-active-desktop.png`
- `03-teacher-arena-publication-report-expired-desktop.png`
- `08-teacher-arena-publication-report-mobile.png`

观察：

- active 报告展示参与情况 `1/1`、提交次数 `2`、有效提交率 `100%`、平均分 `0`、优秀方案 `2`、薄弱指标和课堂复盘。
- 报告标题为 taskId `task-second-order-lead-pid`，副标题显示内部 classId、截止日期和 `course`。
- 报告里“个人最佳”和“优秀方案”都把 `demo` 的 0 分有效提交列为优秀方案；报告说明为“按有效提交分数排序”。
- 课堂复盘区说明“当前发布不强制隐藏完整榜单，报告仍区分官方评价结果与作业评价解释”，但没有导出、发送给学生、锁定最终榜单或发布讲评动作。
- expired 报告和 active 报告视觉结构几乎一致，页面没有突出“已截止”“逾期提交”“最终成绩口径”。
- 移动端报告能纵向呈现所有卡片，但任务名和内部 id 占据首屏，主要动作仍只有“返回竞技场配置”。

问题：

- P1：发布报告标题和班级上下文过度内部化。教师看到 taskId 和 classId，而不是任务中文名、班级名、截止状态。
- P1：0 分有效提交被列为优秀方案。报告没有区分“有效但表现差”“硬约束通过但低分”和“优秀方案”。
- P1：报告缺少交付和结算动作。教师无法导出、发送、锁定榜单、发布讲评或生成补练。
- P1：expired report 没有清晰截止/逾期口径。已截止和未截止报告几乎一样，教师无法判断最终榜单和逾期提交处理。

建议：

- 报告页标题使用任务中文名和班级名，内部 id 移到 debug metadata。
- 优秀方案应设置最低分或满足度阈值，0 分有效提交只能进入“有效提交/待改进方案”。
- 报告顶部加入结算动作：导出报告、发送给学生、锁定最终榜单、发布讲评、生成补练。
- expired report 应突出截止时间、最终提交数、逾期提交数和是否计入榜单。

## 4. 学生 Arena 挑战与榜单

证据：

- `04-student-arena-hall-desktop.png`
- `05-student-arena-publication-challenge-desktop.png`
- `06-student-arena-expired-publication-challenge-desktop.png`
- `09-student-arena-publication-challenge-mobile.png`
- `10-student-arena-expired-publication-challenge-mobile.png`

观察：

- 学生 Arena 大厅能展示挑战入口、筛选和榜单语义。
- 学生进入 active publication challenge 后，页面展示“二阶对象快速稳定挑战”、进入控制工作台、榜单摘要、当前榜单和优秀方案展示。
- 页面右侧榜单摘要显示最高分 `0.0`、参与人数 `1 人`、提交次数 `2 次`、榜单类型 `主榜 / 方法榜 / 指标榜`。
- 学生端 active 与 expired publication challenge 截图视觉完全相同，页面没有明显显示 publicationId、班级、截止日期、是否逾期、最终榜单或是否还能提交。
- 学生端优秀方案展示中，0 分提交拥有“首个达标”“低能耗”“最快响应”等标签，和实际 `0` 分表现冲突。
- 移动端学生 challenge 首屏能看到任务、进入控制工作台和榜单，但 publication 状态、截止时间和班级归属仍不可见。

API 证据：

- `/api/arena/submissions?taskId=task-second-order-lead-pid&publicationId=cmqluwvqo0001pmyf34og34jy` 返回 200，2 条 submissions，viewerUserId 为 demo 学生。
- `/api/arena/submissions?taskId=task-second-order-lead-pid&publicationId=audit-publication-expired-full-system-2026-06-20` 返回 200，2 条 submissions，且 submissions 为 `isLate=true`。
- `/api/arena/submissions?taskId=task-second-order-lead-pid` 返回 200，9 条 submissions，同时包含 active 与 expired publication。

问题：

- P1：学生端 active/expired publication 无可见区别。即使 API 返回 expired submissions 为 `isLate=true`，页面仍不显示截止或逾期状态。
- P1：学生 challenge 页面缺少班级/作业归属。学生无法确认这是 `2024自动化` 的哪次正式发布。
- P1：0 分提交获得正向优秀方案标签。榜单摘要和优秀方案会误导学生以为 0 分方案值得学习。
- P2：任务全局 submissions 会混入不同 publication。全局 challenge 页面可见 9 条 submissions，学生需要更清晰区分公开榜、班级榜、作业榜和过期榜。

建议：

- 学生 challenge 顶部加入 publication context：班级名、教师、截止时间、提交状态、是否已截止、是否允许补交。
- expired publication 应显示最终榜单或已截止状态，并明确 late submissions 是否计入。
- 优秀方案标签必须与分数/满足度阈值一致，0 分方案应标为“有效但待改进”。
- 全局榜单和班级 publication 榜单使用清晰的 tabs、来源标签和筛选说明。

## 5. 本批新增优先问题

105. P1：教师 Arena 已发布列表暴露内部 classId。
     已发布挑战只显示 `cmma...`，没有 `2024自动化`、班级码、学生范围和提交状态。

106. P1：已截止 Arena publication 在列表中仍像 active。
     expired publication 仍以 active 条目呈现，没有已截止、逾期提交、最终榜单或结算状态。

107. P1：教师 Arena 报告标题和上下文过度内部化。
     报告主标题是 taskId，副标题是 classId；教师不能直接识别任务中文名和班级。

108. P1：0 分有效提交被列为优秀方案。
     active/expired 报告和学生挑战页都把 0 分方案放入优秀方案或正向标签。

109. P1：Arena 发布报告缺少交付和结算动作。
     报告有参与、提交、分数和课堂复盘，但没有导出、发送、锁榜、发布讲评或生成补练。

110. P1：学生端 active/expired publication 无明显差异。
     expired publication API 返回 late submissions，但学生挑战页与 active 视觉一致。

111. P1：学生 Arena challenge 缺少班级/作业归属。
     学生看不到 `2024自动化`、教师、截止时间和是否正式作业发布。

112. P2：全局榜单、班级榜和作业榜来源边界不清。
     任务全局 API 返回 9 条 submissions，publication API 各返回 2 条，但页面需要更明确的来源标签和筛选说明。

## 6. 本批脚本与统计备注

- 本批 manifest 为 10 张截图、10 条结果、5 个 API 检查、0 条错误、0 条 ignoredErrors。
- 本批没有新建 publication、没有修改 publication 状态、没有提交 Arena 评测。
- 本批重新统计整份审计真实 PNG 数量后，预期总数为 699。
