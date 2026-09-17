---
node_id: ctkg_v3e-canonical-cd25e47d10ddfec280e82fde
authority_entity_id: "ctkg:v3e-canonical-cd25e47d10ddfec280e82fde"
name: "单位加速度函数"
name_en: "Unit acceleration input"
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
  - course-content/authoring/knowledge/cards/nodes/单位加速度响应_3_5ae8db8b.md
asset_refs: []
---

## 首页

# 单位加速度函数 | Unit acceleration input

**一句话定义**：从零位置、零初始变化率出发，以单位恒定加速度增长的理想输入。

**核心直觉**：输入的变化率也在持续增大，比恒速目标更能体现跟踪动态的不足。

---

## 详情

### 完整解释

$$
r(t)=\frac{t^2}{2}\,u(t),\qquad
\mathcal L\{r(t)\}=\frac1{s^3}.
$$

其中 $u(t)$ 为单位阶跃函数。

在 $t>0$ 时，$\dot r(t)=t$、$\ddot r(t)=1$，例如 $r(2)=2$。因子 $1/2$ 保证二阶导数为一；$t^2$ 对应的加速度则为二。

### 一阶跟踪示例

对零初值系统 $G(s)=1/(Ts+1)$，$T>0$，输入输出之差为

$$
e(t)=Tt+T^2(e^{-t/T}-1).
$$

当 $t$ 增大时，误差近似为 $Tt-T^2$，因此持续增长。一阶系统能够跟随阶跃并不意味着它能够无差跟踪加速度输入。

### 使用条件

这里的“单位加速度”描述输入波形的归一化形式。只有当输入代表位置等相应物理量时，它才具有实际运动加速度的含义。
