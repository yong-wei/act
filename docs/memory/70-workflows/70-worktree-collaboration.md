# 多工作树协作边界

状态: active
最后更新: 2026-06-11
摘要: 记录 OpenSpec/Buddy 与 Codex 开发时的工作树隔离边界。重点明确永久子工作树已经承担隔离职责，不应在其中为同一项实现再创建嵌套临时 worktree。
上游:
- [00-index.md](00-index.md)
下游:
- []
相关:
- [../02-recent-summary.md](../02-recent-summary.md)
- [../10-project/10-current-state.md](../10-project/10-current-state.md)

## 结论

若当前已经在永久子工作树中开发，不需要为同一项 change、issue 或实现任务再新建隔离工作树。永久工作树本身就是隔离边界。

## 判断规则

- 当前工作树是 `act-dev1`、`act-dev2`、`act-resource` 或 Codex 分配的长期子工作树时，直接在该工作树绑定分支上开发。
- `act-dev1` 绑定 `dev1`，`act-dev2` 绑定 `dev2`，`act-resource` 绑定 `resource`；这些分支按需要与 `integration` 同步。
- 在永久子工作树中执行 OpenSpec/Buddy change 时，先确认当前分支、issue claim 和 change 边界，再实施，不要再创建嵌套 worktree。
- 只有从主协调工作树发起具体实现、需要保护主工作树状态，或用户明确要求额外隔离时，才新建临时 worktree。

## 操作顺序

1. 进入工作树后先运行 `git branch --show-current` 和 `git status --short --branch`，确认当前位置和绑定分支。
2. 若已在永久子工作树，先同步 `integration`，再让当前绑定分支跟上集成基线。
3. 按 issue/change 范围实施、验证、提交和推送当前绑定分支。
4. 不在永久子工作树下再嵌套创建工作树；确需额外隔离时，先说明原因并取得明确指令。

## 例外

- 主协调工作树只用于提案、集成验证和协调登记时，具体实现可以创建临时 worktree。
- 用户明确要求某个 change 使用独立临时工作树时，以用户指令为准。
- 涉及破坏性实验、跨分支冲突验证或高风险二分定位时，可以提出额外隔离方案，但不要静默创建。
