# 功能状态流审计续篇（三十二）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：跨角色可访问性、键盘路径、错误播报、刷新/下载状态、图表替代文本、弹窗焦点和全局工具浮层读屏顺序。
截图目录：`screenshots/67-function-state-flows-batch32/`
Manifest：`screenshots/function-state-flows-batch32-manifest.json`
本批新增截图：10 张，全部带 DOM/a11y JSON 快照和 Tab 焦点路径。
账号：学生 `demo`，教师 `201300000012`，管理员 `admin`。

## 1. 本批审计顺序

1. 访客注册页提交短密码，记录 runtime 错误、表单语义和 Tab 路径。
2. 学生访问 `/classroom/join?code=999999`，记录无效课堂码错误与焦点路径。
3. 学生打开自适应学习路径中心，检查路径动作、练习入口和状态播报。
4. 学生打开 4-1 课堂证据筛选页，检查证据错误态、复盘动作和焦点顺序。
5. 教师打开班级分析页，检查图表/矩阵语义、刷新状态和焦点顺序。
6. 教师打开班级添加学生弹窗，检查 dialog 语义和焦点陷阱。
7. 教师打开教案编排器并输入无结果资源搜索，检查搜索空态和拖拽等价操作。
8. 管理员刷新数据治理页，检查完成状态和风险表语义。
9. 管理员打开用户管理页，检查批量导入上传语义和模板下载状态。
10. 访客打开内部 review 移动页，检查是否可作为移动验收证据。

## 2. 表单错误与加入课堂

证据：

- `01-register-short-password-a11y-desktop.png`
- `02-classroom-join-invalid-code-a11y-desktop.png`

观察：

- 注册页短密码提交后仍触发 Next Runtime Error overlay，错误为 `Objects are not valid as a React child (found: object with keys {formErrors, fieldErrors})`。
- manifest 将该 pageerror 记录为 ignoredError，因为它正是本批审计对象。
- 注册页 Tab 顺序从“创建账号”进入登录链接后，直接进入 Next portal、全局 AI 关闭按钮、全局 AI 输入框和工具菜单。
- 课堂加入页展示“未找到该入会码对应的课堂”，但 DOM 没有 `role=alert`、`aria-live` 或 `role=status`。
- 课堂加入页 Tab 顺序从“查询课堂”后进入 Next portal 和全局 AI 控件，而不是优先回到错误提示、课堂码输入框或恢复动作。

问题：

- P0：注册短密码仍把普通校验错误升级为运行时错误页。用户看不到字段级密码规则，页面也失去正常表单恢复路径。
- P1：课堂码错误缺少可访问播报。视觉上有红色错误条，但读屏和键盘用户无法得到明确错误公告。
- P1：公开表单的键盘路径被全局工具打断。注册和课堂加入都在核心任务完成前进入全局 AI portal，降低表单完成效率。

建议：

- 注册 API 错误需要统一归一化为字符串字段错误，并将密码错误绑定到密码输入框的 `aria-describedby`。
- 课堂加入错误区应使用 `role=alert` 或 `aria-live="polite"`，并将查询按钮失败后的焦点留在输入框或错误摘要附近。
- 全局控灵应在表单主任务之后进入 Tab 顺序，或提供跳过/延后焦点策略。

## 3. 学生路径、练习与证据复盘

证据：

- `03-adaptive-practice-action-a11y-desktop.png`
- `04-profile-evidence-filtered-a11y-desktop.png`

API 证据：

- `/api/learning-paths/latest?goal=control-correction` 返回 200。

观察：

- 自适应学习路径中心显示“路径顾问准备中”“查看学习证据”“展开练习题”，右侧仍显示当前建议和本周完成 24%。
- 本批 DOM 没有发现可直接选择并提交的练习题控件，提交动作记录为 `not-found`。
- 个人证据页能显示 4-1 课堂作答失败证据、参考答案、评分和“复盘课堂作答”动作。
- 个人证据页 Tab 顺序先进入全局 AI 输入框、工具按钮和整页 body，再进入“学生驾驶舱”“个人中心”等导航；证据卡和复盘动作没有成为优先键盘目标。

问题：

- P1：自适应练习入口不等于可执行练习。页面提示资源已准备，但未展开为可键盘选择、提交和播报结果的题目状态。
- P1：证据复盘页键盘顺序与用户任务不一致。用户进入筛选后的证据页，焦点优先落入全局 AI，而不是筛选结果、证据卡、错误题或复盘动作。
- P1：证据页失败/需修正状态没有结构化 alert/status。页面有“失败”“需修正”，但缺少面向读屏的结果摘要。

建议：

- 自适应练习应把“展开练习题”后的题目区纳入可验证状态，并为提交结果提供 `role=status`。
- 证据页应在筛选结果变化后播报结果数、失败题数、当前证据来源和下一步复盘动作。
- 进入带 `lessonId` 的证据页时，首个键盘目标应是结果摘要或第一条证据，而不是全局 AI。

## 4. 教师图表、弹窗与编排器

证据：

- `05-teacher-class-analytics-chart-a11y-desktop.png`
- `06-teacher-add-students-modal-focus-a11y-desktop.png`
- `07-teacher-lesson-builder-empty-search-a11y-desktop.png`

API 证据：

- `/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics` 返回 200。

观察：

- 班级分析页有治理覆盖、能力维度、画像等级、能力矩阵和重点学生，页面很长，Tab 路径先进入全局 AI，再进入整页 body。
- 班级分析页刷新入口存在，但 DOM 没有 live/status 完成播报。
- 添加学生弹窗视觉上打开了遮罩和候选列表，但 DOM 快照中 `dialogs=[]`，说明没有 `role=dialog`、`dialog` 或 `aria-modal=true`。
- 添加学生弹窗打开后，Tab 路径仍进入背景学生列表、详情链接和删除按钮，未被限制在弹窗内部。
- 教案编排器的资源搜索输入 `zzzz-no-resource` 后，左侧没有清楚的“0 个资源”状态，主区域仍是拖拽式 BOPPPS 编排卡。

问题：

- P1：教师添加学生弹窗没有 dialog 语义和焦点陷阱。键盘用户会直接进入背景列表和删除按钮，这是高风险操作面。
- P1：教师班级分析的图表/矩阵刷新缺少状态播报。页面是报告型长页，但刷新、覆盖不足和重点学生排序没有可访问摘要。
- P1：教案编排器搜索空态和拖拽等价操作不足。无结果搜索没有明确播报；拖拽把手可见，但未证明存在键盘排序或替代添加路径。
- P2：教师长页中全局 AI 过早进入焦点顺序。班级分析和编排器都应优先服务当前页面任务。

建议：

- 弹窗必须加 `role=dialog`、`aria-modal=true`、标题引用和焦点陷阱；关闭后焦点回到“添加学生”按钮。
- 班级分析应提供图表数据表/摘要、刷新完成播报和重点学生排序说明。
- 教案编排器应提供“无资源结果”状态、键盘添加资源到阶段、阶段内上移/下移动作。

## 5. 管理员与内部 review 页面

证据：

- `08-admin-data-governance-refresh-a11y-desktop.png`
- `09-admin-users-import-a11y-desktop.png`
- `10-review-adaptive-assessment-figures-mobile-a11y.png`

API 证据：

- `/api/admin/users/template` 返回 200，content-type 为 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`，content-disposition 为 `attachment; filename="users-template.xlsx"`。

观察：

- 数据治理页刷新后有最新更新时间、风险卡和风险表，但 DOM 没有 alert/status 区，Tab 路径进入管理员头像、导航，再进入内容。
- 用户管理页模板下载 API 可用，但页面没有下载完成状态或批次导入状态。
- 用户管理页仍有一个无显式标签输入，隐藏 file input 语义问题延续。
- 内部 review 移动页展示三张嵌入式页面截图和下载按钮，但截图本身被移动容器裁剪，且页面出现多个全局工具浮层重叠。

问题：

- P1：管理员刷新/下载状态仍未形成可访问反馈。刷新和模板下载都可执行，但没有完成、失败、文件名、影响范围或恢复动作播报。
- P1：管理员批量导入上传语义仍不稳定。本批继续记录上传相关输入语义不足，且批量导入没有批次状态区。
- P2：内部 review 移动页不能作为真实移动验收证据。页面嵌入的是截图预览，不是真实运行态；移动端还出现多重浮层遮挡。

建议：

- 管理员刷新、下载和导入应共享一个操作状态区，提供 `role=status` 和历史记录。
- 批量导入上传控件必须使用任务语义标签，并把模板下载、上传、校验、导入和撤销串成同一批次流。
- review 页面可保留为内部检查入口，但报告中不能把它当成学生/教师页面移动端通过证据。

## 6. 本批新增优先问题

145. P0：注册短密码仍触发运行时错误页。
     普通密码校验错误被渲染成 React child object，页面显示 Next Runtime Error，而不是字段级错误。

146. P1：课堂码错误缺少可访问播报。
     `/classroom/join?code=999999` 显示“未找到该入会码对应的课堂”，但没有 `role=alert`、`aria-live` 或 `role=status`。

147. P1：全局控灵过早进入 Tab 顺序。
     注册、课堂加入、证据页、班级分析、用户管理和 review 移动页都出现主任务前先进入全局 AI/portal 的焦点路径。

148. P1：学生证据复盘焦点顺序不服务证据任务。
     筛选后的证据页没有把结果摘要、失败题或“复盘课堂作答”作为优先键盘目标。

149. P1：教师添加学生弹窗缺少 dialog 语义和焦点陷阱。
     视觉弹窗已打开，但 DOM 无 dialog 记录，Tab 仍进入背景学生列表、详情和删除按钮。

150. P1：教师班级分析刷新和图表摘要缺少可访问状态。
     长页有大量图表/矩阵信息，但刷新完成、覆盖不足和重点学生排序缺少结构化播报。

151. P1：教案编排器搜索空态和拖拽等价操作不足。
     资源搜索无结果没有明确状态，编排仍主要依赖拖拽把手和图标按钮。

152. P1：管理员刷新/下载仍缺操作完成状态。
     数据治理刷新和用户模板下载都有入口与 API，但页面不播报完成、失败、文件名或影响范围。

153. P1：管理员批量导入上传语义仍不稳定。
     用户页继续暴露上传相关输入语义不足，且导入入口没有批次校验、导入和撤销状态区。

154. P2：内部 review 移动页不能替代真实移动验收。
     `/review/adaptive-assessment-figures` 移动端展示嵌入截图且被浮层遮挡，不能证明真实学生页面移动端可用。

## 7. 本批脚本与统计备注

- 本批 manifest 为 10 张截图、10 条 DOM/a11y JSON、3 个 API 检查、0 条 errors、1 条 ignoredError。
- ignoredError 是注册短密码当前 runtime error，属于本批审计证据，不是采集失败。
- 本批没有创建账号、没有有效加入课堂、没有保存配置、没有导入用户、没有修改教案。
- 本批重新统计整份审计真实 PNG 数量后，当前总数为 745。
