## Context

密封 v0.18 `multilingual-label-index.jsonl` 恰有 1909 行，是 Bundle v2 接纳不变量。邻域扩展到 506 个节点后，25 个非 catalog 对象没有索引行，displayName 又通不过 `isSafeAuthorityLabel`（斜杠、`A/D`、路径样公式、长句）。Teaching 候选双重建只记下 ID，没有写出 `replay-1`/`replay-2` 树。用户授权选项 1：接纳 25 条分类器安全短中文标签，不改分类器、1909 pin 或邻域范围。

## Goals / Non-Goals

**Goals:**
- 为 25 个稳定 ID 提供已审核、分类器安全的 zh-CN `canonical_preferred` 标签
- 在同一 v0.18 snapshot 上解析这些标签
- 保持密封 1909 行索引与 Formula pin 不变
- 写出字节等价的 teaching `replay-1`/`replay-2`
- 重新跑资格得到真实 READY

**Non-Goals:**
- 改写密封 Bundle 或把 1909 改成 1934
- 放宽分类器、缩小邻域、新增 Formula pin
- 切换五个生产选择器或实施 `#1412`

## Decisions

- Overlay 是 snapshot 绑定的 reviewed 行，不是另一套 registry。解析器仅在 release/snapshot/hash 全匹配时合并。
- 密封索引仍是 1909 行。其中 7 个目标 ID 已有分类器不安全的 `canonical_preferred`，3 个只有 alternative。overlay 替换不安全 preferred，补上缺失 preferred，并省略这些 overlay 实体上不安全的 alternative，避免别名把整个对象打成 unavailable。
- 合并后同一实体仍只能有一条 zh-CN preferred；重复必须 fail closed。
- Teaching 双回放树是候选产物的字节拷贝，prepare CLI 以后也要写出它们。

## Risks / Trade-offs

- Overlay 是第二标签源。用 snapshot 三元组绑定并 fail closed，避免跨 release 搜索。
- 真实 READY 会改变资格文件哈希；发布器 pin 必须改为新哈希，否则 `#1411` 仍会拒绝。
- 五个生产指针必须保持 v0.9。
