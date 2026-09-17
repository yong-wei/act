---
node_id: ctkg_v3e-canonical-a781b2b377529226a4c5d077
authority_entity_id: "ctkg:v3e-canonical-a781b2b377529226a4c5d077"
name: "系统型别"
name_en: "System Type"
category: 概念性
knowledge_type: C
bloom_level: 应用
lesson_units:
  - "3-7"
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a79a05c060d0c6d232f8982baf45c616b03d383af0652d6ca3ede77d1fcf9fc2.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a79a05c060d0c6d232f8982baf45c616b03d383af0652d6ca3ede77d1fcf9fc2.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/系统型别_3_5573c2c3.md
  - course-content/authoring/lessons/3-7/design/3-7-handout.md
asset_refs: []
---

## 首页

# 系统型别 | System Type

**一句话定义**：按环路传递函数中未被消去的原点极点数，对系统进行分类。

**核心直觉**：型别反映低频积分能力；提高增益与增加积分环节不是同一件事。

**关键公式**：
$$
L(s)=\frac{K_0}{s^\nu}L_0(s),\qquad 0<|L_0(0)|<\infty
$$

**学习目标**：判定型别，并说明它何时能用于预测稳态跟踪误差。

---

## 详情

### 完整解释

#### 数的是原点极点，不是全部极点

$\nu=0,1,2$ 分别称为 0 型、I 型、II 型。型别与系统阶数不同：$L(s)=10/[s(s+2)]$ 是 I 型，但包含两个极点；把 $10$ 改为 $100$，型别仍为 I 型。

计算前应说明环路及误差信号的定义。以下规律用于稳定、标准单位负反馈系统的参考跟踪，不直接套用于任意非单位反馈或扰动通道。原点极零消去还可能掩盖内部模态，不能用约分替代内部稳定性检查。

#### 把型别与输入一起判断

在满足稳定性和终值条件时，典型单位输入的跟踪误差为：

| 型别 | 单位阶跃 | 单位斜坡 | $t^2/2$ 输入 |
|---|---|---|---|
| 0 型 | 通常为非零有限值 | 无有限稳态值 | 无有限稳态值 |
| I 型 | 0 | 通常为非零有限值 | 无有限稳态值 |
| II 型 | 0 | 0 | 通常为非零有限值 |

表中的有限值还取决于低频增益。型别决定误差类别，误差系数决定具体大小。

#### 同一模型的两种改变

取 $L(s)=10/[s(s+2)]$。其闭环特征多项式为 $s^2+2s+10$，极点实部为负。速度误差系数
$$
K_v=\lim_{s\to0}sL(s)=5.
$$
单位斜坡稳态误差为 $1/K_v=0.2$。将增益加倍，$K_v=10$，误差降为 $0.1$，但并未变为零。

若增加积分环节，则可能提高型别；同时闭环阶数、极点与相位都会变化，需要重新判稳。只有新系统稳定、相关终值存在时，才能应用更高型别的误差结论。

#### 图谱提供的全局视角

节点关联了“影响稳态误差的诸因素”：型别、开环增益、输入形式和幅值。因此不能脱离输入只说某型系统“没有误差”。积分与 PI 改变原点结构，滞后网络通常只调整有限的低频增益，这也是选择校正方法时的重要分界。

#### 自检

1. $L(s)=5/[(s+1)(s+2)]$ 是几型？
2. 为减少斜坡误差，应先判断增益是否足够，还是直接加积分？

**核对要点**：0 型；先明确误差目标、稳定性和动态约束，再判断是否需要改变型别。

### 关联节点

- **图谱关联**：等效系统型别、型别与阶跃稳态误差的陈述、稳态误差的影响因素。
- **学习延伸**：稳态误差、积分控制器、PI控制器与串联滞后校正。
