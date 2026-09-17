---
node_id: ctc_modeling-352b9bfe27ba1ab6b9c9672e
authority_entity_id: "ctc:modeling-352b9bfe27ba1ab6b9c9672e"
name: "传感器执行器同位配置"
name_en: "Collocated Sensing and Actuation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4258b4f45686e5d1a54bd28d02b2f8c4f353e710abbbbe15bb729d0bf0a52aa5.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4258b4f45686e5d1a54bd28d02b2f8c4f353e710abbbbe15bb729d0bf0a52aa5.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-04a/previous/ctc_modeling-352b9bfe27ba1ab6b9c9672e.md"
asset_refs: []
---

## 首页

# 传感器执行器同位配置 | Collocated Sensing and Actuation

**一句话定义**：同位配置把传感器与执行器刚性地安装在同一位置，使测量与作用对应同一机械点。

**核心直觉**：在施力的位置测速度，可以直接判断控制力是在给系统加能量还是耗散能量。

**关键公式**：本例 $u=-2\dot q$，控制功率为 $u\dot q=-2\dot q^2$。

**学习目标**：解释同位力—速度反馈的能量意义，并辨别其稳定性结论所需的控制器与模型条件。

---

## 详情

### 完整解释

同位描述安装和作用位置的关系，不表示传感器与执行器测量或产生同一种物理量。力执行器对物体施加力，速度传感器测量该点的速度，二者单位不同，却能通过功率乘积联系起来。若力与速度的正方向选择一致，乘积为正表示控制输入向系统注入能量，为负表示控制输入从系统取走能量。

这种关系能帮助设计阻尼反馈。测到速度后施加反方向的力，相当于增加阻尼。但此判断依赖测量速度确实对应施力点，并且控制力能够及时、按给定关系产生。仅说“传感器和执行器在一起”不能保证任何控制算法都稳定；信号处理、延迟和符号错误仍可能改变反馈效果。

### 教学计算/推理例

考虑单质量的归一化模型
$$
\ddot q+\dot q+2q=u.
$$
同一点测量速度 $\dot q$，采用理想静态反馈 $u=-2\dot q$，闭环为
$$
\ddot q+3\dot q+2q=0.
$$
闭环特征式 $s^2+3s+2=(s+1)(s+2)$，极点为 $-1,-2$，说明这个模型的自由响应衰减。这个结论来自具体方程和反馈，并非仅由安装位置推断。

取归一化机械能
$$
E=\frac12\dot q^2+q^2,
\qquad \dot E=\dot q(\ddot q+2q)=-3\dot q^2.
$$
原阻尼贡献 $-\dot q^2$，反馈额外贡献 $-2\dot q^2$，所以没有外部输入时能量不增加。能量导数在速度为零时也为零，但若位移非零，弹簧力会再次产生运动；本例唯一能一直保持静止的状态是原点。这与两个负极点的结论一致。

### 适用条件与边界

这里没有测量延迟、执行器饱和、柔性安装和附加未建模动态。若控制力根据过去的速度生成，当前功率便不能继续直接写成 $-2\dot q^2$。若测量的是不同位置的速度，也要重新建立作用点速度与测量信号的关系。位移反馈、速度反馈和其他控制器各有条件，不能互相替换后沿用本例能量结论。

### 常见误区

1. **误区**：同位等于单位反馈。**纠正**：位置关系不能消除传感器标定、单位和动态差异。
2. **误区**：同位配置天然保证所有闭环稳定。**纠正**：本例保证只针对理想静态负速度反馈和给定对象。

### 自检

1. 本例控制力为何总是在耗散而不是注入能量？
2. 引入测量延迟后，原能量推导中哪一步需要重新检查？

**核对要点**：当前力与当前速度乘积为非正值；有延迟时力不再等于当前速度的固定负倍数，不能直接保留平方项结论。

### 关联节点

本卡的核心结论可由上述状态方程与能量关系独立复核。
