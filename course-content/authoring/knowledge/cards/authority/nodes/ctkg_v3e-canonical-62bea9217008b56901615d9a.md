---
node_id: ctkg_v3e-canonical-62bea9217008b56901615d9a
authority_entity_id: "ctkg:v3e-canonical-62bea9217008b56901615d9a"
name: "单位斜坡函数"
name_en: "Unit ramp function"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "2-2"
  - "2-4"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/knowledge/cards/nodes/典型输入信号_3_897a572d.md
  - course-content/authoring/knowledge/cards/nodes/单位斜坡响应_3_2d06d057.md
asset_refs: []
---

## 首页

# 单位斜坡函数 | Unit ramp function

**一句话定义**：从零开始，以单位恒定变化率增长的理想输入。

**核心直觉**：输入持续移动，可以检验系统对恒速目标的跟踪能力。

---

## 详情

### 完整解释

$$
r(t)=t\,u(t),\qquad
\mathcal L\{r(t)\}=\frac1{s^2}.
$$

其中 $u(t)$ 为单位阶跃函数。

在 $t>0$ 时，$\dot r(t)=1$；例如 $r(2)=2$。若物理量具有单位，“单位变化率”也应附带相应的量纲，例如每秒一弧度。变化率为 $v$ 的输入写为 $v\,t\,u(t)$。

### 一阶跟踪示例

对零初值系统 $G(s)=1/(Ts+1)$，$T>0$，

$$
y(t)=t-T+Te^{-t/T},\qquad
r(t)-y(t)=T(1-e^{-t/T}).
$$

输出最终具有与输入相同的变化率，但相差一个有限偏差 $T$。这一偏差与时间常数有关，不能仅从单位阶跃响应的最终值等于一推断斜坡跟踪误差为零。

### 使用条件

斜坡响应强调持续变化输入下的跟踪误差。计算闭环稳态误差时，应先确认闭环稳定、输入类型以及所使用的反馈结构。
