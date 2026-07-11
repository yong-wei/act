## Context

自适应学习路径执行页目前在单个页面文件中同时承担入口说明、统计摘要、路径节点、节点详情、结果卡和活动记录。节点以固定大卡片纵向排列，详情与操作统一位于完整列表之后；桌面长路径需要大幅滚动，移动端模块标题会被右侧状态挤压成逐字换行。

路径启动已经能够附加 `source`、`goalId`、`pathId`、`nodeId`、`intent`、`returnHref` 和 `resourceType`，服务端也会在可信 completion 写入后更新 `currentNodeId`。缺口在于目标页面没有统一的旅程控制与下一节点读取协议，completion 响应也不返回更新后的导航状态。

Arena 侧已经存在具体 challenge detail 和统一工作台路由，但部分 fixture 把 `arena_task` 表达为知识图谱节点并导航至 `/arena`。Challenge 页面只读取发布参数，进入工作台时不会保留自适应路径上下文。

## Goals / Non-Goals

**Goals:**

- 让学生在桌面和移动端快速扫描完整路径、识别资源类型与执行状态，并在所选节点原位完成操作。
- 让路径启动的资源在完成后直接显示经服务端授权的下一步，同时保留返回路径与总体进度入口。
- 让 Arena 节点始终指向具体挑战，并在 challenge detail、Control Odyssey 或统一工作台之间持续保留路径上下文。
- 保持 readiness、结果绑定、官方 Arena 证据和路径所有权校验由服务端决定。
- 建立可自动验证的响应式、交互和跨路由验收基线。

**Non-Goals:**

- 不重新设计路径生成算法、学习目标、排序策略或终端验证政策。
- 不改变 Arena 官方评分、榜单或提交权威。
- 不为非路径入口伪造路径控制，也不改变其现有返回目标。
- 不引入新的全局设计系统、图标库或动画框架。
- 不在本变更中重构学习路径页面的全部数据加载与历史记录模块。

## Decisions

### 1. 采用单列紧凑时间线和节点内联展开

路径使用单列有序列表。折叠节点保持紧凑高度，以节点标记和自适应纵向连接线表达顺序；一次只允许一个节点展开。展开内容直接位于节点容器内部，包含推荐理由、预计时间、证据、检查标准、结果状态和当前可用操作。

选择该方案是因为它在长路径和移动端保持同一心智模型，并直接满足“操作属于所选节点”的要求。未采用桌面双栏详情面板，因为它仍会把节点与操作分离，并要求移动端维护另一套交互；未采用横向 stepper，因为长标题、锁定说明和可变路径长度会造成横向滚动与信息截断。

### 2. 资源类型与执行状态使用正交视觉语义

资源类型通过语义色调、已有图标和明确文字标签共同表达；颜色只用于小面积强调，如节点标记、左侧强调线和浅色背景，不使用整张高饱和卡片。执行状态通过完成图标、当前描边、锁定图标、状态标签和可用性表达，不复用资源类型颜色承担状态含义。

视觉映射集中为一个类型到 tone/icon/label 的配置，优先使用现有设计 token。所有状态在无颜色条件下仍可辨认，并验证浅色、深色及高对比环境。

### 3. 执行页使用任务优先的信息层级

`path-execution` intent 不再重复展示大 Hero、当前建议和六张等权统计卡。页面顶部保留紧凑路径标题、完成比例、预计剩余和检查点状态，随后立即呈现路径时间线。学习记录、路径资源入口和管理能力保持次级折叠模块。

通用 `PathWorkspaceModule` 的 header 在窄屏改为纵向重排，trailing 信息不得占用标题的最小可读宽度。移动端标题、说明和操作必须在 320px 以上正常换行。

### 4. 由服务端提供路径旅程导航视图

新增服务端拥有的旅程导航视图，至少包含：路径与目标标识、当前节点、已完成数量、总节点数、返回地址、路径状态，以及下一动作的 `state`、`nodeId`、标题、资源类型、目标地址和不可用原因。客户端不得从数组位置或可见标签自行推断可执行下一节点。

目标页面从已规范化的 launch context 读取路径标识，通过受权限保护的 journey read API 获取初始视图。路径 completion API 在写入、结果绑定和 readiness 重算后返回最新 journey view，使界面无需先返回路径中心即可启用下一步。幂等 replay 也返回当前真实 journey view。

下一动作状态至少区分：`ready`、`blocked`、`pending-result`、`path-complete`。只有 `ready` 提供可导航地址；`pending-result` 提供刷新或重试；`path-complete` 将主动作切换为查看路径总结。

### 5. 使用共享旅程控制组件接入目标页面

建立共享的路径旅程控制组件和读取 hook。组件始终保留“返回学习路径”，显示当前节点和路径进度，并根据 journey state 渲染下一步、等待结果、完成路径或恢复动作。

完成回调仍由各资源类型产生可信结果引用；共享组件只消费服务端返回状态，不把浏览页面或点击按钮当作完成证据。非路径入口不渲染该组件。

当前受治理路径节点按目标表面使用以下 support matrix；任何新增的内部可执行节点类型必须先登记其中一种行为，不能以未定义的 `supported` 状态进入路径：

| 路径节点类型 | 目标表面 | 连续旅程行为 |
| --- | --- | --- |
| `interactive_lesson`、`knowledge_card`、`textbook_section`、`slides` 及映射到平台资源页的受治理课程/媒体节点 | 通用资源页、知识/教材页或互动课 runtime | 目标页面直接渲染共享旅程控制；可信完成后在原页启用下一步。 |
| `adaptive_quiz`、`checkpoint`、`reflection`、`konling` 及等价 AI intervention | 路径中心内嵌活动或平台自有目标页 | 内嵌活动沿用路径中心旅程控制；离开路径中心的自有页面必须接入共享控制，完成后不得要求再次点击“开始学习”。 |
| `simulation`、`control_workbench` | 仿真或控制工作台壳层 | 壳层接入共享控制，只有受治理运行/结果引用满足门禁后启用下一步。 |
| `arena_task` | 具体 challenge detail，再进入 Control Odyssey 或统一控制工作台 | challenge 与工作台均保留路径上下文和共享控制，只有受治理 Arena 结果允许前进。 |
| `external_resource` | 平台外部 URL | 外链在新的浏览上下文打开并保留路径中心；学生返回后由路径中心刷新 journey，通过既有显式访问/完成证据确认后启用下一步，不再要求重新点击“开始学习”。 |

若平台内部目标尚未接入共享控制，其 ResourceNode 不得被视为连续旅程就绪；若外部站点无法嵌入控制，则必须使用上述可验证 fallback，而不是静默丢失路径状态。

### 6. Arena 节点必须绑定具体任务并完整转发上下文

`arena_task` PathNode 使用 `arena-task:<taskId>`、`sourceKind: arena_task`、`sourceRef: <taskId>` 和 `/arena/challenges/<taskId>`。注册审计拒绝 `/arena`、知识节点占位、缺失 task 或无法解析 challenge 的 Arena 路径节点。

Challenge route 解析并规范化路径 launch context，传给 challenge detail。工作台链接通过 routing helper 保留路径参数和现有 publication 参数。Control Odyssey 与统一控制工作台以相同方式显示旅程控制；Arena completion 仍必须由受治理的 `ArenaSubmission` 或允许的 preview 证据驱动。

### 7. 验收以行为和真实页面截图为准

单元测试覆盖类型视觉映射、journey state、目标审计和参数合并。API 测试覆盖 completion 后 next node、blocked/pending-result、幂等 replay 与越权访问。浏览器测试覆盖节点内联操作、长路径滚动、完成后下一步、Arena challenge 到工作台的上下文传递，以及 1440px、375px 和最低 320px 重排。

视觉验收必须使用真实运行页面，不以源码字符串断言替代。浅色和深色至少各验证一个桌面与移动端执行状态。

## Risks / Trade-offs

- [Risk] 多种资源壳层完成语义不同，统一组件可能诱导客户端伪造完成。→ Mitigation：组件只显示服务端 journey view，各资源继续通过既有受治理 completion 入口写入证据。
- [Risk] completion 后同步读取下一节点会增加接口复杂度。→ Mitigation：由同一服务端事务后的路径真相构建 view，幂等 replay 使用相同构建器，避免客户端二次推断。
- [Risk] 类型颜色过多会形成杂乱的彩虹界面。→ Mitigation：限制为低饱和强调色，状态使用独立图标和标签，并在视觉验收中检查密度与对比度。
- [Risk] Arena path 参数与 publication 参数合并时可能覆盖。→ Mitigation：定义允许传递的键集合，路径上下文与 publication 上下文分别规范化后合并，并覆盖重复键测试。
- [Risk] 修复 fixture 可能使旧持久化路径继续保留 `/arena`。→ Mitigation：恢复路径时检测无效 Arena target，优先从稳定 task id 修复；无法修复时阻塞执行并提示重新生成路径。
- [Risk] 当前页面文件较大，直接堆叠组件会继续恶化维护性。→ Mitigation：仅抽取路径时间线、节点行和旅程控制三个有明确接口的组件，不顺带重构其他工作区。

## Migration Plan

1. 先增加 journey view、目标审计和兼容读取，不改变现有 UI。
2. 修复 fixture 与恢复路径中的 Arena 目标，并为旧无效目标提供阻塞或可验证修复。
3. 接入共享旅程控制到通用资源、互动课、Arena challenge 和工作台。
4. 用紧凑时间线替换执行页节点/详情结构，并调整响应式 header 与信息层级。
5. 运行单元、API、Playwright、视觉截图和 OpenSpec 严格验证后发布。

回滚时可恢复旧执行页渲染，但保留服务端 journey view 与 Arena 目标审计；这些新增接口对旧消费者保持兼容。

## Open Questions

- 无阻塞问题。具体资源色值在实现阶段从现有 token 中选择，并以对比度与暗色截图验收，不新增品牌色体系。
