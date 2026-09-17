---
node_id: ctkg_domainconcept_27b69e7f2e837fd62dc31379
authority_entity_id: "ctkg:domainconcept:27b69e7f2e837fd62dc31379"
name: "反馈控制系统"
name_en: "Feedback Control System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1680cea2ea4bcab0d3da83cdbda1b84906ee1da30d2f1e6954d37c1084311fed.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1680cea2ea4bcab0d3da83cdbda1b84906ee1da30d2f1e6954d37c1084311fed.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/反馈控制系统_1_98dc667a.md"
asset_refs: []
---

## 首页

# 反馈控制系统 | Feedback Control System

**一句话定义**：把参考、输出测量、扰动和噪声放入信号闭环，并用反馈误差驱动前向通路的系统。

**核心直觉**：公共分母决定闭环动态，不同输入通道由各自的分子表达影响路径。

**关键公式**：
$$
E=R-HY-N,\qquad Y=GE+D
$$

**学习目标**：从信号方程分别推导参考、扰动和测量噪声到输出的传递关系。

---

## 详情

### 完整解释

反馈控制系统的关键不是图上有没有回路线，而是比较点、反馈通路和各个输入的注入位置是否已定义。令前向通路为 $G(s)$、反馈通路为 $H(s)$，参考输入为 $R(s)$，输出为 $Y(s)$，测量噪声为 $N(s)$；为便于区分，令扰动 $D(s)$ 在前向通路输出处叠加。负反馈求和点的方程是
$$
E(s)=R(s)-H(s)Y(s)-N(s),\qquad Y(s)=G(s)E(s)+D(s).
$$
代入并整理得
$$
(1+GH)Y=GR+D-GN,
$$
因此
$$
\frac{Y}{R}=\frac{G}{1+GH},\qquad \frac{Y}{D}=\frac{1}{1+GH},\qquad \frac{Y}{N}=-\frac{G}{1+GH}.
$$
三个通道有同一个闭环特征因子 $1+GH$，但分子不同：参考先经过前向通路，输出端扰动绕过了 $G$，测量噪声通过误差求和点以负号进入。把一个通道的分子复制给另一个通道，会错误估计抗扰或抗噪性能。

这条推导还说明了反馈的因果链：测量输出改变误差，误差改变前向控制动作，前向动作改变输出，输出再经 $H$ 返回比较点。若求和点改为正反馈，特征因子会变成 $1-GH$；如果扰动改在对象输入处，通道分子也必须重新写。因而“负反馈”是结构和符号约定，不是无需检查的稳定性结论。

### 教学计算/推理例

取 $G(s)=2/(s+1)$、$H(s)=1$。单位阶跃参考的输出通道为 $Y/R=2/(s+3)$，稳态输出为 $2/3$；单位阶跃输出端扰动的通道为 $Y/D=1/(s+3)$，稳态影响为 $1/3$；单位阶跃测量噪声的通道为 $Y/N=-2/(s+3)$，稳态影响为 $-2/3$。三个结果的极点都在 $-3$，但稳态增益的差异正好来自不同注入位置。

### 适用条件与边界

公式假设线性定常、零初始条件、负反馈符号和所声明的扰动位置。传感器含动态、执行器饱和或内部存在未建模状态时，应保留对应环节并重新列信号方程。

### 自检

1. 为什么参考输入和输出端扰动的分子不同？
2. 画成减号的反馈结构是否必然稳定？

**核对要点**：两者进入环路的位置不同，前者经过 $G$ 而后者绕过 $G$；不必然稳定，必须检查闭环特征方程的根或频域稳定判据。

### 关联节点

- **复合控制系统**（关联）：多个输入或控制通道共同作用时仍需分别列式。
- **特征方程**（关联）：$1+GH=0$ 给出闭环极点条件。
- **串级控制系统**（关联）：多个反馈回路嵌套时，注入点和局部闭环需逐层分析。
