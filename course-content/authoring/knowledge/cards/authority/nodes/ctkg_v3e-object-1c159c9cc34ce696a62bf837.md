---
node_id: ctkg_v3e-object-1c159c9cc34ce696a62bf837
authority_entity_id: "ctkg:v3e-object-1c159c9cc34ce696a62bf837"
name: "相角裕度"
name_en: "Phase Margin"
category: 概念性
knowledge_type: C
bloom_level: 应用
lesson_units:
  - "2-4"
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-578c8c360c2ceb6c0c2650496b1a319ea295c153d3cd779c278125ba175c35d9.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-578c8c360c2ceb6c0c2650496b1a319ea295c153d3cd779c278125ba175c35d9.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/相角裕度_5_5a74b451.md
  - course-content/authoring/lessons/2-4/design/2-4-handout.md
asset_refs: []
---

## 首页

# 相角裕度 | Phase Margin

**一句话定义**：环路幅值为 1 的频率处，相位相对于 $-180^\circ$ 的角度余量。

**核心直觉**：先找对 $0$ dB 交越，再在同一频率读相位。

**关键公式**：
$$
\gamma=180^\circ+\arg L(j\omega_c),\qquad |L(j\omega_c)|=1
$$

**学习目标**：计算相角裕度，并说明单个裕度数不能替代完整稳定性分析。

---

## 详情

### 完整解释

#### 在哪里测量

本卡采用标准负反馈环路 $L(s)=C(s)G(s)H(s)$。$\omega_c$ 是幅值穿过 $1$（$0$ dB）的截止频率。相角裕度须在这个频率读取，而不是在相位等于 $-180^\circ$ 的频率读取；后者用于分析幅值裕度。

在常规单交越、闭环稳定的情形，相角裕度描述还可容许多少附加相位滞后才到达临界方向。这里的“容许”是对模型的分析，不包含未建模动态或执行器约束的保证。

#### 一个完整的计算例

取教学环路
$$
L(s)=\frac{\sqrt2}{s(s+1)}.
$$
由 $|L(j\omega)|=\sqrt2/[\omega\sqrt{1+\omega^2}]$，解得唯一正截止频率 $\omega_c=1$ rad/s。该处相位为 $-90^\circ-45^\circ=-135^\circ$，所以 $\gamma=45^\circ$。

闭环特征多项式为 $s^2+s+\sqrt2$，其极点实部为负，稳定性与裕度解释相容。若只新增纯时延 $e^{-s\tau}$，幅值不变、相位额外减少 $\omega\tau$ 弧度；对本例，临界时延为 $(\pi/4)/1\approx0.785$ 秒。此数仅针对本例和“纯时延”假设。

#### 与速度和精度共同判断

增益调整可能移动截止频率，随之改变相角裕度。超前校正通过局部相位提升争取余量，滞后校正可能通过移动工作频段换取余量。它们对带宽、低频误差和噪声的影响需要分别检查。

图谱还关联了非最小相位、多交越以及相对稳定性的陈述。这些关联用于提醒边界：当有开环右半平面极点、多个 $0$ dB 交越或复杂时延时，应检查全部相关交越并结合奈奎斯特判据，不能以“某处裕度为正”直接断言稳定。

#### 易错判断

- **裕度越大一定越好**：还要考虑跟踪速度、稳态误差、噪声和控制量。
- **$\gamma\approx100\zeta$ 是恒等式**：它只是在特定模型范围下的近似，不能替代闭环响应计算。

#### 自检

1. 在幅值交越处相位为 $-150^\circ$，常规相角裕度是多少？
2. 校正器在原交越处提供 $30^\circ$ 超前，相角裕度必然增加 $30^\circ$ 吗？

**核对要点**：$30^\circ$；不一定，新交越频率可能改变。

### 关联节点

- **图谱关联**：相位裕度、增益裕度、相频特性、开环指标估算时域性能方法。
- **学习延伸**：伯德图负责读数，超前和滞后负责改变环路，闭环响应负责最后复核。
