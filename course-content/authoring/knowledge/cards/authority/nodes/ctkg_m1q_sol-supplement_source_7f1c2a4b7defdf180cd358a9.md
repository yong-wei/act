---
node_id: ctkg_m1q_sol-supplement_source_7f1c2a4b7defdf180cd358a9
authority_entity_id: "ctkg:m1q:sol-supplement:source:7f1c2a4b7defdf180cd358a9"
name: "权阵 F"
name_en: "Terminal Weight Matrix"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
coneightt_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-22e453c91990d14a75fea3418f50a135d911850ef3c05fd8385702d41ea9f496.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-22e453c91990d14a75fea3418f50a135d911850ef3c05fd8385702d41ea9f496.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-07a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 权阵 F | Terminal Weight Matrix

一句话定义：终端权阵F规定有限时域二次型指标中终点状态的代价，并给出相应Riccati方程的终端条件。

- F作用于终点，Q作用于沿途状态。
- F是软权重，不是固定末态约束。
- 终端权重与整个时域的价值矩阵不同。

---
## 详情
### 完整解释

有限时域二次型指标可以写为 $J=\frac12x(T)^TFx(T)+\frac12\int_0^T(x^TQx+u^TRu)\,dt$。F的维数与状态向量一致，通常取对称半正定，使终点偏离的成本非负。如果目标平衡点不是零，需要先明确偏差坐标，而不是默认原状态必须趋近零。

F只直接评价终点，但最优控制会在整个时域内为这个终点成本作出折中。Q和F即使维数相同，也承担不同角色：前者评价沿途状态，后者评价截止时刻。任意交换它们通常会改变优化问题。

### 教学计算/推理例

考虑 $\dot x=u$、$x(0)=1$，时间区间[0,1]，终点自由，控制无幅值限制。取Q=0、R=1，终端权重为非负标量F，指标为

$$
J=\frac12\int_0^1u^2\,dt+\frac12F x(1)^2.
$$

对固定终点a，输入积分必须等于a-1，最小输入平方积分为 $(a-1)^2$，由常值输入u=a-1达到。因此只需最小化 $[(a-1)^2+Fa^2]/2$，得到 $a^*=1/(1+F)$、$u^*=-F/(1+F)$，最小成本 $F/[2(1+F)]$。

F=0时，不处罚末端状态，最优输入为零，终点仍为1，成本为零。F=1时，输入为-1/2、终点为1/2，输入成本和末端成本各为1/8，总成本1/4。F=9时，输入为-9/10、终点为1/10，总成本9/20。较大F促使末端靠近零，却没有在有限权重下强制末端等于零。

### 与Riccati终端条件的联系

本例的价值函数为 $V(t,x)=P(t)x^2/2$，其中

$$
P(t)=\frac{F}{1+F(1-t)},\qquad 0\leq t\leq1.
$$

它满足 $\dot P=P^2$ 和P(1)=F。终端权重为F，初时刻的P却为F/(1+F)，因为剩余时间允许通过控制改变状态。F=1时，P从1/2增加到1，不能在整个区间简单地令P(t)=F。

反馈律为u=-P(t)x。代入初态1得到 $x(t)=[1+F(1-t)]/(1+F)$，其控制正好是前面求出的常值。这个一致性检查连接了直接终点优化与时变反馈表达，但不意味着一般有限时域问题都能用常值输入实现。

### 适用条件与边界

若明确要求x(1)=0，那是硬端点问题，允许集合与本卡不同。固定端点时F项对所有可行控制相同，不会改变这些控制之间的成本排序。若用很大的F近似硬约束，仍需说明它只是近似，并注意数值条件和实际输入能力。

多维F可以只惩罚部分方向。F半正定并不意味着整个状态在终点都受严格惩罚，也不能单靠F判断无限时间稳定性。有限时域策略在T以后如何运行，需要另行给定控制任务，不能从一个截止时刻的成本自动推断其长期行为。

### 常见误区

1. 把F与沿途状态权阵Q混用。
2. 令全部时刻的价值矩阵P都等于F。
3. 把有限终端权重当作精确末端约束。

### 自检

1. F=1时，本例最优终点和最小成本是多少？
2. 为什么P(0)不等于F？

**核对要点**：终点1/2、总成本1/4；初时刻还可以使用一段控制来降低终点代价，价值函数需考虑这段剩余时间。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
