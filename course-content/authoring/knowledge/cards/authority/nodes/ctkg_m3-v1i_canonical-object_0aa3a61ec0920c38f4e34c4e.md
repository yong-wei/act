---
node_id: ctkg_m3-v1i_canonical-object_0aa3a61ec0920c38f4e34c4e
authority_entity_id: "ctkg:m3-v1i:canonical-object:0aa3a61ec0920c38f4e34c4e"
name: "增益裕度"
name_en: "Gain Margin"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d76c863b38f156d039e6399dd903d0878bfac6006d9c5f29e52e1d2ca49ecfc8.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d76c863b38f156d039e6399dd903d0878bfac6006d9c5f29e52e1d2ca49ecfc8.json
  - course-content/authoring/knowledge/cards/nodes/幅值裕度_5_73af26a5.md
asset_refs: []
---

## 首页

# 增益裕度 | Gain Margin

**一句话定义**：在环路相位到达临界方向的频率处，幅值倒数所给出的增益变化尺度。

**核心直觉**：相位已经指向危险方向时，幅值还离临界值有多远。

**关键公式**：
$$
K_g=\frac1{|L(j\omega_\pi)|},\qquad G_m=20\log_{10}K_g\ \mathrm{dB}.
$$

**学习目标**：区分倍数与分贝，计算典型环路的增益稳定边界。

---

## 详情

### 完整解释

#### 找的是相位交越

本卡讨论标准负反馈，$\omega_\pi$ 满足环路相位为 $-180^\circ$ 的相应分支。增益裕度在这个频率看幅值；相角裕度则在幅值等于 $1$ 的频率看相位。两种交越不能混用。

若 $K_g=3$，表示相应临界增益是当前值的三倍，对应约 $9.542$ dB；不是增加 $3$ dB。多个相位交越、开环不稳定或特殊围线时，应结合完整奈奎斯特分析，而不是只挑一个有利读数。

#### 教学算例与代数复核

取 $L(s)=2/[s(s+1)(s+2)]$。在 $\omega_\pi=\sqrt2$ rad/s，复数分母为 $-6$，因此 $L(j\omega_\pi)=-1/3$。

所以 $K_g=3$，$G_m\approx9.542$ dB。若将分子写成可调 $K$，闭环特征式为
$$
s^3+3s^2+2s+K=0.
$$
劳斯表给出严格稳定范围 $0<K<6$。当前 $K=2$，临界值 $6$ 恰好是它的三倍。$K=6$ 时多项式分解为 $(s+3)(s^2+2)$，出现虚轴根；不能把临界点计入严格稳定范围。

#### 无限裕度不等于任意鲁棒

某些常见模型没有有限相位交越，软件可能显示无限增益裕度。它只表示该定义下没有找到有限的增益临界值，并不保证对时延、模型误差、噪声或执行器饱和无限耐受。

图谱将增益裕度与虚轴穿越、相角裕度相联系。实际设计应同时看两种裕度、所有相关交越及闭环性能，明确开环不稳定极点数和反馈符号。

#### 自检

1. 若某相位交越处幅值为 $0.5$，增益裕度是多少倍、多少 dB？
2. 在本例中把 $K$ 增至 $6$，可否称为稳定且有充分余量？

**核对要点**：$2$ 倍、约 $6.021$ dB；临界情形有虚轴根，不是严格稳定。

### 关联节点

- **图谱关联**：虚轴根条件、虚轴穿越、相角裕度与相位裕度。
- **学习延伸**：劳斯表提供独立代数校验，伯德图与奈奎斯特图提供频率读数。
