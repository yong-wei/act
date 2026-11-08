# Tasks: issue-2152-p1（阶段 1）

- [x] T1 Prisma 模型 StudentModelArtifact / ComparisonArtifact + 迁移 + generate
- [x] T2 zod 契约模块（结构判别联合/比较模式/保存载荷/窗口不重叠校验）
- [x] T3 服务端规范序 sha256 contentHash
- [x] T4 API：student-model-artifacts POST/GET/[id] + comparison-artifacts POST/GET
- [x] T5 Vitest：Rust serde 样例往返、非法载荷拒绝、哈希确定性
- [x] T6 typecheck + 数据治理门禁 + strict validate

# 阶段 2a（生效运行信封）

- [x] T7 Prisma 模型 AppliedRunEnvelope + 迁移 + generate
- [x] T8 zod 信封契约（seed 十进制字符串、因素掩码数组、首采样回执）
- [x] T9 API /api/ilab/applied-run-envelopes（upsert 开启/收口 + 本人读取）
- [x] T10 Vitest 契约测试
- [x] T11 typecheck + strict validate
