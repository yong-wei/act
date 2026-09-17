---
node_id: ctkg_v3e-canonical-303314b2f1d601cdba5e3f99
authority_entity_id: "ctkg:v3e-canonical-303314b2f1d601cdba5e3f99"
name: "阶跃输入"
name_en: "Step Input"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d337e02a2c6659a1eb26b1d75db0776382bf30026288fce5394a4dc92bdda274.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d337e02a2c6659a1eb26b1d75db0776382bf30026288fce5394a4dc92bdda274.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-10a/previous/ctkg_v3e-canonical-303314b2f1d601cdba5e3f99.md"
asset_refs: []
---

## 首页

# 阶跃输入 | Step Input

**一句话定义**：阶跃输入在某个时刻由一个恒定值跳到另一个恒定值，之后保持不变。

**核心直觉**：输入的跳变与系统输出的跳变是两件事，输出是否立即变化取决于系统通道和初态。

**关键公式**：本例 $r(t)=3H(t-1)$，$R(s)=3e^{-s}/s$。

**学习目标**：读出阶跃的幅值和延迟，并正确应用时移关系求系统响应。

---

## 详情

### 完整解释

阶跃用来描述命令、负载或其他输入突然改变后保持新值的理想化情形。单位阶跃的幅度为 1，一般阶跃则有明确幅度和发生时刻。写成 $AH(t-t_0)$ 时，$A$ 给出跳变量，$t_0$ 给出延迟；不能只看函数外的系数而忽略时间平移。

理想阶跃具有无限快的跳变，实际设备通常有有限上升时间。因此它是分析与比较系统动态的标准输入，并不等于执行器能够实现无限变化率。阶跃恰在跳变点的单个函数值取何约定，不改变通常的拉普拉斯变换；讨论接通瞬间时，用左右极限更清楚。

### 教学计算/推理例

采用归一化时间，输入在 $t<1$ 时为零，从 $t=1$ 起跳到 3 并保持，即
$$
r(t)=3H(t-1),\qquad R(s)=\frac{3e^{-s}}s.
$$
取零初态对象 $G=2/(s+1)$。输入接通前，对象保持零状态。接通后，原方程变为 $\dot y+y=6$，因此
$$
y(t)=\begin{cases}
0,&t<1,\\
6(1-e^{-(t-1)}),&t\ge1.
\end{cases}
$$
也可先求无延迟幅度 3 阶跃的响应，再整体向后平移一单位时间。平移的是整个因果响应，不能只把指数中的 $t$ 改成 $t-1$ 却让结果在 $t<1$ 提前生效。

在输入右极限 $r(1^+)=3$ 时，本例输出仍为 $y(1^+)=0$，随后逐渐趋于 6。输出没有立即跳到 6，因为对象是严格真有理的一阶动态环节；6 是最终输出，不是初始输出。

### 适用条件与边界

这里变量已归一化，没有直接传递项、其他输入或非零初态。若系统含直接传递项，有限阶跃也可以使输出出现直接跳变；若输入是理想冲激，则状态本身也可能跳变，不能套用本例的连续性结论。阶跃用于观察瞬态和稳态，但不能单独证明所有频段、所有幅值或所有扰动条件下的表现。

### 常见误区

1. **误区**：延迟只影响输入表达式，不影响输出开始时间。**纠正**：因果响应整体延迟，本例 $t<1$ 输出为零。
2. **误区**：阶跃幅度 3 就等于输出终值 3。**纠正**：还取决于系统静态增益，本例终值为 6。

### 自检

1. 本例拉普拉斯式中的 $e^{-s}$ 表示什么？
2. 为什么 $y(1^+)$ 不等于最终值 6？

**核对要点**：表示一单位时间延迟；严格真有理对象需要通过动态过程改变状态和输出。

### 关联节点

- **阶跃输入最易于生成和评估**（无向，关系：相关）
- **采用 Kp 时阶跃输入的稳态跟踪误差**（入边，关系：适用于）
