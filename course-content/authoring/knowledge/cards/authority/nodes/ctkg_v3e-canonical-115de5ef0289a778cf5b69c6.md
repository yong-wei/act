---
node_id: ctkg_v3e-canonical-115de5ef0289a778cf5b69c6
authority_entity_id: "ctkg:v3e-canonical-115de5ef0289a778cf5b69c6"
name: "终值定理"
name_en: "Final Value Theorem"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c3343e1111f2ace6dadfacfb099db7b5d93d9668e583a9002f49e7467aa23ad3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c3343e1111f2ace6dadfacfb099db7b5d93d9668e583a9002f49e7467aa23ad3.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-115de5ef0289a778cf5b69c6.md"
asset_refs: []
---

## 首页

# 终值定理 | Final Value Theorem

**一句话定义**：当 $sF(s)$ 的约简后极点满足条件时，用 $\lim_{s\to0}sF(s)$ 求 $f(t)$ 的终值。

**核心直觉**：先证明信号会收敛，再把“很久以后”换成“低频极限”。

**关键公式**：
$$
\lim_{t\to\infty}f(t)=\lim_{s\to0}sF(s)
$$

**学习目标**：约简 $sF(s)$、检查极点，并识别形式极限与真实终值的差别。

**关联**：部分分式展开 · 终值定理仅适用于稳定系统 · 离散系统的终值定理

---

## 详情

### 完整解释

设因果信号的拉普拉斯变换为 $F(s)$。终值定理说，在相应收敛条件下，时间响应最后趋向的数值可由复频域原点附近的行为得到：
$$
f_\infty=\lim_{t\to\infty}f(t)=\lim_{s\to0}sF(s).
$$
这里最容易被省略的是“在相应条件下”。对有理函数，先把 $sF(s)$ 因式分解并约去公因子，再检查约简式的全部有限极点是否严格位于左半平面。若仍有右半平面极点或虚轴极点，信号可能发散或持续振荡，代入 $s=0$ 得到的形式数字没有终值意义。

在控制系统中，闭环稳定是重要前提，但还要对具体信号检查 $sF(s)$。例如从传递函数得到单位阶跃响应时，$Y(s)=\Phi(s)/s$；求稳态误差时则应先写出对应的 $E(s)$。参考、对象扰动和测量噪声的注入位置不同，不能拿一个通道的 $F(s)$ 代替另一个通道。传递函数推导通常采用零初始条件；若存在非零初始状态，应把自由响应的变换一并纳入总的 $F(s)$。

“约简后”很关键。若
$$
F(s)=\frac{s+1}{s(s+1)(s+2)}=\frac{1}{s(s+2)},
$$
则 $sF(s)$ 约简为 $1/(s+2)$，剩下的极点只有 $-2$，终值是 $1/2$。约分应在代入零点前完成；单看原始分母中的符号或单看 $F(0)$ 都不能替代极点条件。

### 教学计算/推理例

取
$$
F(s)=\frac{1}{s(s+2)},\qquad sF(s)=\frac{1}{s+2}.
$$
约简后的唯一极点为 $-2$，所以条件成立，
$$
f_\infty=\lim_{s\to0}\frac{1}{s+2}=\frac12.
$$
反变换为 $f(t)=\tfrac12(1-e^{-2t})$，时域响应确实从零收敛到 $1/2$。

作反例，取 $F(s)=1/(s^2+1)$。形式上 $\lim_{s\to0}sF(s)=0$，但 $sF(s)=s/(s^2+1)$ 在 $s=\pm j$ 仍有虚轴极点；实际信号是 $\sin t$，振荡永不衰减，因此终值不存在。这个反例说明“能把 $s$ 设成零”只是代数操作，不是收敛性证明。

### 适用条件与边界

本卡使用连续时间、因果、有理信号的常见版本。重复虚轴极点、右半平面极点、未建模冲击或离散系统应分别检查对应定理。终值定理求得的是所选信号的终值；它不自动证明内部状态稳定，也不等于系统的直流增益。对单位阶跃响应，只有在终值条件满足时才可把 $\lim sY(s)$ 写成 $\Phi(0)$。

### 常见误区

1. **误区**：只把 $s=0$ 代入 $sF(s)$，得到数字就宣布终值。**纠正**：先约简，再检查 $sF(s)$ 的全部有限极点；正弦信号给出形式零值但没有终值。
2. **误区**：看到闭环稳定就可以对任意扰动直接套同一个终值表达式。**纠正**：先按注入位置建立该扰动的 $F(s)$ 或 $E(s)$，再检查相应极点条件。

### 自检

1. $F(s)=1/[s(s+2)]$ 的终值是多少？约简后的 $sF(s)$ 极点在哪里？
2. 为什么 $F(s)=1/(s^2+1)$ 不能由 $\lim_{s\to0}sF(s)=0$ 推出终值为零？

**核对要点**：第一问为 $1/2$，约简后极点为 $-2$；第二问中 $sF(s)$ 有 $\pm j$ 虚轴极点，时域是持续振荡的 $\sin t$，终值不存在。

### 关联节点

- **部分分式展开**（由此得到）：可将可接受的 $F(s)$ 展开并反变换核对终值。
- **终值定理仅适用于稳定系统**（适用条件）：直接约束终值定理的极点前提。
- **离散系统的终值定理**（无序关联）：离散时间需要使用 $z$ 域版本。
- **求离散传递函数的直流增益时，对单位阶跃输入应用终值定理：x_ss = lim_{z→1} (1-z^{-1}) X(z)。**（无序关联）：是离散版本的具体应用。
