# 功能状态流审计续篇（十三）

日期：2026-06-20
范围：学生主路径移动端状态、课程/仿真筛选空态、Arena 挑战移动首屏 CTA、知识资源搜索和个人中心回流。
截图证据：`screenshots/48-function-state-flows-batch13/`。
采集清单：`screenshots/function-state-flows-batch13-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、live region、SVG/canvas 命名和 fixed/sticky 浮层记录。本轮 Playwright runtime 未暴露 `page.accessibility.snapshot()`，因此 `.a11y.json` 记录为 DOM 级结构审计。

## 1. 覆盖范围

本轮新增 9 张截图和 9 份结构化 DOM/a11y 记录：

- 学生移动端驾驶舱首屏与入口地图。
- 互动课程目录移动端默认态。
- 互动课程目录移动端搜索输入态。
- 虚拟仿真目录移动端搜索空态。
- Arena 挑战详情移动端第一视口和全页。
- 知识图谱移动端搜索态。
- 个人证据移动端筛选空态。
- 个人中心移动端回流入口。

## 2. 学生驾驶舱：入口完整，但主路径仍被导航和图标噪声稀释

证据：

- `screenshots/48-function-state-flows-batch13/01-dashboard-mobile-entry.png`
- `screenshots/48-function-state-flows-batch13/01-dashboard-mobile-entry.a11y.json`

健康度：可用，但移动首屏任务优先级仍不够强。

观察：

- 移动端能看到“学习者驾驶舱”“当前路径与下一步”“学习入口地图”和快速开始区域。
- 个人中心、证据时间线、互动课程、官方评测和虚拟仿真入口均在 DOM 控件列表中可见。
- DOM 抽查记录 29 个未命名 SVG/canvas，`liveRegions: 0`，并存在 1 个无名控件。

问题：

- P2：入口地图完整，但移动首屏更像功能总览，而不是“下一步任务”。
- P2：图标和浮层继续增加辅助技术噪声，学生路径页面也未建立完整读屏语义。

建议：

- 驾驶舱首屏应把“继续当前路径”或“下一步学习任务”放在功能矩阵之前。
- 对入口图标和全局浮层补可访问名称，避免读屏用户在主任务前听到大量装饰性控件。

## 3. 课程目录：搜索输入没有形成可感知过滤结果

证据：

- `screenshots/48-function-state-flows-batch13/02-course-directory-mobile-default.png`
- `screenshots/48-function-state-flows-batch13/03-course-directory-mobile-filter-empty.png`
- 对应 `.a11y.json`

健康度：移动目录可读，但搜索/筛选反馈不足。

观察：

- 默认态能展示精品课程、章节分组和“进入课程”动作。
- 脚本在第一个可见输入框填入 `zzzz-no-course` 后，页面仍展示完整课程列表。
- 页面没有出现无结果、清除条件、搜索已应用或输入无效的反馈。
- DOM 抽查记录 35 个未命名 SVG/canvas，`liveRegions: 0`。

问题：

- P1：用户输入搜索词后无法判断搜索是否生效。
- P2：移动端没有显式筛选展开控件，课程阶段、类型和启动动作的关系仍不透明。
- P2：无结果状态缺失，用户无法从错误查询恢复。

建议：

- 搜索输入应实时过滤课程列表；无匹配时显示空态、清除条件和返回推荐课程入口。
- 如果该输入不是课程搜索，应改名或移出目录筛选区，避免制造虚假的可搜索性。
- 移动端筛选应明确显示“已应用条件”和“重置”。

## 4. 虚拟仿真：空态明确，但浮层遮挡视图切换

证据：

- `screenshots/48-function-state-flows-batch13/04-simulations-mobile-filter-empty.png`
- `screenshots/48-function-state-flows-batch13/04-simulations-mobile-filter-empty.a11y.json`

健康度：空态可用，布局避让不足。

观察：

- 输入 `zzzz-no-simulation` 后，结果数量显示为 `0 个仿真`。
- 页面显示“没有匹配的仿真对象。请调整搜索词或筛选条件。”
- 搜索、难度、列表/卡片视图和类型筛选均在移动端可见。
- 右下控灵浮层与目录视图切换区域重叠。

问题：

- P2：空态文案成立，但浮层遮挡核心筛选控件，移动端误触风险高。
- P2：搜索和筛选区仍占据较多首屏，首个结果或下一步动作被推迟。

建议：

- 对移动端目录类页面统一设置 floating dock safe area，避免覆盖筛选、分页、视图切换。
- 空态旁增加“清除搜索”和“查看推荐仿真”动作。

## 5. Arena 挑战详情：移动首屏 CTA 可见

证据：

- `screenshots/48-function-state-flows-batch13/05-arena-challenge-mobile-first-viewport.png`
- `screenshots/48-function-state-flows-batch13/06-arena-challenge-mobile-full.png`
- 对应 `.a11y.json`

健康度：核心进入动作达标，浮层问题仍在。

观察：

- 第一视口内可以看到挑战标题、任务摘要和“进入控制工作台”。
- 页面继续展示对象来源、公开程度、工作台和榜单规则。
- DOM 抽查记录 13 个未命名 SVG/canvas，`liveRegions: 0`。
- 底部浮层压近“对象说明”区域。

问题：

- P2：CTA 首屏可见，这是正向证据；但页面仍受全局浮层遮挡影响。
- P2：挑战规则、榜单和提交次数的解释仍依赖后续长页内容，未在 CTA 附近形成任务承诺。

建议：

- CTA 下方补一句短承诺：进入后会使用官方评价、可提交排名、结果是否回流证据。
- 对挑战页移动端保留 CTA 首屏策略，同时治理底部浮层避让。

## 6. 知识资源与个人中心：回流路径可见，筛选空态成立

证据：

- `screenshots/48-function-state-flows-batch13/07-knowledge-mobile-search.png`
- `screenshots/48-function-state-flows-batch13/08-profile-evidence-mobile-filter.png`
- `screenshots/48-function-state-flows-batch13/09-profile-mobile-return-hub.png`
- 对应 `.a11y.json`

健康度：回流路径可用，读屏语义仍未闭环。

观察：

- 知识图谱移动端搜索 `PID` 后，页面保留知识图谱和证据支撑入口。
- 个人证据页可展开筛选，填入 `Arena` 后显示“当前筛选下暂无证据”，并提供重置筛选条件和返回成长中心。
- 个人中心移动端显示证据来源、竞技场、成长中枢和学习档案入口。
- 个人证据页和个人中心均记录 `liveRegions: 0`，说明筛选后空态不会主动播报。

问题：

- P1：个人证据空态可见，但缺少 live/status 语义，读屏用户可能不知道筛选结果已经变化。
- P2：知识图谱仍像探索工具，缺少从当前学习路径出发的默认任务提示。
- P2：个人中心证据和成长路径可回流，但 Arena 提交未回流的问题仍未解除。

建议：

- 筛选结果数量、空态和重置动作应使用状态文本或 `aria-live`。
- 知识资源移动首屏应增加“从当前课程继续查找”或“查看推荐知识点”。
- 继续把 Arena 提交证据回流作为数据链路缺陷处理，而不是只做视觉提示。
