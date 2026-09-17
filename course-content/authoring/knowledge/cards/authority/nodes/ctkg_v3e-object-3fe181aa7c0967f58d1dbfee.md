---
node_id: ctkg_v3e-object-3fe181aa7c0967f58d1dbfee
authority_entity_id: "ctkg:v3e-object-3fe181aa7c0967f58d1dbfee"
name: "比例控制规律"
name_en: "Proportional Control Law"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1ea4f1d17c82bfe86cd4c827494196b6b786081fb6b0a15e1ed001ba5dee696d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1ea4f1d17c82bfe86cd4c827494196b6b786081fb6b0a15e1ed001ba5dee696d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01g/previous/ctkg_v3e-object-3fe181aa7c0967f58d1dbfee.md"
asset_refs: []
---

## 首页

# 比例控制规律 | Proportional Control Law

**一句话定义**：比例控制器把误差按正实增益 $K$ 直接放大，增益改变而相位不被重新塑形。

**核心直觉**：增大 $K$ 会让本例闭环极点左移、稳态误差变小，但控制动作和测量噪声通道也按比例变大。

**关键公式**：
$$
u(t)=K e(t),\qquad C(s)=K,\qquad K>0.
$$

**学习目标**：由负反馈方程判断比例增益对极点、稳态误差、时间常数和初始控制量的影响。

---

## 详情

### 完整解释

比例控制规律把误差信号 $e(t)=r(t)-y_m(t)$ 乘以一个常数，得到控制信号 $u(t)=K e(t)$。它是可调增益放大器：当 $K$ 为正实数时，频域中 $C(j\omega)=K$ 的相位为 $0$，因此它只改变幅值，不改变相位。这个判断依赖正增益；负增益会引入 $180^\circ$ 的相位变化，不能把“不改相位”当成无条件结论。

教学例取理想线性对象 $G(s)=1/(s+1)$、单位负反馈、零初态和单位阶跃参考。闭环方程为
$$
\Phi(s)=\frac{Y(s)}{R(s)}=\frac{K}{s+1+K},
$$
所以闭环极点为 $-(1+K)$，单位阶跃稳态误差为 $1/(1+K)$，时间常数为 $1/(1+K)$，且零初态下初始控制量为 $u(0^+)=K$。这组关系显示比例增益同时影响准确性和速度，不能只看其中一项。

### 教学计算/推理例

同一对象下取模型已验算的两个正增益。$K=1$ 时闭环极点为 $-2$，阶跃误差为 $0.5$，时间常数为 $0.5$，初始控制量为 $1$。$K=4$ 时极点为 $-5$，阶跃误差为 $0.2$，时间常数为 $0.2$，初始控制量为 $4$。因此本例中增益从 $1$ 增到 $4$，误差和时间常数都减小，但控制峰值约束仍须单独检查。

### 适用条件与边界

上述推导针对理想线性定常模型、零初态、单位负反馈和单位阶跃。若反馈符号、对象模型、初始状态或输入改变，闭环方程必须重算。频率响应中的 $\omega$ 采用 $\mathrm{rad/s}$；比例环节本身不提供相位补偿。测量噪声经比例通道进入控制器时也被放大，增益选择还要受执行器和噪声限制。

### 常见误区

1. **误区**：比例增益越大就一定让所有性能都更好。**纠正**：本例的速度和阶跃误差改善来自特定模型；控制量、噪声敏感性、饱和和其他动态必须另行验证。
2. **误区**：任何比例系数都不改变相位。**纠正**：这里的结论限定为正实增益；负增益的相位作用不同，甚至可能改变反馈稳定性。

### 自检

1. 在 $G(s)=1/(s+1)$ 的单位负反馈中，为什么 $K=4$ 的闭环极点比 $K=1$ 更靠左？
2. 为什么比例控制器不能把本例的阶跃稳态误差直接变为零？

**核对要点**：闭环极点为 $-(1+K)$；有限正 $K$ 的误差是 $1/(1+K)$，只有在极限意义上才趋近零。

### 关联节点

- **P控制器**（无向，关系：相关）
- **比例系数**（出边，关系：包含组件）
