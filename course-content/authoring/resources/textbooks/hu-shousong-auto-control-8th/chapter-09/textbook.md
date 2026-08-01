<!-- source_pdf_page: 455 -->
## 第九章 线性系统的状态空间分析与综合

经典线性系统理论对于单输入－单输出线性定常系统的分析和综合是比较有效的，但其显著的缺点是只能揭示输入－输出的外部特性，难以揭示系统内部的结构特性，也难以有效处理多输人－多输出系统。

在20世纪50年代蓬勃兴起的航天技术的推动下，1960年前后开始了从经典控制理论到现代控制理论的过渡，其中一个重要标志就是卡尔曼系统地将状态空间概念引入到控制理论中来。现代控制理论正是在引人状态和状态空间概念的基础上发展起来的。

现代控制理论中的线性系统理论运用状态空间法描述输入－状态－输出诸变量间的因果关系，不但反映了系统的输人－输出外部特性，而且揭示了系统内部的结构特性，是一种既适用于单输入－单输出系统又适用于多输入－多输出系统，既可用于线性定常系统又可用于线性时变系统的有效分析和综合方法。

在线性系统理论中，根据所采用的数学工具及系统描述方法，又出现了一些平行的分支，目前主要有线性系统的状态空间法、线性系统的几何理论、线性系统的代数理论、线性系统的多变量频域方法等。由于状态空间法是线性系统理论中最重要和影响最广的分支，所以本章只介绍线性系统的状态空间法。

## 9－1 线性系统的状态空间描述

1．系统数学描述的两种基本类型
这里所谓的系统是指由一些相互制约的部分构成的整体，它可能是一个由反馈闭合的整体，也可能是某一控制装置或被控对象。本章所研究的系统均假定具有若干的输入端和输出端，如图9－1所示。图中方框以外的部分为系统环境，环境对系统的作用为系统输入，系统对环境的作用为系统输出，二者分别用向量 $\boldsymbol{u}=\left[u_{1}, u_{2}, \cdots, u_{p}\right]^{\mathrm{T}}$ 和 $\boldsymbol{y}=\left[y_{1}, y_{2}, \cdots, y_{q}\right]^{\mathrm{T}}$ 表示，它们均为系统的外部变量。描述系统内部每个时刻所处状况的变量为系统的内部变量，以向量 $\boldsymbol{x}=\left[x_{1}, x_{2}, \cdots\right.$ ，$\left.x_{n}\right]^{\mathrm{T}}$ 表示。系统的数学描述是反映系统变量间因果关系和变换关系的一种数学模型。

系统的数学描述通常有两种基本类型。一种是系统的外部描述，即输人－输出描述。这种描述将系统看作一个＂黑箱＂，只是反映系统外部变量间即输入－输出间的因果关系，而不去表征系统的内部结构和内部变量。系

![](assets/fig-09-01.png)

> Image description: This textbook figure (Fig. 9-1) depicts a system’s block diagram. Input signals u₁ through uₚ enter from the left, feeding into a central processing block. The block’s internal variables are labeled x₁, x₂, ..., xₙ, indicating processed intermediate states. Outputs y₁ through y_q emerge on the right, representing the system’s response. Arrows clearly show directional flow: inputs → block → outputs. The diagram visually models a general dynamic system, where multiple inputs are transformed into multiple outputs via internal computations. This schematic is standard in control theory and signal processing to abstract system behavior without detailing internal mechanics. The figure’s structure emphasizes input-output relationships and variable transformations within the system.
图9－1 系统的方框图表示

统描述的另一种类型是内部描述，即状态空间描述。这种描述是基于系统内部结构分析的一类数学模型，通常由两个数学方程组成：一个是反映系统内部变量 $\boldsymbol{x}=\left[x_{1}, x_{2}, \cdots, x_{n}\right]^{\mathrm{T}}$和输人变量 $\boldsymbol{u}=\left[u_{1}, u_{2}, \cdots, u_{p}\right]^{\mathrm{T}}$ 间因果关系的数学表达式，常具有微分方程或差分方程的形式，称为状态方程；另一个是表征系统内部变量 $\boldsymbol{x}=\left[x_{1}, x_{2}, \cdots, x_{n}\right]^{\mathrm{T}}$ 及输人变量 $\boldsymbol{u}=\left[u_{1}\right.$ ，$\left.u_{2}, \cdots, u_{p}\right]^{\mathrm{T}}$ 和输出变量 $\boldsymbol{y}=\left[y_{1}, y_{2}, \cdots, y_{q}\right]^{\mathrm{T}}$ 间转换关系的数学表达式，具有代数方程的形式，



<!-- source_pdf_page: 456 -->
称为输出方程。外部描述仅描述系统的外部特性，不能反映系统的内部结构特性，而具有完全不同内部结构的两个系统也可能具有相同的外部特性，因而外部描述通常只是对系统的一种不完全的描述。内部描述则是对系统的一种完全的描述，它能完全表征系统的所有动力学特征。仅当在系统具有一定属性的条件下，两种描述才具有等价关系。

2．系统状态空间描述常用的基本概念
在系统状态空间描述中常用如下的一些基本概念。
状态和状态变量 系统在时间域中的行为或运动信息的集合称为状态。确定系统状态的一组独立（数目最小）变量称为状态变量。

一个用 $n$ 阶微分方程描述的系统，当 $n$ 个初始条件 $x\left(t_{0}\right), \dot{x}\left(t_{0}\right), \cdots, x^{(n-1)}\left(t_{0}\right)$ ，及 $t \geqslant t_{0}$的输入 $u(t)$ 给定时，可唯一确定方程的解，即系统将来的状态，故 $x(t), \dot{x}(t), \cdots, x^{(n-1)}(t)$这 $n$ 个独立变量可选作状态变量。状态变量对于确定系统的行为既是必要的，也是充分的。$n$ 阶系统状态变量所含独立变量的个数为 $n$ 。显然，当变量个数小于 $n$ 时，便不能完全确定$n$ 阶系统的状态，而当变量个数大于 $n$ 时，对于确定系统的状态有的变量则是多余的。

状态变量的选取不具有唯一性，同一个系统可能有多种不同的状态变量选取方法。状态变量也不一定在物理上可量测，有时只具有数学意义，而无任何物理意义。但在具体工程问题中，应尽可能选取容易量测的量作为状态变量，以便实现状态的前馈和反馈等设计要求。例如，机械系统中常选取线（角）位移和线（角）速度作为变量，RCL 网络中则常选取流经电感的电流和电容的端电压作为状态变量。

状态变量常用符号 $x_{1}(t), x_{2}(t), \cdots, x_{n}(t)$ 表示。
状态向量 把描述系统状态的 $n$ 个状态变量 $x_{1}(t), x_{2}(t), \cdots, x_{n}(t)$ 看作向量 $x(t)$ 的分量，即

$$
\boldsymbol{x}(t)=\left[x_{1}(t), x_{2}(t), \cdots, x_{n}(t)\right]^{\mathrm{T}}
$$

则向量 $\boldsymbol{x}(t)$ 称为 $n$ 维状态向量。给定 $t=t_{0}$ 时的初始状态向量 $\boldsymbol{x}\left(t_{0}\right)$ 及 $t \geqslant t_{0}$ 的输入向量 $\boldsymbol{u}(t)$ ，则 $t \geqslant t_{0}$ 的状态由状态向量 $\boldsymbol{x}(t)$ 唯一确定。

状态空间 以 $n$ 个状态变量作为基底所组成的 $n$ 维空间称为状态空间。
状态轨线 系统在任一时刻的状态，在状态空间中用一点来表示。随着时间推移，系统状态在变化，便在状态空间中描绘出一条轨迹。这种系统状态在状态空间中随时间变化的轨迹称为状态轨迹或状态轨线。

线性系统的状态空间表达式 若线性系统描述系统状态量与输入量之间关系的状态方程是一阶向量线性微分方程或一阶向量线性差分方程，而描述输出量与状态量和输入量之间关系的输出方程是向量代数方程，则其组合称为线性系统状态空间表达式，或称为动态方程，其连续形式为

$$
\begin{align*}
& \dot{\boldsymbol{x}}(t)=\boldsymbol{A}(t) \boldsymbol{x}(t)+\boldsymbol{B}(t) \boldsymbol{u}(t)  \tag{9-1}\\
& \boldsymbol{y}(t)=\boldsymbol{C}(t) \boldsymbol{x}(t)+\boldsymbol{D}(t) \boldsymbol{u}(t)
\end{align*}
$$

对于线性离散时间系统，由于在实践中常取 $t_{k}=k T(T$ 为采样周期），其状态空间表达式的一般形式可写为

$$
\begin{align*}
& \boldsymbol{x}(k+1)=\boldsymbol{G}(k) \boldsymbol{x}(k)+\boldsymbol{H}(k) \boldsymbol{u}(k) \\
& \boldsymbol{y}(k)=\boldsymbol{C}(k) \boldsymbol{x}(k)+\boldsymbol{D}(k) \boldsymbol{u}(k) \tag{9-2}
\end{align*}
$$



<!-- source_pdf_page: 457 -->
通常，若状态 $\boldsymbol{x}$ 、输人 $\boldsymbol{u}$ 、输出 $\boldsymbol{y}$ 的维数分别为 $n, p, q$ ，则称 $n \times n$ 矩阵 $\boldsymbol{A}(t)$ 及 $\boldsymbol{G}(k)$ 为系统矩阵或状态矩阵，称 $n \times p$ 矩阵 $\boldsymbol{B}(t)$ 及 $\boldsymbol{H}(k)$ 为控制矩阵或输人矩阵，称 $q \times n$ 矩阵 $\boldsymbol{C}(t)$及 $\boldsymbol{C}(k)$ 为观测矩阵或输出矩阵，称 $q \times p$ 矩阵 $\boldsymbol{D}(t)$ 及 $\boldsymbol{D}(k)$ 为前馈矩阵或输人输出矩阵。

线性定常系统 在线性系统的状态空间表达式中，若系数矩阵 $\boldsymbol{A}(t), \boldsymbol{B}(t), \boldsymbol{C}(\mathrm{t}), \boldsymbol{D}(t)$或 $\boldsymbol{G}(k), \boldsymbol{H}(k), \boldsymbol{C}(k), \boldsymbol{D}(k)$ 的各元素都是常数，则称该系统为线性定常系统，否则为线性时变系统。线性定常系统状态空间表达式的一般形式为

$$
\begin{gather*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{B} \boldsymbol{u}(t)  \tag{9-3}\\
\boldsymbol{y}(t)=\boldsymbol{C} \boldsymbol{x}(t)+\boldsymbol{D} \boldsymbol{u}(t) \\
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{H} \boldsymbol{u}(k) \\
\boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{x}(k)+\boldsymbol{D} \boldsymbol{u}(k) \tag{9-4}
\end{gather*}
$$

当输出方程中 $D \equiv 0$ 时，系统称为绝对固有系统，否则称为固有系统。为书写方便，常把固有系统（9－3）或（9－4）简记为系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C}, \boldsymbol{D})$ 或系统 $(\boldsymbol{G}, \boldsymbol{H}, \boldsymbol{C}, \boldsymbol{D})$ ，而记相应的绝对固有系统为系统 $(A, B, C)$ 或系统 $(G, H, C)$ 。

线性系统的结构图 线性系统的状态空间表达式常用结构图表示。线性连续时间系统（9－3）的结构图如图 9－2 所示，线性离散时间系统（9－4）的结构图如图 9－3所示。结构图中$I$ 为 $n \times n$ 单位矩阵，$s$ 是拉普拉斯算子，$z^{-1}$ 为单位延时算子，$s$ 和 $z$ 均为标量。每一方框的输人－输出关系规定为

输出向量 =（方框所示矩阵）$\times$（输入向量）
应注意到在向量、矩阵的乘法运算中，相乘顺序不允许任意颠倒。

![](assets/fig-09-02.png)

> Image description: This figure illustrates a linear continuous-time system block diagram. Input u enters block B, then combines with feedback from blocks A and D via summing junctions. The output of B feeds into a derivative block (labeled x-dot), which connects to an integrator (I/S), representing state x. Block C multiplies x to produce a signal contributing to output y. Feedback paths include: from D to the integrator’s input, from A to the summing junction before the integrator, and from C to the output y. The system’s output y is the sum of contributions from C and D. Variables x and x-dot denote state and its derivative. This structure models dynamic systems with feedback, commonly used in control theory to represent system behavior and stability analysis.
图9－2 线性连续时间系统结构图

![](assets/fig-09-03.png)

> Image description: This figure illustrates a discrete-time system structure with labeled blocks and signals. Input u(k) enters block H, producing x(k+1). This feeds into a 1/z delay block, yielding x(k). x(k) then passes through block C to contribute to output y(k). Feedback paths include: a direct connection from u(k) to the summing junction before H, a feedback from y(k) through block G to the input of the 1/z block, and a feedback from y(k) through block D to the input of C. The system uses summation (+) junctions to combine signals. Variables u(k), x(k), x(k+1), y(k) denote discrete-time signals. Blocks H, C, D, G represent system components, while 1/z denotes a unit delay. The diagram shows interconnections typical in digital control or signal processing systems.
图9－3 线性离散时间系统结构图

## 3．线性定常连续系统状态空间表达式的建立

建立状态空间表达式的方法主要有两种：一是直接根据系统的机理建立相应的微分方程或差分方程，继而选择有关的物理量作为状态变量，从而导出其状态空间表达式；二是由已知的系统其他数学模型经过转化而得到状态空间表达式。
（1）根据系统机理建立状态空间表达式
下面通过例题来介绍根据系统机理建立线性定常连续系统状态空间表达式的方法。
例 9－1 试列写如图9－4所示 RLC 网络的电路方程，选择几组状态变量并建立相应的状态空间表达式，就所选状态变量间的关系进行讨论。

解 根据电路定律可列写如下方程：

$$
R i+L \frac{\mathrm{~d} i}{\mathrm{~d} t}+\frac{1}{C} \int i \mathrm{~d} t=e
$$

电路输出量为



<!-- source_pdf_page: 458 -->
![](assets/fig-09-04.png)

> Image description: This textbook figure (Fig. 9-4) depicts an RLC series network. The circuit consists of a resistor (R), inductor (L), and capacitor (C) connected in series between two terminals. The input voltage is labeled ‘e’, and the voltage across the capacitor is ‘e_c’. Current ‘i’ flows through all components, indicated by a curved arrow. The capacitor is shown connected in parallel with the series RLC combination, forming a voltage divider configuration. The diagram uses standard electrical symbols: a rectangle for R, a coil for L, and two parallel lines for C. The layout suggests analysis of transient or steady-state response under AC or DC excitation. This RLC network is fundamental in analyzing filters, oscillators, and resonance phenomena in electrical engineering.
图9－4 RLC 网络

$$
y=e_{c}=\frac{1}{C} \int i \mathrm{~d} t
$$

1）设状态变量 $x_{1}=i, x_{2}=\frac{1}{C} \int i \mathrm{~d} t$ ，则状态方程为

$$
\dot{x}_{1}=-\frac{R}{L} x_{1}-\frac{1}{L} x_{2}+\frac{1}{L} e
$$

$$
\dot{x}_{2}=\frac{1}{C} x_{1}
$$

输出方程为

$$
y=x_{2}
$$

其向量－矩阵形式为

$$
\begin{gathered}
{\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
-\frac{R}{L} & -\frac{1}{L} \\
\frac{1}{C} & 0
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{c}
\frac{1}{L} \\
0
\end{array}\right] e} \\
y=\left[\begin{array}{ll}
0 & 1
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]
\end{gathered}
$$

简记为

$$
\begin{aligned}
& \dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}+\boldsymbol{b} e \\
& y=\boldsymbol{c x}
\end{aligned}
$$

式中

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right], \quad \boldsymbol{x}=\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right], \quad \boldsymbol{A}=\left[\begin{array}{cc}
-\frac{R}{L} & -\frac{1}{L} \\
\frac{1}{C} & 0
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{c}
\frac{1}{L} \\
0
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{ll}
0 & 1
\end{array}\right]
$$

2） 设状态变量 $x_{1}=i, x_{2}=\int i \mathrm{~d} t$ ，则有
$$
\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
-\frac{R}{L} & -\frac{1}{L C} \\
1 & 0
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{c}
\frac{1}{L} \\
0
\end{array}\right] e, \quad y=\left[\begin{array}{ll}
0 & \frac{1}{C}
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]
$$
3） 设状态变量 $x_{1}=\frac{1}{C} \int i \mathrm{~d} t+R i, x_{2}=\frac{1}{C} \int i \mathrm{~d} t$ ，则
$$
x_{1}=x_{2}+R i, \quad L \frac{\mathrm{~d} i}{\mathrm{~d} t}=-x_{1}+e
$$
故
$$
\begin{aligned}
& \dot{x}_{1}=\dot{x}_{2}+R \frac{\mathrm{~d} i}{\mathrm{~d} t}=\frac{1}{R C}\left(x_{1}-x_{2}\right)+\frac{R}{L}\left(-x_{1}+e\right) \\
& \dot{x}_{2}=\frac{1}{C} i=\frac{1}{R C}\left(x_{1}-x_{2}\right) \\
& y=x_{2}
\end{aligned}
$$


<!-- source_pdf_page: 459 -->
其向量－矩阵形式为

$$
\begin{aligned}
& {\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
\frac{1}{R C}-\frac{R}{L} & -\frac{1}{R C} \\
\frac{1}{R C} & -\frac{1}{R C}
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{l}
\frac{R}{L} \\
0
\end{array}\right] e} \\
& y=\left[\begin{array}{ll}
0 & 1
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]
\end{aligned}
$$

由上可见，系统的状态空间表达式不具有唯一性。选取不同的状态变量，便会有不同的状态空间表达式，但它们都描述了同一系统。可以推断，描述同一系统的不同状态空间表达式之间一定存在着某种线性变换关系。现研究本例题中两组状态变量之间的关系。

设 $x_{1}=i, x_{2}=\frac{1}{C} \int i \mathrm{~d} t, \bar{x}_{1}=i, \bar{x}_{2}=\int i \mathrm{~d} t$ ，则有

$$
x_{1}=\bar{x}_{1}, \quad x_{2}=\frac{1}{C} \bar{x}_{2}
$$

其相应的向量－矩阵形式为
其中

$$
\begin{gathered}
\boldsymbol{x}=\boldsymbol{P} \overline{\boldsymbol{x}} \\
\boldsymbol{x}=\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right], \quad \overline{\boldsymbol{x}}=\left[\begin{array}{l}
\overline{\boldsymbol{x}}_{1} \\
\overline{\boldsymbol{x}}_{2}
\end{array}\right], \quad \boldsymbol{P}=\left[\begin{array}{ll}
1 & 0 \\
0 & \frac{1}{C}
\end{array}\right]
\end{gathered}
$$

以上说明只要令 $\boldsymbol{x}=\boldsymbol{P} \overline{\boldsymbol{x}}, \boldsymbol{P}$ 为非奇异变换矩阵，便可将 $x_{1}, x_{2}$ 变换为 $\bar{x}_{1}, \bar{x}_{2}$ 。若取任意的非奇异变换阵 $\boldsymbol{P}$ ，便可变换出无穷多组状态变量，这就说明状态变量的选择不具有唯一性。对于图 9－4 所示 RLC 网络来说，由于电容端电压和电感电流容易测量，通常选择这些物理量作为状态变量。
（2）由系统微分方程建立状态空间表达式
按系统输入量中是否含有导数项来分别研究。
1）系统输人量中不含导数项。这种单输入－单输出线性定常连续系统微分方程的一般形式为

$$
\begin{equation*}
y^{(n)}+a_{n-1} y^{(n-1)}+a_{n-2} y^{(n-2)}+\cdots+a_{1} \dot{y}+a_{0} y=\beta_{0} u \tag{9-5}
\end{equation*}
$$

式中，$y, u$ 分别为系统的输出、输入量；$a_{0}, a_{1}, \cdots, a_{n-1}, \beta_{0}$ 是由系统特性确定的常系数。由于给定 $n$ 个初值 $y(0), \dot{y}(0), \cdots, y^{n-1}(0)$ 及 $t \geqslant 0$ 的 $u(t)$ 时，可唯一确定 $t>0$ 时系统的行为，可选取 $n$ 个状态变量为 $x_{1}=y, x_{2}=\dot{y}, \cdots, x_{n}=y^{(n-1)}$ ，故式（9－5）可化为

$$
\left\{\begin{array}{l}
\dot{x}_{1}=x_{2}  \tag{9-6}\\
\dot{x}_{2}=x_{3} \\
\vdots \\
\dot{x}_{n-1}=x_{n} \\
\dot{x}_{n}=-a_{0} x_{1}-a_{1} x_{2}-\cdots-a_{n-1} x_{n}+\beta_{0} u \\
y=x_{1}
\end{array}\right.
$$

其向量－矩阵形式为



<!-- source_pdf_page: 460 -->
式中

$$
\begin{gathered}
\dot{\boldsymbol{x}}=\boldsymbol{A x}+\boldsymbol{b} u \\
\boldsymbol{x}=\boldsymbol{c x} \\
\boldsymbol{x}=\left[\begin{array}{c}
x_{1} \\
x_{2} \\
\vdots \\
x_{n-1} \\
x_{n}
\end{array}\right], \quad \boldsymbol{A}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{c}
0 \\
0 \\
\vdots \\
0 \\
\beta_{0}
\end{array}\right]
\end{gathered}
$$

按式（9－6）绘制的结构图称为状态变量图，如图9－5所示。每个积分器的输出都是对应的状态变量，状态方程由各积分器的输入－输出关系确定，输出方程在输出端获得。

![](assets/fig-09-05.png)

> Image description: This figure illustrates a state-variable diagram for a linear system, labeled as Figure 9-5. Input u enters a gain block β₀, then feeds into a series of n integrators (each labeled 1/s), whose outputs represent state variables xₙ, xₙ₋₁, ..., x₁=y. Each integrator has a feedback path with coefficients aₙ₋₁, aₙ₋₂, ..., a₀, connected via summing junctions. The output y equals x₁. The diagram visually represents the state-space model: the integrators form the state dynamics, while the feedback coefficients define the system’s input-output relationship. Arrows indicate signal flow, and the structure enables direct derivation of the system’s transfer function from the state equations.
图9－5 输人量中不含导数顶时的系统状态变量图

2）系统输人量中含有导数项。这种单输入－单输出线性定常连续系统微分方程的一般形式为

$$
\begin{align*}
& y^{(n)}+a_{n-1} y^{(n-1)}+a_{n-2} y^{(n-2)}+\cdots+a_{1} \dot{y}+a_{0} y  \tag{9-8}\\
= & b_{n} u^{(n)}+b_{n-1} u^{(n-1)}+\cdots+b_{1} \dot{u}+b_{0} u
\end{align*}
$$

一般输人导数项的次数小于或等于系统的阶数 $n$ 。首先研究 $b_{n} \neq 0$ 时的情况。为了避免在状态方程中出现输人导数项，可按如下规则选择一组状态变量，设

$$
\left\{\begin{array}{l}
x_{1}=y-h_{0} u  \tag{9-9}\\
x_{i}=\dot{x}_{i-1}-h_{i-1} u ; \quad i=2,3, \cdots, n
\end{array}\right.
$$

其展开式为

$$
\left\{\begin{array}{l}
x_{1}=y-h_{0} u  \tag{9-10}\\
x_{2}=\dot{x}_{1}-h_{1} u=\dot{y}-h_{0} \dot{u}-h_{1} u \\
x_{3}=\dot{x}_{2}-h_{2} u=\ddot{y}-h_{0} \ddot{u}-h_{1} \dot{u}-h_{2} u \\
\vdots \\
x_{n-1}=\dot{x}_{n-2}-h_{n-2} u=y^{(n-2)}-h_{0} u^{(n-2)}-h_{1} u^{(n-3)}-\cdots-h_{n-2} u \\
x_{n}=\dot{x}_{n-1}-h_{n-1} u=y^{(n-1)}-h_{0} u^{(n-1)}-h_{1} u^{(n-2)}-\cdots-h_{n-1} u
\end{array}\right.
$$

式中，$h_{0}, h_{1}, h_{2}, \cdots, h_{n-1}$ 是 $n$ 个待定常数。由式（9－10）的第一个方程可得输出方程

$$
y=x_{1}+h_{0} u
$$

其余可得 $n-1$ 个状态方程



<!-- source_pdf_page: 461 -->
$$
\begin{aligned}
& \dot{x}_{1}=x_{2}+h_{1} u \\
& \dot{x}_{2}=x_{3}+h_{2} u \\
& \vdots \\
& \dot{x}_{n-1}=x_{n}+h_{n-1} u
\end{aligned}
$$

对 $x_{n}$ 求导数并考虑式（9－8），有

$$
\begin{aligned}
\dot{x}_{n}= & y^{(n)}-h_{0} u^{(n)}-h_{1} u^{(n-1)}-\cdots-h_{n-1} \dot{u}=\left(-a_{n-1} y^{(n-1)}-a_{n-2} y^{(n-2)}\right. \\
& \left.-\cdots-a_{1} \dot{y}-a_{0} y+b_{0} u^{(n)}+\cdots+b_{1} \dot{u}+b_{0} u\right)-h_{0} u^{(n)}-h_{1} u^{(n-1)}-\cdots-h_{n-1} \dot{u}
\end{aligned}
$$

由式（9－10）将 $y^{(n-1)}, \cdots, \dot{y}, y$ 均以 $x_{i}$ 及 $u$ 的各阶导数表示，经整理可得

$$
\begin{aligned}
\dot{x}_{n}= & -a_{0} x_{1}-a_{1} x_{2}-\cdots-a_{n-2} x_{n-1}-a_{n-1} x_{n}+\left(b_{n}-h_{0}\right) u^{(n)} \\
& +\left(b_{n-1}-h_{1}-a_{n-1} h_{0}\right) u^{(n-1)}+\left(b_{n-2}-h_{2}-a_{n-1} h_{1}-a_{n-2} h_{0}\right) u^{(n-2)} \\
& +\cdots+\left(b_{1}-h_{n-1}-a_{n-1} h_{n-2}-a_{n-2} h_{n-3}-\cdots-a_{1} h_{0}\right) \dot{u} \\
& +\left(b_{0}-a_{n-1} h_{n-1}-a_{n-2} h_{n-2}-\cdots-a_{1} h_{1}-a_{0} h_{0}\right) u
\end{aligned}
$$

令上式中 $u$ 的各阶导数项的系数为零，可确定各 $h$ 值

$$
\begin{aligned}
& h_{0}=b_{n} \\
& h_{1}=b_{n-1}-a_{n-1} h_{0} \\
& h_{2}=b_{n-2}-a_{n-1} h_{1}-a_{n-2} h_{0} \\
& \vdots \\
& h_{n-1}=b_{1}-a_{n-1} h_{n-2}-a_{n-2} h_{n-3}-\cdots-a_{1} h_{0}
\end{aligned}
$$

记 $h_{n}=b_{0}-a_{n-1} h_{n-1}-a_{n-2} h_{n-2}-\cdots-a_{1} h_{1}-a_{0} h_{0}$ ，故

$$
\dot{x}_{n}=-a_{0} x_{1}-a_{1} x_{2}-\cdots-a_{n-2} x_{n-1}-a_{n-1} x_{n}+h_{n} u
$$

则式（9－8）的向量－矩阵形式的动态方程为

$$
\begin{gather*}
\dot{\boldsymbol{x}}=\boldsymbol{A x}+\boldsymbol{b} u, \quad y=\boldsymbol{c x}+d u  \tag{9-11}\\
\boldsymbol{A}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{c}
h_{1} \\
h_{2} \\
\vdots \\
h_{n-1} \\
h_{n}
\end{array}\right] \\
c=\left[\begin{array}{llll}
1 & 0 & \cdots & 0
\end{array}\right], \quad d=h_{0}
\end{gather*}
$$

式（9－8）的状态变量图见图9－6。若输人量中仅含 $m$ 次导数且 $m<n$ ，可将高于 $m$ 次导数项的系数置零，仍可应用上述所得公式。

当 $b_{n}=0$ 时，可以令上述公式中的 $h_{0}=0$ 得到所需要的结果，也可按如下规则选择另一组状态变量。设

$$
\left\{\begin{array}{l}
x_{n}=y  \tag{9-12}\\
x_{i}=\dot{x}_{i+1}+a_{i} y-b_{i} u ; \quad i=1,2, \cdots, n-1
\end{array}\right.
$$

其展开式为



<!-- source_pdf_page: 462 -->
![](assets/fig-09-06.png)

> Image description: This figure illustrates a state-variable diagram for a system with input derivatives. The input u flows through a block labeled hₙ, then branches into a series of interconnected subsystems. Each subsystem contains a 1/s block (integrator) and feedback gains aᵢ and hᵢ. Variables xₙ, xₙ₋₁, ..., x₀ represent state variables. The diagram shows feedback loops with gains aᵢ and hᵢ, connecting integrators in cascade. Output y is the sum of contributions from all integrator outputs, scaled by coefficients a₀ through aₙ₋₁ and h₀ through hₙ₋₁. Arrows indicate signal flow, and plus/minus signs denote summation junctions. The structure represents a generalized state-space model, often used in control theory to model systems with derivative inputs.
图9－6 输入量中含有导数项时的系统状态变量图

$$
\begin{aligned}
& x_{n-1}=\dot{x}_{n}+a_{n-1} y-b_{n-1} u=\dot{y}+a_{n-1} y-b_{n-1} u \\
& x_{n-2}=\dot{x}_{n-1}+a_{n-2} y-b_{n-2} u=\ddot{y}+a_{n-1} \dot{y}-b_{n-1} \dot{u}+a_{n-2} y-b_{n-2} u \\
& \vdots \\
& x_{2}=\dot{x}_{3}+a_{2} y-b_{2} u=y^{(n-2)}+a_{n-1} y^{(n-3)}-b_{n-1} u^{(n-3)}+a_{n-2} y^{(n-4)}-b_{n-2} u^{(n-4)}+\cdots+a_{2} y-b_{2} u \\
& x_{1}=\dot{x}_{2}+a_{1} y-b_{1} u=y^{(n-1)}+a_{n-1} y^{(n-2)}-b_{n-1} u^{(n-2)}+a_{n-2} y^{(n-3)}-b_{n-2} u^{(n-3)}+\cdots+a_{1} y-b_{1} u
\end{aligned}
$$

故有 $n-1$ 个状态方程

$$
\begin{aligned}
& \dot{x}_{n}=x_{n-1}-a_{n-1} x_{n}+b_{n-1} u \\
& \dot{x}_{n-1}=x_{n-2}-a_{n-2} x_{n}+b_{n-2} u \\
& \vdots \\
& \dot{x}_{2}=x_{1}-a_{1} x_{n}+b_{1} u
\end{aligned}
$$

对 $x_{1}$ 求导数且考虑式（9－8），经整理有

$$
\dot{x}_{1}=-a_{0} x_{n}+b_{0} u
$$

则式（9－8）在 $b_{n}=0$ 时的动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}+\boldsymbol{b} u, \quad y=\boldsymbol{c} \boldsymbol{x} \tag{9-13}
\end{equation*}
$$

式中

$$
\boldsymbol{A}=\left[\begin{array}{ccccc}
0 & 0 & \cdots & 0 & -a_{0} \\
1 & 0 & \cdots & 0 & -a_{1} \\
0 & 1 & \cdots & 0 & -a_{2} \\
\vdots & \vdots & & \vdots & \vdots \\
0 & 0 & \cdots & 1 & -a_{n-1}
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{c}
b_{0} \\
b_{1} \\
b_{2} \\
\vdots \\
b_{n-1}
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{llll}
0 & 0 & \cdots & 1
\end{array}\right]
$$

例 9－2 设二阶系统微分方程为

$$
\ddot{y}+2 \zeta \omega \dot{y}+\omega^{2} y=T \dot{u}+u
$$

试求系统状态空间表达式。
解 设状态变量 $x_{1}=y-h_{0} u, x_{2}=\dot{x}_{1}-h_{1} u=\dot{y}-h_{0} \dot{u}-h_{1} u$ ，故有

$$
y=x_{1}+h_{0} u, \quad \dot{x}_{1}=x_{2}+h_{1} u
$$

对 $x_{2}$ 求导数且考虑 $x_{1}, x_{2}$ 及系统微分方程，有



<!-- source_pdf_page: 463 -->
$$
\begin{aligned}
\dot{x}_{2} & =\ddot{y}-h_{0} \ddot{u}-h_{1} \dot{u}=\left(-\omega^{2} y-2 \zeta \omega \dot{y}+T \dot{u}+u\right)-h_{0} \ddot{u}-h_{1} \dot{u} \\
& =-\omega^{2} x_{1}-2 \zeta \omega x_{2}-h_{0} \ddot{u}+\left(T-2 \zeta \omega h_{0}-h_{1}\right) \dot{u}+\left(1-\omega^{2} h_{0}-2 \zeta \omega h_{1}\right) u
\end{aligned}
$$

令 $\ddot{u}, \dot{u}$ 项的系数为零，可得

故

$$
\begin{gathered}
h_{0}=0, \quad h_{1}=T \\
\dot{x}_{2}=-\omega^{2} x_{1}-2 \zeta \omega x_{2}+(1-2 \zeta \omega T) u
\end{gathered}
$$

系统的状态空间表达式为

$$
\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
0 & 1 \\
-\omega^{2} & -2 \zeta \omega
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{c}
T \\
1-2 \zeta \omega T
\end{array}\right] u, \quad y=\left[\begin{array}{ll}
1 & 0
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]
$$

（3）由系统传递函数建立状态空间表达式
式（9－8）所对应的系统传递函数为

$$
\begin{equation*}
G(s)=\frac{Y(s)}{U(s)}=\frac{b_{n} s^{n}+b_{n-1} s^{n-1}+b_{n-2} s^{n-2}+\cdots+b_{1} s+b_{0}}{s^{n}+a_{n-1} s^{n-1}+a_{n-2} s^{n-2}+\cdots+a_{1} s+a_{0}} \tag{9-14}
\end{equation*}
$$

应用综合除法有

$$
\begin{equation*}
G(s)=b_{n}+\frac{\beta_{n-1} s^{n-1}+\beta_{n-2} s^{n-2}+\cdots+\beta_{1} s+\beta_{0}}{s^{n}+a_{n-1} s^{n-1}+a_{n-2} s^{n-2}+\cdots+a_{1} s+a_{0}} \triangleq b_{n}+\frac{N(s)}{D(s)} \tag{9-15}
\end{equation*}
$$

式中，$b_{n}$ 是直接联系输人与输出量的前馈系数，当 $G(s)$ 的分母次数大于分子次数时，$b_{n}=0$ ， $\frac{N(s)}{D(s)}$ 是严格有理真分式，其系数由综合除法得到为

$$
\begin{aligned}
& \beta_{0}=b_{0}-a_{0} b_{n} \\
& \beta_{1}=b_{1}-a_{1} b_{n} \\
& \quad \vdots \\
& \beta_{n-2}=b_{n-2}-a_{n-2} b_{n} \\
& \beta_{n-1}=b_{n-1}-a_{n-1} b_{n}
\end{aligned}
$$

下面介绍由 $\frac{N(s)}{D(s)}$ 导出几种标准形式动态方程的方法。
1）$\frac{N(s)}{D(s)}$ 串联分解的情况。将 $\frac{N(s)}{D(s)}$ 分解为两部分相串联，如图9－7所示，$z$ 为中间变量，$z, y$ 应满足

$$
\begin{gathered}
z^{(n)}+a_{n-1} z^{(n-1)}+\cdots+a_{1} \dot{z}+a_{0} z=u \\
y=\beta_{n-1} z^{(n-1)}+\cdots+\beta_{1} \dot{z}+\beta_{0} z \\
\xrightarrow{u} \frac{1}{s^{n}+a_{n-1} s^{n-1}+\cdots+a_{1} s+a_{0}} \stackrel{z}{\Rightarrow} \beta_{n-1} s^{n-1}+\cdots+\beta_{1} s+\beta_{0} \quad y
\end{gathered}
$$
![](assets/fig-09-07.png)

> Image description: This textbook figure (Fig. 9-7) illustrates the serial decomposition of a rational transfer function N(s)/D(s). The system is represented as two cascaded blocks. The first block is a proper rational function: (sⁿ + aₙ₋₁sⁿ⁻¹ + … + a₁s + a₀)⁻¹, receiving input u and producing intermediate output z. The second block, with transfer function βₙ₋₁sⁿ⁻¹ + … + β₁s + β₀, takes z as input and generates output y. Arrows indicate the flow: u → z → y. The diagram visually demonstrates how a complex rational function can be decomposed into a series of simpler, serially connected subsystems, a common technique in control theory for system analysis and design. The figure is labeled “Fig. 9-7” and includes Chinese text “的串联分解” (serial decomposition).

图 9－7 $\frac{N(s)}{D(s)}$ 的串联分解

选取状态变量



<!-- source_pdf_page: 464 -->
$$
x_{1}=z, \quad x_{2}=\dot{z}, \quad x_{3}=\ddot{z}, \quad \cdots, \quad x_{n}=z^{(n-1)}
$$

则状态方程为

$$
\begin{aligned}
\dot{x}_{1} & =x_{2} \\
\dot{x}_{2} & =x_{3} \\
& \vdots \\
\dot{x}_{n} & =-a_{0} z-a_{1} \dot{z}-\cdots-a_{n-1} z^{(n-1)}+u \\
& =-a_{0} x_{1}-a_{1} x_{2}-\cdots-a_{n-1} x_{n}+u
\end{aligned}
$$

输出方程为

$$
y=-\beta_{0} x_{1}-\beta_{1} x_{2}-\cdots-\beta_{n-1} x_{n}
$$

其向量－矩阵形式的动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}+\boldsymbol{b} u, \quad y=\boldsymbol{c} \boldsymbol{x} \tag{9-16}
\end{equation*}
$$

式中

$$
\boldsymbol{A}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{c}
0 \\
0 \\
\vdots \\
0 \\
1
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{llll}
\beta_{0} & \beta_{1} & \cdots & \beta_{n-1}
\end{array}\right]
$$

请读者注意 $\boldsymbol{A}, \boldsymbol{b}$ 的形状特征，这种 $\boldsymbol{A}$ 阵又称友矩阵，若状态方程中的 $\boldsymbol{A}, \boldsymbol{b}$ 具有这种形式，则称为可控标准型。当 $\beta_{1}=\beta_{2}=\cdots=\beta_{n-1}=0$ 时， $\boldsymbol{A}, \boldsymbol{b}$ 的形式不变， $\boldsymbol{c}=\left[\begin{array}{llll}\beta_{0} & 0 & \cdots & 0\end{array}\right]$ 。

因而，当 $G(s)=b_{n}+\frac{N(s)}{D(s)}$ 时， $\boldsymbol{A}, \boldsymbol{b}$ 不变，$y=\boldsymbol{c} \boldsymbol{x}+b_{n} u 。 \frac{N(s)}{D(s)}$ 串联分解时系统的可控标准型状态变量图如图9－8所示。

![](assets/fig-09-08.png)

> Image description: This figure illustrates the controllable canonical form state-space diagram for a system with transfer function G(s) = bn + N(s)/D(s). Input u enters a summing junction, splits into multiple paths, each delayed by S⁻¹ blocks and scaled by coefficients an−1, an−2, ..., a0. These paths feed into a series of summing junctions, with feedback gains βn−1, βn−2, ..., β0. The output y is computed as a weighted sum of the state variables x1 to xn and the direct term bn·u. The diagram visually represents the state equations and output equation of the controllable canonical form, where the system’s dynamics are captured by the cascaded integrators and feedback structure. The dashed line indicates the direct transmission term bn·u, contributing directly to the output. This structure enables easy realization of the system using standard components.
图9－8 $\frac{N(s)}{D(s)}$ 串联分解时系统的可控标准型状念变最图

当 $b_{n}=0$ 时，若按式（9－12）选取状态变量，则系统的 $\boldsymbol{A}, \boldsymbol{b}, \boldsymbol{c}$ 矩阵为



<!-- source_pdf_page: 465 -->
$$
\boldsymbol{A}=\left[\begin{array}{ccccc}
0 & 0 & \cdots & 0 & -a_{0} \\
1 & 0 & \cdots & 0 & -a_{1} \\
0 & 1 & \cdots & 0 & -a_{2} \\
\vdots & \vdots & & \vdots & \vdots \\
0 & 0 & \cdots & 1 & -a_{n-1}
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{c}
\beta_{0} \\
\beta_{1} \\
\beta_{2} \\
\vdots \\
\beta_{n-1}
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{llll}
0 & \cdots & 0 & 1
\end{array}\right]
$$

请注意 $\boldsymbol{A} 、 \boldsymbol{c}$ 的形状特征，此处 $\boldsymbol{A}$ 矩阵是友矩阵的转置。若动态方程中的 $\boldsymbol{A} 、 \boldsymbol{c}$ 具有这种形式，则称为可观测标准型。

由上可见，可控标准型与可观测标准型的各矩阵之间存在如下关系：

$$
\begin{equation*}
\boldsymbol{A}_{c}=\boldsymbol{A}_{o}^{\mathrm{T}}, \quad \boldsymbol{b}_{c}=\boldsymbol{c}_{o}^{\mathrm{T}}, \quad \boldsymbol{c}_{c}=\boldsymbol{b}_{o}^{\mathrm{T}} \tag{9-17}
\end{equation*}
$$

式中，下标 $c$ 表示可控标准型；$o$ 表示可观测标准型；T 为转置符号。式（9－17）所示关系称为对偶关系。关于系统的可控和可观测等概念，后面还要进行较详细的论述。

例 9－3 试列写例 9－2 所示系统的可控标准型、可观测标准型动态方程，并分别确定状态变量与输入、输出量的关系。

解 该系统的传递函数为

$$
G(s)=\frac{Y(s)}{U(s)}=\frac{T s+1}{s^{2}+2 \zeta \omega s+\omega^{2}}
$$

可控标准型动态方程的各矩阵为

$$
x_{c}=\left[\begin{array}{l}
x_{c 1} \\
x_{c 2}
\end{array}\right], \quad \boldsymbol{A}_{c}=\left[\begin{array}{cc}
0 & 1 \\
-\omega^{2} & -2 \zeta \omega
\end{array}\right], \quad \boldsymbol{b}_{c}=\left[\begin{array}{l}
0 \\
1
\end{array}\right], \quad \boldsymbol{c}_{c}=\left[\begin{array}{ll}
1 & T
\end{array}\right]
$$

由 $G(s)$ 串联分解并引入中间变量 $z$ 有

$$
\begin{gathered}
\ddot{z}+2 \zeta \omega \dot{z}+\omega^{2} z=u \\
y=T \dot{z}+z
\end{gathered}
$$

对 $y$ 求导数并考虑上述关系式则有

$$
\dot{y}=T \ddot{z}+\dot{z}=(1-2 \zeta \omega T) \dot{z}-\omega^{2} T z+T u
$$

令 $x_{c 1}=z, x_{c 2}=\dot{z}$ ，可导出状态变量与输入、输出量的关系：

$$
\begin{aligned}
& x_{c 1}=\left[-T \dot{y}+(1-2 \zeta \omega T) y+T^{2} u\right] /\left(1-2 \zeta \omega T+\omega^{2} T^{2}\right) \\
& x_{c 2}=\left(\dot{y}+\omega^{2} T y-T u\right) /\left(1-2 \zeta \omega T+\omega^{2} T^{2}\right)
\end{aligned}
$$

可观测标准型动态方程各矩阵为

$$
\boldsymbol{x}_{o}=\left[\begin{array}{c}
x_{o 1} \\
x_{o 2}
\end{array}\right], \quad \boldsymbol{A}_{o}=\left[\begin{array}{cc}
0 & -\omega^{2} \\
1 & -2 \zeta \omega
\end{array}\right], \quad \boldsymbol{b}_{o}=\left[\begin{array}{c}
1 \\
T
\end{array}\right], \quad \boldsymbol{c}_{o}=\left[\begin{array}{ll}
0 & 1
\end{array}\right]
$$

根据式（9－12）可以写出状态变量与输入、输出量的关系

$$
\begin{aligned}
& x_{o 1}=\dot{y}+2 \zeta \omega y-T u \\
& x_{o 2}=y
\end{aligned}
$$

图 9－9 与图 9－10 分别示出了该系统可控标准型与可观测标准型的状态变量图。
2）$\frac{N(s)}{D(s)}$ 只含单实极点时的情况。当 $\frac{N(s)}{D(s)}$ 只含单实极点时，除了可化为上述可控标准型或可观测标准型动态方程以外，还可化为对角型动态方程，其 $\boldsymbol{A}$ 阵是一个对角阵。



<!-- source_pdf_page: 466 -->
![](assets/fig-09-09.png)

> Image description: This figure illustrates a state-space block diagram for a second-order system, labeled as “Example 9-3 System Controllable Canonical Form.” Input u drives the system, with state variables x₁ and x₂. Blocks represent system dynamics: 1/s (integrators), 2ζω (damping), and ω² (stiffness). The output y is derived from x₁ via 1/s and ω². Feedback loops include a proportional term T and a derivative term 2ζω. Arrows show signal flow: x₂ feeds into integrators, while x₁ contributes to y. The diagram models a mechanical or electrical system with mass, damping, and stiffness, commonly used in control theory. The structure enables direct mapping to state-space matrices for controller design.
图9－9 例9－3系统可控标准型状态变量图

![](assets/fig-09-10.png)

> Image description: This figure illustrates a state-space block diagram for a system in controllable canonical form. Input u drives a summing junction, splitting into two paths: one directly to a block labeled T, and another to a 1/s integrator producing x₁. The x₁ output feeds into a summing junction with feedback from a 2ζω block and a ω² block, generating x₂. The x₂ output passes through a 1/s integrator, yielding y = x₂. A feedback loop from y to the input adjusts the system. Arrows indicate signal flow, and blocks represent system dynamics. The diagram models a second-order system with damping and natural frequency parameters (ζ, ω). This structure is typical for control system analysis and design, emphasizing controllability.
图9－10 例9－3系统可观测标准型状态变量图

设 $D(s)$ 可分解为

$$
D(s)=\left(s-\lambda_{1}\right)\left(s-\lambda_{2}\right) \cdots\left(s-\lambda_{n}\right)
$$

式中，$\lambda_{1}, \cdots, \lambda_{n}$ 为系统的单实极点，则传递函数可展成部分分式之和

$$
\frac{Y(s)}{U(s)}=\frac{N(s)}{D(s)}=\sum_{i=1}^{n} \frac{c_{i}}{s-\lambda_{i}}
$$

而 $c_{i}=\left.\left[\frac{N(s)}{D(s)}\left(s-\lambda_{i}\right)\right]\right|_{s=\lambda_{i}}$ ，为 $\frac{N(s)}{D(s)}$ 在极点 $\lambda_{i}$ 处的留数，且有

$$
Y(s)=\sum_{i=1}^{n} \frac{c_{i}}{s-\lambda_{i}} U(s)
$$

若令状态变量

$$
X_{i}(s)=\frac{1}{s-\lambda_{i}} U(s) ; \quad i=1,2, \cdots, n
$$

其反变换结果为

$$
\begin{gathered}
\dot{x}_{i}(t)=\lambda_{i} x_{i}(t)+u(t) \\
y(t)=\sum_{i=1}^{n} c_{i} x_{i}(t)
\end{gathered}
$$

展开得

$$
\begin{aligned}
& \dot{x}_{1}=\lambda_{1} x_{1}+u \\
& \dot{x}_{2}=\lambda_{2} x_{2}+u \\
& \vdots \\
& \dot{x}_{n}=\lambda_{n} x_{n}+u \\
& y=c_{1} x_{1}+c_{2} x_{2}+\cdots+c_{n} x_{n}
\end{aligned}
$$

其向量－矩阵形式为

$$
\left[\begin{array}{c}
\dot{x}_{1}  \tag{9-18}\\
\dot{x}_{2} \\
\vdots \\
\dot{x}_{n}
\end{array}\right]=\left[\begin{array}{cccc}
\lambda_{1} & & & 0 \\
& \lambda_{2} & & \\
& & \ddots & \\
0 & & & \lambda_{n}
\end{array}\right]\left[\begin{array}{c}
x_{1} \\
x_{2} \\
\vdots \\
x_{n}
\end{array}\right]+\left[\begin{array}{c}
1 \\
1 \\
\vdots \\
1
\end{array}\right] u, \quad y=\left[\begin{array}{llll}
c_{1} & c_{2} & \cdots & c_{n}
\end{array}\right]\left[\begin{array}{c}
x_{1} \\
x_{2} \\
\vdots \\
x_{n}
\end{array}\right]
$$

其状态变量图如图9－11（a）所示。
若令状态变量



<!-- source_pdf_page: 467 -->
$$
X_{i}(s)=\frac{c_{i}}{s-\lambda_{i}} U(s) ; \quad i=1,2, \cdots, n
$$

则

$$
Y(s)=\sum_{i=1}^{n} X_{i}(s)
$$

进行反变换并展开有

$$
\begin{aligned}
& \dot{x}_{1}=\lambda_{1} x_{1}+c_{1} u \\
& \dot{x}_{2}=\lambda_{2} x_{2}+c_{2} u \\
& \vdots \\
& \dot{x}_{n}=\lambda_{n} x_{n}+c_{n} u \\
& y=x_{1}+x_{2}+\cdots+x_{n}
\end{aligned}
$$

其向量－矩阵形式为

$$
\left[\begin{array}{c}
\dot{x}_{1}  \tag{9-19}\\
\dot{x}_{2} \\
\vdots \\
\dot{x}_{n}
\end{array}\right]=\left[\begin{array}{cccc}
\lambda_{1} & & & 0 \\
& \lambda_{2} & & \\
& & \ddots & \\
0 & & & \lambda_{n}
\end{array}\right]\left[\begin{array}{c}
x_{1} \\
x_{2} \\
\vdots \\
x_{n}
\end{array}\right]+\left[\begin{array}{c}
c_{1} \\
c_{2} \\
\vdots \\
c_{n}
\end{array}\right] u, \quad y=\left[\begin{array}{llll}
1 & 1 & \cdots & 1
\end{array}\right]\left[\begin{array}{c}
x_{1} \\
x_{2} \\
\vdots \\
x_{n}
\end{array}\right]
$$

其状态变量图如图9－11（b）所示。显见式（9－19）与式（9－18）存在对偶关系。

![](assets/fig-09-11.png)

> Image description: The figure displays two state-variable diagrams for linear systems: (a) controllable canonical form and (b) observable canonical form. In (a), input u drives each state derivative ẋᵢ, which passes through a 1/s integrator to yield state xᵢ, then multiplied by output coefficient cᵢ. Outputs y are summed from all cᵢxᵢ. In (b), the structure is dual: input u first goes through cᵢ blocks, then to 1/s integrators to generate states xᵢ, and finally, states feed into λᵢ blocks to form y. Arrows indicate signal flow, and summation junctions (+) combine inputs. The diagrams illustrate duality between controllability and observability, with (a) and (b) being dual representations. The caption references equations (9-18) and (9-19) as being dual.
图9－11 系统对角型动态方程的状态变量图

3）$\frac{N(s)}{D(s)}$ 含重实极点时的情况。当传递函数除含单实极点之外还含有重实极点时，不仅可化为可控、可观测标准型，还可化为约当标准型动态方程，其 $\boldsymbol{A}$ 阵是一个含约当块的矩阵。设 $D(s)$ 可分解为

$$
D(s)=\left(s-\lambda_{1}\right)^{3}\left(s-\lambda_{4}\right) \cdots\left(s-\lambda_{n}\right)
$$

式中，$\lambda_{1}$ 为三重实极点；$\lambda_{4}, \cdots, \lambda_{n}$ 为单实极点，则传递函数可展成下列部分分式之和：

$$
\frac{Y(s)}{U(s)}=\frac{N(s)}{D(s)}=\frac{c_{11}}{\left(s-\lambda_{1}\right)^{3}}+\frac{c_{12}}{\left(s-\lambda_{1}\right)^{2}}+\frac{c_{13}}{\left(s-\lambda_{1}\right)}+\sum_{i=4}^{n} \frac{c_{i}}{s-\lambda_{i}}
$$

其状态变量的选取方法与只含单实极点时相同，可分别得出向量－矩阵形式的动态方程：



<!-- source_pdf_page: 468 -->
$$
\begin{align*}
& {\left[\begin{array}{c}
\dot{x}_{11} \\
\dot{x}_{12} \\
\dot{x}_{13} \\
\hdashline \dot{x}_{4} \\
\vdots \\
\dot{x}_{n}
\end{array}\right]=\left[\begin{array}{ccc:ccc}
\lambda_{1} & 1 & & & & \\
& \lambda_{1} & 1 & & 0 & \\
& & \lambda_{1} & & & \\
\hdashline & & & \lambda_{4} & & \\
& 0 & & & \ddots & \\
& & & & & \lambda_{n}
\end{array}\right]\left[\begin{array}{c}
x_{11} \\
x_{12} \\
x_{13} \\
\hdashline x_{4} \\
\vdots \\
x_{n}
\end{array}\right]+\left[\begin{array}{c}
0 \\
0 \\
1 \\
1 \\
\vdots \\
1
\end{array}\right] u}  \tag{9-20}\\
& y=\left[\begin{array}{lll:lll}
c_{11} & c_{12} & c_{13} & c_{4} & \cdots & c_{n}
\end{array}\right] x \\
& {\left[\begin{array}{c}
\dot{x}_{11} \\
\dot{x}_{12} \\
\dot{x}_{13} \\
\hdashline \dot{x}_{4} \\
\vdots \\
\dot{x}_{n}
\end{array}\right]=\left[\begin{array}{ccc:ccc}
\lambda_{1} & & & & & \\
1 & \lambda_{1} & & & 0 & \\
& 1 & \lambda_{1} & & & \\
\hdashline & & & \lambda_{4} & & \\
& 0 & & & \ddots & \\
& & & & & \lambda_{n}
\end{array}\right]\left[\begin{array}{c}
x_{11} \\
x_{12} \\
x_{13} \\
\hdashline x_{4} \\
\vdots \\
x_{n}
\end{array}\right]+\left[\begin{array}{c}
c_{11} \\
c_{12} \\
c_{13} \\
\hdashline c_{4} \\
\vdots \\
c_{n}
\end{array}\right] u} \\
& y=\left[\begin{array}{lll:lll}
0 & 0 & 1 & 1 & \cdots & 1
\end{array}\right] \boldsymbol{x} \tag{9-21}
\end{align*}
$$

其对应的状态变量图如图9－12（a），（b）所示。式（9－20）与式（9－21）也存在对偶关系。

![](assets/fig-09-12.png)

> Image description: This textbook figure illustrates the “controllable canonical form” (a) of a state-space system. Input u enters a summing junction, branching into n parallel paths. Each path processes a state variable derivative (ẋ_i) through an S⁻¹ block (integrator), yielding x_i. Feedback loops with λ_i blocks adjust each path. Outputs c_ij (i,j=1 to n) are generated from the state variables x_i, and all paths converge to a final summing junction producing output y. The diagram visually represents the canonical structure for controllability, where the system’s dynamics are decoupled into integrators, and the output is a linear combination of the states. The figure’s layout and labeled blocks (S⁻¹, λ_i, c_ij) reflect standard control theory notation for system modeling.
（b）可观约当型

图9－12 系统约筑型动态方辟的状态变量图



<!-- source_pdf_page: 469 -->
4．线性定常连续系统状态方程的解
（1）齐次状态方程的解
状态方程

$$
\begin{equation*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t) \tag{9-22}
\end{equation*}
$$

称为齐次状态方程，通常采用幂级数法和拉普拉斯变换法求解。
1）幂级数法。设状态方程式（9－22）的解是 $t$ 的向量幂级数

$$
\boldsymbol{x}(t)=\boldsymbol{b}_{0}+\boldsymbol{b}_{1} t+\boldsymbol{b}_{2} t^{2}+\cdots+\boldsymbol{b}_{k} t^{k}+\cdots
$$

式中， $\boldsymbol{x}, \boldsymbol{b}_{0}, \boldsymbol{b}_{1}, \cdots, \boldsymbol{b}_{k}, \cdots$ 都是 $n$ 维向量，则

$$
\dot{\boldsymbol{x}}(t)=\boldsymbol{b}_{1}+2 \boldsymbol{b}_{2} t+\cdots+\boldsymbol{k} \boldsymbol{b}_{k} t^{k-1}+\cdots=\boldsymbol{A}\left(\boldsymbol{b}_{0}+\boldsymbol{b}_{1} t+\boldsymbol{b}_{2} t^{2}+\cdots+\boldsymbol{b}_{k} t^{k}+\cdots\right)
$$

令上式等号两边 $t$ 的同次项的系数相等，则有

$$
\begin{aligned}
\boldsymbol{b}_{1} & =\boldsymbol{A} \boldsymbol{b}_{0} \\
\boldsymbol{b}_{2} & =\frac{1}{2} \boldsymbol{A} \boldsymbol{b}_{1}=\frac{1}{2} \boldsymbol{A}^{2} \boldsymbol{b}_{0} \\
\boldsymbol{b}_{3} & =\frac{1}{3} \boldsymbol{A} \boldsymbol{b}_{2}=\frac{1}{6} \boldsymbol{A}^{3} \boldsymbol{b}_{0} \\
\vdots & \\
\boldsymbol{b}_{k} & =\frac{1}{k} \boldsymbol{A} \boldsymbol{b}_{k-1}=\frac{1}{k!} \boldsymbol{A}^{k} \boldsymbol{b}_{0} \\
\vdots &
\end{aligned}
$$

且 $\boldsymbol{x}(0)=\boldsymbol{b}_{0}$ ，故

$$
\begin{equation*}
\boldsymbol{x}(t)=\left(\boldsymbol{I}+\boldsymbol{A} t+\frac{1}{2} \boldsymbol{A}^{2} t^{2}+\cdots+\frac{1}{k!} \boldsymbol{A}^{k} t^{k}+\cdots\right) \boldsymbol{x}(0) \tag{9-23}
\end{equation*}
$$

定义

$$
\begin{equation*}
\mathrm{e}^{A t}=\boldsymbol{I}+\boldsymbol{A} t+\frac{1}{2} \boldsymbol{A}^{2} t^{2}+\cdots+\frac{1}{k!} \boldsymbol{A}^{k} t^{k}+\cdots=\sum_{k=0}^{\infty} \frac{1}{k!} \boldsymbol{A}^{k} t^{k} \tag{9-24}
\end{equation*}
$$

则

$$
\begin{equation*}
\boldsymbol{x}(t)=\mathrm{e}^{A t} \boldsymbol{x}(0) \tag{9-25}
\end{equation*}
$$

由于标量微分方程 $\dot{x}=a x$ 的解为 $x(t)=\mathrm{e}^{a t} x(0), \mathrm{e}^{a t}$ 称为指数函数，而向量微分方程式（9－22）具有相似形式的解（式（9－25）），故把 $\mathrm{e}^{A t}$ 称为矩阵指数函数，简称矩阵指数。由于 $\boldsymbol{x}(t)$是由 $\boldsymbol{x}(0)$ 转移而来，对于线性定常系统， $\mathrm{e}^{A t}$ 又称为状态转移矩阵，记为 $\Phi(t)$ ，即

$$
\begin{equation*}
\Phi(t)=\mathrm{e}^{A t} \tag{9-26}
\end{equation*}
$$

2）拉普拉斯变换法。将式（9－22）取拉氏变换，有

$$
s \boldsymbol{X}(s)=\boldsymbol{A} \boldsymbol{X}(s)+\boldsymbol{x}(0)
$$

则

$$
\begin{align*}
& (s \boldsymbol{I}-\boldsymbol{A}) \boldsymbol{X}(s)=\boldsymbol{x}(0)  \tag{9-27}\\
& \boldsymbol{X}(s)=(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{x}(0)
\end{align*}
$$

进行拉氏反变换，有

$$
\begin{equation*}
\boldsymbol{x}(t)=\mathbb{S}^{-1}\left[(s \boldsymbol{I}-\boldsymbol{A})^{-1}\right] \boldsymbol{x}(0) \tag{9-28}
\end{equation*}
$$



<!-- source_pdf_page: 470 -->
与式（9－25）相比有

$$
\begin{equation*}
\mathrm{e}^{A t}=\mathscr{S}^{-1}\left[(s \boldsymbol{I}-\boldsymbol{A})^{-1}\right] \tag{9-29}
\end{equation*}
$$

式（9－29）给出了 $\mathrm{e}^{A t}$ 的闭合形式，说明了式（9－24）所示级数的收敛性。
从上述分析可看出，求解齐次状态方程的问题，就是计算状态转移矩阵 $\Phi(t)$ 的问题，因而有必要研究 $\Phi(t)$ 的运算性质。
（2）状态转移矩阵的运算性质
重写状态转移矩阵 $\boldsymbol{\Phi}(t)$ 的幂级数展开式

$$
\begin{equation*}
\Phi(t)=\mathrm{e}^{A t}=\boldsymbol{I}+\boldsymbol{A} t+\frac{1}{2} \boldsymbol{A}^{2} t^{2}+\cdots+\frac{1}{k!} \boldsymbol{A}^{k} t^{k}+\cdots \tag{9-30}
\end{equation*}
$$

$\Phi(t)$ 具有如下运算性质：
1）$\Phi(0)=\boldsymbol{I}$

2）$\dot{\boldsymbol{\Phi}}(t)=\boldsymbol{A} \boldsymbol{\Phi}(t)=\boldsymbol{\Phi}(t) A$

上述性质利用式（9－30）很容易进行证明。式（9－32）表明，$A \Phi(t)$ 与 $\Phi(t) A$ 可交换，$\dot{\Phi}(0)=A$ ，并且 $\Phi(t)$ 是微分方程

$$
\begin{equation*}
\dot{\boldsymbol{\Phi}}(t)=\boldsymbol{A} \boldsymbol{\Phi}(t), \quad \boldsymbol{\Phi}(0)=\boldsymbol{I} \tag{9-33}
\end{equation*}
$$

的唯一解。
3） $\boldsymbol{\Phi}\left(t_{1} \pm t_{2}\right)=\boldsymbol{\Phi}\left(t_{1}\right) \boldsymbol{\Phi}\left( \pm t_{2}\right)=\boldsymbol{\Phi}\left( \pm t_{2}\right) \boldsymbol{\Phi}\left(t_{1}\right)$

令式（9－30）中 $t=t_{1} \pm t_{2}$ ，便可证明这一性质。 $\boldsymbol{\Phi}\left(t_{1}\right), \boldsymbol{\Phi}\left(t_{2}\right), \boldsymbol{\Phi}\left(t_{1} \pm t_{2}\right)$ 分别表示由状态 $\boldsymbol{x}(0)$转移至状态 $\boldsymbol{x}\left(t_{1}\right), \boldsymbol{x}\left(t_{2}\right), \boldsymbol{x}\left(t_{1} \pm t_{2}\right)$ 的状态转移矩阵。该性质表明 $\boldsymbol{\Phi}\left(t_{1} \pm t_{2}\right)$ 可分解为 $\boldsymbol{\Phi}\left(t_{1}\right)$与 $\Phi\left( \pm t_{2}\right)$ 的乘积，且 $\Phi\left(t_{1}\right)$ 与 $\Phi\left( \pm t_{2}\right)$ 是可交换的。

4） $\boldsymbol{\Phi}^{-1}(t)=\boldsymbol{\Phi}(-t), \boldsymbol{\Phi}^{-1}(-t)=\boldsymbol{\Phi}(t)$

证明 由性质3）有

$$
\Phi(t-t)=\Phi(t) \Phi(-t)=\Phi(-t) \Phi(t)=I
$$

根据逆矩阵的定义可得式（9－35）。
根据 $\boldsymbol{\Phi}(t)$ 的这一性质，对于线性定常系统，显然有

$$
\boldsymbol{x}(t)=\boldsymbol{\Phi}(t) \boldsymbol{x}(0), \quad \boldsymbol{x}(0)=\boldsymbol{\Phi}^{-1}(t) \boldsymbol{x}(t)=\boldsymbol{\Phi}(-t) \boldsymbol{x}(t)
$$

这说明状态转移具有可逆性，$x(t)$ 可由 $x(0)$ 转移而来，$x(0)$ 也可由 $x(t)$ 转移而来。
5） $\boldsymbol{x}\left(t_{2}\right)=\boldsymbol{\Phi}\left(t_{2}-t_{1}\right) \boldsymbol{x}\left(t_{1}\right)$

证明 由于

$$
\begin{aligned}
& \boldsymbol{x}\left(t_{1}\right)=\boldsymbol{\Phi}\left(t_{1}\right) \boldsymbol{x}(0), \quad \boldsymbol{x}(0)=\boldsymbol{\Phi}^{-1}\left(t_{1}\right) \boldsymbol{x}\left(t_{1}\right)=\boldsymbol{\Phi}\left(-t_{1}\right) \boldsymbol{x}\left(t_{1}\right) \\
& \boldsymbol{x}\left(t_{2}\right)=\boldsymbol{\Phi}\left(t_{2}\right) \boldsymbol{x}(0)=\boldsymbol{\Phi}\left(t_{2}\right) \boldsymbol{\Phi}\left(-t_{1}\right) \boldsymbol{x}\left(t_{1}\right)=\boldsymbol{\Phi}\left(t_{2}-t_{1}\right) \boldsymbol{x}\left(t_{1}\right)
\end{aligned}
$$

即由 $\boldsymbol{x}\left(t_{1}\right)$ 转移至 $\boldsymbol{x}\left(t_{2}\right)$ 的状态转移矩阵为 $\boldsymbol{\Phi}\left(t_{2}-t_{1}\right)$ 。
6） $\boldsymbol{\Phi}\left(t_{2}-t_{0}\right)=\boldsymbol{\Phi}\left(t_{2}-t_{1}\right) \boldsymbol{\Phi}\left(t_{1}-t_{0}\right)$

证明 由于



<!-- source_pdf_page: 471 -->
$$
\boldsymbol{x}\left(t_{2}\right)=\boldsymbol{\Phi}\left(t_{2}-t_{0}\right) \boldsymbol{x}\left(t_{0}\right), \quad \boldsymbol{x}\left(t_{1}\right)=\boldsymbol{\Phi}\left(t_{1}-t_{0}\right) \boldsymbol{x}\left(t_{0}\right)
$$

则

$$
\boldsymbol{x}\left(t_{2}\right)=\boldsymbol{\Phi}\left(t_{2}-t_{1}\right) \boldsymbol{x}\left(t_{1}\right)=\boldsymbol{\Phi}\left(t_{2}-t_{1}\right) \boldsymbol{\Phi}\left(t_{1}-t_{0}\right) \boldsymbol{x}\left(t_{0}\right)=\boldsymbol{\Phi}\left(t_{2}-t_{0}\right) \boldsymbol{x}\left(t_{0}\right)
$$

故式（9－37）成立。
根据转移矩阵的这一性质，可把一个转移过程分为若干个小的转移过程来研究，如图9－13所示。

$$
\begin{equation*}
\text { 7) }[\boldsymbol{\Phi}(t)]^{k}=\boldsymbol{\Phi}(k t) \tag{9-38}
\end{equation*}
$$

证明 由于

$$
[\Phi(t)]^{k}=\left(\mathrm{e}^{A t}\right)^{k}=\mathrm{e}^{k A t}=\mathrm{e}^{A(k t)}=\Phi(k t)
$$

故式（9－38）成立。

![](assets/fig-09-13.png)

> Image description: This figure illustrates the state transition matrix property in control theory. The horizontal axis represents time t, and the vertical axis represents state x. Starting at t₀ with initial state x(t₀), the system evolves to t₁ via Φ(t₁−t₀), then to t₂ via Φ(t₂−t₁). The composite path from t₀ to t₂ is shown as Φ(t₂−t₀), demonstrating the semigroup property: Φ(t₂−t₀) = Φ(t₂−t₁)·Φ(t₁−t₀). Curved arrows indicate state trajectories, while dashed lines mark time instants t₀, t₁, t₂. The diagram visually confirms that state evolution over multiple intervals is equivalent to a single evolution over the total interval, a fundamental property of linear time-invariant systems.
图9－13 状态转移矩阵性质6）的图示

8）若 $\boldsymbol{\Phi}(t)$ 为 $\dot{\boldsymbol{x}}(t)=A \boldsymbol{x}(t)$ 的状态转移矩阵，则引人非奇异变换 $\boldsymbol{x}=\boldsymbol{P} \boldsymbol{x}$ 后的状态转移矩阵为

$$
\begin{equation*}
\overline{\boldsymbol{\Phi}}(t)=\boldsymbol{P}^{-1} \mathrm{e}^{A t} \boldsymbol{P} \tag{9-39}
\end{equation*}
$$

证明 将 $\boldsymbol{x}=\boldsymbol{P} \boldsymbol{x}$ 代人 $\dot{x}(t)=\boldsymbol{A} \boldsymbol{x}(t)$ ，有

$$
P \dot{\bar{x}}=A P \bar{x}, \quad \dot{\bar{x}}=P^{-1} A P \bar{x}, \bar{x}(t)=\bar{\Phi}(t) \bar{x}(0)=\mathrm{e}^{P^{-1} A P_{t}} \bar{x}(0)
$$

式中

$$
\begin{aligned}
\mathrm{e}^{P^{-1} A P_{t}} & =\boldsymbol{I}+\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P} t+\frac{1}{2}\left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{2} t^{2}+\cdots+\frac{1}{k!}\left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{k} t^{k}+\cdots \\
& =\boldsymbol{P}^{-1} \boldsymbol{I} \boldsymbol{P}+\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P} t+\frac{1}{2} \boldsymbol{P}^{-1} \boldsymbol{A}^{2} \boldsymbol{P} t^{2}+\cdots+\frac{1}{k!} \boldsymbol{P}^{-1} \boldsymbol{A}^{k} \boldsymbol{P} t^{k}+\cdots \\
& =\boldsymbol{P}^{-1}\left(\boldsymbol{I}+\boldsymbol{A} t+\frac{1}{2} \boldsymbol{A}^{2} t^{2}+\cdots+\frac{1}{k!} \boldsymbol{A}^{k} t^{k}+\cdots\right) \boldsymbol{P}=\boldsymbol{P}^{-1} \mathrm{e}^{A t} \boldsymbol{P}
\end{aligned}
$$

因而式（9－39）成立。
9）两种常见的状态转移矩阵。设 $A=\operatorname{diag}\left[\lambda_{1}, \lambda_{2}, \cdots, \lambda_{n}\right]$ ，即 $A$ 为对角阵，且具有互异元素，则

$$
\boldsymbol{\Phi}(t)=\left[\begin{array}{cccc}
\mathrm{e}^{\lambda_{1} t} & & & 0  \tag{9-40}\\
& \mathrm{e}^{\lambda_{2} t} & & \\
& & \ddots & \\
0 & & & \mathrm{e}^{\lambda_{n} t}
\end{array}\right]
$$

设 $\boldsymbol{A}$ 矩阵为 $m \times m$ 约当阵

$$
A=\left[\begin{array}{cccc}
\lambda & 1 & & 0 \\
& \lambda & \ddots & \\
& & \ddots & 1 \\
0 & & & \lambda
\end{array}\right]
$$



<!-- source_pdf_page: 472 -->
则

$$
\Phi(t)=\left[\begin{array}{ccccc}
\mathrm{e}^{\lambda t} & t \mathrm{e}^{\lambda t} & \frac{t^{2}}{2} \mathrm{e}^{\lambda t} & \cdots & \frac{t^{m-1}}{(m-1)!} \mathrm{e}^{\lambda t}  \tag{9-41}\\
0 & \mathrm{e}^{\lambda t} & t \mathrm{e}^{\lambda t} & \cdots & \frac{t^{m-2}}{(m-2)!} \mathrm{e}^{\lambda t} \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & t \mathrm{e}^{\lambda t} \\
0 & 0 & 0 & \cdots & \mathrm{e}^{\lambda t}
\end{array}\right]
$$

用幂级数展开式即可证明式（9－40）和式（9－41）成立。
例 9－4 设系统状态方程为

$$
\left[\begin{array}{l}
\dot{x}_{1}(t) \\
\dot{x}_{2}(t)
\end{array}\right]=\left[\begin{array}{cc}
0 & 1 \\
-2 & -3
\end{array}\right]\left[\begin{array}{l}
x_{1}(t) \\
x_{2}(t)
\end{array}\right]
$$

试求状态方程的解。
解 用拉氏变换求解

$$
\begin{gathered}
s \boldsymbol{I}-\boldsymbol{A}=\left[\begin{array}{ll}
s & 0 \\
0 & s
\end{array}\right]-\left[\begin{array}{cc}
0 & 1 \\
-2 & -3
\end{array}\right]=\left[\begin{array}{cc}
s & -1 \\
2 & s+3
\end{array}\right] \\
(s \boldsymbol{I}-\boldsymbol{A})^{-1}=\frac{\operatorname{adj}(s \boldsymbol{I}-\boldsymbol{A})}{|s \boldsymbol{I}-\boldsymbol{A}|}=\frac{1}{(s+1)(s+2)}\left[\begin{array}{cc}
s+3 & 1 \\
-2 & s
\end{array}\right]=\left[\begin{array}{cc}
\frac{2}{s+1}-\frac{1}{s+2} & \frac{1}{s+1}-\frac{1}{s+2} \\
\frac{-2}{s+1}+\frac{2}{s+2} & \frac{-1}{s+1}+\frac{2}{s+2}
\end{array}\right] \\
\Phi(t)=\operatorname{sen}^{-1}\left[(s \boldsymbol{I}-\boldsymbol{A})^{-1}\right]=\left[\begin{array}{cc}
2 \mathrm{e}^{-t}-\mathrm{e}^{-2 t} & \mathrm{e}^{-t}-\mathrm{e}^{-2 t} \\
-2 \mathrm{e}^{-t}+2 \mathrm{e}^{-2 t} & -\mathrm{e}^{-t}+2 \mathrm{e}^{-2 t}
\end{array}\right]
\end{gathered}
$$

状态方程的解为

$$
\left[\begin{array}{l}
x_{1}(t) \\
x_{2}(t)
\end{array}\right]=\boldsymbol{\Phi}(t)\left[\begin{array}{l}
x_{1}(0) \\
x_{2}(0)
\end{array}\right]=\left[\begin{array}{cc}
2 \mathrm{e}^{-t}-\mathrm{e}^{-2 t} & \mathrm{e}^{-t}-\mathrm{e}^{-2 t} \\
-2 \mathrm{e}^{-t}+2 \mathrm{e}^{-2 t} & -\mathrm{e}^{-t}+2 \mathrm{e}^{-2 t}
\end{array}\right]\left[\begin{array}{l}
x_{1}(0) \\
x_{2}(0)
\end{array}\right]
$$

（3）非齐次状态方程的解
状态方程

$$
\begin{equation*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{B} \boldsymbol{u}(t) \tag{9-42}
\end{equation*}
$$

称为非齐次状态方程，有如下两种解法。
1）积分法。由式（9－42）可得

$$
\mathrm{e}^{-A t}(\dot{\boldsymbol{x}}(t)-\boldsymbol{A} \boldsymbol{x}(t))=\mathrm{e}^{-A t} \boldsymbol{B} \boldsymbol{u}(t)
$$

由于

$$
\frac{\mathrm{d}}{\mathrm{~d} t}\left(\mathrm{e}^{-A t} \boldsymbol{x}(t)\right)=-\boldsymbol{A} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{x}(t)+\mathrm{e}^{-A t} \dot{\boldsymbol{x}}(t)=\mathrm{e}^{-\boldsymbol{A} t}[\dot{\boldsymbol{x}}(t)-\boldsymbol{A} \boldsymbol{x}(t)]
$$

积分可得

$$
\mathrm{e}^{-A t} \boldsymbol{x}(t)-\boldsymbol{x}(0)=\int_{0}^{t} \mathrm{e}^{-A \tau} \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau
$$

$$
\begin{equation*}
\boldsymbol{x}(t)=\mathrm{e}^{A t} \boldsymbol{x}(0)+\int_{0}^{t} \mathrm{e}^{A(t-\tau)} \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau=\boldsymbol{\Phi}(t) \boldsymbol{x}(0)+\int_{0}^{t} \boldsymbol{\Phi}(t-\tau) \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau \tag{9-43}
\end{equation*}
$$

式中第一项是对初始状态的响应，第二项是对输入作用的响应。
若取 $t_{0}$ 作为初始时刻，则有



<!-- source_pdf_page: 473 -->
$$
\begin{gather*}
\mathrm{e}^{-A t} \boldsymbol{x}(t)-\mathrm{e}^{-A t_{0}} \boldsymbol{x}\left(t_{0}\right)=\int_{t_{0}}^{t} \mathrm{e}^{-A \tau} \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau \\
\boldsymbol{x}(t)=\mathrm{e}^{A\left(t-t_{0}\right)} \boldsymbol{x}\left(t_{0}\right)+\int_{t_{0}}^{t} \mathrm{e}^{A(t-\tau)} \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau \\
=\boldsymbol{\Phi}\left(t-t_{0}\right) \boldsymbol{x}\left(t_{0}\right)+\int_{t_{0}}^{t} \boldsymbol{\Phi}(t-\tau) \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau \tag{9-44}
\end{gather*}
$$

2）拉普拉斯变换法。将式（9－42）两端取拉氏变换，有

$$
s \boldsymbol{X}(s)-\boldsymbol{x}(0)=\boldsymbol{A} \boldsymbol{X}(s)+\boldsymbol{B} \boldsymbol{U}(s)
$$

则

$$
(s I-A) X(s)=x(0)+B U(s)
$$

$$
\boldsymbol{X}(s)=(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{x}(0)+(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B} \boldsymbol{U}(s)
$$

进行拉氏反变换，有

$$
\boldsymbol{x}(t)=\mathscr{L}^{-1}\left[(s \boldsymbol{I}-\boldsymbol{A})^{-1}\right] \boldsymbol{x}(0)+\mathscr{L}^{-1}\left[(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B} \boldsymbol{U}(s)\right]
$$

由拉氏变换卷积定理

$$
\mathscr{L}^{-1}\left[F_{1}(s) F_{2}(s)\right]=\int_{0}^{t} f_{1}(t-\tau) f_{2}(\tau) \mathrm{d} \tau=\int_{0}^{t} f_{1}(\tau) f_{2}(t-\tau) \mathrm{d} \tau
$$

在此将 $(s \boldsymbol{I}-\boldsymbol{A})^{-1}$ 视为 $F_{1}(s)$ ，将 $\boldsymbol{B} \boldsymbol{U}(s)$ 视为 $F_{2}(s)$ ，则有

$$
\boldsymbol{x}(t)=\mathrm{e}^{\boldsymbol{A} t} \boldsymbol{x}(0)+\int_{0}^{t} \mathrm{e}^{\boldsymbol{A}(t-\tau)} \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau=\boldsymbol{\Phi}(t) \boldsymbol{x}(0)+\int_{0}^{t} \boldsymbol{\Phi}(t-\tau) \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau
$$

结果与式（9－43）相同。上式又可表示为

$$
\begin{equation*}
\boldsymbol{x}(t)=\boldsymbol{\Phi}(t) \boldsymbol{x}(0)+\int_{0}^{t} \boldsymbol{\Phi}(\tau) \boldsymbol{B} \boldsymbol{u}(t-\tau) \mathrm{d} \tau \tag{9-45}
\end{equation*}
$$

有时利用式（9－45）求解更为方便。
例 9－5 系统状态方程为

$$
\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
0 & 1 \\
-2 & -3
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{l}
0 \\
1
\end{array}\right] u
$$

且 $\boldsymbol{x}(0)=\left[x_{1}(0) \quad x_{2}(0)\right]^{\mathrm{T}}$ 。试求在 $u(t)=1(t)$ 作用下状态方程的解。
解 由于 $u(t)=1, u(t-\tau)=1$ ，根据式（9－45）可得

$$
\boldsymbol{x}(t)=\boldsymbol{\Phi}(t) \boldsymbol{x}(0)+\int_{0}^{t} \boldsymbol{\Phi}(\tau) \boldsymbol{B} \mathrm{d} \tau
$$

由例9－4 已求得

$$
\begin{gathered}
\Phi(t)=\left[\begin{array}{cc}
2 \mathrm{e}^{-t}-\mathrm{e}^{-2 t} & \mathrm{e}^{-t}-\mathrm{e}^{-2 t} \\
-2 \mathrm{e}^{-t}+2 \mathrm{e}^{-2 t} & -\mathrm{e}^{-t}+2 \mathrm{e}^{-2 t}
\end{array}\right] \\
\int_{0}^{t} \Phi(\tau) B \mathrm{~d} \tau=\int_{0}^{t}\left[\begin{array}{c}
\mathrm{e}^{-\tau}-\mathrm{e}^{-2 \tau} \\
-\mathrm{e}^{-\tau}+2 \mathrm{e}^{-2 \tau}
\end{array}\right] \mathrm{d} \tau=\left.\left[\begin{array}{c}
-\mathrm{e}^{-\tau}+\frac{1}{2} \mathrm{e}^{-2 \tau} \\
\mathrm{e}^{-\tau}-\mathrm{e}^{-2 \tau}
\end{array}\right]\right|_{0} ^{t}=\left[\begin{array}{c}
-\mathrm{e}^{-t}+\frac{1}{2} \mathrm{e}^{-2 t}+\frac{1}{2} \\
\mathrm{e}^{-t}-\mathrm{e}^{-2 t}
\end{array}\right]
\end{gathered}
$$

故

$$
\boldsymbol{x}(t)=\left[\begin{array}{l}
x_{1}(t) \\
x_{2}(t)
\end{array}\right]=\left[\begin{array}{cc}
2 \mathrm{e}^{-t}-\mathrm{e}^{-2 t} & \mathrm{e}^{-t}-\mathrm{e}^{-2 t} \\
-2 \mathrm{e}^{-t}+2 \mathrm{e}^{-2 t} & -\mathrm{e}^{-t}+2 \mathrm{e}^{-2 t}
\end{array}\right]\left[\begin{array}{l}
x_{1}(0) \\
x_{2}(0)
\end{array}\right]+\left[\begin{array}{c}
-\mathrm{e}^{-t}+\frac{1}{2} \mathrm{e}^{-2 t}+\frac{1}{2} \\
\mathrm{e}^{-t}-\mathrm{e}^{-2 t}
\end{array}\right]
$$



<!-- source_pdf_page: 474 -->
5．系统的传递函数矩阵
对于多输入－多输出系统，需要讨论传递函数矩阵。
（1）定义及表达式
初始条件为零时，输出向量的拉氏变换式与输入向量的拉氏变换式之间的传递关系称为传递函数矩阵，简称传递矩阵。设系统动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{B} \boldsymbol{u}(t), \quad \boldsymbol{y}(t)=\boldsymbol{C} \boldsymbol{x}(t)+\boldsymbol{D} \boldsymbol{u}(t) \tag{9-46}
\end{equation*}
$$

令初始条件为零，进行拉氏变换有

$$
s \boldsymbol{X}(s)=\boldsymbol{A} \boldsymbol{X}(s)+\boldsymbol{B} \boldsymbol{U}(s), \quad \boldsymbol{Y}(s)=\boldsymbol{C} \boldsymbol{X}(s)+\boldsymbol{D} \boldsymbol{U}(s)
$$

则

$$
\boldsymbol{X}(s)=(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B} \boldsymbol{U}(s)
$$

$$
\begin{equation*}
\boldsymbol{Y}(s)=\left[\boldsymbol{C}(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B}+\boldsymbol{D}\right] \boldsymbol{U}(s)=\boldsymbol{G}(s) \boldsymbol{U}(s) \tag{9-47}
\end{equation*}
$$

系统的传递函数矩阵表达式为

$$
\begin{equation*}
\boldsymbol{G}(s)=\boldsymbol{C}(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B}+\boldsymbol{D} \tag{9-48}
\end{equation*}
$$

若输入 $\boldsymbol{u}$ 为 $p$ 维向量，输出 $\boldsymbol{y}$ 为 $q$ 维向量，则 $\boldsymbol{G}(s)$ 为 $q \times p$ 矩阵。式（9－47）的展开式为

$$
\left[\begin{array}{c}
Y_{1}(s)  \tag{9-49}\\
Y_{2}(s) \\
\vdots \\
Y_{q}(s)
\end{array}\right]=\left[\begin{array}{cccc}
G_{11}(s) & G_{12}(s) & \cdots & G_{1 p}(s) \\
G_{21}(s) & G_{22}(s) & \cdots & G_{2 p}(s) \\
\vdots & \vdots & & \vdots \\
G_{q 1}(s) & G_{q 2}(s) & \cdots & G_{q p}(s)
\end{array}\right]\left[\begin{array}{c}
U_{1}(s) \\
U_{2}(s) \\
\vdots \\
U_{p}(s)
\end{array}\right]
$$

式中，$G_{i j}(s)(i=1,2, \cdots, q ; j=1,2, \cdots, p)$ 表示第 $i$ 个输出量与第 $j$ 个输人量之间的传递函数。
例 9－6 已知系统动态方程为

$$
\begin{aligned}
& {\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
0 & 1 \\
0 & -2
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{ll}
1 & 0 \\
0 & 1
\end{array}\right]\left[\begin{array}{l}
u_{1} \\
u_{2}
\end{array}\right]} \\
& {\left[\begin{array}{l}
y_{1} \\
y_{2}
\end{array}\right]=\left[\begin{array}{ll}
1 & 0 \\
0 & 1
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]}
\end{aligned}
$$

试求系统的传递矩阵。
解 已知

$$
\boldsymbol{A}=\left[\begin{array}{cc}
0 & 1 \\
0 & -2
\end{array}\right], \quad \boldsymbol{B}=\left[\begin{array}{ll}
1 & 0 \\
0 & 1
\end{array}\right], \quad \boldsymbol{C}=\left[\begin{array}{ll}
1 & 0 \\
0 & 1
\end{array}\right], \quad \boldsymbol{D}=\mathbf{0}
$$

故

$$
\begin{gathered}
(s \boldsymbol{I}-\boldsymbol{A})^{-1}=\left[\begin{array}{cc}
s & -1 \\
0 & s+2
\end{array}\right]^{-1}=\left[\begin{array}{cc}
\frac{1}{s} & \frac{1}{s(s+2)} \\
0 & \frac{1}{s+2}
\end{array}\right] \\
\boldsymbol{G}(s)=\boldsymbol{C}(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B}=\left[\begin{array}{ll}
1 & 0 \\
0 & 1
\end{array}\right]\left[\begin{array}{cc}
\frac{1}{s} & \frac{1}{s(s+2)} \\
0 & \frac{1}{s+2}
\end{array}\right]\left[\begin{array}{ll}
1 & 0 \\
0 & 1
\end{array}\right]=\left[\begin{array}{cc}
\frac{1}{s} & \frac{1}{s(s+2)} \\
0 & \frac{1}{s+2}
\end{array}\right]
\end{gathered}
$$



<!-- source_pdf_page: 475 -->
（2）开环与闭环传递矩阵
设多输人－多输出系统结构图如图9－14所示。图中 $\boldsymbol{U}, \boldsymbol{Y}, \boldsymbol{Z}, \boldsymbol{E}$ 分别为输人、输出、反馈、偏差向量； $\boldsymbol{G}, \boldsymbol{H}$ 分别为前向通路和反馈通路的传递矩阵。由图可知

$$
\begin{equation*}
\boldsymbol{Z}(s)=\boldsymbol{H}(s) \boldsymbol{Y}(s)=\boldsymbol{H}(s) \boldsymbol{G}(s) \boldsymbol{E}(s) \tag{9-50}
\end{equation*}
$$

![](assets/fig-09-14.png)

> Image description: This figure illustrates a multi-input-multi-output (MIMO) feedback control system. Input U(s) enters a summing junction, where it combines with feedback signal Z(s) to produce error E(s). E(s) drives the plant G(s), generating output Y(s). A separate feedback path from Y(s) passes through H(s) to form Z(s), which returns to the summing junction. Arrows indicate signal flow: U(s) → E(s) → G(s) → Y(s), and Y(s) → H(s) → Z(s) → summing junction. The diagram shows interconnection of blocks and feedback loops, typical in control theory. Variables U(s), E(s), Y(s), Z(s) denote inputs, errors, outputs, and feedback signals. The structure enables analysis of system dynamics and stability in MIMO contexts.
图9－14 多输人－多输出系统结构图

定义偏差向量至反馈向量之间的传递矩阵 $H(s) G(s)$ 为开环传递矩阵，它描述了 $E(s)$至 $\boldsymbol{Z}(s)$ 之间的传递关系。开环传递矩阵等于向量传递过程中所有部件传递矩阵的乘积，其相乘顺序与传递过程相反，而且由于是矩阵相乘，顺序不能任意交换。

由于

$$
\boldsymbol{Y}(s)=\boldsymbol{G}(s) \boldsymbol{E}(s)=\boldsymbol{G}(s)[\boldsymbol{U}(s)-\boldsymbol{Z}(s)]=\boldsymbol{G}(s)[\boldsymbol{U}(s)-\boldsymbol{H}(s) \boldsymbol{Y}(s)]
$$

则

$$
\begin{equation*}
\boldsymbol{Y}(s)=[\boldsymbol{I}+\boldsymbol{G}(s) \boldsymbol{H}(s)]^{-1} \boldsymbol{G}(s) \boldsymbol{U}(s) \tag{9-51}
\end{equation*}
$$

定义输入向量至输出向量之间的传递矩阵为闭环传递矩阵，记为 $\Phi(s)$ ，则

$$
\begin{equation*}
\boldsymbol{\Phi}(s)=[\boldsymbol{I}+\boldsymbol{G}(s) \boldsymbol{H}(s)]^{-1} \boldsymbol{G}(s) \tag{9-52}
\end{equation*}
$$

它描述了 $U(s)$ 至 $\boldsymbol{Y}(s)$ 之间的传递关系。
由于

$$
\boldsymbol{E}(s)=\boldsymbol{U}(s)-\boldsymbol{Z}(s)=\boldsymbol{U}(s)-\boldsymbol{H}(s) \boldsymbol{G}(s) \boldsymbol{E}(s)
$$

则

$$
\begin{equation*}
\boldsymbol{E}(s)=[\boldsymbol{I}+\boldsymbol{H}(s) \boldsymbol{G}(s)]^{-1} \boldsymbol{U}(s) \tag{9-53}
\end{equation*}
$$

定义输入向量至偏差向量之间的传递矩阵为偏差传递矩阵，记为 $\Phi_{e}(s)$ ，则

$$
\begin{equation*}
\boldsymbol{\Phi}_{e}(s)=[\boldsymbol{I}+\boldsymbol{H}(s) \boldsymbol{G}(s)]^{-1} \tag{9-54}
\end{equation*}
$$

它描述了 $U(s)$ 至 $\boldsymbol{E}(s)$ 之间的传递关系。
（3）解耦系统的传递矩阵
将式（9－49）写成标量方程组

$$
\begin{align*}
& Y_{1}(s)=G_{11}(s) U_{1}(s)+G_{12}(s) U_{2}(s)+\cdots+G_{1 p}(s) U_{p}(s) \\
& Y_{2}(s)=G_{21}(s) U_{1}(s)+G_{22}(s) U_{2}(s)+\cdots+G_{2 p}(s) U_{p}(s)  \tag{9-55}\\
& \vdots \\
& Y_{q}(s)=G_{q 1}(s) U_{1}(s)+G_{q 2}(s) U_{2}(s)+\cdots+G_{q p}(s) U_{p}(s)
\end{align*}
$$

可见，一般多输人－多输出系统的传递矩阵不是对角阵，每一个输人量将影响所有输出量，而每一个输出量也都会受到所有输人量的影响。这种系统称为耦合系统，其控制方式称为耦合控制。

对一个耦合系统进行控制是复杂的，工程中常希望实现某一输出量仅受某一输入量的控制，这种控制方式称为解耦控制，其相应的系统称为解耦系统。解耦系统的输入向量和输出向量必有相同的维数，传递矩阵必为对角阵，即

$$
\left[\begin{array}{c}
Y_{1}(s)  \tag{9-56}\\
Y_{2}(s) \\
\vdots \\
Y_{m}(s)
\end{array}\right]=\left[\begin{array}{cccc}
G_{11}(s) & & & 0 \\
& G_{22}(s) & & \\
& & \ddots & \\
0 & & & G_{m m}(s)
\end{array}\right]\left[\begin{array}{c}
U_{1}(s) \\
U_{2}(s) \\
\vdots \\
U_{m}(s)
\end{array}\right]
$$



<!-- source_pdf_page: 476 -->
可以看出，解耦系统是由 $m$ 个独立的单输入－单输出系统

$$
\begin{equation*}
Y_{i}(s)=G_{i i}(s) U_{i}(s), \quad i=1,2, \cdots, m \tag{9-57}
\end{equation*}
$$

组成。为了控制每个输出量，$G_{i i}(s)$ 不得为零，即解耦系统的对角化传递矩阵必须是非奇异的。在系统中引人适当的校正环节使传递矩阵对角化，称为解耦。系统的解耦问题是一个相当复杂的问题，研究解耦问题的人很多，解耦的方法也很多。下面介绍适用于线性定常连续系统的两种简单解耦方法。

1）用串联补偿器 $\boldsymbol{G}_{c}(s)$ 实现解耦。系统结构图如图 9－15 所示。未引入 $\boldsymbol{G}_{c}(s)$ 时，原系统为耦合系统，引人 $\boldsymbol{G}_{c}(s)$ 后的闭环传递矩阵为

$$
\begin{equation*}
\boldsymbol{\Phi}(s)=\left[\boldsymbol{I}+\boldsymbol{G}_{0}(s) \boldsymbol{G}_{c}(s) \boldsymbol{H}(s)\right]^{-1} \boldsymbol{G}_{0}(s) \boldsymbol{G}_{c}(s) \tag{9-58}
\end{equation*}
$$

以 $\left[\boldsymbol{I}+\boldsymbol{G}_{0}(s) G_{c}(\boldsymbol{s}) \boldsymbol{H}(s)\right]$ 左乘式（9－58）两端，经整理有

$$
\begin{equation*}
\boldsymbol{G}_{0}(s) \boldsymbol{G}_{c}(s)=\boldsymbol{\Phi}(s)[\boldsymbol{I}-\boldsymbol{H}(s) \boldsymbol{\Phi}(s)]^{-1} \tag{9-59}
\end{equation*}
$$

式中， $\boldsymbol{\Phi}(s)$ 为所希望的对角阵，阵中各元素与性能指标要求有关。由式（9－59）可见，在 $\boldsymbol{H}(s)$为对角阵的条件下，$[\boldsymbol{I}-\boldsymbol{H}(s) \boldsymbol{\Phi}(s)]^{-1}$ 仍为对角阵，故 $\boldsymbol{G}_{0}(s) \boldsymbol{G}_{c}(s)$ 应为对角阵，且有

$$
\begin{equation*}
\boldsymbol{G}_{c}(s)=\boldsymbol{G}_{0}^{-1}(s) \boldsymbol{\Phi}(s)[\boldsymbol{I}-\boldsymbol{H}(s) \boldsymbol{\Phi}(s)]^{-1} \tag{9-60}
\end{equation*}
$$

按式（9－60）设计串联补偿器可使系统解耦。
2）用前馈补偿器 $\boldsymbol{G}_{d}(s)$ 实现解耦。系统结构如图9－16所示， $\boldsymbol{G}_{d}(s)$ 的作用是对输入进行适当变换以实现解耦。未引入 $\boldsymbol{G}_{d}(s)$ 时原系统的闭环传递矩阵为

![](assets/fig-09-15.png)

> Image description: This figure illustrates a feedback control system with a feedforward compensator. Input U(s) enters a summing junction, where it is compared with feedback signal Z(s). The error E(s) drives the controller Gc(s), then the plant G0(s), producing output Y(s). A separate feedback path from Y(s) through H(s) returns to the summing junction, forming a closed loop. The feedforward compensator Gd(s) is not visually present in the diagram but is referenced in the caption as the component intended to decouple the system. Arrows indicate signal flow: U(s) → E(s) → Gc(s) → G0(s) → Y(s), while Y(s) → H(s) → Z(s) → summing junction. The system’s goal is to achieve decoupling via Gd(s), though its implementation is not shown in the current schematic.
图9－15

![](assets/fig-09-16.png)

> Image description: Figure 9-15 depicts a feedback control system with labeled blocks and signals. Input U(s) enters a forward path through G_d(s), producing U'(s). This signal subtracts from feedback signal Y(s) via G_0(s), forming error E(s). The error E(s) drives G_0(s), generating output Y(s). A feedback loop returns Y(s) to the summing junction, adjusting the error. Arrows indicate signal flow: U(s) → G_d(s) → U'(s) → summing junction → E(s) → G_0(s) → Y(s). The system’s engineering purpose is to regulate output by minimizing error through proportional feedback. All blocks and variables are clearly labeled, with no axes or numerical scales shown. The diagram illustrates classical negative feedback control structure.
图9－16 用前馈补倊器实现解耦的系统结构图

$$
\begin{equation*}
\Phi^{\prime}(s)=\left[\boldsymbol{I}+\boldsymbol{G}_{0}(s)\right]^{-1} \boldsymbol{G}_{0}(s) \tag{9-61}
\end{equation*}
$$

引入 $\boldsymbol{G}_{d}(s)$ 后解耦系统的闭环传递矩阵为

$$
\begin{equation*}
\boldsymbol{\Phi}(s)=\boldsymbol{\Phi}^{\prime}(s) \boldsymbol{G}_{d}(s)=\left[\boldsymbol{I}+\boldsymbol{G}_{0}(s)\right]^{-1} \boldsymbol{G}_{0}(s) \boldsymbol{G}_{d}(s) \tag{9-62}
\end{equation*}
$$

式中，$\Phi(s)$ 为所希望的对角阵。由式（9－62）可得

$$
\begin{equation*}
\boldsymbol{G}_{d}(s)=\boldsymbol{G}_{0}^{-1}(s)\left[\boldsymbol{I}+\boldsymbol{G}_{0}(s)\right] \boldsymbol{\Phi}(s) \tag{9-63}
\end{equation*}
$$

按式（9－63）设计前馈补偿器可使系统解耦。

![](assets/fig-09-17.png)

> Image description: This figure illustrates a two-input, two-output feedback control system. Input signals u₁ and u₂ drive separate error generators e₁ and e₂. e₁ feeds into a block with transfer function 1/(2s+1), producing output y₁. e₂ feeds into a block with transfer function 1/(s+1), producing output y₂. A summing junction combines y₁ and y₂, with y₁ scaled by a gain of 1, and the combined signal feeds back to subtract from u₁ and u₂ respectively. The system uses negative feedback for both channels, with y₁ also influencing the input to the second channel. Arrows indicate signal flow, and all blocks are interconnected to form a closed-loop system. The diagram is labeled as Figure 9-17.
图9－17

例 9－7 已知双输入－双输出单位反馈系统结构图如图9－17所示。试列写原系统的开、闭环传递矩阵，并求串联补偿器和前馈补偿器，使解耦系统的闭环传递矩阵为

$$
\Phi(s)=\left[\begin{array}{cc}
\frac{1}{s+1} & 0 \\
0 & \frac{1}{5 s+1}
\end{array}\right]
$$

并画出解耦系统的结构图。



<!-- source_pdf_page: 477 -->
解 求原系统开环传递矩阵 $\boldsymbol{G}_{0}(s)$ ，只需写出输出量 $\left(y_{1}, y_{2}\right)$ 与误差量 $\left(e_{1}, e_{2}\right)$ 各分量之间的关系，即

$$
\begin{aligned}
& Y_{1}(s)=\frac{1}{2 s+1} E_{1}(s) \\
& Y_{2}(s)=E_{1}(s)+\frac{1}{s+1} E_{2}(s)
\end{aligned}
$$

其向量－矩阵形式为

$$
\boldsymbol{Y}(s)=\left[\begin{array}{l}
Y_{1}(s) \\
Y_{2}(s)
\end{array}\right]=\left[\begin{array}{cc}
\frac{1}{2 s+1} & 0 \\
1 & \frac{1}{s+1}
\end{array}\right]\left[\begin{array}{l}
E_{1}(s) \\
E_{2}(s)
\end{array}\right]=\boldsymbol{G}_{0}(s) \boldsymbol{E}(s)
$$

原系统开环传递矩阵为

$$
\boldsymbol{G}_{0}(s)=\left[\begin{array}{cc}
\frac{1}{2 s+1} & 0 \\
1 & \frac{1}{s+1}
\end{array}\right]
$$

输出量 $\left(y_{1}, y_{2}\right)$ 与输人量 $\left(u_{1}, u_{2}\right)$ 各分量之间的关系为

$$
\begin{aligned}
Y_{1}(s) & =\frac{1 /(2 s+1)}{1+1 /(2 s+1)} U_{1}(s)=\frac{1}{2(s+1)} U_{1}(s) \\
Y_{2}(s) & =\frac{1 /(s+1)}{1+1 /(s+1)} U_{2}(s)+\frac{1}{1+1 /(s+1)} \cdot \frac{1}{1+1 /(2 s+1)} U_{1}(s) \\
& =\frac{1}{s+2} U_{2}(s)+\frac{2 s+1}{2(s+2)} U_{1}(s)
\end{aligned}
$$

其向量－矩阵形式为

$$
Y(s)=\left[\begin{array}{c}
Y_{1}(s) \\
Y_{2}(s)
\end{array}\right]=\left[\begin{array}{cc}
\frac{1}{2(s+1)} & 0 \\
\frac{2 s+1}{2(s+2)} & \frac{1}{s+2}
\end{array}\right]\left[\begin{array}{c}
U_{1}(s) \\
U_{2}(s)
\end{array}\right]=\boldsymbol{\Phi}^{\prime}(s) \boldsymbol{U}(s)
$$

原系统闭环传递矩阵为

$$
\boldsymbol{\Phi}^{\prime}(s)=\left[\begin{array}{cc}
\frac{1}{2(s+1)} & 0 \\
\frac{2 s+1}{2(s+2)} & \frac{1}{s+2}
\end{array}\right]
$$

串联补偿器 $\boldsymbol{G}_{c}(s)$ 的设计：由式（9－60）并考虑 $\boldsymbol{H}(s)=\boldsymbol{I}$ ，有

$$
\boldsymbol{G}_{c}(s)=\boldsymbol{G}_{0}^{-1}(s) \boldsymbol{\Phi}(s)[\boldsymbol{I}-\boldsymbol{\Phi}(s)]^{-1}=\left[\begin{array}{cc}
\frac{1}{2 s+1} & 0 \\
1 & \frac{1}{s+1}
\end{array}\right]^{-1}\left[\begin{array}{cc}
\frac{1}{s+1} & 0 \\
0 & \frac{1}{5 s+1}
\end{array}\right]\left[\begin{array}{cc}
\frac{s}{s+1} & 0 \\
0 & \frac{5 s}{5 s+1}
\end{array}\right]^{-1}
$$



<!-- source_pdf_page: 478 -->
$$
\begin{aligned}
& =\left[\begin{array}{cc}
2 s+1 & 0 \\
-(2 s+1)(s+1) & s+1
\end{array}\right]\left[\begin{array}{cc}
\frac{1}{s+1} & 0 \\
0 & \frac{1}{5 s+1}
\end{array}\right]\left[\begin{array}{cc}
\frac{s+1}{s} & 0 \\
0 & \frac{5 s+1}{5 s}
\end{array}\right] \\
& =\left[\begin{array}{cc}
\frac{2 s+1}{s} & 0 \\
-\frac{(2 s+1)(s+1)}{s} & \frac{s+1}{5 s}
\end{array}\right]=\left[\begin{array}{cc}
G_{c 11}(s) & G_{c 12}(s) \\
G_{c 21}(s) & G_{c 22}(s)
\end{array}\right]
\end{aligned}
$$

式中，$G_{c i j}(s)$ 表示 $U_{j}(s)$ 至 $Y_{i}(s)(i, j=1,2)$ 通道的串联补偿器传递函数。可以验证这种解耦系统的开环传递矩阵 $\boldsymbol{G}_{0}(s) \boldsymbol{G}_{c}(s)$ 为对角阵：

$$
\boldsymbol{G}_{0}(s) \boldsymbol{G}_{c}(s)=\left[\begin{array}{cc}
\frac{1}{2 s+1} & 0 \\
1 & \frac{1}{s+1}
\end{array}\right]\left[\begin{array}{cc}
\frac{2 s+1}{s} & 0 \\
-\frac{(2 s+1)(s+1)}{s} & \frac{s+1}{5 s}
\end{array}\right]=\left[\begin{array}{cc}
\frac{1}{s} & 0 \\
0 & \frac{1}{5 s}
\end{array}\right]
$$

用串联补偿器实现解耦的系统结构图如图9－18所示。

![](assets/fig-09-18.png)

> Image description: This figure illustrates a decoupled system using series compensators, labeled as Figure 9-18. Two inputs, u₁ and u₂, drive two subsystems. Each subsystem has an error signal (e₁, e₂) generated by summing inputs with feedback. The system employs cross-coupling compensators Gc₁₁(s), Gc₂₁(s), Gc₁₂(s), and Gc₂₂(s) to manage interactions. Output y₁ passes through a 1/(2s+1) block, while y₂ goes through 1/(s+1). Feedback paths from y₁ and y₂ are summed with respective inputs to generate error signals. The diagram shows interconnections via summing junctions and transfer functions, aiming to isolate system dynamics for independent control. Arrows indicate signal flow, and blocks represent dynamic components. This structure enables decoupling in multivariable control systems.
图9－18 例9－7用串联补偿器实现解耦的系统结构图

前馈补偿器 $G_{d}(s)$ 设计：由式（9－62），有

$$
\begin{aligned}
\boldsymbol{G}_{d}(s) & =\boldsymbol{\Phi}^{\prime-1}(s) \boldsymbol{\Phi}(s)=\left[\begin{array}{cc}
\frac{1}{2(s+1)} & 0 \\
\frac{2 s+1}{2(s+2)} & \frac{1}{s+2}
\end{array}\right]^{-1}\left[\begin{array}{cc}
\frac{1}{s+1} & 0 \\
0 & \frac{1}{5 s+1}
\end{array}\right] \\
& =\left[\begin{array}{cc}
2(s+1) & 0 \\
-(2 s+1)(s+1) & s+2
\end{array}\right]\left[\begin{array}{cc}
\frac{1}{s+1} & 0 \\
0 & \frac{1}{5 s+1}
\end{array}\right] \\
& =\left[\begin{array}{cc}
2 & 0 \\
-(2 s+1) & \frac{s+2}{5 s+1}
\end{array}\right]=\left[\begin{array}{cc}
G_{d 11}(s) & G_{d 12}(s) \\
G_{d 21}(s) & G_{d 22}(s)
\end{array}\right]
\end{aligned}
$$

式中，$G_{d i j}(s)$ 表示 $U_{j}(s)$ 至 $U_{i}^{\prime}(s)(i, j=1,2)$ 通道的串联补偿器传递函数。
用前馈补偿器实现解耦的系统结构图见图 9－19。



<!-- source_pdf_page: 479 -->
6．线性离散系统状态空间表达式的建立及其解
离散系统的特点是系统中的各个变量被处理成为只在离散时刻取值，其状态空间描述只反映离散时刻的变量组间的因果关系和转换关系，因而这类系统通常称为离散时间系统，简称为离散系统。离散时间系统可以是一类实际的离散时间问题的数学模型，如社会经济问题、生态问题等，也可以是一个连续系统因为采用数字计算机进行计算或控制的需要而人为地加以时间离散化而导出的模型。线性离散系统的动态方程可以利用系统的差分方程建立，也可以利用

![](assets/fig-09-19.png)

> Image description: This figure illustrates a MIMO (multi-input, multi-output) control system with feedforward compensation. Inputs u₁ and u₂ drive blocks G_d11, G_d21, G_d12, and G_d22, forming a decentralized controller. Outputs u’₁ and u’₂ are summed and fed into two parallel channels. Channel 1 has transfer function 1/(2s+1), producing y₁; channel 2 has 1/(s+1), producing y₂. Feedback loops adjust errors e₁ and e₂, with y₁ and y₂ contributing to error calculations. The diagram shows interconnections, summation points, and feedback paths, typical in control system design for achieving desired responses. Variables u₁, u₂, y₁, y₂, e₁, e₂, and transfer functions are clearly labeled.
图9－19 例9－7用前馈补偿器实现解粴的系统结构图

线性连续动态方程的离散化得到。
（1）由差分方程建立动态方程
在经典控制理论中离散系统通常用差分方程或脉冲传递函数来描述。单输入－单输出线性定常离散系统差分方程的一般形式为

$$
\begin{align*}
& y(k+n)+a_{n-1} y(k+n-1)+\cdots+a_{1} y(k+1)+a_{0} y(k)  \tag{9-64}\\
= & b_{n} u(k+n)+b_{n-1} u(k+n-1)+\cdots+b_{1} u(k+1)+b_{0} u(k)
\end{align*}
$$

式中，$k$ 表示 $k T$ 时刻；$T$ 为采样周期；$y(k), u(k)$ 分别为 $k T$ 时刻的输出量和输人量；$a_{i}$ ，$b_{i}\left(i=0,1,2, \cdots, n\right.$ ，且 $\left.a_{n}=1\right)$ 为表征系统特性的常系数。考虑初始条件为零时的 $z$ 变换关系有

$$
[y(k)]=Y(z), \quad X[y(k+i)]=z^{i} Y(z)
$$

对式（9－64）两端取 $z$ 变换并加以整理可得

$$
\begin{align*}
G(z) & =\frac{Y(z)}{U(z)}=\frac{b_{n} z^{n}+b_{n-1} z^{n-1}+\cdots+b_{1} z+b_{0}}{z^{n}+a_{n-1} z^{n-1}+\cdots+a_{1} z+a_{0}}  \tag{9-65}\\
& =b_{n}+\frac{\beta_{n-1} z^{n-1}+\cdots+\beta_{1} z+\beta_{0}}{z^{n}+a_{n-1} z^{n-1}+\cdots+a_{1} z+a_{0}}=b_{n}+\frac{N(z)}{D(z)}
\end{align*}
$$

$G(z)$ 称为脉冲传递函数，式（9－65）与式（9－15）在形式上相同，故连续系统动态方程的建立方法可用于离散系统。例如，在 $N(z) / D(z)$ 的串联分解中，引人中间变量 $Q(z)$ 则有

$$
\begin{aligned}
& z^{n} Q(z)+a_{n-1} z^{n-1} Q(z)+\cdots+a_{1} z Q(z)+a_{0} Q(z)=U(z) \\
& Y(z)=\beta_{n-1} z^{n-1} Q(z)+\cdots+\beta_{1} z Q(z)+\beta_{0} Q(z)
\end{aligned}
$$

设

$$
\begin{aligned}
& X_{1}(z)=Q(z) \\
& X_{2}(z)=z Q(z)=z X_{1}(z) \\
& \vdots \\
& X_{n}(z)=z^{n-1} Q(z)=z X_{n-1}(z)
\end{aligned}
$$

则

$$
\begin{gathered}
z^{n} Q(z)=-a_{0} X_{1}(z)-a_{1} X_{2}(z)-\cdots-a_{n-1} X_{n}(z)+U(z) \\
Y(z)=\beta_{0} X_{1}(z)+\beta_{1} X_{2}(z)+\cdots+\beta_{n-1} X_{n}(z)
\end{gathered}
$$



<!-- source_pdf_page: 480 -->
利用 $z$ 反变换关系

$$
\begin{gathered}
x^{-1}\left[X_{i}(z)\right]=x_{i}(k) \\
x^{-1}\left[z X_{i}(z)\right]=x_{i}(k+1)
\end{gathered}
$$

可得动态方程为

$$
\begin{aligned}
& x_{1}(k+1)=x_{2}(k) \\
& x_{2}(k+1)=x_{3}(k) \\
& \vdots \\
& x_{n-1}(k+1)=x_{n}(k) \\
& x_{n}(k+1)=-a_{0} x_{1}(k)-a_{1} x_{2}(k)-\cdots-a_{n-1} x_{n}(k)+u(k) \\
& y(k)=\beta_{0} x_{1}(k)+\beta_{1} x_{2}(k)+\cdots+\beta_{n-1} x_{n}(k)
\end{aligned}
$$

向量－矩阵形式为

$$
\begin{gather*}
{\left[\begin{array}{c}
x_{1}(k+1) \\
x_{2}(k+1) \\
\vdots \\
x_{n-1}(k+1) \\
x_{n}(k+1)
\end{array}\right]=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right]\left[\begin{array}{c}
x_{1}(k) \\
x_{2}(k) \\
\vdots \\
x_{n-1}(k) \\
x_{n}(k)
\end{array}\right]+\left[\begin{array}{c}
0 \\
0 \\
\vdots \\
0 \\
1
\end{array}\right] u(k)}  \tag{9-66a}\\
y(k)=\left[\begin{array}{llll}
\beta_{0} & \beta_{1} & \cdots & \beta_{n-1}
\end{array}\right] x(k)+b_{n} u(k) \tag{9-66b}
\end{gather*}
$$

简记为

$$
\begin{gather*}
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{h} u(k)  \tag{9-67a}\\
\boldsymbol{y}(k)=\boldsymbol{c} \boldsymbol{x}(k)+d u(k) \tag{9-67b}
\end{gather*}
$$

式中， $\boldsymbol{G}$ 为友矩阵； $\boldsymbol{G}, \boldsymbol{h}$ 为可控标准型。可以看出，离散系统状态方程描述了 $(k+1) T$ 时刻的状态与 $k T$ 时刻的状态及输入量之间的关系，其输出方程描述了 $k T$ 时刻的输出量与$k T$ 时刻的状态及输人量之间的关系。

线性定常多输人－多输出离散系统的动态方程为

$$
\begin{gather*}
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{H} \boldsymbol{u}(k)  \tag{9-68a}\\
\boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{x}(k)+\boldsymbol{D} \boldsymbol{u}(k) \tag{9-68b}
\end{gather*}
$$

系统结构图如图9－3所示，图中 $z^{-1}$ 为单位延迟器，其输入为 $(k+1) T$ 时刻的状态，输出为延迟一个采样周期的 $k T$ 时刻的状态。
（2）定常连续动态方程的离散化
已知定常连续系统状态方程 $\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}+\boldsymbol{B} \boldsymbol{u}$ 在 $\boldsymbol{x}\left(t_{0}\right)$ 及 $\boldsymbol{u}(t)$ 作用下的解为

$$
\boldsymbol{x}(t)=\boldsymbol{\Phi}\left(t-t_{0}\right) x\left(t_{0}\right)+\int_{t_{0}}^{T} \boldsymbol{\Phi}(t-\tau) \boldsymbol{B} \boldsymbol{u}(\tau) \mathrm{d} \tau
$$

令 $t_{0}=k T$ ，则 $\boldsymbol{x}\left(t_{0}\right)=\boldsymbol{x}(k T)=\boldsymbol{x}(k)$ ；令 $t=(k+1) T$ ，则 $\boldsymbol{x}(t)=\boldsymbol{x}[(k+1) T]=\boldsymbol{x}(k+1)$ ；在 $t \in[k, k+1)$区间内， $\boldsymbol{u}(t)=\boldsymbol{u}(k)=$ 常数，于是其解化为

$$
\boldsymbol{x}(k+1)=\boldsymbol{\Phi}[(k+1) T-k T] \boldsymbol{x}(k)+\int_{k T}^{(k+1) T} \boldsymbol{\Phi}[(k+1) T-\tau] \boldsymbol{B} \mathrm{d} \tau \cdot \boldsymbol{u}(k)
$$

记

$$
\boldsymbol{G}(T)=\int_{k T}^{(k+1) T} \boldsymbol{\Phi}[(k+1) T-\tau] \boldsymbol{B} \mathrm{d} \tau
$$



<!-- source_pdf_page: 481 -->
为了便于计算 $\boldsymbol{G}(T)$ ，引人变量置换，令 $(k+1) T-\tau=\tau^{\prime}$ ，则

$$
\begin{equation*}
\boldsymbol{G}(T)=\int_{0}^{T} \boldsymbol{\Phi}\left(\tau^{\prime}\right) \boldsymbol{B} \mathrm{d} \tau^{\prime} \tag{9-69}
\end{equation*}
$$

故离散化状态方程为

$$
\begin{equation*}
\boldsymbol{x}(k+1)=\boldsymbol{\Phi}(T) \boldsymbol{x}(k)+\boldsymbol{G}(T) \boldsymbol{u}(k) \tag{9-70}
\end{equation*}
$$

式中，$\Phi(T)$ 与连续系统状态转移矩阵 $\Phi(t)$ 的关系为

$$
\begin{equation*}
\Phi(T)=\left.\Phi(t)\right|_{t=T} \tag{9-71}
\end{equation*}
$$

离散化系统的输出方程仍为

$$
\boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{x}(k)+\boldsymbol{D} \boldsymbol{u}(k)
$$

（3）定常离散动态方程的解
求解离散动态方程的方法有递推法和 $z$ 变换法，这里只介绍常用的递推法，令式（9－70）中的 $k=0,1, \cdots, k-1$ ，可得到 $T, 2 T, \cdots, k T$ 时刻的状态，即

$$
\begin{array}{ll}
k=0: & \boldsymbol{x}(1)=\boldsymbol{\Phi}(T) \boldsymbol{x}(0)+\boldsymbol{G}(T) \boldsymbol{u}(0) \\
k=1: & \boldsymbol{x}(2)=\boldsymbol{\Phi}(T) \boldsymbol{x}(1)+\boldsymbol{G}(T) \boldsymbol{u}(1) \\
= & \boldsymbol{\Phi} \boldsymbol{\Phi}^{2}(T) \boldsymbol{x}(0)+\boldsymbol{\Phi}(T) \boldsymbol{G}(T) \boldsymbol{u}(0)+\boldsymbol{G}(T) \boldsymbol{u}(1) \\
k=2: & \boldsymbol{x}(3)=\boldsymbol{\Phi}(T) \boldsymbol{x}(2)+\boldsymbol{G}(T) \boldsymbol{u}(2) \\
= & \boldsymbol{\Phi}^{3}(T) \boldsymbol{x}(0)+\boldsymbol{\Phi}^{2}(T) \boldsymbol{G}(T) \boldsymbol{u}(0)+\boldsymbol{\Phi}(T) \boldsymbol{G}(T) \boldsymbol{u}(1)+\boldsymbol{G}(T) \boldsymbol{u}(2) \\
k=k-1: & \boldsymbol{x}(k)=\boldsymbol{\Phi}(T) \boldsymbol{x}(k-1)+\boldsymbol{G}(T) \boldsymbol{u}(k-1) \\
= & \boldsymbol{\Phi}^{k}(T) \boldsymbol{x}(0)+\boldsymbol{\Phi}^{k-1}(T) \boldsymbol{G}(T) \boldsymbol{u}(0)+\boldsymbol{\Phi}^{k-2}(T) \boldsymbol{G}(T) \boldsymbol{u}(1) \\
& +\cdots+\boldsymbol{\Phi}(T) \boldsymbol{G}(T) \boldsymbol{u}(k-2)+\boldsymbol{G}(T) \boldsymbol{u}(k-1) \\
= & \Phi^{k}(T) \boldsymbol{x}(0)+\sum_{i=0}^{k-1} \boldsymbol{\Phi}^{k-1-i}(T) \boldsymbol{G}(T) \boldsymbol{u}(i) \tag{9-72}
\end{array}
$$

式（9－72）为离散化状态方程的解，又称离散化状态转移方程。当 $u(i)=0(i=0,1, \cdots, k-1)$时，有

$$
\boldsymbol{x}(k)=\boldsymbol{\Phi}^{k}(T) \boldsymbol{x}(0)=\boldsymbol{\Phi}(k T) \boldsymbol{x}(0)=\boldsymbol{\Phi}(k) \boldsymbol{x}(0)
$$

$\Phi(k)$ 称为离散化系统动态转移矩阵。
输出方程为

$$
\begin{equation*}
\boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{x}(k)+\boldsymbol{D} \boldsymbol{u}(k)=\boldsymbol{C} \boldsymbol{\Phi}^{k}(T) \boldsymbol{x}(0)+\boldsymbol{C} \sum_{i=0}^{k-1} \boldsymbol{\Phi}^{k-1-i}(T) \boldsymbol{G}(T) \boldsymbol{u}(i)+\boldsymbol{D} \boldsymbol{u}(k) \tag{9-73}
\end{equation*}
$$

对于离散动态方程式（9－68），采用递推法可得其解为

$$
\begin{gather*}
\boldsymbol{x}(k)=\boldsymbol{G}^{k} \boldsymbol{x}(0)+\sum_{i=0}^{k-1} \boldsymbol{G}^{k-1-i} \boldsymbol{H} \boldsymbol{u}(i)  \tag{9-74}\\
\boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{G}^{k} \boldsymbol{x}(0)+\boldsymbol{C} \sum_{i=0}^{k-1} \boldsymbol{G}^{k-1-i} \boldsymbol{H} \boldsymbol{u}(i)+\boldsymbol{D} \boldsymbol{u}(k) \tag{9-75}
\end{gather*}
$$

式中， $\boldsymbol{G}^{k}$ 表示 $k$ 个 $\boldsymbol{G}$ 自乘。
例 9－8 已知连续时间系统的状态方程为

$$
\dot{x}=\left[\begin{array}{cc}
0 & 1 \\
-2 & -3
\end{array}\right] x+\left[\begin{array}{l}
0 \\
1
\end{array}\right] u
$$



<!-- source_pdf_page: 482 -->
设 $T=1$ ，试求相应的离散时间状态方程。
解
由例 9－4已知该连续系统的状态转移矩阵为

$$
\begin{gathered}
\boldsymbol{\Phi}(t)=\left[\begin{array}{cc}
2 \mathrm{e}^{-t}-\mathrm{e}^{-2 t} & \mathrm{e}^{-t}-\mathrm{e}^{-2 t} \\
-2 \mathrm{e}^{-t}+2 \mathrm{e}^{-2 t} & -\mathrm{e}^{-t}+2 \mathrm{e}^{-2 t}
\end{array}\right] \\
\boldsymbol{\Phi}(T)=\left.\boldsymbol{\Phi}(t)\right|_{t=T=1}=\left[\begin{array}{cc}
0.6004 & 0.2325 \\
-0.4651 & -0.0972
\end{array}\right] \\
\boldsymbol{G}(t)=\int_{0}^{T} \boldsymbol{\Phi}(\tau) \boldsymbol{B} \mathrm{d} \tau=\int_{0}^{T}\left[\begin{array}{c}
\mathrm{e}^{-\tau}-\mathrm{e}^{-2 \tau} \\
-\mathrm{e}^{-\tau}+2 \mathrm{e}^{-2 \tau}
\end{array}\right] \mathrm{d} \tau=\left[\begin{array}{c}
\frac{1}{2}-\mathrm{e}^{-T}+\frac{1}{2} \mathrm{e}^{-2 T} \\
\mathrm{e}^{-T}-\mathrm{e}^{-2 T}
\end{array}\right] \\
\left.\boldsymbol{G}(T)\right|_{T=1}=\left[\begin{array}{l}
0.1998 \\
0.2325
\end{array}\right]
\end{gathered}
$$

## 9－2 线性系统的可控性与可观测性

现代控制理论中用状态方程和输出方程描述系统，输入和输出构成系统的外部变量，而状态为系统的内部变量，这就存在着系统内的所有状态是否可受输人影响和是否可由输出反映的问题，这就是可控性和可观测性问题。如果系统所有状态变量的运动都可以由输人来影响和控制而由任意的初态达到原点，则称系统是完全可控的，或者更确切地说是状态完全可控的，简称为系统可控；否则，就称系统是不完全可控的，或简称为系统不可控。相应地，如果系统所有状态变量的任意形式的运动均可由输出完全反映，则称系统是状态完全可观测的，简称为系统可观测；反之，则称系统是不完全可观测的，或简称为系统不可观测。

可控性与可观测性概念，是卡尔曼于20世纪60年代首先提出来的，是用状态空间描述系统引申出来的新概念，在现代控制理论中起着重要作用。

例 9－9 给定系统的动态方程为

$$
\begin{gathered}
{\left[\begin{array}{c}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
4 & 0 \\
0 & -5
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{l}
1 \\
2
\end{array}\right] u} \\
y=\left[\begin{array}{ll}
0 & -6
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]
\end{gathered}
$$

将其表示为标量方程组的形式，有

$$
\begin{aligned}
& \dot{x}_{1}=4 x_{1}+u \\
& \dot{x}_{2}=-5 x_{2}+2 u \\
& y=-6 x_{2}
\end{aligned}
$$

这表明状态变量 $x_{1}$ 和 $x_{2}$ 都可通过选择控制量 $u$ 而由始点达到原点，因而系统完全可控。但是，输出 $y$ 只能反映状态变量 $x_{2}$ ，而与状态变量 $x_{1}$ 既无直接关系也无间接关系，所以系统是不完全可观测的。

应当指出，上述对可控性和可观测性所作的直观说明，只是对这两个概念的直觉的



<!-- source_pdf_page: 483 -->
但不严密的描述，而且也只能用来解释和判断非常直观和非常简单系统的可控性和可观测性。为了揭示可控性和可观测性的本质属性，并用于分析和判断更为一般和较为复杂的系统，需要对这两个概念建立严格的定义，并在此基础上导出相应的判别准则。尽管本章主要研究线性定常系统，但由于线性时变系统的可控性和可观测性定义更具有代表性，而线性定常系统只是线性时变系统的一种特殊类型，因而我们用线性时变系统给出可控性和可观测性的严格定义。在研究线性定常连续和离散系统时，再分别给出可控性及可观测性判据。

1．可控性
考虑线性时变系统的状态方程

$$
\begin{equation*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A}(t) \boldsymbol{x}(t)+\boldsymbol{B}(t) \boldsymbol{u}(t), \quad t \in T_{t} \tag{9-76}
\end{equation*}
$$

其中， $\boldsymbol{x}$ 为 $n$ 维状态向量；$u$ 为 $p$ 维输人向量；$T_{t}$ 为时间定义区间； $\boldsymbol{A}(t)$ 和 $\boldsymbol{B}(t)$ 分别为 $n$ $\times n$ 矩阵和 $n \times p$ 矩阵。现对状态可控、系统可控和不可控分别定义如下：

状态可控 对于式（9－76）所示线性时变系统，如果对取定初始时刻 $t_{0} \in T_{t}$ 的一个非零初始状态 $\boldsymbol{x}\left(t_{0}\right)=\boldsymbol{x}_{0}$ ，存在一个时刻 $t_{1} \in T_{t}, t_{1}>t_{0}$ ，和一个无约束的容许控制 $\boldsymbol{u}(t), t \in\left[t_{0}, t_{1}\right]$ ，使状态由 $\boldsymbol{x}\left(t_{0}\right)=\boldsymbol{x}_{0}$ 转移到 $t_{1}$ 时的 $\boldsymbol{x}\left(t_{1}\right)=\mathbf{0}$ ，则称此 $\boldsymbol{x}_{0}$ 是在 $t_{0}$ 时刻可控的。

系统可控 对于式（9－76）所示线性时变系统，如果状态空间中的所有非零状态都是在$t_{0}\left(t_{0} \in T_{t}\right)$ 时刻可控的，则称系统在时刻 $t_{0}$ 是完全可控或一致可控的，简称系统在时刻 $t_{0}$可控。

系统不完全可控 对于式（9－76）所示线性时变系统，取定初始时刻 $t_{0} \in T_{t}$ ，如果状态空间中存在一个或一些非零状态在时刻 $t_{0}$ 是不可控的，则称系统在时刻 $t_{0}$ 是不完全可控的，也称为系统是不可控的。

在上述定义中只要求系统在可找到的控制 $\boldsymbol{u}(t)$ 的作用下，使 $t_{0}$ 时刻的非零状态 $\boldsymbol{x}_{0}$ 在$T_{t}$ 上的一段有限时间内转移到状态空间的坐标原点，而对于状态转移的轨迹则未加任何限制和规定。所以，可控性是表征系统状态运动的一个定性特性。定义中对控制 $\boldsymbol{u}(t)$ 的每个分量的幅值并未加以限制，可为任意大的要求值。但 $\boldsymbol{u}(t)$ 必须是容许控制，即 $\boldsymbol{u}(t)$的每个分量 $u_{i}(t)(i=1,2, \cdots, p)$ 均在时间区间 $T_{t}$ 上平方可积，即

$$
\int_{t_{0}}^{T}\left|u_{i}(t)\right|^{2} \mathrm{~d} t<\infty ; \quad t_{0}, t \in T_{t}
$$

此外，对于线性时变系统，其可控性与初始时刻 $t_{0}$ 的选取有关，是相对于 $T_{t}$ 中的一个取定时刻 $t_{0}$ 来定义的。而对于线性定常系统，其可控性与初始时刻 $t_{0}$ 的选取无关。

状态与系统的可达 对于式（9－76）所示线性时变系统，若存在能将状态 $\boldsymbol{x}\left(t_{0}\right)=\mathbf{0}$ 转移到 $x\left(t_{f}\right)=x_{f}$ 的控制作用，则称状态 $x_{f}$ 是 $t_{0}$ 时刻可达的。若 $x_{f}$ 对所有时刻都是可达的，则称 $x_{f}$ 为完全可达或一致可达。若系统对于状态空间中的每一个状态都是时刻 $t_{0}$ 可达的，则称该系统是 $t_{0}$ 时刻状态完全可达的，或简称该系统是 $t_{0}$ 时刻可达的。

对于线性定常连续系统，可控性与可达性是等价的。但对于离散系统和时变系统，严格地说两者是不等价的。



<!-- source_pdf_page: 484 -->
2．可观测性
可观测性表征了状态可由输出完全反映的性能，所以应同时考虑系统的状态方程和输出方程

$$
\begin{gather*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A}(t) \boldsymbol{x}(t)+\boldsymbol{B}(t) \boldsymbol{u}(t), \quad t \in T_{t}  \tag{9-77a}\\
\boldsymbol{y}(t)=\boldsymbol{C}(t) \boldsymbol{x}(t)+\boldsymbol{D}(t) \boldsymbol{u}(t), \quad \boldsymbol{x}\left(t_{0}\right)=\boldsymbol{x}_{0} \tag{9-77b}
\end{gather*}
$$

其中， $\boldsymbol{A}(t) 、 \boldsymbol{B}(t) 、 \boldsymbol{C}(t)$ 和 $\boldsymbol{D}(t)$ 分别为 $(n \times n),(n \times p),(q \times n)$ 和 $(q \times p)$ 的满足状态方程解的存在唯一性条件的时变矩阵。式（9－77a）状态方程的解为

$$
\begin{equation*}
\boldsymbol{x}(t)=\boldsymbol{\Phi}\left(t, t_{0}\right) \boldsymbol{x}_{0}+\int_{t_{0}}^{T} \boldsymbol{\Phi}(t, \tau) \boldsymbol{B}(\tau) \boldsymbol{u}(\tau) \mathrm{d} \tau \tag{9-78}
\end{equation*}
$$

其中，$\Phi\left(t, t_{0}\right)$ 为系统的状态转移矩阵。将式（9－78）代人式（9－77b）输出方程，可得输出响应为

$$
\begin{equation*}
\boldsymbol{y}(t)=\boldsymbol{C}(t) \boldsymbol{\Phi}\left(t, t_{0}\right) \boldsymbol{x}_{0}+\boldsymbol{C}(t) \int_{t_{0}}^{T} \boldsymbol{\Phi}(t, \tau) \boldsymbol{B}(\tau) \boldsymbol{u}(\tau) \mathrm{d} \tau+\boldsymbol{D}(t) \boldsymbol{u}(t) \tag{9-79}
\end{equation*}
$$

在研究可观测性问题时，输出 $\boldsymbol{y}$ 和输人 $\boldsymbol{u}$ 均假定为已知，只有初始状态 $\boldsymbol{x}_{0}$ 是未知的。因此，若定义

$$
\overline{\boldsymbol{y}}(t) \triangleq \boldsymbol{y}(t)-\boldsymbol{C}(t) \int_{t_{0}}^{T} \boldsymbol{\Phi}(t, \tau) \boldsymbol{B}(\tau) \boldsymbol{u}(\tau) \mathrm{d} \tau-\boldsymbol{D}(t) \boldsymbol{u}(t)
$$

则式（9－79）可写为

$$
\begin{equation*}
\overline{\boldsymbol{y}}(t)=\boldsymbol{C}(t) \boldsymbol{\Phi}\left(t, t_{0}\right) \boldsymbol{x}_{0} \tag{9-80}
\end{equation*}
$$

这表明可观测性即是 $\boldsymbol{x}_{0}$ 可由 $\overline{\boldsymbol{y}}$ 完全估计的性能。由于 $\overline{\boldsymbol{y}}$ 和 $\boldsymbol{x}_{0}$ 可取任意值，所以这又等价于研究 $\boldsymbol{u}=\mathbf{0}$ 时由 $\boldsymbol{y}$ 来估计 $\boldsymbol{x}_{0}$ 的可能性，即研究零输人方程

$$
\begin{gather*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A}(t) \boldsymbol{x}(t), \quad \boldsymbol{x}\left(t_{0}\right)=\boldsymbol{x}_{0}, \quad t_{0}, t \in T_{t}  \tag{9-81a}\\
\boldsymbol{y}(t)=\boldsymbol{C}(t) \boldsymbol{x}(t) \tag{9-81b}
\end{gather*}
$$

的可观测性。式（9－79）成为

$$
\begin{equation*}
\boldsymbol{y}(t)=\boldsymbol{C}(t) \boldsymbol{\Phi}\left(t, t_{0}\right) \boldsymbol{x}_{0} \tag{9-82}
\end{equation*}
$$

下面基于式（9－81）给出系统可观测性的有关定义。
系统完全可观测 对于式（9－81）所示线性时变系统，如果取定初始时刻 $t_{0} \in T_{t}$ ，存在一个有限时刻 $t_{1} \in T_{t}, t_{1}>t_{0}$ ，对于所有 $t \in\left[t_{0}, t_{1}\right]$ ，系统的输出 $y(t)$ 能唯一确定状态向量的初值 $\boldsymbol{x}\left(t_{0}\right)$ ，则称系统在 $\left[t_{0}, t_{1}\right]$ 内是完全可观测的，简称系统可观测。如果对于一切 $t_{1}>t_{0}$系统都是可观测的，则称系统在 $\left[t_{0}, \infty\right)$ 内完全可观测。

系统不可观测 对于式（9－81）所示线性时变系统，如果取定初始时刻 $t_{0} \in T_{t}$ ，存在一个有限时刻 $t_{1} \in T_{t}, t_{1}>t_{0}$ ，对于所有 $t \in\left[t_{0}, t_{1}\right]$ ，系统的输出 $\boldsymbol{y}(t)$ 不能唯一确定所有状态的初值 $x_{i}\left(t_{0}\right), i=1,2, \cdots, n$ ，即至少有一个状态的初值不能被 $\boldsymbol{y}(t)$ 确定，则称系统在时间区间 $\left[t_{0}, t_{1}\right]$ 内是不完全可观测的，简称系统不可观测。

3．线性定常连续系统的可控性判据
考虑线性定常连续系统的状态方程

$$
\begin{equation*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{B} \boldsymbol{u}(t), \quad \boldsymbol{x}(0)=\boldsymbol{x}_{0}, \quad t \geqslant 0 \tag{9-83}
\end{equation*}
$$



<!-- source_pdf_page: 485 -->
其中， $\boldsymbol{x}$ 为 $n$ 维状态向量； $\boldsymbol{u}$ 为 $p$ 维输入向量； $\boldsymbol{A}$ 和 $\boldsymbol{B}$ 分别为 $n \times n$ 和 $n \times p$ 常值矩阵。下面根据 $\boldsymbol{A}$ 和 $\boldsymbol{B}$ 给出系统可控性的常用判据。

格拉姆矩阵判据 线性定常连续系统式（9－83）完全可控的充分必要条件是，存在时刻$t_{1}>0$ ，使如下定义的格拉姆矩阵：

$$
\begin{equation*}
\boldsymbol{W}\left(0, t_{1}\right) \triangleq \int_{0}^{t_{t}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B} \boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \mathrm{~d} t \tag{9-84}
\end{equation*}
$$

为非奇异。
证明 充分性：已知 $\boldsymbol{W}\left(0, t_{1}\right)$ 为非奇异，欲证系统完全可控。
已知 $\boldsymbol{W}$ 非奇异，故 $\boldsymbol{W}^{-1}$ 存在。对任一非零初始状态 $\boldsymbol{x}_{0}$ 可选取控制 $\boldsymbol{u}(t)$ 为

$$
\begin{equation*}
\boldsymbol{u}(t)=-\boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-A^{\mathrm{T}} t} \boldsymbol{W}^{-1}\left(0, t_{1}\right) \boldsymbol{x}_{0}, \quad t \in\left[t_{0}, t_{1}\right] \tag{9-85}
\end{equation*}
$$

则在 $\boldsymbol{u}(t)$ 作用下系统（9－83）在 $t_{1}$ 时刻的解为

$$
\begin{aligned}
\boldsymbol{x}\left(t_{1}\right) & =\mathrm{e}^{A t_{1}} \boldsymbol{x}_{0}+\int_{0}^{t_{1}} \mathrm{e}^{A\left(t_{1}-t\right)} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t \\
& =\mathrm{e}^{A t_{1}} \boldsymbol{x}_{0}-\mathrm{e}^{A t_{1}} \int_{0}^{t_{1}} \mathrm{e}^{-A t} \boldsymbol{B} \boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-A^{\mathrm{T}} t} \mathrm{~d} t \boldsymbol{W}^{-1}\left(0, t_{1}\right) \boldsymbol{x}_{0} \\
& =\mathrm{e}^{A t_{1}} \boldsymbol{x}_{0}-\mathrm{e}^{A t_{1}} \boldsymbol{W}\left(0, t_{1}\right) \boldsymbol{W}^{-1}\left(0, t_{1}\right) \boldsymbol{x}_{0}=\mathbf{0}, \quad \forall \boldsymbol{x}_{0} \in R^{n}
\end{aligned}
$$

这表明，对任一取定的初始状态 $\boldsymbol{x}_{0} \neq \mathbf{0}$ ，都存在有限时刻 $t_{1}>0$ 和控制 $\boldsymbol{u}(t)$ ，使状态由 $\boldsymbol{x}_{0}$ 转移到 $t_{1}$ 时刻的状态 $\boldsymbol{x}\left(t_{1}\right)=\mathbf{0}$ ，于是根据定义可知系统完全可控。充分性得证。

必要性：已知系统完全可控，欲证 $\boldsymbol{W}\left(0, t_{1}\right)$ 为非奇异。
采用反证法。设 $W\left(0, t_{1}\right)$ 为奇异，则存在某个非零向量 $\bar{x}_{0} \in R^{n}$ ，使

$$
\begin{equation*}
\boldsymbol{W}\left(0, t_{1}\right) \overline{\boldsymbol{x}}_{0}=\mathbf{0} \tag{9-86}
\end{equation*}
$$

成立，由此可导出

$$
\begin{align*}
\overline{\boldsymbol{x}}_{0}^{\mathrm{T}} \boldsymbol{W}\left(0, t_{1}\right) \overline{\boldsymbol{x}}_{0} & =\int_{0}^{t_{\mathrm{t}}} \overline{\boldsymbol{x}}_{0}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B} \boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \overline{\boldsymbol{x}}_{0} \mathrm{~d} t \\
& =\int_{0}^{t_{\mathrm{t}}}\left[\boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \overline{\boldsymbol{x}}_{0}\right]^{\mathrm{T}}\left[\boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \overline{\boldsymbol{x}}_{0}\right] \mathrm{d} t  \tag{9-87}\\
& =\int_{0}^{t_{\mathrm{t}}}\left\|\boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \overline{\boldsymbol{x}}_{0}\right\|^{2} \mathrm{~d} t=0
\end{align*}
$$

其中 $\|\cdot\|$ 为范数，故其必非负。于是，欲使式（9－87）成立，应当有

$$
\begin{equation*}
\boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-A^{T} t} \overline{\boldsymbol{x}}_{0}=\mathbf{0}, \quad \forall t \in\left[0, t_{1}\right] \tag{9-88}
\end{equation*}
$$

另一方面，因系统完全可控，根据定义，对此非零向量 $\bar{x}_{0}$ 应有

$$
\begin{equation*}
\boldsymbol{x}\left(t_{1}\right)=\mathrm{e}^{A t_{1}} \overline{\boldsymbol{x}}_{0}+\int_{0}^{t_{1}} \mathrm{e}^{A t_{1}} \mathrm{e}^{-A t} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t=\mathbf{0} \tag{9-89}
\end{equation*}
$$

由此又可导出

$$
\begin{gather*}
\overline{\boldsymbol{x}}_{0}=-\int_{0}^{t_{1}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t  \tag{9-90}\\
\left\|\overline{\boldsymbol{x}}_{0}\right\|^{2}=\overline{\boldsymbol{x}}_{0}^{\mathrm{T}} \overline{\boldsymbol{x}}_{0}=\left[-\int_{0}^{t_{1}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t\right]^{\mathrm{T}} \overline{\boldsymbol{x}}_{0}=-\int_{0}^{t_{1}} \boldsymbol{u}^{\mathrm{T}}(t) \boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \overline{\boldsymbol{x}}_{0} \mathrm{~d} t \tag{9-91}
\end{gather*}
$$

再利用式（9－88），由式（9－91）可以得到



<!-- source_pdf_page: 486 -->
$$
\begin{equation*}
\left\|\overline{\boldsymbol{x}}_{0}\right\|^{2}=0, \quad \text { 即 } \quad \overline{\boldsymbol{x}}_{0}=\mathbf{0} \tag{9-92}
\end{equation*}
$$

显然，此结果与假设 $\overline{\boldsymbol{x}}_{0} \neq \mathbf{0}$ 相矛盾，即 $\boldsymbol{W}\left(0, t_{1}\right)$ 为奇异的反设不成立。因此，若系统完全可控， $\boldsymbol{W}\left(0, t_{1}\right)$ 必为非奇异。必要性得证。至此格拉姆矩阵判据证毕。

可以看出，在应用格拉姆矩阵判据时需计算矩阵指数 $\mathrm{e}^{A t}$ ，在 $\boldsymbol{A}$ 的维数 $n$ 较大时计算$\mathrm{e}^{A t}$ 是困难的。所以格拉姆矩阵判据主要用于理论分析。线性定常连续系统可控性的常用判据是直接由矩阵 $\boldsymbol{A}$ 和 $\boldsymbol{B}$ 判断可控性的秩判据。由于在推导秩判据时要用到凯莱－哈密顿定理，所以下面先介绍凯莱－哈密顿定理，然后再给出秩判据。

凯莱－哈密顿定理 设 $n$ 阶矩阵 $A$ 的特征多项式为

$$
\begin{align*}
f(\lambda) & =|\lambda \boldsymbol{I}-\boldsymbol{A}|  \tag{9-93}\\
& =\lambda^{n}+a_{n-1} \lambda^{n-1}+\cdots+a_{1} \lambda+a_{0}
\end{align*}
$$

则 $\boldsymbol{A}$ 满足其特征方程，即

$$
\begin{equation*}
f(\boldsymbol{A})=\boldsymbol{A}^{n}+a_{n-1} \boldsymbol{A}^{n-1}+\cdots+a_{1} \boldsymbol{A}+a_{0} \boldsymbol{I}=\mathbf{0} \tag{9-94}
\end{equation*}
$$

证明 由于

$$
\begin{equation*}
(\lambda \boldsymbol{I}-\boldsymbol{A})^{-1}=\frac{\boldsymbol{B}(\lambda)}{|\lambda \boldsymbol{I}-\boldsymbol{A}|}=\frac{\boldsymbol{B}(\lambda)}{f(\lambda)} \tag{9-95}
\end{equation*}
$$

式中， $\boldsymbol{B}(\lambda)$ 为 $(\lambda \boldsymbol{I}-\boldsymbol{A})$ 的伴随矩阵，其一般展开式为

$$
\begin{aligned}
& \boldsymbol{A}=\left[\begin{array}{cccc}
a_{11} & a_{12} & \cdots & a_{1 n} \\
a_{21} & a_{22} & \cdots & a_{2 n} \\
\vdots & \vdots & & \vdots \\
a_{n 1} & a_{n 2} & \cdots & a_{n n}
\end{array}\right], \quad \lambda \boldsymbol{I}-\boldsymbol{A}=\left[\begin{array}{cccc}
\lambda-a_{11} & -a_{12} & \cdots & -a_{1 n} \\
-a_{21} & \lambda-a_{22} & \cdots & -a_{2 n} \\
\vdots & \vdots & & \vdots \\
-a_{n 1} & -a_{n 2} & \cdots & \lambda-a_{n n}
\end{array}\right] \\
& \boldsymbol{B}(\lambda)=\left[\begin{array}{ccc}
(-1)^{1+1}\left|\begin{array}{ccc}
\lambda-a_{22} & \cdots & -a_{2 n} \\
\vdots & & \vdots \\
-a_{n 2} & \cdots & \lambda-a_{n n}
\end{array}\right| & \cdots & (-1)^{n+1}\left|\begin{array}{ccc}
-a_{12} & \cdots & -a_{1 n} \\
\vdots & & \vdots \\
-a_{n-1,2} & \cdots & -a_{n-1, n}
\end{array}\right| \\
(-1)^{1+n}\left|\begin{array}{ccc}
-a_{21} & \cdots & -a_{2, n-1} \\
\vdots & & \vdots \\
-a_{n 1} & \cdots & -a_{n, n-1}
\end{array}\right| & \cdots & (-1)^{n+n}\left|\begin{array}{ccc}
\lambda-a_{11} & \cdots & -a_{1, n-1} \\
\vdots & & \vdots \\
-a_{n-1,1} & \cdots & -a_{n-1, n-1}
\end{array}\right|
\end{array}\right]
\end{aligned}
$$

显见 $\boldsymbol{B}(\lambda)$ 的元素均为 $n-1$ 阶多项式，由矩阵加法规则可将其分解为 $n$ 个矩阵之和，即

$$
\begin{equation*}
\boldsymbol{B}(\lambda)=\lambda^{n-1} \boldsymbol{B}_{n-1}+\lambda^{n-2} \boldsymbol{B}_{n-2}+\cdots+\lambda \boldsymbol{B}_{1}+\boldsymbol{B}_{0} \tag{9-96}
\end{equation*}
$$

式中 $\boldsymbol{B}_{n-1}, \boldsymbol{B}_{n-2}, \cdots, \boldsymbol{B}_{0}$ 均为 $n$ 阶矩阵。将式（9－95）两端右乘 $(\lambda \boldsymbol{I}-\boldsymbol{A})$ ，得

$$
\begin{equation*}
\boldsymbol{B}(\lambda)(\lambda \boldsymbol{I}-\boldsymbol{A})=f(\lambda) \boldsymbol{I} \tag{9-97}
\end{equation*}
$$

将式（9－96）代入式（9－97）并展开，有

$$
\begin{align*}
& \lambda^{n} \boldsymbol{B}_{n-1}+\lambda^{n-1}\left(\boldsymbol{B}_{n-2}-\boldsymbol{B}_{n-1} \boldsymbol{A}\right)+\lambda^{n-2}\left(\boldsymbol{B}_{n-3}-\boldsymbol{B}_{n-2} \boldsymbol{A}\right)+\cdots+\lambda\left(\boldsymbol{B}_{0}-\boldsymbol{B}_{1} \boldsymbol{A}\right)-\boldsymbol{B}_{0} \boldsymbol{A}  \tag{9-98}\\
= & \lambda^{n} \boldsymbol{I}+a_{n-1} \lambda^{n-1} \boldsymbol{I}+\cdots+a_{1} \lambda \boldsymbol{I}-a_{0} \boldsymbol{I}
\end{align*}
$$

令式（9－98）等号两边 $\lambda$ 同次项的系数相等，可得



<!-- source_pdf_page: 487 -->
$$
\begin{align*}
& \boldsymbol{B}_{n-1}=\boldsymbol{I} \\
& \boldsymbol{B}_{n-2}-\boldsymbol{B}_{n-1} \boldsymbol{A}=a_{n-1} \boldsymbol{I} \\
& \vdots  \tag{9-99}\\
& \boldsymbol{B}_{0}-\boldsymbol{B}_{1} \boldsymbol{A}=a_{1} \boldsymbol{I} \\
& -\boldsymbol{B}_{0} \boldsymbol{A}=a_{0} \boldsymbol{I}
\end{align*}
$$

将式（9－99）两端按顺序右乘 $\boldsymbol{A}^{n}, \boldsymbol{A}^{n-1}, \cdots, \boldsymbol{A}, \boldsymbol{A}^{0}$ 得

$$
\begin{align*}
& \boldsymbol{B}_{n-1} \boldsymbol{A}^{n}=\boldsymbol{A}^{n} \\
& \boldsymbol{B}_{n-2} \boldsymbol{A}^{n-1}-\boldsymbol{B}_{n-1} \boldsymbol{A}^{n}=a_{n-1} \boldsymbol{A}^{n-1} \\
& \vdots  \tag{9-100}\\
& \boldsymbol{B}_{0} \boldsymbol{A}-\boldsymbol{B}_{1} \boldsymbol{A}^{2}=a_{1} \boldsymbol{A} \\
& -\boldsymbol{B}_{0} \boldsymbol{A}=a_{0} \boldsymbol{I}
\end{align*}
$$

将式（9－100）中各式相加，可得

$$
f(\boldsymbol{A})=\boldsymbol{A}^{n}+a_{n-1} \boldsymbol{A}^{n-1}+\cdots+a_{1} \boldsymbol{A}+a_{0} \boldsymbol{I}=\mathbf{0}
$$

推论 1 矩阵 $\boldsymbol{A}$ 的 $k(k \geqslant n)$ 次幂可表示为 $\boldsymbol{A}$ 的 $n-1$ 阶多项式

$$
\begin{equation*}
\boldsymbol{A}^{k}=\sum_{m=0}^{n-1} \alpha_{m} \boldsymbol{A}^{m}, \quad k \geqslant n \tag{9-101}
\end{equation*}
$$

证明 由于

$$
A^{n}=-a_{n-1} A^{n-1}-a_{n-2} A^{n-2}-\cdots-a_{1} A-a_{0} I
$$

则

$$
\begin{aligned}
\boldsymbol{A}^{n+1}= & \boldsymbol{A} \boldsymbol{A}^{n}=-a_{n-1} \boldsymbol{A}^{n}-a_{n-2} \boldsymbol{A}^{n-1}-\cdots-a_{1} \boldsymbol{A}^{2}-a_{0} \boldsymbol{A} \\
= & -a_{n-1}\left(-a_{n-1} \boldsymbol{A}^{n-1}-\cdots-a_{1} \boldsymbol{A}-a_{0} \boldsymbol{I}\right)-a_{n-2} \boldsymbol{A}^{n-1}-\cdots-a_{1} \boldsymbol{A}^{2}-a_{0} \boldsymbol{A} \\
= & \left(a_{n-1}^{2}-a_{n-2}\right) \boldsymbol{A}^{n-1}+\left(a_{n-1} a_{n-2}-a_{n-3}\right) \boldsymbol{A}^{n-2}+\cdots \\
& +\left(a_{n-1} a_{2}-a_{1}\right) \boldsymbol{A}^{2}+\left(a_{n-1} a_{1}-a_{0}\right) \boldsymbol{A}+a_{n-1} a_{0} \boldsymbol{I}
\end{aligned}
$$

故上述推论成立。式（9－101）中的 $\alpha_{m}$ 与 $\boldsymbol{A}$ 阵的元素有关。此推论可用以简化矩阵幂的计算。
推论 2 矩阵指数 $\mathrm{e}^{A t}$ 可表示为 $\boldsymbol{A}$ 的 $n-1$ 阶多项式

$$
\begin{equation*}
\mathrm{e}^{A t}=\sum_{m=0}^{n-1} \alpha_{m}(t) \boldsymbol{A}^{m} \tag{9-102}
\end{equation*}
$$

证明 由于

$$
\begin{aligned}
\mathrm{e}^{\boldsymbol{A} t}= & \boldsymbol{I}+\boldsymbol{A} t+\frac{1}{2} \boldsymbol{A}^{2} t^{2}+\cdots+\frac{1}{(n-1)!} \boldsymbol{A}^{n-1} t^{n-1}+\frac{1}{n!} \boldsymbol{A}^{n} t^{n}+\frac{1}{(n+1)!} \boldsymbol{A}^{n+1} t^{n+1}+\cdots+\frac{1}{k!} \boldsymbol{A}^{k} t^{k}+\cdots \\
= & \boldsymbol{I}+\boldsymbol{A} t+\frac{1}{2} \boldsymbol{A}^{2} t^{2}+\cdots+\frac{1}{(n-1)!} \boldsymbol{A}^{n-1} t^{n-1}+\frac{1}{n!}\left(-a_{n-1} \boldsymbol{A}^{n-1}-a_{n-2} \boldsymbol{A}^{n-2}-\cdots-a_{1} \boldsymbol{A}-a_{0} \boldsymbol{I}\right) t^{n} \\
& +\frac{1}{(n+1)!}\left[\left(a_{n-1}^{2}-a_{n-2}\right) \boldsymbol{A}^{n-1}+\left(a_{n-1} a_{n-2}-a_{n-3}\right) \boldsymbol{A}^{n-2}+\cdots\right. \\
& \left.+\left(a_{n-1} a_{2}-a_{1}\right) \boldsymbol{A}^{2}+\left(a_{n-1} a_{1}-a_{0}\right) \boldsymbol{A}+a_{n-1} a_{0} \boldsymbol{I}\right] t^{n+1}+\cdots \\
= & \left(1-\frac{1}{n!} a_{0} t^{n}+\frac{1}{(n+1)!} a_{n-1} a_{0} t^{n+1}+\cdots\right) \boldsymbol{I}
\end{aligned}
$$



<!-- source_pdf_page: 488 -->
$$
\begin{aligned}
& +\left[t-\frac{1}{n!} a_{1} t^{n}+\frac{1}{(n+1)!}\left(a_{n-1} a_{1}-a_{0}\right) t^{n+1}+\cdots\right] \boldsymbol{A} \\
& +\left[\frac{1}{2} t^{2}-\frac{1}{n!} a_{2} t^{n}+\frac{1}{(n+1)!}\left(a_{n-1} a_{2}-a_{1}\right) t^{n+1}+\cdots\right] \boldsymbol{A}^{2}+\cdots \\
& +\left[\frac{1}{(n-1)!} t^{n-1}-\frac{1}{n!} a_{n-1} t^{n}+\frac{1}{(n+1)!}\left(a_{n-1}^{2}-a_{n-2}\right) t^{n+1}+\cdots\right] \boldsymbol{A}^{n-1}
\end{aligned}
$$

令

$$
\begin{aligned}
& \alpha_{0}(t)=1-\frac{1}{n!} a_{0} t^{n}+\frac{1}{(n+1)!} a_{n-1} a_{0} t^{n+1}+\cdots \\
& \alpha_{1}(t)=t-\frac{1}{n!} a_{1} t^{n}+\frac{1}{(n+1)!}\left(a_{n-1} a_{1}-a_{0}\right) t^{n+1}+\cdots \\
& \alpha_{2}(t)=\frac{1}{2} t^{2}-\frac{1}{n!} a_{2} t^{n}+\frac{1}{(n+1)!}\left(a_{n-1} a_{2}-a_{1}\right) t^{n+1}+\cdots \\
& \vdots \\
& \alpha_{n-1}(t)=\frac{1}{(n-1)!} t^{n-1}-\frac{1}{n!} a_{n-1} t^{n}+\frac{1}{(n+1)!}\left(a_{n-1}^{2}-a_{n-2}\right) t^{n+1}+\cdots
\end{aligned}
$$

则有

$$
\mathrm{e}^{\boldsymbol{A} t}=\alpha_{0}(t) \boldsymbol{I}+\alpha_{1}(t) \boldsymbol{A}+\alpha_{2}(t) \boldsymbol{A}^{2}+\cdots+\alpha_{n-1}(t) \boldsymbol{A}^{n-1}=\sum_{m=0}^{n-1} \alpha_{m}(t) \boldsymbol{A}^{m}
$$

故推论2成立。式（9－102）中的 $\alpha_{m}(t)(m=0,1,2, \cdots, n-1)$ 均为 $t$ 的幂函数，对于 $t \in\left[0, t_{f}\right]$ ，不同时刻构成的向量组 $\left[\alpha_{0}(0), \cdots, \alpha_{n-1}(0)\right], \cdots,\left[\alpha_{0}\left(t_{f}\right), \cdots, \alpha_{n-1}\left(t_{f}\right)\right]$ 是线性无关的向量组，其中任一向量都无法表示成为其他向量的线性组合。同理， $\mathrm{e}^{-A t}$ 也可表示为 $\boldsymbol{A}$ 的 $n-1$ 阶多项式

$$
\begin{equation*}
\mathrm{e}^{-A t}=\sum_{m=0}^{n-1} \alpha_{m}^{\prime}(t) \boldsymbol{A}^{m} \tag{9-103}
\end{equation*}
$$

式中

$$
\begin{aligned}
& \alpha_{0}^{\prime}(t)=1-(-1)^{n} \frac{1}{n!} a_{0} t^{n}+(-1)^{n+1} \frac{1}{(n+1)!} a_{n-1} a_{0} t^{n+1}+\cdots \\
& \alpha_{1}^{\prime}(t)=-t-(-1)^{n} \frac{1}{n!} a_{1} t^{n}+(-1)^{n+1} \frac{1}{(n+1)!}\left(a_{n-1} a_{1}-a_{0}\right) t^{n+1}+\cdots \\
& \quad \vdots \\
& \alpha_{n-1}^{\prime}(t)=(-1)^{n-1} \frac{1}{(n-1)!} t^{n-1}-(-1)^{n} \frac{1}{n!} a_{n-1} t^{n}+(-1)^{n+1} \frac{1}{(n+1)!}\left(a_{n-1}^{2}-a_{n-2}\right) t^{n+1}+\cdots
\end{aligned}
$$

例 9－10 已知 $\boldsymbol{A}=\left[\begin{array}{ll}1 & 2 \\ 0 & 1\end{array}\right]$ ，求 $\boldsymbol{A}^{100}$ 。
解 $\boldsymbol{A}$ 的特征多项式为

$$
f(\lambda)=|\lambda \boldsymbol{I}-\boldsymbol{A}|=\left|\begin{array}{cc}
\lambda-1 & -2 \\
0 & \lambda-1
\end{array}\right|=\lambda^{2}-2 \lambda+1
$$

根据凯莱－哈密顿定理，有

$$
f(\boldsymbol{A})=\boldsymbol{A}^{2}-2 \boldsymbol{A}+\boldsymbol{I}=0
$$



<!-- source_pdf_page: 489 -->
$$
A^{2}=2 A-I
$$

故

$$
\begin{gathered}
\boldsymbol{A}^{3}=\boldsymbol{A} \boldsymbol{A}^{2}=2 \boldsymbol{A}^{2}-\boldsymbol{A}=2(2 \boldsymbol{A}-\boldsymbol{I})-\boldsymbol{A}=3 \boldsymbol{A}-2 \boldsymbol{I} \\
\boldsymbol{A}^{4}=\boldsymbol{A} \boldsymbol{A}^{3}=3 \boldsymbol{A}^{2}-2 \boldsymbol{A}=3(2 \boldsymbol{A}-\boldsymbol{I})-2 \boldsymbol{A}=4 \boldsymbol{A}-3 \boldsymbol{I}
\end{gathered}
$$

根据数学归纳法，有

$$
\begin{gathered}
\boldsymbol{A}^{k}=k \boldsymbol{A}-(k-1) \boldsymbol{I} \\
\boldsymbol{A}^{100}=100 \boldsymbol{A}-99 \boldsymbol{I}=\left[\begin{array}{cc}
100 & 200 \\
0 & 100
\end{array}\right]-\left[\begin{array}{cc}
99 & 0 \\
0 & 99
\end{array}\right]=\left[\begin{array}{cc}
1 & 200 \\
0 & 1
\end{array}\right]
\end{gathered}
$$

秩判据 线性定常连续系统（9－83）完全可控的充分必要条件是

$$
\operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B} \tag{9-104}
\end{array}\right]=n
$$

其中，$n$ 为矩阵 $\boldsymbol{A}$ 的维数； $\boldsymbol{S}=\left[\begin{array}{llll}\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B}\end{array}\right]$ 称为系统的可控性判别阵。
西明 充分性：已知 $\operatorname{rank} \boldsymbol{S}=n$ ，欲证系统完全可控。
采用反证法。反设系统为不完全可控，则根据格拉姆矩阵判据可知

$$
\boldsymbol{W}\left(0, t_{1}\right)=\int_{0}^{t_{1}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B} \boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \mathrm{~d} t, \quad \forall t_{1}>0
$$

为奇异，这意味着存在某个非零 $n$ 维向量 $\alpha$ 使

$$
\boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{W}\left(0, t_{1}\right) \boldsymbol{\alpha}=\int_{0}^{t_{1}} \boldsymbol{\alpha}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B} \boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \boldsymbol{\alpha} \mathrm{~d} t=\int_{0}^{t_{1}}\left[\boldsymbol{\alpha}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B}\right]\left[\boldsymbol{\alpha}^{\mathrm{T}} \mathrm{e}^{-A t} \boldsymbol{B}\right]^{\mathrm{T}} \mathrm{~d} t=0
$$

成立。显然，由此可导出

$$
\begin{equation*}
\boldsymbol{\alpha}^{\mathrm{T}} \mathrm{e}^{-A t} \boldsymbol{B}=\mathbf{0}, \quad \forall t \in\left[0, t_{1}\right] \tag{9-105}
\end{equation*}
$$

将式（9－105）求导直至 $n-1$ 次，再在所得结果中令 $t=0$ ，得到

$$
\begin{equation*}
\boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{B}=\mathbf{0}, \quad \boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{A} \boldsymbol{B}=\mathbf{0}, \quad \boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{A}^{2} \boldsymbol{B}=\mathbf{0}, \quad \cdots, \quad \boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{A}^{n-1} \boldsymbol{B}=0 \tag{9-106}
\end{equation*}
$$

式（9－106）又可表示为

$$
\boldsymbol{\alpha}^{\mathrm{T}}\left[\begin{array}{lllll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \boldsymbol{A}^{2} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B} \tag{9-107}
\end{array}\right]=\boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{S}=\mathbf{0}
$$

由于 $\boldsymbol{\alpha} \neq \mathbf{0}$ ，所以式（9－107）意味着 $\boldsymbol{S}$ 为行线性相关，即 $\operatorname{rank} \boldsymbol{S}<n$ ，这显然和已知 $\operatorname{rank} \boldsymbol{S}=n$相矛盾。因而反设不成立，系统应为完全可控。

必要性：已知系统完全可控，欲证 $\operatorname{rank} \boldsymbol{S}=n$ 。
采用反证法。反设 $\operatorname{rank} \boldsymbol{S}<n$ ，这意味着 $\boldsymbol{S}$ 为线性相关，因此必存在一个非零 $n$ 维常数向量 $\boldsymbol{\alpha}$ 使

$$
\boldsymbol{\alpha}^{\top} \boldsymbol{S}=\boldsymbol{\alpha}^{\top}\left[\begin{array}{llll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B}
\end{array}\right]=\mathbf{0}
$$

成立。考虑到问题的一般性，由上式可导出

$$
\begin{equation*}
\boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{A}^{i} \boldsymbol{B}=\mathbf{0}, \quad i=0,1,2, \cdots, n-1 \tag{9-108}
\end{equation*}
$$

根据凯莱－哈密顿定理， $\boldsymbol{A}^{n}, \boldsymbol{A}^{n+1}, \cdots$ 均可表示为 $\boldsymbol{A}$ 的 $n-1$ 阶多项式，因而式（9－108）又可写为

$$
\begin{equation*}
\boldsymbol{\alpha}^{\top} \boldsymbol{A}^{i} \boldsymbol{B}=\mathbf{0}, \quad i=0,1,2,3, \cdots \tag{9-109}
\end{equation*}
$$

从而对任意 $t_{1}>0$ 有

$$
(-1)^{i} \boldsymbol{\alpha}^{\mathrm{T}} \frac{\boldsymbol{A}^{i} t^{i}}{i!} \boldsymbol{B}=\mathbf{0} ; \quad \forall t \in\left[0, t_{1}\right], \quad i=0,1,2, \cdots
$$



<!-- source_pdf_page: 490 -->
或

$$
\begin{equation*}
\boldsymbol{\alpha}^{\mathrm{T}}\left[\boldsymbol{I}-\boldsymbol{A} t+\frac{1}{2} \boldsymbol{A}^{2} t^{2}-\frac{1}{3!} \boldsymbol{A}^{3} t^{3}+\cdots\right] \boldsymbol{B}=\boldsymbol{\alpha}^{\mathrm{T}} \mathrm{e}^{-A t} \boldsymbol{B}=\mathbf{0}, \quad \forall t \in\left[0, t_{1}\right] \tag{9-110}
\end{equation*}
$$

因而有

$$
\begin{equation*}
\boldsymbol{\alpha}^{\mathrm{T}} \int_{0}^{t_{1}} \mathrm{e}^{-\boldsymbol{A} t} \boldsymbol{B} \boldsymbol{B}^{\mathrm{T}} \mathrm{e}^{-\boldsymbol{A}^{\mathrm{T}} t} \mathrm{~d} t \boldsymbol{\alpha}=\boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{W}\left(0, t_{1}\right) \boldsymbol{\alpha}=\mathbf{0} \tag{9-111}
\end{equation*}
$$

因为已知 $\boldsymbol{\alpha} \neq \mathbf{0}$ ，若式（9－111）成立，则 $\boldsymbol{W}\left(0, t_{1}\right)$ 必为奇异，系统为不完全可控，与已知结果相矛盾。于是有 $\operatorname{rank} \boldsymbol{S}=n$ ，必要性得证。秩判据证毕。

例9－11 桥式网络如图9－20所示，试用可控性判据判断其可控性。

![](assets/fig-09-20.png)

> Image description: This textbook figure depicts a bridge network with a voltage source u and an inductor L₂ in series. The network branches into four resistors (R₁, R₂, R₃, R₄) forming a diamond configuration, with a capacitor C at the center. Currents i₁ to i₄ flow through each resistor, and iₜ is the total current entering the bridge from the inductor. The capacitor voltage is labeled u_C. Arrows indicate current directions, and the source voltage is labeled u. The diagram illustrates a four-resistor bridge with a central capacitor, commonly analyzed for controllability in linear systems. The figure is labeled as Example 9-11, referencing Figure 9-20, and prompts using controllability criteria to assess the system’s controllability. No axes or coordinate systems are present.
图9－20 桥式网络电路图

解 该桥式网络的微分方程为

$$
\begin{aligned}
& i_{L}=i_{1}+i_{2}=i_{3}+i_{4} \\
& R_{4} i_{4}+u_{C}=R_{3} i_{3} \\
& R_{1} i_{1}+u_{C}=R_{2} i_{2} \\
& L \frac{\mathrm{~d} i_{L}}{\mathrm{~d} t}+R_{1} i_{1}+R_{3} i_{3}=u
\end{aligned}
$$

选取状态变量 $x_{1}=i_{L}, x_{2}=u_{C}$ ，消去微分方组中的 $i_{1}, i_{2}, i_{3}, i_{4}$ ，可得状态方程

$$
\begin{aligned}
& \dot{x}_{1}=-\frac{1}{L}\left(\frac{R_{1} R_{2}}{R_{1}+R_{2}}+\frac{R_{3} R_{4}}{R_{3}+R_{4}}\right) x_{1}+\frac{1}{L}\left(\frac{R_{1}}{R_{1}+R_{2}}-\frac{R_{3}}{R_{3}+R_{4}}\right) x_{2}+\frac{1}{L} u \\
& \dot{x}_{2}=\frac{1}{C}\left(\frac{R_{2}}{R_{1}+R_{2}}-\frac{R_{4}}{R_{3}+R_{4}}\right) x_{1}-\frac{1}{C}\left(\frac{1}{R_{1}+R_{2}}-\frac{1}{R_{3}+R_{4}}\right) x_{2}
\end{aligned}
$$

其可控性矩阵为

$$
\boldsymbol{S}=\left[\begin{array}{ll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b}
\end{array}\right]=\left[\begin{array}{cc}
\frac{1}{L} & -\frac{1}{L^{2}}\left(\frac{R_{1} R_{2}}{R_{1}+R_{2}}+\frac{R_{3} R_{4}}{R_{3}+R_{4}}\right) \\
0 & -\frac{1}{L C}\left(\frac{R_{4}}{R_{3}+R_{4}}-\frac{R_{2}}{R_{1}+R_{2}}\right)
\end{array}\right]
$$

当 $\frac{R_{4}}{R_{3}+R_{4}} \neq \frac{R_{2}}{R_{1}+R_{2}}$ 时， $\operatorname{rank} \boldsymbol{S}=2=n$ ，系统可控。但是，当电桥处于平衡状态，即 $R_{1} R_{4}=R_{2} R_{3}$时，$\frac{R_{1}}{R_{1}+R_{2}}=\frac{R_{3}}{R_{3}+R_{4}}$ 及 $\frac{R_{2}}{R_{1}+R_{2}}=\frac{R_{4}}{R_{3}+R_{4}}$ 成立，这时状态方程变为

$$
\dot{x}_{1}=-\frac{1}{L}\left(\frac{R_{1} R_{2}}{R_{1}+R_{2}}+\frac{R_{3} R_{4}}{R_{3}+R_{4}}\right) x_{1}+\frac{1}{L} u
$$



<!-- source_pdf_page: 491 -->
$$
\dot{x}_{2}=-\frac{1}{C}\left(\frac{1}{R_{1}+R_{2}}-\frac{1}{R_{3}+R_{4}}\right) x_{2}
$$

可控性矩阵为

$$
\boldsymbol{S}=\left[\begin{array}{ll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b}
\end{array}\right]=\left[\begin{array}{cc}
\frac{1}{L} & -\frac{1}{L^{2}}\left(\frac{R_{1} R_{2}}{R_{1}+R_{2}}+\frac{R_{3} R_{4}}{R_{3}+R_{4}}\right) \\
0 & 0
\end{array}\right]
$$

$r a n k \boldsymbol{S}=1<n$ ，系统不可控，$u$ 不能控制 $x_{2}, x_{2}$ 是不可控状态变量。
PBH 秩判据 线性定常连续系统（9－83）完全可控的充分必要条件是，对矩阵 $A$ 的所有特征值 $\lambda_{i}(i=1,2, \cdots, n)$ ，有

$$
\begin{equation*}
\operatorname{rank}\left[\lambda_{i} \boldsymbol{I}-\boldsymbol{A} \quad \boldsymbol{B}\right]=n, \quad i=1,2, \cdots, n \tag{9-112}
\end{equation*}
$$

均成立，或等价地表示为

$$
\operatorname{rank}\left[\begin{array}{ll}
s \boldsymbol{I}-\boldsymbol{A} & \boldsymbol{B} \tag{9-113}
\end{array}\right]=n, \quad \forall s \in C
$$

由于这一判据是由波波夫（Popov）和贝尔维奇（Belevitch）首先提出，并由豪塔斯（Hautus）最先指出其可广泛应用性，故称为 PBH 秩判据。

证明 必要性：已知系统完全可控，欲证式（9－112）成立。
采用反证法。反设对某个 $\lambda_{i}$ 有 $\operatorname{rank}\left[\lambda_{i} \boldsymbol{I}-\boldsymbol{A} \quad \boldsymbol{B}\right]<n$ ，则意味着 $\left[\lambda_{i} \boldsymbol{I}-\boldsymbol{A} \quad \boldsymbol{B}\right]$ 为行线性相关，因而必存在一个非零常数向量 $\boldsymbol{\alpha}$ ，使

$$
\begin{equation*}
\boldsymbol{\alpha}^{\mathrm{T}}\left[\lambda_{i} \boldsymbol{I}-\boldsymbol{A} \quad \boldsymbol{B}\right]=\mathbf{0} \tag{9-114}
\end{equation*}
$$

成立。考虑到问题的一般性，由式（9－114）可导出

$$
\begin{equation*}
\boldsymbol{\alpha}^{\top} \boldsymbol{A}=\lambda_{i} \boldsymbol{\alpha}^{\top}, \quad \boldsymbol{\alpha}^{\top} \boldsymbol{B}=\mathbf{0} \tag{9-115}
\end{equation*}
$$

进而可得

$$
\boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{B}=\mathbf{0}, \quad \boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{A} \boldsymbol{B}=\lambda_{i} \boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{B}=\mathbf{0}, \quad \cdots, \quad \boldsymbol{\alpha}^{\mathrm{T}} \boldsymbol{A}^{n-1} \boldsymbol{B}=\mathbf{0}
$$

于是有

$$
\boldsymbol{\alpha}^{\top}\left[\begin{array}{llll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B} \tag{9-116}
\end{array}\right]=\boldsymbol{\alpha}^{\top} \boldsymbol{S}=\mathbf{0}
$$

因已知 $\boldsymbol{\alpha} \neq \mathbf{0}$ ，所以欲使式（9－116）成立，必有

$$
\operatorname{rank} \boldsymbol{S}<n
$$

这意味着系统不可控，显然与已知条件相矛盾，因而此反设不成立，而式（9－112）成立。考虑到 $[s \boldsymbol{I}-\boldsymbol{A} \quad \boldsymbol{B}]$ 为多项式矩阵，且对复数域 $C$ 上除 $\lambda_{i}(i=1,2, \cdots, n)$ 以外的所有 $s$ 均有$\operatorname{det}(s \boldsymbol{I}-\boldsymbol{A}) \neq 0$ ，所以式（9－112）等价于式（9－113）。必要性得证。

充分性：已知式（9－112）成立，欲证系统完全可控。
采用反证法。利用与上述相反的思路，即可证明充分性。至此，PBH 秩判据证毕。
例 9－12 已知线性定常连续系统的状态方程为

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{cccc}
0 & 1 & 0 & 0 \\
0 & 0 & -1 & 0 \\
0 & 0 & 0 & 1 \\
0 & 0 & 5 & 0
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{cc}
0 & 1 \\
1 & 0 \\
0 & 1 \\
-2 & 0
\end{array}\right] \boldsymbol{u}, \quad n=4
$$



<!-- source_pdf_page: 492 -->
试判别系统的可控性。
解 根据状态方程可写出

$$
\left[\begin{array}{ll}
s \boldsymbol{I}-\boldsymbol{A} & \boldsymbol{B}
\end{array}\right]=\left[\begin{array}{cccccc}
s & -1 & 0 & 0 & 0 & 1 \\
0 & s & 1 & 0 & 1 & 0 \\
0 & 0 & s & -1 & 0 & 1 \\
0 & 0 & -5 & s & -2 & 0
\end{array}\right]
$$

考虑到 $\boldsymbol{A}$ 的特征值为 $\lambda_{1}=\lambda_{2}=0, \lambda_{3}=\sqrt{5}, \lambda_{4}=-\sqrt{5}$ ，所以只需对它们来检验上述矩阵的秩。通过计算可知，当 $s=\lambda_{1}=\lambda_{2}=0$ 时，有

$$
\operatorname{rank}\left[\begin{array}{ll}
s \boldsymbol{I}-\boldsymbol{A} & \boldsymbol{B}
\end{array}\right]=\operatorname{rank}\left[\begin{array}{cccc}
-1 & 0 & 0 & 0 \\
0 & 1 & 0 & 1 \\
0 & 0 & -1 & 0 \\
0 & -5 & 0 & -2
\end{array}\right]=4
$$

当 $s=\lambda_{3}=\sqrt{5}$ 时，有

$$
\operatorname{rank}\left[\begin{array}{ll}
s \boldsymbol{I}-\boldsymbol{A} & \boldsymbol{B}
\end{array}\right]=\operatorname{rank}\left[\begin{array}{cccc}
\sqrt{5} & -1 & 0 & 1 \\
0 & \sqrt{5} & 1 & 0 \\
0 & 0 & 0 & 1 \\
0 & 0 & -2 & 0
\end{array}\right]=4
$$

当 $s=\lambda_{4}=-\sqrt{5}$ 时，有

$$
\operatorname{rank}\left[\begin{array}{ll}
s \boldsymbol{I}-\boldsymbol{A} & \boldsymbol{B}
\end{array}\right]=\operatorname{rank}\left[\begin{array}{cccc}
-\sqrt{5} & -1 & 0 & 1 \\
0 & -\sqrt{5} & 1 & 0 \\
0 & 0 & 0 & 1 \\
0 & 0 & -2 & 0
\end{array}\right]=4
$$

计算结果表明，充分必要条件式（9－112）成立，故系统完全可控。
对角线规范型判据 若线性定常连续系统（9－83）矩阵 $\boldsymbol{A}$ 的特征值 $\lambda_{1}, \lambda_{2}, \cdots, \lambda_{n}$ 两两相异，由线性变换式（9－83）可变为对角线规范型

$$
\dot{\overline{\boldsymbol{x}}}=\left[\begin{array}{cccc}
\lambda_{1} & & & 0  \tag{9-117}\\
& \lambda_{2} & & \\
& & \ddots & \\
0 & & & \lambda_{n}
\end{array}\right] \overline{\boldsymbol{x}}+\overline{\boldsymbol{B}} \boldsymbol{u}
$$

则系统（9－83）完全可控的充分必要条件是，在式（9－117）中，$\overline{\boldsymbol{B}}$ 不包含元素全为零的行。
证明 可用秩判据予以证明，推证过程略。
例 9－13 已知线性定常连续系统的对角线规范型为

$$
\left[\begin{array}{l}
\dot{\bar{x}}_{1} \\
\dot{\bar{x}}_{2} \\
\dot{\bar{x}}_{3}
\end{array}\right]=\left[\begin{array}{ccc}
8 & 0 & 0 \\
0 & -1 & 0 \\
0 & 0 & 2
\end{array}\right]\left[\begin{array}{l}
\bar{x}_{1} \\
\bar{x}_{2} \\
\bar{x}_{3}
\end{array}\right]+\left[\begin{array}{ll}
0 & 1 \\
3 & 0 \\
0 & 2
\end{array}\right]\left[\begin{array}{l}
u_{1} \\
u_{2}
\end{array}\right]
$$



<!-- source_pdf_page: 493 -->
试判定系统的可控性。
解 由于此规范型中 $\overline{\boldsymbol{B}}$ 不包含元素全为零的行，故系统完全可控。
4．输出可控性
如果系统需要控制的是输出量而不是状态，则需研究系统的输出可控性。
输出可控性 若在有限时间间隔 $\left[t_{0}, t_{1}\right]$ 内，存在无约束分段连续控制函数 $\boldsymbol{u}(t)$ ，$t \in\left[t_{0}, t_{1}\right]$ ，能使任意初始输出 $\boldsymbol{y}\left(t_{0}\right)$ 转移到任意最终输出 $\boldsymbol{y}\left(t_{1}\right)$ ，则称此系统输出完全可控，简称输出可控。

输出可控性判据 设线性定常连续系统的状态方程和输出方程为

$$
\begin{align*}
& \dot{x}=A x+B u, \quad x(0)=x_{0}, \quad t \in\left[0, t_{1}\right]  \tag{9-118}\\
& y=C x+D u \tag{9-119}
\end{align*}
$$

式中， $\boldsymbol{u}$ 为 $p$ 维输人向量； $\boldsymbol{y}$ 为 $q$ 维输出向量； $\boldsymbol{x}$ 为 $\boldsymbol{n}$ 维状态向量。状态方程（9－118）的解为

$$
\boldsymbol{x}\left(t_{1}\right)=\mathrm{e}^{\boldsymbol{A} t_{1}} \boldsymbol{x}_{0}+\int_{0}^{t_{1}} \mathrm{e}^{\boldsymbol{A}\left(t_{1}-t\right)} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t
$$

则输出为

$$
\begin{equation*}
\boldsymbol{y}\left(t_{1}\right)=\boldsymbol{C} \mathrm{e}^{A t_{1}} \boldsymbol{x}_{0}+\boldsymbol{C} \int_{0}^{t_{1}} \mathrm{e}^{\boldsymbol{A}\left(t_{1}-t\right)} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t+\boldsymbol{D} \boldsymbol{u}\left(t_{1}\right) \tag{9-120}
\end{equation*}
$$

不失一般性，令 $y\left(t_{1}\right)=0$ ，并应用凯莱－哈密顿定理的推论 2 有

$$
\begin{aligned}
\boldsymbol{C e}^{A t_{1}} \boldsymbol{x}_{0} & =-\boldsymbol{C} \int_{0}^{t_{1}} \mathrm{e}^{A\left(t_{1}-t\right)} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t-\boldsymbol{D} \boldsymbol{u}\left(t_{1}\right) \\
& =-\boldsymbol{C} \int_{0}^{t_{1}} \sum_{m=0}^{n-1} \alpha_{m}(t) \boldsymbol{A}^{m} \boldsymbol{B} \boldsymbol{u}(t) \mathrm{d} t-\boldsymbol{D} \boldsymbol{u}\left(t_{1}\right) \\
& =-\boldsymbol{C} \sum_{m=0}^{n-1} \boldsymbol{A}^{m} \boldsymbol{B} \int_{0}^{t_{1}} \alpha_{m}(t) \boldsymbol{u}(t) \mathrm{d} t-\boldsymbol{D} \boldsymbol{u}\left(t_{1}\right)
\end{aligned}
$$

令 $\boldsymbol{u}_{m}\left(t_{1}\right)=\int_{0}^{t_{1}} \alpha_{m}(t) \boldsymbol{u}(t) \mathrm{d} t$ ，则

$$
\begin{align*}
C \mathrm{e}^{A t_{1}} \boldsymbol{x}_{0} & =-C \sum_{m=0}^{n-1} \boldsymbol{A}^{m} \boldsymbol{B} \boldsymbol{u}_{m}(t)-\boldsymbol{D} \boldsymbol{u}\left(t_{1}\right) \\
& =-\boldsymbol{C} \boldsymbol{B} \boldsymbol{u}_{0}\left(t_{1}\right)-\boldsymbol{C} \boldsymbol{A} \boldsymbol{B} \boldsymbol{u}_{1}\left(t_{1}\right)-\cdots-\boldsymbol{C} \boldsymbol{A}^{n-1} \boldsymbol{B} \boldsymbol{u}_{n-1}\left(t_{1}\right)-\boldsymbol{D} \boldsymbol{u}\left(t_{1}\right) \\
& =-\left[\begin{array}{lllll}
\boldsymbol{C} \boldsymbol{B} & \boldsymbol{C A} \boldsymbol{B} & \cdots & \boldsymbol{C} \boldsymbol{A}^{n-1} \boldsymbol{B} & \boldsymbol{D}
\end{array}\right]\left[\begin{array}{c}
\boldsymbol{u}_{0}\left(t_{1}\right) \\
\boldsymbol{u}_{1}\left(t_{1}\right) \\
\vdots \\
\boldsymbol{u}_{n-1}\left(t_{1}\right) \\
\boldsymbol{u}\left(t_{1}\right)
\end{array}\right] \tag{9-121}
\end{align*}
$$

令

$$
S_{0}=\left[\begin{array}{lllll}
C B & C A B & \cdots & C A^{n-1} B & D \tag{9-122}
\end{array}\right]
$$

$S_{0}$ 为 $q \times(n+1) p$ 矩阵，称为输出可控性矩阵。输出可控的充分必要条件是，输出可控性矩阵的秩等于输出向量的维数 $q$ ，即



<!-- source_pdf_page: 494 -->
$$
\begin{equation*}
\operatorname{rank} \boldsymbol{S}_{0}=q \tag{9-123}
\end{equation*}
$$

需要注意的是，状态可控性与输出可控性是两个不同的概念，二者没有什么必然的联系。
例 9－14 已知系统的状态方程和输出方程为

$$
\begin{gathered}
\dot{x}=\left[\begin{array}{cc}
0 & 1 \\
-1 & -2
\end{array}\right] x+\left[\begin{array}{c}
1 \\
-1
\end{array}\right] u \\
y=\left[\begin{array}{ll}
1 & 0
\end{array}\right] x
\end{gathered}
$$

试判断系统的状态可控性和输出可控性。
解 系统的状态可控性矩阵为

$$
\boldsymbol{S}=\left[\begin{array}{ll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b}
\end{array}\right]=\left[\begin{array}{cc}
1 & -1 \\
-1 & 1
\end{array}\right]
$$

$|\boldsymbol{S}|=0, \operatorname{rank} \boldsymbol{S}<2$ ，故状态不完全可控。
输出可控性矩阵为

$$
\boldsymbol{S}_{0}=\left[\begin{array}{lll}
\boldsymbol{c} \boldsymbol{b} & \boldsymbol{c A b} & d
\end{array}\right]=\left[\begin{array}{lll}
1 & -1 & 0
\end{array}\right]
$$

$\operatorname{rank} \boldsymbol{S}_{0}=1=q$ ，故输出可控。
5．线性定常连续系统的可观测性判据
考虑输人 $\boldsymbol{u}=\mathbf{0}$ 时系统的状态方程和输出方程

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}, \quad \boldsymbol{x}(0)=\boldsymbol{x}_{0}, \quad t \geqslant 0, \quad y=C x \tag{9-124}
\end{equation*}
$$

式中， $\boldsymbol{x}$ 为 $n$ 维状态向量； $\boldsymbol{y}$ 为 $q$ 维输出向量； $\boldsymbol{A}$ 和 $\boldsymbol{C}$ 分别为 $n \times n$ 和 $q \times n$ 的常值矩阵。
格拉姆矩阵判据 线性定常连续系统（9－124）完全可观测的充分必要条件是，存在有限时刻 $t_{1}>0$ ，使如下定义的格拉姆矩阵：

$$
\begin{equation*}
\boldsymbol{M}(0, t) \triangleq \int_{0}^{t_{1}} \mathrm{e}^{A^{\top} t} \boldsymbol{C}^{\top} \boldsymbol{C} \mathrm{e}^{A t} \mathrm{~d} t \tag{9-125}
\end{equation*}
$$

为非奇异。
证明 充分性：已知 $M\left(0, t_{1}\right)$ 非奇异，欲证系统为完全可观测。
由式（9－124）可得

$$
\begin{equation*}
\boldsymbol{y}(t)=\boldsymbol{C} \boldsymbol{\Phi}(t, 0) \boldsymbol{x}_{0}=\boldsymbol{C} \mathrm{e}^{A t} \boldsymbol{x}_{0} \tag{9-126}
\end{equation*}
$$

将式（9－126）左乘 $\mathrm{e}^{A^{T} t} \boldsymbol{C}^{\mathrm{T}}$ ，然后从0到 $t_{1}$ 积分，得

$$
\begin{equation*}
\int_{0}^{t_{1}} \mathrm{e}^{\boldsymbol{A}^{\top} t} \boldsymbol{C}^{\mathrm{T}} \boldsymbol{y}(t) \mathrm{d} t=\int_{0}^{t_{1}} \mathrm{e}^{\boldsymbol{A}^{\mathrm{T}} t} \boldsymbol{C}^{\mathrm{T}} \boldsymbol{C} \mathrm{e}^{\boldsymbol{A} t} \mathrm{~d} t \boldsymbol{x}_{0}=\boldsymbol{M}\left(0, t_{1}\right) \boldsymbol{x}_{0} \tag{9-127}
\end{equation*}
$$

已知 $\boldsymbol{M}\left(0, t_{1}\right)$ 非奇异，即 $\boldsymbol{M}^{-1}\left(0, t_{1}\right)$ 存在，故由式（9－127）得

$$
\boldsymbol{x}_{0}=\boldsymbol{M}^{-1}\left(0, t_{1}\right) \int_{0}^{t_{1}} \mathrm{e}^{\boldsymbol{A}^{\mathrm{T}} t} \boldsymbol{C}^{\mathrm{T}} \boldsymbol{y}(t) \mathrm{d} t
$$

这表明，在 $\boldsymbol{M}\left(0, t_{1}\right)$ 非奇异的条件下，总可以根据 $\left[0, t_{1}\right]$ 上的输出 $\boldsymbol{y}(t)$ ，唯一地确定非零初始状态 $\boldsymbol{x}_{0}$ 。因此，系统为完全可观测。充分性得证。

必要性：已知系统完全可观测，欲证 $\boldsymbol{M}\left(0, t_{1}\right)$ 非奇异。
采用反证法。反设 $M\left(0, t_{1}\right)$ 奇异，假设存在某一非零 $\overline{\boldsymbol{x}}_{0} \in R^{n}$ ，使



<!-- source_pdf_page: 495 -->
$$
\begin{equation*}
\overline{\boldsymbol{x}}_{0}^{\mathrm{T}} \boldsymbol{M}\left(0, t_{1}\right) \overline{\boldsymbol{x}}_{0}=\int_{0}^{t_{1}} \overline{\boldsymbol{x}}_{0}^{\mathrm{T}} \mathrm{e}^{A^{\mathrm{T}} t} \boldsymbol{C}^{\mathrm{T}} \boldsymbol{C} \mathrm{e}^{A t} \overline{\boldsymbol{x}}_{0} \mathrm{~d} t=\int_{0}^{t_{1}} \boldsymbol{y}^{\mathrm{T}}(t) \boldsymbol{y}(t) \mathrm{d} t=\int_{0}^{t_{1}}\|\boldsymbol{y}(t)\|^{2} \mathrm{~d} t=0 \tag{9-128}
\end{equation*}
$$

成立，这意味着

$$
\boldsymbol{y}(t)=\boldsymbol{C} \mathrm{e}^{A t} \overline{\boldsymbol{x}}_{0} \equiv \mathbf{0}, \quad \forall t \in\left[0, t_{1}\right]
$$

显然， $\bar{x}_{0}$ 为状态空间中的不可观测状态。这和已知系统完全可观测相矛盾，所以反设不成立，必要性得证。至此格拉姆矩阵判据证毕。

秩判据 线性定常连续系统（9－124）完全可观测的充分必要条件是

$$
\operatorname{rank} \boldsymbol{V}=\operatorname{rank}\left[\begin{array}{c}
\boldsymbol{C}  \tag{9-129}\\
\boldsymbol{C A} \\
\vdots \\
\boldsymbol{C A}^{n-1}
\end{array}\right]=n
$$

或

$$
\operatorname{rank} \boldsymbol{V}=\operatorname{rank}\left[\begin{array}{lllll}
\boldsymbol{C}^{\mathrm{T}} & \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \left(\boldsymbol{A}^{\mathrm{T}}\right)^{2} \boldsymbol{C}^{\mathrm{T}} & \cdots & \left(\boldsymbol{A}^{\mathrm{T}}\right)^{n-1} \boldsymbol{C}^{\mathrm{T}} \tag{9-130}
\end{array}\right]=n
$$

式（9－129）和式（9－130）中的矩阵均称为系统可观测性判别阵，简称可观测性阵。
证明 证明方法与可控性秩判据相似，在此不再详述。这里仅从式（9－126）出发，进一步论证秩判据的充分必要条件。

由式（9－126），利用 $\mathrm{e}^{A t}$ 的级数展开式（9－102），可得

$$
\begin{align*}
\boldsymbol{y}(t) & =\boldsymbol{C} \mathrm{e}^{A t} \boldsymbol{x}_{0}=\boldsymbol{C} \sum_{m=0}^{n-1} \alpha_{m}(t) \boldsymbol{A}^{m} \boldsymbol{x}_{0} \\
& =\left[\boldsymbol{C} \alpha_{0}(t)+\boldsymbol{C} \alpha_{1}(t) \boldsymbol{A}+\cdots+\boldsymbol{C} \alpha_{n-1}(t) \boldsymbol{A}^{n-1}\right] \boldsymbol{x}_{0} \\
& =\left[\begin{array}{llll}
\alpha_{0}(t) \boldsymbol{I}_{q} & \alpha_{1}(t) \boldsymbol{I}_{q} & \cdots & \alpha_{n-1}(t) \boldsymbol{I}_{q}
\end{array}\right]\left[\begin{array}{c}
\boldsymbol{C} \\
\boldsymbol{C} \boldsymbol{A} \\
\vdots \\
\boldsymbol{C} \boldsymbol{A}^{n-1}
\end{array}\right] \boldsymbol{x}_{0} \tag{9-131}
\end{align*}
$$

式中， $\boldsymbol{I}_{q}$ 为 $q$ 阶单位阵。已知 $\left[\alpha_{0}(t) \boldsymbol{I}_{q} \cdots \alpha_{n-1}(t) \boldsymbol{I}_{q}\right]$ 的 $n q$ 列线性无关，于是根据测得的 $\boldsymbol{y}(t)$可唯一确定 $\boldsymbol{x}_{0}$ 的充分必要条件是

$$
\operatorname{rank} \boldsymbol{V}=\operatorname{rank}\left[\begin{array}{c}
\boldsymbol{C} \\
\boldsymbol{C A} \\
\vdots \\
\boldsymbol{C A}
\end{array}\right]=n
$$

这就是式（9－129）。
例 9－15 判断下列两个系统的可观测性。

$$
\dot{x}=A \boldsymbol{x}+B \boldsymbol{u}, \quad \boldsymbol{y}=\boldsymbol{C} x
$$

1） $\boldsymbol{A}=\left[\begin{array}{cc}-2 & 0 \\ 0 & -1\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{l}3 \\ 1\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{ll}1 & 0\end{array}\right]$ ；
2） $A=\left[\begin{array}{cc}1 & -1 \\ 1 & 1\end{array}\right], \quad B=\left[\begin{array}{cc}2 & -1 \\ 1 & 0\end{array}\right], \quad C=\left[\begin{array}{cc}1 & 0 \\ -1 & 1\end{array}\right]$ 。


<!-- source_pdf_page: 496 -->
解

1） $\operatorname{rank} \boldsymbol{V}=\operatorname{rank}\left[\begin{array}{ll}c^{\mathrm{T}} & \boldsymbol{A}^{\mathrm{T}} c^{\mathrm{T}}\end{array}\right]=\operatorname{rank}\left[\begin{array}{cc}1 & -2 \\ 0 & 0\end{array}\right]=1<n=2$ ，故系统不可观测。
2） $\operatorname{rank} \boldsymbol{V}=\operatorname{rank}\left[\begin{array}{ll}\boldsymbol{C}^{\mathrm{T}} & \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}}\end{array}\right]=\operatorname{rank}\left[\begin{array}{cccc}1 & -1 & 1 & 0 \\ 0 & 1 & -1 & 2\end{array}\right]=2=n$ ，故系统可观测。

PBH 秩判据 线性定常连续系统（9－124）完全可观测的充分必要条件是，对矩阵 $\boldsymbol{A}$ 的所有特征值 $\lambda_{i}(i=1,2, \cdots, n)$ ，均有

$$
\operatorname{rank}\left[\begin{array}{c}
\boldsymbol{C}  \tag{9-132}\\
\lambda_{i} \boldsymbol{I}-\boldsymbol{A}
\end{array}\right]=n ; \quad i=1,2, \cdots, n
$$

或等价地表示为

$$
\operatorname{rank}\left[\begin{array}{c}
\boldsymbol{C}  \tag{9-133}\\
s \boldsymbol{I}-\boldsymbol{A}
\end{array}\right]=n ; \quad \forall s \in C
$$

对角线规范型判据 线性定常连续系统（9－124）完全可观测的充分必要条件是：
当矩阵 $\boldsymbol{A}$ 的特征值 $\lambda_{1}, \lambda_{2}, \cdots, \lambda_{n}$ 两两相异时，由式（9－124）线性变换导出的对角线规范型为

$$
\dot{\bar{x}}=\left[\begin{array}{cccc}
\lambda_{1} & & & 0  \tag{9-134}\\
& \lambda_{2} & & \\
& & \ddots & \\
0 & & & \lambda_{n}
\end{array}\right] \bar{x}, \quad y=\bar{C} \bar{x}
$$

式中，$\overline{\boldsymbol{C}}$ 不包含元素全为零的列。
例 9－16 已知线性定常连续系统的对角线规范型为

$$
\dot{\bar{x}}=\left[\begin{array}{ccc}
8 & 0 & 0 \\
0 & -1 & 0 \\
0 & 0 & 2
\end{array}\right] \bar{x}, \quad y=\left[\begin{array}{lll}
1 & 0 & 0 \\
0 & 2 & 3
\end{array}\right] \bar{x}
$$

试判定系统的可观测性。
解 显然，此规范型中 $\bar{C}$ 不包含元素全为零的列，故系统为完全可观测。
6．线性离散时间系统的可控性和可观测性
线性离散时间系统简称为线性离散系统。由于线性定常离散系统只是线性时变离散系统的一种特殊类型，为便于读者全面理解基本概念，我们利用线性时变离散系统给出有关定义，而在介绍可控性和可观测性判据时，受篇幅限制，则仅限于线性定常离散系统。
（1）线性离散系统的可控性和可达性
设线性时变离散时间系统的状态方程为

$$
\begin{equation*}
\boldsymbol{x}(k+1)=\boldsymbol{G}(k) \boldsymbol{x}(k)+\boldsymbol{H}(k) \boldsymbol{u}(k), \quad k \in T_{k} \tag{9-135}
\end{equation*}
$$

其中 $T_{k}$ 为离散时间定义区间。如果对初始时刻 $l \in T_{k}$ 和状态空间中的所有非零状态 $\boldsymbol{x}(l)$ ，都存在时刻 $m \in T_{k}, m>l$ ，和对应的控制 $\boldsymbol{u}(k)$ ，使得 $\boldsymbol{x}(m)=\mathbf{0}$ ，则称系统在时刻 $l$ 为完全可



<!-- source_pdf_page: 497 -->
控。对应地，如果对初始时刻 $l \in T_{k}$ 和初始状态 $\boldsymbol{x}(l)=\mathbf{0}$ ，存在时刻 $m \in T_{k}, m>l$ ，和相应的控制 $\boldsymbol{u}(k)$ ，使 $\boldsymbol{x}(m)$ 可为状态空间中的任意非零点，则称系统在时刻 $l$ 为完全可达。

对于离散时间系统，不管是时变的还是定常的，其可控性和可达性只有在一定条件下才是等价的。业已证明，其等价的条件分别如下：
1）线性离散时间系统（9－135）的可控性和可达性为等价的充分必要条件是，系统矩阵$\boldsymbol{G}(k)$ 对所有 $k \in[l, m-1]$ 为非奇异。
2）线性定常离散时间系统

$$
\begin{equation*}
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{H} \boldsymbol{u}(k) ; \quad k=0,1,2, \cdots \tag{9-136}
\end{equation*}
$$

的可控性和可达性等价的充分必要条件是系统矩阵 $\boldsymbol{G}$ 为非奇异。
3）如果线性离散时间系统（9－135）或（9－136）是相应连续时间系统的时间离散化模型，则其可控性和可达性必是等价的。

线性定常离散系统的可控性判据 设单输人线性定常离散系统的状态方程为

$$
\begin{equation*}
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{h} u(k) \tag{9-137}
\end{equation*}
$$

式中， $\boldsymbol{x}$ 为 $n$ 维状态向量；$u$ 为标量输人； $\boldsymbol{G}$ 为 $n \times n$ 非奇异矩阵。状态方程（9－137）的解为

$$
\begin{equation*}
\boldsymbol{x}(k)=\boldsymbol{G}^{k} \boldsymbol{x}(0)+\sum_{i=0}^{k-1} \boldsymbol{G}^{k-1-i} \boldsymbol{h} u(i) \tag{9-138}
\end{equation*}
$$

根据可控性定义，假定 $k=n$ 时， $\boldsymbol{x}(n)=\mathbf{0}$ ，将式（9－138）两端左乘 $\boldsymbol{G}^{-n}$ ，则有

$$
\begin{align*}
x(0) & =-\sum_{i=0}^{n-1} G^{-1-i} h u(i) \\
& =-\left[G^{-1} h u(0)+G^{-2} h u(1)+\cdots+G^{-n} h u(n-1)\right] \\
& =-\left[\begin{array}{llll}
G^{-1} h & G^{-2} h & \cdots & G^{-n} h
\end{array}\right]\left[\begin{array}{c}
u(0) \\
u(1) \\
\vdots \\
u(n-1)
\end{array}\right] \tag{9-139}
\end{align*}
$$

记

$$
S_{1}^{\prime}=\left[\begin{array}{llll}
G^{-1} h & G^{-2} h & \cdots & G^{-n} h \tag{9-140}
\end{array}\right]
$$

称 $\boldsymbol{S}_{1}^{\prime}$ 为 $n \times n$ 可控性矩阵。式（9－139）是一个非奇异线性方程组，含 $n$ 个方程，有 $n$ 个未知数 $u(0), u(1), \cdots, u(n-1)$ 。由线性方程组解的存在定理可知，当矩阵 $\boldsymbol{S}_{1}^{\prime}$ 的秩与增广矩阵$\left[\boldsymbol{S}_{1}^{\prime} \mid \boldsymbol{x}(0)\right]$ 的秩相等时，方程组有解且为唯一解，否则无解。在 $\boldsymbol{x}(0)$ 为任意的情况下，使方程组有解的充分必要条件是矩阵 $S_{1}^{\prime}$ 满秩，即

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{S}_{1}^{\prime}=n \tag{9-141}
\end{equation*}
$$

或矩阵 $\boldsymbol{S}_{1}^{\prime}$ 的行列式不为零

$$
\begin{equation*}
\operatorname{det} \boldsymbol{S}_{1}^{\prime} \neq 0 \tag{9-142}
\end{equation*}
$$

或矩阵 $\boldsymbol{S}_{1}^{\prime}$ 是非奇异的。
由于满秩矩阵与另一满秩矩阵 $\boldsymbol{G}^{n}$ 相乘其秩不变，故

$$
\operatorname{rank} \boldsymbol{S}_{1}^{\prime}=\operatorname{rank}\left[\boldsymbol{G}^{n} \boldsymbol{S}_{1}^{\prime}\right]=\operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{G}^{n-1} \boldsymbol{h} & \cdots & \boldsymbol{G} \boldsymbol{h} & \boldsymbol{h} \tag{9-143}
\end{array}\right]=n
$$



<!-- source_pdf_page: 498 -->
交换矩阵的列，且记为 $\boldsymbol{S}_{1}$ ，其秩也不变，故有

$$
\operatorname{rank} \boldsymbol{S}_{1}=\operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{h} & \boldsymbol{G} \boldsymbol{h} & \cdots & \boldsymbol{G}^{n-1} \boldsymbol{h} \tag{9-144}
\end{array}\right]=n
$$

由于式（9－144）避免了矩阵求逆，在判断系统的可控性时，使用式（9－144）比较方便。
式（9－141）～式（9－144）都称为可控性判据， $\boldsymbol{S}_{1}^{\prime}$ 和 $\boldsymbol{S}_{1}$ 都称为单输人离散系统的可控性矩阵。状态可控性取决于 $\boldsymbol{G}$ 和 $\boldsymbol{h}$ 。

当 $\operatorname{rank} \boldsymbol{S}_{1}<n$ 时，系统不可控，表示不存在使任意 $\boldsymbol{x}(0)$ 转移至 $\boldsymbol{x}(n)=\mathbf{0}$ 的控制。
以上研究了终态为 $\boldsymbol{x}(n)=\mathbf{0}$ 的情况，若令终态为任意给定状态 $\boldsymbol{x}(n)$ ，则式（9－138）变为

$$
\boldsymbol{G}^{n} \boldsymbol{x}(0)-\boldsymbol{x}(n)=-\sum_{i=0}^{n-1} \boldsymbol{G}^{n-1-i} \boldsymbol{h} u(i)
$$

将上式两端左乘 $G^{-n}$ ，有

$$
\boldsymbol{x}(0)-\boldsymbol{G}^{-n} \boldsymbol{x}(n)=-\left[\begin{array}{llll}
\boldsymbol{G}^{-1} \boldsymbol{h} & \boldsymbol{G}^{-2} \boldsymbol{h} & \cdots & \boldsymbol{G}^{-n} \boldsymbol{h}
\end{array}\right]\left[\begin{array}{c}
u(0) \\
u(1) \\
\vdots \\
u(n-1)
\end{array}\right]
$$

当 $\boldsymbol{G}$ 满秩时，该式左端只不过是任意给定的另一初态，其状态可控性条件可用以上推导方法得出完全相同的结论。若令 $\boldsymbol{x}(0)=\mathbf{0}$ ，上述结论同样成立。可见，当 $\boldsymbol{G}$ 为非奇异阵时，系统的可控性和可达性是等价的。

上述研究单输人离散系统可控性的方法可推广到多输人系统。设系统的状态方程为

$$
\begin{equation*}
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{H} \boldsymbol{u}(k) \tag{9-145}
\end{equation*}
$$

所谓可控性问题即是能否求出无约束控制向量序列 $\boldsymbol{u}(0), \boldsymbol{u}(1), \cdots, \boldsymbol{u}(n-1)$ ，使系统能从任意初态 $\boldsymbol{x}(0)$ 转移至 $\boldsymbol{x}(n)=\mathbf{0}$ 。式（9－145）的解为

$$
\begin{equation*}
\boldsymbol{x}(k)=\boldsymbol{G}^{k} \boldsymbol{x}(0)+\sum_{i=0}^{k-1} \boldsymbol{G}^{k-1-i} \boldsymbol{H} \boldsymbol{u}(i) \tag{9-146}
\end{equation*}
$$

令 $k=n, \quad \boldsymbol{x}(n)=\mathbf{0}$ ，且式（9－146）两端左乘 $\boldsymbol{G}^{-n}$ ，有

$$
\begin{align*}
\boldsymbol{x}(0) & =-\sum_{i=0}^{n-1} \boldsymbol{G}^{-1-i} \boldsymbol{H u}(i)=-\left[\boldsymbol{G}^{-1} \boldsymbol{H u}(0)+\boldsymbol{G}^{-2} \boldsymbol{H u}(1)+\cdots+\boldsymbol{G}^{-n} \boldsymbol{H u}(n-1)\right] \\
& =-\left[\begin{array}{llll}
\boldsymbol{G}^{-1} \boldsymbol{H} & \boldsymbol{G}^{-2} \boldsymbol{H} & \cdots & \boldsymbol{G}^{-n} \boldsymbol{H}
\end{array}\right]\left[\begin{array}{c}
\boldsymbol{u}(0) \\
\boldsymbol{u}(1) \\
\vdots \\
\boldsymbol{u}(n-1)
\end{array}\right] \tag{9-147}
\end{align*}
$$

记

$$
\boldsymbol{S}_{2}^{\prime}=\left[\begin{array}{llll}
\boldsymbol{G}^{-1} \boldsymbol{H} & \boldsymbol{G}^{-2} \boldsymbol{H} & \cdots & \boldsymbol{G}^{-n} \boldsymbol{H} \tag{9-148}
\end{array}\right]
$$

为 $n \times n p$ 矩阵，由子列向量 $\boldsymbol{u}(0), \boldsymbol{u}(1), \cdots, \boldsymbol{u}(n-1)$ 构成的控制列向量是 $n p$ 维的。式（9－147）含 $n$ 个方程，但有 $n p$ 个待求的控制量。由于初态 $\boldsymbol{x}(0)$ 可任意给定，根据解存在定理，矩阵 $\boldsymbol{S}_{2}^{\prime}$ 的秩为 $n$ 时，方程组才有解。于是多输人线性离散系统状态可控的充分必要条件是

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{S}_{2}^{\prime}=n \tag{9-149}
\end{equation*}
$$



<!-- source_pdf_page: 499 -->
或

$$
\operatorname{rank} \boldsymbol{S}_{2}^{\prime}=\operatorname{rank}\left[\boldsymbol{G}^{n} \boldsymbol{S}_{2}^{\prime}\right]=\operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{G}^{n-1} \boldsymbol{H} & \cdots & \boldsymbol{G} \boldsymbol{H} & \boldsymbol{H} \tag{9-150}
\end{array}\right]=n
$$

或

$$
\operatorname{rank} \boldsymbol{S}_{2}=\operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{H} & \boldsymbol{G} \boldsymbol{H} & \cdots & \boldsymbol{G}^{n-1} \boldsymbol{H} \tag{9-151}
\end{array}\right]=n
$$

式（9－149）～式（9－151）都是多输人线性离散系统的可控性判据，通常使用式（9－151）较为方便。应当指出：
1）由于式（9－147）中方程个数少于未知量个数，方程组的解便不唯一，任意假定 $n p-n$个控制量，其余 $n$ 个控制量才能唯一确定。多输人线性离散系统控制序列的选择，通常具有无穷多种方式。
2）由于 $\boldsymbol{S}_{2}$ 的行数总小于列数，因而在列写 $\boldsymbol{S}_{2}$ 时，只要所选取的列能判断出 $\boldsymbol{S}_{2}$ 的秩为 $n$ ，便不必再将 $\boldsymbol{S}_{2}$ 的其余列都列写出来。
3）多输人线性定常离散系统由任意初态转移至原点一般可少于 $n$ 个采样周期。
例 9－17 设单输人线性定常离散系统状态方程为

$$
\boldsymbol{x}(k+1)=\left[\begin{array}{ccc}
1 & 0 & 0 \\
0 & 2 & -2 \\
-1 & 1 & 0
\end{array}\right] \boldsymbol{x}(k)+\left[\begin{array}{l}
1 \\
0 \\
1
\end{array}\right] u(k)
$$

试判断其可控性；若初始状态 $\boldsymbol{x}(0)=\left[\begin{array}{lll}2 & 1 & 0\end{array}\right]^{\mathrm{T}}$ ，确定使 $\boldsymbol{x}(3)=\mathbf{0}$ 的控制序列 $u(0), u(1), u(2)$ ；研究使 $\boldsymbol{x}(2)=\mathbf{0}$ 的可能性。

解 由题意知

$$
\begin{gathered}
\boldsymbol{G}=\left[\begin{array}{ccc}
1 & 0 & 0 \\
0 & 2 & -2 \\
-1 & 1 & 0
\end{array}\right], \quad \boldsymbol{h}=\left[\begin{array}{l}
1 \\
0 \\
1
\end{array}\right] \\
\operatorname{rank} \boldsymbol{S}_{1}=\operatorname{rank}\left[\begin{array}{lll}
\boldsymbol{h} & \boldsymbol{G} \boldsymbol{h} & \boldsymbol{G}^{2} \boldsymbol{h}
\end{array}\right]=\operatorname{rank}\left[\begin{array}{ccc}
1 & 1 & 1 \\
0 & -2 & -2 \\
1 & -1 & -3
\end{array}\right]=3=n
\end{gathered}
$$

故系统可控。可按式（9－139）求出 $u(0) 、 u(1) 、 u(2)$ ，为了减少求逆阵的麻烦，现用递推法来求。令 $k=0,1,2$ ，可得状态序列

$$
\begin{aligned}
& \boldsymbol{x}(1)=\boldsymbol{G} \boldsymbol{x}(0)+\boldsymbol{h} u(0)=\left[\begin{array}{ccc}
1 & 0 & 0 \\
0 & 2 & -2 \\
-1 & 1 & 0
\end{array}\right]\left[\begin{array}{l}
2 \\
1 \\
0
\end{array}\right]+\left[\begin{array}{l}
1 \\
0 \\
1
\end{array}\right] u(0)=\left[\begin{array}{c}
2 \\
2 \\
-1
\end{array}\right]+\left[\begin{array}{l}
1 \\
0 \\
1
\end{array}\right] u(0) \\
& \boldsymbol{x}(2)=\boldsymbol{G} \boldsymbol{x}(1)+\boldsymbol{h} u(1)=\left[\begin{array}{l}
2 \\
6 \\
0
\end{array}\right]+\left[\begin{array}{c}
1 \\
-2 \\
-1
\end{array}\right] u(0)+\left[\begin{array}{l}
1 \\
0 \\
1
\end{array}\right] u(1) \\
& \boldsymbol{x}(3)=\boldsymbol{G} \boldsymbol{x}(2)+\boldsymbol{h} u(2)=\left[\begin{array}{c}
2 \\
12 \\
4
\end{array}\right]+\left[\begin{array}{c}
1 \\
-2 \\
-3
\end{array}\right] u(0)+\left[\begin{array}{c}
1 \\
-2 \\
-1
\end{array}\right] u(1)+\left[\begin{array}{l}
1 \\
0 \\
1
\end{array}\right] u(2)
\end{aligned}
$$

令 $\boldsymbol{x}(3)=\mathbf{0}$ ，则有



<!-- source_pdf_page: 500 -->
$$
\left[\begin{array}{ccc}
1 & 1 & 1 \\
-2 & -2 & 0 \\
-3 & -1 & 1
\end{array}\right]\left[\begin{array}{c}
u(0) \\
u(1) \\
u(2)
\end{array}\right]=\left[\begin{array}{c}
-2 \\
-12 \\
-4
\end{array}\right]
$$

其系数矩阵即可控性矩阵 $\boldsymbol{S}_{1}$ 是非奇异的，因而可得

$$
\left[\begin{array}{c}
u(0) \\
u(1) \\
u(2)
\end{array}\right]=\left[\begin{array}{ccc}
1 & 1 & 1 \\
-2 & -2 & 0 \\
-3 & -1 & 1
\end{array}\right]^{-1}\left[\begin{array}{c}
-2 \\
-12 \\
-4
\end{array}\right]=\left[\begin{array}{ccc}
\frac{1}{2} & \frac{1}{2} & -\frac{1}{2} \\
-\frac{1}{2} & -1 & \frac{1}{2} \\
1 & \frac{1}{2} & 0
\end{array}\right]\left[\begin{array}{c}
-2 \\
-12 \\
-4
\end{array}\right]=\left[\begin{array}{c}
-5 \\
11 \\
-8
\end{array}\right]
$$

若令 $\boldsymbol{x}(2)=\mathbf{0}$ ，即解方程组

$$
\left[\begin{array}{cc}
1 & 1 \\
-2 & 0 \\
-1 & 1
\end{array}\right]\left[\begin{array}{c}
u(0) \\
u(1)
\end{array}\right]=\left[\begin{array}{c}
-2 \\
-6 \\
0
\end{array}\right]
$$

容易看出其系数矩阵的秩为 2，但增广矩阵

$$
\left[\begin{array}{cc:c}
1 & 1 & -2 \\
-2 & 0 & -6 \\
-1 & 1 & 0
\end{array}\right]
$$

的秩为3，两个秩不等，方程组无解，意味着不能在两个采样周期内使系统由初始状态转移至原点。若该两个秩相等，则可用两步完成状态转移。
（2）线性离散系统的可观测性
设离散系统为

$$
\begin{gather*}
\boldsymbol{x}(k+1)=\boldsymbol{G}(k) \boldsymbol{x}(k)+\boldsymbol{H}(k) \boldsymbol{u}(k), \quad k \in T_{k} \\
\boldsymbol{y}(k)=\boldsymbol{C}(k) \boldsymbol{x}(k)+\boldsymbol{D}(k) \boldsymbol{u}(k) \tag{9-152}
\end{gather*}
$$

若对初始时刻 $l \in T_{k}$ 的任一非零初始状态 $x(l)=x_{0}$ ，都存在有限时刻 $m \in T_{k}, m>l$ ，且可由$[l, m]$ 上的输出 $\boldsymbol{y}(k)$ 唯一地确定 $\boldsymbol{x}_{0}$ ，则称系统在时刻 $l$ 是完全可观测的。

线性定常离散系统的可观测性判据 设线性定常离散系统的动态方程为

$$
\begin{equation*}
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{H} \boldsymbol{u}(k), \quad \boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{x}(k)+\boldsymbol{D} \boldsymbol{u}(k) \tag{9-153}
\end{equation*}
$$

式中， $\boldsymbol{x}(k)$ 为 $n$ 维状态向量； $\boldsymbol{y}(k)$ 为 $q$ 维输出向量，其解为

$$
\begin{gather*}
\boldsymbol{x}(k)=\boldsymbol{G}^{k} \boldsymbol{x}(0)+\sum_{i=0}^{k-1} \boldsymbol{G}^{k-1-i} \boldsymbol{H} \boldsymbol{u}(i)  \tag{9-154}\\
\boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{G}^{k} \boldsymbol{x}(0)+\boldsymbol{C} \sum_{i=0}^{k-1} \boldsymbol{G}^{k-1-i} \boldsymbol{H} \boldsymbol{u}(i)+\boldsymbol{D} \boldsymbol{u}(k) \tag{9-155}
\end{gather*}
$$

研究可观测性问题时， $\boldsymbol{u}(k) 、 \boldsymbol{G} 、 \boldsymbol{H} 、 \boldsymbol{C} 、 \boldsymbol{D}$ 均为已知，故不失一般性，可将动态方程简化为

$$
\begin{equation*}
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k), \quad \boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{x}(k) \tag{9-156}
\end{equation*}
$$

对应的解为

$$
\begin{equation*}
\boldsymbol{x}(k)=\boldsymbol{G}^{k} \boldsymbol{x}(0), \quad \boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{G}^{k} \boldsymbol{x}(0) \tag{9-157}
\end{equation*}
$$



<!-- source_pdf_page: 501 -->
将 $y(k)$ 写成展开式

$$
\left\{\begin{array}{l}
\boldsymbol{y}(0)=\boldsymbol{C} \boldsymbol{x}(0)  \tag{9-158}\\
\boldsymbol{y}(1)=\boldsymbol{C} \boldsymbol{G} \boldsymbol{x}(0) \\
\vdots \\
\boldsymbol{y}(n-1)=\boldsymbol{C} \boldsymbol{G}^{n-1} \boldsymbol{x}(0)
\end{array}\right.
$$

其向量－矩阵形式为

$$
\begin{align*}
{\left[\begin{array}{c}
\boldsymbol{y}(0) \\
\boldsymbol{y}(1) \\
\vdots \\
\boldsymbol{y}(n-1)
\end{array}\right] } & =\left[\begin{array}{c}
\boldsymbol{C} \\
\boldsymbol{C} \boldsymbol{G} \\
\vdots \\
\boldsymbol{C} \boldsymbol{G}^{n-1}
\end{array}\right]\left[\begin{array}{c}
x_{1}(0) \\
x_{2}(0) \\
\vdots \\
x_{n}(0)
\end{array}\right]  \tag{9-159}\\
\boldsymbol{V}_{1}^{\mathrm{T}} & =\left[\begin{array}{c}
\boldsymbol{C} \\
\boldsymbol{C} \boldsymbol{G} \\
\vdots \\
\boldsymbol{C} \boldsymbol{G}^{n-1}
\end{array}\right] \tag{9-160}
\end{align*}
$$

$\boldsymbol{V}_{1}^{\mathrm{T}}$ 称为线性定常离散系统的可观测性矩阵，为 $n q \times n$ 矩阵。式（9－159）含有 $n q$ 个方程，若其中有 $n$ 个独立方程，便可确定唯一的一组 $x_{1}(0), x_{2}(0), \cdots, x_{n}(0)$ 。当独立方程个数大于 $n$ 时，解会出现矛盾；当独立方程个数小于 $n$ 时，便有无穷多解。故系统可观测的充分必要条件为

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{V}_{1}^{\mathrm{T}}=n \tag{9-161}
\end{equation*}
$$

由于 $\operatorname{rank} \boldsymbol{V}_{1}^{\mathrm{T}}=\operatorname{rank} \boldsymbol{V}_{1}$ ，故线性定常离散系统的可观测性判据常表示为

$$
\operatorname{rank} \boldsymbol{V}_{1}=\operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{C}^{\mathrm{T}} & \boldsymbol{G}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \cdots & \left(\boldsymbol{G}^{\mathrm{T}}\right)^{n-1} \boldsymbol{C}^{\mathrm{T}} \tag{9-162}
\end{array}\right]=n
$$

例 9－18 已知线性定常离散系统的动态方程为

$$
\boldsymbol{x}(k+1)=\boldsymbol{G} \boldsymbol{x}(k)+\boldsymbol{h} u(k), \quad \boldsymbol{y}(k)=\boldsymbol{C} \boldsymbol{x}(k), \quad i=1,2
$$

其中

$$
\boldsymbol{G}=\left[\begin{array}{ccc}
1 & 0 & -1 \\
0 & -2 & 1 \\
3 & 0 & 2
\end{array}\right], \quad \boldsymbol{h}=\left[\begin{array}{c}
2 \\
-1 \\
1
\end{array}\right], \quad \boldsymbol{c}_{1}=\left[\begin{array}{lll}
0 & 1 & 0
\end{array}\right], \quad \boldsymbol{C}_{2}=\left[\begin{array}{lll}
0 & 0 & 1 \\
1 & 0 & 0
\end{array}\right]
$$

试判断系统的可观测性，并讨论可观测性的物理解释。
解 当观测矩阵为 $c_{1}$ 时，

$$
\begin{gathered}
\boldsymbol{c}_{1}^{\mathrm{T}}=\left[\begin{array}{l}
0 \\
1 \\
0
\end{array}\right], \quad \boldsymbol{G}^{\mathrm{T}} \boldsymbol{c}_{1}^{\mathrm{T}}=\left[\begin{array}{c}
0 \\
-2 \\
1
\end{array}\right], \quad\left(\boldsymbol{G}^{\mathrm{T}}\right)^{2} \boldsymbol{c}_{1}^{\mathrm{T}}=\left[\begin{array}{l}
3 \\
4 \\
0
\end{array}\right] \\
\operatorname{rank} \boldsymbol{V}_{1}=\operatorname{rank}\left[\begin{array}{ccc}
0 & 0 & 3 \\
1 & -2 & 4 \\
0 & 1 & 0
\end{array}\right]=3=n
\end{gathered}
$$

故系统可观测。由输出方程 $y(k)=\boldsymbol{c}_{1} \boldsymbol{x}(k)=x_{2}(k)$ 可见，在第 $k$ 步便可由输出确定状态变量 $x_{2}(k)$ 。



<!-- source_pdf_page: 502 -->
由于

$$
y(k+1)=x_{2}(k+1)=-2 x_{2}(k)+x_{3}(k)
$$

故在第 $k+1$ 步便可确定 $x_{3}(k)$ 。由于

$$
\begin{aligned}
y(k+2) & =x_{2}(k+2)=-2 x_{2}(k+1)+x_{3}(k+1) \\
& =-2\left[-2 x_{2}(k)+x_{3}(k)\right]+3 x_{1}(k)+2 x_{3}(k)=4 x_{2}(k)+3 x_{1}(k)
\end{aligned}
$$

故在第 $k+2$ 步便可确定 $x_{1}(k)$ 。
该系统为三阶系统，可观测意味着至多三步便可由输出 $y(k), y(k+1), y(k+2)$ 的测量值来确定三个状态变量。

当观测矩阵为 $\boldsymbol{C}_{2}$ 时，

$$
\begin{aligned}
& \boldsymbol{C}_{2}^{\mathrm{T}}=\left[\begin{array}{ll}
0 & 1 \\
0 & 0 \\
1 & 0
\end{array}\right], \quad \boldsymbol{G}^{\mathrm{T}} \boldsymbol{C}_{2}^{\mathrm{T}}=\left[\begin{array}{cc}
3 & 1 \\
0 & 0 \\
2 & -1
\end{array}\right], \quad\left(\boldsymbol{G}^{\mathrm{T}}\right)^{2} \boldsymbol{C}_{2}^{\mathrm{T}}=\left[\begin{array}{cc}
9 & -2 \\
0 & 0 \\
1 & -3
\end{array}\right] \\
& \operatorname{rank} \boldsymbol{V}_{1}=\operatorname{rank}\left[\begin{array}{cccccc}
0 & 1 & 3 & 1 & 9 & -2 \\
0 & 0 & 0 & 0 & 0 & 0 \\
1 & 0 & 2 & -1 & 1 & -3
\end{array}\right]=2 \neq n=3
\end{aligned}
$$

故系统不可观测。
根据系统动态方程可导出

$$
\begin{aligned}
& y(k)=\left[\begin{array}{l}
x_{3}(k) \\
x_{1}(k)
\end{array}\right] \\
& y(k+1)=\left[\begin{array}{l}
x_{3}(k+1) \\
x_{1}(k+1)
\end{array}\right]=\left[\begin{array}{c}
3 x_{1}(k)+2 x_{3}(k) \\
x_{1}(k)-x_{3}(k)
\end{array}\right] \\
& y(k+2)=\left[\begin{array}{l}
x_{3}(k+2) \\
x_{1}(k+2)
\end{array}\right]=\left[\begin{array}{c}
3 x_{1}(k+1)+2 x_{3}(k+1) \\
x_{1}(k+1)-x_{3}(k+1)
\end{array}\right]=\left[\begin{array}{c}
9 x_{1}(k)+x_{3}(k) \\
-2 x_{1}(k)-3 x_{3}(k)
\end{array}\right]
\end{aligned}
$$

可看出三步的输出测量值中始终不含 $x_{2}(k)$ ，故 $x_{2}(k)$ 是不可观测状态变量。只要有一个状态变量不可观测，则称系统不完全可观测，简称不可观测。
（3）连续动态方程离散化后的可控性和可观测性
一个可控的或可观测的连续系统，当其离散化后并不一定能保持其可控性或可观测性，现举例来说明。

设连续系统动态方程为

$$
\left[\begin{array}{l}
\dot{x}_{1} \\
\dot{x}_{2}
\end{array}\right]=\left[\begin{array}{cc}
0 & 1 \\
-\omega^{2} & 0
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]+\left[\begin{array}{l}
0 \\
1
\end{array}\right] u, \quad y=\left[\begin{array}{ll}
0 & 1
\end{array}\right]\left[\begin{array}{l}
x_{1} \\
x_{2}
\end{array}\right]
$$

由于系统的状态方程为可控标准型，故一定可控。根据可观测性判据，有

$$
\operatorname{rank} \boldsymbol{V}_{1}=\operatorname{rank}\left[\begin{array}{ll}
1 & 0 \\
0 & 1
\end{array}\right]=2=n
$$

故系统可观测。
系统的状态转移矩阵为



<!-- source_pdf_page: 503 -->
$$
\begin{gathered}
\Phi(t)=\mathscr{S}^{-1}\left[(s \boldsymbol{I}-\boldsymbol{A})^{-1}\right]=\mathscr{T}^{-1}\left[\begin{array}{cc}
s & -1 \\
\omega^{2} & s
\end{array}\right]^{-1}=\mathscr{T}^{-1}\left[\begin{array}{cc}
\frac{s}{s^{2}+\omega^{2}} & \frac{1}{s^{2}+\omega^{2}} \\
\frac{-\omega^{2}}{s^{2}+\omega^{2}} & \frac{s}{s^{2}+\omega^{2}}
\end{array}\right] \\
=\left[\begin{array}{cc}
\cos \omega t & \frac{\sin \omega t}{\omega} \\
-\omega \sin \omega t & \cos \omega t
\end{array}\right] \\
\boldsymbol{G}(t)=\int_{0}^{t} \Phi(\tau) \boldsymbol{b} \mathrm{d} \tau=\int_{0}^{T}\left[\begin{array}{c}
\frac{\sin \omega \tau}{\omega} \\
\cos \omega \tau
\end{array}\right] \mathrm{d} \tau=\left[\begin{array}{c}
\frac{1-\cos \omega t}{\omega^{2}} \\
\frac{\sin \omega t}{\omega}
\end{array}\right]
\end{gathered}
$$

系统离散化后的状态方程为

$$
\begin{aligned}
\boldsymbol{x}(k+1) & =\Phi(T) \boldsymbol{x}(k)+\boldsymbol{G}(T) u(k) \\
& =\left[\begin{array}{cc}
\cos \omega T & \frac{\sin \omega T}{\omega} \\
-\omega \sin \omega T & \cos \omega T
\end{array}\right]\left[\begin{array}{l}
x_{1}(k) \\
x_{2}(k)
\end{array}\right]+\left[\begin{array}{c}
\frac{1-\cos \omega T}{\omega^{2}} \\
\frac{\sin \omega T}{\omega}
\end{array}\right] u(k)
\end{aligned}
$$

离散化后系统的可控性矩阵为

$$
\boldsymbol{S}_{1}=\left[\begin{array}{ll}
\boldsymbol{G}(T) & \Phi(T) \boldsymbol{G}(T)
\end{array}\right]=\left[\begin{array}{cc}
\frac{1-\cos \omega T}{\omega^{2}} & \frac{\cos \omega T-\cos ^{2} \omega T+\sin ^{2} \omega T}{\omega^{2}} \\
\frac{\sin \omega T}{\omega} & \frac{2 \sin \omega T \cos \omega T-\sin \omega T}{\omega}
\end{array}\right]
$$

离散化后系统的可观测性矩阵为

$$
\boldsymbol{V}_{1}=\left[\begin{array}{ll}
\boldsymbol{C}^{\mathrm{T}} & \Phi^{\mathrm{T}}(T) \boldsymbol{C}^{\mathrm{T}}
\end{array}\right]=\left[\begin{array}{lc}
1 & \cos \omega T \\
0 & \frac{\sin \omega T}{\omega}
\end{array}\right]
$$

当采样周期 $T=\frac{k \pi}{\omega}(k=1,2, \cdots)$ 时，可控性矩阵 $S_{1}$ 和可观测性矩阵 $V_{1}$ 均出现零行，$\operatorname{rank} \boldsymbol{S}_{1}=1<n$ ，rank $\boldsymbol{V}_{1}=1<n$ ，系统不可控也不可观测。这表明连续系统可控或可观测时，若采样周期选择不当，对应的离散化系统便有可能不可控或不可观测，也有可能既不可控又不可观测。若连续系统不可控或不可观测，不管采样周期 T 如何选择，离散化后的系统一定是不可控或不可观测的。

## 7．线性定常系统的线性变换

为便于对系统进行分析和综合设计，经常需要对系统进行各种非奇异变换，例如将 $A$ 阵对角化、约当化、将 $\{\boldsymbol{A}, \boldsymbol{b}\}$ 化为可控标准型，将 $\{\boldsymbol{A}, \boldsymbol{c}\}$ 化为可观测标准型等，本小节将介绍在线性定常系统研究中常用的一些线性变换方法及非奇异线性变换的一些不变特性。
（1）状态空间表达式的线性变换
在研究线性定常连续系统状态空间表达式的建立方法时可以看到，选取不同的状态



<!-- source_pdf_page: 504 -->
变量便有不同形式的动态方程。若两组状态变量之间用一个非奇异矩阵联系着，则两组动态方程的系数矩阵与该非奇异矩阵有确定关系。

设系统动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}+\boldsymbol{b} u, \quad y=\boldsymbol{c} \boldsymbol{x} \tag{9-163}
\end{equation*}
$$

令

$$
\begin{equation*}
x=P \bar{x} \tag{9-164}
\end{equation*}
$$

式中， $\boldsymbol{P}$ 为非奇异线性变换矩阵，它将 $\boldsymbol{x}$ 变换为 $\overline{\boldsymbol{x}}$ ，变换后的动态方程为

$$
\begin{equation*}
\dot{\overline{\boldsymbol{x}}}=\overline{\boldsymbol{A}} \overline{\boldsymbol{x}}+\overline{\boldsymbol{b}} u, \quad \bar{y}=\overline{\boldsymbol{c} \boldsymbol{x}}=y \tag{9-165}
\end{equation*}
$$

式中

$$
\begin{equation*}
\bar{A}=P^{-1} A P, \quad \bar{b}=P^{-1} b, \quad \bar{c}=c P \tag{9-166}
\end{equation*}
$$

并称为对系统进行 $P$ 变换。对系统进行线性变换的目的在于使 $\bar{A}$ 阵规范化，以便揭示系统特性及分析计算，并不会改变系统的原有性质，故称为等价变换。待获得所需结果之后，再引入反变换关系 $\overline{\boldsymbol{x}}=\boldsymbol{P}^{-1} \boldsymbol{x}$ ，换算回原来的状态空间中去，得出最终结果。

下面概括给出本章中常用的几种线性变换关系。
1）化 $\boldsymbol{A}$ 阵为对角型。
（1）设 $\boldsymbol{A}$ 阵为任意形式的方阵，且有 $n$ 个互异实数特征值 $\lambda_{1}, \lambda_{2}, \cdots, \lambda_{n}$ ，则可由非奇异线性变换化为对角阵 $\Lambda$ 。

$$
\boldsymbol{\Lambda}=\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}=\left[\begin{array}{cccc}
\lambda_{1} & & & 0  \tag{9-167}\\
& \lambda_{2} & & \\
& & \ddots & \\
0 & & & \lambda_{n}
\end{array}\right]
$$

$\boldsymbol{P}$ 阵由 $\boldsymbol{A}$ 阵的实数特征向量 $p_{i}(i=1,2, \cdots, n)$ 组成

$$
\boldsymbol{P}=\left[\begin{array}{llll}
p_{1} & p_{2} & \cdots & p_{n} \tag{9-168}
\end{array}\right]
$$

特征向量满足

$$
\begin{equation*}
\boldsymbol{A} \boldsymbol{p}_{i}=\lambda_{i} P_{i}, \quad i=1,2, \cdots, n \tag{9-169}
\end{equation*}
$$

（2）若 $\boldsymbol{A}$ 阵为友矩阵，且有 $n$ 个互异实数特征值 $\lambda_{1}, \lambda_{2}, \cdots, \lambda_{n}$ ，则下列的范德蒙德（Vandermonde）矩阵 $\boldsymbol{P}$ 可使 $\boldsymbol{A}$ 对角化：

$$
\boldsymbol{A}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0  \tag{9-170}\\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right], \quad \boldsymbol{P}=\left[\begin{array}{cccc}
1 & 1 & \cdots & 1 \\
\lambda_{1} & \lambda_{2} & \cdots & \lambda_{n} \\
\lambda_{1}^{2} & \lambda_{2}^{2} & \cdots & \lambda_{n}^{2} \\
\vdots & \vdots & & \vdots \\
\lambda_{1}^{n-1} & \lambda_{2}^{n-1} & \cdots & \lambda_{n}^{n-1}
\end{array}\right]
$$

2）化 $\boldsymbol{A}$ 阵为约当型。
设 $\boldsymbol{A}$ 阵具有 $m$ 重实特征值 $\lambda_{1}$ ，其余为 $n-m$ 个互异实特征值，但在求解 $\boldsymbol{A} \boldsymbol{p}_{i}=\lambda_{1} \boldsymbol{p}_{i}$ 时只有一个独立实特征向量 $\boldsymbol{p}_{1}$ ，则只能使 $\boldsymbol{A}$ 化为约当阵 $\boldsymbol{J}$ 。



<!-- source_pdf_page: 505 -->
$$
\boldsymbol{J}=\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}=\left[\begin{array}{cccc:ccc}
\lambda_{1} & 1 & & & & &  \tag{9-171}\\
& \lambda_{1} & \ddots & & & 0 & \\
& & \ddots & 1 & & & \\
& & & \lambda_{1} & & & \\
\hdashline & 0 & & & \ddots & \\
& & & & & \lambda_{n}
\end{array}\right]
$$

$J$ 中虚线示出存在一个约当块。

$$
\boldsymbol{P}=\left[\begin{array}{llll|lll}
\boldsymbol{p}_{1} & p_{2} & \cdots & p_{m} & p_{m+1} & \cdots & p_{n} \tag{9-172}
\end{array}\right]
$$

式中，$p_{2}, p_{3}, \cdots, p_{m}$ 是广义实特征向量，满足

$$
\left[\begin{array}{llll}
\boldsymbol{p}_{1} & \boldsymbol{p}_{2} & \cdots & \boldsymbol{p}_{m}
\end{array}\right]\left[\begin{array}{cccc}
\lambda_{1} & 1 & & 0  \tag{9-173}\\
& \lambda_{1} & \ddots & \\
& & \ddots & 1 \\
0 & & & \lambda_{1}
\end{array}\right]=\boldsymbol{A}\left[\begin{array}{llll}
\boldsymbol{p}_{1} & \boldsymbol{p}_{2} & \cdots & \boldsymbol{p}_{m}
\end{array}\right]
$$

$p_{m+1}, \cdots, p_{n}$ 是互异特征值对应的实特征向量。
3）化可控系统为可控标准型。
在前面研究状态空间表达式的建立问题时，曾得出单输入线性定常系统状态方程的可控标准型：

$$
\left[\begin{array}{c}
\dot{x}_{1}  \tag{9-174}\\
\dot{x}_{2} \\
\vdots \\
\dot{x}_{n-1} \\
\dot{x}_{n}
\end{array}\right]=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right]\left[\begin{array}{c}
x_{1} \\
x_{2} \\
\vdots \\
x_{n-1} \\
x_{n}
\end{array}\right]+\left[\begin{array}{c}
0 \\
0 \\
\vdots \\
0 \\
1
\end{array}\right] u
$$

与该状态方程对应的可控性矩阵 $\boldsymbol{S}$ 是一个右下三角阵，其主对角线元素均为 1 ，故 $\operatorname{det} \boldsymbol{S} \neq 0$ ，系统一定可控，这就是形如式（9－174）中的 $\boldsymbol{A}, \boldsymbol{b}$ 称为可控标准型名称的由来。其可控性矩阵 $\boldsymbol{S}$ 形如

$$
\boldsymbol{S}=\left[\begin{array}{llll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{b}
\end{array}\right]=\left[\begin{array}{cccccc}
0 & 0 & 0 & \cdots & 0 & 1  \tag{9-175}\\
0 & 0 & 0 & \cdots & 1 & -a_{n-1} \\
\vdots & \vdots & \vdots & & \vdots & \vdots \\
0 & 0 & 1 & \cdots & \times & \times \\
0 & 1 & -a_{n-1} & \cdots & \times & \times \\
1 & -a_{n-1} & -a_{n-2} & \cdots & \times & \times
\end{array}\right]
$$

一个可控系统，当 $\boldsymbol{A}, \boldsymbol{b}$ 不具有可控标准型时，一定可以选择适当的变换化为可控标准型。设系统状态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}+\boldsymbol{b} u \tag{9-176}
\end{equation*}
$$

进行 $\boldsymbol{P}^{-1}$ 变换，即令

$$
\begin{equation*}
x=P^{-1} z \tag{9-177}
\end{equation*}
$$



<!-- source_pdf_page: 506 -->
变换为

$$
\begin{gather*}
\dot{\boldsymbol{z}}=\boldsymbol{P A P}^{-1} \boldsymbol{z}+\boldsymbol{P b} u  \tag{9-178}\\
\boldsymbol{P A} \boldsymbol{P}^{-1}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right], \quad \boldsymbol{P b}=\left[\begin{array}{c}
0 \\
0 \\
\vdots \\
0 \\
1
\end{array}\right] \tag{9-179}
\end{gather*}
$$

要求

下面具体推导变换矩阵 $\boldsymbol{P}$ ：
设变换矩阵 $\boldsymbol{P}$ 为

$$
\boldsymbol{P}=\left[\begin{array}{llll}
\boldsymbol{p}_{1}^{\mathrm{T}} & \boldsymbol{p}_{2}^{\mathrm{T}} & \cdots & \boldsymbol{p}_{n}^{\mathrm{T}} \tag{9-180}
\end{array}\right]^{\mathrm{T}}
$$

根据 $\boldsymbol{A}$ 阵变换要求， $\boldsymbol{P}$ 应满足式（9－179），有

$$
\left[\begin{array}{c}
p_{1}  \tag{9-181}\\
p_{2} \\
\vdots \\
p_{n-1} \\
p_{n}
\end{array}\right] \boldsymbol{A}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right]\left[\begin{array}{c}
p_{1} \\
p_{2} \\
\vdots \\
p_{n-1} \\
p_{n}
\end{array}\right]
$$

展开为

$$
\begin{aligned}
& p_{1} A=p_{2} \\
& p_{2} A=p_{3} \\
& \vdots \\
& p_{n-1} A=p_{n} \\
& p_{n} A=-a_{0} p_{1}-a_{1} p_{2}-\cdots-a_{n-1} p_{n}
\end{aligned}
$$

经整理有

$$
\begin{aligned}
& p_{1} A=p_{2} \\
& p_{2} A=p_{1} A^{2}=p_{3} \\
& \quad \vdots \\
& p_{n-1} A=p_{1} A^{n-1}=p_{n}
\end{aligned}
$$

由此可得变换矩阵

$$
\boldsymbol{P}=\left[\begin{array}{c}
\boldsymbol{p}_{1}  \tag{9-182}\\
\boldsymbol{p}_{1} \boldsymbol{A} \\
\vdots \\
\boldsymbol{p}_{1} \boldsymbol{A}^{n-1}
\end{array}\right]
$$

又根据 $\boldsymbol{b}$ 阵变换要求， $\boldsymbol{P}$ 应满足式（9－179），有

$$
P b=\left[\begin{array}{c}
p_{1}  \tag{9-183}\\
p_{1} A \\
\vdots \\
p_{1} A^{n-1}
\end{array}\right] b=p_{1}\left[\begin{array}{c}
b \\
A b \\
\vdots \\
A^{n-1} b
\end{array}\right]=\left[\begin{array}{c}
0 \\
\vdots \\
0 \\
1
\end{array}\right]
$$

即

$$
\boldsymbol{p}_{1}\left[\begin{array}{llll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{b}
\end{array}\right]=\left[\begin{array}{llll}
0 & \cdots & 0 & 1 \tag{9-184}
\end{array}\right]
$$

故

$$
\boldsymbol{p}_{1}=\left[\begin{array}{llll}
0 & \cdots & 0 & 1
\end{array}\right]\left[\begin{array}{llll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{b} \tag{9-185}
\end{array}\right]^{-1}
$$



<!-- source_pdf_page: 507 -->
该式表明 $p_{1}$ 是可控性矩阵的逆阵的最后一行，于是可得出变换矩阵 $\boldsymbol{P}^{-1}$ 的求法如下：

（1） 计算可控性矩阵 $\boldsymbol{S}=\left[\boldsymbol{b} \quad \boldsymbol{A} \boldsymbol{b} \cdots \boldsymbol{A}^{n-1} \boldsymbol{b}\right]$ ；
（2） 计算可控性矩阵的逆阵 $\boldsymbol{S}^{-1}$ ，设一般形式为
$$
\boldsymbol{S}^{-1}=\left[\begin{array}{cccc}
S_{11} & S_{12} & \cdots & S_{1 n} \\
S_{21} & S_{22} & \cdots & S_{2 n} \\
\vdots & \vdots & & \vdots \\
S_{n 1} & S_{n 2} & \cdots & S_{n n}
\end{array}\right]
$$
（3） 取出 $S^{-1}$ 的最后一行（即第 $n$ 行）构成 $\boldsymbol{p}_{1}$ 行向量
$$
\boldsymbol{p}_{1}=\left[\begin{array}{llll}
S_{n 1} & S_{n 2} & \cdots & S_{n n}
\end{array}\right]
$$
（4） 构造 $\boldsymbol{P}$ 阵
$$
P=\left[\begin{array}{c}
p_{1} \\
p_{1} A \\
\vdots \\
p_{1} A^{n-1}
\end{array}\right]
$$
（5） $\boldsymbol{P}^{-1}$ 便是将非标准型可控系统化为可控标准型的变换矩阵。
4） 化可观系统为可观标准型。

可观标准型变换过程如下：

（1） 针对线性连续定常系统（ $\boldsymbol{A}, \boldsymbol{b}, \boldsymbol{c}$ ），计算可观性矩阵
$$
V=\left[\begin{array}{c}
c \\
c A \\
\vdots \\
c A^{n-1}
\end{array}\right]
$$
（2） 求 $\boldsymbol{V}$ 的逆矩阵 $\boldsymbol{V}^{-1}$ 。
（3） 取 $\boldsymbol{V}^{-1}$ 的最后一列即第 $n$ 列，构成向量 $\boldsymbol{p}$ 。
（4） 构造变换矩阵及其逆矩阵
$$
P=\left[\begin{array}{llll}
p & A p & \cdots & A^{n-1} p
\end{array}\right]
$$
（5） 求线性变换，得到可观标准型的状态空间表达式
$$
A_{0}=P^{-1} A P, \quad b_{0}=P^{-1} b, \quad c_{0}=c P
$$
例 9－19 已知线性连续定常系统 $(\boldsymbol{A}, \boldsymbol{b}, \boldsymbol{c})$ 为
$$
A=\left[\begin{array}{ccc}
2 & -1 & -1 \\
0 & 1 & 0 \\
0 & 2 & 1
\end{array}\right], \quad b=\left[\begin{array}{l}
7 \\
2 \\
1
\end{array}\right], \quad c=\left[\begin{array}{lll}
1 & 1 & 0
\end{array}\right]
$$
请将该系统化为可观标准型，并求出相应的变换矩阵。


<!-- source_pdf_page: 508 -->
$$
\boldsymbol{V}=\left[\begin{array}{c}
\boldsymbol{c} \\
\boldsymbol{c A} \\
\boldsymbol{c A}
\end{array}\right]=\left[\begin{array}{ccc}
1 & 1 & 0 \\
2 & 0 & -1 \\
4 & -4 & -3
\end{array}\right]
$$

由于 $\operatorname{rank} \boldsymbol{V}=3=n$ ，因此系统可观测。
求 $\boldsymbol{V}$ 的逆矩阵

$$
\boldsymbol{V}^{-1}=\left[\begin{array}{ccc}
2 & -1.5 & 0.5 \\
-1 & 1.5 & -0.5 \\
4 & -4 & 1
\end{array}\right]
$$

取 $\boldsymbol{V}^{-1}$ 的最后一列

$$
p=\left[\begin{array}{c}
0.5 \\
-0.5 \\
1
\end{array}\right]
$$

构造变换矩阵及其逆矩阵

$$
\begin{gathered}
\boldsymbol{P}=\left[\begin{array}{lll}
\boldsymbol{p} & \boldsymbol{A} \boldsymbol{p} & \boldsymbol{A}^{2} \boldsymbol{p}
\end{array}\right]=\left[\begin{array}{ccc}
0.5 & 0.5 & 1.5 \\
-0.5 & -0.5 & -0.5 \\
1 & 0 & -1
\end{array}\right] \\
\boldsymbol{P}^{-1}=\left[\begin{array}{ccc}
1 & 1 & 1 \\
-2 & -4 & -1 \\
1 & 1 & 0
\end{array}\right]
\end{gathered}
$$

（6）线性变换

$$
\boldsymbol{A}_{0}=\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}=\left[\begin{array}{ccc}
0 & 0 & 2 \\
1 & 0 & -5 \\
0 & 1 & 4
\end{array}\right], \quad \boldsymbol{b}_{0}=\boldsymbol{P}^{-1} \boldsymbol{b}=\left[\begin{array}{c}
10 \\
-23 \\
9
\end{array}\right], \quad \boldsymbol{c}_{0}=\boldsymbol{c} \boldsymbol{P}=\left[\begin{array}{lll}
0 & 0 & 1
\end{array}\right]
$$

即得到原系统的可观标准型。
（2）对偶原理
在研究系统的可控性和可观测性时，利用对偶原理常常带来许多方便。
设系统为 $\Sigma_{1}(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ ，则系统 $\Sigma_{2}\left(\boldsymbol{A}^{\mathrm{T}}, \boldsymbol{C}^{\mathrm{T}}, \boldsymbol{B}^{\mathrm{T}}\right)$ 为系统 $\Sigma_{1}$ 的对偶系统。其动态方程分别为

$$
\begin{align*}
\Sigma_{1}: \dot{\boldsymbol{x}}=\boldsymbol{A x}+\boldsymbol{B u}, & \boldsymbol{y}=\boldsymbol{C x}  \tag{9-186}\\
\Sigma_{2}: \dot{z}=\boldsymbol{A}^{\mathrm{T}} z+C^{\mathrm{T}} v, & w=\boldsymbol{B}^{\mathrm{T}} z \tag{9-187}
\end{align*}
$$

式中， $\boldsymbol{x} 、 z$ 均为 $n$ 维状态向量； $\boldsymbol{u} 、 w$ 均为 $p$ 维向量；$y 、 v$ 均为 $q$ 维向量。注意到系统与对偶系统之间，其输人、输出向量的维数是相交换的，当 $\Sigma_{2}$ 为 $\Sigma_{1}$ 的对偶系统时，$\Sigma_{1}$ 也是$\Sigma_{2}$ 的对偶系统。

不难验证，系统 $\Sigma_{1}$ 的可控性判别矩阵 $\left[\boldsymbol{B} \quad \boldsymbol{A} \boldsymbol{B} \cdots \boldsymbol{A}^{n-1} \boldsymbol{B}\right]$ 与对偶系统 $\Sigma_{2}$ 的可观测性矩阵$\left[\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}}\left(\boldsymbol{A}^{\mathrm{T}}\right)^{\mathrm{T}}\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}} \cdots\left(\left(\boldsymbol{A}^{\mathrm{T}}\right)^{\mathrm{T}}\right)^{n-1}\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}}\right]$ 完全相同；系统 $\Sigma_{1}$ 的可观测性矩阵 $\left[\boldsymbol{C}^{\mathrm{T}} \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} \cdots\right.$



<!-- source_pdf_page: 509 -->
$\left(\boldsymbol{A}^{\mathrm{T}}\right)^{n-1} \boldsymbol{C}^{\mathrm{T}}$ ］与对偶系统 $\Sigma_{2}$ 的可控性判别矩阵 $\left[\boldsymbol{C}^{\mathrm{T}} \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} \cdots\left(\boldsymbol{A}^{\mathrm{T}}\right)^{n-1} \boldsymbol{C}^{\mathrm{T}}\right]$ 完全相同。
应用对偶原理，能把可观测的单输人－单输出系统化为可观测标准型的问题转化为将其对偶系统化为可控标准型的问题。设单输人－单输出系统动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}+\boldsymbol{b} u, \quad y=\boldsymbol{c} \boldsymbol{x} \tag{9-188}
\end{equation*}
$$

系统可观测，但 $\boldsymbol{A} 、 \boldsymbol{c}$ 不是可观测标准型。其对偶系统动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{z}}=\boldsymbol{A}^{\mathrm{T}} \boldsymbol{z}+\boldsymbol{c}^{\mathrm{T}} v, \quad w=\boldsymbol{b}^{\mathrm{T}} \boldsymbol{z} \tag{9-189}
\end{equation*}
$$

对偶系统一定可控，但不是可控标准型。可利用已知的化为可控标准型的原理和步骤，先将对偶系统化为可控标准型，再一次使用对偶原理，便可获得原系统的可观测标准型。下面仅给出其计算步骤：

1）列出对偶系统的可控性矩阵（即原系统的可观测性矩阵 $\boldsymbol{V}_{1}$ ）

$$
\overline{\boldsymbol{S}}_{2}=\boldsymbol{V}_{1}=\left[\begin{array}{llll}
\boldsymbol{c}^{\mathrm{T}} & \boldsymbol{A}^{\mathrm{T}} \boldsymbol{c}^{\mathrm{T}} & \cdots & \left(\boldsymbol{A}^{\mathrm{T}}\right)^{n-1} \boldsymbol{c}^{\mathrm{T}}
\end{array}\right]
$$

2）求 $\boldsymbol{V}_{1}$ 的逆阵 $\boldsymbol{V}_{1}^{-1}$ ，且记为行向量组

$$
\boldsymbol{V}_{1}^{-1}=\left[\begin{array}{c}
v_{1}^{\mathrm{T}} \\
v_{2}^{\mathrm{T}} \\
\vdots \\
v_{n}^{\mathrm{T}}
\end{array}\right]
$$

3）取 $\boldsymbol{V}_{1}^{-1}$ 的第 $n$ 行 $v_{n}^{\mathrm{T}}$ ，并按下列规则构造变换矩阵 $\boldsymbol{P}$ ：

$$
\boldsymbol{P}=\left[\begin{array}{c}
\boldsymbol{v}_{n}^{\mathrm{T}} \\
v_{n}^{\mathrm{T}} \boldsymbol{A}^{\mathrm{T}} \\
\vdots \\
v_{n}^{\mathrm{T}}\left(\boldsymbol{A}^{\mathrm{T}}\right)^{n-1}
\end{array}\right]
$$

4）求 $\boldsymbol{P}$ 的逆阵 $\boldsymbol{P}^{-1}$ ，并引入 $\boldsymbol{P}^{-1}$ 变换，即 $z=\boldsymbol{p}^{-1} \bar{z}$ ，变换后动态方程为

$$
\dot{\overline{\boldsymbol{z}}}=\boldsymbol{P} \boldsymbol{A}^{\mathrm{T}} \boldsymbol{P}^{-1} \overline{\boldsymbol{z}}+\boldsymbol{P} \boldsymbol{c}^{\mathrm{T}} v, \quad \bar{w}=\boldsymbol{b}^{\mathrm{T}} \boldsymbol{P}^{-1} \overline{\boldsymbol{z}}
$$

5）对对偶系统再利用对偶原理，便可获得原系统的可观测标准型，结果为

$$
\begin{aligned}
& \dot{\overline{\boldsymbol{x}}}=\left(\boldsymbol{P} \boldsymbol{A}^{\mathrm{T}} \boldsymbol{P}^{-1}\right)^{\mathrm{T}} \overline{\boldsymbol{x}}+\left(\boldsymbol{b}^{\mathrm{T}} \boldsymbol{P}^{-1}\right)^{\mathrm{T}} u=\boldsymbol{P}^{-\mathrm{T}} \boldsymbol{A} \boldsymbol{P}^{\mathrm{T}} \overline{\boldsymbol{x}}+\boldsymbol{P}^{-\mathrm{T}} \boldsymbol{b} u \\
& \bar{y}=\left(\boldsymbol{P} \boldsymbol{c}^{\mathrm{T}}\right)^{\mathrm{T}} \overline{\boldsymbol{x}}=\boldsymbol{c} \boldsymbol{P}^{\mathrm{T}} \overline{\boldsymbol{x}}
\end{aligned}
$$

与原系统动态方程相比较，可知将原系统化为可观测标准型需要进行 $\boldsymbol{P}^{T}$ 变换，即令

$$
\begin{gather*}
\boldsymbol{x}=\boldsymbol{P}^{\top} \overline{\boldsymbol{x}}  \tag{9-190}\\
\boldsymbol{P}^{\mathrm{T}}=\left[\begin{array}{cccc}
v_{n} & A v_{n} & \cdots & A^{n-1} v_{n}
\end{array}\right] \tag{9-191}
\end{gather*}
$$

其中
$v_{n}$ 为原系统可观测性矩阵的逆阵中第 $n$ 行的转置。
（3）非奇异线性变换的不变特性
从前面的研究中可以看到，为了便于研究系统固有特性，常常需要引人非奇异线性变换。例如：将 $\boldsymbol{A}$ 阵对角化或约当化，需进行 $\boldsymbol{P}$ 变换；将 $\boldsymbol{A}, \boldsymbol{b}$ 化为可控标准型，需进行 $\boldsymbol{P}^{-1}$ 变换；将 $\boldsymbol{A}, \boldsymbol{c}$ 化为可观测标准型，需进行 $\boldsymbol{P}^{\mathrm{T}}$ 变换。虽然这些变换中的 $\boldsymbol{P}$ 阵各不相同，但都是非奇异矩阵。经过变换后，系统的固有特性是否会引起改变呢？这当然是人们在研究线性变换时所需要回答的一个重要问题。下面的研究将会表明，系统经过非

```
非奇吊线性
变换的不变
特性
```

奇异线性变换，其特征值、传递矩阵、可控性、可观测性等重要性质均保持不变。下面



<!-- source_pdf_page: 510 -->
以 $\boldsymbol{P}$ 变换为例进行论证。
设系统动态方程为

$$
\dot{x}=A x+B u, \quad y=C x+D u
$$

令 $x=P \bar{x}$ ，变换后动态方程为

$$
\dot{\bar{x}}=P^{-1} A P \bar{x}+P^{-1} B u, \quad y=\bar{y}=C P \bar{x}+D u
$$

1）变换后系统特征值不变。变换后系统的特征值为

$$
\begin{aligned}
\left|\lambda \boldsymbol{I}-\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right| & =\left|\lambda \boldsymbol{P}^{-1} \boldsymbol{P}-\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right|=\left|\boldsymbol{P}^{-1} \lambda \boldsymbol{P}-\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right| \\
& =\left|\boldsymbol{P}^{-1}(\lambda \boldsymbol{I}-\boldsymbol{A}) \boldsymbol{P}\right|=\left|\boldsymbol{P}^{-1}\right||\lambda \boldsymbol{I}-\boldsymbol{A}||\boldsymbol{P}|=\left|\boldsymbol{P}^{-1}\right||\boldsymbol{P}||\lambda \boldsymbol{I}-\boldsymbol{A}| \\
& =\left|\boldsymbol{P}^{-1} \boldsymbol{P}\right||\lambda \boldsymbol{I}-\boldsymbol{A}|=|\boldsymbol{I}||\lambda \boldsymbol{I}-\boldsymbol{A}|=|\lambda \boldsymbol{I}-\boldsymbol{A}|
\end{aligned}
$$

可见，系统变换后与变换前的特征值完全相同，这说明对于非奇异线性变换，系统特征值具有不变性。
2）变换后系统传递矩阵不变。变换后系统的传递矩阵为

$$
\begin{aligned}
\boldsymbol{G}^{\prime}(s) & =\boldsymbol{C} \boldsymbol{P}\left(s \boldsymbol{I}-\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{-1} \boldsymbol{P}^{-1} \boldsymbol{B}+\boldsymbol{D} \\
& =\boldsymbol{C} \boldsymbol{P}\left(\boldsymbol{P}^{-1} s \boldsymbol{I} \boldsymbol{P}-\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{-1} \boldsymbol{P}^{-1} \boldsymbol{B}+\boldsymbol{D} \\
& =\boldsymbol{C} \boldsymbol{P}\left[\boldsymbol{P}^{-1}(s \boldsymbol{I}-\boldsymbol{A}) \boldsymbol{P}\right]^{-1} \boldsymbol{P}^{-1} \boldsymbol{B}+\boldsymbol{D} \\
& =\boldsymbol{C} \boldsymbol{P} \boldsymbol{P}^{-1}(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{P} \boldsymbol{P}^{-1} \boldsymbol{B}+\boldsymbol{D} \\
& =\boldsymbol{C}(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B}+\boldsymbol{D}=\boldsymbol{G}(s)
\end{aligned}
$$

这表明变换前与变换后系统的传递矩阵完全相同，系统的传递矩阵对于非奇异线性变换具有不变性。
3）变换后系统可控性不变。变换后系统可控性矩阵的秩为

$$
\begin{aligned}
\operatorname{rank} \boldsymbol{S}^{\prime} & =\operatorname{rank}\left[\begin{array}{lllll}
\boldsymbol{P}^{-1} \boldsymbol{B} & \left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right) \boldsymbol{P}^{-1} \boldsymbol{B} & \left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{2} \boldsymbol{P}^{-1} \boldsymbol{B} & \cdots & \left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{n-1} \boldsymbol{P}^{-1} \boldsymbol{B}
\end{array}\right] \\
& =\operatorname{rank}\left[\begin{array}{lllll}
\boldsymbol{P}^{-1} \boldsymbol{B} & \boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{B} & \boldsymbol{P}^{-1} \boldsymbol{A}^{2} \boldsymbol{B} & \cdots & \boldsymbol{P}^{-1} \boldsymbol{A}^{n-1} \boldsymbol{B}
\end{array}\right] \\
& =\operatorname{rank} \boldsymbol{P}^{-1}\left[\begin{array}{lllll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \boldsymbol{A}^{2} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B}
\end{array}\right] \\
& =\operatorname{rank}\left[\begin{array}{lllll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \boldsymbol{A}^{2} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B}
\end{array}\right]=\operatorname{rank} \boldsymbol{S}
\end{aligned}
$$

式中， $\boldsymbol{S}^{\prime}$ 为变换后系统的可控性矩阵； $\boldsymbol{S}$ 为变换前系统的可控性矩阵。可见，变换后与变换前系统可控性矩阵的秩相等，根据系统可控性的秩判据可知，对于非奇异线性变换，系统的可控性不变。
4）变换后系统可观测性不变。设变换后系统的可观测性矩阵为 $V^{\prime}$ ，变换前系统的可观测性矩阵为 $\boldsymbol{V}$ ，则有

$$
\begin{aligned}
\operatorname{rank} \boldsymbol{V}^{\prime} & =\operatorname{rank}\left[\begin{array}{lllll}
(\boldsymbol{C} \boldsymbol{P})^{\mathrm{T}} & \left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{\mathrm{T}}(\boldsymbol{C} \boldsymbol{P})^{\mathrm{T}} & \left(\left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{2}\right)^{\mathrm{T}}(\boldsymbol{C} \boldsymbol{P})^{\mathrm{T}} & \cdots & \left(\left(\boldsymbol{P}^{-1} \boldsymbol{A} \boldsymbol{P}\right)^{n-1}\right)^{\mathrm{T}}(\boldsymbol{C} \boldsymbol{P})^{\mathrm{T}}
\end{array}\right] \\
& =\operatorname{rank}\left[\begin{array}{lllll}
\boldsymbol{P}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \boldsymbol{P}^{\mathrm{T}} \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \boldsymbol{P}^{\mathrm{T}}\left(\boldsymbol{A}^{2}\right)^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \cdots & \boldsymbol{P}^{\mathrm{T}}\left(\boldsymbol{A}^{n-1}\right)^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}}
\end{array}\right] \\
& =\operatorname{rank} \boldsymbol{P}^{\mathrm{T}}\left[\begin{array}{lllll}
\boldsymbol{C}^{\mathrm{T}} & \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \left(\boldsymbol{A}^{2}\right)^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \cdots & \left(\boldsymbol{A}^{n-1}\right)^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}}
\end{array}\right] \\
& =\operatorname{rank}\left[\begin{array}{lllll}
\boldsymbol{C}^{\mathrm{T}} & \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \left(\boldsymbol{A}^{2}\right)^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \cdots & \left(\boldsymbol{A}^{n-1}\right)^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}}
\end{array}\right]=\operatorname{rank} \boldsymbol{V}
\end{aligned}
$$



<!-- source_pdf_page: 511 -->
可见，变换后与变换前系统的可观测性矩阵的秩相等，故系统的可观测性不变。
（4）线性定常系统的结构分解
系统中只要有一个状态变量不可控便称系统不可控，因而不可控系统便含有可控和不可控两种状态变量。类似地，系统中只要有一个状态变量不可观测便称系统不可观测，不可观测系统含有可观测和不可观测两种状态变量。从可控性和可观测性出发，状态变量便可分为可控可观测 $\boldsymbol{x}_{c o}$ 、可控不可观测 $\boldsymbol{x}_{c \bar{o}}$ 、不可控可观测 $\boldsymbol{x}_{\overline{c o}}$ 、不可控不可观测 $\boldsymbol{x}_{\overline{c o}}$ 四类。由对应状态变量构成的子空间也分为四类，因而系统也对应分成了四类子系统，称为系统的结构分解，也有的参考文献称此为系统的规范分解。研究结构分解可以更明显地揭示系统的结构特性、传递特性。研究方法是选取一种特殊的线性变换，使原来的状态向量 $\boldsymbol{x}$ 变换成 $\left[\boldsymbol{x}_{c o}^{\mathrm{T}} \boldsymbol{x}_{c o}^{\mathrm{T}} \boldsymbol{x}_{c o}^{\mathrm{T}} \boldsymbol{x}_{c o}^{\mathrm{T}}\right]^{\mathrm{T}}$ ，相应地使原动态方程中的 $\boldsymbol{A} 、 \boldsymbol{B} 、 \boldsymbol{C}$ 矩阵变换成某种标准构造的形式。结构分解过程可先从整个系统的可控性分解开始，将可控与不可控的状态变量分离开，继而分别对可控和不可控子系统进行可观测性分解，便可以分离出四类状态变量及四类子系统。当然，结构分解的过程也可以从系统的可观测性分解开始。下面着重介绍结构分解的方法，有关证明略去。

1）系统按可控性的结构分解。设不可控系统的动态方程为

$$
\begin{equation*}
\dot{x}=A x+B u, \quad y=C x \tag{9-192}
\end{equation*}
$$

式中， $\boldsymbol{x}$ 为 $n$ 维状态向量； $\boldsymbol{u}$ 为 $p$ 维输人向量； $\boldsymbol{y}$ 为 $q$ 维输出向量； $\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C}$ 为具有相应维数的矩阵。若系统可控性矩阵的秩为 $r(r<n)$ ，则可从可控性矩阵中选出 $r$ 个线性无关的列向量 $s_{1}, s_{2}, \cdots, s_{r}$ ，另外再任意选取尽可能简单的 $n-r$ 个 $n$ 维列向量 $s_{r+1}, s_{r+2}, \cdots, s_{n}$ ，使它们与 $\left\{\boldsymbol{s}_{1}, \boldsymbol{s}_{2}, \cdots, \boldsymbol{s}_{r}\right\}$ 线性无关，这样就可以构成 $n \times n$ 非奇异变换矩阵。

$$
\boldsymbol{P}^{-1}=\left[\begin{array}{llllllll}
\boldsymbol{s}_{1} & \boldsymbol{s}_{2} & \cdots & \boldsymbol{s}_{r} & \vdots & \boldsymbol{s}_{r+1} & \cdots & \boldsymbol{s}_{n}
\end{array}\right]
$$

对式（9－192）进行非奇异线性变换

$$
\boldsymbol{x}=\boldsymbol{P}^{-1}\left[\begin{array}{l}
\boldsymbol{x}_{c}  \tag{9-193}\\
\boldsymbol{x}_{\bar{c}}
\end{array}\right]
$$

式（9－192）便变换为下列的规范形式：

$$
\left[\begin{array}{l}
\dot{x}_{c}  \tag{9-194}\\
\dot{x}_{\bar{c}}
\end{array}\right]=P A P^{-1}\left[\begin{array}{l}
x_{c} \\
x_{\bar{c}}
\end{array}\right]+P B u, \quad y=C P^{-1}\left[\begin{array}{l}
x_{c} \\
x_{\bar{c}}
\end{array}\right]
$$

式中， $\boldsymbol{x}_{c}$ 为 $r$ 维可控状态子向量； $\boldsymbol{x}_{\bar{c}}$ 为 $n-r$ 维不可控状态子向量，并且

$$
\begin{align*}
\boldsymbol{P} \boldsymbol{A} \boldsymbol{P}^{-1} & =\left[\begin{array}{c|c}
\overline{\boldsymbol{A}}_{11} & \overline{\boldsymbol{A}}_{12} \\
\hline \mathbf{0} & \overline{\boldsymbol{A}}_{22}
\end{array}\right] \underbrace{r \text { 行 }}_{n-r \text { 行 }}, \quad \boldsymbol{P B}=\left[\begin{array}{c}
\overline{\boldsymbol{B}}_{1} \\
\hline \mathbf{0}
\end{array}\right]_{n-r} \begin{array}{c}
r \text { 行 } \\
r \text { 行 }
\end{array} \\
\boldsymbol{C} \boldsymbol{P}^{-1} & =\left[\begin{array}{c|c}
\overline{\boldsymbol{C}}_{1} & \overline{\boldsymbol{C}}_{2}
\end{array}\right] q \text { 行 } \\
r \text { 列 } & n-r \text { 列 } \tag{9-195}
\end{align*}
$$

展开式（9－194），有

$$
\begin{aligned}
& \dot{\boldsymbol{x}}_{c}=\overline{\boldsymbol{A}}_{11} \boldsymbol{x}_{c}+\overline{\boldsymbol{A}}_{12} \boldsymbol{x}_{\bar{c}}+\overline{\boldsymbol{B}}_{1} u \\
& \dot{\boldsymbol{x}}_{\bar{c}}=\overline{\boldsymbol{A}}_{22} \boldsymbol{x}_{\bar{c}} \\
& \boldsymbol{y}=\overline{\boldsymbol{C}}_{1} \boldsymbol{x}_{c}+\overline{\boldsymbol{C}}_{2} x_{\bar{c}}
\end{aligned}
$$



<!-- source_pdf_page: 512 -->
将输出向量进行分解，令 $y=y_{1}+y_{2}$ ，则可得子系统动态方程，其中可控子系统动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}_{c}=\overline{\boldsymbol{A}}_{11} \boldsymbol{x}_{c}+\overline{\boldsymbol{A}}_{12} \boldsymbol{x}_{\bar{c}}+\overline{\boldsymbol{B}}_{1} \boldsymbol{u}, \quad \boldsymbol{y}_{1}=\overline{\boldsymbol{C}}_{1} \boldsymbol{x}_{c} \tag{9-196}
\end{equation*}
$$

不可控子系统动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}_{\bar{c}}=\overline{\boldsymbol{A}}_{22} \boldsymbol{x}_{\bar{c}}, \quad \boldsymbol{y}_{2}=\overline{\boldsymbol{C}}_{2} \boldsymbol{x}_{\bar{c}} \tag{9-197}
\end{equation*}
$$

上述系统结构分解方式称为可控性规范分解，系统方框图如图9－21所示。
系统结构的可控性规范分解具有下列特点：
（1）不可控系统与其可控子系统具有相同的传递函数矩阵。
由于

![](assets/fig-09-21.png)

> Image description: This textbook figure illustrates a controllability canonical decomposition of a linear system. Input u enters through block B̄₁, splitting into two state paths: one via ẋₑ → I/S → xₑ → C̄₁, and another via ẋₑ → I/S → xₑ → C̄₂. The system has two outputs y₁ and y₂, derived from C̄₁ and C̄₂ respectively, with feedback loops involving Ā₁₁, Ā₁₂, Ā₂₂. The structure shows how the system is decomposed into controllable and uncontrollable sub-systems, with identical transfer functions for both. Arrows indicate signal flow, and blocks represent system matrices (A, B, C, D). The diagram visually demonstrates the decomposition’s engineering meaning: separating controllable dynamics from uncontrollable ones while preserving overall input-output behavior.
图9－21 系统可控性规范分解方框图

$$
\begin{align*}
& \operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B}
\end{array}\right] \\
= & \operatorname{rank}\left[\begin{array}{cccc}
\boldsymbol{P} \boldsymbol{B} & \left(\boldsymbol{P} \boldsymbol{A} \boldsymbol{P}^{-1}\right)(\boldsymbol{P} \boldsymbol{B}) & \cdots & \left(\boldsymbol{P} \boldsymbol{A} \boldsymbol{P}^{-1}\right)^{n-1}(\boldsymbol{P} \boldsymbol{B})
\end{array}\right] \\
= & \operatorname{rank}\left[\begin{array}{cccc}
\overline{\boldsymbol{B}}_{1} & \overline{\boldsymbol{A}}_{11} \overline{\boldsymbol{B}}_{1} & \cdots & \overline{\boldsymbol{A}}_{11}^{n-1} \overline{\boldsymbol{B}}_{1} \\
\mathbf{0} & \mathbf{0} & \cdots & \mathbf{0}
\end{array}\right]  \tag{9-198}\\
= & \operatorname{rank}\left[\begin{array}{llll}
\overline{\boldsymbol{B}}_{1} & \overline{\boldsymbol{A}}_{11} \overline{\boldsymbol{B}}_{1} & \cdots & \overline{\boldsymbol{A}}_{11}^{n-1} \overline{\boldsymbol{B}}_{1}
\end{array}\right] \\
= & r
\end{align*}
$$

$$
\begin{align*}
& C(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{B}=\left(\boldsymbol{C} \boldsymbol{P}^{-1}\right)\left(s \boldsymbol{I}-\boldsymbol{P} \boldsymbol{A} \boldsymbol{P}^{-1}\right)^{-1}(\boldsymbol{P} \boldsymbol{B}) \\
= & {\left[\begin{array}{ll}
\overline{\boldsymbol{C}}_{1} & \overline{\boldsymbol{C}}_{2}
\end{array}\right]\left[\begin{array}{cc}
s \boldsymbol{I}-\left[\begin{array}{cc}
\overline{\boldsymbol{A}}_{11} & \overline{\boldsymbol{A}}_{12} \\
\mathbf{0} & \overline{\boldsymbol{A}}_{22}
\end{array}\right]
\end{array}\right]^{-1}\left[\begin{array}{c}
\overline{\boldsymbol{B}}_{1} \\
\mathbf{0}
\end{array}\right] } \\
= & {\left[\begin{array}{ll}
\overline{\boldsymbol{C}}_{1} & \overline{\boldsymbol{C}}_{2}
\end{array}\right]\left[\begin{array}{cc}
s \boldsymbol{I}-\overline{\boldsymbol{A}}_{11} & -\overline{\boldsymbol{A}}_{12} \\
\mathbf{0} & s \boldsymbol{I}-\overline{\boldsymbol{A}}_{22}
\end{array}\right]^{-1}\left[\begin{array}{c}
\overline{\boldsymbol{B}}_{1} \\
\mathbf{0}
\end{array}\right] }  \tag{9-199}\\
= & {\left[\begin{array}{ll}
\overline{\boldsymbol{C}}_{1} & \overline{\boldsymbol{C}}_{2}
\end{array}\right]\left[\begin{array}{cc}
\left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{11}\right)^{-1} & \left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{11}\right)^{-1} \overline{\boldsymbol{A}}_{12}\left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{22}\right)^{-1} \\
\mathbf{0} & \left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{22}\right)^{-1}
\end{array}\right]\left[\begin{array}{c}
\overline{\boldsymbol{B}}_{1} \\
\mathbf{0}
\end{array}\right] } \\
= & \overline{\boldsymbol{C}}_{1}\left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{11}\right)^{-1} \overline{\boldsymbol{B}}_{1}
\end{align*}
$$

因而 $r$ 维子系统 $\left(\overline{\boldsymbol{A}}_{11}, \overline{\boldsymbol{B}}_{1}, \overline{\boldsymbol{C}}_{1}\right)$ 是可控的，并且和系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ 具有相同的传递函数矩阵。



<!-- source_pdf_page: 513 -->
如果从传递特性的角度分析系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ ，可以等价地用分析子系统 $\left(\overline{\boldsymbol{A}}_{11}, \overline{\boldsymbol{B}}_{1}, \overline{\boldsymbol{C}}_{1}\right)$ 来代替，由于后者维数降低了很多，可能会使分析变得简单。
（2）不可控子系统的特性与整个系统的稳定性及输出响应有关。
输人 $\boldsymbol{u}$ 只能通过可控子系统传递到输出，而与不可控子系统无关，故 $\boldsymbol{u}$ 到 $\boldsymbol{y}$ 之间的传递函数矩阵描述不能反映不可控部分的特性。但是，不可控子系统对整个系统的影响是存在的，不可忽视。因而要求 $\overline{\boldsymbol{A}}_{22}$ 仅含稳定特征值，以保证整个系统稳定，并且应考虑到可控子系统的状态响应 $\boldsymbol{x}_{c}(t)$ 和整个系统的输出响应 $\boldsymbol{y}(t)$ 均与不可控子系统的状态$\boldsymbol{x}_{\bar{c}}$ 有关。
（3）不可控系统的可控性规范分解是不唯一的。
由于选取非奇异变换阵 $\boldsymbol{P}^{-1}$ 的列向量 $\boldsymbol{s}_{1}, \boldsymbol{s}_{2}, \cdots, \boldsymbol{s}_{r}$ 及 $\boldsymbol{s}_{r+1}, \cdots, \boldsymbol{s}_{n}$ 的非唯一性，虽然系统可控性规范分解的形式不变，但诸系数阵不相同，故可控性规范分解不是唯一的。
（4）不可控系统的可控性规范分解将整个系统的特征值分解为可控因子与不可控因子两类。

由于

$$
\begin{equation*}
\operatorname{det}(s \boldsymbol{I}-\overline{\boldsymbol{A}})=\operatorname{det}\left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{11}\right) \cdot \operatorname{det}\left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{22}\right) \tag{9-200}
\end{equation*}
$$

故 $\boldsymbol{x}_{c}$ 的稳定性完全由 $\overline{\boldsymbol{A}}_{11}$ 的特征值 $\lambda_{1}, \lambda_{2}, \cdots, \lambda_{r}$ 决定； $\boldsymbol{x}_{\bar{c}}$ 的稳定性完全由 $\overline{\boldsymbol{A}}_{22}$ 的特征值$\lambda_{r+1}, \cdots, \lambda_{n}$ 决定，而 $\lambda_{1}, \lambda_{2}, \cdots, \lambda_{n}$ 都是 $\boldsymbol{A}$ 的特征值。 $\lambda_{1}, \cdots, \lambda_{r}$ 称为系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ 的可控因子或可控振型，$\lambda_{r+1}, \cdots, \lambda_{n}$ 称为不可控因子或不可控振型。

例 9－20 已知系统（ $\boldsymbol{A}, \boldsymbol{b}, \boldsymbol{c}$ ），其中

$$
\boldsymbol{A}=\left[\begin{array}{ccc}
1 & 2 & -1 \\
0 & 1 & 0 \\
1 & -4 & 3
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{l}
0 \\
0 \\
1
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{lll}
1 & -1 & 1
\end{array}\right]
$$

试按可控性分解为规范形式。
解 系统可控性矩阵为

$$
\begin{aligned}
& \boldsymbol{S}=\left[\begin{array}{lll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b} & \boldsymbol{A}^{2} \boldsymbol{b}
\end{array}\right]=\left[\begin{array}{ccc}
0 & -1 & -4 \\
0 & 0 & 0 \\
1 & 3 & 8
\end{array}\right] \\
& \operatorname{rank} \boldsymbol{S}=2<n=3
\end{aligned}
$$

故系统不可控。从可控性矩阵中选出两个线性无关的列向量 $\left[\begin{array}{lll}0 & 0 & 1\end{array}\right]^{\mathrm{T}}$ 和 $\left[\begin{array}{lll}-1 & 0 & 3\end{array}\right]^{\mathrm{T}}$ ，附加任意列向量 $[0 \quad 1 \quad 0]^{\mathrm{T}}$ ，构成非奇异变换阵

$$
\boldsymbol{P}^{-1}=\left[\begin{array}{ccc}
0 & -1 & 0 \\
0 & 0 & 1 \\
1 & 3 & 0
\end{array}\right]
$$

计算矩阵 $\boldsymbol{P}$ 和变换后的各矩阵

$$
\boldsymbol{P}=\left(\boldsymbol{P}^{-1}\right)^{-1}=\left[\begin{array}{ccc}
3 & 0 & 1 \\
-1 & 0 & 0 \\
0 & 1 & 0
\end{array}\right]
$$



<!-- source_pdf_page: 514 -->
$$
\boldsymbol{P} A \boldsymbol{P}^{-1}=\left[\begin{array}{cc|c}
0 & -4 & 2 \\
1 & 4 & -2 \\
\hline 0 & 0 & 1
\end{array}\right], \quad \boldsymbol{P b}=\left[\begin{array}{c}
1 \\
0 \\
\hdashline 0
\end{array}\right], \quad \boldsymbol{c} \boldsymbol{P}^{-1}=\left[\begin{array}{ll|l}
1 & 2 & -1
\end{array}\right]
$$

可控子系统动态方程为

$$
\dot{\boldsymbol{x}}_{c}=\left[\begin{array}{cc}
0 & -4 \\
1 & 4
\end{array}\right] \boldsymbol{x}_{c}+\left[\begin{array}{c}
2 \\
-2
\end{array}\right] \boldsymbol{x}_{\bar{c}}+\left[\begin{array}{l}
1 \\
0
\end{array}\right] u, \quad y_{1}=\left[\begin{array}{ll}
1 & 2
\end{array}\right] \boldsymbol{x}_{c}
$$

不可控子系统动态方程为

$$
\dot{x}_{\bar{c}}=x_{\bar{c}}, \quad y_{2}=-x_{\bar{c}}
$$

2）系统按可观测性的结构分解。系统按可观测性结构分解的所有结论，都对偶于系统按可控性结构分解的结果。设不可观测系统的动态方程为

$$
\begin{equation*}
\dot{x}=A x+B u, \quad y=C x \tag{9-201}
\end{equation*}
$$

式中， $\boldsymbol{x}$ 为 $n$ 维状态向量； $\boldsymbol{u}$ 为 $p$ 维输入向量； $\boldsymbol{y}$ 为 $q$ 维输出向量。系统的可观测性矩阵为

$$
V=\left[\begin{array}{c}
C \\
C A \\
\vdots \\
C A^{n-1}
\end{array}\right]
$$

$\operatorname{rank} V=l(l<n)$ ，在 $\boldsymbol{V}$ 中任意选取 $l$ 个线性无关的行向量 $\boldsymbol{t}_{1}, \boldsymbol{t}_{2}, \cdots, \boldsymbol{t}_{l}$ ，此外再选取 $n-l$ 个与之线性无关的行向量 $t_{l+1}, \cdots, \boldsymbol{t}_{n}$ ，构成非奇异线性变换阵

$$
T=\left[\begin{array}{c}
\boldsymbol{t}_{1}  \tag{9-202}\\
\vdots \\
\boldsymbol{t}_{l} \\
\hline \boldsymbol{t}_{l+1} \\
\vdots \\
\boldsymbol{t}_{n}
\end{array}\right]
$$

对式（9－201）不可观测系统进行非奇异线性变换

$$
x=T^{-1}\left[\begin{array}{l}
x_{o}  \tag{9-203}\\
x_{\bar{o}}
\end{array}\right]
$$

可得系统结构按可观测性分解的规范表达式

$$
\left[\begin{array}{c}
\dot{x}_{o}  \tag{9-204}\\
\dot{x}_{\bar{o}}
\end{array}\right]=\operatorname{TAT}^{-1}\left[\begin{array}{c}
x_{o} \\
x_{\bar{o}}
\end{array}\right]+T B u, \quad y=C T^{-1}\left[\begin{array}{c}
x_{o} \\
x_{\bar{o}}
\end{array}\right]
$$

式中， $\boldsymbol{x}_{o}$ 为 $l$ 维可观测状态子向量； $\boldsymbol{x}_{\bar{o}}$ 为 $n-l$ 维不可观测状态子向量，并且

$$
\begin{gather*}
\boldsymbol{T} A \boldsymbol{T}^{-1}=\left[\begin{array}{c|c}
\hat{\boldsymbol{A}}_{11} & 0 \\
\hdashline \hat{\boldsymbol{A}}_{21} & \hat{\boldsymbol{A}}_{22}
\end{array}\right] \underset{n-l \text { 行 }}{l} \text { 行 } \quad \boldsymbol{T B}=\left[\begin{array}{c}
\hat{\boldsymbol{B}}_{1} \\
\hat{\boldsymbol{B}}_{2}
\end{array}\right] \underset{n-l \text { 行 }}{l \text { 行 }} \quad \begin{array}{c}
n-l \text { 列 } \\
p \text { 列 }
\end{array} \\
C T^{-1}=\left[\begin{array}{c:c}
\hat{\boldsymbol{C}}_{1} & 0
\end{array}\right] q \text { 行 } \\
l \text { 例 } \quad n-\text { l列 } \tag{9-205}
\end{gather*}
$$



<!-- source_pdf_page: 515 -->
展开式（9－204），有

$$
\begin{aligned}
& \dot{x}_{o}=\hat{A}_{11} x_{o}+\hat{B}_{1} u \\
& \dot{x}_{\bar{o}}=\hat{A}_{21} x_{o}+\hat{A}_{22} x_{\bar{o}}+\hat{B}_{2} u \\
& y=\hat{C}_{1} x_{o}
\end{aligned}
$$

可观测子系统动态方程为

$$
\begin{equation*}
\dot{x}_{o}=\hat{A}_{11} x_{o}+\hat{B}_{1} u, \quad y_{1}=\hat{C}_{1} x_{o}=y \tag{9-206}
\end{equation*}
$$

不可观测子系统动态方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}_{\bar{o}}=\hat{\boldsymbol{A}}_{21} \boldsymbol{x}_{o}+\hat{\boldsymbol{A}}_{22} \boldsymbol{x}_{\bar{o}}+\hat{\boldsymbol{B}}_{2} \boldsymbol{u}, \quad \boldsymbol{y}_{2}=\mathbf{0} \tag{9-207}
\end{equation*}
$$

系统可观测性规范分解方框图如图9－22所示。

![](assets/fig-09-22.png)

> Image description: This figure illustrates a state-space system’s observable canonical decomposition. Input u splits into two paths, each feeding a subsystem via blocks B̂₁ and B̂₂. The upper path generates ẋₒ, which passes through an integrator (1/s) and matrix Â₁₁, then combines with feedback to form output y via Ĉ₁. The lower path generates ẋ̄, similarly processed through integrators and matrices Â₂₁, Â₂₂, and output Ĉ₁. Cross-feedback links (xₒ, x̄) connect subsystems, indicating state coupling. The diagram uses standard control engineering notation: blocks represent system matrices, arrows denote signal flow, and summation points indicate algebraic combination. This structure enables analysis of system observability by separating states into observable and unobservable subspaces.
图9－22 系统可观测性规范分解方框图

设

$$
\begin{aligned}
& \hat{A}=T A T^{-1}=\left[\begin{array}{c|c}
\hat{A}_{11} & 0 \\
\hline \hat{A}_{21} & \hat{A}_{22}
\end{array}\right], \quad \hat{B}=T B=\left[\begin{array}{c}
\hat{B}_{1} \\
\hline \hat{B}_{2}
\end{array}\right] \\
& \hat{C}=C T^{-1}=\left[\begin{array}{c|c}
\hat{C}_{1} & 0
\end{array}\right]
\end{aligned}
$$

与可控性规范分解相类似，称系统 $(\hat{\boldsymbol{A}}, \hat{\boldsymbol{B}}, \hat{\boldsymbol{C}})$ 为系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ 的可观测规范分解。可观测性规范分解也有与可控性规范分解相类似的分析与结论。

例 9－21 试将例 9－19 所示系统按可观测性进行分解。
解 系统的可观测性矩阵为

$$
\begin{aligned}
& \boldsymbol{V}=\left[\begin{array}{c}
\boldsymbol{c} \\
\boldsymbol{c} \boldsymbol{A} \\
\boldsymbol{c} \boldsymbol{A}^{2}
\end{array}\right]=\left[\begin{array}{lll}
1 & -1 & 1 \\
2 & -3 & 2 \\
4 & -7 & 4
\end{array}\right] \\
& \operatorname{rank} \boldsymbol{V}=2<n=3
\end{aligned}
$$

故系统不可观测。从可观测性矩阵中选取两个线性无关行向量［11－1 1］和［2－3 2］，再选取一个与之线性无关的行向量 $[0 \quad 0 \quad 1]$ ，构成非奇异变换矩阵

$$
\boldsymbol{T}=\left[\begin{array}{ccc}
1 & -1 & 1 \\
2 & -3 & 2 \\
0 & 0 & 1
\end{array}\right]
$$



<!-- source_pdf_page: 516 -->
计算变换后各矩阵

$$
\begin{gathered}
\boldsymbol{T}^{-1}=\left[\begin{array}{ccc}
3 & -1 & -1 \\
2 & -1 & 0 \\
0 & 0 & 1
\end{array}\right], \quad \boldsymbol{T} \boldsymbol{A} \boldsymbol{T}^{-1}=\left[\begin{array}{cc|c}
0 & 1 & 0 \\
-2 & 3 & 0 \\
\hline-5 & 3 & 2
\end{array}\right] \\
\boldsymbol{T} \boldsymbol{b}=\left[\begin{array}{c}
1 \\
2 \\
\frac{1}{1}
\end{array}\right], \quad \boldsymbol{c \boldsymbol { T } ^ { - 1 }}=\left[\begin{array}{ll:l}
1 & 0 & 0
\end{array}\right]
\end{gathered}
$$

可观测子系统动态方程为

$$
\dot{x}_{o}=\left[\begin{array}{cc}
0 & 1 \\
-2 & 3
\end{array}\right] x_{o}+\left[\begin{array}{l}
1 \\
2
\end{array}\right] u, \quad y_{1}=\left[\begin{array}{ll}
1 & 0
\end{array}\right] x_{o}=y
$$

不可观测子系统动态方程为

$$
\dot{x}_{\bar{o}}=\left[\begin{array}{ll}
-5 & 3
\end{array}\right] x_{o}+2 x_{\bar{o}}+u, \quad y_{2}=0
$$

## 9－3 李雅普诺夫稳定性分析

稳定性是系统的重要特性，是系统正常工作的必要条件，它描述初始条件下系统方程的解是否具有收玫性，而与输入作用无关。1892年俄国学者李雅普诺夫提出的稳定性理论是确定系统稳定性的更一般性理论，它采用了状态向量描述，不仅适用于单变量、线性、定常系统，而且适用于多变量、非线性、时变系统。在分析一些特定的非线性系统的稳定性时，李雅普诺夫理论有效地解决了用其他方法所不能解决的问题。李雅普诺夫理论在建立一系列关于稳定性概念的基础上，提出了判断系统稳定性的两种方法：一种方法是利用线性系统微分方程的解来判断系统稳定性，称之为李雅普诺夫第一法或间接法；另一种方法是首先利用经验和技巧来构造李雅普诺夫函数，进而利用李雅普诺夫函数来判断系统稳定性，称之为李雅普诺夫第二法或直接法。由于间接法需要解线性系统微分方程，求解系统微分方程往往并非易事，所以间接法的应用受到了很大限制。而直接法不需要解系统微分方程，给判断系统的稳定性带来极大方便，获得了广泛应用。

## 1．李雅普诺夫意义下的稳定性

设系统方程为

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{f}(\boldsymbol{x}, t) \tag{9-208}
\end{equation*}
$$

式中， $\boldsymbol{x}$ 为 $n$ 维状态向量，且显含时间变量 $t ; \boldsymbol{f}(\boldsymbol{x}, t)$ 为线性或非线性、定常或时变的 $n$维向量函数，其展开式为

$$
\begin{equation*}
\dot{x}_{i}=f_{i}\left(x_{1}, x_{2}, \cdots, x_{n}, t\right) ; \quad i=1,2, \cdots, n \tag{9-209}
\end{equation*}
$$

假定方程的解为 $\boldsymbol{x}\left(t ; \boldsymbol{x}_{0}, t_{0}\right)$ ，式中 $\boldsymbol{x}_{0}$ 和 $t_{0}$ 分别为初始状态向量和初始时刻，则初始条件 $\boldsymbol{x}_{0}$必满足 $\boldsymbol{x}\left(t_{0} ; \boldsymbol{x}_{0}, t_{0}\right)=\boldsymbol{x}_{0}$ 。



<!-- source_pdf_page: 517 -->
（1）平衡状态
李雅普诺夫关于稳定性的研究均针对平衡状态而言。对于所有 $t$ ，满足

$$
\begin{equation*}
\dot{\boldsymbol{x}}_{e}=\boldsymbol{f}\left(\boldsymbol{x}_{e}, t\right)=\mathbf{0} \tag{9-210}
\end{equation*}
$$

的状态 $\boldsymbol{x}_{e}$ 称为平衡状态。平衡状态的各分量相对于时间不再发生变化。若已知状态方程，令 $\boldsymbol{x}=\mathbf{0}$ 所求得的解 $\boldsymbol{x}$ ，便是一种平衡状态。

线性定常系统 $\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}$ ，其平衡状态满足 $\boldsymbol{A} \boldsymbol{x}_{e}=\mathbf{0}$ ，当 $\boldsymbol{A}$ 为非奇异矩阵时，系统只有唯一的零解，即只存在一个位于状态空间原点的平衡状态。若 $\boldsymbol{A}$ 为奇异矩阵，则系统存在有无穷多个平衡状态。对于非线性系统，可能有一个或多个平衡状态。
（2）李雅普诺夫意义下的稳定性
设系统初始状态位于以平衡状态 $\boldsymbol{x}_{e}$ 为球心、 $\delta$ 为半径的闭球域 $S(\delta)$ 内，即

$$
\begin{equation*}
\left\|\boldsymbol{x}_{0}-\boldsymbol{x}_{e}\right\| \leqslant \delta, \quad t=t_{0} \tag{9-211}
\end{equation*}
$$

若能使系统方程的解 $\boldsymbol{x}\left(t ; \boldsymbol{x}_{0}, t_{0}\right)$ 在 $t \rightarrow \infty$ 的过程中，都位于以 $\boldsymbol{x}_{e}$ 为球心、任意规定的半径为 $\varepsilon$ 的闭球域 $S(\varepsilon)$ 内，即

$$
\begin{equation*}
\left\|\boldsymbol{x}\left(t ; \boldsymbol{x}_{0}, t_{0}\right)-\boldsymbol{x}_{0}\right\| \leqslant \varepsilon, \quad t \geqslant t_{0} \tag{9-212}
\end{equation*}
$$

则称系统的平衡状态 $\boldsymbol{x}_{e}$ 在李雅普诺夫意义下是稳定的。该定义的平面几何表示如图 9－23（a）所示。式中 $\|\cdot\|$ 为欧几里得范数，其几何意义是空间距离的尺度。例如 $\left\|\boldsymbol{x}_{0}-\boldsymbol{x}_{e}\right\|$ 表示状态空间中 $\boldsymbol{x}_{0}$ 点至 $\boldsymbol{x}_{e}$ 点之间距离的尺度，其数学表达式为

$$
\begin{equation*}
\left\|\boldsymbol{x}_{0}-\boldsymbol{x}_{e}\right\|=\left[\left(x_{10}-x_{1 e}\right)^{2}+\cdots+\left(x_{n 0}-x_{n e}\right)^{2}\right]^{\frac{1}{2}} \tag{9-213}
\end{equation*}
$$

实数 $\delta$ 与 $\varepsilon$ 有关，通常也与 $t_{0}$ 有关。如果 $\delta$ 与 $t_{0}$ 无关，则称平衡状态是一致稳定的。

![](assets/fig-09-23.png)

> Image description: This textbook figure illustrates three types of stability in dynamical systems using phase plane geometry. The x₁-x₂ plane shows trajectories spiraling around equilibrium point xₑ. In (a), “Liapunov stability” shows trajectories confined within concentric circles S(δ) and S(ε), with δ < ε, indicating boundedness without convergence. In (b), “asymptotic stability” adds that trajectories converge to xₑ as time increases, spiraling inward from S(ε) to S(δ). In (c), “instability” depicts trajectories moving outward from S(δ) toward S(ε), diverging from xₑ. Arrows indicate direction of motion, and labeled circles define regions of influence. The figure visually distinguishes stability concepts critical in nonlinear system analysis, with ε and δ denoting radii of concentric circles.
图9－23 有关稳定性的平而几何表示

应当注意，按李雅普诺夫意义下的稳定性定义，当系统作不衰减的振荡运动时，将在平面描绘出一条封闭曲线，但只要不超出 $S(\varepsilon)$ ，则认为是稳定的，这与经典控制理论中线性定常系统稳定性的定义是有差异的。经典控制理论中的稳定性，指的是渐近稳定性。
（3）渐近稳定性
若系统的平衡状态 $\boldsymbol{x}_{e}$ 不仅具有李雅普诺夫意义下的稳定性，且有

$$
\begin{equation*}
\lim _{t \rightarrow \infty}\left\|\boldsymbol{x}\left(t ; \boldsymbol{x}_{0}, t_{0}\right)-\boldsymbol{x}_{e}\right\|=0 \tag{9-214}
\end{equation*}
$$



<!-- source_pdf_page: 518 -->
则称此平衡状态是渐近稳定的。这时，从 $S(\delta)$ 出发的轨迹不仅不会超出 $S(\varepsilon)$ ，且当 $t \rightarrow \infty$时收敛于 $x_{e}$ ，其平面几何表示如图9－23（b）所示。显见经典控制理论中的稳定性定义与此处的渐近稳定性对应。

若 $\delta$ 与 $t_{0}$ 无关，且式（9－214）的极限过程与 $t_{0}$ 无关，则称平衡状态是一致渐近稳定的。
（4）大范围（全局）渐近稳定性
当初始条件扩展至整个状态空间，且平衡状态均具有渐近稳定性时，称此平衡状态是大范围渐近稳定的。此时 $\delta \rightarrow \infty, S(\delta) \rightarrow \infty$ 。当 $t \rightarrow \infty$ 时，由状态空间中任一点出发的轨迹都收敛至 $x_{e}$ 。

对于严格线性的系统，如果它是渐近稳定的，则必定是大范围渐近稳定的，这是因为线性系统的稳定性与初始条件的大小无关。而对于非线性系统来说，其稳定性往往与初始条件的大小密切相关，系统渐近稳定不一定是大范围渐近稳定。
（5）不稳定性
如果对于某个实数 $\varepsilon>0$ 和任一个实数 $\delta>0$ ，不管这两个实数有多么小，在 $S(\delta)$ 内总存在着一个状态 $\boldsymbol{x}_{0}$ ，使得由这一状态出发的轨迹超出 $S(\varepsilon)$ ，则平衡状态 $\boldsymbol{x}_{e}$ 称为是不稳定的，如图9－23（c）所示。

下面介绍李雅普诺夫理论中判断系统稳定性的方法。
2．李雅普诺夫第一法（间接法）
李雅普诺夫第一法是利用状态方程解的特性来判断系统稳定性的方法，它适用于线性定常、线性时变以及非线性函数可线性化的情况。由于本章主要研究线性定常系统，所以在此仅介绍线性定常系统的特征值判据。

定理 9－1 对于线性定常系统 $\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}, \boldsymbol{x}(0)=x_{0}, t \geqslant 0$ ，有
1）系统的每一平衡状态是在李雅普诺夫意义下稳定的充分必要条件是， $\boldsymbol{A}$ 的所有特征值均具有非正（负或零）实部，且具有零实部的特征值为 $\boldsymbol{A}$ 的最小多项式的单根。

2）系统的唯一平衡状态 $\boldsymbol{x}_{e}=\mathbf{0}$ 是渐近稳定的充分必要条件是， $\boldsymbol{A}$ 的所有特征值均具有负实部。

证明 1）设 $\boldsymbol{x}_{e}$ 为 $\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}$ 的平衡状态，则由性质 $\dot{\boldsymbol{x}}_{e}=\mathbf{0}$ 和 $\boldsymbol{A} \boldsymbol{x}_{e}=\mathbf{0}$ 可知，对于所有$t \geqslant 0$ 均有

$$
\begin{equation*}
\boldsymbol{x}_{e}=\mathrm{e}^{A t} \boldsymbol{x}_{e} \tag{9-215}
\end{equation*}
$$

于是，考虑到 $\boldsymbol{x}\left(t ; \boldsymbol{x}_{0}, 0\right)=\mathrm{e}^{A t} \boldsymbol{x}_{0}$ ，有

$$
\begin{equation*}
x\left(t ; x_{0}, 0\right)-x_{e}=\mathrm{e}^{A t}\left(x_{0}-x_{e}\right), \quad \forall t \geqslant 0 \tag{9-216}
\end{equation*}
$$

这表明，当且仅当 $\left\|\mathrm{e}^{A t}\right\| \leqslant k<\infty$ 时，对任意给的一个实数 $\varepsilon>0$ ，都对应存在和初始时刻无关的一个实数 $\delta(\varepsilon)=\varepsilon / k$ ，使得由满足不等式

$$
\begin{equation*}
\left\|\boldsymbol{x}_{0}-\boldsymbol{x}_{e}\right\| \leqslant \delta(\varepsilon) \tag{9-217}
\end{equation*}
$$

的任一初态 $x_{0}$ 出发的受扰运动都满足不等式

$$
\begin{equation*}
\left\|x\left(t ; x_{0}, 0\right)-x_{e}\right\| \leqslant\left\|\mathrm{e}^{A t}\right\| \cdot\left\|x_{0}-x_{e}\right\| \leqslant k \cdot \frac{\varepsilon}{k}, \quad \forall t \geqslant 0 \tag{9-218}
\end{equation*}
$$



<!-- source_pdf_page: 519 -->
从而由定义知，系统的每一个平衡状态均为李雅普诺夫意义下稳定。再引入非奇异变换阵 $\boldsymbol{P}$ ，使得 $\hat{\boldsymbol{A}}=\boldsymbol{P}^{-1} \boldsymbol{A P}$ 为矩阵 $\boldsymbol{A}$ 的约当规范型，则又有

$$
\begin{equation*}
\left\|\mathrm{e}^{\hat{A} t}\right\| \leqslant\left\|\boldsymbol{P}^{-1}\right\| \cdot\left\|\mathrm{e}^{A t}\right\| \cdot\|\boldsymbol{P}\| \tag{9-219}
\end{equation*}
$$

因而 $\left\|\mathrm{e}^{A t}\right\|$ 有界等价于 $\left\|\mathrm{e}^{\hat{\lambda} t}\right\|$ 有界。但是，由 $\hat{\boldsymbol{A}}$ 为约当规范型可知 $\mathrm{e}^{\hat{\lambda} t}$ 每一元的形式为

$$
\begin{equation*}
t^{\beta} \mathrm{e}^{a_{i} t+\mathrm{j} \omega_{i} t}, \quad \alpha_{i}+\mathrm{j} \omega_{i}=\lambda_{i}(\hat{\boldsymbol{A}})=\lambda_{i}(\boldsymbol{A}) \tag{9-220}
\end{equation*}
$$

式中，$\lambda_{i}(\cdot)$ 为（•）的特征值；$\beta_{i}$ 为特征值的重数。注意到式（9－220）中，当 $\alpha_{i}<0$ 时对任何正整数 $\beta_{i}$ ，此元在 $[0, \infty)$ 上为有界，而 $\alpha_{i}=0$ 时只对 $\beta_{i}=0$ ，此元在 $[0, \infty)$ 上为有界。同时， $\mathrm{e}^{A t}$ 的每一个元有界意味着 $\left\|\mathrm{e}^{A t}\right\|$ 有界。由此可知，当且仅当 $A$ 的所有特征值均具有负或零实部，且具有零实部的特征值为单根时，$\left\|\mathrm{e}^{\dot{A} t}\right\|$ 为有界，也就是系统的每一个平衡状态为李雅普诺夫意义下的稳定。结论1）证毕。

2）由式（9－216）可知，当且仅当 $\left\|\mathrm{e}^{A t}\right\|$ 对一切 $t \geqslant 0$ 为有界，且当 $t \rightarrow 0$ 时 $\left\|\mathrm{e}^{A t}\right\| \rightarrow 0$ ，零平衡状态 $\boldsymbol{x}_{e}=\mathbf{0}$ 为渐近稳定。如上所证，当且仅当 $\boldsymbol{A}$ 的所有特征值均具有负或零实部时，$\left\|\mathrm{e}^{A t}\right\|$ 有界。又根据式（9－219）和式（9－220）可知，当且仅当 $t \rightarrow \infty$ 时 $t^{\beta} \mathrm{e}^{\alpha,+\mathrm{j} \omega t} \rightarrow 0$ ，可保证$t \rightarrow 0$ 时 $\left\|\mathrm{e}^{A t}\right\| \rightarrow 0$ ，这等价于 $A$ 的特征值均具有负实部。结论2）证毕。

由于所讨论的系统为线性定常系统，当其为稳定时必是一致稳定，当其为渐定稳定时必是大范围一致渐近稳定。

## 3．李雅普诺夫第二法（直接法）

根据古典力学中的振动现象，若系统能量（含动能与位能）随时间推移而衰减，系统迟早会达到平衡状态，但要找到实际系统的能量函数表达式并非易事。李雅普诺夫提出，可虚构一个能量函数，后来便被称为李雅普诺夫函数，一般它与 $x_{1}, x_{2}, \cdots, x_{n}$ 及 $t$ 有关，记以 $V(\boldsymbol{x}, t)$ 。若不显含 $t$ ，则记以 $V(\boldsymbol{x})$ 。它是一个标量函数，考虑到能量总大于零，故为正定函数。能量衰减特性用 $\dot{V}(\boldsymbol{x}, t)$ 或 $\dot{V}(\boldsymbol{x})$ 表示。李雅普诺夫第二法利用 $V$ 及 $\dot{V}$ 的符号特征，直接对平衡状态稳定性作出判断，无须求出系统状态方程的解，故称直接法。用此方法解决了一些用其他稳定性判据难以解决的非线性系统的稳定性问题，遗憾的是对一般非线性系统仍未找到构造李雅普诺夫函数的通用方法。对于线性系统，通常用二次型函数 $\boldsymbol{x}^{\mathrm{T}} \boldsymbol{P x}$ 作为李雅普诺夫函数。

这里不打算对李雅普诺夫第二法中的诸稳定性定理在数学上作严格证明，而只着重于物理概念的阐述和应用。
（1）标量函数定号性的简要回顾
正定性 标量函数 $V(\boldsymbol{x})$ 对所有在域 $S$ 中的非零状态 $\boldsymbol{x}$ 有 $V(\boldsymbol{x})>0$ 且 $V(\mathbf{0})=0$ ，则在域 $S$（域 $S$ 包含状态空间的原点）内的标量函数 $V(x)$ 称为是正定的。

负定性 如果 $-V(\boldsymbol{x})$ 是正定函数，则标量函数 $V(\boldsymbol{x})$ 称为负定函数。
正半定性 如果标量函数 $V(x)$ 除了原点及某些状态处等于零外，在域 $S$ 内的所有状态都是正定的，则 $V(\boldsymbol{x})$ 称为正半定函数。



<!-- source_pdf_page: 520 -->
负半定性 如果 $-V(\boldsymbol{x})$ 是正半定函数，则标量函数 $V(\boldsymbol{x})$ 称为负半定函数。
不定性 如果在域 $S$ 内，不论域 $S$ 多么小，$V(\boldsymbol{x})$ 既可为正值也可为负值，则标量函数 $V(\boldsymbol{x})$ 称为不定函数。
（2）李雅普诺夫第二法主要定理
定理 9－2（定常系统大范围渐近稳定判别定理1）对于定常系统

$$
\begin{equation*}
\dot{\boldsymbol{x}}=\boldsymbol{f}(\boldsymbol{x}), \quad t \geqslant 0 \tag{9-221}
\end{equation*}
$$

其中 $\boldsymbol{f}(\mathbf{0})=\mathbf{0}$ ，如果存在一个具有连续一阶导数的标量函数 $V(\boldsymbol{x}), V(\mathbf{0})=0$ ，并且对于状态空间 $X$ 中的一切非零点 $\boldsymbol{x}$ 满足如下条件：

1）$V(\boldsymbol{x})$ 为正定；
2）$\dot{V}(\boldsymbol{x})$ 为负定；
3）当 $\|x\| \rightarrow \infty$ 时 $V(x) \rightarrow \infty$ 。
则系统的原点平衡状态是大范围渐近稳定的。
例 9－22 设系统状态方程为

$$
\begin{aligned}
& \dot{x}_{1}=x_{2}-x_{1}\left(x_{1}^{2}+x_{2}^{2}\right) \\
& \dot{x}_{2}=-x_{1}-x_{2}\left(x_{1}^{2}+x_{2}^{2}\right)
\end{aligned}
$$

试确定系统的稳定性。
解 显然，原点 $\left(x_{1}=0, x_{2}=0\right)$ 是该系统唯一的平衡状态。选取正定标量函数 $V(x)$ 为

$$
V(\boldsymbol{x})=x_{1}^{2}+x_{2}^{2}
$$

则沿任意轨迹 $V(\boldsymbol{x})$ 对时间的导数

$$
\dot{V}(\boldsymbol{x})=2 x_{1} \dot{x}_{1}+2 x_{2} \dot{x}_{2}=-2\left(x_{1}^{2}+x_{2}^{2}\right)^{2}
$$

是负定的。这说明 $V(\boldsymbol{x})$ 沿任意轨迹是连续减小的，因此 $V(\boldsymbol{x})$ 是一个李雅普诺夫函数。由于当 $\|\boldsymbol{x}\| \rightarrow \infty$ 时 $V(\boldsymbol{x}) \rightarrow \infty$ ，所以系统在原点处的平衡状态是大范围渐近稳定的。

一般地说，对于相当一部分系统，要构造一个李雅普诺夫函数 $V(\boldsymbol{x})$ 使其满足定理 9－2 中所要求的 $\dot{V}(\boldsymbol{x})$ 为负定这一条件，常常不易做到。同时，从直观上也容易理解，要求 $\dot{V}(\boldsymbol{x})$ 为负定不免过于保守。下面给出将这一条件放宽后的定常系统大范围渐近稳定判别定理。

定理9－3（定常系统大范围渐近稳定判别定理2）对于定常系统（9－221），如果存在一个具有连续一阶导数的标量 $V(\boldsymbol{x}), V(\mathbf{0})=0$ ，并且对状态空间 $X$ 中的一切非零点 $\boldsymbol{x}$ 满足如下的条件：

1）$V(\boldsymbol{x})$ 为正定；
2）$\dot{V}(\boldsymbol{x})$ 为负半定；
3）对任意 $\boldsymbol{x} \in X, \dot{V}\left(\boldsymbol{x}\left(t ; x_{0}, 0\right)\right) \not \equiv 0$ ；
4）当 $\|\boldsymbol{x}\| \rightarrow \infty$ 时 $V(\boldsymbol{x}) \rightarrow \infty$ 。
则系统的原点平衡状态是大范围渐近稳定的。
例 9－23 已知定常系统状态方程为

$$
\begin{aligned}
& \dot{x}_{1}=x_{2} \\
& \dot{x}_{2}=-x_{1}-\left(1+x_{2}\right)^{2} x_{2}
\end{aligned}
$$

试确定系统的稳定性。



<!-- source_pdf_page: 521 -->
解 易知原点 $\left(x_{1}=0, x_{2}=0\right)$ 为系统唯一的平衡状态。现取 $V(\boldsymbol{x})=x_{1}^{2}+x_{2}^{2}$ ，且有
1）$V(\boldsymbol{x})=x_{1}^{2}+x_{2}^{2}$ 为正定。
2）$\dot{V}(\boldsymbol{x})=2 x_{1} \dot{x}_{1}+2 x_{2} \dot{x}_{2}=-2 x_{2}^{2}\left(1+x_{2}\right)^{2}$ 。容易看出，除了（1）$x_{1}$ 任意，$x_{2}=0$ ；（2）$x_{1}$ 任意，$x_{2}=-1$ 时，$\dot{V}(\boldsymbol{x})=0$ 以外，均有 $\dot{V}(\boldsymbol{x})<0$ 。所以，$\dot{V}(\boldsymbol{x})$ 为负半定。
3）检查是否 $\dot{V}\left(\boldsymbol{x}\left(t ; \boldsymbol{x}_{0}, 0\right)\right) \not \equiv 0$ 。考虑到使得 $\dot{V}(\boldsymbol{x})=0$ 的可能性只有上述（1）和（2）两种情况，所以问题归结为判断这两种情况是否为系统的受扰运动解。先考察情况（1）：设$\overline{\boldsymbol{x}}\left(t ; \boldsymbol{x}_{0}, 0\right)=\left[x_{1}(t) \quad 0\right]^{\mathrm{T}}$ ，则由 $x_{2}(t) \equiv 0$ 可导出 $\dot{x}_{2}(t)=0$ ，将此代人系统状态方程可得

$$
\begin{aligned}
& \dot{x}_{1}(t)=x_{2}(t)=0 \\
& 0=\dot{x}_{2}(t)=-\left(1+x_{2}(t)\right)^{2} x_{2}(t)-x_{1}(t)=-x_{1}(t)
\end{aligned}
$$

这表明，除了点 $\left(x_{1}=0, x_{2}=0\right)$ 外，$\overline{\boldsymbol{x}}\left(t ; \boldsymbol{x}_{0}, 0\right)=\left[x_{1}(t) \quad 0\right]^{\mathrm{T}}$ 不是系统的受扰运动解。再考察情况（2）：设 $\overline{\boldsymbol{x}}\left(t ; \boldsymbol{x}_{0}, 0\right)=\left[x_{1}(t)-1\right]^{\mathrm{T}}$ ，则由 $x_{2}(t)=-1$ 可导出 $\dot{x}_{2}(t)=0$ ，将此代人系统状态方程可得

$$
\begin{aligned}
& \dot{x}_{1}(t)=x_{2}(t)=-1 \\
& 0=\dot{x}_{2}(t)=-\left(1+x_{2}(t)\right)^{2} x_{2}(t)-x_{1}(t)=-x_{1}(t)
\end{aligned}
$$

显然这是一个矛盾的结果，表明 $\overline{\boldsymbol{x}}\left(t ; \boldsymbol{x}_{0}, 0\right)=\left[x_{1}(t)-1\right]^{\mathrm{T}}$ 也不是系统的受扰运动解。综合以上分析可知，$\dot{V}\left(\boldsymbol{x}\left(t ; \boldsymbol{x}_{0}, 0\right)\right) \not \equiv 0$ 。
4）当 $\|x\| \rightarrow \infty$ 时，显然有 $V(x)=\|x\|^{2} \rightarrow \infty$ 。
于是，根据定理 9－3 可判定系统的原点平衡状态是大范围渐近稳定的。
由于上述给出的所有判别定理都只提供了充分条件，如果经多次试取李雅普诺夫函数都得不到确定的答案时，就要考虑其为不稳定的可能性。下面的定理给出了判别不稳定的充分条件。

定理 9－4（不稳定判别定理）对于定常系统（9－221），如果存在一个具有连续一阶导数的标量函数 $V(\boldsymbol{x})$（其中 $V(\mathbf{0})=0$ ），和围绕原点的域 $\Omega$ ，使得对于一切 $\boldsymbol{x} \in \Omega$ 和一切 $t \geqslant t_{0}$ 满足如下条件：
1）$V(\boldsymbol{x})$ 为正定；
2）$\dot{V}(\boldsymbol{x})$ 为正定。
则系统平衡状态为不稳定。
4．线性定常系统的李雅普诺夫稳定性分析
下面介绍李雅普诺夫第二法在线性定常系统稳定性分析中的应用。
（1）线性定常连续系统渐近稳定性的判别
设线性定常系统状态方程为 $\dot{x}=\boldsymbol{A} \boldsymbol{x}, \boldsymbol{x}(0)=\boldsymbol{x}_{0}, t \geqslant 0, \boldsymbol{A}$ 为非奇异矩阵，故原点是唯一平衡状态。设取正定二次型函数 $V(x)=\boldsymbol{x}^{\mathrm{T}} \boldsymbol{P x}$ 作为可能的李雅普诺夫函数，考虑到系统状态方程，则有

$$
\begin{gather*}
\dot{V}(x)=\dot{x}^{\mathrm{T}} P x+x^{\mathrm{T}} P \dot{x}=x^{\mathrm{T}}\left(A^{\mathrm{T}} P+P A\right) x  \tag{9-222}\\
A^{\mathrm{T}} P+P A=-Q \tag{9-223}
\end{gather*}
$$



<!-- source_pdf_page: 522 -->
于是有

$$
\begin{equation*}
\dot{V}(\boldsymbol{x})=-\boldsymbol{x}^{\mathrm{T}} \boldsymbol{Q} \boldsymbol{x} \tag{9-224}
\end{equation*}
$$

根据定常系统大范围渐近稳定判别定理1，只要 $Q$ 正定（即 $\dot{V}(\boldsymbol{x})$ 负定），则系统是大范围渐近稳定的。于是线性定常连续系统渐近稳定的充分必要条件可表示为：给定一正定矩阵 $\boldsymbol{P}$ ，存在着满足式（9－223）的正定矩阵 $\boldsymbol{Q}$ ，而 $\boldsymbol{x}^{\mathrm{T}} \boldsymbol{P} \boldsymbol{x}$ 是该系统的一个李雅普诺夫函数，式（9－223）称为李雅普诺夫矩阵代数方程。

但是，按上述先给定 $\boldsymbol{P}$ 、再验证 $\boldsymbol{Q}$ 是否正定的步骤去分析系统稳定性时，若 $\boldsymbol{P}$ 选取不当，往往会导致 $\boldsymbol{Q}$ 非正定，需反复多次选取 $\boldsymbol{P}$ 阵来检验 $\boldsymbol{Q}$ 是否正定，使用中很不方便。因而在应用时，往往是先选取 $\boldsymbol{Q}$ 为正定实对称矩阵，再求解式（9－223），若所求得的 $\boldsymbol{P}$ 阵为正定实对称矩阵，则可判定系统是渐近稳定的。由于使用中常选取 $\boldsymbol{Q}$ 阵为单位阵或对角线阵，比起先选 $\boldsymbol{P}$ 阵再检验 $\boldsymbol{Q}$ 阵要方便得多，所以在判定系统的稳定性时常利用下述定理：

定理 9－5 线性定常系统 $\dot{\boldsymbol{x}}=\boldsymbol{A} \boldsymbol{x}, \boldsymbol{x}(0)=\boldsymbol{x}_{0}, t \geqslant 0$ 的原点平衡状态 $\boldsymbol{x}_{\mathrm{e}}=\mathbf{0}$ 为渐近稳定的充分必要条件是，对于任意给定的一个正定对称矩阵 $\boldsymbol{Q}$ ，有唯一的正定对称矩阵 $\boldsymbol{P}$ 使式（9－223）成立。

需要说明的是，在利用上述定理判断线性定常系统的渐近稳定性时，对 $Q$ 的唯一限制是其应为对称正定阵。显然，满足这种限制的 $\boldsymbol{Q}$ 阵可能有无穷多个，但判断的结果即系统是否为渐近稳定，则和 $\boldsymbol{Q}$ 阵的不同选择无关。上述定理的实质是给出了矩阵 $\boldsymbol{A}$ 的所有特征值均具有负实部的充分必要条件。

根据定常系统大范围渐近稳定判别定理 2 可以推知，若系统任意的状态轨迹在非零状态不存在 $\dot{V}(\boldsymbol{x})$ 恒为零时， $\boldsymbol{Q}$ 阵可选择为正半定的，即允许 $\boldsymbol{Q}$ 取半正定对角阵时主对角线上部分元素为零，而解得的 $\boldsymbol{P}$ 阵仍应正定。

由于利用上述定理判断线性定常系统是否渐近稳定时需要求解李雅普诺夫方程（ $9-223$ ），但一般地说求解李雅普诺夫方程并非易事，因而这种方法往往不用来判定系统的渐近稳定性，而是用来构造线性定常连续渐近稳定系统。

例 9－24 已知线性定常连续系统状态方程为

$$
\dot{x}_{1}=x_{2}, \quad \dot{x}_{2}=2 x_{1}-x_{2}
$$

试用李雅普诺夫方程判定系统的渐近稳定性。
解 为便于对比，先用特征值判据判断。系统状态方程为

$$
\begin{gathered}
\dot{\boldsymbol{x}}=\left[\begin{array}{cc}
0 & 1 \\
2 & -1
\end{array}\right] \boldsymbol{x}, \quad \boldsymbol{A}=\left[\begin{array}{cc}
0 & 1 \\
2 & -1
\end{array}\right] \\
|\lambda \boldsymbol{I}-\boldsymbol{A}|=\left[\begin{array}{cc}
\lambda & -1 \\
-2 & \lambda+1
\end{array}\right]=\lambda^{2}+\lambda-2=(\lambda-1)(\lambda+2)
\end{gathered}
$$

特征值为 $-2,1$ ，故系统不稳定。令

$$
\begin{aligned}
& \boldsymbol{A}^{\mathrm{T}} \boldsymbol{P}+\boldsymbol{P} \boldsymbol{A}=-\boldsymbol{Q}=-\boldsymbol{I} \\
& \boldsymbol{P}=\boldsymbol{P}^{\mathrm{T}}=\left[\begin{array}{ll}
P_{11} & P_{12} \\
P_{12} & P_{22}
\end{array}\right]
\end{aligned}
$$



<!-- source_pdf_page: 523 -->


<!-- source_pdf_page: 524 -->


<!-- source_pdf_page: 525 -->
## 9－4 线性定常系统的反馈结构及状态观测器

为了利用状态进行反馈，必须用传感器来测量状态变量，但并不是所有状态变量在物理上都可测量，于是提出了用状态观测器给出状态估值的问题。因此，状态反馈与状态观测器的设计便构成了用状态空间法综合设计系统的主要内容。

1．线性定常系统常用反馈结构及其对系统特性的影响
（1）两种常用反馈结构
在系统的综合设计中，两种常用的反馈形式是线性直接状态反馈和线性非动态输出反馈，简称为状态反馈和输出反馈。
1）状态反馈。设有 $n$ 维线性定常系统

$$
\begin{equation*}
\dot{\boldsymbol{x}}=A \boldsymbol{x}+B \boldsymbol{u}, \quad y=C x \tag{9-227}
\end{equation*}
$$

式中， $\boldsymbol{x} 、 \boldsymbol{u} 、 \boldsymbol{y}$ 分别为 $n$ 维、 $p$ 维和 $q$ 维向量； $\boldsymbol{A} 、 \boldsymbol{B} 、 \boldsymbol{C}$ 分别为 $n \times n 、 n \times p 、 q \times n$ 实数矩阵。

当将系统的控制量 $\boldsymbol{u}$ 取为状态变量的线性函数

$$
\begin{equation*}
u=v-K x \tag{9-228}
\end{equation*}
$$

时，称之为线性直接状态反馈，简称为状态反馈，其中 $\boldsymbol{v}$ 为 $p$ 维参考输入向量， $\boldsymbol{K}$ 为（ $p \times n)$ 维实反馈增益矩阵。在研究状态反馈时，假定所有的状态变量都是可以用来反馈的。

将式（9－228）代人式（9－227）可得状态反馈系统动态方程

$$
\begin{equation*}
\dot{x}=(A-B K) x+B v, \quad y=C x \tag{9-229}
\end{equation*}
$$

其传递函数矩阵为

$$
\begin{equation*}
\boldsymbol{G}_{K}(s)=\boldsymbol{C}(s \boldsymbol{I}-\boldsymbol{A}+\boldsymbol{B} \boldsymbol{K})^{-1} \boldsymbol{B} \tag{9-230}
\end{equation*}
$$

因此可用 $\{\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}, \boldsymbol{B}, \boldsymbol{C}\}$ 来表示引人状态反馈后的闭环系统。由式（9－229）可以看出，引入状态反馈后系统的输出方程没有变化。

加入状态反馈后系统方框图如图 9－24 所示。

![](assets/fig-09-24.png)

> Image description: This figure illustrates a state-feedback control system, labeled as Figure 9-24. Input signal 'v' enters a summing junction, subtracting feedback 'u' to produce 'u'. 'u' passes through block 'B', then adds to 'x-dot' (ẋ) at a summing junction. 'ẋ' enters an integrator (I/s), yielding state 'x'. 'x' feeds into output block 'C' to produce output 'y', and also splits to multiply by gain 'A' and feedback gain 'K'. The 'A' and 'K' blocks combine their outputs and subtract from the input to the first summing junction, forming a closed-loop system. Arrows indicate signal flow, and blocks represent system components: 'B' is a plant, 'I/s' is an integrator, 'C' is an output function, 'A' and 'K' are feedback gains. The diagram shows how state feedback improves system stability and response.
图9－24 加入状态反馈后系统方框图

2）输出反馈。系统的状态常常不能全部测量到，因而状态反馈法的应用受到了限制。在此情况下，人们常常采用输出反馈法。输出反馈的目的首先是使系统闭环成为稳定系统，然后在此基础上进一步改善闭环系统性能。

输出反馈有两种形式：一种是将输出量反馈至状态微分，另一种是将输出量反馈至参考输入。

输出量反馈至状态微分系统方框图如图 9－25 所示。输出反馈系统的动态方程为

$$
\begin{equation*}
\dot{x}=A x+B u-H y=(A-H C) x+B u, \quad y=C x \tag{9-231}
\end{equation*}
$$

其传递函数矩阵为

$$
\begin{equation*}
\boldsymbol{G}_{H}(s)=\boldsymbol{C}(s \boldsymbol{I}-\boldsymbol{A}+\boldsymbol{H} \boldsymbol{C})^{-1} \boldsymbol{B} \tag{9-232}
\end{equation*}
$$



<!-- source_pdf_page: 526 -->
![](assets/fig-09-25.png)

> Image description: This block diagram (Fig. 9-25) depicts a state-differentiated feedback control system. Input u passes through block B, then combines with feedback from output y via block H and block A, which feeds into a summing junction. The error signal drives a system with transfer function I/s, yielding state x. The derivative x-dot is fed forward to the next stage. Output y is generated by block C, and a portion of y is fed back through H to the summing junction. The diagram shows interconnections between blocks B, A, H, and C, with arrows indicating signal flow. Variables u, x, x-dot, and y are labeled. The structure suggests a dynamic system with state estimation or differentiation, where feedback adjusts the input based on measured output to regulate the system’s behavior.
图9－25 输出量反馈至状态微分系统方框图

将输出量反馈至参考输人系统方框图如图 9－26 所示。当将系统的控制量 $\boldsymbol{u}$ 取为输出$y$ 的线性函数

$$
\begin{equation*}
u=v-F y \tag{9-233}
\end{equation*}
$$

时，称之为线性非动态输出反馈，常简称为输出反馈，其中 $\boldsymbol{v}$ 为 $p$ 维参考输入向量， $\boldsymbol{F}$为 $p \times q$ 维实反馈增益矩阵。这是一种最常用的输出反馈，在一些参考书中往往只介绍这一种输出反馈，而不介绍输出至状态微分的反馈。

![](assets/fig-09-26.png)

> Image description: This block diagram (Fig. 9-26) depicts a feedback control system with output y feeding back to the reference input. The system begins with a summing junction combining reference input v+ and feedback signal u, producing u. u passes through block B, then to a second summing junction that adds x-dot (ẋ). The ẋ signal enters an integrator (I/s), yielding x. x is sent to output block C, generating y. Simultaneously, x and y feed into blocks A and F, which influence the system’s feedback path. Block A and F modulate the feedback, which is summed with the reference to adjust u. The diagram illustrates how output feedback corrects the system’s response, with variables v, u, x, ẋ, y, and blocks A, B, C, F interconnecting via arrows to show signal flow.
图9－26 输出量反馈至参考输入系统方框图

将式（9－233）代人式（9－227）可得输出反馈系统动态方程

$$
\begin{equation*}
\dot{x}=(A-B F C) x+B v, \quad y=C x \tag{9-234}
\end{equation*}
$$

其传递函数矩阵为

$$
\begin{equation*}
\boldsymbol{G}_{F}(s)=\boldsymbol{C}(s \boldsymbol{I}-\boldsymbol{A}+\boldsymbol{B} \boldsymbol{F} \boldsymbol{C})^{-1} \boldsymbol{B} \tag{9-235}
\end{equation*}
$$

不难看出，不管是状态反馈还是输出反馈，都可以改变状态的系数矩阵，但这并不表明二者具有等同的功能。由于状态能完整地表征系统的动态行为，因而利用状态反馈时，其信息量大而完整，可以在不增加系统维数的情况下，自由地支配响应特性。而输出反馈仅利用了状态变量的线性组合进行反馈，其信息量较小，所引入的补偿装置将使系统维数增加，且难以得到任意的所期望的响应特性。一个输出反馈系统的性能，一定有对应的状态反馈系统与之等同，例如对于图 9－26 所示输出反馈系统，只要令 $\boldsymbol{F} \boldsymbol{C}=\boldsymbol{K}$ 便可确定状态反馈增益矩阵。但是，对于一个状态反馈系统，却不一定有对应的输出反馈系统与之等同，这是由于令 $\boldsymbol{K}=\boldsymbol{F} \boldsymbol{C}$ 来求解矩阵 $\boldsymbol{F}$ 时，有可能因 $\boldsymbol{F}$ 含有高阶导数而无法实现。对于非最小相位被控对象，如果含有在复平面右半平面上的极点，并且选择在复平面右半平面上的校正零点来加以对消时，便会有不稳定的隐患。但是，由于输出反馈所用的输出变量总是容易测量的，实现起来比较方便，因而获得了较广泛的应用。对于状态反馈系统中不便测量或不能测量的状态变量，需要利用状态观测器进行重构。有关状态观测器的设计问题，后面将作进一步阐述。



<!-- source_pdf_page: 527 -->
（2）反馈结构对系统性能的影响
由于引入反馈，系统状态的系数矩阵发生了变化，对系统的可控性、可观测性、稳定性、响应特性等均有影响。

1）对系统可控性和可观测性的影响。
定理 9－7 对于系统（9－227），状态反馈的引入不改变系统的可控性，但可能改变系统的可观测性。

证明 设被控系统 $\Sigma_{0}$ 的动态方程为

$$
\dot{x}=A x+B u, \quad y=C x
$$

加入状态反馈后系统 $\Sigma_{K}$ 的动态方程为

$$
\dot{x}=(A-B K) x+B v, \quad y=C x
$$

首先证明状态反馈系统 $\Sigma_{K}$ 可控的充分必要条件是被控系统 $\Sigma_{0}$ 可控。
系统 $\Sigma_{0}$ 的可控性矩阵为

$$
\boldsymbol{S}_{c}=\left[\begin{array}{llll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B}
\end{array}\right]
$$

系统 $\Sigma_{K}$ 的可控性矩阵为

$$
\boldsymbol{S}_{c K}=\left[\begin{array}{llll}
\boldsymbol{B} & (\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{B} & \cdots & (\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K})^{n-1} \boldsymbol{B}
\end{array}\right]
$$

由于

$$
\begin{gathered}
\boldsymbol{B}=\left[\begin{array}{llll}
\boldsymbol{b}_{1} & \boldsymbol{b}_{2} & \cdots & \boldsymbol{b}_{p}
\end{array}\right], \quad \boldsymbol{A} \boldsymbol{B}=\left[\begin{array}{llll}
\boldsymbol{A} \boldsymbol{b}_{1} & \boldsymbol{A} \boldsymbol{b}_{2} & \cdots & \boldsymbol{A} \boldsymbol{b}_{p}
\end{array}\right] \\
(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{B}=\left[\begin{array}{llll}
(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{b}_{1} & (\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{b}_{2} & \cdots & (\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{b}_{p}
\end{array}\right]
\end{gathered}
$$

式中， $\boldsymbol{b}_{i}(i=1,2, \cdots, p)$ 为列向量。将 $\boldsymbol{K}$ 表示为行向量组

$$
K=\left[\begin{array}{c}
k_{1} \\
k_{2} \\
\vdots \\
k_{p}
\end{array}\right]
$$

则

$$
(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{b}_{i}=\boldsymbol{A} \boldsymbol{b}_{i}-\left[\begin{array}{llll}
\boldsymbol{b}_{1} & \boldsymbol{b}_{2} & \cdots & \boldsymbol{b}_{p}
\end{array}\right]\left[\begin{array}{c}
\boldsymbol{k}_{1} \boldsymbol{b}_{i} \\
\boldsymbol{k}_{2} \boldsymbol{b}_{i} \\
\vdots \\
\boldsymbol{k}_{p} \boldsymbol{b}_{i}
\end{array}\right]
$$

令

$$
c_{1 i}=\boldsymbol{k}_{1} \boldsymbol{b}_{i}, \quad c_{2 i}=\boldsymbol{k}_{2} \boldsymbol{b}_{i}, \quad \cdots, \quad c_{p i}=\boldsymbol{k}_{p} \boldsymbol{b}_{i}
$$

式中，$c_{j i}(j=1,2, \cdots, p)$ 均为标量。故

$$
(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{b}_{i}=\boldsymbol{A} \boldsymbol{b}_{i}-\left(c_{1 i} \boldsymbol{b}_{1}+c_{2 i} \boldsymbol{b}_{2}+\cdots+c_{p i} \boldsymbol{b}_{p}\right)
$$

这说明 $(\boldsymbol{A}-\boldsymbol{B} \quad \boldsymbol{K}) \boldsymbol{B}$ 的列是 $\left[\begin{array}{ll}\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B}\end{array}\right]$ 列的线性组合。同理有 $(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K})^{2} \boldsymbol{B}$ 的列是 $\left[\begin{array}{lll}\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \boldsymbol{A}^{2} \boldsymbol{B}\end{array}\right]$列的线性组合，如此等等，故 $\boldsymbol{S}_{c K}$ 的每一列均可表为 $\boldsymbol{S}_{c}$ 的列的线性组合。由此可得

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{S}_{c K} \leqslant \operatorname{rank} \boldsymbol{S}_{c} \tag{9-236}
\end{equation*}
$$

另一方面，$\Sigma_{0}$ 又可看成为 $\Sigma_{K}$ 的状态反馈系统，即



<!-- source_pdf_page: 528 -->
$$
\dot{x}=A x+B u=[(A-B K)+B K] x+B u
$$

同理可得

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{S}_{c} \leqslant \operatorname{rank} \boldsymbol{S}_{c K} \tag{9-237}
\end{equation*}
$$

由式（9－236）和式（9－237）可得

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{S}_{c K}=\operatorname{rank} \boldsymbol{S}_{c} \tag{9-238}
\end{equation*}
$$

从而当且仅当 $\Sigma_{0}$ 可控时，$\Sigma_{K}$ 可控。
再来证明状态反馈系统不一定能保持可观测性，对此只需举一反例说明。例如，考察

$$
\dot{x}=\left[\begin{array}{ll}
1 & 2 \\
0 & 3
\end{array}\right] x+\left[\begin{array}{l}
0 \\
1
\end{array}\right] u, \quad y=\left[\begin{array}{ll}
1 & 1
\end{array}\right] x
$$

其可观测性判别阵

$$
\boldsymbol{V}_{o}=\left[\begin{array}{c}
\boldsymbol{c} \\
\boldsymbol{c} \boldsymbol{A}
\end{array}\right]=\left[\begin{array}{ll}
1 & 1 \\
1 & 5
\end{array}\right], \quad \operatorname{rank} \boldsymbol{V}_{o}=n=2
$$

故该系统可观测。现引入状态反馈，取 $\boldsymbol{k}=\left[\begin{array}{ll}0 & 4\end{array}\right]$ ，则状态反馈系统 $\Sigma_{K}$ 为

$$
\dot{\boldsymbol{x}}=(\boldsymbol{A}-\boldsymbol{b} \boldsymbol{k}) \boldsymbol{x}+\boldsymbol{b} v=\left[\begin{array}{cc}
1 & 2 \\
0 & -1
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{l}
0 \\
1
\end{array}\right] v, \quad y=\left[\begin{array}{ll}
1 & 1
\end{array}\right] \boldsymbol{x}
$$

其可观测性判别阵

$$
\boldsymbol{V}_{o K}=\left[\begin{array}{c}
\boldsymbol{c} \\
\boldsymbol{c}(\boldsymbol{A}-\boldsymbol{b} \boldsymbol{k})
\end{array}\right]=\left[\begin{array}{ll}
1 & 1 \\
1 & 1
\end{array}\right], \quad \operatorname{rank} \boldsymbol{V}_{o K}=1<n=2
$$

故该状态反馈系统为不可观测。而若取 $k=\left[\begin{array}{ll}0 & 5\end{array}\right]$ ，则通过计算可知，此时它成为可观测的。这表明状态反馈可能改变系统的可观测性，其原因是状态反馈造成了所配置的极点与零点相对消。

定理 9－8 对于系统（9－227），输出至状态微分反馈的引入不改变系统的可观测性，但可能改变系统的可控性。

证明 用对偶定理证明。设被控对象 $\Sigma_{0}$ 为 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ ，将输出反馈至状态微分的系统$\Sigma_{H}$ 为 $((\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C}), \boldsymbol{B}, \boldsymbol{C})$ ，若 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ 可观测，则对偶系统 $\left(\boldsymbol{A}^{\mathrm{T}}, \boldsymbol{C}^{\mathrm{T}}, \boldsymbol{B}^{\mathrm{T}}\right)$ 可控，由定理9－7可知，系统 $\left(\boldsymbol{A}^{\mathrm{T}}, \boldsymbol{C}^{\mathrm{T}}, \boldsymbol{B}^{\mathrm{T}}\right)$ 加入状态反馈后的系统 $\left(\left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{C}^{\mathrm{T}} \boldsymbol{H}^{\mathrm{T}}\right), \boldsymbol{C}^{\mathrm{T}}, \boldsymbol{B}^{\mathrm{T}}\right)$ 的可控性不变，但可能改变其可观测性。因而有

$$
\begin{align*}
& \operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{C}^{\mathrm{T}} & \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \cdots & \left(\boldsymbol{A}^{\mathrm{T}}\right)^{n-1} \boldsymbol{C}^{\mathrm{T}}
\end{array}\right] \\
= & \operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{C}^{\mathrm{T}} & \left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{C}^{\mathrm{T}} \boldsymbol{H}^{\mathrm{T}}\right) \boldsymbol{C}^{\mathrm{T}} & \cdots & \left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{C}^{\mathrm{T}} \boldsymbol{H}^{\mathrm{T}}\right)^{n-1} \boldsymbol{C}^{\mathrm{T}}
\end{array}\right]  \tag{9-239}\\
= & \operatorname{rank}\left[\begin{array}{llll}
\boldsymbol{C}^{\mathrm{T}} & (\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C})^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}} & \cdots & \left((\boldsymbol{A}-\boldsymbol{C} \boldsymbol{H})^{\mathrm{T}}\right)^{n-1} \boldsymbol{C}^{\mathrm{T}}
\end{array}\right]
\end{align*}
$$

上式表明，系统 $\Sigma_{0}$ 与系统 $\Sigma_{H}$ 可观测性判别阵的秩相等，这意味着若 $\Sigma_{0}$ 可观测，则 $\Sigma_{H}$ 也是可观测的，输出至状态微分反馈的引入不改变系统的可观测性。

由于系统 $\left(\boldsymbol{A}^{\mathrm{T}}, \boldsymbol{C}^{\mathrm{T}}, \boldsymbol{B}^{\mathrm{T}}\right)$ 的可观测性判别阵为

$$
\begin{aligned}
\overline{\boldsymbol{S}}_{o} & =\left[\begin{array}{llll}
\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}} & \left(\boldsymbol{A}^{\mathrm{T}}\right)^{\mathrm{T}}\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}} & \cdots & \left(\left(\boldsymbol{A}^{\mathrm{T}}\right)^{\mathrm{T}}\right)^{n-1}\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}}
\end{array}\right] \\
& =\left[\begin{array}{llll}
\boldsymbol{B} & \boldsymbol{A} \boldsymbol{B} & \cdots & \boldsymbol{A}^{n-1} \boldsymbol{B}
\end{array}\right]
\end{aligned}
$$



<!-- source_pdf_page: 529 -->
系统 $\left(\left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{C}^{\mathrm{T}} \boldsymbol{H}^{\mathrm{T}}\right), \boldsymbol{C}^{\mathrm{T}}, \boldsymbol{B}^{\mathrm{T}}\right)$ 的可观测性判别阵为

$$
\begin{aligned}
\overline{\boldsymbol{V}}_{o H} & =\left[\begin{array}{llll}
\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}} & \left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{C}^{\mathrm{T}} \boldsymbol{H}^{\mathrm{T}}\right)^{\mathrm{T}}\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}} & \cdots & \left(\left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{C}^{\mathrm{T}} \boldsymbol{H}^{\mathrm{T}}\right)^{\mathrm{T}}\right)^{n-1}\left(\boldsymbol{B}^{\mathrm{T}}\right)^{\mathrm{T}}
\end{array}\right] \\
& =\left[\begin{array}{llll}
\boldsymbol{B} & (\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C}) \boldsymbol{B} & \cdots & (\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C})^{n-1} \boldsymbol{B}
\end{array}\right]
\end{aligned}
$$

系统加入状态反馈后可能改变其可观测性意味着有可能使得

$$
\begin{equation*}
\operatorname{rank} \bar{V}_{o} \neq \operatorname{rank} \bar{V}_{o H} \tag{9-240}
\end{equation*}
$$

因为 $\overline{\boldsymbol{V}}_{o}$ 也是系统 $\Sigma_{0}$ 的可控性判别阵，$\overline{\boldsymbol{V}}_{o H}$ 又是系统 $\Sigma_{H}$ 的可控性判别阵，式（9－240）表明，输出至状态微分的反馈可能改变系统的可控性。证毕。

定理 9－9 对于系统（9－227），输出至参考输入反馈的引入能同时不改变系统的可控性和可观测性，即输出反馈系统 $\Sigma_{F}$ 为可控（可观测）的充分必要条件是被控系统 $\Sigma_{0}$ 为可控（可观测）。

证明 首先，由于对任一输出至参考输人的反馈系统都能找到一个等价的状态反馈系统，由定理9－7知状态反馈可保持可控性，因而输出至参考输入反馈的引入不改变系统的可控性。

由于 $\Sigma_{0}$ 和 $\Sigma_{F}$ 的可观测性判别阵分别为

$$
\begin{gathered}
V_{o}=\left[\begin{array}{c}
C \\
C A \\
\vdots \\
C A^{n-1}
\end{array}\right], \quad V_{o F}=\left[\begin{array}{c}
C \\
C(A-B F C) \\
\vdots \\
C(A-B F C)^{n-1}
\end{array}\right] \\
C=\left[\begin{array}{c}
c_{1} \\
c_{2} \\
\vdots \\
c_{q}
\end{array}\right], \quad C A=\left[\begin{array}{c}
c_{1} A \\
c_{2} A \\
\vdots \\
c_{q} A
\end{array}\right], \quad C(A-B F C)=\left[\begin{array}{c}
c_{1}(A-B F C) \\
c_{2}(A-B F C) \\
\vdots \\
c_{q}(A-B F C)
\end{array}\right]
\end{gathered}
$$

式中，$c_{i}(i=1,2, \cdots, q)$ 为行向量，将 $\boldsymbol{F}$ 表为列向量组 $\left\{\boldsymbol{f}_{j}\right\}$ ，即 $\boldsymbol{F}=\left[\begin{array}{llll}\boldsymbol{f}_{1} & \boldsymbol{f}_{2} & \cdots & \boldsymbol{f}_{q}\end{array}\right]$ ，则

$$
\begin{aligned}
c_{i}(A-B F C) & =c_{i} A-c_{i} B\left(f_{1} c_{1}+f_{2} c_{2}+\cdots+f_{q} c_{q}\right) \\
& =c_{i} A-\left[\left(c_{i} B f_{1}\right) c_{1}+\left(c_{i} B f_{2}\right) c_{2}+\cdots+\left(c_{i} B f_{q}\right) c_{q}\right]
\end{aligned}
$$

令式中 $\boldsymbol{c}_{i} \boldsymbol{B} \boldsymbol{f}_{j}=\alpha_{j}, \alpha_{j}$ 为标量，$j=1,2, \cdots, q$ ，则有

$$
\boldsymbol{c}_{i}(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{F} \boldsymbol{C})=\boldsymbol{c}_{i} \boldsymbol{A}-\left(\alpha_{1} \boldsymbol{c}_{1}+\alpha_{2} c_{2}+\cdots+\alpha_{q} \boldsymbol{c}_{q}\right)
$$

该式表明 $\boldsymbol{C}(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{F} \boldsymbol{C})$ 的行是 $\left[\boldsymbol{C}^{\mathrm{T}} \boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}}\right]^{\mathrm{T}}$ 的行的线性组合。同理有 $\boldsymbol{C}(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{F} \boldsymbol{C})^{2}$ 的行是 $\left[\boldsymbol{C}^{\mathrm{T}}\right.$ $\left.\boldsymbol{A}^{\mathrm{T}} \boldsymbol{C}^{\mathrm{T}}\left(\boldsymbol{A}^{\mathrm{T}}\right)^{2} \boldsymbol{C}^{\mathrm{T}}\right]^{\mathrm{T}}$ 的行的线性组合，如此等等。故 $\boldsymbol{V}_{O F}$ 的每一行均可表为 $\boldsymbol{V}_{o}$ 的行的线性组合，由此可得

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{V}_{O F} \leqslant \operatorname{rank} \boldsymbol{V}_{O} \tag{9-241}
\end{equation*}
$$

由于 $\Sigma_{0}$ 又可看成为 $\Sigma_{F}$ 的输出反馈系统，因而有

$$
\begin{equation*}
\operatorname{rank} \boldsymbol{V}_{o} \leqslant \operatorname{rank} \boldsymbol{V}_{O F} \tag{9-242}
\end{equation*}
$$

由式（9－241）和式（9－242）可得



<!-- source_pdf_page: 530 -->
$$
\begin{equation*}
\operatorname{rank} \boldsymbol{V}_{o}=\operatorname{rank} \boldsymbol{V}_{o F} \tag{9-243}
\end{equation*}
$$

这表明输出至参考输人的反馈可保持系统的可观测性。证毕。
2）对系统稳定性的影响。状态反馈和输出反馈都能影响系统的稳定性。加入反馈，使得通过反馈构成的闭环系统成为稳定系统，称之为镇定。由于状态反馈具有许多优越性，且输出反馈系统总可以找到与之性能等同的状态反馈系统，故在此只讨论状态反馈的镇定问题。对于线性定常被控系统

$$
\dot{x}=A x+B u
$$

如果可以找到状态反馈控制律

$$
u=-K x+v
$$

其中，$v$ 为参考输入，使得通过反馈构成的闭环系统

$$
\dot{\boldsymbol{x}}=(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) \boldsymbol{x}+\boldsymbol{B} \boldsymbol{v}
$$

是渐近稳定的，即 $(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K})$ 的特征值均具有负实部，则称系统实现了状态反馈镇定。
定理 9－10 当且仅当系统（9－227）的不可控部分渐近稳定时，系统是状态反馈可镇定的。

证明 由于 $\{\boldsymbol{A}, \boldsymbol{B}\}$ 不完全可控，则一定可引入非奇异线性变换进行可控性结构分解，使得

$$
\overline{\boldsymbol{A}}=\boldsymbol{P} \boldsymbol{A} \boldsymbol{P}^{-1}=\left[\begin{array}{cc}
\overline{\boldsymbol{A}}_{c} & \overline{\boldsymbol{A}}_{12}  \tag{9-244}\\
0 & \overline{\boldsymbol{A}}_{\bar{c}}
\end{array}\right], \quad \overline{\boldsymbol{B}}=\boldsymbol{P} \boldsymbol{B}=\left[\begin{array}{c}
\overline{\boldsymbol{B}}_{c} \\
\mathbf{0}
\end{array}\right]
$$

式中，$\overline{\boldsymbol{A}}_{c}$ 为可控状态子矩阵；$\overline{\boldsymbol{A}}_{\bar{c}}$ 为不可控状态子矩阵；$\overline{\boldsymbol{B}}_{c}$ 为可控输人子矩阵。并且对任意 $\overline{\boldsymbol{K}}=\left[\begin{array}{ll}\overline{\boldsymbol{K}}_{1} & \overline{\boldsymbol{K}}_{2}\end{array}\right]$ 可导出

$$
\begin{align*}
\operatorname{det}(s \boldsymbol{I}-\boldsymbol{A}+\boldsymbol{B} \boldsymbol{K}) & =\operatorname{det}(s \boldsymbol{I}-\overline{\boldsymbol{A}}+\overline{\boldsymbol{B}} \overline{\boldsymbol{K}}) \\
& =\operatorname{det}\left[\begin{array}{cc}
s \boldsymbol{I}-\overline{\boldsymbol{A}}_{c}+\overline{\boldsymbol{B}}_{c} \overline{\boldsymbol{K}}_{1} & -\overline{\boldsymbol{A}}_{12}+\overline{\boldsymbol{B}}_{c} \overline{\boldsymbol{K}}_{2} \\
\mathbf{0} & s \boldsymbol{I}-\overline{\boldsymbol{A}}_{\bar{c}}
\end{array}\right]  \tag{9-245}\\
& =\operatorname{det}\left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{c}+\overline{\boldsymbol{B}}_{c} \overline{\boldsymbol{K}}_{1}\right) \operatorname{det}\left(s \boldsymbol{I}-\overline{\boldsymbol{A}}_{\bar{c}}\right)
\end{align*}
$$

由于 $\left\{\overline{\boldsymbol{A}}_{c}, \overline{\boldsymbol{B}}_{c}\right\}$ 为可控子系统，故必存在 $\overline{\boldsymbol{K}}_{1}$ 使 $\left(\overline{\boldsymbol{A}}_{c}-\overline{\boldsymbol{B}}_{c} \overline{\boldsymbol{K}}_{1}\right)$ 的特征值均具有负实部。又因为状态反馈对不可控子系统的极点毫无影响，从而可知欲使 $(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K})$ 的特征值均具有负实部，只有使不可控部分 $\overline{\boldsymbol{A}}_{c}$ 的特征值均具有负实部。这表明系统由状态反馈可镇定的充分必要条件是不可控部分渐近稳定。证毕。

## 2．系统的极点配置

状态反馈和输出反馈都能改变闭环系统的极点位置。所谓极点配置，就是利用状态反馈或输出反馈使闭环系统的极点位于所希望的极点位置。由于系统的性能和它的极点位置密切相关，因而极点配置问题在系统设计中是很重要的。这里需要解决两个问题：一是建立极点可配置的条件；二是确定极点配置所需要的反馈增益矩阵。
（1）极点可配置条件
这里给出的极点可配置条件既适合于单输人－单输出系统，也适合于多输入－多输出



<!-- source_pdf_page: 531 -->
系统。
1）利用状态反馈的极点可配置条件。
定理 9－11 利用状态反馈任意配置闭环极点的充分必要条件是被控系统（9－227）可控。

证明 下面就单输人－多输出系统来证明该定理。这时被控系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ 中的 $\boldsymbol{B}$ 为一列向量，记为 $\boldsymbol{b}$ 。

充分性：若系统 $(A, b)$ 可控，则通过非奇异线性变换 $\boldsymbol{x}=\boldsymbol{P}^{-1} \overline{\boldsymbol{x}}$ 可变换为可控标准型

$$
\dot{\overline{\boldsymbol{x}}}=\overline{\boldsymbol{A}} \overline{\boldsymbol{x}}+\overline{\boldsymbol{b}} u
$$

式中

$$
\overline{\boldsymbol{A}}=\boldsymbol{P} \boldsymbol{A} \boldsymbol{P}^{-1}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0 \\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
-a_{0} & -a_{1} & -a_{2} & \cdots & -a_{n-1}
\end{array}\right], \quad \overline{\boldsymbol{b}}=\boldsymbol{P} \boldsymbol{b}=\left[\begin{array}{c}
0 \\
0 \\
\vdots \\
0 \\
1
\end{array}\right]
$$

在单输人情况下，引人状态反馈

$$
u=v-\boldsymbol{k} \boldsymbol{x}=v-\boldsymbol{k} \boldsymbol{P}^{-1} \overline{\boldsymbol{x}}=v-\overline{\boldsymbol{k}} \overline{\boldsymbol{x}}
$$

其中

$$
\overline{\boldsymbol{k}}=\boldsymbol{k} \boldsymbol{P}^{-1}=\left[\begin{array}{llll}
\bar{k}_{0} & \bar{k}_{1} & \cdots & \bar{k}_{n-1}
\end{array}\right]
$$

则引入状态反馈后闭环系统的状态阵为

$$
\overline{\boldsymbol{A}}-\overline{\boldsymbol{b} \boldsymbol{k}}=\left[\begin{array}{ccccc}
0 & 1 & 0 & \cdots & 0  \tag{9-246}\\
0 & 0 & 1 & \cdots & 0 \\
\vdots & \vdots & \vdots & & \vdots \\
0 & 0 & 0 & \cdots & 1 \\
\left(-a_{0}-\bar{k}_{0}\right) & \left(-a_{1}-\bar{k}_{1}\right) & \left(-a_{2}-\bar{k}_{2}\right) & \cdots & \left(-a_{n-1}-\bar{k}_{n-1}\right)
\end{array}\right]
$$

对于式（9－246）这种特殊形式的矩阵，容易写出其闭环特征方程

$$
\begin{align*}
\operatorname{det}[s I-(\overline{\boldsymbol{A}}-\overline{\boldsymbol{b} \boldsymbol{k}})]= & s^{n}+\left(a_{n-1}+\bar{k}_{n-1}\right) s^{n-1}+\left(a_{n-2}+\bar{k}_{n-2}\right) s^{n-2}  \tag{9-247}\\
& +\cdots+\left(a_{1}+\bar{k}_{1}\right) s+\left(a_{0}+\bar{k}_{0}\right)=0
\end{align*}
$$

显然，该 $n$ 阶特征方程中的 $n$ 个系数，可通过 $\bar{k}_{0}, \bar{k}_{1}, \cdots, \bar{k}_{n-1}$ 来独立设置，也就是说$(\overline{\boldsymbol{A}}-\overline{\boldsymbol{b k}})$ 的特征值可以任意选择，即系统的极点可以任意配置。

必要性：如果系统 $(\boldsymbol{A}, \boldsymbol{b})$ 不可控，就说明系统的有些状态将不受 $u$ 的控制，则引人状态反馈时就不可能通过控制来影响不可控的极点。证毕。

2）利用输出反馈的极点可配置条件。
定理 9－12 用输出至状态微分的反馈任意配置闭环极点的充分必要条件是被控系统（9－227）可观测。

证明 下面以多输入－单输出系统为例给出定理的证明。根据对偶定理可知，若被控系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{c})$ 可观测，则对偶系统 $\left(\boldsymbol{A}^{\mathrm{T}}, \boldsymbol{c}^{\mathrm{T}}, \boldsymbol{B}^{\mathrm{T}}\right)$ 可控，由状态反馈极点配置定理知



<!-- source_pdf_page: 532 -->
$\left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{c}^{\mathrm{T}} \boldsymbol{h}^{\mathrm{T}}\right)$ 的特征值可任意配置，其中 $\boldsymbol{h}$ 为 $n \times 1$ 输出反馈向量。由于 $\left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{c}^{\mathrm{T}} \boldsymbol{h}^{\mathrm{T}}\right)$ 的特征值与 $\left(\boldsymbol{A}^{\mathrm{T}}-\boldsymbol{c}^{\mathrm{T}} \boldsymbol{h}^{\mathrm{T}}\right)^{\mathrm{T}}=\boldsymbol{A}-\boldsymbol{h} \boldsymbol{c}$ 的特征值相同，故当且仅当系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{c})$ 可观测时，可以任意配置 $(A-h c)$ 的特征值。证毕。

为了根据期望闭环极点来设计输出反馈向量 $h$ 的参数，只需将期望的系统特征多项式与该输出反馈系统特征多项式 $|\lambda \boldsymbol{I}-(\boldsymbol{A}-\boldsymbol{h} \boldsymbol{c})|$ 相比即可。

对于多输入－单输出被控系统来说，当采用输出至参考输入的反馈时，反馈增益矩阵$\boldsymbol{F}$ 为 $p \times 1$ 向量，记为 $\boldsymbol{f}$ ，则

$$
\boldsymbol{u}=\boldsymbol{v}-f y
$$

输出反馈系统的动态方程为

$$
\dot{x}=(A-B f c) x+B v, \quad y=c x
$$

若令 $\boldsymbol{f} \boldsymbol{c}=\boldsymbol{K}$ ，该输出反馈便等价为状态反馈。适当选择 $\boldsymbol{f}$ ，可使特征值任意配置。但是，当比例的状态反馈变换为输出反馈时，输出反馈中必定含有输出量的各阶导数，于是 $\boldsymbol{f}$不是常数向量，这会给物理实现带来困难，因而其应用受限。可推论，当 $\boldsymbol{f}$ 是常数向量时，便不能任意配置极点。
（2）单输人－单输出系统的极点配置算法
对于具体的可控单输人－单输出系统，求解实现希望极点配置的状态反馈向量 $\boldsymbol{k}$ 时，不必像定理9－11中证明那样去进行可控标准型变换，只需要运行如下简单算法。

步骤 1：列写系统状态方程及状态反馈控制律

$$
\dot{x}=A x+b u, \quad u=v-k x
$$

其中 $\boldsymbol{k}=\left[\begin{array}{llll}k_{0} & k_{1} & \cdots & k_{n-1}\end{array}\right]$ 。
步骤2：检验 $(\boldsymbol{A}, \boldsymbol{b})$ 的可控性。若 rank $\left[\boldsymbol{b} \quad \boldsymbol{A} \boldsymbol{b} \quad \cdots \quad \boldsymbol{A}^{n-1} \boldsymbol{b}\right]=n$ ，则转下步。
步骤 3：由要求配置的闭环极点 $\lambda_{1}, \lambda_{2}, \cdots, \lambda_{n}$ ，求出希望特征多项式 $a_{0}^{*}(s)=\prod_{i=1}^{n}\left(s-\lambda_{i}\right)$ 。
步骤4：计算状态反馈系统的特征多项式 $a_{0}(s)=\operatorname{det}[s \boldsymbol{I}-\boldsymbol{A}+\boldsymbol{b} \boldsymbol{k}]$ 。
步骤 5：比较多项式 $a_{0}^{*}(s)$ 与 $a_{0}(s)$ ，令其对应项系数相等，可确定状态反馈增益向量 $\boldsymbol{k}_{\text {。 }}$
应当指出，应用极点配置方法来改善系统性能，有以下需要注意的方面：
1）配置极点时并非离虚轴越远越好，以免造成系统带宽过大使抗扰性降低。
2）状态反馈向量 $k$ 中的元素不宜过大，否则物理实现不易。
3）闭环零点对系统动态性能影响甚大，在规定希望配置的闭环极点时，需要充分考虑闭环零点的影响。

4）状态反馈对系统的零点和可观测性没有影响，只有当任意配置的极点与系统零点存在对消时，状态反馈系统的零点和可观测性将会改变。

以上性质适用于单输入－多输出或单输出系统，但不适用于多输入－多输出系统。
例 9－25 已知单输人线性定常系统的状态方程为

$$
\dot{x}=\left[\begin{array}{ccc}
0 & 0 & 0 \\
1 & -6 & 0 \\
0 & 1 & -12
\end{array}\right] x+\left[\begin{array}{l}
1 \\
0 \\
0
\end{array}\right] u
$$

求状态反馈向量 $\boldsymbol{k}$ ，使系统的闭环特征值为



<!-- source_pdf_page: 533 -->
解 系统的可控性判别矩阵为

$$
\begin{aligned}
& \boldsymbol{S}_{c}=\left[\begin{array}{lll}
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b} & \boldsymbol{A}^{2} \boldsymbol{b}
\end{array}\right]=\left[\begin{array}{ccc}
1 & 0 & 0 \\
0 & 1 & -6 \\
0 & 0 & 1
\end{array}\right] \\
& \operatorname{rank} \boldsymbol{S}_{c}=3=n
\end{aligned}
$$

系统可控，满足极点可配置条件。系统的特征多项式为

$$
\operatorname{det}(s \boldsymbol{I}-\boldsymbol{A})=\operatorname{det}\left[\begin{array}{ccc}
s & 0 & 0 \\
-1 & s+6 & 0 \\
0 & -1 & s+12
\end{array}\right]=s^{3}+18 s^{2}+72 s
$$

希望特征多项式为

$$
\dot{a_{0}}(s)=\left(s-\lambda_{1}\right)\left(s-\lambda_{2}\right)\left(s-\lambda_{3}\right)=(s+2)(s+1-\mathrm{j})(s+1+\mathrm{j})=s^{3}+4 s^{2}+6 s+4
$$

于是可求得

$$
\overline{\boldsymbol{k}}=\left[\begin{array}{lll}
\dot{a_{0}}-a_{0} & a_{1}^{*}-a_{1} & a_{2}^{*}-a_{2}
\end{array}\right]=\left[\begin{array}{lll}
4 & -66 & -14
\end{array}\right]
$$

变换矩阵为

$$
\begin{gathered}
\boldsymbol{P}^{-1}=\left[\begin{array}{lll}
\boldsymbol{A}^{2} \boldsymbol{b} & \boldsymbol{A} \boldsymbol{b} & \boldsymbol{b}
\end{array}\right]\left[\begin{array}{ccc}
1 & 0 & 0 \\
a_{2} & 1 & 0 \\
a_{1} & a_{2} & 1
\end{array}\right]=\left[\begin{array}{ccc}
0 & 0 & 1 \\
-6 & 1 & 0 \\
1 & 0 & 0
\end{array}\right]\left[\begin{array}{ccc}
1 & 0 & 0 \\
18 & 1 & 0 \\
72 & 18 & 1
\end{array}\right]=\left[\begin{array}{ccc}
72 & 18 & 1 \\
12 & 1 & 0 \\
1 & 0 & 0
\end{array}\right] \\
\boldsymbol{P}=\left[\begin{array}{ccc}
0 & 0 & 1 \\
0 & 1 & -12 \\
1 & -18 & 144
\end{array}\right] \\
\boldsymbol{k}=\overline{\boldsymbol{k}} \boldsymbol{P}=\left[\begin{array}{lll}
4 & -66 & -14
\end{array}\right]\left[\begin{array}{ccc}
0 & 0 & 1 \\
0 & 1 & -12 \\
1 & -18 & 144
\end{array}\right]=\left[\begin{array}{lll}
-14 & 186 & -1220
\end{array}\right]
\end{gathered}
$$

或令

$$
\begin{aligned}
a_{0}^{*}(s) & =\operatorname{det}(s \boldsymbol{I}-\boldsymbol{A}+\boldsymbol{b} \boldsymbol{k}) \\
& =\left[\begin{array}{ccc}
s+k_{1} & k_{2} & k_{3} \\
-1 & s+6 & 0 \\
0 & -1 & s+12
\end{array}\right] \\
& =s^{3}+\left(k_{1}+18\right) s^{2}+\left(18 k_{1}+k_{2}+72\right) s+\left(72 k_{1}+12 k_{2}+k_{3}\right)
\end{aligned}
$$

于是有

$$
\begin{gathered}
k_{1}+18=4 \\
18 k_{1}+k_{2}+72=6 \\
72 k_{1}+12 k_{2}+k_{3}=4
\end{gathered}
$$

可求得

$$
\begin{gathered}
k_{1}=-14, \quad k_{2}=186, \quad k_{3}=-1220 \\
\boldsymbol{k}=\left[\begin{array}{lll}
k_{1} & k_{2} & k_{3}
\end{array}\right]=\left[\begin{array}{lll}
-14 & 186 & -1220
\end{array}\right]
\end{gathered}
$$



<!-- source_pdf_page: 534 -->
（3）状态反馈对传递函数零点的影响
状态反馈在改变系统极点的同时，是否对系统的零点产生影响？下面来分析回答这一问题。

已知完全可控的单输人－单输出线性定常系统可经适当非奇异线性变换化为可控标准型

$$
\dot{\bar{x}}=\overline{\boldsymbol{A}} \overline{\boldsymbol{x}}+\overline{\boldsymbol{b}} u, \quad y=\overline{\boldsymbol{c} \boldsymbol{x}}
$$

被控系统的传递函数为

$$
\begin{aligned}
G(s) & =\boldsymbol{c}(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{b}=\overline{\boldsymbol{c}}(s \boldsymbol{I}-\overline{\boldsymbol{A}})^{-1} \overline{\boldsymbol{b}} \\
& =\frac{\left[\beta_{0} \quad \beta_{1} \quad \cdots \quad \beta_{n-1}\right]}{s^{n}+a_{n-1} s^{n-1}+\cdots+a_{1} s+a_{0}}\left[\begin{array}{cccc}
\times & \cdots & \times & 1 \\
\times & \cdots & \times & s \\
\vdots & & \vdots & \vdots \\
\times & \cdots & \times & s^{n-1}
\end{array}\right]\left[\begin{array}{c}
0 \\
\vdots \\
0 \\
1
\end{array}\right] \\
& =\frac{\beta_{n-1} s^{n-1}+\cdots+\beta_{1} s+\beta_{0}}{s^{n}+a_{n-1} s^{n-1}+\cdots+a_{1} s+a_{0}}
\end{aligned}
$$

引入状态反馈后的闭环系统传递函数为

$$
\begin{aligned}
& G_{K}(s)=\boldsymbol{c}(s \boldsymbol{I}-\boldsymbol{A}+\boldsymbol{b} \boldsymbol{k})^{-1} \boldsymbol{b}=\overline{\boldsymbol{c}}(s \boldsymbol{I}-\overline{\boldsymbol{A}}+\overline{\boldsymbol{b} \boldsymbol{k}})^{-1} \overline{\boldsymbol{b}} \\
&\left.=\frac{\left[\beta_{0}\right.}{\beta_{1}} \cdots \beta_{n-1}\right] \\
& s^{n}+a_{n-1}^{*} s^{n-1}+\cdots+a_{1}^{*} s+a_{0}^{*}\left[\begin{array}{cccc}
\times & \cdots & \times & 1 \\
\times & \cdots & \times & s \\
\vdots & & \vdots & \vdots \\
\times & \cdots & \times & s^{n-1}
\end{array}\right]\left[\begin{array}{c}
0 \\
\vdots \\
0 \\
1
\end{array}\right] \\
&=\frac{\beta_{n-1} s^{n-1}+\cdots+\beta_{1} s+\beta_{0}}{s^{n}+a_{n-1}^{*} s^{n-1}+\cdots+a_{1}^{*} s+a_{0}^{*}}
\end{aligned}
$$

上述推导表明，由于 $\operatorname{adj}(s \boldsymbol{I}-\overline{\boldsymbol{A}})$ 与 $\operatorname{adj}(s \boldsymbol{I}-\overline{\boldsymbol{A}}+\overline{\boldsymbol{b}} \boldsymbol{k})$ 的第 $n$ 列相同，故 $G(s)$ 与 $G_{K}(s)$ 的分子多项式相同，即闭环系统零点与被控系统零点相同，状态反馈对 $G(s)$ 的零点没有影响，仅使 $G(s)$ 的极点改变为闭环系统极点。然而可能有这种情况：引人状态反馈后恰巧使某些极点移到 $G(s)$ 的零点处而构成极、零点对消，这时既失去了一个系统零点，又失去了一个系统极点，并且被对消掉的那些极点可能不可观测。这也是对状态反馈可能使系统失去可观测性的一个直观解释。

## 3．全维状态观测器及其设计

当利用状态反馈配置系统极点时，需要用传感器测量状态变量以便实现反馈。但在许多情况下，通常只有被控对象的输人量和输出量能够用传感器测量，而多数状态变量不易测得或不可能测得，于是提出了利用被控对象的输入量和输出量建立状态观测器（又称为状态估计器、状态重构器）来重构状态的问题。当重构状态向量的维数等于被控对象状态向量的维数时，称为全维状态观测器。
（1）全维状态观测器构成方案
设被控对象动态方程为

$$
\begin{equation*}
\dot{x}=A x+B u, \quad y=C x \tag{9-248}
\end{equation*}
$$



<!-- source_pdf_page: 535 -->
构造一个动态方程与式（9－248）相同且能用计算机实现的模拟被控系统

$$
\begin{equation*}
\dot{\hat{x}}=A \hat{x}+B u, \quad \hat{y}=C \hat{x} \tag{9-249}
\end{equation*}
$$

式中，$\hat{\boldsymbol{x}} 、 \hat{\boldsymbol{y}}$ 分别为模拟系统的状态向量和输出向量，是被控对象状态向量和输出向量的估值。当模拟系统与被控对象的初始状态向量相同时，在同一输人作用下，有 $\hat{x}=x$ ，可用 $\hat{x}$ 作为状态反馈所需用的信息。但是，被控对象的初始状态可能很不相同，模拟系统中积分器初始条件的设置又只能预估，因而两个系统的初始状态总有差异，即使两个系统的 $\boldsymbol{A} 、 \boldsymbol{B} 、 \boldsymbol{C}$ 阵完全一样，也必定存在估计状态与被控对象实际状态的误差 $(\hat{\boldsymbol{x}}-\boldsymbol{x})$ ，难以实现所需要的状态反馈。但是，$(\hat{x}-x)$ 的存在必定导致 $(\hat{y}-y)$ 的存在，而被控系统的输出量总是可以用传感器测量的，于是可根据一般反馈控制原理，将 $(\hat{y}-y)$ 负反馈至 $\dot{\hat{x}}$处，控制 $(\hat{\boldsymbol{y}}-\boldsymbol{y})$ 尽快逼近于零，从而使 $(\hat{\boldsymbol{x}}-\boldsymbol{x})$ 尽快逼近于零，便可以利用 $\hat{\boldsymbol{x}}$ 来形成状态反馈。按以上原理构成的状态观测器及其实现状态反馈的方框图如图9－27所示。状态观测器有两个输人，即 $\boldsymbol{u}$ 和 $\boldsymbol{y}$ ，输出为 $\hat{\boldsymbol{x}}$ 。观测器含 $n$ 个积分器并对全部状态变量作出估计。 $\boldsymbol{H}$ 为观测器输出反馈阵，它把 $(\hat{\boldsymbol{y}}-\boldsymbol{y})$ 负反馈至 $\dot{\hat{x}}$ 处，是为配置观测器极点，提高其动态性能，即尽快使 $(\hat{x}-x)$ 逼近于零而引入的，它是前面所介绍过的一种输出反馈。
（2）全维状态观测器分析设计
由图 9－27 可列出全维状态观测器动态方程

$$
\begin{equation*}
\dot{\hat{x}}=A \hat{x}+B u-H(\hat{y}-y), \quad \hat{y}=C \hat{x} \tag{9-250}
\end{equation*}
$$

故有

$$
\begin{equation*}
\dot{\hat{x}}=A \hat{x}+B u-H C(\hat{x}-x)=(A-H C) \hat{x}+B u+H y \tag{9-251}
\end{equation*}
$$

式中，$(A-H C)$ 称为观测器系统矩阵。观测器分析设计的关键问题是能否在任何初始条件下，即尽管 $\hat{\boldsymbol{x}}\left(t_{0}\right)$ 与 $\boldsymbol{x}\left(t_{0}\right)$ 不同，但总能保证

$$
\begin{equation*}
\lim _{t \rightarrow \infty}(\hat{\boldsymbol{x}}(t)-\boldsymbol{x}(t))=\mathbf{0} \tag{9-252}
\end{equation*}
$$

成立。只有满足式（9－252），状态反馈系统才能正常工作，式（9－231）所示系统才能作为实际的状态观测器，故式（9－252）称为观测器存在条件。

![](assets/fig-09-27.png)

> Image description: This figure illustrates a state feedback system with a state observer. The top section shows the actual system: input u drives block B, then state x evolves via A and integrator (1/s), and output y is generated by C. Feedback uses gain K. The bottom section depicts the observer: estimated state x̂ is computed using observer gain H, matching the plant’s dynamics. The observer’s output ŷ is compared with actual y, generating error for correction. Both systems share the same C block. The dashed line separates the actual system from the observer. The observer’s estimate x̂ is fed into the feedback loop via K, enabling state feedback control without full state measurement. This architecture enables full-state control using only output measurements.
图9－27 状态观测器及其实现状态反馈的系统方相图

由式（9－251）与式（9－248）可得



<!-- source_pdf_page: 536 -->
$$
\begin{equation*}
\dot{\boldsymbol{x}}-\dot{\hat{\boldsymbol{x}}}=(\boldsymbol{A}-\boldsymbol{H} C)(\boldsymbol{x}-\hat{\boldsymbol{x}}) \tag{9-253}
\end{equation*}
$$

其解为

$$
\begin{equation*}
\boldsymbol{x}(t)-\hat{\boldsymbol{x}}(t)=\mathrm{e}^{(A-H C)\left(t-t_{0}\right)}\left[\boldsymbol{x}\left(t_{0}\right)-\hat{\boldsymbol{x}}\left(t_{0}\right)\right] \tag{9-254}
\end{equation*}
$$

显见当 $\hat{x}\left(t_{0}\right)=\boldsymbol{x}\left(t_{0}\right)$ 时，恒有 $\boldsymbol{x}(t)=\hat{\boldsymbol{x}}(t)$ ，所引入的输出反馈并不起作用。当 $\hat{\boldsymbol{x}}\left(t_{0}\right) \neq \boldsymbol{x}\left(t_{0}\right)$ 时，有 $\hat{\boldsymbol{x}}(t) \neq \boldsymbol{x}(t)$ ，输出反馈便起作用了，这时只要 $(\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C})$ 的全部特征值具有负实部，初始状态向量误差总会按指数衰减规律满足式（9－252），其衰减速率取决于观测器的极点配置。由前面的输出反馈定理可知，若被控对象可观测，则 $(\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C})$ 的极点可任意配置，以满足$\hat{\boldsymbol{x}}$ 逼近 $\boldsymbol{x}$ 的速率要求，因而保证了状态观测器的存在性。

定理 9－13 若被控系统 $(\boldsymbol{A}, \boldsymbol{B}, \boldsymbol{C})$ 可观测，则其状态可用形如

$$
\begin{equation*}
\dot{\hat{x}}=A \hat{x}+B u-H C(\hat{x}-x)=(A-H C) \hat{x}+B u+H y \tag{9-255}
\end{equation*}
$$

的全维状态观测器给出估值，其中矩阵 $H$ 按任意配置观测器极点的需要来选择，以决定状态误差衰减的速率。

选择 $\boldsymbol{H}$ 阵参数时，应注意防止数值过大带来的实现困难，如饱和效应、噪声加剧等，通常希望观测器响应速度比状态反馈系统的响应速度要快些。

例 9－26 设被控对象传递函数为

$$
\frac{Y(s)}{U(s)}=\frac{2}{(s+1)(s+2)}
$$

试设计全维状态观测器，将极点配置在－10，－10。
解 被控对象的传递函数为

$$
\frac{Y(s)}{U(s)}=\frac{2}{(s+1)(s+2)}=\frac{2}{s^{2}+3 s+2}
$$

根据传递函数可直接写出系统的可控标准型
其中

$$
\begin{gathered}
\dot{\boldsymbol{x}}=\boldsymbol{A x}+\boldsymbol{b} u, \quad y=\boldsymbol{c} \boldsymbol{x} \\
\boldsymbol{A}=\left[\begin{array}{cc}
0 & 1 \\
-2 & -3
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{l}
0 \\
1
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{ll}
2 & 0
\end{array}\right]
\end{gathered}
$$

显然，系统可控可观测。 $n=2, q=1$ ，输出反馈向量 $\boldsymbol{h}$ 为 $2 \times 1$ 向量。全维状态观测器系统矩阵为

$$
\boldsymbol{A}-\boldsymbol{h} \boldsymbol{c}=\left[\begin{array}{cc}
0 & 1 \\
-2 & -3
\end{array}\right]-\left[\begin{array}{l}
h_{0} \\
h_{1}
\end{array}\right]\left[\begin{array}{ll}
2 & 0
\end{array}\right]=\left[\begin{array}{cc}
-2 h_{0} & 1 \\
-2-2 h_{1} & -3
\end{array}\right]
$$

观测器特征方程为

$$
|\lambda \boldsymbol{I}-(\boldsymbol{A}-\boldsymbol{h} \boldsymbol{c})|=\lambda^{2}+\left(2 h_{0}+3\right) \lambda+\left(6 h_{0}+2 h_{1}+2\right)=0
$$

期望特征方程为

$$
(\lambda+10)^{2}=\lambda^{2}+20 \lambda+100=0
$$

令两特征方程同次项系数相等，可得
因而有

$$
\begin{gathered}
2 h_{0}+3=20, \quad 6 h_{0}+2 h_{1}+2=100 \\
h_{0}=8.5, \quad h_{1}=23.5
\end{gathered}
$$



<!-- source_pdf_page: 537 -->
$h_{0}, h_{1}$ 分别为由 $(\hat{y}-y)$ 引至 $\dot{\hat{x}}_{1}, \dot{\hat{x}}_{2}$ 的反馈系数。被控对象及全维状态观测器组合系统的状态变量图如图9－28所示。

![](assets/fig-09-28.png)

> Image description: This figure illustrates a combined system of a controlled plant and a full-order state observer. The top section shows the actual plant dynamics, with inputs u, states x₁, x₂, and output y, interconnected via integrators (1/s), gains (2, 3), and feedback loops. Initial states x₁(0), x₂(0) are injected. The bottom section depicts the observer, using estimated states ̂x₁(0), ̂x₂(0) and identical dynamics to replicate the plant. Error signals (y - ̂y) are fed back to update observer states via coefficients h₀, h₁ (implied by the caption). The dashed line separates plant from observer. Both sections share identical structure, ensuring accurate state estimation for feedback control.
图9－28 全维状态观测器及被控对像组合系统的状态变量图

4．分离特性
当用全维状态观测器提供的状态估值 $\hat{x}$ 代替真实状态 $x$ 来实现状态反馈时，为保持系统的期望特征值，其状态反馈阵 $\boldsymbol{K}$ 是否需要重新设计？当观测器被引人系统以后，状态反馈系统部分是否会改变已经设计好的观测器极点配置，其观测器输出反馈阵 $\boldsymbol{H}$ 是否需要重新设计？为此需要对引入观测器的状态反馈系统作进一步分析。整个系统的结构图如图9－27所示，是一个 $2 n$ 维的复合系统，其中

$$
\begin{equation*}
u=v-K \hat{x} \tag{9-256}
\end{equation*}
$$

状态反馈子系统动态方程为

$$
\begin{equation*}
\dot{x}=A x+B u=A x-B K \hat{x}+B v, \quad y=C x \tag{9-257}
\end{equation*}
$$

全维状态观测器子系统动态方程为

$$
\begin{equation*}
\dot{\hat{x}}=A \hat{x}+B u-H(\hat{y}-y)=(A-B K-H C) \hat{x}+H C x+B v \tag{9-258}
\end{equation*}
$$

故复合系统动态方程为

$$
\begin{gather*}
{\left[\begin{array}{c}
\dot{x} \\
\dot{\hat{x}}
\end{array}\right]=\left[\begin{array}{cc}
A & -B K \\
H C & A-B K-H C
\end{array}\right]\left[\begin{array}{l}
x \\
\hat{x}
\end{array}\right]+\left[\begin{array}{l}
B \\
B
\end{array}\right] v}  \tag{9-259a}\\
y=\left[\begin{array}{ll}
C & 0
\end{array}\right]\left[\begin{array}{l}
x \\
\hat{x}
\end{array}\right] \tag{9-259b}
\end{gather*}
$$

在复合系统动态方程中，不用状态估值 $\hat{x}$ ，而用状态误差 $(\boldsymbol{x}-\hat{\boldsymbol{x}})$ ，将会使分析研究更加



<!-- source_pdf_page: 538 -->
直观方便。由式（9－257）和式（9－258）可得

$$
\begin{equation*}
\dot{x}-\dot{\hat{x}}=(A-H C)(x-\hat{x}) \tag{9-260}
\end{equation*}
$$

该式与 $\boldsymbol{u}, \boldsymbol{v}$ 无关，即 $(\boldsymbol{x}-\hat{\boldsymbol{x}})$ 是不可控的。不管施加什么样的控制信号，只要 $(\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C})$全部特征值都具有负实部，状态误差总会衰减到零，这正是所希望的，是状态观测器所具有的重要性质。对式（9－259）引人非奇异线性变换

$$
\left[\begin{array}{l}
\boldsymbol{x}  \tag{9-261}\\
\hat{\boldsymbol{x}}
\end{array}\right]=\left[\begin{array}{cc}
\boldsymbol{I}_{n} & \mathbf{0} \\
\boldsymbol{I}_{n} & -\boldsymbol{I}_{n}
\end{array}\right]\left[\begin{array}{c}
\boldsymbol{x} \\
\boldsymbol{x}-\hat{\boldsymbol{x}}
\end{array}\right]
$$

则有

$$
\begin{gather*}
{\left[\begin{array}{c}
\dot{x} \\
\dot{x}-\dot{\hat{x}}
\end{array}\right]=\left[\begin{array}{cc}
A-B K & B K \\
0 & A-H C
\end{array}\right]\left[\begin{array}{c}
x \\
x-\hat{x}
\end{array}\right]+\left[\begin{array}{c}
B \\
0
\end{array}\right] v}  \tag{9-262a}\\
y=\left[\begin{array}{ll}
C & 0
\end{array}\right]\left[\begin{array}{c}
x \\
x-\hat{x}
\end{array}\right] \tag{9-262b}
\end{gather*}
$$

由于线性变换后系统传递函数矩阵具有不变性，由式（9－262）可导出系统传递函数矩阵

$$
\boldsymbol{G}(s)=\left[\begin{array}{ll}
\boldsymbol{C} & \mathbf{0}
\end{array}\right]\left[\begin{array}{cc}
s \boldsymbol{I}-(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K}) & -\boldsymbol{B} \boldsymbol{K}  \tag{9-263}\\
\mathbf{0} & s \boldsymbol{I}-(\boldsymbol{A}-\boldsymbol{H} \boldsymbol{C})
\end{array}\right]^{-1}\left[\begin{array}{l}
\boldsymbol{B} \\
\mathbf{0}
\end{array}\right]
$$

利用分块矩阵求逆公式

$$
\left[\begin{array}{cc}
\boldsymbol{R} & \boldsymbol{S}  \tag{9-264}\\
\mathbf{0} & \boldsymbol{T}
\end{array}\right]^{-1}=\left[\begin{array}{cc}
\boldsymbol{R}^{-1} & -\boldsymbol{R}^{-1} \boldsymbol{S} \boldsymbol{T}^{-1} \\
\mathbf{0} & \boldsymbol{T}^{-1}
\end{array}\right]
$$

可得

$$
\begin{equation*}
\boldsymbol{G}(s)=\boldsymbol{C}[s \boldsymbol{I}-(\boldsymbol{A}-\boldsymbol{B} \boldsymbol{K})]^{-1} \boldsymbol{B} \tag{9-265}
\end{equation*}
$$

式（9－265）正是引人真实状态 $x$ 作为反馈的状态反馈系统

$$
\begin{align*}
& \dot{x}=A x+B(v-K x)=(A-B K) x+B v \\
& y=C x \tag{9-266}
\end{align*}
$$

的传递函数矩阵。这说明复合系统与状态反馈子系统具有相同的传递特性，与观测器部分无关，可用估值状态 $\hat{\boldsymbol{x}}$ 代替真实状态 $\boldsymbol{x}$ 作为反馈。 $2 n$ 维复合系统导出了 $n \times n$ 传递矩阵，这是由于 $(x-\hat{x})$ 的不可控造成的。

由于线性变换后特征值具有不变性，由式（9－262）易导出其特征值满足关系式

$$
\left[\begin{array}{cc}
s I-(A-B K) & -B K  \tag{9-267}\\
0 & s I-(A-H C)
\end{array}\right]=|s I-(A-B K)| \cdot|s I-(A-H C)|
$$

该式表明复合系统特征值是由状态反馈子系统和全维状态观测器的特征值组合而成，且两部分特征值相互独立，彼此不受影响，因而状态反馈矩阵 $\boldsymbol{K}$ 和输出反馈矩阵 $\boldsymbol{H}$ 可根据各自的要求来独立进行设计，故有下述分离定理。

定理9－14（分离定理）若被控系统 $(A, B, C)$ 可控可观测，用状态观测器估值形成状态反馈时，其系统的极点配置和观测器设计可分别独立进行，即 $\boldsymbol{K}$ 和 $\boldsymbol{H}$ 阵的设计可分别独立进行。



<!-- source_pdf_page: 539 -->
## 9－5 控制系统状态空间设计

例 9－27 内模控制器。
在许多实际场合，单纯的状态变量反馈方法并不是一种改善系统性能的实用方法。其主要原因是，状态变量反馈往往要求用具有无限带宽的 PD 控制器或 PID 控制器来实现，但实际部件和控制器都只有有限的带宽。

内模控制器是另一类校正控制器，能以零稳态误差渐近跟踪各类参考输入信号，如阶跃信号、斜坡信号及正弦信号等。众所周知，在经典控制理论中，对于阶跃输入信号，$I$ 型系统可以实现零稳态误差跟踪。如果在校正控制器中引人参考输人的内模，则可以在状态空间设计法中推广这一结论。采用类似的内模控制器方法，可以在更多的情况下实现零稳态误差跟踪。

设单输人－单输出系统的状态空间表达式为

$$
\begin{equation*}
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{b} u(t), \quad y(t)=\boldsymbol{c x}(t) \tag{9-268}
\end{equation*}
$$

式中， $\boldsymbol{x} \in \mathbf{R}^{n}$ 为状态向量；$u$ 为标量输入；$y$ 为标量输出； $\boldsymbol{A}, \boldsymbol{b}$ 和 $\boldsymbol{c}$ 维数适当。
生成参考输人信号 $r(t)$ 的线性系统为

$$
\begin{equation*}
\dot{\boldsymbol{x}}_{r}(t)=\boldsymbol{A}_{r} \boldsymbol{x}_{r}(t), \quad r(t)=\boldsymbol{d}_{r} \boldsymbol{x}_{r}(t) \tag{9-269}
\end{equation*}
$$

其中，初始条件未知。此外，参考输人信号 $r(t)$ 的生成系统也可以等效为

$$
\begin{equation*}
r^{(n)}(t)=\alpha_{n-1} r^{(n-1)}(t)+\alpha_{n-2} r^{(n-2)}(t)+\cdots+\alpha_{1} \dot{r}(t)+\alpha_{0} r(t) \tag{9-270}
\end{equation*}
$$

首先考虑参考输人 $r(t)$ 为单位阶跃信号时的内模控制器设计。此时，$r(t)$ 可由下列方程生成：

$$
\dot{\boldsymbol{x}}_{r}(t)=0, \quad r(t)=x_{r}(t)
$$

或等价为

$$
\dot{r}(t)=0
$$

定义跟踪误差

$$
\begin{gather*}
e(t)=r(t)-y(t) \\
\dot{e}(t)=-\dot{y}(t)=-c \dot{x}(t) \tag{9-271}
\end{gather*}
$$

现在，引人两个中间变量 $z(t)$ 和 $w(t)$ ，定义为

$$
\boldsymbol{z}(t)=\dot{\boldsymbol{x}}(t), \quad w(t)=\dot{u}(t)
$$

故有

$$
\begin{equation*}
\dot{\boldsymbol{z}}(t)=\ddot{\boldsymbol{x}}(t)=\boldsymbol{A} \dot{\boldsymbol{x}}(t)+\boldsymbol{b} \dot{u}(t)=\boldsymbol{A} \boldsymbol{z}(t)+\boldsymbol{b} w(t) \tag{9-272}
\end{equation*}
$$

则式（9－271）与式（9－272）构成如下增广系统方程：

$$
\left[\begin{array}{l}
\dot{e}  \tag{9-273}\\
\dot{z}
\end{array}\right]=\left[\begin{array}{rr}
0 & -c \\
0 & A
\end{array}\right]\left[\begin{array}{l}
e \\
z
\end{array}\right]+\left[\begin{array}{l}
0 \\
b
\end{array}\right] w
$$

当增广系统（9－273）可控时，即有

$$
\operatorname{rank}\left[\begin{array}{ccccc}
0 & -c b & -c A b & \cdots & -c A^{n-1} b  \tag{9-274}\\
b & A b & A^{2} b & \cdots & A^{n} b
\end{array}\right]=n+1
$$

总可以找到反馈信号



<!-- source_pdf_page: 540 -->
$$
\begin{equation*}
w(t)=-k_{1} e(t)-\boldsymbol{k}_{2} z(t) \tag{9-275}
\end{equation*}
$$

使该系统渐近稳定。这表明跟踪误差 $e(t)$ 是渐近收玫的，因此系统输出能以零稳态误差跟踪参考输人信号。对式（9－275）求积分，可得系统内部的反馈控制信号为

$$
\begin{equation*}
u(t)=-k_{1} \int_{0}^{t} e(\tau) \mathrm{d} \tau-\boldsymbol{k}_{2} \boldsymbol{x}(t) \tag{9-276}
\end{equation*}
$$

与此对应的系统结构图如图9－29所示。由图可见，在校正控制器中，除包含有状态变量

![](assets/fig-09-29.png)

> Image description: This block diagram illustrates a feedback control system. The input r(t) generates error e, which passes through a proportional gain k₁, then a 1/s integrator. The output u is fed to the plant G₀(s) = 1/(s² + 2s + 2), producing y(t). A feedback loop uses y(t) through gain k₂ to subtract from the error. The dashed box groups the controller (k₁, 1/s) and a feedforward term k₂, indicating a combined correction strategy. The system’s dynamics are governed by the second-order plant, and the integrator ensures steady-state error elimination. Variables e, u, x, and y(t) are clearly labeled, with arrows denoting signal flow. This structure is typical for state-variable feedback or PID-like control design.
图9－29 阶跃输入的内模设计系统结阿图

反馈外，还包含了参考阶跃输人的内模（图中积分器环节），故称为内模控制器。
下例为一个具体系统的单位阶跃输人内模控制器的设计过程。设有

$$
\begin{gathered}
\dot{x}(t)=\left[\begin{array}{cc}
0 & 1 \\
-2 & -2
\end{array}\right] x(t)+\left[\begin{array}{l}
1 \\
2
\end{array}\right] u(t) \\
y(t)=\left[\begin{array}{ll}
1 & 0
\end{array}\right] x(t)
\end{gathered}
$$

要求系统输出能以零稳态误差跟踪单位阶跃参考输人信号。由式（9－273）知，增广系统方程为

$$
\left[\begin{array}{l}
\dot{e} \\
\dot{z}
\end{array}\right]=\left[\begin{array}{ccc}
0 & -1 & 0 \\
0 & 0 & 1 \\
0 & -2 & -2
\end{array}\right]\left[\begin{array}{l}
e \\
z
\end{array}\right]+\left[\begin{array}{l}
0 \\
1 \\
2
\end{array}\right] w
$$

由于可控性矩阵

$$
\operatorname{rank}\left[\begin{array}{ccc}
0 & -\boldsymbol{c} \boldsymbol{b} & -\boldsymbol{c} \boldsymbol{A} \boldsymbol{b} \\
\boldsymbol{b} & \boldsymbol{A} \boldsymbol{b} & \boldsymbol{A}^{2} \boldsymbol{b}
\end{array}\right]=\operatorname{rank}\left[\begin{array}{ccc}
0 & -1 & -2 \\
1 & 2 & -6 \\
2 & -6 & 8
\end{array}\right]=3
$$

满秩，增广系统可控，故通过状态反馈

$$
w=-\boldsymbol{k}\left[\begin{array}{l}
e \\
z
\end{array}\right]=-k_{1} e-k_{2} z_{1}-k_{3} z_{2}
$$

式中 $\boldsymbol{k}=\left[\begin{array}{lll}k_{1} & k_{2} & k_{3}\end{array}\right]$ ，可任意配置闭环增广系统

$$
\left[\begin{array}{c}
\dot{e} \\
\dot{z}_{1} \\
\dot{z}_{2}
\end{array}\right]=\left\{\left[\begin{array}{ccc}
0 & -1 & 0 \\
0 & 0 & 1 \\
0 & -2 & -2
\end{array}\right]-\left[\begin{array}{c}
0 \\
1 \\
2
\end{array}\right]\left[\begin{array}{lll}
k_{1} & k_{2} & k_{3}
\end{array}\right]\right\}\left[\begin{array}{c}
e \\
z_{1} \\
z_{2}
\end{array}\right]
$$



<!-- source_pdf_page: 541 -->
的极点。如果要求闭环极点为 $s_{1,2}=1 \pm \mathrm{j}, s_{3}=-10$ ，则希望特征方程为

$$
(s+1+\mathrm{j})(s+1-\mathrm{j})(s+10)=s^{3}+12 s^{2}+22 s+20=0
$$

而实际特征方程为

$$
\operatorname{det}\left[\begin{array}{ccc}
s & 1 & 0 \\
k_{1} & s+k_{2} & k_{3}-1 \\
2 k_{1} & 2\left(1+k_{2}\right) & s+2+2 k_{3}
\end{array}\right]=s^{3}+\left(k_{2}+2 k_{3}+2\right) s^{2}+\left(2-k_{1}+4 k_{2}-2 k_{3}\right) s-4 k_{1}=0
$$

令上述两个特征方程式的对应项系数相等，解得

$$
k_{1}=-5, \quad k_{2}=5, \quad k_{3}=2.5
$$

则由式（9－276）得内模控制律为

$$
u(t)=5 \int_{0}^{t} e(\tau) \mathrm{d} \tau-5 x_{1}(t)-2.5 x_{2}(t)
$$

相应的单位阶跃输人内模控制系统的结构图如图9－30所示。

![](assets/fig-09-30.png)

> Image description: This block diagram illustrates an internal model control (IMC) system for a unit step input. The reference signal r enters a summing junction, generating error e. e is multiplied by 5, then integrated (1/s) to produce a signal fed into a subtractor. The output u is generated by subtracting feedback terms. u is multiplied by 2, then fed into a state variable x₂, which is integrated (1/s) to produce x₂. x₂ and x₁ (the output y) are used to generate feedback signals. The system includes multiple feedback paths with gains 2, 2.5, and 5, and integrators (1/s) for state dynamics. The output y = x₁ is also fed back to the summing junction. This structure ensures tracking and disturbance rejection in a state-space IMC framework.
图9－30 单位阶跃输人内模控制系统结构图

显然，本例设计的内模控制系统是渐近稳定的。对任意初始跟踪误差 $e(0)$ ，反馈控制信号都可以保证在 $t \rightarrow \infty$ 时，$e(t) \rightarrow 0$ 。在 MATLAB 的 Simulink 环境下，根据结构图9－30搭建内模控制系统模型，运行后可得图9－31，其直观地表明了系统在单位阶跃参考输入时，跟踪误差的渐近收敛性。

![](assets/fig-09-31.png)

> Image description: This figure illustrates the asymptotic convergence of tracking error e(t) over time in an internally model-controlled system. The y-axis represents the tracking error e(t), ranging from -1.0 to 1.0, while the x-axis denotes time in seconds (0 to 20). The curve begins at e(0) = 1.0, rapidly decreases, oscillates around zero with diminishing amplitude, and asymptotically approaches zero after approximately 10 seconds. This behavior confirms the system’s asymptotic stability: for any initial error, the feedback control ensures e(t) → 0 as t → ∞. The plot visually validates the theoretical analysis, demonstrating robust tracking performance under unit step input, as modeled in MATLAB Simulink (Figure 9-30).
图9－31 单位阶跃输入下内模控制系统的跟踪误郜响应（MATLAB）



<!-- source_pdf_page: 542 -->
考虑参考输人为斜坡信号的内模设计问题。设单位斜坡参考输入信号为 $r(t)=t$ ，并由下列系统生成：

$$
\begin{aligned}
& \dot{\boldsymbol{x}}_{r}=\boldsymbol{A}_{r} \boldsymbol{x}_{r}=\left[\begin{array}{ll}
0 & 1 \\
0 & 0
\end{array}\right] \boldsymbol{x}_{r} \\
& r=\boldsymbol{d}_{r} \boldsymbol{x}_{r}=\left[\begin{array}{ll}
1 & 0
\end{array}\right] \boldsymbol{x}_{r}
\end{aligned}
$$

且有 $\ddot{r}(t)=0$ ，则对于单输人－单输出系统（9－268），定义跟踪误差 $e=r-y$ ，有

$$
\ddot{e}(t)=-\ddot{y}(t)=-c \ddot{x}(t)
$$

令中间变量

$$
z=\ddot{x}, \quad w=\ddot{u}
$$

有

$$
\begin{gathered}
z=\ddot{x}=A \dot{x}+b \dot{u} \\
\dot{z}=A \ddot{x}+b \ddot{u}=A z+b w \\
\ddot{e}=-\ddot{y}=-c \ddot{x}=-c z
\end{gathered}
$$

构造增广系统

$$
\left[\begin{array}{c}
\dot{e}  \tag{9-277}\\
\ddot{e} \\
\dot{z}
\end{array}\right]=\left[\begin{array}{ccc}
0 & 1 & 0 \\
0 & 0 & -\boldsymbol{c} \\
0 & 0 & \boldsymbol{A}
\end{array}\right]\left[\begin{array}{l}
e \\
\dot{e} \\
\boldsymbol{z}
\end{array}\right]+\left[\begin{array}{l}
0 \\
0 \\
\boldsymbol{b}
\end{array}\right] w
$$

若系统（9－277）可控，即

$$
\operatorname{rank}\left[\begin{array}{cccc}
0 & 0 & -c b & -c A b \\
0 & -c b & -c A b & -c A^{2} b \\
b & A b & A^{2} b & A^{3} b
\end{array}\right]=n+2
$$

则存在状态反馈

$$
w=-\left[\begin{array}{lll}
k_{1} & k_{2} & \boldsymbol{k}_{3}
\end{array}\right]\left[\begin{array}{c}
e  \tag{9-278}\\
\dot{e} \\
z
\end{array}\right]=-k_{1} e-k_{2} \dot{e}-\boldsymbol{k}_{3} z
$$

使增广闭环系统

$$
\begin{align*}
{\left[\begin{array}{c}
\dot{e} \\
\ddot{e} \\
\dot{z}
\end{array}\right] } & =\left\{\left[\begin{array}{ccc}
0 & 1 & 0 \\
0 & 0 & -\boldsymbol{c} \\
0 & 0 & \boldsymbol{A}
\end{array}\right]-\left[\begin{array}{c}
0 \\
0 \\
\boldsymbol{b}
\end{array}\right]\left[\begin{array}{lll}
k_{1} & k_{2} & \boldsymbol{k}_{3}
\end{array}\right]\right\}\left[\begin{array}{l}
e \\
\dot{e} \\
z
\end{array}\right]  \tag{9-279}\\
& =\left[\begin{array}{ccc}
0 & 1 & 0 \\
0 & 0 & -\boldsymbol{c} \\
-k_{1} \boldsymbol{b} & -k_{2} \boldsymbol{b} & \boldsymbol{A}-\boldsymbol{b} \boldsymbol{k}_{3}
\end{array}\right]\left[\begin{array}{l}
e \\
\dot{e} \\
z
\end{array}\right]
\end{align*}
$$

渐近稳定。其中，$k_{1}, k_{2}$ 和 $\boldsymbol{k}_{3}$ 可由要求的闭环增广系统（9－278）的极点位置来确定。这样，当 $t \rightarrow \infty$ 时，必有 $e(t) \rightarrow 0$ 。

对式（9－278）作二次积分，可得含有输人内模信息的反馈控制信号

$$
u(t)=-k_{1} \int_{0}^{t} \int_{0}^{t} e(\tau) \mathrm{d} \tau \mathrm{~d} \tau-k_{2} \int_{0}^{t} e(\tau) \mathrm{d} \tau-\boldsymbol{k}_{3} \boldsymbol{x}(t)
$$



<!-- source_pdf_page: 543 -->
斜坡输人的内模设计系统框图如图9－32所示。
由图9－32可见，虚框表示的控制器中含有两个积分器，这正是斜坡输入的内模形式。类似地，可以将内模方法推广到处理其他参考输人形式。此外，如果将扰动信号的生成模型也纳人校正控制器中，还可以通过扰动内模设计来克服持续扰动对系统性能的影响，请参见本章习题。

![](assets/fig-09-32.png)

> Image description: This figure illustrates a control system with a dashed boundary denoting the controller. Inside, two integrators (1/s blocks) are connected in series, forming an internal model for ramp inputs. The controller also includes gains k₁, k₂, and k₃. The error signal e(t) is generated by subtracting the system output y(t) from the reference r(t). The controller output u(t) drives the “对象” (plant), producing y(t). Feedback paths include k₂ and k₃, with k₃ connected to the plant’s output x. The structure demonstrates how internal model control (IMC) can handle ramp inputs and potentially be extended to reject persistent disturbances by incorporating disturbance models into the controller design.
图9－32 斜坡输人的内模设计系统框图

例9－28 打印机皮带驱动器。
在计算机外围设备中，常用的低价位打印机都配有皮带驱动器，用于驱动打印头沿打印页面横向移动。打印头可能是喷墨式或针式的。图9－33是一个装有直流电机的皮带驱动式打印机，其光传感器用来测定打印头的位置，皮带张力变化用于调节皮带的实际弹性状态。

![](assets/fig-09-33.png)

> Image description: This textbook figure illustrates a belt-driven printer mechanism using a DC motor. The system comprises a belt looped between rollers, with a print head mounted on it. A light source and optical sensor form a position feedback loop, measuring the print head’s actual position y(t). The sensor output feeds into a controller, which adjusts the DC motor voltage to regulate the print head’s movement. Arrows indicate the control flow: sensor → controller → motor. The diagram highlights the closed-loop control system, where the optical sensor provides real-time position feedback to maintain accurate print head alignment. The belt’s tension is noted as a factor influencing its elastic behavior, affecting print precision. This setup is typical in low-cost printers using either inkjet or dot-matrix technology.
图9－33 打印机皮带驱动系统

设计要求：

1） 建立系统的状态空间模型，选择合适的电机参数、滑轮参数和控制器参数；
2） 研究皮带弹性系数 $k$ 对打印机抗外界扰动性能的影响。

解 1）状态空间建模及系统参数选择。图9－34为打印机皮带驱动器的基本模型。模型中记皮带弹性系数为 $k$ ，滑轮半径为 $r$ ，电机轴转角为 $\theta$ ，右滑轮的转角为 $\theta_{p}$ ，打印头质量为 $m$ ，打印头位移为 $y(t)$ 。光传感器用来测量 $y(t)$ ，光传感器的输出电压为 $v_{1}$ ，且 $v_{1}=k_{1} y$ 。控制器输出电压为 $v_{2}$ ，对系统进行速度反馈，即有 $v_{2}=-k_{2} \frac{\mathrm{~d} v_{1}}{\mathrm{~d} t}$ 。

系统参数取值情况如表 9－2 所示。



<!-- source_pdf_page: 544 -->
表9－2 打印装置的参数
| 质量 | $m=0.2 \mathrm{~kg}$ |
| :--- | :--- |
| 光传感器 | $k_{1}=1 \mathrm{~V} / \mathrm{m}$ |
| 滑轮半径 | $r=0.015 \mathrm{~m}$ |
| 电机 |  |
| 电感 | $L \approx 0$ |
| 电机和滑轮的摩擦系数 | $f=0.25 \mathrm{~N} \cdot \mathrm{~m} \cdot \mathrm{~s}$ |
| 电枢电阻 | $R=2 \Omega$ |
| 电机传递系数 | $K_{m}=2 \mathrm{~kg} \cdot \mathrm{~m} / \mathrm{A}$ |
| 电机和滑轮的转动惯量 | $J_{\text {电新 }}+J_{\text {汿轮 }}=J=0.01 \mathrm{~kg} \cdot \mathrm{~m}^{2}$ |


![](assets/fig-09-34.png)

> Image description: This figure illustrates a belt-drive system model for a printer, depicting mechanical and control components. An electric motor generates torque T₁ and T₂, driving pulleys with angular displacements θ and θ_p. The system includes two springs with stiffness k, connecting the motor and pulley to a mass m, representing mechanical compliance. A sensor measures velocity v₁ = k₁y, and a controller computes v₂ = -k₂ dv₁/dt, feeding back to the motor. The mass m moves linearly with displacement y, linked to pulley θ_p via radius r. Arrows indicate torque and velocity directions, while dashed lines show feedback paths. The model integrates mechanical dynamics with proportional-derivative control for position regulation, simulating real-time printer belt tension and movement control.
图9－34 打印机皮带驱动模型

下面推导系统的运动方程。注意到 $y=r \theta_{p}$ ，可知皮带张力 $T_{1}$ 和 $T_{2}$ 分别为

$$
T_{1}=k\left(r \theta-r \theta_{p}\right)=k(r \theta-y), \quad T_{2}=k(y-r \theta)
$$

式中，$k$ 为皮带弹性系数。于是，作用在质量 $m$ 上的皮带净张力为

$$
T_{1}-T_{2}=2 k(r \theta-y)=2 k x_{1}
$$

其中，$x_{1}=r \theta-y$ 为第一个状态变量，表示打印头实际位移 $y$ 与预期位移 $r \theta$ 之间的位移差。显然，质量 $m$ 的运动方程为

$$
m \frac{\mathrm{~d}^{2} y}{\mathrm{~d} t^{2}}=T_{1}-T_{2}=2 k x_{1}
$$

取第二个状态变量为 $x_{2}=\frac{\mathrm{d} y}{\mathrm{~d} t}$ ，于是有

$$
\begin{equation*}
\frac{\mathrm{d} x_{2}}{\mathrm{~d} t}=\frac{2 k}{m} x_{1} \tag{9-280}
\end{equation*}
$$

定义第三个状态变量为 $x_{3}=\frac{\mathrm{d} \theta}{\mathrm{d} t}$ ，则 $x_{1}$ 的导数

$$
\begin{equation*}
\frac{\mathrm{d} x_{1}}{\mathrm{~d} t}=r \frac{\mathrm{~d} \theta}{\mathrm{~d} t}-\frac{\mathrm{d} y}{\mathrm{~d} t}=-x_{2}+r x_{3} \tag{9-281}
\end{equation*}
$$

接着，推导电机旋转的运动方程：当 $L=0$ 时，电机电枢电流 $i=\frac{v_{2}}{R}$ ，而电机转矩为



<!-- source_pdf_page: 545 -->
$M_{m}=K_{m} i$ ，于是有

$$
\begin{equation*}
M_{m}=\frac{K_{m}}{R} v_{2} \tag{9-282}
\end{equation*}
$$

设作用在驱动皮带上的扰动转矩为 $M_{d}$ ，则电机驱动皮带的有效转矩为 $M=M_{m}-M_{d}$ 。显然，只有有效转矩驱动电机轴带动滑轮运动，因此有

$$
M=J \frac{\mathrm{~d}^{2} \theta}{\mathrm{~d} t^{2}}+f \frac{\mathrm{~d} \theta}{\mathrm{~d} t}+r\left(T_{1}-T_{2}\right)
$$

由于

$$
\frac{\mathrm{d} x_{3}}{\mathrm{~d} t}=\frac{\mathrm{d}^{2} \theta}{\mathrm{~d} t^{2}}, \quad T_{1}-T_{2}=2 k x_{1}
$$

故得
在上式中，代人式（9－282）以及

$$
\begin{aligned}
& v_{2}=-k_{2} \frac{\mathrm{~d} v_{1}}{\mathrm{~d} t} \\
& v_{1}=k_{1} y, \quad x_{2}=\frac{\mathrm{d} y}{\mathrm{~d} t}
\end{aligned}
$$

得到

$$
\frac{M_{m}}{J}=\frac{K_{m}}{R J} v_{2}=-\frac{K_{m} k_{2}}{R J} \frac{\mathrm{~d} v_{1}}{\mathrm{~d} t}=-\frac{K_{m} k_{1} k_{2}}{R J} x_{2}
$$

最后可得

$$
\begin{equation*}
\frac{\mathrm{d} x_{3}}{\mathrm{~d} t}=-\frac{2 k r}{J} x_{1}-\frac{K_{m} k_{1} k_{2}}{R J} x_{2}-\frac{f}{J} x_{3}-\frac{M_{d}}{J} \tag{9-283}
\end{equation*}
$$

式（9－280）、式（9－281）及式（9－283）构成了描述打印机皮带驱动系统的一阶运动微分方程组，其向量－矩阵形式为

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{ccc}
0 & -1 & r  \tag{9-284}\\
\frac{2 k}{m} & 0 & 0 \\
-\frac{2 k r}{J} & -\frac{K_{m} k_{1} k_{2}}{R J} & -\frac{f}{J}
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{c}
0 \\
0 \\
-\frac{1}{J}
\end{array}\right] M_{d}
$$

式（9－284）的信号流图如图9－35所示，图中还表示了扰动力矩 $M_{d}$ 的节点。

![](assets/fig-09-35.png)

> Image description: This signal flow graph (Fig. 9-35) models a mechanical system’s dynamics using Mason’s gain formula. Nodes represent variables: M (input torque), x₁, x₂, x₃ (positions/velocities), and M_d (disturbance torque). Arrows denote signal flow with transfer functions: 1/J, s⁻¹, -f/J, -2kr/J, 2k/m, -2kr, -k₂k₁, K_m/R, and -1. Feedback loops include -f/J, -2kr, and -k₂k₁. The disturbance M_d enters via -1 and 1 branches, affecting M. The system integrates forces and torques, with s⁻¹ blocks indicating integration (velocity from acceleration). The graph visually represents the system’s state-space or transfer function relationships, crucial for analyzing stability and response under external disturbances.
图9－35 打印机皮带驱动系统的信号流图

2）皮带弹性系数的影响。为了研究如何抑制 $M_{d}$ 对系统性能的影响，可由图9－35确定传递函数 $X_{1}(s) / M_{d}(s)$ 。利用梅森增益公式，可得



<!-- source_pdf_page: 546 -->
$$
\frac{X_{1}(s)}{M_{d}(s)}=\frac{-\frac{r}{J} s^{-2}}{1-\left(L_{1}+L_{2}+L_{3}+L_{4}\right)+L_{1} L_{2}}
$$

其中回路增益

$$
\begin{array}{ll}
L_{1}=-\frac{f}{J} s^{-1}, & L_{2}=-\frac{2 k}{m} s^{-2} \\
L_{3}=-\frac{2 k r^{2}}{J} s^{-2}, & L_{4}=-\frac{2 k k_{1} k_{2} K_{m} r}{m R J} s^{-3}
\end{array}
$$

因而有

$$
\frac{X_{1}(s)}{M_{d}(s)}=\frac{-\left(\frac{r}{J}\right) s}{s^{3}+\left(\frac{f}{J}\right) s^{2}+\left(\frac{2 k}{m}+\frac{2 k r^{2}}{J}\right) s+\left(\frac{2 k f}{m J}+\frac{2 k K_{m} k_{1} k_{2} r}{m R J}\right)}
$$

代人表9－2所示参数值，得

$$
\frac{X_{1}(s)}{M_{d}(s)}=\frac{-1.5 s}{s^{3}+25 s^{2}+10.05 k s+k\left(250+15 k_{2}\right)}
$$

为了抑制 $M_{d}$ 对打印头位移差 $x_{1}=r \theta-y$ 的影响，需要选择合适的皮带弹性系数 $k$ 和速度反馈系数 $k_{2}$ 。令 $M_{d}(s)=\frac{1}{s}$ ，有

$$
X_{1}(s)=\frac{-1.5}{s^{3}+25 s^{2}+10.05 k s+k\left(250+15 k_{2}\right)}
$$

显然，$k$ 与 $k_{2}$ 的选择应首先保证闭环系统的稳定性。系统的闭环特征方程为

$$
s^{3}+25 s^{2}+10.05 k s+k\left(250+15 k_{2}\right)=0
$$

列劳斯表如下：

$$
\begin{array}{c|cc}
s^{3} & 1 & 10.05 k \\
s^{2} & 25 & k\left(250+15 k_{2}\right) \\
s^{1} & \frac{25 \times 10.05 k-k\left(250+15 k_{2}\right)}{25} & 0 \\
s^{0} & k\left(250+15 k_{2}\right) &
\end{array}
$$

由劳斯判据知，使闭环系统稳定的充分必要条件为

$$
25 \times 10.05 k-k\left(250+15 k_{2}\right)>0
$$

以及

$$
k\left(250+15 k_{2}\right)>0
$$

整理得

$$
k>0, \quad 0<k_{2}<0.0833
$$

在系统稳定的前提下，由终值定理可知，打印头稳态位移差

$$
\lim _{t \rightarrow \infty} x_{1}(t)=\lim _{s \rightarrow 0} s X_{1}(s)=0
$$

打印头在运动过程中受单位阶跃扰动力矩作用下的动态特性，取决于皮带弹性系数 $k$ 和速度反馈系数 $k_{2}$ 的选取。通常，$k$ 在 $1 \sim 40$ 范围内取值，$k_{2}<1$ 。 一组合适的取值为 $k=20$和 $k_{2}=0.08$ ，此时



<!-- source_pdf_page: 547 -->
$$
X_{1}(s)=\frac{-1.5}{s^{3}+25 s^{2}+201 s+5024}=\frac{-1.5}{(s+25)\left(s^{2}+201\right)}
$$

对上式进行部分分式分解，有

$$
X_{1}(s)=\frac{A_{1}}{s+25}+\frac{A_{2} s+A_{3}}{s^{2}+201}
$$

其中，$A_{1}=-0.0018, A_{2}=0.0018, A_{3}=-0.045$ 。由于留数 $A_{1}$ 和 $A_{2}$ 比 $A_{3}$ 小得多，其影响可略，故

$$
X_{1}(s) \approx \frac{-0.045}{s^{2}+201}
$$

查本书附录 A，可得

$$
x_{1}(t) \approx-3.17 \times 10^{-3} \sin (14.18 t)
$$

其动态响应如图9－36所示。由图可见，该系统可将外来阶跃扰动的影响抑制到相当微弱的程度，实现了预期的设计目标。

![](assets/fig-09-36.png)

> Image description: The figure displays the dynamic response of a system over time, labeled as x₁(t) on the y-axis and Time/sec on the x-axis, ranging from 0 to 3.0 seconds. The y-axis is scaled by ×10⁻³, indicating the response variable is in milli-units. The plot shows a damped oscillatory response, with peaks gradually decreasing in amplitude over time, suggesting effective suppression of external step disturbances. The system exhibits a stable, decaying oscillation, returning toward equilibrium without divergence. This behavior reflects successful control design, as the oscillations are confined and diminish, demonstrating robustness against perturbations. The graph visually confirms the system’s ability to attenuate disturbances to negligible levels, meeting the design objective.
图9－36 打印头位移差 $x_{1}(t)$ 对阶跃扰动的响应（ $k=20$ ，MATLAB）

MATLAB 程序如下 ：

```
k=20: k2=0.08:
num= [-1.50] :
den = [125 10.05*k k*(250+15*k2)] :
sys=tf(num, den);
f=0: 0.01: 3;
step(sys, t): grid
```

例 9－29 自动检测系统。
电气开关面板上有各种开关、继电器和指示灯，若采用手工方式检测，会降低产量并造成较大的检验误差。图 9－37 是一个自动检测系统示意图，该系统通过直流电机来驱动一组探针，使探针穿过零件的引线，以便检测零件的导通性能、电阻及其他功能参数。



<!-- source_pdf_page: 548 -->
![](assets/fig-09-37.png)

> Image description: This figure illustrates a position detection system. A horizontal rod (导杆) slides within guide rails (导轨), enabling linear motion. Attached to the rod is a probe (探针) for sensing. An electric motor (电机) drives the rod, while a rotary encoder (编码器) mounted on the motor shaft generates position feedback signals. These signals are sent to a decoder (解码器), which processes them and outputs a decoded position value. The system includes a control panel (开关面板) and a magnetic field voltage supply (磁场电压) for the motor. Arrows indicate bidirectional movement. The encoder-decoder pair enables precise position tracking, forming a closed-loop control system for automated positioning applications.
图9－37 自幼检测系统示意图

该自动检测系统利用直流电机上的编码器来测量电压和探针的位置，如图9－38所示。其结构图模型如图9－39所示，其中 $K_{a}$ 为所需要的功率放大系数。

![](assets/fig-09-38.png)

> Image description: This figure illustrates a position-sensing system using a DC motor with an incremental encoder. The motor’s shaft rotates with angular displacement θ, indicated by an arc and arrow. Attached to the motor’s periphery is an incremental encoder, which generates position and velocity signals. These signals feed into a decoder block, outputting θ (angular position) and dθ/dt (angular velocity). A separate input labeled “磁场电流” (field current, i_f) is applied to the motor’s field winding. The diagram shows a closed-loop control system where position and speed feedback from the encoder is processed by the decoder to regulate motor motion. The encoder’s output enables precise position tracking, essential for servo or robotic applications. No power amplifier gain (K_a) is visually depicted, though referenced in the caption.
图9－38 装有编码轮睢的直流电机示意图

![](assets/fig-09-39.png)

> Image description: This block diagram (Fig. 9-38) illustrates a DC motor control system with an encoder wheel. Input voltage U(s) enters an amplifier with gain Ka, producing voltage output Vf(s). This drives a field excitation circuit modeled as 1/(s+5), yielding field current If(s). The current then feeds a motor block represented as 1/[s(s+1)], generating angular output Θ(s). Arrows indicate signal flow: U(s) → Vf(s) → If(s) → Θ(s). The system models field-controlled DC motor dynamics, where the amplifier scales input, the field circuit introduces time delay, and the motor block captures mechanical inertia and damping. This schematic is typical in control systems for analyzing position response under field excitation.
图9－39 直流电机结构图模型

设状态变量选择为：$x_{1}=\theta, x_{2}=\mathrm{d} \theta / \mathrm{d} t, x_{3}=i_{f}$ ；假定这些状态变量均可测，且能用于反馈。图9－40所示为其闭环系统，其中控制律

$$
u=-K_{1} x_{1}-K_{2} x_{2}-K_{3} x_{3}
$$

本例的设计目标是：合理选择放大器增益 $K_{a}$ 和状态反馈增益 $K_{1}, K_{2}$ 和 $K_{3}$ ，使系统单位阶跃响应的调节时间小于 $2 \mathrm{~s}(\Delta=2 \%)$ ，超调量小于 $4 \%$ 。

解 首先列写系统的状态方程。由图 9－40 可见，当系统状态反馈未接人时，有

$$
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{b} u(t)=\left[\begin{array}{ccc}
0 & 1 & 0 \\
0 & -1 & 1 \\
0 & 0 & -5
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{c}
0 \\
0 \\
K_{a}
\end{array}\right] u
$$

当系统接人状态反馈控制律，并令 $K_{1}=1$ 时，得闭环系统方程为

$$
\dot{x}(t)=\left[\begin{array}{ccc}
0 & 1 & 0 \\
0 & -1 & 1 \\
-K_{a} & -K_{a} K_{2} & -\left(5+K_{a} K_{3}\right)
\end{array}\right] x(t)=\bar{A} x(t)
$$



<!-- source_pdf_page: 549 -->
![](assets/fig-09-40.png)

> Image description: This figure illustrates a feedback control system’s signal flow. Input R(s) enters a summing junction, then passes through U(s), Ka, and transfer functions 1/(s+5), 1/(s+1), and 1/s, leading to output position x1. Feedback paths with gains -K1, -K2, and -K3 connect from various points (x1, x2, x3) back to the input summing junction. The system uses negative feedback to correct error. Variables x1, x2, x3 represent intermediate states or measurements. The diagram shows how the controller U(s) and feedback loops interact to regulate the output position. This structure is typical in automatic control systems for maintaining desired output despite disturbances.
图9－40 自动检测反馈控制系统信号流图

令 $\operatorname{det}(s \boldsymbol{I}-\overline{\boldsymbol{A}})=0$ ，得闭环系统特征方程

$$
s^{3}+\left(6+K_{a} K_{3}\right) s^{2}+\left[5+K_{a}\left(K_{2}+K_{3}\right)\right] s+K_{a}=0
$$

上式可写为

$$
s(s+1)(s+5)+K_{a} K_{3}\left(s^{2}+\frac{K_{2}+K_{3}}{K_{3}} s+\frac{1}{K_{3}}\right)=0
$$

其等效闭环特征方程为

$$
1+K_{a} K_{3} \frac{s^{2}+\frac{K_{2}+K_{3}}{K_{3}} s+\frac{1}{K_{3}}}{s(s+1)(s+5)}=0
$$

以 $K_{a} K_{3}$ 为可变参数，绘制等效系统的根轨迹图，并适当选择待定参数，使系统性能满足设计指标。

根据给定的性能指标要求，应有

$$
\begin{gathered}
\sigma \% \cong 100 \mathrm{e}^{-\pi \zeta / \sqrt{1-\zeta^{2}}} \%<4 \% \\
t_{s} \cong \frac{4.4}{\zeta \omega_{n}}<2 \quad(\Delta=2 \%) \\
\zeta>0.72, \quad \omega_{n}>3.1
\end{gathered}
$$

则系统希望主导极点在复平面上的有效取值区域，如图9－41（a）中阴影线区域所示。

![](assets/fig-09-41.png)

> Image description: This figure illustrates the desired region in the complex plane for dominant system poles to meet performance specifications. The real axis (horizontal) and imaginary axis (vertical) form the s-plane. Shaded diagonal lines represent constant damping ratio (ζ) contours, while dashed lines indicate constant natural frequency (ωₙ) values. A labeled ellipse marks the “effective region” satisfying ζ > 0.72 and ωₙ = 3.1. A point labeled KₐK₃ = 12 indicates a design gain value. Arrows show the trajectory of the closed-loop pole as gain varies. The shaded area, bounded by ζωₙ and -ζωₙ, defines where poles must lie to achieve the desired transient response. This is a root locus or pole placement design diagram for control system tuning.
（a）自动检测系统的根轨迹

ele：clear：
num＝$\left[\begin{array}{lll}1 & 8 & 20\end{array}\right]$ ：den $=\left[\begin{array}{llll}1 & 6 & 5 & 0\end{array}\right]$ ；
rlocus（num，den）：hold on
％昆示稳定性区域
zeta $=0.72 . \mathrm{wn}=3.1:$
$\mathrm{x}=-1030.1:-$ zeta ${ }^{*}$ wn； $\mathrm{y}=-\left(\operatorname{sqrt}\left(1-\text { zeta }^{\wedge} 2\right) / \text { zeta }\right)^{*} \mathrm{x}$ ；
xc＝－10：0．1：－zeta＊wn；c＝sqrt（wn 2－xc．＾2）；
plot（x，y，％，x，－y，＊，xc，c，＇，xc，－c，＇ 3
$\operatorname{axis}\left(\left[\begin{array}{llll}-10 & 1 & -10 & 10\end{array}\right]\right)$ ；
（b）MATLAB程序
图9－41 自动检测系统设订（MATLAB）



<!-- source_pdf_page: 550 -->
为了把根轨迹拉向图9－41（a）所示阴影线区域，将等效系统的开环零点取为 $s=-4 \pm \mathrm{j} 2$（位于阴影线区域内），且令

$$
s^{2}+\frac{K_{2}+K_{3}}{K_{3}} s+\frac{1}{K_{3}}=(s+4+\mathrm{j} 2)(s+4-\mathrm{j} 2)=s^{2}+8 s+20
$$

即有

$$
\frac{K_{2}+K_{3}}{K_{3}}=8, \quad \frac{1}{K_{3}}=20
$$

解出

$$
K_{2}=0.35, \quad K_{3}=0.05
$$

运行图9－41（b）所示 MATLAB 程序，可以画出以 $K_{a} K_{3}$ 为可变参数的根轨迹图，如图9－41（a）所示。由图可见，当取根轨迹增益 $K_{a} K_{3}=12$ 时，闭环极点位于有效取值区域之内。从而满足设计指标要求。本例最终设计结果为：$K_{a}=240.00, K_{1}=1.00, K_{2}=0.35, K_{3}=0.05$ 。

最后，校验设计参数，系统的单位阶跃响应曲线如图9－42所示。由图得，设计后系统的 $\sigma \%=2 \%, t_{s}=0.88 \mathrm{~s}(\Delta=2 \%)$ ，系统确实满足了设计要求。

MATLAB 程序如下：

```
Ka=240; K1=1; K2=0.35: K3=0.05;
A=[010; 0-1 1: -Ka -Ka*K2 -5-Ka*K3] :
b=[00 Ka] ′ :
c= [100,
d=0;
sys=ss(A, b, c, d):
t=0 : 0.01 : 3:
step(sys, t); grid
```

![](assets/fig-09-42.png)

> Image description: This figure, labeled “Figure 9-42,” displays the unit step response of an automatic detection system simulated in MATLAB. The x-axis represents time in seconds (0 to 3.0 sec), and the y-axis represents amplitude (0.0 to 1.0). The response curve begins at zero, rises steeply, and asymptotically approaches 1.0 amplitude after approximately 1.0 second. From 1.5 seconds onward, the amplitude stabilizes near 1.0, indicating system settling. The plot includes dashed grid lines and horizontal dashed lines marking the 1.0 amplitude level. This response suggests a first-order or low-order system with a relatively fast rise time and minimal overshoot. The curve’s behavior reflects the system’s transient and steady-state responses under a unit step input, crucial for analyzing system stability and performance in control engineering.
图9－42 自动检测系统的单位阶跃响应（MATLAB）

例 9－30 磁盘驱动读取系统（续）。
现代磁盘在每厘米宽度内有5000个磁道，每个磁道的典型宽度仅为1 $\mu \mathrm{m}$ ，因此磁盘驱动读取系统对磁头的定位精度和磁头在磁道间移动的动态过程有严格的要求。

当不考虑磁场电感影响时，磁头控制系统的二阶开环模型如图9－43所示，采用状态反馈控制器后的闭环系统如图 9－44 所示。设计要求：

1）选择放大器增益 $K_{a}$ 和反馈系数 $K_{2}$ ，使系统二阶模型响应满足表 9－3 所示性能指标要求；



<!-- source_pdf_page: 551 -->
![](assets/fig-09-43.png)

> Image description: This figure illustrates a magnetic head control system’s second-order open-loop model. Input R(s) drives the system through a summing junction, then passes through a proportional amplifier with gain Ka. The output enters a motor gain block G1(s) = 5. A disturbance N(s) is added at a summing junction before the plant transfer function 1/(s+20). The system then integrates via 1/s to yield the magnetic head position Y(s). The diagram includes labeled blocks: “放大器” (amplifier), “电机增益” (motor gain), and “磁头位置” (head position). Arrows indicate signal flow, and summing junctions (+) show feedback or disturbance addition. This model represents a simplified servo system for precise magnetic head positioning in data storage devices.
图9－43 磁头控制系统的二阶开环模型

![](assets/fig-09-44.png)

> Image description: This figure illustrates a second-order open-loop model for a magnetic head control system. Input R(s) enters a summing junction with gain 1, then passes through a proportional gain Ka. The output proceeds through a gain block of 5, then a summing junction with feedback from N(s) (disturbance) and a feedback path labeled -20. The system includes two integrators (1/s) and two feedback loops: one with gain -K2 and another with -K1 = -1. The disturbance N(s) is added at a point before the first integrator. The final output is Y(s), derived from the cascaded system and feedback paths. Arrows indicate signal flow, and the variable x2 denotes a point in the feedback loop. The diagram represents a control system with disturbance rejection and integral action for position control.
图9－44 具有两条状态变量反馈回路的闭环系统信号流图

2）若考虑磁场电感的影响，且设电感 $L$ 为 1 mH ，则磁盘驱动读取系统中的电机传递函数为

$$
G_{1}(s)=\frac{5000}{s+1000}
$$

要求采用系统的三阶模型检验系统采用二阶模型时的设计结果。

表9－3 磁盘驱动控制系统的设计要求和实际性能
| 性能指标 | 期望值 | 二阶模型响应 | 三阶模型响应 |
| :--- | :--- | :--- | :--- |
| 超调量 | ＜5％ | ＜2％ | 0％ |
| 调节时间／ms | ＜50 | 40.2 | 40.3 |
| 单位阶跃扰动的响应峰值 | $5.2 \times 10^{-3}$ | $5.2 \times 10^{-5}$ | $5.2 \times 10^{-5}$ |


解 首先建立系统的状态空间模型。选择状态变量为：$x_{1}(t)=y(t)$ ，$x_{2}(t)=\mathrm{d} y(t) / \mathrm{d} t=\mathrm{d} x_{1}(t) / \mathrm{d} t$ ，由图9－43知，开环系统的二阶模型的状态方程为

$$
\dot{\boldsymbol{x}}(t)=\left[\begin{array}{cc}
0 & 1 \\
0 & -20
\end{array}\right] \boldsymbol{x}(t)+\left[\begin{array}{c}
0 \\
5 K_{a}
\end{array}\right] r(t)
$$

假定磁头的位置及速度均可以测量，根据图9－44所示的状态反馈闭环系统，可得闭环系统的状态方程为

$$
\dot{\boldsymbol{x}}(t)=\left[\begin{array}{cc}
0 & 1 \\
-5 K_{1} K_{a} & -\left(20+5 K_{2} K_{a}\right)
\end{array}\right] \boldsymbol{x}(t)+\left[\begin{array}{c}
0 \\
5 K_{a}
\end{array}\right] r(t)
$$

在上式中代人 $K_{1}=1$ ，可由 $\operatorname{det}(s \boldsymbol{I}-\overline{\boldsymbol{A}})=0$（其中 $\overline{\boldsymbol{A}}$ 为闭环系统阵），得

$$
\operatorname{det}\left[\begin{array}{cc}
s & -1 \\
5 K_{a} & s+\left(20+5 K_{2} K_{a}\right)
\end{array}\right]=0
$$

于是，闭环系统的特征方程为

$$
s^{2}+\left(20+5 K_{2} K_{a}\right) s+5 K_{a}=0
$$



<!-- source_pdf_page: 552 -->
为了满足设计指标要求，根据

$$
\begin{aligned}
& \sigma \%=100 \mathrm{e}^{-\pi \zeta / \sqrt{1-\zeta^{2}}} \%<5 \% \\
& t_{s}=\frac{4.4}{\zeta \omega_{n}}<0.05 \quad(\Delta=2 \%)
\end{aligned}
$$

应有 $\zeta>0.69$ 以及 $\zeta \omega_{n}>88$ 。考虑到磁盘读取系统对动态过程的严格要求，现取

$$
\zeta=0.9, \quad \zeta \omega_{n}=125
$$

其对应的动态性能指标为 $\sigma \%=1.53 \%$ 和 $t_{s}=35.2 \mathrm{~ms}$ ，比较满意。在此情况下，预期的闭环特征方程为

$$
s^{2}+2 \zeta \omega_{n} s+\omega_{n}^{2}=s^{2}+250 s+19290=0
$$

令实际系统的闭环特征方程与预期闭环特征方程的对应项系数相等，得

$$
\begin{gathered}
5 K_{a}=19290 \\
20+5 K_{2} K_{a}=250
\end{gathered}
$$

求得放大器增益 $K_{a}=3858$ ，反馈增益 $K_{2}=0.012$ 。采用仿真方法计算闭环系统的实际响应，所得动态性能指标如表 9－3 中第 3 列所示。结果表明，所选择的系统参数满足对系统的设计指标要求。

如果考虑磁场电感影响，图9－43中的 $G_{1}(s)=5$ 应变为

$$
G_{1}(s)=\frac{5000}{s+1000}
$$

从而得到系统更精确的三阶开环模型。仍然沿用二阶系统模型时选取的系统参数，即$K_{a}=3858, K_{1}=1, K_{2}=0.012$ ，对闭环系统的实际响应进行仿真计算，其结果如表 9－3 中第4 列所示。表明：三阶闭环系统同样满足设计要求，其动态性能与二阶闭环系统性能相近，这说明二阶开环模型足以精确地描述磁盘驱动读取系统。

三阶模型单位阶跃响应的 MATLAB 仿真结果如图9－45所示。

![](assets/fig-09-45.png)

> Image description: The figure displays the unit step response of a third-order system, simulated in MATLAB. The x-axis represents time in seconds (0 to 0.06 sec), and the y-axis represents amplitude (0 to 1.0). The response curve begins at zero amplitude at t=0 and rises rapidly, approaching a steady-state value near 1.0 after approximately 0.04 seconds. The curve exhibits a smooth, sigmoidal shape, characteristic of a damped system’s transient behavior. The system’s overshoot is minimal, and it settles with little oscillation, indicating a relatively stable and well-damped response. The plot includes dotted gridlines for reference, aiding in visual interpretation of the system’s dynamics. This response is typical for a higher-order system with sufficient damping to avoid significant oscillations.
图9－45 碳盘驱动系统三阶模型的时间响应（MATLAB）



<!-- source_pdf_page: 553 -->
## 习 题

9－1 已知电枢控制的直流伺服电机的微分方程组及传递函数为

$$
\begin{gathered}
u_{a}=R_{a} i_{a}+L_{a} \frac{\mathrm{~d} i_{a}}{\mathrm{~d} t}+E_{b}, \quad E_{b}=C_{b} \frac{\mathrm{~d} \theta_{m}}{\mathrm{~d} t} \\
M_{m}=C_{m} i_{a}, \quad M_{m}=J_{m} \frac{\mathrm{~d}^{2} \theta_{m}}{\mathrm{~d} t^{2}}+f_{m} \frac{\mathrm{~d} \theta_{m}}{\mathrm{~d} t} \\
\frac{\Theta_{m}(s)}{U_{a}(s)}=\frac{C_{m}}{S\left[L_{a} J_{m} s^{2}+\left(L_{a} f_{m}+J_{m} R_{a}\right) s+\left(R_{a} f_{m}+C_{b} C_{m}\right)\right]}
\end{gathered}
$$

（1） 设状态变量 $x_{1}=\theta_{m}, x_{2}=\dot{\theta}_{m}, x_{3}=\ddot{\theta}_{m}$ ，输出量 $y=\theta_{m}$ ，试建立其动态方程；
（2） 设状态变量 $\bar{x}_{1}=i_{a}, \bar{x}_{2}=\theta_{m}, \bar{x}_{3}=\dot{\theta}_{m}, y=\theta_{m}$ ，试建立其动态方程；
（3） 设 $\boldsymbol{x}=T \boldsymbol{x}$ ，确定两组状态变量间的变换矩阵 $T$ 。

9－2 设系统微分方程为

$$
\ddot{x}+3 \dot{x}+2 x=u
$$

式中，$u$ 为输人量，$x$ 为输出量。

（1） 设状态变量 $x_{1}=x, x_{2}=\dot{x}$ ，试列写动态方程；
（2） 设状态变换 $x_{1}=\bar{x}_{1}+\bar{x}_{2}, x_{2}=-\bar{x}_{1}-2 \bar{x}_{2}$ ，试确定变换矩阵 $\boldsymbol{T}$ 及变换后的动态方程。

9－3 设系统微分方程为

$$
\dddot{y}+6 \ddot{y}+11 \dot{y}+6 y=6 u
$$

式中，$u 、 y$ 分别为系统的输人、输出量。试列写可控标准型（即 $\boldsymbol{A}$ 为友矩阵）及可观测标准型（即 $\boldsymbol{A}$为友矩阵转置）状态空间表达式，并画出状态变量图。

9－4 已知系统结构图如图9－46所示，其状态变量为 $x_{1}, x_{2}, x_{3}$ 。试求动态方程，并画出状态变量图。

![](assets/fig-09-46.png)

> Image description: This block diagram depicts a linear feedback control system with three state variables: x₁, x₂, x₃. The input is U(s), and output is Y(s) = X₁(s). The system flows from U(s) through a first block (2/(s+3)) to X₂(s), then to a summing junction. A feedback path from X₁(s) passes through a block (s) and then a block (2/(s+1)) to produce X₃(s), which subtracts from the forward path at the second summing junction. The output X₁(s) also feeds back directly to the first summing junction. Arrows indicate signal flow, and all blocks are interconnected to form a closed-loop system. The diagram is labeled with variables and transfer functions, suitable for deriving state-space equations.
图9－46 系统结构图

9－5 已知双输入－双输出系统状态方程和输出方程

$$
\begin{aligned}
& \dot{x}_{1}=x_{2}+u_{1} \\
& \dot{x}_{2}=x_{3}+2 u_{1}-u_{2} \\
& \dot{x}_{3}=-6 x_{1}-11 x_{2}-6 x_{3}+2 u_{2} \\
& y_{1}=x_{1}-x_{2} \\
& y_{2}=2 x_{1}+x_{2}-x_{3}
\end{aligned}
$$

写出其向量－矩阵形式并画出状态变量图。
9－6 已知系统传递函数为

$$
G(s)=\frac{s^{2}+6 s+8}{s^{2}+4 s+3}
$$



<!-- source_pdf_page: 554 -->
试求可控标准型（ $\boldsymbol{A}$ 为友矩阵）、可观测标准型（ $\boldsymbol{A}$ 为友矩阵转置）、对角线型（ $\boldsymbol{A}$ 为对角阵）的动态方程。

9－7 已知系统传递函数

$$
G(s)=\frac{5}{(s+1)^{2}(s+2)}
$$

试求约当型（ $\boldsymbol{A}$ 为约当阵）动态方程。
9－8 已知矩阵

$$
\boldsymbol{A}=\left[\begin{array}{llll}
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1 \\
1 & 0 & 0 & 0
\end{array}\right]
$$

试求 $\boldsymbol{A}$ 的特征方程、特征值、特征向量，并求出变换矩阵将 $\boldsymbol{A}$ 对角化。
9－9 已知矩阵

$$
A=\left[\begin{array}{cc}
-1 & 0 \\
0 & 1
\end{array}\right]
$$

试用幂级数法及拉普拉斯变换法求出矩阵指数（即状态转移矩阵）。
9－10 试求下列状态方程的解：

$$
\dot{x}=\left[\begin{array}{ccc}
-1 & 0 & 0 \\
0 & -2 & 0 \\
0 & 0 & -3
\end{array}\right] x
$$

9－11 已知系统状态方程为

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{ll}
1 & 0 \\
1 & 1
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{l}
1 \\
1
\end{array}\right] u
$$

初始条件为 $x_{1}(0)=1, x_{2}(0)=0$ 。试求系统在单位阶跃输人作用下的状态响应。
9－12 已知线性系统状态转移矩阵

$$
\Phi(t)=\left[\begin{array}{cc}
6 \mathrm{e}^{-t}-5 \mathrm{e}^{-2 t} & 4 \mathrm{e}^{-t}-4 \mathrm{e}^{-2 t} \\
-3 \mathrm{e}^{-t}+3 \mathrm{e}^{-2 t} & -2 \mathrm{e}^{-t}+3 \mathrm{e}^{-2 t}
\end{array}\right]
$$

试求该系统的状态阵 $\boldsymbol{A}$ 。
9－13 已知系统动态方程

$$
\begin{gathered}
\dot{x}=\left[\begin{array}{ccc}
0 & 1 & 0 \\
-2 & -3 & 0 \\
-1 & 1 & 3
\end{array}\right] x+\left[\begin{array}{l}
0 \\
1 \\
2
\end{array}\right] u \\
y=\left[\begin{array}{lll}
0 & 0 & 1
\end{array}\right] x
\end{gathered}
$$

试求传递函数 $G(s)$ 。
9－14 试求习题9－5所示系统的传递函数矩阵。
9－15 已知差分方程

$$
y(k+2)+3 y(k+1)+2 y(k)=2 u(k+1)+3 u(k)
$$

试列写可控标准型（ $\boldsymbol{A}$ 为友矩阵）离散动态方程，并求出 $u(k)=1$ 时的系统响应。给定 $y(0)=0, y(1)=1$ 。
9－16 已知连续系统动态方程为



<!-- source_pdf_page: 555 -->
$$
\dot{x}=\left[\begin{array}{ll}
0 & 1 \\
0 & 2
\end{array}\right] x+\left[\begin{array}{l}
0 \\
1
\end{array}\right] u, \quad y=\left[\begin{array}{ll}
1 & 0
\end{array}\right] x
$$

设采样周期 $T=1 \mathrm{~s}$ ，试求离散化动态方程。
9－17 试判断下列系统的状态可控性：
（1）$\dot{x}=\left[\begin{array}{ccc}-2 & 2 & -1 \\ 0 & -2 & 0 \\ 1 & -4 & 0\end{array}\right] \boldsymbol{x}+\left[\begin{array}{l}0 \\ 0 \\ 1\end{array}\right] u$ ；
（2）$\dot{x}=\left[\begin{array}{lll}1 & 1 & 0 \\ 0 & 1 & 0 \\ 0 & 1 & 1\end{array}\right] \boldsymbol{x}+\left[\begin{array}{l}0 \\ 1 \\ 0\end{array}\right] u$ ；
（3）$\dot{x}=\left[\begin{array}{lll}1 & 1 & 0 \\ 0 & 1 & 0 \\ 0 & 1 & 1\end{array}\right] \boldsymbol{x}+\left[\begin{array}{ll}0 & 0 \\ 0 & 1 \\ 1 & 0\end{array}\right]\left[\begin{array}{l}u_{1} \\ u_{2}\end{array}\right]$ ；
（4）$\dot{x}=\left[\begin{array}{ccc}-4 & & 0 \\ & -4 & \\ 0 & & 1\end{array}\right] x+\left[\begin{array}{l}1 \\ 2 \\ 1\end{array}\right] u$ 。

9－18 已知 $a d=b c$ ，试计算 $\left[\begin{array}{ll}a & b \\ c & d\end{array}\right]^{100}$ 。
9－19 设系统状态方程为

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{cc}
0 & 1 \\
-1 & a
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{l}
1 \\
b
\end{array}\right] u
$$

设状态可控，试求 $a, b$ 。
9－20 设系统传递函数为

$$
G(s)=\frac{s+a}{s^{3}+7 s^{2}+14 s+8}
$$

设状态可控，试求 $a$ 。
9－21 判断下列系统的输出可控性：

（1） $\dot{x}=\left[\begin{array}{ccc}0 & 1 & 0 \\ 0 & 0 & 1 \\ -6 & -11 & -6\end{array}\right] x+\left[\begin{array}{l}0 \\ 0 \\ 1\end{array}\right] u, \quad y=\left[\begin{array}{lll}1 & 0 & 0\end{array}\right] x$ ；
（2） $\dot{x}=\left[\begin{array}{cccc}-a & & & 0 \\ & -b & & \\ & & -c & \\ 0 & & & -d\end{array}\right] x+\left[\begin{array}{l}0 \\ 0 \\ 1 \\ 1\end{array}\right] u, \quad y=\left[\begin{array}{llll}1 & 0 & 0 & 0\end{array}\right] x$ 。

9－22 试判断下列系统的可观测性：

（1） $\dot{x}=\left[\begin{array}{ccc}-1 & -2 & -2 \\ 0 & -1 & 1 \\ 1 & 0 & -1\end{array}\right] x+\left[\begin{array}{l}2 \\ 0 \\ 1\end{array}\right] u, \quad y=\left[\begin{array}{lll}1 & 1 & 0\end{array}\right] x$ ；
（2） $\dot{x}=\left[\begin{array}{lll}2 & 0 & 0 \\ 0 & 2 & 0 \\ 0 & 3 & 1\end{array}\right] \boldsymbol{x}, \quad y=\left[\begin{array}{lll}1 & 1 & 1\end{array}\right] x$ ；
（3） $\dot{x}=\left[\begin{array}{cccc}-1 & 1 & & 0 \\ & -1 & & \\ & & -2 & 1 \\ 0 & & & -2\end{array}\right] x, \quad y=\left[\begin{array}{cccc}1 & 0 & 0 & 0 \\ 0 & 0 & -1 & 0\end{array}\right] x$ ；


<!-- source_pdf_page: 556 -->
（4）$\dot{x}=\left[\begin{array}{ccc}2 & 1 & 0 \\ 0 & 2 & 0 \\ 0 & 0 & -3\end{array}\right] \boldsymbol{x}, \quad y=\left[\begin{array}{lll}0 & 1 & 1\end{array}\right] x$ 。
9－23 试确定使下列系统可观测的 $a, b$ ：

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{ll}
a & 1 \\
0 & b
\end{array}\right] \boldsymbol{x}, \quad y=\left[\begin{array}{ll}
1 & -1
\end{array}\right] x
$$

9－24 已知系统各矩阵为

$$
\boldsymbol{A}=\left[\begin{array}{lll}
1 & 3 & 2 \\
0 & 4 & 2 \\
0 & 0 & 1
\end{array}\right], \quad \boldsymbol{B}=\left[\begin{array}{ll}
0 & 1 \\
0 & 0 \\
1 & 0
\end{array}\right], \quad \boldsymbol{C}=\left[\begin{array}{lll}
1 & 0 & 0 \\
0 & 0 & 1
\end{array}\right]
$$

试用传递矩阵判断系统可控性、可观测性。
9－25 将下列状态方程化为可控标准型：

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{cc}
1 & -2 \\
3 & 4
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{l}
1 \\
1
\end{array}\right] u
$$

9－26 已知系统传递函数为

$$
\frac{Y(s)}{U(s)}=\frac{s+1}{s^{2}+3 s+2}
$$

试写出系统可控不可观测、可观测不可控、不可控不可观测的动态方程。
9－27 已知系统各矩阵为

$$
\boldsymbol{A}=\left[\begin{array}{cccc}
1 & 0 & 0 & 0 \\
0 & 2 & 0 & 0 \\
-6 & -2 & 3 & 0 \\
3 & -2 & 0 & 4
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{l}
1 \\
0 \\
3 \\
2
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{llll}
-4 & -3 & 1 & 1
\end{array}\right]
$$

试求可控子系统与不可控子系统的动态方程。
9－28 系统各矩阵同习题 9－27，试求可观测子系统与不可观测子系统的动态方程。
9－29 设被控系统状态方程为

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{ccc}
0 & 1 & 0 \\
0 & -1 & 1 \\
0 & -1 & 10
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{c}
0 \\
0 \\
10
\end{array}\right] u
$$

可否用状态反馈任意配置闭环极点？求状态反馈阵，使闭环极点位于 $-10,-1 \pm \mathrm{j} \sqrt{3}$ ，并画出状态变量图。

9－30 设被控系统动态方程为

$$
\dot{x}=\left[\begin{array}{ll}
0 & 1 \\
0 & 0
\end{array}\right] x+\left[\begin{array}{l}
0 \\
1
\end{array}\right] u, \quad y=\left[\begin{array}{ll}
1 & 0
\end{array}\right] x
$$

试设计全维状态观测器，使闭环极点位于 $-r,-2 r(r>0)$ ，并画出状态变量图。
9－31 设系统传递函数为

$$
\frac{(s-1)(s+2)}{(s+1)(s-2)(s+3)}
$$

试问能否利用状态反馈将传递函数变成



<!-- source_pdf_page: 557 -->
$$
\frac{s-1}{(s+2)(s+3)}
$$

若有可能，求出一个满足要求的状态反馈阵 $\boldsymbol{K}$ ，并画出状态变量图。（提示：状态反馈不改变原传递函数零点）

9－32 试用李雅普诺夫第二法判断下列线性系统平衡状态的稳定性：

$$
\dot{x}_{1}=-x_{1}+x_{2}, \quad \dot{x}_{2}=2 x_{1}-3 x_{2}
$$

9－33 已知系统状态方程为

$$
\dot{\boldsymbol{x}}=\left[\begin{array}{ccc}
2 & \frac{1}{2} & -3 \\
0 & -1 & 0 \\
0 & \frac{1}{2} & -1
\end{array}\right] \boldsymbol{x}+\left[\begin{array}{ll}
1 & 0 \\
0 & 2 \\
1 & 0
\end{array}\right]\left[\begin{array}{l}
u_{1} \\
u_{2}
\end{array}\right]
$$

当 $\boldsymbol{Q}=\boldsymbol{I}$ 时， $\boldsymbol{P}=$ ？若选 $\boldsymbol{Q}$ 为正半定矩阵， $\boldsymbol{Q}=$ ？对应 $\boldsymbol{P}=$ ？判断系统稳定性。
9－34 设线性定常离散系统状态方程为

$$
\boldsymbol{x}(k+1)=\left[\begin{array}{ccc}
0 & 1 & 0 \\
0 & 0 & 1 \\
\frac{k}{2} & 0 & 0
\end{array}\right] \boldsymbol{x}(k), \quad k>0
$$

试求使系统渐近稳定的 $k$ 值范围。
9－35 设工业机器人如图9－47所示，其中两相伺服电机转动肘关节之后，通过小臂移动机器人的手腕。假定弹簧的弹性系数为 $k$ ，阻尼系数为 $f$ ，并选取系统的如下状态变量：

$$
x_{1}=\phi_{1}-\phi_{2}, \quad x_{2}=\frac{\omega_{1}}{\omega_{0}}, \quad x_{3}=\frac{\omega_{2}}{\omega_{0}}
$$

其中 $\omega_{0}^{2}=\frac{k\left(J_{1}+J_{2}\right)}{J_{1} J_{2}}$ 。试列写该机器人的状态方程。

![](assets/fig-09-47.png)

> Image description: This figure illustrates a simplified mechanical model of a robotic arm segment. An electric current i(t) drives a motor, which rotates the elbow joint (φ₁) with angular velocity ω₁. The elbow joint, modeled as inertia J₁, is connected via a torsional spring with stiffness k and damping f to the wrist joint (φ₂). The wrist, represented as inertia J₂, rotates with angular velocity ω₂. The system depicts torque transmission from motor to joint, with spring and damper elements modeling mechanical compliance. Arrows indicate rotational motion and direction of torque flow. This diagram captures key dynamics for robotic control, including inertia, spring, and damping effects in jointed robotic systems.
图9－47 工业机器人示意图

9－36 为了完成空间站装配、卫星捕获等空间操作，航天飞机的货舱内装备了一种可膨胀机械臂的遥操作系统，如图9－48（a）所示。柔性机械臂的模型如图9－48（b）所示，其中 $J$ 是驱动电机的转动惯量，$u$为电机驱动转矩，$\theta_{1}$ 和 $\theta_{2}$ 为柔性臂转角，$k$ 为柔性臂的弹性系数，$M$ 和 $I$ 分别为负载质量与转动惯量，$l$为机械臂在负载上的作用点到负载重心的距离。若选取状态变量为 $x_{1}=\theta_{1}, x_{2}=\dot{\theta}_{1}, x_{3}=\theta_{2}, x_{4}=\dot{\theta}_{2}$ ，试列写柔性机械臂系统的线性化状态方程。

9－37 设磁悬浮试验系统如图9－49所示。在该系统上方装有一个电磁铁，产生电磁吸力 $F$ ，以便将铁球悬浮于空中。系统的下方装有一个间隙测量传感器，以测量铁球的悬浮间隙。由于没有引人反馈，该磁悬浮试验系统不能稳定工作。



<!-- source_pdf_page: 558 -->
假定电磁铁电感为 $L=0.508 \mathrm{H}$ ，电阻为 $R=23.2 \Omega$ ，电流为 $i_{1}=I_{0}+i$ ，其中 $I_{0}=1.06 \mathrm{~A}$ 是系统的标称工作电流。再假定铁球的质量为 $m=1.75 \mathrm{~kg}$ ，铁球悬浮间隙 $\mu_{g}=X_{0}+x$ ，其中 $X_{0}=4.36 \mathrm{~mm}$ 为标称磁悬浮间隙。若电磁吸力满足如下条件：

$$
F=k\left(i / \mu_{g}\right)^{2}
$$

式中，$k=2.9 \times 10^{-4} \mathrm{~kg} \cdot \mathrm{~m}^{2} / \mathrm{A}^{2}$ 。选择 $x_{1}=x, x_{2}=\frac{\mathrm{d} x}{\mathrm{~d} t}, x_{3}=i$ 为状态变量，试利用 $F$ 的泰勒展开式，列写磁悬浮试验系统的线性化状态空间表达式。

![](assets/img-chapter-09-048.png)
（a）可膨胀机械臂遷操作

![](assets/fig-09-48.png)

> Image description: This textbook figure (Fig. 9-48) illustrates a flexible mechanical arm system. Part (a) shows a “flexible mechanical arm operation,” while part (b) labels it as a “flexible mechanical arm model.” A drive motor (J) with inertia J and input torque u generates motion. The arm, modeled with flexible joint stiffness k, transmits torque through two rotational angles: θ₂ at the motor end and θ₁ at the load end. The load (I, M) represents inertia and mass. The system demonstrates torque transmission through flexible links, with θ₁ and θ₂ indicating angular deflections. The diagram visually connects the motor to the load via a compliant joint, emphasizing dynamic behavior in flexible robotic systems. Variables like u, k, θ₁, θ₂, I, and M are labeled to denote key system parameters.
图9－48 遲操作系统示意图

![](assets/fig-09-49.png)

> Image description: This figure illustrates a magnetic levitation system. An electromagnet, supplied with voltage u and current i₁, generates an upward magnetic force F to counteract the downward gravitational force mg of a spherical iron ball (mass m). The ball is suspended with a variable gap x above a force sensor. The sensor measures the net force F, which balances mg. Arrows indicate direction: upward for F and downward for mg. The system demonstrates magnetic suspension, where the electromagnetic force adjusts to maintain equilibrium. The force sensor provides real-time feedback, enabling control. This setup is used to study dynamic stability and control in magnetic levitation systems, often in educational or experimental contexts. The diagram includes labeled components: electromagnet, iron ball, force sensor, and gravitational force.
图9－49 磁息滛系统示意图

9－38 在大功率高性能的摩托车中，常采用图9－50所示的弹簧－质量－阻尼器系统作为减震器。若已知减震器的基本参数取为质量 $m=1 \mathrm{~kg}$ ，摩擦系数 $f=9 \mathrm{~kg} \cdot \mathrm{~m} \cdot \mathrm{~s}$ ，弹簧系数 $k=20 \mathrm{~kg} / \mathrm{m}, u(t)$ 为力输入，$y(t)$为位移输出。要求完成：
（1）选择状态变量为 $x_{1}=y, y_{2}=\dot{y}$ ，列写系统的动态方程；
（2）计算系统的特征根及状态转移矩阵 $\phi(t)$ ；
（3）若初始条件 $y(0)=1, \dot{y}(0)=2$ ，在 $0 \leqslant t \leqslant 2$ 范围内，绘出系统零输入响应 $y(t)$ 及 $\dot{y}(t)$ ；
（4）重新设计 $f$ 和 $k$ 的合适值，使系统特征根为 $s_{1}=s_{2}=-10$ ，以减轻震动对车手的影响。

9－39 设汽车悬架控制系统如图9－51所示，其中 $X_{1}(s) 、 X_{2}(s)$和 $X_{3}(s)$ 为状态变量，$K_{1} 、 K_{2}$ 和 $K_{3}$ 为状态反馈系数，已知 $K_{1}=1$ 。试确定 $K_{2}$ 和 $K_{3}$ 的合适取值，使闭环系统的三个特征根位于 $s=-3$和 $s=-6$ 之间。另外，还要求确定前置增益 $K_{p}$ 值，使系统对阶跃

![](assets/fig-09-50.png)

> Image description: This textbook figure depicts a vehicle suspension system model. A mass 'm' is suspended by a spring with stiffness 'k' and is constrained between vertical walls. Friction coefficient 'f' is labeled on the left wall, indicating damping or frictional forces. The mass experiences two downward forces: 'y(t)' and 'u(t)', likely representing road input and control input respectively. The system is modeled as a mechanical dynamic system with spring and possibly damping elements. The figure is labeled as Figure 9-51, and the accompanying problem involves state feedback control with state variables X1(s), X2(s), X3(s) and feedback gains K1, K2, K3. Given K1=1, the task is to find K2 and K3 to place closed-loop poles between s=-3 and s=-6, and determine a proportional gain Kp for step response. The diagram visually represents the physical components of a suspension system for control analysis.
图9－50 弹簧－质量－阻尼器系统示意图

输入的稳态误差为零。

9－40 在图9－52（a）所示的新型游船上，采用了浮桥和稳定器来减少波浪对游船摇摆的影响，游船摇摆控制系统如图9－52（b）所示。图中，$X_{1} 、 X_{2}$ 和 $X_{3}$ 为状态变量，$K_{2}$ 和 $K_{3}$ 为状态反馈增益。试确定



<!-- source_pdf_page: 559 -->
$K_{2}$ 和 $K_{3}$ 的合适取值，使闭环特征根为 $s_{1,2}=-2 \pm \mathrm{j} 2, s_{3}=-15$ ，并画出系统在单位阶跃扰动作用下的响应曲线。

9－41 设内模控制系统如图9－53所示。试设计合适的内模控制器 $G_{c}(s)$ 和状态反馈增益向量 $k_{2}$ ，使系统闭环极点 $s_{1}=s_{2}=s_{3}=-2$ ，且对阶跃输入的稳态跟踪误差为零，最后绘出系统的单位阶跃响应曲线。

![](assets/fig-09-51.png)

> Image description: This figure depicts a feedback control system with an internal model structure. Input R(s) passes through proportional gain Kp, then a summing junction combines it with feedback signals. The system has three forward paths: one through transfer function 2/(s+4), another through K3, and a third through K2. A feedback loop includes K1 and K3, with outputs X3(s), X2(s), and X1(s)=Y(s). The system’s output Y(s) feeds back through K1, K2, and K3 to the summing junction. The goal is to design an internal model controller Gc(s) and state feedback gain k2 to place all closed-loop poles at s = -2, ensuring zero steady-state error for step inputs. The diagram shows interconnections and signal flows necessary for controller synthesis.
图9－51 汽车悬架控制系统结构图

![](assets/fig-09-51-2.png)

> Image description: The figure, labeled as Figure 9-51, presents a conceptual diagram of a cruise ship’s stabilization system, not an automotive suspension control system as the caption suggests. It displays two views: a side view (侧视图) and a front view (正视图) of a large cruise vessel. The front view highlights key components: “游客仓” (passenger cabin), “驾驶仓” (bridge), “支控浮桥” (support-controlled floating bridge), and “电子控制式稳定器” (electronic control stabilizer). The side view shows the ship’s structure with multiple decks and windows. The “电子控制式稳定器” is depicted as a mechanical unit attached to the hull, implying its function in maintaining ship stability through electronic control. The diagram lacks axes, variables, or arrows indicating motion or force direction, focusing instead on structural layout and component labeling for engineering understanding.
（a）游船

![](assets/fig-09-52.png)

> Image description: This figure illustrates a ship’s roll stabilization control system. The reference input R(s) = 0 indicates no desired roll command. Disturbance N(s) affects the system. The primary path includes blocks: 60/(s+8), 2/(s+2), and 1/s, representing plant dynamics and integrator. Feedback paths contain gains K₂ and K₃, with K₂ connected to the output Θ(s) and K₃ to the first plant block. Signal points X₁(s), X₂(s), and X₃(s) denote intermediate outputs. The system’s output is Θ(s), labeled “摇摆角” (roll angle). Arrows show signal flow, and summing junctions manage feedback and disturbance addition. This configuration aims to counteract roll motion using feedback control.
（b）控制系统结构图

图9－52 游船摇摇控制系统

![](assets/fig-09-53.png)

> Image description: This figure illustrates a ship roll stabilization control system. Input R(s) drives the system through a summing junction, generating error E(s). E(s) passes through controller Gc(s), then to actuator U(s). U(s) feeds into the plant G0(s) = 1/[(s+1)(s+2)], producing output Y(s). A feedback loop measures Y(s) and applies gain k2 to generate a signal x, which is subtracted from U(s) at a summing junction. The system’s dynamics are governed by the plant transfer function, and the controller Gc(s) adjusts the input to counteract roll motion. The diagram uses standard block diagram notation with arrows indicating signal flow, and labels denote key variables and components. This setup represents a classic negative feedback control architecture for marine stabilization.
图9－53 内模控制系统结构图



<!-- source_pdf_page: 560 -->
9－42 设单位斜坡内模控制系统如图9－54所示，其中被控对象

$$
G_{0}(s)=\frac{1}{(s+1)(s+2)}
$$

$x_{1}(t)$ 和 $x_{2}(t)$ 为状态变量。试设计合适的内模控制器

$$
G_{c}(s)=\frac{k_{1}+k_{2} s}{s^{2}}
$$

及状态反馈增益 $k_{3}$ 和 $k_{4}$ ，使系统的闭环极点为 $s_{1}=s_{2}=s_{3}=s_{4}=-2$ ，且系统对单位斜坡输入的稳态跟踪误差为零，最后绘出系统的单位斜坡响应曲线。

![](assets/fig-09-54.png)

> Image description: This figure illustrates a unit ramp internal model control system. Input r(t) generates error e(t), fed into controller Gc(s) containing gains k1, k2, and two integrators (1/s). The controller output u(t) drives plant blocks: first a 1/(s+1) stage yielding x2(t), then a 1/(s+2) stage yielding output y(t) = x1(t). Feedback paths include k3 and k4, with y(t) also feeding back through k3 to the summing junction. The system uses internal model principles to track ramp inputs, with k2 providing a direct feedback path to the controller. Arrows indicate signal flow, and dashed lines denote the controller boundary. This structure ensures asymptotic tracking of unit ramp inputs by matching the plant’s dynamics.
图9－54 单位斜坡内模控制系统结构图

9－43 已知被控对象的动态方程
其中

$$
\begin{aligned}
& \dot{x}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{b} u(t), \quad y(t)=\boldsymbol{c x}(t) \\
& \boldsymbol{A}=\left[\begin{array}{cc}
0 & 1 \\
-2 & -2
\end{array}\right], \quad \boldsymbol{b}=\left[\begin{array}{l}
1 \\
2
\end{array}\right], \quad \boldsymbol{c}=\left[\begin{array}{ll}
1 & 0
\end{array}\right]
\end{aligned}
$$

要求设计单位斜坡输人时的内模控制器，使系统闭环极点为 $s_{1,2}=-1 \pm \mathrm{j} 1, s_{3}=s_{4}=-10$ ，并给出单位斜坡内模控制系统结构图及跟踪误差 $e(t)$ 的响应曲线。

9－44 设带有扰动 $n(t)$ 的单输人－单输出系统的状态空间表达式为

$$
\dot{\boldsymbol{x}}(t)=\boldsymbol{A} \boldsymbol{x}(t)+\boldsymbol{b} u(t), \quad y(t)=\boldsymbol{c} \boldsymbol{x}(t)+n(t)
$$

式中，$x \in \mathbf{R}^{n}$ 为状态向量；$u$ 为标量输人；$y$ 为标量输出； $\boldsymbol{A} 、 \boldsymbol{b} 、 \boldsymbol{c}$ 维数适当。设参考输人 $r(t)=t$ ，扰动信号 $n(t)=1(t)$ ，为阶跃扰动。试论证可设计扰动内模控制器，使系统输出能以零稳态误差渐近跟踪斜坡输人 $t$ ，且不受阶跃扰动 $n(t)$ 的影响。

9－45 设有系统

$$
\dot{\boldsymbol{x}}(t)=\left[\begin{array}{cc}
0 & 1 \\
-2 & -2
\end{array}\right] \boldsymbol{x}(t)+\left[\begin{array}{l}
1 \\
2
\end{array}\right] u(t), \quad y(t)=\left[\begin{array}{ll}
1 & 0
\end{array}\right] \boldsymbol{x}(t)+n(t)
$$

式中，$n(t)=3 t^{2}$ 为输出端扰动信号。要求系统输出能以零稳态误差跟踪斜坡参考输人信号，并克服输出端加速度扰动对跟踪性能的影响。
