# 功能状态流续篇（四十）

日期：2026-06-20
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：学生自适应学习路径中心、练习、路径生成、路径选择、路径执行、证据回看、latest path API 和移动状态。

## 1. 证据清单

- 截图目录：`../screenshots/75-function-state-flows-batch40/`
- Manifest：`../screenshots/function-state-flows-batch40-manifest.json`
- 采集脚本：`../scripts/capture-batch40.mjs`
- 结果：17 张 PNG、17 个 DOM/a11y JSON、5 个 API 检查、3 个可选动作、0 个脚本错误、0 个忽略错误。

## 2. 真实学生会话 API 状态

固定学生账号 `demo` 登录成功，`/api/auth/session` 返回 `role=STUDENT`。学习路径相关 API 显示当前学生不是“已有路径继续执行”的状态：

| API | 状态 | 审计含义 |
|---|---:|---|
| `/api/learning-paths/latest?goal=control-correction` | 200，`path:null` | 控制校正目标没有可恢复路径。 |
| `/api/learning-paths/latest?goal=frequency-response-foundations` | 200，`path:null` | 频率响应目标没有可恢复路径。 |
| `/api/adaptive/learner-state?goal=control-correction` | 503 | 学习者状态服务关闭，返回 `LEARNER_STATE_SERVICE_DISABLED`。 |
| `/api/adaptive/path-advisor-context?goal=control-correction` | 403 | 当前账号缺少班级信息，不能生成学习路径。 |

这组事实要求 UI 明确区分“尚无路径”“服务不可用”“账号缺班级导致无法生成”三类状态。当前页面多数状态仍以“先建立入门路径”“路径顾问准备中”“可比较方案”这类正向文案承诺后续能力，缺少失败原因与恢复路径。

## 3. 桌面状态覆盖

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/assessment/adaptive-practice` | `01-student-adaptive-path-default-landing.png` | 默认态为 `workspaceIntent=landing`，显示学习概况与 24% 进度，但 API 最新路径为 `null`。 |
| 2 | `?goal=control-correction&intent=practice` | `02-student-adaptive-practice-core-goal.png` | 练习态显示 `practiceResource=true`，题目为折叠摘要。 |
| 3 | 同上，点击生成/展开练习题 | `03-student-adaptive-practice-question-action.png` | 题面可展开为 `practiceQuestionActive=true`，但无 `role=status` 或 `aria-live`。 |
| 4 | `?goal=control-correction&intent=evidence-review` | `04-student-adaptive-path-evidence-review-intent.png` | 页面识别 `workspaceIntent=evidence-review`，但 `evidenceSurface=false`，只显示选择历史。 |
| 5 | `?goal=control-correction&intent=contextual-recommendation` | `05-student-adaptive-path-generation-panel.png` | 生成面板可见，目标、时间、节奏、资源偏好、检查点、外部资源和自然语言输入齐全。 |
| 6 | 同上，编辑生成参数 | `06-student-adaptive-path-generation-edited.png` | 输入可保持，但账号缺班级/路径顾问 403 没有在面板内提示。 |
| 7 | `?intent=contextual-recommendation` | `07-student-adaptive-path-generic-generation.png` | 无显式 goal 时仍显示生成面板，但 `controlCorrectionGoal` 为空，路径上下文不稳定。 |
| 8 | `?goal=control-correction&intent=path-selection` | `08-student-adaptive-path-selection-without-path.png` | 在真实 `path:null` 下仍显示 3 条可比较路径和 6 个 route option module。 |
| 9 | `?goal=control-correction&intent=path-execution` | `09-student-adaptive-path-execution-without-path.png` | 无活动路径时显示“路径资源入口”和练习题入口，缺少“没有可执行路径”的解释。 |
| 10 | `?demo=1&scene=stable&goal=control-correction&intent=path-selection` | `10-demo-adaptive-path-selection-options.png` | 演示路径选择可显示 3 条方案、比较字段和选择历史。 |
| 11 | `?demo=1&scene=stable&goal=control-correction&intent=path-execution` | `11-demo-adaptive-path-execution-route.png` | 演示执行态可显示 3 个节点、证据记录和路径资源入口。 |
| 12 | 同上，展开练习题 | `12-demo-adaptive-path-execution-question-expanded.png` | 题面展开后仍保留路径节点上下文，但无完成/反馈播报。 |
| 13 | `?demo=1&scene=stable&goal=control-correction&intent=evidence-review` | `13-demo-adaptive-path-evidence-review.png` | 演示有路径时 `evidenceSurface=true`，证实真实空路径证据回看缺口不是脚本问题。 |

## 4. 移动状态覆盖

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 14 | `/assessment/adaptive-practice` | `14-mobile-adaptive-path-default-landing.png` | 移动默认态先显示完整顶部导航，再进入学习路径卡片；全局浮层贴近当前建议卡。 |
| 15 | `?goal=control-correction&intent=contextual-recommendation` | `15-mobile-adaptive-path-generation-panel.png` | 生成表单在窄屏可读，但全局控灵浮层压住当前建议正文区域。 |
| 16 | 演示 `path-selection` | `16-mobile-demo-adaptive-path-selection-options.png` | 横向摘要、路径卡和动作可见，但 3 条路径形成长页，选择动作重复下沉。 |
| 17 | 演示 `path-execution` | `17-mobile-demo-adaptive-path-execution-route.png` | 路线、证据、练习入口可见；仍缺状态播报和主任务优先焦点证据。 |

## 5. 主要问题

### 227. P1：默认学习路径落地页显示进度但最新路径为空

`/api/learning-paths/latest?goal=control-correction` 与 `frequency-response-foundations` 都返回 `path:null`，但默认页仍显示当前节点“入门诊断”、本周完成 `24%` 和“路径顾问准备中”。这会把冷启动、服务不可用和已有路径进度混在一起。

建议：默认页先用真实 latest path 与 learner-state 结果驱动文案。`path:null` 时应显示“尚无可恢复路径”，并把生成路径所需条件列出，而不是显示进度式指标。

### 228. P1：学习者状态 503 与路径顾问 403 没有进入生成面板

API 已返回 `LEARNER_STATE_SERVICE_DISABLED` 和“当前账号缺少班级信息，暂不能生成学习路径”，但生成页只显示可编辑表单和“生成路径/打开控灵”。学生无法在提交前知道该操作为什么不能完成。

建议：在生成设置区域顶部显示路径生成前置条件状态，包括学习者状态服务、班级绑定、目标注册和证据来源；不可生成时禁用主按钮并给出恢复路径。

### 229. P1：`evidence-review` 意图在空路径下没有形成证据回看视图

真实学生访问 `?goal=control-correction&intent=evidence-review` 时，DOM 标记为 `workspaceIntent=evidence-review`，但 `evidenceSurface=false`，页面只显示选择历史。演示路径同一 intent 可显示证据记录，说明空路径状态缺少专门降级设计。

建议：无路径时也应展示证据回看空状态：说明没有路径证据、可查看个人证据、可从错题或课堂作答发起补练，并保留返回证据页的上下文。

### 230. P1：`path-selection` 在真实 `path:null` 下仍展示 3 条可比较路径

真实会话 selection intent 显示 3 条方案、比较字段和“选择路径/调整/解释差异/暂不采用/有帮助”等按钮；但 API 没有实际路径，按钮也缺少可写入的 option。用户会误以为路径已经生成。

建议：只有持久化或可写入的 path option 存在时才进入方案选择。否则展示“尚未生成路径”的空状态和回到生成表单的主动作。

### 231. P1：`path-execution` 无活动路径时降级为练习资源入口

真实会话 execution intent 没有路线、节点或证据记录，却显示“路径资源入口”“检查节点练习已准备”和“展开练习题”。这会让学生误判自己已经进入某条路径节点。

建议：无 `pathId` 且 latest path 为空时，execution intent 应显示“当前没有可执行路径”，并提供生成路径、查看证据、返回学习概况三个明确动作。

### 232. P2：无显式 goal 的生成入口缺少目标选择上下文

`/assessment/adaptive-practice?intent=contextual-recommendation` 会打开生成面板，但 `controlCorrectionGoal` 为空。页面可以填写参数，却缺少“先选择目标”的明确约束，后续生成请求的上下文不稳定。

建议：无 goal 的 generation intent 应先进入目标选择，或者把目标选择作为必填校验，避免把泛化入口伪装成已绑定目标的生成页。

### 233. P2：移动端学习路径页仍被全局控灵浮层干扰

移动生成页中右下控灵浮层压在当前建议正文附近；演示路径选择页中浮层也贴近方案卡和选择动作。这个问题与仿真移动端浮层竞争一致，是全局 dock 与任务页面缺少 safe-area 规则。

建议：学习路径、仿真、任务工作区共享一套移动浮层避让策略；在窄屏优先把全局控灵停靠到固定安全区或折叠为不遮挡主任务的入口。

### 234. P2：学习路径关键状态变化缺少 live/status 播报

17 个截图的 DOM 摘要均为 `alerts=0`。练习题展开、路径参数编辑、选择/执行/证据视图切换和移动长页状态都没有 `role=status` 或 `aria-live`。

建议：为筛选/生成/展开题面/路径状态恢复/证据记录加载添加状态区，并确保按钮触发后的完成、失败和不可用原因可被读屏获知。

## 6. 后续审计输入

- 修复路径生成前置条件后，需要重新采集真实学生从“生成路径 -> 选择方案 -> 执行节点 -> 完成/跳过 -> 证据回看”的完整闭环。
- 当前演示态证明 UI 可以展示有路径的选择、执行和证据记录，但不能替代真实学生数据链路。
- 第 41 批建议继续补“学习路径生成修复后的真实闭环”或转向“全局浮层 safe-area 回归”，取决于后续开发优先级。
