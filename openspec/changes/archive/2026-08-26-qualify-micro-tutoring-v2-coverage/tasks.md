## 1. v2 覆盖审计

- [x] 1.1 增加 v2 覆盖审计配置，固定 135 题分母和阶段计数，并消费 v2 归因/资源/验证工件。
- [x] 1.2 保持 v1 54/108 审计路径与工件只读。
- [x] 1.3 脏工作树、混合修订、摘要不一致、资源或验证漂移时 fail-closed。

## 2. v2 生产资格

- [x] 2.1 实现独立 v2 candidate 回执，绑定 Git、DB capture、工件摘要、测试和浏览器/OCI 证明。
- [x] 2.2 证明资格不等于激活，未授权时生产选择器不变，并保留回滚证据。
- [x] 2.3 扩展 production-like PostgreSQL 与四类入口浏览器证据，不以夹具替代服务端验证。

## 3. 验证与交付

- [x] 3.1 运行相关覆盖审计、资格、编排和 typecheck 测试。证据：v1/v2 coverage audit、qualification unit、coverage/qualification command 与 typecheck 通过。
- [x] 3.2 提交并创建关联 Issue #1522 的 PR。
