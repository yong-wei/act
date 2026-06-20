# 功能状态流审计续篇（三十五）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：AI 工坊、独立 Copilot、元提示词评价、作品集提示词/反思入口、移动端 AI 输入状态。
截图目录：`screenshots/70-function-state-flows-batch35/`
Manifest：`screenshots/function-state-flows-batch35-manifest.json`
本批新增截图：14 张，全部带 DOM/a11y JSON 快照；关键步骤带焦点路径与 API 检查。
账号：学生 `demo`。

## 1. 本批审计顺序

1. 学生打开 `/ai`，检查 AI 工坊、学习任务、日志和实验档案。
2. 在 AI 工坊选择“船舶航向控制仿真”，检查任务选择后的详情与启动动作。
3. 打开 `/ai/copilot` 空态，检查快速问题、输入框和返回 AI 工坊。
4. 点击 Copilot 快速问题“PID原理”，检查发送后回答、状态和证据提示。
5. 打开 `/evaluation/prompt-assessment` 空态，检查结构化提示词编辑器。
6. 填写提示词字段并执行“评价提示词质量”，检查评分、建议和持久化状态。
7. 执行“过程一致性校验”，检查一致性报告和完成状态。
8. 执行“生成常态化演示轨迹”，检查历史记录、demo 边界和趋势数据。
9. 打开 `/profile/portfolio` 的“提示词设计”标签，检查提示词成果入口。
10. 点击作品集提示词空态动作，检查目标路由。
11. 打开作品集“学习反思”标签，检查反思空态入口。
12. 点击“开始反思”，检查 Copilot 是否继承反思上下文。
13. 移动端打开 `/evaluation/prompt-assessment?autodemo=1`，检查编辑器、结果和历史长页。
14. 移动端打开 `/ai/copilot`，检查快捷问题、输入框和全局浮层关系。

## 2. AI 工坊与任务选择

证据：

- `01-ai-workshop-desktop.png`
- `02-ai-workshop-task-selected-desktop.png`

观察：

- `/ai` 返回 200，首屏包含“学海罗盘”“成就徽章”“学习任务”“思政学习日志”“实验档案”和右侧控灵面板。
- 学习任务按钮可点击，选择“船舶航向控制仿真”后只形成视觉选中状态，没有出现任务详情、开始按钮、返回课程或继续工作台动作。
- 焦点路径先进入全局 AI 输入框、浮动工具和 `body`，之后才到“返回首页”和学习任务按钮；AI 工坊作为 AI 页面，却仍被全局 AI 侧栏抢占第一焦点。
- 页面存在 3 个无名控件，`alerts`、`dialogs` 和 live/status 区域均为空。

问题：

- P1：AI 工坊任务选择只改变视觉状态。用户选中任务后看不到详情、目标、开始动作或是否已保存到当前学习路径。
- P1：AI 工坊与真实课程/工作台上下文断开。任务卡有学习时长和难度，但不能直接进入课程、仿真或控制工作台。
- P1：全局 AI 输入框先于 AI 工坊主任务进入焦点路径。用户进入 AI 页面后，键盘第一站仍是另一个全局 AI 面板。

建议：

- 任务选择后应打开任务详情区或内联展开：当前目标、来源课程、下一步按钮、是否写入学习记录。
- 任务卡应连接真实目标，例如课程运行态、Arena challenge、控制工作台或反思任务，而不是只停留在工坊样例。
- AI 工坊内应降级或合并全局 AI 浮层，避免同一页面出现两个互相竞争的 AI 入口。

## 3. 独立 Copilot

证据：

- `03-copilot-empty-desktop.png`
- `04-copilot-after-quick-question-desktop.png`
- `14-copilot-mobile-empty.png`

观察：

- `/ai/copilot` 返回 200，空态能看到“返回AI工坊”、六个快捷问题和输入框。
- 点击“PID原理”后能生成回答，但回答开头直接展示 `[控灵证据提示] 本次流式回答尚未完成最终引用核验。缺少证据类型...` 以及 `missing-content`、`assistant-citation-owner-missing` 等内部诊断。
- 发送后结构化快照 `alerts=0`、`liveRegion=false`，没有可访问的发送中、生成完成、引用核验完成或失败状态。
- 桌面回答态的首批控件包含本页输入框、关闭按钮、全局 AI 输入框和浮动工具；移动端输入区固定在底部，但全局黑色按钮和控灵浮层贴近输入区域。

问题：

- P1：Copilot 把证据核验内部诊断直接暴露给学生。学生看到的是实现层缺证据类型和 owner 缺失，而不是可理解的引用可信度说明。
- P1：Copilot 回答缺少生成与引用核验状态播报。发送、流式回答、完成和引用状态没有 `role=status`/`aria-live`。
- P1：独立 Copilot 与全局 AI 控件互相竞争。AI 页面内部有 Copilot，同时全局 AI 输入框和浮动工具仍进入焦点路径。
- P2：移动端 Copilot 输入区与全局浮层距离过近。发送按钮、输入框和控灵浮层形成底部拥挤状态。

建议：

- 将证据诊断转换为学生可理解的引用状态，例如“回答正在核验引用”“暂未找到可引用资料”，内部 code 只进入开发日志。
- 为发送、生成、引用核验和错误增加统一 status/live 区域。
- 在 `/ai/copilot` 页面隐藏或延后全局 AI 侧栏焦点，保留一个主 AI 会话入口。
- 移动端给底部输入区和全局浮层建立互斥或避让规则。

## 4. 元提示词评价与过程一致性

证据：

- `05-prompt-assessment-empty-desktop.png`
- `06-prompt-assessment-quality-result-desktop.png`
- `07-prompt-assessment-consistency-result-desktop.png`
- `08-prompt-assessment-demo-history-desktop.png`
- `13-prompt-assessment-autodemo-mobile.png`

API 证据：

- `/api/auth/session` 返回学生 `demo`，`role=STUDENT`。
- 执行提示词评价后 `/api/auth/session` 仍返回同一学生上下文。
- `/api/evaluation/prompt-history/cmjm5lkjk0000t69bqiupz5am` 返回 200，历史记录数量为 4。

观察：

- 空态页是完整结构化编辑器，但没有 AppShell 导航、当前课程目标或返回学习任务的上下文。
- 质量评价能生成综合分 94 和四维评分；一致性校验能生成一致性得分、实际优化方向和迭代次数；演示轨迹能把历史版本扩展到 4 条。
- 所有操作后的结构化快照均为 `alerts=0`、`liveRegion=false`，没有评价中、已保存、校验完成、演示生成完成等可访问状态。
- “生成常态化演示轨迹”在真实学生 id 下写入/展示多条历史；页面没有清晰标注哪些是自动演示、哪些是真实学习记录。
- 移动端 `autodemo=1` 页面高度达到 3114px，编辑器、预览、仪表盘、一致性报告和历史轨迹纵向堆叠；控灵和黑色浮层覆盖在“过程一致性检验”按钮附近。

问题：

- P1：Prompt 评估缺少学习任务上下文。学生不知道这是来自哪门课、哪次作答或哪个作品集目标。
- P1：评价、校验和演示生成均缺少完成状态播报。视觉上有结果，但读屏和键盘用户无法稳定获知操作完成。
- P1：demo 演示轨迹与真实学生历史边界不清。历史 API 使用真实学生 id 返回 4 条记录，页面没有演示数据隔离说明。
- P2：移动端页面过长且主操作被浮层干扰。编辑、结果和历史全部堆叠，关键按钮缺少固定操作区。

建议：

- 将 Prompt 评估入口绑定到课程、作品集或任务上下文，页面顶部显示来源和返回动作。
- 每个异步动作增加 `role=status`/`aria-live`：评价中、评价完成并保存、校验完成、演示轨迹已生成。
- demo 轨迹应使用独立 demo 标记或隔离 session，历史列表明确区分真实作品与演示样例。
- 移动端把编辑器、结果、历史拆为标签或分段，并为主操作区预留浮层避让。

## 5. 作品集提示词与反思入口

证据：

- `09-portfolio-prompt-designs-tab-desktop.png`
- `10-portfolio-prompt-practice-action-target-desktop.png`
- `11-portfolio-reflections-tab-desktop.png`
- `12-portfolio-reflection-action-copilot-target-desktop.png`

观察：

- `/profile/portfolio` 返回 200，作品集有“课堂作品 / 提示词设计 / 仿真设计 / 伦理整改 / 学习反思”等标签。
- “提示词设计”标签为空态时提供“练习提示词设计”动作，但点击后落到 `/evaluation`，页面显示 Next 404。
- “学习反思”标签空态提供“开始反思”，点击后落到 `/ai/copilot`。
- Copilot 目标页没有携带 reflection intent、作品集来源、当前学生证据或反思模板；首屏仍是通用快捷问题。

问题：

- P1：作品集提示词空态动作指向不存在的 `/evaluation`。该动作应进入 `/evaluation/prompt-assessment`，当前直接导致 404。
- P1：作品集反思入口没有保留反思上下文。学生从“学习反思”进入 Copilot 后，看不到反思目标、作品集来源或可保存回作品集的说明。
- P1：作品集学习成果与 AI 辅助页之间缺少保存/回流合同。Prompt 评估和 Copilot 都能打开，但作品集侧没有明确记录何时生成、何时保存、如何回到作品集。

建议：

- 将“练习提示词设计”的 href 改为 `/evaluation/prompt-assessment`，并携带 `source=portfolio&tab=prompt-designs` 之类的来源参数。
- “开始反思”应打开 Copilot 的反思模式，预置反思 prompt，并显示“完成后保存到学习反思”。
- 作品集空态动作应统一定义：生成入口、保存目标、返回作品集和未保存提醒。

## 6. 本批新增优先问题

177. P1：AI 工坊任务选择只改变视觉状态。
     选择“船舶航向控制仿真”后没有任务详情、开始动作、学习路径写入或课程/工作台落点。

178. P1：AI 工坊与真实学习任务上下文断开。
     任务卡显示学习时长和难度，但不能直接进入课程、仿真、Arena 或控制工作台。

179. P1：AI 工坊内全局 AI 先于主任务进入焦点路径。
     焦点先进入全局 AI 输入框、浮动工具和 `body`，之后才进入返回首页和任务按钮。

180. P1：Copilot 向学生暴露证据核验内部诊断。
     回答开头出现 `[控灵证据提示]`、`missing-content`、`assistant-citation-owner-missing` 等实现层信息。

181. P1：Copilot 回答缺少生成与引用核验状态播报。
     发送、生成、完成和引用核验后的 DOM 快照均无 `role=status`/`aria-live`。

182. P1：独立 Copilot 与全局 AI 控件互相竞争。
     Copilot 页面仍把全局 AI 输入框和浮动工具放入同一焦点路径。

183. P1：Prompt 评估缺少学习任务上下文。
     页面没有当前课程、作品集来源、作答来源或返回学习目标的稳定入口。

184. P1：Prompt 评价、校验和演示生成缺少完成状态播报。
     三类操作都有可见结果，但 `alerts=0`、`liveRegion=false`，读屏用户无法获知完成。

185. P1：Prompt demo 轨迹与真实学生历史边界不清。
     历史 API 使用真实学生 id 返回 4 条记录，页面没有演示数据隔离标识。

186. P1：作品集提示词空态动作指向 404。
     “练习提示词设计”落到 `/evaluation`，当前 App Router 无该页面，应改为 `/evaluation/prompt-assessment`。

187. P1：作品集反思入口没有保留反思上下文。
     “开始反思”只打开通用 `/ai/copilot`，没有 reflection intent、证据来源或保存回作品集提示。

188. P2：移动端 Prompt 评估和 Copilot 底部浮层避让不足。
     Prompt 评估长页主按钮被全局浮层贴近，Copilot 输入区也与控灵浮层形成底部拥挤。

## 7. 本批脚本与统计备注

- 本批 manifest 为 14 张截图、14 条 DOM/a11y JSON、3 个 API 检查、0 条 errors、0 条 ignoredErrors。
- 本批对真实学生 `demo` 执行了提示词评价、一致性校验和演示轨迹生成；`prompt-history` 返回 4 条记录，应按演示数据边界继续复核。
- 本批没有修改密码、没有提交课堂/Arena 作业、没有创建教师或管理员账号。
- 本批重新统计整份审计真实 PNG 数量后，当前总数为 782。
