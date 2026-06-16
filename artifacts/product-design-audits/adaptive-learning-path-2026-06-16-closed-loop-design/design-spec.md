# 自适应学习路径生成与执行闭环设计规格

日期: 2026-06-16
状态: Product Design draft for OpenSpec input
范围: `/assessment/adaptive-practice` 的路径生成、路径选择、路径执行、结果回写、历史证据记录

## 设计 Brief

目标是把当前“自适应学习路径中心”从展示型页面改为完整可用的学生工作流。学生应能基于自己的真实状态生成路径、调整参数、比较方案、选择路径、执行节点、获得复杂节点结果记录，并让这些行为进入后续推荐。

视觉真源沿用 2026-06-14 Product Design handoff:

- 路径生成主界面: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`
- 路径选择与比较: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png`
- 当前路径执行: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png`
- 学习历史与证据记录: `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png`

当前问题证据来自:

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/audit-notes.md`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/*.png`

## 产品原则

1. 学生看到的是学习任务，不是系统状态。
2. 路径生成必须是可调参数面板，不是静态摘要。
3. 低能力不是推荐重型节点的理由，必须先判断可执行性。
4. 每条路径都必须可选择、可执行、可回写。
5. 仿真、Arena、自适应测试等复杂节点必须有结果记录。
6. 低证据或低资源场景仍要给出可选方案，但要降低风险和难度。
7. 页面状态必须单一主任务优先，不再把生成、选择、执行、历史堆成一个长页。

## 目标用户状态

以 `20230010102601` 这类学生为关键验收场景:

- 控制建模能力为 0。
- 参数设计与调优能力为 0。
- 有路径选择/跳过/开始记录。
- 可能有 Arena 提交，但路径执行记录未绑定结果。

该学生进入路径中心时，不应直接进入 Arena。系统应先呈现“当前建议先完成准备节点”，并说明 Arena 暂未解锁。

## 主流程

### A. 初次进入

入口: `/assessment/adaptive-practice`

首屏只承担一个任务: 生成或继续学习路径。

必须显示:

- 页面标题: `自适应学习路径中心`
- 当前状态摘要: 目标、能力状态、证据可信度、上次路径状态
- 主按钮: `生成学习路径`
- 次按钮: `查看学习证据`
- 如果已有 active path: 主按钮变为 `继续当前路径`
- 如果有待处理复杂节点结果: 显示 `查看节点结果`

目标选择不再作为页面下方普通卡片。目标选择进入生成面板第一步。

### B. 打开路径生成面板

触发:

- 顶部 `生成学习路径`
- 当前路径中的 `请控灵调整`
- 无路径状态的空态按钮

形态:

- 桌面端: 居中弹出面板或右侧工作面板，宽度约 560-680px。
- 移动端: 底部全高 sheet，包含顶部步骤标题和固定底部操作。
- 控灵仍是右下浮动 dock；生成面板是路径任务面板，不替代全局控灵。

面板分为三段:

1. 学习目标
2. 路径约束
3. 控灵补充说明

### C. 参数填写

必须可编辑:

| 字段 | 控件 | 默认值 | 说明 |
|---|---|---|---|
| 学习目标 | select / segmented cards | 最近目标或推荐目标 | 不只限两个目标，但当前可先支持两个注册目标 |
| 可用时间 | stepper / slider / number input | 90 分钟 | 范围 15-240 分钟 |
| 难度节奏 | segmented control | 稳扎稳打 | 入门优先、稳扎稳打、挑战冲刺 |
| 资源偏好 | checkbox chips | 根据学生偏好和目标推荐 | 知识卡、视频、音频、练习、控制工作台、仿真、Arena、外部资源、控灵辅导 |
| 检查点密度 | segmented control | 标准 | 轻量、标准、密集 |
| 外部资源 | toggle | 关闭 | 开启后只允许治理过的资源 |
| 自然语言意图 | textarea | 空 | placeholder: `告诉控灵你想达成什么` |

按钮:

- `生成路径`
- `取消`

不可出现:

- 只读参数摘要伪装成输入框。
- 点击后只打开全局聊天输入框。
- 需要用户手写 JSON 或内部字段。

### D. 学生可执行性预检

点击 `生成路径` 后，系统先做 readiness check，再生成路径。

readiness check 输入:

- learner state: 知识掌握度、能力向量、证据可信度
- path history: 完成、跳过、失败、返回、选择历史
- complex node outcomes: 自适应测试、仿真、Arena、控制工作台结果
- resource prerequisites: 节点前置关系
- resource readiness metadata: 最低能力、最低证据、解锁条件

输出:

- `ready`: 可直接进入路径
- `needs-preparation`: 需要准备节点
- `locked`: 重型节点暂不进入主路径
- `evidence-needed`: 先完成诊断或基础互动

学生可见表达:

- `建议先完成准备节点，再进入仿真。`
- `Arena 暂未解锁，完成仿真验证后会自动进入。`
- `当前证据较少，先生成入门路径。`

内部 reason code 只能进入日志和治理视图。

### E. 生成结果

生成结果至少显示 3 条路径，低资源场景也不能退化成单一路径。

默认路径:

1. 基础补弱路径
2. 实践验证路径
3. 课程同步路径

当学生能力为 0:

- 基础补弱路径应排第一。
- 实践验证路径可以显示仿真或 Arena 为“后续解锁节点”，不能作为立即执行主节点。
- 课程同步路径应提供知识卡、视频/音频、互动课、自适应练习。

每条路径必须包含:

- 预计时长
- 资源组成
- 当前建议理由
- 可执行性状态
- 检查点
- 解锁后的重型节点
- 预期结果
- 主要风险提示

操作:

- `选择路径`
- `请控灵调整`
- `暂不采用`
- `查看为什么这样推荐`

### F. 选择路径

选择路径后:

- 关闭生成面板。
- 页面进入 `path-execution` 主状态。
- 顶部显示选中路径名称和当前节点。
- 写入选择历史和学习事实。
- 保留其他路径为可切换方案。

如果选择包含锁定节点的路径:

- 主路径只激活可执行部分。
- 锁定节点显示为 `稍后解锁`。
- 系统说明解锁条件。

### G. 当前路径执行

入口:

- `/assessment/adaptive-practice?intent=path-execution&pathId=...`

主视图:

- 左侧或主区域: 完整路径图
- 右侧或下方: 当前节点详情
- 底部或侧栏: 证据与历史摘要

节点状态:

| 状态 | 学生文案 | 行为 |
|---|---|---|
| current | 当前节点 | 可开始或继续 |
| next | 后续节点 | 可查看，不可越级开始，除非无前置 |
| locked | 稍后解锁 | 展示解锁条件 |
| completed | 已完成 | 可回顾、继续互动、查看证据 |
| skipped | 已跳过 | 可返回 |
| blocked | 需要复核 | 展示原因和替代路径 |

当前节点操作:

- `开始学习`
- `继续学习`
- `确认完成`
- `跳过`
- `请控灵解释`

跳过前必须二次确认:

> 跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。

### H. 复杂节点结果记录

自适应测试、仿真、控制工作台、Arena 都必须有节点结果卡。

结果卡字段:

- 节点名称
- 完成状态
- 分数或达成度
- 关键指标
- 证据来源
- 复核状态
- 对后续路径的影响

不同节点结果:

| 类型 | 必须记录 |
|---|---|
| 自适应测试 | 题目数、正确率、能力变化、薄弱知识点 |
| 仿真 | run id、trace/ref、关键指标、是否通过检查 |
| 控制工作台 | 参数方案、性能指标、验证结果 |
| Arena | submission id、score、valid、评价摘要 |

如果结果未绑定:

- 学生可见: `结果待同步`
- 系统行为: 不推进到依赖该结果的节点
- 治理行为: 记录缺失绑定问题

### I. 历史与证据

入口:

- `/assessment/adaptive-practice?intent=evidence-review&pathId=...`

必须独立成主状态，不再显示生成面板。

内容:

- 路径完成概览
- 时间线
- 选择/调整历史
- 节点结果
- 控灵干预
- 跳过与返回记录
- 证据来源标签

学生可见状态:

- 已记录
- 待同步
- 待复核
- 可用于推荐
- 仅作参考

不可出现:

- `started`、`fallback`、`low-resource-fallback`、`policyBundle`、`reasonCodes`
- `missing-*`
- `terminal-validation-unavailable`

## 信息架构

页面应按 route intent 切换主状态:

| intent | 主状态 | 首屏主任务 |
|---|---|---|
| none | Landing | 继续路径或生成路径 |
| contextual-recommendation | Generate | 调整参数并生成 |
| path-selection | Select | 比较并选择路径 |
| path-execution | Execute | 执行当前节点 |
| evidence-review | Evidence | 查看记录和证据 |

一个 intent 下只显示一个主工作区。可以保留轻量入口，但不能把所有状态堆叠在同一长页。

## 数据合同

### 路径生成请求

字段:

- `goalId`
- `timeBudgetMinutes`
- `difficultyRhythm`
- `resourcePreference`
- `checkpointPreference`
- `allowExternalResources`
- `naturalLanguageIntent`
- `excludedNodeIds`
- `preferredStyleId`
- `requestedAt`

### 资源 readiness metadata

为 ResourceNode 增加路径执行门槛:

- `readiness.minCompetency`
- `readiness.minEvidenceCount`
- `readiness.requiredCompletedNodeIds`
- `readiness.requiredOutcomeRefs`
- `readiness.unlockMessage`
- `readiness.lockedFallbackNodeIds`

示例:

```json
{
  "minCompetency": {
    "parameterDesign": 0.35,
    "controlModeling": 0.3
  },
  "requiredCompletedNodeIds": ["simulation:control-correction-step-response-lab"],
  "requiredOutcomeRefs": ["simulationRef"],
  "unlockMessage": "完成仿真验证后进入 Arena。"
}
```

### 路径节点执行记录

`LearningPathExecution` 应能表达:

- started
- completed
- failed
- reviewed
- continued-interaction
- returned-to-skipped

复杂节点必须绑定:

- `simulationRef`
- `arenaRef`
- `adaptiveAssessmentRef`
- `controlWorkbenchRef`

### 路径推荐结果

路径方案必须保留:

- `styleId`
- `label`
- `nodeIds`
- `activeNodeIds`
- `lockedNodeIds`
- `readinessSummary`
- `resourceMix`
- `estimatedMinutes`
- `checkpointNodeIds`
- `terminalValidationNodeIds`
- `studentFacingReason`

## 视觉与交互要求

桌面:

- 页面使用平台 AppShell。
- 生成面板不超过 680px，字段分组清晰。
- 路径比较使用表格式或横向列比较，但操作按钮固定在每列底部。
- 执行视图以路径图和当前节点详情为主，不显示生成面板。

移动:

- 使用分段标签: 生成、选择、执行、记录。
- 生成面板为底部 sheet。
- 路径比较使用横向路径卡 + 纵向字段详情。
- 当前节点操作固定在底部安全区上方。

控灵:

- 右下 floating dock 保持统一。
- 生成面板内的 `请控灵调整` 调用 path-advisor 工具，但参数来自表单。
- 全局聊天输入不替代路径生成表单。

## 关键空态

无路径:

- `还没有学习路径`
- `选择目标和可用时间，控灵会生成 3 条可比较路径。`
- 操作: `生成学习路径`

低证据:

- `证据还少，先从入门路径开始。`
- 操作: `生成入门路径`

重型节点未解锁:

- `Arena 暂未解锁`
- `先完成仿真验证，系统会记录结果并自动更新路径。`
- 操作: `查看准备节点`

结果待同步:

- `结果待同步`
- `系统还没有收到该节点的结果记录，暂不推进后续依赖节点。`
- 操作: `刷新结果`、`返回当前节点`

## 验收标准

1. 初次进入页面时，主任务清楚，不出现不可选择的伪预置路径。
2. 生成面板有真实可编辑控件，并能把参数传给 `generate_learning_path`。
3. 低能力学生不会直接获得立即执行的 Arena 主节点。
4. 低资源场景仍显示至少 3 条可比较方案，其中可包含锁定节点和解锁条件。
5. 选择路径后进入执行主状态，不再保留生成长页。
6. 跳过、返回、回顾、继续互动都写入路径记录。
7. 自适应测试、仿真、控制工作台、Arena 完成后都有结果卡。
8. 复杂节点没有结果绑定时，不推进依赖节点。
9. 学生页面不出现工程语义和内部 reason code。
10. 桌面与移动端分别对照四张视觉稿通过设计 QA。

## OpenSpec 拆分建议

建议拆成四个独立变更:

1. `redesign-adaptive-path-generation-panel`
   - 生成面板、参数控件、目标选择、控灵工具参数传递。
2. `govern-adaptive-path-readiness-gates`
   - readiness metadata、能力门槛、锁定节点、低能力路径策略。
3. `complete-adaptive-path-execution-results`
   - 复杂节点结果绑定、结果卡、依赖推进规则。
4. `separate-adaptive-path-workspace-states`
   - intent 状态机、执行视图、历史证据视图、移动端任务流。

这些变更可以并行设计，但实现顺序应先做生成面板和 readiness gate，再做执行结果，最后整理页面状态。
