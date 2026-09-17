---
node_id: ctkg_v3e-object-7b59e975b2aaa6100b970b52
authority_entity_id: "ctkg:v3e-object-7b59e975b2aaa6100b970b52"
name: "描述函数法"
name_en: "Describing-Function Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4a8ce922e766ed9e236c6692e3fad853487239596cf85642ff7d8d7d779be7a0.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4a8ce922e766ed9e236c6692e3fad853487239596cf85642ff7d8d7d779be7a0.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-7b59e975b2aaa6100b970b52.md"
asset_refs: []
---

## 首页
# 描述函数法 | Describing-Function Method

一句话定义：描述函数法用非线性元件的基波等效响应结合线性频率响应，近似分析某些非线性反馈系统的周期运动。

- 先核验结构、正弦近似和高次谐波衰减条件。
- 谐波平衡交点给出候选振幅与频率。
- 真实存在性和稳定性需要进一步核验。

---
## 详情
### 完整解释

设反馈回路可分成线性部分 $G(s)$ 与一个具有可定义周期输出的非线性元件。若非线性输入近似为 $A\sin\omega t$，保留输出基波可用描述函数 $N(A)$ 表示。负反馈下的谐波平衡条件为 $1+G(j\omega)N(A)=0$。

常用分析步骤是：明确非线性输入输出位置；由傅里叶积分或有效公式求描述函数；在复平面寻找 $G(j\omega)$ 与 $-1/N(A)$ 的交点；核验参数范围和高次谐波；再结合完整模型研究候选周期运动及其稳定性。不能把最后一步省略后仍声称得到精确结论。

### 教学计算/推理例

非线性为无迟滞继电器，输出等级 $\pm1$，则 $N(A)=4/(\pi A)$。取 $G=1/[(s+1)(s+2)(s+3)]$。在 $\omega=\sqrt{11}$ 时 $G=-1/60$，所以谐波平衡给出 $N=60$，候选振幅 $A=1/(15\pi)\approx0.02122$。

把候选值代回可得 $G N=-1$，说明基波相位和幅值满足闭合关系。但继电器方波还含三次谐波，其幅值为 $4/(3\pi)$。在假设输入正弦的条件下，经过线性部分后的三次与一次谐波幅值比为

$$
\frac13\left|\frac{G(j3\omega)}{G(j\omega)}\right|.
$$

可以据此评估某个被忽略谐波的影响。即使这个比值较小，也只是支持近似的部分证据，尚未覆盖所有谐波、切换时刻和周期轨道稳定性。本例提供候选与核验方法，不宣称已求出完整非线性闭环的精确周期解。

### 适用条件与边界

方法主要适用于结构可分解、周期响应可描述、线性部分具有适当滤波作用的一类系统。强烈非正弦输入、多非线性耦合、偏置、非唯一稳态分支或复杂记忆行为可能使简单描述函数不足。动态非线性还可能需要依赖频率的 $N(A,\omega)$。

与局部线性化相比，描述函数考虑有限振幅下的基波投影，却仍是近似。它不能自动描述任意瞬态，也不能无条件排除混沌、多频振荡或其他非周期行为。若要用交点方向判断候选稳定性，应说明推断所依赖的幅值扰动和近似条件。

实际核验可用完整方程、切换事件分析或适当数值方法，并检查初态扰动、振幅与频率是否收敛。数值观察也应保留有限时间和误差限制，不能仅凭一段重复波形就宣布全局稳定。

### 常见误区

1. 把描述函数法称为对任意非线性系统都精确的方法。
2. 只解出 $1+GN=0$ 就宣布周期轨道及稳定性存在。
3. 看到线性部分低通，就不再检查候选频率处的谐波衰减。

### 自检

1. 本例 $A\approx0.02122$ 是精确振幅还是谐波平衡候选？
2. 验证 $GN=-1$ 后，为什么仍要检查高次谐波？

**核对要点**：是候选；方波不是正弦，高次谐波会改变反馈波形，基波闭合关系没有包含全部动态。

### 关联节点

- **极限环**（出边，关系：用于分析）
- **自激振荡**（出边，关系：用于分析）
- **描述函数**（出边，关系：包含组件）
