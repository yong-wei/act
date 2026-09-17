---
node_id: ctkg_v3e-canonical-a9f8ff29f0e4550a22bfcc67
authority_entity_id: "ctkg:v3e-canonical-a9f8ff29f0e4550a22bfcc67"
name: "上升时间"
name_en: "Rise Time"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f904318477e31af703e68a8463cf164496bac1c98a076ac1941e4e899615996b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f904318477e31af703e68a8463cf164496bac1c98a076ac1941e4e899615996b.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-12a/previous/ctkg_v3e-canonical-a9f8ff29f0e4550a22bfcc67.md"
asset_refs: []
---

## 首页

# 上升时间 | Rise Time

**一句话定义**：本节点采用从零第一次上升到终值的0–100%口径；其他资料也常采用10–90%区间，需明确区分。

**核心直觉**：比较上升时间前，先确认计时从哪个输出阈值开始、到哪个阈值结束。

**关键公式**：本例0–100%时间为 $2\pi/(3\sqrt3)$，10–90%时间为 $t_{90}-t_{10}$。

**学习目标**：按给定口径计算首次阈值到达时间，避免把不同定义的结果混为一谈。

---

## 详情

### 完整解释

上升时间用于描述输出向目标上升的速度，但并没有脱离定义的唯一数字。0–100%口径从初始零值计到第一次达到终值；10–90%口径则从第一次达到总变化的10%计到第一次达到90%。两者起终点不同，结果不同并不表示计算矛盾。

阈值通常相对于明确的初始与最终变化量设定。本卡初值为零、终值为1，所以阈值直接为0.1、0.9和1。若初值非零或终值为负，需要按相应定义重新确定阈值方向和尺度，不能机械复制这些数值。

### 教学计算/推理例

取归一化标准模型 $T=4/(s^2+2s+4)$ 的零初态单位阶跃。其响应为
$$
y(t)=1-e^{-t}\left[\cos(\sqrt3t)+\frac{\sin(\sqrt3t)}{\sqrt3}\right].
$$
第一次达到终值1时，方括号首次为零，对应 $\sqrt3t=2\pi/3$，所以
$$
t_{0\text{–}100}=\frac{2\pi}{3\sqrt3}\approx1.20920.
$$
分别求解首次 $y=0.1$ 和 $y=0.9$，得到
$$
t_{10}\approx0.244115,\qquad t_{90}\approx1.062901.
$$
因此10–90%上升区间为
$$
t_{10\text{–}90}=t_{90}-t_{10}\approx0.818786.
$$
0.818786与1.20920来自同一响应，只是指标口径不同。第一次达到终值以后仍会继续超调，故上升时间也不等于峰值时间或调节时间。

### 适用条件与边界

0–100%定义对某些单调渐近响应没有有限首次到达时刻。例如标准临界阻尼响应可以始终小于终值，却在有限时间内通过10%和90%阈值。因此跨不同响应类型比较时，应选择一致且可定义的口径。对带延迟或非零初态的试验，还要说明是否包含输入开始前的等待时间，以及采用相对还是绝对时钟。

### 常见误区

1. **误区**：不同资料给出两个上升时间，必有一个错误。**纠正**：应先核对0–100%或10–90%等定义。
2. **误区**：第一次达到终值后，输出就一直保持终值。**纠正**：欠阻尼响应还可能超调和振荡。

### 自检

1. 本例0.818786具体对应哪两个时刻之差？
2. 为什么单调渐近响应仍可能有有限10–90%时间？

**核对要点**：首次90%时刻减首次10%时刻；这两个阈值都低于最终极限值，可以在有限时间到达。

### 关联节点

- **动态性能指标**（入边，关系：包含组件）
