## 1. 映射生成管线与治理账本

- [x] 1.1 盘点激活 v0.37 的 7476 个对象（按 15 个运行时 catalog 域分组），建立映射分母清单（`denominator.json`）
- [x] 1.2 候选生成：标签/别名/教学字段经 bge-m3 混合检索索引召回候选结构单元，叠加 act-crosswalk 检索词词典（`candidates.json`，29904 候选行覆盖全部 7476 对象）
- [x] 1.3 独立语义评审账本（复用 course-coverage review 账本模式）：候选逐条 approved/rejected + 理由，不可变追加（`reviews.jsonl`，75 批独立评审，28891 条 verdict；6 条矛盾裁决按保守规则取 rejected）
- [x] 1.4 例外账本：无 approved 映射的节点按原因分类显式入账，禁止静默无映射（`exceptions.jsonl`，4293 条：1089 条评审员提案 + 3204 条管线自动分类）
- [x] 1.5 覆盖率门禁：approved + 显式例外 ≥95%，按组件域报告，低于门禁 fail closed（`coverage.json`：合并覆盖 100%，approved 3183 / 例外 4293，15 域全部 100%）

## 2. 契约扩展与身份重钉

- [x] 2.1 crosswalk 契约扩展 v2 structuralUnit 坐标（bookId/edition/structuralUnitId/structuralPath/unitTitle），保留 v1 locator 行兼容（6 行 v1 保留可消费）
- [x] 2.2 新 crosswalk 行 authority binding 重钉 `ctr:release:control-theory-engineering-v0.37`（绑定 bundle-manifest 的 releaseHash/bundleDigest/captureRevision）；钉旧 release 的行 fail closed（909 行 v2；runtime 通道 `stale-authority-binding` 分支测试覆盖）
- [x] 2.3 书籍 id 别名表：投影 sourceDocumentId → 阅读器 bookId + edition，解析目标必须存在于 v2 manifest，否则 fail closed（`aliases.ts`；manifest 校验测试覆盖）

## 3. 运行时消费

- [x] 3.1 `runtime-full-binding.ts` textbook 通道扩量消费 v2 crosswalk（不再限 6 行 locator）；未知 canonical 进例外账本（232 个 v2 section 资源 + 434 EXPLAINS 绑定投影；authority 外 canonical → `unknown-canonical` 账本）
- [x] 3.2 教材资源经别名表 + v2 坐标解析挂到 `buildTextbookReaderHref`；REFERENCE_ONLY 按 design 决策 6 的确认结果执行（resource-bindings `textbookSectionReaderHref` 数据面产出 reader href；画布资源面板的可点击态待用户裁决 knowledge-graph 启动门禁的 %20 拒绝与含空格 edition 的相容性，见 PR 描述）
- [x] 3.3 linkage/identity 校验：映射坐标可解析到真实 v2 单元，href 与混合检索/阅读器同一 URL 体系（909/909 坐标解析验证 + coordinates 测试断言 href 字节形态）

## 4. 快照/物化 sources 填充

- [x] 4.1 `materialize.ts` node-detail `sources` 由评审通过的映射账本经显式输入填充，不再恒写空数组（新分片集 `ads-74558e30`，3183 节点带 sources）
- [x] 4.2 物化保留激活快照自带的 `sourceMappings`/`sourceObjects`/`evidence`（存在时），不得丢弃（`snapshotSourceCitations` + receipt `snapshotSourceMappingsPreserved`；当前快照三者为空，receipt 记 0）
- [x] 4.3 detail 分片 sources 条数上限与 payload budget 断言显式调整（`NODE_SOURCES_LIMIT=6`，receipt 记录 `nodesCappedToLimit`，budget 断言继续生效——本次 0 节点触顶）
- [x] 4.4 画布节点详情零前端改动验证：`presentSourceCitation` 显示教材出处，点击跳统一阅读器（Playwright 验收 `tests/engineering-graph-textbook-coverage-2043.spec.ts`：sources 显示通过并留证 `artifacts/issue-2043-textbook-coverage/canvas-acceptance.json`；面板点击为 test.fixme 待裁决项）

## 5. 验证与发布

- [x] 5.1 聚焦测试：候选生成确定性、评审账本不可变、例外账本闭合、覆盖率门禁 fail-closed、别名解析、坐标→href、物化 sources（`engineering-textbook-mapping` 15 测试 + `crosswalk-v2` 9 测试 + `authority-domain-shard-sources` 4 测试 + 既有通道回归）
- [x] 5.2 `rtk npm run typecheck` 与相关域测试通过（typecheck 0 错误；聚焦套件 80/81 通过，唯一失败为已归档 change 的既有基线测试债务，与本变更无关）
- [ ] 5.3 合入 `integration` 后，生产内容发布（重新物化分片、投影重发布）——执行时单独授权

### 评审工作文件说明

`review-work/`（75 个输入批次 + 75 个 verdict 文件）为可确定性重建的评审工作副本（`build-review-work.ts` 从 `candidates.json` + 快照 + v2 units 重建），未入 Git；评审真源为 `reviews.jsonl` + `exceptions-proposed.jsonl`。
