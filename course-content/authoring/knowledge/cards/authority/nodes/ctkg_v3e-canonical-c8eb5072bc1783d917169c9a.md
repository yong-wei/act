---
node_id: ctkg_v3e-canonical-c8eb5072bc1783d917169c9a
authority_entity_id: "ctkg:v3e-canonical-c8eb5072bc1783d917169c9a"
name: "稳态过程"
name_en: "Asymptotic System Behavior"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-aee15520e0619c5cd8bd749bc05e14b67b3f0940fff74274bb2875c734823b22.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-aee15520e0619c5cd8bd749bc05e14b67b3f0940fff74274bb2875c734823b22.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-12a/previous/ctkg_v3e-canonical-c8eb5072bc1783d917169c9a.md"
asset_refs: []
---

## 首页

# 稳态过程 | Asymptotic System Behavior

**一句话定义**：稳态过程描述系统在给定持续输入下的长期输出行为，不限于趋向一个常数。

**核心直觉**：输出可以持续增长而跟踪误差趋于常数，稳定性判断必须连同输入一起考虑。

**关键公式**：本例 $y=t-1+e^{-t}$，而 $r-y=1-e^{-t}\to1$。

**学习目标**：区分长期输出形式、输出终值和稳态误差，并解释无界输入下的稳定系统响应。

---

## 详情

### 完整解释

系统长期行为取决于输入。恒定输入可能对应恒定输出，正弦输入可能对应周期输出，斜坡输入则可能对应持续增长的输出。因此分析稳态过程时，要先说明输入形式和所关心的量，不能默认所有情况都存在有限的 $y(\infty)$。

稳定性与输出是否增长也不是简单的一一对应。稳定线性系统对有界输入的有界性约束，不要求它对无界斜坡也输出有界。若输入本身持续增大，输出增长并不单独构成系统不稳定的证据。应检查自然模态以及输入条件，而不是只看曲线是否向上。

### 教学计算/推理例

取归一化一阶模型
$$
T(s)=\frac1{s+1},\qquad \dot y+y=r,
$$
从零初态施加因果斜坡 $r(t)=t$。解为
$$
y(t)=t-1+e^{-t}.
$$
完整响应与长期形式 $t-1$ 的差为 $e^{-t}$，趋于零。因此输出长期保持斜率为1的增长，并没有有限常数终值。

若关心参考与输出的差，则
$$
e(t)=r(t)-y(t)=1-e^{-t}\longrightarrow1.
$$
输出不断增长与误差趋于常数可以同时发生。模型的自然模态 $e^{-t}$ 衰减，输出的增长来自斜坡输入，而不是一个增长的内部自然模态。

长期形式 $t-1$ 也不能替代全过程。在 $t=0$ 它等于 $-1$，而实际初值为0；衰减项 $e^{-t}$ 正好补足差异。直接把渐近表达式从起始时刻使用，会破坏初始条件。

### 适用条件与边界

本例是明确的一阶线性模型，变量和时间已归一化，没有其他隐藏状态、饱和或扰动。更一般系统的长期形式需要结合完整动态与输入重新求解。稳态误差也必须按相同单位和同一参考定义，不能把输出与某个不同位置的命令直接相减。

对周期输入，应讨论周期稳态而不是把每个瞬间误差都替换成一个常数；对不稳定自然模态，则未必存在本例这种衰减差值的长期分解。

### 常见误区

1. **误区**：稳定系统输出绝不会随时间增长。**纠正**：本例输入斜坡无界，输出也增长，但自然模态衰减。
2. **误区**：稳态误差为1，表示输出终值为1。**纠正**：一个是差值极限，一个是输出本身的行为。

### 自检

1. 本例哪一个量趋于1？
2. 为什么不能把 $t-1$ 当成从零时刻起的精确输出？

**核对要点**：跟踪误差趋于1；长期表达式不满足初值，完整响应还含 $e^{-t}$。

### 关联节点

- **稳态误差**（无向，关系：相关）
- **动态过程**（无向，关系：相关）
