# Cpt2

- 来源文件：`Cpt2.tex`
- 课程标题：自动控制原理
- 副标题：第二章 控制系统的数学模型

## 引言

### 建模方法

#### 幻灯片：建模方法

**机理建模（分析法）**
根据现有的物理、化学定律对系统各部分的动态进行分析和描述，并给出运动方程。
**电学：基尔霍夫定律**
- **电流定律**  所有进入某节点的电流的总和等于所有离开这节点的电流的总和。
- **电压定律**  沿着闭合回路所有元件两端的电势差（电压）的代数和等于零。

#### 幻灯片：建模方法

**力学：牛顿定律**
- **第一定律** 存在某些参考系，在其中，不受外力的物体都保持静止或匀速直线运动。
- **第二定律** 施加于物体的合外力等于此物体的质量与加速度的乘积。
- **第三定律** 当两个物体互相作用时，彼此施加于对方的力，其大小相等、方向相反。

#### 幻灯片：建模方法

**热力学：热力学定律**
- **第零定律** 若两个热力学系统均与第三个系统处于热平衡状态，此两个系统也必互相处于热平衡。
-  [第一定律]物体内能的增加等于物体吸收的热量和对物体所作的功的总和.（系统经过绝热循环，其所做的功为零，因此第一类永动机是不可能的（即不消耗能量做功的机械）。
-  [第二定律]孤立系统自发地朝着热力学平衡方向──最大熵状态──演化，同样地，第二类永动机永不可能实现。（不可能从单一热源吸取热量，使之完全变为有用功而不产生其他影响）
-  [第三定律]热力学系统的熵在温度趋近于绝对零度时趋于定值，特别地，对于完整晶体，这个定值为零

#### 幻灯片：黑箱建模（实验法）

- **系统辨识** 给系统添加测试信号，记录输出响应，使用数学模型逼近。
- **神经网络** 训练网络权值，最小化输出的最小二乘误差。神经网络建模可看做系统辨识的特例。
系统辨识已经形成了一门独立的学科。本章重点研究分析法。

### 控制理论中的系统模型

#### 幻灯片：控制理论中的系统模型

**数学模型**
系统内各变量之间的关系
静态$\longrightarrow$各阶导数为零
动态$\longrightarrow$各阶变量之间关系
**数学模型的类型**
- **时域($t$)** 微分方程，差分方程，状态方程
- **复数域($s$)** 传递函数，结构图
- **频率域($\omega$)** 频率特性

### 控制系统的微分方程

#### 幻灯片：控制系统的微分方程

**线性定常系统微分方程的一般形式 (2em,0) coordinate(t); (b) at (t) System; (b.east) -- node[above]$c(t)$++(2em,0);**
**建立微分方程的一般步骤**
-  确定输入量、输出量和扰动量，并根据需要引进一些中间变量。
-  根据物理或化学定律，列出微分方程。
-  消去中间变量后得到描述输出量与输入量(包括扰动量)关系的微分方程（标准形式）。

**原始公式代码**

```tex
\begin{align}
	&a_{n}\dod[n]{c(t)}{t}+a_{n-1}\dod[n-1]{c(t)}{t}+\cdots+a_{1}\dod{c(t)}{t}+a_0c(t)\nonumber\\
	=&b_{m}\dod[m]{r(t)}{t}+b_{m-1}\dod[m-1]{r(t)}{t}\cdots+b_{1}\dod{r(t)}{t}+b_0r(t)\label{eq:difEq}
\end{align}
```

### 建模实例

#### 幻灯片：R-L-C 串连电路

由基尔霍夫定律得
消去中间变量$i(t)$
        图像引用：../figs/L3p1.pdf

**原始公式代码**

```tex
\begin{align*}
&u_r(t)=L\dod{i(t)}{t}+Ri(t)+u_c(t)\\
&i(t)=C\dod{u_c(t)}{t}
\end{align*}
```

**原始公式代码**

```tex
\begin{align*}
&LC\dod[2]{u_c(t)}{t}+RC\dod{u_c(t)}{t}+u_c(t)=u_r(t)
\end{align*}
```

#### 幻灯片：有负载效应的电路

图像引用：../figs/L3p2.pdf
	消去中间变量$i_1$，$i_2$，整理得

**原始公式代码**

```tex
\begin{align*}
	&u_r=\frac{1}{C_1}\int(i_1-i_2)\dif t+i_1R_1\\
	&\frac{1}{C_1}\int(i_1-i_2)\dif t=i_2R_2+u_c\\
	&u_c=\frac{1}{C_2}\int i_2\dif t
	\end{align*}
```

**原始公式代码**

```tex
\begin{align*}
	&R_1R_2C_1C_2\dod[2]{u_c}{t}+(R_1C_1+R_2C_2+R_1C_2)\dod{u_c}{t}+u_c=u_r
	\end{align*}
```

#### 幻灯片：机械位移系统

由牛顿第二定律：
$f_M(t)=M\dod[2]{x(t)}{t}$
阻尼器模型：
$f_B(t)=B\dod{x(t)}{t}$
由胡克定律：
$f_K(t)=Kx(t)$
        图像引用：../figs/L3p3.pdf

**原始公式代码**

```tex
\begin{align*}
F(t)&=f_M(t)+f_B(t)+f_K(t)\\
&=M\dod[2]{x(t)}{t}+B\dod{x(t)}{t}+Kx(t)
\end{align*}
```

#### 幻灯片：电枢控制式直流电动机

消去中间变量$i$，$M_m$，$E_b$可得：
        图像引用：../figs/L3p4.pdf

**原始公式代码**

```tex
$$\begin{matrix}T_m\dot{\omega}_m+\omega_m=K_mu_r\\
T_m\ddot{\theta}_m+\dot{\theta}_m=K_mu_r\end{matrix}~~
\begin{cases}T_m=J_mR/(R\cdot f_m+c_e\cdot c_m)&\text{电机时间常数 
}\\ K_m=c_m/(R\cdot f_m+c_e\cdot c_m)&\text{电机传递系数
}\end{cases}$$
```

**原始公式代码**

```tex
\begin{eqnarray*}
\text{电枢回路}&u_r=Ri+E_b&\text{克希霍夫}\\
\text{电枢反电势}&E_b=c_e\cdot\omega_m&\text{楞次定律}\\
\text{电磁力矩}&M_m=c_mi&\text{安培定律}\\
\text{力矩平衡}&J_m\dot{\omega}_m+f_m\omega_m=M_m&\text{牛顿定律}\\
&\omega_m=\dot{\theta}&
\end{eqnarray*}
```

## 控制系统的复数域数学模型

### 非线性模型的线性化

#### 幻灯片：非线性模型的线性化

在给定工作点附近将非线性模型展开为泰勒级数
略去2次及高阶项，得到线性化方程
其中
关键看是否满足叠加原理
本节不作要求，但考研要求
推荐教材：斯坦福

**原始公式代码**

```tex
$$\ddot{c}+\dot{c}=\ddot{r}+r\longrightarrow\text{线性}$$
```

**原始公式代码**

```tex
$$c\ddot{c}+\dot{c}=\ddot{r}+r\longrightarrow\text{非线性}$$
```

**原始公式代码**

```tex
$$y=f(x)=f(x_0)+\left.\dod{f}{x}\right|_{x=x_0}(x-x_0)+\frac{1}{2}\left.\dod[2]{f}{x}\right|_{x=x_0}(x-x_0)^2+\cdots$$
```

**原始公式代码**

```tex
$$y=y_0+K(x-x_0)$$
```

**原始公式代码**

```tex
$$y_0=f(x_0),~~~~K=\left.\dod{f}{x}\right|_{x=x_0}$$
```

### 拉普拉斯变换

#### 幻灯片：导入

**关键词**
		法国，18世纪后期，（1782年《四库全书》，1787年台湾天地会反清，1796年白莲教起义），数学，3L（Lagrange，Laplace，Legendre）
	tabularccc
		图像引用：../figs/C2Lagrange.jpg&图像引用：../figs/C2Laplace.jpg&图像引用：../figs/C2Legendre.jpg
		拉格朗日&拉普拉斯&勒让德
	tabular

#### 幻灯片：导入

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
		\onslide<4->{\node[label=拉格朗日] (Lagrange) at (0,0) {\includegraphics[height=2cm]{../figs/C2Lagrange.jpg}};}
		\node[label=拉普拉斯] (Laplace) at (0,-9) {\includegraphics[height=2cm]{../figs/C2Laplace.jpg}};
		\onslide<3->{\node[label=泊松] (Poisson) at (8,-9) {\includegraphics[height=2cm]{../figs/C2Poisson.jpg}};}
		\onslide<5->{\node[label=傅里叶] (Fourier) at (8,0) {\includegraphics[height=2cm]{../figs/C2Fourier.jpg}};}
		\onslide<6->{\node[label=欧拉] (Euler) at (-8,0) {\includegraphics[height=2cm]{../figs/C2Euler.jpg}};}
		\onslide<2->{\node[label=达朗贝尔] (Alembert) at (-8,-9) {\includegraphics[height=2cm]{../figs/C2Alembert.jpg}};}
		\onslide<7->{\node[label=约翰·伯努利] (Johann) at (-16,0) {\includegraphics[height=2cm]{../figs/C2Johann_Bernoulli.jpg}};}
		\onslide<8->{\node[label=雅各布·伯努利] (Jakob) at (-16,-9) {\includegraphics[height=2cm]{../figs/C2Jakob_Bernoulli.jpg}};}
		\onslide<3->{\path[arr] (Laplace) -- (Poisson) node[midway,above] {博士生};}
		\onslide<4->{\path[arr] (Lagrange) -- (Poisson) node[midway,right] {博士生};}
		\onslide<5->{\path[arr] (Lagrange) -- (Fourier) node[midway,above] {博士生};}
		\onslide<6->{\path[arr] (Euler) -- (Lagrange) node[midway,above] {博士生};}
		\onslide<2->{\path[arr] (Alembert) -- (Laplace) node[midway,above] {博士生};}
		\onslide<7->{\path[arr] (Johann) -- (Euler) node[midway,above] {博士生};}
		\onslide<8->{\path[arr] (Jakob) -- (Johann) node[near end,right] {博士生};}
	\end{tikzpicture}
```

#### 幻灯片：第四讲学习目标

-  掌握拉普拉斯变换的定义
		-   理解拉普拉斯变换微分定理的含义（对导数取拉普拉斯变换）
		-  了解拉普拉斯变换积分定理
		-  理解初值定理的含义
		-  掌握终值定理的应用（求稳态）及其内涵

#### 幻灯片：拉普拉斯变换

**前测：配对定理**
		线性定理，微分定理，积分定理，初值定理，终值定理，位移定理，相似定理，卷积定理
	**拉普拉斯变换的定义**
	其中$s$为复变量，上面的变换简称拉氏变换，记作

**原始公式代码**

```tex
$$F(s) = \int_0^\infty f(t)e^{-st}\dif t$$
```

**原始公式代码**

```tex
$$F(s) = \mathcal{L}[f(t)]$$
```

#### 幻灯片：拉普拉斯变换定理

**线性定理**
	**微分定理——零初始条件**

**原始公式代码**

```tex
$$\mathcal{L}[af_1(t)+bf_2(t)]=a\mL[f_1(t)]+b\mL[f_2(t)]=aF_1(s)+bF_2(s)$$
```

**原始公式代码**

```tex
\begin{align*}
			\mL\left[\fracd{f(t)}{t}\right]	&=sF(s)\onslide+<-4>{-f(0)}\\
			\onslide<3->{\mL\left[\fracd{^2f(t)}{t^2}\right]	&=s^2F(s)\onslide+<-4>{-[sf(0)+\dot{f}(0)]}\\
			&\cdots\\}
			\onslide<4->{\mL\left[\fracd{^nf(t)}{t^n}\right]	&=s^nF(s)\onslide+<-4>{-[s^{n-1}f(0)+s^{n-2}\dot{f}(0)+\cdots+f^{(n-1)}(0)]}}
		\end{align*}
```

#### 幻灯片：拉普拉斯变换定理

**积分定理——零初始条件**
	*$f^{(-1)}(0)=\left.\int f(t)\dif t\right|_{t=0}$

**原始公式代码**

```tex
\begin{align*}
			\mL\left[\int f(t)\dif t\right]	&=\frac{1}{s}F(s)\onslide+<-3>{+\frac{1}{s}f^{(-1)}(0)}\\
			\onslide<2->{\mL\left[\iint f(t)(\dif t)^2\right]	&=\frac{1}{s^2}F(s)\onslide+<-3>{+\frac{1}{s^2}f^{(-1)}(0)+\frac{1}{s}f^{(-2)}(0)}}\\
			\onslide<3->{&\cdots\\
			\mL\left[\idotsint f(t)(\dif t)^n\right]	&=\frac{1}{s^n}F(s)\onslide+<-3>{+\frac{1}{s^n}f^{(-1)}(0)+\cdots+\frac{1}{s}f^{(-n)}(0)}}
		\end{align*}
```

#### 幻灯片：拉普拉斯变换定理

**初值定理**
	**终值定理**
	**位移定理**

**原始公式代码**

```tex
$$f(0_+)=\limit{t}{0+}f(t)=\limit{s}{\infty}sF(s)$$
```

**原始公式代码**

```tex
$$f(\infty)=\limit{t}{\infty}f(t)=\limit{s}{0}sF(s)$$
```

**原始公式代码**

```tex
$$\mL[f(t-\tau_0)]=e^{-\tau_0s}F(s)$$
```

**原始公式代码**

```tex
$$\mL[e^{at}f(t)]=F(s-a)$$
```

#### 幻灯片：拉普拉斯变换定理

**相似定理**
	**卷积定理**
		设$F_1(s)=\mL[f_1(t)]$，$F_2(s)=\mL[f_2(t)]$，则有

**原始公式代码**

```tex
$$\mL\left[f(\frac{t}{a})\right]=aF(as)$$
```

**原始公式代码**

```tex
$$F_1(s)F_2(s)=\mL\left[\int_0^tf_1(t-\tau)f_2(\tau)\dif\tau\right]$$
```

#### 幻灯片：拉普拉斯反变换

**如何求解下式的时间域函数？——部分分式法**
	**首先，分母因式分解**
		其中$s_1$、$s_2$是$D(s)=0$的根。

**原始公式代码**

```tex
$$f(t)=\mathcal{L}^{-1}[F(s)] = \frac{1}{2\pi}\int_{c-j\infty}^{c+j\infty}F(s)e^{st}\dif s,\quad (t>0)$$
```

**原始公式代码**

```tex
$$F(s) = \frac{N(s)}{D(s)} = \frac{b_0s^m+b_1s^{m-1}+\cdots + b_{m-1}s+b_m}{s^n+a_1s^{n-1}+\cdots + a_{n-1}s+a_n}$$
```

**原始公式代码**

```tex
$$F(s) = \frac{N(s)}{D(s)} = \frac{b_0s^m+b_1s^{m-1}+\cdots + b_{m-1}s+b_m}{(s-s_1)(s-s_2)\cdots(s-s_n)}$$
```

#### 幻灯片：部分分式法——$D(s)=0$无重根

$c_1$待定，解法：
	*$\dot{D}(s)=\fracd{D(s)}{s}$

**原始公式代码**

```tex
$$c_i=\limit{s}{s_i}(s-s_i)F(s)\quad\text{或}\quad c_i=\left.\frac{N(s)}{\dot{D}(s)}\right|_{s=s_i}$$
```

**原始公式代码**

```tex
$$f(t)=\mathcal{L}^{-1}[F(s)]=\mathcal{L}^{-1}\left[\sum_{i=1}^{n}\frac{c_i}{s-s_i}\right]=\sum_{i=1}^n c_ie^{s_it}$$
```

**原始公式代码**

```tex
\begin{align*}
		F(s)	&=\frac{N(s)}{D(s)} = \frac{b_0s^m+b_1s^{m-1}+\cdots + b_{m-1}s+b_m}{(s-s_1)(s-s_2)\cdots(s-s_n)}\\
			&=\frac{c_1}{s-s_1}+\frac{c_2}{s-s_2}+\cdots+\frac{c_n}{s-s_n}=\sum_{i=1}^{n}\frac{c_i}{s-s_i}
	\end{align*}
```

#### 幻灯片：求$F(s)$的原函数

**原始公式代码**

```tex
$$F(s)=\frac{s^2+2s+2}{(s+1)(s+2)(s+3)}$$
```

**原始公式代码**

```tex
\begin{align*}
		\onslide<2->{F(s)	&=\frac{c_1}{(s+1)}+\frac{c_2}{(s+2)}+\frac{c_3}{(s+3)}}\\
		\onslide<3->{c_1	&=\limit{s}{-1}(s+1)F(s)=\limit{s}{-1}\frac{s^2+2s+2}{(s+2)(s+3)}=\frac{1}{2}}\\
		\onslide<4->{c_2	&=\limit{s}{-2}(s+2)F(s)=-2}\\
		\onslide<5->{c_3	&=\limit{s}{-3}(s+3)F(s)=\frac{5}{2}}\\
		\onslide<6>{f(t)=	&\mathcal{L}^{-1}[F(s)]=\mathcal{L}^{-1}\left[\sum_{i=1}^{n}\frac{c_i}{s-s_i}\right]=\frac{1}{2}e^{-t}-2e^{-2t}+\frac{5}{2}e^{-3t}\quad (t\ge 0)}
	\end{align*}
```

#### 幻灯片：求$F(s)$的原函数

**原始公式代码**

```tex
$$F(s)=\frac{s-3}{s^2+2s+2}$$
```

**原始公式代码**

```tex
\begin{align*}
		F(s)	&=\frac{s-3}{(s+1)^2+1}=\frac{s+1}{(s+1)^2+1}-\frac{4}{(s+1)^2+1}\\
		f(t)	&=e^{-t}\cos t-4e^{-t}\sin t
	\end{align*}
```

#### 幻灯片：部分分式法——$D(s)=0$有重根

**原始公式代码**

```tex
\begin{align*}
		F(s)	&=\frac{N(s)}{(s-s_1)^r(s-s_{r+1})\cdots(s-s_n)}\\
			&=\frac{c_r}{(s-s_1)^r}+\frac{c_{r-1}}{(s-s_1)^{r-1}}+\cdots\frac{c_1}{(s-s_1)}+\frac{c_{r+1}}{(s-s_{r+1})}+\cdots+\frac{c_n}{(s-s_n)}\\
		c_r	&=\limit{s}{s_1}(s-s_1)^rF(s)\\
		c_{r-1}&=\limit{s}{s_1}\dod{}{s}[(s-s_1)^rF(s)]\\
			&\cdots\\
		c_{r-j}&=\frac{1}{j!}\limit{s}{s_1}\dod[j]{}{s}[(s-s_1)^rF(s)]\\
			&\cdots\\
		c_{1}&=\frac{1}{(r-1)!}\limit{s}{s_1}\dod[r-1]{}{s}[(s-s_1)^rF(s)]
	\end{align*}
```

#### 幻灯片：部分分式法——$D(s)=0$有重根

有重根的部分分式法接拉普拉斯反变换可以总结为

**原始公式代码**

```tex
\begin{align*}
		f(t)	&=\mathcal{L}^{-1}[F(s)]\\
			&=\mathcal{L}^{-1}\left[\frac{c_r}{(s-s_1)^r}+\frac{c_{r-1}}{(s-s_1)^{r-1}}+\cdots+\frac{c_1}{s-s_1}+\frac{c_{r+1}}{s-s_{r+1}}+\cdots+\frac{c_n}{s-s_n}\right]\\
			&=\left[\frac{c_r}{(r-1)!}t^{r-1}+\frac{c_{r-1}}{(r-2)!}t^{r-2}+\cdots+c_2t+c_1\right]e^{s_1t}+\sum_{i=r+1}^n c_ie^{s_it}
	\end{align*}
```

#### 幻灯片：求$F(s)$的原函数

**原始公式代码**

```tex
$$F(s)=\frac{s+2}{(s-1)^2(s+1)}$$
```

**原始公式代码**

```tex
\begin{align*}
		F(s)	&=\frac{c_1}{(s-1)^2}+\frac{c_2}{s-1}+\frac{c_3}{s+1}\\
		c_1	&=\limit{s}{1}(s-1)^2F(s)=\limit{s}{1}\frac{s+2}{s+1}=\frac{3}{2}\\
		c_2	&=\limit{s}{1}\fracd{}{s}[(s-1)^2F(s)]=-\frac{1}{4}\\
		c_3	&=\limit{s}{-1}(s+1)F(s)=\frac{1}{4}\\
		f(t)	&=e^t\left(\frac{3}{2}t-\frac{1}{4}\right)+\frac{1}{4}e^{-t}\quad (t\ge 0)
		\end{align*}
```

### 控制系统的复数域数学模型

#### 幻灯片：控制系统的复数域数学模型

传递函数：经典控制的基础
(0,0)--node[above]$r(t)$(2em,0);
 (b) at (2em,0)$\ddot{c}+\dot{c}=\ddot{r}+r$;
(b.east)--node[above]$c(t)$++(2em,0);
**定义**
零初始条件下输出的拉氏变换比输入拉氏变换。
**典型外作用信号**
- **阶跃** $f(t)=R\cdot1(t)$
- **斜坡** $f(t)=Rt$
- **脉冲** $f(t)=\limit{t_0}{0}\frac{A}{t_0}[1(t)-1(t-t_0)]$
复数域下，理想脉冲信号表示为$\delta(t)$，且有：

**原始公式代码**

```tex
$$\mathcal{L}[\delta(t)]=1$$
```

#### 幻灯片：微分方程与传递函数

回忆线性定常微分方程的一般形式eq:difEq：
零初始条件下，对上式两边取拉氏变换，得：
该系统的传递函数定义为输出与输入之比：

**原始公式代码**

```tex
\begin{align*}
	&a_{0}\dod[n]{c(t)}{t}+a_{1}\dod[n-1]{c(t)}{t}+\cdots+a_{n-1}\dod{c(t)}{t}+a_nc(t)\nonumber\\
	=&b_{0}\dod[m]{r(t)}{t}+b_{1}\dod[m-1]{r(t)}{t}\cdots+b_{m-1}\dod{r(t)}{t}+b_mr(t)\end{align*}
```

**原始公式代码**

```tex
\begin{align}
(a_0s^n+a_1s^{n-1}+\cdots+a_{n-1}s+a_n)C(s)\nonumber\\
=(b_0s^m+b_1s^{m-1}+\cdots+b_{m-1}s+b_m)R(s)
\end{align}
```

**原始公式代码**

```tex
\begin{equation}
G(s)=\frac{C(s)}{R(s)}=\frac{b_0s^m+b_1s^{m-1}+\cdots+b_{m-1}s+b_m}{a_0s^n+a_1s^{n-1}+\cdots+a_{n-1}s+a_n}
\end{equation}
```

#### 幻灯片：线性系统的数学模型

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
		\node[block] (sys) at (0,0) {线性系统};
		\node[block] (tf) at (-12,-8) {传递函数};
		\node[block] (de) at (0,-8) {微分方程};
		\node[block] (fc) at (12,-8) {频率特性};
		\path[arr] (sys) -- (tf);
		\path[arr] (sys) -- (de);
		\path[arr] (sys) -- (fc);
		\path[arr] (de) -- (tf) node[midway,above] {拉氏变换} node[midway,below] {\includegraphics[height=3cm]{../figs/C2Laplace.jpg}};
		\path[arr] (de) -- (fc) node[midway,above] {傅里叶变换} node[midway,below] {\includegraphics[height=3cm]{../figs/C2Fourier.jpg}};
	\end{tikzpicture}
```

#### 幻灯片：传递函数的零极点形式

$s=z_i(i=1,2,\cdots,m)$是$N(s)=0$的根，称为传递函数的零点；$s=p_i(i=1,2,\cdots,n)$是$D(s)=0$的根，称为传递函数的极点。

**原始公式代码**

```tex
\begin{align}
G(s)&=\frac{C(s)}{R(s)}=\frac{b_0s^m+b_1s^{m-1}+\cdots+b_{m-1}s+b_m}{a_0s^n+a_1s^{n-1}+\cdots+a_{n-1}s+a_n}\nonumber\\
&=\frac{N(s)}{D(s)}=\frac{b_0(s-z_1)(s-z_2)\cdots(s-z_m)}{a_0(s-p_1)(s-p_2)\cdots(s-p_n)}
\end{align}
```

#### 幻灯片：传递函数性质

-  TF与信号无关，只取决于系统的结构和参数，与系统的输入和输出位置有关
-  仅适用于线性定常系统
-  分母阶次$n$大于分子阶次$m$，$n>m$
-  分母中$s$的最高阶次$n$即为系统的阶次
-  不能反映非零初始条件的运动
-  由相应零极点组成
-  只反映单输入与单输出的 关系，不反映内部（多入多出系统使用TF矩阵）
-  特征多项式$D(s)=a_0s^n+a_1s^{n-1}+\cdots+a_{n-1}s+a_n$
-  特征方程$D(s)=0$
-  $D(s)=0$的根称为特征根。

### 微分方程求传递函数举例

#### 幻灯片：微分方程求传递函数举例

由ex:RLC，所得系统微分方程为：
拉氏变换得：$LCs^2U_c(s)+RCsU_c(s)+U_c(s)=U_r(s)$，整理得
由ex:load，所得系统微分方程为
拉氏变换得并整理得：

**原始公式代码**

```tex
$$LC\od[2]{u_c(t)}{t}+RC\od{u_c(t)}{t}+u_c(t)=u_r(t)$$
```

**原始公式代码**

```tex
$$\frac{U_c(s)}{U_r(s)}=\frac{1}{LCs^2+RCs+1}$$
```

**原始公式代码**

```tex
$$R_1R_2C_1C_2\od[2]{u_c}{t}+(R_1C_1+R_2C_2+R_1C_2)\dod{u_c}{t}+u_c=u_r$$
```

**原始公式代码**

```tex
$$\frac{U_c(s)}{U_r(s)}=\frac{1}{R_1R_2C_1C_2s^2+(R_1C_1+R_2C_2+R_1C_2)s+1}$$
```

#### 幻灯片：微分方程求传递函数举例

由ex:machine，所得系统微分方程为：
拉氏变换并整理得：
由ex:motor，所得系统微分方程为
拉氏变换得并整理得：

**原始公式代码**

```tex
$$M\od[2]{x(t)}{t}+B\od{x(t)}{t}+Kx(t)=F(t)$$
```

**原始公式代码**

```tex
$$\frac{X(s)}{F(s)}=\frac{1}{Ms^2+Bs+K}$$
```

**原始公式代码**

```tex
$$T_m\dot{\omega}_m+\omega_m=K_mu_r\text{~~或~~}T_m\ddot{\theta}_m+\dot{\theta}_m=K_mu_r$$
```

**原始公式代码**

```tex
$$\frac{\Omega_m(s)}{U_r(s)}=\frac{K_m}{T_ms+1}\text{~~或~~}\frac{\Theta_m(s)}{U_r(s)}=\frac{K_m}{s(T_ms+1)}$$
```

### 典型环节的数学模型

#### 幻灯片：典型环节的数学模型

**1）比例环节**
其输出量和输入量的关系，
式中$K$为环节的放大系数，为常数。传递函数为
- **特点：** 输出与输入量成比例，无失真和时间延迟。
- **实例：** 电子放大器，齿轮，电阻(电位器) 等。

**原始公式代码**

```tex
$$y(t)=Kr(t)$$
```

**原始公式代码**

```tex
$$G(s)=\frac{Y(s)}{R(s)}=K$$
```

#### 幻灯片：典型环节的数学模型

**2）惯性环节**
微分方程式表示
式中$T$为环节的时间常数。传递函数为
- **特点：** 对突变的输入,其输出不能立即复现，输出无振荡。
- **实例：** RC网络，直流伺服电动机的传递函数也包含这一环节。

**原始公式代码**

```tex
$$T\dod{y(t)}{t}+y(t)=r(t)$$
```

**原始公式代码**

```tex
$$G(s)=\frac{Y(s)}{R(s)}=\frac{1}{Ts+1}$$
```

#### 幻灯片：典型环节的数学模型

**3）积分环节**
微分方程式表示
传递函数为
- **特点：** 输出量与输入量的积分成正比例，当输入消失，输出具有记忆功能。
- **实例：** 模拟计算机中的积分器。

**原始公式代码**

```tex
$$y(t)=\int r(t)\dif t$$
```

**原始公式代码**

```tex
$$G(s)=\frac{Y(s)}{R(s)}=\frac{1}{s}$$
```

#### 幻灯片：典型环节的数学模型

**4）微分环节**
是积分的逆运算，微分方程式表示
式中$\tau$为环节的时间常数，传递函数为
- **特点：** 输出量正比输入量变化的速度，能预示输入信号的变化趋势。
- **实例：** 测速发电机输出电压与输入角度间的传递函数即为微分环节。

**原始公式代码**

```tex
$$y(t)=\tau\od{r(t)}{t}$$
```

**原始公式代码**

```tex
$$G(s)=\frac{Y(s)}{R(s)}=\tau s$$
```

#### 幻灯片：典型环节的数学模型

**5）振荡环节：**
二阶微分方程式来表示
传递函数为
- **特点：** 环节中有两个独立的储能元件，并可进行能量交换。
- **实例：** RLC电路的输出与输入电压间的传递函数。

**原始公式代码**

```tex
$$T^2\od[2]{y(t)}{t}+2\zeta T\od{y(t)}{t}+y(t)=r(t)$$
```

**原始公式代码**

```tex
$$G(s)=\frac{Y(s)}{R(s)}=\frac{1}{T^2s^2+2\zeta Ts+1}$$
```

### 典型环节的特点

#### 幻灯片：典型环节的特点

-  环节：具有相同形式传递函数的元部件的分类。
-  不同的元部件可以有相同的传递函数；
-  若输入输出变量选择不同，同一部件可以有不同的传递函数 ；
-  任一传递函数都可看作典型环节的组合，即传递函数的典型环节形式。
例如：

**原始公式代码**

```tex
$$G(s)=\frac{K(2s+1)}{s^v(Ts+1)(\tau^2s^2+2\epsilon\tau s+1)}$$
```

#### 幻灯片：结构相似系统

许多表面上看来似乎毫无共同之处的控制系统，其运动规律可能完全一样，可以用一个运动方程来表示，称它们为结构相似系统。
ex:RLC的RLC电路和ex:machine机械平移系统就可以用同一个数学表达式分析，具有相同的数学模型。

**原始公式代码**

```tex
$$LC\od[2]{u_c(t)}{t}+RC\od{u_c(t)}{t}+u_c(t)=u_r(t)$$
```

**原始公式代码**

```tex
$$M\od[2]{x(t)}{t}+B\od{x(t)}{t}+Kx(t)=F(t)$$
```

## 动态结构图及等效变换

### 动态结构图的组成

#### 幻灯片：动态结构图的组成

**1、信号线：有箭头的直线，箭头表示信号传递方向。**
(0,0)--node[above,midway]$U(s)$(8em,0);
**2、引出点：信号引出或测量的位置。**
(0,0)--node[above,at start]$U(s)$ node[above,very near end]$U(s)$(8em,0);(3em,0)--node[right,near end]$U(s)$(3em,-4em);
从同一信号线上引出的信号，数值和性质完全相同

#### 幻灯片：动态结构图的组成

**3、综合点：对两个或两个以上的信号进行代数运算，“$+$”表示相加，常省略，“$-$”表示相减。**
(0,0)--node[above,very near start]$R(s)$(8em,0);
 (8.5em,0) circle (0.5em);
 (8.15em,0.35em)--(8.85em,-0.35em);
 (8.15em,-0.35em)--(8.85em,0.35em);
(9em,0)--node[above,very near end]$U(s)$(15em,0);
(8.5em,-3em)--node[right,very near start]$B(s)$ node[left,very near end]$\pm$(8.5em,-0.5em);
**4、方框：表示典型环节或其组合，框内为对应的传递函数 ，两侧为输入、输出信号线。**
(0,0)--node[above,at start]$R(s)$ ++(4em,0) coordinate(t);
 (b) at(t) $G(s)$;
(b.east)--node[above,near end]$Y(s)=R(s)G(s)$++(7em,0);

#### 幻灯片：动态结构图的建立

(b1)at(0,0) 工作原理图;
(b1.north)|- ++(4em,4em)coordinate(t);
 (b2)at(t) 方框图;
(b2.east)-| node[above]$G_i(s)$++(4em,-4em)coordinate(t);
 (b3)at(t) 系统结构图;
(b1.south)|- ++(4em,-4em)coordinate(t);
 (b4)at(t) 微分方程组;
(b4.east)-| node[below]$L$(b3.south);

#### 幻灯片：有负载效应的RC网络

**1）由微分方程得到规范的因果关系**
**2）绘动态结构图。按照变量的传递顺序，依次将各元件的结构图连接起来**
(0,0)--node[above,very near start]$U_r(s)$(2em,0);
 (2.5em,0) circle (0.5em) ++(0,-0.5em)coordinate(c1);
(3em,0)--++(1.5em,0)coordinate(t);
 (b1) at (t) $\frac{1}{R_1}$;
(b1.east)--node[above]$I_1(s)$++(3em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(1.5em,0)coordinate(t);
 (b2) at (t) $\frac{1}{sC_1}$;
(b2.east)--node[above,at end]$U_{c_1}(s)$++(1.5em,0)coordinate(o1)--++(1.5em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c3);
(t)--++(1.5em,0)coordinate(t);
 (b3) at (t) $\frac{1}{R_2}$;
(b3.east)--++(1em,0)coordinate(o2)--++(1em,0)coordinate(t);
 (b4) at (t) $\frac{1}{sC_2}$;
(b4.east)--node[above,very near end]$U_c(s)$++(1.5em,0)coordinate(o3)--++(1.5em,0)coordinate(t);
(o1)--++(0,-3em)-|node[right,near end]$U_{c_1}(s)$node[left,very near end]$-$(c1);
(o2)--++(0,3em)-|node[right,very near end]$-$(c2);
(o3)--++(0,-3em)-|node[right,near end]$U_c(s)$node[left,very near end]$-$(c3);
 (-1em,3em)rectangle(6.7em,-3.5em);
 (8em,3.5em)rectangle(11em,-2em);
 (17em,2.5em)rectangle(22em,-3.5em);
 (23em,2.5em)rectangle(26em,-2em);

**原始公式代码**

```tex
\begin{equation*}
\begin{matrix}
\color{red}i_1(t)=\frac{u_r(t)-u_1(t)}{R_1}&\Longrightarrow&\color{red}[U_r(s)-U_{c_1}(s)]\frac{1}{R_1}=I_1(s)\\
\color{blue}u_1(t)=\frac{1}{C_1}\int(i_1(t)-i_2(t))dt&\Longrightarrow&\color{blue}[I_1(s)-I_2(s)]\frac{1}{sC_1}=U_1(s)\\
\color{green}i_2(t)=\frac{u_1(t)-u_C(t)}{R_2}&\Longrightarrow&\color{green}[U_1(s)-U_C(s)]\frac{1}{R_2}=I_2(s)\\
\color{cyan}u_C(t)=\frac{1}{C_2}\int i_2(t)dt&\Longrightarrow&\color{cyan}I_2(s)\frac{1}{sC_2}=U_C(s)\\
\end{matrix}
\end{equation*}
```

### 典型连接方式及等效变换

#### 幻灯片：典型连接方式及等效变换

**1、串联及等效**
(0,0)--node[above,at start]$X(s)$ ++(2em,0) coordinate(t);
 (b1) at(t) $G_1(s)$;
(b1.east)--node[above,midway]$X_1(s)$++(3em,0)coordinate(t);
 (b2) at(t) $G_2(s)$;
(b2.east)--node[above,midway]$Y(s)$++(3em,0)coordinate(t);
(8em,-2em)|-++(3em,-3em)coordinate(t);
scope[xshift=13em,yshift=-5em]
(0,0)--node[above,at start]$X(s)$ ++(2em,0) coordinate(t);
 (b1) at(t) $G(s)$;
(b1.east)--node[above,midway]$Y(s)$++(3em,0)coordinate(t);
scope

**原始公式代码**

```tex
$$\frac{X_1(s)}{X(s)}=G_1(s),~~~\frac{Y(s)}{X_1(s)}=G_2(s)$$
```

**原始公式代码**

```tex
$$G(s)=\frac{Y(s)}{X(s)}=G_1(s)G_2(s)$$
```

#### 幻灯片：典型连接方式及等效变换

**2、并联及等效**
(0,0)--node[above,at start]$X(s)$ ++(2em,0) coordinate(o)--++(1em,0)coordinate(t);
 (b1) at(t) $G_1(s)$;
(b1.east)-|node[above,midway]$Y_1(s)$++(3em,-1em)coordinate(t);
 (t)[yshift=-0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--node[above,near end]$Y(s)$++(3em,0)coordinate(t);
(o)|-++(1em,-3em)coordinate(t);
 (b2) at(t) $G_2(s)$;
(b2.east)-|node[below]$Y_2(s)$node[right,very near end]$\pm$(c);
(15em,-2em)--++(2em,0);
scope[xshift=19em,yshift=-2em]
(0,0)--node[above,at start]$X(s)$ ++(2em,0) coordinate(t);
 (b3) at(t) $G(s)$;
(b3.east)--node[above,midway]$Y(s)$++(3em,0)coordinate(t);
scope

**原始公式代码**

```tex
$$G(s)=G_1(s)\pm G_2(s)$$
```

**原始公式代码**

```tex
\begin{align*}
Y(s)&=Y_1(s)\pm Y_2(s)=X(s)G_1(s)\pm X(s)G_2(s)\\
&=X(s)[G_1(s)\pm G_2(s)]=X(s)G(s)
\end{align*}
```

#### 幻灯片：典型连接方式及等效变换

**3、反馈及等效**
(0,0)--node[above,at start]$R(s)$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--node[above]$E(s)$++(3em,0)coordinate(t);
 (b1) at(t) $G(s)$;
(b1.east)--++(2em,0)coordinate(o)--node[above,near end]$Y(s)$++(1em,0);
(o)|-++(-2em,-3em)coordinate(t);
 (b2) at(t) $H(s)$;
(b2.west)-|node[right,near end]$B(s)$node[left,very near end]$\mp$(c);
(15em,-2em)--++(2em,0);
scope[xshift=19em,yshift=-2em]
(0,0)--node[above,at start]$R(s)$ ++(2em,0) coordinate(t);
 (b3) at(t) $\frac{G(s)}{1\pm G(s)H(s)}$;
(b3.east)--node[above,midway]$Y(s)$++(3em,0)coordinate(t);
scope

**原始公式代码**

```tex
\begin{align*}
&Y(s)=E(s)G(s),~~E(s)=R(s)\mp B(s),~~B(s)=Y(s)H(s)\\
&Y(s)=[R(s)\mp B(s)]G(s)=R(s)G(s)\mp Y(s)H(s)G(s)\\
&Y(s)[1\pm H(s)G(s)]=R(s)G(s)\\
&\frac{Y(s)}{R(s)}=\frac{G(s)}{1\pm H(s)G(s)}
\end{align*}
```

### 等效移动规则

#### 幻灯片：等效移动规则

**1、引出点的移动**
1）前移：在移动支路中串入所越过的传递函数方框
(0,0)--node[below,at start]$X_1$ ++(2em,0) coordinate(t);
 (b1) at(t) $G(s)$;
(b1.east)--++(1em,0)coordinate(o)--node[above,near end]$X_2$++(1em,0);
(o)|-node[below,near end]$X_2$++(2em,-2em)coordinate(t);
(10em,-1em)--++(2em,0);
scope[xshift=13em]
(0,0)--node[above,at start]$X_1$ ++(1em,0)coordinate(o)--++(2em,0) coordinate(t);
 (b2) at(t) $G(s)$;
(b2.east)--node[above,very near end]$X_2$++(3em,0);
(o)|-++(2em,-2em)coordinate(t);
 (b3) at(t) $G(s)$;
(b3.east)--node[above,very near end]$X_2$++(3em,0);
scope
2）后移：在移动支路中串入所越过的传递函数的倒数方框
(0,0)--node[above,at start]$X_1$ ++(1em,0)coordinate(o)--++(2em,0) coordinate(t);
 (b1) at(t) $G(s)$;
(b1.east)--node[above,very near end]$X_2$++(3em,0);
(o)|-node[above,at end]$X_1$++(8em,-2em)coordinate(t);
(11em,-1em)--++(2em,0);
scope[xshift=14em]
(0,0)--node[above,at start]$X_1$ ++(2em,0) coordinate(t);
 (b2) at(t) $G(s)$;
(b2.east)--++(1em,0)coordinate(o)--node[above,very near end]$X_2$++(5em,0);
(o)|-++(2em,-2em)coordinate(t);
 (b3) at(t) $1/G(s)$;
(b3.east)--node[above,very near end]$X_1$++(1em,0);
scope

#### 幻灯片：等效移动规则

**2、综合点的移动**
1）前移：在移动支路中串入所越过的传递函数的倒数方框
(0,0)--node[above,at start]$X_1$ ++(2em,0) coordinate(t);
 (b1) at(t) $G(s)$;
(b1.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--node[above,at end]$X_2$++(2em,0);
(c)--node[right,at start]$-$node[right,at end]$X_3$++(0,-2em);
(10em,-1em)--++(2em,0);
scope[xshift=13em]
(0,0)--node[above,at start]$X_1$ ++(1em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--++(1em,0)coordinate(t);
 (b2) at(t) $G(s)$;
(b2.east)--node[above,very near end]$X_2$++(3em,0);
(c)|-node[right,at start]$-$++(2em,-2em)coordinate(t);
 (b3) at(t) $1/G(s)$;
(b3.east)--node[above,very near end]$X_3$++(3em,0);
scope
2）后移：在移动支路中串入所越过的传递函数方框
(0,0)--node[above,at start]$X_1$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--++(2em,0)coordinate(t);
(c)--node[right,at start]$-$node[right,at end]$X_3$++(0,-2em);
 (b1) at(t) $G(s)$;
(b1.east)--node[above,at end]$X_2$++(1em,0)coordinate(t);
(10em,-1em)--++(2em,0);
scope[xshift=15em]
(0,0)--node[above,at start]$X_1$ ++(2em,0) coordinate(t);
 (b2) at(t) $G(s)$;
(b2.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--node[above,at end]$X_2$++(1em,0)coordinate(t);
(c)|-++(-2em,-2em)coordinate(t);
 (b3) at(t) $G(s)$;
(b3.west)--node[above,very near end]$X_3$++(-2em,0);
scope

#### 幻灯片：等效移动规则

**3）相邻综合点移动**
(0,0)--node[above,at start]$X_1$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--++(2em,0)coordinate(t);
(c)--node[right,at end]$X_2$++(0,-2em);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c);
(t)--node[above,at end]$Y$++(2em,0);
(c)--node[right,at end]$X_3$++(0,2em);
(10em,-1em)--++(2em,0);
scope[xshift=13em]
(0,0)--node[above,at start]$X_1$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c);
(t)--++(2em,0)coordinate(t);
(c)--node[right,at end]$X_3$++(0,2em);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--node[above,at end]$Y$++(2em,0);
(c)--node[right,at end]$X_2$++(0,-2em);
scope
-  相邻综合点之间可以随意调换位置
-  相邻引出点之间可以随意调换位置
注意：相邻引出点和综合点之间不能互换!;

### 结构图等效变换方法

#### 幻灯片：结构图等效变换方法

-  若有三种典型结构，串联，并联或反馈，则直接用公式先化简;
-  若没有三种典型结构，且回路之间有交叉，则必须移位。
-  比较点只能向相邻比较点方向移位，引出点只能向相邻引出点方向移位。且移位后，常常伴随着与相邻综合点或相邻引出点交换位置或综合，以解交叉。
-  由内回路向外回路一层层简化。
-  注意：相邻引出点和综合点之间不能互换!

#### 幻灯片：结构图简化：电枢控制直流电动机

(0,0)--node[above,at start]$U_a$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--++(1em,0)coordinate(t);
 (b1) at(t) $\frac{1}{R}$;
(b1.east)--++(1em,0)coordinate(t);
 (b2) at(t) $C_m$;
(b2.east)--++(1em,0)coordinate(t);
 (b3) at(t) $\frac{1}{J_ms+f_m}$;
(b3.east)--node[above,at end]$\omega$++(1em,0)coordinate(o)--++(1em,0)coordinate(t);
 (b4) at(t) $\frac{1}{s}$;
(b4.east)--node[above,at end]$\theta$++(2em,0);
(o)|-++(-3em,-2em)coordinate(t);
 (b5) at(t) $C_e$;
(b5.west)-|node[left,at end]$-$(c);
(0,0)--node[above,at start]$U_a$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--++(1em,0)coordinate(t);
 (b1) at(t) $\frac{C_m}{R(J_ms+f_m)}$;
(b1.east)--node[above,at end]$\omega$++(1em,0)coordinate(o)--++(1em,0)coordinate(t);
 (b4) at(t) $\frac{1}{s}$;
(b4.east)--node[above,at end]$\theta$++(2em,0);
(o)|-++(-3em,-2em)coordinate(t);
 (b5) at(t) $C_e$;
(b5.west)-|node[left,at end]$-$(c);
(0,0)--node[above,at start]$U_a$ ++(2em,0) coordinate(t);
 (b1) at(t) $\frac{C_m/(Rf_m+C_mC_e)}{\frac{RJ_m}{Rf_m+C_mC_e}s+1}$;
(b1.east)--node[above,midway]$\omega$++(2em,0)coordinate(t);
 (b4) at(t) $\frac{1}{s}$;
(b4.east)--node[above,at end]$\theta$++(2em,0);
(0,0)--node[above,at start]$U_a$ ++(2em,0) coordinate(t);
 (b1) at(t) $\frac{K_m}{s(T_ms+1)}$;
(b1.east)--node[above,at end]$\theta$++(2em,0);

#### 幻灯片：结构图简化

0.8
(0,0)--node[above,at start]$R$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
 (b1) at(t) $G_1$;
(b1.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c2)++(0,1em)coordinate(c3);
(t)--++(4em,0)coordinate(o2)--++(1em,0)coordinate(t);
 (b2) at(t) $G_2$;
(b2.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c4);
(t)--++(1em,0)coordinate(o3)--++(3em,0)coordinate(o4)--++(1em,0)coordinate(t);
 (b3) at(t) $G_3$;
(b3.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c5);
(t)--++(1em,0)coordinate(o5)--node[above,at end]$C$++(1em,0);
(o1)|-++(1em,2.5em)coordinate(t);
 (b4) at(t) $G_4$;
(b4.east)-|(c5);
(o2)|-++(-0.8em,-1.5em)coordinate(t);
 (b5) at(t) $G_1H_1$;
(b5.west)-|node[left,at end]$-$(c2);
(o3)|-++(-6em,1.5em)coordinate(t);
 (b6) at(t) $H_2$;
(b6.west)-|node[left,at end]$-$(c3);
(o4)|-++(-0.8em,-1.5em)coordinate(t);
 (b7) at(t) $G_3H_3$;
(b7.west)-|node[left,at end]$-$(c4);
(o5)|-++(-12em,-2.5em)coordinate(t);
 (b8) at(t) $H_4$;
(b8.west)-|node[left,at end]$-$(c1);
0.8
(0,0)--node[above,at start]$R$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
 (b1) at(t) $G_1$;
(b1.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(1em,0)coordinate(t);
 (b2) at(t) $\frac{1}{1+G_1H_1}G_2\frac{1}{1+G_3H_3}$;
(b2.east)--++(1em,0)coordinate(o2)--++(1em,0)coordinate(t);
 (b3) at(t) $G_3$;
(b3.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c3);
(t)--++(1em,0)coordinate(o3)--node[above,at end]$C$++(1em,0);
(o1)|-++(1em,3em)coordinate(t);
 (b4) at(t) $G_4$;
(b4.east)-|(c3);
(o2)|-++(-5em,2em)coordinate(t);
 (b5) at(t) $H_2$;
(b5.west)-|node[left,at end]$-$(c2);
(o3)|-++(-12em,-2.1em)coordinate(t);
 (b6) at(t) $H_4$;
(b6.west)-|node[left,at end]$-$(c1);
0.8
(0,0)--node[above,at start]$R$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
 (b1) at(t) $G_1$;
(b1.east)--++(1em,0)coordinate(t);
 (b2) at(t) $\frac{G_2}{(1+G_1H_1)(1+G_3H_3)+G_2H_2}$;
(b2.east)--++(1em,0)coordinate(t);
 (b3) at(t) $G_3$;
(b3.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(1em,0)coordinate(o2)--node[above,at end]$C$++(1em,0);
(o1)|-++(1em,2.1em)coordinate(t);
 (b4) at(t) $G_4$;
(b4.east)-|(c2);
(o2)|-++(-12em,-2.1em)coordinate(t);
 (b6) at(t) $H_4$;
(b6.west)-|node[left,at end]$-$(c1);
0.8
(0,0)--node[above,at start]$R$ ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c);
(t)--++(1em,0)coordinate(t);
 (b1) at(t) $G_4+\frac{G_1G_2G_3}{(1+G_1H_1)(1+G_3H_3)+G_2H_2}$;
(b1.east)--++(1em,0)coordinate(o)--node[above,at end]$C$++(1em,0);
(o)|-++(-8em,-2.1em)coordinate(t);
 (b2) at(t) $H_4$;
(b2.west)-|node[left,at end]$-$(c);

#### 幻灯片：引出点移动

(0,0)-- ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(1em,0)coordinate(t);
 (b1) at(t) $G_1$;
(b1.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(1em,0)coordinate(t);
 (b2) at(t) $G_2$;
(b2.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c3);
(t)--++(1em,0)coordinate(t);
 (b3) at(t) $G_3$;
(b3.east)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
 (b4) at(t) $G_4$;
(b4.east)--++(1em,0)coordinate(o2)--++(1em,0);
(o2)|-++(-2.9em,-2em)coordinate(t);
 (b5) at(t) $H_3$;
(b5.west)-|node[left,at end]$-$(c3);
(o2)|-++(-10em,-3em)coordinate(t);
 (b6) at(t) $H_1$;
(b6.west)-|node[left,at end]$-$(c1);
(o1)|-++(-3.5em,1.5em)coordinate(t);
 (b7) at(t) $H_2$;
(b7.west)-|node[left,at end]$-$(c2);
(0,0)-- ++(2em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(1em,0)coordinate(t);
 (b1) at(t) $G_1$;
(b1.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(1em,0)coordinate(t);
 (b2) at(t) $G_2$;
(b2.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c3);
(t)--++(1em,0)coordinate(t);
 (b3) at(t) $G_3$;
(b3.east)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
 (b4) at(t) $G_4$;
(b4.east)--++(1em,0)coordinate(o2)--++(1em,0);
(o2)|-++(-2.9em,-2em)coordinate(t);
 (b5) at(t) $H_3$;
(b5.west)-|node[left,at end]$-$(c3);
(o2)|-++(-10em,-3em)coordinate(t);
 (b6) at(t) $H_1$;
(b6.west)-|node[left,at end]$-$(c1);
(o1)|-++(-3.5em,1.5em)coordinate(t);
 (b7) at(t) $H_2$;
(b7.west)-|node[left,at end]$-$(c2);
(o2)|-++(-3em,1.5em)coordinate(t);
 (b8) at(t) $\frac{1}{G_4}$;
(b8.west)--(b7.east);

#### 幻灯片：综合点移动

(0,0)-- ++(2em,0) coordinate(o1)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(2em,0)coordinate(t);
 (b1) at(t) $G_1$;
(b1.east)--++(2em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(2em,0)coordinate(t);
 (b2) at(t) $G_2$;
(b2.east)--++(2em,0)coordinate(o2)--++(2em,0)coordinate(t);
(o2)|-++(-1em,-3em)coordinate(t);
 (b3) at(t) $H_1$;
(b3.west)-|node[left,at end]$-$(c1);
(o1)|-++(5em,3em)coordinate(t);
 (b4) at(t) $G_3$;
(b4.east)-|(c2);
(0,0)-- ++(2em,0) coordinate(o1)-++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(2em,0)coordinate(t);
 (b1) at(t) $G_1$;
(b1.east)--++(2em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(2em,0)coordinate(t);
 (b2) at(t) $G_2$;
(b2.east)--++(2em,0)coordinate(o2)--++(2em,0)coordinate(t);
(o2)|-++(-1em,-3em)coordinate(t);
 (b3) at(t) $H_1$;
(b3.west)-|node[left,at end]$-$(c1);
(o1)|-++(5em,3em)coordinate(t);
 (b4) at(t) $G_3$;
(b4.east)-|(c2);
(b3.west)--++(-1em,0)coordinate(t);
 (b5) at(t) $G_1$;
(b5.west)-|node[left,at end]$-$($ (c2)+(0,-1em)$);

#### 幻灯片：试简化系统结构图，并求系统传递函数

(0,0)-- node[above,at start]$R(s)$++(3em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(2em,0)coordinate(o1)--++(2em,0)coordinate(t);
 (b1) at(t) $G$;
(b1.east)--++(2em,0)coordinate(o2)--++(2em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--node[above,at end]$Y(s)$++(3em,0);
(o1)|-++(3em,2em)coordinate(t);
 (b2) at(t) $H_1$;
(b2.east)-|(c2);
(o2)|-++(-3em,-2em)coordinate(t);
 (b3) at(t) $H_2$;
(b3.west)-|node[left,at end]$-$(c1);
(o1)..controls($(o1)+(1em,-2em)$)and($(o2)+(-1em,-1em)$)..(o2);
(o1)circle(5pt);
(o2)circle(5pt);
at (17em,-2.5em)方法1:引出点后移;
(0,0)-- node[above,at start]$R(s)$++(3em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
 (b1) at(t) $G$;
(b1.east)--++(1em,0)coordinate(o2)--++(7em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--node[above,at end]$Y(s)$++(3em,0);
(o2)|-++(1em,2em)coordinate(t);
 (b2) at(t) $1/G$;
(b2.east)--++(1em,0)coordinate(t);
 (b3) at(t) $H_1$;
(b3.east)-|(c2);
(o2)|-++(-1em,-2em)coordinate(t);
 (b3) at(t) $H_2$;
(b3.west)-|node[left,at end]$-$(c1);

**原始公式代码**

```tex
$$\frac{Y(s)}{R(s)}=\frac{G+H_1}{1+GH_2}$$
```

#### 幻灯片：试简化系统结构图，并求系统传递函数

(0,0)-- node[above,at start]$R(s)$++(3em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(2em,0)coordinate(o1)--++(2em,0)coordinate(t);
 (b1) at(t) $G$;
(b1.east)--++(2em,0)coordinate(o2)--++(2em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--node[above,at end]$Y(s)$++(3em,0);
(o1)|-++(3em,2em)coordinate(t);
 (b2) at(t) $H_1$;
(b2.east)-|(c2);
(o2)|-++(-3em,-2em)coordinate(t);
 (b3) at(t) $H_2$;
(b3.west)-|node[left,at end]$-$(c1);
(o2)..controls($(o2)+(-1em,-2em)$)and($(o1)+(1em,-1em)$)..(o1);
(o1)circle(5pt);
(o2)circle(5pt);
at (0em,2.5em)方法2:引出点前移;
(0,0)-- node[above,at start]$R(s)$++(3em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--++(6em,0)coordinate(o1)--++(2em,0)coordinate(t);
 (b1) at(t) $G$;
(b1.east)--++(2em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--node[above,at end]$Y(s)$++(3em,0);
(o1)|-++(2em,2em)coordinate(t);
 (b2) at(t) $H_1$;
(b2.east)-|(c2);
(o1)|-++(-1em,-2em)coordinate(t);
 (b3) at(t) $G$;
(b3.west)--++(-1em,0)coordinate(t);
 (b4) at(t) $H_2$;
(b4.west)-|node[left,at end]$-$(c1);

**原始公式代码**

```tex
$$\frac{Y(s)}{R(s)}=\frac{G+H_1}{1+GH_2}$$
```

## 信号流图及梅森公式

#### 幻灯片：课程回顾：控制系统的结构图及其等效变换

**一、动态结构图的组成**
信号线、引出点、综合点、方框
**二、典型连接方式及等效变换**
-  串联等效
-  并联等效
-  反馈等效
**三、等效移动规则**
-  引出点的移动
-  综合点的移动
**四、结构图等效变换方法**

### 信号流图的基本概念

#### 幻灯片：信号流图-拓扑结构

**原始图示代码**

```tex
\begin{figure}
		\includegraphics[height=5cm]{../figs/C2Mobius_strip.jpeg}
		\includegraphics[height=5cm]{../figs/C2Trefoil_knot_arb.png}
		\caption{（左）莫比乌斯环和（右）三叶结（图片引用自\href{https://zh.wikipedia.org/wiki/拓扑学}{\underline{Wikipedia}} ）}
	\end{figure}
```

#### 幻灯片：信号流图的基本概念

信号流图是一种描述系统中各信号传递关系的数学图形。只适用于线性系统。其优点在于流图增益公式实用性。信号流图由节点和支路组成。
		 (x1) [label=left:$x_1$];
		 (x2) [right of=x1, label=above left:$x_2$];
		 (x3) [right of=x2, label=above right:$x_3$];
		 (x4) [right of=x3, label=right:$x_4$];
		 (x1) -- node[above]a(x2);
		 (x2) -- node[above]b(x3);
		 (x3) -- node[above]1(x4);
		 (x3) edge [bend right]node[above]c(x2);
		- **节点[var** ;：]表示系统中的变量。
		- **支路[con** (0,0)--(2em,0);：] 表示变量之间的传输关系。

#### 幻灯片：信流图的基本术语

- **源点：** \ 只有流出支路的节点。对应于系统的输入信号，或称为输入节点。
		- **陷点：** \ 只有输入支路的节点。对应于系统的输出信号，或称为输出节点。
		- **混合节点：** \ 既有输入也有输出的节点。
	call = [draw=orange, rectangle callout, line width=1pt, minimum height=2em, text width=4em]
	(x1)[label=left:$x_1$];
	(x2)[right of=x1, label=above left:$x_2$];
	(x3)[right of=x2, label=above right:$x_3$];
	(x4)[above of=x3, label=left:$x_4$];
	(x5)[right of=x3, label=right:$x_5$];
	(x1) -- node[above]a(x2);
	(x2) -- node[above]b(x3);
	(x3) -- node[above]e(x5);
	(x4) -- node[right]d(x3);
	(x3)edge[bend left]node[above]c(x2);
	<2-> at (0em,-3em)输入节点（源点）;
	 at (12em,4em)输入节点（源点）;
	<3-> at (12em,-3em)输出节点（陷点）;
	<4-> at (4em,2.5em)混合节点;

#### 幻灯片：信流图的基本术语

- **通路：** \ 从某一节点开始沿支路箭头方向到另一节点（或同一节点）构成的路径。
		- **回路：** \ 如果通路的终点就是起点，并且与任何其他节点相交不多于一次。
		- **回环增益：** \ 回环中各支路增益的乘积。
		- **前向通路：** \ 从源点开始并终止于陷点，且与其他节点相交不多于一次的通道。该通路各支路增益乘积称为前向通路增益。
		- **不接触回路：** \ 各回路之间没有任何公共节点。反之称为接触回路 。
		(R)[label=left:$R$];
		 /// in e/R/above/e, a1/e/above/a_1, a2/a1/below/a_2, a3/a2/above/a_3, a4/a3/above/a_4, a5/a4/below/a_5, a6/a5/above/a_6, a7/a6/above/a_7, C/a7/right/C
			()[right of=, label=:$\n$];
		 // in R/1/e, e/G_1/a1, a1/G_2/a2, a2/G_3/a3, a3/1/a4, a4/G_4/a5, a5/G_5/a6, a6/G_6/a7, a7/1/C
			()--node[above]$\y$();
		(a5)edge[bend right]node[below]$-H_4$node[above, near start] II(a2);
		(a7)to[bend left]node[above]$-H_1$node[above, near end] IV(e);
		(a3)edge[bend left]node[below]$-H_2$node[above, near start] I(a1);
		(a6)edge[bend left]node[below]$-H_3$node[above, near start] III(a4);

### 信号流图的绘制

#### 幻灯片：信号流图的绘制

**由结构图绘制信流图**

**原始公式代码**

```tex
\begin{align*}
			\text{\alert{结构图}} &	&\text{\alert{信号流图}}\\
			\text{输入信号} &\hspace{4em}\longrightarrow&\text{源节点}\\
			\text{输出信号} &\hspace{4em}\longrightarrow&\text{陷节点}\\
			\text{比较点，引出点} &\hspace{4em}\longrightarrow&\text{混合节点 }\\
			\text{环节} &\hspace{4em}\longrightarrow&\text{支路}\\
			\text{环节传递函数} &\hspace{4em}\longrightarrow&\text{支路增益 }
		\end{align*}
```

#### 幻灯片：信号流图的绘制

**基本步骤：**
			-  在结构图的信号线上，标出各变量对应节点名称。若比较点之后又有引出点，只需设一个节点。
			-  所有输入为源点，输出为陷点，可以通过引入单位增益支路实现。
			-  将各节点按原来顺序排列；
			-  连接各支路，注意支路增益符号。

#### 幻灯片：由结构图绘制信号流图

(0,0)-- node[above,at start]$r$++(1em,0) coordinate(t);
         (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
        (t)--node[above,midway]$e$++(1em,0)coordinate(t);
         (b1) at(t) $G_1$;
        (b1.east)--++(1em,0)coordinate(t);
         (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c2);
        (t)--node[above,midway]$a_1$++(1em,0)coordinate(t);
         (b2) at(t) $G_2$;
        (b2.east)--++(1em,0)coordinate(t);
         (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c3);
        (t)--node[below,midway]$a_2$++(1em,0)coordinate(t);
         (b3) at(t) $G_3$;
        (b3.east)--node[above,at end]$a_3$++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
         (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c4);
        (t)--node[above,midway]$a_4$++(1em,0)coordinate(t);
         (b4) at(t) $G_4$;
        (b4.east)--++(1em,0)coordinate(o2)--node[above,midway]$a_5$++(1em,0)coordinate(t);
         (b5) at(t) $G_5$;
        (b5.east)--++(1em,0)coordinate(o3)--node[above,at start]$a_6$++(1em,0)coordinate(t);
         (b6) at(t) $G_6$;
        (b6.east)--++(1em,0)coordinate(o4)--node[above,near start]$a_7=c$++(1em,0);
        (o1)|-++(-3em,-2em)coordinate(t);
         (h2) at(t) $H_2$;
        (h2.west)-|node[right,at end]$-$(c2);
        (o3)|-++(-3em,-2em)coordinate(t);
         (h3) at(t) $H_3$;
        (h3.west)-|node[right,at end]$-$(c4);
        (o2)|-++(-4em,2em)coordinate(t);
         (h4) at(t) $H_4$;
        (h4.west)-|node[right,at end]$-$(c3);
        (o4)|-++(-11em,-3em)coordinate(t);
         (h1) at(t) $H_1$;
        (h1.west)-|node[right,at end]$-$(c1);
<2->
(R)[label=left:$R$];
(e)[right of=R,label=above:$e$];
(a1)[right of=e,label=above:$a_1$];
(a2)[right of=a1,label=below:$a_2$];
(a3)[right of=a2,label=above:$a_3$];
(a4)[right of=a3,label=above:$a_4$];
(a5)[right of=a4,label=below:$a_5$];
(a6)[right of=a5,label=above:$a_6$];
(a7)[right of=a6,label=above:$a_7$];
(C)[right of=a7,label=right:$C$];
<3->
(R)--node[above]$1$(e);
(e)--node[above]$G_1$(a1);
(a1)--node[above]$G_2$(a2);
(a2)--node[above]$G_3$(a3);
(a3)--node[above]$1$(a4);
(a4)--node[above]$G_4$(a5);
(a5)--node[above]$G_5$(a6);
(a6)--node[above]$G_6$(a7);
(a7)--node[above]$1$(C);
(a5)edge[bend right]node[below]$-H_4$(a2);
(a7)to[bend left]node[above]$-H_1$(e);
(a3)edge[bend left]node[below]$-H_2$(a1);
(a6)edge[bend left]node[below]$-H_3$(a4);

#### 幻灯片：由结构图绘制信号流图

var=[draw,color=orange,thick,circle,minimum size=0.2em,inner sep=2pt]
con=[draw,color=cyan,thick,-latex]
(0,0)-- node[above,at start]$r$++(1em,0) coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--node[above,midway]$e$++(1em,0)coordinate(t);
 (b1) at(t) $K$;
(b1.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--node[below,midway]$a_1$++(1em,0)coordinate(t);
 (b2) at(t) $0.5$;
(b2.east)--++(1em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c3);
(t)--node[above,midway]$a_2$++(1em,0)coordinate(t);
 (b3) at(t) $\frac{1}{s+1}$;
(b3.east)--node[below,at end]$a_3$++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
 (b4) at(t) $\frac{1}{s^2}$;
(b4.east)--++(1em,0)coordinate(o2)--node[above,midway]$a_4=c$++(1em,0);
(o1)|-++(-3em,2em)coordinate(t);
 (h1) at(t) $5$;
(h1.west)-|node[right,at end]$-$(c2);
(o2)|-++(-3em,-2em)coordinate(t);
 (h2) at(t) $s$;
(h2.west)-|node[right,at end]$-$(c3);
(o2)--++(0,-3em)-|node[right,at end]$-$(c1);
<2->
(r)[label=left:$r$];
(e)[right of=r,label=above:$e$];
(a1)[right of=e,label=above:$a_1$];
(a2)[right of=a1,label=above:$a_2$];
(a3)[right of=a2,label=below:$a_3$];
(a4)[right of=a3,label=above:$a_4$];
(c)[right of=a4,label=right:$c$];
<3->
(r)--node[above]$1$(e);
(e)--node[above]$K$(a1);
(a1)--node[above]$0.5$(a2);
(a2)--node[above]$\frac{1}{s+1}$(a3);
(a3)--node[above]$\frac{1}{s^2}$(a4);
(a4)--node[above]$1$(c);
(a3)edge[bend right]node[above]$-5$(a1);
(a4)edge[bend left]node[below]$-s$(a2);
(a4)edge[bend left]node[above]$-1$(e);

#### 幻灯片：由方程组绘制信号流图

首先按照节点的次序绘出各节点，然后根据各方程式绘制各支路。当所有方程式的信号流图绘制完毕后，即得系统的信号流图。
<2->
(xr)[label=left:$x_r$];
(x1)[right of=xr,label=above:$x_1$];
(x2)[right of=x1,label=below:$x_2$];
(x3)[right of=x2,label=above:$x_3$];
(x4)[right of=x3,label=above:$x_4$];
(xc)[right of=x4,label=right:$x_c$];
<3->
(xr)--node[above]$1$(x1);
(x1)--node[above]$a$(x2);
(x2)--node[above]$b$(x3);
(x3)--node[above]$c$(x4);
(x4)--node[above]$d$(xc);
(xc)edge[bend left]node[above]$-e$(x3);
(x4)edge[bend right]node[above]$-f$(x2);
(xc)edge[bend left]node[above]$-g$(x1);

**原始公式代码**

```tex
\begin{eqnarray*}
&x_1=x_r-gx_c\quad x_2=ax_1-fx_4\quad x_3=bx_2-ex_c\\
&x_4=cx_3\quad x_c=dx_4
\end{eqnarray*}
```

### 梅森（Mason）增益公式

#### 幻灯片：如何求解信号的增益？

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em, node distance=4em, bend angle=60]
		\node[var] (xr) [label=left:$x_r$] {};
		\node[var](x1)[right of=xr, label=above:$x_1$]{};
		\node[var](xc)[right of=x1, label=right:$x_c$]{};
		\path[con](xr)--node[above] {$a$} (x1);
		\path[con](x1)--node[above] {$b$} (xc);
		\begin{scope}[yshift=-7em]
			\node[var] (xr) [label=left:$x_r$] {};
			\node[var] (xc)[right of=xr, label=right:$x_c$] {};
			\path[con] (xr) edge [bend left] node [above] {$a$} (xc);
			\path[con] (xr) edge [bend right] node [below] {$b$} (xc);
		\end{scope}
		\begin{scope}[yshift=-14em]
			\node[var] (xr) [label=left:$x_r$] {};
			\node[var](x1)[right of=xr, label=above:$x_1$]{};
			\node[var](xc)[right of=x1, label=right:$x_c$]{};
			\path[con] (xr) -- node [above] {$1$} (x1);
			\path[con] (x1) -- node [above] {$a$} (xc);
			\path[con] (xc) edge [bend left] node [below] {$b$} (x1);
		\end{scope}
	\end{tikzpicture}
```

#### 幻灯片：梅森（Mason）生平

**Samuel Jefferson Mason (1921–1974)**
	-  Professor and Associate Director of the Research Laboratory of Electronics, MIT.
	-  Leader of the Cognitive Information Processing Unit at Research Laboratory of Electronics, MIT.
	-  博士论文：On the logic of feedback，信号流图发明者（一说为 Claude Shannon）
	-  为盲人设计了OCR及语音合成系统
	图像引用：../figs/C2Mason.jpg

#### 幻灯片：梅森（Mason）增益公式

- **$p$** 总增益
- **$p_k$** 第$k$条前向通路的通路增益
- **$\Delta$** 信号流图的特征式，即
- **$\sum_aL_a$** 所有回路增益之和
- **$\sum_{bc}L_bL_c$** 每两互不接触回路增益乘积之和
- **$\sum_{def}L_dL_eL_f$** 每三个互不接触回路增益乘积之和
- **$\Delta_k$** 在$\Delta$中除去与第$k$条前向通道相接触的回路后的特征式，称为前向通道特征式的余子式。

**原始公式代码**

```tex
$$p=\frac{1}{\Delta}\sum_{k=1}^np_k\Delta_k$$
```

**原始公式代码**

```tex
$$\Delta=1-\sum_aL_a+\sum_{bc}L_bL_c-\sum_{def}L_dL_eL_f+\cdots$$
```

#### 幻灯片：由信号流图计算传递函数

var=[draw,color=orange,thick,circle,minimum size=0.2em,inner sep=2pt]
con=[draw,color=cyan,thick,-latex]
(r)[label=left:$R(s)$];
(x1)[right of=r];
(x2)[right of=x1];
(x3)[right of=x2];
(x4)[right of=x3];
(c)[right of=x4,label=right:$C(s)$];
(r)--node[above]$1$(x1);
(x1)--node[above]$a$(x2);
(x2)--node[above]$b$(x3);
(x3)--node[above]$c$(x4);
(x4)--node[above]$d$(c);
(x1)edge[bend left]node[above]$e$(x4);
(x2)edge[bend left]node[below]$f$(x1);
(x3)edge[bend right]node[above]$g$(x2);
(x4)edge[bend left]node[below]$h$(x3);
			- <2->[回路增益：]$af$，$bg$，$ch$，$ehgf$
			- <3->[每两互不接触回路：]$afch$
			- <5->[前向通路增益：]$p_1=abcd$，$p_2=ed$
<7->
四个单独回路，两个回路互不接触
前向通路两条

**原始公式代码**

```tex
$$\Delta=1-af-bg-ch-ehgf+afch$$
```

**原始公式代码**

```tex
$$\Delta_1=1\quad\Delta_2=1-bg$$
```

**原始公式代码**

```tex
$$\frac{C(s)}{R(s)}=\frac{abcd+ed(1-bg)}{1-af-bg-ch-ehgf+afch}$$
```

#### 幻灯片：求$C(s)/R(s)$：Aex:CbyR1

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\draw[-latex,thick](0,0)-- node[above,at start]{$R$}++(1,0) coordinate(t);
		\node[cross] (s1) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s1)--node[above,midway]{$e$}++(2,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b1) at(t) {$G_1$};
		\draw[-latex,thick](b1.east)--++(1,0)coordinate(t);
		\node[cross] (s2) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s2)--node[above,midway]{$a_1$}++(2,0) coordinate(t);
		\node[draw,rectangle,anchor=west] (b2) at(t) {$G_2$};
		\draw[-latex,thick](b2.east)--++(1em,0)coordinate(t);
		\node[cross] (s3) at (t) [xshift=0.5em] {};
		\draw[-latex,thick](s3)--node[below,midway]{$a_2$}++(2,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b3) at(t) {$G_3$};
		\draw[-latex,thick](b3.east)--++(.5em,0)coordinate(o1)--node[above,at start]{$a_3$}++(1,0)coordinate(t);
		\node[cross] (s4) at (t) [xshift=0.5em] {};
		\draw[-latex,thick](s4)--node[above,midway]{$a_4$}++(2,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b4) at(t) {$G_4$};
		\draw[-latex,thick](b4.east)--++(.5em,0)coordinate(o2)--node[above,midway]{$a_5$}++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b5) at(t) {$G_5$};
		\draw[-latex,thick](b5.east)--++(.5em,0)coordinate(o3)--node[above,at start]{$a_6$}++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b6) at(t) {$G_6$};
		\draw[-latex,thick](b6.east)--++(.5em,0)coordinate(o4)--node[above,near start]{$C$}++(1em,0);
		\draw[-latex,thick](o1)|-++(-3em,-2em)coordinate(t);
		\node[draw,rectangle,anchor=east] (h2) at(t) {$H_2$};
		\draw[-latex,thick](h2.west)-|node[right,at end]{$-$}(s2);
		\draw[-latex,thick](o3)|-++(-3em,-2em)coordinate(t);
		\node[draw,rectangle,anchor=east] (h3) at(t) {$H_3$};
		\draw[-latex,thick](h3.west)-|node[right,at end]{$-$}(s4);
		\draw[-latex,thick](o2)|-++(-4em,2em)coordinate(t);
		\node[draw,rectangle,anchor=east] (h4) at(t) {$H_4$};
		\draw[-latex,thick](h4.west)-|node[right,at end]{$-$}(s3);
		\draw[-latex,thick](o4)|-++(-11em,-3em)coordinate(t);
		\node[draw,rectangle,anchor=east] (h1) at(t) {$H_1$};
		\draw[-latex,thick](h1.west)-|node[right,at end]{$-$}(s1);
		\onslide<2,6>{\path[flow] (b2) -- (b3) --(o1) |- (h2) -| (s2.center) -- (b2);}
		\onslide<3,6>{\path[flow] (b4) -- (b5) --(o3) |- (h3) -| (s4.center) -- (b4);}
		\onslide<4>{\path[flow] (h4) -| (s3.center) --(b3) -- (b4) -- (o2) |- (h4);}
		\onslide<5>{\path[flow] (b1) -- (b2) -- (b3) -- (b4) -- (b5) -- (b6) --(o4) |- (h1) -| (s1.center) -- (b1);}
		\onslide<8>{\path[flow] (s1) -- (b1) -- (b2) -- (b3) -- (b4) -- (b5) -- (b6) -- (o4);}
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
	\onslide<2->{\Delta&=1-[-G_2G_3H_2}\onslide<3->{-G_4G_5H_3}\onslide<4->{-G_3G_4H_4}\onslide<5->{-G_1G_2G_3G_4G_5G_6H_1]}\\
	\onslide<6->{&+(-G_2G_3H_2)(-G_4G_5H_3)}\\
	\onslide<7->{&=1+G_2G_3H_2+G_4G_5H_3+G_3G_4H_4\\
	&+G_1G_2G_3G_4G_5G_6H_1+G_2G_3G_4G_5H_2H_3}\\
	\onslide<8->{P_1&=G_1G_2G_3G_4G_5G_6~~~~\Delta_1=1}\\
	\onslide<9->{\Phi&=\frac{G_1G_2G_3G_4G_5G_6}{1+G_2G_3H_2+G_4G_5H_3+G_3G_4H_4+G_{1-6}H_1+G_{2-5}H_2H_3}}
\end{align*}
```

#### 幻灯片：求$C(s)/R(s)$：Bex:CbyR2

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\draw[-latex,thick](0,0)-- node[above,at start]{$R$}++(1em,0) coordinate(t);
		\node[cross] (s1) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s1)--++(2,0)coordinate(t);
		\node[cross] (s2) at (t)[xshift=0.5em] {}; 
		\draw[-latex,thick](s2)--++(2,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b1) at(t) {$G_1$};
		\draw[-latex,thick](b1.east)--++(2,0)coordinate(t);
		\node[cross] (s3) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s3)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b2) at (t) {$G_2$};
		\draw[-latex,thick](b2.east)--++(2,0)coordinate(o2)--++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b3) at (t) {$G_3$};
		\draw[-latex,thick](b3.east)--++(2,0)coordinate(t);
		\node[cross] (s4) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s4)--++(1em,0)coordinate(o3)--node[above,at start]{$C$}++(1em,0)coordinate(t);
		\draw[-latex,thick](o2)|-++(-3em,-3em)coordinate(t);
		\node[draw,rectangle,anchor=east] (h1) at(t) {$H_1$};
		\draw[-latex,thick](h1.west)-|node[right,at end]{$-$}(s2);
		\draw[-latex,thick](o3)|-++(-3em,-2em)coordinate(t);
		\node[draw,rectangle,anchor=east] (h2) at(t) {$H_2$};
		\draw[-latex,thick](h2.west)-|node[right,at end]{$-$}(s3);
		\draw[-latex,thick](o3)--++(0,-4em)-|node[right,at end]{$-$}(s1);
		\draw[-latex,thick](o1)|-++(3em,3em)coordinate(t);
		\node[draw,rectangle,anchor=west] (b4) at(t) {$G_4$};
		\draw[-latex,thick](b4.east)-|(s4);
		\onslide<2>{\path[flow] (b1) -- (o2) --++(0,-3) -| (s2) -- (b1);}
		\onslide<3>{\draw[flow] (b2) -- (b3) -- (o3) --++(0,-2) -| (s3) -- (b2);}
		\onslide<4>{\draw[flow] (b1) -- (b2) -- (b3) -- (o3) --++(0,-4) -| (s1) -- (b1);}
		\onslide<5>{\draw[flow] (b4) -| (s4) -- (o3) --++(0,-2) -| (s3) -- (o1) |- (b4);}
		\onslide<6>{\draw[flow] (b1) -- (o1) |- (b4) -| (s4) -- (o3) --++(0,-4) -| (s1) -- (b1);}
		\onslide<8>{\draw[flow] (s1) -- (b1) -- (b2) -- (b3) -- (o3);}
		\onslide<9>{\draw[flow] (s1) -- (b1) -- (o1) |- (b4) -| (s4.center) -- (o3);}
	\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{align*}
\onslide<2->{
\Delta&=1-[-G_1G_2H_1\onslide<3->{-G_2G_3H_2}\onslide<4->{-G_1G_2G_3}\onslide<5->{-G_4H_2}\onslide<6->{-G_1G_4]}\\}
\onslide<7->{
&=1+G_1G_2H_1+G_2G_3H_2+G_1G_2G_3+G_4H_2+G_1G_4\\}
\onslide<8->{
P_1&=G_1G_2G_3\quad \quad \Delta_1=1\\}
\onslide<9->{P_2&=G_1G_4\quad \quad \Delta_2=1\\}
\onslide<10->{
\Phi&=\frac{G_1G_2G_3+G_1G_4}{1+G_1G_2H_1+G_2G_3H_2+G_1G_2G_3+G_4H_2+G_1G_4}}
\end{align*}
```

#### 幻灯片：求$C(s)/R(s)$：Cex:CbyR3

<2->回路： I，II，III，IV，V
互不接触回路：<3-> I-III，I-V，III-V，I-IV，II-V，II-IV

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\draw[-latex,thick](0,0)-- node[above,at start]{$R$}++(1em,0) coordinate(t);
		\node[cross] (s1) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s1)--++(1.5,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b1) at(t) {$\frac{1}{R}$};
		\draw[-latex,thick](b1.east)--++(1em,0)coordinate(t);
		\node[cross] (s2) at (t) [xshift=0.5em] {};
		\draw[-latex,thick](s2)--++(1.5,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b2) at(t) {$\frac{1}{Cs}$};
		\draw[-latex,thick](b2.east)--++(.5em,0)coordinate(o1)--++(1,0)coordinate(t);
		\node[cross] (s3) at (t) [xshift=0.5em] {};
		\draw[-latex,thick](s3)--++(1.5,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b3) at(t) {$\frac{1}{R}$};
		\draw[-latex,thick](b3.east)--++(.5em,0)coordinate(o2)--++(1,0)coordinate(t);
		\node[cross] (s4) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s4)--++(1.5,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b4) at(t) {$\frac{1}{Cs}$};
		\draw[-latex,thick](b4.east)--++(.5em,0)coordinate(o3)--++(1,0)coordinate(t);
		\node[cross] (s5) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s5)--++(1.5,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b5) at(t) {$\frac{1}{R}$};
		\draw[-latex,thick](b5.east)--++(.5em,0)coordinate(o4)--++(1,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b6) at(t) {$\frac{1}{Cs}$};
		\draw[-latex,thick](b6.east)--++(.5em,0)coordinate(o5)--node[above,at start]{$C$}++(1em,0);
		\draw[-latex,thick](o1)--++(0,-2em)-|node[above,near start]{\rm I}node[right,at end]{$-$}(s1);
		\draw[-latex,thick](o2)--++(0,2em)-|node[above,near start]{\rm II}node[right,at end]{$-$}(s2);
		\draw[-latex,thick](o3)--++(0,-2em)-|node[above,near start]{\rm III}node[right,at end]{$-$}(s3);
		\draw[-latex,thick](o4)--++(0,2em)-|node[above,near start]{\rm IV}node[right,at end]{$-$}(s4);
		\draw[-latex,thick](o5)--++(0,-2em)-|node[above,near start]{\rm V}node[right,at end]{$-$}(s5);
	\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{align*}
\onslide<4->{
\Delta&=1-5\cdot\frac{-1}{RCs}+6\cdot\frac{1}{(RCs)^2}-\frac{-1}{(RCs)^3}\\}
\onslide<5->{
p_1&=\frac{1}{(RCs)^3}\quad \quad \Delta_1=1\\}
\onslide<6->{
\Phi&=\frac{1}{1+(RCs)^3+5(RCs)^2+6(RCs)}}
\end{align*}
```

#### 幻灯片：求$C(s)/R(s)$：DCbyR4

-1em

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\draw[-latex,thick](0,0)--node[above,at start]{$R$}++(1em,0) coordinate(t);
		\node[cross] (s1) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s1)--++(1,0)coordinate(t);
		\node[cross] (s2) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s2)--++(.5,0)coordinate(o1)--++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b1) at(t) {$G_1$};
		\draw[-latex,thick](b1.east)--++(1em,0)coordinate(t);
		\node[cross] (s3) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s3)--++(4em,0)coordinate(o2)--++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b2) at(t) {$G_2$};
		\draw[-latex,thick](b2.east)--++(1em,0)coordinate(t);
		\node[cross] (s4) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s4)--++(1em,0)coordinate(o3)--++(1em,0)coordinate(o4)--node[above,at start]{$C$}++(1em,0)coordinate(t);
		\draw[-latex,thick](o4)--++(0,-3)-|node[right,at end]{$-$}(s1);
		\draw[-latex,thick](o2)--++(0,-2)-|node[right,at end]{$-$}(s2);
		\draw[-latex,thick](o3)--++(0,-1)-|node[right,at end]{$-$}(s3);
		\draw[-latex,thick](o2)|-++(-1,2)coordinate(t);
		\node[draw,rectangle,anchor=east] (h1) at(t) {$H_1$};
		\draw[-latex,thick](h1.west)-|node[right,at end]{$-$}(s3);
		\draw[-latex,thick](o1)|-++(5,4)coordinate(t);
		\node[draw,rectangle,anchor=west] (b3) at(t) {$G_3$};
		\draw[-latex,thick](b3.east)-|node[right,at end]{$-$}(s4);
		\onslide<2,8>{\path[flow] (h1.west) -| (s3.center) -- (o2) |- (h1.east);}
		\onslide<3>{\path[flow] (b1.east) -- (o2) --++(0,-2) -| (s2.center) -- (b1.west);}
		\onslide<4>{\path[flow] (b2.east) -- (o3) --++(0,-1) -| (s3.center) -- (b2.west);}
		\onslide<5>{\path[flow] (b1.east) -- (b2) -- (o4) --++(0,-3) -| (s1.center) -- (b1.west);}
		\onslide<6,8>{\path[flow] (b3.east) -| (s4.center) -- (o4) --++(0,-3) -| (s1.center) -- (o1) |- (b3.west);}
		\onslide<7>{\path[flow] (b3.east) -| (s4.center) -- (o3) --++(0,-1) -| (s3.center) -- (o2) --++(0,-2) -| (s2.center) --(o1) |-  (b3.west);}
		\onslide<10>{\path[flow] (s1) -- (b1) -- (b2) -- (o4);}
		\onslide<11>{\path[flow] (s1) -- (o1) |- (b3) -| (s4.center) -- (o4);}
	\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{align*}
	\onslide<2->{\Delta&=1-[-H_1}\onslide<3->{-G_1}\onslide<4->{-G_2}\onslide<5->{-G_1G_2}\onslide<6->{+G_3}\onslide<7->{-G_3]}\onslide<8->{-G_3H_1}\\
	\onslide<9->{&=1+H_1+G_1+G_2+G_1G_2-G_3H_1\\}
	\onslide<10->{P_1&=G_1G_2\quad \quad \Delta_1=1\\}
	\onslide<11->{P_2&=-G_3\quad \quad \Delta_2=1+H_1\\}
	\onslide<12->{\Phi&=\frac{G_1G_2-G_3(1+H_1)}{1+H_1+G_1+G_2+G_1G_2-G_3H_1}\\}
	\onslide<13->{&\xlongrightarrow{G_1,G_2,G_3,H_1=\frac{1}{s}}\frac{-1}{s+1}}\onslide<14->{\rightarrow\text{MATLAB求解}}
\end{align*}
```

#### 幻灯片：求$C(s)/R(s)$：Eex:CbyR5

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em, y=1em]
		\draw[-latex,thick](0,0)--node[above,at start]{$R$}++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
		\node[cross] (s1) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s1)--++(1,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b1) at(t) {$G_1$};
		\draw[-latex,thick](b1.east)--++(1,0)coordinate(t);
		\node[cross] (s2) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s2)--++(1em,0)coordinate(t);
		\node[cross] (s3) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s3)--++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b2) at(t) {$G_2$};
		\draw[-latex,thick](b2.east)--++(1,0)coordinate(o2)--++(1em,0)coordinate(t);
		\node[cross] (s4) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s4)--++(1,0)coordinate(o3)--++(1em,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b3) at(t) {$G_3$};
		\draw[-latex,thick](b3.east)--++(1em,0)coordinate(t);
		\node[cross] (s5) at (t)[xshift=0.5em] {};
		\draw[-latex,thick](s5)--++(1,0)coordinate(t);
		\node[draw,rectangle,anchor=west] (b4) at(t) {$G_4$};
		\draw[-latex,thick](b4.east)--++(1,0)coordinate(o4)--node[above,at start]{$C$}++(1em,0)coordinate(t);
		\draw[-latex,thick](o1)|-++(6,3)coordinate(t);
		\node[draw,rectangle,anchor=west] (b6) at (t) {$G_6$};
		\draw[-latex,thick](b6.east)-|node[right,at end]{$-$}(s4);
		\draw[-latex,thick](o1)|-++(2,2)coordinate(t);
		\node[draw,rectangle,anchor=west] (b5) at (t) {$G_5$};
		\draw[-latex,thick](b5.east)-|(s2);
		\draw[-latex,thick](o3)|-++(-3,-2)coordinate(t);
		\node[draw,rectangle,anchor=east] (h2) at (t) {$H_2$};
		\draw[-latex,thick](h2.west)-|(s3);
		\draw[-latex,thick](o4)|-++(-8,-3)coordinate(t);
		\node[draw,rectangle,anchor=east] (h1) at (t) {$H_1$};
		\draw[-latex,thick](h1.west)-|node[right,at end]{$-$}(s1);
		\draw[-latex,thick](o2)--++(0,2em)-|(s5);
		\onslide<2>{\path[flow] (b2) -- (o3) |- (h2) -| (s3.center) -- (b2);}
		\onslide<3>{\path[flow] (b1) -- (b2) -- (b3) -- (b4) -- (o4) |- (h1) -| (s1.center) -- (b1);}
		\onslide<4>{\path[flow] (b1) -- (b2) -- (o2) --++(0,2) -| (s5.center) -- (b4) -- (o4) |- (h1) -| (s1.center) -- (b1);}
		\onslide<6>{\path[flow] (o1) -- (b1) -- (b2) -- (b3) -- (b4) -- (o4);}
		\onslide<7>{\path[flow] (o1) -- (b1) -- (b2) -- (o2) --++ (0,2) -| (s5.center) -- (b4) -- (o4);}
		\onslide<8>{\path[flow] (o1) |- (b5) -| (s2.center) -- (b2) -- (b3) -- (b4) -- (o4);}
		\onslide<9>{\path[flow] (o1) |- (b5) -| (s2.center) -- (b2) -- (o2) --++(0,2) -| (s5) -- (b4) -- (o4);}
		\onslide<10>{\path[flow] (o1) |- (b6) -| (s4) -- (b3) -- (b4) -- (o4);}
		\onslide<11>{\path[flow] (o1) |- (b6) -| (s4) -- (o3) |- (h2) -| (s3) -- (b2) -- (o2) --++(0,2) -| (s5.center) -- (b4) -- (o4);}
	\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{align*}
	\onslide<2->{\Delta&=1-[G_2H_2}\onslide<3->{-G_1G_2G_3G_4H_1}\onslide<4->{-G_1G_2G_4H_1]}\\
	\onslide<5->{&=1-G_2H_2+G_1G_2G_3G_4H_1+G_1G_2G_4H_1\\}
	&\begin{matrix}
		\onslide<6->{P_1=G_1G_2G_3G_4&\Delta_1=1}&\onslide<7->{P_2=G_1G_2G_4&\Delta_2=1\\}
		\onslide<8->{P_3=G_2G_3G_4G_5&\Delta_3=1}&\onslide<9->{P_4=G_2G_4G_5&\Delta_4=1\\}
		\onslide<10->{P_5=-G_3G_4G_6&\Delta_5=1}&\onslide<11->{P_6=-G_6H_2G_2G_4&\Delta_6=1}
	\end{matrix}\\
	\onslide<12->{
	\Phi&=\frac{G_{1-4}+G_{1,2,4}+G_{2-5}+G_{2,4,5}-G_{3,4,6}-G_6H_2G_2G_4}{1-G_2H_2+G_1G_2G_3G_4H_1+G_1G_2G_4H_1}}
\end{align*}
```

#### 幻灯片：小结

-  信号流图的组成
-  信号流图与结构图的关系
-  结构图$\Rightarrow$信号流图

## 控制系统的传递函数

### 传递函数分类

#### 幻灯片：控制系统的传递函数

var=[draw,color=orange,thick,circle,minimum size=0.2em,inner sep=2pt]
con=[draw,color=cyan,thick,-latex]
(0,0)--node[above,at start]$R(s)$++(2em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
(t)--node[above,midway]$E(s)$++(2em,0)coordinate(t);
 (b1) at(t) $G_1(s)$;
(b1.east)--++(2em,0)coordinate(t);
 (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c2);
(t)--++(2em,0)coordinate(t);
 (b2) at(t) $G_2(s)$;
(b2.east)--++(2em,0)coordinate(o1)--node[above,midway]$C(s)$++(2em,0)coordinate(t);
(o1)|-++(-6em,-3em)coordinate(t);
 (h) at (t) $H(s)$;
(h.west)-|node[right,near end]$B(s)$node[right,at end]$-$(c1);
(c2)--node[right,at end]$N(s)$++(0,2em)coordinate(t);
**一、系统的开环传递函数**
定义为把主反馈通道断开，得到的传递函数

**原始公式代码**

```tex
$$G_k(s)=\frac{B(s)}{E(s)}=G_1(s)G_2(s)H(s)$$
```

#### 幻灯片：控制系统的传递函数

**二、输入作用下系统的闭环传递函数**
**三、扰动作用下系统的闭环传递函数**
**四、系统的总输出**

**原始公式代码**

```tex
$$\Phi(s)=\frac{Y(s)}{R(s)}=\frac{G_1(s)G_2(s)}{1+G_1(s)G_2(s)H(s)}$$
```

**原始公式代码**

```tex
$$\Phi_N(s)=\frac{Y_N(s)}{N(s)}=\frac{G_2(s)}{1+G_1(s)G_2(s)H(s)}$$
```

**原始公式代码**

```tex
$$Y(s)=\frac{G_1(s)G_2(s)}{1+G_1(s)G_2(s)H(s)}\cdot R(s)+\frac{G_2(s)}{1+G_1(s)G_2(s)H(s)}\cdot N(s)$$
```

#### 幻灯片：控制系统的传递函数

**五、误差传递函数**
误差信号$E(s)=R(s)-B(s)$
**六、系统的总误差**

**原始公式代码**

```tex
$$\text{输入作用下的误差传递函数}~~\Phi_e(s)=\frac{E(s)}{R(s)}=\frac{1}{1+G_1(s)G_2(s)H(s)}$$
```

**原始公式代码**

```tex
$$\text{扰动作用下的误差传递函数}~~\Phi_{eN}(s)=\frac{E(s)}{N(s)}=\frac{-G_2(s)H(s)}{1+G_1(s)G_2(s)H(s)}$$
```

**原始公式代码**

```tex
$$E(s)=\frac{R(s)-G_2(s)H(s)N(s)}{1+G_1(s)G_2(s)H(s)}$$
```

### 求传递函数实例

#### 幻灯片：求$C(s)/R(s)$，$C(s)/N(s)$

var=[draw,color=orange,thick,circle,minimum size=0.2em,inner sep=2pt]
con=[draw,color=cyan,thick,-latex]

**原始绘图代码**

```tex
\begin{tikzpicture}
\draw[-latex,thick](0,0)--node[above,at start]{$R(s)$}++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
\draw[-latex,thick](t)--++(1em,0)coordinate(t);
\node[draw,rectangle,anchor=west] (b1) at(t) {$G_1$};
\draw[-latex,thick](b1.east)--++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c2);
\draw[-latex,thick](t)--++(1em,0)coordinate(t);
\node[draw,rectangle,anchor=west] (b2) at(t) {$G_2$};
\draw[-latex,thick](b2.east)--++(1em,0)coordinate(o2)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c3);
\draw[-latex,thick](t)--++(1em,0)coordinate(o3)--node[above,at end]{$C(s)$}++(1em,0)coordinate(t);
\draw[-latex,thick](o2)|-++(-2em,-2em)coordinate(t);
\node[draw,rectangle,anchor=east] (h) at (t) {$H$};
\draw[-latex,thick](h.west)-|node[right,at end]{$-$}(c2);
\draw[-latex,thick](o1)|-++(4em,-3em)coordinate(t);
\node[draw,rectangle,anchor=west] (b3) at (t) {$G_3$};
\draw[-latex,thick](b3.east)-|(c3);
\draw[-latex,thick](o3)--++(0,-4em)-|node[right,at end]{$-$}(c1);
\draw[-latex,thick]($(c3)+(0,3em)$)|-++(-5em,-1em)coordinate(t);
\node[draw,rectangle,anchor=east] (b4) at (t) {$G_4$};
\draw[-latex,thick](b4.west)-|($(c1)+(0,1em)$);
\draw[-latex,thick]($(c3)+(0,3em)$)--node[right,at start]{$N(s)$}node[left,very near end]{$-$}($(c3)+(0,1em)$);
\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{align*}
\Delta&=1-[-G_2H-G_1G_2-G_1G_3]+G_1G_2G_3H\\
&=1+G_2H+G_1G_2+G_1G_3+G_1G_2G_3H
\end{align*}
```

**原始公式代码**

```tex
\begin{equation*}\left.
\begin{matrix}
P_1=G_1G_2&\Delta_1=1\\
P_2=G_1G_3&\Delta_2=1+G_2H
\end{matrix}\right\}
\Phi=\frac{G_1G_2+G_1G_3(1+G_2H)}{1+G_2H+G_1G_2+G_1G_3+G_{1-3}H}
\end{equation*}
```

**原始公式代码**

```tex
\begin{equation*}\left.
\begin{matrix}
P_{N1}=-1&\Delta_{N1}=1+G_2H\\
P_{N2}=G_{4,1,2}&\Delta_{N2}=1\\
P_{N3}=G_{4,1,3}&\Delta_{N3}=1+G_2H
\end{matrix}\right\}
\Phi_N=\frac{(-1+G_{1,3,4})(1+G_2H)+G_{1,2,4}}{1+G_2H+G_{1,2}+G_{1,3}+G_{1-3}H}
\end{equation*}
```

#### 幻灯片：梅逊公式求$C(s)$

**原始公式代码**

```tex
$$C(s)=\frac{\alert{R(s)[}G_3G_2(1-G_1H_1)+G_1G_2\alert{]}+G_2(1-G_1H_1)\alert{N(s)}}{1-G_1H_1+G_2H_2+G_1G_2H_3-G_1H_1G_2H_2}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}
\draw[-latex,thick](0,0)--node[above,at start]{$R(s)$}++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
\draw[-latex,thick](t)--node[above,midway]{$E(s)$}++(2em,0)coordinate(t);
\node[draw,rectangle,anchor=west] (b1) at(t) {$G_1(s)$};
\draw[-latex,thick](b1.east)--++(1em,0)coordinate(o2)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c2)++(0,1em)coordinate(c3);
\draw[-latex,thick](t)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c4);
\draw[-latex,thick](t)--++(1em,0)coordinate(t);
\node[draw,rectangle,anchor=west] (b2) at(t) {$G_2(s)$};
\draw[-latex,thick](b2.east)--++(1em,0)coordinate(o3)--node[above,at end]{$C(s)$}++(1em,0)coordinate(t);
\draw[cross] ($(c1)+(0,-2em)$)circle (0.5em)++(0,-0.5em)coordinate(c5)++(0.5em,0.5em)coordinate(c6);
\draw[-latex,thick](o2)|-++(-1em,-2.5em)coordinate(t);
\node[draw,rectangle,anchor=east] (h1) at (t) {$H_1(s)$};
\draw[-latex,thick](h1.west)--node[above,near end]{$-$}(c6);
\draw[-latex,thick]($(c5)+(0,1em)$)--node[right,at end]{$-$}(c1);
\draw[-latex,thick](o3)|-++(-2em,-2.5em)coordinate(t);
\node[draw,rectangle,anchor=east] (h2) at (t) {$H_2(s)$};
\draw[-latex,thick](h2.west)-|node[right,at end]{$-$}(c2);
\draw[-latex,thick](o3)|-++(-6em,-4em)coordinate(t);
\node[draw,rectangle,anchor=east] (h3) at (t) {$H_3(s)$};
\draw[-latex,thick](h3.west)-|(c5);
\draw[-latex,thick](o1)|-++(3em,2.5em)coordinate(t);
\node[draw,rectangle,anchor=west] (b3) at (t) {$G_3(s)$};
\draw[-latex,thick](b3.east)-|(c3);
\draw[-latex,thick]($(c4)+(0,3em)$)--node[right,at start]{$N(s)$}(c4);
\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{equation*}
\begin{matrix}
L_1=G_1H_1&L_2=-G_2H_2\\
L_3=-G_1G_2H_3&L_1L_2=(G_1H_1)(-G_2H_2)
\end{matrix}
\end{equation*}
```

#### 幻灯片：梅逊公式求$E(s)$

**原始公式代码**

```tex
$$E(s)=\frac{\alert{R(s)[}(1+G_2H_2)+(-G_3G_2H_3)\alert{]}+(-G_2H_3)\alert{N(s)}}{1-G_1H_1+G_2H_2+G_1G_2H_3-G_1H_1G_2H_2}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}
\draw[-latex,thick](0,0)--node[above,at start]{$R(s)$}++(1em,0)coordinate(o1)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c1);
\draw[-latex,thick,color=red]($(t)+(2em,0)$)--($(t)+(4em,1em)$);
\draw[-latex,thick](t)--node[above,near start]{$E(s)$}++(4em,0)coordinate(t);
\node[draw,rectangle,anchor=west] (b1) at(t) {$G_1(s)$};
\draw[-latex,thick](b1.east)--++(1em,0)coordinate(o2)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,-0.5em)coordinate(c2)++(0,1em)coordinate(c3);
\draw[-latex,thick](t)--++(1em,0)coordinate(t);
\draw[cross] (t)[xshift=0.5em] circle (0.5em)++(0.5em,0)coordinate(t)++(-0.5em,0.5em)coordinate(c4);
\draw[-latex,thick](t)--++(1em,0)coordinate(t);
\node[draw,rectangle,anchor=west] (b2) at(t) {$G_2(s)$};
\draw[-latex,thick](b2.east)--++(1em,0)coordinate(o3)--node[above,at end]{$C(s)$}++(1em,0)coordinate(t);
\draw[cross] ($(c1)+(0,-2em)$)circle (0.5em)++(0,-0.5em)coordinate(c5)++(0.5em,0.5em)coordinate(c6);
\draw[-latex,thick](o2)|-++(-1em,-2.5em)coordinate(t);
\node[draw,rectangle,anchor=east] (h1) at (t) {$H_1(s)$};
\draw[-latex,thick](h1.west)--node[above,near end]{$-$}(c6);
\draw[-latex,thick]($(c5)+(0,1em)$)--node[right,at end]{$-$}(c1);
\draw[-latex,thick](o3)|-++(-2em,-2.5em)coordinate(t);
\node[draw,rectangle,anchor=east] (h2) at (t) {$H_2(s)$};
\draw[-latex,thick](h2.west)-|node[right,at end]{$-$}(c2);
\draw[-latex,thick](o3)|-++(-6em,-4em)coordinate(t);
\node[draw,rectangle,anchor=east] (h3) at (t) {$H_3(s)$};
\draw[-latex,thick](h3.west)-|(c5);
\draw[-latex,thick](o1)|-++(3em,2.5em)coordinate(t);
\node[draw,rectangle,anchor=west] (b3) at (t) {$G_3(s)$};
\draw[-latex,thick](b3.east)-|(c3);
\draw[-latex,thick]($(c4)+(0,3em)$)--node[right,at start]{$N(s)$}(c4);
\end{tikzpicture}
```

**原始公式代码**

```tex
\begin{equation*}
\begin{matrix}
P_1=1&\Delta_1=1+G_2H_2\\
P_2=-G_3G_2H_3&\Delta_2=1\\
\alert{P_1=-G_2H_3}&\alert{\Delta_1=1}
\end{matrix}
\end{equation*}
```

#### 幻灯片：本章小结

-  掌握建立微分方程的方法
-  掌握拉氏变换求解微分方程的方法
-  牢固掌握系统传递函数的定义
-  能熟练地进行动态结构图等效变换
-  能熟练运用梅逊公式求取系统传递函数
-  了解控制系统中各种传递函数的定义
