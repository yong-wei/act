# 功能状态流审计续篇（十四）

日期：2026-06-20
范围：首页 CTA 登录模态、学生自适应学习路径动作态、课堂加入表单、教师移动端列表与分析页、管理员移动端筛选和统计页。
截图证据：`screenshots/49-function-state-flows-batch14/`。
采集清单：`screenshots/function-state-flows-batch14-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、live region、SVG/canvas 命名、表单、表格和 fixed/sticky 浮层记录。本轮继续使用 DOM 级结构审计。

## 1. 覆盖范围

本轮新增 13 张截图和 13 份结构化 DOM/a11y 记录：

- 访客首页移动首屏。
- 访客点击首页主 CTA 后的登录模态。
- 学生自适应学习路径默认态。
- 学生自适应学习路径动作态。
- 学生课堂加入非数字过滤态与 6 位无效码状态。
- 学生成长中心移动端下一步建议。
- 教师课堂历史移动端空态。
- 教师班级移动端搜索空态。
- 教师班级分析 v2 移动长页。
- 管理员用户移动端搜索空态。
- 管理员数据治理移动端状态页。
- 管理员系统统计移动端图表页。

## 2. 首页 CTA：登录模态清楚，但浮层仍进入遮罩层

证据：

- `screenshots/49-function-state-flows-batch14/01-guest-home-mobile-first-viewport.png`
- `screenshots/49-function-state-flows-batch14/02-guest-home-mobile-primary-cta-result.png`
- 对应 `.a11y.json`

健康度：入口可理解，遮罩层细节需要治理。

观察：

- 访客移动首屏可见主标题、平台入口菜单、进入驾驶舱和开启任务链。
- 点击主 CTA 后留在首页并打开“账号登录”模态，登录表单字段与关闭按钮可见。
- 结构抽查记录登录模态状态下 `liveRegions: 0`，仍有 4 个无名控件和 31 个未命名 SVG/canvas。
- 底部控灵和工具浮层仍显示在遮罩之上或遮罩边缘。

问题：

- P2：登录模态本身清楚，但全局浮层仍进入同一视觉层，削弱模态专注度。
- P2：遮罩状态下仍存在多个无名控件，读屏顺序可能先经过背景或全局工具。

建议：

- 首页登录模态打开时应隐藏或延后全局工具入口，并确保焦点进入模态内部。
- 登录模态需要明确 `dialog` 语义、标题关联和关闭后的焦点回位。

## 3. 自适应学习路径：动作可触发，但路径生成与练习执行关系不清

证据：

- `screenshots/49-function-state-flows-batch14/03-student-adaptive-practice-mobile-default.png`
- `screenshots/49-function-state-flows-batch14/04-student-adaptive-practice-mobile-action.png`
- 对应 `.a11y.json`

健康度：学生可以继续练习，但状态解释不足。

观察：

- 默认态显示“先建立入门路径”和学习概况。
- 点击主要动作后页面出现“路径原创准备中”，同时下方出现自适应练习题和提交答案按钮。
- 题目、选项和提交按钮可见；底部控灵浮层压近选项区域。
- 动作态 `liveRegions: 0`，路径状态变化不会主动播报。

问题：

- P1：页面同时表达“路径原创准备中”和“练习可提交”，学生难以判断当前任务是等路径、做练习，还是用练习补齐路径证据。
- P2：移动端题目区过长，底部浮层贴近答案选项和提交按钮。
- P2：路径状态变化缺少 live/status 语义。

建议：

- 把路径准备、练习执行、证据回流拆成明确的三段状态。
- 如果练习是路径生成前置证据，应在题目前说明“完成后刷新路径建议”。
- 练习题和提交按钮区域应纳入 floating dock safe area。

## 4. 课堂加入表单：格式过滤存在，但无效码没有错误反馈

证据：

- `screenshots/49-function-state-flows-batch14/05-student-classroom-join-mobile-invalid.png`
- `screenshots/49-function-state-flows-batch14/13-student-classroom-join-mobile-invalid-6digit.png`
- 对应 `.a11y.json`

健康度：输入约束可见，错误恢复不足。

观察：

- 输入 `BAD123` 后，控件只保留 `1 2 3`，说明非数字被过滤。
- 输入 `123456` 后点击查询课堂，页面仍停留在表单，没有可见错误文案。
- 两个状态都记录 `liveRegions: 0`。
- 控灵浮层贴近表单底部，但未覆盖输入框。

问题：

- P1：6 位无效课堂码没有明确反馈，用户不知道是未查询、查询中、课堂不存在还是网络失败。
- P2：非数字过滤没有就近说明，用户只看到输入内容被静默改写。
- P2：错误反馈缺少可访问播报语义。

建议：

- 对 6 位不存在课堂码显示“未找到课堂，请确认课堂码或联系教师”，并提供重新输入。
- 非数字输入应保留格式提示，例如“课堂码仅支持 6 位数字”。
- 查询中、成功、失败都应有 `role="status"` 或 `aria-live`。

## 5. 教师移动端：班级搜索空态清楚，历史空态和分析长页仍弱

证据：

- `screenshots/49-function-state-flows-batch14/07-teacher-history-mobile-search-empty.png`
- `screenshots/49-function-state-flows-batch14/08-teacher-classes-mobile-search-empty.png`
- `screenshots/49-function-state-flows-batch14/09-teacher-class-analytics-v2-mobile.png`
- 对应 `.a11y.json`

健康度：班级搜索可用，课堂历史和班级分析仍需治理。

观察：

- 班级搜索 `zzzz-no-class` 后显示“没有找到匹配的班级，请尝试其他搜索词”。
- 课堂历史显示 `0 节课` 和“暂无已结束课堂”，但页面没有搜索框或筛选控件，脚本填入的是页面中的其他输入。
- 班级分析 v2 移动长页展示能力维度、画像等级、能力矩阵和重点学生。
- 班级分析 v2 结构抽查记录 50 个未命名 SVG/canvas，`liveRegions: 0`。
- 移动截图显示能力矩阵和重点学生列表形成极长滚动，教师需要滑过大量重复行。

问题：

- P1：班级分析移动端信息量过大，能力矩阵和学生列表缺少摘要、折叠和优先级。
- P1：分析页图表/矩阵缺少等价文本，读屏和低视力用户难以获得班级主要风险。
- P2：课堂历史空态没有后续动作，例如创建课堂、返回教案或查看未结束课堂。

建议：

- 班级分析移动端先给“3 个主要短板 / 3 名优先关注学生 / 证据覆盖缺口”摘要，再展示长表。
- 移动端能力矩阵按风险等级折叠，默认只展开高风险或待处理学生。
- 历史空态应给教师下一步：发起课堂、查看教案、返回班级。

## 6. 管理员移动端：用户空态成立，治理和统计页仍偏长报告

证据：

- `screenshots/49-function-state-flows-batch14/10-admin-users-mobile-search-empty.png`
- `screenshots/49-function-state-flows-batch14/11-admin-data-governance-mobile-search.png`
- `screenshots/49-function-state-flows-batch14/12-admin-states-mobile-chart-context.png`
- 对应 `.a11y.json`

健康度：可访问主要信息，但移动管理效率不足。

观察：

- 用户页搜索 `zzzz-no-user` 后账号列表显示“暂无账号数据”，分页显示 `共 0 条`。
- 管理员用户表格在移动端被压成多行表头，仍保留账号信息、学号/工号、角色、创建时间和操作列。
- 数据治理页没有明显页面内搜索/筛选入口；脚本点击后仍停留在总览、队列和风险清单。
- 系统统计移动端展示多组图表，结构抽查记录 18 个未命名 SVG/canvas，`liveRegions: 0`。

问题：

- P1：管理员用户表格移动端列太多，表头被挤压，空态可见但表格结构不适合小屏操作。
- P2：数据治理移动页像长报告，不像“先看风险 -> 处理异常”的操作台。
- P1：统计图表缺少移动端等价文本和关键结论摘要。

建议：

- 管理员用户移动端应改为账号卡片或两列关键字段，敏感操作进入详情抽屉。
- 数据治理移动端首屏优先展示当前最高风险和待处理动作，再展开队列细节。
- 统计页每个图表组前加入一句可读摘要，并为图表绑定文本说明。
