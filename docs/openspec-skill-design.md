可行，而且这是比“在不同 worktree 里各自维护 proposal”更适合代理协作的方案。

但我建议你把它设计成 **GitHub Issues 作为任务事实源，GitHub Projects 作为视图和调度面板，OpenSpec 作为单个 change 的规格执行包**。不要反过来让 OpenSpec 的 `changes/` 目录承担全局任务池职责。

GitHub Issues 本身支持 assignee、project、milestone、issue type、label 等工作跟踪元数据；labels 可用于分类 issue / PR / discussion；Projects 还支持自定义字段，用来给 issue / PR / draft issue 添加更丰富的元数据。也就是说，用 GitHub 做统一状态标识是有工具基础的。([GitHub Docs][1])

我会把规则定成这样：

```text
一个 change = 一个 GitHub Issue = 一个 OpenSpec change-id = 一个执行分支 = 一个 PR
```

GitHub Issue 负责回答：

```text
这个 change 是什么？
现在是否可执行？
谁正在执行？
必须在哪个分支上执行？
依赖哪些 change？
属于哪个 series？
是否允许并行？
对应哪个 PR？
是否已经归档？
```

OpenSpec 只负责回答：

```text
这个 change 的规格是什么？
验收任务是什么？
影响哪些 spec？
```

---

## 关键判断：不要用“全局没有 in-progress”作为唯一原则

你提出“首先查看没有 in-progress 的 change，然后实施即可”，方向是对的，但规则需要更精细。

如果全局只能有一个 `in-progress`，那 ACT 平台的并行开发会被人为压死。更合理的是：

```text
同一 coupling group / 同一强依赖链 / 同一受限分支中，只允许一个 in-progress。
不同模块、不同依赖链、不同执行分支，可以并行 in-progress。
```

例如：

```text
可以并行：
- arena-a1-challenge-entry
- ai-b1-spark-feedback
- docs-c1-contest-evidence

不宜并行：
- arena-a2-workbench-context
- arena-a3-submission-evaluation
如果 A3 强依赖 A2 的未合并接口，则 A3 应 blocked 或 stacked。
```

所以核心不是“有没有任何 in-progress”，而是：

```text
当前 change 的依赖是否完成？
当前 change 的 coupling group 是否已有 in-progress？
当前 change 是否要求在特定 branch 上执行？
当前执行者是否已经成功 claim？
```

---

## 推荐的 GitHub Project 字段

建一个 Project，例如：

```text
ACT XH-202620 Development Board
```

每个 change 对应一个 Issue。Project 中设置这些字段：

| 字段                | 类型                   | 用途                                                                                  |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `Status`          | single select        | `Backlog / Ready / Claimed / In Progress / In Review / Merged / Archived / Blocked` |
| `Change ID`       | text                 | 如 `arena-a2-workbench-context`                                                      |
| `Series`          | single select 或 text | 如 `arena-workbench`、`spark-agent`、`contest-docs`                                    |
| `Coupling Group`  | text                 | 强耦合互斥组，如 `workbench-context-chain`                                                  |
| `Execution Mode`  | single select        | `isolated / stacked / fixed-branch / docs-only`                                     |
| `Required Branch` | text                 | 如 `feature/arena-context-stack`，无要求则为空                                              |
| `Base Branch`     | text                 | 通常是 `main` 或 `integration`                                                          |
| `Depends On`      | text                 | 依赖的 issue 编号或 change-id                                                             |
| `Owner`           | assignee             | 当前执行人或 agent 账号                                                                     |
| `Claim Expires`   | date                 | 防止任务被僵尸占用                                                                           |
| `PR`              | text 或 linked PR     | 对应 PR                                                                               |
| `OpenSpec Path`   | text                 | 如 `openspec/changes/arena-a2-workbench-context`                                     |
| `Risk`            | single select        | `low / medium / high`                                                               |
| `Area`            | single select        | `arena / workbench / simulation / ai / db / docs / deploy`                          |

Projects 的自定义字段正适合承载这类结构化元数据。([GitHub Docs][2])

不过，我不建议代理主要依赖 Project 字段读取任务。原因很实际：Project 字段通过 CLI/API 操作比 issue labels、assignee、body 更麻烦。**给人看用 Project；给代理执行用 Issue body + labels + assignee。**

---

## 推荐的 Issue 结构

每个 change issue 采用固定模板。

```markdown
---
change_id: arena-a2-workbench-context
series: arena-workbench
coupling_group: workbench-context-chain
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - arena-a1-challenge-entry
openspec_path: openspec/changes/arena-a2-workbench-context
risk: medium
area: workbench
---

## Goal

从竞技场挑战进入综合工作台时，注入明确的 ChallengeWorkbenchContext，并在工作台顶部显示挑战对象、评价指标和硬约束。

## Scope

- 定义 ChallengeWorkbenchContext 类型
- 修改挑战详情页跳转逻辑
- 工作台读取并展示挑战上下文
- 刷新页面后上下文不丢失

## Out of Scope

- 不修改排行榜排序逻辑
- 不新增仿真引擎
- 不重构所有工作台视图

## Acceptance Criteria

- [ ] 从 Challenge 进入工作台后，上下文完整
- [ ] 无上下文时显示明确错误
- [ ] 提交结果时包含 challengeId、modelId、evaluationProfileId
- [ ] typecheck 通过
- [ ] 相关测试通过

## Agent Guardrails

- 只执行本 issue 对应 change
- 不扫描或执行其他 planned changes
- 不修改无关模块
- 不创建第二个 OpenSpec change
```

然后加 labels：

```text
status:ready
area:workbench
series:arena-workbench
risk:medium
mode:isolated
```

当代理开始执行时，把标签改成：

```text
status:in-progress
```

并设置 assignee。GitHub CLI 的 `gh issue edit` 支持添加 assignee 和 label，适合代理脚本化执行。([GitHub CLI][3])

---

## 代理执行前的“领取协议”

这是关键。不要只靠提示词让代理“自觉”。应当有一个领取协议。

代理执行任何任务前，必须做：

```text
1. 查询 Ready issue
2. 检查依赖是否完成
3. 检查同 coupling_group 是否已有 in-progress
4. 检查 required_branch 约束
5. claim 当前 issue
6. 重新读取 issue，确认 claim 成功
7. 创建隔离 worktree
8. 只物化本 change 的 OpenSpec proposal
```

这个协议可以写成 `scripts/claim-change.sh` 或让 Codex 主线程执行。

示意流程：

```bash
# 1. 查看可执行任务
gh issue list \
  --label "status:ready" \
  --json number,title,labels,assignees

# 2. 领取 issue
gh issue edit 123 \
  --add-label "status:in-progress" \
  --remove-label "status:ready" \
  --add-assignee "@me"

# 3. 留下领取注释
gh issue comment 123 --body "Claimed by codex-agent in worktree wt-arena-a2-workbench-context."
```

但这里有一个硬问题：**GitHub Issue 的 label/assignee 更新不是严格的分布式事务锁。**两个代理如果几乎同时读取 `status:ready`，理论上都可能尝试 claim。同一时间你通常不会跑大量自治代理，所以问题不大；如果要更稳，就必须在 claim 后重新读取 issue，发现已有其他 assignee 或状态异常就退出。

更强的规则是：

```text
claim 后必须二次确认：
- status 已变成 in-progress
- assignee 是自己
- issue 最新 comment 中的 claim owner 是自己
否则立即停止执行。
```

---

## 强耦合 change 如何处理

你提到“某些 change 因为强耦合，必须在规定的分支中执行”，这个设计很必要。

可以用 `execution_mode` 区分：

### 1. `isolated`

默认模式。

```yaml
execution_mode: isolated
base_branch: integration
required_branch:
```

规则：

```text
从 integration 新建独立分支；
一个 change 一个 PR；
完成后合并；
worktree 销毁。
```

适合大多数任务。

---

### 2. `fixed-branch`

强制在指定分支执行。

```yaml
execution_mode: fixed-branch
required_branch: feature/workbench-context-stack
base_branch: integration
```

规则：

```text
代理不能自行创建 feature 分支；
必须 checkout required_branch；
如果 required_branch 不存在，停止并要求调度器创建。
```

适合一组正在连续重构的任务。

---

### 3. `stacked`

堆叠分支模式。

```yaml
execution_mode: stacked
base_branch: feature/arena-a2-workbench-context
required_branch: feature/arena-a3-submission-evaluation
depends_on:
  - arena-a2-workbench-context
```

规则：

```text
A3 建立在 A2 分支之上；
A2 合并后，A3 rebase 到 integration/main；
只允许技术负责人或主调度代理处理。
```

这个模式不适合学生随意用，也不适合一般代理自动处理。它应该是少数情况。

---

### 4. `blocked`

不可执行。

```yaml
execution_mode: isolated
status: blocked
depends_on:
  - arena-a2-workbench-context
```

规则：

```text
依赖未完成前，代理不得领取。
```

---

## 我建议的状态流

不要只用 `todo / in-progress / done`，太粗。

推荐：

```text
Backlog
  ↓
Ready
  ↓
Claimed
  ↓
In Progress
  ↓
In Review
  ↓
Merged
  ↓
Archived
```

其中：

```text
Backlog：只是想法，不能执行。
Ready：规格足够明确，可以领取。
Claimed：已被某人/代理领取，但还未开始大规模修改。
In Progress：正在实现。
In Review：PR 已提交，等待审查。
Merged：PR 已合并，但归档可能未完成。
Archived：OpenSpec 已归档，台账已更新。
Blocked：依赖或分支条件未满足。
```

`Claimed` 这个状态有价值。它把“正在抢占任务”和“已经实质开发”分开，能减少并发领取冲突。

---

## 你的“总原则”可以这样写

可以放进 `AGENTS.md` 或 `CONTRIBUTING.md`：

```markdown
## Change Execution Rule

Before implementing any change, the agent must check GitHub Issues as the source of truth.

The agent may only execute an issue whose status is `Ready`.

Before implementation, the agent must:

1. Read the issue body and metadata.
2. Verify that all dependencies are `Merged` or `Archived`.
3. Verify that no issue in the same `Coupling Group` is `Claimed` or `In Progress`.
4. Verify the `Execution Mode`.
5. If `Required Branch` is specified, use that branch only.
6. Claim the issue by changing its status to `Claimed` or `In Progress`, assigning itself, and adding a claim comment.
7. Re-read the issue to confirm the claim.
8. Create or enter the specified worktree.
9. Implement only this change.
10. Open a PR linked to the issue.
11. Move the issue to `In Review`.
12. After merge, archive the OpenSpec change and move the issue to `Archived`.

The agent must not implement unclaimed issues, adjacent planned changes, or roadmap items that were not explicitly assigned.
```

这条规则很适合你的多 worktree + 多代理场景。

---

## 但要避免一个反向问题

GitHub Issue / Project 作为统一事实源之后，代理可能变得过度依赖平台状态，而忽略仓库里的真实代码状态。

所以执行前还必须检查：

```text
1. 当前 base branch 是否最新；
2. required_branch 是否存在；
3. issue 中描述的文件路径是否仍然存在；
4. OpenSpec path 是否与 issue metadata 一致；
5. 相关模块是否已经被其他 PR 改写；
6. 本地 diff 是否只包含当前 change。
```

也就是说，GitHub 是任务状态真源，不是代码事实真源。代码事实仍然以 Git 为准。

---

## 最佳组合

我认为最稳的组合是：

```text
GitHub Issue：
    单个 change 的正式任务单

GitHub Project：
    多个 change 的全局看板和调度视图

Issue labels：
    给代理快速筛选状态、模块、风险、执行模式

Issue body YAML：
    给代理读取精确元数据

OpenSpec：
    只在 change 被领取后物化为执行规格

worktree：
    只为当前执行 change 临时创建

PR：
    单个 change 的审查和合并单元
```

最后形成这样一条链：

```text
Project card
   ↓
GitHub Issue
   ↓
claim
   ↓
temporary worktree
   ↓
OpenSpec change
   ↓
implementation
   ↓
PR
   ↓
merge
   ↓
archive
   ↓
destroy worktree
```

这套机制的好处是：无论代理在哪个 worktree、哪个分支，只要先看 GitHub Issue，就能知道自己是否有权执行、应该执行哪个 change、是否必须进入特定分支、是否会和其他 change 冲突。

结论很明确：**可行，而且值得做。**
但不要把它设计成“GitHub 上没有任何 in-progress 才能开工”。应设计成“按依赖、耦合组、执行模式和分支约束进行领取”。这样既能保持并行，又能避免 A2 被 B 工作树里的代理误执行。

[1]: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue?utm_source=chatgpt.com "Creating an issue - GitHub Docs"
[2]: https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields?utm_source=chatgpt.com "Understanding fields"
[3]: https://cli.github.com/manual/gh_issue_edit?utm_source=chatgpt.com "gh issue edit"
