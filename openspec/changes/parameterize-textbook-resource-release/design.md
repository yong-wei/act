## Context

仓库的 authoring 教材是发布输入的唯一真源。当前实际可发布集合为 `control-encyclopedia` 和 `hu-shousong-exercise-analysis-3rd`；`hu-shousong-auto-control-8th` 资源不完整，不进入本变更。现有导出链路仍固定使用历史七本列表，导致 runtime、index、manifest 和配置锁之间容易漂移。

## Goals / Non-Goals

**Goals:**

- 将教材发布输入统一为 resourceSet，教材数量由 `books.length` 动态计算。
- runtime、assets、hybrid index、provenance、validation 和 remote deploy 共用同一 resourceSet。
- 保持现有 Loader 与验证 schema 的严格性，不通过放宽校验绕过问题。
- 只提交配置、脚本、测试、OpenSpec 和文档，不提交生成资源。

**Non-Goals:**

- 不恢复历史七本教材，不寻找外部教材。
- 不修复 `hu-shousong-auto-control-8th` 的资源质量问题。
- 不修改 `src/lib` 中的 textbook loader 或运行时查询逻辑。
- 不新增 `expectedBookCount`、`sourceRevision`、`manifestHash` 等固定数量或版本字段到 resourceSet。

## Decisions

### 1. resourceSet 是发布输入的唯一真源

`course-content/config/textbook-resource-set.json` 只声明 `resourceSetId`、`sourceRoot`、`configRoot` 和 `books`。教材数量、目录清单和校验范围均由 `books` 推导。resourceSet 不声明生成结果或固定数量，避免再次产生硬编码。

### 2. Node 与 Python 使用同一合同

新增 `scripts/release/textbook-resource-set.mjs` 和 `course-content/scripts/textbook_resource_set.py` 作为共享读取入口。两者对 `resourceSetId`、路径安全、非空且唯一的 `books` 做同一校验，供 release 脚本和生成脚本调用。

### 3. 生成与验证参数同步迁移

`structured_textbook_runtime.py`、`export_textbook_runtime_assets.py` 和 `textbook_hybrid_retrieval.py` 接受 `--resource-set`；Node release 脚本统一传入同一配置。`expected_book_count` 仅在显式调用且与 resourceSet 不一致时 fail closed，不再由发布链路固定传递。

### 4. 保持校验强度

runtime manifest、schema 校验、hybrid index windows/segments、manifestHash、sourceRevision 与 resourceSetId 仍按既有合同验证。任何资源缺失、数量不符或版本漂移都继续失败，不修改 Loader 绕过。

### 5. 生成资源不入 Git

`course-content/runtime/resources/**` 和 `.cache/textbook-hybrid-retrieval/**` 属于发布资产，由 release 流程生成和分发。PR 只提交可复现生成的代码、配置和测试。

### 6. 远端 provenance 校验随 resourceSet 发布

远端 `textbook-runtime-v2-provenance.mjs` 依赖同目录的 `textbook-resource-set.mjs`，并从远端仓库根目录读取 `course-content/config/textbook-resource-set.json`。`remote-deploy.sh` 必须将这三个文件作为同一原子发布单元上传，并在执行 provenance 校验前进入 `REMOTE_PROJECT_DIR`。该成套发布挂在现行 `ossfs-blob-view` 应用部署与显式 runtime-release 边界上：默认应用路径不 rsync runtime，`legacy-rsync` 失败关闭，v1 `ossfs-release` 只保留兼容入口。这使首次部署和没有旧 helper 的主机同样 fail closed，而不依赖远端残留脚本或配置。

## Risks / Trade-offs

- [resourceSet 内容与 authoring 实际集合不一致] → 共享 helper 校验非空、唯一和安全路径，生成/验证脚本使用同一来源。
- [旧固定七本断言残留] → 本次发布脚本改为动态读取；历史测试 fixture 和课程正文中的固定教材引用不属于本变更范围。
- [真实导出依赖 Python 和外部 embedding/reranker] → 导出前先验证脚本可运行；无法在隔离工作区完成时记录为发布环境前置条件。

## Migration Plan

本变更先落地参数化代码与测试。下一步在干净 HEAD 上运行导出和验证，按实际 manifest 更新 `course-content/config/textbook-hybrid-retrieval.json` 的 `resourceSetId`、`sourceRevision` 与 `selectedIndexManifestHash`，然后进入正式发布流程。

## Open Questions

无。resourceSet 范围、发布输入和生成资源归属已确认。
