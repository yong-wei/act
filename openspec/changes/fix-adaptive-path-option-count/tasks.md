# Tasks

- [ ] 1. `starterPathPolicy` 类型与 control-correction 注册定义增加 `targetOptionCount: 3`，移除 `minOptions` 旧语义并保持类型向后兼容迁移
- [ ] 2. `buildPolicyBundle` 族解析改为请求族优先：requestedFamilies 非空时不再并入 primaryPolicyFamily，并校验族数与 targetOptionCount 一致
- [ ] 3. 规划器单测：starter 注入三类场景断言候选恒为 3 且不含主族路线；资源不足 fallback 不以第 4 条补数
- [ ] 4. 候选批次持久化与 `buildSerializablePathOptions` 测试断言 `candidateCount === 3`、`ordinal` 连续 1..3
- [ ] 5. `path-advisor-tool` generate 合同测试断言响应 `optionCount === 3`；页面候选卡片数量合同测试补 3 卡断言
- [ ] 6. 更新受影响的既有测试断言，运行 `typecheck` 与 personalization 相关测试套件
