---
node_id: ctkg_domainconcept_fef4835248def04a043183ee
authority_entity_id: "ctkg:domainconcept:fef4835248def04a043183ee"
name: "闭环系统"
name_en: "Closed-Loop System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5cc72d5a7e0f977d0b9c1086ebaea8b325571d87dbf90e1be5b79824de1bc1f6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5cc72d5a7e0f977d0b9c1086ebaea8b325571d87dbf90e1be5b79824de1bc1f6.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/最优闭环系统渐近稳定性_10_897d7b2f.md"
asset_refs: []
---

## 首页

# 闭环系统 | Closed-Loop System

**一句话定义**：利用反馈把输入、控制器、对象和测量通道连接成完整信号回路的系统。

**核心直觉**：回路闭合后，公共特征因子改变自然动态；性能要看闭环极点和各输入通道。

**关键公式**：
$$
\Phi(s)=\frac{Y(s)}{R(s)}=\frac{G(s)}{1+G(s)H(s)}
$$

**学习目标**：由闭环信号方程求传递函数，并用闭环特征方程而不是开环对象单独判断动态。

---

## 详情

### 完整解释

闭环系统的“闭合”指信号关系形成回路：输出 $Y(s)$ 经测量通路 $H(s)$ 返回比较点，与参考 $R(s)$ 形成误差，再由前向通路 $G(s)$ 产生新的输出。对负反馈、零初始条件的单输入单输出模型，
$$
E(s)=R(s)-H(s)Y(s),\qquad Y(s)=G(s)E(s).
$$
代入得到
$$
(1+GH)Y=GR,\qquad \Phi(s)=\frac{Y}{R}=\frac{G}{1+GH}.
$$
分母 $1+G(s)H(s)$ 是闭环特征因子，令它为零得到闭环极点。它把开环对象、控制器和反馈测量的共同作用压缩到同一个动态条件中；若反馈为正，符号会改变为 $1-GH$，不能脱离求和点约定背公式。

开环和闭环是两个不同的观察层次。开环极点只描述回路断开时的自然动态，闭环极点才描述反馈接通后的自由响应。闭环还可能包含参考、对象入口扰动和测量噪声等不同通道，它们共享特征因子却有不同分子。即使闭环极点向左移动，也仍需检查超调、控制量、噪声放大和模型误差；“更快”不是全部性能。

### 教学计算/推理例

取 $G(s)=4/(s+2)$、$H(s)=1$。闭环传递函数为
$$
\Phi(s)=\frac{4}{s+6}.
$$
开环对象极点为 $-2$，闭环极点为 $-6$；单位阶跃输入的稳态输出为 $\Phi(0)=4/6=2/3$。这个例子显示反馈改变了时间尺度和稳态增益，但并不说明所有反馈都稳定或都能消除静差。作为边界，若 $G(s)=2/(s-1)$、$H=1$，则闭环极点为 $-1$，反馈在该符号和增益下可以把开环不稳定极点移到左半平面，仍须检查实际结构和饱和限制。

### 适用条件与边界

上述传递函数假设线性定常、零初始条件、单回路和没有不当的零极点相消。内部非零状态、嵌套回路、时延或非线性存在时，应保留相应状态或环节后重新建立闭环模型。

### 自检

1. $G(s)=4/(s+2)$、$H=1$ 时闭环特征方程是什么？为什么？
2. 闭环极点更靠左是否单独证明所有性能都更好？为什么？

**核对要点**：特征方程为 $s+6=0$，来自 $1+GH=0$；不能，还要检查超调、控制量、噪声和模型不确定性。

### 关联节点

- **开环系统**（关联）：用于和反馈接通后的闭环极点作区分。
- **闭环系统传递函数**（关联）：给出参考到输出的输入输出关系。
