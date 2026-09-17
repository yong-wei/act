---
node_id: ctkg_v3e-canonical-ab642a336bbbbafc6327f6f2
authority_entity_id: "ctkg:v3e-canonical-ab642a336bbbbafc6327f6f2"
name: "阻尼比"
name_en: "Damping Ratio"
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
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1f4df5e3bf9321ad1a7aa06633b50859e55b1080555d2979b4e893e7fd60f9b5.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1f4df5e3bf9321ad1a7aa06633b50859e55b1080555d2979b4e893e7fd60f9b5.json
  - course-content/authoring/knowledge/cards/nodes/阻尼比_3_b849784e.md
asset_refs: []
---

## 首页

# 阻尼比 | Damping Ratio

**一句话定义**：标准二阶模型中表征阻尼相对强弱的无量纲参数。

**核心直觉**：阻尼比描述振荡与衰减的相对关系，自然频率还决定绝对时间尺度。

**关键公式**：
$$
s^2+2\zeta\omega_n s+\omega_n^2.
$$

**学习目标**：从多项式或极点读出阻尼比，并限定超调与速度判断的适用范围。

---

## 详情

### 完整解释

#### 从系数读参数

对首一分母 $s^2+a_1s+a_0$，在 $a_0>0$ 时可令 $\omega_n=\sqrt{a_0}$、$\zeta=a_1/(2\sqrt{a_0})$。图谱中某些用惯量、增益等物理参数表达的阻尼比公式，来自特定模型，不能作为所有系统的定义。

欠阻尼情形 $0<\zeta<1$ 的极点为 $-\zeta\omega_n\pm j\omega_n\sqrt{1-\zeta^2}$。若极点写作 $-\sigma\pm j\omega_d$，其中 $\sigma>0$，则
$$
\zeta=\frac{\sigma}{\sqrt{\sigma^2+\omega_d^2}}.
$$
同一条由原点发出的极点射线上，阻尼比相同；距离原点不同，自然频率不同。

#### 两个模型的比较

取教学分母 $s^2+2s+4$，得到 $\omega_n=2$、$\zeta=0.5$，极点为 $-1\pm j\sqrt3$。若改为 $s^2+4s+16$，则 $\omega_n=4$、$\zeta=0.5$，极点为 $-2\pm j2\sqrt3$。

对于相应的无零点、单位直流增益标准闭环，二者单位阶跃超调均约为 $16.3\%$，第二个模型的时间尺度减半。相同阻尼比不意味着相同响应速度。

若固定 $\omega_n=2$、增大到 $\zeta=1$，分母成为 $(s+2)^2$，标准响应不再欠阻尼振荡。但继续增大阻尼比并不保证更快，因为过阻尼系统可能产生很慢的实极点。

#### 和设计方法的联系

根轨迹给出极点随参数移动的位置，可据此读取阻尼变化；相角裕度提供频域的相对稳定性线索。相角裕度与阻尼比之间的经验近似只适用于特定模型，不应替代闭环求根和响应验证。

图谱里关于“通常取某个阻尼比范围”的陈述适合作为设计起点，最终仍由超调、时间、执行器和噪声约束决定。

#### 自检

1. 分母为 $s^2+6s+9$ 时，阻尼比是多少？
2. 给标准闭环增加一个零点后，原来的阻尼比还能直接决定超调吗？

**核对要点**：$\zeta=1$；分母参数仍可定义，但零点会改变响应，不能直接套原超调公式。

### 关联节点

- **图谱关联**：相对阻尼系数、临界阻尼系数、阻尼比与性能取舍的相关陈述。
- **学习延伸**：二阶系统、超调量、根轨迹法和相角裕度。
