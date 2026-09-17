---
node_id: ctkg_v3e-object-42f4fff2329a29d38cbcd4bc
authority_entity_id: "ctkg:v3e-object-42f4fff2329a29d38cbcd4bc"
name: "系统带宽"
name_en: "System Bandwidth"
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
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1e07b0407e35bb7ba45810de377d053b119a03b699fa8c9f99b49d9ac84ef8bf.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1e07b0407e35bb7ba45810de377d053b119a03b699fa8c9f99b49d9ac84ef8bf.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/系统带宽_5_eaed82b2.md
  - course-content/authoring/lessons/2-4/design/2-4-handout.md
asset_refs: []
---

## 首页

# 系统带宽 | System Bandwidth

**一句话定义**：对常见低通闭环系统，从零频到幅值降至低频值约 $0.707$ 时的频率范围。

**核心直觉**：带宽描述系统能有效跟随多快的变化，不能只把它理解为“越大越好”。

**关键公式**：
$$
|\Phi(j\omega_b)|=\frac{|\Phi(0)|}{\sqrt2}
$$

**学习目标**：读取闭环带宽，区分带宽频率、环路截止频率与对象交接频率。

---

## 详情

### 完整解释

#### 先说明测的是哪个通道

本卡讨论参考输入到输出的稳定低通闭环传递函数 $\Phi$，且 $\Phi(0)$ 有限非零。带宽频率 $\omega_b$ 对应相对低频幅值下降 $3.010$ dB，通常简称 $-3$ dB 点。若直流增益不为 $1$，必须相对它的低频值测量，不能固定找绝对 $-3$ dB。

对带通、陷波、多峰或多个交点的系统，要另行明确频带和交点选取规则，不直接套用这张卡的单一低通定义。

#### 同一组参数怎样影响带宽

取教学闭环模型
$$
\Phi(s)=\frac1{1+0.5s}.
$$
低频增益为 $1$，令幅值为 $1/\sqrt2$，得 $\omega_b=2$ rad/s，换算为 $f_b=\omega_b/(2\pi)\approx0.318$ Hz。对应时间常数为 $0.5$ 秒，单位阶跃在 $0.5$ 秒达到终值的约 $63.2\%$。

若同结构的时间常数减为 $0.25$ 秒，带宽变为 $4$ rad/s。这个例子建立了“更短时间尺度—更宽频带”的联系；对带零点、高阶或有明显时延的系统，不能把 $1/\omega_b$ 当作精确响应时间。

#### 速度收益与代价

在同类稳定系统中，较宽带宽通常有利于跟踪较快的参考变化。但是否抑制扰动，要看扰动进入位置和对应传递函数；是否放大测量噪声，也要检查噪声到输出及控制量的通道。

例如标准负反馈中，测量噪声到输出与互补灵敏度有关。扩大某些频段的闭环响应能力，可能同时扩大这些频段内噪声的影响。实际选带宽还需要考虑执行器速率、模型可信频段与未建模共振。

#### 不要混淆三个频率

- **对象交接频率**：来自某个因子的时间常数。
- **环路截止频率 $\omega_c$**：满足 $|L(j\omega_c)|=1$，用于读取相角裕度。
- **闭环带宽频率 $\omega_b$**：相对闭环低频增益下降约 $3$ dB。

它们有联系，但一般不相等。图谱把系统带宽归入性能指标，正说明它需要与其他指标共同评价。

#### 自检

1. 若闭环低频幅值是 $2$，带宽处幅值应是多少？
2. $2$ rad/s 是否等于 $2$ Hz？

**核对要点**：$\sqrt2$；不等于，须除以 $2\pi$ 换算。

### 关联节点

- **图谱分类**：性能指标。
- **学习延伸**：二阶系统连接时域动态，相角裕度连接环路余量，伯德图提供频率读数。
