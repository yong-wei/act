---
node_id: 峰值时间_3_adc7ea95
name: 峰值时间
name_en: Peak Time
lesson_units:
  - 1-3
category: 概念性
knowledge_type: C
chapter: 3
tags:
  - 层1精化
  - 时域分析
  - 动态性能指标
card_version: 1
source_docs:
  - authoring/lessons/2-2/design/handout.md
asset_refs:
  - td-04-time-domain-indices-annotated.svg
  - td-05-example-response-with-indices.svg
---

## 首页

# 峰值时间 | Peak Time

**一句话定义**：欠阻尼二阶系统单位阶跃响应达到第一个峰值的时刻，记作 $t_p$。

**关键提示**：它直接受阻尼振荡频率控制，满足 $t_p=\pi/\omega_d$。

**关联**：前置 → 欠阻尼响应、阻尼振荡频率 · 后续 → 超调量、时域指标到极点参数映射

## 详情

### 完整解释

峰值时间来自“响应什么时候第一次冲到最高点”这个问题。对欠阻尼标准二阶系统，峰值点满足

$$
\dot c(t_p)=0
$$

排除初始时刻 $t=0$ 后，可得第一个峰值对应

$$
\omega_d t_p=\pi
$$

因而

$$
t_p=\frac{\pi}{\omega_d}=\frac{\pi}{\omega_n\sqrt{1-\zeta^2}}
$$

这说明：振荡越快，峰值出现得越早。

### 常见误区

1. **误区**：峰值时间就是第一次到达终值的时刻。  
   **纠正**：第一次到达终值对应的是上升时间定义之一，峰值时间是第一次到达最高点的时刻，二者不同。

2. **误区**：峰值时间只由 $\omega_n$ 决定。  
   **纠正**：准确地说，它由 $\omega_d$ 决定，因此同时受 $\omega_n$ 和 $\zeta$ 影响。
