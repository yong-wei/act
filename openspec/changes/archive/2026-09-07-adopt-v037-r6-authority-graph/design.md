## Context

运行时图谱数据链：上游 bundle → authority 快照（`snap-*`，engineering.json）→ 域目录（`adc-*`）+ 教学投影（domain-fragments `proj-*` / 课程投影 `proj-*`）→ 消费者激活（`activation-*`，六消费者 combination）→ 分片集（`ads-*`）→ 六个 runtime selector（`consumer-activation/current.json`、`authority-domain-catalog/current.json`、`teaching-projection/domain-fragments/current.json`、`projection/current.json`、`prerequisites/current.json`、`authority-domain-shards/current.json`）。`resolveActiveShardIdentity`（`src/lib/authority-domain-shards/identity.ts:94-234`）从 consumer-activation 的 engineering-graph combination 读快照身份，不从 authoring 侧 `authority/current.json` 读。

当前状态：快照 snap-e2d8b92f（绑 r4 bundle digest 2943366b…），分片集 ads-74558e30（#2043 物化，含教材 sources），domain-fragments proj-05984a0f，课程投影 proj-b0b02692（绑旧快照），消费者激活 activation-0b72f577。

r6 bundle 已镜像到 `course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r6/`（commit `73f01e022`）。上游克隆 `/Users/YW/Documents/Project/ActKG` HEAD=fcfd48d（含 r6 tag）；capture 对脏工作树 fail-closed，运行前需提交或 stash 其 `.wolf/*` 改动。

## Goals / Non-Goals

**Goals:**

- 运行时图谱消费 r6：79 条先后修边、名词短语标签、683 实体别名、隐藏内部记录公式全部到达分片。
- U1：relation-family 分片与所交付关系的端点同交付，view-model 不再因端点缺席丢边；覆盖收据（U6）与最终 payload 账实一致。
- 六个 selector 同一提交原子切换；旧分片集按既有保留策略处置；全部 receipt 绑定同一 capture revision。
- 定向分片测试 + 呈现资格验证 + `npm run typecheck` 零错误基线不破。

**Non-Goals:**

- 不执行生产发布、远端切换或 `deploy:runtime`；不改生产选择器。
- 不改上游 bundle 字节；不在本变更消费先后修边做路径规划（属 `consume-engineering-prerequisite-order`）。
- 不重建 engineering-textbook-mapping 治理链（denominator.json 钉旧快照属既有事实，其重建是独立决策；本变更仅保证物化路径的 sources-input 绑定校验通过）。
- 不处理 #2031（headless 捕获环境指针问题）。

## Decisions

1. **U1：family 分片 bounded 端点闭包。** `buildAuthorityDomainShards`（`src/lib/authority-domain-shards/materialize.ts`）在交付某 relation-family 分片时，将该族关系的全部端点对象并入同一分片（对象去重、只含呈现必需字段）；端点对象不计入「domain-default 只含有界域概念」的既有约束（该要求限域 default 分片）。备选「view-model 容忍缺失端点并按需拉 neighborhood」被拒：2462/3063 边受影响，逐边回补等于废弃分片边界设计，且首屏 N+1。
2. **U6：收据取最终 payload。** `teachingCoverage.relationCount`（及同类计数字段）在分片写盘前从最终序列化 payload 重算；禁止从声明值或上游 Coverage v0.34 抄录（Coverage 是教材章节覆盖，不是教学关系）。
3. **prerequisite 谓词一等族。** `families.ts:22-31` 增加 `prerequisite` → 先后修族映射，`materialize.ts:79-89` `SUPPORTED_PREDICATES` 同步；79 条 DC–DC 有向无环边作为工程层关系在画布可过滤呈现。备选「仅留 neighborhood 分片」被拒：上游铸造该谓词的目的就是学习顺序可见，且 U1 闭包使其端点天然可得。
4. **别名进快照与分片。** `build-v037-authority-snapshot.ts:366,373-380` 从只收 `name`/`canonical_preferred` 扩展为同时收 localized-content `field_path=alias` 与 mli `alternative` 行；registry v0.37 行 `multilingualLabelCount` 改为构建器实际产出的多语标签证据计数（同时修正 2330 vs 7476 的既有语义债——该字段语义在 registry 与快照 manifest 间必须一致）。
5. **catalog 退役 4 成员走显式治理裁决。** r6 域投影 7472 节点；退役对象均为 v0.22 继承成员、不在 176 条 assignments 内、sources-input 零条目（已实测）。`build-v037-r4-domain-catalog.ts` 的 7476/7300/176/零退役断言参数化为「声明退役集 + crosswalk 重钉」，退役集写入候选目录治理证据；catalogVersion 去 r4 硬编码。
6. **课程投影随权重绑。** projection/current.json 与 domain-fragments 一并重组到新快照：`compose-successor-domain-fragments.ts --successor-authority-manifest <新 snap>` 重组域投影；`restage-runtime-teaching-bindings.ts` 的 r4 bundle 路径与固定 activationId 参数化后重绑课程投影；v2 教材定位行按 r6 bundleDigest 重发（`emit-crosswalk-and-sources.ts:36` 同步换径）。不做则分片因 envelope 不匹配丢弃全部教学关系（shard-delivery spec「Old or mismatched projection」条款），本变更反而放大「教学关系 0 条」。
7. **selector 原子切换。** 新增 r6 的 consumer-activation staging + selector apply 脚本（前任 activation-0b72f577，参数化 `apply-r4-c4-runtime-selectors.ts`/`restage-r4-c4-consumer-activation.ts` 的硬编码）；六个 current.json 同一提交写入；engineering-graph combination 的 projectionId 维持 null（现状语义）。
8. **locale 资格包随切换同提交重建。** `v037-adapter.ts:33-34` 改 r6（或参数化）；旧包在切换瞬间即 fail-closed（`verifyLocaleQualificationPackage` 对包内 authority/catalog/shardSet 与活指针一致性校验），因此包重建（`build-v037-r5-locale-qualification.ts`，构建时读活分片）必须在 selector 切换之后、同一提交内完成，随后回填 registry 的 publicationId/publicationHash（新 qualificationHash）。

## Execution Runbook

按序执行（每步产物即 receipt，fail-closed 门禁见各脚本）：

1. 前置：提交/stash 上游克隆 `.wolf/*` 脏改动；registry v0.37 行 `multilingualLabelCount` 改为预期产出口径。
2. `tsx scripts/knowledge-cutover/coordinate-latest-authority-oss-cutover.ts capture --actkg-root /Users/YW/Documents/Project/ActKG --out course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r6`（--skip-fetch 可选；compatibility≠COMPATIBLE 即停）。
3. `tsx scripts/knowledge-cutover/build-v037-authority-snapshot.ts --capture <上步 authority-capture.json> --staged-at <RFC3339 毫秒>`（自动推导 bundle 目录；校验 digest 一致、SHA256SUMS、7472 节点 zh 标签全覆盖；不写任何 selector）。
4. catalog：改造后的 `build-v037-r4-domain-catalog.ts --snapshot-dir <新 snap> --predecessor-catalog/--predecessor-authoring <现行> --out <候选>`（声明退役集，crosswalk 重钉）。
5. 教学投影重组：`compose-successor-domain-fragments.ts --successor-authority-manifest <新 snap manifest> --out <候选>`；`stageDomainTeachingRuntimeFromCandidate` 显式传 candidateDir（其默认硬编码 r4-c5）。
6. 课程投影重绑：`restage-runtime-teaching-bindings.ts`（参数化后）；教材 crosswalk/sources 按 r6 重发。
7. 消费者激活 staging + 六 selector apply（新 r6 脚本，前任 activation-0b72f577）。
8. `tsx scripts/knowledge/materialize-authority-domain-shards.ts`（含 U1/U6 修复后的构建器；原子写 `authority-domain-shards/current.json`）。
9. 呈现资格：`verify-r4-authority-presentation-labels.ts --snapshot-dir <新 snap> --catalog <runtime catalog.json> --shard-stage <分片 stage> --out <资格 json>`；locale 资格包重建；registry 13 字段回填。
10. 验证：定向 vitest（authority-domain-shard-coverage/delivery/sources、authority-domain-display-catalog、authority-locale-readiness、authority-locale-v037-package、latest-authority-oss-cutover）+ `npm run test:unit` + `npm run typecheck`；浏览器 zh↔en 切换与图谱冒烟（对照 `artifacts/activate-v037-bilingual-authority-graph-1741` 先例）。

## Risks / Trade-offs

- [capture 输出 ADAPTATION_REQUIRED] → 按 incompatibleReasons 先走适配评估，不强行接入。
- [别名/先后修族扩大分片体积] → 端点闭包只含呈现必需字段；体积增量写入 stage receipt 供审阅；性能验收沿用既有延迟/I/O 预算门禁。
- [退役 4 成员存在未发现的运行时引用] → 退役裁决前置 grep/图谱引用扫描（含 rag-crosswalk、cards、infographs），证据入候选目录；引用存在则该成员移出退役集并记录例外。
- [课程投影重绑与 #2043 教材通道耦合] → 重发 crosswalk v2 时 sources-input 重新绑定活 coverage digest；不通过则停在 staged，不切 selector。
- [单提交原子切换的评审体量] → 代码改动（构建器/适配器/脚本参数化）与数据产物（snap/ads/指针）分 commit 落地，selector 切换单独 commit 并附全部 receipt 哈希。

## Migration Plan

纯仓库内 staged 切换：六个 selector 同提交指向新身份；旧 ads-74558e30/snap-e2d8b92f 目录保留在仓库内直至下次清理变更；回滚 = revert selector 提交（分片集不可变，旧集仍可打开）。生产切换走既有 `deploy:runtime` 授权流程，不属于本变更。
