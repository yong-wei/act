## 1. 采纳工程先后修

- [ ] 1.1 从当前 Authority 工程关系枚举 `post-requisite` 族，映射为 `ACT_TEACHING` `PREREQUISITE` 骨架并写入带工程关系 id 的 provenance
- [ ] 1.2 校验 REQUIRED 子图无环、端点封闭，失败则 fail closed
- [ ] 1.3 添加构建器测试：工程先后修被采纳；association/derived_from 不被采纳；运行时 loader 不从 family shard 推断教学边

## 2. 串联领域概览

- [ ] 2.1 以每个注册领域 domain-default DomainConcept 为分母，检测弱连通分量
- [ ] 2.2 在不反向权威骨架的前提下发布扩展教学边，使每个领域概览弱连通
- [ ] 2.3 孤立概览概念使候选投影失败；覆盖测试覆盖系统建模之外至少两个原 empty 领域

## 3. 物化与验证

- [ ] 3.1 组合新 domain-fragments 投影并重物化 domain-default `teachingRelations` / coverage
- [ ] 3.2 断言 15 个领域默认画布输入的教学边数量与弱连通门禁，且不改 Engineering 字节
- [ ] 3.3 跑 `openspec validate adopt-engineering-prerequisites-into-domain-teaching --type change --strict` 与相关单元测试
