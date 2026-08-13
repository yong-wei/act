# 多控制方法学习陪伴实施计划

**目标：** 让竞技场 AI 学伴以任务目录中的方法和指标为依据，为 PID、MPC 和黑箱辨识提供可验证且不冒充官方评价的练习建议。

**架构：** 新增只读场景解析器，从 Arena 任务、允许方法和 `MetricProfile` 构造参数与指标上下文。生成路由在服务端重新解析该上下文，Konling 运行时将其传给可选的上下文感知干预逻辑；无上下文调用保留既有 PID 行为。

**全局约束：** 仅使用任务目录的静态定义；不写入官方成绩、榜单、LearningFact、画像或正式错因；隐藏场景仅暴露已登记的聚合指标；PR 同时提交 Grill、OpenSpec、计划、实现和测试。

### 任务 1：任务派生上下文

- 创建 `src/features/ai/companion/arena-companion-context.ts`。
- 以 `getArenaChallengeTask`、`getArenaMetricProfile` 和 `ControllerMethod` 为唯一来源，验证任务和方法，并返回参数元数据、指标定义、教学动作。
- 保持全部方法有明确元数据；本 PR 验收覆盖 PID、MPC、黑箱辨识。
- 运行 `npm exec vitest run src/features/ai/__tests__/arena-companion-context.test.ts`。

### 任务 2：上下文感知干预

- 扩展 `shouldIntervene` 与 `generateIntervention` 的可选上下文参数。
- 有上下文时按指标方向和 `unacceptableValue` 识别练习风险，并生成方法特定、仅建议性的文本；无上下文时保持既有输出。
- 将上下文通过 `KonlingInterventionInput` 传到运行时，不增加任何学习记录或官方评价写入。
- 运行 `npm exec vitest run src/features/ai/__tests__/intervention-engine-context.test.ts` 及现有 Konling 回归。

### 任务 3：受认证的请求与工作台入口

- 生成路由接受可选 `arenaTaskId` 与 `method`，仅在二者同时出现时创建 Arena 上下文；不完整组合或非法组合返回 400 且不创建干预。
- 将任务绑定的 `AICompanionPanel` 放入控制工作台。工作台预设提供已确定的方法，通用多方法任务不猜测当前方法。
- 面板从共享上下文动态渲染参数和观测指标，发送任务和方法标识，且将结果明确标注为练习记录。
- 运行路由契约、组件和工作台回归测试。

### 任务 4：收尾

- 更新 OpenSpec 任务状态，严格校验并将 delta 同步到主规格。
- 运行目标测试、相关回归、`npm run typecheck`、`git diff --check`；需要时启动本地服务进行浏览器验收。
- 提交、推送并创建指向 `integration` 的 PR；不合并、不发送 `@codex review`。
