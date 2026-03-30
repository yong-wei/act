---
node_id: 调节时间_10_fcbccf4e
name: 调节时间
name_en: Settling Time
lesson_units:
  - L-2a
  - 2-2
category: 概念性
knowledge_type: C
chapter: 3
tags:
  - 层0速通
  - 层1精化
  - 动态性能指标
card_version: "2.0"
source_docs:
  - authoring/lessons/legacy/L-2a/design/handout.md
  - authoring/lessons/2-2/design/handout.md
asset_refs:
  - td-04-time-domain-indices-annotated.svg
  - td-06-time-spec-to-pole-region.svg
---

## 首页

**一句话定义**：响应进入并始终保持在稳态值允许误差带内所需的最短时间，记作 $t_s$。

**核心直觉**：它不是“第一次到达目标”的时刻，而是“之后再也不明显跑出去”的时刻。

$$
t_s\approx \frac{4}{\zeta\omega_n} \qquad (2\%\ \text{误差带})
$$

**关联速查**：阻尼比 · 无阻尼自然频率 · 闭环极点

## 详情

### 完整解释

调节时间最能体现极点实部的作用。对常见欠阻尼二阶系统，2% 误差带下的工程近似为

$$
t_s\approx \frac{4}{\zeta\omega_n}=\frac{4}{\sigma}
$$

其中 $\sigma=\zeta\omega_n$ 可理解为极点实部的绝对值。因此极点越靠左，衰减越快，$t_s$ 越短。

### 常见误区

1. **误区**：调节时间是唯一一个同时受 $\zeta$ 和 $\omega_n$ 影响的指标。
   **纠正**：上升时间和峰值时间同样会同时受两者影响；调节时间的特殊之处在于它更直接对应极点实部和衰减包络。

2. **误区**：第一次进入误差带就可以算调节时间。
   **纠正**：必须进入后不再离开，才算真正达到调节时间。
