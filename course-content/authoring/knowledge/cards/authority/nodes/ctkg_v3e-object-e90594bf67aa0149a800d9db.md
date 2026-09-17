---
node_id: ctkg_v3e-object-e90594bf67aa0149a800d9db
authority_entity_id: "ctkg:v3e-object-e90594bf67aa0149a800d9db"
name: "负倒描述函数"
name_en: "Negative Inverse Describing Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-6d800586aa10e18ffc07a21c88e4aa0917ef4ad9d4315c5287ca5a68c4425750.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-6d800586aa10e18ffc07a21c88e4aa0917ef4ad9d4315c5287ca5a68c4425750.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-e90594bf67aa0149a800d9db.md"
asset_refs: []
---

## 首页
# 负倒描述函数 | Negative Inverse Describing Function

一句话定义：负倒描述函数是 $-1/N(A)$，用于与线性部分频率响应 $G(j\omega)$ 比较，寻找谐波平衡候选交点。

- 它是描述函数的代数变换，不是新增物理元件。
- 非线性曲线以振幅为参数，线性曲线以频率为参数。
- 交点是近似候选，不能直接当作精确稳定周期解。

---
## 详情
### 完整解释

在规定的负反馈结构中，假设非线性输入近似为单一正弦，并用其基波描述函数代替非线性元件，可写出 $1+G(j\omega)N(A)=0$。当 $N(A)\ne0$ 时，等价于

$$
G(j\omega)=-\frac1{N(A)}.
$$

因此可以在同一复平面画两条参数曲线，寻找对应某个振幅和频率的交点。图上坐标相同，并不意味着两条曲线使用相同参数。读取结果时应分别标出 $A$ 和 $\omega$，并检查它们是否位于描述函数适用范围。

### 教学计算/推理例

无迟滞继电器的 $N(A)=4M/(\pi A)$ 为正实数，因此 $-1/N(A)=-\pi A/(4M)$ 沿负实轴变化。取 $M=1,A=2$，坐标为 $-\pi/2\approx-1.5708$，不是 $-2/\pi$；后者混淆了倒数。

设线性部分 $G(s)=1/[(s+1)(s+2)(s+3)]$。在 $\omega=\sqrt{11}$ rad/s处，$G(j\omega)=-1/60$。令其等于 $-\pi A/4$，得到候选输入振幅

$$
A=\frac1{15\pi}\approx0.02122,\qquad \omega\approx3.31662\ \mathrm{rad/s}.
$$

此时 $N=60$，代回 $1+GN$ 得0，验证了代数谐波平衡关系。$A$ 指继电器输入的正弦近似振幅，继电器输出等级仍是 $\pm1$，不能把两个位置的振幅混同。

### 适用条件与边界

该交点只属于基波近似。真实继电输出含有高次谐波，反馈波形可能偏离正弦；存在交点不自动保证真实周期轨道存在，也不直接给出其稳定性。没有交点也不能在所有非线性系统中无条件排除其他复杂运动。

若 $N=0$，负倒数不存在有限值；若描述函数还依赖频率，曲线构造和参数匹配也需相应扩展。反馈符号改变时，特征关系的符号应重新推导，不能保留本卡负反馈公式而仅改变图上的箭头。

有些教材进一步使用交点附近的方向分析估计振幅稳定性，这也依赖谐波近似及相应假设。最终结论应说明证据层级，避免将图解方法升级成未经证明的全局稳定定理。

### 常见误区

1. 将 $-1/N$ 算成 $-N$，导致曲线位置错误。
2. 把 $A$ 当成线性频率曲线的参数，漏记交点频率。
3. 将继电输入振幅候选误写为继电输出等级，或直接宣布精确周期解。

### 自检

1. 当 $M=1,A=2$ 时负倒描述函数是多少？
2. 上述候选 $A\approx0.02122$ 是否说明继电器输出幅值也为0.02122？

**核对要点**：为 $-\pi/2$；不是，候选是继电输入的基波近似振幅，输出等级仍为 $\pm1$。

### 关联节点

- **描述函数**（出边，关系：推导自）
