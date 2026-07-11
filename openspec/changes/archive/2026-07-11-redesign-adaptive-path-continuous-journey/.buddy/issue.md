---
change_id: redesign-adaptive-path-continuous-journey
claim_branch: redesign-adaptive-path-continuous-journey
series: adaptive-learning-experience
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/redesign-adaptive-path-continuous-journey
risk: high
area: adaptive-learning
---

## Goal

把当前学习路径改造成紧凑、可扫描、节点内联操作且可跨资源连续前进的学习旅程，并确保 Arena 节点进入具体挑战、保留路径上下文和受治理的下一步状态。

## Scope

- 重构路径执行页的节点、连接线、类型视觉、操作位置、信息层级和响应式行为。
- 建立服务端拥有的 journey view，并让可信 completion 返回重新计算后的下一动作。
- 为全部受治理路径节点登记平台自有目标、路径内活动或外部资源 fallback，并提供可审核的返回路径/当前进度/下一步行为。
- 修复 Arena PathNode 的具体任务身份、challenge target、fixture 与恢复校验。
- 保留并转发 Arena publication、路径 launch context 和证据门禁。
- 增加单元、API、浏览器和真实页面视觉验收。

## Out of Scope

- 不修改路径生成算法、LearningGoal、排序策略、readiness 政策或终端验证政策。
- 不修改 Arena 官方评分、提交、榜单或隐藏评测权威。
- 不重构学习路径历史、画像或其他非执行工作区。
- 不改变非路径入口的默认返回与完成行为。
- 不引入新的设计系统、图标库或动画依赖。

## Acceptance Checklist

- [ ] AC-1: 路径以紧凑节点和连续连接线呈现，聚焦节点在原位展开详情及允许的操作，长路径无需滚动到独立详情区才能操作。Owner: independent reviewer.
  Evidence: 路径组件测试、Playwright 节点切换测试、1440px 与 375px 真实页面截图。
- [ ] AC-2: 知识、课程、练习、仿真、工作台、Arena 等资源类型使用稳定且低饱和的语义视觉，执行状态使用独立图标/标签/描边，并且不依赖颜色也可辨认。Owner: independent reviewer.
  Evidence: 类型映射单元测试、无颜色语义检查、浅色/深色截图。
- [ ] AC-3: `path-execution` 优先显示紧凑进度与路径；在 320px、375px 和 1440px 下无逐字标题、重叠、裁切或页面级横向滚动。Owner: independent reviewer.
  Evidence: 响应式 Playwright 断言与三种宽度截图。
- [ ] AC-4: 受权限保护的 journey view 由服务端路径真相生成；completion、复杂结果待同步、阻塞、终点和幂等 replay 返回正确下一动作，客户端不自行推断下一节点。Owner: independent reviewer.
  Evidence: journey builder/API 测试、越权测试、execution route 测试。
- [ ] AC-5: 受治理路径类型 `interactive_lesson`、`knowledge_card`、`textbook_section`、`slides`、`adaptive_quiz`、`control_workbench`、`simulation`、`arena_task`、`reflection`、`checkpoint`、`konling` 和 `external_resource` 均具有可审核的连续旅程行为；平台自有目标或路径内活动持续提供返回/进度/下一步，外部资源采用保留路径中心且返回后无需再次开始的 fallback，非路径入口保持原行为。Owner: independent reviewer.
  Evidence: 节点类型 support matrix 测试、组件测试、外部资源 fallback 测试与跨资源 Playwright 流程。
- [ ] AC-6: 所有可执行 `arena_task` 节点绑定真实 `taskId` 并导航到 `/arena/challenges/<taskId>`；`/arena`、知识节点占位和未知 challenge 会被修复或阻塞。Owner: independent reviewer.
  Evidence: ResourceNode audit、Yang Fan fixture、恢复与路径启动测试。
- [ ] AC-7: Arena challenge、Control Odyssey 和统一控制工作台保留路径与 publication 上下文；Arena 下一步只在受治理结果满足路径政策后启用。Owner: independent reviewer.
  Evidence: routing 参数测试、Arena API/evidence 测试、challenge-to-workbench Playwright 流程。
- [ ] AC-8: 相关类型检查、单元/API 测试、浏览器测试、视觉验收及 OpenSpec 严格验证全部通过，无未登记范围扩张。Owner: independent reviewer.
  Evidence: `rtk npm run typecheck`、目标测试命令、Design QC 截图、`rtk openspec validate redesign-adaptive-path-continuous-journey --type change --strict`。

## Tasks

- [ ] Task 1: 建立 journey view、授权读取和 completion 后连续导航响应。
  Covers: AC-4, AC-5
  Acceptance: ready、blocked、pending-result、path-complete、unauthorized 和 idempotent replay 状态均来自服务端并具有测试。
  Evidence: journey builder、API 与 execution route 测试结果。
  Reviewer Check: 确认客户端不能仅凭节点数组位置获得可执行下一地址，且越权响应不泄露路径结构。
- [ ] Task 2: 修复并治理 Arena PathNode 的具体任务身份和目标。
  Covers: AC-6
  Acceptance: registry、fixture 和 restored path 只允许可验证具体 challenge；遗留无效目标具有确定的 repair-or-block 行为。
  Evidence: ResourceNode audit、Yang Fan fixture、restore 和 route 测试。
  Reviewer Check: 确认任何 `/arena` 首页目标或知识节点占位都不能作为可执行 Arena PathNode 通过。
- [ ] Task 3: 实现共享路径旅程控制并覆盖全部受治理节点类型与外部资源 fallback。
  Covers: AC-4, AC-5
  Acceptance: support matrix 中每类节点都由平台自有页面、路径内活动或外部资源 fallback 提供返回、进度和服务端下一动作；非路径入口不显示伪造路径控制。
  Evidence: 节点类型矩阵、组件测试、资源 completion、外部 fallback 和跨资源浏览器流程。
  Reviewer Check: 逐类确认知识/教材、自适应测验、反思、检查点、控灵、仿真/工作台、Arena 与外部资源均有明确行为，共享控制不直接写入伪造完成证据，并保持原非路径导航。
- [ ] Task 4: 将执行页重构为紧凑内联路径并修复响应式信息层级。
  Covers: AC-1, AC-2, AC-3
  Acceptance: 节点内联展开和操作、类型/状态正交语义、任务优先布局及 320px 以上正常重排全部实现。
  Evidence: 组件/交互测试和 1440px、375px、320px 浅色/深色截图。
  Reviewer Check: 确认长路径操作不再远离节点，颜色不是唯一语义，移动端不存在逐字列或横向溢出。
- [ ] Task 5: 贯通 Arena challenge 与工作台的路径上下文和结果门禁。
  Covers: AC-7
  Acceptance: challenge detail 显示路径旅程，工作台链接保留路径与 publication 参数，下一步由 Arena 结果真相控制。
  Evidence: routing 参数测试、Arena evidence 测试和 challenge-to-workbench Playwright 流程。
  Reviewer Check: 确认打开详情不等于完成，错误任务或无效结果不会解锁下一节点，隐藏评测不泄露。
- [ ] Task 6: 完成回归与视觉门禁并更新必要文档。
  Covers: AC-8
  Acceptance: 最小充分类型、单元、API、浏览器、视觉和 OpenSpec 验证通过，ProjectDescription 仅在重大产品状态变化时更新。
  Evidence: 完整命令输出、Design QC 截图和最终 diff。
  Reviewer Check: 确认验证覆盖五个修改 capability，且 diff 不含相邻无关重构。

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
