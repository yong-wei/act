---
node_id: ctkg_v3e-object-232e387ed53e92abee078346
authority_entity_id: "ctkg:v3e-object-232e387ed53e92abee078346"
name: "截止频率"
name_en: "Open-Loop Crossover Frequency"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-868f4f01c9e9c2ec249c16f9c585ea93a4f7461f9be33f73f411e64ec70b1a0d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-868f4f01c9e9c2ec249c16f9c585ea93a4f7461f9be33f73f411e64ec70b1a0d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01f/previous/ctkg_v3e-object-232e387ed53e92abee078346.md"
asset_refs: []
---

## 首页

# 截止频率 | Open-Loop Crossover Frequency

**一句话定义**：本课程该节点的截止频率指开环幅值等于1的频率，也称增益穿越频率。

**核心直觉**：先确认看的是开环还是闭环，才能解释图上“截止”对应的水平线。

**关键公式**：
$$|L(j\omega_c)|=1\quad(0\,\mathrm{dB}).$$

**学习目标**：按课程定义求开环截止频率，并区分闭环带宽和滤波器的−3 dB截止用法。

---

## 详情

### 完整解释

“截止频率”在不同领域有不同约定。本节点遵循开环频域设计的用法，指环路传递函数 $L$ 的0 dB穿越。滤波器文献常把幅值降为通带参考值的 $1/\sqrt2$ 处称为截止频率；闭环控制中常用同样的相对幅值条件定义带宽。这些概念可相关，却不能因为中文名称相同就把阈值从0 dB换成−3 dB。

闭环 $T=L/(1+L)$ 的幅值同时受开环幅值和相位影响；因此同一个 $|L|=1$ 交点，并不能单独给出 $|T|$ 的具体大小。频率设计常在稳定裕度相近的模型之间用开环截止频率估计响应快慢，但这属于有条件的工程比较，不是普遍恒等式。系统可能没有有限0 dB交点，也可能有多个，应记录实际交越结构。

### 教学计算/推理例

用归一化执行器环路 $L(s)=4/(s+1)$，单位负反馈。开环幅值为 $4/\sqrt{1+\omega^2}$，故
$$\omega_c=\sqrt{15}\approx3.873\,\mathrm{rad/s}.$$
闭环为 $T(s)=4/(s+5)$，直流增益为 $T(0)=0.8$。若按相对于直流值下降3.0103 dB的标准定义带宽，应求
$$|T(j\omega_b)|=\frac{0.8}{\sqrt2},$$
解得 $\omega_b=5\,\mathrm{rad/s}$。在开环截止频率 $\sqrt{15}$ 处，闭环幅值为 $4/\sqrt{40}\approx0.6325$，并非带宽阈值 $0.8/\sqrt2\approx0.5657$。两者的数值差异直接说明开环0 dB截止和闭环−3 dB带宽不是同一个量。

此例的闭环时间常数为0.2，响应单调且稳定。若换成有谐振峰的高阶系统，带宽与时域指标的关系还会受到阻尼影响，不能只用一个开环截止数值概括所有动态性能。

### 常见误区与边界

1. **误区**：闭环带宽一律找绝对−3 dB水平线。**纠正**：通常相对于低频增益定义，本例低频增益不等于1，阈值必须随之调整。
2. **误区**：rad/s和Hz可使用相同数值。**纠正**：$f=\omega/(2\pi)$，本例开环截止约为0.616 Hz。

### 自检

1. 本节点求截止频率时使用 $L$ 还是 $T$？阈值是多少？
2. 上例闭环带宽为何不是 $\sqrt{15}$？

**核对要点**：使用开环 $L$，幅值阈值1；闭环需按 $T(0)/\sqrt2$ 解独立方程，结果为5 rad/s。

### 关联节点

- **带宽频率**（关联）：本卡计算展示其与开环截止频率的区别。
- **对数幅频渐近特性曲线**（分析方法）：可先估算交点，转折附近再用精确频响验证。
- **利用开环频域指标估算时域性能方法**（分析方法）：需要结合裕度和模型结构，不能把频率相关性当成无条件等式。
