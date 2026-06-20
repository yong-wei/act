# 功能状态流续篇（四十二）

日期：2026-06-20
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：Global AI 真实对话、上下文注入、引用核验提示、清空/重试/停止状态、知识图谱降级上下文、自适应路径 AI 入口、管理员治理 AI 和移动端 AI 首屏。

## 1. 证据清单

- 截图目录：`../screenshots/77-function-state-flows-batch42/`
- Manifest：`../screenshots/function-state-flows-batch42-manifest.json`
- 采集脚本：`../scripts/capture-batch42.mjs`
- 结果：12 张 PNG、12 个 DOM/a11y JSON、4 个 `/api/ai/chat` 响应、24 个可选动作、0 个脚本错误、0 个忽略错误。

4 次 `/api/ai/chat` 均返回 HTTP 200，说明本批不是整体服务不可用问题。流式响应开头均带 `konlingCitationGuard.status="low-confidence"`，缺少 `content`、`learner-state`、`path-execution` 和 `evidence` 引用类别；其中管理员治理页有一次响应体读取因页面上下文关闭失败，但 UI 截图和 DOM 状态已捕获。

## 2. 桌面 AI 对话状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/dashboard` AI 初始 | `01-dashboard-ai-initial.png` | AI 侧栏打开，欢迎语可见，但 `role=""`、`quickQuestions=0`、发送按钮可见但无可访问名称；焦点从关闭按钮、输入框跳到浮动工具和页面正文。 |
| 2 | `/dashboard` 发送后加载中 | `02-dashboard-ai-submitted-loading.png` | 用户问题已写入，对话出现低置信引用核验提示，`hasLoading=true`，停止按钮有名称；`alerts=0`。 |
| 3 | `/dashboard` 回答完成 | `03-dashboard-ai-response-or-error.png` | 接口 200 且回答完成，但首段仍是面向内部状态的引用核验提示；清空按钮出现，发送按钮仍无名称。 |
| 4 | `/dashboard` 重试状态 | `04-dashboard-ai-retry-state.png` | 因没有错误态，重试按钮未出现；页面仍保留同一回答。 |
| 5 | `/dashboard` 清空尝试 | `05-dashboard-ai-cleared.png` | “清空对话”点击被页面 body 截获并超时，截图仍显示 2 条消息，没有回到欢迎态。 |
| 6 | `/knowledge?node=Bode图_1_1` 初始 | `06-knowledge-ai-degraded-context.png` | 降级上下文卡能说明“节点未解析”，`knowledgeContextState=degraded`，但问题建议区标题后没有任何快捷问题。 |
| 7 | 同上，回答完成 | `07-knowledge-ai-response-or-error.png` | 回答首屏直接显示 `pageContext`、`knowledgeWorkspace`、`knowledgeCapabilityContext` 等 JSON，然后才出现引用核验提示和自然语言解释。 |
| 8 | `/assessment/adaptive-practice?...` AI 入口 | `08-adaptive-path-ai-entry.png` | 路径页 AI 入口点击被阻塞，侧栏仍为 `closed`；页面依赖控灵给出路径建议，但“打开控灵”动作不可用且没有原因说明。 |
| 9 | `/admin/data-governance` 管理员 AI | `09-admin-governance-ai-response-or-error.png` | 管理员问题发出后 16 秒仍处于 loading；可见回答中先暴露治理 `pageContext`、`knowledgeCapabilityContext`、`null`、路径对象和数组，再出现低置信提示。 |

## 3. 移动 AI 状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 10 | `/dashboard` 移动 AI 初始 | `10-mobile-dashboard-ai-initial.png` | 移动端 AI 面板打开后覆盖首屏，但没有 dialog/complementary 语义；焦点仍能跳到浮动工具、页面正文和主题按钮。 |
| 11 | `/dashboard` 移动 AI 回答 | `11-mobile-dashboard-ai-response-or-error.png` | 回答首屏主要被低置信引用核验提示占据；后续建议直接引导 PID 整定，但缺少当前学习路径或证据来源支撑。 |
| 12 | `/knowledge?node=Bode图_1_1` 移动降级 | `12-mobile-knowledge-ai-degraded-context.png` | 降级上下文可见，发送按钮仍无名称，快捷问题仍为空，且 `alerts=0`。 |

## 4. 主要问题

### 244. P1：Global AI 回答把服务器上下文 JSON 直接暴露给用户

知识图谱和管理员治理页的可见回答都先展示 `pageContext`、`knowledgeWorkspace`、`knowledgeCapabilityContext`、`null`、路径对象和数组。该内容来自系统上下文，而不是学生或管理员可读的解释层。`07-knowledge-ai-response-or-error.png` 与 `09-admin-governance-ai-response-or-error.png` 都是视觉证据。

建议：把上下文对象严格限定为模型输入或调试日志，禁止进入 assistant 可见文本；必要时只以产品化摘要展示“当前节点未解析”“缺少路径证据”等状态。

### 245. P1：引用核验低置信提示作为回答首段直接展示

Dashboard、知识图谱、管理员治理和移动 Dashboard 的回答均先展示“控灵证据提示”，并列出缺少引用类别和低置信原因。普通学习者看到的是内部核验诊断，而不是可操作反馈；移动端首屏尤其明显。

建议：把 citation guard 转成 UI 状态层，例如“证据不足，建议先补充仿真/路径记录”，并把内部缺失类别隐藏到开发诊断或管理员可展开详情中。

### 246. P1：自适应路径页 AI 入口被阻塞且无原因说明

`08-adaptive-path-ai-entry.png` 捕获到 `aiSidebarState=closed`，可选动作 `adaptive open AI/sidebar action` 为 `blocked`。页面正在展示路径建议和上下文推荐 intent，却不能打开控灵，也没有说明是否需要先生成路径、加入班级或补充证据。

建议：路径页应提供可点击的控灵入口；若确实需要前置条件，按钮必须保留可解释的 disabled reason，并把同一原因写入可读状态区。

### 247. P2：AI 发送按钮没有可访问名称

12 个状态中发送按钮的 `sendButtonName` 均为空。图标按钮没有 `aria-label` 或 sr-only 文本，读屏用户无法判断该按钮用途；输入框禁用时也缺少状态解释。

建议：为发送按钮补 `aria-label="发送问题"` 或等价 sr-only 文本，并在禁用时通过 `aria-describedby` 关联“请输入问题后发送”等提示。

### 248. P2：AI 加载、完成和降级状态没有 live/status 播报

本批 12 个截图 `alerts=0`。发送问题、进入 loading、完成回答、知识节点降级、管理员超时、清空失败和入口被阻塞都没有读屏可感知状态。

建议：Global AI 应有统一 `role=status` 或 `aria-live=polite` 区域，覆盖发送中、已完成、低置信、节点未解析、清空失败和长时间等待。

### 249. P2：“清空对话”动作可见但不能完成

Dashboard 完成态出现“清空对话”，脚本按按钮 title 点击后超时，消息数仍为 2，页面没有回到欢迎态。该动作对视觉用户可见，但命中/层级/事件处理不可靠。

建议：修复清空按钮命中层级，点击后同步清空消息、恢复欢迎态，并播报“对话已清空”；若需要确认，应使用应用内 dialog 而不是静默失败。

### 250. P2：AI 面板焦点仍会泄漏到页面正文和浮动工具

桌面和移动初始状态的焦点轨迹均显示：关闭按钮、AI 输入框之后进入浮动工具、body、导航或主题按钮。第 41 批已确认侧栏缺焦点 containment，本批在真实对话状态再次复现。

建议：移动端按 modal dialog 限定焦点；桌面端若作为 complementary 区域，应明确焦点进入/离开路径，并避免打开后立即落入浮动工具。

### 251. P2：快捷问题标题存在但问题列表为空

Dashboard、知识图谱和移动状态都显示“你可以问我:”，但 `quickQuestions=[]`。这会让用户期待可点问题，却没有可操作项。

建议：没有快捷问题时隐藏该标题；有上下文时提供 2-3 个真实任务问题，例如“为什么节点未解析”“先补哪类证据”“下一步练习是什么”。

### 252. P2：管理员治理 AI 长时间 loading 时仍暴露调试上下文

管理员治理页 16 秒后仍 `hasLoading=true`，同时已经显示原始上下文、低置信提示和“控灵正在思考...”。这会同时造成信息层级混乱和长任务不确定性。

建议：为管理员 AI 增加长请求 timeout/重试/取消状态，loading 中不要提前展示未整理的上下文；治理页回答应优先围绕风险、数量、影响范围和处置入口。

### 253. P2：移动端 AI 首屏被内部警告占据，任务层级不清

`11-mobile-dashboard-ai-response-or-error.png` 中，首屏主要是引用核验警告，页面正文仍在下方可见，AI 面板与页面任务的层级关系不明确。用户需要先越过内部警告才能看到真正建议。

建议：移动端 AI 应把回答正文作为首要内容，低置信状态转为紧凑 banner 或状态行，并在打开时明确遮罩/安全区，避免与页面正文混读。

## 5. 后续审计输入

- Global AI 修复后，优先回归 Dashboard、知识图谱降级节点、管理员数据治理和移动 Dashboard。
- 自适应路径页应单独补一次“生成路径 -> 打开控灵 -> 使用路径上下文提问”的完整链路。
- 引用核验与上下文注入需要产品级合同：模型可用上下文、用户可见摘要、管理员调试详情和日志输出必须分层。
