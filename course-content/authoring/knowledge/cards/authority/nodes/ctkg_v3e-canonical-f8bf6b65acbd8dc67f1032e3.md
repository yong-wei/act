---
node_id: ctkg_v3e-canonical-f8bf6b65acbd8dc67f1032e3
authority_entity_id: "ctkg:v3e-canonical-f8bf6b65acbd8dc67f1032e3"
name: "单位脉冲函数"
name_en: "Unit impulse"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "2-1"
  - "2-2"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/knowledge/cards/nodes/单位脉冲函数_3_8a68d227.md
  - course-content/authoring/knowledge/cards/nodes/单位脉冲响应_2_e56a0360.md
asset_refs: []
---

## 首页

# 单位脉冲函数 | Unit impulse

**一句话定义**：作用集中在一个时刻、积分强度为一的理想冲激输入，通常记为 $\delta(t)$。

**核心直觉**：脉冲很短、幅值很大，但其总作用量保持确定。

---

## 详情

### 面积与筛选性质

单位脉冲是一种广义函数，其基本性质为

$$
\int_{-\infty}^{\infty}\delta(t)\,dt=1,\qquad
\int_{-\infty}^{\infty}f(t)\delta(t-t_0)\,dt=f(t_0).
$$

采用包含起点冲激的因果拉普拉斯变换约定时，$\mathcal L\{\delta(t)\}=1$。在广义函数意义下，单位阶跃的导数为单位脉冲。

### 有限脉冲近似

宽度为 $\varepsilon$、高度为 $1/\varepsilon$ 的矩形脉冲面积等于一。取 $\varepsilon=0.01$，高度为 $100$，总面积仍为一。近似是否有效取决于脉宽相对于系统动态时间尺度是否足够小。

### 系统响应

线性定常系统在零初始状态下对单位脉冲的输出称为脉冲响应 $h(t)$，其拉普拉斯变换为 $G(s)$。例如 $G(s)=1/(s+1)$ 的脉冲响应为 $e^{-t}u(t)$。存在直接馈通时，输出还可能含冲激分量。
