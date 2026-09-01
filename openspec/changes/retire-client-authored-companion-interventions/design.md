## Context

`add-konling-official-evaluation-companion-loop` 已明确指出旧陪伴引擎接受客户端形状的尝试记录和通用指标阈值，不适合作为正式任务约束的权威来源。该变更已经实现正式提交适配、提交级去重、正式结果建议卡和下一次同任务提交的验证回访。

然而，`ControlWorkbenchShell` 仍在任务会话中挂载 `AICompanionPanel`。该面板以 React 状态保存学生手填的参数、指标和成功/失败，构造 `StudentState` 后调用 `/api/ai/intervention/generate`。路由只重新解析任务和方法目录，仍把客户端尝试历史交给 `createGovernedKonlingIntervention()`，后者可以创建受治理干预、证据上下文和 Memory。正式提交和手填记录因而同时成为生产陪伴来源。

## Goals / Non-Goals

**Goals:**

- 让控制工作台只有正式 `ArenaSubmission` 能触发、去重和验证受治理陪伴轮次。
- 消除学生手填参数、指标和成功状态进入干预、证据、Memory 或冷却判断的生产路径。
- 保留任务/方法/指标档案对正式提交的差异化解释能力。
- 保持历史记录可审计，并防止旧非正式记录参与新的正式陪伴轮次。

**Non-Goals:**

- 不改变 Arena 正式评测、任务硬约束、分数、排行榜或提交资格。
- 不禁止控制工作台预览、自由探索或学生手动调整控制参数。
- 不删除历史 `AIIntervention`、Memory 或反馈记录。
- 不重建通用 Konling 干预系统；本变更只关闭控制工作台的客户端自报生产通道。

## Decisions

### 1. Make the official result companion the only production surface

从控制工作台壳层移除旧手填陪伴面板及其“记录尝试/成功失败/生成建议”流程。正式评测结果面板中的陪伴卡继续作为唯一生产入口，在正式提交完成后按既有规则自动决定是否显示建议和回访。

如果其他非正式教学页面将来需要手工复盘，应使用明确的本地草稿或独立变更；不得复用受治理 Arena 干预身份。

### 2. Fail closed on client-authored Arena intervention requests

Arena 干预写入必须从服务端读取并验证一份属于当前认证学生、当前任务的正式提交引用。仅提供 `studentState`、`arenaTaskId` 和 `method` 的客户端请求不能创建 Arena 干预、evidence、Memory 或反馈身份。

由于当前生产调用者只有旧面板，可以删除 Arena 分支、删除整个未使用生成端点，或把端点改为只接受正式提交身份；选择最小且与其他已验证非 Arena 调用兼容的实现。无论实现形式，客户端自报状态都不能到达 Arena 持久化路径。

### 3. Resolve method-aware context from official evidence

正式提交的任务身份和控制器产物决定当前方法，再由任务目录和 `MetricProfile` 解析参数标签、指标和教学建议。客户端方法值只能作为路由定位提示，并必须与正式提交一致，不能覆盖提交证据。

旧 `control-method-aware-companion-guidance` 中“practice observation”触发持久化干预和按任务/方法时间冷却的语义由正式提交轮次取代。去重使用作用域内正式提交引用，下一份同任务正式提交可以开始新的轮次。

### 4. Preserve legacy rows without granting authority

不删除既有客户端自报 `AIIntervention`、evidence 或 Memory。读取正式陪伴基线和回访时，只接受包含可验证官方提交引用且通过学生/任务作用域校验的记录。旧记录可以继续作为审计历史，但不得补造官方提交引用或被描述为正式评测证据。

## Risks / Trade-offs

- [Risk] 删除旧面板后学生认为少了调参入口。 -> 正式结果卡继续给出基于真实结果的调整方向，参数编辑和预览仍在工作台原位置。
- [Risk] 通用干预路由存在未检出的非 Arena 调用。 -> 先通过生产引用扫描和契约测试确认调用面，再选择删除路由或仅关闭 Arena 客户端分支。
- [Risk] 历史旧记录被正式读取器误纳入。 -> 以可验证官方提交引用作为硬资格，缺失引用的记录保持历史但不参与轮次。
- [Risk] 任务方法解析与正式控制器产物不一致。 -> 服务端从提交和任务目录共同解析并 fail closed，不使用客户端选择纠正官方记录。

## Migration Plan

1. 增加证明旧面板可达、客户端状态可写入以及正式读取器必须排除旧记录的失败测试。
2. 关闭控制工作台旧入口并使 Arena 客户端自报请求在持久化前失败。
3. 将方法上下文和去重完全绑定到正式提交，验证下一次正式提交仍可形成新轮次。
4. 运行 focused tests、typecheck、严格 OpenSpec 校验及正式结果页面桌面端/320px 浏览器验收。

Rollback 可以恢复界面代码，但不得在未恢复明确非正式隔离语义的情况下重新开放客户端干预写入。
