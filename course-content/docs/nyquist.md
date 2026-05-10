下面给出的是“绘制数据的计算逻辑”，不是渲染流程。默认对象是连续时间、SISO、负反馈开环函数

[
L(s)=C(s)G(s)
]

闭环特征方程为：

[
1+L(s)=0
]

因此 Nyquist 判据中的关键点是：

[
-1+j0
]

Wolfram 的 `NyquistPlot` 文档明确说，连续时间系统的 Nyquist contour 包围整个右半平面、排除虚轴极点，并按顺时针方向遍历；如果没有指定频率范围，则相当于遍历完整 Nyquist contour；同时它用 `Exclusions` 处理谐振频率等不连续点。这个方向和处理原则可以作为程序设计的基准。([Wolfram 文档中心][1])

---

# 1. 先明确：程序要生成的不是一条曲线，而是一组有类型的曲线段

完整 Nyquist 曲线应拆成若干段：

[
\Gamma
======

\Gamma_{\text{imag}}
+
\Gamma_{\text{indent}}
+
\Gamma_{\text{big}}
]

其中：

[
\Gamma_{\text{imag}}
]

是虚轴上的频率响应段；

[
\Gamma_{\text{indent}}
]

是绕开虚轴极点的小半圆在 (L(s)) 平面的映射；

[
\Gamma_{\text{big}}
]

是右半平面无穷大半圆在 (L(s)) 平面的映射。

程序输出时不应只输出一个 `points` 数组，而应输出类似这样的数据结构：

```text
Segment {
    type: "regular" | "infinity_arc" | "big_arc" | "connector" | "asymptote" | "grid" | ...
    parameter_range: ...
    points: complex[]
    direction: ...
    metadata: {
        pole_location,
        pole_order,
        frequency_interval,
        layer_index,
        is_auxiliary,
        ...
    }
}
```

这比单纯拼接所有点更稳妥，因为普通频率响应段、无穷远补弧、渐近辅助线、裕度辅助线在数学意义上不同，后续渲染也应该有不同处理。

---

# 2. 采用固定方向的完整 Nyquist 围线

建议程序统一采用 Wolfram/经典 Nyquist contour 的方向：

从下方虚轴开始，沿虚轴向上走：

[
s=j\omega,\qquad \omega:-\Omega\to+\Omega
]

遇到虚轴极点时向右半平面绕开。

最后沿右半平面大圆弧从 (+j\Omega) 回到 (-j\Omega)：

[
s=\Omega e^{j\theta},
\qquad
\theta:\frac{\pi}{2}\to-\frac{\pi}{2}
]

这是顺时针围线，包围右半平面。

然后将整个围线通过

[
z=L(s)
]

映射到复平面，得到 Nyquist 曲线。

若对象没有虚轴极点，也可以只算：

[
L(j\omega),\quad \omega\in[0,+\infty)
]

再用共轭对称性补负频率。但如果要做一个稳健程序，最好直接按完整 contour 算，因为虚轴极点、非严格真有理对象、延迟对象、多重极点都会让“正频率加镜像”的写法变得不够清楚。

---

# 3. 输入对象的预分析

程序第一步不是采样，而是分析开环函数 (L(s))。

至少要得到以下信息：

1. 所有开环极点；
2. 所有开环零点；
3. 虚轴极点及其阶数；
4. 原点积分环节个数；
5. 相对阶次；
6. 高频主导系数；
7. 每个虚轴极点附近的主部系数。

设

[
L(s)=\frac{N(s)}{D(s)}
]

如果 (p_k=j\omega_k) 是虚轴极点，阶数为 (q_k)，则在 (p_k) 附近：

[
L(s)
====

\frac{A_k}{(s-p_k)^{q_k}}
+\text{低阶奇异项或解析项}
]

其中主部系数为：

[
A_k
===

\lim_{s\to p_k}
(s-p_k)^{q_k}L(s)
]

这个 (A_k) 决定绕开该虚轴极点时，无穷远补弧的起止方向和旋转方向。

如果是简单极点 (q_k=1)，则：

[
A_k=\frac{N(p_k)}{D'(p_k)}
]

如果是高阶极点，建议直接对多项式因子分解，或用高精度极限计算，不建议用低精度数值差分。

---

# 4. 频率区间的切分

设虚轴极点频率集合为：

[
\mathcal W_p={\omega_1,\omega_2,\dots,\omega_m}
]

按从小到大排序：

[
\omega_1<\omega_2<\cdots<\omega_m
]

截断频率为 (\Omega)。则虚轴频率区间切成：

[
[-\Omega,\omega_1-\delta_1]
]

[
[\omega_1+\delta_1,\omega_2-\delta_2]
]

[
\cdots
]

[
[\omega_m+\delta_m,\Omega]
]

其中 (\delta_k) 是绕开第 (k) 个虚轴极点时的局部频率缺口。

程序不要直接取一个固定小数，例如 (\delta=10^{-6})。更合理的做法是让 (\delta_k) 与无穷远显示半径相关。

假设希望普通频率响应段在靠近极点时停止在幅值约为 (R_{\text{entry}}) 的位置。由局部近似：

[
|L(j\omega)|
\approx
\frac{|A_k|}{|\omega-\omega_k|^{q_k}}
]

可取：

[
\delta_k
========

\left(
\frac{|A_k|}{R_{\text{entry}}}
\right)^{1/q_k}
]

同时需要限制：

[
\delta_k
\le
\eta \cdot
\min_{l\ne k}|\omega_k-\omega_l|
]

例如：

[
\eta=0.1
]

如果附近没有其他虚轴极点，则用最近的有限特征频率或用户给定下限约束。

这样做的好处是：普通曲线段不会因为过于靠近极点而数值爆炸；无穷远补弧由专门算法生成，而不是靠真实巨大数值硬画。

---

# 5. 普通频率响应段的采样

对每个常规区间：

[
[\omega_a,\omega_b]
]

计算：

[
z(\omega)=L(j\omega)
]

采样不要只用等间距，也不要只用对数间距。推荐使用“初始网格 + 自适应细分”。

初始网格可以包含：

1. 区间端点；
2. 所有极点、零点模值附近的频率；
3. 增益交叉、相位交叉的候选频率；
4. 对数均匀点；
5. 必要时加入线性均匀点。

然后递归细分。对任意小区间 ([\omega_a,\omega_b])，计算：

[
z_a=L(j\omega_a)
]

[
z_b=L(j\omega_b)
]

[
z_m=L\left(j\frac{\omega_a+\omega_b}{2}\right)
]

用以下判据判断是否继续细分。

几何误差：

[
e_{\text{chord}}
================

\left|
z_m-\frac{z_a+z_b}{2}
\right|
]

若：

[
e_{\text{chord}}

>

\varepsilon_{\text{geom}}\cdot S
]

则细分。这里 (S) 是当前图形尺度，例如：

[
S=\max(1,|z_a|,|z_b|,|z_m|)
]

还应加入角度变化判据。因为 Nyquist 判据关心对 (-1) 的绕行，所以建议监视：

[
\Delta\theta_{-1}
=================

\left|
\operatorname{unwrap}
\arg(1+z_b)
-----------

\operatorname{unwrap}
\arg(1+z_a)
\right|
]

如果：

[
\Delta\theta_{-1}

>

\theta_{\max}
]

则细分。可取：

[
\theta_{\max}=5^\circ\sim 10^\circ
]

还应监视普通相角变化：

[
\Delta\theta_{0}
================

\left|
\operatorname{unwrap}
\arg(z_b)
---------

\operatorname{unwrap}
\arg(z_a)
\right|
]

如果过大，也细分。

这个策略比只看曲线弯曲程度更安全，因为有时曲线看起来局部很直，但刚好从 (-1) 附近穿过，绕行判断会出错。

---

# 6. 高频截断 (\Omega) 的选择

设 (L(s)) 是有理函数，分母次数比分子次数高 (r) 阶：

[
r=\deg D-\deg N
]

高频时：

[
L(s)\sim K_\infty s^{-r}
]

若 (r>0)，则：

[
L(j\omega)\to 0
]

可根据尾部幅值选 (\Omega)：

[
|K_\infty|\Omega^{-r}
<
\varepsilon_{\text{tail}}
]

例如：

[
\varepsilon_{\text{tail}}
=========================

10^{-3}
]

或相对于当前绘图尺度：

[
|K_\infty|\Omega^{-r}
<
\varepsilon_{\text{tail}}S
]

实践上，可以从：

[
\Omega_0=10\max(1,|p_i|,|z_i|)
]

开始，逐步乘以 10，直到尾部条件满足。

如果 (r=0)，则：

[
L(j\omega)\to K_\infty
]

此时高频不趋于原点，而趋于有限常数。大圆弧映射也趋于这个有限常数。

如果 (r<0)，系统是非真有理函数，高频映射趋于无穷远。此时应把右半平面大圆弧也按“无穷远补弧”处理。这类对象通常不是物理可实现的开环传递函数，程序应给出警告。

---

# 7. 右半平面大圆弧的数据

大圆弧为：

[
s=\Omega e^{j\theta},
\qquad
\theta:\frac{\pi}{2}\to-\frac{\pi}{2}
]

计算：

[
z(\theta)=L(\Omega e^{j\theta})
]

若 (L(s)) 严格真有理，即 (r>0)，则这段映射在 (\Omega\to\infty) 时收缩到原点附近。为了完整性，程序可以输出这段 `big_arc` 数据，但通常它在图上只是原点附近的一小段。

如果只关心对 (-1) 的绕行，严格真有理系统的大圆弧通常不会影响判断，因为它远离 (-1)。

但如果要生成“完整曲线数据”，建议仍然输出：

```text
Segment {
    type: "big_arc",
    points: [L(Ω exp(jθ_i))],
    parameter_range: θ ∈ [π/2, -π/2]
}
```

若 (r>1)，大圆弧在原点附近可能有多个相位变化，但半径很小。为避免渲染时完全塌缩，可以附带元数据：

```text
metadata: {
    asymptotic_center: 0,
    asymptotic_order: r,
    collapsed: true
}
```

是否把它画成小半径辅助弧，属于渲染层决定。

---

# 8. 虚轴极点的无穷远补弧

这是核心。

设虚轴极点为：

[
p_k=j\omega_k
]

阶数为：

[
q_k
]

主部系数为：

[
A_k
]

程序中的 Nyquist contour 沿虚轴向上走。绕开该极点时，右半平面小半圆为：

[
s=p_k+\rho e^{j\theta},
\qquad
\theta:-\frac{\pi}{2}\to+\frac{\pi}{2}
]

在 (L) 平面中：

[
L(s)
\sim
A_k\rho^{-q_k}e^{-jq_k\theta}
]

因此当 (\theta) 从 (-\pi/2) 到 (+\pi/2) 时，(L(s)) 的相角变化为：

[
\Delta\phi=-q_k\pi
]

也就是：

[
\boxed{
\text{一个 }q_k\text{ 阶虚轴极点，对应无穷远处顺时针扫过 }q_k\pi
}
]

起始角为：

[
\phi_{\text{start}}
===================

\arg A_k
+
q_k\frac{\pi}{2}
]

终止角为：

[
\phi_{\text{end}}
=================

## \arg A_k

q_k\frac{\pi}{2}
]

这段补弧在数学上位于无穷远处。程序中不要用极小 (\rho) 直接评价 (L(s)) 来硬画，因为会带来溢出、重叠和尺度灾难。

应把它作为专门的 `infinity_arc` 段生成。

---

# 9. 多圈无穷远补弧的确定性方案：分层半圆法

如果 (q_k=1)，补弧扫过 (180^\circ)。用一个很大的半圆即可。

如果 (q_k=2)，补弧扫过 (360^\circ)。如果直接用同一个半径画一整圈，会闭合在自身上。

如果 (q_k>2)，会出现多圈无穷远圆弧，直接画会严重重叠。

所以建议采用一个确定的“分层半圆法”。

基本思想：把 (q_k\pi) 的总扫角拆成 (q_k) 个半圆，每个半圆使用不同的大半径。半圆之间用径向连接线相连。所有这些曲线都在一个足够大的外部区域中，因此不会改变它们对 (-1) 的绕行关系。

设显示用的基础无穷远半径为：

[
R_{\infty}
]

层间距为：

[
\Delta R
]

例如：

[
\Delta R=0.08R_{\infty}
]

对第 (k) 个虚轴极点，其补弧分为 (q_k) 个半圆。第 (h) 个半圆，(h=0,1,\dots,q_k-1)，角度为：

[
\phi_h(t)
=========

## \phi_{\text{start}}

(h+t)\pi,
\qquad
t\in[0,1]
]

半径为：

[
R_h
===

R_{\infty}
+
\ell_h\Delta R
]

其中 (\ell_h) 是全局唯一的层编号。

对应数据点为：

[
z_h(t)
======

R_h e^{j\phi_h(t)}
]

半圆之间的径向连接线为：

[
z_{\text{conn},h}(\lambda)
==========================

\left[
(1-\lambda)R_h+\lambda R_{h+1}
\right]
e^{j\phi_{\text{start}}-(h+1)\pi}
]

其中：

[
\lambda\in[0,1]
]

这样，一个 (q=4) 的虚轴极点不会被画成在同一半径上的两圈重叠圆，而是四个半圆分别位于四个半径层上，中间用径向线连接。

这不是在声称真实 Nyquist 曲线在无穷远处有这些不同半径。它是一个可视化表示。数学上，这些曲线都处在包围 (-1) 的大圆之外，可以连续变形成真实的无穷远补弧，因此保留了绕行数。

---

# 10. 基础无穷远半径 (R_{\infty}) 的选择

先采样所有普通有限段，得到有限点集合：

[
\mathcal Z_{\text{finite}}
]

设：

[
R_{\text{finite}}
=================

\max_{z\in \mathcal Z_{\text{finite}}}|z|
]

再取：

[
R_{\infty}
==========

\gamma\max(1,R_{\text{finite}},|-1|)
]

通常：

[
\gamma=1.5\sim 3
]

如果希望无穷远补弧明显在外部，可以取：

[
R_{\infty}=2.5\max(1,R_{\text{finite}})
]

如果普通有限段本身因为靠近虚轴极点已经被截断到 (R_{\text{entry}})，则可直接取：

[
R_{\infty}=1.2R_{\text{entry}}
]

然后用：

[
R_h=R_{\infty}+\ell_h\Delta R
]

保证所有无穷远补弧都在有限曲线外侧。

---

# 11. 与普通频率响应段的连接

普通频率响应段在极点下方停止于：

[
z_k^-
=====

L(j(\omega_k-\delta_k))
]

在极点上方重新开始于：

[
z_k^+
=====

L(j(\omega_k+\delta_k))
]

理论无穷远补弧的起止方向是：

[
\phi_{\text{start}}
===================

\arg A_k
+
q_k\frac{\pi}{2}
]

[
\phi_{\text{end}}
=================

## \arg A_k

q_k\frac{\pi}{2}
]

构造连接时，不建议强行让 (z_k^-) 和补弧第一个点完全相同，因为 (z_k^-) 是有限截断点，而补弧是无穷远表示。

可使用两段连接。

第一段，从实际截断点连接到外层起点：

[
z_{\text{entry}}(\lambda)
=========================

(1-\lambda)z_k^-
+
\lambda R_0 e^{j\phi_{\text{start}}}
]

其中 (R_0) 是该补弧第一层半径。

最后一段，从外层终点连接到实际截断点：

[
z_{\text{exit}}(\lambda)
========================

(1-\lambda)R_{q_k-1}e^{j\phi_{\text{end}}}
+
\lambda z_k^+
]

如果 (\delta_k) 选得合理，(z_k^-) 的方向会接近 (\phi_{\text{start}})，(z_k^+) 的方向会接近 (\phi_{\text{end}})，连接段不会产生明显扭曲。

如果要更严格，可以把 (z_k^-) 和 (z_k^+) 投影到对应方向：

[
\tilde z_k^- = |z_k^-|e^{j\phi_{\text{start}}}
]

[
\tilde z_k^+ = |z_k^+|e^{j\phi_{\text{end}}}
]

然后连接：

[
z_k^- \to \tilde z_k^- \to R_0 e^{j\phi_{\text{start}}}
]

[
R_{q_k-1}e^{j\phi_{\text{end}}} \to \tilde z_k^+ \to z_k^+
]

这能让补弧起止角严格由主部系数控制。

---

# 12. 原点多重积分环节的专门形式

如果原点有 (\nu) 个积分环节：

[
L(s)\sim \frac{A_0}{s^\nu}
]

则：

[
q_0=\nu
]

[
p_0=0
]

[
A_0=\lim_{s\to0}s^\nu L(s)
]

绕过原点右半小半圆：

[
s=\rho e^{j\theta},
\qquad
\theta:-\frac{\pi}{2}\to+\frac{\pi}{2}
]

映射为：

[
L(s)\sim A_0\rho^{-\nu}e^{-j\nu\theta}
]

所以补弧扫过：

[
-\nu\pi
]

若 (A_0>0)，则：

[
\phi_{\text{start}}=\nu\frac{\pi}{2}
]

[
\phi_{\text{end}}=-\nu\frac{\pi}{2}
]

例如：

一个积分环节：

[
\nu=1
]

从 (+j\infty) 到 (-j\infty)，顺时针半圈。

两个积分环节：

[
\nu=2
]

从 (-\infty) 到 (-\infty)，顺时针一整圈。

三个积分环节：

[
\nu=3
]

从 (-j\infty) 到 (+j\infty)，顺时针 (1.5) 圈。

如果直接画在同一半径上，(\nu\ge 4) 时会出现多圈重合。用上面的分层半圆法即可避免。

---

# 13. 伪代码：完整曲线数据生成

下面是核心逻辑。

```text
function nyquist_data(L):

    # 1. 分析系统
    poles = compute_poles(L)
    zeros = compute_zeros(L)
    imag_poles = select poles with abs(real(p)) < tol_pole
    for each imag_pole:
        p_k = j * omega_k
        q_k = multiplicity(p_k)
        A_k = principal_coefficient(L, p_k, q_k)

    r = relative_degree(L)
    K_inf = high_frequency_coefficient(L)

    # 2. 确定高频截断
    Omega = choose_frequency_cutoff(L, poles, zeros, r, K_inf, eps_tail)

    # 3. 初步估计有限尺度
    #    可以先不靠近虚轴极点，粗采样一次
    finite_probe_points = coarse_sample_regular_parts(L, Omega, imag_poles)
    R_finite = max(abs(finite_probe_points), 1)

    # 4. 确定无穷远显示尺度
    R_entry = alpha_entry * R_finite
    R_inf   = alpha_inf   * R_finite
    dR      = beta_layer  * R_inf

    # 5. 为每个虚轴极点确定绕行缺口 delta_k
    for each imag_pole k:
        delta_k = (abs(A_k) / R_entry)^(1/q_k)
        delta_k = clamp_by_spacing(delta_k, imag_poles, Omega)

    # 6. 构造普通虚轴频率区间
    intervals = split([-Omega, Omega], imag_poles, delta_k)

    segments = []

    # 7. 普通频率响应段
    for interval [wa, wb] in intervals:
        pts = adaptive_sample(lambda w: L(j*w), wa, wb)
        segments.append(Segment(type="regular", points=pts))

    # 8. 虚轴极点的无穷远补弧
    layer_counter = 0
    for pole k in imag_poles ordered by omega_k increasing:

        phi0 = arg(A_k) + q_k*pi/2
        phi1 = arg(A_k) - q_k*pi/2

        z_minus = L(j*(omega_k - delta_k))
        z_plus  = L(j*(omega_k + delta_k))

        # 入口连接
        R0 = R_inf + layer_counter*dR
        segments.append(connector(z_minus, R0*exp(j*phi0)))

        for h in 0..q_k-1:
            layer = layer_counter
            R_layer = R_inf + layer*dR

            phi_start_h = phi0 - h*pi
            phi_end_h   = phi0 - (h+1)*pi

            pts_arc = [
                R_layer * exp(j*((1-t)*phi_start_h + t*phi_end_h))
                for t in linspace(0,1,N_arc)
            ]

            segments.append(Segment(
                type="infinity_arc",
                points=pts_arc,
                metadata={pole:p_k, order:q_k, half_turn:h, layer:layer}
            ))

            # 半圆之间的径向连接
            if h < q_k - 1:
                R_next = R_inf + (layer_counter+1)*dR
                phi_mid = phi_end_h
                pts_conn = [
                    ((1-lambda)*R_layer + lambda*R_next)*exp(j*phi_mid)
                    for lambda in linspace(0,1,N_conn)
                ]
                segments.append(Segment(type="connector", points=pts_conn))

            layer_counter += 1

        # 出口连接
        R_last = R_inf + (layer_counter-1)*dR
        segments.append(connector(R_last*exp(j*phi1), z_plus))

    # 9. 右半平面大圆弧
    if r >= 0:
        pts_big = adaptive_sample(
            lambda theta: L(Omega * exp(j*theta)),
            pi/2,
            -pi/2
        )
        segments.append(Segment(type="big_arc", points=pts_big))
    else:
        # 非真有理：大圆弧也趋于无穷远
        segments += build_infinity_arc_for_big_semicircle(L, r, K_inf)

    return segments
```

注意：上面伪代码中，无穷远补弧按虚轴极点顺序插入；如果想完全保持 contour 的点序，普通频率响应段和对应补弧应交替加入，而不是先全部加入普通段再加入补弧。更准确的结构是：

```text
regular interval below pole
infinity arc around pole
regular interval above pole
infinity arc around next pole
...
big arc
```

---

# 14. 自适应采样函数的建议

普通曲线段可以使用如下递归逻辑：

```text
function adaptive_sample(f, a, b):

    za = f(a)
    zb = f(b)
    zm = f((a+b)/2)

    err_geom = abs(zm - (za+zb)/2)

    err_angle_critical = abs(
        unwrap(arg(1+zb) - arg(1+za))
    )

    err_angle_origin = abs(
        unwrap(arg(zb) - arg(za))
    )

    if err_geom < tol_geom * scale
       and err_angle_critical < tol_angle
       and err_angle_origin < tol_angle
       and recursion_depth < max_depth:
           return [za, zb]
    else:
           return adaptive_sample(f,a,(a+b)/2)
                  + adaptive_sample(f,(a+b)/2,b)
```

其中：

[
\arg(1+z)
]

用于监视对关键点 (-1) 的绕行；

[
\arg(z)
]

用于监视曲线本身相角突变。

这比只用 `PlotPoints` 更稳健。Wolfram 文档中 `NyquistPlot` 也保留了 `PlotPoints` 和 `MaxRecursion` 这类自适应绘图控制参数，但它没有公开完整内部算法；程序实现上可以采用上述等价思想。([Wolfram 文档中心][1])

---

# 15. 渐近线数据的计算

渐近线是辅助线，不是 Nyquist contour 的一部分。

## 15.1 低频渐近线

若原点有 (\nu) 个积分环节：

[
L(s)\sim \frac{A_0}{s^\nu}
]

则正频率低频分支：

[
L(j\omega)
\sim
A_0\omega^{-\nu}e^{-j\nu\pi/2}
]

方向角为：

[
\phi_{0,+}
==========

\arg A_0-\nu\frac{\pi}{2}
]

负频率方向角为：

[
\phi_{0,-}
==========

\arg A_0+\nu\frac{\pi}{2}
]

辅助线数据可取：

[
z(r)=r e^{j\phi_{0,+}},
\qquad
r\in[R_{\text{min}},R_{\text{max}}]
]

和：

[
z(r)=r e^{j\phi_{0,-}}
]

如果不止有 (A_0/s^\nu) 项，还希望画更准确的低频渐近直线，可以展开：

[
L(s)
====

\frac{A_0}{s^\nu}
+
\frac{A_1}{s^{\nu-1}}
+\cdots
]

对于一个积分环节，常见情况是：

[
L(j\omega)
\approx
\frac{A_0}{j\omega}+A_1
]

所以渐近线不是穿过原点的射线，而是带有横向偏移的直线：

[
z(\omega)
\approx
A_1
---

j\frac{A_0}{\omega}
]

这时辅助线可以直接按该低阶展开生成，而不是只画射线。

## 15.2 高频渐近线

若相对阶次为 (r>0)：

[
L(s)\sim K_\infty s^{-r}
]

正频率高频方向为：

[
\phi_{\infty,+}
===============

\arg K_\infty-r\frac{\pi}{2}
]

因此曲线从该方向趋近原点：

[
z(\rho)=\rho e^{j\phi_{\infty,+}},
\qquad
\rho\to0
]

负频率方向为：

[
\phi_{\infty,-}
===============

\arg K_\infty+r\frac{\pi}{2}
]

辅助线可用小半径线段生成：

[
z(\rho)=\rho e^{j\phi_{\infty,+}},
\qquad
\rho\in[0,\rho_{\max}]
]

---

# 16. 稳定裕度辅助线的数据

## 16.1 关键点

关键点数据：

[
z_c=-1+j0
]

可以作为单点输出：

```text
critical_point = -1 + 0j
```

## 16.2 增益交叉点

增益交叉频率满足：

[
|L(j\omega)|=1
]

数值上在采样网格中找符号变化：

[
g(\omega)=\log |L(j\omega)|
]

若：

[
g(\omega_i)g(\omega_{i+1})<0
]

则用一维求根得到：

[
\omega_{gc}
]

对应点：

[
z_{gc}=L(j\omega_{gc})
]

相位裕度：

[
PM
==

\pi+\arg L(j\omega_{gc})
]

注意要用展开相位。

辅助线可包括：

1. 单位圆：

[
z=e^{j\theta}
]

2. 从原点到 (z_{gc}) 的射线；
3. 从 (-1) 到 Nyquist 曲线附近的角度标识数据。

## 16.3 相位交叉点

相位交叉频率满足：

[
\operatorname{Im}L(j\omega)=0
]

且：

[
\operatorname{Re}L(j\omega)<0
]

数值上对：

[
h(\omega)=\operatorname{Im}L(j\omega)
]

找符号变化并求根。

得到：

[
\omega_{pc}
]

[
z_{pc}=L(j\omega_{pc})
]

若：

[
z_{pc}=-a,\qquad a>0
]

则增益裕度：

[
GM=\frac{1}{a}
]

辅助线可包括负实轴线段：

[
z=x,\qquad x\in[-R_{\text{aux}},0]
]

以及从原点到 (z_{pc}) 的线段。

---

# 17. Nyquist 网格线数据

Wolfram 的 `NyquistGridLines` 是 `NyquistPlot` 的一个选项，用于绘制闭环系统的等幅值、等相位轮廓；文档中也说明了可以指定幅值与相位轮廓，幅值取绝对值，相位用弧度。([Wolfram 文档中心][2])

负反馈下闭环传递函数为：

[
T=\frac{L}{1+L}
]

设 Nyquist 平面变量为：

[
z=x+jy=L(j\omega)
]

则：

[
T(z)=\frac{z}{1+z}
]

## 17.1 闭环等幅值曲线

令：

[
|T|=M
]

即：

[
\left|\frac{z}{1+z}\right|=M
]

得到：

[
x^2+y^2
=======

M^2\left[(1+x)^2+y^2\right]
]

当 (M\ne1) 时，这是圆：

[
\left(
x-\frac{M^2}{1-M^2}
\right)^2
+
y^2
===

\left(
\frac{M}{|1-M^2|}
\right)^2
]

圆心：

[
c_M=
\frac{M^2}{1-M^2}
]

半径：

[
r_M=
\frac{M}{|1-M^2|}
]

当：

[
M=1
]

退化为直线：

[
x=-\frac{1}{2}
]

所以等幅值网格线数据为：

[
z(\theta)=c_M+r_M e^{j\theta}
]

其中：

[
\theta\in[0,2\pi]
]

对于 (M=1)，输出直线段：

[
z(y)=-\frac{1}{2}+jy
]

其中 (y) 的范围由当前图形尺度决定。

## 17.2 闭环等相位曲线

令：

[
\arg T=\varphi
]

即：

[
\arg\left(\frac{z}{1+z}\right)=\varphi
]

可得：

[
y\cos\varphi
------------

# \left[x(1+x)+y^2\right]\sin\varphi

0
]

当：

[
\sin\varphi\ne0
]

可整理为圆：

[
\left(x+\frac{1}{2}\right)^2
+
\left(
y-\frac{1}{2}\cot\varphi
\right)^2
=========

\left(
\frac{1}{2}\csc\varphi
\right)^2
]

所以圆心为：

[
c_\varphi
=========

-\frac{1}{2}
+
j\frac{1}{2}\cot\varphi
]

半径为：

[
r_\varphi
=========

\frac{1}{2|\sin\varphi|}
]

等相位网格线数据为：

[
z(\theta)=c_\varphi+r_\varphi e^{j\theta}
]

当：

[
\varphi=0
]

或：

[
\varphi=\pi
]

退化为实轴相关分支，需要根据 (T) 的正负方向限制区域。程序中可以简单输出实轴辅助线，再由渲染层裁剪。

---

# 18. 延迟系统的处理

若：

[
L(s)=R(s)e^{-\tau s}
]

则：

[
L(j\omega)=R(j\omega)e^{-j\tau\omega}
]

幅值由 (R(j\omega)) 决定，相位额外增加：

[
-\tau\omega
]

这会导致高频相位持续旋转。若 (R(s)) 严格真有理，幅值仍可能趋于 0，因此高频曲线会在原点附近绕很多圈。

程序处理延迟系统时应增加两个采样判据：

[
|\tau(\omega_b-\omega_a)|<\theta_{\max}
]

以及：

[
|\Delta \arg L(j\omega)|<\theta_{\max}
]

否则自适应采样会漏掉原点附近的多圈旋转。

如果高频尾部半径已经小于容差：

[
|R(j\omega)|<\varepsilon_{\text{tail}}
]

可以停止继续采样，并把剩余尾部标记为：

```text
Segment {
    type: "collapsed_tail",
    center: 0,
    residual_radius_bound: eps_tail
}
```

这比试图画无限多圈更合理。

---

# 19. 包围数的计算不应依赖可视化补弧

如果目标不仅是画图，还要算稳定性，建议直接用曲线数据计算：

[
N
=

\frac{1}{2\pi}
\Delta
\arg(1+L(s))
]

其中 (\Delta\arg) 沿完整 Nyquist contour 计算。

普通段可以用采样点：

[
\Delta\arg(1+z_i)
]

无穷远补弧也可以解析贡献。

对虚轴极点补弧：

[
z(\phi)=R e^{j\phi},\qquad R\to\infty
]

则：

[
1+z(\phi)\sim z(\phi)
]

因此补弧对 (\arg(1+z)) 的贡献近似等于补弧自身相角变化：

[
\Delta\arg(1+z)
===============

-q_k\pi
]

如果用了分层半圆法，程序也可以直接从生成的数据点计算；但更稳妥的是把解析贡献作为元数据保留：

```text
metadata: {
    winding_contribution_about_minus_one: -q_k / 2
}
```

一个 (q=2) 的虚轴极点补弧贡献为：

[
-1
]

即顺时针绕 (-1) 一圈。

注意：这个贡献是针对无穷远补弧本身的相角变化；总包围数还要加上普通频率响应段的贡献。

---

# 20. 推荐的数据输出结构

可以输出：

```text
NyquistData {
    segments: [
        Segment(type="regular", points=[...], omega_range=[...]),
        Segment(type="connector", points=[...]),
        Segment(type="infinity_arc", points=[...], metadata={...}),
        Segment(type="regular", points=[...]),
        Segment(type="big_arc", points=[...]),
        ...
    ],

    auxiliary: {
        critical_point: -1+0j,
        unit_circle: complex[],
        negative_real_axis: complex[],
        gain_crossover_points: complex[],
        phase_crossover_points: complex[],
        closed_loop_magnitude_grid: Segment[],
        closed_loop_phase_grid: Segment[],
        low_frequency_asymptotes: Segment[],
        high_frequency_asymptotes: Segment[]
    },

    diagnostics: {
        open_loop_RHP_poles: P,
        imaginary_axis_poles: [...],
        estimated_clockwise_encirclements: N,
        closed_loop_RHP_zeros: Z = P + N,
        frequency_cutoff: Omega,
        sampling_tolerance: ...
    }
}
```

其中对负反馈 Nyquist 判据，若采用“顺时针包围数为正”的约定，则 Wolfram 文档中的形式是闭环不稳定极点数可由开环不稳定极点数和对 (-1) 的顺时针包围数推得。([Wolfram 文档中心][1])

---

# 21. 一个简化例子：二重积分环节

设：

[
L(s)=\frac{K}{s^2(Ts+1)}
]

原点有二阶极点：

[
q=2
]

主部系数：

[
A_0=K
]

若 (K>0)，则：

[
\phi_{\text{start}}
===================

# \arg K+2\frac{\pi}{2}

\pi
]

[
\phi_{\text{end}}
=================

# \arg K-2\frac{\pi}{2}

-\pi
]

总扫角：

[
-2\pi
]

如果直接画，就是无穷远处一整圈，起点终点都在负实无穷远。

用分层半圆法：

第一段半圆：

[
\phi:\pi\to0
]

半径：

[
R_0=R_\infty
]

第二段半圆：

[
\phi:0\to-\pi
]

半径：

[
R_1=R_\infty+\Delta R
]

中间用实轴正方向上的径向连接线连接：

[
R_0\to R_1,\qquad \phi=0
]

最终从：

[
R_1e^{-j\pi}
]

连接回原点上方普通频率响应段的截断点。

这样既保留了顺时针一圈的绕行，又避免了一整圈重叠。

---

# 22. 关键实现原则总结

程序化绘制完整 Nyquist 曲线时，最可靠的逻辑是：

1. **不要直接在 (\omega\in(-\infty,+\infty)) 上硬采样。**
   应先找虚轴极点，把频率轴切成普通段和奇异段。

2. **普通段用自适应采样。**
   同时监视曲线几何误差、(\arg z) 的变化和 (\arg(1+z)) 的变化。

3. **虚轴极点不要用极小半圆直接数值评价。**
   用局部主部：

   [
   L(s)\sim\frac{A_k}{(s-p_k)^{q_k}}
   ]

   解析生成无穷远补弧。

4. **多重虚轴极点的无穷远补弧用分层半圆法。**
   把 (q_k\pi) 拆成 (q_k) 个半圆，每个半圆一个半径层，半圆之间用径向连接线。这是避免多圈重叠的确定性方案。

5. **右半平面大圆弧也应作为独立段处理。**
   严格真有理对象中它通常收缩到原点；非真有理对象中它可能进入无穷远，需要特殊处理。

6. **辅助线单独生成，不要混入主曲线。**
   包括 (-1) 点、单位圆、负实轴、增益/相位交叉点、闭环等幅值/等相位网格、低频/高频渐近线。

7. **稳定性包围数最好用相角增量单独计算。**
   不要依赖最终图像是否“看起来包围了 (-1)”。对于无穷远补弧，解析贡献应保留在元数据中。

[1]: https://reference.wolfram.com/language/ref/NyquistPlot.html "NyquistPlot—Wolfram Documentation"
[2]: https://reference.wolfram.com/language/ref/NyquistGridLines.html "NyquistGridLines—Wolfram Documentation"
