---
node_id: ctkg_v3e-canonical-01549ef9b34888b89b55f224
authority_entity_id: "ctkg:v3e-canonical-01549ef9b34888b89b55f224"
name: "终值定理法求稳态误差"
name_en: "Steady-State Error by Final-Value Theorem"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f3a93a1438a5173a96c87d6011eceb8b339fd1db2f9cb1e01b829d6cb9009d01.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f3a93a1438a5173a96c87d6011eceb8b339fd1db2f9cb1e01b829d6cb9009d01.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-01549ef9b34888b89b55f224.md"
asset_refs: []
---

## 首页

# 终值定理法求稳态误差 | Steady-State Error by Final-Value Theorem

**一句话定义**：在终值定理适用时，用 sE(s) 的极限直接求稳态误差。

**核心直觉**：先验证误差信号的稳定条件，再取极限；取极限本身不是稳定性证明。

**关键公式**：
$$
e_ss = lim(t→∞) e(t) = lim(s→0) sE(s)
$$

**学习目标**：写出误差传递函数并验证 sE(s) 的极点，再计算稳态误差。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

该方法把时域的“最后剩多少”转成复频域极限。参考输入、扰动和测量噪声的误差通道不同，必须先选对 E(s)。如果 sE(s) 有右半平面或虚轴极点，响应可能不收敛，不能套用终值公式。

### 教学计算/推理例

单位反馈取 G(s)=5/(s+1)、R(s)=1/s，则 E(s)=(s+1)/[s(s+6)]。因此 e_ss=lim(s→0)sE(s)=1/6≈0.1667；闭环极点 −6，条件满足。

### 适用条件与边界

假设线性定常、零初始条件、闭环稳定且极限存在。对持续振荡、发散或多通道扰动，需先改写相应 E(s)。

### 自检

1. 为什么要先看 sE(s) 的极点？
2. G(s)=5/(s+1) 的单位阶跃稳态误差是多少？

**核对要点**：因为终值定理要求相应信号收敛；误差为 1/6。

### 关联节点

- **稳态误差 e(∞)**（入边，关系：相关）
- **静态误差系数法求稳态误差**（入边，关系：相关）
- **当N(s)=n1/s^2时，essn(∞)=-n1Ti/K1。**（入边，关系：由此得到）
- **当N(s)=n0/s时，essn(∞)=0。**（入边，关系：由此得到）
