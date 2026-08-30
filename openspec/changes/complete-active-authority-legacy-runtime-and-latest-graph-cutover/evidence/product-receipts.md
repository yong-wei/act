# 产品收据边界

本变更将候选生成、部署、激活、产品验收与回滚演练视为五类独立收据。任一上游收据存在，都不能替代后续阶段的实际执行与验收。

## 1. Candidate receipt（provider）

- 所有者：`coordinate-latest-authority-and-active-oss-cutover` provider。
- 已有候选收据用于密封 Authority、Teaching Projection、领域 fragments、shards、prerequisites、formal resource、consumer activation 与 Runtime 候选身份。
- 候选新鲜度、候选可重开或候选 Runtime 已物化，不代表生产 selector 已切换，也不代表 `/knowledge` 产品验收完成。

## 2. Deployment receipt（尚未执行）

- 所有者：本变更后续部署步骤。
- 当前未执行应用镜像构建与 ECS 部署，因此不存在可声明完成的 deployment receipt。
- 镜像构建、镜像装载或应用部署只证明应用修订到位，不能证明图谱 selector、Teaching fragments 或 active Runtime 已形成 coherent cutover。

## 3. Activation receipt（provider 10.7）

- 所有者：provider 的独立停服激活事务。
- 激活收据必须由 provider 10.7 产生，并绑定最终 `coordinated-active-receipt/v1`、生产 selector 回读及 active Runtime identity。
- 本变更只读消费该收据，不写 selector、不推进 Runtime lifecycle，也不补造事务收据。

## 4. Product acceptance receipt（未完成）

- 所有者：本变更。
- 当前尚未执行生产构建、部署和生产浏览器验收，因此 product acceptance 保持未完成。
- 只有只读 latest-cutover verifier 对最终 active receipt 及全部 immutable members 校验通过，且 `/knowledge` 共享 Force Graph 展示同一 successor 的非空 Teaching 关系与资源身份后，才可形成产品验收收据。

## 5. Rollback rehearsal receipt（未执行）

- 所有者：provider 的回滚权限边界与本变更的只读消费验收。
- 当前未执行 identity-matched rollback rehearsal，因此不存在 rollback rehearsal receipt。
- 前任组合可被 verifier 识别为 `predecessor` 且保持服务正确，但 `latestCutover.ready` 必须为 `false`；这不是 successor cutover 成功。

## 结论

截至本记录，candidate evidence 与 activation/provider evidence 仍按各自来源独立保留；deployment、product acceptance 和 rollback rehearsal 未执行。不得把镜像部署、数据库导入、候选 recency、单个 selector 存在或前任可回退解释为 cutover 已完成。
