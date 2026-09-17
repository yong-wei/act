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
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1680cea2ea4bcab0d3da83cdbda1b84906ee1da30d2f1e6954d37c1084311fed.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1680cea2ea4bcab0d3da83cdbda1b84906ee1da30d2f1e6954d37c1084311fed.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/反馈控制系统_1_98dc667a.md"
asset_refs: []
---

## 首页

# 反馈控制系统 | Feedback Control System

**一句话定义**：具有参考输入、扰动和测量噪声通道，并利用输出反馈形成闭环的控制系统。

**核心直觉**：同一公共分母控制闭环动态，不同输入通道由不同分子表达其影响。

**关键公式**：
$$
E=R-HY-N,\qquad Y=GE+D
$$

**学习目标**：从信号方程分别推导参考、扰动和噪声到输出的传递关系。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

反馈控制系统必须先固定求和点符号和扰动入口，再写方程。对于负反馈、单位反馈且扰动加在对象输入端，$Y/R=G/(1+GH)$、$Y/D=1/(1+GH)$；测量噪声通道通常带有 $-G/(1+GH)$。不能把一个通道的分子套到另一个通道。

### 教学计算/推理例

取 $G(s)=2/(s+1)$、$H=1$。参考单位阶跃的终值为 $2/(1+2)=2/3$；若单位阶跃扰动在对象输入端加入，扰动到输出的直流增益为 $1/(1+2)=1/3$。两者公共闭环极点均为 $-3$。

### 适用条件与边界

需要明确负反馈、线性定常、零初始条件和扰动/噪声的注入位置。若反馈符号、传感器动态或注入点变化，分母或分子都可能改变。

### 自检

1. 为什么参考和对象入口扰动的分子不同？
2. 有负号的反馈结构是否必然稳定？

**核对要点**：它们进入系统的通道不同；不一定，稳定性要检查闭环特征根或频域判据。

### 关联节点

- **复合控制系统**（出边，关系：相关）
- **特征方程**（出边，关系：相关）
- **串级控制系统**（出边，关系：相关）
