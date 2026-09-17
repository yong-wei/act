---
node_id: ctc_v11g-9dfc90c240d6bf3ebc285faf
authority_entity_id: "ctc:v11g-9dfc90c240d6bf3ebc285faf"
name: "振荡频率"
name_en: "Oscillation Frequency at the Stability Boundary"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4ca33b75e28358618bfb44b5f45e8b616a53eb138e2145efb3dec7bcb61d2157.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4ca33b75e28358618bfb44b5f45e8b616a53eb138e2145efb3dec7bcb61d2157.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-12a/previous/ctc_v11g-9dfc90c240d6bf3ebc285faf.md"
asset_refs: []
---

## 首页

# 振荡频率 | Oscillation Frequency at the Stability Boundary

**一句话定义**：本节点所指振荡频率，是系统在临界稳定增益处出现的持续振荡模态频率。

**核心直觉**：先找出临界增益对应的虚轴极点，再由虚部读取频率，不要与一般衰减暂态的频率混用。

**关键公式**：本例临界特征式为 $(s+3)(s^2+2)$，角频率为 $\sqrt2$。

**学习目标**：由临界特征方程求振荡频率，并区分边界模态、渐近稳定和非线性极限环。

---

## 详情

### 完整解释

当增益变化使闭环极点到达虚轴时，对应模态可能不再指数衰减。此时的频率由该对虚轴极点的虚部大小决定。它描述的是给定控制模型在边界处的线性模态，不能脱离临界参数，也不能直接当成任意观测振荡的统一频率。

边界情况不等于渐近稳定。如果响应中保留无衰减的振荡分量，就不会趋于一个固定终值。它也不是非线性极限环存在性的证明：线性模型的振幅由输入与初态决定，还没有讨论非线性限幅等机制。

### 教学计算/推理例

取归一化开环模型
$$
L(s)=\frac K{s(s+1)(s+2)},
$$
采用单位负反馈，闭环特征多项式为 $s^3+3s^2+2s+K$。当 $K=6$ 时
$$
s^3+3s^2+2s+6=(s+3)(s^2+2),
$$
所以极点为 $-3$ 和 $\pm j\sqrt2$。对应角频率为 $\sqrt2$，普通频率为 $\sqrt2/(2\pi)$ 个周期每单位时间。直接求根还可确认：$K=5$ 时全部根在左半平面，$K=7$ 时已有右半平面根。

在临界增益下，零初态单位阶跃响应为
$$
y(t)=1-\frac2{11}e^{-3t}-\frac9{11}\cos(\sqrt2t)
-\frac6{11\sqrt2}\sin(\sqrt2t).
$$
指数项衰减，但正弦和余弦项保留，因而输出持续振荡，没有有限常数终值。不能对这条曲线照搬稳定阶跃的2%调节时间计算。

### 适用条件与边界

这里的临界增益和频率只属于给定环路及负反馈约定。改变反馈符号、模型参数或增加延迟后，边界位置需要重新计算。频率以归一化时间为尺度，使用实际秒数时应同步转换。某个输出还可能因模态不可见或约消而呈现不同现象，本例闭环通道没有消去这对虚轴极点。

### 常见误区

1. **误区**：虚轴极点表示响应会慢慢衰减。**纠正**：本例相应项没有衰减因子。
2. **误区**：发现持续振荡就证明存在非线性极限环。**纠正**：本例只给出线性边界模态。

### 自检

1. 为什么频率取 $\sqrt2$ 而不是3？
2. 为什么本例临界阶跃没有常数终值？

**核对要点**：3来自衰减实极点，振荡频率由虚轴根决定；正弦与余弦分量长期保留。

### 关联节点

- **振荡周期**（无向，关系：相关）
- **增益裕度**（无向，关系：相关）
- **无阻尼自然频率 ω_n**（无向，关系：相关）
