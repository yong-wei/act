---
node_id: ctc_modeling-71f0e8d834291c2c7d5e25b9
authority_entity_id: "ctc:modeling-71f0e8d834291c2c7d5e25b9"
name: "无直接馈通的状态空间模型"
name_en: "State-space model without direct feedthrough"
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
  - course-content/authoring/knowledge/cards/nodes/状态空间表达式_9_477dfe0d.md
  - course-content/authoring/lessons/2-1/design/2-1-handout.md
asset_refs: []
---

## 首页

# 无直接馈通的状态空间模型 | State-space model without direct feedthrough

**一句话定义**：输出方程中 $D=0$ 时，输入通过状态变化影响输出。

**核心直觉**：状态传递动态影响，直接馈通描述输入到输出的瞬时通道。

---

## 详情

### 完整解释

线性定常系统可以写为

$$
\dot x(t)=Ax(t)+Bu(t),\qquad y(t)=Cx(t)+Du(t).
$$

矩阵 $D$ 描述输入到输出的直接馈通。当 $D=0$ 时，输出为 $y(t)=Cx(t)$，当前输入先影响状态的变化率，再经状态影响输出。对有限阶、常系数的普通状态空间模型，零初值传递函数为

$$
G(s)=C(sI-A)^{-1}B.
$$

当 $s$ 的幅值趋于无穷时，$G(s)$ 趋于零，因此这一输入输出模型是严格真有理的。它仍然可以有非零的直流增益：高频极限与零频率处的增益描述不同性质。

### 归一化舵机模型示例

取 $\dot x=-x+u$、$y=x$，初始状态为零。单位阶跃输入作用后，$y(t)=1-e^{-t}$，所以 $y(0^+)=0$、$y(\infty)=1$。输出逐渐变化，最终值可以非零。

### 判断要点

- 检查输出方程中的 $D$，可以判断是否存在直接馈通。
- 初始状态、输入冲激等条件应另行说明；普通阶跃下的连续响应结论依赖这些条件。

### 关联节点

状态方程 · 输出方程 · 传递函数 · 严格真有理系统
