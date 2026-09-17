---
node_id: ctkg_v3e-canonical-b1b7acfdda35086ace2d7091
authority_entity_id: "ctkg:v3e-canonical-b1b7acfdda35086ace2d7091"
name: "不同极点部分分式展开法"
name_en: "Expansion at Distinct Poles"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-9984fc132ccbb70533bce65ffa2d0fe18757a76f2a625a2ee342e92df85b0c37.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-9984fc132ccbb70533bce65ffa2d0fe18757a76f2a625a2ee342e92df85b0c37.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01d/previous/ctkg_v3e-canonical-b1b7acfdda35086ace2d7091.md"
asset_refs: []
---

## 首页

# 不同极点部分分式展开法 | Expansion at Distinct Poles

**一句话定义**：对互异简单极点的真有理函数，逐极点求留数并重构其部分分式。

**核心直觉**：每个简单极点贡献一个基本指数模式，留数决定该模式的权重。

**关键公式**：
$$A_i=\lim_{s\to p_i}(s-p_i)F(s)=\frac{N(p_i)}{D'(p_i)}.$$

**学习目标**：判断简单极点条件，计算留数，并从完整响应变换识别各时域分量。

---

## 详情

### 完整解释

设 $F=N/D$ 已约去公因子且为真分式，分母根 $p_i$ 互不相同，则 $F=\sum_i A_i/(s-p_i)$。留数公式的第二种写法要求 $D'(p_i)\ne0$；重极点不满足这一条件，不能直接代入。若某个分母根被分子完全约去，它就不是约简后函数的极点，应先处理消去再谈模式。

对因果信号，每一项反变换为 $A_i e^{p_it}$。复系数项应按共轭对合并为实数正弦或余弦组合。极点相近时，单独的留数可能很大且相互抵消，数值计算需要足够精度；这不改变精确代数结论。留数的正负也不直接等于稳定或不稳定，稳定性主要由未消去的极点位置决定。

### 教学计算/推理例

归一化执行器对象为 $G(s)=2/[(s+1)(s+2)]$，零初态接单位阶跃。应展开的是
$$Y(s)=\frac{2}{s(s+1)(s+2)},$$
因为输入额外带来原点极点。三个极点为 $0,-1,-2$，对应留数由原式计算得1、$-2$、1，因此
$$y(t)=1-2e^{-t}+e^{-2t}=(1-e^{-t})^2.$$
在 $t=\ln2$ 时输出为 $1/4$，初值为零，终值为1。将表达式代入原微分方程 $\ddot y+3\dot y+2y=2$，其在 $t>0$ 满足方程，且 $y(0)=\dot y(0)=0$。原点极点来自阶跃输入，其常值响应分量不意味着对象 $G$ 存在积分器。

若只对 $G(s)$ 展开，会得到 $2/(s+1)-2/(s+2)$，反变换为 $2e^{-t}-2e^{-2t}$，这是对象的冲激响应，不是上述阶跃响应。先明确求什么输入下的响应，再选择要展开的完整变换，是比套公式更重要的一步。

### 常见误区与边界

1. **误区**：阶跃响应直接反变换 $G(s)$。**纠正**：零初态时必须先乘 $R(s)=1/s$。
2. **误区**：重极点也满足 $A_i=N(p_i)/D'(p_i)$。**纠正**：重根使分母导数为零，需用重极点展开公式。

### 自检

1. 若只对上例 $G$ 反变换，得到什么响应？
2. 留数 $-2$ 是否意味着系统不稳定？

**核对要点**：得到冲激响应；负留数只表明某模式的权重，不能据此判定稳定性。

### 关联节点

- **部分分式展开**（图谱关联）：涵盖重极点与非真分式等更一般情况。
- **用于拉普拉斯逆变换的 Heaviside 部分分式展开**（关联）：提供反变换的计算思路，需要保留所求完整响应的输入因子。
- **部分分式展开覆盖法**（关联）：简单极点下快速计算留数，仍应通分检查。
