# Cpt8

- 来源文件：`Cpt8.tex`
- 课程标题：自动控制原理
- 副标题：第七章 非线性系统

## 非线性系统概述

### 非线性系统的普遍性

#### 幻灯片：非线性系统的普遍性

-  非线性是宇宙间的普遍规律，线性系统只是在特定条件下的近似描述。
		-  组成实际控制系统的元部件总存在一定程度的非线性。例如，晶体管放 大器有一个线性工作范围，超出这个范围，放大器就会出现饱和现象; 电动机输出轴上总是存在摩擦力矩和负载力矩，只有在输入超过启动电 压后，电动机才会转动，存在不灵敏区;而当输入达到饱和电压时，由 于电机磁性材料的非线性，输出转矩会出现饱和，因而限制了电机的最 大转速;各种传动机构由于机械加工和装配上的缺陷，在传动过程中总 存在着间隙;开关或继电器会导致信号的跳变等。

### 非线性系统的特殊性质

#### 幻灯片：非线性系统的特殊性质

非线性系统具有许多特殊的运动形式，与线性系统有着本质的区别。
	**1. 不满足叠加原理**
		在线性系统中，一般可采用传递函数、频率特性、根轨迹等概 念。非线性系统中，由于叠加原理不成立，不能应用上述方法
	**2.稳定性问题**
		线性系统的稳定性仅取决于系统自身的结构参数，与外作用的大小、形式 以及初始条件无关。线性系统若稳定，则无论受到多大的扰动，扰动消失 后一定会回到唯一的平衡点(原点)。
非线性系统的稳定性除了与系统自身的结构参数有关外，还与外作用以及 初始条件有关。

#### 幻灯片：非线性系统的特殊性质

非线性系统的平衡点可能不止一个，所以非线性系统的稳定 性只能针对确定的平衡点来讨论。一个非线性系统在某些平 衡点可能是稳定的，在另外一些平衡点却可能是不稳定的; 在小扰动时可能稳定，大扰动时却可能不稳定。

#### 幻灯片：非线性系统的特殊性质

**3.自持振荡问题**
			-  描述线性系统的微分方程可能有一个周期运动解，但这一周期 运动实际上不能稳定地持续下去。例如，二阶零阻尼系统的自由运 动解是等幅震荡 。一旦系统受到扰动，这种周期运动就会改变，是不稳定的。
			-  非线性系统，即使在没有输入作用的情况下，一定条件下，受初始扰动产生某一固定振幅和频率的振荡(一种稳定的周期运动)， 并且当受到扰动作用后，运动仍能保持原来的频率和振幅不变，亦即这种周期运动具有稳定性。非线性系统出现的这种稳定的周期运 动称为自持振荡，简称自振。
			-  自振是非线性系统特有的运动现象，是非线性控制理论研究的 重要问题之一，如电机自振振幅和频率过大，会造成机械摩擦和损坏。

#### 幻灯片：非线性系统的特殊性质

**4.对正弦输入信号的响应**
			-  线性系统的稳态正弦输出一定是与输入同频率的正弦信号，仅在幅值和相角上与输入不同。输入信号振幅的变化，仅使输出响应的振幅成比例变化，因此频率特性与输入信号幅值无关，而与频率有关。
			-  非线性系统的正弦响应比较复杂。其稳态输出的波形不仅与系统自身的结构参数有关，还与输入信号的幅值大小密切相关，而且其稳态输出除了包含与输入频率相同的信号外，还可能有与输入频率成整数倍的高次谐波分量。且输入幅值和频率的稍微变化导致系统改变状态，即跃变现象。还有组合振荡(混沌)现象。因此，频域分析法不再适合于非线性系统。

### 非线性系统与线性系统的比较

#### 幻灯片：非线性系统与线性系统的比较

tabularp0.18p0.35p0.35
		&线性系统&非线性系统
1数学模型&线性微分方程(迭加原理)&非线性微分方程(不能用迭加原理)
2稳定性&与系统结构参数有关&与系统结构参数、初始条件、外部输入有关
3运动状态&稳定或不稳定&稳定、 不稳定、自持振荡
4研究重点&稳定性、动态及 稳态性能&稳定性、自持振荡
5研究方法&传函、频率法等&相平面法、描述函数法、波波夫法，李亚普诺夫法、仿真实验等
6典型环节&比例、惯性、积分、微分、振荡等&饱和、死区、间隙、继电器等
	tabular

### 典型非线性特性

#### 幻灯片：饱和非线性

实际的运算放大器只能在一定的输入范围内保持输出量和输入量之间的线性关系。当输入量超出该范围时，其输出量则保持为一个常值(如三极管，学习效率等等)，如下图所示。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
		\path[arr] (-4,0) -- (-3,0) coordinate (c1) node[below left]  {$-C$} -- (0,0) node[below right] {0} -- (3,0) coordinate (c2) node[below]  {$C$} -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) -- (0,-3) coordinate (b1) node[below left] {$-B$} -- (0,3) coordinate (b2) node[left] {$B$} -- (0,4) node [above right] {$y$};
		\coordinate (a1) at (-3,-3){};
		\coordinate (a2) at (3,3){};
		\path[daline] (a1) -- (c1);
		\path[daline] (a1) -- (b1);
		\path[daline] (a2) -- (c2);
		\path[daline] (a2) -- (b2);
		\path[line,red] (-4,-3) -- (a1) -- (a2) -- (4,3);
	\end{tikzpicture}
```

#### 幻灯片：死区特性

一般的测量元件、执行机构都具有不灵敏区特性(水 表，电表，肌肉电特性等等)。只有在输入信号大到 一定程度以后才会有输出。这种只有当输入量超过一 定值后才有输出的特性称为死区特性，如下图所示。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
		\path[arr] (-4,0) -- (-2,0) coordinate (c1) node[below]  {$-C$} -- (0,0) node[below right] {0} -- (2,0) coordinate (c2) node[below]  {$C$} -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) -- (0,4) node [above right] {$y$};
		\path[line,draw=red] (-4,-3) -- node [right] {$k$}(c1) -- (c2) -- node [left] {$k$} (4,3);
	\end{tikzpicture}
```

#### 幻灯片：具有不灵敏区的饱和特性

在很多情况下，系统的元件同时存在死区特性和饱和限 幅特性。譬如，测量元件的最大测量范围与最小测量范 围都是有限的。具有不灵敏区的饱和特性如下图所示。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.5em,y=1.5em]
		\path[arr] (-4,0) -- (-3,0) coordinate (nc1) node [above] {$-nc$} -- (-2,0) coordinate (c1) node[above] {$-C$} -- (0,0) node[below right] {0} -- (2,0) coordinate (c2) node[below]  {$C$} -- (3,0) coordinate (nc2) node [below] {$nc$} -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) -- (0,-3) coordinate (b1) node[below left] {$-B$} -- (0,3) coordinate (b2) node[left] {$B$} -- (0,4) node [at end, right] {$y$};
		\coordinate (a1) at (-3,-3){};
		\coordinate (a2) at (3,3){};
		\path[daline] (a1) -- (nc1);
		\path[daline] (a1) -- (b1);
		\path[daline] (a2) -- (nc2);
		\path[daline] (a2) -- (b2);
		\path[line,red] (-4,-3) -- (a1) -- (c1) -- (c2) -- (a2) -- (4,3);
	\end{tikzpicture}
```

#### 幻灯片：继电特性

继电器的特性是指输入和输出之间的关系不完全是单值 的，继电器的吸合电流大于释放电流，因此，具有一个 滞环，称为具有滞环的三位置继电特性，如下图所示。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.5em,y=1.5em]
		\coordinate (a) at (-3,-3);
		\coordinate (b) at (-1,-3);
		\coordinate (c) at (-3,0);
		\coordinate (d) at (-1,0);
		\coordinate (e) at (1,0);
		\coordinate (f) at (3,0);
		\coordinate (g) at (1,3);
		\coordinate (h) at (3,3);
		\path[arr] (-4,0) -- (c) node [above] {$-C$} -- (d) node[above] {$-mc$} -- (0,0) node[below right] {0} -- (e) node[below]  {$mc$} -- (f) node [below] {$C$} -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) -- (0,-3) coordinate (b1) node[below left] {$-B$} -- (0,3) coordinate (b2) node[left] {$B$} -- (0,4) node [at end, right] {$y$};		
		\path[daline] (b) -- (b1);
		\path[daline] (g) -- (b2);
		\path[line,red] (a) -- (b) -- node [fill, dart, shape border rotate=90, inner sep=1pt] {} (d) -- (f) -- node [fill, dart, shape border rotate=90, inner sep=1pt] {} (h) -- (4,3);
		\path[line,red] (h) -- (g) -- node [fill, dart, shape border rotate=270, inner sep=1pt] {} (e) -- (c) -- node [fill, dart, shape border rotate=270, inner sep=1pt] {} (a) -- (-4,-3);
	\end{tikzpicture}
```

#### 幻灯片：继电特性

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
		\begin{scope}[xshift=0em]
		\coordinate (a) at (-3,-3);
		\coordinate (b) at (0,-3);
		\coordinate (c) at (0,3);
		\coordinate (d) at (3,3);
		\path[arr] (-4,0) -- (0,0) -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) node [below] {理想继电器}-- (0,4) node [at end, right] {$y$};		
		\path[line,draw=red] (a) -- (b) node [right] {$-M$} -- (c) node [left] {$M$}-- (d);
		\end{scope}
		
		\begin{scope}[xshift=10em]
		\coordinate (a) at (-3,-3);
		\coordinate (b) at (-1,-3);
		\coordinate (c) at (-1,0);
		\coordinate (d) at (1,0);
		\coordinate (e) at (1,3);
		\coordinate (f) at (3,3);
		\path[arr] (-4,0) -- (0,0) -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) node [below] {死区继电器}-- (0,4) node [at end, right] {$y$};		
		\path[line,draw=red] (a) -- (b) -- (c) -- (d) -- (e) -- (f);
		\path[daline] (b) -- ++(1,0) node [right] {$-M$};
		\path[daline] (e) -- ++(-1,0) node [left] {$M$};
		\end{scope}
		
		\begin{scope}[xshift=20em]
		\coordinate (a) at (-3,-3);
		\coordinate (b) at (-1,-3);
		\coordinate (c) at (1,-3);
		\coordinate (d) at (3,3);
		\coordinate (e) at (1,3);
		\coordinate (f) at (-1,3);
		\path[arr] (-4,0) -- (0,0) -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) node [below] {纯滞环继电器}-- (0,4) node [at end, right] {$y$};		
		\path[line,draw=red] (a) -- (c) -- (e);
		\path[line,draw=red] (d) -- (f) -- (b);
		\end{scope}
	\end{tikzpicture}
```

#### 幻灯片：间隙特性

间隙特性的特点是:当输入量的变化方向改变时，输出量保持不变，一直到输入量的变化超出一定数值(间隙)后，输出量才跟着变化(如齿轮，磁带等等)，如下图所示。
	齿轮不能精确地啮合，当主动齿轮改变方向后，只有消除齿轮间隙时负载齿轮才开始运动。 间隙宽度$2C$，相当于延时环节。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.2em,y=1.2em]
		\coordinate (a) at (-2,0);
		\coordinate (b) at (2,0);
		\coordinate (c) at (-3,-3);
		\coordinate (d) at (-1,-3);
		\coordinate (e) at (3,3);
		\coordinate (f) at (1,3);
		\path[arr] (-4,0) -- (a) node [above] {$-C$} -- (0,0) node[below right] {0} -- (b) node [below] {$C$} -- (4,0) node [below right] {$x$};
		\path[arr] (0,-4) -- (0,-3) coordinate (b1) node[right] {$-B$} -- (0,3) coordinate (b2) node[left] {$B$} -- (0,4) node [at end, right] {$y$};		
		\path[daline] (d) -- (b1);
		\path[daline] (f) -- (b2);
		\path[line,red] (c) -- node [fill, dart, shape border rotate=0, inner sep=1pt] {}(d) -- (e) -- node [fill, dart, shape border rotate=180, inner sep=1pt] {} (f) -- (c);
		\path[daline,green] (2,1.5) -- node [fill, dart, shape border rotate=180, inner sep=1pt] {} (0,1.5);
		\path[daline,green] (0,-1.5) -- node [fill, dart, shape border rotate=0, inner sep=1pt] {} (-2,-1.5);
	\end{tikzpicture}
```

### 非线性系统的分析方法

#### 幻灯片：非线性系统的分析方法

由于非线性系统的复杂性和特殊性，目前还没有形成用于研究非线性系统的通用方法。
	非线性程度不严重时，系统在某一平衡点附近运动时，可以考虑采用小偏差线性化方法。
	目前，工程上广泛应用的分析和设计非线性控制系统的方法是描述函数法和相平面分析法。
	**描述函数法**
		又称为谐波线性化法，是一种工程近似方法。用于研究一类非线性控 制系统的稳定性和自振问题，给出自振过程的基本特性(如振幅、频率)与系统参数(如放大系数、时间常数等)的关系，为系统的初步设计提供一个思考方向。相当于线性理论中频率法的推广，不受系统阶次的限制，且所得结果也比较符合实际，故得到了广泛应用。

#### 幻灯片：非线性系统的分析方法

**相平面分析法**
		适用于一、二阶非线性系统的分析，方法的重点是将二阶非线性微分方程变写为以输出量及输出量导数为变量的两个一阶微分方 程。然后依据这一对方程，设法求出其在上述两变量构成的相平面 中的轨线，并由此对系统的时间响应进行判别。
		随着计算机技术的发展，计算机仿真已成为研究非线性系统的重要手段。用计算机直接求解非线性微分方程，以数值解形式进行仿真研究，是分析、设计复杂非线性系统的有效方法。

## 描述函数法

### 描述函数法的基本概念

#### 幻灯片：描述函数法的基本概念

**基本思想**
		当系统满足一定的假设条件时，系统中 非线性环节在正弦信号作用下的输出可用一次谐波分量来近似，由此导出非线性环节的近似等效频率特性，即描述函数。是频域响应法延伸到非线性系统的近似。
	**描述函数的定义; (b) at (o.east) $N(A)$; (b.east) --+(2em,0) node[right,at end] $y(t)$;**
		针对任意非线性系统，设输入$x=A\sin\omega t$，输出非正弦周期信号为$y(t)$，则可以将$y(t)$展开为傅氏级数形式

**原始公式代码**

```tex
\begin{align*}
			y(t)	&= A_0 + \sum_{n=1}^\infty (A_n\cos n\omega t + B_n\sin n\omega t)\\
				&= A_0+\sum_{n=1}^\infty Y_n\sin(n\omega t+\phi_n)
		\end{align*}
```

#### 幻灯片：描述函数法的基本概念

**原始公式代码**

```tex
\begin{align*}
		y(t)	&= A_0 + \sum_{n=1}^\infty (A_n\cos n\omega t + B_n\sin n\omega t)\\
			&= A_0+\sum_{n=1}^\infty Y_n\sin(n\omega t+\phi_n)\\
		\text{where }A_o	&= \frac{1}{2\pi}\int_0^{2\pi}y(t)\dif\omega t\\
		A_n	&= \frac{1}{\pi}\int_0^{2\pi}y(t)\cos n\omega t\dif\omega t\\
		B_n	&= \frac{1}{\pi}\int_0^{2\pi}y(t)\sin n\omega t\dif\omega t\\
		Y_n	&= \sqrt{A_n^2+B_n^2}\\
		\phi_n&=\arctan\frac{A_n}{B_n}
	\end{align*}
```

#### 幻灯片：谐波线性化

以输出$y(t)$的基波分量近似地代替整个输出。亦即略去输出的高次谐波，将输出表示为
	where $Y_1=\sqrt{A_1^2+B_1^2}$，$\phi_1=\arctan\frac{A_1}{B_1}$
	这意味着一个非线性元件在正弦输入下，其输出也是 一个同频率的正弦量，只是振幅和相位发生了变化。 这与线性元件在正弦信号作用下的输出具有形式上的 相似性，故称上述近似处理为谐波线性化。

**原始公式代码**

```tex
$$y(t)=A_1\cos\omega t+B_1\sin\omega t=Y_1\sin(\omega t+\phi_1)$$
```

#### 幻灯片：描述函数法的定义

输入为正弦函数时，输出的基波分量与输入正弦量的复数比。其数学表达式为
	*这里的$y(t)$是以正弦$A\sin\omega t$为输入时的实际输出，因为非线性的关系，$y(t)$往往是分段函数。

**原始公式代码**

```tex
\begin{align*}
		N(A)	&= \frac{Y_1\sin(\omega t+\phi_1)}{A\sin\omega t}=\frac{Y_1}{A}\angle\phi_1=\frac{\sqrt{A_1^2+B_1^2}}{A}\angle\arctan\frac{A_1}{B_1}\\
		A_1	&= \frac{1}{\pi}\int_0^{2\pi}y(t)\cos\omega t\dif\omega t\\
		B_1	&= \frac{1}{\pi}\int_0^{2\pi}y(t)\sin\omega t\dif\omega t
	\end{align*}
```

#### 幻灯片：描述函数法的定义

非线性单值奇对称、$y(t)$奇函数时，$A_0=A_n=0$，$\phi_1=0$
	*$f(x)=-f(-x)$，奇对称和奇函数是一样的。非线性环节单值奇对称时，对正弦输入，其输出为与$\pi$奇对称的波形。因此，$y(t)\sin\omega t$总是为正的。而$y(t)\cos\omega t$则刚好正负相消，$A_1$为0.
		-  描述函数法主要用来分析在无外输入(自由系统)的 情况下，非线性系统的稳定性和自振荡问题。
		-  这种方法不受系统阶次的限制，对系统的初步分析和设计十分方便，获得了广泛应用。
		-  描述函数法是一种近似的分析方法，分析非线性系统时有如下限制条件:

**原始公式代码**

```tex
$$N(A)=\frac{B_1}{A}$$
```

#### 幻灯片：应用描述函数法分析非线性系统时的限制条件：

-  非线性系统的结构图可以简化成只有一个非线性环节和一个线性部分相串联的典型形式;
		-  非线性环节的输入输出特性是中心对称的，即$y(x)=-y(-x)$;
		-  最小相角系统，且系统的线性部分具有较好的低通滤波性能，即$|G(j\omega)|$ 高频时幅值迅速衰减，远远小于基波幅值，$n>m$。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=2em, y=1em]
			\path [arr] (0,0) -- node [above, red] {$r(t)=0$} ++(2,0) coordinate (t);
			\node [cross, anchor = west] (c) at (t) {};
			\path [arr] (c.east) -- node [above, red] {$e(t)$} ++(1,0) coordinate (t);
			\node [block] (b1) at (t) {非线性特性};
			\path [arr] (b1.east) -- node [above, red] {$x(t)$} ++(1,0) coordinate (t);
			\node [block] (b2) at (t) {$G(s)$};
			\path [arr] (b2.east) -- ++(.5,0) coordinate (t) -- node [above, red] {$c(t)$}++(.5,0);
			\path [arr] (t) -- ++(0,-2) -| node [right, at end] {$-$} (c.south);
		\end{tikzpicture}
```

## 典型非线性特性的描述函数

### 理想继电器特性及其输出波形

#### 幻灯片：理想继电器特性及其输出波形

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
			\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
			\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
			\path[line] (-6,-4) -- (0,-4) node [right] {$-M$} -- (0,4) node [left] {$M$} -- (6,4);
			\begin{scope}[xshift=8em]
				\path[arr] (-0.5,0) -- (0,0) node [at end, above left] {0} -- (3.14,0) node [at end, above right ] {$\pi$} -- (6.28,0) node [at end, above] {$2\pi$} -- (8,0) node [at end, below] {$\omega t$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line] (0,4) -| (pi,-4) node [at start, left] {$M$} -| (2*pi,0) ;
			\end{scope}
			\begin{scope}[yshift=-6em]
				\path[arr] (-6,0) -- (0,0) node [at end, above right] {0} -- (6,0) node [at end, below] {$e$};
				\path[arr] (0,1) -- (0,-3.14) node [at end, below right] {$\pi$} -- (0,-6.28) node [at end, right] {$2\pi$} -- (0,-8) node [very near end, right] {$\omega t$};
				\path[line, domain=0:2*pi, samples=100, rotate=-90] plot (\x, {5*sin(\x r)});
				\path[daline] (5,0) -- (5,-1.57) node [at start, above] {$A$};

			\end{scope}
			\begin{scope}[xshift=20em]
				\path[arr] (0,0)--(4,0) coordinate (o) node[at start, above]  {$x(t)=A\sin\omega t$}; 
				\node[block,anchor=west](b) at (o.east) {$N(A)$}; \path[arr] (b.east) --+(2em,0) node[near end, above] {$y(t)$};
				\node at (0,-10) {\begin{tabular}{c}
					$\displaystyle x(t)=A\sin\omega t$\\
					$\displaystyle y(t)=\begin{cases}+M&(0<\omega t\le \pi)\\ -M&(\pi\le\omega t\le 2\pi)\end{cases}$\\
					将$y(t)$傅氏展开得\end{tabular}
				};
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：理想继电器特性及其输出波形

特性单值奇对称、$y(t)$奇函数$\rightarrow A_0=A_n=0$，$N(A)=\frac{B_1}{A}$
	理想继电器特性的描述函数
	与输入幅值 $A$有关的实函数

**原始公式代码**

```tex
$$y(t)=A_0+\sum_{n=1}^\infty(A_n\cos n\omega t+B_n\sin n\omega t)$$
```

**原始公式代码**

```tex
$$N(A)=\frac{B_1}{A}=\frac{4M}{\pi A}$$
```

**原始公式代码**

```tex
\begin{align*}
		B_1	&= \frac{1}{\pi}\int_0^{2\pi}y(t)\sin\omega t\dif \omega t\\
			&= \frac{2}{\pi}\int_0^{\pi}y(t)\sin\omega t\dif\omega t\\
			&= -\frac{2M}{\pi}\cos\omega t|_0^\pi=\frac{4M}{\pi}
	\end{align*}
```

### 理想饱和特性

#### 幻灯片：理想饱和特性及其输出波形

10em

**原始公式代码**

```tex
$$x(t)=\begin{cases}
		kA\sin\omega t&0\le\omega t\le\alpha_1\\
		ka=b			&\alpha_1<\omega t<(\pi-\alpha_1)\\
		kA\sin\omega t&(\pi-\alpha_1)\le\omega t\le\pi
	\end{cases}$$
```

**原始公式代码**

```tex
$$A\sin\alpha_1=a\Rightarrow\alpha_1=\arcsin\frac{a}{A}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
			\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$e$};
			\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
			\path[line] (-6,-4) -- ++(right:2) coordinate (a1) -- (4,4) node [near end, left] {$k$} coordinate (a2) -- ++(right:2);
			\path[daline] (a1) -- (a1 |- 0,0) node [at end, above] {$-a$};
			\path[daline] (a2) -- (a2 |- 0,0) node [at end, above right] {$a$} -- ++(down:9.25);
			\path[daline] (a1) -- ++(right:18);
			\begin{scope}[xshift=8em]
				\path[arr] (-0.5,0) -- (0,0) node [at end, above left] {0} -- (3.14,0) node [at end, above right ] {$\pi$} -- (6.28,0) node [at end, above] {$2\pi$} -- (8,0) node [at end, below] {$\omega t$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
				\path[line, domain=0:2*pi, samples=100] plot (\x, {max(min(5*sin(\x r),4),-4)});
				\path[daline] (0.95,0) |- (-5,4) node [at start, below] {$\alpha_1$};
				\path[daline] (2.2,0) -- (2.2,4);
			\end{scope}
			\begin{scope}[yshift=-6em]
				\path[arr] (-6,0) -- (0,0) node [at end, above right] {0} -- (6,0) node [at end, below] {$e$};
				\path[arr] (0,1) -- (0,-3.14) node [at end, below right] {$\pi$} -- (0,-6.28) node [at end, right] {$2\pi$} -- (0,-8) node [very near end, right] {$\omega t$};
				\path[line, domain=0:2*pi, samples=100, rotate=-90] plot (\x, {5*sin(\x r)});
				\path[daline] (5,0) -- (5,-1.57) node [at start, above] {$A$};
				\path[daline] (0,-2.2) -- (4,-2.2) node [at start, left] {$\pi-\alpha_1$};
				\path[daline] (0,-0.95) -- (4,-0.95) node [at start, left] {$\alpha_1$};
			\end{scope}
			\begin{scope}[xshift=19em]
				\node[cross] (sum) {};
				\node[block, right=of sum] (T) {非线性特性};
				\node[block, right=of T] (G) {$G(s)$};
				\path[arr] ($(sum)-(3,0)$) -- (sum.west) node [midway, above] {$r(t)=0$};
				\path[arr] (sum) -- (T.west) node [midway, above] {$e(t)$};
				\path[arr] (T) -- (G.west) node[midway, above] {$x(t)$};
				\path[arr] (G.east) -- ++(right:1) coordinate (t) -- ++(right:1) node [midway, above] {$c(t)$};
				\path[arr] (t) -- ++(down:2) -| (sum.south) node [below right] {$-$};
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：理想饱和特性及其描述函数

理想饱和是单值奇对称，$y(t)$是半波奇对称（关于$\pi$），1/4波偶对称（关于$\pi/2$）
	理想饱和特性的描述函数

**原始公式代码**

```tex
$$N(A)=\frac{B_1}{A}=\frac{2k}{\pi}\left[\arcsin\frac{a}{A}+\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right],\quad (A\ge a)$$
```

**原始公式代码**

```tex
\begin{align*}
		B_1	&= \frac{1}{\pi}\int_{0}^{2\pi}x(t)\sin\omega t\dif(\omega t)=\frac{4}{\pi}\int_0^{\pi/2}x(t)\sin\omega t\dif(\omega t)\\
			&= \frac{4}{\pi}\left[\int_0^{\alpha_1}kA\sin\omega t\sin\omega t \dif(\omega t)+\int_{\alpha_1}^{\pi/2}ka\sin\omega t\dif(\omega t)\right]\\
			&= \frac{4kA}{\pi}\left\{\left[\frac{1}{2}\omega t-\frac{1}{2}\sin2\omega t\right]_0^{\alpha_1}+\frac{a}{A}\left[-\cos\omega t\right]_{\alpha_1}^{\pi/2}\right\}\\
			&= \frac{4kA}{\pi}\left(\frac{1}{2}\alpha_1-\frac{1}{4}\sin2\alpha_1+\frac{a}{A}\cos\alpha_1\right) = \frac{2kA}{\pi}\left(\arcsin\frac{a}{A}+\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right)
	\end{align*}
```

### 死区特性

#### 幻灯片：死区特性及其波形

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
			\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$e$};
			\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
			\path[line] (-6,-4) -- ++(3,4) node [at end, above] {$-a$} coordinate (a1) -- (3,0) node [at end, above left] {$a$} coordinate (a2) -- ++(3,4) node [near end, left] {$k$};
			\path[daline] (a2) -- ++(down:10);
			\begin{scope}[xshift=12em]
				\path[arr] (-0.5,0) -- (0,0) node [at end, above left] {0} -- (3.14,0) node [at end, above right ] {$\pi$} -- (6.28,0) node [at end, above] {$2\pi$} -- (8,0) node [at end, below] {$\omega t$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
				\path[line, domain=0:pi, samples=100] plot (\x, {max(5*sin(\x r)-2,0)});
				\path[line, domain=pi:2*pi, samples=100, xshift=pi] plot (\x, {min(5*sin(\x r)+2,0)});
				\path[daline] (0,3) -- (pi/2,3) node [at start, left] {$k(A-a)$};
				\node[below] at (0.7,0) {$\alpha_1$};
			\end{scope}
			\begin{scope}[yshift=-6em]
				\path[arr] (-6,0) -- (0,0) node [at end, above right] {0} -- (6,0) node [at end, below] {$e$};
				\path[arr] (0,1) -- (0,-3.14) node [at end, below right] {$\pi$} -- (0,-6.28) node [at end, right] {$2\pi$} -- (0,-8) node [very near end, right] {$\omega t$};
				\path[line, domain=0:2*pi, samples=100, rotate=-90] plot (\x, {5*sin(\x r)});
				\path[daline] (5,0) -- (5,-1.57) node [at start, above] {$A$};
				\path[daline] (0,-2.5) -- (3,-2.5) node [at start, left] {$\pi-\alpha_1$};
				\path[daline] (0,-0.7) -- (3,-0.7) node [at start, left] {$\alpha_1$};
			\end{scope}
			\node at (20,-10) {
				\begin{tabular}{c}
					$\displaystyle x(t)=
					\begin{cases}
						0				&0\le\omega t\le\alpha_1\\
						kA\sin(\omega t-a)	&\alpha_1<\omega t<(\pi-\alpha_1)\\
						0				&(\pi-\alpha_1)\le\omega t\le\pi
					\end{cases}$\\
					$\displaystyle A\sin\alpha_1=a\Rightarrow\alpha_1=\arcsin\frac{a}{A}$
				\end{tabular}
			};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：死区特性及其描述函数

理想死区特性是单值奇对称，$A_1=0$
	理想死区特性的描述函数

**原始公式代码**

```tex
$$N(A)=\frac{B_1}{A}=\frac{2k}{\pi}\left[\frac{\pi}{2}-\arcsin\frac{a}{A}-\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right],\quad (A\ge a)$$
```

**原始公式代码**

```tex
\begin{align*}
		B_1	&= \frac{1}{\pi}\int_{0}^{2\pi}x(t)\sin\omega t\dif(\omega t)=\frac{4}{\pi}\int_0^{\pi/2}x(t)\sin\omega t\dif(\omega t)\\
			&= \frac{4}{\pi}\left[\int_{\alpha_1}^{\pi/2}kA(\sin\omega t-a)\sin\omega t\dif(\omega t)\right]\\
			&= \frac{2kA}{\pi}\left(\frac{\pi}{2}-\arcsin\frac{a}{A}-\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right)
	\end{align*}
```

#### 幻灯片：死区特性饱和/继电特性

**死区饱和特性**
			**死区继电器特性**
				均为与输入幅值$A$有关的实函数

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
					\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$e$};
					\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
					\path[line] (-6,-4) -- ++(right:2) coordinate (s1) -- (-2,0) node [at end, above] {$-a$} -- (2,0) node [at end, below] {$a$} -- (4,4) node [near end, left] {$k$} coordinate (s2)-- ++(right:2);
					\path[daline] (s1) -- (s1 |- 0,0) node [at end, above] {$-s$};
					\path[daline] (s2) -- (s2 |- 0,0) node [at end, below] {$s$};
				\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
					\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$e$};
					\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
					\path[line] (-6,-4) -| (-2,0) node [at end, above] {$-a$} -- (2,0) node [at end, below] {$a$} |- (6,4);
					\path[daline] (0,4) -- (2,4) node [at start, left] {$M$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

**原始公式代码**

```tex
\begin{align*}
					N(A)	&= \frac{2k}{\pi}\left[\arcsin\frac{s}{A}-\arcsin\frac{a}{A}+\frac{s}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right.\\
						&- \left.\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right]\quad (A\ge s)
				\end{align*}
```

**原始公式代码**

```tex
\begin{align*}
					N(A)	&= \frac{4M}{\pi A}\sqrt{1-\left(\frac{a}{A}\right)^2}\quad (A\ge a)
				\end{align*}
```

### 间隙与滞环特性

#### 幻灯片：间隙与滞环特性

**非单值$A_1\neq 0$***
	非单值函数时，$A_1\neq0$，$N(A)$是复数，虚部不为0。
	*非单值时正穿越和负穿越时函数值不同，$A_1$的积分无法互相抵消。

**原始公式代码**

```tex
$$B_1=\frac{kA}{\pi}\left[\frac{\pi}{2}+\arcsin\left(1-\frac{2a}{A}\right)+2\left(1-\frac{2a}{A}\right)\sqrt{\frac{a}{A}-\left(\frac{a}{A}\right)^2}\right]$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
					\path[arr, name path=x axis] (-6,0) -- (0,0) node [at end, below left] {0} -- (4,0) node [at end, below] {$A$} -- (6,0) node [at end, below] {$e$};
					\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
					\path[line, name path=loop] (-4,-4) -- (2,4) -- ++(right:2) -- (-2,-4) node [near start, right] {$k$} -- cycle;
					\path[name intersections={of=x axis and loop, by={a1,a2}}] (a1) node [above left] {$-a$} (a2) node [below right] {$a$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

**原始公式代码**

```tex
\begin{align*}
					N(A)	&= \frac{\sqrt{A_1^2+B_1^2}}{a}\angle\arctan\frac{A_1}{B_1}\quad (A\ge a)\\
					A_1	&= \frac{4kA}{\pi}\left[\left(\frac{a}{A}\right)^2-\frac{a}{A}\right]
				\end{align*}
```

## 非线性系统的描述函数分析法

#### 幻灯片：非线性系统的描述函数分析法

**为何提出$N(X)$的概念**
		实际物理系统，严格地讲，都是程度不同地带有非线性因素，非线性系统的许多运动规律是线性系统领域看不 到的，如非线性自振。若一个实际系统(如火炮系统)发 生自振，当瞄准具对准一个目标，炮口由于自振而不停摆 动，是打不中目标的，另外对系统本身磨损也很厉害，所 以有必要把非线性系统的稳定性及自振问题专门拿出来研究。
		描述函数法是专门研究一类非线性系统稳定性及其自 振问题的方法。

### 基本假设

#### 幻灯片：基本假设

**使用描述函数法必须满足的假设**
			-  非线性系统的结构图可以简化成 只有一个非线性环节和一个线性部分相串联的典型形式;
			-  非线性环节的输入输出特性是中心对称的，即$y(x)=-y(-x)$保证非线性特性在正弦信号作用下的输出不包含常值分量;
			-  最小相角系统，且系统的线性部分具有较好的低通滤波性能，高次谐波分量将被大大削弱，因此闭环通道内近似只有基波信号流通。线性部分的阶次越高，低通滤波性能越好，用描述函数法所得结果的准确性也越高。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
			\node[cross] (sum) {};
			\node[block, right=of sum] (T) {$N$};
			\node[block, right=of T] (G) {$W$};
			\path[arr] ($(sum)-(3,0)$) -- (sum.west) node [midway, above] {$r(t)=0$};
			\path[arr] (sum) -- (T.west) node [midway, above] {$e(t)$};
			\path[arr] (T) -- (G.west) node[midway, above] {$x(t)$};
			\path[arr] (G.east) -- ++(right:1) coordinate (t) -- ++(right:1) node [midway, above] {$c(t)$};
			\path[arr] (t) -- ++(down:2) -| (sum.south) node [below right] {$-$};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

### 非线性系统的稳定性

#### 幻灯片：非线性系统的稳定性

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
			\node[cross] (sum) {};
			\node[block, right=of sum] (T) {$N(A)$};
			\node[block, right=of T] (G) {$G(s)$};
			\path[arr] ($(sum)-(3,0)$) -- (sum.west) node [midway, above] {$R(s)$};
			\path[arr] (sum) -- (T.west) node [midway, above] {$E(s)$};
			\path[arr] (T) -- (G.west);
			\path[arr] (G.east) -- ++(right:1) coordinate (t) -- ++(right:1) node [midway, above] {$C(s)$};
			\path[arr] (t) -- ++(down:2) -| (sum.south) node [below right] {$-$};
			\node at (25,0) {$\displaystyle\frac{C(s)}{R(s)}=\frac{G(s)N(A)}{1+G(s)N(A)}$};
			\node (f1) at (5,-4) {$D(s)=1+N(A)G(s)=0$};
			\node (f2) at (25,-4) {$\begin{array}{c}\text{线性系统}\\ 1+G(s)=0\\ G(s)=-1\end{array}$};
			\node[label=below:负倒描述函数(描述函数负倒特性)] (f3) at (5,-10) {$\displaystyle G(s)=-\frac{1}{N(A)}$};
			\node (f4) at (5,-15) {$\displaystyle -\frac{1}{N(A)}$};
			\node (f5) at (25,-15) {$(-1,\rj 0)$};
			\path[arr, latex-latex] (f1) -- (f2) node [midway, above] {$N(A)=1$};
			\path[arr] (f1) -- (f3);
			\path[arr, latex-latex] (f4) -- (f5) node [midway, below] {$-\frac{1}{N(A)}$为广义的$(-1,\rj 0)$} node [midway, above] {{\color{red}?}};
			\node[text width=10em] at (25,-10) {(\emph{奈奎斯特判据})\\ 最小相角系统闭环稳定的充要条件是$G(\j\omega)$轨迹不包围复平面的$(-1,\j 0)$。};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：非线性系统的稳定性

设线性部分$G(\rj\omega)$最小相角环节，$p=0$
	 $A = 0\rightarrow \infty$变化时， $\frac{-1}{N(A)}$描绘出一条曲线(不是定点)，将$G(\rj\omega)$和$\frac{-1}{N(A)}$画在同一个坐标系上。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.5em, y=1.5em]
	 		\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [below] {$\Re$};
			\path[arr] (0,-4) -- (0,2) node [right] {$\Im$};
			\path[line] (-5,-4) .. controls ++(60:3) and ++(-110:3) .. (-2,0) node [midway, left] {$\frac{-1}{N(A)}$};
			\path[arr,->] (-4.5,-4) -- ++(60:1) node [at start, below] {$A$} node [at end, above right] {$\infty$};
			\path[line, draw=red] (-3,-4) .. controls ++(75:3) and ++(115:2) .. (0,0) node [at start, below] {$G(\rj\omega)$};
			\path[arr,->] (-2.5,-3) -- ++(75:1) node [midway, right] {$\omega$};
			\node[anchor=west, text width=12em] at (-6,-7) {(1) $G(\rj\omega)$不包围负倒描述函数$\rightarrow$\alert{闭环系统稳定}};
			\begin{scope}[xshift=15em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [below] {$\Re$};
				\path[arr] (0,-4) -- (0,2) node [right] {$\Im$};
				\path[line] (-5,-4) .. controls ++(60:3) and ++(-110:3) .. (-2,0) node [midway, left] {$\frac{-1}{N(A)}$};
				\path[arr,->] (-4.5,-4) -- ++(60:1) node [at start, below] {$A$} node [at end, above right] {$\infty$};
				\path[line, draw=red] (-6,-4) .. controls ++(75:3) and ++(115:2) .. (0,0) node [at start, below] {$G(\rj\omega)$};
				\path[arr,->] (-6,-3) -- ++(75:1) node [midway, left] {$\omega$};
				\node[anchor=west, text width=12em] at (-6,-7) {(2) $G(\rj\omega)$包围负倒描述函数$\rightarrow$\alert{闭环系统不稳定}};
			\end{scope}
	 	\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
	 	
	 \end{figure}
```

#### 幻灯片：非线性系统的稳定性

(3) $G(\rj\omega)$与负倒描述函数相交
				-  闭环系统可能出现自持振荡(必要条件)
				-  稳定？不稳定？
				-  振幅($A$)？
				-  频率($\omega$)？$G(\rj\omega)$
	任意交点都是 $G(s) = - \frac{1}{N(A)}$的周期解，意味着控制系统内存在对应于该交点的振荡，稳定的振荡称为零输入造成的自振荡。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.5em, y=1.5em]
					\useasboundingbox (-6,-5) rectangle (2,2);
	 				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [below] {$\Re$};
					\path[arr] (0,-4) -- (0,2) node [right] {$\Im$};
					\path[line] (-5,-4) .. controls ++(60:3) and ++(-110:3) .. (-2,0) node [midway, left] {$\frac{-1}{N(A)}$};
					\path[arr,->] (-4.5,-4) -- ++(60:1) node [at start, below] {$A$} node [at end, above right] {$\infty$};
					\path[line, draw=red] (-2.5,-4) .. controls ++(100:3) and ++(135:4) .. (0,0) node [at start, below] {$G(\rj\omega)$};
					\path[arr,->] (-2,-4) -- ++(100:1) node [midway, right] {$\omega$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
	 			
			\end{figure}
```

### 自振分析（定性）

#### 幻灯片：自振分析（定性）

**微小扰动分析法**
					-  当微小扰动使振幅$A$减小到$c$点时， $c$点“$(-1,\rj0)$” 被$G(\rj\omega)$轨迹包围，
					-  系统不稳定，振幅$A$继续增大， 返回到$a$。
					-  当微小扰动使振幅$A$增大到$d$点， $d$点“$(-1,\rj0)$”未被$G(\rj\omega)$轨迹包围，
					-  系统稳定，振幅$A$继续减小， 返回到$a$。
					-  $\rightarrow a$为稳定自振点。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.3em, y=1.3em]
					\useasboundingbox (-15,-8) rectangle (1,4);
					\fill[blue!20, fill opacity=0.5]  (0,0) |- (-15,4) |- (-12,-8) .. controls ++(70:7) and ++(120:8) .. (0,0) -- cycle;
					\path[arr] (-15,0) -- (0,0) node [below left] {0} -- (1,0);
					\path[arr] (0,-8) -- (0,4);
					\draw[help lines] (-15,-8) grid (0,4);
					\path[save path=\pathA, name path=c1] (-12,-8) .. controls ++(70:7) and ++(120:8) .. (0,0) node [near start, left] {$G(\rj\omega)$};
					\draw[line] [use path=\pathA];
					\path[arr] (-12,-8) -- ++(70:2) node [below right] {$\omega\uparrow$};
					\path[line, draw=red, name path=c2] (-12,-6.6) .. controls ++(60:9) and ++(-1:20) .. (-15,-0.1);
					\path[name intersections={of=c1 and c2, by={a,b}}] 
						(a) node [sep, inner sep=2pt, label=below right:{$b(A_b,\omega_b)$}] {} 
						(b) node [zero, fill=red, label=above:$a$] {} 
						($(b)-(1,0)$) node [zero, label=$d$] {} 
						($(b)+(1,0)$) node [zero, label=$c$] {} 
						($(b)+(0,1)$) node [label={$(A_a,\omega_a)$}] {} 
						(-14,1) node {$A\uparrow$} (-14,-1) node {$\frac{-1}{N(A)}$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

#### 幻灯片：自振分析（定性）

**微小扰动分析法**
					-  当微小扰动使振幅$A$减小到$e$点时， $e$点“$(-1,\rj0)$” 未被$G(\rj\omega)$轨迹包围，
					-  系统稳定，振幅$A$减小， 不能返回到$b$。
					-  当微小扰动使振幅$A$增大到$f$点， $f$点“$(-1,\rj0)$”被$G(\rj\omega)$轨迹包围，
					-  系统不稳定，振幅$A$增大， 不能返回到$b$。
					-  $\rightarrow b$不是自振点*。
	*此时振幅将持续增大，直到到达a点，进入稳定自振。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.3em, y=1.3em]
					\useasboundingbox (-15,-8) rectangle (1,4);
					\fill[blue!20, fill opacity=0.5]  (0,0) |- (-15,4) |- (-12,-8) .. controls ++(70:7) and ++(120:8) .. (0,0) -- cycle;
					\path[arr] (-15,0) -- (0,0) node [below left] {0} -- (1,0);
					\path[arr] (0,-8) -- (0,4);
					\draw[help lines] (-15,-8) grid (0,4);
					\path[save path=\pathA, name path=c1] (-12,-8) .. controls ++(70:7) and ++(120:8) .. (0,0) node [near start, left] {$G(\rj\omega)$};
					\draw[line] [use path=\pathA];
					\path[arr] (-12,-8) -- ++(70:2) node [below right] {$\omega\uparrow$};
					\path[line, draw=red, name path=c2] (-12,-6.6) .. controls ++(60:9) and ++(-1:20) .. (-15,-0.1);
					\path[name intersections={of=c1 and c2, by={a,b}}] 
						(a) node [sep, inner sep=2pt, label=below right:{$b(A_b,\omega_b)$}] {}  
						($(a)+(-132:1)$) node [zero, label=left:$e$] {} 
						($(a)+(45:1)$) node [zero, label=right:$f$] {} 
						(b) node [zero, fill=red, label=above:$a$] {} 
						($(b)+(0,1)$) node [label={$(A_a,\omega_a)$}] {} 
						(-14,1) node {$A\uparrow$} (-14,-1) node {$\frac{-1}{N(A)}$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

#### 幻灯片：自振分析（定性）

**总结**
				$b$点的幅值$A_1$确定了一个边界，当初始 扰动令起始振幅$A< A_1$时，系统收敛；
				反之，当初始扰动令起始振幅$A> A_1$时，系统趋于发散或趋向于另一个幅值更大的自振运动。

**原始公式代码**

```tex
$$\frac{-1}{N(A)}\xrightarrow{A\uparrow}
				\begin{cases}
					\text{穿入}G(\rj\omega)		&\text{不是自振点}\\
					\text{穿出}G(\rj\omega)		&\text{是自振点}\\
					\text{相切于}G(\rj\omega)	&\text{\setlength{\tabcolsep}{0pt}\begin{tabular}{l}对应半稳定的\\ 周期运动\end{tabular}}
				\end{cases}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.3em, y=1.3em]
					\useasboundingbox (-15,-8) rectangle (1,4);
					\fill[blue!20, fill opacity=0.5]  (0,0) |- (-15,4) |- (-12,-8) .. controls ++(70:7) and ++(120:8) .. (0,0) -- cycle;
					\path[arr] (-15,0) -- (0,0) node [below left] {0} -- (1,0);
					\path[arr] (0,-8) -- (0,4);
					\draw[help lines] (-15,-8) grid (0,4);
					\path[save path=\pathA, name path=c1] (-12,-8) .. controls ++(70:7) and ++(120:8) .. (0,0) node [near start, left] {$G(\rj\omega)$};
					\draw[line] [use path=\pathA];
					\path[arr] (-12,-8) -- ++(70:2) node [below right] {$\omega\uparrow$};
					\path[line, draw=red, name path=c2] (-12,-6.6) .. controls ++(60:9) and ++(-1:20) .. (-15,-0.1);
					\path[name intersections={of=c1 and c2, by={a,b}}] 
						(a) node [sep, inner sep=2pt, label=below right:{$b(A_b,\omega_b)$}] {}  
						($(a)+(-132:1)$) node [zero] {} 
						($(a)+(45:1)$) node [zero] {} 
						(b) node [zero, fill=red, label=above:$a$] {} 
						($(b)-(1,0)$) node [zero] {} 
						($(b)+(1,0)$) node [zero] {} 
						($(b)+(0,1)$) node [label={$(A_a,\omega_a)$}] {} 
						(-14,1) node {$A\uparrow$} (-14,-1) node {$\frac{-1}{N(A)}$} 
						(-4,-3) node {不稳定区域} (-11,2) node {稳定区域};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

#### 幻灯片：$\frac{-1}{N(A)}$的绘制

**具有理想继电器特性的非线性系统**

**原始公式代码**

```tex
$$N(A)=\frac{4M}{\pi A}\quad(A\ge0)$$
```

**原始公式代码**

```tex
$$-\frac{1}{N_0(A)}=-\frac{\pi A}{4M}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
						\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
						\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
						\path[line] (-6,-4) -- (0,-4) node [right] {$-M$} -- (0,4) node [left] {$M$} -- (6,4);
					\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, decoration={markings, mark=at position .25 with {\arrow[blue, thick]{latex}}
			}]
			\path[arr] (-8,0) -- (0,0) node [below right] {0} --(4,0) node [below] {$\displaystyle \Re{\frac{-1}{N_0}}$};
			\path[arr] (0,-2) -- (0,2) node [right] {$\displaystyle \Im{\frac{-1}{N_0}}$};
			\path[line, -latex, very thick] (0,0) -- (-8,0) node [at start, below left] {$A=0$} node [midway, above] {$\leftarrow A$} node [at end, below] {$A\rightarrow+\infty$};
			\node[anchor=west] at (-8,-4) {$\displaystyle -\frac{1}{N(A)}$轨迹为整个负实轴};
			\begin{scope}[xshift=15em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (6,0);
				\path[arr] (0,-4) -- (0,4) node [right] {$\rj$};
				\path[arr, draw=red, very thick] (0,0) -- (-6,0) node [below] {$A\uparrow$};
				\path[line] [postaction={decorate}] (5,0) .. controls ++(-90:3) and ++(-120:3) .. (0,0) node [midway, below] {$G_1$};
				\path[line] [postaction={decorate}] (-2,-4) .. controls ++(80:2) and ++(-160:1) .. (0,0) node [near start, right] {$G_2$};
				\path[line] [postaction={decorate}] (-5,-4) .. controls ++(70:3) and ++(130:2) .. (0,0) node [near start, right] {$G_3$};
				\path[line] [postaction={decorate}] (-5,3) .. controls ++(0:3) and ++(110:2) .. (0,0) node [near start, below] {$G_4$};
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
					
				\end{figure}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：$\frac{-1}{N(A)}$的绘制

**具有饱和特性的非线性系统**
				$-\frac{1}{N(A)}$关于$A$递减，轨迹为实轴上$(-1/k,-\infty)$

**原始公式代码**

```tex
$$-\frac{1}{N(A)}=\frac{-\pi}{2k\left[\arcsin\frac{a}{A}+\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right]}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
						\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$e$};
						\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
						\path[line] (-6,-4) -- ++(right:2) coordinate (a1) -- (4,4) node [near end, left] {$k$} coordinate (a2) -- ++(right:2);
						\path[daline] (a1) -- (a1 |- 0,0) node [at end, above] {$-a$};
						\path[daline] (a2) -- (a2 |- 0,0) node [at end, above right] {$a$};
					\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, decoration={markings, mark=at position .25 with {\arrow[blue, thick]{latex}}
			}]
			\useasboundingbox (-10,-4) rectangle (20,4);
			\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [below] {$\Re$};
			\path[arr] (0,-4) -- (0,4) node [right] {$\Im$};
			\path[arr, draw=red, very thick, name path=c1] (-2,0) -- (-6,0) node [sep, label=above:{'-1'}] {} node [sep, at start, label=above:{$-1/k$}] {} -- (-10,0) node [below] {$\frac{-1}{N(A)}$} node [above] {$\infty\leftarrow A$};
			\path[line] [postaction={decorate}] (-3,-4) .. controls ++(70:2) and ++(150:2) .. (0,0) node [near start, right] {$G_1$};
			\path[line, name path=c2] [postaction={decorate}] (-7,-4) .. controls ++(70:3) and ++(120:6) .. (0,0) node [near start, right] {$G_2$};
			\path[name intersections={of=c1 and c2, by=b}] (b) node [sep, label=above:$b$] {};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
					
				\end{figure}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

**原始公式代码**

```tex
\begin{align*}
					A=a\text{时}\quad				&\frac{-1}{N(A)}=\frac{-1}{k}\\
					A\rightarrow\infty\text{时}\quad	&\frac{-1}{N(A)}\rightarrow-\infty
				\end{align*}
```

#### 幻灯片：$\frac{-1}{N(A)}$的绘制

**具有死区特性的非线性系统**
				$-\frac{1}{N(A)}$轨迹为实轴上$(-\infty,-1/k)$

**原始公式代码**

```tex
$$-\frac{1}{N(A)}=\frac{-\pi}{2k\left[\frac{\pi}{2}-\arcsin\frac{a}{A}-\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right]}\quad (A\ge a)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em]
						\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$e$};
						\path[arr] (0,-5) -- (0,5) node [at end, right] {$x$};
						\path[line] (-6,-4) -- ++(3,4) node [at end, above] {$-a$} coordinate (a1) -- (3,0) node [at end, above left] {$a$} coordinate (a2) -- ++(3,4) node [near end, left] {$k$};
					\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, decoration={markings, mark=at position .25 with {\arrow[blue, thick]{latex}}
			}]
			\useasboundingbox (-10,-4) rectangle (25,4);
			\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [below] {$\Re$};
			\path[arr] (0,-4) -- (0,4) node [right] {$\Im$};
			\path[arr, draw=red, very thick, latex-, name path=c1] (-2,0) -- (-6,0) node [sep, label=above:{'-1'}] {} node [sep, at start, label=above:{$-1/k$}] {} -- (-10,0) node [below] {$\frac{-1}{N(A)}$} node [above] {$A\rightarrow \infty$};
			\path[line] [postaction={decorate}] (-3,-4) .. controls ++(70:2) and ++(150:2) .. (0,0) node [near start, right] {$G_1$};
			\path[line, name path=c2] [postaction={decorate}] (-7,-4) .. controls ++(70:3) and ++(120:6) .. (0,0) node [near start, right] {$G_2$};
			\path[name intersections={of=c1 and c2, by=b}] (b) node [sep, label=above:$b$] {};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
					
				\end{figure}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

**原始公式代码**

```tex
\begin{align*}
					A=a\text{时}\quad				&\frac{-1}{N(A)}\rightarrow-\infty\\
					A\rightarrow\infty\text{时}\quad	&\frac{-1}{N(A)}=\frac{-1}{k}
				\end{align*}
```

#### 幻灯片：$\frac{-1}{N(A)}$的绘制

**具有间隙特性的非线性系统**
				$-\frac{1}{N(A)}$轨迹为$G$平面上一条曲线

**原始公式代码**

```tex
$$-\frac{1}{N(A)}= \frac{A}{\sqrt{A_1^2+B_1^2}}\angle\left(-180^\circ-\arctan\frac{A_1}{B_1}\right)\quad (A\ge a)$$
```

**原始公式代码**

```tex
$$A\rightarrow\infty\text{时}\quad	\frac{-1}{N(A)}=\frac{-1}{k}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em, decoration={markings, mark=at position .15 with {\arrow[blue, thick]{latex}}
						}]
						\path[arr, name path=x axis] (-6,0) -- (0,0) node [at end, below left] {0} -- (4,0) node [at end, below] {$x$};
						\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
						\path[line, name path=loop] (-4,-4) -- (2,4) -- ++(right:2) -- (-2,-4) node [near start, right] {$k$} -- cycle;
						\path[name intersections={of=x axis and loop, by={a1,a2}}] (a1) node [above left] {$-b$} (a2) node [below right] {$b$};
						\begin{scope}[xshift=5em, yshift=-7em, x=1em, y=1em]
							\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [below] {$\Re$};
							\path[arr] (0,-4) -- (0,4) node [right] {$\Im$};
							\path[arr, draw=red, very thick, name path=c1] (-9,-4) .. controls ++(60:4) and ++(-130:3) .. (-2,0) node [at start, below] {$\frac{-1}{N(A)}$} node [near end, sep, label=below:{'-1'}] {} node [sep, at end, label=above:{$-1/k$}] {};
							\path[arr, ->] (-10,-3) -- ++(60:1) node [at start, below] {$A$} node [at end, above right] {$\infty$};
							\path[line] [postaction={decorate}] (-3,-4) .. controls ++(70:2) and ++(150:2) .. (0,0) node [near start, right] {$G_1$};
							\path[line, name path=c2] [postaction={decorate}] (-7,-4) .. controls ++(70:3) and ++(120:6) .. (0,0) node [very near start, right] {$G_2$};
							\path[name intersections={of=c1 and c2, by=b}] (b) node [sep, label=above:$b$] {};
						\end{scope}
					\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
					
				\end{figure}
```

#### 幻灯片：$\frac{-1}{N(A)}$的绘制

**具有滞环继电器特性的非线性系统**
				负倒描述函数为第三象 限内平行于横轴的一组 直线。

**原始公式代码**

```tex
$$-\frac{1}{N(A)}= \frac{\pi A}{4M}\angle\left(-180^\circ-\arcsin\frac{h}{A}\right)\quad (A\ge h)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.8em, y=.8em, decoration={markings, mark=at position .15 with {\arrow[blue, thick]{latex}}
						}]
						\path[arr, name path=x axis] (-6,0) -- (0,0) node [at end, above right] {0} -- (4,0)  node [at end, below] {$e$};
						\path[arr, name path=y axis] (0,-5) -- (0,5) node [at end, right] {$x$};
						\path[line, name path=loop] (-2,-4) rectangle (2,4);
						\path[name intersections={of=x axis and loop, by={a1,a2}}] (a1) node [below left] {$-h$} (a2) node [below right] {$h$};
						\path[name intersections={of=y axis and loop, by={m1,m2}}] (m1) node [above left] {$M$};
						\begin{scope}[xshift=5em, yshift=-5em, x=1em, y=1em]
							\path[arr] (-10,0) -- (0,0) node [below right] {0} -- (2,0) node [below] {$\Re$};
							\path[arr] (0,-5) -- (0,2) node [right] {$\Im$};
							\path[arr, draw=red, very thick, name path=c1] (0,-2) -- (-10,-2) node [at end, above] {$\frac{-1}{N_1(A)}$} node [at start, right] {$A=h_1$} node [midway, above] {$\leftarrow A$};
							\path[arr, draw=red, very thick, name path=c3] (0,-4) -- (-10,-4) node [at end, above] {$\frac{-1}{N_2(A)}$} node [at start, right] {$A=h_2$} node [near start, below] {$\leftarrow A$};
							\path[line, name path=c2] [postaction={decorate}] (-6,-6) .. controls ++(70:3) and ++(120:2) .. (0,0) node [at start, left] {$G(\rj\omega)$};
							\path[name intersections={of=c1 and c2, by=b}] (b) node [sep, label=above:$b$] {} (b) node [xshift=-0.4em, below left] {$A=2h_1$};
							\path[name intersections={of=c3 and c2, by=c}] (c) node [sep, label=below:$c$] {} (c) node [xshift=-0.4em, below left] {$A=2h_2$};
							\path[daline] (0,0) -- (b) -- ([turn]0:5);
						\end{scope}
					\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
					
				\end{figure}
```

#### 幻灯片：常见非线性特性描述函数及负倒描述函数

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.4em, y=.35em]
				\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line] (-6,-4) -- ++(right:2) coordinate (a1) -- (4,4) node [near end, left] {$k$} coordinate (a2) -- ++(right:2);
				\path[daline] (a1) -- (a1 |- 0,0) node [at end, above] {$-a$};
				\path[daline] (a2) -- (a2 |- 0,0) node [at end, above right] {$a$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-3) -- (0,4) node [below right] {$\Im$};
				\path[arr, draw=red, very thick, name path=c1] (-3,0) -- (-6,0) node [sep, at start, label=above:{$-\frac{1}{k}$}] {} node [at start, below] {$A=a$}-- (-10,0) node [below] {$\infty\leftarrow A$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.4em, y=.35em]
				\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line] (-6,-4) -- ++(3,4) node [at end, above] {$-a$} coordinate (a1) -- (3,0) node [at end, above left] {$a$} coordinate (a2) -- ++(3,4) node [near end, left] {$k$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-3) -- (0,4) node [below right] {$\Im$};
				\path[arr, draw=red, very thick, latex-] (-3,0) -- (-6,0) node [sep, at start, label=above:{$-\frac{1}{k}$}] {} node [at start, below] {$A\rightarrow\infty$}-- (-10,0) node [below] {$A=a$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.4em, y=.35em]
				\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line] (-6,-4) -- (0,-4) node [right] {$-M$} -- (0,4) node [left] {$M$} -- (6,4);
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-3) -- (0,4) node [below right] {$\Im$};
				\path[arr, draw=red, very thick] (0,0) -- (-6,0) node [sep, at start, label=above left:{$-\frac{1}{k}$}] {} node [at start, below left] {$A=0$}-- (-10,0) node [below] {$A\rightarrow\infty$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.4em, y=.35em]
				\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line] (-6,-4) -| (-3,0) node [at end, above] {$-a$} -- (3,0) node [at end, below] {$a$} |- (6,4);
				\path[daline] (0,4) -- (3,4) node [at start, left] {$M$};
				\path[daline] (0,-4) -- (-3,-4) node [at start, right] {$-M$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-3) -- (0,4) node [below right] {$\Im$};
				\path[arr, draw=red, very thick] (-10,0.3) -| (-2,0) node [sep, at end, label=above left:{$-\frac{\pi a}{2M}$}] {} node [at start, above] {$A=a$} |- (-10,-0.3) node [below] {$A\rightarrow\infty$};
			\end{tikzpicture}
```

**原始表格代码**

```tex
\begin{table}\setlength{\tabcolsep}{5pt}\renewcommand\arraystretch{0.1}
		\begin{tabular}{m{.06\textwidth}<{\centering}m{.15\textwidth}<{\centering}m{.35\textwidth}<{\centering}m{.35\textwidth}<{\centering}}\toprule
			类型&非线性特性&描述函数$N(A)$&负倒描述函数曲线$-1/N(A)$\\\midrule
			饱和特性&
			&
			$\begin{array}{c}\frac{2k}{\pi}\left[\arcsin\frac{a}{A}+\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right]\\(A\ge a)\end{array}$&
			\\
			死区特性&
			&
			$\begin{array}{c}\frac{2k}{\pi}\left[\frac{\pi}{2}-\arcsin\frac{a}{A}-\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right]\\(A\ge a)\end{array}$&
			\\
			理想继电特性&
			&
			$\frac{4M}{\pi A}$&
			\\
			死区继电特性&
			&
			$\begin{array}{c}\frac{4M}{\pi A}\sqrt{1-\left(\frac{a}{A}\right)^2}\\ (A\ge a)\end{array}$&
			\\\bottomrule
		\end{tabular}
	\end{table}
```

#### 幻灯片：常见非线性特性描述函数及负倒描述函数

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.4em, y=.35em]
				\path[arr, name path=x axis] (-6,0) -- (0,0) node [at end, above right] {0} -- (6,0)  node [at end, below] {$x$};
				\path[arr, name path=y axis] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line, name path=lower] (-4,-4) -| (2,4);
				\path[line, name path=upper] (-2,-4) |- (4,4);
				\path[name intersections={of=x axis and upper, by={h1}}] (h1) node [below left] {$-h$}; 
				\path[name intersections={of=y axis and upper, by={m1}}](m1) node [above left] {$M$};
				\path[name intersections={of=x axis and lower, by={h2}}] (h2) node [below right] {$h$};
				\path[name intersections={of=y axis and lower, by={m2}}](m2) node [below right] {$-M$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-4) -- (0,3) node [below right] {$\Im$};
				\path[arr, draw=red, very thick] (0,-3) -- (-10,-3) node [sep, at start, label=above left:{$A=h$}] {} node [at start, right] {$-\rj\frac{\pi h}{4M}$} node [at end, below] {$A\rightarrow\infty$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.5em, y=.45em]
				\path[arr] (-6,0) -- (0,0) node [at end, below left] {0} -- (6,0) node [at end, below] {$x$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line] (-6,-4) -- (-4,-4) rectangle (-2,0);
				\path[line] (6,4) -- (4,4) rectangle (2,0) node [below] {$mh$};
				\node[below] at (4,0) {$h$};
				\path[daline] (-2,-4) -- (0,-4) node [right] {$-M$};
				\path[daline] (2,4) -- (0,4) node [left] {$M$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-4) -- (0,4) node [below right] {$\Im$};
				\path[arr, draw=red, very thick] (0,-3.5) -- (-10,-3.5) node [below] {$m=-1$} node [at start, right] {$-\rj\frac{\pi h}{4M}$};
				\path[arr, draw=red, very thick] (-1,-3.5) .. controls ++(90:1.3) and ++(0:8) .. (-10,-2.5) node [left, yshift=-0.3em] {$-0.5$};
				\path[arr, draw=red, very thick] (-2,-3.5) .. controls ++(60:3.3) and ++(0:8) .. (-10,-1.5) node [left] {$0$};
				\path[arr, draw=red, very thick] (-3,-3.5) .. controls ++(60:4.5) and ++(0:8) .. (-10,-0.5) node [left, yshift=0.3em] {$0.5$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.4em, y=.35em]
				\path[arr, name path=x axis] (-6,0) -- (0,0) node [at end, below left] {0} -- (4,0) node [at end, below] {$x$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line, name path=loop] (-4,-4) -- (2,4) -- ++(right:2) -- (-2,-4) node [near start, right] {$k$} -- cycle;
				\path[name intersections={of=x axis and loop, by={a1,a2}}] (a1) node [above left] {$-b$} (a2) node [below right] {$b$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-4) -- (0,3) node [right] {$\Im$};
				\path[arr, draw=red, very thick, name path=c1] (-6,-4) .. controls ++(60:4) and ++(-130:3) .. (-2,0) node [at start, right] {$A=b$} node [near end, left] {$A\rightarrow\infty$} node [at end, above] {$-\frac{1}{k}$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=.4em, y=.35em]
				\path[arr] (-6,0) -- (0,0) node [at end, below left] {0} -- (6,0) node [at end, below] {$x$};
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
				\path[line] (-6,-4) -- ++(right:1) coordinate (a1) -- (-2,0) node [above] {$-\Delta$} coordinate (d1) -- (2,0) node [below] {$\Delta$} -- (5,4)  node [midway, left] {$k$} coordinate (a2) -- ++(right:1);
				\path[dline] (a1) -- (a1 |- 0,0) node [at end, above] {$-a$};
				\path[dline] (a2) -- (a2 |- 0,0) node [at end, below] {$a$};
			\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.6em, y=0.5em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (2,0) node [right] {$\Re$};
				\path[arr] (0,-3) -- (0,4) node [below right] {$\Im$};
				\path[arr, draw=red, very thick] (-10,-0.3) -| (-6,0.3) -- (-10,0.3);
				\path[arr, draw=red, very thick] (-10,-0.8) -| (-4,0.8) -- (-10,0.8);
				\path[arr, draw=red, very thick] (-10,-1.3) -| (-2,1.3) -- (-10,1.3);
				\path (-10,-2.5) node (a1) {$n=2$} (-7,-2.5) node (a2) {$3$} (-5,-2.5) node (a3) {$5$};
				\path[draw] (-7,-0.3) -- (a1);
				\path[draw] (-4,-0.8) -- (a2);
				\path[draw] (-2,-1.3) -- (a3);
			\end{tikzpicture}
```

**原始表格代码**

```tex
\begin{table}\setlength{\tabcolsep}{5pt}\renewcommand\arraystretch{-0.9}
		\begin{tabular}{m{.08\textwidth}<{\centering\vs{-0.2em}}m{.15\textwidth}<{\centering\vs{-0.2em}}m{.38\textwidth}<{\centering\vs{-0.2em}}m{.3\textwidth}<{\centering\vs{-0.2em}}}\toprule
			类型&非线性特性&描述函数$N(A)$&$-1/N(A)$\\\midrule
			滞环继电特性&
			&
			$\begin{array}{c}\frac{4M}{\pi A}\sqrt{1-\left(\frac{h}{A}\right)^2}-\rj\frac{4Mh}{\pi A^2}\\(A\ge h)\end{array}$&
			\\
			死区加滞环继电特性&
			&
			$\small\begin{array}{c}\frac{2M}{\pi A}\left[\sqrt{1-\frac{(mh)^2}{A}+\sqrt{1-\left(\frac{h}{A}\right)^2}}\right]\\+\rj\frac{2Mh}{\pi A^2}(m-1)\quad(A\ge a)\end{array}$&
			\\
			间隙特性&
			&
			$\footnotesize\begin{array}{c}\frac{k}{\pi}\left[\frac{\pi}{2}+\arcsin\left(1-\frac{2b}{A}\right)+2\left(1-\frac{2b}{A}\right)\right.\\\left.\sqrt{\frac{b}{A}\left(1-\frac{b}{A}\right)}\right]+\rj\frac{4kb}{\pi A}\left(\frac{b}{A}-1\right)\quad(A\ge b)\end{array}$&
			\\
			死区加饱和特性&
			&
			$\footnotesize\begin{array}{c}\frac{2k}{\pi}\left[\arcsin\frac{a}{A}-\arcsin\frac{\Delta}{A}+\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right.\\\left.-\frac{\Delta}{A}\sqrt{1-\left(\frac{\Delta}{A}\right)^2}\right]\quad(A\ge b)\end{array}$&
			\\\bottomrule
		\end{tabular}
	\end{table}
```

### 自振分析（定量）

#### 幻灯片：自振分析（定量）

自振必要条件：$N(A)G(\rj\omega)=-1$
			分析系统的稳定性($M=1$)，求自振参数。
			 作图分析，系统一定自振。由自振条件得：
			比较实部与虚部得：

**原始公式代码**

```tex
$$\begin{cases}\frac{40}{\pi A}=3\omega^2\\\omega(2-\omega^2)=0\end{cases}\quad\begin{cases}\omega=\sqrt{2}\\ A=\frac{40}{6\pi}=2.122\end{cases}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
					\tikzset{relay/.pic = {
						\begin{scope}[x=.3em, y=.35em]
						\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
						\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
						\path[line] (-6,-4) -- (0,-4) node [right] {$-M$} -- (0,4) node [left] {$M=1$} -- (6,4);
						\path[draw, blue, thick] (-10,-5.5) rectangle (7,6);
						\path (-10,0) coordinate (west);
						\path (7,0) coordinate (east);
						\end{scope}
						}
					}
					\node[cross] (sum) {};
					\path (5.5,0) pic {relay};
					\node[block] (G) at (10,0) {$\frac{10}{s(s+1)(s+2)}$};
					\path[arr] ($(sum)-(3,0)$) -- (sum.west) node [midway, above] {$r(t)=0$};
					\path[arr] (sum) -- (west) node [midway, above] {$e(t)$};
					\path[arr] (east) -- (G.west) node[midway, above] {$x(t)$};
					\path[arr] (G.east) -- ++(right:1) coordinate (t) -- ++(right:1) node [midway, above] {$c(t)$};
					\path[arr] (t) -- ++(down:3) -| (sum.south) node [below right] {$-$};
				\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
						\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (6,0);
						\path[arr] (0,-4) -- (0,4) node [right] {$\rj$};
						\path[arr, draw=red, very thick, name path=n] (0,0) -- (-6,0) node [below] {$A\uparrow$};
						\path[line, name path=g] [postaction={decorate}] (-5,-4) .. controls ++(70:3) and ++(130:2) .. (0,0) node [near start, right] {$\omega\uparrow$};
						\path[name intersections={of=g and n, by={c1,c2}}] (c2) node[sep, label=above:{$(A,\omega)$}] {}; 
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

**原始公式代码**

```tex
\begin{align*}
				&\frac{4}{\pi A}\frac{10}{\rj\omega(1+\rj\omega)(2+\rj\omega)}=-1\\
				&\frac{40}{\pi A}=-\rj\omega(1+\rj\omega)(2+\rj\omega)=3\omega^2-\rj\omega(2-\omega^2)
			\end{align*}
```

#### 幻灯片：自振分析（定量）

分析图示系统的稳定性
	 作图分析，饱和特性的描述函数为
	$-\frac{1}{N(A)}$轨迹为实轴上$(-1/k,-\infty)$，$K>7.5$时有一个交点，且系统自振。

**原始公式代码**

```tex
$$N(A)=\frac{2k}{\pi}\left[\arcsin\frac{a}{A}+\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right]$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, decoration={markings, mark=at position .15 with {\arrow[blue, thick]{latex}}
			}]
			\tikzset{relay/.pic = {
				\begin{scope}[x=.3em, y=.35em]
					\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (6,0) node [at end, below] {$x$};
					\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
					\path[line] (-6,-4) -- ++(right:2) -- (4,4)  -- ++(right:2);
					\path[daline] (0,4) -| (4,0) node [at start, left] {2} node [at end, below] {1};
					\path[draw, blue, thick] (-8,-5.5) rectangle (8,6);
					\path (-8,0) coordinate (west);
					\path (8,0) coordinate (east);
				\end{scope}
				}
			}
			\node[cross] (sum) {};
			\path (5.5,0) pic {relay};
			\node[block] (G) at (10,0) {$\frac{K}{s(0.1s+1)(0.2s+1)}$};
			\path[arr] ($(sum)-(3,0)$) -- (sum.west) node [midway, above] {$r(t)=0$};
			\path[arr] (sum) -- (west) node [midway, above] {$e(t)$};
			\path[arr] (east) -- (G.west) node[midway, above] {$x(t)$};
			\path[arr] (G.east) -- ++(right:1) coordinate (t) -- ++(right:1) node [midway, above] {$c(t)$};
			\path[arr] (t) -- ++(down:3) -| (sum.south) node [below right] {$-$};
			\begin{scope}[xshift=29em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (3.5,0) node [right] {$\Re$};
				\path[arr] (0,-5) -- (0,2) node [below right] {$\Im$};
				\path[arr, draw=red, very thick, name path=c1] (-2,0) -- (-6,0) node [sep, at start, label=below:{$-1/2$}] {} node [below] {$-1/N(A)$};
				\path[line, name path=c2] [postaction={decorate}] (-2,-5) .. controls ++(95:2) and ++(140:6) .. (0,0) node [near start, left] {$G(\rj\omega)$};
				\path[line, dashed] [postaction={decorate}] (3,0) .. controls ++(-100:4) and ++(35:2) .. (-2,-5);
				\path[name intersections={of=c1 and c2, by=c}] (c) node [sep, label=above left:{$-1/K$}] {};
				\node at (-3,-6) {$k$为饱和特性线形部斜率，依图知$k=2$};
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

**原始公式代码**

```tex
\begin{align*}
		G(\rj\omega):&-90^\circ-\arctan0.1\omega_g-\arctan0.2\omega_g=-180^\circ\\
		\omega_g&=\sqrt{50}\ \mathrm{rad/s}\Rightarrow A=|G(\rj\omega_g)|=\frac{K}{\sqrt{50}\sqrt{0.5+1}\sqrt{2+1}}=\frac{K}{15}
	\end{align*}
```

#### 幻灯片：自振分析（定量）

分析图示系统的稳定性
	 作图分析，死区特性的描述函数为
	$-\frac{1}{N(A)}$轨迹为实轴上$(-\infty,-1/k)$，线性部分如图$G(\rj\omega)$，$\omega_g=1$ rad/s，$|G(\rj\omega_g)|=2$
	$k>0.5$时如图，$-\frac{1}{N(A)}$和$G(\rj\omega)$有交点，但不是稳定的自振点。

**原始公式代码**

```tex
$$N(A)=\frac{2k}{\pi}\left[\frac{\pi}{2}-\arcsin\frac{a}{A}-\frac{a}{A}\sqrt{1-\left(\frac{a}{A}\right)^2}\right]\quad(A\ge a)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, decoration={markings, mark=at position .15 with {\arrow[blue, thick]{latex}}
			}]
			\tikzset{relay/.pic = {
				\begin{scope}[x=.3em, y=.35em]
					\path[arr] (-6,0) -- (0,0) node [at end, below left] {0} -- (6,0) node [at end, below] {$x$};
					\path[arr] (0,-5) -- (0,5) node [at end, right] {$y$};
					\path[line] (-6,-4) -- ++(3,4) -- (3,0) node [at end, below] {$a$} coordinate (a2) -- ++(3,4) node [near end, left] {$k$};
					\path[draw, blue, thick] (-8,-5.5) rectangle (8,6);
					\path (-8,0) coordinate (west);
					\path (8,0) coordinate (east);
				\end{scope}
				}
			}
			\node[cross] (sum) {};
			\path (5.5,0) pic {relay};
			\node[block] (G) at (10,0) {$\frac{4}{s(s+1)^2}$};
			\path[arr] ($(sum)-(3,0)$) -- (sum.west) node [midway, above] {$r(t)=0$};
			\path[arr] (sum) -- (west) node [midway, above] {$e(t)$};
			\path[arr] (east) -- (G.west) node[midway, above] {$x(t)$};
			\path[arr] (G.east) -- ++(right:1) coordinate (t) -- ++(right:1) node [midway, above] {$c(t)$};
			\path[arr] (t) -- ++(down:3) -| (sum.south) node [below right] {$-$};
			\begin{scope}[xshift=29em]
				\path[arr] (-6,0) -- (0,0) node [below right] {0} -- (3.5,0) node [right] {$\Re$};
				\path[arr] (0,-5) -- (0,2) node [below right] {$\Im$};
				\path[arr, draw=red, very thick, name path=c1, latex-] (-1,0) -- (-6,0) node [sep, at start, label=below:{2}] {} node [at end, below] {$-1/N(A)$};
				\path[line, name path=c2] [postaction={decorate}] (-2,-5) .. controls ++(95:2) and ++(140:6) .. (0,0) node [near start, left] {$G(\rj\omega)$};
				\path[line, dashed] [postaction={decorate}] (3,0) .. controls ++(-100:4) and ++(35:2) .. (-2,-5);
				\path[name intersections={of=c1 and c2, by=c}] (c) node [sep, label=above left:{$-1/K$}] {};
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

## 小结

#### 幻灯片：描述函数小结

-  描述函数的概念、定义$N(A)=\frac{Y_1}{A}\angle\psi_1$ (0,0)--(4,0) coordinate (o) node[at start, above]  $x(t)=A\sin\omega t$; (b) at (o.east) $N(A)$;  (b.east) --+(2em,0) node[near end, above] $y(t)$;
		-  描述函数分析方法
			-  基本假设$\begin{cases}\text{结构上:}N(A), G(\j\omega) \text{串联}\\ N(A)\text{奇对称},y_1(t)\text{幅值占优}\\G(\rj\omega)\text{低通滤波特性好}\end{cases}$ (sum) ;
				 (T) $N(A)$;
				 (G) $G(\rj\omega)$;
				 ($(sum)-(3,0)$) -- (sum.west) node [midway, above] $r(t)=0$;
				 (sum) -- (T.west) node [midway, above] $e(t)$;
				 (T) -- (G.west) node[midway, above] $x(t)$;
				 (G.east) -- ++(right:1) coordinate (t) -- ++(right:1) node [midway, above] $c(t)$;
				 (t) -- ++(down:2) -| (sum.south) node [below right] $-$;
			-  稳定性分析$G()cases
					不包围&稳定
					包围&不稳定
					相交于&可能自振
				cases$
			-  自振分析$-1N(A)A
					穿入&不是自振点
					穿出G()&是自振点
					线切于&对应半稳定
				cases$
				$cases
					定性分析&-1N(A)
					定量分析&N(A)G()=-1
				cases$
