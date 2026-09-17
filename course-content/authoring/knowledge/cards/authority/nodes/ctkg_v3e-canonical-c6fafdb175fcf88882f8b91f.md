---
node_id: ctkg_v3e-canonical-c6fafdb175fcf88882f8b91f
authority_entity_id: "ctkg:v3e-canonical-c6fafdb175fcf88882f8b91f"
name: "阻尼自然频率"
name_en: "Damped Natural Frequency"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c12998fd919f9938798882ff991b0e1985c34b878dacbf67f4bb5267382dd6c4.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c12998fd919f9938798882ff991b0e1985c34b878dacbf67f4bb5267382dd6c4.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-11a/previous/ctkg_v3e-canonical-c6fafdb175fcf88882f8b91f.md"
asset_refs: []
---

## 首页

# 阻尼自然频率 | Damped Natural Frequency

**一句话定义**：阻尼自然频率 $\omega_d$ 是稳定欠阻尼二阶模态中振荡因子的角频率。

**核心直觉**：相位可以按固定节奏推进，而振幅同时衰减；振荡相位周期不代表整条衰减曲线严格重复。

**关键公式**：$\omega_d=\omega_n\sqrt{1-\zeta^2}$。

**学习目标**：从极点虚部求阻尼频率，并正确区分完整振荡周期、相邻极值间隔和首次峰时。

---

## 详情

### 完整解释

标准欠阻尼极点的实部给出衰减，虚部大小给出振荡相位的推进速度。因为 $0<\zeta<1$，$\omega_d$ 小于 $\omega_n$。将固有频率直接当作测得的暂态振荡频率，会忽略阻尼造成的差异。

带指数包络的暂态并非严格周期函数：经过一段相位周期后，振幅已经改变。通常说其振荡周期，是指相位增长 $2\pi$ 的时间间隔，而不是整条响应在幅值上完全复制。相邻最大值与最小值之间通常只有半个相位周期，不能用这个间隔直接当作完整周期。

### 教学计算/推理例

取归一化标准系统 $\omega_n=2$、$\zeta=0.5$，极点为 $-1\pm j\sqrt3$，因此
$$
\omega_d=\sqrt3,\qquad T_d=\frac{2\pi}{\sqrt3}\approx3.62760.
$$
对该无零点、单位增益模型的零初态单位阶跃，第一次超调峰时为
$$
t_p=\frac\pi{\sqrt3}\approx1.81380.
$$
下一次正超调峰发生在 $3\pi/\sqrt3$，两次正峰之间相隔 $2\pi/\sqrt3$。中间还存在一次低于终值的极小值，所以相邻最大、最小值的间隔只是一半。

这个结论可从标准阶跃导数核对：导数的振荡因子为 $\sin(\sqrt3t)$，在整数倍 $\pi/\sqrt3$ 时为零，极大与极小交替出现。指数包络持续衰减，使下一正峰的超调幅度小于第一正峰，但不会把相位周期变为两倍或一半。

### 适用条件与边界

峰时关系针对本例标准阶跃，若存在零点、不同初态或其他模态，首峰位置不一定仍为 $\pi/\omega_d$。从测量数据估计频率时，要确认比较的是同类峰值，并区分噪声产生的局部极值。若阻尼达到或超过临界值，标准特征根不再有非零虚部，这个实数振荡频率公式不再按欠阻尼方式使用。

### 常见误区

1. **误区**：相邻一个峰和一个谷的间隔就是完整周期。**纠正**：本例只是半周期，应比较相邻同类正峰。
2. **误区**：响应有“周期”就意味着幅值不变。**纠正**：这里描述振荡相位，包络仍在衰减。

### 自检

1. 本例为什么用 $2\pi/\sqrt3$ 而不是 $\pi/\sqrt3$ 表示相位周期？
2. 第二个正峰比第一个低，是否说明振荡频率已经改变？

**核对要点**：完整相位变化为 $2\pi$；峰值降低来自指数包络，不等于相位推进速率改变。

### 关联节点

- **截止频率**（无向，关系：相关）
- **无阻尼自然频率**（无向，关系：相关）
- **穿越频率（相位）**（无向，关系：相关）
