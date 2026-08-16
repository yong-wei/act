## Why

v0.18 资格因分片邻域 25 个非 catalog 对象缺少分类器安全的 zh-CN `canonical_preferred` 标签而诚实 BLOCKED；teaching 候选也缺少 `replay-1`/`replay-2` 树。用户已授权选项 1：接纳这 25 条已审核短中文标签，而不是改分类器、1909 密封索引 pin 或邻域策略。

## What Changes

- 为上述 25 个稳定 ID 接纳快照绑定的已审核 zh-CN `canonical_preferred` 标签。
- 标签进入与同一 v0.18 snapshot 绑定的 reviewed overlay，不改写密封 `multilingual-label-index.jsonl` 的 1909 行。
- 解析器在该 snapshot 上合并 overlay；现有安全分类器、Formula pin 与邻域扩展保持不变。
- 写出 teaching 候选的字节等价 `replay-1`/`replay-2` 树。
- 重新跑资格 CLI，产生真实 READY 密封报告（不得手改现有 BLOCKED 报告）。
- 不切换五个生产选择器，不认领 `#1412`。

## Capabilities

### New Capabilities

- `actkg-v018-neighborhood-label-overlay`: snapshot-bound reviewed zh-CN labels for the 25 neighborhood objects missing from the sealed 1909 index.

### Modified Capabilities

- `authority-localized-label-projection`: resolver MAY merge a snapshot-bound reviewed overlay after the admitted index.
- `actkg-v018-cutover-qualification`: teaching dual-replay trees MUST exist and be byte-equivalent; READY requires overlay-safe neighborhood labels.

## Impact

- `src/lib/authority-domain-shards/labels.ts` 与 overlay 加载器
- teaching 候选 `replay-1`/`replay-2`
- 资格报告与（若 READY）发布器密封哈希 pin
- 五个生产指针保持 v0.9
