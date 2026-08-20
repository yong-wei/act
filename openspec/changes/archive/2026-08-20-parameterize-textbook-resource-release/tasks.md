## 1. resourceSet 合同

- [x] 1.1 新增 `course-content/config/textbook-resource-set.json`，声明 `resourceSetId`、`sourceRoot`、`configRoot` 和 `books`。
- [x] 1.2 新增 Node 与 Python 共享 helper，并校验非空、唯一、安全的教材集合。
- [x] 1.3 删除发布链路中的固定七本依赖，改用 `textbookBookIds()` / `textbook_book_ids()`。

## 2. runtime 与 assets 参数化

- [x] 2.1 `structured_textbook_runtime.py` 支持 `--resource-set`，不再接受 `--all-seven`。
- [x] 2.2 `export_textbook_runtime_assets.py` 按 resourceSet 读取配置并导出 assets。
- [x] 2.3 Node release 脚本统一传入 resourceSet，并把 resourceSet 配置纳入 generator inputs。

## 3. hybrid retrieval 参数化

- [x] 3.1 `textbook_hybrid_retrieval.py` 的 build/verify 使用 resourceSet；除数量外显式校验实际 book id 集合与 `resourceSet.books` 一致，并补充同数量错集合回归。
- [x] 3.2 `validate-textbook-runtime-v2.mjs` 使用 resourceSet 传递索引验证参数。
- [x] 3.3 保持 windows、segments、manifestHash、sourceRevision 与 resourceSetId 一致性校验。

## 4. remote deploy

- [x] 4.1 `scripts/remote-deploy.sh` 从 resourceSet 动态读取 book ids 和 count。
- [x] 4.2 移除 `-eq 7` 和固定七本数组。
- [x] 4.3 远端 provenance 校验将 helper 依赖与 resourceSet 配置作为同一发布单元上传，并从远端仓库根目录解析配置。

## 5. 测试

- [x] 5.1 更新 runtime provenance streaming 测试。
- [x] 5.2 更新 externalized deploy 与 remote-deploy 测试，覆盖 resourceSet 动态调用。
- [x] 5.3 在可用的 Python 环境运行 runtime 与 hybrid retrieval 单元测试；本机 Windows CRLF 环境仅 benchmark lock 既有校验例外。
- [x] 5.4 覆盖全新远端的 provenance helper 依赖发布，以及递归清理悬空符号链接的 externalized deploy 回归。

## 6. OpenSpec 与验证

- [x] 6.1 完成 proposal、design、tasks 和 spec delta，并将 canonical spec 中固定六本教材与 150 MiB 固定集合语义替换为 resourceSet 表述。
- [x] 6.2 运行 OpenSpec 严格校验。
- [x] 6.3 运行 helper CLI、相关 Node 测试与发布前检查。
- [x] 6.4 在干净 HEAD 上执行导出和验证，按实际结果更新配置锁：`sourceRevision=bf2d85e98d8f336c24214079dbecec4026cbffd8`、`selectedIndexManifestHash=sha256:4d1199f319f59a39d0f4196c1ad391004b4faf5ddb0cc97dd9f11423a7023d5c`、`resourceSetId=current-authoring-bundle-v1`、`windows=5692`。
