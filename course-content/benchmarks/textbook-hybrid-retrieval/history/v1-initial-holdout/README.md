# v1 初始 holdout 历史

本目录固定第一次且唯一一次 v1 holdout 验收历史。

- v1 acceptance：5/7（71.43%），未达到 80% 验收门槛。
- selection：`Qwen/Qwen3-Embedding-0.6B` 在 tuning 集上通过 26/29。
- `selection-report.json` 与 `acceptance-report.json` 分别保存上述模型选择结果和第一次 v1 holdout 验收结果的原始证据。
- 本目录仅用于复现 v1 历史，不得作为 v2 acceptance 使用。

## 文件校验和

| 文件 | SHA-256 |
| --- | --- |
| `benchmark.jsonl` | `516d9f7b4f19a9f324d3dbf4f285d69a5367a07335fcde910c781303cf51e903` |
| `split.json` | `872d5640d14ce0236c448a4e90bf74b3e201413631bc5009cba9ebe26bd28948` |
| `benchmark-lock.json` | `5540190c0bc4a625a6ebdd3ab3002033e322e5f26fefdaa66980e78afd729bc9` |
| `selection-report.json` | `2e2f864d93f2b5fba41ee4479cafa19314d293a7218303145e5510fbdb9ca79b` |
| `acceptance-report.json` | `93b8e892c5dd4921418f46653e0fb93d00b21a779414b8479e5666d8df6ae4c7` |
