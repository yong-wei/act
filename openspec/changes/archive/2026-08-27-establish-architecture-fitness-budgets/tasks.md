## Hard Dependencies

已 qualified 的 `enforce-modular-domain-dependency-contracts` 与 `split-production-tooling-test-typescript-graphs` 必须同时满足；任一 graph、allowlist、owner 或 receipt drift/分母不完整时保持 blocked，依赖方向不回指本 change。

## 1. Characterize upstream identities and metrics

- [x] 1.1 验证 baseline、charter、domain dependency contract 和 production/tooling/test graph 的 source revision/tree、schema 与 receipt identity；发现 drift 时停止 qualification。
- [x] 1.2 Characterize 依赖 forward/reverse edges、SCC、deep imports、feature→app、`src/lib` exception、文件尺寸、中心节点及其变化原因，保留 production/test/generated/framework 分类。
- [x] 1.3 Characterize cold/warm typecheck RSS/time/file-count receipt 和当前命令 scope，明确变量测量不能直接变成 deterministic threshold。

## 2. Implement fitness budget ledger

- [x] 2.1 定义 budget record、metric kind、scope、baseline/receipt identity、direction、owner、evidence、exception、deletion condition 和 follow-up change schema。
- [x] 2.2 复用 dependency contract 的唯一 graph/allowlist，检查 edges、reverse edges、完整 SCC、deep imports、feature→app 与新违规；任何新 forbidden edge、SCC member 或 deep import 均无条件失败。
- [x] 2.3 实现文件尺寸与中心节点预算，冻结 baseline metric 后任何增长均失败；不得通过新增 exception、扩大 pattern、补字段、改名或转移 owner 绕过，合理代码必须采用合规替换/拆分。
- [x] 2.4 实现编译资源 budget projection，消费 TS graph 的 frozen measurement receipt，区分 observed/trend/blocked，禁止 heap-only success。
- [x] 2.5 输出稳定排序、分母闭合、privacy-safe 的 fitness report，并为 drift、unresolved、任意新例外/扩大 pattern/补字段、第二套 graph 和冻结指标增长增加 contract fixtures。

## 3. Remove or replace old authority

- [x] 3.1 删除本 change 新增的重复 dependency/TS discovery、复制 owner catalog、宽 glob exception 和未绑定 source identity 的 budget；禁止以新增条目绕过失败。
- [x] 3.2 仅通过删除或合规替换收缩既有例外集合；任何新增 exception、扩大 pattern、补字段、改名或转移 owner 的尝试均标为 blocker。
- [x] 3.3 将已冻结文件尺寸、中心节点和其他结构指标的增长作为无条件失败；合理代码必须由合规拆分/替换维持预算，另行 baseline revision 不属于本 change。
- [x] 3.4 确认 fitness report 不替代 domain dependency contract、test command contract、release qualification 或现有 frontend/source-boundary gates。

## 4. Targeted and affected-domain verification

- [x] 4.1 运行 unchanged baseline fixtures，确认历史 debt 可见、forward/reverse/SCC 分母闭合，任何新增 forbidden edge/SCC member/deep import/冻结指标增长/例外均无条件失败。
- [x] 4.2 运行文件尺寸/中心节点/编译 receipt projections，验证同一 source+receipt identity 可重复生成，新的环境测量只生成新 receipt。
- [x] 4.3 运行 domain dependency fitness、各 TypeScript graph、受影响 unit/contract tests，并记录既有失败/外部限制为独立 blocker。
- [x] 4.4 运行 `rtk openspec validate establish-architecture-fitness-budgets --type change --strict` 和 `git diff --check`。

## 5. Documentation and handoff

- [x] 5.1 更新 architecture fitness、budget ledger、例外删除条件、owner、报告字段和 receipt 使用文档。
- [x] 5.2 将 qualified fitness identity、remaining debt、blocked/unresolved records 交给 `enforce-pr-integration-quality-gates`，不把观察值写成永久常量。
- [x] 5.3 明确下一步删除/迁移 change 与验证命令，保留 legacy debt 的真实状态而不 claim 全仓已重构。
