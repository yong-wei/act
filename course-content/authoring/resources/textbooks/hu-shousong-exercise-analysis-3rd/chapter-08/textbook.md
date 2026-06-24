<!-- source_pdf_page: 260 -->
## 第八章 非线性控制系统分析

8－1 某线性系统的结构图如图 8－76 所示，试分别绘制下列三种情况时，变量 $e$ 的相轨迹，并根据相轨迹分别作出相应的 $e(t)$ 曲线。
（1）$J=1, K_{1}=1, K_{2}=2$ ，初始条件 $e(0)=3$ ， $\dot{e}(0)=0 ; e(0)=1, \dot{e}(0)=-2.5$ ；
（2）$J=1, K_{1}=1, K_{2}=0.5$ ，初始条件 $e(0)= 3, \dot{e}(0)=0 ; e(0)=-3, \dot{e}(0)=0$ ；
（3）$J=1, K_{1}=1, K_{2}=0$ ，初始条件 $e(0)=1$ ， $\dot{e}(0)=1 ; ~ e(0)=0, \dot{e}(0)=2$ 。

![](assets/fig-08-76.png)

> Image description: A block diagram of a linear control system is shown. The input signal $r$ enters from the left into a summing junction with a positive sign. A feedback loop returns the output signal $c$ to this first junction with a negative sign. The resulting error signal proceeds toward a second summing junction, labeled as $e$. This second junction receives a positive input and a negative feedback signal coming from a block labeled $K_2s^2$. The output of this second junction enters a forward-path block defined by the transfer function $\frac{K_1}{Js^2}$. The output of this forward block is the system output $c$, which then splits into two paths: one returning directly to the first summing junction and another passing through the $K_2s^2$ block before entering the second summing junction. Arrows indicate the unidirectional flow of signals throughout the feedback architecture.
图8－76 题 8－1 系统结构图

解 本题首先应根据系统结构图写出相应的微分方程，得到解析表达式，再根据给定的系统参数和初始条件，绘制线性系统的相轨迹。

由线性系统结构图可知

$$
\begin{gathered}
\frac{C(s)}{E(s)}=\frac{\frac{K_{1}}{J s^{2}}}{1+\frac{K_{1} K_{2}}{J}}=\frac{K_{1}}{\left(J+K_{1} K_{2}\right) s^{2}} \\
\ddot{c}(t)=\frac{K_{1}}{J+K_{1} K_{2}} e(t)
\end{gathered}
$$

所以
输人比较点处 $e(t)=r(t)-c(t)=-c(t)$ ，整理上述关系式后有

$$
\begin{aligned}
\ddot{e}(t) & =-\frac{K_{1}}{J+K_{1} K_{2}} e(t) \\
\dot{e} \mathrm{~d} \dot{e} & =-\frac{K_{1}}{J+K_{1} K_{2}} e \mathrm{~d} e
\end{aligned}
$$

积分得

$$
\dot{e}^{2}(t)+\frac{K_{1}}{J+K_{1} K_{2}} e^{2}(t)=\dot{e}^{2}(0)+\frac{K_{1}}{J+K_{1} K_{2}} e^{2}(0)
$$

（1）$J=1, K_{1}=1, K_{2}=2$ 。当初始条件 $e(0)=3, \dot{e}(0)=0$ 时，有

$$
\dot{e}^{2}(t)+\frac{1}{3} e^{2}(t)=3
$$

显然，此时相轨迹为一中心在原点的椭圆。下面利用 MATLAB 程序 exe801．m，得相应的相轨迹和 $e(t)$ 零输人响应曲线分别如图 8－1－1、图 8－1－2 中的虚线所示。

MATLAB 程序：exe801．m

$$
\begin{aligned}
& \mathrm{t}=0: 0.01: 20 \\
& \mathrm{e} 01=\left[\begin{array}{ll}
3 & 0
\end{array}\right]^{\prime} \\
& \mathrm{e} 02=\left[\begin{array}{ll}
1 & -2.5
\end{array}\right]^{\prime}
\end{aligned}
$$

\％设定仿真时间为 20 s
\％设定初始条件 $e(0)=3, \dot{e}(0)=0$
\％设定初始条件 $e(0)=1, \dot{e}(0)=-2.5$



<!-- source_pdf_page: 261 -->
```
[t,e1] = ode45('sys801',t,e01);
```

\％求解初始条件 $e(0)=3, \dot{e}(0)=0$ 下的系统微分方程
$[\mathrm{t}, \mathrm{e} 2]=\operatorname{ode} 45\left({ }^{\prime} \mathrm{sys} 801{ }^{\prime}, \mathrm{t}, \mathrm{e} 02\right)$ ；
\％求解初始条件 $e(0)=1, \dot{e}(0)=-2.5$ 下的系统微分方程
figure（1）
plot（e1（：，1），e1（：，2），＇：＇，e2（：，1），e2（：，2））；
\％绘制系统相轨迹
axis equal；grid \％调整纵横坐标比例，保持图形并添加网格
figure（2）
$\operatorname{plot}(\mathrm{t}, \mathrm{e} 1(:, 1), \mathrm{t}, \mathrm{e} 2(:, 1))$ ；\％绘制系统误差响应曲线
grid
调用函数 sys801．m
function de $=\operatorname{sys801}(\mathrm{t}, \mathrm{e})$
\％描述系统的微分方程
$\mathrm{J}=1 ; \mathrm{K} 1=1 ; \mathrm{K} 2=2$ ；
\％系统参数 $J=1, K_{1}=1, K_{2}=2$
de1＝e（2）；
de2 $=-($ K1／$($ J + K1 $*$ K2 $)) * e(1)$ ；
de $=\left[\right.$ de1 de2 ${ }^{\prime}$ ；
当初始条件 $e(0)=1, \dot{e}(0)=-2.5$ 时，有

$$
\dot{e}^{2}(t)+\frac{1}{3} e^{2}(t)=6.583
$$

相轨迹为一中心在原点的椭圆。此时 MATLAB 程序 exe801．m 运行得到的相轨迹和 $e(t)$响应曲线为图 8－1－1、图 8－1－2 中的实线所示。

![](assets/fig-08-01-01.png)

> Image description: A technical plot showing a phase trajectory in a two-dimensional coordinate system. The image features a grid with a horizontal x-axis and a vertical y-axis, both scaled from -4 to 4 and -3 to 3 respectively. The figure displays two concentric ellipses centered at the origin (0,0). One ellipse is drawn with a solid black line, extending horizontally to approximately $\pm 4$ and vertically to approximately $\pm 2.5$. Inside this is a smaller ellipse represented by a dashed black line, extending horizontally to approximately $\pm 3$ and vertically to approximately $\pm 1.7$. Based on the provided caption, these curves represent phase trajectories of a system. The solid line specifically corresponds to the output of a MATLAB program (exe801.m) and relates to an error response curve $e(t)$. There are no arrows or variable labels within the plot area itself beyond the numerical axis markings.
图 8－1－1 题 8－1 系统（1）的相轨迹 （MATLAB）

![](assets/fig-08-01-01-2.png)

> Image description: The image shows a mathematical plot featuring two oscillating waveforms on a Cartesian coordinate system. The horizontal axis is numbered from 0 to 20 in increments of 2, while the vertical axis ranges from -5 to 5 in increments of 1. Two distinct curves are plotted: a solid line and a dashed line. Both exhibit sinusoidal behavior. The solid curve has a larger amplitude, oscillating between approximately -4.5 and +4.3, with peaks occurring near x=8.5 and x=19. The dashed curve has a smaller amplitude, oscillating between roughly -3 and +3, with its first trough around x=5 and its peak near x=11. The figure is captioned in Chinese as "图 8－1－1 题 8－1 系统（1）的相轨迹 （MATLAB）," indicating it represents phase trajectories for a specific system (System 1) from Problem 8-1, generated using MATLAB software.
图 8－1－2 题 8－1 系统（1）的 $e(t)$ 零输人响应曲线（MATLAB）

（2）$J=1, K_{1}=1, K_{2}=0.5$ 。初始条件 $e(0)=3, \dot{e}(0)=0$ 或 $e(0)=-3, \dot{e}(0)=0$ 时，均有

$$
\dot{e}^{2}(t)+\frac{2}{3} e^{2}(t)=6
$$

此时两个不同初始条件下的相轨迹同为一中心在原点的椭圆。改写 MATLAB 程序 exe801．m 中的参数和初始条件设置，得相应的相轨迹和 $e(t)$ 曲线分别如图 8－1－3、图 8－1－4所示。



<!-- source_pdf_page: 262 -->
![](assets/fig-08-01-03.png)

> Image description: The image shows a mathematical plot of a phase trajectory for "System (2)" from Problem 8-1, generated using MATLAB. The figure features a two-dimensional Cartesian coordinate system with a horizontal x-axis and a vertical y-axis. Both axes are labeled with numerical values: the x-axis ranges from -3 to 3, and the y-axis ranges from approximately -2.5 to 2.5. The central feature is a single, closed elliptical curve centered at the origin (0,0). The ellipse extends horizontally from -3 to 3 on the x-axis and vertically from roughly -2.4 to 2.4 on the y-axis. A grid of dashed lines provides a reference for these coordinates. There are no arrows or variables explicitly labeled within the plot area. In engineering terms, this represents a stable periodic orbit or a center in a phase plane analysis, indicating a system with sustained oscillations.
图 8－1－3 题 8－1 系统（2）的相轨迹 （MATLAB）

![](assets/fig-08-01-03-2.png)

> Image description: The image shows a mathematical plot featuring two sinusoidal waveforms on a Cartesian coordinate system. The horizontal axis (x-axis) is labeled with numerical values from 0 to 20 in increments of 2. The vertical axis (y-axis) ranges from -4 to 4, with major grid lines every unit. Two oscillating curves are plotted: one as a solid black line and the other as a dashed black line. Both waves share the same amplitude, peaking at approximately 3 and dipping to -3. They exhibit a phase shift; for instance, at $x=0$, the solid line starts at its minimum (-3) while the dashed line starts near its maximum (3). The curves intersect periodically throughout the domain. According to the caption "图 8－1－3 题 8－1 系统（2）的相轨迹 （MATLAB）", this figure represents a phase trajectory for system (2) from problem 8-1, generated using MATLAB software.
图 8－1－4 题 8－1系统（2）的 $e(t)$ 零输人响应曲线（MATLAB）

（3）$J=1, K_{1}=1, K_{2}=0$ 。当初始条件 $e(0)=1, \dot{e}(0)=1$ 时，有

$$
\dot{e}^{2}(t)+e^{2}(t)=2
$$

显然，此时相轨迹为一中心在原点、半径为 $\sqrt{2}$ 的圆。改写 MATLAB 程序 exe801．m 中的参数和初始条件设置，得相应的相轨迹和 $e(t)$ 曲线分别如图 8－1－5、图 8－1－6 中的虚线所示。

当初始条件 $e(0)=0, \dot{e}(0)=2$ 时，有

$$
\dot{e}^{2}(t)+e^{2}(t)=4
$$

此时相轨迹为一中心在原点、半径为 2 的圆。改写 MATLAB 程序 exe801．m 中的参数和初始条件设置，得相应的相轨迹和 $e(t)$ 曲线分别如图 8－1－5、图 8－1－6 中的实线所示。

![](assets/fig-08-01-05.png)

> Image description: The image displays a two-dimensional coordinate system with a grid of dashed lines. The horizontal axis (x-axis) and vertical axis (y-axis) are both labeled with numerical values ranging from -2 to 2, with increments of 0.5. Centrally located at the origin (0,0), there are two concentric circles. The outer circle is represented by a solid black line with a radius of 2 units, intersecting the axes at points (2,0), (-2,0), (0,2), and (0,-2). Inside this is a smaller circle represented by a dashed black line, which has a radius of approximately 1.3 to 1.4 units. In an engineering context, specifically regarding control systems or differential equations, this figure represents a phase portrait (phase trajectory) in the state space. The circles indicate periodic orbits around a stable equilibrium point at the origin, where the distance from the center corresponds to the system's energy level or amplitude.
图 8－1－5 题 8－1 系统（3）的相轨迹（MATLAB）

![](assets/fig-08-01-05-2.png)

> Image description: The image shows a mathematical plot featuring two periodic waveforms on a Cartesian coordinate system. The horizontal axis is numbered from 0 to 20 in increments of 2, while the vertical axis ranges from -2.5 to 2.5 with labels every 0.5 units. Two sinusoidal curves are plotted: one represented by a solid black line and the other by a dashed black line. The solid curve has a larger amplitude, peaking at approximately 2 and dipping to -2. Both waves share the same frequency and period, but they are shifted in phase relative to each other. Specifically, the dashed wave leads the solid wave. The figure is titled "图 8－1－5 题 8－1 系统（3）的相轨迹（MATLAB）," indicating it represents a phase trajectory for system (3) from problem 8-1, generated using MATLAB software. The plot illustrates the time-domain relationship between two oscillating signals in an engineering or physics context.
图 8－1－6 题 8－1 系统（3）的 $e(t)$ 零输人响应曲线（MATLAB）

8－2 设一阶非线性系统的微分方程为

$$
\dot{x}=-x+x^{3}
$$

试确定系统有几个平衡状态，分析各平衡状态的稳定性，并作出系统的相轨迹。
解 本题首先需解出系统的各个平衡状态点，通过解析法分析各个平衡状态点的稳定性，最后绘制该系统的概略相轨迹。
（1）求系统的平衡状态。令 $\dot{x}=0$ ，即

$$
\dot{x}=-x+x^{3}=x(x-1)(x+1)=0
$$

得系统的平衡状态为 $x_{e}=0,-1,1$ 。



<!-- source_pdf_page: 263 -->
（2）分析各个平衡状态的稳定性。设 $t=0$ 时系统的初始状态为 $x_{0}$ ，由微分方程可得

即

$$
\begin{gathered}
\frac{\mathrm{d} x}{x(x-1)(x+1)}=\mathrm{d} t \\
\left(-\frac{1}{x}+\frac{1 / 2}{x-1}+\frac{1 / 2}{x+1}\right) \mathrm{d} x=\mathrm{d} t \\
x^{2}=\frac{x_{0}^{2} \mathrm{e}^{-2 t}}{1-x_{0}^{2}+x_{0}^{2} \mathrm{e}^{-2 t}}
\end{gathered}
$$

积分得
当然，利用 MATLAB 的 dsolve 函数也可以得到上述结果，其命令语句如下：

$$
\text { dsolve(' } \left.D x=-x+x 3^{\prime},{ }^{\prime} x(0)=a^{\prime}\right) \quad \text { \% } a \text { 表示初始条件 }
$$

相应的时间响应随初始条件而变。当初始条件 $\left|x_{0}\right|<1$ 时， $1-x_{0}^{2}>0$ ，并且随着 $t$ 的增大，上式分子的衰减速率大于分母的衰减速率，使得 $x(t)$ 递减，并收玫至平衡原点 $x_{e}=0$ ；而当 $\left|x_{0}\right|>1$ 时， $1-x_{0}^{2}<0$ ，若 $t<\frac{1}{2} \ln \frac{x_{0}^{2}}{x_{0}^{2}-1}$ ，随着 $t$ 增大，上式分母的衰减速率大于分子的衰减速率，因此 $x(t)$ 递增；尤其当 $t=\frac{1}{2} \ln \frac{x_{0}^{2}}{x_{0}^{2}-1}$ 时，上式分母 $1-x_{0}^{2}+x_{0}^{2} \mathrm{e}^{-2 t}=0, x(t)$ 为无穷大，系统发散不稳定。
（3）应用下列简单的 MATLAB 命令，可得系统的相轨迹如图 8－2－1 所示。
MATLAB 程序 ：exe802．m

$$
\begin{aligned}
& x=-1.5: 0.01: 1.5 \\
& d x=-x+x . \wedge^{\wedge} 3 \\
& \operatorname{plot}(x, d x) ; \operatorname{grid}
\end{aligned}
$$

![](assets/fig-08-02-01.png)

> Image description: This image shows a phase portrait plot generated by MATLAB for a dynamical system, labeled as "图 8－2－1 题 8－2 系统的相轨迹". The graph plots the derivative of state $x$ (denoted as $\dot{x}$ on the vertical axis) against the state variable $x$ (on the horizontal axis). Both axes range from -2 to 2. The plot features a cubic-like curve with three equilibrium points where $\dot{x} = 0$. The region between approximately $x = -2$ and $x = 1$, demarcated by vertical dashed lines, is labeled as "稳定区域" (stable region). Within this zone, arrows on the curve point toward the central equilibrium point. Outside these boundaries—specifically for $x < -2$ and $x > 1$—the regions are labeled as "不稳定区域" (unstable region), where arrows indicate trajectories moving away from the center. This visualization represents the stability analysis of a first-order nonlinear system.
图 8－2－1 题 8－2 系统的相轨迹（MATLAB）

（4）由以上分析可知，非线性系统可能存在多个平衡状态，平衡状态的稳定性不仅与系统的结构和参数有关，而且与系统的初始条件也有直接关系。

8－3 试确定下列方程的奇点及其类型，并用等倾线法或 MATLAB 法绘制它们的相平



<!-- source_pdf_page: 264 -->
面图：
（1）$\ddot{x}+\dot{x}+|x|=0$ ；
（2）$\ddot{x}+x+\operatorname{sign} \dot{x}=0$ ；
（3）$\ddot{x}+\sin x=0$ ；
（4）$\ddot{x}+|x|=0$ ；
（5）$\left\{\begin{array}{l}\dot{x}_{1}=x_{1}+x_{2}, \\ \dot{x}_{2}=2 x_{1}+x_{2} 。\end{array}\right.$

解 本题首先应求出各个系统的奇点，然后计算各奇点处的增量线性化方程，根据特征根确定奇点类型，再用等倾线法或 MATLAB 法绘制各个系统的相轨迹。
（1）$\ddot{x}+\dot{x}+|x|=0$
将原方程改写为

$$
\begin{cases}\ddot{x}+\dot{x}+x=0, & x \geqslant 0 \\ \ddot{x}+\dot{x}-x=0, & x<0\end{cases}
$$

系统的特征方程为

$$
\begin{cases}s^{2}+s+1=0, & x \geqslant 0 \\ s^{2}+s-1=0, & x<0\end{cases}
$$

相应的特征根为

$$
\begin{array}{lll}
s_{1.2}=-0.5 \pm \mathrm{j} 0.866, & \text { (稳定焦点) } & x \geqslant 0 \\
s_{3}=-1.618, \quad s_{4}=0.618, & \text { (鞍点) } & x<0
\end{array}
$$

由于

$$
\ddot{x}=-\dot{x}-|x|, \quad \frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=-1-\frac{|x|}{\dot{x}}
$$

令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\alpha$ ，得等倾线方程为 $\dot{x}=-\frac{1}{1+\alpha}|x|$ 。
下表给出了不同 $\alpha$ 值下等倾线的斜率：

| $\alpha$ | -3 | -2 | -1 | 0 | 1 | 2 | $\infty$ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $-\frac{1}{1+\alpha}$ | $\frac{1}{2}$ | 1 | $\infty$ | -1 | $-\frac{1}{2}$ | $-\frac{1}{3}$ | 0 |

根据表格或 MATLAB 作出相轨迹图，如图 8－3－1 所示。

![](assets/fig-08-03-01.png)

> Image description: This image shows a phase portrait (phase trajectory plot) from a textbook, labeled as Figure 8-3-1 according to the Chinese caption. The graph is plotted on a Cartesian coordinate system where the horizontal axis represents the variable $x$ and the vertical axis represents its time derivative $\dot{x}$. The axes range from approximately $-8$ to $8$ for $x$ and $-4$ to $3$ for $\dot{x}$, with a grid overlay. The plot consists of multiple curved trajectories (phase paths) with directional arrows indicating the flow of the system over time. Several distinct behaviors are visible: some trajectories converge toward an equilibrium point near the origin, while others diverge or loop. A prominent linear-like boundary separates different regions of trajectory behavior. In engineering terms, this figure visualizes the stability and dynamic evolution of a second-order differential equation in state space.
图 8－3－1 题 8－3 系统（1）相轨迹（MATLAB）

![](assets/fig-08-03-01-2.png)

> Image description: A black-and-white technical plot showing the phase trajectories of a dynamical system, generated in MATLAB. The image features a two-dimensional Cartesian coordinate system with the horizontal axis labeled $x$ and the vertical axis labeled $\dot{x}$. Both axes range from $-5$ to $5$, with grid lines every unit. The figure displays several curved trajectory lines with directional arrows indicating the flow of the system over time. The trajectories exhibit a spiral behavior, rotating around a central point near the origin $(0, 0)$. A distinct horizontal line segment exists on the $\dot{x} = 0$ axis between $x=0$ and approximately $x=1.5$, suggesting a discontinuity or a specific constraint in the system's state space. Roman numerals I, II, and III are placed along the left vertical axis to denote different regions of the phase plane. The caption identifies this as "图 8－3－1 题 8－3 系统（1）相轨迹," referring to the phase trajectories of System (1).
图 8－3－2 题 8－3 系统（2）相轨迹（MATLAB）

（2）$\ddot{x}+x+\operatorname{sign} \dot{x}=0$
将原方程改写为



<!-- source_pdf_page: 265 -->
$$
\begin{cases}\ddot{x}+x+1=0, & \dot{x}>0 \\ \ddot{x}+x=0, & \dot{x}=0 \\ \ddot{x}+x-1=0, & \dot{x}<0\end{cases}
$$

系统的特征方程为 $s^{2}+1=0$ ，特征根 $s_{1,2}= \pm \mathrm{j}$ ，奇点为中心点。
在 I 区 $(\dot{x}>0), \dot{x} \frac{\mathrm{~d} \dot{x}}{\mathrm{~d} x}=-x-1$ 。令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\alpha$ ，得等倾线方程为 $\dot{x}=-\frac{x+1}{\alpha}$ 。
在II区 $(\dot{x}=0)$ ，等倾线位于 $x$ 轴上。
在 III区 $(\dot{x}<0), \dot{x} \frac{\mathrm{~d} \dot{x}}{\mathrm{~d} x}=-x+1$ 。令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\alpha$ ，得等倾线方程为 $\dot{x}=-\frac{x-1}{\alpha}$ 。
下表给出了不同 $\alpha$ 值下等倾线的斜率：

| $\alpha$ | $-\infty$ | －3 | －1 | $-\frac{1}{3}$ | 0 | $\frac{1}{3}$ | 1 | 3 | $\infty$ |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| $-\frac{1}{\alpha}$ | 0 | $\frac{1}{3}$ | 1 | 3 | $-\infty$ | －3 | －1 | $-\frac{1}{3}$ | 0 |

根据表格作出概略相轨迹图，如图 8－3－2 所示。由图可见，系统运动最终收敛到（ -1 ， 1）之间。奇点在 $(-1,1)$ 之间连成一条线，称之为奇线。
（3）$\ddot{x}+\sin x=0$
令 $\ddot{x}=\dot{x}=0$ ，则 $\sin x=0$ ，得系统的奇点为

$$
x_{e}=0, \pm \pi, \pm 2 \pi, \cdots
$$

当 $x_{e}=2 k \pi, k=0, \pm 1, \pm 2, \cdots$ 时，令 $x=2 k \pi+x_{0}$ ，原方程变为

$$
\ddot{x}=\ddot{x}_{0}=-\sin \left(2 k \pi+x_{0}\right)=-\sin x_{0}
$$

在奇点 $x_{0}=0$（即 $x_{e}=2 k \pi$ ）处的线性化方程为

$$
\ddot{x}_{0}=-x_{0}
$$

特征方程为

$$
s^{2}+1=0
$$

特征根为 $s_{1,2}= \pm \mathrm{j}$ ，奇点为中心点。
当 $x_{e}=(2 k+1) \pi, k=0, \pm 1, \pm 2, \cdots$ 时，令 $x=(2 k+1) \pi+x_{0}$ ，原方程变为

$$
\ddot{x}=\ddot{x}_{0}=-\sin \left[(2 k+1) \pi+x_{0}\right]=\sin x_{0}
$$

在奇点 $x_{0}=0$（即 $\left.x_{e}=(2 k+1) \pi\right)$ 处的线性化方程为

$$
\ddot{x}_{0}=x_{0}
$$

特征方程为

$$
s^{2}-1=0
$$

特征根为 $s_{1,2}= \pm 1$ ，奇点为鞍点。
令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\alpha$ ，得等倾线方程为

$$
\dot{x}=-\frac{1}{\alpha} \sin x
$$

下表给出了不同 $\alpha$ 值下等倾线的斜率。



<!-- source_pdf_page: 266 -->
| $\alpha$ | -2 | -1 | $-\frac{1}{2}$ | $-\frac{1}{4}$ | 0 | $\frac{1}{4}$ | $\frac{1}{2}$ | 1 | 2 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $-\frac{1}{\alpha}$ | $\frac{1}{2}$ | 1 | 2 | 4 | $\infty$ | -4 | -2 | -1 | $-\frac{1}{2}$ |

根据表格作出概略相轨迹，如图 8－3－3 所示。

![](assets/fig-08-03-03.png)

> Image description: A black-and-white textbook figure showing a phase portrait in the $\dot{x}$ versus $x$ plane. The horizontal axis is labeled $x$, with marked values at $-2\pi, -\pi, 0, \pi,$ and $2\pi$. The vertical axis is labeled $\dot{x}$. The plot displays periodic trajectories consisting of alternating centers and saddle points along the x-axis. Centers are located at $x = -2\pi, 0,$ and $2\pi$, characterized by closed concentric circular orbits with counter-clockwise arrows. Saddle points are positioned at $x = -\pi$ and $\pi$, where trajectories converge and diverge in a hyperbolic pattern. The flow lines (phase trajectories) connect these equilibrium points, illustrating the global dynamics of a nonlinear system. The caption indicates that this is a sketch of phase trajectories based on a provided table, labeled as Figure 8-3-3.
图8－3－3 题8－3系统（3）相轨迹

（4）$\ddot{x}+|x|=0$
原系统方程改写为

$$
\begin{cases}\ddot{x}+x=0, & x \geqslant 0 \\ \ddot{x}-x=0, & x<0\end{cases}
$$

系统的特征方程为

$$
\begin{cases}s^{2}+1=0, & x \geqslant 0 \\ s^{2}-1=0, & x<0\end{cases}
$$

相应的特征根为

$$
\begin{array}{lr}
s_{1,2}= \pm \mathrm{j}, & \text { (中心点) } \quad x \geqslant 0 \\
s_{3,4}= \pm 1, & \text { (鞍点) } \quad x<0 \\
\ddot{x}=-|x|, & \dot{x} \frac{\mathrm{~d} \dot{x}}{\mathrm{~d} x}=-|x|
\end{array}
$$

由于

$$
\dot{x}=-\frac{1}{\alpha}|x|
$$

令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\alpha$ ，得等倾线方程为

下表给出了不同 $\alpha$ 值下等倾线的斜率。

| $\alpha$ | $-\infty$ | －3 | －1 | $-\frac{1}{3}$ | 0 | $\frac{1}{3}$ | 1 | 3 | $\infty$ |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| $-\frac{1}{\alpha}$ | 0 | $\frac{1}{3}$ | 1 | 3 | $-\infty$ | －3 | －1 | $-\frac{1}{3}$ | 0 |

根据表格或 MATLAB 作出系统的相轨迹，如图 8－3－4 所示。由图可见，系统由初始条件出发，向 $x$ 轴负方向运动，发散不稳定。
（5）$\left\{\begin{array}{l}\dot{x}_{1}=x_{1}+x_{2} \\ \dot{x}_{2}=2 x_{1}+x_{2}\end{array}\right.$



<!-- source_pdf_page: 267 -->
![](assets/fig-08-03-04.png)

> Image description: This image is a phase portrait plot generated in MATLAB, labeled as "图 8－3－4 题 8－3 系统（4）相轨迹". The graph features a two-dimensional coordinate system where the horizontal axis represents the variable $x$ and the vertical axis represents its time derivative $\dot{x}$. Both axes range approximately from -10 to 8. The plot displays multiple curved phase trajectories with directional arrows indicating the flow of the system over time. These trajectories originate from the lower-left quadrant, curve upward and to the right, and then loop back toward the left. A horizontal dashed line is positioned at $\dot{x} = 3$, intersecting several trajectories. The overall pattern shows a non-linear dynamical system where states evolve in a cyclic or spiraling manner across the phase plane, illustrating the relationship between position $x$ and velocity $\dot{x}$.
图 8－3－4 题 8－3 系统（4）相轨迹（MATLAB）

由于 $x_{2}=\dot{x}_{1}-x_{1}$ ，因此系统方程为

即

$$
\begin{gathered}
\ddot{x}_{1}-\dot{x}_{1}=2 x_{1}+\dot{x}_{1}-x_{1} \\
\ddot{x}_{1}-2 \dot{x}_{1}-x_{1}=0
\end{gathered}
$$

同理可得

$$
\ddot{x}_{2}-2 \dot{x}_{2}-x_{2}=0
$$

令 $\mathrm{d} \dot{\mathrm{x}} x=\frac{2 \dot{x}+x}{\dot{x}}=\frac{0}{0}$ ，得奇点为 $(0,0)$ 。系统特征方程为

$$
s^{2}-2 s-1=0
$$

相应的特征根为

$$
s_{1}=2.414, s_{2}=-0.414 \quad \text { (鞍点) }
$$

由于 $\ddot{x}=\dot{x} \frac{\mathrm{~d} \dot{x}}{\mathrm{~d} x}=2 \dot{x}+x$ ，令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\alpha$ ，得等倾

线方程为

$$
\dot{x}=\frac{x}{\alpha-2}=k x
$$

其中 $k$ 为等倾线的斜率。由于相轨迹的渐近线是特殊的等倾线，满足 $k=\alpha$ ，则由上式不难得到 $k_{1}=\alpha_{1}=2.414, k_{2}=\alpha_{2}=-0.414$ 。相轨迹在这两条特殊的等倾线附近将沿着渐近线收敛或发散。

下表给出了不同 $\alpha$ 值下等倾线的斜率。

| $\alpha$ | 2 | 2.5 | 3 | $\infty$ | 1 | 1.5 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $\frac{1}{\alpha-2}$ | $\infty$ | 2 | 1 | 0 | -1 | -2 |

根据表格或 MATLAB 作出相轨迹，如图 8－3－5 所示。

![](assets/fig-08-03-05.png)

> Image description: A phase portrait plot from a textbook, labeled as Figure 8-3-5, illustrating the trajectories of a dynamical system in the $(\text{x}, \dot{\text{x}})$ plane. The horizontal axis is labeled $\text{x}$ and ranges from $-20$ to $20$, while the vertical axis is labeled $\dot{\text{x}}$ and ranges from $-10$ to $10$. The figure displays several curved trajectories with directional arrows indicating the flow of the system over time. A prominent straight line passes through the origin $(0,0)$ with a negative slope, acting as a boundary or nullcline. The trajectories exhibit different behaviors: some diverge away from the center, while others curve sharply toward the edges of the plot. In engineering terms, this represents a phase plane analysis used to determine the stability and qualitative behavior of a second-order differential equation based on its state variables.
图 8－3－5 题 8－3 系统（5）相轨迹（MATLAB）

8－4 若非线性系统的微分方程为
（1）$\ddot{x}+(3 \dot{x}-0.5) \dot{x}+x+x^{2}=0$ ；
（2）$\ddot{x}+x \dot{x}+x=0$ ；
（3）$\ddot{x}+\dot{x}^{2}+x=0$ 。

试求系统的奇点，并概略绘制奇点附近的相轨迹。
解 首先应求出各个系统的奇点，然后计算各奇点处的一阶偏导数及增量线性化方程，根据特征根确定奇点类型，并由奇点类型概略绘制各个系统的相轨迹。
（1）$\ddot{x}+(3 \dot{x}-0.5) \dot{x}+x+x^{2}=0$
系统的相轨迹微分方程为

$$
\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\frac{-(3 \dot{x}-0.5) \dot{x}-x-x^{2}}{\dot{x}}
$$

令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\frac{0}{0}$ ，求得系统的两个奇点



<!-- source_pdf_page: 268 -->
$$
\left\{\begin{array}{l}
x_{1}=0 \\
\dot{x}_{1}=0
\end{array}, \quad\left\{\begin{array}{l}
x_{1}=-1 \\
\dot{x}_{1}=0
\end{array}\right.\right.
$$

为确定奇点类型，需计算各奇点处的一阶偏导数及增量线性化方程。
奇点 $(-1,0)$ 处：

$$
\begin{gathered}
\left.\frac{\partial f(x, \dot{x})}{\partial x}\right|_{\substack{x=-1 \\
\dot{x}=0}}=1,\left.\quad \frac{\partial f(x, \dot{x})}{\partial \dot{x}}\right|_{\substack{x=-1 \\
\dot{x}=0}}=0.5 \\
\Delta \ddot{x}-0.5 \Delta \dot{x}-\Delta x=0
\end{gathered}
$$

特征根 $s_{1}=1.218, s_{2}=-0.718$ ，故奇点 $(-1,0)$ 为鞍点。其概略相轨迹如图8－4－1（a）所示。
奇点 $(0,0)$ 处：

$$
\begin{gathered}
\left.\frac{\partial f(x, \dot{x})}{\partial x}\right|_{\substack{x=0 \\
\dot{x}=0}}=-1,\left.\quad \frac{\partial f(x, \dot{x})}{\partial \dot{x}}\right|_{\substack{x=0 \\
\dot{x}=0}}=0.5 \\
\Delta \ddot{x}-0.5 \Delta \dot{x}+\Delta x=0
\end{gathered}
$$

特征根为 $s_{1,2}=0.25 \pm \mathrm{j} 0.984$ ，故奇点 $(0,0)$ 为不稳定的焦点，如图8－4－1（b）所示。
（2）$\ddot{x}+x \dot{x}+x=0$
系统的相轨迹微分方程为

$$
\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\frac{-x \dot{x}-x}{\dot{x}}
$$

令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\frac{0}{0}$ ，则求得系统的奇点为 $(0,0)$ 。
奇点 $(0,0)$ 处：

$$
\begin{gathered}
\left.\frac{\partial f(x, \dot{x})}{\partial x}\right|_{\substack{x=0 \\
\dot{x}=0}}=-1,\left.\quad \frac{\partial f(x, \dot{x})}{\partial \dot{x}}\right|_{\substack{x=0 \\
\dot{x}=0}}=0 \\
\Delta \ddot{x}+\Delta x=0
\end{gathered}
$$

特征根为 $s_{1,2}= \pm \mathrm{j}$ ，故奇点 $(0,0)$ 为中心点。其相轨迹如图8－4－2所示。

![](assets/fig-08-04-01.png)

> Image description: The image contains two phase portraits of dynamical systems, labeled (a) and (b), plotted on Cartesian coordinate axes. Figure (a) shows a saddle point at the singular point $(-1, 0)$. The trajectories are hyperbolic curves with arrows indicating flow directions: some paths converge toward the center along one axis while diverging away along another, characteristic of an unstable equilibrium in specific dimensions. Figure (b) displays a phase portrait centered at the origin $(0, 0)$, with axes labeled $x$ and $\dot{x}$. The trajectories are outward-spiraling curves moving clockwise away from the singular point. The Chinese caption identifies this as an "unstable focus" (不稳定焦点). Together, these figures illustrate different types of equilibrium points in a state-space representation, where variables $x$ and its derivative $\dot{x}$ define the system's stability and behavior based on the eigenvalues of the characteristic equation.
图 8－4－1 题 8－4 系统（1）的概略相轨迹及奇点

![](assets/fig-08-04-02.png)

> Image description: A technical diagram showing a phase portrait of a dynamical system in a two-dimensional state space. The horizontal axis is labeled $x$ and the vertical axis is labeled $\dot{x}$. The origin is marked with a "0", representing a singular point (equilibrium point). The figure displays two concentric circular trajectories centered at the origin. Both circles feature directional arrows indicating a clockwise flow of the system's state over time. These closed orbits suggest a stable, non-asymptotic behavior, characteristic of a center in linear systems theory. The caption identifies this as Figure 8-4-1, showing the schematic phase trajectories and singular point for system (1) from problem 8-4. In engineering terms, this represents a harmonic oscillator or a conservative system where energy is conserved, resulting in periodic oscillations around the equilibrium point.
图8－4－2 题 8－4 系统（2）的相轨迹及奇点类型中心点

（3）$\ddot{x}+\dot{x}^{2}+x=0$
系统的相轨迹微分方程为

$$
\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\frac{-\dot{x}^{2}-x}{\dot{x}}
$$

令 $\frac{\mathrm{d} \dot{x}}{\mathrm{~d} x}=\frac{0}{0}$ ，则求得系统的奇点为 $(0,0)$ 。



<!-- source_pdf_page: 269 -->
![](assets/fig-08-04-03.png)

> Image description: A technical diagram showing a phase portrait of a dynamical system in a two-dimensional state space. The horizontal axis is labeled $x$ and the vertical axis is labeled $\dot{x}$, intersecting at an origin marked with "0". The figure displays two concentric circular trajectories centered around the origin. Directional arrows on these curves indicate a clockwise flow. According to the Chinese caption, this represents the phase trajectories of "System (3)" from "Problem 8-4," specifically identifying the singularity at the origin as a "center point" (中心点). In engineering and control theory, such a plot illustrates a system with neutral stability where states oscillate periodically without decaying or growing over time.
图 8－4－3 题 8－4 系统（3）的相轨迹及奇点类型中心点

奇点 $(0,0)$ 处：

$$
\left.\frac{\partial f(x, \dot{x})}{\partial x}\right|_{\substack{x=0 \\ \dot{x}=0}}=-1,\left.\quad \frac{\partial f(x, \dot{x})}{\partial \dot{x}}\right|_{\substack{x=0 \\ \dot{x}=0}}=0
$$

特征根为 $s_{1,2}= \pm \mathrm{j}$ ，故奇点 $(0,0)$ 为中心点。其相轨迹如图 8－4－3 所示。

8－5 非线性系统的结构图如图 8－77 所示，系统开始时是静止的，输人信号 $r(t)=4 \cdot 1(t)$ ，试写出开关线方程，确定奇点的位置和类型，作出该系统的相平面图，并分析系统的运动特点。

解 本题首先应根据系统结构图解出相应的微分方程和开关线，得到解析表达式，然后根据给定输入信号和初始条件，绘制相轨迹，并由相轨迹分析系统运动特点。
（1）解微分方程。假设开始时系统处于静止状态，即 $c(0)=0, \dot{c}(0)=0$ ，则描述系统的方程组为

![](assets/fig-08-77.png)

> Image description: This image shows a control system block diagram labeled "图8－77 题 8－5 的非线性系统结构图." The system is a closed-loop feedback loop. The process begins with an input signal $r(t)$ entering a summing junction. The output of this junction is the error signal $e(t)$, which serves as the input to a nonlinear block. This block contains a graph showing a saturation function with a slope $k=1$ and saturation limits at $-2$ and $2$. The output of the nonlinear block is labeled $u(t)$, which then enters a linear transfer function block represented by $\frac{1}{s^2}$. The final system output is denoted as $c(t)$. A feedback path carries $c(t)$ back to the summing junction with a negative sign, indicating negative feedback. Arrows indicate the unidirectional flow of signals from left to right through the forward path and from right to left via the feedback loop.
图8－77 题 8－5 的非线性系统结构图

$\ddot{c}=u$ ，其中

$$
u= \begin{cases}e+2, & e<-2 \\ 0, & |e|<2 \\ e-2, & e>2\end{cases}
$$

由比较点可得

$$
e=r-c
$$

因为 $r(t)=4 \cdot 1(t)$ ，故有 $e=4-c, \dot{e}=-\dot{c}, \ddot{e}=-\ddot{c}$ ，初始条件为 $e(0)=4, \dot{e}(0)=0$ 。
整理上述关系式后可得

$$
\ddot{e}=\left\{\begin{array}{lc}
-e-2, & e<-2 \\
0, & |e|<2 \\
-e+2, & e>2
\end{array}\right.
$$

开关线为 $e= \pm 2$ 。
（2）相平面分析。当 $e>2$ 时，描述系统的微分方程为

积分得

$$
\begin{gathered}
\ddot{e}=-e+2, \quad \dot{e} \mathrm{~d} \dot{e}=(-e+2) \mathrm{d} e \\
(e-2)^{2}+\dot{e}^{2}=C_{1}
\end{gathered}
$$

$C_{1}$ 由初始条件 $e(0)=4$ 和 $\dot{e}(0)=0$ 决定，可得 $C_{1}=4$ 。由此可见，$e>2$ 区域内的相轨迹是一圆心在 $(2,0)$ 处的圆。

当 $e<2$ 时，描述系统的微分方程为

$$
\ddot{e}=0, \quad \dot{e} \mathrm{~d} \dot{e}=0
$$

积分得

$$
\dot{e}^{2}=C_{2}
$$

$C_{2}$ 由 $e>2$ 区域内的相轨迹与开关线 $e=2$ 的交点 $(2,2)$ 决定，可得 $C_{2}=2$ 。由此可见，$e<2$区域内相轨迹为水平直线。

当 $e<-2$ 时，描述系统的微分方程为



<!-- source_pdf_page: 270 -->
积分得

$$
\begin{gathered}
\ddot{e}=-e-2, \quad \dot{e} \mathrm{~d} \dot{e}=(-e-2) \mathrm{d} e \\
(e+2)^{2}+\dot{e}^{2}=C_{3}
\end{gathered}
$$

$C_{3}$ 由 $e<2$ 区域内的相轨迹与开关线 $e=-2$ 的交点 $(-2,-2)$ 决定，可得 $C_{3}=4$ 。由此可见，$e<-2$ 区域内的相轨迹是一圆心在 $(-2,0)$ 处的圆。

当 $e>-2$ 时，描述系统的微分方程为

$$
\ddot{e}=0, \quad \dot{e} \mathrm{~d} \dot{e}=0
$$

积分得

$$
\dot{e}^{2}=C_{4}
$$

$C_{4}$ 由 $e<-2$ 区域内的相轨迹与开关线 $e=-2$ 的交点 $(-2,2)$ 决定，可得 $C_{4}=2$ 。由此可见，$e>-2$ 区域内的相轨迹为水平直线。
（3）相轨迹绘制与时间响应。实际上，由相轨迹对称条件可知，该非线性系统相轨迹上下对称，左右对称，且关于原点对称。

运行 MATLAB 程序 exe805．m 得到相轨迹和 $e(t)$ 曲线分别如图 8－5－1 和图 8－5－2 所示。由图 8－5－1、图 8－5－2 可见，系统由初始条件出发，呈周期振荡状态。

MATLAB 程序 ：exe805．m

```
$\mathrm{t}=0: 0.01: 30$; 设定仿真时间为30s
$\mathrm{e} 0=\left[\begin{array}{ll}4 & 0\end{array}\right]^{\prime}$; $\quad$ \% 初始条件 $e(0)=4, \dot{e}(0)=0$
$[\mathrm{t}, \mathrm{e}]=\operatorname{ode45}$ ('sys805', $\mathrm{t}, \mathrm{e} 0$ ); \%求解初始条件 $e(0)=4, \dot{e}(0)=0$ 下的系统微分方程
figure(1)
plot(e(:,1),e(:,2));grid \%绘制相轨迹
figure(2)
plot(t,e(:,1)); grid \%绘制系统的误差响应曲线
调用函数: sys805
function de = sys805( $\mathrm{t}, \mathrm{e}) \quad$ \%描述系统的微分方程
de1 = e(2);
if ( $\mathrm{e}(1)<-2$ )
    de2 = -2-e(1);
elseif (abs(e(1))<2)
    de2 = 0;
else de2 = 2-e(1);
end
de $=[\text { de1 de2 }]^{\prime}$;
```

![](assets/fig-08-05-01.png)

> Image description: The image shows a phase plane plot from MATLAB, labeled as "图 8－5－1 题 8－5 系统相轨迹". The graph features a Cartesian coordinate system where the horizontal axis is labeled $e$ and the vertical axis is labeled $\dot{e}$. Both axes range from $-5$ to $5$ (horizontal) and $-3$ to $3$ (vertical), with grid lines every one unit. The central figure is a closed, symmetric loop resembling a stadium shape or a rounded rectangle. The trajectory consists of two straight horizontal segments at $\dot{e} = 2$ and $\dot{e} = -2$, extending between approximately $e = -2.5$ and $e = 2.5$. These are connected by two semi-circular arcs on the left and right sides, reaching maximum widths at $e = -4$ and $e = 4$. In engineering terms, this represents a phase trajectory of a system, illustrating the relationship between an error variable $e$ and its derivative $\dot{e}$.
图 8－5－1 题 8－5 系统相轨迹（MATLAB）

![](assets/fig-08-05-01-2.png)

> Image description: The image shows a plot of a sinusoidal waveform from a textbook, labeled as "图 8－5－1 题 8－5 系统相轨迹 (MATLAB)". The graph features two perpendicular axes: the horizontal axis is labeled $t$ (representing time) and the vertical axis is labeled $e$ (likely representing error). The horizontal axis ranges from $0$ to $30$, with major grid lines every $5$ units. The vertical axis ranges from $-5$ to $5$, with increments of $1$. A continuous, oscillating curve fluctuates between a maximum value of approximately $3.7$ and a minimum value of approximately $-4.2$. The waveform is periodic, completing roughly three full cycles within the displayed time interval. This plot represents the time-domain response of a system, specifically showing an undamped or sustained oscillation of variable $e$ over time $t$, generated using MATLAB software.
图 8－5－2 题 8－5 系统 $e(t)$ 响应曲线（MATLAB）



<!-- source_pdf_page: 271 -->
8－6 变增益控制系统的结构图及其中非线性元件 $N(A)$ 的输入输出特性如图8－78所示，设系统开始处于零初始状态，若输人信号 $r(t)=R \cdot 1(t)$ ，且 $R>e_{0}, k K<\frac{1}{4 T}<K$ ，试绘出系统的相平面图，并分析采用变增益放大器对系统性能的影响。已知系统参数：$k=0.1$ ， $e_{0}=0.6, K=5, T=0.49$ 。

![](assets/fig-08-78.png)

> Image description: This figure consists of two parts illustrating a variable-gain control system. Part (a) is a block diagram showing a closed-loop feedback system. An input signal $r$ enters a summing junction to produce an error signal $e$. This signal passes through a nonlinear element $N(A)$, resulting in output $u$, which then enters a linear plant block with the transfer function $\frac{K}{s(Ts+1)}$. The final output $c$ is fed back to the summing junction. Part (b) displays the input-output characteristic of the nonlinear element $N(A)$ on a coordinate system with axes $u$ and $e$. The graph shows a piecewise linear function passing through the origin. For $|e| < e_0$, the gain is a constant slope $k$. Once $|e|$ exceeds the threshold $e_0$, there is a step jump in $u$, followed by a steeper linear segment with a gain of 1.
图 8－78 题 8－6 具有变增益放大器的系统

解 本题首先应根据系统结构图解出相应的微分方程和开关线，确定系统奇点，然后根据给定输人信号和初始条件，绘制相轨迹，并由相轨迹分析变增益放大器对系统性能的影响。

假设开始时系统处于静止状态，即

$$
c(0)=0, \quad \dot{c}(0)=0
$$

则描述系统的方程组为 $T \ddot{c}+\dot{c}=K u$ ，其中

$$
\begin{aligned}
& u= \begin{cases}e, & |e|>e_{0} \\
k e, & |e|<e_{0}\end{cases} \\
& e=r-c
\end{aligned}
$$

因为 $r(t)=R \cdot 1(t)$ ，故有 $e=R-c, \dot{e}=-\dot{c}, \ddot{e}=-\ddot{c}$ ，初始条件为 $e(0)=R, \dot{e}(0)=0$ 。
整理上述关系式后可得

$$
\begin{array}{ll}
T \ddot{e}+\dot{e}+K e=0, & |e|>e_{0} \\
T \ddot{e}+\dot{e}+k K e=0, & |e|<e_{0}
\end{array}
$$

开关线为 $|e|=e_{0}$ 。
在相平面的 I 区（ $|e|>e_{0}$ ），系统相轨迹微分方程为

$$
\frac{\mathrm{d} \dot{e}}{\mathrm{~d} e}=-\frac{\dot{e}+K e}{T \dot{e}}
$$

令 $\frac{\mathrm{d} \dot{e}}{\mathrm{~d} e}=\frac{0}{0}$ ，则求得系统的奇点在 $(0,0)$ 处。
为确定该奇点类型，需计算各奇点处的一阶偏导数及增量线性化方程。
奇点 $(0,0)$ 处：

$$
\begin{gathered}
\left.\frac{\partial f(e, \dot{e})}{\partial \dot{e}}\right|_{\substack{e=0 \\
\ddot{e}=0}}=-\frac{1}{T},\left.\quad \frac{\partial f(e, \dot{e})}{\partial e}\right|_{\substack{e=0 \\
\ddot{e}=0}}=-\frac{K}{T} \\
\Delta \ddot{e}+\frac{1}{T} \Delta \dot{e}+\frac{K}{T} \Delta e=0
\end{gathered}
$$

由于 $\frac{1}{4 T}<K$ ，可得特征根 $s_{1,2}=\frac{1}{2 T}(-1 \pm \mathrm{j} \sqrt{4 K T-1})$ ，故奇点在（ 0,0 ）是稳定焦点。



<!-- source_pdf_page: 272 -->
同理可得，在相平面的 II 区 $\left(|e|<e_{0}\right)$ ，由于 $k K<\frac{1}{4 T}$ ，可得系统奇点在 $(0,0)$ 处的特征根 $s_{1,2}=-\frac{1}{2 T}(1 \pm \sqrt{1-4 K T k})$ ，是稳定节点。

为便于作图，取 $T=0.49, K=5, k=0.1, e_{0}=0.6, R=1$ 。系统以非周期运动形式由初始点 $(1,0)$ 运动到平衡位置 $(0,0)$ ，稳态误差 $e_{s}(\infty)=0$ 。运行 MATLAB 程序 exe806．m 得相轨迹如图 8－6－1 所示，而非线性环节加人前后的 $e(t)$ 曲线分别如图 8－6－2 中的虚线和实线部分所示。

![](assets/fig-08-06-01.png)

> Image description: This image shows a phase plane plot (Figure 8-6-1) representing the trajectory of a system's error. The horizontal axis is labeled as $e$ and the vertical axis is labeled as $\dot{e}$, ranging from approximately -0.4 to 1 on the x-axis and -2 to 0.5 on the y-axis. A single continuous curve represents the phase trajectory, starting from an initial point at $(1, 0)$ and moving toward a stable equilibrium position at $(0, 0)$. Directional arrows along the path indicate the flow of motion: the trajectory descends sharply into the negative $\dot{e}$ region, reaching a minimum near $e=0.6$, before curving back upward and leftward to terminate at the origin. According to the caption, this represents non-periodic motion where the steady-state error $e_s(\infty)$ equals 0, generated via a MATLAB program with specific parameters ($T=0.49, K=5, k=0.1, e_0=0.6, R=1$).
图 8－6－1 题 8－6 系统相轨迹（MATLAB）

![](assets/fig-08-06-02.png)

> Image description: The image displays a MATLAB-generated plot showing the time response of an error signal $e$ over time $t$. The horizontal axis is labeled $t$, ranging from 0 to 10, and the vertical axis is labeled $e$, ranging from -0.4 to 1. Two distinct curves are plotted starting from an initial value of $e = 0.95$ at $t = 0$. One curve (dotted line) exhibits a fast decay with a small undershoot around $t=1.5$ before converging quickly toward zero. The second curve (solid line) shows a slower response, dipping deeper into a negative overshoot reaching approximately -0.35 near $t=2$, and then gradually asymptotically approaching zero as $t$ increases toward 10. In an engineering context, this figure represents the transient response of a system's error over time, illustrating different damping characteristics or controller settings for the same initial condition.
图8－6－2 题 8－6 系统误差响应曲线（MATLAB）

MATLAB 程序 ：exe806．m
global KT
$\mathrm{K}=5 ; \mathrm{T}=0.49 ; \mathrm{R}=1 ;$
$\mathrm{G}=\mathrm{tf}([\mathrm{K}],[\mathrm{T} 1 \mathrm{O}]) ;$
sys $=$ feedback $(G, 1)$ ；
$\mathrm{t}=0: 0.01: 10$ ；
$c=R * \operatorname{step}(\operatorname{sys}, t)$
el $=R-c$ ；
e $0=\left[\begin{array}{lll}\mathrm{R} & 0\end{array}\right]^{\prime}$ ；
$[\mathrm{t}, \mathrm{e} 2]=$ ode45（＇sys806＇$, \mathrm{t}, \mathrm{e} 0$ ）；
figure（1）
plot（e2（：，1），e2（：，2））；grid
figure（2）
plot（t，e1，＇：＇，t，e2（：，1））；grid
调用函数：sys806．m
function de＝sys806（ $\mathrm{t}, \mathrm{e}$ ）
global KT
$\mathrm{e} 01=0.6 ; \mathrm{k}=0.1$ ；
de1＝e（2）；
if（abs（e（1））＞e01）
$\operatorname{de} 2=(-e(2)-K * e(1)) . / T ;$
else $\operatorname{de} 2=(-e(2)-k * K * e(1)) . / T$ ；
\％设定全局变量参数
\％开环线性传递函数
\％线性闭环传递函数
\％设定仿真时间为 10 s
\％线性闭环系统输出
\％线性闭环系统输出
\％设定非线性闭环系统的误差初始条件
\％求解非线性系统微分方程
\％绘制相轨迹
\％绘制非线性环节加人前后的 $e(t)$ 曲线
\％描述非线性系统的微分方程
\％说明全局变量参数



<!-- source_pdf_page: 273 -->
end
de $=[\text { de1 de2 }]^{\prime}$ ；
由图8－6－1可见，相轨迹最终收敛于稳定节点，其横坐标就是稳态误差，即 $e_{s s}(\infty)=0$ 。与线性放大器时的情况相同。以上分析表明，在这种情况下，引入变增益线性放大器不但不会增加阶跃响应的稳态误差，而且由图8－6－2可见，还加快了系统误差响应的收玫速度，改善了系统性能。

8－7 图 8－79 为一带有库仑摩擦的二阶系统，试用相平面法讨论库仑摩擦对系统单位阶跃响应的影响。

![](assets/fig-08-79.png)

> Image description: This image shows a block diagram of a second-order control system featuring Coulomb friction. The input signal $r$ enters a summing junction, where it is compared with the output feedback signal $c$, resulting in an error signal $e$. This error passes through a gain block labeled "5" to produce a signal $u$. The signal $u$ then enters another summing junction that incorporates a non-linear feedback loop. This loop contains a block representing Coulomb friction, characterized by a step function with values of 2 and -2. The output of this junction feeds into a first-order transfer function $\frac{1}{0.5s+1}$, which is subsequently followed by an integrator block $\frac{1}{s}$ to produce the final system output $c$. Arrows indicate the unidirectional flow of signals through the blocks, forming a closed-loop feedback architecture designed to analyze the impact of friction on unit step response using phase plane methods.
图 8－79 题 8－7 有库仑摩擦的二阶系统结构图

解 本题首先应根据系统结构图解出相应的微分方程和开关线，然后根据给定输入信号和初始条件，用等倾线法绘制相轨迹，并由相轨迹分析库仑摩擦对系统单位阶跃响应的影响。

假设开始时系统处于静止状态，即

$$
c(0)=0, \quad \dot{c}(0)=0
$$

由系统结构图8－79，有

$$
0.5 \ddot{c}+\dot{c}=5 e-u
$$

其中 $u$ 为库仑摩擦非线性环节输出

$$
u= \begin{cases}2, & \dot{c}>0 \\ -2, & \dot{c}<0\end{cases}
$$

列写系统微分方程

$$
\left\{\begin{array}{rlrl}
0.5 \ddot{c}+\dot{c} & =5 e-2, & \dot{c}>0 \\
0.5 \ddot{c}+\dot{c} & =5 e+2, & \dot{c}<0 \\
e & =r-c
\end{array}\right.
$$

因为 $r(t)=1(t)$ ，故有 $e=1-c, \dot{e}=-\dot{c}, \ddot{e}=-\ddot{c}$ ，初始条件为 $e(0)=1, \dot{e}(0)=0$ 。
整理上述关系式后可得

$$
\begin{array}{ll}
\ddot{e}+2 \dot{e}+10 e-4=0, & \dot{e}<0 \\
\ddot{e}+2 \dot{e}+10 e+4=0, & \dot{e}>0
\end{array}
$$

开关线为 $\dot{e}=0$ 。
在 I 区 $(\dot{e}<0)$ ，由于

$$
\dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}=-2 \dot{e}-10 e+4
$$

令 $\frac{\mathrm{d} \dot{e}}{\mathrm{~d} e}=\alpha_{1}$ ，得等倾线方程为

$$
\dot{e}=-\frac{10}{\alpha_{1}+2} e+\frac{4}{\alpha_{1}+2}
$$

在II区（ $\dot{e}>0$ ），由于

$$
\dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}=-2 \dot{e}-10 e-4
$$



<!-- source_pdf_page: 274 -->
令 $\frac{\mathrm{d} \dot{e}}{\mathrm{~d} e}=\alpha_{2}$ ，得等倾线方程为

$$
\dot{e}=-\frac{10}{\alpha_{2}+2} e-\frac{4}{\alpha_{2}+2}
$$

下表给出了不同 $\alpha_{i}(i=1,2)$ 值下等倾线的斜率。

| $\alpha_{i}$ | -4 | -2 | -1 | 0 | 2 | 3 | $\infty$ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $-\frac{10}{\alpha_{i}+2}$ | 5 | $-\infty$ | -10 | -5 | -2.5 | -2 | 0 |

根据表格作等倾线或用 MATLAB法可得系统的相轨迹如图 8－7－1所示。

最后，此题可考虑在 MATLAB 的 Simulink 环境下搭建如图 8－7－2 所示的二阶系统，并进一步研究库仑摩擦环节对系统阶跃响应的影响。该模型仿真时间设定为 10 s ，并采用定步长（fixed－step）的 ode4（Runge－Kutta）算法，得系统在库

![](assets/fig-08-07-01.png)

> Image description: The image displays a phase plane plot of a second-order system, plotting the rate of change of error $\dot{e}(t)$ on the vertical y-axis against the error $e(t)$ on the horizontal x-axis. The axes are scaled from -0.2 to 1.2 for $e(t)$ and from -2 to 1 for $\dot{e}(t)$, with a grid overlaying the plot area. A single continuous trajectory curve begins at approximately $(1, 0)$ and spirals inward toward an equilibrium point near $(0.4, 0)$. An arrow on the curve indicates the direction of motion, showing a clockwise spiral. In engineering terms, this represents a stable focus, where the system's state converges to a steady-state error value over time. According to the caption, this plot relates to a MATLAB Simulink simulation of a second-order system incorporating Coulomb friction, analyzed using a fixed-step ode4 Runge-Kutta algorithm over a 10-second duration.
图 8－7－1 库仑摩擦系统相轨迹（MATLAB）

![](assets/fig-08-07-01-2.png)

> Image description: This image shows a MATLAB Simulink block diagram of a control system, captioned "图 8－7－1 库仑摩擦系统相轨迹 (MATLAB)," indicating it models the phase trajectory of a Coulomb friction system. The signal flow begins with a "Step" input entering a summing junction. The error signal passes through a gain block $K$ with a value of 5, then into another summing junction that incorporates feedback from a "Relay" block. This combined signal enters a transfer function block $G = \frac{1}{0.5s+1}$, followed by an integrator block labeled "dc" ($\frac{1}{s}$). The output is routed to a scope labeled "c" and a "To Workspace" block for data logging. A feedback loop connects the final output back to the initial summing junction. Additionally, a "Clock" signal is sent to a separate "To Workspace1" block to record time $t$. The diagram illustrates a closed-loop system with non-linear relay feedback.
图 8－7－2 带有库仑摩擦的二阶系统（Simulink 环境）

![](assets/fig-08-07-02.png)

> Image description: This image is a plot showing the time-domain response of a second-order system with Coulomb friction, as indicated by the Chinese caption "图 8－7－2 带有库仑摩擦的二阶系统 (Simulink 环境)". The graph features two axes: the horizontal axis represents time $t$, ranging from 0 to 10, and the vertical axis represents a variable $c(t)$, ranging from 0 to 1.4. Two curves are plotted starting from the origin $(0,0)$ and converging toward a steady-state value of approximately 1.0. One curve is a solid line exhibiting slight oscillation (underdamped behavior), while the other is a dashed line showing a significantly higher initial overshoot, peaking at roughly 1.3 around $t=1$, before oscillating and settling. This figure illustrates how different system parameters or friction levels affect the transient response and stability of a second-order engineering system simulated in Simulink.
图8－7－3 题 8－7 系统输出响应曲线（MATLAB）

由图 8－7－3 可见，系统稳定收玫，引人库仑摩擦非线性环节后，系统的单位阶跃响应阻尼程度加大，超调量减小，改善了动态性能。

8－8 设非线性系统如图 8－80 所示，输人为单位斜坡函数。试在 $e \dot{e}$ 平面上绘制相轨迹。

解 本题首先应根据系统结构图解出相应的微分方程和开关线，得到解析表达式，然后根据给定输入单位斜坡信号和初始条件，绘制相轨迹，并由相轨迹分析系统运动特点。



<!-- source_pdf_page: 275 -->
假设开始时系统处于静止状态，即

$$
c(0)=0, \quad \dot{c}(0)=0
$$

![](assets/img-chapter-08-027.png)

则描述系统的方程组为 $\ddot{c}=u$ ，其中

$$
\begin{aligned}
& u= \begin{cases}1, & \left\{\begin{array}{l}
e>1 \\
-1<e<1, \dot{e}<0
\end{array}\right. \\
-1, & \left\{\begin{array}{l}
e<-1 \\
-1<e<1, \dot{e}>0
\end{array}\right.\end{cases} \\
& e=r-c
\end{aligned}
$$

图8－80 题8－8的非线性系统结构图

因为 $r(t)=t$ ，故有 $e=t-c, \dot{e}=1-\dot{c}, \ddot{e}=-\ddot{c}$ ，初始条件为 $e(0)=0, \dot{e}(0)=1$ 。
整理上述关系式后可得

$$
\ddot{e}= \begin{cases}-1, & \left\{\begin{array}{l}
e>1 \\
-1<e<1, \dot{e}<0
\end{array}\right. \\
1, & \left\{\begin{array}{l}
e<-1 \\
-1<e<1, \dot{e}>0
\end{array}\right.\end{cases}
$$

在相平面的 I 区 $(e>1 ;-1<e<1, \dot{e}<0)$ ，描述系统的微分方程为

$$
\ddot{e}=-1
$$

积分可得

$$
\frac{1}{2} \dot{e}^{2}=-e+C_{1} \quad \text { (抛物线) }
$$

在相平面的 II 区（ $e<-1 ;-1<e<1, \dot{e}>0$ ），描述系统的微分方程为

$$
\ddot{e}=1
$$

积分可得

$$
\frac{1}{2} \dot{e}^{2}=e+C_{2} \quad \text { (抛物线) }
$$

由初始条件 $e(0)=0, \dot{e}(0)=1$ 出发，概略绘制其相轨迹如图 8－8－1 所示。
下面利用 MATLAB 程序 exe808．m 精确绘制系统相轨迹，如图8－8－2 所示。由图可见，系统振荡发散。

![](assets/fig-08-08-01.png)

> Image description: A phase portrait plot from a textbook, labeled as Figure 8-8-2, illustrating the system's stability. The graph features a horizontal axis labeled $e$ and a vertical axis labeled $\dot{e}$, representing an error variable and its time derivative, respectively. Numerical markers $-1$, $0$, and $1$ are present on both axes. Two vertical dashed lines are drawn at $e = -1$ and $e = 1$. The figure displays several trajectory curves with directional arrows indicating the flow of the system over time. The trajectories spiral outward from the origin, crossing the boundaries defined by the dashed lines. This expanding spiral pattern indicates that the system is unstable and exhibits divergent oscillations. According to the provided caption, this plot was generated using a MATLAB program (exe808.m) to precisely depict the system's phase trajectories.
图 8－8－1 题 8－8 系统的概略相轨迹

![](assets/fig-08-08-01-2.png)

> Image description: This image shows a phase plane plot (phase trajectory) for a system, labeled as "图 8－8－1 题 8－8 系统的概略相轨迹". The graph features two perpendicular axes: the horizontal axis is labeled $e$ and the vertical axis is labeled $\dot{e}$. Both axes use a numerical scale ranging from approximately -10 to 10 for $e$ and -5 to 5 for $\dot{e}$, with dashed grid lines marking intervals of 2 units. The plot displays three distinct spiral trajectories that originate from different initial points on the right side of the plane. Each trajectory is marked with directional arrows indicating a clockwise motion as they spiral inward toward the origin $(0,0)$. In engineering terms, this represents a stable focus, where the system's error $e$ and its rate of change $\dot{e}$ oscillate with decreasing amplitude over time, eventually converging to an equilibrium state at the origin.
图 8－8－2 题 8－8 系统的相轨迹（MATLAB）



<!-- source_pdf_page: 276 -->
MATLAB 程序：exe808．m

$$
\begin{array}{ll}
\mathrm{t}=0: 0.01: 30 ; & \text { \% 设置仿真时间为 } 30 \mathrm{~s} \\
\mathrm{e} 0=\left[\begin{array}{ll}
0 & 1
\end{array}\right]^{\prime} ; & \text { \% 设定初始条件为 } e(0)=0, \dot{e}(0)=1 \\
{[\mathrm{t}, \mathrm{e} 1]=\operatorname{ode} 45\left(^{\prime} \mathrm{sys} 808\right.} & \prime, \mathrm{t}, \mathrm{e} 0) ; \\
\text { plot }(\mathrm{e} 1(:, 1), \mathrm{e} 1(:, 2)) ; \mathrm{grid} & \text { \%求解微分方程 } \\
\text { 调用函数: sys808. m } & \text { \%绘制系统相轨迹 } \\
\text { function de = sys808(t,e) } & \text { \%描述系统微分方程 } \\
\text { de1 = } \mathrm{e}(2) ; & \\
\text { if }((\mathrm{e}(1)>1) \mid(((\mathrm{e}(1)<1) \&(\mathrm{e}(1)>-1)) \&(\mathrm{e}(2)<0))) \\
\quad \text { de2 }=-1 ; & \\
\text { else de2 = } 1 ; & \\
\text { end } & \\
\text { de }=[\mathrm{de} 1 \mathrm{de} 2]^{\prime} ; &
\end{array}
$$

8－9 设非线性系统如图 8－81 所示，其中 $M=1, T=1$ 。若输出为零初始条件，输人 $r(t)=1(t)$ ，要求：
（1）在 $e \dot{e}$ 平面上画出相轨迹；
（2）判断该系统是否稳定，最大稳态误差是多少；
（3）绘出 $e(t)$ 及 $c(t)$ 的时间响应大致波形。

![](assets/fig-08-81.png)

> Image description: This image shows a block diagram of a non-linear control system. The process begins with an input signal $r$ entering a summing junction, where it is compared with a feedback loop to produce the error signal $e$. This signal passes through a gain block labeled "5" before entering a non-linear element. The non-linear block contains a piecewise function graph with three segments: a constant value of $-M$ for inputs below $-0.5$, zero for inputs between $-0.5$ and $0.5$, and a constant value of $M$ for inputs above $0.5$. The output of this block is labeled $u$. The signal $u$ then enters a transfer function block defined as $\frac{1}{s(Ts+1)}$. The final system output is labeled $c$, which is fed back to the summing junction via a unity feedback loop. The accompanying Chinese caption specifies parameters $M=1, T=1$ and an input $r(t)=1(t)$.
图8－81 题8－9 的非线性系统结构图

解 本题首先应根据系统结构图解出相应的微分方程和开关线，然后根据给定输入信号和初始条件，用等倾线法或 MATLAB 法绘制相轨迹，并由相轨迹分析系统性能，得到最大稳态误差，绘制 $e(t)$ 及 $c(t)$ 的时间响应波形。
（1）相轨迹。假设系统输出为零初始条件，即

$$
c(0)=0, \quad \dot{c}(0)=0
$$

则描述系统的方程组为 $T \ddot{c}+\dot{c}=u$ ，其中

$$
u=\left\{\begin{array}{lc}
M, & 5 e>0.5 \\
0, & |5 e| \leqslant 0.5 \\
-M, & 5 e<-0.5
\end{array}\right.
$$

由比较点可得

$$
e=r-c
$$

因为 $r(t)=1(t)$ ，故有 $e=1-c, \dot{e}=-\dot{c}, \ddot{e}=-\ddot{c}$ ，初始条件为 $e(0)=1, \dot{e}(0)=0$ 。
整理上述关系式后可得

$$
T \ddot{e}+\dot{e}=-u=\left\{\begin{array}{lc}
-M, & e>0.1 \\
0, & |e| \leqslant 0.1 \\
M, & e<-0.1
\end{array}\right.
$$

开关线为 $e= \pm 0.1$ 。
在 I 区 $(e>0.1)$ ：



<!-- source_pdf_page: 277 -->
$$
T \dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}+\dot{e}=-M
$$

令 $\frac{\mathrm{d} \dot{e}}{\mathrm{~d} e}=\alpha$ ，得等倾线方程为

$$
\dot{e}=-\frac{M}{T_{\alpha}+1}
$$

在 II 区 $(|e| \leqslant 0.1)$ ：

$$
T \dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}+\dot{e}=0
$$

得 $\alpha=\frac{1}{T}$ 或 $\dot{e}=0$ 。
在III区 $(e<-0.1)$ ：

$$
T \dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{de}}+\dot{e}=M
$$

得等倾线方程为

$$
\dot{e}=\frac{M}{T_{\alpha}+1}
$$

为便于作图，取 $M=1, T=1$ ，下表给出了不同 $\alpha$ 值下等倾线的斜率：

| $\alpha$ | －0．5 | 0 | 1 | $\infty$ | －3 | －2 | －1．5 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| $-\frac{M}{T \alpha+1}$ | －2 | －1 | －0．5 | 0 | 0.5 | 1 | 2 |
| $\frac{M}{T \alpha+1}$ | 2 | 1 | 0.5 | 0 | －0．5 | －1 | －2 |

根据表格作等倾线或运行 MATLAB 程序 exe809．m，可得系统相轨迹如图8－9－1所示。 MATLAB 程序：exe809．m

$$
\begin{array}{ll}
\mathrm{t}=0: 0.01: 12 ; & \text { \%设定仿真时间为 } 12 \mathrm{~s} \\
\mathrm{e} 01=\left[\begin{array}{ll}
1 & 0
\end{array}\right]^{\prime} ; & \text { \% 初始条件 } e(0)=1, \dot{e}(0)=0 \\
{[\mathrm{t}, \mathrm{e} 1]=\operatorname{ode} 45\left({ }^{\prime} \mathrm{sys} 809^{\prime}, \mathrm{t}, \mathrm{e} 01\right) ;} & \text { \%求解初始条件下的系统微分方程 } \\
\text { figure(1) } & \\
\operatorname{plot}(\mathrm{e} 1(:, 1), \mathrm{e} 1(:, 2)) ; \mathrm{grid} & \text { \% 绘制相轨迹 } \\
\operatorname{axis}([-1,1,-1.5,1.5]) ; & \text { \%重新设定坐标范围 } \\
\text { figure }(2) & \\
\operatorname{plot}(\mathrm{t}, \mathrm{e} 1(:, 1), \mathrm{t},(1-\mathrm{e} 1(:, 1))) ; & \text { \%绘制 } e(t) \text { 及 } c(t) \text { 时间响应波形 } \\
\operatorname{axis}([012-0.51 .5]) ; \operatorname{grid} & \text { \%重新设定坐标范围 } \\
\text { 调用函数: sys809.m } & \\
\text { function de }=\operatorname{sys809}(\mathrm{t}, \mathrm{e}) & \text { \%描述系统的微分方程 } \\
\operatorname{de} 1=\mathrm{e}(2) ; & \\
\text { if }(\mathrm{e}(1)<-0.1) & \\
\operatorname{de} 2=2-\mathrm{e}(2) ; &
\end{array}
$$



<!-- source_pdf_page: 278 -->
```
elseif (abs(e(1))<0.1)
    de2 = 0;
else de2 = -2 - e(2);
end
de = [de1 de2]}\mp@subsup{}{}{\prime}\mathrm{ ;
```

（2）稳定性。由相轨迹可见，系统存在稳定自振，最大稳态误差 $\left|e_{s s}(\infty)\right|=0.1$ 。
（3）时间响应。运行 MATLAB 程序 exe809．m 可得 $e(t)$ 及 $c(t)$ 时间响应波形如图 8－9－2所示。

![](assets/fig-08-09-01.png)

> Image description: A phase plane plot showing the relationship between a variable $e$ (horizontal axis) and its time derivative $\dot{e}$ (vertical axis). The axes range from -1 to 1 for $e$ and -1.5 to 1.5 for $\dot{e}$, with dashed grid lines marking increments of 0.2 on the x-axis and 0.5 on the y-axis. The figure displays several nested, closed-loop trajectories centered around the origin $(0,0)$. These orbits are roughly elliptical or rounded rectangular in shape, indicating periodic oscillations. Small arrows along the curves indicate a clockwise direction of flow. The innermost loops are tighter and more rectangular, while the outermost loop extends further along the positive $e$-axis toward 1. In engineering terms, this represents the state-space trajectory of a system's error response over time, illustrating stability and oscillatory behavior around an equilibrium point.
图 8－9－1 题 8－9 系统相轨迹（MATLAB）

![](assets/fig-08-09-01-2.png)

> Image description: The image shows a plot of two time-domain signals, $c(t)$ and $e(t)$, plotted against time $t$ on the horizontal axis. The vertical axis ranges from -0.5 to 1.5. The signal $c(t)$ starts at a value of 1.0 at $t=0$, initially decreases, and then exhibits decaying oscillations that converge toward a steady-state value of 1.0. The signal $e(t)$ starts at 0 at $t=0$ and displays similar decaying oscillations centered around the zero axis. The relationship between the two curves indicates that $e(t)$ represents the error signal, likely defined as the difference between $c(t)$ and its target setpoint of 1.0. The damped sinusoidal nature of both waveforms suggests a second-order underdamped system response in control engineering. The figure is captioned "图 8－9－1 题 8－9 系统相轨迹（MATLAB）," indicating it was generated using MATLAB to analyze system trajectories.
图 8－9－2 题 8－9 系统 $e(t)$ 及 $c(t)$ 的时间响应（MATLAB）

8－10 已知具有理想继电器的非线性系统如图 8－82 所示，试用相平面法分析：
（1）$T_{d}=0$ 时系统的运动；
（2）$T_{d}=0.5$ 时系统的运动，并说明比例微分控制对改善系统性能的作用；
（3）$T_{d}=2$ ，并考虑实际继电器有延迟时系统的运动。
解 本题首先应根据系统结构图解出相应的微分方程和开关线，得到解析表达式，然后根据给定输入信号、初始条件和不同参数，绘制各个系统的相轨迹，并由相轨迹分析比例微分控制对系统性能的影响。

描述系统的微分方程为

![](assets/fig-08-82.png)

> Image description: A block diagram of a nonlinear system featuring an ideal relay is shown in Figure 8-82 (Problem 8-10). The system operates as a closed-loop feedback control loop. The process begins with an input signal $r=1(t)$ entering a summing junction, where it is compared with the output $c$ to produce an error signal $e$. This signal passes through a linear block labeled $1 + T_d s$, representing a proportional-derivative controller. The resulting signal enters a nonlinear relay block characterized by a step function with outputs of $1$ and $-1$. The output of the relay, denoted as $u$, serves as the input to a double integrator block represented by $\frac{1}{s^2}$. This final stage produces the system output $c$, which is fed back to the initial summing junction via a negative feedback path. The diagram illustrates the structural relationship between linear dynamics and nonlinear switching in a control system.
图 8－82 题 8－10 具有理想继电器的非线性系统结构图

$$
\ddot{c}=u
$$

其中

$$
u=\left\{\begin{array}{cc}
1, & e+T_{d} \dot{e}>0 \\
-1, & e+T_{d} \dot{e}<0
\end{array}\right.
$$

由输人比较点可得

$$
e=r-c=1-c, \quad \dot{e}=-\dot{c}, \quad \ddot{e}=-\ddot{c}
$$

初始条件 $e(0)=1, \dot{e}(0)=0$ 。



<!-- source_pdf_page: 279 -->
![](assets/fig-08-10-01.png)

> Image description: A phase portrait plot generated in MATLAB, labeled as Figure 8-10-1, showing the system's phase trajectory when $T_d = 0$. The graph features a Cartesian coordinate system where the horizontal axis is labeled with the variable $e$ and the vertical axis is labeled with $\dot{e}$. Both axes range approximately from -1.5 to 1.5, with tick marks every 0.2 units on the x-axis. The figure displays a single, closed-loop trajectory forming a symmetric, rounded diamond shape centered at the origin (0,0). The loop extends horizontally from $e = -1$ to $e = 1$ and vertically from $\dot{e} \approx -1.4$ to $\dot{e} \approx 1.4$. Two small arrows on the trajectory indicate a clockwise direction of motion. In engineering terms, this represents a limit cycle in the phase plane, indicating a stable periodic oscillation of the system variables $e$ and $\dot{e}$.
图 8－10－1 $\quad T_{d}=0$ 时系统相轨迹（MATLAB）

整理上述关系式后可得

$$
\ddot{e}=-u=\left\{\begin{array}{cc}
-1, & e+T_{d} \dot{e}>0 \\
1, & e+T_{d} \dot{e}<0
\end{array}\right.
$$

开关线为 $e+T_{d} \dot{e}=0$ 。
在 I 区 $\left(e+T_{d} \dot{e}>0\right)$ ：

$$
\ddot{e}=-1, \quad \dot{e} \mathrm{~d} \dot{e}=-\mathrm{d} e
$$

积分可得

$$
\frac{1}{2} \dot{e}^{2}=-e+C_{1}
$$

（抛物线）

其中 $C_{1}$ 为常数，由初始条件和开关线确定。
同理可得，在 II 区 $\left(e+T_{d} \dot{e}<0\right)$ ：

$$
\frac{1}{2} \dot{e}^{2}=e+C_{2} \quad \text { (抛物线) }
$$

其中 $C_{2}$ 为常数，由初始条件和开关线确定。
（1）$T_{d}=0$ 时，系统的运动。 $T_{d}=0$ 时，系统相轨迹如图 8－10－1 所示。
系统在 $r(t)=1(t)$ 作用下，输出呈现等幅振荡状态。在 MATLAB 的 Simulink 环境下搭建具有继电器的非线性系统，如图8－10－2所示。设定仿真时间为 10 s ，算法选用 ode45，微分环节系数设为 0 。运行得到此时单位阶跃响应如图8－10－3所示。

![](assets/fig-08-10-02.png)

> Image description: This image shows a MATLAB Simulink block diagram of a nonlinear control system featuring a relay. The system begins with a "Step" input entering a summation junction. A feedback loop returns the final output to this junction. The forward path consists of a parallel structure: one branch contains a "Derivation" ($du/dt$) block followed by a "Gain" block, while the other is a direct connection. These merge into another summation junction before entering a "Relay" block. The signal then passes through two sequential integrator blocks labeled "Tranfer Fon1" and "Tranfer Fon," representing a second-order system. Data extraction points are visible: a "Clock" feeds into "To Workspace1" (variable $t$), the output of the first integrator goes to "To Workspace2" (variable $dc$), and the final output goes to both "To Workspace" (variable $c$) and a "Scope" for visualization. The diagram illustrates a system designed to analyze limit cycle oscillations under step input.
图 8－10－2 具有继电器的非线性系统（Simulink 环境）

![](assets/fig-08-10-02-2.png)

> Image description: The image shows a plot of a time-domain signal $c(t)$ from a nonlinear system with a relay, as indicated by the Chinese caption "图 8－10－2 具有继电器的非线性系统 (Simulink 环境)". The graph features two perpendicular axes: the horizontal x-axis is labeled "Time/sec" and ranges from 0 to 10 seconds. The vertical y-axis is labeled $c(t)$ and ranges from 0 to 2. A grid of dashed lines overlays the plot area for precise value reading. The plotted function is a periodic, sinusoidal-like wave starting at the origin $(0,0)$. It reaches its first peak of $2$ at approximately $t = 2.8$ seconds, returns to zero at roughly $t = 5.6$ seconds, and reaches a second peak of $2$ at approximately $t = 8.4$ seconds. The waveform represents the output response of the described Simulink nonlinear system over time.
图8－10－3 $T_{d}=0$ 时系统的时间响应（MATLAB）

![](assets/fig-08-10-03.png)

> Image description: A technical plot showing a phase-plane trajectory of a system's time response when $T_d=0$, as indicated by the Chinese caption "图8－10－3 $T_{d}=0$ 时系统的时间响应（MATLAB）". The graph is plotted on a Cartesian coordinate system where the horizontal axis is labeled $e$ and the vertical axis is labeled $\dot{e}$. The x-axis ($e$) ranges from -0.4 to 1.4, and the y-axis ($\dot{e}$) ranges from -1.2 to 0.4. The plot features a curved trajectory starting near $(0, 0)$, descending into the fourth quadrant to reach a minimum $\dot{e}$ value of approximately -1.1 at $e \approx 0.5$, and then curving back upward toward $e=1$ on the x-axis. A straight line segment also intersects this curve, originating from roughly $(-0.1, 0.2)$ and extending downward to meet the trajectory near $(0.5, -1.0)$. The figure represents a state-space analysis of error ($e$) versus its derivative ($\dot{e}$).
图 8－10－4 $T_{d}=0.5$ 时系统相轨迹（MATLAB）



<!-- source_pdf_page: 280 -->
（2）$T_{d}=0.5$ 时，系统的运动。 $T_{d}=0.5$ 时，系统相轨迹如图 8－10－4 所示。
系统在 $r(t)=1(t)$ 作用下，输出响应收敛。将图8－10－2所示的非线性系统仿真时间设为 5 s ，算法选用 ode 45 ，微分环节系数设为 0.5 。运行得到此时系统的单位阶跃响应如图8－10－5所示。

由图8－10－5可见，加人比例微分控制可以改善系统的稳定性，并且微分作用增强时，切换提前，系统运动振荡次数减少，响应加快。
（3）$T_{d}=2$ 时，系统的运动。 $T_{d}=2$ ，并考虑实际继电器有一定的延迟时，系统时间响应如图8－10－6所示。

在小延迟情况下，系统在 $r(t)=1(t)$ 作用下输出响应收玫。若实际继电器的延迟较大，系统输出响应则有可能出现振荡现象。将图8－10－2所示的非线性系统仿真时间设为 20 s ，算法选用 ode45，微分环节系数设为 2 ，延迟系数设为 0.4 。运行得到此时系统的单位阶跃响应如图 8－10－7 所示。

![](assets/fig-08-10-05.png)

> Image description: This image shows a plot of the unit step response for a nonlinear system, labeled as Figure 8-10-7 in the provided text. The graph features a vertical y-axis representing the output variable $c(t)$ and a horizontal x-axis representing Time in seconds (Time/sec), ranging from 0 to 10. The curve starts at the origin $(0,0)$, rises steeply between 0 and 2 seconds, and reaches a peak slightly above 1 around $t=2$ seconds. It then exhibits a small amount of overshoot before settling and converging asymptotically toward a steady-state value of 1. The grid lines are spaced every 0.2 units on the y-axis and every 1 second on the x-axis. In engineering terms, this represents a stable system response to a unit step input $r(t)=1(t)$ under conditions of small delay, showing minimal oscillation before reaching equilibrium.
图8－10－5 $T_{d}=0.5$ 时系统的时间响应（MATLAB）

![](assets/fig-08-10-05-2.png)

> Image description: A line graph plotting the time response of a system, generated in MATLAB, as indicated by the caption "图8－10－5 $T_d=0.5$ 时系统的时间响应（MATLAB）". The horizontal x-axis is labeled "Time/sec" and ranges from 0 to 20 seconds with increments of 2. The vertical y-axis is labeled "$c(t)$" and ranges from 0 to 1.4 with increments of 0.2. The figure shows a single smooth curve starting at the origin (0,0) and rising asymptotically toward a steady-state value of 1.0. The response exhibits a characteristic first-order or overdamped behavior, reaching approximately 63% of its final value around 2 seconds and stabilizing near $c(t)=1$ after approximately 10 to 12 seconds. There is no overshoot or oscillation visible in the plot.
图8－10－6 $T_{d}=2$ 时系统时间响应（MATLAB）

![](assets/fig-08-10-07.png)

> Image description: A line graph showing the system time response of a variable $c(t)$ over time, as generated by MATLAB. The horizontal x-axis is labeled "Time/sec" and ranges from 0 to 20 seconds with major grid increments every 2 seconds. The vertical y-axis is labeled "$c(t)$" and ranges from 0 to 1.4, with dashed grid lines every 0.2 units. The plot depicts a transient response starting at the origin $(0,0)$. The signal rises sharply, reaching approximately $0.6$ by 2 seconds, before entering an oscillatory phase. These oscillations occur around a steady-state value of approximately $1.0$. The amplitude of the ripples is relatively constant and small, indicating a stable but underdamped system response. According to the provided caption, this specific behavior occurs when the parameter $T_d = 2$.
图 8－10－7 $T_{d}=2$ 且继电器有延迟时系统的时间响应（MATLAB）

由图8－10－5和图8－10－7可见，由于实际系统中继电器总是需要一定的开关速度，因此当 $r(t)=1(t)$ 时，非线性系统的单位阶跃响应的稳态过程亦呈现为 $1(t)$ 叠加小幅振荡的运



<!-- source_pdf_page: 281 -->
动形式。
以上分析表明，如果继电特性选择合适，则可以提高系统的响应速度。反之，则常常会使系统产生振荡现象。

8－11 非线性系统的结构图如图8－83所示，图中 $a=0.5, K=8, T=0.5, K_{t}=0.5$ ，要求：
（1）当开关断开时，绘制初始条件为 $e(0)=2, \dot{e}(0)=0$ 的相轨迹；
（2）当开关闭合时，绘制相同初始条件下的相轨迹，并说明测速反馈的作用。
解 本题首先应根据系统结构图解出相应的微分方程和开关线，然后根据给定参数和初始条件，用等倾线法或 MATLAB 法绘制相轨迹，并由相轨迹分析测速反馈对系统性能的影响。

![](assets/fig-08-83.png)

> Image description: A block diagram of a nonlinear control system is shown. The input signal $r=0$ enters a summing junction, where it is compared with the output feedback $c$. This results in an error signal $e+$, which then passes through another summing junction receiving a feedback loop from $c$ via a block labeled $K_i s$. A switch (labeled "开关") controls whether this inner feedback loop is active. The resulting signal $\varepsilon$ enters a nonlinear block characterized by a relay-like function with parameters $-a, 0,$ and $a$, and a gain $K$. The output of this block, $u$, is fed into a linear plant represented by the transfer function $\frac{1}{s(Ts+1)}$. The final output of the system is $c$. The diagram illustrates a closed-loop system with both proportional-like nonlinear control and an optional derivative feedback loop (velocity feedback) to modify system stability and phase trajectories.
图8－83 题 8－11的非线性系统结构图

（1）开关断开。描述系统的微分方程为 $T \ddot{c}+\dot{c}=u$ ，其中

$$
u=\left\{\begin{array}{lc}
K a, & e>a \\
K e, & |e|<a \\
-K a, & e<-a
\end{array}\right.
$$

由比较点可得

$$
e=r-c=-c, \quad \dot{e}=-\dot{c}, \quad \ddot{e}=-\ddot{c}
$$

整理上述关系式可得

$$
T \ddot{e}+\dot{e}=-u=\left\{\begin{array}{lc}
-K a, & e>a \\
-K e, & |e|<a \\
K a, & e<-a
\end{array}\right.
$$

开关线为 $e= \pm a$ 。
在 I 区 $(e>a)$ ，有

$$
T \dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}+\dot{e}=-K a
$$

令 $\frac{\mathrm{d} \dot{e}}{\mathrm{~d} e}=\alpha$ ，得等倾线方程为

$$
\dot{e}=-\frac{K a}{T \alpha+1}=-\frac{4}{0.5 \alpha+1}
$$

在III区 $(e<a)$ ，同理可得等倾线方程为

$$
\dot{e}=\frac{K a}{T \alpha+1}=\frac{4}{0.5 \alpha+1}
$$

下表给出了不同 $\alpha$ 值下等倾线的斜率。

| $\alpha$ | 0 | 2 | 6 | $\infty$ | －10 | －6 | －4 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| $-\frac{4}{0.5 \alpha+1}$ | －4 | －2 | －1 | 0 | 1 | 2 | 4 |
| $\frac{4}{0.5 \alpha+1}$ | 4 | 2 | 1 | 0 | －1 | －2 | －4 |

在II区 $(|e|<a)$ ，有



<!-- source_pdf_page: 282 -->
$$
T \dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}+\dot{e}=-K e
$$

令 $\mathrm{d} \dot{\mathrm{e}}=\alpha$ ，得等倾线方程为

$$
\dot{e}=-\frac{8}{0.5 \alpha+1} e
$$

下表给出了不同 $\alpha$ 值下等倾线的斜率：

| $\alpha$ | 0 | 2 | 6 | $\infty$ | -10 | -6 | -4 | -2 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $-\frac{8}{0.5 \alpha+1}$ | -8 | -4 | -2 | 0 | 2 | 4 | 8 | $\infty$ |

根据表格作出等倾线或运行 MATLAB 程序 exe811．m 可作出初始条件为 $e(0)=2$ ， $\dot{e}(0)=0$ 时系统的相轨迹，如图8－11－1所示。
（2）开关闭合。 $\varepsilon=r-c-K_{t} \dot{c}=-c-K_{t} \dot{c}=e+K_{t} \dot{e}$ ，描述系统的微分方程为 $T \ddot{c}+\dot{c}=u$ ，其中

$$
u= \begin{cases}K a, & \varepsilon>a \\ K \varepsilon, & |\varepsilon|<a \\ -K a, & \varepsilon<-a\end{cases}
$$

由输人比较点可得

$$
e=r-c=-c, \quad \dot{e}=-\dot{c}, \quad \ddot{e}=-\ddot{c}
$$

整理上述关系式可得

$$
T \ddot{e}+\dot{e}=-u= \begin{cases}-K a, & e+K_{t} \dot{e}>a \\ -K\left(e+K_{t} \dot{e}\right), & \left|e+K_{t} \dot{e}\right|<a \\ K a, & e+K_{t} \dot{e}<-a\end{cases}
$$

开关线为 $e+0.5 \dot{e}= \pm 0.5$ 。

![](assets/fig-08-11-01.png)

> Image description: A phase plane plot showing the system's phase trajectory when a switch is open, generated in MATLAB. The graph features a horizontal axis labeled $e$ and a vertical axis labeled $\dot{e}$, both with numerical scales. The $e$-axis ranges from $-1$ to $2$, while the $\dot{e}$-axis ranges from $-6$ to $3$. The trajectory is represented by a continuous black curve that spirals inward toward the origin $(0,0)$. An arrow on the lower right portion of the curve indicates the direction of motion, showing the system evolving from an initial state near $(1.5, -5)$ and spiraling clockwise toward the equilibrium point at the center. The plot includes a grid of dashed lines for coordinate reference. This figure illustrates the stability and convergence behavior of the system's error $e$ and its derivative $\dot{e}$ over time.
图8－11－1 题 8－11开关断开时系统的相轨迹（MATLAB）

I、III区的讨论同（1），其等倾线方程分别为
在I区 $\left(e+K_{t} \dot{e}>a\right) \quad \dot{e}=-\frac{K a}{T \alpha+1}=-\frac{4}{0.5 \alpha+1}$
在III区 $\left(e+K_{t} \dot{e}<a\right) \quad \dot{e}=\frac{K a}{T \alpha+1}=\frac{4}{0.5 \alpha+1}$
在II区 $\left(\left|e+K_{t} \dot{e}\right|<a\right) \quad T \dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}+\left(1+K K_{t}\right) \dot{e}=-K e$
令 $\mathrm{d} \dot{\mathrm{e}} e=\alpha$ ，得等倾线方程为

$$
\dot{e}=-\frac{K e}{1+T_{\alpha}+K K_{t}}=-\frac{16}{\alpha+10} e
$$

下表给出了不同 $\alpha$ 值下等倾线的斜率。

| $\alpha$ | 10 | -6 | -2 | 6 | $\infty$ | -26 | -18 | -14 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $-\frac{16}{\alpha+10}$ | $-\infty$ | -4 | -2 | -1 | 0 | 1 | 2 | 4 |

根据表格作出等倾线或运行 MATLAB 程序 exe811．m，作出初始条件为 $e(0)=2$ ， $\dot{e}(0)=0$ 时系统的相轨迹，如图 8－11－2 所示。



<!-- source_pdf_page: 283 -->
运行 MATLAB 程序 exe $811 . \mathrm{m}$ ，同样可得开关断开和闭合时的系统误差响应曲线，分别如图 8－11－3中实线、虚线部分所示。

![](assets/fig-08-11-02.png)

> Image description: A technical plot showing the phase plane relationship between a system error variable $e$ (horizontal axis) and its time derivative $\dot{e}$ (vertical axis). The x-axis ranges from -0.5 to 2, while the y-axis ranges from -3 to 0.5. The figure displays a continuous solid curve starting at the origin $(0, 0)$, descending into the negative $\dot{e}$ region as $e$ increases, reaching a minimum value of approximately $-2.6$ near $e = 1.6$, and then curving sharply upward toward $e = 2$. A downward-pointing arrow is positioned on the rightmost ascending portion of the curve, indicating the direction of the system's trajectory in the phase plane. This plot represents a system error response curve, likely used in control engineering to analyze stability or transient behavior during switch opening and closing events as mentioned in the caption.
图8－11－2 题8－11开关闭合时系统的相轨迹（MATLAB）

![](assets/fig-08-11-03.png)

> Image description: The image shows a MATLAB-generated plot of an error signal $e(t)$ over time, representing the system's response after a switch is closed. The horizontal axis is labeled "Time/sec" and ranges from 0 to 10 seconds. The vertical axis represents the error variable $e(t)$, ranging from -1 to 2. Two distinct curves are plotted starting from an initial value of $e(0) = 2$. One curve exhibits a smooth, exponential decay toward zero without oscillation. The second curve shows a highly underdamped response, characterized by significant oscillations that overshoot the zero line and eventually dampen out as time progresses. Both signals converge to a steady-state error of zero around 5 to 6 seconds. In an engineering context, this figure compares different system damping characteristics or control strategies in terms of their transient response and stability.
图8－11－3 题 8－11系统误差响应曲线（MATLAB）

MATLAB 程序 ：exe811．m
$\mathrm{t}=0: 0.01: 10$ ；
$\mathrm{e} 0=\left[\begin{array}{ll}2 & 0\end{array}\right]^{\prime}$ ；
$[\mathrm{t}, \mathrm{e} 1]=\operatorname{ode45}\left({ }^{\prime}\right.$ sys811a＇， $\left.\mathrm{t}, \mathrm{e} 0\right)$ ；
$[\mathrm{t}, \mathrm{e} 2]=\operatorname{ode45}\left({ }^{\prime} \mathrm{sys811b}{ }^{\prime}, \mathrm{t}, \mathrm{e} 0\right)$ ；
figure（1）
plot（e1（：，1），e1（：，2））；grid
figure（2）
plot（e2（：，1），e2（：，2））；grid
figure（3）
plot（t，el（：，1））；grid
hold on
plot（t，e2（：，1））；grid
\％设定仿真时间为 10 s
\％初始条件 $e(0)=2, \dot{e}(0)=0$
\％求解开关断开时系统的微分方程
\％求解开关闭合时系统的微分方程
\％绘制开关断开时的系统相轨迹
\％绘制开关闭合时的系统相轨迹
\％绘制开关断开时的系统误差曲线
\％图形保持
\％绘制开关闭合时的系统误差曲线

开关断开时的调用函数：sys811a．m

```
function de = sys811a(t,e)
a=0.5;K=8;T=0.5;Kt=0.5;
de1 = e(2);
if (e(1)< - a)
    de2 = (K*a }-e(2))/T
elseif (abs(e(1))<2)
    de2 =(- K*e(1) -e(2))/T;
else de2 = ( - K*a - e(2))/T;
end
de = [de1 de2]';
```

\％描述开关断开时系统的微分方程

开关闭合时的调用函数：sys811b．m

```
function de = sys811b(t,e)
global a K T Kt
```



<!-- source_pdf_page: 284 -->
```
de1 = e(2);
if ((e(1)+Kt*e(2))<-a)
    de2 = (K*a -e(2))/T;
elseif (abs((e(1)+Kt*e(2)))<2)
    de2 =(-K*(e(1)+Kt*e(2))-e(2))/T;
else de2 =(-K*a-e(2))/T;
end
de = [de1 de2]}\mp@subsup{}{}{\prime}\mathrm{ ;
```

由图 8－11－1 和图 8－11－2 可见，测速反馈的引入使相轨迹切换提前，收玫加快，从而系统的阻尼增加，性能得到改善。系统加人测速反馈前后的误差响应如图 8－11－3 中的实线和虚线所示。

8－12 设三个非线性系统的非线性环节一样，其线性部分分别为
（1）$G(s)=\frac{1}{s(0.1 s+1)}$ ；
（2）$G(s)=\frac{2}{s(s+1)}$ ；
（3）$G(s)=\frac{2(1.5 s+1)}{s(s+1)(0.1 s+1)}$ 。

用描述函数法分析时，哪个系统分析的准确度高？
解 由于当非线性环节的输入为正弦信号时，实际输出必定含有高次谐波分量，线性部分的低通滤波性能越好，高次谐波分量越被大幅削弱，因此闭环通道内近似只有一次谐波分量流通，从而保证应用描述函数分析法所得结果的准确性。

由于系统（2）的线性环节部分的频率特性在高频段衰减较快，低通滤波性能较好，因此系统（2）采用描述函数分析法所得的结果准确度高。

利用 MATLAB 的 bode 命令，绘制三个系统线性部分的开环对数幅频特性曲线如图8－12－1所示。

![](assets/fig-08-12-01.png)

> Image description: This image is a Bode magnitude plot showing the open-loop logarithmic amplitude-frequency characteristics of three different systems, labeled as $G_1(\text{dB})$, $G_2(\text{dB})$, and $G_3(\text{dB})$. The horizontal axis represents angular frequency $\omega$ in radians per second ($\text{rad/s}$), plotted on a logarithmic scale ranging from $0.01$ to $100$. The vertical axis represents the loop gain $L(\omega)$ measured in decibels ($\text{dB}$), with a linear scale ranging from $-100$ to $100$. Three distinct curves are plotted, each indicated by an arrow pointing to its respective label. All three curves exhibit a downward slope as frequency increases, characteristic of low-pass filter behavior. At low frequencies (around $0.01\text{ rad/s}$), the gains are clustered between approximately $40$ and $50\text{ dB}$. As $\omega$ increases beyond $1\text{ rad/s}$, the curves diverge, with $G_2(\text{dB})$ showing the steepest decline toward $-70\text{ dB}$ at $100\text{ rad/s}$.
图 8－12－1 题 8－12 开环对数幅频特性曲线（MATLAB）

MATLAB 程序 ：exe812．m
$\mathrm{G} 1=\mathrm{tf}\left([1],\left[\begin{array}{llll}0 . & 1 & 1 & 0\end{array}\right]\right)$ ；
$\mathrm{G2}=\operatorname{zpk}([\square,[0-1], 2) ;$
$G 3=t f\left(\left[\begin{array}{ll}3 & 2\end{array}\right],\left[\begin{array}{llllll}0 & 1 & 1 & 1 & 1 & 0\end{array}\right]\right) ;$
bode（G1，G2，G3）；\％绘制三个系统线性部分的开环对数幅频特性曲线
8－13 试推导下列非线性特性的描述函数：
（1）变增益特性（见教材中表 8－1 第 9 项）；
（2）具有死区的继电特性（见教材中表8－1第2项）；
（3）$y=x^{3}$ 。
解 本题非线性特性的描述函数可由等效法则或描述函数的定义来求取。
（1）变增益特性。通过作图法获得 $y(t)$ ，如图 8－13－1所示，其中 $\varphi_{1}=\arcsin \frac{s}{A}$ 。



<!-- source_pdf_page: 285 -->
![](assets/fig-08-13-01.png)

> Image description: This figure consists of three coordinate plots illustrating the relationship between a variable-gain characteristic and its sinusoidal response. The top-left plot shows a non-linear transfer function on $x$ and $y$ axes, where the slope changes at point $s$. The line is labeled with two different gain constants, $K_1$ (for $|x| < s$) and $K_2$ (for $|x| > s$), indicating a piecewise linear system. The top-right plot displays a sinusoidal output wave on axes $y$ and $\omega t$, ranging from $0$ to $2\pi$. A specific phase point $\phi_1$ is marked on the horizontal axis, corresponding via dashed lines to the transition point $K_1$ in the first plot. The bottom-left plot shows a distorted sinusoidal wave on axes $x$ and $\omega t$, where the vertical axis represents time. Dashed lines link the peaks and troughs of this input signal to the gain transitions in the transfer function, demonstrating how variable gain affects the output waveform.
图8－13－1 题 8－13 变增益特性和正弦响应曲线

输出 $y(t)$ 的数学表达式为

$$
y(t)= \begin{cases}K_{1} A \sin \omega t, & 0 \leqslant \omega t \leqslant \varphi_{1} \\ K_{1} s+K_{2}(A \sin \omega t-s), & \varphi_{1}<\omega t \leqslant \frac{\pi}{2}\end{cases}
$$

由图 8－13－1 可见，$y(t)$ 是奇函数，所以有 $A_{1}=0$ 。而 $y(t)$ 又为半周期内对称，故

$$
\begin{aligned}
B_{1}= & \frac{1}{\pi} \int_{0}^{2 \pi} y(t) \sin \omega t \mathrm{~d} \omega t=\frac{4}{\pi} \int_{0}^{\frac{\pi}{2}} y(t) \sin \omega t \mathrm{~d} \omega t \\
= & \frac{4}{\pi} \int_{0}^{\varphi_{1}} K_{1} A \sin ^{2} \omega t \mathrm{~d} \omega t+\frac{4}{\pi} \int_{\varphi_{1}}^{\frac{\pi}{2}}\left[K_{1} s+K_{2}(A \sin \omega t-s)\right] \sin \omega t \mathrm{~d} \omega t \\
= & \frac{4 K_{1} A}{\pi} \int_{0}^{\varphi_{1}} \frac{1}{2}(1-\cos 2 \omega t) \mathrm{d} \omega t+\frac{4 s}{\pi} \int_{\varphi_{1}}^{\frac{\pi}{2}}\left(K_{1}-K_{2}\right) \sin \omega t \mathrm{~d} \omega t+\frac{4 K_{2} A}{\pi} \int_{\varphi_{1}}^{\frac{\pi}{2}} \sin ^{2} \omega t \mathrm{~d} \omega t \\
= & \left.\frac{2 K_{1} A}{\pi}\left(\omega t-\frac{1}{2} \sin 2 \omega t\right)\right|_{0} ^{\varphi_{1}}+\left.\frac{4 s\left(K_{1}-K_{2}\right)}{\pi}(-\cos \omega t)\right|_{\varphi_{1}} ^{\frac{\pi}{2}}+\left.\frac{2 K_{2} A}{\pi}\left(\omega t-\frac{1}{2} \sin 2 \omega t\right)\right|_{\varphi_{1}} ^{\frac{\pi}{2}} \\
= & \frac{2 K_{1} A}{\pi}\left[\arcsin \frac{s}{A}-\frac{s}{A} \sqrt{1-\left(\frac{s}{A}\right)^{2}}\right]+\frac{4 s\left(K_{1}-K_{2}\right)}{\pi} \sqrt{1-\left(\frac{s}{A}\right)^{2}} \\
& +\frac{2 K_{2} A}{\pi}\left[\frac{\pi}{2}-\arcsin \frac{s}{A}+\frac{s}{A} \sqrt{1-\left(\frac{s}{A}\right)^{2}}\right] \\
= & K_{2} A+\frac{2 A}{\pi}\left(K_{1}-K_{2}\right)\left[\arcsin \frac{s}{A}+\frac{s}{A} \sqrt{1-\left(\frac{s}{A}\right)^{2}}\right]
\end{aligned}
$$

因此，该非线性部分的描述函数为

$$
N(A)=\frac{B_{1}}{A}+\mathrm{j} \frac{A_{1}}{A}=K_{2}+\frac{2}{\pi}\left(K_{1}-K_{2}\right)\left[\arcsin \frac{s}{A}+\frac{s}{A} \sqrt{1-\left(\frac{s}{A}\right)^{2}}\right], \quad A \geqslant s
$$

（2）有死区的继电特性。通过作图法获得 $y(t)$ ，如图 8－13－2 所示，其中 $\varphi_{1}=\arcsin \frac{h}{A}$ 。
输出 $y(t)$ 的输出表达式为

$$
y(t)= \begin{cases}0, & 0 \leqslant \omega t \leqslant \varphi_{1} \\ M, & \varphi_{1}<\omega t \leqslant \frac{\pi}{2}\end{cases}
$$



<!-- source_pdf_page: 286 -->
由图8－13－2可见，$y(t)$ 是奇函数，所以有 $A_{1}=0$ 。而 $y(t)$ 又为半周期内对称，故

$$
\begin{aligned}
B_{1} & =\frac{4}{\pi} \int_{0}^{\frac{\pi}{2}} y(t) \sin \omega t \mathrm{~d} \omega t=\frac{\pi}{4} \int_{\varphi_{1}}^{\frac{\pi}{2}} M \sin \omega t \mathrm{~d} \omega t \\
& =-\left.\frac{4 M}{\pi} \cos \omega t\right|_{\varphi_{1}} ^{\frac{\pi}{2}}=\frac{4 M}{\pi} \cos \varphi_{1}=\frac{4 M}{\pi} \sqrt{1-\left(\frac{h}{A}\right)^{2}}, \quad A \geqslant h
\end{aligned}
$$

则该非线性环节的描述函数为

$$
N(A)=\frac{B_{1}}{A}+\mathrm{j} \frac{A_{1}}{A}=\frac{4 M}{\pi A} \sqrt{1-\left(\frac{h}{A}\right)^{2}}, \quad A \geqslant h
$$

（3）$y=x^{2}$ 。通过作图法获得 $y(t)$ ，如图 8－13－3 所示。
因 $y(x)$ 是 $x$ 的奇函数，故 $A_{0}=0$ ，当输人为 $x=A \sin \omega t$ 时

$$
y(t)=A^{3} \sin ^{3} \omega t
$$

为 $t$ 的奇函数，所以 $A_{1}=0$ 。又因为 $y(t)$ 具有半周期对称，故

$$
B_{1}=\frac{4}{\pi} \int_{0}^{\frac{\pi}{2}} y(t) \sin \omega t \mathrm{~d} \omega t=\frac{\pi}{4} \int_{0}^{\frac{\pi}{2}} A^{3} \sin ^{3} \omega t \mathrm{~d} \omega t
$$

由定积分公式

得

$$
\begin{gathered}
I_{n}=\int_{0}^{\frac{\pi}{2}} \sin ^{n} \omega t \mathrm{~d} \omega t= \begin{cases}\frac{(n-1)(n-3) \times \cdots \times 4 \times 2}{n(n-2)(n-4) \times \cdots \times 5 \times 3}, & n \text { 为奇整数 } \\
\frac{(n-1)(n-3) \times \cdots \times 5 \times 3 \times 1}{n(n-2) \times \cdots \times 4 \times 2} \times \frac{\pi}{2}, & n \text { 为偶整数 }\end{cases} \\
B_{1}=\frac{\pi}{4} \times A^{3} \times \frac{3}{8} \times \frac{\pi}{2}=\frac{3}{4} A^{3}
\end{gathered}
$$

则该非线性元件的描述函数为

$$
N(A)=\frac{B_{1}}{A}+\mathrm{j} \frac{A_{1}}{A}=\frac{3}{4} A^{2}
$$

![](assets/fig-08-13-02.png)

> Image description: The image contains three coordinated plots illustrating a relay characteristic with a dead zone and its corresponding sinusoidal response. The top-left plot shows the relay transfer function on $x$ and $y$ axes. The output remains zero for $x$ values between $0$ and $h$, then jumps to a constant value $M$ for $x > h$. The top-right plot displays a square wave response over time, with the horizontal axis labeled $2\pi\omega t$. The signal transitions from zero to a positive peak at $\phi_1$, returns to zero at $\pi$, and drops to a negative peak before returning to zero at $2\pi\omega t$. The bottom plot shows a sinusoidal input wave plotted along a vertical time axis ($2\pi\omega t$) against a horizontal $x$ axis. Dashed lines connect the dead zone threshold $h$ from the first plot and the switching time $\phi_1$ from the second plot to this sine wave, demonstrating how the dead zone affects the timing of the relay's output response.
图8－13－2 具有死区的继电特性和正弦响应曲线

![](assets/fig-08-13-03.png)

> Image description: The image contains three coordinate plots illustrating a relay characteristic with a dead zone and its corresponding sinusoidal response. On the left, two vertically aligned graphs share an x-axis. The top graph shows a non-linear relay transfer function $y(x)$ that passes through the origin but exhibits a flat region (dead zone) around $x=0$. The bottom graph plots $\omega t$ on the vertical axis against $x$ on the horizontal axis, showing a sinusoidal wave shifted relative to the x-axis. To the right is a third plot with a vertical y-axis and a horizontal $\omega t$ axis. It displays a standard sine wave starting at 0, peaking, crossing zero at $\pi$, reaching a minimum, and returning to zero at $2\pi$. Dashed lines connect the peak and trough of this output waveform back to the corresponding values on the relay characteristic curve in the first plot.
图8－13－3 $y=x^{3}$ 特性和正弦响应曲线

8－14 将图 8－84 所示非线性系统简化成典型结构图形式，并写出线性部分的传递函数。

解 本题可根据系统结构图简化规则，对结构图中的线性环节进行等效变换，得到典型



<!-- source_pdf_page: 287 -->
![](assets/fig-08-84.png)

> Image description: The image contains two control system block diagrams, labeled (a) and (b), illustrating nonlinear system structures. Both diagrams feature a reference input $r=0$ entering a summing junction, with an output variable $c$. In diagram (a), the forward path consists of a nonlinear block $N(A)$ followed by a linear transfer function $G_1(s)$. There are two feedback loops: an inner loop passing through $H_1(s)$ and an outer unity feedback loop. The signals from both loops return to summing junctions with negative signs. In diagram (b), the forward path contains only the linear block $G_1(s)$. The inner feedback loop is modified; it now consists of the nonlinear block $N(A)$ followed by the transfer function $H_1(s)$, before returning to the second summing junction. The outer unity feedback loop remains identical to diagram (a). Both figures use arrows to indicate signal flow from left to right and back through the feedback paths.
图 8－84 题 8－14 的非线性系统结构图

结构图形式和线性部分的传递函数。
图8－84（b）经过结构简化，如图 8－14－1所示。得线性部分的传递函数

$$
G(s)=H_{1}(s) \frac{G_{1}(s)}{1+G_{1}(s)}
$$

![](assets/fig-08-14-01.png)

> Image description: The image contains two side-by-side control system block diagrams labeled as Figure 8-14-1 (simplified structural diagram of nonlinear system (b)). The left diagram shows a closed-loop feedback system. The forward path consists of a summing junction leading to a block with the transfer function $\frac{G_1(s)}{1+G_1(s)}$. The feedback path contains two blocks in series: $H_1(s)$ followed by a nonlinear element $N(A)$. Arrows indicate signal flow from the input, through the forward block to the output, and back through the feedback loop to the negative terminal of the summing junction. The right diagram shows a simplified version of the system. The forward path consists of the nonlinear block $N(A)$ followed by a linear block $G(s)$. A single feedback line connects the output directly back to the negative terminal of the summing junction, creating a unity feedback loop. Both diagrams represent engineering models for analyzing stability and response in nonlinear control systems.
图8－14－1 非线性系统（b）的简化结构图

图8－84（a）经过结构简化，如图8－14－2所示。得线性部分的传递函数

$$
G(s)=G_{1}(s)\left[1+H_{1}(s)\right]
$$

![](assets/fig-08-14-02.png)

> Image description: The image contains two side-by-side control system block diagrams labeled as part of Figure 8-14-2, depicting simplified structures of a nonlinear system. The left diagram shows a closed-loop feedback system. A summing junction receives an input and a negative feedback signal. The forward path consists of a nonlinear block $N(A)$ followed by a linear transfer function block $G_1(s)$. The output is fed back through a block labeled $1+H_1(s)$, which returns to the summing junction. The right diagram shows a simplified version of the same system. It also features a summing junction and a forward path containing the nonlinear block $N(A)$ followed by a linear transfer function block $G(s)$. In this configuration, the feedback loop is a direct unity connection from the output back to the negative terminal of the summing junction, omitting the intermediate feedback block seen in the first diagram.
图8－14－2 非线性系统（a）的简化结构图

8－15 根据已知非线性特性的描述函数，求图 8－85 所示各种非线性特性的描述函数。

![](assets/fig-08-85.png)

> Image description: This image contains three diagrams illustrating nonlinear characteristics used in control engineering to derive describing functions. Figure (a) shows a linear characteristic with a dead zone. The plot of $y$ versus $x$ features a flat segment on the x-axis between $-a$ and $a$, with linear slopes of $K$ for $|x| > a$. Figure (b) depicts a relay characteristic with a dead zone. The output $y$ remains zero for $x$ between $0$ and $a$, jumps to $M$ when $x > a$, and further increases to $2M$ when $x > b$. A symmetric negative step occurs for $x < 0$. Figure (c) shows a block diagram where two nonlinear elements are connected in series. An input signal $x$ enters the first block, which contains a dead-zone linear characteristic with parameters $K$ and $\Delta$, producing output $x_1$. This signal then enters a second block representing a relay characteristic with parameters $M$ and $h$, resulting in final output $y$.
图8－85 题8－15的非线性特性

解 本题可根据等效法则，首先将非线性环节分解或综合成等效非线性环节，再根据已知非线性特性的描述函数，求出等效非线性环节的描述函数。



<!-- source_pdf_page: 288 -->
图8－85（a）中的非线性环节相当于死区非线性和死区继电非线性环节（图8－15－1）的并联。

![](assets/fig-08-15-01.png)

> Image description: This technical diagram illustrates a parallel combination of two nonlinear blocks that together function as a single equivalent system. The input signal is $x = A \sin \omega t$. This signal splits into two paths: The top block produces output $y_1$, characterized by a step-like nonlinearity with thresholds at $\pm a$ and an amplitude of $Ka$. The bottom block produces output $y_2$, featuring a dead-zone nonlinearity where the output is zero between $-a$ and $a$, and linear with slope $K$ outside this range. These two outputs are combined in a summation junction ($y = y_1 + y_2$). An equals sign indicates that this parallel configuration is equivalent to the single block on the right. The final equivalent transfer function shows a continuous linear relationship with slope $K$ and no dead zone, as indicated by the straight line passing through the origin on the $x$-$y$ axes.
图8－15－1 非线性特性并联时的等效非线性特性

由描述函数定义，并联等效非线性特性的描述函数为各非线性特性描述函数的代数和。因此

$$
\begin{aligned}
N(A) & =N_{1}(A)+N_{2}(A) \\
& =\frac{4 K a}{\pi A} \sqrt{1-\left(\frac{a}{A}\right)^{2}}+\frac{2 K}{\pi}\left[\frac{\pi}{2}-\arcsin \frac{a}{A}-\frac{a}{A} \sqrt{1-\left(\frac{a}{A}\right)^{2}}\right] \\
& =K-\frac{2 K}{\pi} \arcsin \frac{a}{A}+\frac{2 K a}{\pi A} \sqrt{1-\left(\frac{a}{A}\right)^{2}}, \quad A \geqslant a
\end{aligned}
$$

图8－85（b）中的非线性环节相当于两个死区继电非线性环节（图8－15－2）的并联：

$$
N(A)=N_{1}(A)+N_{2}(A)=\frac{4 M}{\pi A}\left[\sqrt{1-\left(\frac{a}{A}\right)^{2}}+\sqrt{1-\left(\frac{b}{A}\right)^{2}}\right], \quad A \geqslant b
$$

对于图8－85（c），由于非线性特性对称，故只需考虑 $x>0$ 的情况。当 $x_{1}>h$ 时，$y=M$ ，否则 $y=0$ ；当 $x_{1}>0$ 时，$x_{1}=K(x-\Delta)$ 。令 $x_{1}=h$ ，则有 $h=K(x-\Delta)$ ，故

$$
x=\Delta+\frac{h}{K}
$$

即当 $x>\Delta+\frac{h}{K}$ 时，$x_{1}>h, y=M$ 。因此，图8－85（c）中两个非线性环节可以等效为图8－15－3

![](assets/fig-08-15-02.png)

> Image description: This engineering diagram illustrates the parallel combination of two non-linear blocks that are summed to create a single equivalent block. On the left, an input signal $x = A \sin \omega t$ splits into two paths. The top path enters a block with a transfer function $y_1$, characterized by a step response that jumps from $0$ to $M$ at $x=a$ and from $0$ to $-M$ at $x=-a$. The bottom path enters a similar block for $y_2$, which jumps to $M$ at $x=b$ and to $-M$ at $x=-b$. These two outputs are combined in a summation circle ($y = y_1 + y_2$). On the right, an equals sign indicates that this system is equivalent to a single block. The resulting transfer function graph shows a multi-step output: it reaches $M$ when $a < x < b$, and climbs further to $2M$ when $x > b$. Symmetrical negative steps occur for $x < -a$ and $x < -b$.
图8－15－2 非线性特性并联时的等效非线性特性



<!-- source_pdf_page: 289 -->
死区继电非线性环节，其描述函数

$$
N(A)=\frac{4 M}{\pi A} \sqrt{1-\left(\frac{h^{\prime}}{A}\right)^{2}}, \quad A \geqslant h^{\prime}
$$

其中 $h^{\prime}=\Delta+\frac{h}{K}$ 。

![](assets/fig-08-15-03.png)

> Image description: This image shows a block diagram illustrating the series connection of two nonlinear elements and their resulting equivalent nonlinearity. On the left, an input signal $x$ enters the first block, which contains a graph with axes $x_1$ and $x$. The function is characterized by a slope $K$ and dead-zone offsets $\Delta$ and $-\Delta$, outputting signal $x_1$. This $x_1$ then serves as the input to a second block. The second block's graph features axes $y$ and $x_1$, depicting a saturation characteristic with limits $M$ and $-M$ and thresholds $h$ and $-h$, resulting in output $y$. An equals sign separates this sequence from a single equivalent block on the right. This final block takes input $x$ and produces output $y$ via a combined nonlinear function, where the saturation threshold is relabeled as $h'$. The caption identifies this as "Equivalent nonlinear characteristics when nonlinear characteristics are connected in series."
图 8－15－3 非线性特性串联时的等效非线性特性

8－16 某单位反馈系统，其前向通道中有一描述函数 $N(A)=\mathrm{e}^{-\mathrm{j} \frac{\pi}{4}} / A$ 的非线性元件，线性部分的传递函数为 $G(s)=15 / s(0.5 s+1)$ ，试用描述函数法确定系统是否存在自振？若有，参数是多少？

解 首先应绘制出非线性部分的负倒描述函数和线性部分的幅相特性曲线，求出自振点，并由奈氏判据判断其稳定性。

![](assets/fig-08-16-01.png)

> Image description: A technical diagram illustrating the stability analysis of a nonlinear system, labeled as Figure 8-16-1 (图8－16－1 非线性系统的稳定性分析). The figure features a complex plane with a vertical axis labeled "$j$" and a horizontal real axis. An arrow originates from the origin ($0$) and curves downward and to the left into the third quadrant, representing the frequency response $G(j\omega)$. The curve terminates at a point on the negative real axis marked by the expression $-\frac{1}{N(A)}$. The trajectory of the curve is indicated by an arrowhead pointing away from the origin. In engineering terms, this plot typically represents a Nyquist-like stability criterion for nonlinear systems, where the relationship between the linear plant $G(j\omega)$ and the nonlinear gain $N(A)$ determines system stability based on whether the locus encircles the critical point $-\frac{1}{N(A)}$.
图8－16－1 非线性系统的稳定性分析

由题意知非线性部分的描述函数为

$$
N(A)=\mathrm{e}^{-\mathrm{j} \frac{\pi}{4}} / A
$$

其负倒描述函数为

$$
-\frac{1}{N(A)}=-A \mathrm{e}^{\mathrm{j} \frac{\pi}{4}}
$$

作 $-\frac{1}{N(A)}$ 曲线如图 8－16－1 所示。线性部分 $G(s)$ 的 $\Gamma_{G}$ 曲线如图 8－16－1 中曲线所示。由图可知系统存在稳定的自振点。

由描述函数分析法，有

即

联立方程组

$$
\begin{aligned}
& G(\mathrm{j} \omega)=-\frac{1}{N(A)} \\
& \left\{\begin{array}{l}
|G(\mathrm{j} \omega)|=\left|\frac{1}{N(A)}\right| \\
\angle G(\mathrm{j} \omega)=-\pi-\angle N(A)
\end{array}\right. \\
& \left\{\begin{array}{l}
\frac{15}{\omega \sqrt{1+0.25 \omega^{2}}}=A \\
-\frac{\pi}{2}-\arctan \frac{\omega}{2}=\frac{\pi}{4}-\pi
\end{array}\right.
\end{aligned}
$$

解得 $\omega=2, A=5.3$ 。系统产生自振荡，$x(t)=5.3 \sin 2 t$ 。
运行 MATLAB 程序 exe816．m 可得线性部分 $G(s)$ 的幅相特性曲线和 $-1 / N(A)$ 曲线，如图8－16－2所示。在图8－16－2 中可以通过鼠标取点确定交点处 $\omega=2.01$ ，然后在 MATLAB命令窗口的＂传递函数频率特性曲线和负倒描述函数曲线交点为自振频率 $\mathrm{w}=$＂语句后输入 2．01，可计算得到自振振幅 $A=5.26$ ，由此可知，仿真结果与计算结果一致。

MATLAB 程序 ：exe816．m



<!-- source_pdf_page: 290 -->
```
G = tf([15],[0.5 10]);
A = 0:0.01:100;
N1 = - A * exp(0.25 * pi * i);
x = real(N1);y=imag(N1);
plot(x,y);
hold on;
nyquist(G);
axis([-10,1,-10,10]);
```

\％由传递函数频率特性曲线和负倒描述函数曲线得自振频率 w
$\mathrm{w}=$ input $\left({ }^{\prime}\right.$ 传递函数频率特性曲线和负倒描述函数曲线交点为自振频率 $\mathrm{w}={ }^{\prime}$ ）；
syms $s$

$$
\begin{aligned}
& S=w * i ; \\
& G w=15 /(s *(0.5 * s+1)) ;
\end{aligned}
$$

![](assets/fig-08-16-02.png)

> Image description: This image is a technical plot from a textbook, captioned "图8－16－2 题8－16稳定性分析（MATLAB)," depicting a stability analysis in the complex plane. The graph features a horizontal "Real Axis" ranging from -10 to 1 and a vertical "Imaginary Axis" ranging from -10 to 10. Two distinct curves are plotted, both originating from the origin (0,0). One curve is labeled $G(j\omega)$, which descends into the third quadrant toward the bottom-left. The second curve is labeled $-\frac{1}{N(A)}$, which arcs upward into the second quadrant and then extends downward into the third quadrant. Both curves include directional arrows indicating their trajectory as frequency or parameters change. A dashed vertical line marks the imaginary axis, and a dashed horizontal line marks the real axis. In engineering terms, this represents a Nyquist-style stability analysis used to determine system stability based on the intersection of these loci.
图8－16－2 题8－16稳定性分析（MATLAB）

\％得自振振幅
$\mathrm{A}=\operatorname{norm}(\mathrm{Gw})$
8－17 已知非线性系统的结构图如图8－86所示，图中非线性环节的描述函数 $N(A)= \frac{A+6}{A+2}(A>0)$ ，试用描述函数法确定：
（1）使该非线性系统稳定、不稳定以及产生周期运动时，线性部分的 $K$ 值范围；
（2）判断周期运动的稳定性，并计算稳定周期运动的振幅和频率。
解 本题首先应绘制出非线性部分的负倒描述函数和线性部分的幅相特性曲线，求出自振点，并由奈氏判据求出非线性系统稳定、不稳定以及产生周期运动时的 $K$ 值范围。
（1）确定 $K$ 值范围。非线性环节的描述函数为

$$
N(A)=\frac{A+6}{A+2}, \quad A>0
$$

其负倒描述函数为

$$
-\frac{1}{N(A)}=-\frac{A+2}{A+6}
$$

为单调减函数，作 $-\frac{1}{N(A)}$ 曲线如图 8－17－1 所示。

![](assets/fig-08-86.png)

> Image description: This image shows a control system block diagram representing a feedback loop. The process begins with an input signal $r=0$ entering a summing junction, where it is compared with a feedback signal (indicated by a minus sign). The error signal from the summing junction flows via an arrow into a block labeled $N(A)$, which represents a non-linear element. The output of this block then enters a second block containing the transfer function $\frac{K}{s(s+1)^2}$. Finally, the system produces an output variable $c$. A feedback path connects the output $c$ back to the summing junction, completing the loop. From an engineering perspective, this diagram depicts a closed-loop control system with a non-linear component and a third-order linear plant. The caption mentions that for a monotonically decreasing function, a curve of $-\frac{1}{N(A)}$ is plotted as shown in Figure 8-17-1, suggesting the diagram is used for stability analysis via the describing function method.
图 8－86 题 8－17 的非线性系统结构图

![](assets/fig-08-17-01.png)

> Image description: A technical diagram showing a Nyquist plot of a frequency response function $G(j\omega)$ in the complex plane. The horizontal axis represents the real part, and the vertical axis is labeled with $j$ to represent the imaginary part. The plot features a curved trajectory starting from the origin $(0,0)$, moving into the fourth quadrant (negative imaginary values), and curving back toward the negative real axis. An arrow indicates the direction of increasing frequency $\omega$. The curve intersects the real axis at two specific points: one labeled $-\frac{K}{2}$ and another further left labeled $-\frac{1}{N(A)}$. A point on the real axis is also marked as $-\frac{1}{3}$. The plot extends toward the critical point $-1$ on the real axis. This figure is used in control engineering to analyze the stability of a nonlinear system, specifically relating to the Nyquist stability criterion.
图 8－17－1 系统稳定性分析



<!-- source_pdf_page: 291 -->
线性部分 $G(s)$ 的 $\boldsymbol{\Gamma}_{G}$ 曲线如图 8－17－1 所示，其中穿越频率

$$
\omega_{x}=\frac{1}{\sqrt{1 \times 1}}=1
$$

$\boldsymbol{\Gamma}_{G}$ 曲线与负实轴的交点为

$$
G\left(\mathrm{j} \omega_{x}\right)=-\frac{1 \times 1 \times K}{1+1}=-\frac{K}{2}
$$

当 $0<K<\frac{2}{3}$ 时， $\boldsymbol{\Gamma}_{G}$ 曲线不包围 $-\frac{1}{N(A)}$ 曲线，系统稳定。
当 $\frac{2}{3}<K<2$ 时， $\boldsymbol{\Gamma}_{G}$ 曲线和 $-\frac{1}{N(A)}$ 曲线存在交点 $\left(-\frac{K}{2}, \mathrm{j} 0\right),-\frac{1}{N(A)}$ 曲线由不稳定区域进入稳定区域，系统存在稳定的自振。

当 $2<K<\infty$ 时， $\boldsymbol{\Gamma}_{G}$ 曲线完全包围 $-\frac{1}{N(A)}$ 曲线，系统不稳定。
由以上讨论可知，随着 $K$ 的增大，系统由稳定变成自振，最终不稳定。
利用 MATLAB 程序 exe817．m 验证上述过程，分析结果一致。
MATLAB 程序 ：exe817．m

$$
\begin{aligned}
& \begin{array}{l}
A=0.01: 0.01: 100 ; \\
x=\operatorname{real}(-(A+2) . /(A+6)) ; y=\operatorname{imag}(-(A+2) . /(A+6)) ; \\
\operatorname{plot}(x, y) ; \text { hold on } \\
k=[0.51 .52 .5] ; \\
\text { figure }(1) \\
\text { for } i=1: 1: 3 ; \\
G=\operatorname{zpk}([\square,[0-1-1], k(i)) ; \\
\text { nyquist }(G) ; \text { hold on; } \\
\text { end } \\
\text { axis }([-2.5,0,-1,1]) ;
\end{array} \text { \%绘足上述三种讨论情况下取值 } k \text { 不同取值时的奈氏曲线 } \\
&
\end{aligned}
$$

（2）当系统产生稳定的周期运动时确定自振参数。由描述函数分析法可知

$$
\begin{aligned}
G(\mathrm{j} \omega) & =-\frac{1}{N(A)} \\
-\frac{K}{2} & =-\frac{A+2}{A+6}
\end{aligned}
$$

即

$$
A=\frac{6 K-4}{2-K}, \quad \frac{2}{3}<K<2
$$

另外由（1）分析可知，系统的振荡频率为 $\omega=1$ 。
8－18 非线性系统如图 8－87 所示，试用描述函数法分析周期运动的稳定性，并确定系统输出信号振荡的振幅和频率。

解 本题首先应根据结构图进行等效变换，求出线性部分的传递函数，然后绘制非线性部分的负倒描述函数和线性部分的幅相特性曲线，求出自振点，由频率域稳定判据判断其稳定性，并确定系统输出信号振荡的振幅和频率。
（1）将原系统结构图等效变换为图 8－18－1 所示。



<!-- source_pdf_page: 292 -->
![](assets/fig-08-87.png)

> Image description: A block diagram of a nonlinear control system is shown in Figure 8-87 (图 8－87). The system consists of a forward path and a unity negative feedback loop. The input signal $r=0$ enters a summing junction, where it is compared with the feedback signal to produce an error signal $e(t)$. This signal passes through a linear gain block labeled "5," followed by a nonlinear element represented by a saturation function graph. The saturation block has upper and lower limits of 1 and 0.2 (or -0.2), respectively. The output of the nonlinearity enters a transfer function block defined as $\frac{2}{s(s+1)}$. The final system output is labeled $c$. A feedback line connects the output $c$ back to the negative terminal of the summing junction, completing the closed-loop structure. This diagram represents a typical nonlinear feedback control loop used for stability analysis.
图 8－87 题 8－18 的非线性系统结构图

![](assets/fig-08-18-01.png)

> Image description: A control system block diagram is shown in Figure 8-87, representing a nonlinear system structure for Problem 8-18. The system consists of a negative feedback loop starting from a summing junction on the left. The forward path begins with an arrow leading into a nonlinear block containing a hysteresis element. This block features a graphical symbol of a hysteresis loop with labels "1" and "0.2" indicating its switching thresholds. An arrow then connects this nonlinearity to a linear transfer function block labeled $\frac{10}{s(s+1)}$. The output of this second block is the system's final output variable. A feedback path consists of a line returning from the output back to the summing junction, marked with a minus sign ($-$) to indicate negative feedback. This configuration describes a closed-loop control system where a nonlinear hysteresis element precedes a second-order linear plant.
图8－18－1 题 8－18 的非线性系统结构变换图

（2）非线性环节的描述函数为

$$
N(A)=\frac{4}{\pi A}\left[\sqrt{1-\left(\frac{0.2}{A}\right)^{2}}-\mathrm{j} \frac{0.2}{A}\right]
$$

其负倒描述函数为

$$
-\frac{1}{N(A)}=-\frac{\pi A}{4} \sqrt{1-\left(\frac{0.2}{A}\right)^{2}}-\mathrm{j} \frac{0.2 \pi}{4}
$$

作 $-\frac{1}{N(A)}$ 曲线如图 8－18－2 所示。
（3）等效结构图线性部分

$$
G(s)=\frac{10}{s(s+1)}
$$

其频率特性为

$$
G(\mathrm{j} \omega)=\frac{10}{\mathrm{j} \omega(\mathrm{j} \omega+1)}=-\frac{10}{\omega^{2}+1}-\mathrm{j} \frac{10}{\omega\left(\omega^{2}+1\right)}
$$

线性部分 $G(s)$ 的 $\boldsymbol{\Gamma}_{G}$ 曲线如图 8－18－2 中曲线 $G(\mathrm{j} \omega)$ 所示。
（4）周期运动的稳定性。由描述函数分析法有

$$
G(\mathrm{j} \omega)=-\frac{1}{N(A)}
$$

图 8－18－2 表明，$G(\mathrm{j} \omega)$ 与 $-1 / N(A)$ 存在交点，且 $-1 / N(A)$ 由 $G(\mathrm{j} \omega)$ 的不稳定区域穿到稳定区域，故系统存在稳定自振。由联立方程组可得

$$
\left\{\begin{array}{l}
\frac{0.2 \pi}{4}=\frac{10}{\omega\left(\omega^{2}+1\right)} \\
\frac{\pi A}{4} \sqrt{1-\left(\frac{0.2}{A}\right)^{2}}=\frac{10}{\omega^{2}+1}
\end{array}\right.
$$

解得自振频率 $\omega_{0}=3.91$ ，自振振幅 $A_{0}=0.8$ 。因此系统输出信号振荡的振幅 $A_{c}=\frac{A_{0}}{5}=$ 0.16 。

下面利用 MATLAB 程序 exe818．m 验证上述分析结果，得系统自振信号输出如图8－18－3所示，与数值计算结果基本一致。

MATLAB 程序 ：exe818．m
$\mathrm{G}=\operatorname{zpk}([],[0-1], 10) ;$
$\mathrm{A}=0.01: 0.01: 10$ ；
NA1 $=-0.25 * \mathrm{pi} . * \mathrm{~A} . * \operatorname{sqrt}(1-(0.2 . / \mathrm{A}) . \wedge 2)-\mathrm{i} * 0.2 * \mathrm{pi} / 4$ ；
$\mathrm{x}=\operatorname{real}$（NA1）； $\mathrm{y}=\operatorname{imag}$（NA1）；



<!-- source_pdf_page: 293 -->
![](assets/fig-08-18-02.png)

> Image description: A technical diagram showing a Nyquist plot of a frequency response function $G(j\omega)$ in the complex plane. The horizontal axis represents the real part and the vertical axis is labeled with $j$ to represent the imaginary part. The plot features a solid curved line starting from the origin $(0,0)$, curving downwards and to the left into the third quadrant, and ending at a point on the negative real axis. An arrow on this curve indicates the direction of increasing frequency $\omega$. The intersection of the curve with the negative real axis is explicitly labeled as $-\frac{1}{N(A)}$. Additionally, there is a horizontal line segment extending from the curve to the vertical axis, marked with the value $-0.157$. A dotted semicircular arc connects the end of the plot back toward the origin. The figure is used for system stability analysis, as indicated by the Chinese caption "图8－18－2 题 8－18 系统稳定性分析".
图8－18－2 题 8－18 系统稳定性分析

![](assets/fig-08-18-02-2.png)

> Image description: The image shows a plot of a time-domain signal $c(t)$ against time in seconds. The horizontal x-axis is labeled "Time/sec" and ranges from 0 to 10, with major grid lines every 1 second. The vertical y-axis is labeled "$c(t)$" and ranges from -0.2 to 0.2, with increments of 0.05. The graph displays an oscillating waveform that begins at the origin $(0,0)$. As time progresses, the amplitude of the oscillations increases initially before stabilizing into a steady-state sinusoidal wave. The peaks reach approximately $0.15$ and the troughs reach approximately $-0.16$. From an engineering perspective, this figure represents the stability analysis of a system (as indicated by the caption "图8－18－2 题 8－18 系统稳定性分析"). Specifically, it depicts a marginally stable or unstable response where the output oscillates with a constant or slightly growing amplitude over time.
图8－18－3 题 8－18 系统的自振信号输出（MATLAB）

```
figure(1)
plot(x,y);hold on %绘制-1/N(A)曲线
nyquist(G); %绘制线性环节的奈氏曲线
axis([-2,0,-0.5,0.5]) %重新设置坐标范围
figure(2)
t=0:0.01:10; %设定仿真时间为 10s
c0=[00 0 '; %初始条件为零
[t,c1] = ode45('sys818',t,c0); %求解微分方程
plot(t,c1(:,1));grid %绘制系统自振输出信号
调用函数:sys818.m
function dc = sys818(t,c) %描述系统微分方程
dc1 = c(2);
if ((c(1)>0.04)|(((c(1)<0.04)&(c(1)>-0.04))&(c(2)<0))
    dc2 = -c(2) -2;
else dc2 = -c(2) + 2;
end
dc = [dc1 dc2]}\mp@subsup{}{}{\prime}\mathrm{ ;
```

8－19 试用描述函数法说明图 8－88 所示系统必然存在自振，并确定 $c$ 的自振振幅和频率，画出 $c, x, y$ 的稳态波形。

解 本题首先应根据结构图进行等效变换，求出线性部分的传递函数，然后绘制非线性部分的负倒描述函数和线性部分的幅相特性曲线，求出自振点，由频域稳定判据判断其稳定性，并确定输出 $c$ 的自振振幅和频率，画出 $c, x, y$ 的稳态波形。
（1）理想继电环节的描述函数

$$
N(A)=\frac{4}{\pi A}
$$

其负倒描述函数为

$$
-\frac{1}{N(A)}=-\frac{\pi A}{4}
$$

为单调减函数，作 $-\frac{1}{N(A)}$ 曲线如图 8－19－1 所示。



<!-- source_pdf_page: 294 -->
![](assets/fig-08-88.png)

> Image description: This image shows a block diagram of a nonlinear control system, labeled as "图8－88 题 8－19 的非线性系统结构图". The system begins with an input signal $r=0$ entering a summing junction. The output of this junction is the variable $x$, which feeds into a nonlinear element represented by a signum-like function (outputting $1$ for positive inputs and $-1$ for negative inputs). The output of this nonlinear block, labeled as $y$, enters a linear transfer function block defined as $\frac{5}{s(s+2)^2}$. The final system output is denoted as $c$. A feedback loop connects the output $c$ back to the summing junction through a gain block with a value of $2$. Arrows indicate the unidirectional flow of signals from left to right, with the feedback path returning from right to left. This structure represents a closed-loop system combining a nonlinear relay and a third-order linear plant.
图8－88 题 8－19 的非线性系统结构图

![](assets/fig-08-19-01.png)

> Image description: A technical diagram illustrating a Nyquist plot for a nonlinear system in the complex plane. The horizontal axis represents the real part, and the vertical axis is labeled with $j$, representing the imaginary part. A curved trajectory, labeled as $G(j\omega)$, originates from the bottom left and moves upward and to the right. The curve crosses the real axis at a point marked $A_0$. To the left of this intersection, there is a label $-\frac{1}{N(A)}$ positioned above the real axis. A horizontal arrow points from the region near $A_0$ toward the critical point $-1$ on the real axis. The origin is marked as $0$. This figure visually represents stability analysis for a nonlinear system, specifically showing the relationship between the frequency response $G(j\omega)$ and the descriptive function $N(A)$ relative to the critical point $(-1, 0)$.
图8－19－1 系统稳定性分析

（2）线性部分的幅相曲线

$$
G(\mathrm{j} \omega)=\frac{10}{\mathrm{j} \omega(2+\mathrm{j} \omega)^{2}}
$$

线性部分的 $\boldsymbol{\Gamma}_{G}$ 曲线如图 8－19－1 中曲线所示。由图可知，$G(\mathrm{j} \omega)$ 与 $-1 / N(A)$ 存在交点 $A_{0}, A_{0}$ 点处频率为 $G(\mathrm{j} \omega)$ 的穿越频率 $\omega_{x}$ 。因

$$
G(\mathrm{j} \omega)=-\frac{40}{\omega^{4}+8 \omega^{2}+16}-\mathrm{j} \frac{10\left(4-\omega^{2}\right)}{\omega\left(\omega^{4}+8 \omega^{2}+16\right)}
$$

令 $\operatorname{Im} G(\mathrm{j} \omega)=0$ ，得 $\omega_{x}=2$ 。
$\boldsymbol{\Gamma}_{G}$ 曲线与负实轴的交点为

$$
G\left(\mathrm{j} \omega_{x}\right)=-\left.\frac{40}{\omega_{x}^{4}+8 \omega_{x}^{2}+16}\right|_{\omega_{x}=2}=-\frac{5}{8}=-0.625
$$

（3）自振稳定性。由描述函数分析法，有

$$
G(\mathrm{j} \omega)=-\frac{1}{N(A)}
$$

图 8－19－1 表示系统必然存在稳定的自振。令

$$
G\left(j \omega_{x}\right)=-\frac{1}{N(A)}=-\frac{\pi A}{4}=-\frac{5}{8}
$$

解得自振振幅

$$
A_{0}=\frac{5}{2 \pi}=0.796
$$

由此产生的自振信号为 $x(t)=0.796 \sin 2 t$ 。
利用 MATLAB 程序 exe819．m，绘制该非线性系统稳态输出波形，如图 8－19－2 所示，其中 $c 、 x$ 和 $y$ 的波形曲线分别以点线、实线和虚线表示。

MATLAB 程序 ：exe819．m

$$
\begin{aligned}
& A=0.01: 0.01: 100 ; \\
& N A 1=-4 . /(p i * A) ; \\
& x=\operatorname{real}(N A 1) ; y=\operatorname{imag}(N A 1) ;
\end{aligned}
$$

figure（1）

```
plot(x,y);hold on
%绘制-1/N(A)曲线
G= zpk([],[0-2-2],10);
nyquist(G)
%绘制线性部分的奈氏曲线
axis([-1,0,-0.5,0.5]);
% 重新设定坐标范围
```



<!-- source_pdf_page: 295 -->
```
$\mathrm{t}=0: 0.01: 14$;
$\mathrm{c} 0=\left[\begin{array}{lll}-0.1 & 0 & 0\end{array}\right]^{\prime}$;
$[\mathrm{t}, \mathrm{c}]=\operatorname{ode45}\left({ }^{\prime}\right.$ sys819', $\left.\mathrm{t}, \mathrm{c0}\right)$; \%求解微分方程
$y=\operatorname{sign}(c(:, 1))$; \%非线性环节输出
figure (2) \%绘制系统响应曲线
subplot( $3,1,1$ )
plot( $\left.t,-2 * c(:, 1),{ }^{\prime}-{ }^{\prime}\right)$;grid
axis $([0,14,-0.85,0.85])$;
subplot(3,1,2)
plot(t,c(:,1), ': ');grid
axis( $[0,14,-0,45,0,45]$ );
subplot(3,1,3)
plot(t,y,' - - ');grid
$\operatorname{axis}([0,14,-1.2,1.2])$ \% 重新设定坐标范围
调用程序: sys819
function dc $=\operatorname{sys819}(\mathrm{t}, \mathrm{c})$
dc1 = c(2) ;
dc2 = c(3);
if $((-2 * c(1))<0)$ \%描述系统的微分方程
    $\mathrm{y}=-1 ;$
else $y=1$;
end
$d c 3=-4 * c(2)-4 * c(3)+5 * y ;$
$\mathrm{dc}=\left[\begin{array}{lll}\mathrm{dc} 1 & \mathrm{dc} 2 & \mathrm{dc} 3\end{array}\right]^{\prime}$;
```

![](assets/fig-08-19-02.png)

> Image description: This image displays three vertically stacked time-domain plots representing the steady-state waveforms of a nonlinear system, generated in MATLAB. The common horizontal axis is labeled "Time/sec," ranging from 0 to 14 seconds. The top plot shows variable $x(t)$ as a solid sinusoidal wave oscillating between approximately -0.7 and 0.8. The middle plot displays variable $c(t)$ as a dashed sinusoidal wave with an amplitude ranging roughly from -0.4 to 0.4. The bottom plot depicts variable $y(t)$ as a dashed square wave, switching abruptly between values of 1 and -1. The figure illustrates the relationship between these three variables over time, where the smooth oscillations of $x(t)$ and $c(t)$ correspond to the binary switching behavior of $y(t)$. The caption identifies this as "图8－19－2 非线性系统 $c, x, y$ 的稳态波形（MATLAB）," indicating these are steady-state waveforms for a nonlinear system.
图8－19－2 非线性系统 $c, x, y$ 的稳态波形（MATLAB）

8－20 已知非线性系统的输人和输出关系式

$$
\dddot{y}+a f(\ddot{y}, \dot{y}, y)=\ddot{u}+b g(\dot{u}, u)
$$

试求伪线性系统的结构及实现形式。
解 由原系统方程可得



<!-- source_pdf_page: 296 -->
$$
\ddot{u}=\dddot{y}+a f(\ddot{y}, \dot{y}, y)-b g(\dot{u}, u)
$$

取伪线性系统的输人为

$$
\Phi=\dddot{y}
$$

则逆系统方程为

$$
\ddot{u}=\Phi+a f(\ddot{y}, \dot{y}, y)-b g(\dot{u}, u)
$$

将逆系统方程代人原系统方程可得

$$
\begin{gathered}
\dddot{y}=\Phi \\
y(s)=\frac{1}{s^{3}} \Phi(s)
\end{gathered}
$$

伪线性系统等效为三重积分环节，其实
现形式如图 8－20－1 所示。

![](assets/fig-08-20-01.png)

> Image description: A control system block diagram is shown, consisting of an "inverse system" (逆系统) enclosed in a dashed box and a "original system" (原系统). The input signal $\phi$ enters the inverse system at a summing junction. The forward path of the inverse system consists of two sequential integrators ($1/s$), producing signals $\dot{u}$ and $u$. A feedback loop from these integrators passes through a function block $g(\dot{u}, u)$ and a gain block $b$ back to the summing junction. A second feedback loop originates from the output $y$ of the original system. The signal $y$ is processed by derivative blocks ($s$ and $s^2$) and fed into a function block $f(\ddot{y}, \dot{y}, y)$, followed by a gain block $a$, which returns to the summing junction. The final output of the inverse system, $u$, serves as the input to the original system to produce output $y$.
图8－20－1 伪线性系统的结构图

8－21 已知带速度反馈的非线性系
统如图 8－89 所示。系统原来处于静止状态，且 $0<\beta<1$ ，输入 $r(t)=-R \cdot 1(t)(R>a)$ ，试分别画出有速度反馈和无速度反馈时的系统相轨迹。

![](assets/fig-08-89.png)

> Image description: This figure depicts a control system block diagram. The input signal $r(t)$ enters from the left, passing through a summing junction to produce an error signal $e(t)$. A second summing junction incorporates a feedback loop containing a gain block $\beta$ (indicated by dashed lines), which feeds back the output of the first integrator. The resulting signal enters a non-linear element represented by a graph with axes and a step function, where the output $x(t)$ switches between values based on threshold $a$ and saturation level $b$. This output $x(t)$ then passes through two successive integrators, denoted as $1/s$, to produce the final system output $c(t)$. A primary feedback loop returns $c(t)$ to the first summing junction. The diagram illustrates a second-order system with a non-linear controller and optional velocity feedback via $\beta$.
图8－89 非线性系统

解（1）无速度反馈。由图8－89可知，$x(t)=\ddot{c}(t)$ 。当 $e>a$ 时，$x=b=\ddot{c}$ ，而 $e=r$－ $c, \dot{e}=-\dot{c}, \ddot{e}=-\ddot{c}=-b$ ；当 $|e|<a$ 时，$x=\ddot{c}=0$ ，故 $\ddot{e}=0$ ；当 $e<-a$ 时，必有 $x=-b=\ddot{c}$ ，故 $\ddot{e}=-\ddot{c}=b$ 。相轨迹方程为

$$
\begin{cases}\ddot{e}=-b, & e>a \\ \ddot{e}=0, & |e|<a \\ \ddot{e}=b, & e<-a\end{cases}
$$

显然，开关线

$$
|e|=a
$$

初始条件

$$
e(0)=-R, \quad \dot{e}(0)=0
$$

当 $e<-a$ 时，$\dot{e} \frac{\mathrm{~d} \dot{e}}{\mathrm{~d} e}=b$ ，有 $\dot{e}^{2}=2 b e+C_{1}$ 。由初始条件

$$
C_{1}=\dot{e}^{2}(0)-2 b e(0)=2 b R
$$

故有

$$
\dot{e}^{2}=2 b(e+R)
$$

这是一条抛物线，其顶点为 $-R$ 。
当 $e>a$ 时，由相轨迹的对称性知，相轨迹是一条开口相反的抛物线，其顶点为 $R$ 。



<!-- source_pdf_page: 297 -->
当 $|e|<a$ 时，因 $\ddot{e}=0$ ，有 $\dot{e}=\mathrm{const}$ ，相轨迹为水平直线。
无速度反馈时，系统的相轨迹如图 8－21－1 所示。
（2）有速度反馈。系统等效结构图如图8－21－2所示。由图知

![](assets/fig-08-21-01.png)

> Image description: A black-and-white technical diagram showing a phase plane plot with horizontal axis $e$ and vertical axis $\dot{e}$. The origin is marked as $0$. On the horizontal axis, there are labels for $-R$, $-a$, $a$, and $R$. The figure depicts a closed-loop trajectory consisting of two curved arcs and two straight horizontal segments. The left and right boundaries are semi-circular arcs connecting points at $\pm R$ on the $e$-axis. These arcs are joined by two parallel horizontal line segments located at vertical positions corresponding to the peaks of the arcs, spanning between $-a$ and $a$. Directional arrows on the trajectory indicate a clockwise flow: moving upward along the left arc, rightward along the top horizontal segment, downward along the right arc, and leftward along the bottom horizontal segment. Vertical dashed lines mark the boundaries at $\pm a$. This represents a limit cycle in a dynamical system with velocity feedback.
图 8－21－1 无速度反馈时系统的相轨迹

![](assets/fig-08-21-02.png)

> Image description: A control system block diagram is shown in Figure 8-21-1. The input signal $r(t)$ enters a summing junction, where it is compared with a feedback signal to produce the error signal $e'(t)$. This error signal enters a non-linear block containing a graph with axes centered at zero; the graph depicts a relay or saturation function with thresholds at $a$ and $-a$, and output limits at $b$ and $-b$. The output of this non-linear block, labeled $x(t)$, passes through a double integrator block represented by the transfer function $\frac{1}{s^2}$. The final system output is $c(t)$. A feedback loop returns $c(t)$ through a lead/lag compensator block with the transfer function $\beta s + 1$ back to the summing junction. Arrows indicate the unidirectional flow of signals from left to right and through the feedback path.
图8－21－2 系统等效结构图

$$
e^{\prime}=r-c-\beta \dot{c}
$$

由于 $e=r-c, \dot{e}=-\dot{c}$ ，所以

$$
e^{\prime}=e+\beta \dot{e}
$$

相轨迹方程为

$$
\ddot{e}= \begin{cases}-b, & e+\beta \dot{e}>a \\ 0, & |e+\beta \dot{e}|<a \\ b, & e+\beta \dot{e}<-a\end{cases}
$$

开关线

$$
|e+\beta \dot{e}|=a
$$

初始条件

$$
e(0)=-R, \quad \dot{e}(0)=0
$$

有速度反馈时，系统的概略相轨迹如图 8－21－3 所示。
设 $a=1, b=2, \beta=0.5, R=2$ ，运行以下 MATLAB 文件，得有速度反馈时系统的相轨迹图，如图 8－21－4 所示。

![](assets/fig-08-21-03.png)

> Image description: A phase plane plot showing system trajectories with velocity feedback is presented in Figure 8-21-4. The graph features a horizontal axis labeled $e$ and a vertical axis labeled $\dot{e}$. Several closed-loop trajectories are visible, indicated by directional arrows moving clockwise. Key markers on the $e$-axis include $-R$, $-a$, $0$, and $a$. Two dashed diagonal lines intersect the phase plane, acting as boundaries or switching lines for the system's dynamics. The trajectories exhibit a limit cycle behavior: they move horizontally across the center, curve sharply around points $a$ and $-a$, and follow larger arcs that extend toward $-R$. This figure illustrates the stability and convergence of a control system in the phase plane, specifically demonstrating how velocity feedback influences the state trajectories of the error $e$ and its derivative $\dot{e}$.
图8－21－3 有速度反馈时系统的概略相轨迹

![](assets/fig-08-21-03-2.png)

> Image description: A technical plot showing a schematic phase trajectory of a system with velocity feedback (as indicated by the Chinese caption "图8-21-3 有速度反馈时系统的概略相轨迹"). The image features a 2D coordinate system with a horizontal x-axis ranging from -2 to 1 and a vertical y-axis ranging from -0.5 to 1.5. The plot displays a closed loop formed by a solid black line. This trajectory starts at (1, 0), rises linearly to approximately (0.3, 1.2), remains constant horizontally until roughly (-1.6, 1.2), and then curves downward back toward the x-axis at (-2, 0). Two dashed diagonal lines intersect the plot: one crossing from top-left to bottom-right through the point (-1, 0), and another nearly vertical dashed line on the right side. The figure illustrates the stability and limiting behavior of a dynamical system's state space under specific feedback control.
图 8－21－4 有速度反馈时系统的相轨迹（MATLAB）



<!-- source_pdf_page: 298 -->
```
MATLAB 程序:exe821.m
global a b belta R
a =1;b=2; belta=0.5;R=2;
t=0:0.01:6;
e0 = [ - 20 0 ';
[t,e2] = ode23('sys821',t,e0);
ed = - 10:0.01:10;
e3 = 1 - belta * ed;
e4 = -1 - belta * ed;
plot(e3,ed,' :',e4,ed,':')
hold on;
plot(e2(:,1),e2(:,2));
axis([-2,1,-0.5,1.5])
调用函数:
function de = sys821 (t,e)
global a b belta R
de1 = e(2);
if ((e(1) + belta * e(2))<-a)
    de2 = b;
elseif (abs(e(1) + belta * e(2))<a)
    de2 = 0;
else
    de2 = -b;
end
de = [de1 de2]}\mp@subsup{}{}{\prime}\mathrm{ ;
```

8－22 非线性系统如图 8－90 所示，其中非线性环节的描述函数 $N(A)=\frac{4 M}{\pi A}$ 。试问：
（1）当 $\tau=0$ 时，系统受扰动后的稳定运动状态呈现什么形式？
（2）当 $\tau \neq 0$ 时，要使系统产生频率 $\omega=$ 1 ，幅值 $A=2$ 的自振，$\tau$ 与 $K$ 应取何值？

解（1）$\tau=0$ 时系统的稳定运动形式。系统频率特性为

![](assets/fig-08-90.png)

> Image description: A block diagram of a nonlinear system is shown in Figure 8-90 (labeled "图8－90 非线性系统结构图"). The system consists of a feedback loop starting with a summing junction on the left, indicated by a circle with a plus and minus sign. An arrow leads from this junction into a nonlinear block containing a piecewise function $M$, where the output is $1$ for positive inputs, $0$ at zero, and $-1$ for negative inputs. The output of the nonlinear block feeds into a linear transfer function block represented by the expression $\frac{Ke^{-rs}}{s(s+1)(s+2)}$. The final system output is labeled as $c(t)$. A feedback path consists of a line returning from the output $c(t)$ back to the negative terminal of the initial summing junction, completing the closed-loop control structure.
图8－90 非线性系统结构图

$$
G(\mathrm{j} \omega)=\frac{K}{\mathrm{j} \omega(\mathrm{j} \omega+1)(\mathrm{j} \omega+2)}=\frac{K}{-3 \omega^{2}-\mathrm{j}\left(\omega^{3}-2 \omega\right)}
$$

负倒描述函数为

$$
-\frac{1}{N(A)}=-\frac{\pi A}{4 M}=-\frac{\pi A}{4}
$$

绘制 $G(\mathrm{j} \omega)$ 与－ $1 / N(A)$ 曲线，如图 8－22－1 所示。由图 8－22－1 知，$G(\mathrm{j} \omega)$ 与－ $1 / N(A)$ 存在交点 $A_{0}$ ，且当振幅增大时，$-1 / N(A)$ 从不稳定区域进入稳定区域，所以系统受扰后稳定运动状态呈现稳定自振。



<!-- source_pdf_page: 299 -->
![](assets/img-chapter-08-074.png)

> Image description: A technical diagram illustrating the stability rate characteristics of a system when $\tau=0$. The figure features a complex plane with a vertical imaginary axis labeled $j$ and a horizontal real axis. An origin point is marked as $0$. A curved plot, labeled $G(j\omega)$, originates from the bottom left and arcs upward toward the right, intersecting the real axis at a point labeled $A_0$. From this intersection point $A_0$, a straight line with an arrow extends horizontally to the left. Above this horizontal line is the mathematical expression $\frac{-1}{N(A)}$. A double-headed arrow on the real axis indicates the bidirectional nature of the axis. The plot represents the frequency response and stability margins of a control system in the complex plane, specifically showing the relationship between the open-loop transfer function $G(j\omega)$ and the critical point defined by the characteristic equation.

因交点 $A_{0}$ 在负实轴上，必有 $\operatorname{Im} G\left(\mathrm{j} \omega_{0}\right)=0$ ，因而 $\omega_{0}^{3}-2 \omega_{0} =0$ ，解得自振频率 $\omega_{0}=0$（舍去）和 $\omega_{0}=\sqrt{2}$ 。而

$$
\operatorname{Re} G\left(\mathrm{j} \omega_{0}\right)=-\frac{1}{N\left(A_{0}\right)}=-\frac{\pi A_{0}}{4}
$$

有 $-\left.\frac{K}{3 \omega_{0}^{2}}\right|_{\omega_{0}=\sqrt{2}}=-\frac{\pi A_{0}}{4}$ ，可求出自振振幅 $A_{0}=\frac{2 K}{3 \pi}$ 。
（2）$\tau \neq 0$ 时产生自振的系统参数 $K$ 与 $\tau$ 值。线性部分频
图8－22－1 $\tau=0$ 时系统的稳定 率特性为
性分析

$$
G(\mathrm{j} \omega)=\frac{K \mathrm{e}^{-\mathrm{j} \omega}}{\mathrm{j} \omega(\mathrm{j} \omega+1)(\mathrm{j} \omega+2)}
$$

由题意，系统自振频率 $\omega=1$ ，自振振幅 $A=2$ ，在 $G(\mathrm{j} \omega)$ 与 $-1 / N(A)$ 的交点上，有

$$
-\frac{1}{N(A)}=-\frac{2 \pi}{4}=-\frac{\pi}{2}
$$

因

$$
|G(\mathrm{j} 1)|=\frac{K}{\sqrt{1+1} \cdot \sqrt{1+4}}=\frac{K}{\sqrt{10}}
$$

根据 $\frac{K}{\sqrt{10}}=\frac{\pi}{2}$ ，可求出

由

$$
\begin{gathered}
K=\frac{\sqrt{10} \pi}{2}=4.97 \\
\angle G(\mathrm{j} 1)=-90^{\circ}-\arctan 1-\arctan 0.5-57.3 \tau=-180^{\circ}
\end{gathered}
$$

可求出 $\tau=0.32$ 。故所求参数值为

$$
K=4.97, \quad \tau=0.32
$$

MATLAB 验证：
运行 MATLAB 文件 exe823， m ，可得系统在 $K=4.97, \tau=0.32$ 时的 $G(\mathrm{j} \omega)$ 与 $-1 / N(A)$ 曲线，如图 8－22－2 所示。

![](assets/fig-08-22-02.png)

> Image description: This image shows a Nyquist plot used in control engineering to analyze system stability. The graph features a horizontal "Real Axis" and a vertical "Imaginary" axis, with the origin at (0,0). Two primary curves are plotted: 1. A frequency response curve labeled $G(\mathrm{j}\omega)$, which forms a large loop extending into the left-half plane. Arrows indicate the direction of increasing frequency $\omega$, moving from the origin, looping around to the left, and returning toward the origin. 2. A straight line segment on the real axis labeled $-\frac{1}{N(A)}$. The two curves intersect at a specific point marked $A_1$, located approximately at $-1.6$ on the real axis. The plot illustrates the relationship between the open-loop transfer function and the characteristic equation of the system for specific parameters ($K=4.97, \tau=0.32$), used to determine stability via the Nyquist stability criterion.
图8－22－2 $\tau \neq 0$ 时系统的稳定性分析（MATLAB）

MATLAB 程序 ：exe822．m

$$
\begin{aligned}
& K=4.97 ; \operatorname{tao}=0.32 ; \\
& G=\operatorname{zpk}([],[0-1-2], K, \text { inputdelay', } \\
& ; \\
& A=0.01: 0.01: 100 ; \\
& \text { NA1 }=-4 . /(\mathrm{pi} * A) ; \\
& x=\operatorname{real}(\mathrm{NA} 1) ; y=\operatorname{imag}(\mathrm{NA} 1) ; \\
& \operatorname{plot}(\mathrm{x}, \mathrm{y}) ; \text { hold on } \\
& w=0: 0.01: 10 ; \\
& \text { nyquist }(G, w) \\
& \operatorname{axis}([-20.05-0.40 .4])
\end{aligned}
$$

在 MATLAB 的 Simulink 环境下搭建如图 8－22－3 所示的延迟系统模型，并设定初始条件 $c(0)=1$ ，仿真可得系统在 $K=4.97, \tau=0.32$ 时的输出时间响应 $c(t)$ ，如图 8－22－4 所示。



<!-- source_pdf_page: 300 -->
![](assets/fig-08-22-03.png)

> Image description: This image shows a Simulink block diagram of a delayed system model, labeled as Figure 8-22-3 (图8-22-3). The control loop begins with a "Constant" block set to 0, which enters a summation junction. The error signal passes through a "Sign" function block and a "Transport Delay" block before reaching a gain block $K$ with a value of 4.97. The signal then flows into a "Zero-Pole" transfer function block defined as $\frac{1}{(s+1)(s+2)}$, followed by an "Integrator" block $\frac{1}{s}$. The output, denoted as $c(t)$, is sent to a scope and a "To Workspace" block. A feedback loop connects the integrator's output back to the initial summation junction. Additionally, a separate path consists of a "Clock" connected to a "To Workspace2" block for time variable $t$. The diagram represents a closed-loop system incorporating non-linear signum control and transport delay.
图8－22－3 Simulink 环境下的延迟系统模型

![](assets/fig-08-22-03-2.png)

> Image description: A line graph plotting a time-domain signal $c(t)$ against time in seconds. The horizontal x-axis is labeled "Time/sec" and ranges from 0 to 40, with major grid increments every 5 seconds. The vertical y-axis is labeled "$c(t)$" and ranges from -2.5 to 2.5, with markings every 0.5 units. The plot displays a periodic sinusoidal waveform. It begins at $t=0$ with an initial value of 1. After a brief transient period, the signal settles into a steady-state oscillation between approximately -2 and 2. The wave exhibits a constant frequency and amplitude throughout the majority of the time window. In an engineering context, this represents the output response of a system over time, specifically illustrating a delayed system model as indicated by the provided Chinese caption "图8－22－3 Simulink 环境下的延迟系统模型".
图8－22－4 系统输出时间响应（MATLAB）

8－23 若使图 8－91 所示非线性系统输出量 $c$ 的自振振幅 $A_{c}=0.1$ ，角频率 $\omega=10$ ，试确定参数 $T$ 及 $K$ 的数值（ $T 、 K$ 均大于零）。

![](assets/fig-08-91.png)

> Image description: This image shows a block diagram of a non-linear control system in a negative feedback loop. The input signal is labeled as $r=0$. The forward path consists of three sequential blocks: 1. A linear transfer function block $\frac{10}{Ts+1}$. 2. A non-linear saturation element with upper and lower limits of $\sqrt{2}$ and $-\sqrt{2}$, respectively, and a linear region centered at $0$. 3. A second linear transfer function block $\frac{K}{s(0.1s+1)}$. The output of the system is labeled as $c$. A feedback line connects the output $c$ back to a summing junction at the input, where it is subtracted from $r$. Arrows indicate the unidirectional flow of signals from left to right through the blocks and backward through the feedback loop. The diagram represents a closed-loop system used for analyzing self-sustained oscillations (limit cycles) based on parameters $T$ and $K$.
图8－91 非线性系统结构图

解（1）结构图归化。将系统等效为典型的结构形式，其中非线性部分的描述函数为

$$
N(A)=\frac{4 \sqrt{2}}{\pi A}
$$

线性部分的传递函数为

$$
G(s)=\frac{10 K}{s(T s+1)(0.1 s+1)}
$$

（2）稳定性分析及参数确定。负倒描述函数为

$$
-\frac{1}{N(A)}=-\frac{\pi A}{4 \sqrt{2}}
$$

显然，$-\frac{1}{N(0)}=0,-\frac{1}{N(\infty)}=-\infty$ 。
线性部分的频率特性为

$$
G(\mathrm{j} \omega)=\frac{10 K}{\mathrm{j} \omega(\mathrm{j} T \omega+1)(\mathrm{j} 0.1 \omega+1)}
$$



<!-- source_pdf_page: 301 -->
概略绘制 $\Gamma_{G}$ 与－ $1 / N(A)$ 的曲线如图 8－23－1 所示。由图可知，$\Gamma_{G}$ 与 $-1 / N(A)$ 曲线存在交点，且当振幅增大时，$-1 / N(A)$ 曲线从不稳定区域进人稳定区域，所以系统在满足下列 $T$ 、 $K$ 数值时呈现频率 $\omega=10$ 的稳定自振。

因交点在负实轴上，必有 $\operatorname{Im} G(\mathrm{j} 10)=0$ ，即

$$
-90^{\circ}-\arctan 1-\arctan (10 T)=-180^{\circ}
$$

求得 $T=0.1$ 。
由于非线性输出量 $c$ 的自振振幅 $A_{c}=0.1$ ，而输出量 $c$ 到非线性环节输人端的传递函数为 $\frac{10}{T s+1}$ ，幅频特性 $\left|\frac{10}{\mathrm{j} T \omega+1}\right|_{\substack{T=0.1 \\ \omega=10}}=5 \sqrt{2}$ 。因此，非线性环节输人端的自振振幅 $A=5 \sqrt{2} A_{c}=\frac{\sqrt{2}}{2}$ 。令

$$
\operatorname{Re} G(\mathrm{j} 10)=\left.\frac{1}{N(A)}\right|_{A=\frac{\sqrt{2}}{2}}
$$

有 $-\frac{K}{2}=-\frac{\pi}{8}$ ，不难求得 $K=\frac{\pi}{4}$ 。
MATLAB 验证：
取 $T=0.1, K=\frac{\pi}{2}$ ，在 MATLAB 的 Simulink 环境下搭建如图 8－91 所示的非线性系统，仿真时间取为 5 s ，运行可得系统输出响应，如图8－23－2所示。

![](assets/fig-08-23-01.png)

> Image description: A technical diagram showing a contour plot in the complex plane, featuring a real axis (horizontal) and an imaginary axis labeled with $j$ (vertical). The origin is marked as $0$. The figure depicts a closed-loop path denoted as $\Gamma_G$. This contour consists of a solid line forming a semi-circular arc that starts on the negative real axis, curves upward through the upper half-plane, and returns toward the origin. A dashed line completes the loop by curving through the lower half-plane back to the starting point. An arrow on the negative real axis points away from the origin, associated with the label $-\frac{1}{N(A)}$. The overall structure represents a Nyquist-style stability analysis or a contour integration path used in control engineering to evaluate system stability based on the encirclement of critical points.
图8－23－1 非线性系统稳定性分析

![](assets/fig-08-23-01-2.png)

> Image description: This image is a technical plot showing the time-domain response of a signal $c(t)$ for a nonlinear system stability analysis, as indicated by the caption "图8－23－1 非线性系统稳定性分析". The graph features a vertical y-axis labeled $c(t)$, with values ranging from $-0.2$ to $0.15$. The horizontal x-axis is labeled "Time/sec", spanning from $0$ to $5$ seconds. A dashed grid is overlaid on the plot for precise reading. The plotted waveform begins at the origin $(0,0)$ and exhibits an initial transient phase where the amplitude of oscillation increases over the first 1.5 seconds. Following this period, the signal settles into a steady-state limit cycle—a sustained periodic oscillation with a constant peak-to-peak amplitude of approximately $0.2$ (ranging from roughly $-0.1$ to $0.1$). This behavior is characteristic of a stable limit cycle in nonlinear system dynamics.
图8－23－2 非线性系统输出时间响应（MATLAB）

8－24 设非线性系统如图 8－92 所示，其中参数 $K_{1}, K_{2}, T_{1}, T_{2}, M$ 均为正。试确定：
（1）系统发生自振时，各参数应满足的条件；
（2）自振频率和振幅。
解 将图示非线性系统化为典型结构

$$
\begin{aligned}
G(\mathrm{j} \omega)= & \frac{K_{2}}{\mathrm{j} \omega\left(T_{1} \mathrm{j} \omega+1\right)\left(T_{2} \mathrm{j} \omega+1\right)+K_{1} K_{2}} \\
= & \frac{K_{2}}{K_{1} K_{2}-\left(T_{1}+T_{2}\right) \omega^{2}+\left(1-T_{1} T_{2} \omega^{2}\right) \mathrm{j} \omega} \\
& -\frac{1}{N(A)}=-\frac{\pi A}{4 M}
\end{aligned}
$$

当 $\omega=\frac{1}{\sqrt{T_{1} T_{2}}}$ 时，有



<!-- source_pdf_page: 302 -->
$$
\operatorname{Re}[G(\mathrm{j} \omega)]=\frac{K_{2}}{K_{1} K_{2}-\left(\frac{T_{1}+T_{2}}{T_{1} T_{2}}\right)}
$$

令 $-\frac{1}{N(A)}=\operatorname{Re}[G(\mathrm{j} \omega)]$ ，即

$$
-\frac{\pi A}{4 M}=\frac{K_{2}}{K_{1} K_{2}-\left(\frac{T_{1}+T_{2}}{T_{1} T_{2}}\right)}
$$

由此可知，使系统产生稳定自振时各参数应满足的条件为 $K_{1} K_{2}<\frac{T_{1}+T_{2}}{T_{1} T_{2}}$ ，自振参数为

$$
\omega=\frac{1}{\sqrt{T_{1} T_{2}}}, \quad A=\frac{4 M K_{2}}{\pi\left(\frac{T_{1}+T_{2}}{T_{1} T_{2}}-K_{1} K_{2}\right)}
$$

MATLAB 验证：设 $T_{1}=1, T_{2}=2, K_{1}=0.1, K_{2}=10, M=1$ ，正好满足稳定自振条件，且应有如下自振参数

$$
\omega=0.707, \quad A=25.46
$$

运行如下 MATLAB 文件，可得系统输出时间响应，如图 8－24－1 所示。

![](assets/fig-08-92.png)

> Image description: A block diagram of a control system is shown. The system begins with a summing junction on the left, where a feedback signal is subtracted from an input. This error signal enters a non-linear block characterized by a saturation function with limits $M$ and $-M$. The output of this saturation block enters another summing junction, which subtracts a feedback signal scaled by gain $K_1$. The resulting signal then passes through a linear plant block defined by the transfer function $\frac{K_2}{s(T_1s+1)(T_2s+1)}$. The final system output is labeled as $c(t)$. A primary feedback loop connects the output $c(t)$ back to the initial summing junction. Additionally, a secondary inner feedback loop passes through block $K_1$ and returns to the second summing junction. Arrows indicate the unidirectional flow of signals throughout the closed-loop architecture.
图8－92 题 8－24 非线性系统结构图

![](assets/fig-08-92-2.png)

> Image description: The image shows a plot of a time-domain signal $c(t)$ versus Time in seconds. The horizontal x-axis is labeled "Time/sec" and ranges from 0 to 120, with major grid markings every 20 units. The vertical y-axis is labeled "$c(t)$" and ranges from -30 to 30, with increments of 10. The graph depicts an oscillating waveform that begins at the origin $(0,0)$. As time progresses, the amplitude of the oscillations increases gradually before stabilizing into a steady-state limit cycle. The peaks eventually reach approximately 25 units and the troughs reach approximately -25 units. This behavior is characteristic of a nonlinear system exhibiting growth toward a stable periodic oscillation. The figure is captioned in Chinese as "图8－92 题 8－24 非线性系统结构图," indicating it relates to a problem on nonlinear system structures.
图8－24－1 非线性系统输出时间响应（MATLAB）

MATLAB 程序：exe 824．m

$$
\begin{aligned}
& t=0: 0.01: 120 ; \\
& c 0=\left[\begin{array}{lll}
0 & 0 & 0
\end{array}\right]^{\prime} ; \\
& {[t, c]=\operatorname{ode45}(\text { 'sys824', } t, c 0) ;} \\
& \text { plot }(t, c(:, 1)) ; g r i d \\
& \text { 调用函数: } \\
& \text { function } d c=\operatorname{sys824(t,c)} \\
& d c 1=c(2) ; \\
& d c 2=c(3) ; \\
& \text { if }(c(1)<0) \\
& \quad d c 3=5-0.5 * c(1)-0.5 * c(2)-1.5 * c(3) ; \\
& \text { else } \\
& \text { end } d c 3=-5-0.5 * c(1)-0.5 * c(2)-1.5 * c(3) ; \\
& d c=[d c 1 \text { dc2 dc3 }]^{\prime} ;
\end{aligned}
$$



