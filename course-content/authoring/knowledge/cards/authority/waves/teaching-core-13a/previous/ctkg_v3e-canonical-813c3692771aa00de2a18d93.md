---
node_id: ctkg_v3e-canonical-813c3692771aa00de2a18d93
authority_entity_id: "ctkg:v3e-canonical-813c3692771aa00de2a18d93"
name: "动态性能"
name_en: "Dynamic Performance"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "2-2"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/lessons/2-2/design/2-2-handout.md
  - course-content/authoring/knowledge/cards/nodes/动态性能指标_3_a10733c1.md
asset_refs: []
---

## 首页

# 动态性能 | Dynamic Performance

**一句话定义**：动态性能描述系统从初始状态走向稳定状态时的速度、超调与振荡。

**核心直觉**：上升快、峰值早、超调小和调节时间短，评价的是不同侧面。

---

## 详情

### 完整解释

同一条阶跃响应可用上升时间 $t_r$、峰值时间 $t_p$、超调量 $M_p$ 和调节时间 $t_s$ 描述。它们分别反映响应抵达目标附近的速度、首个峰值的时刻、越过最终值的幅度，以及进入并持续保持在误差带内所需的时间。

读数时需要明确上升时间的阈值约定和调节时间的误差带，例如采用 2% 或 5% 误差带。不同约定下的数值具有不同含义。一次越过误差带边界，也不代表响应从此保持在其中。

### 标准二阶模型

对无零点、单位静态增益的欠阻尼标准闭环模型，

$$
\Phi(s)=\frac{\omega_n^2}{s^2+2\zeta\omega_ns+\omega_n^2},\qquad 0<\zeta<1,
$$

有

$$
M_p=100e^{-\pi\zeta/\sqrt{1-\zeta^2}}\%,\qquad t_p=\frac{\pi}{\omega_n\sqrt{1-\zeta^2}}.
$$

当 $\zeta=0.5$、$\omega_n=2\,\mathrm{rad/s}$ 时，超调量约为 $16.3\%$，峰值时间约为 $1.81\,\mathrm{s}$。含有附加零点、高阶模态或饱和环节时，需要用实际响应重新测量指标。

### 关联节点

上升时间 · 峰值时间 · 超调量 · 调节时间 · 阻尼比
