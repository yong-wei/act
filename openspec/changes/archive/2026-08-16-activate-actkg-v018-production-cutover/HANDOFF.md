# Handoff: #1412 `activate-actkg-v018-production-cutover`

状态: **生产五选择器已切到 v0.18；收据 READY；待 PR 清场合并**  
日期: 2026-08-16  
工作树: `/Users/YW/.codex/worktrees/act-dev1`

## 一句话

生产 Authority / Teaching Projection / prerequisites / shards / consumer-activation 已原子切到 v0.18。公开 `/api/knowledge/shards/active` 返回 8 个中文领域标签，modeling teaching HTTP 200，六个消费者 READY。v0.9 树与 predecessor bytes 保留。

## 密封身份

| 项 | 值 |
| --- | --- |
| transaction | `v018-cutover-2026-08-16T131321310Z` |
| journalHash | `d4ce69bf9e011521962971aa01400e2950929673f27368ecea6a8212984a46a5` |
| receiptDigest | `4295ffd695aa195620643dcda390e3eacc375b8f4d4a905ebf7eac6aa1e0bb71` |
| authority | `snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed` |
| projection | `proj-17f00f669b22c25126ca4c562e1e019c074a7738502825d2d109a77c47202ba9` |
| shards | `ads-30cd92a6be1035c981428d1cb144e2d1dc37578020b6e99b1b02d41f7c2752af` |
| activation | `v018-cutover-1b64a853dda5-17f00f669b22` |
| image | `localhost/act-obe-platform:v018-94d585ae63a6` |

不要认领 `#1405`。
