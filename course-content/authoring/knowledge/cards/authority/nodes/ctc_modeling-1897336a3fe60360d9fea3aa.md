---
node_id: ctc_modeling-1897336a3fe60360d9fea3aa
authority_entity_id: "ctc:modeling-1897336a3fe60360d9fea3aa"
name: "动态系统建模规范步骤"
name_en: "Standard Procedure for Dynamic System Modeling"
category: 程序性
knowledge_type: X
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-7d9b1eb8cf06a4c5853ffc67c2401f635cb6a8328c3cb836e534d39f0a8ffb55.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-7d9b1eb8cf06a4c5853ffc67c2401f635cb6a8328c3cb836e534d39f0a8ffb55.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-01a/previous/ctc_modeling-1897336a3fe60360d9fea3aa.md"
asset_refs: []
---

## 首页

# 动态系统建模规范步骤 | Standard Procedure for Dynamic System Modeling

**一句话定义**：从对象边界和目的出发，经假设、建式、求解到结果检查的建模顺序。

**核心直觉**：先说明“要解释什么”，再决定“保留什么”；方程写对只是中途结果，单位、初值和物理含义还要复核。

**关键公式**：
$$
5\dot r+r=0.2\delta,\qquad \dot\psi=r.
$$

**学习目标**：能按统一顺序把一个动态对象变成可检查的微分方程，并区分角速度收敛与航向收敛。

---

## 详情

### 完整解释

规范建模不是把现象立刻套进某个传递函数，而是一条可回查的推理链。第一步先写清建模目的、输入、输出和系统边界：例如只研究固定航速附近的舵角到偏航角速度，输入是舵角 $\delta$（单位：度），输出是角速度 $r$（单位：度/秒），航向角记为 $\psi$（单位：度）。第二步列出简化假设，例如工作点附近的小扰动和常系数。假设决定哪些物理效应暂时不进入模型，也决定结论能覆盖多大范围。

第三步依据物理关系写出方程，固定教学例为
$$
5\dot r+r=0.2\delta,\qquad \dot\psi=r.
$$
这里时间用秒，$5$ 的单位是秒，$0.2$ 的单位是 $1/\mathrm{s}$，所以等式两侧分别具有度/秒和度/秒的量纲。第四步给定输入和初始状态。对 $\delta(t)=10$ 度（$t\ge 0$）、$r(0)=0$、$\psi(0)=0$，方程才对应一个确定的响应，而不是只有一条含任意常数的曲线。

第五步求解并说明输出。角速度响应为
$$
r(t)=2\left(1-e^{-t/5}\right)\ \mathrm{deg/s},
$$
在 $t=5$ 秒时 $r(5)=1.26424$ 度/秒，稳态角速度为 $2$ 度/秒。航向角由积分得到
$$
\psi(t)=2\left[t-5\left(1-e^{-t/5}\right)\right]\ \mathrm{deg},
$$
因此 $\psi(5)=3.67879$ 度。第六步检查结果：检查单位、初值、代回方程和极限行为。角速度趋于常数并不表示航向角趋于常数；持续的非零角速度会让航向继续变化。

### 教学计算/推理例

在十度阶跃舵下，稳态右端为 $0.2\times10=2$ 度/秒。时间常数为 $5$ 秒，所以经过一个时间常数时，角速度达到稳态值的 $1-e^{-1}$，即 $2(1-e^{-1})=1.26424$ 度/秒。把它与航向积分式比较，5 秒时航向已经改变 $3.67879$ 度。这个计算同时检查了“速率稳定”和“航向稳定”是两个不同问题。

### 适用条件与边界

本例是固定航速和固定工作点附近的线性近似；参数是教学用示例，不是某艘实船的识别结果。改变输入幅值、初始状态、反馈符号或输出定义后，必须重新写清方程并检查单位。十度舵角只属于本例的输入设定，不能据此断言对所有船舶都满足小扰动。持续定舵时角速度可收敛，而航向角一般不会收敛。

### 常见误区

1. **误区**：微分方程写出来就完成了建模。**纠正**：还必须给出边界、假设、输入、初值、输出和单位，并检查方程与响应是否相容。
2. **误区**：角速度趋于稳定值就说明航向已经稳定。**纠正**：$\dot\psi=r$；若稳态 $r\ne0$，航向仍会持续变化。

### 自检

1. 对十度阶跃舵和零初态，为什么 $r(5)$ 是 $1.26424$ 度/秒而不是 $2$ 度/秒？
2. 若检查结果发现 $r(t)$ 的单位写成度，最可能漏掉了哪一步？

**核对要点**：$t=5$ 秒是一个时间常数，响应只达到稳态值的 $1-e^{-1}$；$r$ 是角速度，单位为度/秒，$\psi$ 才是角度，且由 $r$ 积分得到。

### 关联节点

- **隔离体受力图**（无向，关系：相关）
- **消去输入导数状态变量选取法**（无向，关系：相关）
- **控制系统计算机仿真法**（无向，关系：相关）
- **机理建模与分析流程**（无向，关系：相关）
- **数学模型**（无向，关系：相关）
- **状态空间表达式建立方法**（无向，关系：相关）
- **单摆机械系统**（无向，关系：相关）
- **建模（流体储罐）**（入边，关系：属于）
- **牛顿定律力学建模法**（入边，关系：属于）
- **刚体牛顿力学五步建模法**（入边，关系：属于）
- **系统原理图消元建模法**（入边，关系：属于）
- **系统建模简化假设**（无向，关系：相关）
