# Cpt7

- 来源文件：`Cpt7.tex`
- 课程标题：自动控制原理
- 副标题：第七章 离散系统

## 离散系统的基本概念

#### 幻灯片：离散系统的基本概念

**按信号传递形式分为：**
		- **连续系统：**  系统中所有的信号为连续的时间函数。
		- **离散系统：**  系统中一处或多处信号为离散信号。
	**离散系统类型**
		-  采样控制系统
		-  数字控制系统

### 连续系统

#### 幻灯片：连续系统

缺点：炉子是具有较大延迟特性的大惯性环节，易产生大超调。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\node[cross] (sum) at (0,0) {};
		\node[block, right=of sum, text width=5em] (b1) {放大器与执行电机};
		\node[block, right=of b1, text width=5em] (b2) {燃料供应阀};
		\node[block, right=of b2] (b3) {炉子};
		\node[block, below=of b2] (b4) {测量};
		\path[arr] (-3,0) -- (sum.west) node[at start, above] {给定温度};
		\path[arr] (sum.east) -- (b1.west);
		\path[arr] (b1.east) -- (b2.west);
		\path[arr] (b2.east) -- (b3.west);
		\path[arr] (b3.east) -- ++(2,0) node[at end, above] {炉温} coordinate (t) -- +(2,0);
		\path[arr] (t) |- (b4.east);
		\path[arr] (b4.west) -| (sum.south) node [at end, right] {$-$};
	\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
	\centering
	
	\caption{炉温连续控制系统原理方框图}
	\end{figure}
```

### 采样控制系统

#### 幻灯片：采样控制系统

优点：可以有效抑制系统超调

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\node[cross] (sum) at (0,0) {};
		\node[block, right=of sum, xshift=3em, text width=5em] (b1) {放大器与执行电机};
		\node[block, right=of b1, text width=5em] (b2) {燃料供应阀};
		\node[block, right=of b2] (b3) {炉子};
		\node[block, below=of b2, yshift=2em] (b4) {测量};
		\path[arr] (-3,0) -- (sum.west) node[at start, above] {给定温度};
		\path[arr] (sum.east) -- ++(1,0) node [above] {$e(t)$} -- ++ (30:3) node [right] {$T$};
		\path[draw, -latex] (2.2,1.5) arc (60:0:2);
		\path[arr] (4,0) -- (b1.west);
		\path[arr] (b1.east) -- (b2.west);
		\path[arr] (b2.east) -- (b3.west);
		\path[arr] (b3.east) -- ++(2,0) node[at end, above] {炉温} coordinate (t) -- +(2,0);
		\path[arr] (t) |- (b4.east);
		\path[arr] (b4.west) -| (sum.south) node [at end, right] {$-$};
	\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\node[cross] (sum) at (0,0) {};
		\node[block, right=of sum, xshift=4em, text width=5em] (b1) {脉冲控制器};
		\node[block, right=of b1, text width=5em] (b2) {保持器};
		\node[block, right=of b2] (b3) {被控对象};
		\node[block, below=of b2, yshift=2em] (b4) {测量};
		\path[arr] (-3,0) -- (sum.west) node[at start, above] {$r(t)$};
		\path[arr] (sum.east) -- ++(1,0) node [above] {$e(t)$} -- ++ (30:3) node [right] {$T$};
		\path[draw, -latex] (2.2,1.5) arc (60:0:2) node [at end, below] {采样开关};
		\path[arr] (4,0) -- (b1.west) node [above, midway] {$e^*(t)$};
		\path[arr] (b1.east) -- (b2.west);
		\path[arr] (b2.east) -- (b3.west);
		\path[arr] (b3.east) -- ++(2,0) node[at end, above] {炉温} coordinate (t) -- +(2,0);
		\path[arr] (t) |- (b4.east);
		\path[arr] (b4.west) -| (sum.south) node [at end, right] {$-$};
	\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
	\centering
	
	\caption{炉温采样控制系统原理方框图}
	\end{figure}
```

**原始图示代码**

```tex
\begin{figure}
	\centering
	
	\caption{典型采样控制系统原理方框图}
	\end{figure}
```

#### 幻灯片：采样器

- **采样**  将时间连续的信号转变为时间离散的脉冲序列的过程
		- **采样器**  实现采样的转制
	采样器常用一周期闭合的开关表示，每隔$T$秒闭合，闭合时间为$\tau$。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=2em, y=1em]
		\path[arr] (-1,0) -- (5,0);
		\path[arr] (0,-2) -- (0,3) node [near end, left] {$e(t)$};
		\path[line] (0,0) .. controls (2,4) and (2,0) .. (4.5,3);
		\begin{scope}[yshift=-4em]
		\path[arr] (-1,0) -- ++(3,0) node [near start, above] {$e(t)$} -- ++ (1,1);
		\path[draw,-latex] (2,0.5) arc (60:0:1) node [at end, below] {$T$};
		\path[arr] (3,0) -- (5,0) node [near start, above] {$e^*(t)$};
		\end{scope}
		\begin{scope}[yshift=-8em]
		\path[arr] (-1,0) -- (5,0);
		\path[arr] (0,-2) -- (0,3) node [near end, left] {$e_\tau^*(t)$};
		\path[line, dashed] (0,0) .. controls (2,4) and (2,0) .. (4.5,3);
		\foreach \x/\y in {0.8/1.4,1.6/1.85,2.4/1.75,3.2/1.95,4/2.5}{
		\path[draw, red] (\x,0) |- (\x+0.2,\y) -- (\x+0.2,0);
		}
		\path[draw] (0.8,0) -- (0.8,-2);
		\path[draw] (1.6,0) -- (1.6,-2);
		\path[draw,latex-latex] (0.8,-1.8) -- (1.6,-1.8) node [midway, above] {$T$};
		\path[draw] (2.4,0) -- (2.4,-2);
		\path[draw] (2.6,0) -- (2.6,-2);
		\path[draw, -latex] (2,-0.5) -- (2.4,-0.5);
		\path[draw, -latex] (3,-0.5) -- (2.6,-0.5) node [midway, below] {$\tau$};
		\end{scope}
		\begin{scope}[yshift=-13.5em]
		\path[arr] (-1,0) -- (5,0);
		\path[arr] (0,-2) -- (0,3) node [near end, left] {$e^*(t)$};
		\path[line, dashed] (0,0) .. controls (2,4) and (2,0) .. (4.5,3);
		\foreach \x/\y in {0.8/1.4,1.6/1.85,2.4/1.75,3.2/1.95,4/2.5}{
		\path[draw, red, thick] (\x,0) -- (\x,\y);
		}
		\end{scope}
		\node (b1) at (7,0) {连续信号};
		\node (b2) at (7,-4) {采样};
		\node[text width=5em] (b3) at (7,-8) {时间-离散 幅值-连续};
		\node (b4) at (7,-13.5) {理想脉冲序列};
		\path[arr] (b1) to (b2);
		\path[arr] (b2) -- (b3);
		\path[arr] (b3) -- (b4) node [midway, right] {近似};
	\end{tikzpicture}
```

#### 幻灯片：保持器

**保持器**
			将脉冲序列$u^*(t)$转变为连续信号$u_h(t)$的装置。
		**零阶保持器redZero redOrder redHolder**
			把前一采样时刻$nT$的值，恒不变地保持到下一采样时刻$(n+1)T$，从而使$u^*(t)$变成阶梯信号$u_h(t)$

**原始绘图代码**

```tex
\begin{tikzpicture}[x=2em, y=1em]
			\path[arr] (-1,0) -- (5,0);
			\path[arr] (0,-2) -- (0,3) node [near end, left] {$u^*(t)$};
			\path[line, dashed] (0,0) .. controls (2,4) and (2,0) .. (4.5,3);
			\foreach \x/\y in {0.8/1.4,1.6/1.85,2.4/1.75,3.2/1.95,4/2.5}{
			\path[draw, red, thick] (\x,0) -- (\x,\y);
			}
			\node[block] (b) at (1,-5) {零阶保持器};
			\begin{scope}[yshift=-12em]
			\path[arr] (-1,0) -- (5,0);
			\path[arr] (0,-2) -- (0,3) node [near end, left] {$u_h^*(t)$};
			\path[line, dashed] (0,0) .. controls (2,4) and (2,0) .. (4.5,3);
			\foreach \x/\y in {0/0,0.8/1.4,1.6/1.85,2.4/1.75,3.2/1.95,4/2.5}{
			\path[draw, red, thick] (\x,0) |- (\x+0.8,\y);
			}
			\end{scope}
			\path[arr] ($(b)+(0,4)$) -- (b) node [midway, right] {$u^*(t)$};
			\path[arr] (b) -- ++(0,-4) node [midway, right] {$u_h^*(t)$};
		\end{tikzpicture}
```

### 数字控制系统

#### 幻灯片：数字控制系统

-  A/D转换
			- **采样**  使连续信号$e(t)$每隔$T$秒进行一次采样，得到时间离散的模拟信号$e^*(t)$；
			- **整量（编码）**  用一组二进制的数码来逼近时间离散的模拟信号的幅值，将其转换为数字量。
		-  D/A转换：把离散的数字信号转换成连续的模拟信号，包括解码与复现两过程。
	离散控制系统的优点：控制灵活，控制精度高，控制速度快等特点。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
			\node[cross] (sum) at (0,0) {};
			\node[block, right=of sum] (b1) {A/D};
			\node[block, right=of b1, text width=3em] (b2) {数字控制器};
			\node[block, right=of b2] (b3) {D/A};
			\node[block, right=of b3] (b4) {控制对象};
			\node[block, below=of b2, yshift=2em] (b5) {测量元件};
			\path[arr] (sum)++(-3,0) -- (sum) node[near start, above] {给定信号};
			\path[arr] (sum) -- (b1) node [midway, above] {$e(t)$};
			\path[arr] (b1) -- (b2) node [midway, above] {$e^*(t)$};
			\path[arr] (b2) -- (b3) node [midway, above] {$u_k^*(t)$};
			\path[arr] (b3) -- (b4) node [midway, above] {$u_k(t)$};
			\path[arr] (b4.east) -- ++(2,0) coordinate (c) -- ++(2,0) node[near end, above] {输出信号};
			\path[arr] (c) |- (b5) node[near end, above] {数字计算机} -| (sum) node [at end,right] {$-$};
			\draw[dashed, gray] (2.7,1.8) rectangle (17.7,-1.8);
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}[h]
		\centering
		
		\caption{计算机控制系统典型结构}			
	\end{figure}
```

#### 幻灯片：A/D转换过程

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.5em, y=1em]
		\path[arr] (-1,0) -- (6,0);
		\path[arr] (0,-1) -- (0,0) node [midway, left] {0} -- (0,5) node [at end, right] {$e(t)$};
		\path[line] (0,4) .. controls (2,4) and (4,3) .. (6,1);
		\node at (2,-3) {时间-连续};
		\node at (2,-5) {幅值-连续};
		\node at (2,-7) {（模拟信号）};
		\path[arr] (6,3) -- (8,3) node [midway, above] {\Large 采样};
		
		\begin{scope}[xshift=13em]
		\path[arr] (-1,0) -- (6,0);
		\path[arr] (0,-1) -- (0,0) node [midway, left] {0} -- (0,5) node [at end, right] {$e^*(t)$};
		\path[line, dashed] (0,4) .. controls (2,4) and (4,3) .. (6,1);
		\foreach \x/\y in {1/3.95,2/3.65,3/3.2,4/2.65,5/1.9}{
			\path[draw=red, thick] (\x,\y) -- (\x,0) node [at end, below] {\small $\x T$};
		}
		\node at (2,-3) {时间-离散};
		\node at (2,-5) {幅值-连续};
		\node at (2,-7) {（采样信号）};
		\end{scope}
		\path[arr] (14.5,3) -- (16.5,3) node [midway, above] {\Large 编码};
		
		\begin{scope}[xshift=26em]
		\path[arr] (-1,0) -- (6,0);
		\path[arr] (0,-1) -- (0,0) node [midway, left] {0} -- (0,5) node [at end, right] {$e^*(t)$};
		\foreach \x/\y in {1/3.95,2/3.65,3/3.2,4/2.65,5/1.9}{
			\path[draw] (\x,0.5) -- (\x,-0.5) node [at end, below] {\small $\x T$};
		}
		\node at (3,1) {101100011010001};
		\node at (2,-3) {时间-离散};
		\node at (2,-5) {幅值-离散};
		\node at (2,-7) {（数字信号）};
		\end{scope}
	\end{tikzpicture}
```

## 信号的采样

#### 幻灯片：信号的采样与保持

离散系统：系统中有一处或几处的信号为采样信号或数字信号。
	为了定量的对离散系统进行研究，必须对信号的采样和保持过程进行数学描述。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\node[block, text width=1em] at (0,0) {连续信号};
		\node[block, text width=1em] at (12,0) {离散信号};
		\path[arr] (2,1) -- (12,1) node [midway, above] {采样器};
		\path[arr, latex-] (2,-1) -- (12,-1) node [midway, below] {保持器};
	\end{tikzpicture}
```

### 采样过程

#### 幻灯片：采样过程

**理想采样序列**
			理想采样开关可以看成一个脉冲调制器$\delta_T(t)$。
			其中$\delta(t-nT)$表示$t=nT$时强度为1的单位脉冲。

**原始公式代码**

```tex
$$\delta_T(t)=\sum_{n=-\infty}^\infty\delta(t-nT)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
			\path[arr] (0,0) -- ++(4,0) node [near start, above] {$x(t)$} -- ++ (30:2);
			\path[draw,-latex] (4.5,1) arc (60:0:1.5) node [at end, below] {$T$};
			\path[arr] (6,0) -- (10,0) node [near end, above] {$x^*(t)$};
			
			\begin{scope}[xshift=1em, yshift=-5em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x(t)$};
			\path[line] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\end{scope}
			\node at (5,-7) {\Large$+$};
			
			\begin{scope}[xshift=1em, yshift=-10em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,2.5) node [at end, left] {$\delta_T(t)$};
			\foreach \x in {1,...,8}{
				\path[draw, red, thick] (\x,2) -- (\x,0) node [at end, below] {\tiny $\x T$};
			}
			\end{scope}
			\node at (5,-13) {\Large$\Downarrow$};
			
			\begin{scope}[xshift=1em, yshift=-16em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x^*(t)$};
			\path[line, dashed] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\foreach \x/\y in {1/2.5,2/2.6,3/2.2,4/1.35,5/-0.,6/-1.25,7/-1.25,8/-0.05}{
				\path[draw, red, thick] (\x,\y) -- (\x,0) node [at end, below] {};
			}
			\end{scope}
		\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{align*}
				x^*(t) 	&= x(t)\delta_T(t)\\
						&= x(t)\sum_{-\infty}^\infty\delta(t-nT)\\
				t\ge 0\quad x^*(t) &= \sum_{n=0}^\infty x(nT)\cdot\delta(t-nT)		
			\end{align*}
```

#### 幻灯片：采样过程

**采样信号拉氏变换**
			由拉氏变换位移定理得

**原始公式代码**

```tex
$$\mathcal{L}[\delta(t-nT)]=e^{-nTs}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
			\path[arr] (0,0) -- ++(4,0) node [near start, above] {$x(t)$} -- ++ (30:2);
			\path[draw,-latex] (4.5,1) arc (60:0:1.5) node [at end, below] {$T$};
			\path[arr] (6,0) -- (10,0) node [near end, above] {$x^*(t)$};
			
			\begin{scope}[xshift=1em, yshift=-5em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x(t)$};
			\path[line] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\end{scope}
			\node at (5,-7) {\Large$+$};
			
			\begin{scope}[xshift=1em, yshift=-10em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,2.5) node [at end, left] {$\delta_T(t)$};
			\foreach \x in {1,...,8}{
				\path[draw, red, thick] (\x,2) -- (\x,0) node [at end, below] {\tiny $\x T$};
			}
			\end{scope}
			\node at (5,-13) {\Large$\Downarrow$};
			
			\begin{scope}[xshift=1em, yshift=-16em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x^*(t)$};
			\path[line, dashed] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\foreach \x/\y in {1/2.5,2/2.6,3/2.2,4/1.35,5/-0.,6/-1.25,7/-1.25,8/-0.05}{
				\path[draw, red, thick] (\x,\y) -- (\x,0) node [at end, below] {};
			}
			\end{scope}
		\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{align*}
				X^*(s)	&= \mathcal{L}[x^*(t)]=\mathcal{L}\left[\sum_{n=0}^\infty x(nT)\cdot\delta(t-nT)\right]\\
						&= \sum_{n=0}^\infty x(nT)\cdot e^{-nTs}
			\end{align*}
```

#### 幻灯片：采样过程：采样信号的频谱

$\delta_T(t)=\sum_{n=-\infty}^\infty\delta(t-nT)$为周期函数，可展开为傅氏级数，并写出复数形式
		$\omega_s=\frac{2\pi}{T}$为采样频率。则采样信号可表示为
		对上式进行拉氏变换得：
		注：复数域位移定理$\mL{e^{at}f(t)}=F(s-a)$

**原始公式代码**

```tex
$$\delta_T(t)=\frac{1}{T}\sum_{n=-\infty}^\infty e^{\rj n\omega_st}$$
```

**原始公式代码**

```tex
$$x^*(t)=x(t)\cdot\delta_T(t)=\frac{1}{T}x(t)\sum_{n=-\infty}^\infty e^{\rj n\omega_st}=\frac{1}{T}\sum_{n=-\infty}^\infty x(t)\cdot e^{\rj n\omega_st}$$
```

**原始公式代码**

```tex
$$\mL{x^*(t)}=\mL{\frac{1}{T}\sum_{n=-\infty}^\infty x(t)\cdot e^{\rj n\omega_st}}=\frac{1}{T}\sum_{n=-\infty}^\infty X(s-\rj n\omega_s)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
			\path[arr] (0,0) -- ++(4,0) node [near start, above] {$x(t)$} -- ++ (30:2);
			\path[draw,-latex] (4.5,1) arc (60:0:1.5) node [at end, below] {$T$};
			\path[arr] (6,0) -- (10,0) node [near end, above] {$x^*(t)$};
			
			\begin{scope}[xshift=1em, yshift=-5em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x(t)$};
			\path[line] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\end{scope}
			\node at (5,-7) {\Large$+$};
			
			\begin{scope}[xshift=1em, yshift=-10em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,2.5) node [at end, left] {$\delta_T(t)$};
			\foreach \x in {1,...,8}{
				\path[draw, red, thick] (\x,2) -- (\x,0) node [at end, below] {\tiny $\x T$};
			}
			\end{scope}
			\node at (5,-13) {\Large$\Downarrow$};
			
			\begin{scope}[xshift=1em, yshift=-16em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x^*(t)$};
			\path[line, dashed] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\foreach \x/\y in {1/2.5,2/2.6,3/2.2,4/1.35,5/-0.,6/-1.25,7/-1.25,8/-0.05}{
				\path[draw, red, thick] (\x,\y) -- (\x,0) node [at end, below] {};
			}
			\end{scope}
		\end{tikzpicture}
```

#### 幻灯片：采样过程：采样信号的频谱

令$s=\rj\omega$，采样信号的频率特性为：
		采样信号的频谱
		为以$\omega_s$为周期的无限多个频谱之和。
		注：频率特性中随频率变换的幅频特性称为频谱。

**原始公式代码**

```tex
$$\mL{x^*(t)}=\frac{1}{T}\sum_{n=-\infty}^\infty X(s-\rj n\omega_s)$$
```

**原始公式代码**

```tex
$$X^*(\rj\omega)=\frac{1}{T}\sum_{n=-\infty}^\infty X[\rj(\omega-n\omega_s)]$$
```

**原始公式代码**

```tex
$$|X^*(\rj\omega)|=\frac{1}{T}\left|\sum_{n=-\infty}^\infty X[\rj(\omega-n\omega_s)]\right|$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
			\path[arr] (0,0) -- ++(4,0) node [near start, above] {$x(t)$} -- ++ (30:2);
			\path[draw,-latex] (4.5,1) arc (60:0:1.5) node [at end, below] {$T$};
			\path[arr] (6,0) -- (10,0) node [near end, above] {$x^*(t)$};
			
			\begin{scope}[xshift=1em, yshift=-5em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x(t)$};
			\path[line] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\end{scope}
			\node at (5,-7) {\Large$+$};
			
			\begin{scope}[xshift=1em, yshift=-10em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,2.5) node [at end, left] {$\delta_T(t)$};
			\foreach \x in {1,...,8}{
				\path[draw, red, thick] (\x,2) -- (\x,0) node [at end, below] {\tiny $\x T$};
			}
			\end{scope}
			\node at (5,-13) {\Large$\Downarrow$};
			
			\begin{scope}[xshift=1em, yshift=-16em]
			\path[arr] (0,0) -- (9,0) node [at start, left] {0} node [at end, below] {$t$};
			\path[arr] (0,-2) -- (0,3) node [at end, left] {$x^*(t)$};
			\path[line, dashed] (0,2) .. controls (5,5) and (5,-5) .. (8,0);
			\foreach \x/\y in {1/2.5,2/2.6,3/2.2,4/1.35,5/-0.,6/-1.25,7/-1.25,8/-0.05}{
				\path[draw, red, thick] (\x,\y) -- (\x,0) node [at end, below] {};
			}
			\end{scope}
		\end{tikzpicture}
```

#### 幻灯片：采样过程：采样信号的频谱

对于连续信号$x(t)$，其频率特性为
	该信号的频谱$|X(\rj\omega)|$是一个单独的连续频谱，其最大角频率为$\omega_{\max}$。假设其频谱为如右，当采样频率$\omega_s\ge2\omega_{\max}$时，离散信号的频谱为无限多个孤立频谱组成的离散频谱：

**原始公式代码**

```tex
$$x(\rj\omega)=\int_{-\infty}^{+\infty} x(t)e^{-\rj\omega t}\dif t$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\path[arr] (-5,0) -- (5,0) node [very near start, below] {$-\omega_{\max}$} node [very near end, below] {$+\omega_{\max}$} node [at end, below right] {$\omega$} ;
		\path[arr] (0,0) -- (0,5) node [at start, below] {0} node[very near end, left] {$X(\rj\omega)$};
		\path[line] (-3,0) .. controls (0,0) and (-1,4) .. (0,4) .. controls (1,4) and (0,0) .. (3,0);
		\path[draw] (-3,-1.5) -- (-3,-3.5);
		\path[draw] (3,-1.5) -- (3,-3.5);
		\path[draw, latex-latex] (-3,-3) -- (3,-3) node [midway, above] {$2\omega_{\max}$};
	\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\path[arr] (-18,0) -- (18,0) node [at end, below] {$\omega$};
		\path[arr] (0,0) -- (0,5) node [at end, left] {$|X(\rj\omega)|$};
		\clip (-18,4) rectangle (18,-4);
		\foreach \x/\y in {-16/-2\omega_s,-8/-\omega_s,0/,8/\omega_s,16/2\omega_s}{
			\begin{scope}[xshift=\x em]
				\path[line] (-3,0) .. controls (0,0) and (-1,4) .. (0,4) .. controls (1,4) and (0,0) .. (3,0);
				\path[draw, dashed] (0,4) -- (0,0) node [at end, below] {$\y$};
			\end{scope}
		}
		\path[draw] (-3,0) -- (-3,-2);
		\path[draw] (3,0) -- (3,-2);
		\path[draw, latex-latex] (-3,-1.5) -- (3,-1.5) node [midway, above] {$2\omega_{\max}$};
		\path[draw] (-4,0) -- (-4,-3.5);
		\path[draw] (4,0) -- (4,-3.5);
		\path[draw, latex-latex] (-4,-3) -- (4,-3) node [midway, above] {$\omega_s$};
	\end{tikzpicture}
```

#### 幻灯片：采样过程：采样信号的频谱

如果$\omega_s<2\omega_{\max}$，离散信号信号的频谱成为了连续的：
	采样角频率$\omega_s$满足什么条件时能从$X^*(\rj\omega)$复原$X(\rj\omega)$？

**原始公式代码**

```tex
$$\omega_s\ge 2\omega_{\max}\quad\text{或}\quad f_s\ge 2\frac{\omega_{\max}}{2\pi}\quad\text{或}\quad T\le\frac{\pi}{\omega_{\max}}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\path[arr] (-18,0) -- (18,0) node [at end, below] {$\omega$};
		\path[arr] (0,0) -- (0,5) node [at end, left] {$|X(\rj\omega)|$};
		\clip (-17,4.2) rectangle (17,-4);
		\begin{scope}
		\clip (-18,0.5) rectangle (18,-1);
		\foreach \x in {-16,-12,-8,-4,0,4,8,12,16}{
			\begin{scope}[xshift=\x em]
			\path[line, dotted] (-3,0) .. controls (0,0) and (-1,4) .. (0,4) .. controls (1,4) and (0,0) .. (3,0);
			\end{scope}
		}
		\end{scope}
		\foreach \x/\y in {-16/-4\omega_s,-12/-3\omega_s,-8/-2\omega_s,-4/-\omega_s,0/,4/\omega_s,8/2\omega_s,12/3\omega_s,16/4\omega_s}{
			\begin{scope}[xshift=\x em]
				\begin{scope}
					\clip (-1.5,4.5) rectangle (1.5,0);
					\path[line] (-3,0) .. controls (0,0) and (-1,4) .. (0,4) .. controls (1,4) and (0,0) .. (3,0);
				\end{scope}
				\path[line] (-2.025,0.7) .. controls (-1.85,0.5) and (-1.7,0.35) .. (-1.48,0.55);
				\path[line] (2.025,0.7) .. controls (1.85,0.5) and (1.7,0.35) .. (1.48,0.55);
				\path[draw, dashed] (0,4) -- (0,0) node [at end, below] {$\y$};
			\end{scope}
		}
		\path[draw] (-3,0) -- (-3,-3.5);
		\path[draw] (3,0) -- (3,-3.5);
		\path[draw, latex-latex] (-3,-3) -- (3,-3) node [midway, above] {$2\omega_{\max}$};
		\path[draw] (-2,0) -- (-2,-2);
		\path[draw] (2,0) -- (2,-2);
		\path[draw, latex-latex] (-2,-1.5) -- (2,-1.5) node [midway, above] {$\omega_s$};
	\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
	\centering
	
	\end{figure}
```

#### 幻灯片：香农(Shannon)采样定理

如果采样器输入信号$x(t)$具有有限带宽，最高频率分量为$\omega_{\max}$，采样周期$T$必须满足$\omega_s\ge2\omega_{\max}$（$\omega_s=2\pi/T$），则才有可能通过理想的低通滤波器滤去$x^*(t)$离散信号的副频谱，把原信号$x(t)$从$x^*(t)$中完全恢复过来。
	**香农定理的物理意义**
			-  采样角频率$\omega_s$若满足$\omega_s\ge 2\omega_{\max}$，则就含有连续信号$x(t)$的全部信息，通过理想的低通滤波器，可把原信号$x(t)$不失真地复现。
			-  离散信号$x^*(t)$通过理想低通滤波器，可过滤掉所有$\omega_s>\omega_{\max}$的高频分量。通过放大器对幅值进行补偿，可以无失真地将原连续信号复现。

### 信号的保持

#### 幻灯片：采样信号的保持（复现）

将采样信号恢复为原来连续信号的过程称为信号复现。该装置称为保持器或复现滤波器。
	理想滤波器可以完成此任务，但其无法实现，只能用低通滤波器代替。
				-  零阶保持器的数学模型
				最简单最常用是零阶保持器（Zero-Order Holder，ZOH）
				把某一采样时刻$kT$的采样值$f(kT)$恒定地保持到下一个采样时刻$(k+1)T$。

**原始公式代码**

```tex
$$\text{信号恢复}\begin{cases}
		\text{时域上}&x^*(t)\rightarrow x(t)\\
		\text{频域上}&\text{滤去}x^*(t)\text{中辅频谱，保留主频谱}
	\end{cases}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1.5em, y=1em]
				\path[arr] (-1,0) -- (0,0) -- (10,0) node [at start, below left] {$0$} node [at end, below] {$t$};
				\path[arr] (0,-1) -- (0,8) node [at end, left] {$f(t)$};
				\path[line, name path=f] (0,5) .. controls (2,5) and (2.5,6) .. (3.5,6) .. controls (5,6) and (4,-2) .. (8.5,-2); 
				\foreach \x/\y/\z/\p in {1/5/T/below,2/5.1/2T/below,3/5.4/3T/below,4/5.9/4T/below,5/5.6/5T/below,6/1.7/6T/above right,7/-1/7T/above,8/-2/8T/above}{
					\path[name path=fh] (\x-1,-2.1) -- ++(0,10.2);
					\path[line, draw=red, name intersections={of=f and fh, by=hp}] (\x-1,0) -- (hp) -- ++(1,0) coordinate (t) -- (t |- 0,0) node [at end, \p] {\tiny $\z$};
				}
				\begin{scope}[xshift=0.75em]
					\path[line, dashed] (0,5) .. controls (2,5) and (2.5,6) .. (3.5,6) .. controls (5,6) and (4,-2) .. (8.5,-2); 
				\end{scope}
				\path[arr] (3,7) -- (2.5,5.7) node [at start, above] {$f(t)$};
				\path[arr] (6,4) -- (5.2,3) node [at start, above] {$f_l(t)$};
				\path[arr] (6,7) -- (5,5.5) node [at start, above] {$f_h(t)$};
			\end{tikzpicture}
```

#### 幻灯片：采样信号的保持（复现）

-  零阶保持器的数学模型
	**零阶保持器的传递函数**

**原始公式代码**

```tex
$$G_h(s) = \frac{1}{s}-\frac{1}{s}e^{-Ts}=\frac{1-e^{-Ts}}{s}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=0.7em]
			\node[block] (b) at (0,0) {$G_h(s)$};
			\path[arr] ($(b)-(3,0)$) -- (b) node [at start, above] {$r(t)$} node [at start, below] {$R(s)$};
			\path[arr] (b) -- ++(3,0) node [at end, above] {$c(t)$} node [at end, below] {$C(s)$};
			\begin{scope}[yshift=-6em]
				\path[arr] (-1,0) -- (0,0) -- (5,0) node [at start, below left] {$0$} node [at end, below] {$t$};
				\path[arr] (0,-1) -- (0,4) node [near end, right] {$r(t)$};
				\path[rlocus, -latex] (0,0) -- (0,3);
			\end{scope}
			\begin{scope}[xshift=7em, yshift=-6em]
				\path[arr] (-1,0) -- (0,0) -- (5,0) node [at start, below left] {$0$} node [at end, below] {$t$};
				\path[arr] (0,-1) -- (0,4) node [at end, right] {$c(t)$};
				\path[line] (0,0) -- (0,3) node [at end, left] {1} -| (2,0) node [at end, below] {$T$};
			\end{scope}
			\node[single arrow, draw, single arrow head extend=.2cm, fill=gray!50, text width=2em] (a) at (15,-4) {};
			\begin{scope}[xshift=20em, yshift=-1em]
				\path[arr] (-1,0) -- (0,0) node [at end, below left] {0}-- (5,0) node [at end, below] {$t$};
				\path[arr] (0,-1) -- (0,4) node [at end, right] {$c_1(t)$};
				\path[line] (0,0) -- (0,3) node [at end ,left] {1} -- (4,3);
				\node at (2,-1) {$T$};
			\end{scope}
			\begin{scope}[xshift=20em, yshift=-5em]
				\path[arr] (-1,0) -- (0,0) node [at end, below left] {0}-- (5,0) node [at end, below] {$t$};
				\path[arr] (0,-2) -- (0,2) node [at end, right] {$c_2(t)$};
				\path[line] (0,0) -- (2,0) node [at end, above] {$T$} |- (4,-3);
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：采样信号的保持（复现）

enumi1
		-  零阶保持器的频率特性
			**零阶保持器的幅频与相频特性**
					-  低通特性。幅频特性随$\omega$增大而迅速衰减
					-  相角滞后
					-  时间迟后

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
					\path[arr] (-1,0) -- (0,0) node [at end, below left] {0} -- (10,0) node [at end, above] {$\omega$};
					\path[arr] (0,-1) -- (0,6) node [at end, right] {$|G_h(\rj\omega)|$};
					\path[line] (0,3) .. controls (1.5,2.5) and (2.2,2) .. (2.5,0) .. controls (3,1.5) and (4.5,1) .. (5,0) .. controls (5.5,0.8) and (7,0.5) .. (7.5,0) .. controls (8,0.4) .. (9,0.2);
					\begin{scope}[yshift=-3em]
						\path[arr] (-1,0) -- (0,0) node [at end, below left] {0} -- (10,0) node [at end, above] {$\omega$};
						\path[arr] (0,-6) -- (0,1) node [at end, right] {$\angle G_h(\rj\omega)$};
						\path[line] (0,0) -- (-35:10em);
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
				G_h(\rj\omega) &= \frac{1-e^{-\rj T\omega}}{\rj \omega} = 2e^{-\rj T\omega/2}\left(\frac{e^{\rj T\omega/2}-e^{\rj T\omega/2}}{2\rj\omega}\right)\\
					&= \frac{2}{\omega}e^{-\rj\omega T/2}\sin\frac{\omega T}{2}\\
					&= T\frac{\sin\frac{\omega T}{2}}{\frac{\omega T}{2}}e^{-\rj\frac{\omega T}{2}}
			\end{align*}
```

#### 幻灯片：采样信号的保持（复现）

enumi2
		-  零阶保持器的实现
	可由RC网络实现

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, every circuit symbol/.style={thick}, semithick]
			\path[every node/.style={terminal}] (0,0) node (a) {} (8,0) node (b) {} (0,-3) node (c) {} (8,-3) node (d) {}; 
			\path[draw] (a) to [resistor={info={$R$}}] (6,0) coordinate (t) to (b);
			\path[draw] (c) to node [midway, below] {$RC$保持器} (d);
			\path[draw] (t) to [capacitor={info=$C$}] (t |- c);
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
		\because &e^{Ts} = 1+Ts + \frac{1}{2}T^2s+\cdots\approx 1+Ts\\
		\therefore & G_h(s) = \frac{1-e^{-Ts}}{s}=\frac{e^{Ts}-1}{se^{Ts}}=\frac{Ts}{s(1+Ts)}=\frac{T}{1+Ts}
	\end{align*}
```

## Z变换定义及性质

### Z变换定义

#### 幻灯片：Z变换理论

**定义**
			**拉氏变换**
			令$z=e^{Ts}$，则

**原始公式代码**

```tex
$$f^*(t)=\sum_{n=0}^{+\infty}f(nT)\delta(t-nT)$$
```

**原始公式代码**

```tex
$$F^*(s)=\sum_{n=0}^{\infty}f(nT)e^{-nTs}$$
```

**原始公式代码**

```tex
$$F(z)\triangleq \left.F^*(s)\right|_{s=\frac{\ln z}{T}}=\sum_{n=0}^{+\infty}f(nT)z^{-n}\quad\xrightarrow{\text{i.e.}}\quad F(z)=\mZ[f(t)]$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, thick]
					\path[arr] (-1,0) -- (0,0) node [at start, below left] {0} -- (7,0) node [at end, below] {$t$};
					\path[arr] (0,-1) -- (0,4) node [at end, right] {$f(t)$};
					\path[line] (0,1.5) .. controls (1,3) and (5,1) .. (6,4);
					\path[draw, thick, yshift=-3em] (-1,0) node [at start, above] {$f(t)$} to [make contact] (6,0);
					\node[above, yshift=-3em] at (6,0) {$f^*(t)$};
					\begin{scope}[yshift=-8em]
						\path[arr] (-1,0) -- (0,0) node [at start, below left] {0} -- (7,0) node [at end, below] {$t$};
						\path[arr] (0,-1) -- (0,4) node [at end, right] {$f^*(t)$};
						\path[line, dashed, name path=curve] (0,1.5) .. controls (1,3) and (5,1) .. (6,4);
						\foreach \x in {0.8,1.6,...,6.4}{
							\path[name path=v] (\x,0) -- (\x,4);
							\path[line, red, name intersections={of=curve and v, by=x}] (\x,0) -- (x);
						}
					\end{scope}
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

**原始表格代码**

```tex
\begin{table}
		\begin{tabular}{cccc}
			线性连续系统 &微分方程 &\alert{拉氏变换} &传递函数\\
			线性离散系统 &差分方程 &\alert{Z变换} & 脉冲传递函数
		\end{tabular}
	\end{table}
```

#### 幻灯片：Z变换求取方法

-  级数求和法（定义法）$\sum_{n=0}^\infty x^n=\frac{1}{1-x}\quad |x|<1$
	试求单位阶跃函数$1(t)$的Z变换
	 $f(nT)=1,\quad n=1,2,\cdots$
	试求指数函数$e^{-at}$的Z变换
	 令$t=nT$，则该函数在各采样时刻的值为

**原始公式代码**

```tex
$$F(z) = 1+z^{-1}+z^{-2}+\cdots+z^{-n}+\cdots=\sum_{n=0}^\infty [z^{-1}]^n=\frac{1}{1-z^{-1}}=\frac{z}{z-1}\quad |z^{-1}|<1$$
```

**原始公式代码**

```tex
\begin{align*}
		f(nT) &= e^{-anT}\\
		F(z) &=\sum_{n=0}^\infty f(nT)z^{-n}=\sum_{n=0}^\infty e^{-anT}z^{-n}=\sum_{n=0}^\infty [e^{-aT}z^{-1}]^n=\frac{1}{1-e^{-aT}z^{-1}}=\frac{z}{z-e^{-aT}}\\
		& |e^{-aT}z^{-1}|<1
	\end{align*}
```

#### 幻灯片：Z变换求取方法

enumi1
		-  部分分式法
	一致连续函数$E(s)=\frac{a}{s(s+1)}$，试求相应的Z变换$E(z)$

**原始公式代码**

```tex
$$f(t)\rightarrow F(s)\rightarrow\text{部分分式之和}\xrightarrow{\text{查表}}F(z)$$
```

**原始公式代码**

```tex
\begin{align*}
		E(s)	&=\frac{1}{s}-\frac{1}{s+1} \shortintertext{查表得}
		E(z)	&=\frac{z}{z-1}-\frac{z}{z-e^{-aT}}
	\end{align*}
```

### Z变换性质

#### 幻灯片：Z变换基本定理

-  线性定理
			**叠加原理**
				可加性、齐次性
			若$\mZ[f_1^*(t)]=F_1(z),\ \mZ[f_2^*(t)]=F_2(z)$，则$\mZ[af_1^*(t)+bf_2^*(t)]=aF_1(z)+bF_2(z)$
		-  实数位移定理
					**延迟定理**
						令$\mZ[f(t)]=F(z)$，则$\mZ[f(t-nT)]=\underbrace{\alert{z^{-n}}}_{\mathclap{\text{延迟环节}}}F(z)$
					**超前定理**
						令$\mZ[f(t)]=F(z)$，则$\mZ[f(t+nT)]=\underbrace{\alert{z^{n}}}_{\mathclap{\text{超前环节}}}[F(z)-\sum_{k=0}^{n-1}f(kT)z^{-k}]$

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
							\path[arr] (-1,0) -- (0,0) node [at start, below left] {0} -- (7,0) node [at end, below] {$t$};
							\path[arr] (0,-1) -- (0,6);
							\path[daline, purple] (-2,4) -- (5,4);
							\foreach \x/\y in {-1.5/blue,0/black,1.5/red}{
								\path[draw, thick, \y] (\x,4) .. controls (\x+1,6) and (\x+3,4) .. (\x+4,-0.5);
							}
							\path[arr, blue] (2.5,5) -- (0.5,4.1) node [at start, above] {$f(t+nT)$};
							\path[arr, red] (6,4) -- (4.5,2.5) node [at start, above] {$f(t-nT)$};
							\path[arr] (3,-2) -- (4,-0.5) node [at start, below] {$f(t)$};
						\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
						
					\end{figure}
```

#### 幻灯片：Z变换基本定理

试用位移定理计算延迟一个采样周期的指数函数$e^{-a(t-T)}$的Z变换。
		enumi2
		-  复数位移定理$\mZ[e^{\mp at}f(t)]=F(ze^{\pm aT})$
		-  初值定理$f(0)=\limit{n}{0}f(nT)=\limit{z}{\infty}F(z)$
		-  终值定理$f(\infty)=\limit{n}{\infty}f(nT)=\limit{z}{1}(z-1)F(z)$
		或$f(\infty)=\limit{n}{\infty}f(nT)=\limit{z}{1}(1-z^{-1})F(z)$

**原始公式代码**

```tex
\begin{align*}
		\mZ [e^{-a(t-T)}] &= z^{-1}\mZ[e^{-at}]\\
		&= z^{-1}\frac{z}{z-e^{-aT}}=\frac{1}{z-e^{-aT}}
	\end{align*}
```

#### 幻灯片：Z变换基本定理

设Z变换函数试利用终值定理确定$e(nT)$的终值。

**原始公式代码**

```tex
$$E(z)=\frac{0.747z^2}{(z-1)(z^2-0.461z+0.208)}$$
```

**原始公式代码**

```tex
$$e(\infty)=\limit{z}{1}(z-1)\frac{0.747z^2}{(z-1)(z^2-0.461z+0.208)}=\limit{z}{1}\frac{0.747z^2}{z^2-0.461z+0.208}=1$$
```

### Z反变换

#### 幻灯片：Z反变换

由$F(z)\rightarrow f^*(t)$，即$\mZr{F(z)}=f(nT)$，$f^*(t)=\sum_{n=0}^{+\infty}f(nT)\delta(t-nT)$
	注意：Z反变换只能给出采样信号$f^*(t)$，而不能提供连续信号$f(t)$。
	**长除法**
		用长除法把$F(z)$按降幂展开成幂级数，然后求得$f(nT)$
		即

**原始公式代码**

```tex
$$F(z)=\frac{b_0z^m+b_1z^{m-1}+\cdots+b_m}{a_0z^n+a_1z^{n-1}+\cdots+a_n},\quad n>m$$
```

**原始公式代码**

```tex
\begin{align*}
			F(z) &= c_0z^0+c_1z^{-1}+c_2z^{-2}+\cdots\\
			f^*(t) &= c_0\delta(t) +c_1\delta(t-T)+c_2\delta(t-2T)+\cdots
		\end{align*}
```

#### 幻灯片：Z反变换

试用长除法求的Z反变换。
	将$E(z)$分子被分母除，得
	采样脉冲序列为
	思考：如何求$e(1)$，$e(3)$？

**原始公式代码**

```tex
$$E(z)=\frac{10z}{(z-1)(z-2)}$$
```

**原始公式代码**

```tex
$$E(z)=\frac{10z}{z^2-3z+2}$$
```

**原始公式代码**

```tex
$$E(z)=10z^{-1}+30z^{-2}+70z^{-3}+150z^{-4}+\cdots$$
```

**原始公式代码**

```tex
\begin{align*}
		e^*(t) &=10\delta(t-T)+30\delta(t-2T)+70\delta(t-3T)\\
		&+150\delta(t-4T)+\cdots
	\end{align*}
```

#### 幻灯片：Z反变换

**部分分式法**
			-  $F(z)/z$展成部分分式之和
			-  查表各项对应的$f_i(nT)$
			-  得采样信号$f^*(t)$
	已知$E(z)=\frac{10z}{(z-1)(z-2)}$，试求其反变换。
	查表得
	$\therefore e(nT)=-10+10\times 2^n\rightarrow$单个脉冲

**原始公式代码**

```tex
$$\frac{E(z)}{z}=\frac{10}{(z-1)(z-2)}=\frac{-10}{z-1}+\frac{10}{z-2}\rightarrow E(z)=\frac{-10z}{z-1}+\frac{10z}{z-2}$$
```

**原始公式代码**

```tex
$$\mZ^{-1}\left[\frac{z}{z-1}\right]=1,\quad \mZ^{-1}\left[\frac{z}{z-2}\right]=2^n$$
```

**原始公式代码**

```tex
$$e^*(t)=\sum_{n=0}^{\infty}e(nT)\delta(t-nT)=\sum_{n=0}^{+\infty}[10(2^n-1)]\delta(t-nT)\rightarrow\text{\alert{脉冲序列}}$$
```

## 离散系统的数学模型

### 差分方程及其求解

#### 幻灯片：差分方程

**差分定义**
		函数$y=f(t)$在每两相邻采样时刻之间的增量称为差分。
		- **一阶前向差分**  $\Delta y(k)=y(k+1)-y(k)$
		- **二阶前向差分**
		- **$\vdots$**
		- **$n$阶前向差分**  $\Delta^n y(k)=\Delta^{n-1}[\Delta y(k)]=\Delta^{n-1}y(k+1)-\Delta^{n-1}y(k)$
		- **前向差分定理** $\mZ[x(t+nT)]=z^n\left[X(z)-\sum_{k=0}^{n-1}x(kT)z^{-k}\right]$
	*前向差分左移脉冲序列，需要减去0时刻之前的脉冲。因此要减去$\sum_{k=0}^{n-1}x(kT)z^{n-k}$

**原始公式代码**

```tex
$$\begin{multlined}[c]
			\Delta^2y(k)=\Delta[\Delta y(k)]=\Delta[y(k+1)-y(k)]\\
			=\Delta y(k+1)-\Delta y(k)=y(k+2)-2y(k+1)+y(k)
		\end{multlined}$$
```

#### 幻灯片：差分方程

**差分定义**
		函数$y=f(t)$在每两相邻采样时刻之间的增量称为差分。
		- **一阶后向差分**  $\Delta y(k)=y(k)-y(k-1)$
		- **二阶后向差分**
		- **$\vdots$**
		- **$n$阶后向差分**  $\Delta^n y(k)=\Delta^{n-1}[\Delta y(k)]=\Delta^{n-1}y(k)-\Delta^{n-1}y(k-1)$
		- **后向差分定理** $\mZ[x(t-nT)]=z^{-n}X(z)$
	*后向差分右移脉冲序列，需要加上0时刻之前的脉冲。因为系统零初态，则没有增加项。

**原始公式代码**

```tex
$$\begin{multlined}[c]
			\Delta^2y(k)=\Delta[\Delta y(k)]=\Delta[y(k)-y(k-1)]\\
			=\Delta y(k)-\Delta y(k-1)=y(k)-2y(k-1)+y(k-2)
		\end{multlined}$$
```

#### 幻灯片：差分方程

离散控制系统在某一采样时刻的输出值$c(k)$不仅与这一时刻的输入值$r(k)$有关，而且与$k$时刻以前的输入值$r(k-1)$，$r(k-2)$……有关，还与$k$时刻以前的输出值$c(k-1)$，$c(k-2)$……有关，可用线性定常后向差分方程描述为：
	也可用线性定常前向差分方程来描述：

**原始公式代码**

```tex
\begin{align*}
		&c(k)+a_1c(k-1)+a_2c(k-2)+\cdots+a_nc(k-n)\\
		=&b_0r(k)+b_1r(k-1)+\cdots+b_mr(k-m)
	\end{align*}
```

**原始公式代码**

```tex
\begin{align*}
		&c(k+n)+a_1c(k+n-1)+a_2c(k+n-2)+\cdots+a_nc(k)\\
		=&b_0r(k+m)+b_1r(k+m-1)+\cdots+b_mr(k)
	\end{align*}
```

#### 幻灯片：差分方程的求解

**迭代法**
		已知差分方程$c(k+1)+0.2c(k)=2r(k)$，$r(kT)=1$，$k=0,\cdots$，$c(0)=0$。试用迭代法求解该差分方程。
		小结：这种方法，不能得到$c(nT)$的一般表达式。

**原始公式代码**

```tex
\begin{align*}
			c(k+1) 		&= -0.2c(k)+2r(k)\\
			k=0\quad c(1)	&= -0.2c(0)+2r(0)=-0.2\times 0+2\times 1=2\\
			k=1\quad c(2)	&= -0.2c(1)+2r(1)=-0.2\times 2+2\times 1=1.6\\
			\vdots&
		\end{align*}
```

#### 幻灯片：差分方程的求解

**Z变换法**
		求解步骤：
		已知差分方程$c(k+2)+3c(k+1)+2c(k)=0$，$c(0)=0$，$c(1)=1$。试用Z变换法求解该差分方程。
		 对差分方程每项进行Z变换
		则$(z^2+3z+2)c(z)=z$，即
		$c(z)=\frac{z}{z^2+3z+2}=\frac{z}{z+1}-\frac{z}{z+2}$
		进行Z反变换，得：$c(n)=(-1)^n-(-2)^n$，$n=0,1,2,\cdots$。或$c^*(t)=\sum_{n=0}^{+\infty}[(-1)^n-(-2)^n]\delta(t-nT)$

**原始公式代码**

```tex
$$\text{差分方程}\xrightarrow[\text{位移定理}]{\text{Z变换}}\text{Z域代数方程}\xrightarrow{\text{解方程}}C(z)\xrightarrow{Z^{-1}}c(k)$$
```

**原始公式代码**

```tex
\begin{align*}
			\mZ[c(k+2)]	&= z^2c(z)-z^2c(0)-zc(1)=z^2c(z)-z\\
			\mZ[3c(k+1)]	&= 3zc(z)-3zc(0)=3zc(z)\\
			\mZ[2c(k)]	&= 2c(z)
		\end{align*}
```

### 脉冲传递函数

#### 幻灯片：脉冲传递函数

**定义**
		零初始条件下，系统输出$c(t)$的Z变换$C(z)$与输入$r(t)$的Z变换$R(z)$之比，称为脉冲传递函数，即$G(z)=C(z)/R(z)$。
				则$C(z)=G(z)R(z)$
				[注]多数控制系统输出$c(t)$为连续信号，而非$c^*(t)$，可在输出端虚设一个与输入采样开关同步的采样开关，当采样频率较高时，可用$c^*(t)$近似描述$c(t)$.

**原始公式代码**

```tex
$$c^*(t)=\mZr{C(z)}=\mZr{G(z)R(z)}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, thick]
						\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
						\path (1,0) node [above] {$r(t)$} (1,0) node [below] {$R(z)$} (5,0) node [above] {$r^*(t)$};
						\node[block] (G) at (t) {G(s)};
						\path[draw] (G) to [make contact] ++(right:5) coordinate (t);
						\path (t) node [above ]{$c^*(t)$} (t) node [below] {$C(z)$} ($(t)-(2.8,0)$) node [above] {$c(t)$};
						\node[below of=G] {开环离散系统};
						\begin{scope}[yshift=-6em]
							\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
							\path (1,0) node [above] {$r(t)$} (1,0) node [below] {$R(z)$} (5,0) node [above] {$r^*(t)$};
							\node[block] (G) at (t) {G(s)};
							\path[draw] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
							\path (t) node [above] {$c^*(t)$} (t) node [below] {$c(t)$};
							\path[draw, dashed, red] (c) to ++(up:2) to [make contact=red] ++(right:3);
							\node[below of=G] {实际的开环离散系统};
						\end{scope}
					\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
					
				\end{figure}
```

#### 幻灯片：脉冲传递函数

**由$G(s)$求$G(z)$的方法**
	求下列传函相应的$G(z)$：
	查变换表，得

**原始公式代码**

```tex
$$G(s)\rightarrow\text{部分分式之和}\xrightarrow{查表}G(z)$$
```

**原始公式代码**

```tex
$$G(s)=\frac{s+1}{s^2+5s+6}$$
```

**原始公式代码**

```tex
$$G(s)=\frac{s+1}{s^2+5s+6}=\frac{2}{s+3}-\frac{1}{s+2}$$
```

**原始公式代码**

```tex
$$G(z)=\frac{2z}{z-e^{-3T}}-\frac{z}{z-e^{-2T}}$$
```

### 开环系统脉冲传递函数

#### 幻灯片：开环系统脉冲传递函数

**采样拉氏变换重要性质**
		若采样函数拉氏变换$F^*(s)$与连续函数的拉氏变换$G(s)$相乘后再离散化，则$F^*(s)$可从离散信号中提出来。
	**开环系统**
					-  串联环节间有采样开关
					$C(z)=G_2(z)D(z)$，$D(z)=G_1(z)R(z)$
					则$\frac{C(z)}{R(z)}=G_1(z)G_2(z)$

**原始公式代码**

```tex
$$[F^*(s)G(s)]^*=F^*(s)G^*(s)$$
```

**原始公式代码**

```tex
$$\therefore C(z)=G_1(z)G_2(z)R(z)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, thick]
						\node[block, fill=blue!20, text width=15em] {结论：串联环节中间具有采样开关的环节，总的脉冲传函等于各脉冲环节传函之积。} ;
						\begin{scope}[yshift=-6em]
							\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
							\path (1,0) node [above] {$R(s)$} (5,0) node [below] {$R(z)$} (5,0) node [above] {$R^*(s)$};
							\node[block] (G) at (t) {$G_1(s)$};
							\path[draw] (G) to [make contact] ++(right:8) coordinate (t);
							\path (10,0) node [above] {$D(s)$} (14,0) node [below] {$D(z)$} (14,0) node [above] {$D^*(s)$};
							\node[block] (G) at (t) {$G_2(s)$};
							\path[draw, -latex] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
							\path (t) node [above left] {$C^*(s)$} (t) node [below left] {$C(z)$};
							\path[draw, dashed, red] (c) to ++(up:1.5) to [make contact=red] ++(right:3);
							\foreach \x in {4,14,22}{
								\draw[gray] (\x,1.5) -- (\x,3.5);
							}
							\path[draw=gray, latex-latex] (4,2.5) -- (14,2.5) node [midway, fill=white] {$G_1(z)$};
							\path[draw=gray, latex-latex] (14,2.5) -- (22,2.5) node [midway, fill=white] {$G_2(z)$}; 
						\end{scope}
					\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
					
				\end{figure}
```

#### 幻灯片：开环系统脉冲传递函数

enumi1
		-  串联环节间无采样开关
	两边离散化得$C^*(s)=R^*(s)[G_1(s)G_2(s)]^*$，Z变换得
	结论：串联环节中间无采样开关时，总的脉冲传函等于各环节传递函数相乘后再取Z变换。

**原始公式代码**

```tex
$$C(s)=G_2(s)C_1(s)=G_2(s)G_1(s)R^*(s)$$
```

**原始公式代码**

```tex
$$C(z)=G_1G_2(z)R(z)\quad\therefore \frac{C(z)}{R(z)}=G_1G_2(z)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, thick]
			\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
			\path (1,0) node [above] {$R(s)$} (5,0) node [below] {$R(z)$} (5,0) node [above] {$R^*(s)$};
			\node[block] (G) at (t) {$G_1(s)$};
			\path[draw, -latex] (G) to ++(right:4) node[above] {$C_1(s)$} to ++(right:3) coordinate (t);
			\node[block] (G) at (t) {$G_2(s)$};
			\path[draw, -latex] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
			\path (t) node [above left] {$C^*(s)$} (t) node [below left] {$C(s)$};
			\path[draw, dashed, red] (c) to ++(up:1.5) to [make contact=red] ++(right:3);
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：开环系统脉冲传递函数

设开环离散系统如图(a)及(b)
	其中$G_1(s)=1/s$，$G_2(s)=10/(s+10)$，试求系统的脉冲传递函数$G(z)$。
	 系统(a)：

**原始公式代码**

```tex
$$G_1(z)=\mZ{\frac{1}{s}}=\frac{z}{z-1}\quad G_2(z)=\mZ{\frac{10}{s+10}}=\frac{10z}{z-e^{-10T}}$$
```

**原始公式代码**

```tex
$$G_a(z)=G_1(z)G_2(z)=\frac{10z^2}{(z-1)(z-e^{-10T})}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, thick]
			\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
			\path (1,0) node [above] {$r(t)$} (5,0) node [below] {$R(z)$} (5,0) node [above] {$r^*(t)$};
			\node[block] (G) at (t) {$G_1(s)$};
			\path[draw] (G) to [make contact] ++(right:8) coordinate (t);
			\path (10,0) node [above] {$d(t)$} (14,0) node [below] {$D(z)$} (14,0) node [above] {$d^*(t)$};
			\node[block] (G) at (t) {$G_2(s)$};
			\path[draw, -latex] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
			\path (t) node [above left] {$c^*(t)$} (t) node [below left] {$C(z)$};
			\path[draw, dashed, red] (c) to ++(up:1.5) to [make contact=red] ++(right:3);
			\node at (25,0) {(a)};
			\begin{scope}[yshift=-5em]
				\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
				\path (1,0) node [above] {$r(t)$} (5,0) node [below] {$R(z)$} (5,0) node [above] {$r^*(t)$};
				\node[block] (G) at (t) {$G_1(s)$};
				\path[draw, -latex] (G) to ++(right:4) node[above] {$d(t)$} to ++(right:3) coordinate (t);
				\node[block] (G) at (t) {$G_2(s)$};
				\path[draw, -latex] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
				\path (t) node [above left] {$c^*(t)$} (t) node [below left] {$C(z)$};
				\path[draw, dashed, red] (c) to ++(up:1.5) to [make contact=red] ++(right:3);
				\node at (25,0) {(b)};
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：开环系统脉冲传递函数

系统(b)

**原始公式代码**

```tex
$$G_1G_2(z)\neq G_1(z)G_2(z)$$
```

**原始公式代码**

```tex
\begin{align*}
		G_1(s)G_2(s)		&=\frac{10}{s(s+10)}\\
		G_b(z)			&=G_1G_2(z)=\mZ{\frac{10}{s(s+10)}}=\frac{z(1-e^{-10T})}{(z-1)(z-e^{-10T})}\\
		G_a(z)			&=G_1(z)G_2(z)=\frac{10z^2}{(z-1)(z-e^{-10T})}
	\end{align*}
```

#### 幻灯片：开环系统脉冲传递函数

enumi2
		-  有零阶保持器的情况
			两边离散化

**原始公式代码**

```tex
$$C(s)=\left(G_0(s)\frac{1-e^{-Ts}}{s}\right)R^*(s)$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, thick]
					\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
					\path (1,0) node [above] {$R(s)$} (5,0) node [above] {$R^*(s)$};
					\node[block] (G) at (t) {$G_h(s)=\frac{1-e^{-Ts}}{s}$};
					\path[arr] (G.east) -- ++ (1.5,0) coordinate (t);
					\node[block] (G) at (t) {$G_0(s)$};
					\path[draw, -latex] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
					\path (t) node [above left] {$C^*(s)$} (t) node [below left] {$C(s)$};
					\path[draw, dashed, red] (c) to ++(up:1.5) to [make contact=red] ++(right:3);
					\path[draw, dashed, red] (4.5,2) rectangle (18.5,-2);
					\node[single arrow, draw, red, fill=red, text width=2em, rotate=-90] at (12,-4) {}; 
					\begin{scope}[yshift=-8em]
						\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
						\path (1,0) node [above] {$R(s)$} (5,0) node [above] {$R^*(s)$};
						\node[block] (G) at (t) {$1-e^{-Ts}$};
						\path[arr] (G.east) -- ++ (1.5,0) coordinate (t);
						\node[block] (G) at (t) {$\frac{G_0(s)}{s}$};
						\path[draw, -latex] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
						\path (t) node [above left] {$C^*(s)$} (t) node [below left] {$C(s)$};
						\path[draw, dashed, red] (c) to ++(up:1.5) to [make contact=red] ++(right:3);
					\end{scope}
					\node at (11,-11) {\alert{$z=e^{Ts}$}};
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
				C^*(s) &= (1-z^{-1})\left(\frac{G_0(s)}{s}\right)^*R^*(s)\\
				C(z)	&= (1-z^{-1})\mZ{\frac{G_0(s)}{s}}R(z)\\
				\therefore\frac{C(z)}{R(z)}	&= (1-z^{-1})\mZ{\frac{G_0(s)}{s}}
			\end{align*}
```

#### 幻灯片：开环系统脉冲传递函数

设离散系统如图，设试求系统的脉冲传递函数。

**原始公式代码**

```tex
$$G_p(s)=\frac{1}{s(s+1)},\quad T=1s$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, circuit ee IEC, thick]
			\path[draw] (0,0) to [make contact] ++(right:6) coordinate (t);
			\path (1,0) node [above] {$r(t)$} (5,0) node [above] {$r^*(t)$} (5,0) node [below] {$R(z)$};
			\node[block] (G) at (t) {$G_h(s)=\frac{1-e^{-Ts}}{s}$};
			\path[arr] (G.east) -- ++ (1.5,0) coordinate (t);
			\node[block] (G) at (t) {$G_p(s)$};
			\path[draw, -latex] (G.east) to ++(right:1) coordinate (c) to ++(right:3) coordinate (t);
			\path (t) node [above left] {$C(z)$} (t) node [below left] {$c(t)$} (t) node [above right, above=1em] {$c^*(t)$};
			\path[draw, dashed, red] (c) to ++(up:1.5) to [make contact=red] ++(right:3);
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
		\frac{G_p(s)}{s}	&=\frac{1}{s^2(s+1)}=\frac{1}{s^2}-\frac{1}{s}+\frac{1}{s+1}\\
		\mZ[\frac{G_p(s)}{s}]	&= \frac{Tz}{(z-1)^2}-\frac{z}{z-1}+\frac{z}{z-e^{-T}}\\
							&= \frac{z[(e^{-T}+T-1)z+(1-Te^{-T}-e^{-T})]}{(z-1)^2(z-e^{-T})}\\
		G(z)					&= (1-z^{-1})\mZ[\frac{G_p(s)}{s}]\overset{T=1}{=}\frac{e^{-1}z+(1-2e^{-1})}{(z-1)(z-e^{-1})}=\frac{0.367z+0.266}{z^2-1.367z+0.367}
	\end{align*}
```

### 闭环脉冲传递函数

#### 幻灯片：闭环系统脉冲传递函数

右边是一种较常见的闭环采样系统结构图
			 该系统的基本方程为
	由eq:7.1-eq:7.3得$E(s)=R(s)-HG(s)E^*(s)$，两边离散化得$E^*(s)=R^*(s)-HG^*(s)E^*(s)$，即
	两边离散化，得
	特征方程为：$1+GH(z)=0$

**原始公式代码**

```tex
$$E^*(s)=\frac{1}{1+GH^*(s)}R^*(s)\xrightarrow{\text{代入\eqref{eq:7.3}}} C(s)=\frac{G(s)}{1+GH^*(s)}R^*(s)$$
```

**原始公式代码**

```tex
$$\frac{C^*(s)}{R^*(s)}=\frac{G^*(s)}{1+GH^*(s)}\quad\text{即}\quad\frac{C(z)}{R(z)}=\frac{G(z)}{1+GH(z)}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick, circuit ee IEC]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=3em] (G) {$G(s)$};
					\node[block, below of = G] (H) {$H(s)$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- +(right:2) node [midway, above] {$E(s)$} coordinate (t);
					\path[draw] ($(sum)+(2,0)$) to [make contact] ($(G.west)-(2,0)$);
					\path[arr] ($(G.west)-(2,0)$) -- (G) node [midway, above] {$E^*(s)$};
					\path[arr] (G.east) -- ++(right:1) coordinate (c1) -- ++(right:0.5) coordinate (c2) -- ++(right:3) coordinate (t);
					\path (t) node [above left] {$C^*(s)$} (t) node [below left] {$C(s)$} (t);
					\path[draw, dashed, red] (c2) to ++(up:1.5) to [make contact=red] ++(right:3);
					\path[arr] (c1) |- (H.east);
					\path[arr] (H.west) -| (sum) node[near end, left] {$-$} node[near end, right] {$B(s)$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

**原始公式代码**

```tex
\begin{align}
				E(s)=R(s)-B(s)\label{eq:7.1}\\
				B(s)=H(s)C(s)\label{eq:7.2}\\
				C(s)=G(s)E^*(s)\label{eq:7.3}
			\end{align}
```

#### 幻灯片：闭环系统脉冲传递函数

设闭环离散系统如图所示，试求$C(z)$。
			 列基本方程
			由eq:7.4两边离散化得
			 C^*(s) =G_2^*(s)C_1^*(s)
			由eq:7.6两边离散化得
			 E^*(s)=R^*(s)-H^*(s)C^*(s)
			将eq:7.8代入eq:7.5得
			 C_1^*(s) 	= G_1^*(s)[R^*(s)-H^*(s)C^*(s)]
			代入eq:7.7：
			 C^*(s)	=G_2^*(s)G_1^*(s)[R^*(s)-H^*(s)C^*(s)]
			整理得

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick, circuit ee IEC]
			\node [cross] (sum) {};
			\node[block, right = of sum, xshift=3em] (G1) {$G_1(s)$};
			\node[block, below of = G1] (H) {$H(s)$};
			\node[block, right = of G1, xshift=3em] (G2) {$G_2(s)$};
			\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
			\path[draw] (sum) -- +(right:2) node [midway, above] {$E(s)$} coordinate (t);
			\path[draw] ($(sum)+(2,0)$) to [make contact] ($(G1.west)-(2,0)$);
			\path[arr] ($(G1.west)-(2,0)$) -- (G1) node [midway, above] {$E^*(s)$};
			\path[draw] (G1.east) -- +(right:2) node [midway, above] {$C_1(s)$} coordinate (t);
			\path[draw] ($(G1.east)+(2,0)$) to [make contact] ($(G2.west)-(2,0)$);
			\path[arr] ($(G2.west)-(2,0)$) -- (G2) node [midway, above] {$C_1^*(s)$};
			\path[arr] (G2.east) -- ++(right:1) coordinate (c1) -- ++(right:0.5) coordinate (c2) -- ++(right:3) coordinate (t);
			\path (t) node [above left] {$C^*(s)$} (t) node [below left] {$C(s)$} (t);
			\path[draw, dashed, red] (c1) to ++(up:1.5) to [make contact=red] ++(right:3);
			\path[draw] (c2) |- ($(H.east)+(4,0)$);
			\path[draw] ($(H.east)+(4,0)$) to [make contact] ($(H.east)+(2,0)$);
			\path[arr] ($(H.east)+(2,0)$) -- (H.east) node [midway, above] {$C^*(s)$};
			\path[arr] (H.west) -| (sum) node[near end, left] {$-$};
			\node at (23,-3) {$\Phi(z)=?$};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

**原始公式代码**

```tex
\begin{align}
				C(s)		&= G_2(s)C_1^*(s)\label{eq:7.4}\\
				C_1^*(s)	&= G_1(s)E^*(s)\label{eq:7.5}\\
				E(s)		&= R(s)-H(s)C^*(s)\label{eq:7.6}
			\end{align}
```

**原始公式代码**

```tex
\begin{align*}
				C^*(s)	&= \frac{G_1^*(s)G_2^*(s)R^*(s)}{1+G_1^*(s)G_2^*(s)H^*(s)}\\
				C(z)		&= \frac{G_1(z)G_2(z)R(z)}{1+G_1(z)G_2(z)H(z)}
			\end{align*}
```

#### 幻灯片：思考：设闭环离散系统如图所示，试求$C(z)$。

列基本方程
			由eq:7.9代入eq:7.11得
			 E(s)=R(s)-G_2(s)C_1^*(s)
			将eq:7.12代入eq:7.10得
			 C_1^*(s)=[G_1(s)R(s)-G_1(s)G_2(s)C_1^*(s)]^*
			eq:7.9离散化得
			 C^*(s)=G_2^*(s)C_1^*(s)
			将eq:7.13代入eq:7.14整理得

**原始公式代码**

```tex
$$\Rightarrow C_1^*(s)=\frac{[G_1(s)R(s)]^*}{1+[G_1(s)G_2(s)]^*}$$
```

**原始公式代码**

```tex
$$C^*(s)=\frac{[G_1(s)R(s)]^*G_2^*(s)}{1+[G_1(s)G_2(s)]^*}$$
```

**原始公式代码**

```tex
$$C(z)=\frac{G_1R(z)G_2(z)}{1+G_1G_2(z)}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick, circuit ee IEC]
			\node [cross] (sum) {};
			\node[block, right = of sum] (G1) {$G_1(s)$};
			\node[block, right = of G1, xshift=3em] (G2) {$G_2(s)$};
			\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
			\path[arr] (sum) -- (G1) node [near start, above] {$E(s)$};
			\path[draw] (G1.east) -- +(right:2) node [midway, above] {$C_1(s)$} coordinate (t);
			\path[draw] ($(G1.east)+(2,0)$) to [make contact] ($(G2.west)-(2,0)$);
			\path[arr] ($(G2.west)-(2,0)$) -- (G2) node [midway, above] {$C_1^*(s)$};
			\path[arr] (G2.east) -- ++(right:1) coordinate (c1) -- ++(right:0.5) coordinate (c2) -- ++(right:3) coordinate (t);
			\path (t) node [above left] {$C^*(s)$} (t) node [below left] {$C(s)$} (t);
			\path[draw, dashed, red] (c1) to ++(up:1.5) to [make contact=red] ++(right:3);
			\path[draw] (c2) -- ++(down:2em) -|  (sum) node[near end, left] {$-$};
			\node at (23,-1) {$\Phi(z)=?$};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

**原始公式代码**

```tex
\begin{align}
				C(s)		&= G_2(s)C_1^*(s)\label{eq:7.9}\\
				C_1^*(s)	&= [G_1(s)E(s)]^*\label{eq:7.10}\\
				E(s)		&= R(s)-C(s)\label{eq:7.11}
			\end{align}
```

## 离散系统稳定定义及充要条件

### s平面与z平面的映射关系

#### 幻灯片：s平面与z平面的映射关系

**s平面与z平面的映射关系**
		在Z变换定义中，(e)$z=e^{sT}$;(b)这就是s平面与z平面的映射关系; (e)--(b);
	令$s=\sigma +\rj\omega$，$z=e^{(\sigma+\rj\omega)T}=e^{\sigma T}e^{\rj\omega T}$，其中$|z|=e^{\sigma T}$，$\psi=\omega T$

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.7em, y=0.7em]
			\path[arr] (-6,0) -- (0,0) node [at end, below right] {0} -- (4,0);
			\path[arr] (0,-4) -- (0,4) node [at end, right] {$\rj$};
			\node at (3,3) {s平面};
			\begin{scope}
			\clip (-6,-4) rectangle (0,4);
			\path [inner color=red, outer color=white, fill opacity=0.5] (0,0) ellipse (6 and 4);
			\end{scope}
			\begin{scope}[xshift=10em]
				\path[arr] (-5,0) -- (0,0) node [at end, below right] {0} -- (5,0);
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$\rj$};
				\node at (3,3) {z平面};
				\filldraw[red, fill opacity=0.5] (0,0) circle (5);
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

**原始表格代码**

```tex
\begin{table}
		\begin{tabular}{cccc}\toprule
			$\sigma$	&\emph{s平面}	&\emph{z平面}	&\emph{映射关系}\\\midrule
			$\sigma=0$	&$s=\rj\omega$	&$|z|=1$	&s平面虚轴$\rightarrow$z平面单位圆\\
			$\sigma<0$	&$s=\sigma+\rj\omega$	&$|z|<1$	&s平面左半部分$\rightarrow$z平面单位圆内\\
			$\sigma>0$	&$s=\sigma+\rj\omega$	&$|z|>1$	&s平面右半部分$\rightarrow$z平面单位圆外\\\bottomrule
		\end{tabular}
	\end{table}
```

### 离散系统稳定的充要条件

#### 幻灯片：离散系统稳定的充要条件

典型离散控制系统如图，其闭环脉冲传递函数：
			特征方程为：$D(z)=1+GH(z)=0$
	**线性离散系统稳定的充要条件**
			-  线性离散系统的特征根全部位于z平面的单位圆内或所有特征根的模全部小于1，及$z_i<1$，$i=1,1,\cdots$；
			-  只要有一个根位于z平面单位圆外，系统就不稳定；
			-  当有根在z平面单位圆上，其他根在单位圆内，系统处于临界稳定。

**原始公式代码**

```tex
$$\Phi_{cr}(z)=\frac{G(z)}{1+GH(z)}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=1em] (G) {$G(s)$};
					\node[block, below of = G] (H) {$H(s)$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} pic {sampler} ++(right:1) coordinate (t);
					\path[arr] (t) -- (G);
					\path[arr] (G.east) -- ++(right:1) coordinate (c) -- ++(right:3) coordinate (t) node [at end, above] {$c(s)$};
					\path[arr] (c) |- (H);
					\path[arr] (H) -| (sum) node [very near end, right] {$-$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

### 离散系统稳定性判断

#### 幻灯片：离散系统的稳定性判据

**判稳的两种方法**
			-  直接求根法（适用范围：低阶离散系统）
			-  劳斯判据（适用范围：高阶离散系统）
	证明：设$z=x+\rj y$，$w=u+\rj v$，令

**原始公式代码**

```tex
$$z=\frac{w+1}{w-1}\quad\text{或者}\quad z=\frac{w-1}{w+1}$$
```

**原始公式代码**

```tex
$$z=\frac{w+1}{w-1}\rightarrow w=\frac{z+1}{z-1}$$
```

**原始公式代码**

```tex
$$w=u+\rj v=\frac{x+\rj y+1}{x+\rj y-1}=\frac{x^2+y^2-1}{(x-1)^2+y^2}-\rj \frac{2y}{(x-1)^2+y^2}$$
```

#### 幻灯片：离散系统的稳定性判据

**原始绘图代码**

```tex
\begin{tikzpicture}[x=0.7em, y=0.7em]
			\tikzfading[name=fade out, inner color=transparent!0, outer color=transparent!100]
			\begin{scope}[xshift=0em]
				\path[arr] (-5,0) -- (0,0) node [at end, below right] {0} -- (5,0);
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$\rj$};
				\node at (4,4) {z平面};
				\filldraw[blue, fill opacity=0.5] (0,0) circle (5);
			\end{scope}
			\path[draw, thick, red, latex-latex, dashed] (1,1) .. controls ++(45:3) and ++(135:3) .. (13,1); 
			\begin{scope}[xshift=10em]
				\path[arr] (-5,0) -- (0,0) node [at end, below right] {0} -- (4,0);
				\path[arr] (0,-5) -- (0,5) node [at end, right] {$\rj$};
				\node at (4,4) {w平面};
				\clip (-6,-4) rectangle (0,4);
				\path [fill=blue, path fading=fade out] (0,0) ellipse (6 and 4);				
			\end{scope}
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

**原始表格代码**

```tex
\begin{table}
		\begin{tabular}{ccc}\toprule
			\emph{z平面}	&\emph{w平面}	&\emph{对应关系}\\\midrule
			$x^2+y^2-1$	&$\Re w=0$	&\multirow{2}{*}{z平面上单位圆对应w平面虚轴}\\
			单位圆	&虚轴	&\\\midrule
			$x^2+y^2<1$	&$\Re w=u<0$	&\multirow{2}{*}{z平面上单位圆内对应w平面虚轴之左}\\
			单位圆内	&虚轴之左	&\\\midrule
			$x^2+y^2>1$	&$\Re w=u>0$	&\multirow{2}{*}{z平面上单位圆外对应w平面虚轴之右}\\
			单位圆外	&虚轴之右	&\\\bottomrule
		\end{tabular}
	\end{table}
```

#### 幻灯片：离散系统的稳定性判据

设离散系统的特征方程为
	试判断系统的稳定性。
	 令$z=(w+1)/(w-1)$，代入$D(z)$中，得
	列劳斯表：
	tabularlcc
		$w^3$	&1	&2
		$w^2$	&2	&40
		$w$		&-19&
		$w^0$	&40	&
	tabular
	系统不稳定，且有两个特征根位于z平面单位圆外。

**原始公式代码**

```tex
$$D(z)=45z^3-117z^2+119z-39=0$$
```

**原始公式代码**

```tex
$$w^3+2w^2+2w+40=0$$
```

#### 幻灯片：离散系统的稳定性判据

设离散系统如图，其中采样周期$T=0.1s$。试求系统稳定时$K$的临界值。
	 求出$G(s)$的Z变换
	由结构图得闭环特征方程$1+G(z)=0$
	特征方程
	令$z=(w+1)/(w-1)$，得

**原始公式代码**

```tex
$$G(z)=\frac{0.632Kz}{z^2-1.368z+0.368}$$
```

**原始公式代码**

```tex
$$1+G(z)=z^2+(0.632K-1.368)z+0.368=0$$
```

**原始公式代码**

```tex
$$\left(\frac{w+1}{w-1}\right)^2+(0632K-1.368)\left(\frac{w+1}{w-1}\right)+0.368=0$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
			\node [cross] (sum) {};
			\node[block, right = of sum, xshift=1em] (G) {$\frac{K}{s(1+0.1s)}$};
			\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$r(t)$};
			\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} pic {sampler} ++(right:1) coordinate (t);
			\path[arr] (t) -- (G);
			\path[arr] (G.east) -- ++(right:1) coordinate (c) -- ++(right:3) node [at end, above] {$c(s)$};
			\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
		\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
		
	\end{figure}
```

#### 幻灯片：离散系统的稳定性判据

化简后得
	列出劳斯表
	tabularlcc
		$w^2$	&0.632K	&2.736-0.632K
		$w^1$	&1.264	&0
		$w^0$	&2.736-0.632K	&0
	tabular
	为保证稳定

**原始公式代码**

```tex
$$0.632Kw^2+1.264w+(2.736-0.632K)=0$$
```

**原始公式代码**

```tex
$$\begin{cases}K>0\\ 2.736-0.632K>0\end{cases}\Rightarrow K_c=4.33$$
```

#### 幻灯片：离散系统的稳定性判据

某离散系统的结构图如下，判断系统的稳定性
	得$G(z)=(1-z^{-1})\mZ[\frac{1}{s(s+1)}]=\frac{1-e^{-T}}{z-e^{-T}}$
	$D(z)=z-2e^{-T}+1=0\rightarrow z=2e^{-T}-1=-0.26$，$|z|<1$，系统稳定

**原始公式代码**

```tex
$$\Phi(z)=\frac{G(z)}{1+G(z)}=\frac{1-e^{-T}}{z-2e^{-T}+1}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
			\node [cross] (sum) {};
			\node[block, right = of sum, xshift=1em] (G1) {$\frac{1-e^{-Ts}}{s}$};
			\node[block, right = of G1](G2) {$\frac{1}{s+1}$};
			\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$r(t)$};
			\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T=1$} pic {sampler} ++(right:1) coordinate (t);
			\path[arr] (t) -- (G1);
			\path[arr] (G1) to (G2);
			\path[arr] (G2.east) -- ++(right:1) coordinate (c) -- ++(right:3) node [at end, above] {$c(s)$};
			\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
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
		G(z)	&=(1-z^{-1})\mZ[\frac{1}{s(s+1)}]\\
		\mZ[\frac{1}{s(s+1)}]	&=\mZ[\frac{1}{s}-\frac{1}{s+1}]=\frac{z(1-e^{-T})}{(z-1)(z-e^{-T})}	
	\end{align*}
```

### 离散系统的稳态误差

#### 幻灯片：离散系统的稳态误差

**终值定理法**
				单位反馈离散系统：定义
	若$\Phi_{er}(z)$极点全部位于z平面的单位圆内，即离散系统稳定，则可用终值定理求稳态误差。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=1em] (G) {$G(s)$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} node [midway, above] {$E(s)$} pic {sampler} ++(right:1) coordinate (t);
					\path[arr] (t) -- (G) node [midway, above] {$E^*(s)$};
					\path[arr] (G.east) -- ++(right:1) coordinate (c) -- ++(right:3) node [at end, above] {$C(s)$};
					\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
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
					E(z)			&= R(z)-C(z)\\
								&= R(z)-\frac{G(z)}{1+G(z)}R(z)\\
								&= \frac{1}{1+G(z)}R(z)\\
					\Phi_{er}(z)	&=\frac{E(z)}{R(z)}=\frac{1}{1+G(z)}
				\end{align*}
```

**原始公式代码**

```tex
\begin{align*}
		e(+\infty)	&= \limit{z}{1}(z-1)E(z)=\limit{z}{1}(z-1)\Phi_{er}(z)R(z)\\
		C(+\infty)	&= \limit{z}{1}(z-1)C(z)
	\end{align*}
```

#### 幻灯片：离散系统的稳态误差

设离散系统如图，其中$G(s)=\frac{K}{s(s+1)}$，$T$为采样周期。试求：
			-  系统稳定时，$T$与$K$应满足的条件；
			-  求稳态误差$e(+\infty)$.
		 1)
	闭环特征方程为：
	令$z=\frac{w+1}{w-1}$，代入上式得$Kw^2+2w+\left[\frac{2(1+e^{-T})}{1-e^{-T}}-K\right]=0$
			劳斯表
			tabularlcc
				$w^2$	&$K$	&$\frac{2(1+e^{-T})}{1-e^{-T}}-K$
				$w^1$	&2		&0
				$w^0$	&$\frac{2(1+e^{-T})}{1-e^{-T}}-K$	&
			tabular;
			欲使系统稳定则$K>0$，
			即

**原始公式代码**

```tex
$$G(z)=\mZ[G(s)]=\frac{Kz(1-e^{-T})}{(z-1)(z-e^{-T})}$$
```

**原始公式代码**

```tex
$$\frac{2(1+e^{-T})}{1-e^{-T}}-K>0$$
```

**原始公式代码**

```tex
$$0<K<\frac{2(1+e^{-T})}{1-e^{-T}}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=1em] (G) {$G(s)$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} node [midway, above] {$E(s)$} pic {sampler} ++(right:1) coordinate (t);
					\path[arr] (t) -- (G) node [midway, above] {$E^*(s)$};
					\path[arr] (G.east) -- ++(right:1) coordinate (c1)  -- ++ (right:0.5) coordinate (c2) -- ++(right:3) node [at end, below] {$C(s)$};
					\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
					\path[dashed, red, draw] (c2) |- ++(1,1.5) pic{sampler} ++ (right:1) coordinate (t);
					\path[arr, dashed, red] (t) -- ++(right:1) node [below] {$C^*(s)$};
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
		&D(z)=1+G(z)=(z-1)(z-e^{-T})+Kz(1-e^{-T})=0\\
		\rightarrow	&z^2+[K(1-e^{-T})-(1+e^{-T})]z+e^{-T}=0
	\end{align*}
```

#### 幻灯片：离散系统的稳态误差

设离散系统如图，其中$G(s)=\frac{K}{s(s+1)}$，$T$为采样周期。试求：
				-  系统稳定时，$T$与$K$应满足的条件；
				-  求稳态误差$e(+\infty)$.
			 2)

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=1em] (G) {$G(s)$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} node [midway, above] {$E(s)$} pic {sampler} ++(right:1) coordinate (t);
					\path[arr] (t) -- (G) node [midway, above] {$E^*(s)$};
					\path[arr] (G.east) -- ++(right:1) coordinate (c1)  -- ++ (right:0.5) coordinate (c2) -- ++(right:3) node [at end, below] {$C(s)$};
					\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
					\path[dashed, red, draw] (c2) |- ++(1,1.5) pic{sampler} ++ (right:1) coordinate (t);
					\path[arr, dashed, red] (t) -- ++(right:1) node [below] {$C^*(s)$};
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
		E(z)	&= R(z)-C(z)=R(z)-\frac{G(z)}{1+G(z)}R(z)=\frac{1}{1+G(z)}R(z)\\
		G(z)	&= \mZ{G(s)}=\frac{Kz(1-e{-T})}{(z-1)(z-e^{-T})}\\
		e(+\infty)	&=\lim(z-1)E(z)
	\end{align*}
```

#### 幻灯片：离散系统的稳态误差

**误差系数法**
		（适用于单位反馈系统，$r(t)$为典型输入的情况）
		型别$v$：开环脉冲传递函数$G(z)$中含有$z=1$极点数
		单位反馈系统，利用误差系数法求$e(+\infty)$，见表：

**原始表格代码**

```tex
\begin{table}
		\begin{tabular}{>{$\displaystyle}c<{$}>{$\displaystyle}c<{$}>{$\displaystyle}c<{$}}\toprule
			r(t)			&\text{\emph{误差系数}}		&e(+\infty)\\\midrule
			1(t)			&K_p=\limit{z}{1}G(z)		&\limit{z}{1}(z-1)\frac{z}{z-1}\frac{1}{1+G(z)}=\frac{1}{1+\limit{z}{1}G(z)}=\frac{1}{1+K_p}\\[2ex]
			t			&K_v=\limit{z}{1}(z-1)G(z)		&\limit{z}{1}(z-1)\frac{Tz}{(z-1)^2}\frac{1}{1+G(z)}=\frac{T}{\limit{z}{1}(z-1)G(z)}=\frac{T}{K_v}\\[2ex]
			\frac{1}{2}t^2	&K_a=\limit{z}{1}(z-1)^2G(z)	&\limit{z}{1}(z-1)\frac{T^2z(z+1)}{2(z-1)^3}\frac{1}{1+G(z)}=\frac{T^2}{\limit{z}{1}(z-1^2)G(z)}=\frac{T^2}{K_a}\\\bottomrule
		\end{tabular}
	\end{table}
```

#### 幻灯片：离散系统的稳态误差

已知系统的输入$r(t)=t$，试求系统的稳态误差。
	 系统开环脉冲传递函数
	可见，系统为I型系统，速度误差系数为
	稳态误差为

**原始公式代码**

```tex
$$G(z)=(1-z^{-1})\mZ{\frac{K}{s^2(s+a)}}=K\frac{(e^{-aT}+aT-1)z+(1-e^{-aT}-aTe^{-aT})}{a^2(z-1)(z-e^{-aT})}$$
```

**原始公式代码**

```tex
$$K_v=\limit{z}{1}[(z-1)G(z)]=\frac{KT}{a}$$
```

**原始公式代码**

```tex
$$e(+\infty)=\frac{T}{K_v}=\frac{a}{K}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=1em] (G1) {$\frac{1-e^{-Ts}}{s}$};
					\node[block, right = of G1](G2) {$\frac{K}{s(s+a)}$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} pic {sampler} ++(right:1) coordinate (t);
					\path[arr] (t) -- (G1);
					\path[arr] (G1) to (G2);
					\path[arr] (G2.east) -- ++(right:1) coordinate (c) -- ++(right:1) node [at end, above] {$C(s)$};
					\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
				\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}
				
			\end{figure}
```

## 离散系统的动态性能分析

### 离散控制系统的时间响应及性能指标

#### 幻灯片：离散控制系统的时间响应及性能指标

**步骤**
		G(z)=(1-z^-1)Ks^2(s+1)=K(e^-T+T-1)z+(1-e^-T-Te^-T)(z-1)(z-e^-T)(z)=G(z)1+G(z)=0.368z+0.264z^2-z+0.632$$

**原始公式代码**

```tex
$$\Phi(z)\xrightarrow{\text{阶跃响应}}c^*(t)\xrightarrow{\text{性能指标定义}}\sigma\
	\end{block}
	\begin{columns}[T]
		\column{.45\textwidth}
			\example{离散系统如图，$T=1s$，$K=1$，试求单位阶跃响应，及其超调量、调节时间、上升时间和峰值时间。}
		\column{.525\textwidth}
			\begin{figure}
				\begin{tikzpicture}[x=1em, y=1em, thick]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=1em] (G1) {$\frac{1-e^{-Ts}}{s}$};
					\node[block, right = of G1](G2) {$\frac{K}{s(s+1)}$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} pic {sampler} ++(right:1) coordinate (t);
					\path[arr] (t) -- (G1);
					\path[arr] (G1) to (G2);
					\path[arr] (G2.east) -- ++(right:1) coordinate (c) -- ++(right:1) node [at end, above] {$C(s)$};
					\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
				\end{tikzpicture}
			\end{figure}
	\end{columns}
	\solution\vs{-1em}
	$$
```

**原始公式代码**

```tex
$$
	当$T=1$，$K=1$时
	$$
```

#### 幻灯片：离散控制系统的时间响应及性能指标

单位阶跃输入时，则
	Z反变换得

**原始公式代码**

```tex
\begin{align*}
		C(z)	&= \Phi(z)R(z)=\frac{0.368z+0.264}{z^2-z+0.632}\frac{z}{z-1}=\frac{0.368z^2+0.264z}{z^3-2z^2+1.632z-0.632}\\
			&=0.368z^{-1}+z^{-2}+1.4z^{-3}+1.4z^{-4}+1.14z^{-5}+0.895z^{-6}+0.802z^{-7}\\
			&+0.868z^{-8}+0.993z^{-9}+1.077z^{-10}+\cdots
	\end{align*}
```

**原始公式代码**

```tex
\begin{align*}
		c^*(t)	&= 0.368\delta(t-T)+\delta(t-2T)+1.4\delta(t-3T)+1.4\delta(t-4T)+1.14\delta(t-5T)\\
				&+0.895\delta(t-6T)+0.802\delta(t-7T)+0.868\delta(t-8T)+0.993\delta(t-9T)+\cdots
	\end{align*}
```

#### 幻灯片：离散控制系统的时间响应及性能指标

由图可知

**原始图示代码**

```tex
\begin{figure}
				\includegraphics[scale=0.45]{../figs/C7f1.eps}
				\caption{系统阶跃响应曲线}
			\end{figure}
```

**原始表格代码**

```tex
\begin{table}
				\begin{tabular}{c>{$}c<{$}}\toprule
					超调量	&\sigma\
					上升时间	&t_r=2s\\
					峰值时间	&t_p=4s\\
					调节时间	&t_s=12s\\\bottomrule
				\end{tabular}
			\end{table}
```

#### 幻灯片：离散控制系统的时间响应及性能指标

离散系统如图，$T=1s$，$K=1$，试求单位阶跃响应，及其超调量、调节时间、上升时间和峰值时间。
	由$T=1s$，$K=1$得

**原始公式代码**

```tex
$$G(z)=\mZ{\frac{K}{s(s+1)}}=\frac{z(1-e^{-T})}{(z-1)(z-e^{-T})}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, thick]
					\node [cross] (sum) {};
					\node[block, right = of sum, xshift=1em, dashed] (G1) {$\frac{1-e^{-Ts}}{s}$};
					\node[block, right = of G1](G2) {$\frac{K}{s(s+1)}$};
					\path[arr] ($(sum)-(2,0)$) -- (sum) node [at start, above] {$R(s)$};
					\path[draw] (sum) -- ++(right:1) node[at end, below right ] {$T$} pic {sampler} ++(right:1) coordinate (t);
					\path[arr] (t) -- (G1);
					\path[arr] (G1) to (G2);
					\path[arr] (G2.east) -- ++(right:1) coordinate (c) -- ++(right:1) node [at end, above] {$C(s)$};
					\path[arr] (c) -- ++(down:2) -| (sum) node [very near end, right] {$-$};
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
		G(z)		&= \frac{0.632z}{(z-1)(z-e^{-T})}\\
		\Phi(z)	&= \frac{G(z)}{1+G(z)}=\frac{0.632z}{z^2-0.736z+0.368}
	\end{align*}
```

#### 幻灯片：离散控制系统的时间响应及性能指标

单位阶跃输入时，则
	Z反变换得

**原始公式代码**

```tex
\begin{align*}
		C(z)	&= \Phi(z)R(z)=\frac{0.632z}{z^2-0.736z+0.368}\frac{z}{z-1}=\frac{0.632z^2}{z^3-1.736z^2+1.104z-0.368}\\
			&=0.632z^{-1}+1.097z^{-2}+1.207z^{-3}+1.117z^{-4}+1.014z^{-5}+0.96z^{-6}+0.968z^{-7}\\
			&+0.99z^{-8}+\cdots
	\end{align*}
```

**原始公式代码**

```tex
\begin{align*}
		c^*(t)	&= 0.632\delta(t-T)+1.097\delta(t-2T)+1.207\delta(t-3T)+1.117\delta(t-4T)+1.014\delta(t-5T)\\
				&+0.96\delta(t-6T)+0.968\delta(t-7T)+0.99\delta(t-8T)+\cdots
	\end{align*}
```

#### 幻灯片：离散控制系统的时间响应及性能指标

由图可知，无保持器
			有保持器
			结论：保持器使系统超调量增大，调节时间增长，相角滞后，降低稳定程度。

**原始图示代码**

```tex
\begin{figure}
				\includegraphics[scale=0.45]{../figs/C7f2.eps}
				\caption{系统阶跃响应曲线}
			\end{figure}
```

**原始表格代码**

```tex
\begin{table}
				\begin{tabular}{c>{$}c<{$}}\toprule
					超调量	&\sigma\
					上升时间	&t_r=2s\\
					峰值时间	&t_p=3s\\
					调节时间	&t_s=5s\\\bottomrule
				\end{tabular}
			\end{table}
```

**原始表格代码**

```tex
\begin{table}
				\begin{tabular}{c>{$}c<{$}}\toprule
					超调量	&\sigma\
					上升时间	&t_r=2s\\
					峰值时间	&t_p=4s\\
					调节时间	&t_s=12s\\\bottomrule
				\end{tabular}
			\end{table}
```
