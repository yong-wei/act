---
node_id: ctkg_m1q_phase-g_source_c14dc59187664d8a36099266
authority_entity_id: "ctkg:m1q:phase-g:source:c14dc59187664d8a36099266"
name: "末值项"
name_en: "Terminal Cost"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-54ea3aa7ea67333ed9e95147c53c923a9b8db91eb44c80af34ebc83899adbf3a.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-54ea3aa7ea67333ed9e95147c53c923a9b8db91eb44c80af34ebc83899adbf3a.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-06a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 末值项 | Terminal Cost

一句话定义：末值项在控制区间终点评价状态表现，常与过程代价共同构成有限时域性能指标。

- 末值惩罚与固定末端约束不同。
- 有限权重通常允许末端保留误差。
- 末值条件会影响整段最优控制。

---
## 详情
### 完整解释

性能指标中的 $\phi(x(T))$ 只对终点状态计价，例如末端偏差平方。它与整个区间内的过程积分相加，表达既要控制沿途成本、又要关注终点结果的要求。末值项的形式和权重应在求解前确定，不能在得到轨迹后再改变指标，却仍沿用原来的最优性结论。

末端状态固定时，所有可行轨迹在终点取相同值；末端状态自由时，末值项可以影响最终落点。软惩罚只让偏差付出代价，并不直接禁止偏差；硬约束则将不满足端点条件的轨迹排除出可行集合。二者不能仅凭“权重很大”就被认作严格相同。

### 教学计算/推理例

考虑 $\dot x=u$、$x(0)=0$、时间区间[0,1]，终点状态自由，控制允许为平方可积函数。目标是

$$
J[u]=\int_0^1u(t)^2\,dt+F(x(1)-1)^2,\qquad F\geq0.
$$

令最终状态为a。因为输入积分等于a，由柯西不等式可知，到达该终点的最小输入代价为 $a^2$，由常值输入u=a达到。因此整个问题可化成对终点的一元优化：

$$
\min_a\bigl[a^2+F(a-1)^2\bigr].
$$

求导得 $2a+2F(a-1)=0$，所以 $a^*=F/(1+F)$。二阶导数为 $2(1+F)>0$，此标量目标严格凸，得到唯一最优终点；常值控制 $u^*=a^*$ 实现它。最小总成本为 $F/(1+F)$。

F=0时，不处罚终点偏差，最优选择是不使用输入，终点为0。F=1时，最优输入为1/2，终点也为1/2；输入成本与末值成本各为1/4，总成本1/2。F=9时，终点为9/10，输入成本81/100、末值成本9/100，总成本9/10。

### 权重极限与端点条件

随着F增大，终点逐渐接近1，但任意有限F仍有误差 $1/(1+F)$。若任务要求精确到达1，应直接规定 $x(1)=1$。这个硬约束问题的最优输入为1，成本为1；它是本例软惩罚极限的结果，却不是任意有限权重下的相同问题。

若改为固定末端x(1)=b，则末值项 $F(b-1)^2$ 在全部可行控制之间相同，不影响它们的排序。它会改变报告的总代价，但不会在这个固定端点问题内改变最优控制。末值项是否影响决策，取决于末端是否允许变化，而不是只取决于F是否为零。

### 适用条件与边界

在正常型、光滑、固定终止时间且末端自由的极小值原理中，采用 $H=L+\lambda f$ 的约定时，协态末值由末值成本的梯度给出。若末端固定或受约束，必须使用相应的端点条件，不能不加判断地令协态末值为零。

本例只有输入平方和末端误差，且模型精确、无输入上限，因此可解析化为一元凸问题。增加状态过程代价、饱和约束或非线性动态后，一般不能只凭终点a直接确定全过程最小代价，应重新求解相应问题。

### 常见误区

1. 认为有限末值权重强制终点误差严格为零。
2. 混淆自由末端与固定末端条件。
3. 只报告末值成本而忽略过程输入成本。

### 自检

1. F=1时为什么不选择直接到达目标1？
2. 固定末端后，末值项为何不改变可行控制的排序？

**核对要点**：到达1的输入成本为1，而折中方案总成本仅1/2；固定末端让末值项成为各可行控制共有的常数。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
