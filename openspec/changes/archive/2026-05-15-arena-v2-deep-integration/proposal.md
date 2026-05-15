## Why

当前 Arena V2 PR #5 完成了 Arena 与多表征工作台的 MVP 级深度接入，但仍有 8 个实质性差距：官方评测仍用启发式估算、白箱协议名实不符、模型选择面板未实现自由探索、黑箱适配器绕过已有实验服务、埋点未接入 LearningFact 链、教师/作业/奥德赛仍只是模板、模块 barrel 边界不干净。这导致 Arena 不能作为"统一评测与排行榜层"长期运行，也无法为学生画像和教师洞察提供可信学习证据。必须在当前 PR 基础上完成深度整合，才能将 Arena 推进到实用地步。

## What Changes

- 拆分评测协议版本：`analysis-whitebox-v1` / `template-whitebox-v1` / `blackbox-v1` / `code-sandbox-disabled-v1`，按控制器方法族区分评测口径
- 将 metric provider 体系真正接入 `evaluateWhiteBoxSubmission`，使评测链路不再直接调用 `estimateMetrics`
- 补全 ControlAnalysisResult 衍生指标（ITAE 积分、指标来源标记），禁止不可算指标默默变 0 参与评分
- 实现自由探索模式：`ArenaModelSelectorPanel` 在无 `arenaContext` 时也可显示，接入 `onSelectObject` 切换工作台模型
- 不兼容对象跳转改为从真实 ChallengeTask 推导，不再硬编码
- 黑箱适配器接入已有 `createArenaBlackBoxExperiment` / 预算 / 持久化 / 归属校验链路，移除随机数据生成
- 合并 `telemetry.ts` 与 `arena-event-dictionary.ts` 为单一事件定义源，建立 Arena 事件 → LearningFact 物化映射
- 拆分 barrel：`src/features/arena/{domain,client,server}.ts`，禁止 client hook 从总入口导入 server 模块
- 无效和不兼容 `arenaTask` 不启动默认模型 control analysis hook
- `gain` 等价性测试覆盖 PID/PI/PD/lead/lag/lead_lag 六种校正结构
- 从 Arena PR 中移除 `.claude/settings.json`，拆为独立提交

## Capabilities

### New Capabilities

- `arena-protocol-granularity`: 评测协议按控制器方法族拆分，`analysis-whitebox-v1` vs `template-whitebox-v1` vs `blackbox-v1`；protocolVersion 函数接收 taskId + method 参数
- `arena-metric-provider-integration`: metric provider 体系接入官方评测主链路，`evaluateWhiteBoxSubmission` 通过 provider 获取指标而非直接调用 estimateMetrics
- `arena-metric-sources`: 所有官方指标标记来源（control-analysis / derived-from-response / derived-from-controller / unavailable），ITAE 从 step response 数值积分计算
- `arena-free-explore-model-selector`: 自由探索模式下显示 `ArenaModelSelectorPanel`，接入对象选择回调，切换后刷新工作台图表；不兼容对象跳转从真实任务推导
- `arena-blackbox-adapter-service`: 黑箱适配器接入已有实验服务（预算、持久化、datasetHash、归属校验），移除随机数据生成器
- `arena-telemetry-fact-integration`: 合并事件字典为单一源，Arena 高价值事件物化为 LearningFact（valid submission / failed constraint / identification model save）
- `arena-barrel-split`: 拆分 `src/features/arena/index.ts` 为 `domain.ts` / `client.ts` / `server.ts`，client 文件不从 server barrel 导入

### Modified Capabilities

无现有 spec 被修改（项目当前 `openspec/specs/` 为空，此为首次提案）。

## Impact

- `src/features/arena/evaluation/` — protocol.ts 重写协议划分，whitebox-evaluator.ts 改为编排 provider
- `src/features/arena/workbench/` — artifact-mappers.ts 新增等价性测试，arena-model-selector-panel.tsx 实现自由探索
- `src/features/arena/adapters/` — plant-adapter.ts 回归已有实验服务
- `src/features/arena/` — 新增 domain.ts / client.ts / server.ts barrel 拆分
- `src/features/arena/arena-event-dictionary.ts` / `telemetry.ts` — 合并为单一事件定义
- `src/features/interactive/multi-representation-linkage/` — 模型选择回调接入，无效 task 禁用分析
- `src/lib/data-governance/` — 新增 Arena 事件 → LearningFact 物化
- `.claude/settings.json` — 从 PR 移除
