## 1. 解锁链路展示模型

- [x] 1.1 新增 `src/lib/adaptive-path-unlock-chain.ts`，定义学生可见的解锁链路结构与派生函数
- [x] 1.2 从 `readiness.missingCompletedNodeIds`、`missingEvidenceCount`、`missingCompetencies`、`missingOutcomeRefs` 生成缺失条件
- [x] 1.3 缺失节点 ID 优先映射为路径内节点标题，未知 ID 不暴露原始 ID
- [x] 1.4 按“完成节点 -> 结果/证据 -> 能力”排序，只输出未满足条件
- [x] 1.5 实现 `fallbackNodeIds` / `prerequisiteNodeIds` / `unlockMessage` 降级，并保留“暂时无法展示具体解锁条件”兜底
- [x] 1.6 解析下一步解锁动作，有可执行目标时输出目标，无目标时仅输出文本

## 2. 路径选项预览

- [x] 2.1 在路径选项预览构建层为锁定节点补充解锁链路
- [x] 2.2 在 `PathOptionRoutePreview` 渲染锁定原因、缺失条件与下一步动作
- [x] 2.3 有目标时渲染动作链接/按钮，无目标时只显示文本

## 3. 执行时间线与节点详情

- [x] 3.1 扩展 `PathExecutionNodeView`，增加可选 `unlockChain`
- [x] 3.2 从 `pathPlan.mainPath[].readiness` 填充执行时间线节点的解锁链路
- [x] 3.3 在节点展开详情中展示解锁链路
- [x] 3.4 锁定操作区展示下一步动作，并保持节点不可启动

## 4. 测试

- [x] 4.1 为解锁链路函数补充单元测试，覆盖多条缺口、字段缺失、未知 ID、无目标降级
- [x] 4.2 为路径选项预览补充测试，断言锁定节点显示结构化解锁链路
- [x] 4.3 为执行时间线补充测试，断言锁定节点详情显示解锁链路且不暴露内部字段

## 5. 验证

- [x] 5.1 运行 `openspec validate --change add-adaptive-path-unlock-chain-explanation --strict`
- [x] 5.2 运行相关 Vitest 定向测试
- [x] 5.3 运行 `npm run typecheck`

## 6. 提交与 PR

- [x] 6.1 将 grill 决策文档、OpenSpec change 与实现代码一并提交
- [x] 6.2 更新 issue #1167 状态并创建关联 PR

## 7. 基线门禁依赖与最终收尾

- [ ] 7.1 建立独立基线修复 PR，修复共享 adaptive-path 13 状态捕获合同及其定向测试，不提交将被本 PR 淘汰的产品证据
- [ ] 7.2 在该基线 PR 的最终 HEAD 通过完整 `npm run test` 与 current-HEAD 审查后合并至 integration
- [ ] 7.3 以 merge 方式将基线修复同步至 #1169，并在最终组合 HEAD 重新采集 adaptive-path 13 个状态与 `/knowledge` 完整矩阵；展开状态必须验证真实的导航展开与 Dock 辅助菜单，不改变禁用动作语义
- [ ] 7.4 在 #1169 最终组合 HEAD 通过完整 `npm run test`、current-HEAD 审查与合并门禁后合并并关闭 #1167
