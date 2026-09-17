---
node_id: ctkg_v3e-canonical-115de5ef0289a778cf5b69c6
authority_entity_id: "ctkg:v3e-canonical-115de5ef0289a778cf5b69c6"
name: "终值定理"
name_en: "Final Value Theorem"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "3-7"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/lessons/3-7/design/3-7-handout.md
asset_refs: []
---

## 首页

# 终值定理 | Final Value Theorem

**一句话定义**：满足极点条件时，终值可由 $\lim_{s\to0}sF(s)$ 求得。

**核心直觉**：求极限前先检查动态是否允许信号收敛。

---

## 详情

### 完整解释

设因果信号 $f(t)$ 的拉普拉斯变换为 $F(s)$。对常见的有理变换，若 $sF(s)$ 的全部极点位于开左半平面，则

$$
\lim_{t\to\infty}f(t)=\lim_{s\to0}sF(s).
$$

这把长时间后的信号值转化为复频域中的低频极限。控制系统求稳态误差时，应先写出对应输入通道的 $E(s)$，再检查 $sE(s)$ 的极点。代数极限存在并不足以证明时间响应收敛；右半平面极点或未衰减振荡会使终值判断失效。

### 一阶响应示例

若归一化测量响应为

$$
Y(s)=\frac{2}{s(s+2)},
$$

则 $sY(s)=2/(s+2)$ 只有极点 $-2$，条件成立，故 $y(\infty)=1$。相应时域响应 $1-e^{-2t}$ 给出相同结果。

### 稳态误差计算

在系统稳定且满足上述条件时，$e_{ss}=\lim_{s\to0}sE(s)$。阶跃、斜坡和扰动对应不同的 $E(s)$，应分别建立误差通道。

### 关联节点

拉普拉斯变换 · 闭环稳定性 · 稳态误差 · 系统型别
