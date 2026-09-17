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
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e5e5cf87ec5f6a944405e3d68421a5b960f689442a051c0332488514d30bd851.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e5e5cf87ec5f6a944405e3d68421a5b960f689442a051c0332488514d30bd851.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/扰动抑制中的通道重写边界_4_43006.md"
asset_refs: []
---

## 首页

# 扰动抑制 | Disturbance Rejection

**一句话定义**：反馈系统减小外部扰动对输出或跟踪误差影响的能力。

**核心直觉**：先看扰动从哪里进入，再用对应通道的灵敏度计算残差；抗扰和抗噪通常不是同一条通道。

**关键公式**：
$$
S(s)=\frac{1}{1+L(s)},\qquad L(s)=C(s)P(s)H(s)
$$

**学习目标**：区分输出端、对象输入端和测量端扰动，并解释提高低频环路增益的收益与代价。

---

## 详情

### 完整解释

扰动抑制不是一句“反馈会抵消扰动”，而是对一个指定输入到指定输出的通道作定量判断。设控制器为 $C(s)$、对象为 $P(s)$、测量通路为 $H(s)$，负反馈环路增益为
$$
L(s)=C(s)P(s)H(s),\qquad S(s)=\frac{1}{1+L(s)}.
$$
如果扰动 $D_o(s)$ 直接叠加在对象输出端，输出和误差通道分别为 $Y_D=S D_o$、$E_D=-H S D_o$；如果扰动 $D_u(s)$ 进入对象输入端，则对象会先把它变成输出，通道变为 $Y_D=P S D_u$、$E_D=-H P S D_u$。当测量反馈为单位反馈 $H=1$、噪声 $N(s)$ 在比较点进入时，输出通道为 $Y_N=-T N$，其中 $T=L/(1+L)$；非单位测量通路要保留 $H$ 后重新列式，不能拿输出端扰动的分子代替。

这形成一条可检查的因果链：注入点决定物理路径，物理路径与环路共同决定传递函数，传递函数在目标频段的幅值决定残余大小。对慢变化扰动，若低频 $|L|$ 很大，则 $|S|$ 很小，跟踪误差和输出端慢扰动通常被压低；但提高增益可能缩小相位裕度、增大控制量，并使高频测量噪声更容易通过。扰动抑制能力因此必须连同频段、稳定裕度和执行器限制报告。

### 教学计算/推理例

取 $P(s)=3/(s+1)$、$C(s)=3$、$H(s)=1$，则低频环路增益 $L(0)=9$，所以 $S(0)=1/10=0.1$。单位阶跃输出端扰动产生 $Y_D(\infty)=0.1$；单位阶跃对象输入扰动产生 $Y_D(\infty)=P(0)S(0)=3\times0.1=0.3$。若同样大小的单位阶跃噪声加在测量端，$T(0)=9/10=0.9$，输出通道的幅值为 $0.9$，它没有因为抗低频扰动变好而同步变小。

为检查非单位反馈，保持同一对象和控制器而取 $H=2$。此时 $L(0)=18$，单位对象输入扰动对应 $Y_D(\infty)=3/19$、$E_D(\infty)=-6/19$。误差是比较点的 $E=R-HY$，在 $R=0$ 时必须等于 $-2Y$，所以不能漏掉测量通路系数。

### 适用条件与边界

上述计算假设线性定常、负反馈、闭环稳定且注入点明确。扰动频率接近共振、执行器饱和或模型存在未建模动态时，低频灵敏度的近似不足以证明全频段抑制性能。

### 自检

1. 将低频环路增益从 $9$ 增至 $99$，灵敏度 $S(0)$ 如何变化？为什么？
2. 低频扰动抑制变好，是否说明所有高频测量噪声也变小？为什么？

**核对要点**：$S(0)$ 从 $1/10$ 降到 $1/100$，因为灵敏度是 $1/(1+L)$；不能，高频噪声受互补灵敏度、传感器和带宽共同影响。

### 关联节点

- **误差信号分析**（关联）：抗扰评价常以误差通道为目标。
- **测量噪声衰减**（关联）：测量噪声与对象扰动的传播通道不同。
- **测量噪声衰减分析**（关联）：用于比较噪声频段的幅值变化。
- **前馈扰动抑制**（关联）：已知扰动模型时可绕过部分反馈通道进行补偿。
- **调节与扰动抑制的系统类型**（关联）：系统型别影响低频跟踪和抗扰能力。
