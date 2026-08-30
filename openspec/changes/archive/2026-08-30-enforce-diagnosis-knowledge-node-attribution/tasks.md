# Task: Enforce knowledge-node attribution in diagnosis findings

## 1. 生成端

- [x] 1.1 建立 `knowledge-progress` evidenceRef → nodeId 解析表（来自受治理输入投影行）。
- [x] 1.2 唯一节点 + 未填 → 确定性回填；多节点 + 未填、填入不存在节点、与引用证据不一致 → 拒绝并重试；引用行无节点 → 保持缺省。
- [x] 1.3 system prompt 增加归因要求（知识点发现必须携带一致节点；风险/成绩类发现豁免）。
- [x] 1.4 worker 失败分类接入 `diagnosis-finding-attribution-invalid`（可重试，中文失败原因）。

## 2. 投影层

- [x] 2.1 attribution-limited 为唯一置信原因时，可用性状态表述为"知识节点归因受限"及归因恢复建议；与数据覆盖原因并存时保持现行为。

## 3. 测试与验证

- [x] 3.1 生成端：有效节点自动回填、漏填且多节点被拒绝、不存在节点被拒绝、不一致节点被拒绝、真实无映射保持缺省、非知识发现无节点不受影响。
- [x] 3.2 worker 分类：归因失败可重试、预算耗尽 FAILED + 中文原因。
- [x] 3.3 投影层：归因专属状态标签、混合原因保持覆盖受限、知识发现已归因不受限（#1620 规则回归）。
- [x] 3.4 `npm run typecheck`、相关 Vitest 套件、改动文件 eslint 通过。
