## ADDED Requirements

### Req: model selector panel visible in free explore mode

`ArenaModelSelectorPanel` 必须在无 `arenaContext` 时也可渲染（自由探索入口），并标注"当前为自由探索，未绑定竞技场任务，不能提交官方评测"。

### Req: onSelectObject callback must be wired

`page-client.tsx` 必须向 `ArenaModelSelectorPanel` 传入 `onSelectObject` 回调。兼容模型点击后触发 `selectArenaObjectForExploration(objectId)`，读取对象 model + workbenchSeed，设置 poles/zeros/gain，刷新工作台图表。

### Req: no official submit button in free explore mode

自由探索模式下不渲染 `ArenaSubmitPanel`。

### Req: incompatible object links must be derived from real tasks

不兼容对象的推荐工作台提示不得硬编码为特定 task ID。应改为：
- 优先找同 objectId 的 `ARENA_CHALLENGE_TASKS` 条目
- 按 `workspaceMode` 匹配推荐模式
- 无匹配 task 时仅显示文字说明，不提供虚假链接
- 不再使用 `as any` 构造假的 `ChallengeTask`
