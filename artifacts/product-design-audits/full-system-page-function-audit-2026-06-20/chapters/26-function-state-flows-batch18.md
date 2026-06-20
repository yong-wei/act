# 功能状态流审计续篇（十八）

日期：2026-06-20
范围：真实 4-1 课堂发放作答、学生提交、教师汇总、参考答案切换、结束课堂、学生结束后入口、学生证据回流和教师结束后返回路径。
截图证据：`screenshots/53-function-state-flows-batch18/`。
采集清单：`screenshots/function-state-flows-batch18-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、按钮、图形元素、当前焦点、body text 和状态文本。本批使用真实 session：`cmqea1d3n001euwyfoi7b6pru`，课堂码 `129051`，目标页 `step-03`。

## 1. 覆盖范围

本轮新增 16 张截图和 16 份结构化 DOM/a11y 记录：

- 学生真实课堂运行态初始页和第 03 页发放前状态。
- 教师真实课堂运行态初始页、第 03 页发放前状态和发放作答后状态。
- 学生刷新后看到已发放作答卡、选择答案并提交。
- 教师刷新后看到学生提交汇总，并切换参考答案显示。
- 教师展开本页工具，点击“结束课堂”，接受原生确认。
- 学生在教师结束课堂后刷新运行态，进入个人学习证据页查看回流。
- 教师结束后当前路由、点击后续入口后的历史页，以及直接访问已结束 session 投影页的桌面状态。

数据库复核：

- `ClassSession cmqea1d3n001euwyfoi7b6pru` 已从 `ACTIVE` 变为 `FINISHED`。
- `endTime` 为 `2026-06-20T06:49:50.916Z`。
- `studentStepResponses` 出现 `step-03` 提交记录，`submittedAt` 为 `2026-06-20T06:49:41Z` 附近。

## 2. 发放作答与学生提交：功能可用，但状态播报不成立

证据：

- `screenshots/53-function-state-flows-batch18/02-student-step03-before-release-mobile.png`
- `screenshots/53-function-state-flows-batch18/04-teacher-step03-before-release-mobile.png`
- `screenshots/53-function-state-flows-batch18/05-teacher-step03-release-action-mobile.png`
- `screenshots/53-function-state-flows-batch18/06-student-step03-after-release-mobile.png`
- `screenshots/53-function-state-flows-batch18/07-student-step03-submit-result-mobile.png`
- 对应 `.a11y.json`

健康度：功能链路可跑通，但提交状态和读屏语义偏弱。

观察：

- 学生发放前看到“教师尚未发放本页作答卡，请先阅读上方证据”。
- 教师第 03 页可见“发放作答”“显示参考答案”和“学生提交汇总”。
- 点击发放后教师端按钮变为“已发放作答”。
- 学生刷新后看到三张作答卡和三个“提交答案”按钮。
- 学生选择第一题并提交后，第一张卡显示“已提交，可修改后重提”和“本卡已提交，修改后可以再次提交”。
- 本批 DOM 结构抽查中，上述发放、提交和提交结果页面 `alerts` 均为空，没有 `role=status`、`aria-live` 或 `role=alert`。

问题：

- P1：教师发放作答后只改变按钮文本，没有面向全班的“已发放到学生端”状态说明。
- P1：学生提交后只有卡片内短文案，缺少页面级完成状态、证据回流说明和读屏播报。
- P2：三张作答卡独立提交是合理设计，但页面没有明确“本页完成度 1/3”，学生容易误以为已经完成整页。

建议：

- 教师发放后显示短状态：“第 03 页作答已发放，学生刷新或同步后可提交”，并加入 `role="status"`。
- 学生提交后在作答区顶部显示“已提交 1/3，本次提交已写入课堂记录”，并加入 `aria-live="polite"`。
- 多卡页面需要统一完成度和下一步动作，例如“继续完成剩余 2 张卡”。

## 3. 教师汇总与参考答案：汇总可见，但缺少状态口径

证据：

- `screenshots/53-function-state-flows-batch18/08-teacher-step03-submission-summary-mobile.png`
- `screenshots/53-function-state-flows-batch18/09-teacher-step03-reference-answer-toggle-mobile.png`
- 对应 `.a11y.json`

健康度：教师可以看到提交变化，但讲评口径不足。

观察：

- 学生提交后教师刷新第 03 页，汇总区出现“已提交 1 人”。
- 参考答案切换能改变教师投影中的答案状态。
- DOM 结构记录中汇总和答案切换状态同样没有 live/status。
- 汇总以每张作答卡分散展示，缺少本页总提交人数、提交率、正确率和待讲评提示。

问题：

- P1：教师端汇总变化没有状态播报，投影或移动端操作后只能靠重新扫读页面确认。
- P2：教师讲评前缺少“本页 1 人提交、1/3 卡已提交、第一题错误”的摘要层。

建议：

- 教师端在汇总区顶部提供页级摘要：提交人数、完成卡数、需讲评题目。
- 参考答案显示/隐藏应给出投影可见状态，例如“参考答案已显示，仅教师投影可见/学生端不可见”。

## 4. 结束课堂：原生确认可执行，但结束后路径断裂

证据：

- `screenshots/53-function-state-flows-batch18/10-teacher-runtime-tools-before-end-mobile.png`
- `screenshots/53-function-state-flows-batch18/11-teacher-end-class-result-mobile.png`
- `screenshots/function-state-flows-batch18-manifest.json`
- 对应 `.a11y.json`

健康度：结束动作能落库，但 UX 风险较高。

观察：

- “结束课堂”藏在展开后的“本页工具”内。
- 点击后出现原生确认：“确定要结束课堂吗？结束后学生将停止同步课堂进度。”
- 接受确认后会话状态变为 `FINISHED`。
- 结束后教师被带到 `/teacher/lesson-plans`，页面是“教师工作台 / 我的教案”。
- 结束结果页没有“课堂已结束”“已生成记录”“去复盘/去历史/去报告”的成功状态。

问题：

- P1：结束课堂前没有展示当前在线人数、已提交人数、未提交学生、是否会生成复盘等影响范围。
- P1：结束后回到教案列表，教师难以确认刚才的课堂已经结束，也不知道下一步应看历史、统计还是复盘。
- P2：原生确认弹窗无法承载复杂课堂影响说明，也无法和平台视觉/可访问性状态一致。

建议：

- 用平台确认模态替换原生确认，展示课堂名、课堂码、在线人数、提交进度、结束影响和下一步。
- 结束成功后进入专门的课堂结束页，主动作应为“查看课堂复盘/课堂历史”，次动作返回教案。

## 5. 结束后学生与教师访问：结束态没有稳定入口

证据：

- `screenshots/53-function-state-flows-batch18/12-student-runtime-after-teacher-ended-mobile.png`
- `screenshots/53-function-state-flows-batch18/14-teacher-post-end-current-route-mobile.png`
- `screenshots/53-function-state-flows-batch18/15-teacher-post-end-review-click-result-mobile.png`
- `screenshots/53-function-state-flows-batch18/16-teacher-ended-session-desktop.png`
- 对应 `.a11y.json`

健康度：学生证据可查，但课堂结束态不稳定。

观察：

- 教师结束课堂后，学生刷新原课堂运行态，被带到 4-1 课程入口页。
- 学生入口页显示“输入课堂码加入课堂”，没有显示“课堂已结束，本次记录已保存”。
- 教师结束后停在教案列表；本批点击一个课堂相关入口后进入 `/teacher/history`。
- 直接访问已结束 session 的教师投影 URL 仍显示第 03 页、已发放作答、学生提交汇总和投影控制，首屏没有“课堂已结束”提示。

问题：

- P1：学生结束后没有稳定的课堂结束页，刷新旧运行态会回到课程入口，容易误以为需要重新输入课堂码。
- P1：教师直接访问已结束 session 投影页仍像直播课堂，可能误导教师继续投影或操作。
- P2：教师从结束成功到历史页之间没有清晰的刚结束课堂定位，历史列表需要能高亮刚结束记录。

建议：

- 学生端结束后应保留结束态页面：课堂已结束、提交已保存、查看学习证据、返回课程入口。
- 教师端已结束 session 应只读化，顶部显示结束时间、提交摘要和复盘入口，禁用继续发放/翻页等直播控制。
- 结束成功后携带 sessionId 到历史页，高亮最近结束课堂。

## 6. 学生证据回流：已进入证据页，但入口断裂

证据：

- `screenshots/53-function-state-flows-batch18/13-student-profile-evidence-after-submit-mobile.png`
- 对应 `.a11y.json`

健康度：证据回流成立，但应从课堂结束态直接抵达。

观察：

- `/profile/evidence` 显示“4-1 前测：同图异读预判”。
- 证据记录包含 `unit-4-1-design-task-expression-v1 · step-03`、课堂作答、参考答案、评分和“复盘课堂作答”动作。
- 因本批只提交了第一张卡，证据显示失败和未作答题项，符合数据状态。
- 学生结束后被带回课程入口，而不是被引导到这条证据。

问题：

- P1：提交证据已经回流，但课堂结束态没有把学生带到“查看本次证据”的动作。
- P2：证据页能展示题目级结果，但没有明显标记“来自刚结束课堂 129051”。

建议：

- 学生课堂结束页提供“查看本次课堂证据”按钮，带上 sessionId 或 lessonKey 过滤证据列表。
- 证据卡显示课堂码、课堂标题或结束时间，避免学生在多条课堂作答之间迷失。

## 7. 可访问性结论

本批真实课堂提交和结束链路可跑通，但关键状态变化都缺少可访问性闭环：

- 发放作答、提交答案、教师汇总和参考答案切换没有 live/status。
- 结束课堂使用原生确认，确认内容无法承载影响范围、提交摘要和下一步。
- 结束后学生、教师的页面跳转缺少状态说明。
- 已结束 session 仍可呈现直播投影界面，容易造成操作语义混乱。

下一批建议继续覆盖：

- 管理员数据治理课堂质量真实内容、风险处理动作、导出/刷新完成态。
- 批量导入选择真实文件后的预检、成功、失败行导出、撤销和通知链路。
- 教师历史页刚结束课堂的定位、课后复盘生成、报告导出和返回路径。
- 已结束课堂学生证据过滤、复盘课堂作答动作和证据详情页。
