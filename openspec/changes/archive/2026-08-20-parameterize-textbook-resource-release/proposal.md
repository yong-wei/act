## Why

教材发布链路当前把固定教材列表写死在 Node 脚本、Shell 脚本和 Python 导出器中，无法以当前仓库已有 authoring 教材作为唯一发布输入。`hu-shousong-auto-control-8th` 资源不完整，历史固定七本集合也不能作为发布基线。需要把发布输入改为显式的 resourceSet，由 `books.length` 动态决定教材数量。

## What Changes

- 新增 `course-content/config/textbook-resource-set.json`，声明当前可发布教材集合，只包含 `control-encyclopedia` 和 `hu-shousong-exercise-analysis-3rd`。
- runtime 导出、runtime assets、hybrid retrieval index、provenance、validation 和 remote deploy 均改为读取 resourceSet 的 `books`。
- 删除固定七本数组、`--all-seven` 和固定 `expected-book-count=7` 依赖。
- 保持 Loader、runtime schema 和 hybrid retrieval schema 校验不变，资源与索引不一致时继续 fail closed。
- 大体积 runtime/index/vectors 资源不提交 Git，发布流程在生成后按 manifest 更新配置锁。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `structured-textbook-runtime`: 教材 runtime 的导出和验证输入由 resourceSet 决定。
- `textbook-hybrid-retrieval`: hybrid retrieval index 的构建和验证输入由 resourceSet 决定。

## Impact

- `course-content/config/textbook-resource-set.json`、`course-content/config/textbook-hybrid-retrieval.json`
- `course-content/scripts/textbook_resource_set.py`
- `course-content/scripts/structured_textbook_runtime.py`
- `course-content/scripts/export_textbook_runtime_assets.py`
- `course-content/scripts/textbook_hybrid_retrieval.py`
- `scripts/release/textbook-resource-set.mjs`
- `scripts/release/export-textbook-runtime-v2.mjs`
- `scripts/release/textbook-runtime-v2-provenance.mjs`
- `scripts/release/validate-textbook-runtime-v2.mjs`
- `scripts/remote-deploy.sh`
- 相关 Node 发布脚本测试。
