---
status: accepted
context: act-owned-canonical-teaching-relations
supersedes: docs/grill/20260727-pm/adr/20260727-let-actkg-teaching-projections-own-knowledge-to-knowledge-pedagogy.md
---

# 由 ACT 永久负责 Canonical Object 之间的教学关系

## 背景

既有 ADR 规定 ActKG Teaching Projection 最终接管 Canonical Object 之间的包含、先修和关联关系。当前仓库的 active Authority domain shard 却没有绑定可消费 Teaching Projection，包含、先修和关联均为 0；另一个通用投影中的 4 条先修关系与 active shard 不属于同一身份包，不能作为当前覆盖。

工程 Authority 的对象和工程关系不是课程教学覆盖分母，也不能重标为教学关系。等待独立图谱项目补齐教学语义，会使 ACT 的课程结构、资源语义、教学顺序和审核责任长期没有本地权威。

## 决策

ACT 永久拥有 Canonical Object 之间的包含、先修和关联教学关系，包括作者数据、证据、方向、强度、候选生成、冲突、审核决定、版本化 Teaching Projection 和激活。ActKG 继续拥有 Canonical 身份、工程对象、工程关系和来源证据；ACT 生成的 Teaching Projection 必须绑定一个精确 ActKG Authority 身份。工程关系不得自动推断或重标为教学关系。

教学治理分母从目标 composed manifest 动态计算，为该 Authority 发布中正式纳入课程 active domain 的全部 Canonical Object；当前 408 个节点只是快照基线，不是长期常量。每个节点对包含、先修和关联分别具有处置位。包含关系是首发硬门禁：每个节点必须具有已通过父节点关系或明确课程根节点。先修和关联允许部分完成，真实边数由证据决定，不为满足数量制造关系。

教学关系采用自动优先、异常人工裁决。专用管道在代表性 gold/holdout 上以精确率和召回率平衡指标取得版本资格；通过单项阈值且没有证据不足、方向冲突或非法环路的结果可以直接发布。异常结果不生成正式边，也不能自动写成“无需关系”，而是进入 ACT 仓库内版本化 JSON/JSONL 审核包，由课程所有者批准、拒绝、修改或暂缓。Markdown 仅作为生成报告。

未裁决候选可以继续留在仓库审核包；正式 `PARTIAL` Teaching Projection 只包含已通过关系，并绑定真实分母、各关系族处置数、正式边数、待裁决数和审核包 hash。运行项目不提供审核入口、角色、entitlement 或在线裁决 API，也不展示审核包；当前范围只服务课程所有者本人的课程。

## 结果

- 本 ADR 完整取代旧的 ActKG Teaching Projection 最终权威决定；相关 OpenSpec 必须显式修订冲突措辞和依赖。
- 当前图谱不能以“教学关系暂不可用”作为最终交付。包含骨架必须完整；先修和关联可诚实发布为 `PARTIAL`，运行态只展示已通过关系且不得宣称完整覆盖。
- 教学候选、审核决定和投影均绑定 Authority、课程输入、模型或算法、配置、证据和内容 hash；输入或管道版本变化时重新生成或重新准入。
- 未来扩大到其他教师或多课程协作时，另开权限和多租户治理变更，不从本次单人仓库审核推断运行态角色。

## 未采用方案

- 继续等待 ActKG 建立教学关系：无法履行 ACT 对本课程教学结构的交付责任。
- 把工程关系直接映射成教学关系：混淆工程事实与教学编排，并可能产生错误方向或环路。
- 任一异常阻断全部合格关系：会让可验证教学骨架长期不可用。
- 将低置信候选自动写成无关系：会伪造覆盖完整性并丢失待裁决事实。
