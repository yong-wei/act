---
node_id: ctkg_v3e-canonical-01549ef9b34888b89b55f224
authority_entity_id: "ctkg:v3e-canonical-01549ef9b34888b89b55f224"
name: "终值定理法求稳态误差"
name_en: "Steady-State Error by Final-Value Theorem"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f3a93a1438a5173a96c87d6011eceb8b339fd1db2f9cb1e01b829d6cb9009d01.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f3a93a1438a5173a96c87d6011eceb8b339fd1db2f9cb1e01b829d6cb9009d01.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01b/previous/ctkg_v3e-canonical-01549ef9b34888b89b55f224.md"
asset_refs: []
---

## 首页

# 终值定理法求稳态误差 | Steady-State Error by Final-Value Theorem

**一句话定义**：在终值定理适用时，用 $sE(s)$ 在 $s\to0$ 的极限求误差信号终值。

**核心直觉**：先确认误差信号会收敛，再取极限；极限计算本身不是稳定性证明。

**关键公式**：
$$
e_{\mathrm{ss}}=\lim_{t\to\infty}e(t)=\lim_{s\to0}sE(s)
$$

**学习目标**：写出正确误差通道，核对终值定理的极点条件，并计算阶跃或扰动下的稳态误差。

---

## 详情

### 完整解释

稳态误差是误差信号 $e(t)$ 在时间足够长后的剩余量。终值定理把时域终值转换为复频域极限，但它有先决条件：$sE(s)$ 的全部有限极点必须位于复平面左半部，不能有右半平面极点或虚轴上的持续振荡极点。若条件不满足，直接令 $s\to0$ 可能得到一个形式上的数，却没有对应的时域终值。

对单位负反馈，参考通道的误差由
$$
E(s)=R(s)-Y(s)=\frac{R(s)}{1+G(s)}
$$
得到；对象入口扰动或测量噪声要先按各自注入位置重写 $E(s)$。随后按“列出输入 → 写误差通道 → 检查 $sE(s)$ 的极点 → 取 $s\to0$ 极限”的顺序计算。这个顺序能避免把输出通道、误差通道和不同扰动的分子混在一起。

### 教学计算/推理例

取单位负反馈对象 $G(s)=5/(s+1)$，输入为单位阶跃 $R(s)=1/s$。由信号方程
$$
E(s)=\frac{1/s}{1+5/(s+1)}=\frac{s+1}{s(s+6)},\qquad sE(s)=\frac{s+1}{s+6}.
$$
$sE(s)$ 的唯一极点为 $-6$，满足条件，因此
$$
e_{\mathrm{ss}}=\lim_{s\to0}\frac{s+1}{s+6}=\frac16\approx0.1667.
$$
若把同一对象改用单位斜坡 $R(s)=1/s^2$，则 $E(s)=(s+1)/(s^2(s+6))$，乘以 $s$ 后为 $sE(s)=(s+1)/(s(s+6))$ 在原点有极点，终值定理不可用；这时误差不会收敛到有限常数，不能仍报告 $1/6$。

### 适用条件与边界

计算假设线性定常、零初始条件、误差定义明确且闭环响应存在。临界稳定、持续振荡、发散输入或含未声明初始状态时，应先判断是否存在稳态，再选择终值定理、时域解或其他方法。

### 自检

1. 为什么在取极限前必须检查 $sE(s)$ 的极点？
2. $G(s)=5/(s+1)$ 单位负反馈接单位阶跃时，稳态误差是多少？为什么？

**核对要点**：终值定理只有在相应时域信号收敛时才成立，极点检查是其适用条件；误差为 $1/6$，因为 $sE(s)=(s+1)/(s+6)$ 且极点 $-6$ 在左半平面。

### 关联节点

- **稳态误差 $e(\infty)$**（关联）：终值定理直接计算的目标量。
- **静态误差系数法求稳态误差**（关联）：在特定输入族下的另一种求法。
- **当 $N(s)=n_1/s^2$ 时的稳态误差结论**（关联）：说明扰动输入也必须先建立误差通道。
- **当 $N(s)=n_0/s$ 时的稳态误差结论**（关联）：用于比较不同扰动形状的终值。
