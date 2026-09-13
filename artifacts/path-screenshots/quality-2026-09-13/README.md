# 路径质量验收截图 2026-09-13

后台先跑 `path-scenario-acceptance`（3 目标 × 3 掌握度）通过后，才截这些图。

- 页面生成：9/9 persisted，比较卡在路径页。
- 控灵：3/3 调用 `generate_learning_path`，`pageHasCards=true`，截的是路径页而不是对话摘要。
- 掌握度夹具：`scripts/db/seed-path-mastery-test-learners.mjs` 按活骨架写入标签。
- 已掌握的「反馈与闭环」可能只剩 1 条方案：三条风格去重后资源相同。

文件：

- `1-*` / `2-*` / `3-*`：无掌握 / 部分掌握 / 前置较充分 × 三个目标
- `chat-*`：控灵侧栏生成后的路径页
- `page-results.json` / `chat-results.json`
