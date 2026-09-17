---
node_id: ctkg_v3e-object-bda94d95d799211be70fabf9
authority_entity_id: "ctkg:v3e-object-bda94d95d799211be70fabf9"
name: "自振荡"
name_en: "Autonomous Oscillation"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-3d2905c8ff5e7dc03d21a5fc810b5444c8569582f96029267952261fa592ee44.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-3d2905c8ff5e7dc03d21a5fc810b5444c8569582f96029267952261fa592ee44.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-bda94d95d799211be70fabf9.md"
asset_refs: []
---

## 首页
# 自振荡 | Autonomous Oscillation

一句话定义：在本课程语境中，自振荡是自激振荡的简称，指无需外部周期信号维持的内部周期运动。

- 识别自振荡要看激励来源和长期行为。
- 振幅收敛与相位同步不是同一个条件。
- 周期运动可以稳定、非稳定或只单侧吸引。

---
## 详情
### 完整解释

“自振荡”强调周期运动来自系统内部闭环动力机制。若一个稳定线性系统受到持续正弦输入而产生同频响应，属于强迫响应；若系统只因初态发生逐渐衰减的振荡，也不属于稳定持续自振荡。无阻尼线性振子的自由周期运动虽无需周期输入，却通常形成连续轨道族，不能直接当成具有振幅选择机制的稳定极限环自振。

判断时应明确模型是否自治、是否有外部周期输入、振幅是否长期维持，以及附近扰动后的轨道行为。只看频谱出现一个峰，信息不足以区分这些情形。

### 教学计算/推理例

对径向系统 $\dot r=r(1-r^2)$、$\dot\theta=1$，非零初始半径趋向1。设两条轨迹初始相位分别为0和 $\pi/2$，即使最终半径都为1，二者相位差仍可保持 $\pi/2$。它们都靠近同一几何周期轨道，却不会在同一时刻处于同一点。

这说明稳定周期轨道的吸引通常是到轨道集合的距离趋近，而不是所有轨迹自动同相。若任务要求与外部时钟同步，还需额外耦合或同步机制，不能从“稳定自振”四字中推出。

作为对照，取 $\dot r=r(r^2-1)^2$、$\dot\theta=1$。半径1也形成周期轨道，但内侧趋近、外侧远离，是半稳定极限环。若只从0.9测试，会看到逐渐接近；从1.1测试则看到远离。相同的环上周期不代表相同的扰动稳定性。

### 适用条件与边界

真实系统可能有能量供给、限幅和耗散，它们共同决定是否维持振荡。没有外部周期信号并不意味着物理能量凭空产生。噪声可触发偏离不稳定平衡点，但噪声本身是否成为持续周期驱动，应根据机制区分。

有限时长数值轨迹只能提供观察证据，慢暂态可能看起来周期，半稳定轨道附近也可能长时间几乎不变。应结合方程、初态扰动、时间尺度和适当理论判断。描述函数交点提供的是近似候选，不能独立确认精确振幅、周期及稳定性。

一个系统还可能同时具有平衡点和周期吸引子，不同初态进入不同长期状态。因而报告自振荡时应说明参数、初态或吸引范围，不宜泛化为“该系统始终振荡”。

### 常见误区

1. 仅凭周期波形就忽略外部强迫输入和暂态。
2. 把轨道吸引误解为所有初态自动实现相位同步。
3. 只从一侧扰动测试便排除半稳定或其他边界行为。

### 自检

1. 两条轨迹都趋向半径1，是否必须具有相同相位？
2. 为什么半稳定例需要分别测试环内和环外？

**核对要点**：不必，相位差可保持；两侧径向行为不同，单侧收敛不足以证明双侧稳定。

### 关联节点

- **极限环**（无向，关系：相关）
- **间隙特性**（无向，关系：相关）
- **稳定极限环**（无向，关系：相关）
