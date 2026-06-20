# 功能状态流审计续篇（十七）

日期：2026-06-20
范围：真实课堂码加入、课程入口有效码加入、教师等待页复制与开课、教师投影本页工具/二维码/翻页、管理员模板下载与数据治理标签页。
截图证据：`screenshots/52-function-state-flows-batch17/`。
采集清单：`screenshots/function-state-flows-batch17-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、按钮、图形元素、当前焦点、body text 和状态文本。本批使用真实 active session：`cmqea1d3n001euwyfoi7b6pru`，课堂码 `129051`。

## 1. 覆盖范围

本轮新增 20 张截图和 20 份结构化 DOM/a11y 记录：

- 学生从 `/classroom/join?code=129051` 进入扫码/链接课堂加入页。
- 学生在课堂加入页第一次点击和第二次点击后的不同结果。
- 学生在 4-1 课程入口输入真实课堂码并进入运行态。
- 教师真实课堂等待页、复制课堂码、复制加入链接、点击开始上课。
- 教师投影运行态本页工具展开、二维码弹窗、复制课堂码、下一页。
- 管理员用户页模板下载。
- 管理员数据治理课堂质量、证据源、缓存健康标签页和桌面总览。

## 2. 学生加入课堂：课程入口直接成功，扫码入口多一步

证据：

- `screenshots/52-function-state-flows-batch17/01-student-classroom-join-prefilled-mobile.png`
- `screenshots/52-function-state-flows-batch17/02-student-classroom-join-result-mobile.png`
- `screenshots/52-function-state-flows-batch17/03-student-course-entry-valid-code-filled-mobile.png`
- `screenshots/52-function-state-flows-batch17/04-student-course-entry-valid-code-result-mobile.png`
- `screenshots/52-function-state-flows-batch17/17-student-classroom-join-second-step-result-mobile.png`
- 对应 `.a11y.json`

健康度：真实课堂码链路可进入课堂，但扫码/链接入口的步骤表达不清。

观察：

- `/classroom/join?code=129051` 能预填 6 位课堂码并找到课堂，首屏显示课堂信息和“加入课堂”。
- 第一次点击后页面仍停留在 `/classroom/join?code=129051`，截图显示按钮回到“查询课堂”，没有进入运行态，也没有解释“已找到课堂，请再次加入”。
- 第二次点击“加入课堂”后进入 `/interactive-learning/courses/unit-4-1-design-task-expression/student/cmqea1d3n001euwyfoi7b6pru`。
- 从课程入口页直接输入 `129051` 并点击“加入课堂”会一次进入学生运行态。
- 学生运行态显示“已加入课堂 cmqea1d3n001euwyfoi7b6pru”，把 raw sessionId 直接暴露给学生。
- 第二次进入时学生端显示第 02 页“本次课程目标”，与教师端已推进后的当前页同步。

问题：

- P1：扫码/链接入口是两步动作，但界面没有把“查询课堂”和“确认加入”分开说明，第一次点击后缺少状态反馈。
- P1：学生运行态显示 raw sessionId，学生需要的是课堂码、课程名或班级名，不是内部会话 id。
- P2：学生被同步到教师当前页是合理课堂行为，但页面缺少“已同步到教师当前进度”的解释。

建议：

- `/classroom/join?code=...` 预填并查到课堂后，应直接显示确认态文案：课程名、教师、课堂码、加入按钮；点击加入后立即进入运行态或显示可恢复错误。
- 学生运行态把 `sessionId` 替换为课堂码、课堂标题或班级名，内部 id 只保留在调试日志。
- 同步到第 02 页时显示短状态：“已加入课堂，当前跟随教师进度：第 02 页”。

## 3. 教师等待页与投影页：真实 session 可用，状态播报不足

证据：

- `screenshots/52-function-state-flows-batch17/05-teacher-waiting-real-session-mobile.png`
- `screenshots/52-function-state-flows-batch17/06-teacher-waiting-copy-code-feedback-mobile.png`
- `screenshots/52-function-state-flows-batch17/07-teacher-waiting-copy-link-feedback-mobile.png`
- `screenshots/52-function-state-flows-batch17/08-teacher-waiting-start-class-result-mobile.png`
- `screenshots/52-function-state-flows-batch17/11-teacher-runtime-next-page-mobile.png`
- 对应 `.a11y.json`

健康度：等待页和真实投影页可执行，但复制、开课和翻页反馈仍偏轻。

观察：

- 真实等待页显示课堂码 `129051`、二维码区域、已加入学生 1 人、等待开始状态和“开始上课”。
- 点击“复制课堂码”后页面出现“课堂码已复制”；点击“复制加入链接”后页面出现“加入链接已复制”。
- 两个复制反馈在结构记录里没有 `role="alert"`、`role="status"` 或 `aria-live`。
- 点击“开始上课”后进入教师投影运行态，URL 已切到 `/teacher/cmqea1d3n001euwyfoi7b6pru`。
- 教师投影点击“下一页”后显示第 02 页，本轮后续学生加入也跟随到第 02 页。

问题：

- P1：等待页复制反馈是可见文本，但读屏和键盘用户缺少可靠播报。
- P1：开课动作进入投影后缺少“课堂已开始，1 名学生在线”的成功状态。
- P2：翻页成功只能通过标题和页码变化判断，缺少轻量状态播报。

建议：

- 复制、开课、翻页统一使用 `role="status"` 或 `aria-live="polite"`，并在状态文本中包含动作对象。
- 教师投影顶部加入短时成功提示：“课堂已开始，当前在线 1 人”。
- 翻页后播报“已切到第 02 页：本次课程目标”。

## 4. 教师投影本页工具：二维码藏得较深，但展开后可用

证据：

- `screenshots/52-function-state-flows-batch17/18-teacher-runtime-local-tools-expanded-mobile.png`
- `screenshots/52-function-state-flows-batch17/19-teacher-runtime-local-tools-qr-dialog-mobile.png`
- `screenshots/52-function-state-flows-batch17/20-teacher-runtime-local-tools-copy-feedback-mobile.png`
- 对应 `.a11y.json`

健康度：功能存在，但移动端发现成本和反馈语义不足。

观察：

- 教师投影页默认只显示“本页工具 默认折叠”；二维码入口在展开后的教师课堂台中。
- 展开后可看到课堂码、二维码、结束课堂、当前在线学生和页面知识卡片。
- 点击“二维码”后弹窗显示课堂二维码、课堂码 `129051`、复制课堂码、复制链接和加入链接。
- 弹窗内点击“复制课堂码”后显示“课堂码已复制”，但结构记录仍没有 alert/live 语义。

问题：

- P1：课堂中途需要让学生加入时，二维码入口默认隐藏在折叠工具里，教师在投影移动端不一定能快速找到。
- P1：弹窗内复制反馈没有 status 语义。
- P2：弹窗关闭按钮为英文 `Close`，与中文课堂界面不一致。

建议：

- 课堂投影顶部保留一个轻量“课堂码/二维码”入口，折叠工具内再提供完整教师课堂台。
- 弹窗复制反馈加入 `role="status"`，并把关闭按钮本地化为“关闭”。
- 默认折叠摘要应显示关键状态，例如“本页工具：课堂码、二维码、结束课堂”。

## 5. 管理员：模板下载可触发，数据治理标签页信息充足但状态不足

证据：

- `screenshots/52-function-state-flows-batch17/12-admin-users-template-download-mobile.png`
- `screenshots/52-function-state-flows-batch17/13-admin-data-governance-class-quality-tab-mobile.png`
- `screenshots/52-function-state-flows-batch17/14-admin-data-governance-sources-tab-mobile.png`
- `screenshots/52-function-state-flows-batch17/15-admin-data-governance-cache-tab-mobile.png`
- `screenshots/52-function-state-flows-batch17/16-admin-data-governance-overview-desktop.png`
- 对应 `.a11y.json`

健康度：后台治理信息覆盖较强，但下载、切换和移动端阅读仍不够稳定。

观察：

- 点击“下载模板”触发浏览器下载事件，文件名为 `users-template.xlsx`。
- 用户页没有显示“模板下载已开始/失败/完成”的可见状态。
- 数据治理移动页能展示系统状态、数据新鲜度、学习事实、风险、课堂质量和标签页。
- 点击“课堂质量”后本次截图仍停留在总览内容，未观察到明确标签切换；点击“证据源”和“缓存健康”能切到对应内容。
- 证据源页展示 dry-run 命令、目录源、可贡献源、样本行数和来源明细。
- 缓存健康页展示缓存条目、待刷新、源事实、重建次数、最近刷新和缺失数量。
- 桌面总览比移动端更可读，但风险清单仍保留长表格和内部 id。

问题：

- P1：模板下载只依赖浏览器下载，没有页面内成功/失败状态。
- P1：数据治理“课堂质量”标签点击结果不明确，移动端用户难以判断当前标签是否生效。
- P1：数据治理移动端风险和证据源表格仍以长字段、内部 id 和密集列为主。
- P2：证据源与缓存页给出大量治理数据，但缺少“下一步处理什么”的优先级。

建议：

- 下载模板后显示状态：“模板下载已开始：users-template.xlsx”，失败时给重试和模板字段说明。
- 标签页应有明确 selected 状态、标题同步和 `aria-selected`/键盘切换语义。
- 移动端把风险、证据源和缓存项改为卡片摘要，内部 id 放入展开详情。
- 治理页顶部加入“当前最需要处理的 3 件事”，把风险、证据源缺口和缓存缺失转成行动顺序。

## 6. 可访问性结论

本批确认真实课堂链路可以跑通，但状态变化播报仍是系统性短板。

- 课堂加入第一次查询、第二次加入之间缺少清晰状态和读屏播报。
- 教师等待页复制、教师投影复制、开课和翻页都缺少 live/status。
- 管理员模板下载和数据治理标签切换缺少完成/切换播报。
- 课堂运行态仍存在全局浮层和内部 id 暴露风险。

下一批建议继续覆盖：

- 真实加入课堂后的提交、保存和课后证据回流。
- 教师课堂结束、学生被结束态同步、课后复盘生成和返回路径。
- 管理员数据治理课堂质量真实标签页内容、风险处理动作和导出/刷新完成态。
- 批量导入选择真实文件后的预检、成功、失败行导出、撤销和通知链路。
