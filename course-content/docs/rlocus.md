可以。你这个问题的关键不是“根轨迹怎么画”，而是**怎样把根轨迹当作一组带事件点的多分支代数曲线来生成数据**。如果仍然只是“取一串 (K)，求根，最近邻连线”，遇到分离点、汇合点、复分支、大增益零点端、无穷远分支和局部圆弧时必然会出问题。

MATLAB 和 Mathematica/Wolfram 的思路可以借鉴，但不要照搬为黑箱。MATLAB `rlocus(sys)` 在用户不指定增益时，会自动选择一组正反馈增益以得到平滑根轨迹；如果用户给定 `k`，则直接返回对应闭环极点。也就是说，它的核心仍是“选增益—求闭环根—组织轨迹”，但增益点不是简单均匀取样。([MathWorks][1]) Wolfram 的 `RootLocusPlot[lsys,{k,kmin,kmax}]` 明确把根轨迹作为参数 (k) 在区间内变化时闭环极点的位置，并提供 `PlotPoints`、`MaxRecursion`、`Exclusions`、`RegionFunction`、`Method`、`PoleZeroMarkers` 等选项，这说明它更接近“参数曲线 + 自适应采样 + 排除点/特殊点处理”的绘图框架。([Wolfram 语言与系统文档中心][2])

公开实现中，Python Control 的 `root_locus_map` 可作为一个很好的参考：它按 (1+kG(s)=0) 求根；若未给定增益，则自动选取能包含主要结构的增益；返回的数据按“增益索引”和“分支索引”组织。其源码中还显式计算实轴分离点、估计最大增益、加入分离点增益、按相邻根距离过大进行加密，并用最近邻方式给根排序。([Python 控制系统库][3])

我建议你设计的根轨迹计算器不要只是复刻这些默认算法，而是做成下面这种结构。

---

# 1. 统一数学形式

设开环传递函数为：

[
L(s)=\frac{N(s)}{D(s)}
]

负反馈闭环特征方程为：

[
1+K L(s)=0
]

即：

[
F(s,K)=D(s)+K N(s)=0
]

其中：

[
K\ge 0
]

根轨迹就是 (K) 从 (0) 到 (+\infty) 变化时，方程

[
D(s)+K N(s)=0
]

的所有根在 (s) 平面中的轨迹。

程序内部一定要统一成这个形式。不要一会儿用 (1+KG(s)=0)，一会儿用 (1-KG(s)=0)。如果要支持正反馈，可以设置：

```text
feedback_sign = +1 or -1
F(s,K)=D(s)+feedback_sign*K*N(s)
```

但内部最好始终转成：

[
D(s)+K\tilde N(s)=0
]

---

# 2. 根轨迹数据对象，而不是简单二维数组

不建议只输出：

```text
roots[gain_index, branch_index]
gains[gain_index]
```

这种结构只能画普通根轨迹，不能很好地支持分段显示、局部放大、事件标注和无穷远尾部处理。

建议输出：

```text
RootLocusData {
    model: {
        numerator: N(s),
        denominator: D(s),
        poles: [...],
        zeros: [...],
        degree_den: n,
        degree_num: m,
        relative_degree: r = n - m,
        cancelled_modes: [...],
        gain_convention: "D + K N = 0"
    },

    events: [
        Event(type="open_loop_pole", s=..., multiplicity=..., K=0),
        Event(type="open_loop_zero", s=..., multiplicity=..., K=∞),
        Event(type="breakaway", s=..., K=..., multiplicity=...),
        Event(type="breakin", s=..., K=..., multiplicity=...),
        Event(type="complex_branch_point", s=..., K=..., multiplicity=...),
        Event(type="imag_axis_crossing", s=..., K=...),
        Event(type="infinity_endpoint", asymptote_angle=..., branch_id=...)
    ],

    branches: [
        Branch {
            branch_id,
            start_event,
            end_event,
            endpoint_type: "finite_zero" | "infinity",
            segments: [
                Segment(type="regular", points=[...]),
                Segment(type="near_break", points=[...]),
                Segment(type="near_zero", points=[...]),
                Segment(type="asymptotic_tail", points=[...])
            ]
        }
    ],

    auxiliary: {
        real_axis_locus_segments,
        asymptote_lines,
        asymptote_centroid,
        departure_angle_rays,
        arrival_angle_rays,
        break_point_labels,
        gain_ticks,
        damping_ratio_grid,
        natural_frequency_grid,
        imaginary_axis_crossing_labels,
        pole_zero_markers
    },

    views: {
        feature_view,
        full_view,
        branch_views,
        event_views,
        suggested_insets
    },

    diagnostics: {
        assignment_warnings,
        near_multiple_root_warnings,
        ill_conditioned_gains,
        truncated_infinity_branches,
        hidden_endpoint_segments
    }
}
```

重点是：**根轨迹应被组织成“事件点—分支—分段曲线”的结构，而不是一个根表。**

根表可以保留，用于兼容 MATLAB 或 Python Control 风格的接口；但真正用于绘制、标注和局部放大的数据，应是上面这种结构。

---

# 3. 预分析：先找结构，再采样

第一步不是采样，而是结构分析。

计算开环极点和零点：

[
p_i=\text{roots}(D)
]

[
z_j=\text{roots}(N)
]

设：

[
n=\deg D,\qquad m=\deg N
]

若：

[
n>m
]

则有：

[
r=n-m
]

条根轨迹分支最终走向无穷远。

若：

[
n=m
]

所有分支最终走向有限开环零点。

若：

[
m>n
]

则开环传递函数是非真有理形式。严格说，这不是常规物理可实现控制对象的典型根轨迹问题。程序可以支持，但应给出警告。

还要检测公共因子。如果：

[
D(s)=Q(s)D_r(s),\qquad N(s)=Q(s)N_r(s)
]

则：

[
D(s)+K N(s)=Q(s)\left[D_r(s)+K N_r(s)\right]
]

公共因子 (Q(s)) 的根是固定闭环模态，不随 (K) 运动。绘图时应作为：

```text
cancelled_modes / fixed_modes
```

单独标记，不能混入活动根轨迹分支。

---

# 4. 分离点和汇合点

根轨迹上的分离点和汇合点，本质是闭环特征方程的重根点。

它们满足：

[
F(s,K)=0
]

[
F_s(s,K)=0
]

其中：

[
F(s,K)=D(s)+K N(s)
]

若：

[
N(s)\ne0
]

由：

[
K=-\frac{D(s)}{N(s)}
]

代入 (F_s=0)，得到候选方程：

[
D'(s)N(s)-D(s)N'(s)=0
]

程序应先求：

[
B(s)=D'(s)N(s)-D(s)N'(s)
]

的所有根。

对每个候选点 (s_b)，计算：

[
K_b=-\frac{D(s_b)}{N(s_b)}
]

保留满足：

[
|\operatorname{Im}K_b|<\varepsilon_K
]

[
\operatorname{Re}K_b\ge 0
]

的点。

如果：

[
|\operatorname{Im}s_b|<\varepsilon_s
]

则它是实轴上的分离点或汇合点。

如果：

[
\operatorname{Im}s_b\ne0
]

但 (K_b) 仍近似为实数非负，则它是复平面中的分支事件点，也应保留。很多简单教材不讲这个，但数值绘图不能直接丢弃。

事件对象可以记录为：

```text
Event {
    type: "breakaway" | "breakin" | "complex_branch_point",
    s: s_b,
    K: K_b,
    multiplicity: q,
    local_parameter: "tau = (K-Kb)^(1/q)"
}
```

这里的重数 (q) 可通过检查：

[
F_s=0,\quad F_{ss}=0,\quad \dots
]

确定。

---

# 5. 分离点附近必须改变参数

普通点处，由隐函数定理：

[
F(s,K)=0
]

[
\frac{ds}{dK}
=============

# -\frac{F_K}{F_s}

-\frac{N(s)}{D'(s)+K N'(s)}
]

只要：

[
F_s\ne0
]

根随 (K) 光滑变化。

但在分离点、汇合点处：

[
F_s=0
]

于是：

[
\frac{ds}{dK}
]

会发散。此时用均匀 (K) 采样必然导致两种问题：

1. 分离点附近采样不足，曲线不光滑；
2. 分支归属容易错，某条分支可能被接到另一条分支上。

在 (q) 重根附近，可以作局部展开：

[
F(s,K)
\approx
F_K(s_b,K_b)(K-K_b)
+
\frac{1}{q!}F_{s^q}(s_b,K_b)(s-s_b)^q
]

所以：

[
(s-s_b)^q
\approx
-\frac{q!F_K(s_b,K_b)}{F_{s^q}(s_b,K_b)}(K-K_b)
]

最常见的二重分离点满足：

[
s-s_b\sim c\sqrt{K-K_b}
]

因此在分离点附近不能用 (K) 作为均匀参数，而应使用：

[
\tau=\sqrt{|K-K_b|}
]

一般 (q) 重事件点附近应使用：

[
\tau=|K-K_b|^{1/q}
]

然后：

[
K=K_b+\sigma \tau^q
]

其中：

[
\sigma=+1 \quad \text{或} \quad -1
]

表示事件点两侧的增益方向。

这一点是根轨迹数值绘制的核心。很多“分离点附近线条不光滑”的问题，本质就是错用了 (K) 作为局部均匀参数。

---

# 6. 开环极点附近的采样

根轨迹从开环极点出发。若 (p) 是开环极点，重数为 (\nu)，则在 (K=0) 附近：

[
L(s)\approx \frac{A}{(s-p)^\nu}
]

闭环特征方程：

[
1+K L(s)=0
]

于是：

[
(s-p)^\nu\approx -K A
]

因此：

[
s-p\sim C K^{1/\nu}
]

所以开环多重极点附近也不能简单用均匀 (K) 采样。应使用：

[
\tau=K^{1/\nu}
]

若是简单极点，(\nu=1)，普通 (K) 采样即可；若是二重或更高重数极点，必须使用 (K^{1/\nu}) 参数，否则出射方向和初始分支会混乱。

程序中建议为每个开环极点生成：

```text
Segment {
    type: "near_pole",
    pole: p,
    multiplicity: nu,
    parameter: "tau = K^(1/nu)",
    K_values: tau_i^nu
}
```

---

# 7. 开环零点附近的采样：用 (\mu=1/K)

根轨迹终止于开环零点时，对应的是：

[
K\to\infty
]

如果仍然直接在 (K) 上采样，就会出现“需要非常大的 (K)”的问题。实际根已经非常靠近零点，但 (K) 还在无穷增长。

所以靠近有限零点时应引入：

[
\mu=\frac{1}{K}
]

闭环方程变成：

[
N(s)+\mu D(s)=0
]

若 (z) 是开环零点，重数为 (\nu)，则：

[
N(s)\approx B(s-z)^\nu
]

于是：

[
(s-z)^\nu\approx -\mu D(z)/B
]

所以：

[
s-z\sim C\mu^{1/\nu}
]

零点附近应使用：

[
\tau=\mu^{1/\nu}=K^{-1/\nu}
]

而不是 (K)。

程序中可生成：

```text
Segment {
    type: "near_zero",
    zero: z,
    multiplicity: nu,
    parameter: "tau = (1/K)^(1/nu)",
    mu_values: tau_i^nu,
    K_values: 1/mu_values
}
```

终止条件不应是：

```text
K > Kmax_global
```

而应是：

[
|s-z|<\varepsilon_z S
]

其中 (S) 是图形特征尺度。例如：

[
\varepsilon_z=10^{-3}\sim10^{-4}
]

这样可以避免为了让某条分支“到达零点”而把 (K) 取到极大，导致其他无穷远分支把自动视窗撑爆。

---

# 8. 无穷远分支的采样

如果：

[
r=n-m>0
]

则有 (r) 条分支走向无穷远。

高增益时：

[
D(s)+K N(s)=0
]

取最高阶项：

[
d_n s^n + K n_m s^m \approx 0
]

即：

[
s^r \approx -K\frac{n_m}{d_n}
]

所以渐近线角度为：

[
\theta_q
========

\frac{\arg\left(-\frac{n_m}{d_n}\right)+2\pi q}{r},
\qquad q=0,1,\dots,r-1
]

若 (d_n,n_m>0)，则退化为经典公式：

[
\theta_q=\frac{(2q+1)\pi}{r}
]

渐近线交点为：

[
\sigma_a=
\frac{\sum_i p_i-\sum_j z_j}{r}
]

这是标准根轨迹渐近线中心。

无穷远分支不能无限画。建议把它分成两部分：

1. 有限计算段：实际求根，直到分支距离达到显示截断半径；
2. 渐近尾段：不再继续求根，只输出渐近线数据。

对无穷远分支，设默认显示截断半径为：

[
R_{\text{tail}}
]

当：

[
|s-\sigma_a|>R_{\text{tail}}
]

就停止实际根点输出，把之后部分表示为：

```text
Segment {
    type: "asymptotic_tail",
    start_point: s_tail,
    asymptote_center: sigma_a,
    asymptote_angle: theta_q,
    hidden_beyond: true
}
```

不要把无穷远分支上极大的点纳入默认自动显示范围。否则所有重要局部结构都会被压缩成一个小点。

---

# 9. 渐近线数据

辅助渐近线应单独输出，不应混入主根轨迹分支。

若：

[
r=n-m>0
]

则：

[
\sigma_a=
\frac{\sum_i p_i-\sum_j z_j}{r}
]

[
\theta_q
========

\frac{\arg\left(-\frac{n_m}{d_n}\right)+2\pi q}{r},
\quad q=0,\dots,r-1
]

生成辅助线：

[
s_q(\rho)=\sigma_a+\rho e^{j\theta_q}
]

其中：

[
\rho\in[0,R_{\text{asymp}}]
]

输出为：

```text
AuxiliaryLine {
    type: "asymptote",
    center: sigma_a,
    angle: theta_q,
    points: [...]
}
```

注意：渐近线是辅助判断线，不是实际根轨迹。实际分支只在 (K\to\infty) 时趋近它。

---

# 10. 出射角和入射角

出射角、入射角应作为辅助标注数据输出。

## 10.1 极点出射角

设 (p) 是开环极点，重数为 (\nu)。在 (p) 附近：

[
L(s)\approx \frac{A_p}{(s-p)^\nu}
]

其中：

[
A_p=\lim_{s\to p}(s-p)^\nu L(s)
]

根轨迹角度条件为：

[
\arg L(s)=(2k+1)\pi
]

令：

[
s=p+\rho e^{j\theta}
]

则：

[
\arg A_p-\nu\theta=(2k+1)\pi
]

所以出射角为：

[
\theta_k
========

\frac{\arg A_p-(2k+1)\pi}{\nu},
\qquad k=0,1,\dots,\nu-1
]

对于简单极点，这就是教材中的：

[
\theta_d
========

\pi+\sum_j \angle(p-z_j)
-\sum_{\ell\ne i}\angle(p-p_\ell)
]

但用局部主部系数 (A_p) 写更通用，能自然处理符号、复极点、多重极点和非标准增益约定。

输出：

```text
AuxiliaryRay {
    type: "departure_angle",
    pole: p,
    angle: theta_k,
    length: local_marker_length
}
```

## 10.2 零点入射角

设 (z) 是开环零点，重数为 (\nu)。在 (z) 附近：

[
L(s)\approx B_z(s-z)^\nu
]

其中：

[
B_z=\lim_{s\to z}\frac{L(s)}{(s-z)^\nu}
]

令：

[
s=z+\rho e^{j\theta}
]

则角度条件：

[
\arg B_z+\nu\theta=(2k+1)\pi
]

所以入射角为：

[
\theta_k
========

\frac{(2k+1)\pi-\arg B_z}{\nu},
\qquad k=0,1,\dots,\nu-1
]

输出：

```text
AuxiliaryRay {
    type: "arrival_angle",
    zero: z,
    angle: theta_k,
    length: local_marker_length
}
```

---

# 11. 实轴根轨迹段

对实轴上的点 (x)，若：

[
N(x)\ne0
]

则对应增益为：

[
K(x)=-\frac{D(x)}{N(x)}
]

对于标准负反馈根轨迹，实轴上满足：

[
K(x)\ge 0
]

的区间就是实轴根轨迹段。

这比“右侧奇数个极点零点”的教材规则更适合程序实现，因为它自动包含符号约定、开环增益正负号和非标准形式。

具体做法：

1. 收集所有实极点和实零点；
2. 按实部排序；
3. 用它们把实轴切成若干区间；
4. 在每个区间取测试点 (x_t)；
5. 计算：

[
K_t=-\frac{D(x_t)}{N(x_t)}
]

6. 若 (K_t\ge0)，则该区间属于实轴根轨迹。

输出：

```text
RealAxisSegment {
    x_range: [x_left, x_right],
    K_function: K(x) = -D(x)/N(x),
    contains_break_points: [...]
}
```

实轴段是辅助数据，也可以作为分支追踪的约束信息使用。

---

# 12. 虚轴交点

虚轴交点常用于稳定性判断和标注。

令：

[
s=j\omega
]

闭环方程为：

[
D(j\omega)+K N(j\omega)=0
]

也可写成：

[
K(j\omega)=-\frac{D(j\omega)}{N(j\omega)}
]

虚轴交点要求：

[
\operatorname{Im}K(j\omega)=0
]

并且：

[
\operatorname{Re}K(j\omega)\ge0
]

程序可在 (\omega\ge0) 上搜索：

[
g(\omega)=\operatorname{Im}\left[-\frac{D(j\omega)}{N(j\omega)}\right]
]

的零点，然后保留：

[
K=\operatorname{Re}\left[-\frac{D(j\omega)}{N(j\omega)}\right]\ge0
]

输出：

```text
Event {
    type: "imag_axis_crossing",
    s: j*omega,
    K: K_cross,
    conjugate_pair: true
}
```

若需要严格稳定性判据，可另外用 Routh-Hurwitz 表求交点；但作为绘图数据生成，数值搜索 (K(j\omega)) 通常更直接。

---

# 13. 普通分支的自适应采样

普通区域可以用 (K) 作为参数，但不能均匀采样。建议使用混合参数：

[
u=\log(1+K/K_s)
]

或者：

[
\alpha=\frac{K}{K+K_s}
]

其中 (K_s) 是尺度参数，可以取：

[
K_s=\operatorname{median}(\text{positive event gains})
]

若没有事件增益，可取 (K_s=1)。

普通分支采样的基本过程：

1. 取初始增益网格；
2. 对每个 (K_i)，求：

[
D(s)+K_iN(s)=0
]

3. 对相邻增益处的根进行分支匹配；
4. 对每条分支检查几何误差；
5. 不满足精度就插入中间增益；
6. 重复直到满足误差或达到最大递归深度。

误差判据不应只看点距。建议同时看：

## 13.1 最大步长

对同一分支：

[
\Delta s_i=|s_{i+1}-s_i|
]

若：

[
\Delta s_i>\varepsilon_{\text{step}} S
]

则加密。

其中 (S) 是当前视图或特征尺度。

## 13.2 弦误差

在区间 ([K_a,K_b]) 中取中点 (K_m)，求对应根 (s_m)。

与线性插值比较：

[
e_{\text{chord}}
================

\left|
s_m-\frac{s_a+s_b}{2}
\right|
]

若：

[
e_{\text{chord}}>\varepsilon_{\text{chord}}S
]

则加密。

## 13.3 切向角变化

可用：

[
\frac{ds}{dK}
=============

-\frac{N(s)}{D'(s)+K N'(s)}
]

计算切向量。若相邻切向角变化过大：

[
|\Delta \arg(ds/dK)|>\theta_{\max}
]

则加密。

可取：

[
\theta_{\max}=5^\circ\sim10^\circ
]

## 13.4 曲率判据

用三个连续点估计曲率。若曲率半径 (R_c) 相对步长过小，说明存在圆弧或急弯：

[
\frac{\Delta s}{R_c}>\varepsilon_\kappa
]

则加密。

这对你提到的“局部圆形结构”“弧线附近采样密度”很重要。单纯点距可能漏掉圆弧，因为圆弧上相邻点距可以不大，但曲率很高。

## 13.5 残差判据

每个点都应满足：

[
F(s,K)=D(s)+K N(s)\approx0
]

可定义归一化残差：

[
r_F=
\frac{|D(s)+K N(s)|}
{|D(s)|+K|N(s)|+\varepsilon}
]

若：

[
r_F>\varepsilon_F
]

则该点标为数值不可靠。

---

# 14. 分支归属：不要只用最近邻

Python Control 的公开实现中，根排序采用相邻增益行之间的最近邻匹配，以避免根“跳到其他分支”。这对普通系统有效，但在分离点、汇合点和近重根处容易失败。([GitHub][4])

更稳妥的分支归属应使用“预测—匹配—校正”。

对第 (i) 个增益 (K_i) 处已经归属的根 (s_{b,i})，计算预测：

[
\hat s_{b,i+1}
==============

s_{b,i}
+
\frac{ds}{dK}(s_{b,i},K_i)(K_{i+1}-K_i)
]

其中：

[
\frac{ds}{dK}
=============

-\frac{N(s)}{D'(s)+K N'(s)}
]

然后对 (K_{i+1}) 处的候选根 (r_j) 建立代价矩阵：

[
C_{bj}
======

\frac{|r_j-\hat s_{b,i+1}|}{S_b}
+
\lambda_\theta
\left|
\Delta\theta_{bj}
\right|
+
\lambda_c C_{\text{conjugate}}
]

其中：

* 第一项是到预测点的距离；
* 第二项是切向角连续性；
* 第三项用于实系数系统的共轭一致性。

然后用 Hungarian assignment 求全局最小匹配，而不是局部贪心最近邻。

伪代码：

```text
for each adjacent gain pair K[i], K[i+1]:

    roots_next = roots_at(K[i+1])

    for each branch b:
        s_prev = assigned_root[b, i]

        if not near_event(s_prev, K[i]):
            ds_dK = -N(s_prev)/(D'(s_prev)+K[i]*N'(s_prev))
            s_pred[b] = s_prev + ds_dK*(K[i+1]-K[i])
        else:
            s_pred[b] = local_event_prediction(...)

    C = cost_matrix(s_pred, roots_next)

    assignment = hungarian(C)

    assigned_root[:, i+1] = roots_next[assignment]
```

在普通区间这样处理即可。

但在事件点附近，应**不要强行穿越事件点匹配**。更好的做法是把事件点切成图节点：

```text
incoming branches -> event node -> outgoing branches
```

然后根据局部 Puiseux 展开方向连接进入和离开的分支。

---

# 15. 事件点附近的局部分支连接

在事件点 ((s_b,K_b)) 附近，若重数为 (q)，局部满足：

[
(s-s_b)^q
=========

C(K-K_b)
]

其中：

[
C=
-\frac{q!F_K(s_b,K_b)}{F_{s^q}(s_b,K_b)}
]

于是：

[
s-s_b=
C^{1/q}(K-K_b)^{1/q}
]

有 (q) 个方向：

[
\theta_\ell
===========

\frac{\arg C+\arg(K-K_b)+2\pi \ell}{q},
\qquad \ell=0,\dots,q-1
]

对实轴二重分离点，通常是：

* (K<K_b) 时，两条实轴分支进入；
* (K>K_b) 时，两条复共轭分支离开；

或者相反。

程序应在事件点附近生成专门点列：

```text
for side in ["left_gain_side", "right_gain_side"]:
    for local_direction in local_directions:
        tau_values = linspace(0, tau_max, N)
        K = Kb + sign_side * tau_values^q
        s_initial = sb + local_direction * tau_values
        s_corrected = Newton_correct(F(s,K)=0, initial=s_initial)
```

其中 Newton 校正用于让点严格落在闭环特征方程上。

这样处理后，分离点附近的曲线会比普通 (K) 采样平滑很多。

---

# 16. 牛顿校正与连续追踪

在自适应采样中，直接调用多项式求根是可靠的，但分支归属可能困难。另一种更强的方法是局部连续追踪。

给定上一个点 ((s_i,K_i))，预测：

[
s_{\text{pred}}=s_i+\frac{ds}{dK}\Delta K
]

然后在固定 (K_{i+1}) 下，对：

[
F(s,K_{i+1})=0
]

做 Newton 校正：

[
s^{(r+1)}
=========

## s^{(r)}

\frac{F(s^{(r)},K_{i+1})}{F_s(s^{(r)},K_{i+1})}
]

这样可以沿着指定分支走，而不是每次全局求所有根再排序。

推荐混合策略：

* 全局增益节点处：用多项式求所有根，确保不漏分支；
* 分支内部加密：用预测—Newton 校正；
* 事件点附近：用局部展开给初值，再 Newton 校正；
* 每隔若干步重新全局求根校验。

这比纯最近邻排序更稳健。

---

# 17. 初始增益网格

初始网格应包含结构点，而不是简单线性或对数网格。

建议：

```text
K_initial =
    {0}
    ∪ event_gains
    ∪ imag_axis_crossing_gains
    ∪ local_near_event_gains
    ∪ logspace(K_min, K_feature_max)
    ∪ branch_specific_endpoint_gains
```

其中：

## 17.1 事件点附近增益

对每个分离点：

[
K_b
]

加入：

[
K_b(1-\eta),\quad K_b,\quad K_b(1+\eta)
]

以及基于局部参数的点：

[
K=K_b\pm \tau_i^q
]

注意如果 (K_b=0)，应改用绝对尺度。

## 17.2 低增益区

加入：

[
K=0
]

以及：

[
K=K_0\tau_i^\nu
]

用于多重开环极点出射。

## 17.3 高增益区

不要只取一个全局 (K_{\max})。应分两类：

有限零点分支用：

[
\mu=\frac{1}{K}
]

采样；

无穷远分支用半径截断：

[
|s-\sigma_a|=R_{\text{tail}}
]

对应估计：

[
K_{\text{tail}}
\approx
\left|\frac{d_n}{n_m}\right|R_{\text{tail}}^r
]

但这个 (K_{\text{tail}}) 只用于无穷远分支，不应强迫所有有限零点分支都画到这个增益。

---

# 18. 自动显示范围：必须区分 feature view 和 full view

你提到的问题非常重要：如果根轨迹有局部圆弧、分离汇合等结构，同时又有无穷远分支，把所有点纳入同一个自动范围，会导致关键结构很小，看不清。

所以默认视图不应是“所有计算点的包围盒”。应至少提供两个范围：

```text
feature_view
full_view
```

## 18.1 full view

包含所有已生成点，包括无穷远分支的截断尾部。

```text
full_view_bbox = bbox(all_visible_points)
```

这个范围用于全局浏览。

## 18.2 feature view

只包含重要有限结构，不包含被标记为：

```text
asymptotic_tail
hidden_beyond
near_endpoint_collapsed
```

的点。

重要有限结构包括：

* 开环极点；
* 开环有限零点；
* 分离点、汇合点；
* 复分支事件点；
* 虚轴交点；
* 实轴根轨迹段；
* 非尾部普通根轨迹点；
* 用户指定 (K) 对应的闭环极点；
* 局部高曲率区域点。

定义：

[
\mathcal P_{\text{feature}}
===========================

\mathcal P_{\text{poles}}
\cup
\mathcal P_{\text{zeros}}
\cup
\mathcal P_{\text{break}}
\cup
\mathcal P_{\text{imag-cross}}
\cup
\mathcal P_{\text{regular-non-tail}}
]

然后：

[
\text{feature_bbox}=\operatorname{bbox}(\mathcal P_{\text{feature}})
]

再加边距：

[
\Delta x=0.08(x_{\max}-x_{\min})
]

[
\Delta y=0.08(y_{\max}-y_{\min})
]

如果范围退化，例如全在实轴上，则给一个最小虚轴范围：

[
y_{\max}-y_{\min}\ge 0.2(x_{\max}-x_{\min})
]

这样默认图能保留局部结构，而不是被无穷远分支拉扁。

## 18.3 局部 inset 建议

程序还可以自动生成：

```text
suggested_insets
```

对每个重要事件点：

[
s_e
]

定义局部尺度：

[
R_e
===

c\cdot
\min_{\ell\ne e}|s_e-s_\ell|
]

或者根据事件点附近轨迹点的局部包围盒生成：

```text
InsetView {
    center: s_e,
    radius: R_e,
    reason: "breakaway" | "high_curvature" | "zero_endpoint" | "imag_crossing"
}
```

对高曲率区域，可用离散曲率检测：

[
\kappa_i
========

\frac{4A(p_{i-1},p_i,p_{i+1})}
{|p_i-p_{i-1}||p_{i+1}-p_i||p_{i+1}-p_{i-1}|}
]

若：

[
\kappa_i S>\kappa_{\text{threshold}}
]

则标为局部结构候选。

---

# 19. 弧线和平滑性：用曲率和弦误差加密

对你提到的“圆形、弧线、局部结构”，核心不是多取点，而是**在正确的地方加密**。

对每条分支段，递归检查：

给定端点：

[
(K_a,s_a),\quad (K_b,s_b)
]

取中点参数 (K_m)，求根 (s_m)。

线性预测点：

[
s_{\text{lin}}=\frac{s_a+s_b}{2}
]

弦误差：

[
e_c=|s_m-s_{\text{lin}}|
]

如果：

[
e_c>\varepsilon_c S
]

加密。

再看切向角：

[
\theta_a=\arg\frac{ds}{dK}(s_a,K_a)
]

[
\theta_b=\arg\frac{ds}{dK}(s_b,K_b)
]

如果：

[
|\operatorname{unwrap}(\theta_b-\theta_a)|>\theta_{\max}
]

加密。

再看曲率估计：

[
\kappa\approx
\frac{4A(s_a,s_m,s_b)}
{|s_m-s_a||s_b-s_m||s_b-s_a|}
]

如果：

[
\kappa |s_b-s_a|>\varepsilon_\kappa
]

加密。

伪代码：

```text
function refine_segment(branch, Ka, sa, Kb, sb, parameter_type):

    Km = midpoint_in_parameter_space(Ka, Kb, parameter_type)

    sm = root_on_same_branch(Km, initial_guess=predict(sa, Ka, Km))

    chord_error = abs(sm - (sa + sb)/2)
    tangent_error = angle_change(ds_dK(sa,Ka), ds_dK(sb,Kb))
    curvature_error = curvature(sa, sm, sb) * abs(sb - sa)

    if chord_error < tol_chord
       and tangent_error < tol_angle
       and curvature_error < tol_curvature:
           accept segment
    else:
           refine_segment(Ka, sa, Km, sm)
           refine_segment(Km, sm, Kb, sb)
```

`midpoint_in_parameter_space` 很重要：

* 普通段：用 (K) 或 (\log(1+K))；
* 分离点附近：用 (\tau=|K-K_b|^{1/q})；
* 零点附近：用 (\mu=1/K)；
* 无穷远附近：用 (\rho=|s-\sigma_a|) 或 (\mu=1/K)。

---

# 20. 分支停止规则

每条分支应有自己的停止规则。

## 20.1 到有限零点的分支

若某分支终止于零点 (z)，当：

[
|s-z|<\varepsilon_z S
]

就可以停止实际绘制，并输出：

```text
Segment {
    type: "near_zero_endpoint",
    endpoint: z,
    last_visible_point: s,
    final_gain: K,
    collapsed_to_zero: true
}
```

不用继续画到更大 (K)。

## 20.2 到无穷远的分支

若某分支走向无穷远，当：

[
|s-\sigma_a|>R_{\text{tail}}
]

就停止实际绘制，之后用渐近尾段表示。

```text
Segment {
    type: "asymptotic_tail",
    from: s_tail,
    direction: theta_q,
    display_policy: "not_in_feature_bbox"
}
```

## 20.3 仅用于计算的隐藏点

程序可以继续计算一些点用于验证，但不要纳入默认显示范围：

```text
Point {
    s: ...,
    K: ...,
    flags: ["tail", "exclude_from_feature_view"]
}
```

---

# 21. MATLAB 风格和 Mathematica 风格的综合策略

可以把实现分成两个模式。

## 21.1 MATLAB-like auto gain mode

参考 MATLAB `rlocus(sys)` 的行为：用户不给增益时，系统自动选择一组正增益，使根轨迹足够平滑。MathWorks 文档明确说明了这一点。([MathWorks][1])

建议流程：

```text
1. 计算开环极点、零点、分离点、渐近线。
2. 估计 feature_view 所需的 K_feature_max。
3. 构造初始 K 网格：
      {0}
      ∪ break gains
      ∪ imag crossing gains
      ∪ logspace(...)
      ∪ local event samples
4. 求所有闭环根。
5. 分支匹配。
6. 按点距、弦误差、切向角、曲率自适应加密。
7. 对无穷远分支截断并输出渐近尾段。
8. 自动生成 feature_view 和 full_view。
```

这比 MATLAB 默认算法更适合教学平台，因为它显式暴露事件点和分段。

## 21.2 Mathematica-like parameter plot mode

参考 Wolfram `RootLocusPlot[lsys,{k,kmin,kmax}]` 的行为：用户可以指定 (k) 的范围，并通过 `PlotPoints`、`MaxRecursion`、`Exclusions`、`RegionFunction` 等控制采样和绘制范围。([Wolfram 语言与系统文档中心][2])

建议提供接口：

```text
RootLocusData[
    system,
    gain_range = {Kmin, Kmax},
    PlotPoints -> Automatic,
    MaxRecursion -> 8,
    Exclusions -> Automatic,
    RegionFunction -> Automatic,
    ViewMode -> "Feature" | "Full" | "Manual",
    BranchMode -> "All" | selected_branch_ids
]
```

其中：

* `PlotPoints`：初始采样点数；
* `MaxRecursion`：最大自适应细分次数；
* `Exclusions`：分离点、汇合点、极大增益端点、数值奇异点；
* `RegionFunction`：只保留某个复平面区域内的点；
* `ViewMode`：决定自动显示范围；
* `BranchMode`：允许只显示某些分支。

---

# 22. 增益刻度点

根轨迹图中常需要标出某些增益对应的闭环极点。

建议自动生成：

```text
gain_ticks = {
    K = 0,
    K = event gains,
    K = imag crossing gains,
    K = user selected gains,
    K = log-spaced gains in visible range
}
```

对每个 (K_t)，求闭环极点：

[
D(s)+K_tN(s)=0
]

并通过分支归属找到其 branch_id，输出：

```text
GainTick {
    K: K_t,
    branch_id: ...,
    s: ...,
    label: "K=..."
}
```

如果某个增益点位于被隐藏的无穷远尾段，应标记：

```text
visibility: "hidden_in_feature_view"
```

---

# 23. 阻尼比和自然频率网格

如果是连续时间系统，常用辅助网格包括阻尼比线和自然频率圆。

闭环极点写成：

[
s=-\zeta\omega_n\pm j\omega_n\sqrt{1-\zeta^2}
]

阻尼比线是从原点出发的射线。对给定 (\zeta)：

[
\theta=\pi-\arccos\zeta
]

以及其共轭：

[
\theta=-\pi+\arccos\zeta
]

生成：

[
s(\rho)=\rho e^{j\theta}
]

自然频率线是圆：

[
|s|=\omega_n
]

生成：

[
s(\phi)=\omega_n e^{j\phi}
]

调节时间近似线，例如按：

[
t_s\approx \frac{4}{\zeta\omega_n}
]

对应实部：

[
\operatorname{Re}s=-\frac{4}{t_s}
]

可生成竖线：

[
s=-\frac{4}{t_s}+j\omega
]

这些都属于 `auxiliary`，不应混入主根轨迹数据。

---

# 24. 伪代码：完整计算流程

下面给出较完整的伪代码。

```text
function build_root_locus_data(N, D, options):

    # 0. 统一形式
    normalize F(s,K) = D(s) + K*N(s)

    # 1. 预分析
    poles = roots(D)
    zeros = roots(N)
    cancelled_modes = detect_common_factors(N, D)

    n = degree(D)
    m = degree(N)
    r = n - m

    # 2. 事件点
    events = []
    events += open_loop_pole_events(poles)
    events += open_loop_zero_events(zeros)

    break_candidates = roots(D'(s)*N(s) - D(s)*N'(s))

    for sb in break_candidates:
        if N(sb) != 0:
            Kb = -D(sb)/N(sb)
            if is_real_positive(Kb):
                event_type = classify_break_event(sb, Kb, F)
                events.append(Event(event_type, sb, Kb))

    imag_crossings = find_imag_axis_crossings(N, D)
    events += imag_crossings

    # 3. 渐近线
    if r > 0:
        sigma_a = (sum(poles) - sum(zeros)) / r
        theta_asymp = [
            (arg(-lead(N)/lead(D)) + 2*pi*q)/r
            for q in range(r)
        ]
        auxiliary.asymptotes = build_asymptote_lines(sigma_a, theta_asymp)

    # 4. 出射角、入射角
    auxiliary.departure_rays = compute_departure_angles(L=N/D, poles)
    auxiliary.arrival_rays = compute_arrival_angles(L=N/D, zeros)

    # 5. 实轴根轨迹段
    auxiliary.real_axis_segments = compute_real_axis_locus(D, N)

    # 6. 初始增益网格
    K_grid = build_initial_gain_grid(
        events,
        poles,
        zeros,
        asymptotes,
        options
    )

    # 7. 求根
    root_table = []
    for K in K_grid:
        roots_K = roots(D + K*N)
        root_table.append(roots_K)

    # 8. 分支归属
    branches_raw = assign_branches(
        K_grid,
        root_table,
        method = "predictor_hungarian",
        events = events
    )

    # 9. 自适应加密
    branches_refined = []

    for branch in branches_raw:
        refined_segments = []

        for segment in split_by_events(branch, events):

            if segment.near_pole:
                parameter = "tau = K^(1/nu)"
            elif segment.near_break:
                parameter = "tau = |K-Kb|^(1/q)"
            elif segment.near_zero:
                parameter = "mu = 1/K"
            elif segment.near_infinity:
                parameter = "radius_or_mu"
            else:
                parameter = "log(1+K/Ks)"

            refined = adaptive_refine_segment(
                segment,
                parameter,
                criteria = {
                    max_step,
                    chord_error,
                    tangent_angle,
                    curvature,
                    residual
                }
            )

            refined_segments.append(refined)

        branches_refined.append(refined_segments)

    # 10. 分支终止处理
    for branch in branches_refined:
        if branch.ends_at_finite_zero:
            collapse_after_distance_to_zero(branch, eps_zero)

        if branch.ends_at_infinity:
            truncate_at_radius(branch, R_tail)
            add_asymptotic_tail(branch)

    # 11. 生成增益刻度
    auxiliary.gain_ticks = compute_gain_ticks(
        K_values = event_gains ∪ user_gains ∪ log_ticks,
        branches = branches_refined
    )

    # 12. 自动视图
    feature_points = collect_points(
        branches_refined,
        include_flags = ["regular", "near_break", "near_zero_visible"],
        exclude_flags = ["asymptotic_tail", "hidden_beyond"]
    )

    full_points = collect_points(
        branches_refined,
        include_all_visible = true
    )

    views.feature_view = robust_bbox(feature_points, auxiliary.important_points)
    views.full_view = robust_bbox(full_points)
    views.suggested_insets = detect_local_feature_views(
        events,
        high_curvature_regions
    )

    # 13. 诊断
    diagnostics = check_assignment_quality(branches_refined)
    diagnostics += check_residuals(branches_refined)
    diagnostics += check_unresolved_events(events, branches_refined)

    return RootLocusData(...)
```

---

# 25. 分支归属伪代码

```text
function assign_branches(K_grid, root_table, events):

    sort K_grid ascending

    assigned[0] = sort_roots_at_K0_by_open_loop_poles(root_table[0])

    for i in 0..len(K_grid)-2:

        K0 = K_grid[i]
        K1 = K_grid[i+1]

        roots_next = root_table[i+1]

        if interval_contains_event(K0, K1, events):
            split interval at event
            continue

        predictions = []

        for b in branches:
            s0 = assigned[i][b]

            if near_multiple_root(s0, K0):
                s_pred = local_event_prediction(...)
            else:
                ds_dK = -N(s0)/(D'(s0)+K0*N'(s0))
                s_pred = s0 + ds_dK*(K1-K0)

            predictions.append(s_pred)

        C = build_cost_matrix(predictions, roots_next)

        assignment = hungarian(C)

        assigned[i+1] = roots_next[assignment]

        if assignment_is_ambiguous(C, assignment):
            mark_for_refinement(K0, K1)

    return assigned
```

模糊匹配的判据可以是：

[
\frac{C_{\text{best}}}{C_{\text{second}}}>0.8
]

或某个 branch 的两个候选距离接近，则说明需要加密或进入事件处理。

---

# 26. 自适应加密伪代码

```text
function adaptive_refine_segment(segment, parameter_type):

    queue = initial_subsegments(segment)

    accepted = []

    while queue not empty:

        sub = pop(queue)

        a = sub.param_start
        b = sub.param_end

        Ka = K_from_parameter(a, parameter_type)
        Kb = K_from_parameter(b, parameter_type)
        Km = K_from_parameter((a+b)/2, parameter_type)

        sa = sub.s_start
        sb = sub.s_end

        sm = root_on_same_branch(
            K = Km,
            initial_guess = predictor(sa, Ka, Km)
        )

        err_chord = abs(sm - (sa+sb)/2)
        err_step = max(abs(sm-sa), abs(sb-sm))
        err_tangent = tangent_angle_error(sa,Ka,sb,Kb)
        err_curv = curvature_error(sa,sm,sb)
        err_res = residual(F(sm,Km))

        if all errors acceptable:
            accepted.append([Ka,sa,Km,sm,Kb,sb])
        else if recursion_depth < MaxRecursion:
            push(queue, left_subsegment)
            push(queue, right_subsegment)
        else:
            accepted.append_with_warning(...)

    return accepted
```

这里的 `parameter_type` 决定如何取中点。不要在所有区域都用 (K) 中点。

---

# 27. 默认显示范围算法

建议定义四种视图模式：

```text
ViewMode = "Feature" | "Full" | "StableDesign" | "Manual"
```

## 27.1 Feature

默认模式。用于看清结构。

包含：

* 极点；
* 有限零点；
* 分离点、汇合点；
* 虚轴交点；
* 非尾部根轨迹；
* 高曲率局部结构。

排除：

* 无穷远渐近尾段；
* 已经靠近有限零点但 (K) 极大的密集点；
* 半径超过 (R_{\text{tail}}) 的点。

## 27.2 Full

包含所有实际绘制点和截断尾段。

## 27.3 StableDesign

重点显示左半平面设计区域，例如：

[
\operatorname{Re}s<0
]

并包含阻尼比、自然频率、调节时间辅助网格。

## 27.4 Manual

由用户指定：

```text
xlim, ylim
```

在 `Manual` 模式下，采样器可以像 Python Control 那样根据缩放窗口重新加密可见区域。Python Control 的源码中就有根据轴范围变化重新计算 loci 的回调逻辑，这一点值得借鉴。([GitHub][4])

---

# 28. 对“重要局部结构”的自动识别

你提到“圆形、分支和汇入”等局部结构，这些应被程序识别出来，并生成建议视窗。

建议使用三类指标。

## 28.1 事件点视窗

每个事件点天然生成 inset：

```text
breakaway
breakin
imag_axis_crossing
complex_branch_point
near_multiple_pole
near_multiple_zero
```

视窗半径可取：

[
R_e
===

\alpha\cdot
\min_{\ell\ne e}|s_e-s_\ell|
]

也可取事件点附近轨迹点包围盒的 (2\sim3) 倍。

## 28.2 高曲率视窗

对每条分支计算离散曲率：

[
\kappa_i
========

\frac{4A(s_{i-1},s_i,s_{i+1})}
{|s_i-s_{i-1}||s_{i+1}-s_i||s_{i+1}-s_{i-1}|}
]

若：

[
\kappa_i S>\kappa_{\text{threshold}}
]

则标记为高曲率区域。

将相邻高曲率点聚类，生成：

```text
InsetView {
    reason: "high_curvature_arc",
    bbox: ...
}
```

## 28.3 小尺度结构被大尺度尾部压缩

计算：

[
S_{\text{feature}}
==================

\operatorname{diameter}(\mathcal P_{\text{feature}})
]

[
S_{\text{full}}
===============

\operatorname{diameter}(\mathcal P_{\text{full}})
]

若：

[
\frac{S_{\text{full}}}{S_{\text{feature}}}>R_{\text{ratio}}
]

例如：

[
R_{\text{ratio}}>5
]

则说明 full view 会压缩重要结构。此时默认显示 `feature_view`，并提示：

```text
full_view_available: true
tail_branches_hidden_in_feature_view: [...]
```

---

# 29. 与 MATLAB/Python Control 默认算法的差异

Python Control 默认算法大致是：

1. 求实轴分离点；
2. 估计最大增益；
3. 生成初始增益向量；
4. 求闭环根；
5. 通过最近邻排序分支；
6. 若相邻点距离过大，则插入更多增益点；
7. 继续直到足够密或达到上限。源码中确实能看到分离点计算、最大增益估计、按距离加密、最近邻根排序等步骤。([GitHub][4])

这个算法适合作为基础，但你的场景需要增强：

| 问题               | MATLAB/Python 风格基础做法 | 建议增强                               |       |         |
| ---------------- | -------------------- | ---------------------------------- | ----- | ------- |
| 分离点附近不光滑         | 加入分离点增益，再距离加密        | 使用 (\tau=\sqrt{                    | K-K_b | }) 局部参数 |
| 分支归属错误           | 最近邻排序                | 预测 + Hungarian 匹配 + 事件点切分          |       |         |
| 圆弧采样不足           | 点距过大才加密              | 弦误差 + 切向角 + 曲率判据                   |       |         |
| 到零点需要 (K=\infty) | 用很大 (K) 逼近           | 用 (\mu=1/K) 局部采样                   |       |         |
| 无穷远分支撑爆视图        | 估计较大 (K_{\max})      | 分支截断 + 渐近尾段 + feature/full view    |       |         |
| 局部结构看不清          | 用户手动缩放               | 自动 feature view + suggested insets |       |         |
| 标注不足             | 极点零点和曲线              | 事件点、出射角、入射角、渐近线、实轴段、交轴点、增益刻度       |       |         |

---

# 30. 推荐最终算法结构

更适合你平台的根轨迹计算结构可以总结为：

```text
RootLocusBuilder
│
├── ModelAnalyzer
│   ├── poles / zeros
│   ├── cancellations
│   ├── relative degree
│   └── asymptote data
│
├── EventDetector
│   ├── breakaway / breakin
│   ├── complex branch points
│   ├── imaginary-axis crossings
│   └── multiple poles / zeros
│
├── GainPlanner
│   ├── MATLAB-like automatic gains
│   ├── Mathematica-like user parameter range
│   ├── local event gain samples
│   ├── zero-endpoint samples using μ=1/K
│   └── infinity-tail samples
│
├── RootSolver
│   ├── polynomial roots for global nodes
│   ├── predictor-Newton continuation for refinement
│   └── residual checking
│
├── BranchAssigner
│   ├── predictor-based matching
│   ├── Hungarian assignment
│   ├── conjugate-pair enforcement
│   └── event-node splitting
│
├── AdaptiveRefiner
│   ├── step length
│   ├── chord error
│   ├── tangent angle change
│   ├── curvature
│   └── residual
│
├── EndpointHandler
│   ├── finite zero collapse
│   ├── infinity truncation
│   └── asymptotic tail generation
│
├── AuxiliaryGenerator
│   ├── real-axis locus
│   ├── asymptotes
│   ├── departure / arrival rays
│   ├── gain ticks
│   ├── damping ratio grid
│   └── natural frequency grid
│
└── ViewPlanner
    ├── feature view
    ├── full view
    ├── branch views
    └── suggested insets
```

---

# 31. 最关键的实现原则

如果只保留几条原则，我建议是这些：

第一，**根轨迹不是一条按 (K) 均匀参数化的普通曲线**。分离点、汇合点、重极点、重零点处都需要局部参数变换。

第二，**分支归属不能只依靠最近邻**。普通区间可用预测 + Hungarian 匹配，事件区间应显式切分为事件节点。

第三，**有限零点端用 (\mu=1/K)，无穷远端用截断尾段和渐近线**。不要用一个巨大的全局 (K_{\max}) 逼所有分支一起结束。

第四，**默认显示范围应服务于结构理解，而不是包含所有计算点**。无穷远分支要能被标记为 tail，并从 feature view 中排除。

第五，**辅助标注应和主曲线分开生成**。实轴段、分离点、渐近线、出射角、入射角、虚轴交点、阻尼网格、增益刻度都应是独立数据层。

这样设计后，你的根轨迹绘制器会比“MATLAB 默认图 + 手动缩放”更适合教学平台：既能自动给出正确、光滑的曲线，又能把根轨迹规则中的关键结构显式呈现出来。

[1]: https://www.mathworks.com/help/control/ref/dynamicsystem.rlocus.html "rlocus - Root locus of dynamic system - MATLAB
"
[2]: https://reference.wolfram.com/language/ref/RootLocusPlot.html "RootLocusPlot—Wolfram Documentation"
[3]: https://python-control.readthedocs.io/en/latest/generated/control.root_locus_map.html "control.root_locus_map — Python Control Systems Library 0.10.2-15-g146ccee documentation"
[4]: https://github.com/python-control/python-control/blob/main/control/rlocus.py "python-control/control/rlocus.py at main · python-control/python-control · GitHub"
