## 1. Dependency and evidence baseline

- [x] 1.1 确认六项 G 系列 active Authority 依赖均已完成或由父任务明确解除阻塞，并冻结 active read、hash、rollback、candidate/legacy 和 role-isolation characterization。
- [x] 1.2 建立 `src/app`/`src/features`/runtime read、scripts/tooling、operator、test、historical 的完整 import/dynamic-caller 清单，绑定当前 Git revision/tree。
- [x] 1.3 按 compatibility slice 记录 owner、真实消费者、替代入口、回滚用途、删除条件和验证证据；缺项保持 retained/blocked。

## 2. Read/tool boundary

- [x] 2.1 将 active knowledge/resource runtime callers 收敛到现有 typed read contract、resource index/eligibility 和 safe launcher descriptor。
- [x] 2.2 移除产品 graph 对 release/qualify/publish/cutover/rollback writer 的导入；必要的纯读取 helper 以最小边界迁移，不新增第二套 registry 或 manifest。
- [x] 2.3 保持内容 authoring→runtime、Authority/Projection binding、manifest/hash 校验和 fail-closed artifact drift 行为。

## 3. Compatibility retirement

- [x] 3.1 对 v1/v2/v022 bundle/display compatibility 及 ledger 中的相关 slices 逐项取得 replacement、zero-consumer、rollback 和负向测试证据。
- [x] 3.2 删除仅被已迁移生产/工具调用者使用的 compatibility slice 及重复测试；保留真正的滚动部署、跨版本回滚和历史审计消费者。
- [x] 3.3 更新静态依赖 allowlist/retirement proof，证明每个 publication operation 仍由唯一 tool entrypoint 拥有。

## 4. Verification and scope guard

- [x] 4.1 验证学生/教师/管理员读取的 active、candidate、legacy 角色隔离与 hash/rollback 行为，且 preview 不成为 official 输入。
- [x] 4.2 确认 diff 未修改 Authority selector、domain shard、ActKG/Teaching Projection schema 或 production Authority。
- [x] 4.3 运行 read/tool boundary tests、compatibility retirement tests、受影响 domain suite、`rtk npm run typecheck`、`rtk openspec validate separate-knowledge-runtime-read-from-release-tooling-and-retire-verified-compatibility-slices --type change --strict` 和 `rtk git diff --check`。
