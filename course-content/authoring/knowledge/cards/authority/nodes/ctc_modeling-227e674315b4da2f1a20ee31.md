---
node_id: ctc_modeling-227e674315b4da2f1a20ee31
authority_entity_id: "ctc:modeling-227e674315b4da2f1a20ee31"
name: "动态系统"
name_en: "Dynamic System"
category: 概念性
knowledge_type: C
bloom_level: 理解
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-98a56c1112244f705fcdad980916f54145eab1719be7fc98fad0bec972528edc.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-98a56c1112244f705fcdad980916f54145eab1719be7fc98fad0bec972528edc.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-01a/previous/ctc_modeling-227e674315b4da2f1a20ee31.md"
asset_refs: []
---

## 首页

# 动态系统 | Dynamic System

**一句话定义**：输出会随时间演化，并由当前输入与内部状态共同决定的系统。

**核心直觉**：状态像系统的“记忆”；同一个输入若从不同状态出发，之后的输出也可能不同。

**关键公式**：
$$
\dot r=\frac{0.2\delta-r}{5},\qquad \dot\psi=r.
$$

**学习目标**：能指出输入、状态和输出的作用，并用初始状态解释同输入下的不同响应。

---

## 详情

### 完整解释

动态系统的关键不在于变量名字，而在于“现在的状态是否携带过去的信息”。在固定航速附近的教学模型中，舵角 $\delta$ 是输入，偏航角速度 $r$ 和航向角 $\psi$ 可以作为状态，观测哪个量则由输出定义决定。模型写成
$$
\dot r=\frac{0.2\delta-r}{5},\qquad \dot\psi=r,
$$
其中时间单位为秒，$\delta$ 用度，$r$ 用度/秒，$\psi$ 用度。第一式说明当前角速度不会瞬间跳到稳态值，而是按时间常数 $5$ 秒逐渐变化；第二式说明航向是角速度的积分。

对十度阶跃舵 $\delta(t)=10$ 度，角速度稳态值是 $2$ 度/秒。给定初始角速度 $r(0)=r_0$，其响应为
$$
r(t)=2+(r_0-2)e^{-t/5}\ \mathrm{deg/s}.
$$
初始状态 $r_0=0$ 时，5 秒后的角速度为 $1.26424$ 度/秒；若输入完全相同但 $r_0=1$ 度/秒，则 5 秒后的角速度为 $1.63212$ 度/秒。两者的差值是 $e^{-1}$ 度/秒，正是初始状态记忆经过一个时间常数后的残留。

状态还决定输出的长期含义。因为 $\dot\psi=r$，当定舵使 $r$ 趋于 $2$ 度/秒时，$\psi$ 的斜率趋于 $2$ 度/秒，航向不会趋于固定角度。对应的零初态传递函数是
$$
\frac{R(s)}{\Delta(s)}=\frac{0.2}{5s+1},\qquad
\frac{\Psi(s)}{\Delta(s)}=\frac{0.2}{s(5s+1)}.
$$
后一个式子多出的 $1/s$ 正是“速率到航向”的积分关系；它不能被角速度的一阶收敛替代。

### 教学计算/推理例

只改变初始角速度，保留十度阶跃舵、$T=5$ 秒和 $K=0.2\ \mathrm{s^{-1}}$。零初态时
$$
r(5)=2(1-e^{-1})=1.26424\ \mathrm{deg/s}.
$$
取 $r(0)=1\ \mathrm{deg/s}$ 时
$$
r(5)=2-e^{-1}=1.63212\ \mathrm{deg/s}.
$$
输入相同而结果不同，说明初态是动态系统描述不可省略的一部分。

### 适用条件与边界

本卡使用的是线性、定常、固定工作点附近的角速度模型，数值仅为教学例。状态的选取不是唯一的，但必须足以确定后续演化；输出也不一定等于全部状态。若改变输入、初态、反馈符号、工作点或模型边界，应重新求解。恒定舵角下的航向增长说明本例不是一个能让航向自行回到固定值的航向闭环。

### 常见误区

1. **误区**：给定输入就能唯一确定动态响应，初始状态无关紧要。**纠正**：微分方程需要初始条件；同输入、不同初态会留下可计算的响应差异。
2. **误区**：$r$ 稳态为常数，所以 $\psi$ 也稳态为常数。**纠正**：$r=\dot\psi$；非零常值角速度会使航向持续以近似恒定斜率变化。

### 自检

1. 同一十度阶跃舵下，为什么 $r(0)=1$ 度/秒时的 $r(5)$ 大于零初态时的 $r(5)$？
2. 从 $R/\Delta$ 到 $\Psi/\Delta$ 为什么会多出一个 $1/s$？

**核对要点**：初始角速度的偏差按 $e^{-t/5}$ 衰减，所以正的初态使 5 秒结果增加 $e^{-1}$；$\dot\psi=r$，拉氏变换后零初态积分对应除以 $s$。

### 关联节点

- **因果系统**（无向，关系：相关）
- **数学模型**（无向，关系：相关）
- **输出**（无向，关系：相关）
- **未建模动态过程**（无向，关系：相关）
- **单位负反馈系统**（入边，关系：属于）
- **正反馈系统**（入边，关系：属于）
- **过阻尼系统**（入边，关系：属于）
- **欠阻尼系统**（入边，关系：属于）
- **二阶临界阻尼系统**（入边，关系：属于）
- **微分方程模型**（出边，关系：有表示）
- **传递函数**（出边，关系：有表示）
- **状态空间模型**（出边，关系：有表示）
