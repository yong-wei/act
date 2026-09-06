## 1. 映射生成管线与治理账本

- [ ] 1.1 盘点激活 v0.37 的 7476 个对象（按 17 个组件域分组），建立映射分母清单
- [ ] 1.2 候选生成：标签/别名/教学字段经 bge-m3 混合检索索引召回候选结构单元，叠加 act-crosswalk 检索词词典
- [ ] 1.3 独立语义评审账本（复用 course-coverage review 账本模式）：候选逐条 approved/rejected + 理由，不可变追加
- [ ] 1.4 例外账本：无 approved 映射的节点按原因分类显式入账，禁止静默无映射
- [ ] 1.5 覆盖率门禁：approved + 显式例外 ≥95%，按组件域报告，低于门禁 fail closed

## 2. 契约扩展与身份重钉

- [ ] 2.1 crosswalk 契约扩展 v2 structuralUnit 坐标（bookId/edition/structuralUnitId/structuralPath），保留 v1 locator 行兼容
- [ ] 2.2 新 crosswalk 行 authority binding 重钉 `ctr:release:control-theory-engineering-v0.37`；钉旧 release 的行 fail closed
- [ ] 2.3 书籍 id 别名表：投影 sourceDocumentId → 阅读器 bookId + edition，解析目标必须存在于 v2 manifest，否则 fail closed

## 3. 运行时消费

- [ ] 3.1 `runtime-full-binding.ts` textbook 通道扩量消费 v2 crosswalk（不再限 6 行 locator）；未知 canonical 进例外账本
- [ ] 3.2 教材资源经别名表 + v2 坐标解析挂到 `buildTextbookReaderHref`；REFERENCE_ONLY 按 design 决策 6 的确认结果执行
- [ ] 3.3 linkage/identity 校验：映射坐标可解析到真实 v2 单元，href 与混合检索/阅读器同一 URL 体系

## 4. 快照/物化 sources 填充

- [ ] 4.1 `materialize.ts` node-detail `sources` 由评审通过的映射账本经显式输入填充，不再恒写空数组
- [ ] 4.2 物化保留激活快照自带的 `sourceMappings`/`sourceObjects`/`evidence`（存在时），不得丢弃
- [ ] 4.3 detail 分片 sources 条数上限与 payload budget 断言显式调整
- [ ] 4.4 画布节点详情零前端改动验证：`presentSourceCitation` 显示教材出处，点击跳统一阅读器

## 5. 验证与发布

- [ ] 5.1 聚焦测试：候选生成确定性、评审账本不可变、例外账本闭合、覆盖率门禁 fail-closed、别名解析、坐标→href、物化 sources
- [ ] 5.2 `rtk npm run typecheck` 与相关域测试通过
- [ ] 5.3 合入 `integration` 后，生产内容发布（重新物化分片、投影重发布）——执行时单独授权
