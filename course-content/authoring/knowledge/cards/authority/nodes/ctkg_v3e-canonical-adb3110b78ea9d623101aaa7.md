---
node_id: ctkg_v3e-canonical-adb3110b78ea9d623101aaa7
authority_entity_id: "ctkg:v3e-canonical-adb3110b78ea9d623101aaa7"
name: "部分分式展开"
name_en: "Partial Fraction Expansion"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d397d7d7225cf3fa1a9433d138e9e67a8713225d1bc7a0b010c1271727e0c04c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d397d7d7225cf3fa1a9433d138e9e67a8713225d1bc7a0b010c1271727e0c04c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01d/previous/ctkg_v3e-canonical-adb3110b78ea9d623101aaa7.md"
asset_refs: []
---

## 首页

# 部分分式展开 | Partial Fraction Expansion

**一句话定义**：把有理函数分解为多项式与简单分母项之和，以便代数计算和拉普拉斯反变换。

**核心直觉**：复杂响应可以拆成指数、指数乘多项式等可识别的基本模式。

**关键公式**：
$$F(s)=Q(s)+\sum_i\sum_{k=1}^{m_i}\frac{A_{ik}}{(s-p_i)^k}.$$

**学习目标**：先判断真分式与极点重数，再选择合适的展开形式并通分核验。

---

## 详情

### 完整解释

先约去真正的公因子，再比较分子分母次数。若分子次数不低于分母，先进行多项式除法，得到商 $Q(s)$ 和真分式余项。随后将分母因式分解；一个 $m$ 重极点必须保留从 $(s-p)^{-1}$ 到 $(s-p)^{-m}$ 的全部可能项，不能只写最高次项，也不能把重极点当成多个互异极点。

对于实系数函数，复极点成共轭对，复留数也成共轭对，可以合并成实系数二次分母项，最终时域信号仍可为实数。因果反变换中，$(s-p)^{-k}$ 对应 $t^{k-1}e^{pt}/(k-1)!$，所以重复极点会引入时间多项式。代数分解本身不规定信号的收敛域；进行双边反变换还必须知道因果性或收敛域。

### 教学计算/推理例

某归一化执行器响应的变换为
$$F(s)=\frac{s+3}{(s+1)^2}.$$
因为极点 $-1$ 重复两次，设 $F=A/(s+1)+B/(s+1)^2$。通分后比较分子得 $s+3=A(s+1)+B$，所以 $A=1$、$B=2$。因果反变换是
$$f(t)=(1+2t)e^{-t},\quad t\ge0.$$
这既能展示指数衰减，也展示重极点带来的 $t$ 因子。在 $t=1$ 时为 $3/e\approx1.1036$；初始值为1，长期为零。虽然极点全在左半平面，响应不一定单调，因为导数为 $(1-2t)e^{-t}$，初始先增大，$t=0.5$ 后才下降。

另看非真分式 $(s^2+2s+3)/(s+1)$，先相除得到 $s+1+2/(s+1)$。其中多项式部分在广义函数反变换中涉及冲激及其导数，不能把它当作普通指数响应随意丢掉。实际系统求阶跃响应时应先写完整 $Y(s)=G(s)R(s)$，再判断其分式性质。

### 常见误区与边界

1. **误区**：所有极点都用简单覆盖法即可。**纠正**：简单极点留数公式不足以给出重极点的全部系数，需比较系数或求导。
2. **误区**：展开式看起来合理就算完成。**纠正**：必须通分还原原函数，必要时用初值、终值或原方程检验时域结果。

### 自检

1. $1/(s+2)^3$ 的因果反变换是什么？
2. 上例 $(1+2t)e^{-t}$ 是否从初始时刻就单调下降？

**核对要点**：第一问为 $t^2e^{-2t}/2$；第二问不是，导数在 $0<t<0.5$ 为正。

### 关联节点

- **不同极点部分分式展开法**（图谱关联）：只处理简单极点，是本卡一般展开结构的一个特例。
- **有理分式拉普拉斯变换**（关联）：提供可分解的代数对象，须先判断是否为真分式。
- **部分分式拉普拉斯反变换法**（关联）：将代数分解进一步转换成时域响应，并核对收敛域或因果约定。
