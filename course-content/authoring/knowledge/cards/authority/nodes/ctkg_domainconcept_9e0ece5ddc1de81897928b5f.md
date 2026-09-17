---
node_id: ctkg_domainconcept_9e0ece5ddc1de81897928b5f
authority_entity_id: "ctkg:domainconcept:9e0ece5ddc1de81897928b5f"
name: "采样周期"
name_en: "Sampling Period"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consevent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-27b38c6bc5b494259e82ea4b8f5810707016e5e099b5c9c271fddb3275f591d8.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-27b38c6bc5b494259e82ea4b8f5810707016e5e099b5c9c271fddb3275f591d8.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-08a/previous/ctkg_domainconcept_9e0ece5ddc1de81897928b5f.md"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-08a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 采样周期 | Sampling Period

一句话定义：采样周期是相邻采样时刻之间的固定时间间隔，它影响离散模型、控制更新与采样间行为。

- 采样率是采样周期的倒数。
- 保持控制与连续实时反馈是不同系统。
- 选定周期后仍需核验闭环稳定和性能。

---
## 详情
### 完整解释

均匀采样时刻可写为t=kT，其中T为正采样周期、k为整数索引。采样率为1/T。数字控制器通常只在这些时刻获得新样值并计算输入，保持环节决定两个采样时刻之间实际施加什么连续信号。因此周期不只是图上点的间距，还进入对象离散化及闭环特征方程。

选择T需要同时考虑对象动态、期望闭环速度、计算与通信时间，以及采样间安全要求。某些经验比例可以提供初始选择，却不构成任意模型、增益和延迟下的稳定保证。下面用同一连续对象和同一反馈系数说明周期改变足以改变稳定性。

### 教学计算/推理例

连续对象为 $\dot x=-x+u$。在t=kT采样，计算 $u[k]=-2x[k]$，并将该输入在整个区间 $[kT,(k+1)T)$ 保持不变。由原方程精确积分得到

$$
x[k+1]=e^{-T}x[k]+(1-e^{-T})u[k].
$$

代入数字反馈后，闭环采样状态满足

$$
x[k+1]=(3e^{-T}-2)x[k].
$$

因此渐近稳定要求 $|3e^{-T}-2|<1$。对T>0整理可得 $T<\ln3$，即稳定区间为 $0<T<\ln3$。T=0.5时，闭环特征值约为-0.1804，样值交替衰减；T=1.5时，特征值约为-1.3306，样值交替增长。

连续实时反馈若为u(t)=-2x(t)，闭环则是 $\dot x=-3x$，确实稳定。但这里采样后保持的是采样瞬间计算的输入，区间内不会随真实状态连续更新，所以不能把数字闭环直接写成 $e^{-3T}$。两种实现的行为差异正是本例的关键。

### 边界与工程解释

T=ln3时，离散特征值等于-1，非零样值持续交替而不衰减，不属于渐近稳定。选择恰好接近这个边界的周期，即使理论上位于稳定一侧，也不代表具有充分的误差或延迟余量。

在较长保持区间内，旧状态决定的输入可能持续作用过久，使下一样值越过目标且幅度更大。这个解释不能代替数学判据，但可以帮助理解为何“数字计算正确”仍可能得到不稳定闭环：变化来自控制更新方式，而非计算器是否算错乘法。

### 适用条件与边界

本例没有额外计算延迟、量化误差或丢包，且保持方式为零阶保持。若控制在下一拍才施加，或者采用不同保持方式，模型和稳定区间都要重新推导。不能将这里的ln3当成其他对象的通用采样上限。

信号重建的采样定理与闭环稳定性判据回答不同问题。满足某个带限信号的采样要求，并不能自动保证给定数字反馈闭环稳定。还应检查采样间连续响应；只看样值没有超限，不足以排除两个样值之间的峰值。

### 常见误区

1. 把T当成只影响画图密度的参数。
2. 将采样保持反馈误写为连续闭环的精确采样。
3. 仅凭经验采样倍数就省略闭环核验。

### 自检

1. 本例数字闭环的特征值为何不是 $e^{-3T}$？
2. T=ln3时是否属于渐近稳定？

**核对要点**：输入在采样区间内保持旧样值计算结果，而非实时反馈；不属于，特征值为-1，非零样值不衰减。

### 关联节点

- **采样率**（入边，关系：推导自）
- **采样器**（出边，关系：适用于）
- **采样率**（无向，关系：相关）
