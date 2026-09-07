## Why

上游 ActKG 已发布 `ctb:control-theory-engineering-v0.37:r6`（digest `ca20b912cd84a57a…`，publication tag `control-theory-engineering-v0.37-r6`，source tag `…-source-r7`）。r6 是 r5 的呈现/图后继，不重写已发布字节，实测核验：

- U2 已修：新增 79 条 `prerequisite` ProjectedLink（DomainConcept–DomainConcept、有向、无环，`ctkg:m4-u2u5:prerequisite:*`）——不依赖教学设计的学习顺序数据首次进入工程图谱；
- U3 已修：303 个超长 DomainConcept zh 名改为课堂名词短语（zh name>16 字符 4373→4070），218 个 Internal Record 公式进入 hidden_entities；
- U4 已修：`ctc:c782502fe412ef828c662650` 更名「闭环传递函数伴随概念」；
- U5 已修：683 实体新增 alias（zh/en 对称，localized-content `field_path=alias`）；
- **U1/U6 退回 ACT**（上游 release 处置表原文）：U1 = family 分片必须与关系端点同交付（bundle 内 3047 边 0 dangling， dangling 是 ACT 分片层制造的）；U6 = `teachingCoverage.relationCount` 必须取最终 payload。

本仓库实测（ads-294a0616 全量数据）：3063 条 ENGINEERING 关系中 2462 条（80%）至少一端不在概览层交付内（2289 个唯一对象仅存在于 node-neighborhood 分片），view-model 按 visibleIds 丢弃悬空边（`src/features/knowledge/authority-graph-view-model.ts:148`）；teachingCoverage 收据与载荷不符（root-locus 声称 1 条实际 0 条）。当前仓库 authority 快照仍绑 r4 bundle（snap-e2d8b92f），不接入 r6 则先后修边、名称修复与别名永远到不了运行时。

## What Changes

- 接入 r6 bundle（已镜像至 `course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r6/`，25 文件 SHA256SUMS 全过）：capture → authority 快照 → 域目录 → 消费者激活 → 分片物化 → locale 资格包 → registry 全量回填，六个 runtime selector 同一提交原子切换。
- **U1 修复（先于物化）**：`buildAuthorityDomainShards` 的 relation-family 分片必须与所交付关系的端点对象同交付（bounded closure），消除「边交付而端点缺席」；物化一次完成，不二次重建。
- **U6 修复**：`teachingCoverage.relationCount` 等覆盖收据字段改从最终分片 payload 重算，不从上游 Coverage v0.34 或声明值抄录。
- **先后修谓词一等呈现**：`prerequisite` 谓词加入 ENGINEERING relation family 映射与 `SUPPORTED_PREDICATES`，作为画布可过滤的一等关系族（先后修）。
- **别名上图**：快照构建器收 `field_path=alias` 行与 mli alternative 行，别名进入分片标签/检索；修正 registry `multilingualLabelCount`（当前 2330 与实际 7476 不符的既有语义债）为构建器实际产出口径。
- **catalog 退役裁决**：r6 域投影 7472 节点，退役 4 个 v0.22 继承成员（`ctc:modeling-423b8453…`、`ctc:modeling-f6940765…`、`ctf:68d4b357…`、`ctf:8f245a09…`）；catalog 构建器的零退役硬编码断言改造为显式治理退役集，crosswalk 重钉。
- **课程投影随权重绑**：projection/current.json（proj-b0b02692 绑 snap-e2d8b92f）与 domain-fragments 一并重组到新快照；v2 教材定位行按 r6 bundleDigest 重发 crosswalk/sources（`runtime-full-binding.ts:220` 逐行比对 pin）。
- 硬编码改造：`v037-adapter.ts` r5 bundle 路径、`build-v037-r5-locale-qualification.ts` 兜底串、`restage-runtime-teaching-bindings.ts` r4 bundle/固定 activationId、`build-v037-r4-domain-catalog.ts` 7476/7300/176 闭包断言与版本串、新增 r6 的 consumer-activation/selector apply 脚本（前任 activation-0b72f577）。

## Capabilities

### Modified Capabilities

- `authority-domain-shard-delivery`：新增关系端点同交付（U1）与覆盖收据按最终 payload 重算（U6）两条要求。
- `active-authority-semantic-graph-presentation`：新增 `prerequisite` 工程关系族一等呈现与治理别名上图两条要求。
- `authority-locale-readiness-and-switching`：v0.37 离线资格证据重钉到 r6 身份（修改既有要求的绑定对象）。

## Impact

- 代码：`src/lib/authority-domain-shards/`（materialize.ts、families.ts、contracts.ts）、`scripts/knowledge-cutover/build-v037-authority-snapshot.ts`（alias 行收取）、`build-v037-r4-domain-catalog.ts`（退役裁决参数化）、`src/lib/authority-locale-readiness/v037-adapter.ts`（r6 路径）、`scripts/knowledge-cutover/build-v037-r5-locale-qualification.ts`、`scripts/knowledge/restage-runtime-teaching-bindings.ts`、`scripts/knowledge/engineering-textbook-mapping/emit-crosswalk-and-sources.ts`、新增 r6 selector apply/activation 脚本。
- 数据产物：新 snap-*、adc-*、ads-*、activation-*、proj-*（domain-fragments 与课程投影）、registry 13 字段、`cutover/envelopes/locale-manifests/control-theory-engineering-v0.37.json`。
- 协调：与 `path-planning-consumes-teaching-projection`（#2046）、`bind-path-candidates-runtime-assets`（#2055）语义正交；`consume-engineering-prerequisite-order`（先后修消费）依赖本变更先行合入。
- 非目标：不执行生产发布/运行态切换（`deploy:runtime` 属另行授权操作）；不改上游字节；不动 #2031（headless 捕获环境指针问题，与 r6 数据无关，保持独立跟踪）。
