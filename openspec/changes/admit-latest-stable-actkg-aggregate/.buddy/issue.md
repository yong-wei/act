<!-- openspec-buddy change_id: admit-latest-stable-actkg-aggregate -->

## Goal

动态接纳 ActKG 当前最新稳定 Aggregate，证明兼容链、隔离候选导入和 Delta 闭合，同时保持生产权威不变。

## Scope

- 解析并冻结最新稳定 Release/Bundle/Schema/来源身份。
- 验证 successor chain，原子暂存并在隔离数据库导入。
- 生成可重放的 candidate 与 Delta 接纳凭据；缺失兼容包时失败关闭。

## Acceptance

- [ ] AC1 最新候选只能由正式发布事实唯一解析，不允许固定版本或旧版回退。
- [ ] AC2 successor/predecessor、Bundle、Schema、身份和 Delta 全部闭合。
- [ ] AC3 隔离导入与不可变凭据通过篡改、漂移和重放测试。
- [ ] AC4 所有生产 selector 与 writer fence 保持不变。

## Evidence

- OpenSpec strict validation、定向测试、typecheck、接纳凭据和 selector 负向证明。

## Reviewer Check

- 独立审核须核对 AC1–AC4、任务与证据映射，并确认没有把候选接纳表述为生产切换。
