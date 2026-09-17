---
node_id: ctkg_v3e-canonical-312d1dfa7e96b9cc6f46e253
authority_entity_id: "ctkg:v3e-canonical-312d1dfa7e96b9cc6f46e253"
name: "单位阶跃响应"
name_en: "Unit-Step Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-54574d1fca4e8c34cdc1cde7b9b37f02d72c3c1986ee01d522bc12562524536c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-54574d1fca4e8c34cdc1cde7b9b37f02d72c3c1986ee01d522bc12562524536c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-312d1dfa7e96b9cc6f46e253.md"
asset_refs: []
---

## 首页

# 单位阶跃响应 | Unit-Step Response

**一句话定义**：以单位阶跃函数为输入时，系统输出随时间变化的完整响应。

**核心直觉**：目标在起点突然改变，曲线同时暴露系统的速度、振荡和最终跟踪值。

**关键公式**：
$$
R(s)=\frac1s,\qquad Y(s)=\frac{\Phi(s)}s
$$

**学习目标**：由闭环传递函数求出单位阶跃响应，并读出初值、终值与延迟后的变化。

**关联**：单位阶跃函数 · 一阶系统的单位阶跃响应 · 高阶系统解析阶跃响应 · 单位阶跃响应曲线

---

## 详情

### 完整解释

单位阶跃响应是一个统一的时域试验：输入在 $t=0$ 从零跳到一，系统从零初态开始运行。这里的“单位”指输入幅值为 $1$，并不规定输出终值必须为 $1$。对线性定常系统，若从参考输入到输出的传递函数是闭环 $\Phi(s)$，则
$$
R(s)=\frac1s,\qquad Y(s)=\Phi(s)R(s)=\frac{\Phi(s)}s.
$$
如果模型是开环对象，也要明确这只是对象的阶跃响应；闭环跟踪问题应使用参考到输出的闭环通道。

由 $Y(s)$ 反变换后，可以分别观察 $y(0^+)$、峰值、稳态值和达到容许带的时间。对稳定且零初始的系统，终值若存在则为 $\lim_{s\to0}sY(s)=\lim_{s\to0}\Phi(s)$；这个等式依赖终值定理条件，不能把 $\Phi(0)$ 当成稳定性证明。非零初态会额外产生自由响应，不能藏在“单位阶跃响应”四个字里。

纯延迟只移动时间轴。若
$$
\Phi_\tau(s)=e^{-\tau s}\frac{2}{s+2},\qquad \tau>0,
$$
则
$$
y_\tau(t)=u(t-\tau)\left[1-e^{-2(t-\tau)}\right].
$$
延迟为正时，$0<t<\tau$ 输出保持零；稳定系统的最终值仍由低频增益决定，但到达过程整体向右平移。

### 教学计算/推理例

取零初始、无延迟的
$$
\Phi(s)=\frac{2}{s+2}.
$$
单位阶跃输入给出
$$
Y(s)=\frac{2}{s(s+2)}=\frac1s-\frac1{s+2},
$$
因此
$$
y(t)=1-e^{-2t},\qquad y(0^+)=0,\qquad y(\infty)=1.
$$
在 $t=0.5\,\mathrm{s}$ 时，$y=1-e^{-1}\approx0.6321$。若加入 $\tau=0.2\,\mathrm{s}$ 的延迟，同一时刻的输出是 $1-e^{-0.6}\approx0.4512$；延迟改变了瞬态时刻，却没有改变这个稳定通道的最终值。

### 适用条件与边界

本卡默认连续时间、线性定常、零初始、输入幅值恰为 $1$。对幅值为 $A$ 的阶跃，$Y=A\Phi/s$；非线性、饱和、时变系统不能直接用同一条叠加结论。延迟 $\tau$ 必须带时间单位，且 $e^{-\tau s}$ 的乘法对应时间移位。

### 常见误区

1. **误区**：单位阶跃响应的终值必然是 $1$。**纠正**：终值由从输入到输出的通道低频增益决定；只有该增益为一且终值条件满足时才等于一。
2. **误区**：把延迟写成 $e^{-\tau}/s$ 或把延迟后的响应写成原曲线不变。**纠正**：延迟环节是 $e^{-\tau s}$，它把响应变为 $y(t-\tau)u(t-\tau)$。

### 自检

1. $\Phi(s)=2/(s+2)$ 的单位阶跃响应在 $t=0.5\,\mathrm{s}$ 时是多少？
2. 延迟 $\tau=0.2\,\mathrm{s}$ 后，为什么 $t=0.1\,\mathrm{s}$ 的输出仍为零？

**核对要点**：$y(0.5)=1-e^{-1}\approx0.6321$；延迟后的因果响应含 $u(t-\tau)$，在延迟到达前输入尚未传到输出。

### 关联节点

- **单位阶跃函数**（由此得到）：它是单位阶跃响应的标准输入。
- **一阶系统的单位阶跃响应**（属于）：本卡的一阶解析例属于该关联。
- **高阶系统解析阶跃响应**（相关）：高阶系统可用同一输入定义展开模态响应。
- **单位阶跃响应曲线**（相关）：输出随时间的曲线表达。
