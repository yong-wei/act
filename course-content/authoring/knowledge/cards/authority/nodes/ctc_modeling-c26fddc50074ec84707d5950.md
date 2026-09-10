---
node_id: ctc_modeling-c26fddc50074ec84707d5950
authority_entity_id: "ctc:modeling-c26fddc50074ec84707d5950"
name: "线性定常系统"
name_en: "Linear time-invariant system"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "2-1"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/knowledge/cards/nodes/线性定常系统_9_c8573c66.md
  - course-content/authoring/lessons/2-1/design/2-1-handout.md
asset_refs: []
---

## 首页

# 线性定常系统 | Linear time-invariant system

**一句话定义**：状态空间模型的系数矩阵均为常数、且满足线性关系的系统。

**核心直觉**：模型的规律不随时钟时间改变，输入引起的响应可以按比例缩放并叠加。

---

## 详情

### 完整解释

连续时间线性定常系统可写为

$$
\dot x(t)=Ax(t)+Bu(t),\qquad y(t)=Cx(t)+Du(t),
$$

其中 $A,B,C,D$ 为常数矩阵。状态 $x(t)$ 随时间变化，并不意味着系数矩阵也随时间变化。对于零初始状态，输入输出关系满足叠加原理；将输入和时间起点一起平移，响应按同样的时间量平移。

零初始状态下的传递函数矩阵为

$$
G(s)=C(sI-A)^{-1}B+D.
$$

### 一阶系统示例

模型 $\dot y+2y=u$ 的系数为常数。零初值下，单位阶跃输入产生

$$
y(t)=\frac12(1-e^{-2t}),\qquad t\ge0.
$$

输入幅值增大到原来的三倍，输出也增大到三倍。若系数改为显含时间的形式，例如 $\dot y+t\,y=u$，则应按时变模型处理。

### 使用条件

线性定常模型通常描述某个工作点附近、参数近似稳定的一段工作范围。参数漂移、饱和或结构切换可能改变该近似的适用性。
