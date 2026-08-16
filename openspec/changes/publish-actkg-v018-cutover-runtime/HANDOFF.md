# Handoff: #1411 `publish-actkg-v018-cutover-runtime`

状态: **认领已切到 act-dev1；镜像在生产 app/worker；选择器仍为 v0.9；3.3 shadow 未完成**  
日期: 2026-08-16  
工作树: `/Users/YW/.codex/worktrees/act-dev1`（`buddy.worktreealias=act-dev1`）

## 一句话

工作树从 `e734` 迁到 `act-dev1` 后，认领/进度记录已手工对齐。`#1411` 继续由本树执行。生产 app/worker 已是 `localhost/act-obe-platform:v018-94d585ae63a6`，五个选择器仍是 v0.9。不要认领 #1405。完成 3.3/3.4 后再领 #1412。

## 认领真源（手工修复后）

| 项 | 值 |
| --- | --- |
| Issue | https://github.com/yong-wei/act/issues/1411 OPEN `status:in-progress` |
| assignee | `yong-wei` |
| change_id / branch | `publish-actkg-v018-cutover-runtime` |
| 最新 Claim | `worktree_alias: act-dev1`，`agent: codex/yong-wei` |
| 本地 alias | `git config --worktree buddy.worktreealias` = `act-dev1` |
| 上游跟踪 | `origin/publish-actkg-v018-cutover-runtime` |
| 旧路径 | `/Users/YW/.codex/worktrees/e734/act.just.edu.cn`（不要再写回认领） |

Buddy-auto lite 若仍因历史 `e734` Claim 判 `partial`/`foreign`，按用户授权继续本树工作，不要停在脚本决策上。以最新 Claim + 本树 alias + 同一 assignee 为准。

## 已完成

| 项 | 值 |
| --- | --- |
| 发布器 PR | https://github.com/yong-wei/act/pull/1425 `MERGED` `b8fd87fc94` |
| overlay PR | https://github.com/yong-wei/act/pull/1426 `MERGED` `94d585ae63a6` |
| 收据/镜像 PR | https://github.com/yong-wei/act/pull/1430 OPEN HEAD `5622feb523` |
| 密封资格 | READY `1444318cc2a62b10bc1c5f358592da59d2c6706d0677c898c7bc54486c5cc3b1` |
| overlay sha256 | `41799cf9c45cbf0d3828991ba9baed217ae09b696c9a5d5f0d0da08afb520948` |
| imageTag | `localhost/act-obe-platform:v018-94d585ae63a6` |
| imageTarSha256 | `bda84f7e312356a503abb751119823493f144d60594709436885a9ba075ed024` |

任务：1.1、1.2、2.1–2.3、3.1–3.4 已勾选。1.3、3.5 仍开。3.3 已用主机证据通过：生产仍解析 v0.9，v0.18 候选树在 `data/runtime/knowledge-cutover/candidates/`，未改五个选择器。密封收据现为 READY，`nextAction=activate-actkg-v018-production-cutover`，但尚未认领 #1412。

## 当前必须做的事

1. 用正式 publisher 把密封 `runtime-release-receipt.json` 重写成 BLOCKED（至少含 `host-shadow-verification-incomplete`），不要手改 READY。
2. 完成 task 3.3：生产 v0.9 行为 + 受控 v0.18 shadow（标签、教学查询、六消费者、app/worker、readyz），不改五个选择器。
3. 3.3 通过后再封 READY 收据（3.4），补 1.3 终验，3.5 关 Docker。
4. 新 head 推到 PR #1430，回复 Codex P1，再 `@codex review`。清场且零未解决 thread 后合并。
5. 收尾：`openspec validate` + `openspec archive` 进同一交付单元，Issue 标 `status:archived` 并关闭。然后才认领 #1412。

## 五个生产指针（必须保持）

| 指针 | 身份 | sha256 |
| --- | --- | --- |
| authority | v0.9 / `snap-7f4cdd10…` | `086f14793fbf2aa3…` |
| projection | `proj-769b1a83…` | `cf553630400a297d…` |
| prerequisites | `proj-b8100a7f…` | `a040258e8efef848…` |
| authority-domain-shards | `ads-6328487e…` | `9613304cbaee9c3e…` |
| consumer-activation | `first-cutover-7f4cdd1084af-769b1a832622` | `e73ac1abd0d691c6…` |

## 明确不要做的事

- 不要伪造 READY 资格或在 3.3 完成前写 READY runtime receipt
- 不要改五个当前选择器
- 不要在 3.3/3.4 完成前 `openspec archive` 或关闭 #1411
- 不要认领 parent #1405
- 不要在永久工作树里再嵌套 worktree
