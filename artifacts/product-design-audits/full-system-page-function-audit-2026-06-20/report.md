# ACT 全系统页面与功能 Product Design 审计报告

日期：2026-06-20
基线：`dev1` 对齐 `origin/integration`，HEAD `60c88246c9`
状态：审计已收口。本文件是全量审计报告的主索引与首批审计稿；认证态角色流程已拆入 `chapters/02-authenticated-role-flows.md`，profile/review/仿真深层页面已拆入 `chapters/03-profile-review-simulation-depth.md`，课程入口全集已拆入 `chapters/04-course-entry-all.md`，课程学生 demo 运行态全集已拆入 `chapters/05-course-student-runtime-demo-all.md`，课程教师等待页与投影运行态全集已拆入 `chapters/06-course-teacher-waiting-runtime-demo-all.md`，详情操作态与 AI/评估辅助页已拆入 `chapters/07-detail-auxiliary-pages.md`，结构化剩余路线和 Arena 发布报告已拆入 `chapters/08-structured-remaining-routes.md`，五十九批功能状态流已拆入 `chapters/09-function-state-flows.md`、`chapters/10-function-state-flows-batch2.md`、`chapters/11-function-state-flows-batch3.md`、`chapters/12-function-state-flows-batch4.md`、`chapters/13-function-state-flows-batch5.md`、`chapters/14-function-state-flows-batch6.md`、`chapters/15-function-state-flows-batch7.md`、`chapters/16-function-state-flows-batch8.md`、`chapters/17-function-state-flows-batch9.md`、`chapters/18-function-state-flows-batch10.md`、`chapters/19-function-state-flows-batch11.md`、`chapters/20-function-state-flows-batch12.md`、`chapters/21-function-state-flows-batch13.md`、`chapters/22-function-state-flows-batch14.md`、`chapters/23-function-state-flows-batch15.md`、`chapters/24-function-state-flows-batch16.md`、`chapters/25-function-state-flows-batch17.md`、`chapters/26-function-state-flows-batch18.md`、`chapters/27-function-state-flows-batch19.md`、`chapters/28-function-state-flows-batch20.md`、`chapters/29-function-state-flows-batch21.md`、`chapters/30-function-state-flows-batch22.md`、`chapters/31-function-state-flows-batch23.md`、`chapters/32-function-state-flows-batch24.md`、`chapters/33-function-state-flows-batch25.md`、`chapters/34-function-state-flows-batch26.md`、`chapters/35-function-state-flows-batch27.md`、`chapters/36-function-state-flows-batch28.md`、`chapters/37-function-state-flows-batch29.md`、`chapters/38-function-state-flows-batch30.md`、`chapters/39-function-state-flows-batch31.md`、`chapters/40-function-state-flows-batch32.md`、`chapters/41-function-state-flows-batch33.md`、`chapters/42-function-state-flows-batch34.md`、`chapters/43-function-state-flows-batch35.md`、`chapters/44-function-state-flows-batch36.md`、`chapters/45-function-state-flows-batch37.md`、`chapters/46-function-state-flows-batch38.md`、`chapters/47-function-state-flows-batch39.md`、`chapters/48-function-state-flows-batch40.md`、`chapters/49-function-state-flows-batch41.md`、`chapters/50-function-state-flows-batch42.md`、`chapters/51-function-state-flows-batch43.md`、`chapters/52-function-state-flows-batch44.md`、`chapters/53-function-state-flows-batch45.md`、`chapters/54-function-state-flows-batch46.md`、`chapters/55-function-state-flows-batch47.md`、`chapters/56-function-state-flows-batch48.md`、`chapters/57-function-state-flows-batch49.md`、`chapters/58-function-state-flows-batch50.md`、`chapters/59-function-state-flows-batch51.md`、`chapters/60-function-state-flows-batch52.md`、`chapters/61-function-state-flows-batch53.md`、`chapters/62-function-state-flows-batch54.md`、`chapters/63-function-state-flows-batch55.md`、`chapters/64-function-state-flows-batch56.md`、`chapters/65-function-state-flows-batch57.md`、`chapters/66-function-state-flows-batch58.md` 和 `chapters/67-function-state-flows-batch59.md`。页面模板级证据已补齐，登录/注册、课堂加入、Arena 交互、Arena 到控制工作台、学生官方提交、移动端官方提交、学生移动端主路径/筛选空态、自适应学习路径动作与提交结果、任务工作区支持工具/提交结果、教师移动长列表/分析/资源空态、管理员移动筛选/统计/模态/批量导入/配置校验、教师建班/教案/课堂发起/课堂结束/有效复盘/Arena 预览/真实发布提交报告、Arena 多次提交/榜单归属/学生证据回流、管理员用户/配置/批量导入/AI provider 测试、导入后治理动作、模态键盘行为、关联数据删除影响范围、截止后 Arena 报告、课程入口课堂码、真实课堂码加入、教师等待/投影二维码工具、真实课堂发放作答/学生提交/教师汇总/结束课堂/学生证据回流、教师历史/进行中课堂、数据治理真实标签页、批量导入多类文件状态、教师课后复盘、学生证据回查、教师班级成员管理、教师侧学生证据链、教师教案编排器、教师资源管理、教师直发课堂、班级绑定课堂学生加入/双人提交/复盘、课后复盘深层动作、报告导出/发送入口、Arena 正式发布/榜单/报告、管理员治理深层动作、学生证据详情/题目级复盘/补练生成路径、控制工作台任务区合同、已结束课堂教师直达态、教师课前包复核阻断、管理员治理处置/导出/撤销缺口、跨角色 a11y/键盘路径、报告交付/评分反馈/管理员配置导入治理状态、跨角色权限边界、全局菜单/改密、浮动工具、AI 侧栏、移动壳层导航、AI 工坊、独立 Copilot、Prompt 评估、作品集 AI 入口、任务大厅和作品集空态动作、数据中心角色边界/治理动作/导出按钮、教师侧学生诊断与证据遗留路由、知识图谱筛选/节点深链、播放列表创建/保存/开始上课、移动端知识图谱/课程流、仿真目录筛选/课程设计弹窗/兼容重定向、仿真运行态局部工具和 Arena 任务入口、自适应学习路径生成/选择/执行/证据回看和移动端路径状态、全局壳层、浮动工具、AI 侧栏、移动抽屉、主题切换、Global AI 真实对话、上下文注入、引用核验提示、清空/重试/停止状态、管理员治理 AI、移动端 AI 首屏、报告账本、导出下载、教师复盘交付、数据中心快照导出、管理员模板下载、治理处置、无效深链、失效对象、错误恢复和列表搜索/筛选/分页/空态、表单校验、下载导入、配置保存、治理加载、学习完成态、提示词评价、证据后续动作、报告交付、导出下载、治理处置、移动端完成态、学生任务与作品集回流、教师评分/写回工作台、管理员用户导入批次治理和移动用户页、自适应 demo 作答、Prompt autodemo、学生个人中心下一步、教师班级报告/分析/课前包、管理员治理/数据中心、真实学习路径空态/执行、教师报告账本到学生证据/评分落点、320px 管理员治理和移动状态，以及学生任务/证据/成长/作品集完成态、教师交付/评分/课前包、管理员批量导入/搜索/配置/治理处置、教师备课/资源治理、管理员教案治理、学生课程目录和课程流创建、直接深链、编辑器、播放入口和知识节点定位，以及报告反馈、Prompt/AI/Copilot、作品集反思、报告账本、评分工作台、数据中心交接、治理分派、配置审计、后续入口目标页、参数化报告/评分/治理动作、移动目标页，以及 API/UI 语义不一致与恢复状态、搜索筛选与方法边界、动作闭环与状态播报等功能状态已补完整审计证据；全站 a11y 断点已完成证据收口，修复阶段仍需建立统一 status/live 合同。

## 1. 审计目标与边界

本次目标是按用户真实使用顺序审计系统每个页面与每个主要功能，并形成分功能区块、分步骤的详实报告。

### 1.1 OpenSpec 整改系列索引

本报告从本次审计完成后作为系统运行的总质量文档维护。后续新增业务功能应在相关页面族或功能流上做增量审计，不再默认重复全量设计审计。以下 OpenSpec 变更系列负责把本报告中的缺陷清单转成可执行整改；每个变更完成并通过验收后，必须回写本报告或对应章节的整改状态、证据路径、日期和 change id。

| Change | 范围 | 主要审计证据 | 当前状态 |
| --- | --- | --- | --- |
| `audit-remediation-p0-stability` | 注册、空教案发课、教师投影、课前包 500 | `chapters/09-function-state-flows.md`、`chapters/10-function-state-flows-batch2.md`、`chapters/06-course-teacher-waiting-runtime-demo-all.md`、`chapters/02-authenticated-role-flows.md`、`chapters/38-function-state-flows-batch30.md`、`chapters/57-function-state-flows-batch49.md` | remediated 2026-06-21；证据：`remediation/audit-remediation-p0-stability/evidence.md`；2026-06-29 台账映射清理：finding 132/133/328 已从未标记阻断集合移出，证据：`remediation/audit-report-closure-ledger-cleanup/evidence.md` |
| `audit-remediation-action-status-contract` | 全站动作状态、下载/导出、提交/审批/写回、`alert/live` | `chapters/49-function-state-flows-batch41.md`、`chapters/50-function-state-flows-batch42.md`、`chapters/51-function-state-flows-batch43.md`、`chapters/54-function-state-flows-batch46.md`、`chapters/63-function-state-flows-batch55.md` 至 `chapters/67-function-state-flows-batch59.md` | foundation remediated 2026-06-21；证据：`remediation/audit-remediation-action-status-contract/evidence.md`；具体页面缺陷待后续垂直变更关闭 |
| `audit-remediation-api-ui-contracts` | URL 参数、搜索筛选、分页、坏 ID、API/UI 口径 | `chapters/52-function-state-flows-batch44.md`、`chapters/53-function-state-flows-batch45.md`、`chapters/63-function-state-flows-batch55.md` 至 `chapters/67-function-state-flows-batch59.md` | foundation + admin users no-match remediated 2026-06-21；证据：`remediation/audit-remediation-api-ui-contracts/evidence.md`；其余 deep link 页面待后续垂直变更关闭 |
| `audit-remediation-student-learning-closure` | 学生报告反馈、任务、自适应练习、证据、成长、作品集写回 | `chapters/55-function-state-flows-batch47.md`、`chapters/56-function-state-flows-batch48.md`、`chapters/63-function-state-flows-batch55.md` 至 `chapters/67-function-state-flows-batch59.md` | proposed |
| `audit-remediation-teacher-report-grading` | 教师报告交付、评分审批、学生证据 deep link、移动长报告主动作 | `chapters/51-function-state-flows-batch43.md`、`chapters/55-function-state-flows-batch47.md`、`chapters/56-function-state-flows-batch48.md`、`chapters/63-function-state-flows-batch55.md` 至 `chapters/67-function-state-flows-batch59.md` | remediated 2026-06-21；证据：`remediation/audit-remediation-teacher-report-grading/evidence.md`；学生反馈、管理员治理等非教师线缺陷待后续垂直变更关闭 |
| `audit-remediation-teacher-classroom-review-delivery-closure` | 教师课堂复盘、报告交付上下文、评分交接、学生证据处置、课前包入口、已结束课堂删除 | `chapters/32-function-state-flows-batch24.md`、`chapters/57-function-state-flows-batch49.md`、`chapters/64-function-state-flows-batch56.md`、`chapters/67-function-state-flows-batch59.md` | remediated 2026-06-29；证据：`remediation/audit-remediation-teacher-classroom-review-delivery-closure/evidence.md` |
| `audit-remediation-admin-governance-workflows` | 管理员治理、用户导入、用户筛选导出、配置测试、统计导出 | `chapters/51-function-state-flows-batch43.md`、`chapters/53-function-state-flows-batch45.md`、`chapters/54-function-state-flows-batch46.md`、`chapters/56-function-state-flows-batch48.md` 至 `chapters/67-function-state-flows-batch59.md` | proposed |
| `audit-remediation-mobile-a11y-shell` | 320px/390px 移动布局、横向溢出、浮动工具避让、焦点与命名 | `chapters/49-function-state-flows-batch41.md`、`chapters/53-function-state-flows-batch45.md`、`chapters/54-function-state-flows-batch46.md`、`chapters/55-function-state-flows-batch47.md`、`chapters/56-function-state-flows-batch48.md`、`chapters/57-function-state-flows-batch49.md`、`chapters/58-function-state-flows-batch50.md`、`chapters/59-function-state-flows-batch51.md`、`chapters/62-function-state-flows-batch54.md`、`chapters/64-function-state-flows-batch56.md`、`chapters/67-function-state-flows-batch59.md` | remediated 2026-06-21；证据：`remediation/audit-remediation-mobile-a11y-shell/evidence.md`；已关闭代表页面移动/a11y 壳层问题，业务状态机缺口待后续垂直变更关闭 |
| `audit-remediation-ai-task-boundaries` | AI、Prompt、Copilot 任务边界、上下文脱敏、持久输出 | `chapters/50-function-state-flows-batch42.md`、`chapters/55-function-state-flows-batch47.md`、`chapters/62-function-state-flows-batch54.md`、`chapters/63-function-state-flows-batch55.md` | remediated 2026-06-21；证据：`remediation/audit-remediation-ai-task-boundaries/evidence.md`；自适应完整链路、学生报告反馈完整状态机和管理员治理 AI 待后续垂直变更关闭 |
| `audit-remediation-arena-classroom-evidence` | Arena 结果解释、多次/逾期/0 分、课堂状态、证据回流 | `chapters/10-function-state-flows-batch2.md`、`chapters/34-function-state-flows-batch26.md`、`chapters/54-function-state-flows-batch46.md` 及课堂/Arena 相关批次 | proposed |
| `audit-remediation-authoring-resource-flows` | 教案、ResourceNode、播放列表、课程流、知识节点与作者态治理 | `chapters/60-function-state-flows-batch52.md`、`chapters/61-function-state-flows-batch53.md` 及本报告资源/作者态问题项 | proposed |

台账维护规则：归档 OpenSpec 整改已经明确覆盖并留存验证证据的 finding，不应继续留在未标记阻断集合中。此类项目按 mapping-cleaned 记录归档 change id、证据路径和日期；相邻但未由该证据覆盖的功能完整性、入口动作、移动布局或后续状态机 finding 继续保留未关闭状态，等待对应垂直整改。

审计对象以当前 App Router 页面为准：

- App Router 页面文件总数：205。
- 平台导航真源：`src/lib/platform-role-navigation.ts`。
- 任务工作区合同：`src/features/simulation-arena-workbench/experience-shell-contracts.ts`。
- 互动课程提交门禁：`src/features/interactive/course-submission-gate-inventory.ts`。
- 当前视觉证据目录：`artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/screenshots/`。

截图工具与证据规则：

- 使用 `openwolf designqc` 采集当前运行的 Next dev server：`http://localhost:3100`。
- 自动检测到的 `http://localhost:8080` 是 uvicorn，不是本系统；该批截图已拒收并移动到 `.wolf/designqc-rejected/2026-06-20-wrong-uvicorn-8080/`。
- 截至 Batch59 已采纳 PNG 截图 1372 张，覆盖 29 个课程入口、29 个课程学生 demo 运行态、29 个教师等待页、29 个教师投影运行态、19 个认证态页面、21 个 profile/review/仿真深层页面、公开认证页、Arena、通用互动页、资源实例、播放列表、知识图谱、遗留教师学生路由、教师/管理员详情操作态、课堂复盘、AI/评估辅助页、Arena 发布报告和五十九批关键功能状态流。截图目录中可能存在尚未纳入主报告的后续批次草稿，主报告计数只统计已采纳批次。
- 全量路由覆盖附录：`route-inventory.md`，包含 205 个 App Router 页面文件。
- 认证态角色流程续篇：`chapters/02-authenticated-role-flows.md`。
- Profile、review 与仿真深层页面续篇：`chapters/03-profile-review-simulation-depth.md`。
- 互动课程入口全集续篇：`chapters/04-course-entry-all.md`。
- 互动课程学生运行态全集续篇：`chapters/05-course-student-runtime-demo-all.md`。
- 互动课程教师等待页与投影运行态全集续篇：`chapters/06-course-teacher-waiting-runtime-demo-all.md`。
- 详情操作态与 AI/评估辅助页续篇：`chapters/07-detail-auxiliary-pages.md`。
- 结构化剩余路线与 Arena 发布报告续篇：`chapters/08-structured-remaining-routes.md`。
- 功能状态流续篇：`chapters/09-function-state-flows.md`。
- 功能状态流续篇（二）：`chapters/10-function-state-flows-batch2.md`。
- 功能状态流续篇（三）：`chapters/11-function-state-flows-batch3.md`。
- 功能状态流续篇（四）：`chapters/12-function-state-flows-batch4.md`。
- 功能状态流续篇（五）：`chapters/13-function-state-flows-batch5.md`。
- 功能状态流续篇（六）：`chapters/14-function-state-flows-batch6.md`。
- 功能状态流续篇（七）：`chapters/15-function-state-flows-batch7.md`。
- 功能状态流续篇（八）：`chapters/16-function-state-flows-batch8.md`。
- 功能状态流续篇（九）：`chapters/17-function-state-flows-batch9.md`。
- 功能状态流续篇（十）：`chapters/18-function-state-flows-batch10.md`。
- 功能状态流续篇（十一）：`chapters/19-function-state-flows-batch11.md`。
- 功能状态流续篇（十二）：`chapters/20-function-state-flows-batch12.md`。
- 功能状态流续篇（十三）：`chapters/21-function-state-flows-batch13.md`。
- 功能状态流续篇（十四）：`chapters/22-function-state-flows-batch14.md`。
- 功能状态流续篇（十五）：`chapters/23-function-state-flows-batch15.md`。
- 功能状态流续篇（十六）：`chapters/24-function-state-flows-batch16.md`。
- 功能状态流续篇（十七）：`chapters/25-function-state-flows-batch17.md`。
- 功能状态流续篇（十八）：`chapters/26-function-state-flows-batch18.md`。
- 功能状态流续篇（十九）：`chapters/27-function-state-flows-batch19.md`。
- 功能状态流续篇（二十）：`chapters/28-function-state-flows-batch20.md`。
- 功能状态流续篇（二十一）：`chapters/29-function-state-flows-batch21.md`。
- 功能状态流续篇（二十二）：`chapters/30-function-state-flows-batch22.md`。
- 功能状态流续篇（二十三）：`chapters/31-function-state-flows-batch23.md`。
- 功能状态流续篇（二十四）：`chapters/32-function-state-flows-batch24.md`。
- 功能状态流续篇（二十五）：`chapters/33-function-state-flows-batch25.md`。
- 功能状态流续篇（二十六）：`chapters/34-function-state-flows-batch26.md`。
- 功能状态流续篇（二十七）：`chapters/35-function-state-flows-batch27.md`。
- 功能状态流续篇（二十八）：`chapters/36-function-state-flows-batch28.md`。
- 功能状态流续篇（二十九）：`chapters/37-function-state-flows-batch29.md`。
- 功能状态流续篇（三十）：`chapters/38-function-state-flows-batch30.md`。
- 功能状态流续篇（三十一）：`chapters/39-function-state-flows-batch31.md`。
- 功能状态流续篇（三十二）：`chapters/40-function-state-flows-batch32.md`。
- 功能状态流续篇（三十三）：`chapters/41-function-state-flows-batch33.md`。
- 功能状态流续篇（三十四）：`chapters/42-function-state-flows-batch34.md`。
- 功能状态流续篇（三十五）：`chapters/43-function-state-flows-batch35.md`。
- 功能状态流续篇（三十六）：`chapters/44-function-state-flows-batch36.md`。
- 功能状态流续篇（三十七）：`chapters/45-function-state-flows-batch37.md`。
- 功能状态流续篇（三十八）：`chapters/46-function-state-flows-batch38.md`。
- 功能状态流续篇（三十九）：`chapters/47-function-state-flows-batch39.md`。
- 功能状态流续篇（四十）：`chapters/48-function-state-flows-batch40.md`。
- 功能状态流续篇（四十一）：`chapters/49-function-state-flows-batch41.md`。
- 功能状态流续篇（四十二）：`chapters/50-function-state-flows-batch42.md`。
- 功能状态流续篇（四十三）：`chapters/51-function-state-flows-batch43.md`。
- 功能状态流续篇（四十四）：`chapters/52-function-state-flows-batch44.md`。
- 功能状态流续篇（四十五）：`chapters/53-function-state-flows-batch45.md`。
- 功能状态流续篇（四十六）：`chapters/54-function-state-flows-batch46.md`。
- 功能状态流续篇（四十七）：`chapters/55-function-state-flows-batch47.md`。
- 功能状态流续篇（四十八）：`chapters/56-function-state-flows-batch48.md`。
- 功能状态流续篇（四十九）：`chapters/57-function-state-flows-batch49.md`。
- 功能状态流续篇（五十）：`chapters/58-function-state-flows-batch50.md`。
- 功能状态流续篇（五十一）：`chapters/59-function-state-flows-batch51.md`。
- 功能状态流续篇（五十二）：`chapters/60-function-state-flows-batch52.md`。
- 功能状态流续篇（五十三）：`chapters/61-function-state-flows-batch53.md`。
- 功能状态流续篇（五十四）：`chapters/62-function-state-flows-batch54.md`。
- 功能状态流续篇（五十五）：`chapters/63-function-state-flows-batch55.md`。
- 功能状态流续篇（五十六）：`chapters/64-function-state-flows-batch56.md`。
- 功能状态流续篇（五十七）：`chapters/65-function-state-flows-batch57.md`。
- 功能状态流续篇（五十八）：`chapters/66-function-state-flows-batch58.md`。
- 功能状态流续篇（五十九）：`chapters/67-function-state-flows-batch59.md`。

## 2. 全站页面覆盖矩阵

| 功能区块 | 页面文件数 | 使用顺序角色 | 审计状态 |
|---|---:|---|---|
| 公开入口与认证 | 3 | 访客、未登录用户 | 已完成 `/`、`/login`、`/register` 和未登录受保护入口截图；已补登录错误、注册短密码状态和首页 CTA 登录模态 |
| 学生驾驶舱与个人中心 | 6 | 学生 | 已补认证态 `/dashboard`、`/missions`、`/profile`、evidence、growth、portfolio；第二十批补学生证据默认列表、课堂作答筛选、复盘课堂作答动作、课次过滤空态；第二十八批补证据详情、复盘落点和移动端证据卡；第三十六批补任务大厅筛选/启动目标、作品集课堂作品/仿真设计/伦理整改空态动作和移动端状态 |
| 互动学习通用入口 | 23 | 学生、访客 | 已完成 `/interactive-learning`、通用互动页、资源实例、讲义打印、播放列表代表和课堂加入；第三十八批补 `/playlists`、`/playlists/new`、`/playlists/[id]/play` 的列表、创建、保存和开始上课状态 |
| 互动课程入口 | 29 | 学生、教师、访客 | 已完成 29 个课程入口桌面/移动首屏，全部 200；第十六批补课堂码短码/无效码错误态；第十七批补真实课堂码 `129051` 从课程入口一次进入运行态 |
| 互动课程学生运行态 | 29 | 学生 | 已完成 29 个 `student/demo` 运行态桌面/移动首屏，全部 200；第十七批补真实课堂加入后的 active session 运行态；第十八批补真实课堂发放前、发放后、提交结果、结束后入口和个人证据回流 |
| 互动课程教师等待页 | 29 | 教师 | 已完成 29 个 `teacher/demo/waiting` 桌面/移动首屏，全部 200；二维码/课堂码为 demo 占位；第十七批补真实 session 等待页、复制课堂码/链接和开课 |
| 互动课程教师运行态 | 29 | 教师 | 已完成 29 个 `teacher/demo` 桌面/移动首屏，全部 200；54/58 张截图含 `Not found`；第十七批补真实 session 投影、本页工具、二维码弹窗和翻页；第十八批补发放作答、提交汇总、参考答案、结束课堂和已结束 session 直接访问；第二十九批复核已结束教师直达页仍呈现直播态 |
| 虚拟仿真 | 9 | 学生、访客 | 已完成 `/simulations`、7 个仿真详情与 `/virtual-lab` 重定向入口；第三十九批补目录搜索/筛选/视图/课程设计弹窗/空态、Cruise/Destroyer/Drilling 运行态、Arena 任务入口和移动端仿真状态 |
| Arena | 4 | 学生、教师、访客 | 已完成 `/arena`、挑战详情、教师 Arena 配置和教师发布报告代表；已补学生榜单/知识卡片、挑战进入工作台、官方评测提交、教师发布预览、真实发布后多次提交、证据回流状态、截止后报告夹具和控制工作台任务区合同 |
| AI、评估与学习路径 | 5 | 学生、教师 | 已补 `/assessment/adaptive-practice`、AI、copilot、文档反馈、prompt 评估、任务页；第十四/十五批补学习路径动作态和练习提交结果；第二十八批补 evidence-review intent、补练入口和 latest path API 空状态；第三十三批补学生报告反馈 demo、评分工作流状态和文档评分方法边界；第三十四批补全局 AI 侧栏、浮动工具和主题切换状态；第三十五批补 AI 工坊、独立 Copilot、Prompt 评估和作品集 AI 入口；第四十批补学习路径 landing/practice/generation/selection/execution/evidence-review 和 latest path API 状态 |
| 知识资源 | 1 | 学生、访客 | 已完成 `/knowledge` 截图；第三十八批补桌面/移动筛选、节点深链、布局工具可发现性和教师角色默认态 |
| 教师与数据中心 | 20 | 教师 | 已补登录态教师首页、班级、教案、资源、ResourceNode、课前包、Arena、历史、详情操作态、建班、教案保存、空教案发起课堂、移动班级搜索空态、移动班级分析长页、教师资源空搜索、Arena 预览、教师历史统计阻断页、进行中课堂投影页、真实等待页复制、真实投影二维码工具、真实课堂提交汇总和结束后返回路径、有效课后复盘、归档编辑、删除确认、未归档阻断、添加学生弹窗、班级学生 Excel 导入、移除学生确认、教师侧个体学情和学生证据页、教案编排器、资源编辑、知识节点预览、直发课堂投影、二维码、结束课堂、历史和复盘阻断；第三十批补课前包入口、直达页和 cluster 深链，确认 `CourseEnhancementPack` 表缺失导致 500；第三十三批复核课后复盘交付、报告账本、评分工作台和移动复盘动作区；第三十七批补教师数据中心、导出按钮、遗留学生诊断/证据路由和移动端证据页 |
| 管理员治理 | 8 | 管理员 | 已补登录态管理首页、用户、统计、配置、数据治理、教案、新建/编辑教案、用户弹窗/详情、批量导入错误/成功/后续动作缺口、移动用户搜索空态、移动数据治理/统计、移动新建账号模态、批量导入 file chooser、配置保存、配置校验、AI 模型测试、模态键盘行为、删除关联影响、模板下载、数据治理真实看板/刷新/标签页状态、批量导入畸形/缺列/混合成功失败/重复更新/导入后搜索状态，以及管理员治理处置/导出/撤销缺口复核；第三十三批补系统配置保存状态、用户批量导入状态、数据治理风险行和移动配置操作区复核；第三十七批补管理员数据中心和数据中心治理动作落点 |
| 内部 review 页面 | 9 | 内部审查 | 已补 `/review` 与 8 个 review 子页面桌面/移动首屏；第三十二批确认 review 移动页嵌入截图被裁剪且浮层重叠，不能替代真实移动验收 |
| 其他 | 1 | 访客/平台规范 | 已补 `/ethics`；背景图 404；第三十二批补跨角色 a11y/键盘路径抽查；第三十四批补跨角色权限边界、账户菜单、改密弹窗、退出登录和移动壳层导航 |

## 3. 用户使用顺序模型

### Step 1：访客进入公开首页

路径：`/`
证据：

- `screenshots/00-public-home/root_desktop_top.jpg`
- `screenshots/00-public-home/root_mobile_top.jpg`

健康度：中等偏好。

观察：

- 桌面首屏能直接表达产品主题、任务链入口、平台入口矩阵和半潜平台视觉资产。
- 主导航按学习、练习、挑战、实验、工作台和个人中心展开，符合学生探索顺序。
- 移动端主标题、CTA 和指标卡可读，但右下工具浮层压住第三个指标卡底部区域。

问题：

- P1：右下浮动工具在移动端重复覆盖内容。首页、登录、互动学习、仿真、知识图谱、学习路径均出现同类遮挡风险。
- P2：移动端顶部品牌区和工具按钮占据较多首屏高度，用户需要更早看到入口矩阵或当前任务。

建议：

- 给移动端浮动工具增加页面级 safe area，避免覆盖首屏卡片、筛选器和图谱工具。
- 首页移动端指标卡可改为横向可滑动或更短的两列密度，减少被 dock 挤压的机会。

### Step 2：未登录用户进入登录/受保护入口

路径：`/login`、未登录 `/dashboard`
证据：

- `screenshots/01-login/login_desktop_top.jpg`
- `screenshots/01-login/login_mobile_top.jpg`
- `screenshots/02-dashboard-unauth/dashboard_desktop_top.jpg`

健康度：中等。

观察：

- 登录页将账号登录、回调目标和学习意图卡放在同一画面，用户能理解登录后的角色驾驶舱。
- `/dashboard` 未登录时回到同一登录体验，说明受保护入口没有空白或崩溃。
- 移动端表单纵向顺序清楚。

问题：

- P2：从 `/dashboard` 进入时登录页仍显示“未指定回调目标”，与用户实际访问受保护目标不一致；这会削弱“登录后回到哪里”的确定性。
- P2：移动端登录页底部工具覆盖意图卡列表区域，影响浏览“学习/练习/挑战/实验/复盘”的解释。

建议：

- 受保护路由重定向登录时应把回调目标显式写入登录说明，例如“登录后返回学生驾驶舱”。
- 移动端登录页的意图卡应与 floating dock 保持最小避让距离。

### Step 3：学生进入互动学习总入口

路径：`/interactive-learning`
证据：

- `screenshots/03-interactive-learning/interactive-learning_desktop_top.jpg`
- `screenshots/03-interactive-learning/interactive-learning_mobile_top.jpg`

健康度：良好。

观察：

- 页面以“继续互动课程”和“查看证据复盘”为主，贴合学生继续学习顺序。
- 桌面端导航、意图标签、主卡片和二级卡片层级明确。
- 移动端将全局导航转换为两列入口，当前项高亮清楚。

问题：

- P2：移动端全局导航占用首屏高度较高，导致主要学习卡片下移。
- P2：右下工具压住下方“学习证据”区域开头，形成重复的局部遮挡。

建议：

- 学生二级入口移动端可折叠为当前路径 + 菜单按钮，不必默认展开全部六个导航项。
- 对所有 AppShell 页面统一增加 floating dock 与主体内容的避让合同。

### Step 4：学生选择课程

路径：`/interactive-learning/courses`
证据：

- `screenshots/04-course-catalog/interactive-learning_courses_desktop_top.jpg`
- `screenshots/04-course-catalog/interactive-learning_courses_desktop_section2.jpg`
- `screenshots/17-auth-student/mobile-interactive-learning-courses.png`

健康度：中等偏好。

观察：

- 桌面端课程目录首屏有模块阶段、课程类型、启动动作三组筛选，并优先展示精品课程。
- 课程卡片包含课程类型、课次、时长、标题、摘要和进入动作，信息完整。

问题：

- P2：第十三批已补课程目录移动端默认态和搜索输入态；填入明显无匹配关键词后仍显示完整课程列表，没有空态、结果数量变化或清除条件反馈。
- P2：筛选器是细长输入形态，但没有显式下拉/多选状态，用户可能不知道“模块进阶/课程类型/启动动作”是否可操作。

建议：

- 课程目录需要让搜索/筛选真实影响结果，或把输入用途说明清楚；无结果时应提供空态和清除条件。
- 课程目录建议把“优先推荐”和筛选条件的关系说清楚，例如当前推荐原因、可用状态、课堂/自学差异。

### Step 5：学生进入虚拟仿真目录

路径：`/simulations`
证据：

- `screenshots/05-simulations/simulations_desktop_top.jpg`
- `screenshots/05-simulations/simulations_mobile_top.jpg`

健康度：中等。

观察：

- 页面明确把仿真整理为“任务、对象和控制主题”，并提供继续实验 CTA。
- 搜索、难度、目录视图、结果数量和类型筛选在桌面端完整呈现。
- 移动端主要 CTA 保持可见。

问题：

- P1：第十三批确认移动端空搜索会显示 `0 个仿真` 和无匹配文案，但全局导航和筛选区叠加后首屏信息密度仍高，右下工具覆盖“视图”切换区域。
- P2：桌面端筛选控件占据大量首屏，真正的仿真结果列表被推到首屏下方。

建议：

- 移动端默认收起高级筛选，只保留搜索和继续实验。
- 桌面端可把视图切换、结果数量和类型筛选压缩到一行，让至少一个仿真卡片进入首屏。

### Step 6：学生进入 Arena

路径：`/arena`
证据：

- `screenshots/06-arena/arena_desktop_top.jpg`
- `screenshots/33-interactive-generic-resource-arena-routes/mobile-arena.png`

健康度：中等。

观察：

- 桌面首屏能表达 Arena 是能力训练地图，并展示对象来源、挑战任务、评分协议和榜单结构。
- 筛选条件覆盖对象来源、允许方法、公开程度、难度、训练阶段、训练能力、任务属性和榜单。

问题：

- P2：首批缺少移动端截图，后续结构化路线已补 `/arena` 移动端代表证据；仍需继续压缩移动端筛选密度。
- P2：桌面筛选器过多，首屏右侧像配置面板，不像学生首要任务选择面板；挑战列表被推到下方。

建议：

- 学生默认视图应优先展示“推荐挑战/当前阶段/最近提交”，高级筛选折叠。
- 教师配置和学生挑战筛选应明显区分，避免学生入口像后台配置。

### Step 7：学生进入知识资源

路径：`/knowledge`
证据：

- `screenshots/07-knowledge/knowledge_desktop_top.jpg`
- `screenshots/07-knowledge/knowledge_mobile_top.jpg`

健康度：中等。

观察：

- 桌面端图谱视觉冲击强，节点数量、关系数量和结构优先级直接可见。
- 移动端保留目录、筛选、图例、视图、关系和展开工具。

问题：

- P1：移动端图谱工具栏拥挤，多个短按钮并列，右下工具继续覆盖图谱区域。
- P2：图谱首屏视觉上强，但缺少“下一步做什么”的学生导向；用户容易停留在观察图，而不知道该点节点、筛选关系还是进入资源。

建议：

- 移动端首屏需要一个明确的默认任务，例如“从当前课程继续”“查找知识点”“查看推荐资源”。
- 图谱工具栏应按使用频率分组，低频项进入更多菜单。

### Step 8：学生进入自适应学习路径

路径：`/assessment/adaptive-practice`
证据：

- `screenshots/08-adaptive-practice/assessment_adaptive-practice_desktop_top.jpg`
- `screenshots/08-adaptive-practice/assessment_adaptive-practice_mobile_top.jpg`

健康度：良好。

观察：

- 页面清楚表达“证据还少，先从入口路径开始”，当前建议和当前节点都可见。
- 桌面端把当前建议、学习概况和路径准备状态并置，符合学习路径中心定位。
- 移动端主要 CTA 可见，路径说明可读。

问题：

- P2：移动端“当前建议”卡片被底部工具部分压住，影响继续阅读。
- P2：桌面端右下 Konling 控件与学习概况卡片边缘接近，状态较多时可能遮挡。

建议：

- 学习路径页应把 floating dock safe area 写入可视验收，而不是逐页靠内容自然留白。
- 对证据不足状态，建议补一个“为什么先进入入口路径”的可展开解释，降低用户对系统随机推荐的疑虑。

### Step 9：学生进入控制工作台

路径：`/interactive-learning/control-workbench`
证据：

- `screenshots/09-control-workbench/interactive-learning_control-workbench_desktop_top.jpg`
- `screenshots/33-interactive-generic-resource-arena-routes/mobile-interactive-learning-control-workbench.png`
- `screenshots/38-function-state-flows-batch3/arena-challenge-enter-workbench-result-desktop.png`
- `screenshots/40-function-state-flows-batch5/student-arena-official-submit-result-mobile.png`

健康度：中等。

观察：

- 首屏直接给出当前目标、任务链、下一行动和证据状态，符合工程工作区的决策顺序。
- 页面明确区分自由探索模式和官方评价/榜单边界。

问题：

- P1：移动端后续已补官方提交结果，证明工作台可进入并提交；但提交入口位于长页面深处，移动任务效率不足。
- P2：桌面右侧局部浮动控制和右下全局工具同时贴近工作区，视觉上像两个独立工具系统。
- P2：首屏显示大量工作区状态，但用户第一步操作入口不够突出，指标卡区域比“开始设计/选择对象/调整参数”更抢眼。

建议：

- 控制工作台应把“下一行动”转成明确主按钮或当前步骤焦点，而不仅是状态文本。
- 将局部控制浮层与全局 Konling dock 的避让规则写入任务工作区合同。

### Step 10：学生进入仿真详情

路径：`/simulations/cruise`
证据：

- `screenshots/10-simulation-cruise/simulations_cruise_desktop_top.jpg`
- `screenshots/10-simulation-cruise/simulations_cruise_mobile_top.jpg`

健康度：中等偏低。

观察：

- 3D 场景首屏强，真实对象和海面环境能立即建立仿真语境。
- 桌面和移动都能看到场景主体、局部控制、教学提示和全局导航。

问题：

- P1：移动端“工具”浮层覆盖顶部导航区域，底部局部控件和提示气泡同时叠在 3D 场景上，影响操控。
- P1：桌面端首屏下沿同时出现说明气泡、控制条、全局 dock 与局部按钮，层级冲突明显。
- P2：3D 场景明亮区域嵌在深色平台壳层中，视觉断层较强，降低统一产品感。

建议：

- 仿真详情需要专用 mobile command deck：全局导航折叠、局部工具进底部 sheet、Konling dock 避让场景主控。
- 对 3D 场景外壳建立统一色彩/遮罩规范，避免深色 AppShell 与浅色 WebGL 场景割裂。

### Step 11：学生查看 Arena 挑战详情

路径：`/arena/challenges/task-second-order-lead-pid`
证据：

- `screenshots/11-arena-challenge-detail/arena_challenges_task-second-order-lead-pid_desktop_top.jpg`
- `screenshots/33-interactive-generic-resource-arena-routes/mobile-arena-challenges-task-second-order-lead-pid.png`

健康度：中等。

观察：

- 详情页主 CTA “进入控制工作台”非常明确。
- 首屏显示对象来源、公开程度、工作台和榜单规则，能帮助学生判断挑战边界。

问题：

- P2：第十三批确认挑战详情移动端第一视口内可见“进入控制工作台”，主要问题转为 CTA 附近的规则摘要、提交承诺和浮层避让。
- P2：首屏在顶部导航按钮和挑战主卡之间留白偏大，任务说明卡下移；挑战详情像静态介绍页，不像即将开始任务的操作页。
- P2：对象说明、模型表达和规则内容在首屏下方，学生点击前可能仍不清楚挑战评价重点。

建议：

- 将“评价指标/硬约束/提交后反馈”摘要前置到 CTA 附近。
- 移动端挑战详情应保留 CTA 首屏可见策略，并继续检查榜单/规则、提交次数和浮层是否干扰操作。

### Step 12：学生查看课程入口详情

路径：`/interactive-learning/courses/unit-1-1-see-the-full-picture`、`/interactive-learning/courses/unit-1-2-modeling-from-object-to-system`
证据：

- `screenshots/12-course-entry-1-1/interactive-learning_courses_unit-1-1-see-the-full-picture_desktop_top.jpg`
- `screenshots/13-course-entry-1-2/interactive-learning_courses_unit-1-2-modeling-from-object-to-system_desktop_top.jpg`
- `screenshots/23-course-entry-all/mobile-interactive-learning-courses-unit-1-1-see-the-full-picture.png`
- `screenshots/23-course-entry-all/mobile-interactive-learning-courses-unit-1-2-modeling-from-object-to-system.png`

健康度：中等。

观察：

- 1-1 与 1-2 的入口模板一致，课程标题、摘要、标签、预计时长、页数、模块数和进入路径都清楚。
- “教师创建课堂后进入等待页、学生用课堂码加入、访客只演示浏览”的路径说明有助于区分角色。

问题：

- P1：首批缺少移动端截图，后续课程入口全集已补 29 个入口移动端；主要问题转为标题截断、导航占高和浮层遮挡。
- P2：入口页把教师/学生/访客路径写成说明条，但缺少可操作按钮或角色化 CTA；用户需要自己理解下一步。

建议：

- 课程入口首屏可提供三个角色化动作：教师开课、学生加入、访客演示。
- 对 29 个课程入口可按共享模板抽样视觉审计，但每个真实路由必须保留覆盖表和异常检查。

### Step 13：学生进入互动课程运行态

路径：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo`
证据：

- `screenshots/14-course-student-runtime-4-1-demo/interactive-learning_courses_unit-4-1-design-task-expression_student_demo_desktop_top.jpg`
- `screenshots/14-course-student-runtime-4-1-demo/interactive-learning_courses_unit-4-1-design-task-expression_student_demo_mobile_top.jpg`

健康度：中等。

观察：

- 运行态能清楚显示课程标题、当前步骤、页码、demo 状态和“不写入课堂状态”的边界。
- 移动端仍保留课程导航和当前页面说明。

问题：

- P1：移动端顶部面包屑被严重截断，课程标题也被截断；学生难以确认当前课次全称。
- P1：右下工具覆盖课程内容下缘；桌面端也压在图面区域。
- P2：4-1 首屏大白色课程图片嵌入深色运行态，视觉割裂明显。
- P2：dev 日志显示 demo 未登录事件上报返回 401，虽然不阻断页面，但会污染运行态审计日志并可能影响数据可信度。
- P2：首屏课程图片触发 Next LCP 提示，建议 above-the-fold 图像配置 eager 或优化加载。

建议：

- 学生运行态移动端应减少全局导航占高，优先保留课名、当前步骤和活动操作。
- demo 模式事件上报应明确跳过或使用 guest-safe endpoint，避免 401 噪声。
- 首屏课程图像与深色壳层之间需要统一容器边界或暗色适配资源。

### Step 14：教师和管理员未登录入口

路径：`/teacher`、`/admin`
证据：

- `screenshots/15-teacher-unauth/teacher_desktop_top.jpg`
- `screenshots/16-admin-unauth/admin_desktop_top.jpg`

健康度：权限入口正常，登录态已在后续章节补证。

观察：

- 未登录访问教师/管理员入口都会重定向到登录页，没有暴露后台内容。
- 登录体验与 `/dashboard` 未登录状态一致。
- 后续第 02、07、09、10、12、13 章已使用固定教师/管理员账号补充后台首页、班级、教案、课堂、Arena、用户管理、有效导入、系统配置和 AI 模型测试等登录态证据。

问题：

- P2：登录页仍未把“教师端/管理员后台”回调目标讲清楚。
- P2：教师/管理员核心后台已补多批登录态证据；有效导入后的通知/撤销动作缺口、有效课后报告链路、配置失败态、真实发布报告、截止后报告、删除影响范围和多类关键读屏语义抽查均已有证据，全站 a11y 断点已完成证据收口，修复仍未闭环。

建议：

- 登录页应根据 callbackUrl 显示“登录后进入教师驾驶舱/管理员后台”。
- 后续登录态审计优先补更多角色的长表格键盘路径、移动端筛选展开态、全站图表替代文本、表单错误播报和浮层读屏顺序的完整覆盖。

## 4. 首批横向问题

认证态角色流程详见 `chapters/02-authenticated-role-flows.md`。该续篇新增一个阻断问题：`/teacher/prep-packs` 在真实教师登录态下桌面和移动均返回 500，日志显示 `CourseEnhancementPack` 数据表缺失导致 Prisma `P2021`。

Profile、review 与仿真深层页面详见 `chapters/03-profile-review-simulation-depth.md`。该续篇补齐学生 profile 子页、全部 review 子页、7 个仿真详情和 `/virtual-lab` 兼容入口，进一步确认移动端浮动层与首屏任务优先级是跨功能区问题。

互动课程入口全集详见 `chapters/04-course-entry-all.md`。该续篇确认 29 个课程入口在学生登录态下桌面/移动均返回 200，并将移动端标题截断、导航占高、浮层遮挡记录为入口族共性问题。

互动课程学生运行态全集详见 `chapters/05-course-student-runtime-demo-all.md`。该续篇确认 29 个 `student/demo` 运行态在学生登录态下桌面/移动均返回 200，并将移动端 demo 状态占高、底部浮层遮挡和标题截断记录为运行态共性问题。

互动课程教师等待页与投影运行态详见 `chapters/06-course-teacher-waiting-runtime-demo-all.md`。该续篇确认 29 个教师等待页与 29 个教师投影运行态均返回 200，但等待页二维码/课堂码处于 demo 占位，教师投影运行态 54/58 张截图出现 `Not found` 文本，属于教师课堂投影链路阻断风险。停止日志还显示 `/api/session/demo` 404、`POST /api/session/demo/state` 500（`StudentState_sessionId_fkey`）和 `/api/interactive/events` 500（`\u0000 cannot be converted to text`），说明教师 demo 运行态存在同步/事件写入后端错误。

详情操作态与 AI/评估辅助页详见 `chapters/07-detail-auxiliary-pages.md`。该续篇确认有效拥有者教师账号下班级详情、班级分析、学生详情、学生证据、教案编辑和课堂复盘均可访问；管理员教案新建/编辑、学生 AI、文档反馈、prompt 评估、任务、伦理、课堂加入和播放列表也均返回 200。新增风险集中在预置教案封面图 404、伦理页背景图 404、移动端信息密度与浮层遮挡，以及辅助页缺少回到学习任务的上下文。

结构化剩余路线与 Arena 发布报告详见 `chapters/08-structured-remaining-routes.md`。该续篇确认公开认证页、Arena、通用互动页、资源实例、讲义打印、播放列表代表、知识图谱、遗留教师学生路由和教师 Arena 发布报告均已补桌面/移动证据；按 `route-inventory.md` 的 205 个 App Router 页面模板核对，页面模板截图缺口为 0。新增最高风险是 `/playlists/[id]/play` 静默回到首页，播放意图被中断。

功能状态流详见 `chapters/09-function-state-flows.md`。该续篇确认登录错误、课堂加入失败、Arena 榜单/知识卡片、教师建班、教案保存、教师 Arena 发布预览、管理员用户弹窗和系统配置校验等首批交互状态；新增最高风险是注册短密码触发 runtime error，另有空环节教案可保存、教师 Arena 默认班级 `class-2026-control` 不存在、管理员弹窗 `Esc` 不关闭并拦截后续操作。

第二批功能状态流详见 `chapters/10-function-state-flows-batch2.md`。该续篇确认控制工作台参数抽屉、教师班级搜索空态、管理员用户详情、移动端新建账号弹窗、系统配置保存和供应商添加状态；新增最高风险是 0 环节教案仍可直接发起课堂，进入 `Waiting for content...` 与 `1 / 0` 的正式教师课堂界面。

第三批功能状态流详见 `chapters/11-function-state-flows-batch3.md`。该续篇确认 Arena 挑战页正式 CTA 能正确进入挑战模式工作台，并显示官方评价、指标阈值和“提交官方评测”；同时确认非规范 `source=arena&taskId=...` 深链会静默降级为自由探索，管理员批量导入无效 CSV 能显示解析错误但缺少就近模板恢复动作。

第四批功能状态流详见 `chapters/12-function-state-flows-batch4.md`。该续篇确认学生官方评测提交、教师课堂结束和管理员 AI 模型测试均可执行；新增风险集中在官方提交结果解释不够清楚、提交后仍可重复点击、课堂结束依赖原生 confirm 且结束后 0 环节教案仍可再次开始。

第五批功能状态流详见 `chapters/13-function-state-flows-batch5.md`。该续篇确认管理员有效 Excel 导入、AI 模型测试 loading、教师课后复盘失败态和学生移动端官方提交；新增风险集中在移动端提交入口过深、空课堂复盘链路断裂、AI loading 状态表达偏轻，以及有效导入缺少后续通知/撤销动作。

第六批功能状态流详见 `chapters/14-function-state-flows-batch6.md`。该续篇确认有效已结束课堂复盘、AI 模型测试失败态和登录页键盘焦点抽查；新增风险集中在复盘页缺少教师后台回流路径、能力下降缺少数据口径解释、AI 失败态缺少故障分类与恢复建议，以及全站 a11y 仍未系统覆盖。

第七批功能状态流详见 `chapters/15-function-state-flows-batch7.md`。该续篇确认管理员真实创建/删除教师账号、教师通过 UI 真实发布 Arena 挑战、学生通过真实 publicationId 提交官方评测、教师查看提交后发布报告；新增风险集中在教师账号删除影响范围不透明、发布列表重复项难辨、班级范围使用内部 id、真实发布报告仍以技术 id 和 0 分有效提交为主。

第八批功能状态流详见 `chapters/16-function-state-flows-batch8.md`。该续篇确认管理员有效导入后的后续治理动作缺口、导入上传控件语义、新建账号模态键盘焦点行为和注册短密码当前错误态；新增风险集中在导入成功后没有本次新增筛选/通知/撤销、隐藏上传 input 可访问名称错误、模态缺少焦点陷阱且 Escape 无效，以及注册短密码仍触发 Runtime Error。

第九批功能状态流详见 `chapters/17-function-state-flows-batch9.md`。该续篇确认真实 Arena 发布支持同一学生同一 publication 多次有效提交，学生挑战详情显示提交次数 2，教师报告显示提交次数 2 和两个 demo 方案；新增风险集中在重复提交采用规则不清、0 分有效提交被列为优秀方案、工作台成功态承诺证据回流但学生证据页和成长页未出现 Arena 记录。

第十批功能状态流详见 `chapters/18-function-state-flows-batch10.md`。该续篇确认管理员删除带关联数据的教师账号时，后端实际删除用户、班级、非预置教案、资源、教案环节、课堂会话和状态记录；新增风险集中在列表、详情、原生 confirm 和成功通知都不展示这些影响范围，删除风险被压缩成“账号”。

第十一批功能状态流详见 `chapters/19-function-state-flows-batch11.md`。该续篇补课堂加入错误态、学生 Arena 官方工作台和教师真实复盘页的 DOM/a11y 快照；新增风险集中在表单错误缺少 `aria-live`/`role=alert`，核心图表缺少替代文本，控灵/浮层存在无名按钮和读屏顺序不清。

第十二批功能状态流详见 `chapters/20-function-state-flows-batch12.md`。该续篇补本地审计夹具的已截止 Arena 发布报告、管理员统计页、学生成长页和教师班级分析页的 DOM/a11y 快照；新增风险集中在报告缺少已截止/逾期提交口径，管理员/学生/教师图表缺少等价文本，`/teacher/classes/[classId]/analytics` 实际归并到 `/analytics-v2`。

第十三批功能状态流详见 `chapters/21-function-state-flows-batch13.md`。该续篇补学生移动端驾驶舱、课程目录默认与搜索输入态、仿真空搜索、Arena 挑战首屏 CTA、知识搜索、个人证据筛选空态和个人中心回流；新增风险集中在课程目录搜索无可感知过滤结果、仿真视图切换被浮层覆盖、个人证据筛选空态缺少 live/status 语义，以及学生主路径仍被导航和筛选稀释。

第十四批功能状态流详见 `chapters/22-function-state-flows-batch14.md`。该续篇补首页 CTA 登录模态、学生自适应学习路径动作态、课堂加入表单两类输入状态、教师课堂历史/班级搜索/班级分析移动态、管理员用户搜索/数据治理/统计移动态；新增风险集中在课堂加入无效码无反馈、自适应路径状态与练习执行关系不清、教师班级分析移动长表格过重、管理员用户表格移动端列压缩，以及统计/分析图表仍缺等价文本。

第十五批功能状态流详见 `chapters/23-function-state-flows-batch15.md`。该续篇补自适应练习展开提交结果、控制工作台支持工具和官方评测提交结果、教师班级加入码/资源空态、管理员新建账号模态焦点、批量导入 file chooser、系统配置保存和添加模型校验；新增风险集中在练习提交完成态不明确、工作台结果/图表仍缺读屏语义、班级加入码操作反馈不足、批量导入缺可见确认层，以及配置保存成功态过轻。

第十六批功能状态流详见 `chapters/24-function-state-flows-batch16.md`。该续篇补课程入口课堂码校验、学生课程运行态动作、讲义导出、教师班级/课堂历史/进行中课堂、管理员用户模态、批量导入、数据治理和后台总览；新增风险集中在课堂码错误区分不足、讲义导出和刷新反馈不足、教师历史统计阻断页缺恢复动作、数据治理移动风险表不可读。

第十七批功能状态流详见 `chapters/25-function-state-flows-batch17.md`。该续篇补真实课堂码 `129051` 的扫码/链接加入、课程入口加入、教师等待页复制与开课、教师投影二维码工具、管理员模板下载和数据治理标签页；新增风险集中在扫码入口第一步只查询不加入且无状态解释、学生运行态暴露 raw sessionId、教师二维码入口默认折叠较深、复制/下载/标签切换缺少 live/status 语义。

第十八批功能状态流详见 `chapters/26-function-state-flows-batch18.md`。该续篇补真实 4-1 课堂发放作答、学生提交、教师汇总、参考答案切换、结束课堂、学生证据回流和教师结束后返回路径；新增风险集中在发放/提交/汇总缺少 live/status、结束课堂影响范围不足、学生结束后入口断裂、已结束 session 仍呈现直播投影界面。

第十九批功能状态流详见 `chapters/27-function-state-flows-batch19.md`。该续篇补管理员数据治理真实总览/刷新/课堂质量/证据源/缓存健康，以及批量导入畸形 Excel、缺列 Excel、混合成功失败、重复更新和导入后搜索回查；新增风险集中在数据治理只读化、刷新/标签切换缺少 selected/live 语义、批量导入第一步缺确认层、上传 input 可访问名称错误、错误状态不持久，以及导入成功/更新缺少批次治理。

第二十批功能状态流详见 `chapters/28-function-state-flows-batch20.md`。该续篇补教师上课历史、搜索、归档编辑、删除确认取消、有效课堂复盘、复盘页后续导航、未归档复盘阻断、学生证据默认列表、课堂作答筛选、复盘课堂作答动作和课次过滤空态；新增风险集中在课后复盘缺少导出/发送/补强动作、复盘出口跳内部评审页、未归档阻断缺修复入口、证据 lessonId 与课程 route slug 不一致、证据复盘动作只是再次过滤列表，以及刷新/筛选缺少 live/status。

第二十一批功能状态流详见 `chapters/29-function-state-flows-batch21.md`。该续篇补教师班级详情、班级加入码、143 人学生清单、添加学生弹窗、搜索添加、Excel 导入、无效导入结果、移除学生确认取消、教师侧学生个体学情和教师侧学生证据桌面/移动状态；新增风险集中在班级学生清单缺少搜索/筛选/批量治理和移动端重构、移除学生影响范围不透明、添加学生弹窗缺 dialog/focus/live 语义、班级学生 Excel 导入缺预览和批次治理、教师个体学情推荐动作不可执行，以及教师侧证据审核缺核验与处置闭环。

第二十二批功能状态流详见 `chapters/30-function-state-flows-batch22.md`。该续篇补教师教案列表、更多菜单、删除确认、新建/编辑教案编排器、空标题校验、资源库空搜索、资源预览、教师资源管理三类标签、资源编辑、知识节点预览和教师资源移动状态；新增风险集中在教案删除影响范围不透明、编排器过度依赖拖拽、空标题校验使用原生 alert、资源搜索/预览缺少后续动作、资源编辑缺使用影响、知识节点大规模列表与未命名按钮过多，以及课堂组件标签缺少教师下一步路径。

第二十三批功能状态流详见 `chapters/31-function-state-flows-batch23.md`。该续篇补教师从教案列表直发课堂、课程专属教师投影桌面/移动、二维码弹窗、在线学生入口、翻页同步、结束课堂确认、结束后落点、上课历史和直发课堂复盘阻断；新增风险集中在发起课堂缺班级绑定、无班级 ACTIVE session 可重复创建、投影与二维码缺班级/临时课堂身份、翻页/复制/结束缺 live/status、结束后落点不承接课后工作流、直发课堂复盘被未绑定班级阻断，以及关键教师运行态控件可访问查询不稳定。

第二十四批功能状态流详见 `chapters/32-function-state-flows-batch24.md`。该续篇补真实班级 `2024自动化` 绑定课堂、两名真实学生通过课堂码加入、教师在线人数、`step-03` 发放作答、双学生移动端提交、教师双提交汇总、参考答案切换、移动端结束课堂、学生证据回查和教师复盘页；新增风险集中在班级发起流程不完整、班级绑定投影/二维码仍缺班级身份、学生运行态暴露 raw session id、在线学生入口缺名单和心跳、发放作答缺送达确认、教师汇总缺步骤级总体口径、学生结束后落点断裂、学习证据重复风险，以及复盘页缺导出/发送/补强路径等报告交付动作。

第二十五批功能状态流详见 `chapters/33-function-state-flows-batch25.md`。该续篇补课后复盘深层动作、班级历史中的报告入口、教师首页报告账本槽位、报告评分工作台空态/demo 态，以及真实班级控制纠偏报告导出、助手效果报告导出和已结束课堂历史 API；新增风险集中在已结束课堂历史不承接报告交付、复盘页真实数据与报告动作断开、评审聚合入口语义偏内部、真实导出 API 与 UI 断开、助手效果报告真实班级仍 demo-only、报告评分工作台缺少真实来源路径，以及移动端复盘缺少固定交付动作区。

第二十六批功能状态流详见 `chapters/34-function-state-flows-batch26.md`。该续篇补教师 Arena 发布配置、active/expired 发布报告、学生 Arena 大厅、学生 active/expired challenge、教师发布列表 API 和学生榜单 submissions API；新增风险集中在已发布列表暴露内部 classId、expired publication 仍像 active、报告标题和班级上下文内部化、0 分有效提交被列为优秀方案、报告缺少交付和结算动作、学生端 active/expired publication 无明显差异，以及全局榜单/班级榜/作业榜来源边界不清。

第二十七批功能状态流详见 `chapters/35-function-state-flows-batch27.md`。该续篇补管理员首页、数据治理总览、刷新状态、用户批次操作、系统配置桌面/移动状态，以及 overview、data-governance/status、system-usage、users search 和 template 下载 API；新增风险集中在数据治理风险清单缺处置动作、数据新鲜度 stale 缺修复入口、刷新缺完成播报、用户导入缺批次治理闭环、上传控件命名错误、系统配置保存缺影响范围和状态播报，以及管理员移动端缺固定关键操作区。

第二十八批功能状态流详见 `chapters/36-function-state-flows-batch28.md`。该续篇补学生证据默认列表、4-1 课次过滤、复盘课堂作答落点、自适应补练入口、evidence-review intent、latest path API 和移动端证据/补练状态；新增风险集中在“复盘课堂作答”只回到同一证据列表、错题证据缺少直接补练、补练入口不继承证据上下文、`path=null` 与进度文案冲突、evidence-review intent 未形成证据复盘视图，以及移动端证据卡被浮层干扰。

第二十九批功能状态流详见 `chapters/37-function-state-flows-batch29.md`。该续篇补 Arena 官方控制工作台桌面/移动任务区合同、移动端底部状态、已结束课堂教师投影直达页和同 session 复盘页；新增风险集中在控制工作台缺少实际 `bottom-tools`、移动端关键动作被长仪表流稀释、浮层避让仍不充分、已结束教师直达页仍呈现直播态、直达页缺少复盘/报告转场，以及复盘页报告交付动作不足。

第三十批功能状态流详见 `chapters/38-function-state-flows-batch30.md`。该续篇补教师工作台课前包入口、班级分析来源页、课前包直达页、cluster 深链和移动端阻断状态；新增风险集中在 `/teacher/prep-packs` 返回 500、`CourseEnhancementPack` 表缺失阻断复核页、工作台入口通向阻断页、班级诊断结果没有就地连接课前包复核、错误状态没有产品级恢复动作，以及移动端课前包报告槽位过深。

第三十一批功能状态流详见 `chapters/39-function-state-flows-batch31.md`。该续篇复核管理员数据治理风险处置、刷新、导出、用户批量导入可逆性、系统配置保存反馈和移动端关键动作；新增风险集中在风险清单仍缺行内处置、刷新缺完成播报、数据治理缺导出入口、批量导入缺预览/通知/撤销/批次审计、上传控件语义错误仍存在、配置保存缺影响范围和完成状态，以及管理员移动端缺固定治理动作区。

第三十二批功能状态流详见 `chapters/40-function-state-flows-batch32.md`。该续篇补跨角色 a11y 与键盘路径抽查，覆盖注册短密码、课堂码错误、自适应学习路径、学生证据、教师班级分析、添加学生弹窗、教案编排器、管理员刷新/下载和内部 review 移动页；新增风险集中在注册短密码 runtime error、课堂码错误缺 alert/live、全局控灵过早进入 Tab 顺序、证据复盘焦点不服务任务、教师弹窗缺 dialog/focus trap、图表/刷新缺状态、编排器缺键盘等价操作、管理员操作缺完成状态，以及 review 移动页不能替代真实移动验收。

第三十三批功能状态流详见 `chapters/41-function-state-flows-batch33.md`。该续篇补真实课后复盘报告交付、复盘出口、教师工作台报告账本、报告评分工作台空态、学生文档评分反馈 demo、系统配置保存状态、用户批量导入状态、数据治理风险行和移动端关键操作区；新增风险集中在控制纠偏报告导出 API 与教师 UI 断开、复盘页出口仍跳内部 review 聚合面、报告账本缺节次级交付状态、评分工作台空态缺来源路径、学生反馈动作过多且状态不清、文档评分缺完成状态播报、系统配置缺影响范围和保存结果、用户导入缺批次状态机、数据治理风险清单仍只读，以及管理员移动端缺固定关键操作与状态回显。

第三十四批功能状态流详见 `chapters/42-function-state-flows-batch34.md`。该续篇补跨角色权限边界、账户菜单、改密弹窗、退出登录、全局浮动工具、主题切换、AI 侧栏和移动端壳层导航；新增风险集中在跨角色访问静默重定向、权限边界缺可审计状态、账户菜单缺菜单语义、改密弹窗缺 dialog/focus trap、改密错误缺 alert/live、全局工具缺弹出层语义、主题切换缺完成播报、AI 侧栏缺区域语义和焦点 containment、Escape 后焦点恢复不稳定、移动端导航入口不统一、移动端 AI 先于主任务进入焦点路径，以及全局浮层移动端避让不足。

第三十五批功能状态流详见 `chapters/43-function-state-flows-batch35.md`。该续篇补 AI 工坊、独立 Copilot、Prompt 评估、作品集提示词入口、作品集反思入口和移动端 AI 输入状态；新增风险集中在 AI 工坊任务选择只有视觉状态、Copilot 暴露证据核验内部诊断、AI/Copilot 与全局 AI 控件竞争、Prompt 评价/校验/演示生成缺少完成播报、demo 轨迹与真实学生历史边界不清、作品集提示词空态动作落到 404、反思入口不保留上下文，以及移动端 Prompt/Copilot 底部浮层避让不足。

第三十六批功能状态流详见 `chapters/44-function-state-flows-batch36.md`。该续篇补学生任务大厅筛选、任务启动目标、学习路径 query 上下文、作品集课堂作品/仿真设计/伦理整改空态动作、Prompt 档案回查和移动端任务/作品集状态；新增风险集中在任务卡整卡链接与内部按钮重复、筛选缺少结果播报、`/missions?project=goal` 不解释路径上下文、任务启动后仿真页不继承任务标题/目标/回写规则、作品集空态动作都落到泛化页面、伦理整改动作与整改记录语义不一致、作品集收录规则不可见，以及移动端任务卡/作品集标签与全局浮层关系仍需治理。

第三十七批功能状态流详见 `chapters/45-function-state-flows-batch37.md`。该续篇补平台数据中心教师/管理员/学生角色状态、学生 `returnTo` 重定向、数据中心治理动作、导出按钮、教师侧学生诊断/证据遗留路由、规范学生详情/证据页和移动端数据中心/证据页；新增风险集中在学生访问数据中心被静默改道、演示数据与正式工作区边界不足、教师治理动作落到泛化首页、导出按钮被右下控灵浮层截获、导出和刷新缺少状态播报、教师侧学生证据缺审核处置闭环，以及跨角色访问教师遗留路由缺权限说明。

第三十八批功能状态流详见 `chapters/46-function-state-flows-batch38.md`。该续篇补知识图谱桌面/移动筛选、节点深链、布局工具，播放列表列表页、新建课程流、空标题校验、知识点添加、保存回流、开始上课跳转和移动端课程流；新增风险集中在知识节点深链无法解析、公开课程流开始上课静默落首页、课程流保存后丢失已添加知识点、默认知识库渲染规模过大、课程流校验使用原生 alert、课程流图标按钮缺少可访问名称，以及移动端知识图谱和课程流信息密度过高。

第三十九批功能状态流详见 `chapters/47-function-state-flows-batch39.md`。该续篇补虚拟仿真目录默认态、搜索、难度/模式组合、卡片视图、课程设计弹窗、空搜索、`/virtual-lab` 兼容重定向、Cruise/Destroyer/Drilling 仿真运行态、Cruise Arena 任务入口和移动端目录/仿真状态；新增风险集中在仿真命令甲板 `bottom-tools` 合同存在但不可见、移动端仿真工具被全局浮层干扰、Arena 黑箱工作台表单被挤压、目录筛选缺少状态播报、空态缺少恢复动作、旧入口重定向缺少说明，以及移动端目录过长。

第四十批功能状态流详见 `chapters/48-function-state-flows-batch40.md`。该续篇补学生自适应学习路径中心的 landing、practice、generation、selection、execution、evidence-review、latest path API 和移动状态；新增风险集中在 latest path 为 `null` 时仍显示进度、学习者状态 503 与路径顾问 403 没进入生成面板、evidence-review 空路径只显示选择历史、path-selection 空路径仍显示 3 条可比较路径、path-execution 空路径降级为练习资源入口、无 goal 生成入口上下文不稳、移动端浮层干扰，以及路径状态变化缺少 live/status。

第四十一批功能状态流详见 `chapters/49-function-state-flows-batch41.md`。该续篇补全局 AppShell、共享浮动工具、Global AI 侧栏、主题切换、移动抽屉导航、焦点恢复和安全区策略；新增风险集中在浮动工具展开面板缺少弹出层语义、Global AI 侧栏缺少区域语义和焦点 containment、移动端学习路径浮动面板遮挡当前建议、主题切换缺完成播报、关闭态 AI 输入框过早进入 Tab 顺序、移动抽屉打开时仍存在全局浮动入口竞争、教师/管理员遗留壳层缺少 routeFrame 标记、跨壳层状态变化缺少 live/status，以及管理员用户移动页横向溢出。

第四十二批功能状态流详见 `chapters/50-function-state-flows-batch42.md`。该续篇补 Global AI 真实对话、上下文注入、引用核验提示、清空/重试/停止状态、知识图谱降级上下文、自适应路径 AI 入口、管理员治理 AI 和移动端 AI 首屏；新增风险集中在回答直接暴露服务器上下文 JSON、引用核验低置信提示作为回答首段展示、自适应路径页 AI 入口被阻塞且无原因说明、发送按钮无可访问名称、加载/完成/降级状态缺少 live/status、清空对话动作被页面 body 截获、AI 面板焦点泄漏、快捷问题标题空挂、管理员治理 AI 长时间 loading 仍暴露调试上下文，以及移动端 AI 首屏被内部警告占据。

第四十三批功能状态流详见 `chapters/51-function-state-flows-batch43.md`。该续篇补报告账本、导出下载、教师复盘交付、数据中心快照导出、管理员模板下载、数据治理处置、学生文档反馈和移动端交付状态；新增风险集中在教师课堂复盘缺少真实报告交付动作、复盘外链丢失课堂与班级上下文、数据中心快照导出被浮动工具阻断、管理员数据治理有 170 个活跃风险但缺导出和处置闭环、管理员用户模板下载成功但批量导入状态机缺失、教师首页报告账本状态组合不可执行、班级分析报告账本埋藏过深、Arena 发布报告缺少交付命令、学生文档反馈状态不清、系统配置保存缺少影响范围和审计反馈、移动教师复盘缺固定交付动作区，以及移动管理员用户页仍横向溢出。

第四十四批功能状态流详见 `chapters/52-function-state-flows-batch44.md`。该续篇补公开未知路由、学生资源/课程/仿真/Arena/播放列表/证据/学习路径坏参数，教师班级/班级分析/学生详情/教案编辑/Arena 报告/课堂复盘坏 ID，管理员教案编辑坏 ID，以及移动端代表失效状态；新增风险集中在多数坏 ID 页面落默认 Next 404、全局 AI/浮动工具成为错误页仅有操作、教师坏分析/坏学生路由只给泛化失败、学习路径坏 pathId/nodeId 被忽略、管理员用户无匹配搜索 API 返回全量用户、互动资源坏 ID 空态过弱、证据坏课次筛选暴露 raw id、移动错误页缺恢复动作、全部失效状态缺 live/status，以及 API 与 UI 错误语义未对齐。

第四十五批功能状态流详见 `chapters/53-function-state-flows-batch45.md`。该续篇补学生任务大厅/证据页、教师班级/教案/资源/历史、管理员用户/教案，以及教师资源和管理员用户移动端的搜索、筛选、分页、无匹配空态和状态播报；新增风险集中在管理员用户无匹配搜索 API、总览和列表口径不一致，教师/管理员教案长列表缺搜索与分页，学生任务和证据缺关键词搜索，教师班级/资源/历史空态缺 live/status，教师资源移动端默认列表过长，管理员用户角色筛选语义不稳定，移动管理员用户默认页横向溢出，以及跨列表状态变化普遍缺少状态播报。

第四十六批功能状态流详见 `chapters/54-function-state-flows-batch46.md`。该续篇补学生课堂码空/短/无效提交、教师真实班级成员动作、管理员新建账号/模板下载/批量导入、系统配置保存/模型测试、数据治理桌面加载和移动治理状态；新增风险集中在课堂码失败分支无反馈、管理员新建账号空提交渲染 `[object Object]`、桌面数据治理长时间加载、教师班级成员维护动作不可发现、管理员新建账号缺 dialog 语义、模板下载缺完成状态、批量导入无 file chooser/预览、配置保存缺影响审计、模型测试入口命名不稳、移动数据治理横向溢出，以及动作状态普遍缺少 alert/live。

第四十七批功能状态流详见 `chapters/55-function-state-flows-batch47.md`。该续篇补学生自适应练习完成态、提示词评价、证据后续动作、教师历史与课堂复盘交付、班级分析行动、数据中心导出、管理员总览与治理处置、移动提示词/证据/复盘/治理状态；新增风险集中在自适应练习 URL 与可执行任务不一致、提示词评价输入被全局 AI 抢占、证据复盘停留列表筛选、教师历史和课堂复盘缺真实交付、班级分析不能转入补强、数据中心导出无下载事件、管理员治理风险清单不可处置、移动治理继续横向溢出，以及完成态普遍缺少 alert/live。

第四十八批功能状态流详见 `chapters/56-function-state-flows-batch48.md`。该续篇补学生任务大厅启动、作品集分类/空态动作、教师报告评分工作台空态与坏 run、文档评分/写回 API、控制校正报告 API、管理员用户模板下载、批量导入入口、无匹配搜索、角色筛选和移动端任务/作品集/评分/用户管理状态；新增风险集中在任务启动不带完成和作品集回写合同、作品集空态缺收录规则、评分工作台没有真实来源路径、坏评分运行标识恢复路径跳首页、报告 API 可用但 UI 不承接交付、批量导入入口无 file chooser/预览、移动管理员用户页仍 945px 宽，以及任务/评分/导入状态全部缺少 alert/live。管理员无匹配搜索 API 本批已返回 `total:0`，相较早期全量返回问题是一个改善点；Batch48 canonical finding 范围为 310-319。

第四十九批功能状态流详见 `chapters/57-function-state-flows-batch49.md`。该续篇补学生自适应 demo 展开/提交、生成态、Prompt autodemo、学生个人中心下一步，教师首页报告/证据入口、真实班级详情、班级分析、控制校正报告 API、助手效果报告 API、课前包 500，管理员治理风险页、状态页、数据中心导出/治理动作，以及移动端自适应、Prompt、个人中心、教师分析、课前包、管理员治理和数据中心状态；新增风险集中在自适应 demo 作答没有 durable 完成和写回状态、真实 latest path 仍为 `path:null`、Prompt 输入继续被全局 AI 抢占、个人中心下一步不继承上下文、教师报告/分析动作不承接交付、控制校正报告只以 raw JSON 存在、助手效果报告真实班级 404、课前包路由 500、治理风险不可处置、数据中心导出无 download event 且治理入口命中隐藏文本、移动关键流程过长/横向溢出，以及 32 个状态全部缺少 alert/live。

第五十批功能状态流详见 `chapters/58-function-state-flows-batch50.md`。该续篇补学生真实学习路径空态、路径顾问、路径选择、路径执行、证据回看和坏 pathId，教师分析旧入口/V2 report surface、学生证据落点、评分工作台来源态，管理员首页风险动作、治理风险/质量标签、状态页、数据中心 returnTo，以及 320px/390px 移动回归状态；新增风险集中在真实学习路径 API 为空但 UI 仍显示可执行路径、路径顾问 403 缺班级信息被泛化为“上下文准备中”、坏 pathId 与无 pathId 等价、路径选择不写入真实 pathId、教师分析有报告数据但不能进入交付工作流、报告账本到学生证据/评分工作台缺处理合同、管理员治理 query 与动作不进入风险处置、数据中心 returnTo 和治理入口不闭环、320px 管理员治理仍横向溢出，以及 32 个状态全部缺少 alert/live。

第五十一批功能状态流详见 `chapters/59-function-state-flows-batch51.md`。该续篇补学生任务/证据/成长/作品集完成态，教师报告交付、班级交付、学生画像、学生证据、评分工作台和课前包，管理员用户模板下载/批量导入/搜索、系统配置、治理处置和教案搜索，以及 320px/390px 移动回归状态；新增风险集中在学生完成态不回流、证据完成筛选不生效、成长建议没有 actionUrl、作品集缺收录状态机、教师报告交付仍停留列表和长页、学生画像推荐不创建补强任务、证据审核只有停留动作、评分 API 与工作台断开、课前包继续 500、管理员 no-match 的 URL 初始态、可见搜索后页面空态和 API 结果口径不一致、批量导入没有 file chooser/状态机、配置重置缺影响范围、治理处置 query 不能直达处置流、管理员教案缺搜索空态、移动管理页继续横向溢出，以及 35 个状态全部缺少 alert/live。

第五十二批功能状态流详见 `chapters/60-function-state-flows-batch52.md`。该续篇补教师预置教案、我的教案、新建教案、资源管理、ResourceNode 管理，管理员教案、新建教案、治理 authoring surface，学生课程目录搜索、课程流创建，以及 320px/390px 移动备课与资源状态；新增风险集中在预置教案使用不形成克隆状态、教师/管理员教案缺搜索编辑闭环、新建教案动作丢上下文、资源搜索缺处理合同、ResourceNode 和课程流巨型清单不可操作、治理 authoring surface 不能进入备课质量报告、学生课程目录 query 不形成搜索状态、移动备课与资源页超长，以及 31 个状态全部缺少 alert/live。

第五十三批功能状态流详见 `chapters/61-function-state-flows-batch53.md`。该续篇补教师教案编辑直达、缺失 template 新建教案、ResourceNode blocked query，管理员教案编辑直达、坏教案编辑、治理 authoring 缺失 lessonPlanId，学生播放列表列表、播放列表直达播放、知识节点直达，以及 320px/390px 移动端作者态与学生深链状态；新增风险集中在教师/管理员教案编辑直达动作丢上下文、缺失 templateId 不形成恢复、ResourceNode blocked 过滤仍是超长清单、管理员坏教案编辑只有默认 404、治理 authoring 缺失 lessonPlanId 不形成报告、播放列表直达播放静默改道、知识节点直达缺任务化后置状态、移动端仍依赖超长列表或静默改道，以及 24 个状态全部缺少 alert/live。

第五十四批功能状态流详见 `chapters/62-function-state-flows-batch54.md`。该续篇补学生文档反馈、Prompt 评价、AI 工坊、独立 Copilot、作品集反思，教师班级分析 report-ledger、评分工作台 ready、教师/管理员数据中心 returnTo，管理员治理 assign、系统配置 audit，以及 320px/390px 移动端报告、AI、评分、治理与配置状态；新增风险集中在文档反馈后续动作仍是证据链接集合、Prompt autodemo 与历史 API 口径不一致、AI 工坊任务动作不形成学习任务状态、Copilot evidence 上下文暴露内部对象、作品集 reflection query 与默认空态不一致、report-ledger surface 落泛化班级分析、评分工作台 ready 无草稿且动作落首页、数据中心 returnTo 不形成返回或治理交接、治理 assign query 不进入分派处置流、系统配置 focus=audit 没有审计工作区、移动端缺固定主动作，以及 30 个状态全部缺少 alert/live。

第五十五批功能状态流详见 `chapters/63-function-state-flows-batch55.md`。该续篇补报告反馈后续入口目标页、Prompt 真实历史模式、AI 报告任务、Copilot 作品集反思、作品集反思创建意图，教师报告账本/补强/学生证据/评分工作台参数化深链，管理员治理 assign/resolve/export 带对象参数、配置 audit/model-test 参数和移动端目标页；新增风险集中在报告反馈目标页不承接 assignment/criterion、学习证据 API 404、练习目标忽略 intent、资源目标缺写回、Prompt/AI 仍被全局 AI 抢占、Copilot/作品集不创建草稿、教师参数化报告页仍是同一长页且动作跳首页、评分工作台来源无草稿、治理 riskId/export 参数不形成处置或下载、配置参数被吞掉、移动目标页过长，以及 39 个状态全部缺少 alert/live。

第五十六批功能状态流详见 `chapters/64-function-state-flows-batch56.md`。该续篇补学习证据 assignment/actionable 与缺失 assignment、学习证据 API、adaptive writeback、资源 returnTo，教师报告 deliver、缺失学生证据、评分 GET 方法边界，管理员用户 no-match URL/可见搜索/API、治理 assign/export、配置缺失 provider 测试，以及移动端证据、评分、治理、配置状态；新增风险集中在学习证据 assignment UI 与 API 都缺目标合同、缺失 assignment 被当普通证据页、自适应 writeback 忽略报告反馈写回、资源 returnTo 不形成回跳、教师报告交付仍是长分析页、缺失学生证据动作跳首页、评分 GET 405 未产品化、管理员 no-match URL/可见搜索/API 口径分裂、治理 CSV 导出无下载事件、缺失 provider 测试参数被忽略、移动端宽表长页，以及 27 个状态全部缺少 alert/live。

第五十七批功能状态流详见 `chapters/65-function-state-flows-batch57.md`。该续篇补报告反馈目标页、学习证据 completed/lessonId/sourceEventId 筛选、自适应 writeback completed，教师报告导出/补强、评分草稿与 GET/POST 方法边界，管理员用户角色筛选/分页/no-match、治理 resolve/export、配置缺失 model 测试，以及 320px/390px 移动目标页；新增风险集中在报告反馈目标页不承接 assignment/criterion、学习证据筛选与 API 继续断裂、自适应 writeback completed 伪装成普通路径中心、教师报告导出和补强 action 被长分析页吞掉、评分草稿与方法边界不汇合到 UI、管理员用户 q 过滤仍被 API 忽略、治理 resolve/export 没有目标态、配置 provider/model 参数被忽略、移动端搜索/治理宽度问题未收敛，以及 32 个状态全部缺少 alert/live。

第五十八批功能状态流详见 `chapters/66-function-state-flows-batch58.md`。该续篇补学生报告反馈采用/写回、任务大厅 feedback returnTo、作品集反馈收录，教师报告 PDF 下载、缺失学生发送、评分审批缺失 run、班级学生 no-match 添加，管理员用户 no-match 重置/导出、治理缺失对象分派/XLSX 导出、配置已知 provider 下缺失 model 测试，以及 320px/390px 移动同态状态；新增风险集中在报告反馈采用和写回不改变状态、任务大厅不承接反馈查询与 returnTo、作品集反馈收录没有候选证据或草稿、教师报告下载无事件、发送缺失学生与评分审批会跳公开首页、教师班级学生页 404 但 API 返回真实学生、管理员用户重置/导出继续忽略 q、治理分派和 XLSX 导出没有闭环、已知 provider 下缺失 model 测试被吞掉，以及 33 个状态全部缺少 alert/live。

第五十九批功能状态流详见 `chapters/67-function-state-flows-batch59.md`。该续篇按 batch58 的剩余输入做最终收口，补学生报告反馈修订入口、自适应练习 returnTo、任务大厅反馈任务、证据/成长/作品集写回目标，教师移动班级详情、长报告、评分审批、学生证据 deep link，管理员 320px 用户 no-match 导出、治理 risk resolve、配置 model test、系统统计导出，以及相关 API 合同；新增风险集中在报告反馈仍无状态机、反馈任务纵向链路不承接 assignment/returnTo、教师移动长报告有 API 数据但没有交付闭环、评分审批方法边界未产品化、教师学生证据 deep link 丢失评分上下文、管理员用户 no-match 继续返回真实用户且横向溢出、治理 risk resolve 仍是只读长看板、配置测试和统计导出缺状态反馈，以及 26 个状态全部缺少 alert/live。至此 205 个 App Router 页面模板与已识别关键功能状态流均已纳入审计证据，后续应进入设计治理和实现修复。


254. P1：教师课堂复盘缺少真实报告交付动作。
   控制校正班级报告 API 返回 200 并包含 report/export 数据，但复盘页只提供返回班级详情和内部评审入口，缺导出、发送、复制摘要、锁定版本和生成补强路径。

255. P1：复盘外链丢失课堂与班级上下文。
   “前往评审聚合入口”跳到 `/review/extracurricular-showcase`，展示内部聚合页而非本课堂交付目的地，不能承接教师课后复盘。

256. P1：数据中心快照导出被浮动工具阻断。
   教师数据中心有导出说明和按钮，但真实点击因右下控灵浮层截获指针事件而超时，manifest 记录 `teacher data center export download` 为 blocked。

257. P1：管理员数据治理有高风险数据但缺导出和处置闭环。
   数据治理 API 返回 170 个活跃风险和 stale 新鲜度；页面能展示风险分布，但 report ledger 为 deferred，风险行缺查看证据、分派、标记处理、创建待办和导出。

258. P1：管理员用户模板下载成功但批量导入状态机缺失。
   模板下载真实触发 `users-template.xlsx`，页面下载后没有完成提示；批量导入仍缺预览、失败行导出、通知、撤销/回滚、批次 ID 和审计记录。

259. P2：教师首页报告账本状态组合不可执行。
   教师首页同时出现课前包复核 deferred、助手效果报告 export available 和 unavailable 文案；助手效果 API 实际返回 404，状态词和下一步动作不清。

260. P2：班级分析报告账本埋藏过深且受限状态缺行动。
   班级分析页高度超过 13,000px，restricted report ledger 位于长页深处，缺导出入口、解除限制条件或跳转到交付页。

261. P2：Arena 发布报告缺少交付命令。
   Arena 发布报告正文和状态可读，但没有导出、发送给学生、锁定版本、教师审核或归档按钮，报告仍停留在查看状态。

262. P2：学生文档反馈后续动作多但状态不清。
   学生报告反馈页有评分解释和多个后续动作，但没有导出、提交边界、已读状态、练习采用状态或 demo 数据边界。

263. P2：系统配置保存缺少影响范围和审计反馈。
   管理员配置页保存、重置、测试控件可见，但没有 diff、影响范围、保存成功/失败、回滚入口和审计记录。

264. P2：移动教师复盘缺少固定交付动作区。
   移动复盘页核心交付动作不固定，返回、内部评审入口、AI 输入和浮动工具竞争首屏与底部区域。

265. P2：移动管理员用户页仍横向溢出且导入状态未治理。
   移动截图在 390px viewport 下实际宽 945px，说明用户管理页仍由表格或控件撑宽；导入/下载动作可见但缺移动端批次状态和审计入口。

266. P1：多数坏 ID 页面落到默认 Next 404，缺少产品级恢复。
   公开未知路由、坏课程、坏仿真、坏 Arena 挑战、坏播放列表、教师坏教案、坏 Arena 发布报告、坏课堂复盘和管理员坏教案都显示默认 `404 This page could not be found.`，没有平台品牌壳层、角色上下文或返回列表入口。

267. P1：错误页上的全局 AI 与浮动工具成为仅有操作入口。
   默认 404 页面没有任务恢复控件，却仍显示全局 AI 输入、关闭按钮和工具浮层；用户最容易点击的控件与当前错误恢复无关。

268. P1：教师坏分析/坏学生路由返回 200 但只给泛化失败。
   教师班级分析坏 ID 和学生坏 ID 都返回 200，只显示“获取班级学情总览失败”或“获取学生学情失败”和“重试”，没有区分对象不存在、无权限、班级不匹配或服务失败。

269. P1：学习路径坏 pathId/nodeId 被忽略，页面仍显示正常进度。
   `pathId=not-a-real-path&nodeId=not-a-real-node` 时，页面继续展示“当前节点 入门诊断”“本周完成 24%”和“检查节点练习已准备”。

270. P1：管理员用户无匹配搜索 API 返回全量用户。
   `/api/admin/users?q=not-a-real-user-zzzz` 返回 200，但 `total=298` 并包含真实用户样本，说明搜索参数没有生效或无结果状态被破坏。

271. P2：互动资源坏 ID 空态过弱。
   资源坏 ID 页面只显示“资源不存在或无法访问”，大量空白，没有原因、资源目录、相近资源、重试或报告失效链接入口。

272. P2：学生证据坏课次筛选暴露 raw id。
   `lessonId=not-a-real-lesson` 时，筛选栏直接显示 raw id，空态只说“当前筛选下暂无证据”，无法区分无效课次和真实课次暂无证据。

273. P2：教师班级详情坏 ID 虽可恢复但缺状态播报。
   教师班级详情坏 ID 有“班级不存在”和“返回班级列表”，但 DOM 中 `alerts=0`，读屏用户无法感知页面进入错误状态。

274. P2：移动端错误页仍缺恢复动作。
   移动学生坏资源和教师坏班级保留部分产品壳层，但移动管理员坏教案仍是默认 404；三类移动状态都没有明显固定恢复动作。

275. P2：所有失效状态都缺 live/status。
   本批 18 个 DOM/a11y JSON 的 `alerts=0`。404、资源不存在、班级不存在、获取失败、空筛选和坏路径上下文都没有状态播报。

276. P2：API 与 UI 的错误语义没有对齐。
   API 能返回“学习路径目标未注册”“班级不存在”等明确错误；UI 层要么默认 404，要么泛化为“获取失败”，要么继续展示正常状态。

277. P1：管理员用户无匹配搜索的 API、总览和列表口径不一致。
   无匹配搜索 API 返回 `total=298` 和 12 个用户，页面列表显示“暂无账号数据/共 0 条”，但总览仍显示用户资产 298、学生 293、教师 4。

278. P1：教师和管理员教案长列表缺少搜索、分页和无匹配状态。
   教师教案列表高 6351px，管理员教案列表高 7350px，均未发现可见搜索控件；无匹配尝试后仍是默认长列表。

279. P2：学生任务大厅缺关键词搜索和搜索空态。
   任务大厅只有“全部/可挑战/已完成”状态筛选，不能按任务标题、控制主题、难度或目标定位任务。

280. P2：学生证据页缺少关键词搜索和筛选状态播报。
   证据页未发现可见搜索控件，筛选和结果变化没有 `role=status`、`aria-live` 或结果数量播报。

281. P2：教师班级、资源和历史空态可见但不可访问状态不完整。
   三类搜索无匹配能显示空态文案，但 DOM 摘要均为 `alerts=0`，结果变化没有播报。

282. P2：教师资源移动端默认列表过长。
   移动端 `/teacher/resources` 默认 full-page 高 7936px，搜索无匹配后才缩短到 1063px。

283. P2：教师上课历史默认列表过长且分页信号不足。
   `/teacher/history` 默认 full-page 高 7465px，DOM 摘要没有分页信号。

284. P2：管理员用户角色筛选的自动化可达性不稳定。
   页面可见“全部角色/管理员/教师/学生”，但按按钮语义查找“教师/TEACHER”未命中。

285. P2：移动管理员用户默认页仍横向溢出。
   移动默认 `/admin/users` 在 390px viewport 下导出为 945px 宽；搜索空态后才恢复 390px。

286. P2：跨列表状态变化普遍缺少 live/status。
   本批 20 个 DOM/a11y JSON 的 `alerts=0`，搜索、空态、列表缩短、分页和重置都缺少可访问状态播报。

287. P1：课堂码失败分支没有任何可见错误。
   空提交、短码 `123`、无效六位码 `999999` 都停在默认课堂码页面，没有错误文本、重试说明或 alert/live。

288. P1：管理员新建账号空提交渲染 `[object Object]`。
   新建账号空提交后页面直接显示对象字符串，字段级错误没有映射到输入或顶部错误摘要。

289. P1：桌面数据治理看板 9 秒仍停留加载态。
   桌面 `/admin/data-governance` 默认、刷新尝试和标签尝试都显示“正在加载数据治理看板…”，但 API 返回 200 且移动端可展示真实数据。

290. P2：教师班级成员维护动作不可发现或不稳定。
   真实 143 人班级详情中，添加学生没有形成 dialog，导入没有 file chooser，移除/删除入口未稳定找到。

291. P2：管理员新建账号缺少 dialog 语义。
   点击新建账号后未检测到 `role=dialog` 或 `aria-modal`，创建流程与背景列表混在一起。

292. P2：模板下载成功但缺少完成状态和下一步。
   浏览器真实下载 `users-template.xlsx`，页面没有下载完成提示、模板版本或“继续导入”动作。

293. P2：管理员批量导入入口点击后没有 file chooser 或预览状态。
   点击批量导入没有 file chooser 事件，也没有预览、失败行导出、通知、撤销或批次审计入口。

294. P2：系统配置保存缺少影响范围和审计反馈。
   保存后只显示“配置已保存”，缺少 diff、影响范围、版本、操作者、回滚和审计记录。

295. P2：模型测试入口命名和可达性不稳定。
   配置页有模型卡片和“测试”字样，但无法用稳定名称定位“测试模型/测试连接/模型测试”入口。

296. P2：移动数据治理页横向溢出。
   移动 `/admin/data-governance` 在 390px viewport 下导出为 568px 宽，风险清单或表格撑宽页面。

297. P2：第 46 批动作状态仍全部缺少 alert/live。
   23 个 DOM/a11y JSON 的 `alerts=0`，课堂码错误、账号校验、下载、配置保存、治理加载和移动风险状态均未播报。

298. P1：自适应练习 URL 与可执行任务不一致。
   `/assessment/adaptive-practice` 看起来是练习入口，但页面显示学习路径中心；脚本未找到可选择答案或提交动作。

299. P1：提示词评价输入被全局 AI 抢占。
   提示词评价页填写文本时命中 `global-ai-sidebar-input`，结构化字段仍为空，但评价后生成综合得分和版本记录。

300. P1：学生证据复盘动作仍停留在列表筛选。
   点击证据后续动作后进入 `lessonId=unit-4-1-design-task-expression-v1` 的列表筛选状态，没有题目级复盘、补练生成或证据详情承接。

301. P1：教师历史列表不能直接进入交付状态。
   教师历史页显示 67 节课，点击报告/复盘相关文本后仍停在长列表；没有明确打开、加载、导出或交付状态。

302. P1：课堂复盘缺少真实交付命令。
   FINISHED 课堂复盘能展示提交、学习事实、短板和雷达图，但仍没有导出、发送、复制摘要、生成补强路径或创建题单。

303. P1：班级分析动作不承接报告或补强。
   班级分析页面高 13192px，展示能力矩阵和学生画像，但报告/补强/课前包动作尝试后没有状态变化。

304. P1：数据中心导出可用但没有下载事件。
   `/data-center` 页面显示导出可用，点击导出/下载后没有浏览器下载事件，也没有页面内成功、失败或权限说明。

305. P1：管理员治理风险清单仍不可处置。
   管理员治理页能展示 170 个风险和风险清单，但没有查看证据、分派、标记处理、导出、批量处置或撤销入口。

306. P2：管理员总览动作缺少状态反馈。
   管理员总览中的刷新、查看、治理相关动作尝试后没有 `role=status` 或页面内状态变化。

307. P2：移动治理页面仍横向溢出。
   移动 `/admin/data-governance` 在 390px 上下文中仍输出 568px 宽、5897px 高截图。

308. P2：移动完成态缺少固定主动作区。
   移动提示词评价、证据页和教师复盘都能访问，但主动作散落在长页内。

309. P2：第 47 批完成态仍全部缺少 alert/live。
   本批 24 个 DOM/a11y JSON 的 `alerts=0`；提交、评价、复盘、导出、处置和移动完成态都没有可访问状态播报。

310. P1：任务启动没有带出完成和作品集回写合同。
   任务大厅启动后落到 `/simulations/destroyer?mission=cmjm54toy0002qs9dnw75508i`，仿真页能展示任务选择和控制面板，但没有任务目标回显、完成条件、提交入口、评分回写或作品集收录规则。

311. P1：作品集空态缺少收录规则和可执行动作。
   `/profile/portfolio` 分类后仍只显示“暂无课堂作品”和“进入互动课程”，没有解释哪些任务会进入作品集，也没有查看、创建、添加、保存、收录或详情动作。

312. P2：作品集与证据 API 真源不对齐。
   `/api/learning-evidence?limit=10` 返回 404，说明作品集回流不能依赖该路径作为统一证据真源；作品集、学生证据和任务回写之间仍缺清晰数据合同。

313. P1：评分工作台空态没有真实来源路径。
   `/teacher/grading-workbench` 只提示没有打开草稿，但不提供去提交列表、打开最近草稿、导入学生文档或回到报告账本等来源路径。

314. P1：坏评分运行标识恢复路径错误。
   `gradingRunId=missing-grading-run` 后点击恢复类动作落到首页 `/`，不是教师工作台、证据列表或报告账本；用户从错误状态被带离教师任务上下文。

315. P1：报告 API 可用但 UI 未承接交付状态。
   控制校正教师报告 API 返回 200 并包含 143 人班级报告和 export 数据；助教效果报告对当前班级返回 404。评分工作台没有展示报告可用、不可用、导出、发送或写回状态。

316. P1：管理员批量导入入口不能进入文件选择或预览。
   桌面和移动 `/admin/users` 点击“批量导入”均记录为 `clicked-no-filechooser`，页面也没有打开导入模态、预览或错误状态。

317. P2：模板下载成功但没有页面状态。
   浏览器捕获到 `users-template.xlsx` 下载事件，但页面没有下载中、下载成功、失败重试或文件名提示，读屏状态也为空。

318. P1：用户搜索和角色筛选连续状态不一致。
   无匹配搜索 API 返回 `total:0`；教师角色 API 返回 `total:4`，但连续筛选后的 UI 仍显示 0 条，页面没有说明当前是组合条件还是未刷新。

319. P1：移动管理员用户页仍存在 945px 横向布局，且动作状态缺少 alert/live。
   移动 `/admin/users` 三个状态在 390px viewport 下均导出为 945px 文档宽度，账号表格和操作区继续撑宽页面，批量导入也无移动状态。同时 24 个 DOM/a11y JSON 均为 `alerts=0`，任务筛选、任务启动、作品集分类、评分动作、坏 run 恢复、模板下载、导入入口、搜索和移动筛选都没有读屏状态播报。


321. P1：自适应 demo 作答没有 durable 完成状态。
   `/assessment/adaptive-practice?demo=1&scene=stable` 能展开题目、选择选项并点击提交，但提交后仍保留“提交答案/换一题”，没有稳定的正确/错误反馈、写回确认、证据链接或下一步状态；真实 latest path API 仍返回 `path:null`。

322. P1：Prompt autodemo 主输入仍被全局 AI 抢占。
   提示词评价页面的填充动作命中 `global-ai-sidebar-input`，而不是评价任务的结构化输入；页面随后仍显示得分和版本历史，造成任务输入边界不可信。

323. P1：学生个人中心下一步动作不继承补练上下文。
   个人中心“执行下一步练习”等动作后仍停留 `/profile?from=batch49`，没有携带薄弱能力、证据 ID、推荐 ID 或目标到练习/路径页面。

324. P1：教师首页报告/证据入口落到泛化班级列表。
   教师首页的报告或证据动作落到 `/teacher/classes`，没有进入具体班级报告账本、证据队列或待处理报告状态。

325. P1：教师班级详情和分析动作没有交付状态。
   班级详情与分析页有 143 人班级、治理覆盖和诊断数据，但证据/报告/补强动作后没有打开证据、题单、报告锁定、分派或发送状态。

326. P1：控制校正报告仍停留在 raw JSON 交付。
   控制校正报告 API 返回 200 并包含可用报告数据，但浏览器访问仍是原始 JSON，教师无法在产品页面中导出、发送、复制摘要、锁定版本或创建补强任务。

327. P1：助手效果报告真实班级仍返回 404。
   `/api/teacher/classes/cmma7g0590004g9q2nl2jyzdf/assistant-effect-report?export=true` 返回 `{"error":"演示效果报告不存在"}`，真实班级没有可交付的助手效果账本。

328. P0：教师课前包真实班级路由返回 500。
   `/teacher/prep-packs?classId=cmma7g0590004g9q2nl2jyzdf` 在桌面和移动都返回 500，只剩 Next 错误页和 Reload。
   台账状态（2026-06-29，`audit-report-closure-ledger-cleanup`）：mapping-cleaned / closed by archived evidence。`audit-remediation-p0-stability` 任务 3.2 已覆盖 class-scoped 课前包恢复态，`chapters/57-function-state-flows-batch49.md` 已在 2026-06-21 标记该 finding 已修复；本次同步主报告映射，证据见 `remediation/audit-remediation-p0-stability/evidence.md` 与 `remediation/audit-report-closure-ledger-cleanup/evidence.md`。

329. P1：管理员治理风险仍不可处置。
   治理页和 API 都能展示 170 个风险，但 drilldown 后没有进入证据、分派、标记处理、批量处置、撤销或审计记录。

330. P1：数据中心导出和治理入口命中不稳定。
   数据中心管理员态点击导出演示快照没有 download event；治理入口点击时定位到隐藏 `数据治理` 文本并超时。

331. P2：移动关键流程过长且缺固定任务动作。
   移动自适应、个人中心、教师分析和数据中心截图高度普遍超过 5000px，教师班级分析超过 14000px；主任务动作没有固定在用户当前决策点。

332. P2：移动管理员治理仍存在宽度异常。
   移动管理员治理在移动上下文下实际宽度约 568px，延续此前治理/用户页的横向溢出风险。

333. P2：第 49 批 32 个状态仍全部缺少 alert/live。
   本批 32 个 DOM/a11y JSON 均没有捕获到 `alert`。作答提交、Prompt 异步动作、报告入口、导出、治理 drilldown、课前包错误和移动状态变化都没有统一的状态播报。

334. P1：真实学习路径 API 为空时 UI 仍展示进度和执行入口
   真实 latest path 返回 `path:null`，learner-state 返回 503，path-advisor-context 返回 403，但页面仍显示 24% 进度、入门诊断和路径执行入口。

335. P1：路径生成动作没有解决前置条件
   路径生成设置可见，点击后只提示“路径生成上下文还在准备，请稍后重试”，没有解释缺少班级信息、服务不可用或需要教师绑定。

336. P1：path-selection、path-execution 和坏 pathId 状态仍被普通页面吞掉
   无真实 path 时，选择和执行 intent 仍显示路径/练习资源；坏 pathId 也没有“路径不存在/已过期/重新生成”状态。

337. P1：教师报告 surface query 没有切换到报告账本
   `analytics-v2?surface=report-ledger` 仍展示完整班级分析页。旧 `/analytics` 入口也静默落到 v2，没有提示兼容跳转。

338. P1：班级分析动作不能进入学生证据或补强任务
   分析页可显示治理覆盖、能力矩阵和重点学生，但点击报告/学生/证据相关动作后不进入学生证据链；真实学生证据页必须靠直达 URL 才能访问。

339. P1：评分工作台忽略 classId/source 上下文
   `/teacher/grading-workbench?classId=...&source=report-ledger` 仍显示“当前没有打开的文档评分草稿”，没有根据班级或报告来源列出可评分材料。

340. P1：教师报告 API 与 UI 交付仍断开
   控制校正报告 API 返回 200，assistant-effect 报告返回 404；UI 没有把可用报告和不可用原因接入教师报告账本。

341. P1：管理员治理风险页加载状态不稳定
   同一路由默认等待后仍可停在 loading，后续动作后才出现风险数据。数据加载完成没有稳定 status/live。

342. P1：治理风险清单仍是只读表
   加载后可见 170 个风险和风险说明，但风险行没有查看证据、分派、标记处理、批量处置、导出或撤销。

343. P1：数据中心 returnTo、导出和治理交接都未闭环
   `returnTo=/admin/data-governance` 没有形成可见返回治理交接；导出没有 download event；治理入口仍命中隐藏文本。

344. P2：移动治理与教师报告页仍不适合窄屏连续任务
   320px 管理员治理实际宽度变成 568px；390px 教师分析报告页高 14,128px。移动用户无法在当前屏幕内完成风险处置或报告交付。

345. P2：第 50 批 32 个状态仍全部缺少 alert/live
   本批 32 个 DOM/a11y JSON 均没有捕获到 `alert`。路径生成失败、报告/证据动作、治理刷新、数据中心导出和移动状态变化都无可访问状态播报。

346. P1：学生任务完成态仍不能形成学习回流。
   任务大厅显示 5/7 已完成和 71% 完成率，但“再次挑战/开始挑战”动作后仍停留列表，没有把完成任务转入证据、作品集、下一步建议或新任务目标。

347. P1：学生证据完成筛选不生效。
   `status=completed` 仍展示失败/成功混合证据；复盘/补练类动作仍停留列表，没有进入题目复盘或补练路径。

348. P1：成长中枢下一步建议没有行动落点。
   “提升参数设计能力”“巩固基础能力”等建议可见，但动作后仍停留成长页，没有携带能力维度、证据 id 或推荐 id。

349. P1：作品集课堂作品仍缺收录状态机。
   `category=coursework` 显示“暂无课堂作品”，动作后没有创建、收录、提交、反思或回到来源课堂/证据的状态。

350. P1：教师报告交付入口仍停留在列表和长页。
   教师首页和班级详情的报告/证据/交付动作仍停留当前页；班级详情高 15,783px，未进入报告锁定、导出、发送或补强任务。

351. P1：教师学生画像推荐动作不能创建补强任务。
   学生画像显示待提升点和推荐动作，但点击后不创建补强任务、不锁定证据、不回写教师报告。

352. P1：教师学生证据审核仍只有停留动作。
   证据卡能显示质量标签，但动作仍是“留在学生证据审核”，缺采用、驳回、补强、注释、分派或返回报告账本。

353. P1：评分 API 与评分工作台仍断开。
   评分工作台带 `classId/source/status` 仍显示无草稿；两个文档评分 API 的 GET 返回 405，页面没有解释正确入口或候选提交。

354. P1：管理员用户无匹配搜索口径仍不一致。
   `/admin/users?source=batch51&q=zzzz-batch51-no-match` 初始态仍显示 298 用户；填入可见搜索框后页面列表变为 0 条，但 `/api/admin/users?q=zzzz-batch51-no-match&page=1&pageSize=5` 仍返回 `total:298`，说明 URL、页面筛选和 API 结果没有共享同一 no-match 合同。

355. P1：管理员批量导入仍没有导入状态机。
   模板下载成功，但批量导入点击没有 file chooser；页面没有预览、失败行导出、通知、撤销、批次 ID 或审计入口。

356. P1：管理员配置动作缺影响范围和审计。
   配置动作后显示“已重置为默认配置”，但没有 diff、影响服务、确认、回滚或审计记录。

357. P1：治理处置 query 不形成处置流。
   `tab=risks&action=resolve` 在桌面可停留 loading；移动能显示 170 个风险，但没有处置、分派、证据、导出、撤销或完成状态。

358. P2：管理员教案搜索缺输入与无匹配状态。
   `/admin/lesson-plans?q=zzzz-batch51-no-match` 仍显示 7,350px 长列表，脚本未找到搜索输入可填。

359. P2：移动管理页继续横向溢出。
   320px 管理员用户页实际宽 945px，320px 管理员治理页实际宽 568px；配置页虽保持 320px 但高度 4,119px 且缺固定操作区。

360. P2：第 51 批 35 个状态仍全部缺少 alert/live。
   35 个 DOM/a11y JSON 均没有捕获到 `alert`。任务启动、证据筛选、报告交付、评分空态、模板下载、导入失败、配置重置、治理加载和移动宽度变化都缺少状态播报。

361. P1：预置教案使用动作没有形成克隆状态
   预置教案列表高 8,911px，卡片上有“预览”和“使用模板”，但点击后仍停留原列表；`/api/teacher/preset-lessons/clone` 的 GET 返回 405，页面没有克隆方法要求、目标教案、失败原因或完成入口。
   2026-06-22 / #618：`GET /api/teacher/preset-lessons/clone` 返回产品化 405 JSON，包含 `recoveryHref=/teacher/preset-lessons` 与 POST 方法要求；新增 `src/app/api/teacher/preset-lessons/clone/__tests__/route.test.ts` 覆盖。

362. P1：教师教案列表缺搜索、编辑定位和状态反馈
   `/teacher/lesson-plans` 高 6,351px，脚本没有找到可填搜索输入，也没有解析到稳定 edit href；搜索探测后页面仍是完整长列表。
   2026-06-22 / #618：`LessonPlanList` 新增搜索输入、结果数量、清除条件、无匹配恢复态，并继续保留稳定编辑入口与开始上课状态；`src/app/__tests__/authoring-resource-flow-source.test.ts` 覆盖源码合同。

363. P1：教师新建教案动作会丢到公开首页
   教师新建教案页能显示资源库，但空标题动作后最终落到 `/` 的公开首页，当前作者态上下文和返回路径都被打断。
   2026-06-22 / #618：教师新建页将 `templateId` 传入编排器，编排器在作者态显示模板提示并保留 `returnPath/workbenchReturnUrl`；空标题提示带模板上下文。

364. P1：资源管理搜索有空态但没有处理合同
   教师资源页默认 112 个资源，搜索无匹配后出现“没有找到匹配的互动组件”，但没有结果数量、清除条件、恢复动作或 live/status；主动作探测后仍停留资源页。
   2026-06-22 / #618：教师资源管理增加搜索结果数量、清除按钮、无匹配恢复提示与 ResourceNode 管理入口；资源编辑弹窗增加使用影响说明。

365. P1：ResourceNode 管理仍是巨型治理清单
   ResourceNode 默认页高 42,159px，移动端高 92,909px；筛选后可显示 0 结果，但没有分页、虚拟列表、批量治理、导出或定位到具体资源的任务流。
   2026-06-22 / #618：ResourceNode 管理读取 `q/status/nodeType/...` 查询参数，`status=blocked` 进入阻断筛选说明，列表默认分页 25 条并提供加载更多；现有详情表单继续承接单节点治理。

366. P1：管理员教案管理仍缺搜索、编辑和创建闭环
   管理员教案页高 7,350px，未找到可填搜索输入或 edit href；新建教案动作后返回长列表，没有字段校验、草稿创建、保存结果或审计记录。
   2026-06-22 / #618：管理员教案复用 `LessonPlanList` 搜索/无匹配/结果数量合同；管理员新建页同样保留 `templateId` 与返回上下文。

367. P1：治理 authoring surface 不能进入备课质量报告
   `surface=authoring&tab=reports` 首屏停留“正在加载数据治理看板…”，动作后只进入通用治理内容；没有教案质量、资源映射、ResourceNode 异常、课程流规模或作者态修复入口。
   2026-06-22 / #618：数据治理页识别 `surface=authoring&tab=reports`，默认进入课堂质量报告视图，展示作者态质量报告提示、返回教案管理动作，并由 status API 回传 `authoringContext`。

368. P1：学生课程目录 query 不形成搜索状态
   `/interactive-learning/courses?q=zzzz-batch52-no-match` 仍显示完整课程目录，脚本也未找到可填搜索输入；用户无法确认当前是否筛选、无匹配或忽略 query。
   2026-06-22 / #618：互动课程页读取 `q`，提供可见搜索框、结果数量、无匹配状态和清除链接。

369. P1：课程流创建器一次性暴露 820 个知识节点
   `/playlists/new` 桌面高 60,902px，移动端高 61,359px；API 返回 820 个知识节点，填入标题和点击动作后仍停留知识库长列表，没有可见已选节点、保存结果或恢复动作。
   2026-06-22 / #618：课程流创建器默认分页显示知识节点、显示已选数量、防重复添加，并在保存成功后跳到 `/playlists/{id}/play?intent=start-class`；`POST /api/knowledge/playlists` 写入 KNOWLEDGE_NODE `LessonItem`。

370. P2：移动备课与资源页长度不可操作
   390px 下教师预置教案高 23,144px、教师教案高 18,670px、教师资源高 7,936px、ResourceNode 高 92,909px；320px 管理员教案高 24,697px；学生课程流移动端高 61,359px。

371. P2：作者态 API 有数据但 UI 缺任务化消费
   `/api/lesson-plans`、`/api/resources`、`/api/teacher/resource-nodes`、`/api/knowledge/nodes` 均返回数据，但 UI 主要表现为长列表或静态清单，没有把 API 数据组织成可完成的编辑、治理、引用、保存或回滚任务。

372. P2：第 52 批 31 个状态仍全部缺少 alert/live
   31 个 DOM/a11y JSON 均没有捕获到 `alert`。预置教案使用、教案搜索、新建教案、资源搜索、ResourceNode 筛选、治理加载、课程目录 query 和课程流创建都缺少状态播报。

373. P1：教师教案编辑直达动作会丢到公开首页
   教师教案编辑直达页能加载 `cmqlsyjrb0003vmyfz0ju3lqh`，API 也返回该教案；但该教案 `items: 0`，页面仍显示资源库与 BOPPPS 编排壳层。动作探测后最终落到公开首页 `/`，教师作者态上下文、教案 id 和恢复入口都丢失。
   2026-06-22 / #618：教师编辑页保留作者态返回目标；缺失对象时显示 `LessonPlanMissingRecovery`，提供返回列表和新建教案动作，避免默认 404 或公开首页改道。

374. P1：教师新建教案缺失 templateId 时仍丢失作者态上下文
   `/teacher/lesson-plans/new?templateId=batch53-missing-template` 返回 200，但页面没有说明模板不存在、是否改为空白教案或如何重新选择模板；动作后同样落到公开首页 `/`。
   2026-06-22 / #618：教师新建页将 `templateId` 转成编排器内的模板来源提示，并保留返回教案列表动作；空标题提示明确当前为模板来源教案。

375. P1：ResourceNode blocked 过滤没有形成可处理清单
   `status=blocked` query 下仍渲染 ResourceNode 管理长页，桌面高 42,159px，移动端高 92,909px；页面标题和列表仍以资源节点清单为主，没有 blocked 数量、原因、修复建议、批量处理或清除筛选。
   2026-06-22 / #618：`status=blocked` 初始化为阻断/排除筛选，显示阻断说明、blocked 数量摘要和单节点详情治理入口，列表分页避免移动端一次性暴露超长清单。

376. P1：管理员教案编辑直达动作只回到长列表
   管理员教案编辑直达页能打开同一空教案，动作后回到 `/admin/lesson-plans`，页面高 7,350px；没有保留刚才的教案、编辑结果、空环节风险或审计入口。
   2026-06-22 / #618：管理员编辑页保留返回上下文，并在缺失对象时进入产品化恢复页；管理员教案列表新增搜索和结果状态，避免只能回到长列表。

377. P1：管理员坏教案编辑缺产品化恢复
   `/admin/lesson-plans/missing-batch53/edit` 返回 404，只显示默认 “This page could not be found.” 和控灵；动作后仍停留同一 404。管理员无法判断教案不存在、权限不足、已删除还是链接过期。
   2026-06-22 / #618：管理员坏教案编辑改为 `LessonPlanMissingRecovery`，展示请求 ID、对象缺失说明、返回教案管理和新建教案动作。

378. P1：治理 authoring 缺失 lessonPlanId 不形成质量报告或恢复动作
   `surface=authoring&tab=reports&lessonPlanId=missing-batch53` 仍进入通用“数据治理”，没有识别 authoring surface，也没有说明 lessonPlanId 缺失、报告不可生成或如何回到教案治理。
   2026-06-22 / #618：治理页和 status API 显式识别 authoring deep link；缺失或指定 `lessonPlanId` 会显示作者态质量报告上下文、目标 ID、查看报告与返回教案管理动作。

379. P1：播放列表直达播放会丢失播放意图
   公开播放列表 API 返回 3 条，直达 `/playlists/cmkaxvc11000n11d46jntz6nf/play` 时路由响应 200，但最终落到公开首页 `/`；动作后进入 `/interactive-learning`，仍没有播放列表标题、playlistId、继续播放或错误说明。
   2026-06-22 / #618：播放列表 play 路由不再硬重定向，改为展示 `PlaylistPlayLauncher`，保留 playlistId、标题、环节数和 `intent=start-class`，并通过 `/api/session` 启动课堂。

380. P2：知识节点直达能打开但缺加入课程流或学习任务后置状态
   知识节点 detail API 可返回 `鞍点_8_292242f6`，`/knowledge?nodeId=...` 也停留在知识图谱；但页面没有把该节点转成加入课程流、开始学习、查看关联资源或生成学习任务的后续状态，动作探测后仍无变化。
   2026-06-22 / #618：知识图谱同时识别 `node` 与 `nodeId`；知识节点检查器新增加入课程流和创建学习任务动作，教师知识节点管理页也提供加入课程流入口。

381. P2：移动直达状态仍依赖超长列表或静默改道
   390px 教师教案编辑仍是作者态壳层，390px ResourceNode blocked 高 92,909px；320px 管理员教案编辑只呈资源库壳层，320px 治理 authoring 缺失教案仍显示通用治理；390px 播放列表直达播放仍落到公开首页。

382. P2：第 53 批 24 个状态仍全部缺少 alert/live
   24 个 DOM/a11y JSON 均没有捕获到 `alert`。教案直达、缺失模板、blocked query、坏教案、治理缺失 lessonPlanId、播放列表直达、知识节点直达和移动深链状态都缺少状态播报。



383. P1：文档反馈后续动作仍是证据链接集合
   报告反馈页能展示 `root-locus-report.pdf`、量规得分、模型假设、目标指标、校正方案、仿真验证和证据胶囊；动作后焦点落在“练习相关任务 compensator-design · evidence 1”。页面没有把教师反馈转成可提交修订、确认已读、生成补练或回到评分记录的闭环状态。

384. P1：Prompt autodemo 与历史 API 口径不一致
   `autodemo=1` 页面默认显示 `STRUCTURE EVALUATED` 和一致性报告，动作后仍停留同页；但 `/api/evaluation/prompt-history/demo` 返回 `total: 0`。用户无法判断当前结果是演示、临时计算、历史记录还是可保存反馈。

385. P1：AI 工坊任务动作没有形成学习任务状态
   AI 工坊显示学习任务、日志和实验档案，动作探测后焦点落在“查看日志 2”等控件；没有任务启动、完成记录、作品集写回或路径更新状态。

386. P1：Copilot evidence 上下文仍暴露内部对象
   `/ai/copilot?context=evidence` 默认与动作后都显示控灵页面；动作后页面文本包含 `currentPathId: null`、`activeNodeId: null`、`nextNodeIds: []` 等上下文对象片段，且焦点仍能落到全局 AI 输入和浮动工具。

387. P1：作品集 reflection query 与默认空态不一致
   `category=reflection` 默认仍显示“暂无课堂作品”，动作后才切到“暂无AI协作反思”；页面没有说明当前分类、反思来源、创建入口或从 Copilot/AI 工坊写回的路径。

388. P1：教师 report-ledger surface 仍落到泛化班级分析
   `surface=report-ledger` 进入的是“班级学情总览”，动作后只切换“能力分/近阶段变化”等分析维度；没有报告账本、交付状态、学生反馈、导出或评分写回入口。

389. P1：评分工作台 ready 状态没有打开评分草稿
   `status=ready` 与有效 `classId` 下仍显示“当前没有打开的文档评分草稿”；GET `/api/teacher/document-grading/submissions` 与 `/writeback-preview` 均返回 405；动作后落到公开首页 `/`。

390. P1：数据中心 returnTo 没有形成返回或治理交接
   教师 `returnTo=/teacher/classes/.../analytics-v2` 和管理员 `returnTo=/admin/data-governance` 均仍停留数据中心；管理员动作探测命中隐藏“数据治理”文本并超时，说明可见命令与隐藏导航文本存在冲突。

391. P1：治理 assign query 不进入分派处置流
   `tab=risks&action=assign` 默认仍是治理页，动作后显示队列健康度、事实类型分布、最新风险清单和快照明细；`/api/admin/data-governance/status` 为 healthy，但没有分派对象、负责人、截止时间、批量操作或完成状态。

392. P1：系统配置 focus=audit 没有审计工作区
   `focus=audit` 默认与动作后均停留“基础设置 / AI 供应商与模型 / 通知设置 / 伦理监测”；没有配置 diff、影响范围、审计日志、回滚、确认或失败恢复。

393. P2：移动报告、AI、评分和治理状态仍缺固定主动作
   390px 文档反馈、Prompt、Copilot、教师 report-ledger、评分工作台，以及 320px 管理员数据中心、治理 assign、配置 audit 均能打开；但移动端仍以长内容、全局浮层或泛化页面为主，没有固定主动作区和清晰状态转场。

394. P2：第 54 批 30 个状态仍全部缺少 alert/live
   30 个 DOM/a11y JSON 的 `alerts` 与 `liveRegions` 均为 0。报告反馈动作、Prompt 评价、AI 任务、Copilot 上下文、作品集分类、报告账本、评分工作台、数据中心 returnTo、治理分派、配置审计和移动状态都缺少状态播报。

395. P1：报告反馈证据目标页不承接 assignment/criterion。
   `/profile/evidence?assignment=report-control-design&criterion=model-assumptions` 仍是泛化学习证据页，`/api/learning-evidence?assignment=...` 返回 404 HTML，报告、量规项和采用状态都没有落点。

396. P1：报告反馈练习目标不区分自适应入口和补强练习。
   普通 adaptive target 与 `intent=practice` target 都进入同一个自适应学习路径中心，真实 latest path 仍为 `path:null`，没有创建指标补强任务。

397. P1：报告反馈资源目标缺来源和完成后写回。
   “校正前测”资源页能打开，但没有显示来自报告反馈的 assignment/criterion，也没有完成后回写报告反馈、证据链或作品集的状态。

398. P1：Prompt 真实历史模式仍由全局 AI 输入驱动。
   `autodemo=0&mode=history` 下输入仍命中 `global-ai-sidebar-input`；动作后同时出现 success/loading 信号，Prompt 历史 API 仍为空。

399. P1：AI 报告任务不能生成练习任务或写回报告反馈。
   `/ai?task=report-feedback` 动作仍填入全局 AI 输入框，没有生成三条练习任务、引用报告反馈、采用/丢弃或写回学习证据。

400. P1：Copilot 反思上下文不生成作品集草稿。
   `context=portfolio-reflection` 提问后仍呈 loading 信号，没有出现反思草稿、保存入口、来源说明或作品集记录。

401. P1：作品集反思 create 意图不创建对象。
   `/profile/portfolio?category=reflection&intent=create` 动作后仍停留同一路由，没有草稿、表单、保存状态或 AI 协作记录。

402. P1：教师报告参数化深链仍是同一长分析页且动作跳首页。
   `surface=report-ledger&report=...`、`surface=remediation&cluster=...`、`surface=student-evidence&studentId=...` 均渲染同一个 13,192px 班级分析页；动作后全部跳到 `/`。

403. P1：评分工作台参数化来源仍无草稿且动作跳首页。
   带 assignment 的 ready 工作台和 missing gradingRunId 工作台都没有草稿列表、缺失对象错误或恢复路径；动作后跳到 `/`，document grading GET 仍返回 405。

404. P1：治理 riskId 和 export 参数不形成分派、处置或下载。
   `action=assign&riskId=missing-batch55` 停在 loading；`action=resolve` 动作后回泛化看板；`action=export` 没有 download event。

405. P1：配置 audit/model-test 参数被通用配置页吞掉。
   `focus=audit&changed=ai-provider` 与 `focus=model-test&provider=missing-batch55` 都打开通用系统配置，动作后没有 diff、影响范围、缺失 provider 错误、模型测试结果或审计记录。

406. P2：移动目标页仍由长页承接关键任务。
   390px 学生反馈证据目标高 4,279px；390px 教师补强 cluster 页高 14,128px；320px 管理员配置审计页高 4,119px，移动端缺固定主动作区和目标摘要。

407. P2：第 55 批 39 个状态仍全部缺少 alert/live。
   39 个 DOM/a11y JSON 均没有捕获到 `alert`。目标页跳转、API 404、空路径、全局 AI 抢占、教师动作跳首页、治理 loading/导出、配置参数忽略和移动长流程都缺少状态播报。

408. P1：学习证据 assignment UI 与 API 同时缺目标合同。
   学生证据页能打开 `assignment=report-control-design&criterion=model-assumptions`，但页面不展示报告、量规项、采用状态或可执行后续动作；同参数 API 返回 404 HTML。

409. P1：缺失 assignment 被当作普通学习证据页。
   `assignment=missing-batch56&criterion=missing-criterion` 仍显示同一“学习证据”页面，没有对象不存在、权限、链接过期或返回反馈页说明。

410. P1：自适应 writeback intent 仍忽略报告反馈写回。
   `intent=writeback` 仍进入普通自适应学习路径中心，真实 latest path 为 `path:null`，没有报告反馈来源、练习生成、完成条件或写回目标。

411. P1：资源 returnTo 不形成报告反馈回跳或完成后写回。
   “校正前测”资源页没有展示 `returnTo=/assessment/document-feedback`、assignment/criterion 或完成后回跳/写回状态。

412. P1：教师报告交付 action 仍停在长分析页。
   `action=deliver` 仍呈现 13,192px 班级分析页；动作后没有导出、发送、锁定版本、补强任务或交付确认，移动端仍高 14,128px。

413. P1：教师缺失学生证据动作跳公开首页。
   `studentId=missing-batch56` 没有学生不存在、班级不匹配或权限错误；动作后跳到公开首页 `/`，教师上下文丢失。

414. P1：评分 GET 方法边界没有产品化。
   评分工作台页面仍无草稿，动作后跳首页；`submissions` 与 `writeback-preview` GET 都返回 405，但 UI 没有说明方法边界或如何加载草稿。

415. P1：管理员用户 no-match URL、可见搜索和 API 口径继续分裂。
   no-match URL 初始页仍显示用户管理长页；可见搜索后页面缩短，但 API 仍返回 `total:298` 和真实用户样本。教师角色 no-match API 返回 `total:4`。

416. P1：治理导出 CSV 没有下载事件或完成状态。
   `tab=evidence-source&action=export&format=csv` 默认和动作后都停留治理 loading 状态，点击导出没有 download event，也没有失败或完成反馈。

417. P1：配置缺失 provider 测试参数被忽略。
   `focus=model-test&provider=missing-batch56&action=test` 仍是通用系统配置，动作后没有缺失 provider 错误、模型测试结果、配置建议或审计记录。

418. P2：移动端仍暴露宽表和长页。
   320px 管理员用户 no-match 页面实际导出为 945px 宽；390px 学生证据目标高 4,279px，教师报告交付高 14,128px，管理员配置高 4,119px。

419. P2：第 56 批 27 个状态仍全部缺少 alert/live。
   27 个 DOM/a11y JSON 均没有捕获到 `alert`。API 404、空路径、no-match 搜索、GET 405、治理导出、配置缺失 provider 和移动宽度变化都没有状态播报。

420. P1：报告反馈 actionable 目标不形成 adopted/completed 状态。
   报告反馈页能打开并显示 hidden-unapproved 状态，但动作后仍停留原页，没有已采用、已完成、待写回、教师可见或学生下一步状态。

421. P1：证据 completed assignment 仍缺页面和 API 合同。
   `status=completed` 的 assignment 证据目标仍显示泛化学习证据；`/api/learning-evidence?assignment=...&status=completed` 返回 404 HTML。

422. P1：缺失 lessonId/sourceEventId 被普通证据页吞掉。
   缺失 lessonId 和 sourceEventId 都返回 200 泛化证据页；lessonId 只显示普通空态，sourceEventId 仍显示普通证据列表，两个 API 均返回 404 HTML。

423. P1：自适应 writeback completed 仍不写回报告反馈。
   `intent=writeback&status=completed` 仍显示普通路径中心，latest path 仍为 `path:null`，没有报告反馈来源、完成结果或写回确认。

424. P1：教师报告导出没有下载事件。
   报告账本 `action=export` 页面可打开，但仍呈现 13,192px 班级分析长页；点击导出/下载后没有 download event。

425. P1：教师补强建任务仍停在长分析页。
   `surface=remediation&action=create-task` 仍是长班级分析页，没有生成补强任务、学生范围、完成条件或回写规则。

426. P1：评分草稿和方法边界不能形成恢复路径。
   评分工作台仍显示没有打开的草稿，动作后跳公开首页；API GET 返回 405，无效 POST 返回 400 原始错误，但页面不解释字段或方法边界。

427. P1：管理员用户 no-match 与角色分页 API 仍不遵守同一过滤合同。
   STUDENT no-match API 返回 `total:293`，ADMIN no-match 返回 `total:1`，TEACHER page 2 返回真实教师样本。q、role、page 的口径仍不一致。

428. P1：治理 resolve 缺失 riskId 没有恢复状态。
   `riskId=missing-batch57&action=resolve` 初始可停留 loading，动作后仍是泛化治理页，没有对象不存在、已解决、无权限或返回风险列表的说明。

429. P1：治理 JSON 导出没有下载事件。
   `action=export&format=json` 点击后没有 download event，也没有导出失败、空数据、权限或完成状态。

430. P1：配置缺失 provider/model 测试参数被忽略。
   `provider=missing-batch57&model=missing-batch57&action=test` 仍显示当前 SiliconFlow 模型列表，点击测试没有缺失对象、运行结果、延迟、失败原因或配置建议。

431. P2：第 57 批 32 个状态仍全部缺少 alert/live。
   32 个 DOM/a11y JSON 均没有捕获到 `alert`。未批准反馈、API 404、搜索结果变化、GET/POST 方法边界、导出无下载、缺失 provider/model 和移动宽度变化都没有状态播报.

432. P1：报告反馈采用和写回动作不改变状态。
   `status=returned&action=adopt` 与 `status=completed&action=writeback` 都只显示同一报告反馈页，点击后仍停留原页，没有 adopted、completed、written-back 或 teacher-visible 状态。

433. P1：任务大厅不承接反馈任务查询和 returnTo。
   `/missions?q=report-control-design&status=completed&returnTo=/assessment/document-feedback` 仍显示普通任务大厅，未找到可见搜索输入；API 返回完整 missions 列表。

434. P1：作品集反馈收录没有形成候选证据或草稿。
   `assignment=report-control-design&intent=collect&status=completed` 仍是普通学习档案，动作后没有收录草稿、候选证据、反馈来源或保存结果。

435. P1：教师报告 PDF 下载仍没有真实下载事件。
   `action=download&format=pdf` 呈现 13,192px 班级分析页，点击下载/导出/报告类动作后没有 download event，也没有下载失败、文件名或完成反馈。

436. P1：教师报告发送缺失学生时会跳公开首页。
   `action=send&studentId=missing-batch58` 不显示学生不存在或权限说明；点击发送/交付类动作后跳到公开首页 `/`。

437. P1：评分审批缺失 run 的 UI、GET 和 POST 边界都不成立。
   评分工作台带 `gradingRunId=missing-batch58&action=approve` 仍显示空态，审批动作后跳公开首页；submissions GET 返回 405，writeback POST 返回 404 HTML。

438. P1：教师班级学生直达页 404，但 API no-match 返回真实学生。
   `/teacher/classes/.../students` 页面返回 404；同一 q 的 API 返回真实学生数组，页面路由、搜索和 API 过滤合同不一致。

439. P1：管理员用户重置/导出动作继续忽略 q。
   学生 no-match page 2 API 返回 `total:293`，教师 no-match page 2 返回 `total:4`；页面仍显示真实用户，导出无 download event。

440. P1：治理分派缺失对象和 XLSX 导出没有闭环。
   缺失 riskId/assignee 的分派仍是泛化治理页；`format=xlsx` 导出没有 download event 或完成/失败状态。

441. P1：已知 provider 下缺失 model 测试仍被通用配置页吞掉。
   `provider=SiliconFlow&model=missing-batch58&action=test` 仍显示真实模型列表，没有缺失 model、测试失败、响应延迟、配置建议或审计记录。

442. P2：第 58 批 33 个动作闭环状态仍全部缺少 alert/live。
   33 个 DOM/a11y JSON 均没有捕获到 `alert`。采用、写回、任务查询、作品集收录、下载、发送、审批、重置、导出、分派和模型测试都没有可读状态播报。

1. P1：移动端 floating dock 与内容避让不足。
   证据覆盖 `/`、`/login`、`/interactive-learning`、`/simulations`、`/knowledge`、`/assessment/adaptive-practice`。这是跨页面壳层问题，应在 AppShell/全局 dock 层解决。

2. P0：注册短密码触发 runtime error。
   `/register` 提交短密码后显示 `Objects are not valid as a React child (found: object with keys {formErrors, fieldErrors})`，普通表单校验错误升级成开发错误页。

3. P0：空环节教案可以发起正式课堂。
   教师新建教案只填标题即可保存，点击“开始上课”后进入教师课堂，主体显示 `Waiting for content...`，页码显示 `1 / 0`。

4. P1：播放列表播放页静默回首页。
   `/playlists/[id]/play` 返回 200 但最终落到 `/`，没有播放列表、课程或权限说明；用户点击播放后会认为入口失效。

5. P1：教师 Arena 发布预览使用不存在的默认班级。
   预览生成后页面底部显示 `Class not found`，默认 `class-2026-control` 与当前教师真实班级不一致。

6. P1：管理员用户弹窗键盘行为失败。
   新建账号弹窗打开后 `Esc` 未关闭遮罩；第八批连续 Tab 还确认焦点先进入遮罩后的下载模板、批量导入、搜索、角色筛选和列表操作，说明模态焦点陷阱不成立。删除确认仍使用浏览器原生 confirm。

7. P1：系统配置空供应商可以生成当前供应商草稿。
   点击“添加供应商”后直接生成 `provider-2` 并切换当前供应商，没有像模型添加一样提示必填字段缺失。

8. P1：Arena 工作台非规范深链静默降级。
   `/interactive-learning/control-workbench?source=arena&taskId=task-second-order-lead-pid` 显示自由探索模式，不进入官方评价；如果外部链接或 AI 工具生成这种参数，学生会丢失正式提交上下文。

9. P2：管理员批量导入错误和上传控件语义不足。
   无效 CSV 能显示“无法解析 Excel 文件，请使用官方模板重新填写”，但错误旁没有“下载官方模板”；第八批还确认隐藏 file input 的可访问名称是“搜索管理员功能”，与上传用户导入 Excel 的真实任务不一致。

10. P1：Arena 官方提交结果解释不够明确。
   提交后同时出现“硬约束已通过，但排名分为 0”和“硬约束全部通过，提交进入正式排名”，学生难以判断 0 分提交是否有效计入榜单。

11. P1：Arena 多次提交采用规则不清。
   同一学生对同一真实 publication 完成第 2 次有效提交后，挑战详情页提交次数从 1 变 2，但当前榜单仍只显示 demo 一行；学生端没有说明榜单按最佳、最新还是全部提交聚合。

12. P1：课堂结束仍依赖浏览器原生 confirm。
   结束确认文案存在，但无法展示在线人数、报告生成、是否可恢复等关键信息；结束后回到教案列表没有成功确认，且 0 环节教案仍可再次开始。

13. P2：AI 模型测试完成态可用，但多次测试后的页面密度风险未治理。
   首个模型测试返回响应时间和正文，长文本直接展开在配置页里，缺少测试时间戳、prompt 摘要和折叠历史。

14. P1：课堂结束后复盘链路在空课堂场景下断裂。
   已结束空课堂的复盘页只显示“未绑定班级，无法展示课后分析信息”，没有返回入口、课堂摘要、教案入口或修复建议。

15. P1：移动端官方提交入口过深。
   学生可以完成移动端官方评测提交，但提交按钮位于长页面深处，提交后结果与图表、参数卡混在同一长页中，完成感和下一步不清楚。

16. P1：有效 Excel 导入成功，但缺少导入后治理动作。
   页面能显示新增 1 并在列表首行展示审计账号；第八批确认可见动作仍没有默认密码说明、通知学生、筛选本次新增、撤销导入或导出失败行入口。历史导入账号会继续混在普通账号列表中，无法按批次管理。

17. P2：AI 模型测试 loading 只依赖按钮文本。
   按钮显示“测试中...”，但没有测试目标、预计耗时、超时提示或配置锁定说明。

18. P1：有效课堂复盘数据可见，但解释与教师回流不足。
   有效复盘页能展示课堂记录、互动日志、提交人数、学习事实和能力追踪；但能力下降缺少数据口径解释，页面缺少回到课堂历史、教案或导出报告的教师工作流入口。

19. P2：AI 模型测试失败态可见，但恢复指导不足。
   失败信息以内联红色提示展示且不泄露密钥，但没有失败类型、时间戳、重试建议或配置检查清单。

20. P1：已确认关键 a11y 断点，全站 a11y 尚未成立。
   登录表单 Tab 焦点环可见；但管理员模态焦点陷阱和 Escape 已确认失败，导入上传控件可访问名称错误，注册短密码没有表单内错误。第十一批确认课堂加入错误态没有 `aria-live`/`role=alert`，Arena 工作台有 30 个未命名 SVG/canvas，教师复盘页有 9 个未命名 SVG/canvas。第十二批继续确认管理员统计页、学生成长页和教师班级分析页仍缺图表等价文本；第二十二批继续确认教案编排器存在无名图标按钮，知识节点管理结构化快照出现 648 个未命名按钮。控灵/浮层持续带入无名按钮和读屏顺序风险。

21. P1：教师账号删除影响范围不透明。
   第十批使用带关联数据的临时教师确认：删除前存在 1 个班级、1 个非预置教案、1 个资源、1 个教案环节、1 个课堂会话和 1 条 StudentState，删除后全部为 0；但 UI 只出现原生确认“确认删除账号 审计关联删除教师0651？”，列表、详情和成功通知都没有展示影响范围、可恢复性或二次核验。

22. P1：Arena 真实发布列表重复项难辨。
   教师通过 UI 真实发布挑战后，列表出现两个标题、班级、状态高度相似的发布项；缺少创建时间、截止时间、提交数或 publicationId 摘要，教师难以确认刚发布的是哪一条。

23. P1：真实发布报告和截止后报告仍以技术 id 和 0 分有效提交为核心。
   学生完成真实 publicationId 官方提交后，教师报告能显示 `1/1` 参与、2 次提交和 100% 有效，但页面主标题仍是 `task-second-order-lead-pid`，且没有解释“有效提交但平均分 0”的教学含义。第十二批已截止夹具报告继续证明，截止后首屏也没有“已截止/最终成绩口径”。

24. P1：Arena 0 分和逾期有效提交被列为优秀方案。
   教师报告中两条 demo 的 0 分有效提交都进入“优秀方案”区域，容易把“入榜记录”误读为“优秀表现”；第十二批夹具把两条复制提交标记为 late 后，页面仍将其列入优秀方案，缺少最佳/最新/截止前/逾期/需诊断方案的区分。

25. P1：Arena 提交未回流学生证据。
   工作台提交成功态写明“可用证据将回流到学习记录”，但二次提交后 `/profile/evidence` 仍只显示课堂作答，`/profile/growth` 仍显示控制校正证据不足，Prisma 复核 LearningFact/GrowthRecord 也没有新增 Arena 来源。

26. P2：教师发布班级范围仍要求内部 id。
   真实发布链路需要输入 `cmma...` 形式的班级 id，缺少班级选择器、班级名搜索或最近授课班级默认值；这会把教师发布流程暴露为内部数据操作。

27. P2：学生主路径首屏经常先展示导航和筛选，而不是下一步任务。
   仿真、Arena、知识图谱尤其明显。学生使用顺序应先回答“我现在做什么”，再展开高级筛选。

28. P2：未登录回调目标表达不稳定。
   未登录 `/dashboard` 的截图显示“未指定回调目标”，应确认受保护入口是否正确传递 callback。

29. P2：深色视觉语言一致，但局部页面偏“控制台/筛选后台”。
   Arena 与仿真目录需要更强的学生任务引导，避免第一眼像管理筛选页。

30. P2：深色平台壳层与浅色/白底课程或 3D 内容存在割裂。
   证据见 `/simulations/cruise` 与 4-1 学生 demo 运行态。需要为 WebGL 场景和课程图片建立统一承载边界。

31. P2：未登录状态下的教师/管理员入口安全性正常，但回调目标表达不足。
   `/teacher`、`/admin` 能重定向登录，但登录页没有说明“登录后进入教师端/管理员后台”。

32. P0：教师投影运行态大面积出现 `Not found`。
   29 门课程教师运行态全部 200，但 27 门课在桌面和移动均出现 `Not found`，说明 HTTP 健康不能代表教师投影链路健康。

33. P1：教师 demo 运行态同步/事件写入失败。
   停止日志显示 `/api/session/demo` 404、`/api/session/demo/state` 外键写入失败，以及 `/api/interactive/events` 因 `\u0000` Unicode escape 写入失败；教师投影页需要把 demo session 与真实课堂状态持久化边界分开。

34. P2：详情/辅助页存在可见资产缺失和上下文断点。
   预置教案封面图和伦理页背景图有 404；AI/评估辅助页能访问，但学生从学习任务进入后缺少稳定返回路径和当前学习目标提示。

35. P1：Arena 发布报告在空数据态、真实提交态和截止后态都存在信息命名偏技术化。
   报告页主标题直接显示 `task-second-order-lead-pid`，教师更需要任务中文名、班级名、截止状态、有效提交解释、逾期提交口径和 0 分诊断。

36. P1：课程目录移动端搜索无可感知过滤结果。
   第十三批在 `/interactive-learning/courses` 移动端填入 `zzzz-no-course` 后，页面仍展示完整课程列表，没有结果数量变化、空态或清除条件；用户无法判断输入是否生效。

37. P1：课堂加入无效码缺少反馈。
   第十四批确认移动端输入 `BAD123` 会被静默过滤为 `123`，输入 `123456` 后点击查询仍没有错误文案、查询中状态或课堂不存在提示；两个状态都没有 live/status 语义。

38. P1：自适应学习路径动作态语义冲突。
   学生点击路径动作后同时看到“路径原创准备中”和可提交的自适应练习题，页面没有解释练习是路径生成前置条件、当前替代任务还是独立练习。

39. P1：教师班级分析移动端长表格过重。
   第十四批 `/teacher/classes/.../analytics-v2` 移动截图出现极长能力矩阵和重点学生列表，结构抽查记录 50 个未命名 SVG/canvas，教师难以快速获得主要风险。

40. P2：管理员用户表格移动端结构不适合操作。
   用户搜索空态能显示“暂无账号数据”，但移动端表头被压成多行，账号信息、学号/工号、角色、创建时间、操作列仍保留桌面表格形态。

41. P1：自适应练习提交完成态不明确。
   第十五批确认学生可展开练习、选择答案并提交，提交后出现“需要复盘”解释；但按钮仍显示“提交答案”，缺少“已提交/下一题/证据已更新”的明确完成态，且结果没有 live/status 语义。

42. P1：管理员批量导入缺少可见确认层。
   点击“批量导入”直接触发原生 file chooser，移动端没有先展示格式、字段、影响范围、隐私或撤销说明；这类批量操作风险高于普通单账号新建。

43. P2：系统配置保存完成态过轻。
   第十五批点击“保存配置”后页面停留在配置页，截图中没有明显成功条、最近保存时间、操作者或影响范围。添加模型空表单能显示“模型 ID 不能为空”，但缺少 live/status 语义。

44. P1：课程入口课堂码错误没有区分格式错误和无效码。
   第十六批在课程入口输入 `123` 和 `123456` 后都显示“请输入 6 位课堂码。”；短码格式错误和 6 位无效码没有不同解释，错误区也没有 `aria-live`/`role=alert`。

45. P1：教师课堂历史统计阻断页缺少恢复动作。
   第十六批从教师历史第一条“课堂统计”进入后，只显示“该课堂记录未绑定班级，无法展示课后分析信息”，没有返回历史、绑定班级、编辑归档信息或修复课堂记录的动作。

46. P1：数据治理移动风险表不可读。
   第十六批数据治理真实看板在 390px 宽度下显示系统状态、队列、事实分布和风险清单，但风险表把学生、风险类型、触发时间和说明压成竖排，关键处置对象难以扫描。

47. P1：数据治理刷新和讲义导出缺少完成反馈。
   第十六批点击数据治理“刷新状态”后页面保留原状态，没有明显刷新中/完成/失败反馈；课程入口点击“下载 PDF 讲义”也未观察到下载事件或可见开始/失败状态。

48. P1：扫码/链接课堂加入是两步，但第一步没有状态解释。
   第十七批 `/classroom/join?code=129051` 能预填并找到课堂，但第一次点击后仍停留在加入页，按钮回到“查询课堂”；第二次点击才进入学生运行态。页面没有解释“已查询到课堂，需要确认加入”，也没有 live/status。

49. P1：学生运行态暴露 raw sessionId。
   第十七批真实加入后学生端显示“已加入课堂 cmqea1d3n001euwyfoi7b6pru”，把内部会话 id 当作学生可见状态。学生更需要课堂码、课程名、班级名和当前同步页。

50. P1：教师投影二维码入口发现成本高，复制反馈缺少播报。
   第十七批确认真实教师投影页默认只露出“本页工具 默认折叠”，二维码入口在展开后的教师课堂台内；等待页和投影二维码弹窗虽有“课堂码已复制/加入链接已复制”可见文本，但没有 `role=status`/`aria-live`。

51. P1：模板下载和数据治理标签切换缺少完成状态。
   第十七批点击“下载模板”触发 `users-template.xlsx` 下载事件，但页面无下载开始/失败/完成反馈；数据治理“课堂质量”点击结果不清，证据源/缓存健康能切换但缺少明确 selected 状态和切换播报。

52. P1：真实课堂发放作答与提交完成态缺少播报。
   第十八批确认教师第 03 页可发放作答，学生可提交第一张作答卡，教师汇总可出现“已提交 1 人”；但发放、提交、汇总和参考答案切换状态的结构记录中 `alerts` 均为空，没有 `role=status`/`aria-live`，学生也缺少“本页完成 1/3”的页级完成度。

53. P1：结束课堂前后缺少影响范围和成功落点。
   第十八批点击“结束课堂”只出现原生确认“确定要结束课堂吗？结束后学生将停止同步课堂进度。”；确认后数据库状态变为 `FINISHED`，但教师被带到 `/teacher/lesson-plans`，没有“课堂已结束”、提交人数、未提交学生、复盘/历史/报告入口等后续动作。

54. P1：学生结束后没有稳定课堂结束页。
   第十八批教师结束课堂后，学生刷新旧运行态被带回 4-1 课程入口页，页面显示“输入课堂码加入课堂”，没有“课堂已结束，本次记录已保存”或“查看本次证据”的直接路径。

55. P1：已结束 session 仍能呈现直播投影界面。
   第十八批直接访问已结束 session 的教师投影 URL，页面仍显示第 03 页、已发放作答、学生提交汇总和投影控制，首屏没有结束时间、只读状态或复盘入口，容易让教师误以为课堂仍可继续操作。

56. P2：学生证据回流已成立，但缺少课堂来源定位。
   第十八批 `/profile/evidence` 出现 4-1 step-03 课堂作答证据和“复盘课堂作答”动作；但学生从结束态不能直达该证据，证据卡也没有突出课堂码、刚结束课堂或 session 来源，多个课堂作答并存时定位成本偏高。

57. P1：数据治理缺少从风险到处置的动作链。
   第十九批确认数据治理页能展示待处理风险、课堂质量、证据源和缓存健康，但主要是只读表格；风险行没有查看学生证据、标记已处理、导出列表、创建待办或分派处置等治理动作。

58. P1：数据治理刷新与标签切换缺少状态语义。
   点击“刷新状态”后页面没有可见刷新中/完成/失败说明，结构化快照 `alerts` 为空；课堂质量、证据源、缓存健康标签能切换内容，但没有 `aria-selected` 或 live/status 播报。

59. P1：批量导入第一步缺少确认与影响说明。
   点击“批量导入”直接打开原生 file chooser，没有先展示字段、更新规则、默认密码、通知策略、撤销范围或隐私影响；隐藏上传 input 的 `aria-label` 仍是“搜索管理员功能”。

60. P1：批量导入错误状态不够持久。
   畸形 Excel 能触发解析失败，但缺少靠近上传入口的稳定错误摘要和模板恢复动作；缺列 Excel 在最终 DOM 快照中没有留下稳定可读的缺列结果，且错误状态没有 live/status 语义。

61. P1：批量导入成功/更新缺少批次治理。
   混合导入能显示“新增 1 / 失败 1 / 角色无效”，重复导入能显示“更新 1”，数据库复核账号真实更新；但页面没有批次 ID、文件名、导入时间、撤销本批、失败行导出、通知学生、复制登录信息或字段级更新摘要。

62. P1：教师课堂删除仍使用原生 confirm，影响范围不透明。
   第二十批在上课历史中点击“删除课堂”只出现浏览器确认“确定删除这条课堂历史吗？课堂记录会一并删除。”；文案没有展示学生状态、提交、报告、学习事实、证据回流和恢复性影响。

63. P1：有效课堂复盘有数据但缺少后续动作。
   5-3 有效复盘能显示 81 人课堂记录、72 人互动日志、56 人提交、56 人形成学习事实和 0 人同步错误，但页面没有导出、下载、打印、发送学生、生成补强路径、创建题单或同步到班级报告的动作。

64. P1：复盘页出口偏离教师课后工作流。
   有效复盘页只有“返回班级详情”和“前往评审聚合入口”；后者跳到 `/review/extracurricular-showcase`，这是内部评审聚合入口，不是教师继续处理本课堂报告的自然路径。

65. P1：学生证据 lessonId 与课程路由 slug 不一致。
   学生默认证据中 4-1 记录使用 `unit-4-1-design-task-expression-v1`；直接按课程路由 slug `unit-4-1-design-task-expression` 过滤会显示“当前筛选下暂无证据”，从课程或报告按 route slug 回查容易断裂。

66. P1：“复盘课堂作答”没有进入题目复盘或补救路径。
   学生证据卡的“复盘课堂作答”只是跳到 `/profile/evidence?lessonId=...` 再次过滤证据列表，仍停留在证据浏览页；没有原题、作答、参考答案、错误原因或补练任务。

67. P1：学生证据刷新、筛选和空态缺少可访问状态播报。
   嵌入式证据页顶部刷新是图标按钮，无法通过可访问名称“刷新”定位；默认筛选、课次筛选、课堂作答筛选和空态恢复的结构化快照 `alerts` 均为空。

68. P1：教师班级学生清单缺少搜索、筛选、批量治理和移动端重构。
   143 人学生清单在桌面和移动端都以长表格呈现，教师无法按风险、证据状态、待刷新或学生姓名快速定位。

69. P1：班级移除学生仍使用原生 confirm，影响范围不透明。
   第二十一批点击“删除”只出现浏览器确认“确定要将 陈兴旺 从班级中移除吗？”；没有说明历史课堂、报告统计、学习事实、证据回流和恢复策略。

70. P1：添加学生弹窗缺少稳定 dialog/focus/live 语义。
   弹窗可见，但结构化快照仍混入背景长表格；单字符校验、候选刷新和搜索空结果没有 `role=status` 或 `role=alert`。

71. P1：班级学生 Excel 导入缺少预览和批次治理。
   无效学号导入能显示失败表格，但导入前没有行数/影响预览，导入后没有批次编号、失败行导出、撤销、通知学生或筛选本批。

72. P1：教师个体学情推荐动作不可执行。
   个体学情页能识别中风险、学习事实 0、证据缺少和多条推荐动作，但无法直接生成补练、发消息、分派任务、记录干预或关闭风险。

73. P1：教师侧学生证据页停留在筛选浏览，缺少核验与处置闭环。
   教师侧证据页能筛选和刷新，但没有导出、备注、核验、生成补救任务或回写课堂复盘；移动端首屏主要被筛选占据。

74. P1：教案删除确认仍缺少影响范围。
   第二十二批删除弹窗只展示教案标题和“此操作无法撤销”，没有说明环节、课堂、报告、学生状态和证据回流影响。

75. P1：教案编排器核心操作过度依赖拖拽。
   空 BOPPPS 阶段只提示“拖拽资源到此处”，没有键盘/触控等价的“加入到阶段”命令；复杂画布中还存在无名图标按钮。

76. P1：新建教案空标题校验使用浏览器原生 alert。
   保存空标题触发 `请输入教案标题` alert，关闭后没有字段级错误、错误摘要或 live/status 证据。

77. P1：编排器资源搜索空态和资源预览缺少后续动作。
   无匹配搜索缺少结果数和恢复路径；资源预览没有直接连接到“加入当前阶段”。
   2026-06-22 / #618：作者态资源管理与课程流选择器补充结果数量、清除/恢复动作和可见已选区；编排器保留模板来源提示和返回路径。资源预览到阶段加入动作仍作为后续独立改进项保留。

78. P1：教师资源编辑缺少使用影响说明。
   资源编辑弹窗没有展示该资源被哪些教案、课堂或学生证据引用，教师无法判断修改名称、描述或分类的影响范围。
   2026-06-22 / #618：资源编辑弹窗新增“使用影响”说明，提示修改会影响教案编排、课堂资源展示和证据回放，并引导先到教案或 ResourceNode 管理复核引用关系。

79. P1：知识节点管理不适合大规模教学编排。
   944 个知识节点形成超长列表，结构化快照出现 648 个未命名按钮，预览弹窗也没有加入教案或生成练习的动作。
   2026-06-22 / #618：教师知识节点管理默认分页根节点、为预览/编辑按钮补可访问名称，并增加“加入课程流”动作；课程流构建器也改为分页知识节点选择。

80. P2：课堂组件标签缺少教师下一步路径。
   页面呈现只读/建设中状态，但没有说明如何配置、何时可用、或应回到哪个教案编排入口。

81. P1：教师发起课堂缺少班级绑定步骤。
   教师有多个班级，但教案列表“开始上课”直接创建 `classId=null` 的课堂，教师无法选择班级或确认临时课堂。

82. P1：无班级直发课堂可重复创建 ACTIVE session。
   后端只有传入 `classId` 时检查班级进行中课堂；本批前已存在多条同教师无班级 ACTIVE session，UI 没有提示继续旧课堂或结束旧课堂。

83. P1：教师投影首屏和二维码弹窗缺少班级/临时课堂身份。
   课堂码和二维码可见，但页面没有明确本课堂未绑定班级，教师无法预判课后复盘会受限。

84. P1：翻页同步与复制/加入状态缺少 live/status。
   二维码弹窗可复制课堂码和链接，翻页也能改变页码，但结构化快照 `alerts` 均为空，缺少同步完成、复制成功和失败重试状态。

85. P1：结束课堂后落点不承接课后工作流。
   确认结束后落回课程入口页，没有课堂已结束成功态、提交摘要、复盘入口、历史入口或报告入口。

86. P1：直发课堂结束后复盘被未绑定班级阻断。
   `/classroom/teacher/{sessionId}/review` 只显示“该课堂记录未绑定班级，无法展示课后分析信息”，但发起课堂前没有提示这种后果。

87. P1：关键教师运行态控件可访问查询不稳定。
   “二维码”“当前在线学生0 人”“结束课堂”在 DOM 中可见，但 Playwright role 查询无法定位，本批脚本必须使用 JS 可见文本 fallback；需要独立键盘和读屏复核。

88. P1：班级详情页“开始上课”没有完整发起流程。
   页面显示班级上下文，但没有把教案选择、班级绑定、进行中课堂检查和投影入口统一成教师可确认的开始课堂流程。

89. P1：班级绑定课堂的教师投影和二维码弹窗仍不显示班级身份。
   后端 `classId` 正确，但前端只突出课堂码，缺少 `2024自动化`、班级码和加入范围说明。

90. P1：学生运行态暴露 raw session id 作为主课堂标识。
   学生看到“已加入课堂 cmqm...”，而不是课程、班级、教师和课堂码组合。

91. P1：在线学生入口只显示人数，缺少名单、当前环节、心跳和送达状态。
   本批 2 名学生加入后教师端显示“当前在线学生2 人”，但点击后没有可用于课堂决策的学生列表。

92. P1：发放作答缺少送达确认。
   教师看到“已发放作答”，但无法判断在线学生是否收到、离线学生是否遗漏、是否需要重发。

93. P1：教师汇总缺少步骤级总体进度和未完成名单。
   单卡统计可显示 `已提交 2 人`，但没有本步骤完成度、未提交卡片、未提交学生或重复提交口径。

94. P1：学生结束后回到课程入口，课堂记录承接不足。
   课堂结束后学生刷新落到课程入口，而不是本次课堂结束态或本次证据入口。

95. P1：真实课堂提交能生成学习证据，但存在重复证据风险。
   学生证据页能看到 `4-1 前测` 记录，但同类记录重复出现；本批数据库也显示 2 名学生在 `step-03` 产生 4 条 step response。

96. P1：教师复盘页缺少报告交付动作。
   复盘页能展示班级、提交、学习事实和学生短板，但缺少导出、发送、复制摘要和发布补强路径。

97. P1：已结束课堂历史不承接报告交付。
   班级详情页能找到课堂统计，但没有导出、发送、生成补强或交付状态。

98. P1：复盘页真实数据与报告动作断开。
   复盘页有班级、提交、学习事实和学生短板，但没有导出、发送、复制摘要、生成补强路径或发布题单。

99. P1：复盘页出口跳内部评审聚合，不是教师报告交付。
   “前往评审聚合入口”落到 `/review/extracurricular-showcase`，不携带本课堂上下文。

100. P1：控制纠偏报告真实导出 API 可用，但 UI 不可发现。
   `/control-correction-report?export=true` 返回 `report` 和 `export`，但教师班级、复盘和首页都没有显式入口。

101. P1：助手效果报告真实班级仍是 demo-only。
   真实班级调用 `/assistant-effect-report?export=true` 返回 404“演示效果报告不存在”，但教师首页已有报告槽位文案。

102. P1：报告评分工作台空态缺少真实来源路径。
   空态要求选择已转换提交或评分草稿，但没有引导从课堂复盘、班级历史或报告账本创建。

103. P2：demo 报告评分工作台与正式报告边界不够强。
   `?demo=1` 能看到样例评分界面，但缺少明显演示数据隔离和不会写入真实班级的说明。

104. P2：移动端课后复盘缺少固定交付动作区。
   移动复盘页长页面主要呈现分析内容，缺少顶部或底部的导出、发送和补强路径快捷动作。

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

113. P1：数据治理风险清单缺少处置动作。
   API 显示 `activeRiskFlags=170`，页面能列风险，但没有查看证据、分派、标记处理、导出或创建修复任务。

114. P1：数据新鲜度 stale 没有修复入口。
   页面显示快照约 3009 分钟前，仍缺重建快照、重试队列或失败原因入口。

115. P1：治理刷新缺少完成播报。
   点击刷新状态后没有明显成功态或 live/status。

116. P1：用户批量导入缺少批次治理闭环。
   下载模板和导入入口存在，但缺预览、撤销、通知、失败行导出和批次审计。

117. P1：用户导入 file input 可访问名称错误。
   隐藏上传控件仍是 `aria-label="搜索管理员功能"`。

118. P1：系统配置保存缺少影响范围和状态播报。
   保存按钮存在，但缺配置变更摘要、影响范围和明确 live/status。

119. P2：管理员移动端缺少固定关键操作区。
   数据治理、用户管理和配置页都可访问，但长页中刷新、导入、保存和处置动作容易丢失。

120. P1：“复盘课堂作答”落点仍是同一证据列表。
   href 为 `/profile/evidence?lessonId=unit-4-1-design-task-expression-v1`，点击后没有进入题目级复盘页。

121. P1：错题证据没有直接生成补练或加入路径。
   证据卡能显示错误题、参考答案和 0 分，但没有基于该 evidence 的补练 CTA。

122. P1：补练入口未继承证据上下文。
   自适应练习页没有显示来自 4-1 课堂作答的题目、课次、错误原因或 sourceLogId。

123. P1：路径生成空状态与进度文案冲突。
   `/api/learning-paths/latest?goal=control-correction` 返回 `path=null`，页面仍显示“当前节点 入门诊断”和“本周完成 24%”。

124. P1：evidence-review intent 未形成证据复盘视图。
   `/assessment/adaptive-practice?intent=evidence-review&goal=control-correction` 仍是泛化路径中心，没有证据摘要和错题上下文。

125. P2：学生证据移动端受浮层和长字段影响。
   课次字段截断，控灵浮层压住第一张证据卡局部。

126. P1：控制工作台缺少实际 `bottom-tools` 区域。
   三张控制工作台截图均记录 `missingZones: ["bottom-tools"]`，用户无法稳定找到底部任务动作区。

127. P1：控制工作台移动端关键动作被长仪表流稀释。
   移动端顶部和底部截图证明学生需要跨过大量图表、参数、流程和支持说明，才能完整理解提交与证据动作。

128. P2：`floating-dock-safe-area` 只是结构标记，未形成充分可见避让。
   控灵浮层仍贴近右侧内容区，移动端长页中不能证明提交和表单动作已有稳定安全区域。

129. P1：已结束教师投影直达页仍呈现直播态。
   `/api/session/cmqm6s1s1001f1wyf4ggkifs5` 返回 `status=FINISHED`，但页面仍显示“教师投影”“教师控制”“已发放作答”和学生提交汇总。

130. P1：已结束教师投影直达页缺少复盘/报告转场。
   直达页结构化摘要 `reviewAction=false`，没有把教师带到复盘、报告或历史课堂工作流。

131. P1：复盘页数据可见，但报告交付动作仍不足。
   复盘页显示 FINISHED 与学生数据，并有内部评审聚合入口；首屏缺少导出、发送、补强和回到历史课堂等教师交付动作。

132. P0：教师课前包复核页当前返回 500。
   `/teacher/prep-packs` 桌面和移动端均返回 500，页面只显示 Next 错误层。
   台账状态（2026-06-29，`audit-report-closure-ledger-cleanup`）：mapping-cleaned / closed by archived evidence。`audit-remediation-p0-stability` 已在 2026-06-21 覆盖 `/teacher/prep-packs` root 与 cluster 路由恢复态，证据见 `remediation/audit-remediation-p0-stability/evidence.md`；本次仅清理主报告未标记映射，证据见 `remediation/audit-report-closure-ledger-cleanup/evidence.md`。

133. P0：`CourseEnhancementPack` 表缺失阻断复核页。
   manifest 记录 `prisma.courseEnhancementPack.findFirst()` 失败，错误为 `The table public.CourseEnhancementPack does not exist in the current database.`
   台账状态（2026-06-29，`audit-report-closure-ledger-cleanup`）：mapping-cleaned / closed by archived evidence。`audit-remediation-p0-stability` 已把缺表、无候选包和 cluster/class 深链导向受控恢复/空态，不再返回 500；证据见 `remediation/audit-remediation-p0-stability/evidence.md`。finding 134-136 仍是课前包入口、近场动作和恢复体验完整性问题，不随本映射清理关闭。

134. P1：教师工作台课前包入口通向阻断页。
   桌面和移动端都有 `/teacher/prep-packs` 入口，但点击后无法进入复核体验。

135. P1：班级诊断结果没有就地连接课前包复核。
   班级分析页能展示大量能力和学生数据，但没有在短板或学生簇旁提供稳定可见的课前包复核动作。

136. P1：课前包错误状态没有产品级恢复动作。
   直达页、cluster 深链和移动端都没有返回教师工作台、回到班级分析、重试或联系管理员。

137. P2：移动端课前包报告槽位过深。
   教师工作台移动端顶部能看到“课前包”标签，但报告槽位的复核/激活/归档说明在长页深处，首屏不可见。

138. P1：数据治理风险清单仍缺少行内处置动作。
   风险表显示学生、风险类型、级别、触发时间和说明，但没有查看证据、分派、标记处理、创建待办或导出风险。

139. P1：治理刷新缺少完成播报。
   “刷新状态”可点击，截图时间戳更新，但 DOM 没有 status/live 区域，管理员和读屏用户都缺少明确结果反馈。

140. P1：数据治理导出入口缺失。
   `/api/admin/data-governance/status` 可返回治理数据，但页面没有风险清单导出、摘要下载或报告交付动作。

141. P1：用户批量导入缺少可逆批次状态机。
   现有入口只有下载模板和批量导入，缺预览、失败行导出、通知、撤销/回滚和批次审计。

142. P1：用户导入 file input 可访问名称错误仍存在。
   隐藏上传控件的 `aria-label` 为“搜索管理员功能”，与批量导入 Excel 上传不一致。

143. P1：系统配置保存缺少影响范围和完成状态。
   保存/重置/测试按钮存在，但页面没有差异摘要、影响路径、保存结果或 live/status。

144. P2：管理员移动端关键治理动作没有固定操作区。
   数据治理、用户管理和系统配置都能访问，但刷新、导入、保存和处置动作在长页中容易与内容表格混在一起。

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

155. P1：课后复盘真实数据与报告交付仍断开。
   控制纠偏报告导出 API 返回 200，但复盘页和教师工作台没有显式导出、发送、复制摘要或生成补强路径动作。

156. P1：复盘页出口仍指向内部 review 聚合面。
   “前往评审聚合入口”跳到 `/review/extracurricular-showcase`，且展示班级变成 `2023启航班`，不承接本课堂。

157. P1：教师工作台报告账本缺少节次级交付状态。
   工作台有报告账本文案和导出语义，但没有显示本次课堂是否已导出、已发送或等待补强。

158. P1：报告评分工作台空态缺少真实来源路径。
   空态要求选择已转换提交或评分草稿，却没有从课堂复盘、报告账本或学生提交进入的动作。

159. P1：学生报告反馈后续动作过多且状态不清。
   demo 页呈现大量查看/练习/复习动作，但没有分清教师指派、推荐复习、可选资源和已完成状态。

160. P1：文档评分工作流缺少完成状态播报。
   评分草稿、审批、写回、反馈发送和导出受限都没有可访问 status/live 区域。

161. P1：系统配置保存缺少影响范围、差异摘要和完成状态。
   保存/测试入口存在，但没有展示变更 diff、影响 AI 路由、最近保存结果和测试完成状态。

162. P1：用户批量导入仍缺完整批次状态机。
   模板下载可用，但导入预览、失败行导出、通知、撤销/回滚和批次审计仍不可见。

163. P1：数据治理风险清单仍是只读列表。
   170 个待处理风险、stale 数据和风险表都没有查看证据、分派、标记处理、创建待办或导出动作。

164. P2：管理员移动端缺少固定关键操作与状态回显。
   配置页移动端很长，保存/测试/重置动作没有稳定操作区，也没有可访问完成播报。

165. P1：跨角色访问被静默重定向。
   学生、教师和管理员访问非本角色工作台时最终落到 `/`、`/dashboard` 或 `/admin`，没有解释目标路径为何不可进入。

166. P1：权限边界缺少可审计状态。
   拦截后最终页面都是 200 的正常页面，界面上无法区分正常访问和权限回落。

167. P1：用户菜单缺少菜单语义和受控焦点。
   账户菜单不是 `role=menu`，Tab 会从菜单项直接进入背景学习入口。

168. P1：修改密码弹窗缺少 dialog 语义和焦点隔离。
   弹窗没有 `role=dialog` / `aria-modal`，空提交后 Tab 继续进入背景页面。

169. P1：改密错误缺少可访问播报。
   “请输入当前密码与新密码”没有 `role=alert`、`role=status` 或 `aria-live`。

170. P1：全局浮动工具菜单缺少弹出层语义和焦点边界。
   工具面板承担主题和 AI 入口，但 Tab 会进入 `body`、背景导航、用户菜单和业务入口。

171. P2：主题切换缺少完成播报。
   `light` 到 `dark` 的状态变化可见，但没有 status/live 告知读屏和键盘用户。

172. P1：AI 侧栏缺少区域语义和焦点 containment。
   侧栏打开后没有 dialog/complementary 语义，Tab 会离开侧栏进入背景页面。

173. P1：AI 侧栏关闭后的焦点恢复不稳定。
   Escape 关闭后第一个 Tab 落到 `body`，没有回到触发 AI 的浮动工具按钮。

174. P1：移动端主工作台没有统一可发现的导航入口。
   学生和教师移动端均未找到“打开平台导航/导航”抽屉按钮，实际仍是长页加横向导航。

175. P1：移动端全局 AI 先于页面主任务进入键盘路径。
   学生和教师移动端首个 Tab 都进入全局 AI 输入框，随后才到浮动工具、导航和业务内容。

176. P2：移动端全局浮层仍会压住内容卡片。
   学生移动端截图显示控灵和黑色浮动按钮贴近并覆盖卡片区域，长页避让不足。

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

189. P1：任务卡存在整卡链接与内部按钮重复交互目标。
   DOM 首批控件同时出现整张任务卡链接和内部“再次挑战/开始挑战”按钮，键盘路径重复且冗长。

190. P1：任务筛选缺少结果变化播报。
   切换“可挑战/已完成”后没有 `role=status`/`aria-live` 告知当前筛选和结果数量。

191. P1：学习路径 query 上下文被忽略。
   `/missions?project=goal` 与默认 `/missions` 完全一致，没有说明目标、来源或推荐原因。

192. P1：任务启动后缺少任务上下文继承。
   `/simulations/destroyer?mission=...` 保留 id，但仿真页不展示任务大厅标题、目标、完成标准或回写说明。

193. P1：任务标题与仿真内任务选择不一致。
   从“海况挑战：大浪”进入后，仿真面板仍显示“直角转向任务”。

194. P1：任务完成回写路径不清。
   仿真页没有说明成绩、证据和任务大厅进度之间的保存关系。

195. P2：移动端任务卡过长且浮层贴近主操作。
   移动首屏中底部浮层靠近第一张任务卡“再次挑战”，长卡让开始动作重复下沉。

196. P1：课堂作品空态动作过于泛化。
   “进入互动课程”落到课程总入口，没有连接具体可产出课堂作品的课堂或提交动作。

197. P1：仿真设计空态动作没有保存回流合同。
   “开始仿真”落到通用 `/simulations/destroyer`，没有作品集来源、收录条件或返回档案提示。

198. P1：伦理整改空态动作与“整改记录”语义不一致。
   “了解工程伦理”落到伦理决策沙盘，但没有进入整改记录、违规复盘或保存回作品集流程。

199. P1：作品集空态没有说明收录规则。
   课堂作品、仿真设计、伦理整改和提示词设计都没有说明什么记录会进入档案、阈值是什么、为什么当前为空。

200. P2：作品集移动端标签缺少稳定 tab 语义。
   标签换行成普通按钮组，缺少 tablist/selected 语义，扫描当前标签和后续动作的成本偏高。

201. P1：学生访问数据中心被静默改道。
   `/data-center` 默认落到 `/profile/evidence`，`returnTo=/dashboard` 落到 `/dashboard`，但没有解释教师/管理员数据中心的权限边界。

202. P1：数据中心演示数据与正式工作区边界不足。
   页面在正式平台壳层内展示“演示场景生成的示例数据”，但缺少真实数据切换、数据不可用状态或更强的演示隔离标识。

203. P1：教师数据中心治理动作落点过于泛化。
   “进入治理复核”落到 `/teacher` 首页，而非具体数据治理、来源口径或复核任务页。

204. P1：数据中心导出按钮被全局浮层干扰。
   真实点击“导出演示快照”时右下控灵浮层截获指针事件，下载没有触发。

205. P1：数据中心导出缺少完成状态播报。
   无论下载是否触发，页面都没有 `role=status`、`aria-live` 或可见完成/失败提示。

206. P1：教师学生详情刷新缺少完成状态。
   点击“刷新数据”后仍保持原页面，但没有刷新中、完成、更新时间或错误恢复反馈。

207. P1：教师侧学生证据页仍缺审核处置闭环。
   证据卡显示“缺少官方 Arena 结果”，但没有确认、请求补证、标记已处理、生成干预或关闭动作。

208. P1：跨角色访问教师遗留路由被静默改道。
   学生访问 `/teacher/students/{studentId}/diagnosis` 最终落到 `/dashboard`，但没有权限说明。

209. P2：移动端数据中心长页缺少章节锚点。
   教师需要纵向滚动大量图表才能到达导出区，主命令与浮层靠得过近。

210. P2：移动端教师证据页筛选区优先级过高。
     筛选栏占据首屏左侧/上方主要空间，证据卡和处置动作被推后。

211. P1：知识节点深链无法解析到节点详情。
     `/knowledge?node=Bode图_1_1` 返回 200，但页面显示“节点未解析”，无法从外部入口稳定定位知识点。
     2026-06-22 / #618：知识图谱深链同时支持 `node` 与 `nodeId` 参数，选中节点后打开检查器并保留资源/关系后续动作。

212. P1：公开课程流开始上课静默落到首页。
     `/playlists/{id}/play` 最终为 `/`，用户丢失课程流上下文和失败原因。
     2026-06-22 / #618：播放列表 play 路由改为课程流启动页，展示 playlistId 对应标题、描述、环节数和开始上课动作，不再静默跳首页。

213. P1：课程流构建器保存后丢失已添加知识点。
     添加知识点并保存后，列表卡片显示 `0 个环节`，API 创建时也没有写入 items。
     2026-06-22 / #618：`POST /api/knowledge/playlists` 校验知识节点并创建 KNOWLEDGE_NODE `LessonItem`；新增 API 测试覆盖已选节点写入。

214. P1：新建课程流默认渲染规模过大。
     默认加载完整知识库，DOM/a11y 快照记录 821 个无名按钮，full-page 截图高度超过 60,000px。
     2026-06-22 / #618：课程流构建器默认显示 40 个知识节点并提供加载更多，显示已选数量，添加按钮具备可访问名称且已选节点禁用重复添加。

215. P1：课程流保存校验使用原生 alert。
     空标题只弹出浏览器 alert `请输入标题`，没有字段级错误、状态区或焦点恢复。

216. P1：课程流图标按钮缺少可访问名称。
     添加、上移、下移、删除等关键按钮大量显示为无名控件。

217. P2：知识图谱布局工具可访问命名不稳定。
     视觉工具为“视图”，脚本按布局语义找不到按钮，说明工具命名与任务语义不一致。

218. P2：移动端知识图谱筛选抽屉信息密度过高。
     关系类型、分类、认知层级和阈值堆在一个窄面板，主图谱状态和后续动作被推后。

219. P2：移动端课程流构建器缺少分步结构。
     完整知识库和课程编排直接堆叠，手机截图高度超过 61,000px，用户难以完成选择、编排和保存。

220. P1：仿真命令甲板 `bottom-tools` 合同存在但不可见。
     Cruise、Destroyer、Drilling 均有 `data-task-workspace-zone="bottom-tools"`，但实际 `visibleBottomTools=false`。

221. P1：移动端仿真场景工具被全局浮层干扰。
     Cruise 移动端中控灵浮层覆盖场景区域，底部相机/网格/速度工具与浮层冲突。

222. P1：Arena 黑箱工作台表单在仿真页右侧被挤压。
     Cruise Arena 任务入口的右侧字段标签出现竖排单字列，影响填写和理解。

223. P2：仿真目录筛选结果缺少状态播报。
     搜索和筛选后结果数变化可见，但没有 `role=status` 或 `aria-live`。

224. P2：仿真目录空态缺少恢复动作。
     空搜索只显示无匹配文案，没有清空搜索或重置筛选按钮。

225. P2：`/virtual-lab` 重定向缺少兼容说明。
     旧入口最终落到 `/simulations`，页面没有解释入口合并或新旧路径关系。

226. P2：移动端仿真目录过长且浮层覆盖视图切换区。
     移动端默认目录高 3809px，控灵浮层压住目录视图切换和结果摘要区域。

227. P1：默认学习路径落地页显示进度但最新路径为空。
     latest path API 对控制校正和频率响应目标均返回 `path:null`，但默认页仍显示当前节点、24% 本周完成和路径顾问准备中。

228. P1：学习者状态 503 与路径顾问 403 没有进入生成面板。
     `/api/adaptive/learner-state` 返回 `LEARNER_STATE_SERVICE_DISABLED`，路径顾问上下文返回账号缺少班级信息，但生成表单仍显示可提交主动作。

229. P1：`evidence-review` 意图在空路径下没有形成证据回看视图。
     页面识别 `workspaceIntent=evidence-review`，但真实空路径下 `evidenceSurface=false`，只显示选择历史。

230. P1：`path-selection` 在真实 `path:null` 下仍展示 3 条可比较路径。
     空路径真实会话仍展示 3 条方案和选择/调整/解释差异等动作，容易被误解为已经生成了可执行路径。

231. P1：`path-execution` 无活动路径时降级为练习资源入口。
     无路线、无节点、无证据记录时仍显示“路径资源入口”和“检查节点练习已准备”，没有解释当前没有活动路径。

232. P2：无显式 goal 的生成入口缺少目标选择上下文。
     `/assessment/adaptive-practice?intent=contextual-recommendation` 打开生成面板，但 `controlCorrectionGoal` 为空，目标绑定不清。

233. P2：移动端学习路径页仍被全局控灵浮层干扰。
     移动生成页和演示选择页中，控灵浮层贴近或压住当前建议、路径方案和主动作区域。

234. P2：学习路径关键状态变化缺少 live/status 播报。
     17 个截图的 DOM 摘要均为 `alerts=0`，练习展开、生成参数、选择/执行/证据视图切换都没有状态播报。

235. P1：浮动工具展开面板缺少弹出层语义。
     学生、教师、管理员、知识图谱和移动管理页均为 `floatingPanelOpen=true` 但 `floatingPanelRole=""`，触发器有 expanded 状态，面板本体没有菜单、对话框或区域语义。

236. P1：Global AI 侧栏缺少区域语义和焦点 containment。
     桌面和移动侧栏均为 `aiSidebarState=open` 且 `aiSidebarRole=""`，焦点可从关闭按钮、AI 输入框跳到浮动工具和页面正文。

237. P1：移动端学习路径浮动面板遮挡当前建议和路径摘要。
     `13-mobile-adaptive-path-floating-dock-open.png` 显示面板覆盖当前建议卡，且 DOM 中 `adaptiveDockPolicy=""`，页面级避让策略未接入。

238. P2：主题切换缺少当前模式和完成播报。
     学生、教师、管理员桌面和移动管理页均可切换主题，但 `alerts=0`，切换后没有当前模式或完成状态播报。

239. P2：全局 AI 输入框在关闭态过早进入 Tab 顺序。
     多个页面的第一项焦点是“全局 AI 问题输入框”，即使 `aiSidebarState=closed`，主任务焦点被关闭态 AI 控件抢先。

240. P2：移动 Arena 抽屉语义正确，但全局浮动入口仍在底部竞争。
     抽屉具备 `role=dialog` 和 `aria-modal=true`，焦点也留在抽屉内；但底部命中点仍能看到全局浮动入口，与抽屉和筛选区竞争。

241. P2：管理员和教师遗留壳层缺少 routeFrame 与导航策略标记。
     `/teacher`、`/admin/data-governance` 和 `/admin/users` 的 routeFrame、desktopNavigation、mobileNavigation 为空，但全局浮动工具仍启用，无法统一应用 safe-area 和可访问性策略。

242. P2：跨壳层状态变化仍缺少 live/status。
     17 个截图的 `alerts=0`，抽屉、浮动面板、AI 侧栏、主题切换和治理刷新上下文均缺少统一状态播报。

243. P2：管理员用户移动页存在横向溢出。
     `/admin/users` 两张移动 full-page PNG 在 390px viewport 下导出为 945px 宽，说明页面或表格撑宽文档，浮动工具也会相对溢出宽度定位。

244. P1：Global AI 回答把服务器上下文 JSON 直接暴露给用户。
     知识图谱和管理员治理页回答首屏可见 `pageContext`、`knowledgeWorkspace`、`knowledgeCapabilityContext`、`null`、路径对象和数组；这类系统上下文应作为模型输入或日志，而不应出现在用户回答正文。

245. P1：引用核验低置信提示作为回答首段直接展示。
     Dashboard、知识图谱、管理员治理和移动 Dashboard 的 `/api/ai/chat` 均返回 200，但回答开头是“控灵证据提示”和缺失引用类别，学生看到的是内部诊断而非任务建议。

246. P1：自适应路径页 AI 入口被阻塞且无原因说明。
     `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation` 的 AI 打开动作超时，侧栏保持关闭；页面依赖控灵解释路径建议，却没有可读的前置条件或 disabled reason。

247. P2：AI 发送按钮没有可访问名称。
     12 个 AI 状态的 `sendButtonName` 均为空；图标按钮缺 `aria-label` 或 sr-only 文本，读屏用户无法识别发送动作。

248. P2：AI 加载、完成和降级状态没有 live/status 播报。
     本批 12 个截图全部 `alerts=0`；发送、加载、完成、低置信、节点未解析、清空失败和管理员长时间等待均没有可读状态。

249. P2：“清空对话”动作可见但不能完成。
     Dashboard 完成态出现清空按钮，但点击被页面 body 截获并超时；截图仍显示 2 条消息，没有恢复欢迎态。

250. P2：AI 面板焦点仍会泄漏到页面正文和浮动工具。
     桌面和移动 Dashboard 的焦点轨迹显示关闭按钮、输入框之后进入浮动工具、body、导航或主题按钮，真实对话状态仍未形成稳定焦点边界。

251. P2：快捷问题标题存在但问题列表为空。
     Dashboard、知识图谱和移动状态均显示“你可以问我:”，但 `quickQuestions=[]`，用户看到标题却没有可点问题。

252. P2：管理员治理 AI 长时间 loading 时仍暴露调试上下文。
     管理员治理页 16 秒后仍 `hasLoading=true`，同时已显示原始上下文、低置信提示和“控灵正在思考...”，缺少 timeout、重试、取消和治理任务化摘要。

253. P2：移动端 AI 首屏被内部警告占据，任务层级不清。
     `11-mobile-dashboard-ai-response-or-error.png` 中首屏主要是引用核验警告，真正学习建议被推到后面，页面正文仍在下方可见，面板与主任务层级不清。

## 5. 下一批审计队列

### A. 登录态学生主链路

1. 已捕获 `/dashboard`、`/interactive-learning`、`/interactive-learning/courses`、`/assessment/adaptive-practice`、`/review`。
2. 已捕获 `/profile`、`/profile/evidence`、`/profile/growth`、`/profile/portfolio`。
3. 第十三批已补 `/dashboard`、课程目录、仿真、Arena 挑战、知识图谱、个人证据和个人中心的移动状态；第十四批已补自适应学习路径动作态和成长中心下一步建议；第十五批已补自适应练习提交结果；第十六批已补课程入口课堂码错误和学生课程运行态主操作；第十七批已补真实课堂码从扫码入口和课程入口进入 active session；第十八批已补真实课堂发放作答、学生提交、结束后入口和证据回流；第二十批已补学生证据默认列表、课堂作答筛选、复盘课堂作答动作和课次过滤空态；第二十八批已补证据详情页、题目级复盘落点和补练生成路径，确认复盘仍回到列表、补练未继承证据上下文；第三十四批补学生跨角色访问、账户菜单、改密弹窗、退出登录、全局工具、AI 侧栏和移动端壳层焦点；第三十五批补作品集提示词/反思入口、AI 工坊、Copilot 和 Prompt 评估，确认作品集提示词动作落 404、反思不保留上下文、Prompt demo 历史边界不清；第三十六批补 `/missions` 筛选/启动目标、学习路径 query 上下文、作品集课堂作品/仿真设计/伦理整改空态动作和移动端作品集状态，确认任务启动与作品集收录回流仍未闭环；第三十七批补学生访问 `/data-center` 默认、内部 returnTo 和外部 returnTo 状态，确认数据中心权限边界仍是静默改道；第三十八批补 `/knowledge` 深链/筛选、`/playlists` 列表、`/playlists/new` 创建和 `/playlists/[id]/play` 开始上课，确认播放列表与课程流保存主链路仍未闭环；第四十批补 `/assessment/adaptive-practice` 的 landing/practice/generation/selection/execution/evidence-review 和移动状态，确认真实空路径、服务不可用和账号缺班级状态仍未被 UI 清晰表达；第四十一批补学生 dashboard、知识图谱、移动 Arena、移动学习路径和全局 AI/浮动工具状态，确认关闭态 AI 输入框过早进 Tab 顺序、浮动工具面板缺语义、AI 侧栏缺焦点 containment、移动学习路径避让策略缺失，且管理员用户移动页存在横向溢出；第四十二批补学生 dashboard、知识图谱降级节点、自适应路径 AI 入口和移动 Dashboard 的真实 AI 对话，确认回答暴露内部上下文、引用核验提示占据首屏、路径页 AI 入口阻塞、发送按钮无名和 AI 状态缺少播报；第四十三批补学生文档反馈交付状态，确认反馈页后续动作多但缺导出、提交边界、已读/采用状态和 demo 边界；第四十四批补学生坏资源/坏课程/坏仿真/坏 Arena/坏播放列表/坏证据筛选/坏学习路径上下文，确认默认 404、raw id 空态和坏路径参数被忽略仍未治理；第四十五批补任务大厅和证据页列表搜索状态，确认学生任务/证据仍缺关键词搜索和结果播报；第四十六批补课堂码空提交、短码和无效六位码，确认失败分支仍无可见错误和状态播报；第四十七批补自适应练习完成态、提示词评价、证据后续动作和移动证据状态，确认练习 URL 与任务不一致、提示词输入被全局 AI 抢占、证据复盘仍停留列表筛选；第四十八批补任务大厅启动、作品集分类/空态动作和移动端状态，确认任务启动不带完成/回写/收录合同，作品集仍缺收录规则和可执行动作；第四十九批补自适应 demo 作答、Prompt autodemo 和学生个人中心下一步，确认 demo 作答缺 durable 完成/写回、真实 latest path 仍为 `path:null`、Prompt 输入被全局 AI 抢占、个人中心下一步不继承补练上下文；第五十批补真实学习路径空态、路径顾问、路径选择、路径执行、证据回看、坏 pathId 和 320px 移动路径执行，确认真实路径服务/API 错误仍没有产品化状态；第五十一批补任务完成态、证据完成筛选、成长建议、作品集课堂作品和移动任务/作品集，确认完成态仍不回流、筛选不生效、建议缺 actionUrl、作品集缺收录状态机。

### B. 课程全链路页面族

1. 已捕获 29 个课程入口桌面/移动首屏，全部 200。
2. 已捕获 29 个学生 `sessionId=demo` 运行态桌面/移动首屏，全部 200。
3. 已捕获 29 个教师等待页与 29 个教师运行态桌面/移动首屏，全部 200。
4. 教师运行态 54/58 张截图含 `Not found`，且日志显示 demo session 仍触发课堂状态和互动事件写入错误；后续修复应优先定位教师投影渲染层与 demo session 持久化边界。
5. 已补真实 session 的教师课堂、学生课堂、教师等待页复制/开课、教师投影二维码工具、发放作答、学生提交、教师汇总、结束课堂与教师复盘入口，拥有者教师账号下均返回 200；第十八批确认已结束 session 仍可呈现直播投影界面，需要单独只读化。

### C. 任务工作区

1. 已捕获 `/simulations/cruise` 与其他 6 个仿真详情，并确认 `/virtual-lab` 重定向 `/simulations`。
2. 已捕获 `/interactive-learning/control-workbench` 桌面/移动。
3. 已捕获 `/arena/challenges/[taskId]` 代表挑战详情桌面/移动，并补从挑战 CTA 进入工作台的官方提交状态；第十三批确认移动端第一视口内可见“进入控制工作台”。
4. 已确认非规范 Arena 查询参数会降级为自由探索；后续需要验证所有实际分享/AI 工具生成的工作台链接是否使用 `arenaTask`。
5. 已补官方评测提交结果、移动端提交态，以及真实教师发布 -> 学生 publicationId 提交 -> 教师报告 after submission 链路。
6. 已补同一学生同一 publication 多次提交、挑战榜单归属、教师报告归属、学生证据回流和截止后报告夹具；当前确认重复提交规则、0 分优秀方案命名、逾期提交口径和证据回流均存在体验缺口。
7. 第十五批已补控制工作台移动端支持工具和官方评测提交结果；第十六批补教师进行中课堂投影移动状态；第十七批补真实投影本页工具展开、二维码弹窗和翻页；第十八批补发放/提交/汇总/结束课堂状态；第二十九批已补 context-header、instrument-area、bottom-tools、floating-dock-safe-area 和已结束课堂只读态，确认 `bottom-tools` 缺失且已结束教师直达页仍呈现直播态；第三十九批补 `/simulations` 目录搜索/筛选/视图、`/virtual-lab` 重定向、Cruise/Destroyer/Drilling 运行态和 Cruise Arena 任务入口，确认仿真 `bottom-tools` 仍隐藏、移动端场景工具被浮层干扰、黑箱工作台表单挤压。

### D. 教师端

1. 已捕获 `/teacher`、班级、教案、资源、ResourceNode、课前包、历史、Arena 配置。
2. 已补 `/teacher/preset-lessons`、教师课堂、教师复盘、班级详情、学生详情、学生证据和教案编辑。
3. 已补教师建班成功、空教案保存、空教案发起课堂、课堂结束、空课堂复盘失败态、有效课堂复盘、班级搜索空态、Arena 发布预览生成、真实 Arena 发布和提交后发布报告状态。
4. 第三十批已标记 `/teacher/prep-packs` 500 阻断，确认当前 dev1 数据库缺 `public.CourseEnhancementPack` 表，直达页、cluster 深链和移动端均无法进入课前包复核；继续评价课前包体验前必须先修复迁移/数据基线。
5. 第十四批已补教师课堂历史移动空态、班级搜索空态和班级分析移动长页；第十五批已补班级加入码区域和教师资源空搜索；第十六批已补教师历史统计阻断页和进行中课堂投影页；第十七批已补真实等待页复制课堂码/加入链接、开课、投影二维码和翻页；第十八批已补真实课堂发放作答、学生提交汇总、参考答案、结束课堂和结束后返回路径；第二十批已补教师历史搜索、归档编辑、删除确认取消、有效课后复盘、内部评审出口、返回班级详情和未归档复盘阻断；第二十一批已补班级学生清单、添加学生搜索/导入、移除学生确认、个体学情和教师侧学生证据；第二十二批已补教案列表、新建/编辑编排器、教案删除确认、资源编辑、知识节点预览和资源移动端状态；第二十三批已补直发课堂、课程专属教师投影、二维码、在线学生、翻页、结束确认、历史和复盘阻断；第二十四批已补班级绑定课堂、双学生加入、发放作答、并发提交、教师汇总、结束课堂、学生证据和教师复盘；第二十五批已补课后复盘深层动作、报告导出/发送入口、教师报告账本和报告评分工作台；第二十六批已补 Arena 正式发布、榜单和报告；第三十三批复核真实课后复盘交付、报告账本、评分工作台和学生文档反馈，确认报告交付状态仍未闭环；第三十四批补教师跨角色访问和教师移动端壳层导航/焦点路径；第四十一批补教师工作台浮动工具展开和 Tab 顺序，确认遗留壳层缺 routeFrame 标记且浮动面板无语义；第四十三批补教师复盘交付、首页/班级分析报告账本、Arena 发布报告和数据中心导出状态，确认复盘仍缺真实交付动作、账本状态不可执行、数据中心导出被浮层阻断；第四十四批补教师坏班级/坏分析/坏学生/坏教案/坏发布报告/坏课堂复盘，确认默认 404 和泛化失败状态缺恢复路径；第四十五批补教师班级、教案、资源、历史列表搜索和移动资源状态，确认教案长列表缺搜索分页、资源移动端过长、空态缺播报；第四十六批补真实班级成员动作，确认添加/导入/移除入口不稳定；第四十七批补教师历史、FINISHED 课堂复盘、班级分析、数据中心导出和移动复盘，确认报告交付、补强行动和导出状态仍未闭环；第四十八批补报告评分工作台空态、坏评分运行标识、文档评分/写回 API、班级报告 API 和移动评分工作台，确认工作台缺真实来源路径、坏 run 恢复跳首页、报告 API 可用但 UI 未承接交付状态；第四十九批补教师首页、班级详情、班级分析、控制校正报告 API、助手效果报告 API 和真实班级课前包，确认报告/证据入口落泛化班级列表、分析动作不承接补强、控制报告仍是 raw JSON、助手效果报告 404、课前包桌面/移动 500；第五十批补分析旧入口/V2 report surface、学生证据落点、评分工作台来源态和移动报告/证据状态，确认报告账本仍不能进入交付、证据处理或评分草稿；第五十一批补教师首页/班级详情交付、学生画像推荐、学生证据审核、评分工作台 ready 来源和课前包，确认报告交付仍停留列表/长页、推荐不创建补强任务、证据审核只有停留动作、评分 API 与工作台断开、课前包继续 500；第五十二批补预置教案、教案列表/新建、资源搜索和 ResourceNode 管理，确认模板克隆无反馈、教案缺稳定搜索/编辑入口、新建动作丢失首页、ResourceNode 默认长页和计数口径不一致；第五十三批补真实教案编辑器直达、缺失模板和 ResourceNode 阻断筛选，确认编辑动作仍可丢到首页、缺失模板无产品错误、阻断筛选不缩小任务队列；后续教师端重点转为报告交付、榜单口径、已截止状态、错误恢复、长列表治理、成员治理、评分草稿来源和全局壳层修复后的回归审计。

### E. 管理员端

1. 已捕获 `/admin`、用户、统计、数据治理、系统配置、管理员教案。
2. 已补管理员新建/编辑教案、用户搜索、用户详情、新建账号弹窗、真实创建教师、删除已创建教师、改密弹窗、删除确认、关联数据教师删除影响、批量导入无效文件、有效 Excel 导入、导入后治理动作缺口、系统配置保存、添加模型校验、添加供应商状态、首个 AI 模型测试完成态、loading 态和失败态。
3. 有效导入后的通知/撤销链路、关联数据账号删除影响范围均已确认缺失治理动作。
4. 第十四批已补管理员用户移动搜索空态、数据治理移动状态和统计移动图表；第十五批已补新建账号模态、批量导入 file chooser、配置保存和添加模型校验；第十六批已补数据治理加载完成、刷新状态和后台总览；第十七批已补模板下载、数据治理课堂质量/证据源/缓存健康标签页和桌面总览；第十九批已补数据治理真实标签页、刷新和批量导入畸形/缺列/混合/重复更新/搜索回查；第二十七批已补总览、异常、风险处置缺口、用户批次和配置调整状态；第三十一批复核确认风险处置、数据导出、批量导入预览/通知/撤销/批次审计、配置保存影响反馈和移动端固定关键动作仍未闭环；第三十三批复核系统配置、用户批量导入、数据治理风险行和移动配置操作区，确认批次状态、处置动作、保存影响和 status/live 仍未闭环；第三十四批补管理员跨角色访问边界；第四十一批补管理员数据治理桌面和用户管理移动壳层，确认遗留壳层缺 routeFrame 标记、浮动面板无语义、移动右下区域仍被浮层竞争，且用户管理移动页存在横向溢出；第四十二批补管理员数据治理 AI 真实提问，确认长时间 loading 时仍暴露原始上下文、低置信提示和路径对象；第四十三批补用户模板下载、数据治理导出/处置、系统配置保存和移动用户导入状态，确认模板下载成功但缺状态机、170 个风险仍缺处置闭环、配置保存缺影响审计、移动用户页仍横向溢出；第四十四批补管理员坏教案和用户无匹配搜索 API，确认默认 404 缺恢复动作且 q 无匹配仍返回全量用户；第四十五批补管理员用户和教案列表状态，确认用户搜索 API/总览/列表口径不一致、角色筛选语义不稳定、移动默认页仍横向溢出、管理员教案长列表缺搜索分页；第四十六批补新建账号、模板下载、批量导入、配置保存和数据治理加载，确认对象错误渲染、导入状态机缺失、桌面治理加载阻断和移动治理横向溢出；第四十七批补管理员总览、治理风险清单、处置/导出/撤销探测和移动治理动作，确认风险清单仍不可处置、总览动作无反馈、移动治理继续横向溢出；第四十八批补用户模板下载、批量导入入口、无匹配搜索、角色筛选和移动用户管理状态，确认模板下载真实可用、无匹配搜索 API 已返回 `total:0`，但批量导入仍无 file chooser/预览/批次状态，移动用户页仍 945px 横向布局；第四十九批补管理员治理风险页、状态页、数据中心导出/治理动作和移动治理/数据中心，确认 170 个治理风险仍不可处置、数据中心导出无 download event、治理入口命中隐藏文本、移动治理仍约 568px 宽；第五十批补管理员首页风险动作、治理风险/质量标签、状态页、数据中心 returnTo 和 320px 移动治理/数据中心，确认 query 与动作仍不进入风险处置，320px 治理实际宽 568px；第五十一批补用户模板下载/批量导入/无匹配搜索、系统配置、治理处置 query、教案搜索和移动用户/配置/治理，确认 no-match URL 初始态、页面可见搜索和 API 结果口径不一致、批量导入无 file chooser、配置缺影响审计、治理处置 query 不闭环、教案缺搜索空态、移动用户 945px 与治理 568px 溢出；第五十二批补教师/管理员教案、新建教案、资源治理、ResourceNode、治理 authoring surface 和学生课程流，确认作者态搜索编辑闭环、质量报告、移动长列表和课程流创建仍未闭环；第五十三批补管理员编辑器直达、缺失教案和缺失 authoring 对象，确认编辑器 h1 为空、动作回长列表、缺失对象落 404 或通用治理加载；后续管理员端重点转为这些动作补齐后的回归审计。

### F. 内部 review 与辅助页面

1. 已捕获 `/review` 及 8 个 review 子页面。
2. 标记为内部审查面，不纳入学生/教师主体验评分，但检查是否存在误暴露入口或无法理解的状态。
3. 已发现 review 子页移动端公式裁剪问题，不能直接把 review 页视为移动验收通过证据；第三十二批进一步确认 `/review/adaptive-assessment-figures` 移动端嵌入截图被裁剪且浮层重叠，仍只能作为内部审查面。
4. 第三十五批补 `/ai`、`/ai/copilot`、`/evaluation/prompt-assessment` 与作品集 AI 入口；第三十六批补作品集课堂作品/仿真设计/伦理整改空态动作和 Prompt 档案回查；第三十七批补数据中心导出按钮被全局浮层截获的真实点击证据；第三十八批补知识图谱控灵上下文在节点深链失败时显示“节点未解析”；第四十二批补 Global AI 真实流式回答，确认上下文 JSON 和 citation guard 内部诊断进入用户可见文本；第四十三批补学生文档反馈和报告交付状态，确认反馈页生命周期仍不清；第四十七批补提示词评价桌面/移动状态，确认页面结构化输入会被全局 AI 抢占，评价完成缺 status/live；第四十九批复核 Prompt autodemo，确认主输入仍会命中全局 AI；后续辅助页重点转为 AI 内部诊断外泄、Prompt 历史真实/demo 边界、作品集保存回流、知识节点上下文解析和 AI 浮层焦点治理。

### G. 可访问性与键盘路径

1. 已补 `/login` 移动端键盘焦点抽查，账号输入框焦点环可见。
2. 已补注册短密码当前错误态、管理员弹窗 Escape/focus trap、导入上传控件语义、课堂加入错误态、课堂加入无反馈态、课程入口课堂码错误态、真实课堂加入、教师等待页复制、教师投影二维码复制、真实课堂发放/提交/汇总/结束、模板下载、数据治理标签页、Arena 工作台、工作台提交结果、自适应练习提交结果、教师复盘页、管理员统计页、数据治理看板、学生成长页、教师班级分析页、学生移动筛选/空态、教师移动空态、管理员移动表格/图表/模态、个人证据页、教师添加学生弹窗、班级学生导入、教师个体学情、教师侧学生证据页、教案编排器、资源管理、知识节点列表、教师直发课堂运行态，以及第三十二批跨角色 Tab 焦点路径、register runtime error、课堂码错误 alert/live、教师弹窗 dialog/focus trap、管理员刷新/下载和 review 移动页结构化抽查；第三十三批补课后复盘报告交付、评分工作台、学生报告反馈、系统配置、用户批量导入和数据治理风险行的 status/live 与移动操作区抽查；第三十四批补跨角色权限边界、用户菜单、改密弹窗、全局浮动工具、主题切换、AI 侧栏、Escape 焦点恢复和移动壳层焦点路径；第三十五批补 AI 工坊、Copilot、Prompt 评价/校验/演示生成和作品集 AI 入口的 status/live、焦点路径和移动浮层抽查；第三十六批补任务大厅筛选、任务启动、作品集标签/空态动作和移动作品集的 status/live 与语义抽查；第三十七批补数据中心导出按钮、学生详情刷新、学生数据中心改道和教师遗留路由改道的状态语义；第三十八批补知识图谱筛选/布局工具、播放列表开始上课、课程流空标题 alert、加号/上移/下移/删除无名按钮和移动端超长课程流；第三十九批补仿真目录筛选状态、课程设计弹窗、空搜索、虚拟实验室重定向、仿真 bottom-tools、Arena 黑箱表单和移动端场景工具；第四十批补学习路径 latest path API、生成面板、选择/执行/证据 intent、练习展开和移动端路径页状态；第四十一批补全局浮动工具、AI 侧栏、主题切换、移动抽屉、教师/管理员遗留壳层和移动避让策略；第四十二批补 Global AI 真实发送、loading、完成、清空、降级、移动首屏和管理员长请求状态；第四十三批补报告导出、模板下载、数据治理、系统配置和移动交付状态；第四十四批补失效路由、坏 ID、错误恢复和移动错误页状态；第四十五批补跨角色列表搜索、筛选、分页、无匹配和移动宽度状态；第四十六批补表单校验、下载导入、配置保存、治理加载和移动治理状态；第四十七批补学习完成态、提示词评价、证据复盘、报告交付、导出下载、治理处置和移动完成态；第四十八批补任务启动、作品集分类、评分工作台、坏 run、模板下载、导入入口、用户搜索和移动用户页状态；第四十九批补自适应 demo 作答、Prompt autodemo、学生个人中心下一步、教师报告/分析/课前包、管理员治理/数据中心和移动状态；第五十批补真实路径错误/空态、报告账本来源态、治理 query/returnTo、320px 移动宽度和全批 status/live；第五十一批补完成态、批量导入、报告交付、配置变更、治理处置和移动管理页状态；第五十二批补备课、教案、资源、治理 authoring、课程目录和课程流创建状态；第五十三批补编辑器深链、缺失对象、播放入口、节点直达和移动直达态；第五十四批补报告反馈、Prompt/AI/Copilot、作品集反思、报告账本、评分工作台、数据中心交接、治理分派、配置审计和移动后置动作；第五十五批补报告反馈目标页、Prompt/AI/作品集创建、教师参数化报告/评分、管理员参数化治理/配置和移动目标页；第五十六批补学习证据/API、管理员搜索口径、评分方法边界、教师报告动作、治理导出、配置 provider 和移动恢复状态；第五十七批补报告反馈目标、证据筛选、教师报告导出/补强、评分方法边界、管理员角色筛选/分页、治理导出/恢复、配置模型测试和移动搜索筛选状态；第五十八批补反馈采用/写回、任务与作品集回流、报告下载/发送、评分审批、班级学生 no-match、用户重置/导出、治理分派/导出和配置缺失模型测试状态；当前确认表单错误播报、图表替代文本、筛选结果播报、刷新/导出/下载状态播报、提交完成播报、标签切换播报、课堂结束状态播报、任务筛选结果播报、权限改道说明、弹窗焦点隔离、拖拽等价操作、报告交付状态、评分写回状态、批次导入状态、配置保存状态、教师投影关键控件 role 查询、全局工具浮层读屏顺序、AI 侧栏焦点 containment、AI 回答引用核验播报、AI 发送按钮名称、AI 加载/完成/清空失败播报、Prompt 异步完成播报、作品集标签语义、课程流图标按钮命名、仿真筛选结果播报、列表搜索/筛选结果播报、表单校验和下载导入状态播报、仿真底部工具可见性、移动端主任务焦点顺序、评分工作台状态播报、作品集收录状态播报、学习路径错误恢复、治理处置状态和移动治理横向布局均未闭环。

## 6. 当前证据限制

- 截图只能证明可见布局、视觉层级和明显交互入口，不能证明键盘可达性、读屏标签、表单校验、登录后数据正确性或 API 权限。
- 当前完成 205 个 App Router 页面模板级截图覆盖，并已补五十九批功能状态流；审计已收口，但截图覆盖不等于问题已修复。
- 当前已补三十八批功能状态流；新增确认知识节点深链无法解析、播放列表开始上课静默落首页、课程流保存丢失 items、课程流默认 820 节点超长渲染、课程流图标按钮缺少可访问名称、移动端课程流缺少分步结构。
- 当前已补三十九批功能状态流；新增确认仿真运行态 `bottom-tools` 合同隐藏、移动端仿真工具被全局浮层干扰、Arena 黑箱表单被挤压、仿真目录筛选缺状态播报、空态缺恢复动作、`/virtual-lab` 重定向缺兼容说明。
- 当前已补四十批功能状态流；新增确认学习路径 latest path 为空时默认页仍显示进度、学习者状态 503 与路径顾问 403 未进入生成面板、evidence-review/selection/execution 空路径状态错位、无 goal 生成上下文不稳、移动端浮层干扰和学习路径状态缺少 live/status。
- 当前已补四十一批功能状态流；新增确认浮动工具展开面板缺少弹出层语义、Global AI 侧栏缺少区域语义和焦点 containment、移动端学习路径浮层遮挡当前建议、主题切换缺播报、关闭态 AI 输入框过早进入 Tab 顺序、移动抽屉与全局浮动入口竞争、教师/管理员遗留壳层缺 routeFrame 标记、跨壳层状态缺少 live/status 和管理员用户移动页横向溢出。
- 当前已补四十二批功能状态流；新增确认 Global AI 回答暴露服务器上下文 JSON、引用核验低置信提示直接占据回答首段、自适应路径 AI 入口阻塞、AI 发送按钮无名、AI 加载/完成/降级缺少 live/status、清空对话不能完成、管理员治理 AI 长时间 loading 且暴露调试上下文、移动端 AI 首屏层级不清。
- 当前已补四十三批功能状态流；新增确认教师课堂复盘缺真实报告交付动作、复盘外链丢失课堂/班级上下文、数据中心快照导出被浮动工具阻断、管理员治理 170 个活跃风险缺导出和处置闭环、模板下载成功但批量导入状态机缺失、班级分析报告账本埋藏过深、Arena 发布报告缺交付命令、学生文档反馈状态不清、系统配置保存缺影响审计、移动教师复盘缺固定交付动作区、移动管理员用户页仍横向溢出。
- 当前已补四十四批功能状态流；新增确认多数坏 ID 页面落默认 Next 404 且缺恢复动作、错误页全局 AI/浮动工具成为仅有操作入口、教师坏分析/坏学生路由返回 200 但只给泛化失败、学习路径坏 pathId/nodeId 被忽略、管理员用户无匹配搜索 API 返回全量用户、互动资源坏 ID 空态过弱、学生证据坏课次筛选暴露 raw id、移动错误页缺恢复动作、全部失效状态缺 live/status、API 与 UI 错误语义未对齐。
- 当前已补四十五批功能状态流；新增确认管理员用户无匹配搜索 API/总览/列表口径不一致、教师/管理员教案长列表缺搜索/分页/无匹配状态、学生任务和证据缺关键词搜索、教师班级/资源/历史空态缺 live/status、教师资源移动端默认列表过长、教师上课历史列表过长、管理员角色筛选语义不稳定、移动管理员用户默认页仍横向溢出、跨列表状态变化普遍缺少 live/status。
- 当前已补四十六批功能状态流；新增确认课堂码失败分支无反馈、管理员新建账号空提交渲染 `[object Object]`、桌面数据治理长时间加载、教师班级成员维护动作不稳定、管理员新建账号缺 dialog 语义、模板下载缺完成状态、批量导入无 file chooser 或预览状态、配置保存缺影响审计、模型测试入口命名不稳、移动数据治理横向溢出、动作状态缺 alert/live。
- 当前已补四十七批功能状态流；新增确认自适应练习 URL 与可执行任务不一致、提示词评价输入被全局 AI 抢占、证据复盘仍停留列表筛选、教师历史和课堂复盘缺真实交付、班级分析动作不承接报告或补强、数据中心导出无下载事件、管理员治理风险清单不可处置、管理员总览动作无反馈、移动治理横向溢出、移动完成态缺固定主动作区、完成态缺 alert/live。
- 当前已补四十八批功能状态流；新增确认任务启动不带完成和作品集回写合同、作品集空态缺收录规则、评分工作台空态缺真实来源路径、坏评分运行标识恢复跳首页、报告 API 可用但 UI 未承接交付、管理员批量导入入口无 file chooser/预览、管理员无匹配搜索 API 已改善但缺状态播报、移动用户页仍 945px 横向布局、任务/评分/导入状态缺 alert/live。
- 当前已补四十九批功能状态流；新增确认自适应 demo 作答缺 durable 完成/写回状态、真实 latest path 仍为 `path:null`、Prompt autodemo 输入被全局 AI 抢占、个人中心下一步不继承上下文、教师报告/分析动作不承接交付、控制报告 raw JSON、助手效果报告 404、治理风险不可处置、数据中心导出无下载且治理入口命中隐藏文本、移动治理宽度异常、32 个状态缺 alert/live。
- 当前已补五十批功能状态流；新增确认真实学习路径空态仍伪装成可执行路径、路径顾问缺班级信息未产品化、坏 pathId 被静默吞掉、路径选择不写入真实 pathId、教师分析页不能进入报告交付、报告账本到学生证据/评分工作台缺处理合同、管理员治理 query 与动作不进入风险处置、数据中心 returnTo 与治理入口不闭环、320px 管理员治理仍横向溢出、32 个状态缺 alert/live。
- 第五十一批已补学生任务/证据/成长/作品集、教师报告交付/评分/课前包、管理员导入/配置/治理和移动管理页状态；确认学生完成态不回流、证据完成筛选不生效、成长建议缺行动落点、作品集缺收录状态机、教师报告交付仍停留列表/长页、学生画像推荐不创建补强任务、证据审核只有停留动作、评分 API 与工作台断开、管理员 no-match URL 初始态、页面筛选和 API 结果口径不一致、批量导入无 file chooser、配置缺影响审计、治理处置 query 不闭环、管理员教案缺搜索空态、移动用户 945px 与治理 568px 横向溢出、35 个状态缺 alert/live。
- 第五十二批已补预置教案、教案列表/新建、资源治理、治理 authoring 和课程流创建状态；确认模板克隆无反馈、教案缺稳定搜索/编辑入口、教师新建教案空标题动作丢到首页、资源搜索缺结果播报、ResourceNode 和课程流巨型清单不可操作、治理 authoring surface 不形成质量报告、学生课程目录 query 被忽略、移动备课与资源页超长、31 个状态缺 alert/live。
- 第五十三批已补直达深链、坏对象、播放列表播放、知识节点直达和移动深链状态；确认教师/管理员教案编辑直达动作丢上下文、缺失 templateId 不形成恢复、ResourceNode blocked 过滤仍是超长清单、管理员坏教案编辑只有默认 404、治理 authoring 缺失 lessonPlanId 不形成报告、播放列表直达播放静默改道、知识节点直达缺任务化后置状态、移动端仍依赖超长列表或静默改道、24 个状态缺 alert/live。
- 当前已补五十四批功能状态流；新增确认文档反馈后续动作仍是证据链接集合、Prompt autodemo 与历史 API 口径不一致、AI 工坊任务动作没有形成学习任务状态、Copilot evidence 上下文仍暴露内部对象、作品集 reflection query 与默认空态不一致、教师 report-ledger surface 落泛化班级分析、评分工作台 ready 状态没有打开评分草稿、数据中心 returnTo 没有形成返回或治理交接、治理 assign query 不进入分派处置流、系统配置 focus=audit 没有审计工作区、移动报告/AI/评分/治理状态缺固定主动作、30 个状态缺 alert/live。
- 当前已补五十五批功能状态流；新增确认报告反馈目标页不承接 assignment/criterion、学习证据 API 404、练习目标忽略 intent、资源目标缺写回、Prompt/AI 仍被全局 AI 抢占、Copilot/作品集不创建草稿、教师参数化报告页仍是同一长页且动作跳首页、评分工作台来源无草稿、治理 riskId/export 参数不形成处置或下载、配置参数被吞掉、移动目标页过长、39 个状态缺 alert/live。
- 当前已补五十六批功能状态流；新增确认学习证据 assignment UI 与 API 同时缺目标合同、缺失 assignment 被当普通证据页、自适应 writeback 忽略报告反馈写回、资源 returnTo 不形成回跳、教师报告交付仍是长分析页、缺失学生证据动作跳首页、评分 GET 405 未产品化、管理员 no-match URL/可见搜索/API 口径分裂、治理 CSV 导出无下载事件、缺失 provider 测试参数被忽略、移动端宽表长页、27 个状态缺 alert/live。
- 当前已补五十七批功能状态流；新增确认报告反馈 actionable 目标不形成 adopted/completed、证据 completed assignment API 继续 404、缺失 lesson/sourceEvent 被普通证据页吞掉、自适应 writeback completed 不回写、教师报告导出无下载事件、补强建任务仍停长分析页、评分 GET/POST 方法边界无恢复、管理员 no-match 与角色分页 API 不遵守同一过滤合同、治理 resolve 缺失 riskId 无恢复、治理 JSON 导出无下载事件、配置缺失 provider/model 测试参数被忽略、32 个状态缺 alert/live。
- 当前已补五十八批功能状态流；新增确认报告反馈采用/写回不改变状态、任务大厅不承接反馈任务查询和 returnTo、作品集反馈收录没有候选证据或草稿、教师报告 PDF 下载无事件、发送缺失学生与评分审批会跳公开首页、教师班级学生直达页 404 但 API no-match 返回真实学生、管理员用户重置/导出继续忽略 q、治理分派缺失对象和 XLSX 导出没有闭环、已知 provider 下缺失 model 测试被通用配置页吞掉、33 个状态缺 alert/live。
- 当前已补五十九批功能状态流；新增确认报告反馈仍无状态机、反馈任务纵向链路不承接 assignment/returnTo、教师移动长报告有 API 数据但没有交付闭环、评分审批方法边界未产品化、教师学生证据 deep link 丢失评分上下文、管理员用户 no-match 继续返回真实用户且横向溢出、治理 risk resolve 仍是只读长看板、配置测试和统计导出缺状态反馈、26 个状态缺 alert/live；审计覆盖已收口，后续进入修复。
- 有效导入后的通知/撤销链路、关联数据账号删除影响范围不透明、Arena 多次提交规则不清、逾期提交口径不清、控制工作台 `bottom-tools` 缺失、控制工作台移动端关键动作被长仪表流稀释、浮层避让不足、课程目录搜索无反馈、课堂加入无效码无反馈、扫码/链接加入两步状态不清、课程入口课堂码错误区分不足、真实课堂发放/提交/汇总/结束状态播报不足、学生结束后入口断裂、已结束 session 投影仍像直播课堂且缺少复盘/报告转场、自适应路径动作态不清、自适应练习完成态不清、批量导入缺少可见确认层、导入错误状态不持久、导入成功/更新缺少批次治理、数据治理移动风险表不可读、数据治理缺少处置动作、数据治理缺少导出入口、治理刷新缺少完成播报、用户批量导入缺少预览/失败行导出/通知/撤销/批次审计、用户导入 file input 可访问名称错误、系统配置保存缺少影响范围和完成状态、管理员移动端缺少固定关键治理动作区、注册短密码 runtime error、课堂码错误缺少 alert/live、全局控灵过早进入 Tab 顺序、学生证据复盘焦点顺序不服务证据任务、教师添加学生弹窗缺少 dialog 语义和焦点陷阱、教师班级分析刷新和图表摘要缺少可访问状态、教案编排器搜索空态和拖拽等价操作不足、内部 review 移动页不能替代真实移动验收、教师课后复盘缺导出/发送/补强动作、教师报告账本缺节次级交付状态、报告评分工作台空态缺少真实来源路径、学生报告反馈后续动作状态不清、文档评分工作流缺少完成状态播报、数据治理风险清单仍是只读列表、课前包入口通向阻断页、班级诊断结果缺少就地课前包复核动作、课前包错误态缺少产品级恢复动作、证据 lessonId 与课程 route slug 不一致、证据复盘动作停留在列表过滤、错题证据缺少直接补练、补练入口未继承 evidence 上下文、latest path 返回 `path=null` 但页面仍显示进度、evidence-review intent 未形成证据复盘视图、刷新/导出/下载完成态不足、数据治理标签切换播报不足、学生证据来源定位不足、教师班级学生清单缺少搜索/筛选/批量治理、班级移除学生影响范围不透明、添加学生弹窗语义不足、班级学生导入缺批次治理、教师个体学情推荐动作不可执行、教师侧证据审核缺处置闭环、教案删除影响范围不透明、教案编排器依赖拖拽、空标题校验使用原生 alert、资源预览缺加入阶段动作、资源编辑缺使用影响说明、知识节点列表规模和无名按钮过多、直发课堂缺班级绑定、无班级 ACTIVE session 可重复创建、结束后落点不承接课后工作流、直发课堂复盘被未绑定班级阻断、跨角色访问静默重定向、权限边界缺可审计状态、账户菜单缺菜单语义、改密弹窗缺 dialog/focus trap、改密错误缺 alert/live、全局工具缺弹出层语义、主题切换缺状态播报、AI 侧栏缺区域语义和焦点 containment、AI 侧栏 Escape 后焦点恢复不稳定、移动端导航入口不统一、移动端 AI 先于主任务进入焦点路径、AI 工坊任务选择只改变视觉状态、AI 工坊与真实学习任务上下文断开、Copilot 暴露证据核验内部诊断、Copilot 回答缺少生成/引用核验播报、Global AI 回答暴露上下文 JSON、Global AI 低置信提示产品化不足、AI 发送按钮无可访问名称、AI 清空动作阻塞、Prompt 评估缺少学习任务上下文、Prompt 评价/校验/演示生成缺少完成播报、Prompt demo 轨迹与真实学生历史边界不清、作品集提示词动作指向 404、作品集反思入口不保留上下文、任务卡整卡链接与内部按钮重复、任务筛选缺少结果播报、学习路径 query 上下文被忽略、任务启动后仿真页不继承任务标题/目标/回写规则、作品集课堂作品/仿真设计/伦理整改空态动作泛化、作品集收录规则不可见、作品集移动端标签语义不足、学生访问数据中心静默改道、数据中心演示数据与正式壳层边界不足、教师数据中心治理动作泛化、数据中心导出按钮被浮层截获、教师学生详情刷新缺状态、教师侧学生证据缺审核处置闭环、教师遗留路由跨角色拒绝缺权限说明、学习路径空路径进度误导、路径生成前置条件不可见、evidence-review 空路径无证据回看、path-selection 空路径伪展示方案、path-execution 空路径伪装成练习节点、无 goal 生成上下文不稳、学习路径状态缺少播报、浮动工具面板缺语义、AI 侧栏焦点 containment 缺失、关闭态 AI 输入框抢占 Tab 顺序、移动学习路径浮层避让缺失、教师/管理员遗留壳层策略标记缺失、管理员用户移动页横向溢出、教师课堂复盘交付缺失、复盘外链丢失上下文、数据中心导出被浮层阻断、管理员治理风险缺处置闭环、模板下载后缺批量导入状态机、Arena 报告缺交付命令、学生文档反馈状态不清、系统配置保存缺影响审计、坏 ID 默认 404 缺产品恢复、错误页全局浮层优先级过高、教师坏对象状态泛化、学习路径坏上下文被忽略、管理员用户搜索无匹配早期曾返回全量且 Batch48 已确认 API 返回 `total:0` 但缺状态播报、任务启动缺完成/回写/收录合同、坏评分运行标识恢复路径错误、移动管理员用户页仍 945px 横向布局、自适应 demo 作答缺 durable 完成/写回、Prompt autodemo 输入被全局 AI 抢占、教师报告/分析动作不承接交付、控制报告 raw JSON、助手效果报告 404、治理风险不可处置、数据中心导出无下载且治理入口命中隐藏文本、移动治理宽度异常、真实路径 API 空/禁用/缺班级时 UI 仍显示进度、教师 report-ledger surface 不生效、评分工作台忽略 classId/source、治理页 loading 不稳定、数据中心 returnTo/导出/治理交接不闭环、学生完成态不回流、管理员 no-match URL/页面/API 口径不一致、批量导入无 file chooser、配置缺影响审计、治理处置 query 不闭环、移动用户 945px 与治理 568px 横向溢出、反馈任务纵向链路不承接 assignment/returnTo、教师移动报告交付缺闭环、评分 deep link 丢失上下文、治理 risk resolve 和统计导出无状态均已确认；课堂加入/Arena/教师复盘/管理员统计/数据治理/学生成长/教师班级分析/学生移动筛选/教师移动空态/管理员移动表格与模态/教师班级成员管理/教师教案与资源管理/教师直发课堂/控制工作台任务区/课前包入口/管理员治理动作/跨角色键盘路径/报告交付与评分反馈/系统壳层 a11y/AI 与作品集入口/任务大厅/数据中心/学习路径状态/Global AI 真实对话/报告导出交付/失效路由恢复/任务作品集回流/评分工作台/用户导入批次抽查已补证，修复阶段应统一处理 status/live、移动布局和动作状态机。
- 教师/管理员/登录态学生已使用固定账号上下文；错误账号访问非归属班级的截图已在第 7 章标记为审计夹具限制，不纳入产品缺陷结论。
- Arena 发布报告已覆盖本地审计夹具空态、真实教师发布后学生提交态、多次提交、榜单归属和截止后报告夹具；全站级读屏语义缺口已形成证据清单，后续进入修复。

## 7. 整改索引

- `audit-remediation-mobile-a11y-shell` 已完成 #617 的壳层范围：关闭全局浮动工具语义、Global AI 侧栏焦点 containment、管理员用户/治理移动横向溢出、教师报告固定主动作、代表页面 `status/live` 播报和移动表格卡片化缺口；学生反馈、任务、评分、治理处置、配置测试等业务状态机仍按对应垂直变更处理。证据见 `remediation/audit-remediation-mobile-a11y-shell/evidence.md`，章节标注见 `chapters/49-function-state-flows-batch41.md`、`chapters/53-function-state-flows-batch45.md`、`chapters/54-function-state-flows-batch46.md`、`chapters/55-function-state-flows-batch47.md`、`chapters/56-function-state-flows-batch48.md`、`chapters/57-function-state-flows-batch49.md`、`chapters/58-function-state-flows-batch50.md`、`chapters/59-function-state-flows-batch51.md`、`chapters/62-function-state-flows-batch54.md`、`chapters/64-function-state-flows-batch56.md`、`chapters/67-function-state-flows-batch59.md`。
