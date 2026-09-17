---
node_id: ctkg_v3e-object-64dfc92ef15f84903e6cdd8a
authority_entity_id: "ctkg:v3e-object-64dfc92ef15f84903e6cdd8a"
name: "极点配置补偿器设计"
name_en: "Observer-Based Pole-Placement Compensator"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-45a0aa44db67766733b9273d5601d84941a5127846360290815a53223d81e042.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-45a0aa44db67766733b9273d5601d84941a5127846360290815a53223d81e042.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01h/previous/ctkg_v3e-object-64dfc92ef15f84903e6cdd8a.md"
asset_refs: []
---

## 首页

# 极点配置补偿器设计 | Observer-Based Pole-Placement Compensator

**一句话定义**：把状态反馈与状态观测器组合成可用测量输出实现的动态补偿器，并配置其内部闭环极点。

**核心直觉**：先用模型估计看不到的状态，再按状态反馈规律控制；估计动态也必须稳定。

**关键公式**：
$$u=-K\hat x+Nr.$$

**学习目标**：从反馈与观测器分别设计增益，构造动态补偿器，并核验分离原理的条件。

---

## 详情

### 完整解释

若无法直接测得全部状态，可对 $\dot x=Ax+Bu,y=Cx$ 使用观测器 $\dot{\hat x}=A\hat x+Bu+L(y-C\hat x)$。将控制律代入后，补偿器内部状态满足
$$\dot{\hat x}=(A-BK-LC)\hat x+Ly+BNr.$$
因此补偿器不是一个单纯的静态增益K，而是拥有内部状态、测量输入和参考输入的动态系统。应先检查可控性与可观测性；若仅需要稳定，相关条件可放宽为可稳定与可检测，但不意味着所有极点都能任意指定。

令估计误差 $e=x-\hat x$。准确线性模型下，$\dot e=(A-LC)e$，真实状态满足 $\dot x=(A-BK)x+BKe+BNr$。在坐标 $[x,e]$ 下矩阵为块上三角，内部闭环特征值是 $A-BK$ 与 $A-LC$ 的特征值并集。这是分离原理的依据；有饱和、模型误差或采样延迟时，不能无条件沿用这个结论。

### 教学计算/推理例

取双积分模型
$$A=\begin{bmatrix}0&1\\0&0\end{bmatrix},\ B=\begin{bmatrix}0\\1\end{bmatrix},\ C=\begin{bmatrix}1&0\end{bmatrix}.$$
其可控矩阵与可观矩阵均满秩。选 $K=[6,5]$ 配置反馈极点 $-2,-3$；再取 $L=[9,20]^\mathsf T$，使 $A-LC$ 的特征多项式为 $s^2+9s+20$，观测器误差极点为 $-4,-5$。因此组合系统的内部极点为 $-2,-3,-4,-5$，全部稳定。

实际补偿器自身矩阵为
$$A-BK-LC=\begin{bmatrix}-9&1\\-26&-5\end{bmatrix}.$$
它的特征多项式是 $s^2+14s+71$，并不是单独的观测器多项式。这说明“观测器误差极点”“补偿器自身极点”和“连接后的内部闭环极点”是不同对象。某个特定输入输出传递函数还可能不显现全部内部模式，不能只根据它的阶数否定分离原理。

### 常见误区与边界

1. **误区**：观测器极点越快越好。**纠正**：过快估计可能放大测量噪声并造成较大暂态控制量，需要结合带宽和执行器检查。
2. **误区**：只验证K对应的极点即可。**纠正**：估计误差动态也要稳定，且观测器必须使用实际施加的控制输入与正确模型。

### 自检

1. 本例组合后的内部闭环有哪四个极点？
2. 为什么不能把 $A-BK-LC$ 的极点直接称为观测器误差极点？

**核对要点**：$-2,-3,-4,-5$；估计误差由 $A-LC$ 决定，补偿器自身还含反馈增益项，二者不同。

### 关联节点

- **估计状态反馈下的对象方程**（组成关系）：图谱对应 $\dot x=Ax-BK\hat x$，本卡在此基础上说明观测器、参考输入及闭环误差动态。
