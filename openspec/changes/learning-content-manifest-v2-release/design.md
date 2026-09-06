## Context

卡/图学习面板的完整链路与当前状态（均已核实）：

- **消费侧已就绪且 fail-closed**：`src/lib/authority-domain-shards/learning-content.ts:19` 要求清单契约恰为 `act-authority-learning-content-manifest/v2`；契约不符时 `readManifest` 返回 null，`resolveNodeLearningContent`（`:206`）对全部节点返回 unavailable，面板整组不可用。v2 结构 = authority 身份四元组（releaseId/releaseSetId/snapshotId/snapshotHash）+ 可选 teaching 印章（`teachingProjectionId`/`teachingProjectionHash`，存在时必须等于分片信封）+ `nodes[]{canonicalId, safeId, card{state,sha256}, infograph{state,sha256}}`。
- **readiness 分类器**：`src/lib/knowledge-surface/learning-content.ts:44` 对 v1（含别名与 `*/v1` 后缀）一律判 `version-drift`，契约缺/畸形判 `unavailable`，authority 四元组不符判 `identity-mismatch`，仅 v2 + 身份匹配判 `available`。
- **生产现状**：清单仍为 v1、只登记 2 个节点 → 全图不可用。本工作树运行态磁盘有 1236 张卡、1235 张信息图（Git 仅跟踪 1 节点夹具，卡/图不入库）。
- **导出脚本存在但未进流水线**：`scripts/knowledge/export-authority-learning-content-v2.py` 扫运行态卡/图、绑定 catalog 节点、缺卡缺图重复即非零退出、写 v2 清单，但不写 teaching 印章；`course-content/scripts/authority-cards/export_authority_cards_and_infographs.py` 做 authoring→runtime 复制并写清单（需 `--authority-shard-manifest`）。两个脚本均无任何 npm script 或发布脚本调用。
- **印章目前靠手工**：`scripts/knowledge/check-authority-surface-linkage.mjs:30` 要求清单 teaching 字段等于 overlay `current.json`；当前仓库清单上这两个字段是脚本外手工补写的。该门禁仅在 `src/lib/__tests__/authority-domain-learning-content.test.ts:242` 中被测试调用，未接入任何发布链。
- **根因**：`scripts/deploy-runtime-blob-release.sh`（`npm run deploy:runtime`）从 Git 快照构建 blob release（`buildGitRuntimeBlobReleaseSnapshot`），未入库的卡/图与 v2 导出都不在闭包内；`act-runtime-release.ts` 与 `materialize-runtime-blob-release.py` 中无任何 learning-content/cards/infographs 引用。不在 Git 的运行态内容的既有发布先例是 external input bundle 通道（`src/lib/runtime-external-input-bundle.ts`，当前只服务 `resources/textbooks/`，带精确前缀白名单与来源证明）。
- **缺图节点**：`ctkg:v3e-object-8c4354096b719a1d5e090da4`（Laplace transform）有卡无图；v2 schema 允许 `infograph.state: missing`，消费侧对此降级为「暂无可用信息图」。

## Goals / Non-Goals

**Goals:**

- teaching 印章由脚本产生并写入 v2 清单，消除手工补写；印章与 overlay 信封不一致时 fail-closed。
- v2 导出 + 印章 + linkage 门禁成为 `deploy:runtime` 发布链的必经步骤；release 闭包包含清单引用的全部卡/图资产。
- 本地生成的 v2 清单覆盖全部 1236 卡节点与 1235 图节点，sha256 校验通过，linkage 门禁通过。
- readiness 分类与消费侧解析的放行条件证明一致（v2 契约 + authority 四元组 + teaching 信封三者匹配，否则 fail-closed）。

**Non-Goals:**

- 不改消费侧解析器（`authority-domain-shards/learning-content.ts`）与 readiness 分类器（`knowledge-surface/learning-content.ts`）的实现——它们已按目标语义就绪。
- 不改卡/图内容本身（不重写、不补生成缺图）。
- 不执行生产发布与部署（步骤列入 tasks，执行时单独授权）。
- 不改 overlay A、教学投影、catalog 或 authority 分片身份。
- 不把 1236/1235 卡/图文件提交进 Git。

## Decisions

1. **印章步骤并入既有 v2 导出脚本。** 扩展 `scripts/knowledge/export-authority-learning-content-v2.py`：读 `course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json`，把 `projectionId`/`projectionHash` 写入清单；overlay 文件缺失、字段缺/畸形时非零退出。备选方案是把印章写进 linkage 门禁或另建印章脚本；拒绝——门禁只校验不生成，另建脚本会产生第二个事实源。

2. **发布链走 `deploy:runtime` 的 external input bundle 通道。** 为 learning-content 增加外部输入生成器（复刻 textbook 生成器模式）：声明前缀 `knowledge/cards/authority/nodes/`、`knowledge/infographs/authority/nodes/` 与清单文件，生成器内部先执行 v2 导出 + 印章，再执行 `check-authority-surface-linkage.mjs`，全部通过才把卡/图/清单计入 bundle 闭包；任一步失败则 bundle 构建失败、发布中止。备选方案是单独的手工内容发布脚本或把卡/图提交进 Git；拒绝——前者正是 v1 滞留的根因模式（游离于发布链之外），后者违反既定的不入库约束。Git 跟踪的 1 节点夹具继续只服务 CI fail-closed，不得作为生产清单发布。

3. **缺图节点登记 `infograph.state: missing`，不阻断导出。** 导出脚本把「有卡无图」从失败改为登记 missing 状态（schema 与消费侧均已支持）；「有图无卡」「无 canonical 映射」「重复身份」「空卡目录」仍非零退出——空目录保护防止运行态缺失时静默发布空清单。缺图节点后续补图属内容工作，不在本变更。

4. **readiness 对齐以验证闭合，不改实现。** 分类器与解析器的放行条件已经一致（v2 契约 + authority 四元组 + teaching 印章在存在时等于信封）；本变更补测试固定该对齐：同一清单在三者匹配时分类 `available` 且解析器放行，任一腿不符时分类器不给 `available`、解析器在读资产字节前 fail-closed。

## Risks / Trade-offs

- [卡/图资产体积进入 bundle]（1236 md + 1235 png）→ 复用 bundle 的内容寻址与增量机制；首次发布体积大是可接受的一次性成本，换得清单与资产同闭包、同 revision。
- [印章与 overlay 漂移导致发布中止] → 这是设计行为：fail-closed 阻止服务身份不一致的清单；操作员先修复 overlay 或重跑导出再发布。
- [缺图节点被误判为导出缺陷] → 清单显式登记 `missing` 状态，linkage 门禁对 `state: missing` 的行跳过哈希校验（消费侧本就如此），并在输出中打印 missing 计数供人工核对。
- [发布链改动影响 textbook 既有通道] → learning-content 生成器为独立前缀白名单项，不改 textbook 生成器逻辑；以既有 bundle 测试防回归。

## Migration Plan

1. 本地：扩展导出脚本与 bundle 生成器，重跑导出，核对清单 1236 节点、sha256 与印章；跑 linkage 门禁与对齐测试。
2. PR 合入 `integration`。
3. （单独授权）冻结该 SHA，执行 `npm run deploy:runtime` 完成生产内容发布；验证生产清单为 v2、节点覆盖完整、卡/图面板恢复。
4. 回滚：发布链恢复上一 blob release；清单为不可变内容寻址对象，不产生就地改写。

## Open Questions

无。印章归属脚本、发布链通道、缺图节点策略均已按仓库既有先例确定。
