---
node_id: ctkg_domainconcept_4eaa0995db3f87d3b7e0f117
authority_entity_id: "ctkg:domainconcept:4eaa0995db3f87d3b7e0f117"
name: "参数不确定性"
name_en: "Parameter Uncertainty"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b81a249d49a5fa4b5bc21523a1ba7f9de6a11507245495f08d2a0e3b5385763b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b81a249d49a5fa4b5bc21523a1ba7f9de6a11507245495f08d2a0e3b5385763b.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/IMC_SIMC与模型匹配整定_4_42013.md"
asset_refs: []
---

## 首页

# 参数不确定性 | Parameter Uncertainty

**一句话定义**：对象传递函数参数未知、漂移或只在一个范围内可确定的状态。

**核心直觉**：设计依据是名义模型，但真实闭环必须对允许的参数变化保留余量。

**关键公式**：
$$
G(s,p)=G_0(s)(1+\Delta_p(s)),\qquad S_p^y=\frac{\partial\ln y}{\partial\ln p}
$$

**学习目标**：用灵敏度和参数范围估计输出变化，并把鲁棒性与名义性能分开报告。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

参数不确定性不等于随机噪声：它改变的是对象或控制器的模型参数。在线性小变化附近，闭环对对象增益的相对灵敏度常被 $S=1/(1+L)$ 压低；但时间常数、未建模极点和大范围变化可能同时改变相位与稳定裕度。

### 教学计算/推理例

若低频环路增益为 $L(0)=9$，对象直流增益发生 $10\%$ 小变化，近似闭环输出相对变化为 $|S|\times10\%=0.1\times10\%=1\%$。这是小扰动近似，不是任意大范围参数变化的精确结论。

### 适用条件与边界

需给出参数变化范围、工作点和模型结构；小信号灵敏度不能替代全范围仿真或稳定性证明。

### 自检

1. 当 $L(0)$ 从 $9$ 增到 $99$，低频灵敏度如何变化？
2. 参数不确定性与测量噪声是否是同一类输入？

**核对要点**：从 $0.1$ 降为约 $0.01$；不是，前者改变对象模型，后者是测量通道中的附加信号。

### 关联节点

- **对数灵敏度函数**（出边，关系：相关）
- **系统灵敏度**（出边，关系：相关）
- **灵敏度**（出边，关系：相关）
