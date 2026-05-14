# Arena V2 Deep Integration — Implementation Tasks

## 1. Gain 等价性与无效任务分析清理

- [ ] 1.1 创建 `src/features/arena/__tests__/multi-representation-artifact-mapper.test.ts`，覆盖 PID/PI/PD/lead/lag/lead_lag 六种校正结构的 gain 等价性
- [ ] 1.2 在 `useMultiRepresentationLinkageModel` 中增加 `shouldRunControlAnalysis` 判断，无效和不兼容 arenaTask 不启动 `useControlEngine`
- [ ] 1.3 验证 `npm run lint` + `npm run test:unit` 通过

## 2. 协议版本按方法族拆分

- [ ] 2.1 修改 `protocol.ts`：新增 `template-whitebox-v1`、`analysis-whitebox-v1`（预留）、`blackbox-v1`、`code-sandbox-disabled-v1`
- [ ] 2.2 `getArenaEvaluationProtocolVersion` 接收 `{ taskId, method }` 参数，按对象类型 + method 返回协议版本
- [ ] 2.3 更新 `createPersistedArenaSubmission` 和 `prisma-store listSubmissions` 的调用路径以匹配新签名
- [ ] 2.4 更新现有测试中的 protocolVersion 引用，新增同 task 不同 method 的协议版本测试
- [ ] 2.5 验证 `npm run build` + `npm run test:unit` 通过

## 3. Metric Provider 接入评测主链路

- [ ] 3.1 在 `evaluateWhiteBoxSubmission` 中通过 `selectWhiteBoxMetricProvider(method)` 获取 provider，调用 `provider.evaluate()` 替代直接调用 `estimateMetrics`
- [ ] 3.2 实现 `selectWhiteBoxMetricProvider(method): WhiteBoxMetricProvider`
- [ ] 3.3 让 `evaluateWhiteBoxSubmission` 编排流程：validateConfig → summarizeController → evaluateHardConstraints → provider.evaluate() → evaluateMetricProfile
- [ ] 3.4 复用 `metric-profile-evaluator.ts` 的 `evaluateMetricProfile` 作为最终评分步骤
- [ ] 3.5 验证评测结果与旧 `evaluateWhiteBoxSubmission` 对于 PID/serial-compensator 的一致性
- [ ] 3.6 验证 `npm run lint` + `npm run test:unit -- src/features/arena` 全部通过

## 4. ControlAnalysisResult 衍生指标补齐

- [ ] 4.1 在 `metric-extraction.ts` 中实现 ITAE 从 `stepResponse.points` 数值积分计算
- [ ] 4.2 新增 `ArenaMetricSource` 类型：`control-analysis` / `derived-from-response` / `derived-from-controller` / `scenario-evaluation` / `blackbox-official` / `unavailable`
- [ ] 4.3 在 `ExtractedMetrics` 中为每个字段增加 `source` 标记
- [ ] 4.4 `controlEnergy` 标记为 `derived-from-response`，`hiddenScenarioWorst` 等不可算指标标记 `unavailable`
- [ ] 4.5 不可算指标（`source=unavailable`）不得参与 `normalizeMetricValue` 评分
- [ ] 4.6 验证 `npm run lint` + `npm run build` 通过

## 5. 自由探索模式与模型选择面板

- [ ] 5.1 `ArenaModelSelectorPanel` 在无 `arenaContext` 时也渲染，标注"自由探索，未绑定竞技场任务"
- [ ] 5.2 `page-client.tsx` 向 `ArenaModelSelectorPanel` 传入 `onSelectObject` 回调
- [ ] 5.3 `useMultiRepresentationLinkageModel` 新增 `selectArenaObjectForExploration(objectId)`，读取对象 model + workbenchSeed 并设置 poles/zeros/gain
- [ ] 5.4 自由探索模式下不渲染 `ArenaSubmitPanel`
- [ ] 5.5 不兼容对象跳转改为从 `ARENA_CHALLENGE_TASKS` 推导，不再硬编码，移除 `as any` 构造
- [ ] 5.6 验证 `npm run lint` + `npm run build` 通过

## 6. 黑箱适配器接入已有实验服务

- [ ] 6.1 将 `createCruiseRollBlackBoxAdapter` 的 `runPublicExperiment` 标记为 `createMockAdapterForTests`，或删除随机实现改为调用 `createArenaBlackBoxExperiment`
- [ ] 6.2 确认所有黑箱实验仍通过 `/api/arena/blackbox-experiments` 产生，预算、持久化、归属校验不被绕过
- [ ] 6.3 验证 `npm run build` + 黑箱相关测试通过

## 7. 埋点与 LearningFact 物化

- [ ] 7.1 `telemetry.ts` 从 `arena-event-dictionary.ts` 导入 `ARENA_CORE_EVENT_TYPES`，消除重复定义
- [ ] 7.2 在数据治理层新增 Arena 事件 → LearningFact 物化映射（`arena_submission_valid`、`arena_submission_failed_constraint`、`arena_identification_model_saved`）
- [ ] 7.3 验证 `/api/interactive/events` 能写入 Arena 事件到 `InteractionLog`
- [ ] 7.4 新增测试覆盖 valid / invalid / blackbox 三类事件的 LearningFact 生成
- [ ] 7.5 验证 `npm run lint` + `npm run test:unit` 通过

## 8. Barrel 拆分

- [ ] 8.1 创建 `src/features/arena/domain.ts` — types, seed selectors, capabilities, context, metric-mapping
- [ ] 8.2 创建 `src/features/arena/client.ts` — telemetry, client panels
- [ ] 8.3 创建 `src/features/arena/server.ts` — evaluator, persistence, prisma store, adapters
- [ ] 8.4 `model.ts`（client hook）改为 `import from '@/features/arena/domain'`，不经过总入口导入 server 模块
- [ ] 8.5 保持 `index.ts` 向后兼容，添加注释标注分块
- [ ] 8.6 验证 `npm run build` 不引入循环依赖或模块解析错误

## 9. PR 范围清理

- [ ] 9.1 从 Arena PR 中移除 `.claude/settings.json`（拆为独立提交或独立 PR）
- [ ] 9.2 确认 `CLAUDE.md` 若需保留则说明为项目级 agent 配置
- [ ] 9.3 验证 `npm run build` + `npm run test` 全部通过后提交
