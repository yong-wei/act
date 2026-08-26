## Hard Dependencies

已 qualified 的 `restore-trustworthy-test-command-contracts` 必须满足；本 change 只消费其 command/discovery receipt，不回指本 change 或形成依赖环。

## 1. Characterize current red signals

- [x] 1.1 消费已 qualified 的 `restore-trustworthy-test-command-contracts` command/discovery receipt，在当前 source revision/tree 重新运行 `test:unit` 与 `npm test`，记录 unhandled errors、失败 fingerprint、skip、证据来源和环境限制；若前置未 qualified 则保持 blocked。
- [x] 1.2 对每个 fingerprint 建立 failure inventory，区分产品 defect、测试 defect、已退役测试、run-specific release evidence 和外部 blocker；禁止按“历史债”预先接受。
- [x] 1.3 读取相关 OpenSpec capability、调用者、evidence manifest 和 owner 记录，确认每项 `remove` 或 `release-input` 都有替代权威与删除/迁移条件。

## 2. Close real defects and invalid tests

- [x] 2.1 为真实产品或测试 defect 添加最小回归测试，修复根因并验证原 fingerprint 消失，同时确认没有以宽化断言改变行为语义。
- [x] 2.2 删除已退役、无现行 owner 或只验证历史文字/固定 hash 的无效测试，补充替代 capability、调用图或退役证据。
- [x] 2.3 对当前未处理错误逐项执行修复或删除，不使用 skip、flaky retry、永久 quarantine、超时放宽或环境绕过。

## 3. Move run-specific evidence to release qualification

- [x] 3.1 将 commercial UI、runtime、知识图谱和 OSS 的 capture-bound/run-specific 校验从默认产品命令迁移到具名 release qualification 输入。
- [x] 3.2 为迁移后的 evidence 建立 source revision/tree、schema、hash、freshness、scope、owner 和缺失/漂移 blocker receipt；不得提交凭据或本机绝对路径。
- [x] 3.3 删除默认命令中由历史 evidence 文件触发的隐式失败/通过路径，并增加 release command 缺失输入时的 fail-closed contract test。

## 4. Enforce zero accepted failures

- [x] 4.1 实现 failure disposition/closure validator，拒绝 accepted、quarantine、silent-skip 等未授权状态进入 PR mandatory receipt。
- [x] 4.2 为 unhandled error、assertion failure、invalid test removal、release-input migration 和 external blocker 添加 characterization/contract fixtures。
- [x] 4.3 生成修复/删除/迁移后的 closure receipt，保留失败前 fingerprint、动作证据、当前命令结果和 source identity。

## 5. Verification and handoff

- [x] 5.1 运行 `npm test`、`test:unit` 及受影响领域/契约测试，确认默认范围没有 accepted failure、unhandled error 或未登记 skip；若仍红则保留 blocker，不声称绿色。
- [x] 5.2 运行 `test:release` 的 evidence qualification contract，验证 run-specific failure 已从产品命令移出且缺失输入仍阻断 release。
- [x] 5.3 运行 `rtk openspec validate eliminate-accepted-red-test-baseline --type change --strict` 和 `git diff --check`。
- [x] 5.4 更新测试/发布资格文档与 failure closure receipt，向 TypeScript graph、architecture budget 和 PR/integration gate changes 提供当前无 accepted-failure 的可验证输入。
