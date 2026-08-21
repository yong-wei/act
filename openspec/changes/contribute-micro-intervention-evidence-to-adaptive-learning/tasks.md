## 1. 证据投影与身份

- [ ] 1.1 定义微干预 evidence envelope、唯一 identity、outbox/projector 状态、算法版本和 drift/limitation schema
- [ ] 1.2 将 outcome、验证题、来源答案、学习目标、Canonical/Authority/Projection/resource 和 capture identity 原子闭合
- [ ] 1.3 实现 append-only、幂等 projector；身份不完整、候选知识或混合修订时不创建部分 LearningFact

## 2. 质量、重复与隐私政策

- [ ] 2.1 将资源打开、动作完成、提示和客户端完成设为 context-only/零 profile weight
- [ ] 2.2 为独立验证定义保守权重、单次上限、重复间隔、时间衰减、冲突、撤销和重放规则
- [ ] 2.3 实现私有证据与学生/公开投影分层，并按独立学习者执行小样本抑制

## 3. 掌握度与路径影子接入

- [ ] 3.1 扩展 mastery rebuild 消费治理后的投影，保证相同输入/算法得到相同 posterior、confidence 和 limitations
- [ ] 3.2 以影子模式向 path planner 提供 evidence summary，禁止读取原始答案或由参与事件直接改路径
- [ ] 3.3 校准后通过独立 feature flag 启用有界贡献，保持 readiness/checkpoint/terminal-validation 门禁

## 4. 数据治理与验证

- [ ] 4.1 增加 projector 幂等、重复投递、短期重复、冲突、衰减、身份漂移、撤销和算法重放测试
- [ ] 4.2 在 production-like PostgreSQL 验证 outbox、LearningFact 唯一性、mastery 重算和 path limitation
- [ ] 4.3 验证学生/公开输出无答案、提示正文、用户标识、本机路径或可逆 option 引用
- [ ] 4.4 运行数据治理、相关单元/集成、typecheck 和 OpenSpec strict validation；未完成校准时保持 consumer flag 关闭
