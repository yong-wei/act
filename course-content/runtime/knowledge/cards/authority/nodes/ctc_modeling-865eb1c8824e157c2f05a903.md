---
node_id: ctc_modeling-865eb1c8824e157c2f05a903
authority_entity_id: "ctc:modeling-865eb1c8824e157c2f05a903"
name: "传递函数"
name_en: "Transfer Function"
category: 概念性
knowledge_type: C
bloom_level: 应用
lesson_units:
  - "1-2"
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4deb0b0cb3031abc6c382b25372aa36ca9720e07c2876404ce9f3c15eecf6983.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4deb0b0cb3031abc6c382b25372aa36ca9720e07c2876404ce9f3c15eecf6983.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/传递函数_1_2.md
  - course-content/authoring/lessons/1-2/design/1-2-handout.md
asset_refs: []
---

## 首页

# 传递函数 | Transfer Function

**一句话定义**：线性时不变系统在零初始条件下，输出与输入拉普拉斯变换之比。

**核心直觉**：同一模型可以回答不同输入会产生什么输出；先说明输入和输出，再谈传递函数。

**关键公式**：
$$
G(s)=\frac{Y(s)}{U(s)}\quad\text{（零初始条件）}
$$

**学习目标**：从一个微分方程得到传递函数，并区分对象模型与闭环模型。

---

## 详情

### 完整解释

#### 从物理量到模型

传递函数描述选定输入、输出之间的线性动态关系。输入可以是舵角，输出可以是艏向角速度；若把输出改为艏向角，模型通常会多一个积分环节。因此“同一艘船的传递函数”并不完整，还应说明变量、工作点及忽略了哪些效应。

对线性微分方程作拉普拉斯变换，将初始条件置零，再整理为输出变换除以输入变换。零初始条件用于定义输入引起的响应，不表示实际系统永远没有初始运动。初始状态不为零时，总响应还包含由初始状态产生的部分。

#### 一个可复核的小模型

以下是教学用的一阶艏向角速度模型，不代表某型实船参数：
$$
2\dot r(t)+r(t)=0.5\delta(t),\qquad r(0)=0.
$$
令 $r$ 为角速度、$\delta$ 为舵角，时间单位为秒。得到
$$
G_{r\delta}(s)=\frac{R(s)}{\Delta(s)}=\frac{0.5}{2s+1}.
$$
若施加幅值为 $2$ 的阶跃舵角，则 $r(t)=1-e^{-t/2}$；$t=2$ 秒时达到终值的约 $63.2\%$。若输出换为艏向角 $\psi$，由 $\dot\psi=r$ 得 $G_{\psi\delta}(s)=0.5/[s(2s+1)]$。这个积分来自变量关系，不能随意删掉。

#### 放回控制系统中理解

对象用 $G(s)$、控制器用 $C(s)$、测量反馈用 $H(s)$ 表示，环路传递函数为 $L(s)=C(s)G(s)H(s)$。标准负反馈下，从参考到输出的闭环传递函数为
$$
\Phi(s)=\frac{C(s)G(s)}{1+C(s)G(s)H(s)}.
$$
对象极点与闭环极点不是同一组数。串联、并联和反馈连接也采用不同的合成规则。图谱中这些连接结构与传递函数相联系，是从单对象建模进入控制系统分析的桥梁。

#### 适用条件与误区

- 传递函数适用于线性时不变模型；非线性对象通常只能在指定工作点附近线性化使用。
- 不能把输出的拉氏表达式 $Y(s)$ 直接当成 $G(s)$，还要除以对应输入 $U(s)$。
- 输入输出模型可能不显示不可控、不可观的内部模态；不能仅凭约分后的极点判断全部内部状态。

#### 自检

1. 将例子中的输出由角速度改为角度，为什么多出 $1/s$？
2. 初始角速度不为零时，是否仍可只用 $Y=GU$ 描述总响应？

**核对要点**：角度是角速度的积分；非零初始状态需要另计自由响应。

### 关联节点

- **图谱关联**：串联连接、并联连接、通过微分方程的拉普拉斯变换求传递函数。
- **学习延伸**：用二阶系统理解模型参数，用伯德图观察频率特性，用根轨迹研究反馈后的极点变化。这些学习建议不新增图谱先修边。
