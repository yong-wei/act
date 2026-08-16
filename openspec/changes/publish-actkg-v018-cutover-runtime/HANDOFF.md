# Handoff: #1411 `publish-actkg-v018-cutover-runtime`

状态: **认领已切到 act-dev1；正式入口已绑定密封 host-shadow 报告；收据 BLOCKED；3.3 仍缺 shards**  
日期: 2026-08-16  
工作树: `/Users/YW/.codex/worktrees/act-dev1`（`buddy.worktreealias=act-dev1`）

## 一句话

`#1411` 继续由 `act-dev1` 执行。正式入口复用密封 OCI 镜像时校验 `manifest.json` tag/config digest `d2ee9cf7…`，并把主机 Image ID 绑到同一 digest。当前收据保持 BLOCKED，blocker 含生产缺少 shards current.json。不要认领 #1405。完成 3.3/3.4 后再领 #1412。

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
| 收据/镜像 PR | https://github.com/yong-wei/act/pull/1430 OPEN |
| 密封资格 | READY `1444318cc2a62b10bc1c5f358592da59d2c6706d0677c898c7bc54486c5cc3b1` |
| overlay sha256 | `41799cf9c45cbf0d3828991ba9baed217ae09b696c9a5d5f0d0da08afb520948` |
| imageTag | `localhost/act-obe-platform:v018-94d585ae63a6` |
| imageTarSha256 | `bda84f7e312356a503abb751119823493f144d60594709436885a9ba075ed024` |

任务：1.1、1.2、2.1–2.3、3.1、3.2、3.5 已勾选。1.3、3.3、3.4 仍开。正式入口已绑定密封 host-shadow 报告（contract、状态、五哈希、observation 与冻结前任一致性）。生产缺少 `authority-domain-shards/current.json`，因此 host-shadow 与密封收据保持 BLOCKED。尚未认领 #1412。

## 当前必须做的事

1. 完成 task 3.3：在不切换五个选择器的前提下，恢复生产 v0.9 shards current.json，并重跑主机 v0.9 + 受控 v0.18 shadow。
2. 3.3 通过后再用正式 publisher 封 READY 收据（3.4），补 1.3 终验。
3. 新 head 推到 PR #1430，处理 Codex/Bugbot thread，`@codex review`。latest-head 清场且零未解决 thread 后合并。
4. 收尾：`openspec validate` + `openspec archive` 进同一交付单元，Issue 标 `status:archived` 并关闭。然后才认领 #1412。

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
