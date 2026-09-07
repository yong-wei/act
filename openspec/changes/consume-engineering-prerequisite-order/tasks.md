## 1. 采用通道

- [ ] 1.1 `prerequisites/contracts.ts`：`prerequisite` 谓词纳入 post-requisite 采用通道（连接两个现行权威对象即可采用为 REQUIRED，工程出处随附），单测覆盖采用与拒绝两态
- [ ] 1.2 修复候选生成空转：ENGINEERING 来源候选真实产出（当前 proj-d55c3ac4 candidates=0），候选生成单测以 r6 的 79 条边为夹具
- [ ] 1.3 采用治理：采用/拒绝逐条收据（绑定 r6 快照与边身份）；与教学设计证据冲突时教学优先并记录例外

## 2. 发布物重建

- [ ] 2.1 重建 prerequisites 发布物（新 proj-*），含采用后的工程先后修边；无环与端点闭合门禁复用既有条款
- [ ] 2.2 切换 `runtime/knowledge/prerequisites/current.json` 到新发布物，旧物保留可回滚

## 3. 消费与诊断

- [ ] 3.1 planner 对采用后的工程顺序边生效（排序约束/就绪门控），路径诊断区分「教学编排顺序」与「工程学习顺序」来源
- [ ] 3.2 端到端：以 control-correction 目标生成路径，断言工程学习顺序约束实际参与排序且解释可见

## 4. 验证

- [ ] 4.1 prerequisites 与 planner 定向测试；`rtk npm run test:unit`、`rtk npm run typecheck` 通过
- [ ] 4.2 `rtk openspec validate consume-engineering-prerequisite-order --type change --strict` 通过
