---
node_id: ctkg_v3e-canonical-bf7bc53bf8286e07fa6035cc
authority_entity_id: "ctkg:v3e-canonical-bf7bc53bf8286e07fa6035cc"
name: "临界阻尼响应"
name_en: "Critically Damped Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c134d93723c663a1e474b5430563593b55b868cfe6d7a47b58c622489cae5880.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c134d93723c663a1e474b5430563593b55b868cfe6d7a47b58c622489cae5880.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-12a/previous/ctkg_v3e-canonical-bf7bc53bf8286e07fa6035cc.md"
asset_refs: []
---

## 首页

# 临界阻尼响应 | Critically Damped Response

**一句话定义**：标准临界阻尼二阶系统的零初态单位阶跃，以含时间因子的指数形式单调趋近终值。

**核心直觉**：在有限时间达到90%，不等于在有限时间精确达到100%。

**关键公式**：本例 $y(t)=1-(1+2t)e^{-2t}$。

**学习目标**：检查临界阻尼阶跃的单调性，区分有限阈值到达与渐近终值。

---

## 详情

### 完整解释

临界阻尼对应标准二阶系统的一对重复负实根。重复根使响应含有时间与指数的乘积，而不是简单地把两个相同指数相加。对本卡无零点、单位直流增益、零初态的标准通道，输出单调上升，没有欠阻尼超调。

“趋于终值”是极限描述。对于某些单调指数响应，输出在任何有限时间都仍与终值存在差值；工程中常用10–90%上升时间或允许误差带来描述速度，而不是要求精确等于最终极限。

### 教学计算/推理例

取归一化模型
$$
T(s)=\frac4{(s+2)^2},\qquad y(t)=1-(1+2t)e^{-2t}.
$$
初值 $y(0)=0$，且
$$
\dot y(t)=4t e^{-2t}\ge0\quad(t\ge0).
$$
所以输出单调上升。对于任意有限 $t\ge0$，$(1+2t)e^{-2t}>0$，故 $y(t)<1$；只有在 $t\to\infty$ 时，差值才趋于零。

求解 $y=0.9$，得到90%到达时间约为1.944860；分别求10%和90%的首次到达时刻，其差约为1.678954。这些指标都有限，但本例没有有限的0–100%首次到达时间。

因此，将某个软件报告的有限“上升时间”与来源采用0–100%口径的定义比较之前，必须先看清阈值。两种数字并不矛盾，它们描述不同事件。也不能把接近终值的小数舍入成1，就声称模型在该时刻已经精确到达终值。

### 适用条件与边界

本例的单调性依赖标准分子与零初态。添加零点或改变初态后，即使分母仍有重复负实根，响应也可能不同。调节时间还要另行规定容差，而不等于90%到达时间。临界阻尼标签本身不保证任何执行器约束或与不同频率系统之间的速度优劣。

### 常见误区

1. **误区**：没有超调，就一定在某个有限时刻停在终值。**纠正**：本例始终从下方渐近逼近。
2. **误区**：有限10–90%时间说明0–100%时间也有限。**纠正**：最终极限与较低阈值的到达条件不同。

### 自检

1. 哪个不等式证明有限时间内输出仍小于1？
2. 为什么本例可以使用有限的10–90%指标？

**核对要点**：$(1+2t)e^{-2t}>0$；0.1和0.9都位于有限时间可通过的输出范围内。

### 关联节点

- **临界阻尼**（无向，关系：相关）
