---
node_id: ctkg_v3e-object-b0cbf122498bca9269e55406
authority_entity_id: "ctkg:v3e-object-b0cbf122498bca9269e55406"
name: "延迟环节"
name_en: "Pure Time Delay"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e4963f54a478cbc04c87a194dbb646d4fabd812074ec21fd9f0e9c710b43f4db.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e4963f54a478cbc04c87a194dbb646d4fabd812074ec21fd9f0e9c710b43f4db.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01h/previous/ctkg_v3e-object-b0cbf122498bca9269e55406.md"
asset_refs: []
---

## 首页

# 延迟环节 | Pure Time Delay

**一句话定义**：延迟环节把输入完整地推迟一段固定时间后输出，不改变其形状和幅值。

**核心直觉**：信号像在通道里多走了一段路，开始得更晚，却不是被平滑成了另一种形状。

**关键公式**：
$$G(s)=e^{-s\tau},\qquad\tau\ge0.$$

**学习目标**：区分纯延迟与惯性滞后，计算其相位影响，并正确关联离散采样延迟。

---

## 详情

### 完整解释

对因果输入且零输入历史，输出在 $t<\tau$ 时为零，之后为 $u(t-\tau)$。如果系统启动之前已有信号，就必须提供相应历史，不能一律补零。延迟的作用是平移时间，不会单独降低正弦稳态的幅值；其复频率响应为 $e^{-j\omega\tau}$，模为1，连续展开的相位为 $-\omega\tau$ 弧度。

纯延迟与一阶惯性 $1/(\tau s+1)$ 不同。后者对高频既衰减幅值又改变相位，并在阶跃施加后立即开始缓慢变化；纯延迟则先等待，再复现原信号。有限阶有理近似可以用于限定频段的分析，但不能把近似模型当作任意频率下的精确等价。

### 教学计算/推理例

设归一化信号通道延迟 $\tau=0.25\,\mathrm s$。单位阶跃在前0.25秒没有输出，之后变为1。若输入为角频率 $4\,\mathrm{rad/s}$ 的正弦，延迟后稳态输出为 $\sin(4t-1)$，幅值仍为1，相位滞后1弧度，约57.30度。注意这里的4是角频率，不是4 Hz。

进一步考虑开环 $L_0(s)=1/[s(s+1)]$ 的单位负反馈。无延迟时增益穿越频率约0.78615 rad/s，相位裕度约51.827度。在开环串入0.25秒纯延迟，幅值不变，所以增益穿越频率保持相同；相位裕度减少 $\omega_c\tau\times180/\pi\approx11.261$ 度，成为约40.567度。本例只有一个相关增益交越；复杂多交越或开环不稳定模型仍需完整稳定性分析。

离散系统的一个采样周期延迟写作 $z^{-1}$，对应 $y[k]=u[k-1]$。只有连续延迟恰为采样周期时，才可在相应采样序列上直接作此对照；非整数周期延迟需要其他处理，不能随意四舍五入而忽略相位误差。

### 常见误区与边界

1. **误区**：延迟不改变幅值，所以不影响稳定性。**纠正**：反馈环对相位敏感，延迟会减少相位余量。
2. **误区**：把 $-\omega\tau$ 的弧度值直接写成角度值。**纠正**：需乘 $180/\pi$，本例1弧度约57.30度。

### 自检

1. 0.25秒延迟对4 rad/s正弦的幅值和相位各有什么影响？
2. 为什么加入纯延迟后本例增益穿越频率不变？

**核对要点**：幅值不变、相位减少1弧度；延迟的频率响应模恒为1，开环0 dB交点不移动。

### 关联节点

- **单位采样延迟环节**（无向关联）：连续时间平移与离散序列移位相对应，但必须核对采样周期和延迟长度。
