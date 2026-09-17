---
node_id: ctkg_v3e-object-1a1dd2df4f2e6bfba96c435c
authority_entity_id: "ctkg:v3e-object-1a1dd2df4f2e6bfba96c435c"
name: "穿越频率（相位）"
name_en: "Phase Crossover Frequency"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-bb78be89bcde5a37896c9db87df58f7c963d6ebd493a9f03301db7e3b2b173ab.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-bb78be89bcde5a37896c9db87df58f7c963d6ebd493a9f03301db7e3b2b173ab.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01f/previous/ctkg_v3e-object-1a1dd2df4f2e6bfba96c435c.md"
asset_refs: []
---

## 首页

# 相位穿越频率 | Phase Crossover Frequency

**一句话定义**：相位穿越频率是开环频率响应落到负实轴时对应的正频率。

**核心直觉**：在这个频率，环路总相位使原本的负反馈接近同相强化，幅值决定离临界点还有多远。

**关键公式**：
$$\arg L(j\omega_{pc})=-180^\circ\pmod{360^\circ}.$$

**学习目标**：从完整开环响应定位相位穿越，并在该处读取幅值裕度。

---

## 详情

### 完整解释

本卡采用负反馈闭环的环路传递函数 $L$，其特征条件是 $1+L=0$。危险点是复平面的 $-1$：不仅要求相位为负180度，还要求幅值恰为1。相位穿越频率只满足其中的相位条件，因此不能仅凭找到这个频率就宣称系统已经不稳定。

“落到负实轴”要求虚部为零、实部小于零，而且该点传递函数有定义。计算时应使用连续展开的相位或直接检查复数实虚部，避免把软件相位跳变误判成真实交越。相位穿越可能没有有限解，也可能存在多个解；有延迟、复杂零极点或开环不稳定极点时，要检查全部相关交点和奈奎斯特环绕，而不是只读一处图上的数值。

### 教学计算/推理例

取归一化控制环
$$L(s)=\frac{3}{s(s+1)(s+2)}.$$
代入 $s=j\omega$，分母为
$$-3\omega^2+j\omega(2-\omega^2).$$
对正频率，虚部为零给出 $\omega=\sqrt2$。此时分母为 $-6$，故 $L(j\sqrt2)=-1/2$，既满足负实轴条件，也说明尚未到达 $-1$。幅值裕度为2，即约6.02 dB。

若把分子3改成6，相位穿越频率不变，但此时 $L(j\sqrt2)=-1$。对应闭环特征多项式 $s^3+3s^2+2s+6=(s+3)(s^2+2)$，出现 $\pm j\sqrt2$ 振荡根。分子3时的多项式则严格稳定。这一对照把频域负实轴交点与时域极点边界联系起来，而不是把相位条件单独当成稳定判据。

作为边界例，$1/(s+1)^2$ 的相位为 $-2\arctan\omega$，有限正频率下不会达到负180度，只在频率趋于无穷时逼近。应记录“无有限相位穿越”，不能凭曲线接近就读出任意一个有限频率。

### 常见误区与边界

1. **误区**：相位穿越频率就是0 dB穿越频率。**纠正**：前者按相位条件定义，后者按幅值等于1定义。
2. **误区**：正实轴交点也可算相位穿越。**纠正**：必须确认实部为负；相位0度与180度的反馈意义不同。

### 自检

1. 上例分子由3变为6，哪个量不变，哪个裕度降为1？
2. 分母在某频率虚部为零是否已经足够？

**核对要点**：相位穿越频率不变，幅值裕度降为1；还要确认响应有定义、实部为负且频率为正。

### 关联节点

- **幅值裕度**（关联）：在相位穿越处读取幅值倒数，并结合完整稳定性分析解释。
- **阻尼自然频率**（关联）：临界振荡频率可与极点对应，但一般相位穿越并不等于稳定闭环的阻尼振荡频率。
