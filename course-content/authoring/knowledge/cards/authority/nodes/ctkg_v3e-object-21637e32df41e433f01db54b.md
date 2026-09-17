---
node_id: ctkg_v3e-object-21637e32df41e433f01db54b
authority_entity_id: "ctkg:v3e-object-21637e32df41e433f01db54b"
name: "等倾线法"
name_en: "Isocline Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1783fd4c4e56f7dcecfe6e74956fa4fabd7ff7aa5b6591c1ef948fd9292996c3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1783fd4c4e56f7dcecfe6e74956fa4fabd7ff7aa5b6591c1ef948fd9292996c3.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-29a/previous/ctkg_v3e-object-21637e32df41e433f01db54b.md"
asset_refs: []
---

## 首页
# 等倾线法 | Isocline Method

一句话定义：等倾线法先寻找相轨迹切线斜率相同的状态点集合，再利用方向场近似绘制相轨迹。

- 斜率表达式只在分母非零处使用。
- 切线斜率不能单独确定时间方向。
- 平衡点与竖直切线点必须区分。

---
## 详情
### 完整解释

对 $\dot x=v$、$\dot v=f(x,v)$，当 $v\ne0$ 时可消去时间，得到

$$
\frac{dv}{dx}=\frac{f(x,v)}{v}.
$$

令这一比值为固定常数 $m$，得到等倾线方程 $f(x,v)=mv$。在同一等倾线上，相轨迹切线斜率相同，可以画出短线段作为作图参考，再从初态沿方向场逐步描绘。

等倾线一般不是相轨迹本身。轨迹可以穿过不同等倾线，斜率随状态变化；沿等倾线移动不意味着满足原动力方程。绘制箭头还需检查 $\dot x$、$\dot v$ 的符号，不能把无方向的斜率线段直接当成时间演化。

### 教学计算/推理例

取 $f(x,v)=-x-v$。对 $v\ne0$，斜率为 $(-x-v)/v$，等倾线为

$$
x=-(m+1)v.
$$

当 $m=0$ 时，$x=-v$，切线水平；当 $m=-1$ 时，$x=0$，切线斜率负1；当 $m=1$ 时，$x=-2v$，切线斜率正1。比如状态 $(-2,1)$ 的向量为 $(1,1)$，沿右上方；状态 $(2,-1)$ 的向量为 $(-1,-1)$，沿左下方。两处斜率都为1，时间方向却相反。

在 $v=0,x\ne0$ 处，$\dot x=0$ 而 $\dot v=-x\ne0$，方向为竖直，不能通过除以0计算有限斜率。只有原点同时满足两个导数为0，是平衡点。把所有分母为0的点都叫奇点，会把普通竖直方向误判成平衡。

### 适用条件与边界

等倾线法可在不求显式时间解的情况下描绘轨迹走向，但手工短线拼接有近似误差。等倾线过疏、曲率变化很快或靠近特殊点时，需要更细致分析。轨迹到达时间并未由这些线段直接给出。

分段系统应在每个有效区域使用对应方程，并在边界按规定连接。若向量场不光滑或解不唯一，需先明确运动规则。对显含时间的系统，相同状态可能具有不同斜率，简单固定二维等倾线图不再完整表达全部动力学。

等倾线交于平衡点时，斜率公式可能呈 $0/0$，应回到原状态方程或线性化等方法分析，不能任意赋予一个斜率。原点附近的稳定类型也不是某一条等倾线名称所能决定的。

### 常见误区

1. 把等倾线当成系统轨迹，沿它直接预测状态变化。
2. 看到相同斜率就画成相同箭头方向。
3. 将 $v=0$ 的整条轴都视为平衡点。

### 自检

1. 本例 $(-2,1)$ 与 $(2,-1)$ 的斜率相同，为什么方向不同？
2. 点 $(1,0)$ 是平衡点还是竖直方向点？

**核对要点**：两处向量互为相反数；$(1,0)$ 有 $\dot v=-1$，不是平衡点，方向向下。

### 关联节点

- **等倾线**（入边，关系：组成部分属于）
- **等倾线**（出边，关系：包含组件）
