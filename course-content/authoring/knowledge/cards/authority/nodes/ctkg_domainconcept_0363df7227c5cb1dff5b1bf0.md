---
node_id: ctkg_domainconcept_0363df7227c5cb1dff5b1bf0
authority_entity_id: "ctkg:domainconcept:0363df7227c5cb1dff5b1bf0"
name: "前馈跟踪"
name_en: "Feedforward Tracking"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-cabddeb61c4c1ebd9b0db209db183f2f9647e7ef7f25daecdb0c40ec45c5145e.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-cabddeb61c4c1ebd9b0db209db183f2f9647e7ef7f25daecdb0c40ec45c5145e.json"
asset_refs: []
---

## 首页

# 前馈跟踪 | Feedforward Tracking

**一句话定义**：参考前馈利用已知模型把参考信号直接送到控制输入，可在名义条件下补足常值跟踪所需的控制量。

逆直流增益补偿针对稳态比例，不等于对全部动态作精确求逆。

---

## 详情

### 完整解释

反馈根据当前误差修正控制量，参考前馈则从已知参考生成额外输入。两者作用来源不同：前馈不需要等待该部分误差形成，但依赖对象模型与参考信息。使用前馈时仍应检查反馈闭环和新通道本身的实现条件。

本卡把前馈直接加在控制输入：$u=K(r-y)+F_rr$。它不同于在误差比较点前把参考乘一个预滤系数。位置不同，所需系数和传递函数也不同，不能将两种结构都简称“输入乘一个数”后混用。

若对象具有已知、有限且非零的直流增益，静态前馈可用该增益的倒数形成常值补偿。这个条件不适用于所有对象；即使直流补偿准确，也不能自动消除过渡过程误差或模型失配造成的偏差。

### 教学计算/推理例

取对象 $P(s)=2/(s+1)$，负单位反馈增益 $K=1$，并选择 $F_r=1/P(0)=0.5$。由连接关系得到

$$T_r(s)=\frac{P(K+F_r)}{1+PK}=\frac3{s+3}.$$

零初态单位阶跃下，输出为 $1-e^{-3t}$，最终趋于1。若没有前馈，参考函数为 $2/(s+3)$，终值仅为2/3。静态前馈补足了这个名义模型的常值跟踪比例，但输出并没有在阶跃发生时立即等于参考。

若真实对象增益变为3，而仍使用按2计算的前馈0.5，则参考函数为 $4.5/(s+4)$，单位阶跃终值为1.125。闭环仍稳定，却出现名义补偿误差。这说明模型依赖不能被“前馈能消除误差”的简短表述省略。

### 适用条件与边界

这里采用稳定一阶模型和常值参考的稳态目标。换成斜坡或其他时变参考，应按完整动态分析；一个正确的直流比例不能代替所有频率上的逆模型。对象有时延、非最小相位零点或相对阶次限制时，完整求逆还可能不可实现。

前馈系数需要与参考和控制量的单位一致。若模型标定或信号尺度变化，应重新换算，不能只保留旧数字。前馈也不能代替对未知扰动和模型偏差的反馈修正，二者的作用应共同评价。

独立、稳定且适当的前馈通道通常不改变原反馈环的特征方程，但若新增前馈自身包含不稳定动态，完整内部系统仍可能有问题。因此，“不改变反馈特征式”不能被解释成任意前馈都无稳定风险。

### 常见误区

1. 误区：逆直流增益前馈能让输出在所有时刻精确等于参考。纠正：它只补偿名义稳态比例，本例仍有指数过渡过程。
2. 误区：对象增益变了，前馈精确跟踪结论仍保持。纠正：本例增益从2变为3后终值变成1.125。

### 自检

1. 本例前馈0.5为什么能把名义阶跃终值从2/3改为1？
2. 为什么要说明前馈加在控制输入，而不是只说“参考乘系数”？

**核对要点**：它补足对象直流增益所需的额外输入，具体关系为 $P(K+F_r)/(1+PK)$。如果位置变成参考预滤，传递关系与系数要求也会改变。

### 关联节点

- **跟踪误差**（无向，关系：相关）
- **零稳态误差**（无向，关系：相关）
- **系统静态直流增益**（无向，关系：相关）
