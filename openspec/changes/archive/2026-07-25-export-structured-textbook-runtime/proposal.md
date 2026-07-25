## Why

现有教材导出只识别主要 Markdown 标题，再把正文按字符长度打成无重叠 chunk；`（1）` 等自然结构无法成为精确引用目标，检索窗口、引用身份和网页定位也混为一体。LinkML 图谱重建完成时间尚不确定，当前控灵需要先获得可重复导出、可审核且能够定位到最小教学单元的教材运行态。

## What Changes

- 对六部教材和一个参考文献集合执行分章节结构异常检测与分散采样审核；仅在确认 Mathpix 作者态存在结构缺损时修复作者态真源。
- 建立通用编号规则与每本教材的声明式配置，以确定性解析器生成章节树、最小非重叠结构单元、公式/插图/表格锚点和稳定结构路径。
- 从结构单元派生允许重叠的检索窗口；窗口保留每段正文所属结构单元的稳定标识，但自身不成为引用目标。
- 生成未接入生产的新版运行态测试产物、结构索引和异常报告，为后续检索与阅读器变更提供稳定合同。
- 无法确定层级时导出失败；模型只审核异常和分散样本，不参与正式导出结果生成。
- **BREAKING（最终系列切换时生效）**：新版结构不提供旧 section/chunk 链接映射、重定向或永久兼容投影。

## Capabilities

### New Capabilities

- `structured-textbook-runtime`: 定义教材作者态、确定性层级解析、无重叠引用单元、重叠检索窗口、稳定锚点和结构异常校订合同。

### Modified Capabilities

<!-- None. This change produces an unconnected v2 test runtime; production consumers switch in the final integration change. -->

## Impact

- `course-content/authoring/resources/textbooks/` 中经审核确认的结构缺损。
- `course-content/scripts/export_textbook_resources.py`、每本教材解析配置及结构审计脚本。
- `course-content/runtime/resources/textbooks/` 下未接入生产的新版测试产物。
- 后续 `build-textbook-hybrid-retrieval`、`build-unified-textbook-reader` 与 `integrate-konling-textbook-rag` 依赖本变更的结构合同。
