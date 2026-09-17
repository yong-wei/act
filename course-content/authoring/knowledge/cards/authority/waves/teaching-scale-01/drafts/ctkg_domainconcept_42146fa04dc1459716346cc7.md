---
node_id: ctkg_domainconcept_42146fa04dc1459716346cc7
authority_entity_id: "ctkg:domainconcept:42146fa04dc1459716346cc7"
name: "扰动抑制"
name_en: "Disturbance Rejection"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e5e5cf87ec5f6a944405e3d68421a5b960f689442a051c0332488514d30bd851.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e5e5cf87ec5f6a944405e3d68421a5b960f689442a051c0332488514d30bd851.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/扰动抑制中的通道重写边界_4_43006.md"
asset_refs: []
---

## 首页

# 扰动抑制 | Disturbance Rejection

**一句话定义**：反馈系统减小扰动对跟踪误差或输出影响的能力。

**核心直觉**：低频环路增益越大，灵敏度越小，慢扰动越容易被压住；噪声通道可能相反。

**关键公式**：
$$
S(s)=\frac{1}{1+L(s)},\qquad E_D(s)=S(s)D(s)
$$

**学习目标**：先指出扰动入口，再用对应传递函数计算残余误差，不把抗扰与抗噪混为一谈。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

若扰动直接叠加在误差或输出通道，灵敏度函数常直接给出误差衰减；若扰动加在对象输入，则还要乘对象到误差的通道。提高低频 $L$ 往往改善慢扰动抑制，却可能牺牲相位裕度、控制量或高频噪声表现。

### 教学计算/推理例

在低频近似 $L(0)=9$、单位阶跃扰动直接进入误差通道时，$S(0)=1/10$，稳态误差幅值为 $0.1$。若同一扰动改从对象输入进入，必须重新写 $Y_D=G S D$，不能继续直接使用 $0.1$。

### 适用条件与边界

必须声明扰动注入点、反馈结构和稳态存在条件。测量噪声经互补灵敏度或测量通道传播，不能用同一个分子代替。

### 自检

1. 增大低频环路增益通常怎样影响慢扰动残差？
2. 扰动抑制变好是否意味着所有高频噪声也变小？

**核对要点**：通常减小；不意味着，高频噪声还取决于互补灵敏度、传感器和带宽。

### 关联节点

- **误差信号分析**（入边，关系：相关）
- **调节与扰动抑制的系统类型**（入边，关系：相关）
- **测量噪声衰减**（入边，关系：相关）
- **测量噪声衰减分析**（入边，关系：相关）
- **前馈扰动抑制**（入边，关系：相关）
