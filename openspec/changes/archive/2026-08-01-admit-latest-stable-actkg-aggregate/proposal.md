## Why

ACT 的阶段性权威快照固定在旧的候选链端点，而 ActKG 会继续发布新的稳定 Aggregate。最终课程审核必须从可重复解析、可验证继承且与生产权威隔离的最新候选输入开始，不能依赖目录名、固定版本常量或静默回退。

## What Changes

- 动态解析 ActKG 当前最新稳定且已授权的 Aggregate，并冻结完整身份和解析摘要。
- 验证新端点相对 ACT 已接纳链的 successor/predecessor、Bundle、Schema、Release Diff 和 Canonical 身份闭包。
- 原子暂存完整候选链，在隔离数据库边界完成导入和 Delta 交叉校验，生成不可变接纳凭据。
- 当最新版缺少兼容工件、发生漂移或无法唯一解析时 fail closed；保持全部生产 selector 与 writer fence 不变。

## Capabilities

### New Capabilities

- `latest-stable-actkg-aggregate-admission`: 定义最新稳定 Aggregate 的动态解析、兼容链验证、隔离候选导入和 Delta 接纳合同。

### Modified Capabilities

无。

## Impact

- 影响 `scripts/actkg-release/`、`scripts/knowledge-cutover/`、聚合治理库和对应测试。
- 读取 ActKG 发布仓库和候选数据库，但不修改 ActKG 语义对象，也不改变 ACT 生产权威。
- 为后续当前 CourseCoverage worklist 提供唯一、不可变的输入身份。
