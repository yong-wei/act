# Implementation Handoff（任务 1.3/1.4 基线，2026-08-25）

负责人已授权生产切换与部署（2026-08-25）。本文件记录执行前核实的实现面基线、生产现状与执行前提，作为后续实现的单一事实源。

## 主规范复核（任务 1.1/1.2，2026-08-25）

- 已对照归档的 `gate-formal-runtime-resources-on-canonical-bindings` delta 与现行 `canonical-knowledge-resource-binding`、`content-addressed-runtime-release-storage` 主规范；正式资源信封、Git/外部输入来源证明、manifest-last 发布和 v2 生命周期仍在现行规范中。
- `68de3610f` 之后未修改这四个相关主规范：`canonical-knowledge-resource-binding`、`content-addressed-runtime-release-storage`、`act-teaching-projection`、`act-canonical-teaching-relation-governance`。现行 Runtime 规范新增的 coordinated selection 要求与本 change 的 delta 一致，没有兼容性漂移。
- 实现仍以 `act-runtime-release.ts` 的 source-proof → immutable manifest/receipt 两阶段闭合和 `runtime-blob-release-lifecycle.py` 的生命周期为唯一 Runtime authority；本次只在其上增加候选阶段，不引入旁路 selector。

## 生产现状（2026-08-25 SSH 核实）

- 宿主 `root@121.40.124.135:/home/projects/act`，公网 `https://act.adapt-learn.online`
- 容器：`act-obe-app` / `act-obe-worker` / `act-obe-postgres` / `act-obe-redis` 全部 Up（31h）
- `ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover`
- **Authority 现行 = v0.22**：`authority/current.json` → snapshot `snap-9c4b2c1c…`，`activationReceiptId: v022-cutover-authority`，`activatedAt: 2026-08-20`
  - 本地 Git 树的 `authority/current.json` 仍为 v0.9（`snap-7f4cdd10…`）——**本地树指针落后于生产，前任状态必须以远端为准读取**
- `data/runtime/releases/` 有 4 个 `runtime-*` blob release 在位
- `course-content/runtime/knowledge/` 子树为空（v0.22 激活未写 projection/consumer-activation 目录）

**本次切换语义：v0.22（生产现行）→ v0.37 remediation（successor）**，而非本地树上的 v0.9 → v0.37。

## 组件映射（提案任务 ↔ 已有实现）

| 提案节 | 状态 | 依据 |
|---|---|---|
| 2 capture | 组件就绪 | `capture` 子命令 + `latest-authority-oss-cutover/capture.ts`（v0.37 capture 已在 #1515 密封：releaseHash `cc73fa15…`） |
| 3 denominator | 组件就绪 | `denominator.ts`；#1515 证据运行已构造 v0.9-non-resource 基线 + 1058 全 NEW delta（需按生产 v0.22 前任重绑） |
| 4 incremental cache | **缺口** | 仅有 allocation 重绑；完整缓存身份体系未实现。对本次全量 successor（1058 全 NEW）非必需，服务后续增量发布 |
| 5 continuity gate | 组件就绪 | `continuity-gate.ts`；#1515 证据运行 QUALIFIED |
| 6 teaching closure | 组件就绪 | `teaching-closure.ts`；22428 行三族闭合工件在 `formal-resource-remediation/` |
| 7 candidate envelope | 组件就绪 | `envelope.ts` + remediation-bound 模式（#1515 12.5/12.6 已验证：消费 handoff、唯一共享 allocation `92fe43d6…`、non-selectable） |
| 8 stopped-service transaction | **部分缺口** | v0.18/v0.22/v0.40 事务基础设施在（`production-cutover.ts` + `remote-production-cutover.sh`），但 inner receipt 绑 candidate-receipt 的 coordinated 形态未适配 |
| 9 runtime 集成 | **缺口** | `runtime-binding.ts` 有 manifest extension；Runtime Release v2 实际物化 + active receipt 绑定未接 |
| 10 验证与发布 | 待执行 | 依赖 4/8/9 完成 |

## 关键架构事实

- 生产消费形态 = authority-store 文件面（`snap-*/engineering.json+manifest.json+stage-receipt.json`、domain shards、catalog、locale presentation），由 `src/app/api/knowledge/_active-authority.ts` 经 `authority-store`/`authority-domain-shards` 读取。
- #1515 handoff 注明 "domain fragments currently also serve the shard/overlay role"——remediation 15 域 fragments 与 shard 形态同构；r3 `locale-manifest.json` 的 capabilities 对接 `authority-locale-readiness` 消费面。
- **缺口 C（知识面构建器）**：remediation 投影（v0.37 capture + teaching-projection + fragments + consumers）→ authority-store 消费形态的生成器不存在。v022 链的生成器（`admit-latest-actkg-aggregate` → `stageAuthorityAfterValidatedBundleImport`）消费 DB aggregate 形态，不能直接承载 remediation 投影。
- 提案 design §7 堵死了 same-schema 裸 admit 升级路径：v0.22→v0.37 必须走 coordinated candidate + 停服事务，不得复用 v022 链直接切换。

## 实现顺序（执行前提）

1. 缺口 C：v0.37 authority snapshot + shards/catalog/locale 工件构建器（从 remediation 工件生成 authority-store 形态）
2. 前任重绑：candidate 输入的 predecessor selector 状态改为读取生产 v0.22 实况（7 指针 + runtime lifecycle），替换 #1515 证据运行的 v0.9 绑定
3. 缺口 B（8 节）：事务 inner receipt 绑 coordinated candidate；`remote-activate-knowledge-cutover.sh` 输入面适配新 authority 形态
4. 缺口 B（9 节）：successor runtime release 构建 + OSS 物化（`act-course-assets` bucket），materialization receipt 回填 candidate
5. 10 节全套验证后，按两段独立授权执行：部署（镜像 + provenance）→ 停服激活事务
6. 第 4 节增量缓存不在本次切换的关键路径上；如需保留为提案范围，在实现完成后补充，不阻塞切换

## 构建器形态映射（缺口 C 设计基线，已核实数据源）

v0.37-r3 bundle（`releases/control-theory-engineering-v0.37-r3/`）→ authority-store snapshot 的字段映射：

| engineering body 语义集 | bundle 数据源 | 形态 |
|---|---|---|
| objects（7476） | `domain-projection.json` nodes：entity_id/display_name/description/labels/evidence_refs/governance_keys/concept_kind/publication_status/release_tier；整行 node 作 payload | 直接映射 |
| relations | `domain-projection.json` links（3047）：relation_id/relation_family/relation_type/source_id/target_id/direction/evidence_state | 直接映射 |
| releaseEntries（10640） | `release.json` entries：entity/entity_role/inclusion_reason/release_tier | 直接映射 |
| linkMetadata | `projection-link-metadata.jsonl` | 直接映射 |
| projectionIdentities | `projection-profiles.json`（profile/versionDigest/sourceRelease/nodeCount/linkCount/artifactSha256） | 直接映射 |
| releaseComponents | `component-releases.json` | 直接映射 |
| sourceMappings/sourceObjects/evidence/upstreamRagReferences | `rag-crosswalk.jsonl` + node evidence_refs，或受控空集（以 `verifyMaterializedSnapshot` 约束为准，实现时核对） | 待映射 |
| manifest 字段 | releaseHash `cc73fa15…`、sourceDatasetHash `2f7f8245…`、predecessorReleaseId `ctr:release:control-theory-engineering-v0.22`、v3 bundle 协议 | 直接映射 |

admit 链（ctkg-0.2-aggregate 协议）对 v0.37 不可用：ActKG r3 树内无 aggregate 发布（2026-08-25 核实），v0.37 只发布了 public bundle（ctkg-release/0.3）。

**构建器已实现并落盘（2603cd91f，2026-08-25）**：`scripts/knowledge-cutover/build-v037-authority-snapshot.ts` 产出 `snap-e955b1ca155573fafae21e9fa1ddab397da7462ab9fd66c60c6d97b87a37e520`（7476 objects / 3047 relations / 10640 entries / 17 components / 3 profiles / 3047 linkMetadata；两行 m3-v2u source-object 简写已展开并注明），`verifyMaterializedSnapshot` 读回通过，candidate-only（零 selector 写入）。catalog 的 10 个种子成员已确认被新 snapshot 覆盖。**剩余联动**：authoring catalog（catalog.json 的 authorityBinding 仍指 v0.9 snap-7f4cdd10）需在激活流程内重绑 snap-e955b1ca 并 runtime 化；shards 在激活事务内按 activation 身份物化（现有函数链），不属于构建器职责。

## 前任实况与依赖图（2026-08-25 读取，工件 `cutover/predecessor-v022/`）

- **生产 v0.22 前任组合**：authority 唯一 PRESENT（snap-9c4b2c1c，objectCount 7082，activatedAt 2026-08-20）；**六个 runtime 知识指针全部 ABSENT**（v0.22 只激活了 Authority 面）；active Runtime Release v2 = `runtime-89fef308…`（generation 17，7272 文件 / 6.18GB，inventory 已落 `runtime-active-inventory.json`）。
- **切换形态**：Authority 继任（v0.22→v0.37）+ runtime 知识面（projection/prerequisites/shards/catalog/consumer）首激活的混合事务。v040 first-activation preflight（要求 all-ABSENT 含 authority）不适用。
- **denominator 语义裁定**：baseline = runtime-89fef308 的 7272 文件级 blob 条目（全部 INCLUDED，不 retire）；delta = remediation 1058 治理资源（全 NEW）——两套身份体系诚实共存，successor runtime release 物化本就包含全部资源 blob。
- **执行依赖图（钉死顺序）**：① successor 知识面物化（remediation 投影 → `stageTeachingProjection`：`TeachingProjectionAuthoringInput{scopeId, authoringRevision, authorityReleaseId=ctr:release:…v0.37, authoritySnapshotId=snap-e955b1ca…, resources/bindings/prerequisites/coreNodes, authorityNodes=7476 端点索引}`；prerequisites/consumer 面同链）→ ② successor Runtime Release v2 物化（OSS，含新知识面）→ ③ 正式 candidate（predecessor=上述实况，successor expectations 引用①②身份）→ ④ 8 节事务（predecessor 混合形态：authority 匹配 v0.22、六指针 ABSENT→PRESENT）→ ⑤ 镜像/部署/激活。

## 知识面物化完成（2026-08-25，8ab84aef6）

**capture 语义修正**：snapshot 的 captureRevision 必须是 ACT 侧构建修订（与投影 authoringRevision 同源），不是 ActKG source commit——snap-e955b1ca 已被 snap-3ba36b03 取代（重新 staged + reverify；ActKG source 3e98864 仅保留在 bundleReceipt.sourceCommit）。

三面全部 staged（candidate-only，零指针写入），身份链冻结在构建时 HEAD 822372e28（工件随 bundle 上传到目标宿主、按 hash 校验，不在远端重建）：
- **Teaching Projection** `proj-e49f022280eb8a7a8a42ff9637acc747df2195fadee36877864eae9566867871`（绑 snap-3ba36b03；1058 资源 act:<type>:<slug>、891 资源级绑定、141 边、205 卡、7476 端点）
- **Prerequisites publication** `proj-b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b`（141 条 PUBLISHED 边 + #1515 域裁决作为 author decisions + 162 端点 core-node 分母，gate 通过）
- **Consumer activation** `activation-e3c8b5856c79c6728bc67710`（authority/projection 工件 rehash 验证；engineering-graph/engineering-rag/course-runtime 就绪，konling/learning-path/teaching-resource-rag BLOCKED_LOCAL_DEPENDENCY——激活时按 PINNED_PREVIOUS 诚实降级）

**剩余依赖图**：② successor runtime release v2 OSS 物化（`deploy-runtime-blob-release.sh`，凭证在本地 credential provider）→ ③ 正式 candidate（引用上述冻结身份 + ② 的物化收据）→ ④ 混合形态事务 → ⑤ 镜像/部署/停服激活。

## 切换执行时的硬性前提

- `rtk bash scripts/build.sh` 构建当前 revision 镜像 + provenance；镜像内知识消费实现与 v0.37 工件形态相容（容器内自检在 `verify_staged_application_image` 内置）
- 远端事务保留 plan/journal/receipt/command.log；失败按身份匹配回滚到 v0.22 组合
- 生产 DB 中 v0.22 时代的投影/候选/影子记录不删除（提案 proposal 明示）
