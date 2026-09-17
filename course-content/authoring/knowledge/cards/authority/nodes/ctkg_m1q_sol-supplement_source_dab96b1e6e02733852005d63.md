---
node_id: ctkg_m1q_sol-supplement_source_dab96b1e6e02733852005d63
authority_entity_id: "ctkg:m1q:sol-supplement:source:dab96b1e6e02733852005d63"
name: "权阵 Q(t)"
name_en: "State Weight Matrix"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e6b1d3e9088c40b6052b602ce7d2899e96ae05c12ca6f79f23d1a8bc45468b5c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e6b1d3e9088c40b6052b602ce7d2899e96ae05c12ca6f79f23d1a8bc45468b5c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-07a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 权阵 Q(t) | State Weight Matrix

一句话定义：权阵Q(t)规定二次型性能指标中各状态方向及其组合的代价，用来表达对状态偏离的评价偏好。

- 对称半正定允许某些非零方向不被直接惩罚。
- 状态坐标和单位会影响权重的解释。
- 增大权重会同时改变控制作用与评价尺度。

---
## 详情
### 完整解释

二次型性能指标的状态部分常写为 $\frac12\int x^TQ(t)x\,dt$。对调节问题，x通常表示相对于目标平衡点的状态偏差；若目标不是零，首先应明确误差坐标。直接对原坐标平方计价，可能是在惩罚错误的目标，而不是单纯的数值差异。

标准LQR允许Q对称半正定，使状态代价非负，但这不意味着每个非零状态都产生严格正成本。例如 $Q=\operatorname{diag}(1,0)$ 时，代价只直接包含第一分量的平方，非零第二轴上的瞬时状态代价仍为零。它是否能被其他状态和动态间接反映，需要另外分析。

### 教学计算/推理例

考虑积分器 $\dot x=u$，初态1，输入权重R=1，在无限时域上最小化

$$
J=\frac12\int_0^\infty(qx^2+u^2)\,dt,\qquad q>0.
$$

稳定Riccati解满足 $-P^2+q=0$，故P为 $\sqrt q$；反馈增益 $K=\sqrt q$，控制为u=-Kx。q=1时，状态为 $e^{-t}$，初始输入-1，最小代价1/2。q=4时，状态为 $e^{-2t}$，初始输入-2，最小代价1。

增大状态权重使这个例子更积极地压低状态偏差，也需要更强的初始控制。状态达到初值十分之一的时间从 $\ln10$ 缩短为 $\ln10/2$。这些结论来自本例完整模型和反馈计算，而不是“Q越大系统总会更好”的一般口号。

如果把两种反馈统一放回q=1的评价指标，K=1的代价是1/2，K=2的代价是5/8；后者虽然更快，却不是q=1指标下最优。反之，在q=4指标下，K=1的代价为5/4，K=2为1。比较方案必须说明采用哪个共同指标，不能混用各自最优成本。

### 半正定权重与可检测性

当Q只半正定时，某些状态方向可能不被成本直接观察到。无限时域标准LQR的稳定最优结论通常配合系统可稳定，以及 $(Q^{1/2},A)$ 可检测等条件。可检测性要求没有被状态成本观察到的不稳定模态，不能只看Q矩阵元素非负就省略这些条件。

例如标量系统 $\dot x=x+u$ 若取Q=0、R=1，控制u=0产生零输入成本，却让非零状态发散。这是成本没有惩罚不稳定状态的具体反例。它不否定满足正确条件的LQR结论，而是说明必须核对评价指标是否反映了稳定目标。

### 适用条件与边界

Q可以随时间变化，也可以包含交叉项。矩阵正定性应通过特征值、分解或等价代数条件判断，不能要求每个矩阵元素都为正。改变状态坐标后，要相应变换权重，才能保持同一个物理评价指标。

对有输入饱和、状态硬约束或明显模型误差的问题，增大Q可能使无约束控制提出不可执行的输入。权重设计需要结合执行能力与模型适用范围；它本身不替代约束建模或鲁棒性分析。

### 常见误区

1. 认为Q半正定就严格惩罚全部非零状态。
2. 只追求大Q而忽略输入代价与幅值限制。
3. 跨不同指标比较最小成本，却不说明评价尺度。

### 自检

1. 本例q从1变4为何会缩短衰减时间？
2. Q=0的不稳定标量反例说明缺少什么检查？

**核对要点**：反馈增益由1增至2；必须核对状态成本对不稳定模态的可检测性，不能把零成本等同于稳定。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
