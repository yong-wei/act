# 功能状态流审计续篇（九）

日期：2026-06-20
范围：Arena 真实发布后的多次提交、榜单与教师报告归属、学生证据回流、移动端提交后状态。
截图证据：`screenshots/44-function-state-flows-batch9/`。
采集清单：`screenshots/function-state-flows-batch9-manifest.json`。

## 1. 覆盖范围

本轮新增 8 张功能状态截图，沿用第七批创建的真实发布：

- publicationId：`cmqluwvqo0001pmyf34og34jy`
- taskId：`task-second-order-lead-pid`
- 教师：`201300000012`
- 学生：`demo`
- 班级：`2024自动化`

数据库复核显示，本轮前该发布已有 1 条 demo 有效提交；本轮通过学生 UI 再次点击“提交官方评测”后，同一发布新增第 2 条有效提交，两个提交均为 `pid`、得分 0、valid true。

## 2. 学生挑战详情页：提交次数与榜单归属

证据：

- `screenshots/44-function-state-flows-batch9/01-student-challenge-publication-before-repeat.png`
- `screenshots/44-function-state-flows-batch9/04-student-challenge-after-repeat-submit.png`

健康度：可用但归属解释不足。

观察：

- 二次提交前，右侧榜单摘要显示参与人数 1 人、提交次数 1 次、当前榜单 1 条记录。
- 二次提交后，挑战详情页显示提交次数 2 次、参与人数仍为 1 人、当前榜单仍只显示 demo 一行。
- 优秀方案展示仍只展示 demo 的方案摘要，未说明这是最新提交、最佳提交还是同一学生多次提交的聚合结果。

问题：

- P1：多次提交的聚合规则没有在学生侧说明。学生能看到提交次数从 1 变 2，但无法知道榜单排名使用最新一次、最高分还是全部提交。
- P2：挑战详情页当前榜单只显示 1 条记录，但页面没有提示“同一学生多次提交已合并展示”。

建议：

- 在榜单摘要旁加入“同一学生多次提交按最佳/最新方案入榜”的规则说明。
- 学生个人方案卡应明确显示“第 2 次提交 / 当前入榜方案 / 历史提交可查看”等状态。

## 3. 学生工作台：二次提交后仍保留提交入口

证据：

- `screenshots/44-function-state-flows-batch9/02-student-workbench-before-repeat-submit.png`
- `screenshots/44-function-state-flows-batch9/03-student-workbench-after-repeat-submit.png`

健康度：可执行，但完成态解释弱。

观察：

- 提交前工作台可见“提交官方评测”按钮，页面说明当前为作业模式、对象分析、串联校正、PID。
- 点击后提交成功，页面显示“提交结果已进入 Arena 官方评价；可用证据将回流到学习记录”。
- 提交后仍保留“提交官方评测”按钮，没有提示这是再次提交、会覆盖入榜方案，还是追加历史记录。
- 结果区仍同时呈现得分 0 和硬约束通过，用户需要自己解释“有效但 0 分”。

问题：

- P1：二次提交前后按钮状态没有区分。重复提交是被允许的，但 UI 不解释允许原因、影响范围和入榜规则。
- P1：“证据将回流到学习记录”的文案与后续学生证据页实际状态不一致，本轮未看到 Arena 记录进入 LearningFact 或 GrowthRecord。

建议：

- 二次提交后将主按钮文案改为“再次提交官方评测”，旁边说明“保留历史记录，榜单按最佳/最新计算”。
- 成功态需要展示 submission id、提交次数、榜单采用规则和证据回流状态；若证据回流异步处理，应显示“待入库/已入库/未生成”的明确状态。

## 4. 教师发布报告：两次提交被直接列为优秀方案

证据：

- `screenshots/44-function-state-flows-batch9/07-teacher-publication-report-after-repeat-submit.png`

健康度：数据可见，但教学解释不足。

观察：

- 教师报告显示参与情况 1/1、提交次数 2、平均分 0、优秀方案 2。
- “优秀方案”区域列出两个 demo 方案，分别对应 2026年6月20日 12:27 和 12:55。
- “个人最佳”区域只展示 demo 一条，右侧得分 0。
- 报告顶部标题仍是技术 id `task-second-order-lead-pid`，发布元信息使用班级 id `cmma...`。

问题：

- P1：教师报告把两次 0 分有效提交都列为“优秀方案”，容易让教师误以为 0 分方案也值得表扬。
- P1：报告没有说明“个人最佳”和“优秀方案”之间的关系，也没有标出多次提交中的最新/最佳/重复。
- P2：标题、班级和任务仍偏技术标识，不利于教师在多个相似发布中快速定位。

建议：

- 将“优秀方案”改为“入榜方案”或按阈值筛选真正优秀方案；0 分方案应进入“需诊断方案”。
- 多次提交应提供每名学生的提交时间线、当前采用方案和被替换方案。
- 报告标题优先显示中文任务名、班级名、截止状态和发布创建时间。

## 5. 学生证据与成长页：Arena 提交未回流

证据：

- `screenshots/44-function-state-flows-batch9/05-student-profile-evidence-after-repeat-submit.png`
- `screenshots/44-function-state-flows-batch9/06-student-profile-growth-after-repeat-submit.png`
- Prisma 复核：最近 LearningFact 仍为 2026-06-17 的课堂作答记录，最近 GrowthRecord 仍为 2026-06-17 的阶段性能力画像评价。

健康度：证据页自身可读，但 Arena 回流断开。

观察：

- `/profile/evidence` 仍只显示课堂作答 step-10 证据，来源范围为互动课提交。
- `/profile/growth` 能显示控制校正个人诊断、能力雷达和课堂作答证据链，但控制校正维度仍为证据不足。
- 二次 Arena 提交后，数据库中 ArenaSubmission 已增至 2 条，但 LearningFact/GrowthRecord 未新增 Arena 来源记录。

问题：

- P1：工作台成功态承诺“可用证据将回流到学习记录”，但学生证据页和成长页没有呈现本次 Arena 证据。
- P1：学生完成正式挑战后，个人中心仍显示控制校正证据不足，行为反馈链路断裂。

建议：

- ArenaSubmission 入库后应生成或链接学生可见 Evidence item，并在证据页标明来源、任务、提交时间、有效性、得分和诊断。
- 成长页应把正式 Arena 提交纳入控制校正维度；若 0 分不计入能力提升，也应展示“已尝试但未达标”的诊断路径。

## 6. 移动端工作台：入口可用但长页面负担高

证据：

- `screenshots/44-function-state-flows-batch9/08-mobile-student-workbench-after-repeat-submit.png`

健康度：可用但效率偏低。

观察：

- 移动端能进入同一 publication 工作台，顶部身份、任务、评价状态和图表都可见。
- “提交官方评测”与结果状态在长页面中部，学生需要穿过指标卡、图表和流程说明才能确认完成。
- 控灵浮层仍贴近右侧内容，长页面滚动时会持续压近局部信息。

问题：

- P1：移动端正式提交完成态没有独立确认区，学生必须在长页面中寻找成功状态、得分和下一步。
- P2：结果、图表、过程说明和提交入口混在同一纵向流中，移动端重复提交风险更高。

建议：

- 移动端提交成功后应固定展示一个完成摘要：有效性、得分、入榜状态、证据回流状态和返回挑战页。
- 长图表应默认折叠或提供“查看分析图”二级入口，把正式提交与下一步放在首要位置。

## 7. 本轮结论

- Arena 真实发布支持同一学生对同一 publication 多次有效提交，提交次数、教师报告和数据库都能反映 2 次提交。
- 体验缺口从“能否提交”转为“重复提交如何解释”：学生端、教师端都没有明确说明采用规则、重复记录、最佳/最新方案和 0 分有效提交的含义。
- 证据回流是当前最高风险：UI 成功态承诺回流学习记录，但学生证据页、成长页和 LearningFact/GrowthRecord 均未出现本轮 Arena 提交。
