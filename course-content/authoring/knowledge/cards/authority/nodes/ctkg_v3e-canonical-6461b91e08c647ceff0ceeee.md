---
node_id: ctkg_v3e-canonical-6461b91e08c647ceff0ceeee
authority_entity_id: "ctkg:v3e-canonical-6461b91e08c647ceff0ceeee"
name: "速度误差系数 (K_v)"
name_en: "Velocity Error Constant"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-3a322e7c50af009e1d0605f73f3261be527781f491f2317b0ea17b76567232ac.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-3a322e7c50af009e1d0605f73f3261be527781f491f2317b0ea17b76567232ac.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-6461b91e08c647ceff0ceeee.md"
asset_refs: []
---

## 首页

# 速度误差系数 ($K_v$) | Velocity Error Constant

**一句话定义**：$K_v$ 是环路开环传递函数的低频极限 $\lim_{s\to0}sL(s)$，用于单位斜坡的静态误差。

**核心直觉**：它衡量环路跟随恒定速度目标的低频能力，越大时理想斜坡静差越小。

**关键公式**：
$$
K_v=\lim_{s\to0}sL(s),\qquad e_{m,ss}=\frac1{K_v}
$$

**学习目标**：从完整环路求 $K_v$，检查闭环与终值条件，并区分它和控制器增益。

**关联**：斜坡输入稳态误差 · 特鲁克萨尔公式 · $K_{v}=\lim_{s\to0}sG_c(s)G(s)$

---

## 详情

### 完整解释

速度误差系数是开环环路在低频处乘以一个 $s$ 后的极限。单位负反馈时 $L=C G$；一般测量通路时，比较器误差对应的环路是 $L=C G H$。$K_v$ 不是速度控制器的增益，也不是某个名为“速度”的参数；它把对象、控制器和反馈通路的低频行为合并为一个数。

对零初始参考输入，
$$
Y=CGE_m,\qquad E_m=R-HY,\qquad \frac{E_m}{R}=\frac{1}{1+L}.
$$
单位斜坡 $R=1/s^2$ 时，若闭环稳定且 $sE_m(s)$ 的约简后极点位于左半平面，
$$
e_{m,ss}=\lim_{s\to0}sE_m(s)=\lim_{s\to0}\frac{1}{s[1+L(s)]}=\frac1{K_v}.
$$
这要求 $K_v$ 为适合该输入的非零有限极限。$K_v=0$ 通常表示斜坡误差发散，$K_v=\infty$ 表示理想模型中的零比较器误差，二者都不能绕过极点和物理约束检查。

在非单位 $H$ 下，$1/K_v$ 对应 $E_m=R-HY$，不一定是物理跟踪误差 $E_t=R-Y$。例如若 $H(0)=2$ 且环路型别为一，低频高增益会使 $Y/R\to1/2$；参考斜坡持续增长时，$E_t$ 会含有约 $r/2$ 的增长项，不能报告一个有限的 $1/K_v$ 作为输出跟踪误差。

### 教学计算/推理例

取单位负反馈、零初态、比例控制器 $C(s)=4$ 和对象 $G(s)=5/[s(s+1)]$。环路为 $L(s)=20/[s(s+1)]$，闭环特征多项式为 $s^2+s+20$，极点实部为 $-1/2$，所以稳定。单位斜坡误差的频域表达为
$$
E_m(s)=\frac{1/s^2}{1+20/[s(s+1)]}=\frac{s+1}{s(s^2+s+20)},\qquad sE_m(s)=\frac{s+1}{s^2+s+20}.
$$
约简后的两个极点在左半平面，且
$$
K_v=\lim_{s\to0}\frac{20}{s+1}=20,\qquad e_{m,ss}=\frac1{20}=0.05.
$$
尽管控制器增益是 $4$，$K_v$ 却是 $20$；对象的低频增益和积分器同样参与了系数。

若只把测量通路改成 $H(s)=2$，则 $K_v=40$ 描述的是测量误差；参考斜坡的实际输出低频比例趋向 $1/H(0)=1/2$，所以 $R-Y$ 随斜坡继续增长，不能把 $1/40$ 当成物理跟踪误差。这是选择误差对象的边界，不是算术例外。

### 适用条件与边界

本卡默认连续时间、线性定常、零初始、负反馈和闭环稳定。输入斜率为 $a$ 时，单位反馈下有限斜坡误差按 $a/K_v$ 缩放。测速反馈、非单位测量、扰动注入或饱和会改变误差通道；应从原始信号方程重算，不能只复制单位反馈结论。

### 常见误区

1. **误区**：$K_v$ 就是速度控制器的增益，或只由控制器参数决定。**纠正**：$K_v=\lim sL(s)$，它是整个开环环路的低频极限。
2. **误区**：$K_v$ 算得越大就必然稳定、超调更小且物理跟踪误差为零。**纠正**：$K_v$只说明选定误差通道的斜坡静差；稳定性、动态指标和 $H\ne1$ 时的 $R-Y$ 必须分别检查。

### 自检

1. $C(s)=4$、$G(s)=5/[s(s+1)]$、单位反馈时，$K_v$ 和单位斜坡误差是多少？
2. 为什么把 $H$ 改为 $2$ 后，$1/K_v$ 不能直接报告为物理跟踪误差？

**核对要点**：$K_v=20$，单位斜坡测量误差为 $0.05$；$H=2$ 时 $K_v$对应 $r-2y$，而物理误差是 $r-y$，参考斜坡下后者并不收敛为该有限常数。

### 关联节点

- **斜坡输入稳态误差**（无序关联）：$K_v$ 的直接应用对象。
- **特鲁克萨尔公式**（无序关联）：图谱中的相关公式关联。
- **$K_{v}=\lim _{s \rightarrow 0} s G_{c}(s) G(s)$**（公式关联）：单位反馈语境下的低频定义。
- **对于带有测速发电机反馈的电动机位置控制系统（G(s)=1/(s(τs+1))，D_c(s)=k_P，H(s)=1+k_t s），系统为 1 型系统，速度误差常数为 K_v = k_P/(1+k_t k_P)。利用测速发电机反馈改善动态响应通常会增大稳态误差。**（应用关联）：说明反馈通路会改变速度误差系数。
- **对于采用比例加积分控制 (D_c = k_P + k_I/s) 且被控对象为 G = A/(τs+1) 的速度控制示例，回路传递函数为 G D_cl(s) = A(k_P s + k_I) / (s(τs+1))。该系统为 1 型系统，速度常数为 K_v = A k_I。**（应用关联）：说明对象和积分参数共同决定系数。
