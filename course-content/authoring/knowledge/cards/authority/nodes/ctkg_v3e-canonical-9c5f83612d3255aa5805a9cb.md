---
node_id: ctkg_v3e-canonical-9c5f83612d3255aa5805a9cb
authority_entity_id: "ctkg:v3e-canonical-9c5f83612d3255aa5805a9cb"
name: "固有频率 ω_n"
name_en: "Natural Frequency and Pole Geometry"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a4961d0617ae5cbeb52bb6620ce80d53c83d4d13c6cbc24f9f080da656cf1ff1.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a4961d0617ae5cbeb52bb6620ce80d53c83d4d13c6cbc24f9f080da656cf1ff1.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-11a/previous/ctkg_v3e-canonical-9c5f83612d3255aa5805a9cb.md"
asset_refs: []
---

## 首页

# 固有频率 ω_n | Natural Frequency and Pole Geometry

**一句话定义**：对标准欠阻尼二阶共轭极点，固有频率是极点到复平面原点的距离。

**核心直觉**：极点的水平分量、竖直分量和到原点的距离分别承载不同信息。

**关键公式**：$\omega_n=\sqrt{\sigma^2+\omega_d^2}$，其中极点为 $-\sigma\pm j\omega_d$。

**学习目标**：用极点几何识别固有频率，并理解固定阻尼比下的时间缩放。

---

## 详情

### 完整解释

标准欠阻尼极点写成 $-\zeta\omega_n\pm j\omega_n\sqrt{1-\zeta^2}$。记衰减率为 $\sigma=\zeta\omega_n$，振荡角频率为 $\omega_d$，便有 $\sigma^2+\omega_d^2=\omega_n^2$。因此固有频率是两个分量共同决定的模长，不是仅取虚部。

在固定阻尼比下改变固有频率，会同时按比例改变极点实部和虚部。对无零点、单位直流增益且零初态的标准二阶阶跃，这相当于改变时间尺度而保留归一化形状。若只改一个系数、阻尼比同时改变，就不再是这种纯时间缩放。

### 教学计算/推理例

第一组极点为 $-1\pm j\sqrt3$，所以
$$
\omega_n=\sqrt{1^2+(\sqrt3)^2}=2,\qquad \zeta=\frac12.
$$
虚部大小为 $\sqrt3$，只表示阻尼自然频率。对应单位阶跃首次峰时为 $\pi/\sqrt3$，约 $1.81380$，超调比例为 $e^{-\pi/\sqrt3}$。

保持 $\zeta=0.5$，将固有频率改为3。标准模型必须相应写为
$$
T(s)=\frac9{s^2+3s+9},
$$
极点变为 $-1.5\pm j(3\sqrt3/2)$。首次峰时为
$$
t_p=\frac\pi{3\sqrt{0.75}},
$$
是第一组的 $2/3$。超调比例仍由同一个阻尼比决定，保持 $e^{-\pi/\sqrt3}$。这里分子、一次项和常数项都按标准关系变化，不能只将常数项4替换成9而保留其他部分。

### 适用条件与边界

这种几何和时间缩放解释依赖标准二阶结构。额外零点、非零初态或不同通道可能改变输出响应，即使极点模长相同也不能直接比较完整曲线。实际系统参数有约束时，固有频率和阻尼比也未必能独立调节。本例仅比较明确给定的两个归一化模型。

复平面的几何长度还应使用一致时间单位。若模型时间尺度发生变化，极点坐标和频率单位也会随之变化，不能只比较裸数值。

### 常见误区

1. **误区**：极点虚部就是 $\omega_n$。**纠正**：虚部大小是 $\omega_d$，模长才是这里的 $\omega_n$。
2. **误区**：提高固有频率必然改变超调比例。**纠正**：本例在阻尼比固定时仅改变时间尺度，超调比例不变。

### 自检

1. 极点 $-1\pm j\sqrt3$ 的模长是多少？
2. 第二组峰时为什么缩为第一组的 $2/3$？

**核对要点**：模长为2；固定阻尼比时，峰时与固有频率成反比。

### 关联节点

- **固有频率**（无向，关系：相关）
