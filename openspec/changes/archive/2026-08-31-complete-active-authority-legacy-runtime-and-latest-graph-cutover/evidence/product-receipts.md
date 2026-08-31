# 产品收据边界

本变更将候选生成、部署、激活、产品验收与回滚演练视为五类独立收据。任一上游收据存在，都不能替代后续阶段的实际执行与验收。

## 1. Candidate receipt（provider）

- 所有者：`coordinate-latest-authority-and-active-oss-cutover` provider。
- 已有候选收据用于密封 Authority、Teaching Projection、领域 fragments、shards、prerequisites、formal resource、consumer activation 与 Runtime 候选身份。
- 候选新鲜度、候选可重开或候选 Runtime 已物化，不代表生产 selector 已切换，也不代表 `/knowledge` 产品验收完成。

## 2. Deployment receipt（v0.6.1）

- 所有者：本变更 6.4。
- GitHub Release：https://github.com/yong-wei/act/releases/tag/v0.6.1
- 冻结修订：`93a70aed4d51a366ecf5cb4e9a86d06c41c4bbed`
- 镜像：`localhost/act-obe-platform:v0.6.1-93a70ae`
- tar SHA-256：`bd05509871dbd0902c0f5cbab6c555e22bcda3783c46e5f5a6ee4f039c01b0b5`
- provenance：`deploymentScope=app-only`
- 部署：`deploy:app --skip-build`；app/worker 均为该镜像；公网 `readyz` 通过
- 未改 Runtime identity，未 `deploy:runtime`
- 镜像构建或应用部署只证明应用修订到位，不能单独证明 Teaching 关系已进入产品面

## 3. Activation receipt（provider 10.7）

- 所有者：provider 的独立停服激活事务。
- 事务：`tx-7cf89677-b091-4508-80ce-c8d9fa132c8a` COMMITTED
- Runtime：`runtime-150a505ac26b2130278fa269f41830f83a9d97658db4afd0aedddde`
- 独立 receipt generation：30（与 `act-runtime-selection.json` 一致；不是 10.7 当时的 44）
- 本变更只读消费该收据，不写 selector、不推进 Runtime lifecycle，也不补造事务收据

## 4. Product acceptance receipt（v0.6.1 + successor Teaching overlay）

- 所有者：本变更。
- 读取时 overlay 已安装：Teaching `c9a6f33e…`、composed domain-fragments `eb4d2d63…`；密封 shard set 仍为 `ads-c462da19` / `c462da19…`（未重物化）
- 只读 latest-cutover：`ready=true`，`combination=successor`，`reasons=[]`
- 合格领域 `root-locus` / `frequency-domain-analysis` 为 `teaching.status=available` 且 `teachingRelations>=1`；`system-modeling` 为 `partial`；JSON 与浏览器均无「教学关系暂不可用」
- 产品验收细节见 `evidence/production-acceptance-v061.md`

## 5. Rollback rehearsal receipt（只读，未写 selector）

- 所有者：provider 的回滚权限边界与本变更的只读消费验收。
- 候选密封 `predecessorRuntimeLifecycleGeneration=42`；现行 generation=30，因此现网不是 identity-matched predecessor
- 聚焦测试证明：identity-matched predecessor 时 `ready=false` 且 `combination=predecessor`；前任 release 配漂移 generation 时 fail-closed
- 未执行真实 selector 回滚；回滚仍归 provider
- 前任组合可被 verifier 识别为 `predecessor` 且保持服务正确，但 `latestCutover.ready` 必须为 `false`；这不是 successor cutover 成功

## 结论

candidate、deployment、activation、product acceptance 与 rollback rehearsal 按各自来源独立保留。v0.6.1 应用部署加上 successor Teaching/domain-fragments overlay 后，产品面已按 successor 验收；不得把单独的镜像部署、数据库导入、候选 recency 或 selector 存在解释为 cutover 已完成。
