## Context

`/ai/copilot` 已支持三种实际状态：无 `context` 的通用入口、`portfolio-reflection` 任务和 `evidence` 任务。后两者已经使用各自的受治理任务合同与专属快捷问题；无任务状态却仍沿用早期船舶仿真演示文案，包括“获取当前仿真状态”“诺莫托船舶模型”“根据 CCS 规范审核设计”和“航迹误差”等内容。

同一页面发送给服务端的通用 page context 是 `courseId=ai-assistant`、`topic=通用学习辅助`，没有仿真运行状态或船舶任务绑定。因此当前默认呈现不仅不一致，还会让学生点击无法由当前证据和工具支持的问题。

## Goals / Non-Goals

**Goals:**

- 让欢迎说明、建议问题、输入示例和能力承诺来自同一个学生安全入口投影。
- 有受治理任务时匹配任务；无任务时使用中性通用学习辅助并明确上下文限制。
- 只承诺当前页面真实具备的解释、复盘、规划、证据读取或候选草稿能力。
- 保持 URL 参数不具备学习事实、权限或能力声明权。

**Non-Goals:**

- 不为通用 Copilot 自动选择课程、仿真、挑战或学生画像。
- 不把聊天建议自动写入 LearningFact、作品集、成绩、排行榜或学习画像。
- 不改变作品集反思和 Evidence Copilot 的服务端授权与写回边界。
- 不在本变更中新增仿真状态工具或 CCS 审核能力。

## Decisions

### 1. Derive one entry presentation from governed task state

建立纯展示投影，包含标题、说明、能力列表、建议问题、输入 placeholder、限制说明和可达行动。输入只使用已经解析的任务类型、服务端 evidence projection 状态和允许能力；组件不再在多个 JSX 分支中拼接独立文案。

逐处替换固定文本容易再次产生标题、快捷问题和输入示例不一致，因此使用一个受限投影作为页面唯一来源。

### 2. Use a neutral generic state when no task is bound

无任务入口只承诺自动控制课程中的概念解释、学习复盘和下一步规划，并提示当前没有绑定具体课程步骤、仿真状态或个人证据。建议问题聚焦“解释一个概念”“整理当前疑问”“选择真实学习入口”，不得声称可读取不存在的运行数据。

默认绑定最近课程或最近仿真会制造未经确认的当前任务，也可能跨越证据边界，因此不采用自动推断。

### 3. Preserve existing task-specific contracts

`portfolio-reflection` 继续使用候选草稿、显式保存边界；`evidence` 继续使用服务端授权证据和 missing/unavailable 限制。入口投影可以改变文案和建议问题，但不能扩大任务权限。

客户端任意 `context`、`source`、`assignment` 或 `intent` 不能创建新的任务能力。未注册 context 回退中性状态，且不得把参数内容直接呈现为权威学习事实。

### 4. Verify promises by executing representative actions

浏览器测试不只检查固定文案消失，还要点击每种状态的代表建议问题或相邻行动，验证请求携带正确任务类型、无任务状态不请求仿真工具、empty/unavailable 状态进入真实学习或证据创建入口。

## Risks / Trade-offs

- [Risk] 通用状态过于空泛。 -> 提供少量可执行的概念解释、疑问整理和学习入口行动，但不伪造当前对象。
- [Risk] 任务投影与服务端合同漂移。 -> 复用现有 task contract 和 evidence projection 类型，并覆盖每个注册状态。
- [Risk] URL 参数重新成为文案权威。 -> 只用注册 context 选择合同；来源描述必须由既有 strict parser 和服务端证据投影约束。
- [Risk] 快捷问题点击后仍请求不可用工具。 -> 请求断言覆盖 tools、task context 与 page context，generic 状态明确无仿真运行态。

## Migration Plan

1. 为入口投影添加 generic、reflection、evidence available/missing/unavailable 和 unknown-context 测试。
2. 用入口投影替换欢迎区、能力列表、快捷问题和 placeholder 的固定船舶文案。
3. 验证代表问题和相邻行动真实可达，并保持会话恢复与任务边界。
4. 运行 focused tests、typecheck、OpenSpec strict 和 Commercial UI governance，在干净 revision 捕获 1440/320 证据。
5. 无数据迁移；回滚仅恢复旧入口文案，不影响已持久化会话。

## Open Questions

None. 未绑定任务时保持中性、已绑定任务时服从现有服务端合同，是既有学习陪伴与证据治理边界的直接结果。

