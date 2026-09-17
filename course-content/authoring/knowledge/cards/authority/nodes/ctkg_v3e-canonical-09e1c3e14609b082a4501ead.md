---
node_id: ctkg_v3e-canonical-09e1c3e14609b082a4501ead
authority_entity_id: "ctkg:v3e-canonical-09e1c3e14609b082a4501ead"
name: "静态误差系数法求稳态误差"
name_en: "Static Error Coefficient Method"
category: 程序性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a2feb663fd251f889389f4ce65929302641a91d8fd9dd3dd1741454f8b658d4f.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a2feb663fd251f889389f4ce65929302641a91d8fd9dd3dd1741454f8b658d4f.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-09e1c3e14609b082a4501ead.md"
asset_refs: []
---

## 首页

# 静态误差系数法求稳态误差 | Static Error Coefficient Method

**一句话定义**：在闭环稳定、输入形式明确时，用环路低频极限对应的误差系数计算稳态误差。

**核心直觉**：输入越像低频多项式，越需要环路中更多的积分能力来跟上它。

**关键公式**：
$$
K_p=\lim_{s\to0}L(s),\quad K_v=\lim_{s\to0}sL(s),\quad K_a=\lim_{s\to0}s^2L(s)
$$

**学习目标**：从误差通道选对 $K_p$、$K_v$ 或 $K_a$，并检查反馈结构、稳定性与单位。

**关联**：稳态误差 · 终值定理法求稳态误差

---

## 详情

### 完整解释

静态误差系数法把“长期跟不跟得上”改写成一个低频问题。先定义环路传递函数 $L(s)$，再看它在 $s=0$ 附近能提供多少增益。对单位负反馈，$L(s)=C(s)G(s)$；若反馈测量通路为一般的 $H(s)$，则比较器测量误差的环路是 $L(s)=C(s)G(s)H(s)$。这里的系数描述的是所选误差通道，不是控制器名称中的某个参数。

以参考输入为例，信号方程为
$$
Y(s)=C(s)G(s)E_m(s),\qquad E_m(s)=R(s)-H(s)Y(s),
$$
所以
$$
\frac{E_m(s)}{R(s)}=\frac{1}{1+L(s)},\qquad \frac{Y(s)}{R(s)}=\frac{C(s)G(s)}{1+C(s)G(s)H(s)}.
$$
单位负反馈时 $E_m=R-Y$；非单位 $H$ 时，比较器误差 $E_m$ 与物理跟踪误差 $E_t=R-Y$ 不能混为一谈。

对单位阶跃 $R(s)=1/s$，若闭环稳定且终值定理适用，
$$
e_{m,ss}=\lim_{s\to0}\frac{1}{1+L(s)}=\frac{1}{1+K_p}.
$$
对单位斜坡 $R(s)=1/s^2$，
$$
e_{m,ss}=\lim_{s\to0}\frac{1}{s[1+L(s)]}=\frac{1}{K_v}.
$$
对单位加速度输入 $R(s)=1/s^3$（时域为 $t^2/2$），同样得到 $e_{m,ss}=1/K_a$，但只有 $K_a$ 为合适的非零有限量且终值存在时才是有限结果。系数为无穷大时表示理想模型中的零误差；系数为零通常表示该输入的误差不收敛为有限常数。

### 教学计算/推理例

取单位负反馈、零初态、$C(s)=4$、$G(s)=5/[s(s+1)]$。于是 $L(s)=20/[s(s+1)]$，闭环特征多项式为 $s^2+s+20$，两个极点的实部都是 $-1/2$，闭环稳定。直接从误差式检查单位斜坡：
$$
E_m(s)=\frac{1/s^2}{1+20/[s(s+1)]}=\frac{s+1}{s(s^2+s+20)},\qquad sE_m(s)=\frac{s+1}{s^2+s+20}.
$$
$sE_m$ 的极点在左半平面，故 $K_p=\infty$、$K_v=20$，单位阶跃误差为 $0$，单位斜坡误差为 $1/20=0.05$。这里 $K_a=0$，所以单位加速度输入没有有限稳态误差；不能把 $1/0$ 当成一个数值答案。

再看非单位测量的边界。取 $C(s)=3$、$G(s)=2/(s+1)$、$H(s)=2$，则 $L(0)=12$、闭环极点为 $-13$。单位阶跃时 $e_{m,ss}=1/13$，但 $Y/R=6/(s+13)$，所以物理跟踪误差为 $e_{t,ss}=1-6/13=7/13$。这说明系数法的误差对象必须写清楚。

### 适用条件与边界

公式默认线性定常、零初始条件、负反馈符号和闭环稳定。输入的幅值会按比例改变误差，例如斜率为 $a$ 的斜坡误差为 $a/K_v$；实际执行器饱和、死区或速率限制会破坏线性模型。使用前还要检查 $sE_m(s)$ 约简后的极点，而不是只把 $s=0$ 代入。

### 常见误区

1. **误区**：把 $K_p$、$K_v$ 当成比例控制器增益或速度控制器增益。**纠正**：它们是环路开环传递函数在低频处的极限；控制器参数只是构成 $L(s)$ 的一部分。
2. **误区**：算出单位负反馈的 $1/K_v$ 后，直接当作非单位 $H(s)$ 的物理跟踪误差。**纠正**：$1/K_v$ 对应比较器测量误差；$H\ne1$ 时应由 $Y/R$ 和 $E_t=R-Y$ 重新计算。

### 自检

1. 单位负反馈的 $L(s)=20/[s(s+1)]$ 对单位斜坡的稳态误差是多少？
2. 为什么 $K_p=\infty$ 仍不能单独证明闭环稳定？

**核对要点**：$K_v=20$，误差为 $1/20=0.05$；$K_p$ 只描述低频极限，稳定性仍须由闭环极点以及 $sE(s)$ 的极点条件检查。

### 关联节点

- **稳态误差**（无序关联）：静态系数法直接计算的目标量。
- **终值定理法求稳态误差**（无序关联）：先写误差通道再取终值的另一种方法。
