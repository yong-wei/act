# Codex review 清场信号调查交接

更新时间：2026-07-12（Asia/Shanghai）

## 任务与工作树状态

- 任务：调查 e734 工作树执行过程中已经合并、但合并前没有得到当前 head 的 Codex review 清场信号的 PR。
- 工作树：`/Users/YW/.codex/worktrees/e734/act.just.edu.cn`
- 当前分支：`redesign-knowledge-graph-direct-manipulation`
- 当前分支相对 `origin/integration`：远端领先 5 个提交，当前分支另有 13 个提交；当前工作树存在用户未提交改动。
- 已执行同步：`git fetch origin integration` 已完成；本地 `integration` 与 `origin/integration` 均为 `56845efbb9d22fe459ba858e2f53f142b5a82e0f`，提交为 `chore: align project named-agent policy`（2026-07-12 11:18:46 +08:00）。
- 为保护用户改动，没有在脏工作树上执行 reset、rebase、切换分支或合并远端提交。
- 调查阶段没有修改现有代码；本 handoff 是本轮新增文件。已有的知识图谱未提交改动不属于本调查。

## 判定标准

只有以下信号才算合并前清场：

1. PR 当前 head 与 Codex review 请求对应。
2. 最新请求之后得到 Codex 的显式无阻塞结论，例如 `Didn't find any major issues` 或等价明确回复。
3. 该信号发生在 PR 合并之前。

以下内容均不算清场：额度耗尽提示、人工或本地 review、普通自动建议、`MERGEABLE/CLEAN`、`merge-ready`、`review_response_gate_passed`，以及合并后才出现的 review。

请求的精确文本是：

`@codex review 中文回复，即使没有重大问题也必须给出显式回复`

## 已核实的 e734 问题 PR

| PR | 合并时间（UTC） | 当前 head | 证据 | 判定 |
|---|---|---|---|---|
| #595 | 2026-06-19 12:15:34 | `5615b4fca2` | 合并前没有显式清场；当前 head 的 Codex review 到 12:20:50 才出现，且是 `COMMENTED` 并带 P2 建议 | 确认缺失 |
| #763 | 2026-07-01 17:31:24 | `dd8736ce0a` | 清场文本出现在 17:31:59，晚于合并 35 秒；e734 lane 后续标记为 `done/mark-achieved-post-merge`，但 `auto-state/pr-763.json` 没有 `review_clear` 或 `merge_gates_passed` | 确认缺失 |
| #888 | 2026-07-10 11:37:07 | `d5e2e146ad` | 26 条 Codex review 均为普通建议；最新当前 head review 在 11:37:59，晚于合并，且没有显式清场文本；e734 缓存仍为 `waiting_review` | 确认缺失 |
| #911 | 2026-07-11 10:59:17 | `2bac45593e` | 只有两条 `You have reached your Codex usage limits for code reviews`；没有 Codex review 或显式清场。e734 reflog 显示该分支在本工作树于 18:57 提交、18:59 合并回 `dev1` | 确认缺失 |

其中 #911 没有对应的 e734 auto-state 文件，但有本工作树的 reflog 归属；因此应作为 e734 的直接手动分支活动审计，而不是普通全局 PR 列表。

## 对照样本与范围边界

- #909 是正确路径对照：Codex 清场评论在 10:29:39，auto-state 在 10:30:24 记录 `review_clear`，10:30:40 通过 `verify-review-clear.sh`，PR 10:31:47 合并。
- e734 auto-lanes 当前备份包含 45 个 PR；逐一对照后，除 #763、#888 外，其他缓存中的已合并 PR 均找到合并前当前 head 的显式清场评论。#595 是此前 e734 运行的历史补充。
- #899、#907、#908、#910、#912 也存在“没有合并前 Codex 清场”的 live GitHub 证据，其中 #907、#908、#910、#912 只有额度耗尽提示；但当前没有足够的 e734 cache/reflog 证据把它们纳入本工作树确认范围。后续若调查目标是全局事故，应另列为独立批次。

## 当前根因线索

已读取的 OpenSpec-buddy 逻辑表明，正常 `buddy-auto-driver` 路径会先要求 `review_clear`，再要求 `merge_gates_passed`，因此“额度耗尽直接被 verifier 判为清场”不是当前显式 verifier 的正常结果。

但存在两个需要继续追踪的边界：

- `buddy-auto-lane-driver.mjs` 对已经在 GitHub 合并的 PR 有恢复路径，会把 live PR truth 设为 `merge_ready` 并要求重新运行 driver 完成 achievement；这只能证明合并后的恢复，不证明合并前有 review 清场。
- #888 的状态正好显示出这个问题：`issue_pr_bound.bridgeReason` 已写明 “exact issue-bound PR #888 is already merged”，随后仍记录 `mark_review_passed` 与 `review_requested`，但没有 `review_clear`/`merge_gates_passed`。这说明缓存的 `done`、绑定状态和 post-merge achievement 不能反向证明合并门禁曾经通过。

尚未完成的关键定位是：#763、#888、#911 究竟通过了哪个实际 merge 入口。需要继续检查 OpenSpec-buddy 的 merge helper、lane driver 的 merged recovery、以及是否存在控制器之外的手动合并路径。

## 下一线程建议顺序

1. 先复核本文件中的四个确认问题 PR，读取 `openspec/.buddy-cache/auto-state/pr-763.json`、`pr-888.json`、`pr-909.json` 与工作树 reflog。
2. 在 `/Users/YW/Documents/Project/OpenSpec-buddy` 只读检查 merge helper、`verify-review-clear`、`verify-achieved-truth`、`buddy-auto-lane-driver` 的调用链，找出能在没有 `review_clear` 时触发 GitHub merge 的入口。
3. 对照 GitHub 的 merge 时间、当前 head、精确 review 请求时间和 Codex 评论 URL，建立每个异常 PR 的时间线。
4. 仅在根因确认后再提出或实施修复；不要把 quota exhaustion、local Sol review 或 `merge-ready` 当作 Codex 清场替代品。

## 保护事项

- 不要清理或覆盖当前工作树已有的知识图谱未提交改动。
- `/Users/YW/Documents/Project/OpenSpec-buddy` 当前存在用户改动及未提交的 quota hardening 计划，下一线程只读检查，除非用户明确要求修改。
- 本 handoff 记录的是调查中间状态，不是修复完成声明。

## 2026-07-12 定点 follow-up 结果

本轮仅复核 e734 工作树实际处理且未清场的 #595、#763、#888、#911，范围限定为已有 Codex P1/P2 所涉及的关键路径；没有对整仓库重新审核，也没有修改任何通用 Buddy 技能。

| PR | Follow-up 证据 | 当前结论 |
|---|---|---|
| #595 | `0f16145db` 已将 path execution evidence 限定到目标 goal，并在 `src/lib/__tests__/adaptive-learner-state-service.test.ts` 与 `src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts` 覆盖角色过滤、隐藏 AgentToolRun、受治理 AgentToolRun 和跨 goal 场景 | 当前实现先完成 role-filtered mastery traceability，再构建 goal slice；学生侧 confidence/mastery/source coverage 不再消费隐藏 teacher-scoped refs。定点测试通过。 |
| #763 | `bdf91a7a7` 补教师绑定门禁，`410491c3d` 修正 401 为 `auth-required`，`dd8736ce0` 保留通用 contextual-recommendation 登录回调；对应 route/page 契约测试仍在当前 head | P1/P2 关键路径均有实现和回归断言，定点测试通过，没有发现需要再次修改的缺口。 |
| #888 | 合并后提交 `775ec2091` 补 infograph manifest 删除门禁；`scripts/tests/test-new-resource-semantic-completeness-command.mjs` 已覆盖删除、重复 identity、路径变更和 base mode，命令级测试通过 | manifest 删除会生成 delete requirement，保留旧 projection 会被阻断；当前 follow-up 已闭合该最终 P2。 |
| #911 | GitHub PR 没有 Codex review，只有 quota exhaustion；合并内容为 `2bac45593` 的 OpenSpec archive 与规范同步 | 没有 Codex actionable finding，不能伪造 review follow-up；本轮完成归档提交与 merge 证据核对，不新增业务修复。 |

定点验证结果：6 个 Vitest 文件共 93 项通过；`node scripts/tests/test-new-resource-semantic-completeness-command.mjs` 通过。由于本轮没有修改 ACT 业务源代码，未运行全量审核或全量构建。后续若要处理 merge-clearance 根因，应在 OpenSpec-buddy 项目另行执行用户授权的控制器修复，不在本工作树改动其技能文件。
