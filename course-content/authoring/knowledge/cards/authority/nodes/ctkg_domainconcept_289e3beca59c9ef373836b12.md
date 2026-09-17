---
node_id: ctkg_domainconcept_289e3beca59c9ef373836b12
authority_entity_id: "ctkg:domainconcept:289e3beca59c9ef373836b12"
name: "零阶保持器"
name_en: "Zero-Order Hold"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-cf94d646a554978c56904776b8184762c06b848f55034ef1f84858f6d5a4ab54.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-cf94d646a554978c56904776b8184762c06b848f55034ef1f84858f6d5a4ab54.json
  - course-content/authoring/knowledge/cards/nodes/零阶保持器_7_ddb4bb56.md
asset_refs: []
---

## 首页

# 零阶保持器 | Zero-Order Hold

**一句话定义**：在相邻采样时刻之间维持最近一次样值不变的保持装置。

**核心直觉**：数字指令更新是离散的，对象接收到的是一段一段保持的输入。

**关键公式**：
$$
u(t)=u[k],\qquad kT_s\le t<(k+1)T_s.
$$

**学习目标**：区分采样与保持，理解保持对模型和相位的影响。

---

## 详情

### 完整解释

#### 保持不等于完美重构

采样器把连续信号变成一串样值；保持器则把样值变成分段常值信号。零阶保持的输出是阶梯状的，不是原连续信号的精确还原。采样定理给出的理想重构条件，不等于使用零阶保持就能无失真重构。

对以加权冲激串作为输入的连续描述，宽度 $T_s$、高度 $1$ 的保持脉冲具有传递函数
$$
H_0(s)=\frac{1-e^{-sT_s}}s.
$$
其低频极限为 $T_s$，与冲激串幅值的约定有关。讨论频率幅值形状时，经常使用归一化 $H_0(j\omega)/T_s$，不能把两种约定混在一起。

#### 频率例子

归一化响应可写为
$$
\frac{H_0(j\omega)}{T_s}=\frac{\sin(\omega T_s/2)}{\omega T_s/2}e^{-j\omega T_s/2}.
$$
取教学采样周期 $T_s=0.1$ 秒、$\omega=2$ rad/s，则归一化幅值约为 $0.998334$，相位约为 $-5.730^\circ$。低频附近可直观理解为带有约半个采样周期的相位滞后，但在高频不能把整个保持器精确替换为纯时延。

#### 保持参与离散模型的形成

连续对象 $\dot x=-x+u$ 在一个采样周期内保持 $u[k]$，精确积分得到
$$
x[k+1]=e^{-T_s}x[k]+(1-e^{-T_s})u[k].
$$
这说明离散模型必须包含保持方式。改变采样周期会改变离散极点；闭环稳定性和超调变化还取决于控制器及对象，不能把某个例子的性能变化写成所有系统的规律。

图谱关联了采样周期、保持器和相位影响。它们共同说明，数字控制设计应把采样、计算和保持的时序作为模型的一部分。

#### 自检

1. $u[0]=1,u[1]=3$ 时，第一个与第二个采样区间的输出各是多少？
2. 本例 $T_s=0.1$ 时，离散状态系数 $e^{-T_s}$ 约是多少？

**核对要点**：分别保持 $1$ 与 $3$；约 $0.904837$。

### 关联节点

- **图谱关联**：采样周期、保持器、区间保持表达式及相位影响。
- **学习延伸**：脉冲传递函数描述采样时刻的模型，朱利判据检查离散闭环稳定性。
