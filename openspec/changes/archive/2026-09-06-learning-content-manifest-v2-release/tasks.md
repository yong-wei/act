## 1. teaching 印章脚本化

- [x] 1.1 扩展 `scripts/knowledge/export-authority-learning-content-v2.py`：读 `course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json`，把 `projectionId`/`projectionHash` 写入清单；overlay 缺失或字段缺/畸形时非零退出
- [x] 1.2 缺图节点策略：有卡无图登记 `infograph.state: missing`（null hash）不阻断；有图无卡、无 canonical 映射、重复身份、空卡目录仍非零退出
- [x] 1.3 重跑导出，核对清单：contract v2、1236 卡节点 + 1235 available 图节点、印章等于 overlay current、全部 sha256 抽验通过

## 2. 发布链纳入

- [x] 2.1 在 `src/lib/runtime-external-input-bundle.ts` 增加 learning-content 外部输入生成器（前缀 `knowledge/cards/authority/nodes/`、`knowledge/infographs/authority/nodes/` + 清单文件），生成器先执行 v2 导出 + 印章，再执行 `scripts/knowledge/check-authority-surface-linkage.mjs`，失败即中止 bundle 构建
- [x] 2.2 把该生成器接入 `deploy:runtime`（`scripts/deploy-runtime-blob-release.sh` / `act-runtime-release.ts`）的 bundle 准备阶段，使卡/图/清单进入 blob release 闭包；Git 1 节点夹具不得作为生产清单发布
- [x] 2.3 验证 release 计划/manifest 含清单与其引用的全部资产；导出或门禁失败时发布中止、既有激活清单不受影响

## 3. readiness 与消费侧对齐验证

- [x] 3.1 补测试：同一清单在 v2 契约 + authority 四元组 + teaching 信封三者匹配时分类 `available` 且解析器放行；契约 v1/别名、四元组不符、印章不符时分类器不给 `available`、解析器读资产前 fail-closed
- [x] 3.2 运行 `src/lib/__tests__/authority-domain-learning-content.test.ts`（含 linkage 门禁用例）与新增对齐测试
- [x] 3.3 运行 `rtk npm run typecheck` 与受影响域测试

## 4. 生产发布（需单独授权）

- [ ] 4.1 合入 `origin/integration` 后冻结该 SHA，执行 `rtk npm run deploy:runtime` 完成内容发布（单独授权后执行）
- [ ] 4.2 生产验证：清单为 v2、覆盖完整节点集、印章等于活跃 overlay；抽查节点卡/图面板渲染恢复
- [ ] 4.3 回滚预案就绪：恢复上一 blob release，确认面板回到 fail-closed 降级态
