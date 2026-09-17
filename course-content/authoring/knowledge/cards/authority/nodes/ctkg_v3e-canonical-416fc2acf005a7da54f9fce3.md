---
node_id: ctkg_v3e-canonical-416fc2acf005a7da54f9fce3
authority_entity_id: "ctkg:v3e-canonical-416fc2acf005a7da54f9fce3"
name: "位置误差常数 (K_p)"
name_en: "Position Error Constant"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-96e87fa5acebbc3d3475a668c25db542a475ab27630dff585876632beefcd8da.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-96e87fa5acebbc3d3475a668c25db542a475ab27630dff585876632beefcd8da.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-416fc2acf005a7da54f9fce3.md"
asset_refs: []
---

## 首页

# 位置误差常数 ($K_p$) | Position Error Constant

**一句话定义**：$K_p$ 是环路开环传递函数的低频极限，用来计算单位阶跃的静态误差。

**核心直觉**：它衡量环路在“位置不再变化”时还能提供多少校正作用。

**关键公式**：
$$
K_p=\lim_{s\to0}L(s),\qquad e_{m,ss}=\frac{1}{1+K_p}
$$

**学习目标**：在单位反馈和非单位测量下分别确定误差对象，并区分 $K_p$ 与控制器比例增益。

**关联**：零型系统 · $K_{p}=\lim_{s\to0}G_c(s)G(s)$

---

## 详情

### 完整解释

位置误差常数不是控制器的比例参数。它是环路开环传递函数 $L(s)$ 在低频处的极限：单位负反馈时常写成 $L=C G$；一般测量反馈时，比较器误差对应的环路为 $L=C G H$。符号 $K_p$ 容易和比例控制器增益混淆，所以计算时应先写完整环路，再取极限。

对零初始、线性定常的参考通道，
$$
Y=CG E_m,\qquad E_m=R-HY,
$$
得到
$$
\frac{E_m}{R}=\frac{1}{1+CGH}=\frac{1}{1+L}.
$$
若闭环稳定，并且相应 $sE_m(s)$ 满足终值定理的极点条件，单位阶跃 $R=1/s$ 给出
$$
e_{m,ss}=\lim_{s\to0}\frac{1}{1+L(s)}=\frac{1}{1+K_p}.
$$
当环路含一个或多个积分器时，$K_p$ 可能趋于无穷大；这只表示在理想模型和稳定前提下单位阶跃的比较器误差趋向零，不能跳过闭环极点检查。

物理跟踪误差是 $E_t=R-Y$。由
$$
\frac{Y}{R}=\frac{CG}{1+CGH}
$$
可见，$H=1$ 时 $E_t=E_m$；$H\ne1$ 时，$K_p$ 给出的 $1/(1+K_p)$ 只对应测量误差，物理跟踪误差必须另算。若参考和输出单位相同，位置误差常数通常是无量纲的；若通道含比例或单位换算，量纲必须随完整模型核对。

### 教学计算/推理例

先取单位负反馈、零初态的 $C(s)=3$、$G(s)=2/(s+1)$。环路为 $L(s)=6/(s+1)$，闭环极点为 $-7$，因此 $K_p=L(0)=6$。对单位阶跃，
$$
\frac{Y}{R}=\frac{6}{s+7},\qquad e_{m,ss}=e_{t,ss}=\frac{1}{1+6}=\frac17\approx0.1429.
$$
这一步使用了 $H=1$，所以测量误差和实际跟踪误差相同。

保持 $C$、$G$ 不变而令 $H(s)=2$，则 $L=12/(s+1)$、闭环极点为 $-13$，$K_p=12$。此时
$$
\frac{Y}{R}=\frac{6}{s+13},\qquad e_{m,ss}=\frac1{13},\qquad e_{t,ss}=1-\frac6{13}=\frac7{13}.
$$
两个误差都来自同一个闭环，但数值不同；把单位反馈公式直接套到物理输出会得到错误结论。

### 适用条件与边界

位置误差常数法默认负反馈、线性定常、零初始和闭环稳定。对非单位输入幅值 $A$，单位阶跃结果按 $A$ 倍缩放。$K_p$ 只约束低频静差，不给出超调、调节时间或稳定裕度；模型含饱和和死区时，还要检查线性结论是否仍适用。

### 常见误区

1. **误区**：$K_p$ 就是比例控制器的增益。**纠正**：$K_p=\lim_{s\to0}L(s)$，它由整个开环环路的低频行为决定，比例控制器增益只是其中一项。
2. **误区**：$K_p=\infty$ 自动说明闭环稳定且所有误差为零。**纠正**：仍须检查闭环极点和具体误差通道；非单位 $H$ 时物理跟踪误差也不由该数字直接决定。

### 自检

1. 单位负反馈中 $C(s)=3$、$G(s)=2/(s+1)$ 的 $K_p$ 和单位阶跃误差是多少？
2. 为什么同样的 $C$、$G$ 换成 $H=2$ 后，$1/(1+K_p)$ 不能当作 $R-Y$？

**核对要点**：$K_p=6$，误差为 $1/7$；$1/(1+K_p)$是 $r-Hy$ 的终值，$H=2$ 时物理误差应从 $Y/R=6/(s+13)$ 另行计算为 $7/13$。

### 关联节点

- **零型系统**（无序关联）：没有环路积分器时，位置误差常数通常是有限值。
- **$K_{p}=\lim _{s \rightarrow 0} G_{c}(s) G(s)$**（公式关联）：图谱记录的单位反馈低频定义；本卡用 $L(s)$ 表示完整环路。
