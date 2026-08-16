# Handoff: #1411 `publish-actkg-v018-cutover-runtime`

状态: **资格已 READY；镜像/部署仍未授权**  
日期: 2026-08-16  
工作树: `/Users/YW/.codex/worktrees/act-dev1`（永久隔离树 `dev1`；旧路径 `e734/act.just.edu.cn` 已废弃）

## 一句话

fail-closed 发布门禁已合入 `integration`。选项 1 overlay 之后，密封资格报告已是真实 READY，发布器 pin 已改到新文件哈希。五个生产指针仍是 v0.9。不要归档本 change，不要关闭 #1411，不要认领 #1412，不要在未再授权时跑 `scripts/build.sh`。

## 已完成

| 项 | 值 |
| --- | --- |
| PR | https://github.com/yong-wei/act/pull/1425 `MERGED` |
| merge | `b8fd87fc94ac4d060f1c01768169702f8a6231c4` |
| 审查 HEAD | `a3229cfe49fb5c169c91c7c101ad62d3caa427f4` |
| 清场 | https://github.com/yong-wei/act/pull/1425#issuecomment-5303626488 |
| threads | 9/9 resolved |
| CI | 本仓库 PR 无检查（`statusCheckRollup: []`） |
| Issue | https://github.com/yong-wei/act/issues/1411 OPEN `status:blocked` |
| OpenSpec | 仍在 `openspec/changes/publish-actkg-v018-cutover-runtime/`，仅 1.1 勾选 |

合入代码：

- `src/lib/teaching-projection/publish/v018-runtime-release.ts`
- `scripts/knowledge-cutover/publish-actkg-v018-cutover-runtime.ts`
- `src/lib/__tests__/publish-actkg-v018-cutover-runtime.test.ts`

门禁：资格必须是封存字节（单次 read → hash+parse）、digest/身份绑定、blockers 为空、isolatedRollback.advanced+restored、dualRebuild.byteEquivalent、六消费者 READY、五个 v0.9 指针哈希匹配、Docker ≥ 20 GiB，然后才允许 `scripts/build.sh` 并重哈希 image tar。

## 阻断原因（真实，不要绕过）

历史 BLOCKED 报告（`receiptDigest=219c9232…`，文件 sha256 `fafdcf2a0644971f…`）已被正式 qualify CLI 覆盖为 READY：`receiptDigest=84f6c18a493cea53db193904f49778da80fab50fd5b8e5c1c3060aacfc781bc1`，文件 sha256 `94b66f3a39b450da79c2016abe6deeed7a21486b7fab72f6f96073282e6a1f9f`。该 READY 来自 `admit-actkg-v018-neighborhood-zh-cn-labels`，不是手改旧报告。

主要 blockers：`isolated-shard` 标签不可用、`teaching-dual-replay-trees-absent`、`isolated-five-selector-incomplete`。

用已交付 resolver 复核：10 个 catalog member 可解析；邻域扩展 506 个节点中有 **25** 个非 catalog 对象 zh-CN 标签不可用（`A/D转换器`、`G(s)=1/s^2` 等被安全分类器拒绝）。已接纳 `multilingual-label-index.jsonl` 对这 25 个 ID **零行**，engineering 也没有 `preferred_labels`。本会话不能发明“已接纳”标签，也不能擅自开 OpenSpec 改分类器。Teaching 候选没有 `replay-1`/`replay-2`。

因此 live CLI 返回 `status=BLOCKED`、`imageBuilt=false`、`qualification-not-ready`。这是正确失败，不是环境缺失：Docker 24/8 已配，`scripts/build.sh` 存在。

## 五个生产指针（必须保持）

| 指针 | 身份 | sha256 |
| --- | --- | --- |
| authority | v0.9 / `snap-7f4cdd10…` | `086f14793fbf2aa3…` |
| projection | `proj-769b1a83…` | `cf553630400a297d…` |
| prerequisites | `proj-b8100a7f…` | `a040258e8efef848…` |
| authority-domain-shards | `ads-6328487e…` | `9613304cbaee9c3e…` |
| consumer-activation | `first-cutover-7f4cdd1084af-769b1a832622` | `e73ac1abd0d691c6…` |

## 恢复后立刻要做的事

1. 密封资格已是真实 READY。继续 `#1411` tasks 1.2–3.5（镜像/`scripts/build.sh`）仍需用户明确授权；不要把选项 1 当成构建授权。
2. 继续时只用 `buddy-auto.mjs --issue 1411`，不要认领 `#1405`，不要无目标跑。
3. `#1412` 还需要用户单独给出生产切换授权。没有授权就停。
4. Prisma 曾报告 3 个未应用迁移；未在本轮执行，恢复后重新核验，不要静默 migrate。

## 明确不要做的事

- 不要伪造 READY 资格或 runtime-release receipt
- 不要在资格 BLOCKED 时跑 `scripts/build.sh` 或远端部署
- 不要改五个当前选择器
- 不要 `openspec archive` 本 change
- 不要把 #1411 标成 `status:archived` 或关闭
- 不要认领或实施 #1412
- 不要在永久工作树里再嵌套 worktree
