---
node_id: ctkg_v3e-canonical-62bea9217008b56901615d9a
authority_entity_id: "ctkg:v3e-canonical-62bea9217008b56901615d9a"
name: "单位斜坡函数"
name_en: "Unit-Ramp Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c33b309413d9dd157ef28302bf62c814faf2172121e7b6f7cee834dfc08b9c37.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c33b309413d9dd157ef28302bf62c814faf2172121e7b6f7cee834dfc08b9c37.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-62bea9217008b56901615d9a.md"
asset_refs: []
---

## 首页

# 单位斜坡函数 | Unit-Ramp Function

**一句话定义**：从零开始、以单位斜率随时间增长的标准因果输入。

**核心直觉**：它让目标持续移动，用来检验系统是否能跟上恒定速度。

**关键公式**：
$$
r(t)=t\,u(t),\qquad R(s)=\frac1{s^2}
$$

**学习目标**：写出斜坡的幅值、斜率与延迟变换，并由完整误差通道判断跟踪偏差。

**关联**：典型输入信号

---

## 详情

### 完整解释

单位斜坡函数写作 $r(t)=t\,u(t)$。对 $t>0$，它的斜率为 $1$；“单位斜率”并不是无条件的物理单位，若时间用秒、目标用米，则斜率单位为米每秒。幅值为 $a$ 的斜坡应写作 $r_a(t)=a t u(t)$，其中 $a$ 明确携带变化率的单位。拉普拉斯变换为

$$
R(s)=\mathcal{L}\{t u(t)\}=\frac1{s^2}.
$$

斜坡没有有限的输入终值，所以讨论“稳态误差”时，指的是误差信号 $e(t)$ 是否趋向有限常数，而不是说 $r(t)$ 或 $y(t)$ 本身停在某个值。对一阶对象 $G(s)=1/(Ts+1)$，零初态单位斜坡输出为
$$
y(t)=t-T+T e^{-t/T},\qquad e(t)=r(t)-y(t)=T(1-e^{-t/T}).
$$
输出斜率最终趋向一，但保持一个由时间常数造成的跟踪偏差。

延迟斜坡要区分两种写法。纯粹把整条单位斜坡延迟 $\tau$ 秒得到 $(t-\tau)u(t-\tau)$，其变换是 $e^{-\tau s}/s^2$；若写成 $t u(t-\tau)$，它在开启瞬间已经带有 $\tau$ 的幅值，变换应为 $e^{-\tau s}(1/s^2+\tau/s)$。这个差异来自“延迟后从零重新计时”还是“延迟后继续使用原时钟”。

### 教学计算/推理例

取零初态的一阶对象 $G(s)=1/(s+1)$，输入为单位斜坡 $R(s)=1/s^2$。输出变换为
$$
Y(s)=\frac{1}{s^2(s+1)}=-\frac1s+\frac1{s^2}+\frac1{s+1},
$$
所以
$$
y(t)=t-1+e^{-t},\qquad e(t)=t-y(t)=1-e^{-t}.
$$
在 $t=2\,\mathrm{s}$ 时，目标值为 $2$，输出为 $1+e^{-2}\approx1.1353$，误差为 $1-e^{-2}\approx0.8647$；随着时间增加，误差趋向 $1$ 而不是零。若改用斜率 $a=3$，目标和误差都按三倍缩放。

### 适用条件与边界

本卡默认因果、连续时间、线性定常、零初始和明确的输入通道。闭环斜坡跟踪还要检查闭环稳定；没有足够积分型别时，误差可能发散，不能把“斜坡稳态误差”当成必然存在。延迟 $\tau$ 用秒等时间单位表示，纯延迟乘子必须是 $e^{-\tau s}$。

### 常见误区

1. **误区**：单位斜坡的值始终为一，或单位斜坡和单位阶跃只是名称不同。**纠正**：斜坡值为 $t$、斜率为一；阶跃在起点跃变后保持常数，两者的拉普拉斯变换分别是 $1/s^2$ 和 $1/s$。
2. **误区**：输出和输入都在增长，所以稳态误差一定为零；或者把延迟斜坡写成 $t u(t-\tau)$。**纠正**：应检查 $e(t)=r(t)-y(t)$ 的终值，并区分纯延迟斜坡 $(t-\tau)u(t-\tau)$ 与延迟后沿原时钟的写法。

### 自检

1. 单位斜坡在 $t=3\,\mathrm{s}$ 的目标值和拉普拉斯变换分别是什么？
2. $G(s)=1/(s+1)$ 对单位斜坡在 $t=2\,\mathrm{s}$ 的误差是多少？

**核对要点**：目标值为 $3$，变换为 $1/s^2$；误差为 $1-e^{-2}\approx0.8647$，其长期极限为 $1$。

### 关联节点

- **典型输入信号**（包含）：单位斜坡是典型输入信号家族中的持续变化输入。
