# Design

- 来源文件：`Design.tex`
- 课程标题：自动控制原理
- 副标题：控制系统综合

## 问题描述

### 磁盘驱动器

#### 幻灯片：问题描述：磁盘驱动器

磁盘驱动器是目前最有效和方便的数据存储介质之一。过去，人们一直在尝试增大磁盘的存储密度并缩短存取时间。在上世纪90年代，磁盘驱动器的数据密度以每年60\

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.3]{../figs/LDp1.pdf}
\caption{磁盘驱动器结构图}
\label{fig:1} 
\end{figure}
```

### 磁盘驱动器闭环系统

#### 幻灯片：问题描述：磁盘驱动器闭环系统

磁盘驱动器使用读写头读取存储在磁盘轨道上的数据。磁盘驱动器的读取装置将读写头准确的定位在相应轨道上。影响控制精度的变量就是读写头的位置（安装在滑动装置上）。磁盘以每分钟1800$\sim$7200转的速度转动，读写头“飞”至磁盘表面上方，且与磁盘表面的工作距离小于100\,nm。位置精度的初始指标是1$\mu$m。此外，读写头应该能够在50\,ms内从轨道a移动到轨道b。由此，可以得到初始的系统结构图：
所得闭环系统使用电机作为执行机构，驱动读写臂到磁盘上的期望位置。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick]
	\path[line](0,0)--node[above,at start]{\alert{期望磁头位置}}++(4,0)coordinate(t);
	\node[cross,anchor=west](c)at(t){};
	\path[line](c.east)--node[above]{误差}++(3,0)coordinate(t);
	\node[block](b1)at(t){控制装置};
	\path[line](b1.east)--++(1,0)coordinate(t);	
	\node[block,text width=4em](b2)at (t){执行电机和读写臂};
	\path[line](b2.east)--++(2,0)coordinate(o)--node[above,at end]{\alert{实际磁头位置}}++(2,0);
	\node[block,below of=b1](b3){传感器};
	\path[line](o)|-(b3.east);
	\path[line](b3.west)-|node[right,at end]{$-$}(c.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}

\caption{磁盘驱动器闭环系统}
\label{fig:2}
\end{figure}
```

## 磁盘读写系统的数学模型

### 读写臂

#### 幻灯片：磁盘读写系统的数学模型：读写臂

前面确定了磁盘驱动系统的两个初始目标：
-  精确定位读写头至期望轨道
-  在50\,ms内由一条轨道移动到另一条轨道
首先确定控制对象$G(s)$和传感器的数学模型。磁盘驱动器使用永磁直流电机使得读写臂旋动。直流电机使用所谓的音圈电动机。音圈电动机是为适应计算机外围设备存储容量增大的需要而发展起来的一种高精度直线定位用的新型执行元件。读写头安装在滑动装置上，而滑动装置连接在读写臂上，如右图所示：

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.3]{../figs/LDp2.pdf}
\caption{读写臂结构}
\label{fig:3} 
\end{figure}
```

### 方框图

#### 幻灯片：磁盘读写系统的数学模型：方框图

曲部（Flexure，一片有弹性的金属）使得读写头浮动于磁盘面上方100\,nm的间隙之间。贴片电阻读写头读取磁通量并把信号传递至放大器。图fig:4中的误差信号读取自事先记录在索引轨道中的误差。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{期望磁头位置}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c)at(t){};
	\path[line](c.east)--node[above]{误差}++(3,0)coordinate(t);
	\node[block,text width=4em](b1)at(t){放大器};
	\node[block,anchor=south]at(b1.north){控制装置};
	\path[line](b1.east)--node[above,text width=2em]{输入电压}++(3,0)coordinate(t);	
	\node[block,text width=7em](b2)at (t){直流电机和摇臂};
	\node[block,text width=7em,anchor=south]at(b2.north){执行器和读写臂};
	\path[line](b2.east)--++(2,0)coordinate(o)--node[below,at end,text width=2em]{\alert{实际磁头位置}}++(2,0);
	\node[block,below of=b1](b3)at($(b1.north)+(5,-2)$){读写头和磁盘上的索引轨道};
	\node[block,text width=12em,anchor=south]at(b3.north){传感器};
	\path[line](o)|-(b3.east);
	\path[line](b3.west)-|node[right,at end]{$-$}(c.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}[htbp]

\caption{磁盘读写系统方框图}
\label{fig:4}
\end{figure}
```

#### 幻灯片：磁盘读写系统的数学模型

假设读写准确，则传感器的传递函数为$H(s)=1$，如图fig:5所示。永磁电机和线性放大器的模型也如图fig:5所示。为了更好的近似，这里使用电枢控制直流电机的模型。
图fig:5的模型假定曲部是刚体，也就是不会显著发生形变。以后将会考虑有形变的模型，不再是完全的刚体。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c)at(t){};
	\path[line](c.east)--node[above]{$E(s)$}++(3,0)coordinate(t);
	\node[block,text width=3em](b1)at(t){$K_a$};
	\node[block,anchor=south]at(b1.north){放大器};
	\path[line](b1.east)--node[above,text width=2em]{$V(s)$}++(3,0)coordinate(t);	
	\node[block,text width=10em](b2)at (t){$G(s)=\frac{K_m}{s(Js+b)(Ls+R)}$};
	\node[block,text width=10em,anchor=south]at(b2.north){执行器和读写臂$G(s)$};
	\path[line](b2.east)--++(2,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\node[block,below of=b1,text width=4em](b3)at($(b1.north)+(5,-2)$){$H(s)=1$};
	\node[block,text width=4em,anchor=south]at(b3.north){传感器};
	\path[line](o)|-(b3.east);
	\path[line](b3.west)-|node[right,at end]{$-$}(c.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}[htbp]

\caption{磁盘读写系统方框图}
\label{fig:5}
\end{figure}
```

### 典型参数

#### 幻灯片：磁盘读写系统的数学模型：典型参数

表tab:1为磁盘驱动系统的典型参数，于是，我们有：

**原始表格代码**

```tex
\begin{table}
\centering
\caption{磁盘驱动器的典型参数}
\begin{tabular}{lll}\toprule
参数&符号&典型值\\ \midrule
读写头和读写臂的转动惯量&$J$&1\,N\,m\,$s^2$/rad\\
阻力&$b$&20\,N\,m\,s/rad\\
放大器&$K_a$&10-1000\\
电枢电阻&$R$&1$\Omega$\\
电机常数&$K_m$&5\,N\,/A\\
电枢电感&$L$&1\,mH\\\bottomrule
\end{tabular}
\label{tab:1}
\end{table}
```

**原始公式代码**

```tex
\begin{equation}
G(s)=\frac{K_m}{s(Js+b)(Ls+R)}=\frac{5000}{s(s+20)(s+1000)} 
\label{eq:1}
\end{equation}
```

#### 幻灯片：磁盘读写系统的数学模型：闭环方框图

还可以写为：
其中$\tau_L=J/b=50\,ms$，$\tau=L/R=1\,ms$。由于$\tau\ll\tau_L$，常常可以忽略$\tau$，于是可以有
闭环系统的方框图如下：

**原始公式代码**

```tex
$$G(s)\approx\frac{K_m/(bR)}{s(\tau_Ls+1)}=\frac{0.25}{s(0.05s+1)}=\frac{5}{s(s+20)}$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c)at(t){};
	\path[line](c.east)--node[above]{$E(s)$}++(3,0)coordinate(t);
	\node[block,text width=3em](b1)at(t){$K_a$};
	\path[line](b1.east)--++(3,0)coordinate(t);	
	\node[block,text width=3em](b2)at (t){$G(s)$};
	\path[line](b2.east)--++(2,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\path[line](o)--++(0,-2)-|node[right,at end]{$-$}(c.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}

\caption{闭环系统方框图}
\label{fig:6}
\end{figure}
```

**原始公式代码**

```tex
\begin{equation}
G(s)=\frac{K_m/(bR)}{s(\tau_Ls+1)(\tau s+1)}
\label{eq:2} 
\end{equation}
```

#### 幻灯片：磁盘读写系统的数学模型：阶跃响应

相应的闭环传递函数：
使用上面给出的$G(s)$的二阶近似模型，得到：
当$K_a=40$，可得
在$R(s)=\frac{0.1}{s}$下的阶跃响应如右图。

**原始公式代码**

```tex
$$\frac{Y(s)}{R(s)}=\frac{5K_a}{s^2+20s+5K_a}$$
```

**原始公式代码**

```tex
$$Y(s)=\frac{200}{s^2+20s+200}R(s)$$
```

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.3]{../figs/Df7.pdf}
\caption{图\ref{fig:6}中系统在$R(s)=\frac{0.1}{s}$时的响应}
\label{fig:7} 
\end{figure}
```

**原始公式代码**

```tex
\begin{equation}
\frac{Y(s)}{R(s)}=\frac{K_aG(s)}{1+K_aG(s)}
\label{eq:3} 
\end{equation}
```

## 磁盘读写系统的反馈控制

### 控制系统

#### 幻灯片：磁盘读写系统的反馈控制：控制系统

磁盘驱动控制系统的设计目标是准确定位读写头，并能降低参数变化、外部震动和冲击带来的效应。机械臂和柔性部在特定频率下会发生共振（例如笔记本受到冲击）。磁盘驱动器的扰动包括转动轴的物理振动，磨损和晃动，以及部件改变造成的参数变动。
下面将研究扰动和系统参数变化对磁盘驱动系统的影响。此外，还将系统对于阶跃响应的稳态误差以及放大器增益$K_a$改变时瞬态响应的变化。
考虑图fig:8所示的系统，使用可变增益的放大器作为控制器，使用表tab:1中的参数，可得到图fig:9中的传递函数。首先考察当$T_d(s)=0$时系统在单位阶跃输入$R(s)=1/s$下的稳态。当$H(s)=1$时，有

**原始公式代码**

```tex
$$E(s)=R(s)-Y(s)=\frac{1}{1+K_aG_1(s)G_2(s)}R(s)$$
```

#### 幻灯片：磁盘读写系统的反馈控制：控制系统

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c1)at(t){};
	\path[line](c1.east)--++(1,0)coordinate(t);
	\node[block,text width=3em](b1)at(t){$K_a$};
	\node[block,anchor=south]at(b1.north){放大器};
	\path[line](b1.east)--node[above,text width=2em]{$V(s)$}++(3,0)coordinate(t);	
	\node[block,text width=2.5em](b2)at (t){$\frac{K_m}{Ls+R}$};
	\node[block,text width=2.5em,anchor=south]at(b2.north){线圈};
	\path[line](b2.east)--++(2em,0)coordinate(t);
	\node[cross,anchor=west](c2)at(t){};
	\node (d) at ($(c2.north)+(0,2em)$){扰动$T_d(s)$};
	\path[line](d.south)--node[left,at end]{$-$}(c2.north);
	\path[line](c2.east)--++(2em,0)coordinate(t);
	\node[block,text width=3.5em](b3)at (t){$\frac{1}{s(Js+b)}$};
	\node[block,text width=3.5em,anchor=south]at(b3.north){负载};
	\path[line](b3.east)--++(2,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\node[block,below of=b2,text width=4em,below=1em](b4){$H(s)=1$};
	\node[block,text width=4em,anchor=south]at(b4.north){传感器};
	\path[line](o)|-(b4.east);
	\path[line](b4.west)-|node[right,at end]{$-$}(c1.south);
\end{tikzpicture}
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c1)at(t){};
	\path[line](c1.east)--++(1,0)coordinate(t);
	\node[block](b1)at(t){$K_a$};
	\path[line](b1.east)--++(1,0)coordinate(t);	
	\node[block,text width=7em](b2)at (t){$G_1(s)=\frac{5000}{s+1000}$};
	\node[block,text width=7em,anchor=south]at(b2.north){线圈};
	\path[line](b2.east)--++(1em,0)coordinate(t);
	\node[cross,anchor=west](c2)at(t){};
	\node (d) at ($(c2.north)+(0,3em)$){扰动$T_d(s)$};
	\path[line](d.south)--node[left,at end]{$-$}(c2.north);
	\path[line](c2.east)--++(1em,0)coordinate(t);
	\node[block,text width=7em](b3)at (t){$G_2(s)=\frac{1}{s(s+20)}$};
	\node[block,text width=7em,anchor=south]at(b3.north){负载};
	\path[line](b3.east)--++(1,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\path[line](o)--++(0,-2)-|node[right,at end]{$-$}(c1.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}[htbp]

\caption{磁盘驱动控制系统}
\label{fig:8}
\end{figure}
```

**原始图示代码**

```tex
\begin{figure}[htbp]

\caption{使用表\ref{tab:1}中典型参数的磁盘驱动控制系统}
\label{fig:9}
\end{figure}
```

#### 幻灯片：磁盘读写系统的反馈控制：闭环传函

因此有
于是对于阶跃响应的稳态误差$e(\infty)=0$，在系统参数改变的情况下此结论依然成立。
现在考察$K_a$调整时的系统瞬态性能。当$T_d(s)=0$时，系统闭环传递函数为

**原始公式代码**

```tex
$$\lim\limits_{t \rightarrow\infty}e(t)=\lim\limits_{s \rightarrow0}s\frac{1}{1+K_aG_1(s)G_2(s)}\frac{1}{s}$$
```

**原始公式代码**

```tex
\begin{align}
T(s)=\frac{Y(s)}{R(s)}=&\frac{K_aG_1(s)G_2(s)}{1+K_aG_1(s)G_2(s)}\notag \\
=&\frac{5000K_a}{s^3+1020s^2+20000s+5000K_a} 
\end{align}
```

### 系统仿真

#### 幻灯片：磁盘读写系统的反馈控制：系统仿真

使用下面的代码（以$K_a=10$为例），可以得到系统在$K_a=10$和$K_a=80$时的响应，如图fig:10所示。显然，系统对于输入的响应在$K_a=80$时要快得多，但同时出现了震荡，这是无法接受的。
verbatim
close all
Ka=10;
nf=5000; df=[1 1000]; sysf=tf(nf,df);
ng=1; dg=[1 20 0];sysg=tf(ng,dg);
sysa=series(Ka*sysf,sysg);
sys=feedback(sysa,1);
t=0:0.01:2;
y=step(sys,t); plot(t,y,'LineWidth',2);
set(gca,'FontSize',20,'FontName','Times');
ylabel('y(t)'), xlabel('Time (s)'), grid
annotation('textbox',[.7,.3,.11,.09],'String',...
['K_a=',num2str(Ka)],'FontSize',20,'FontName','Times');
verbatim

#### 幻灯片：磁盘读写系统的反馈控制：系统仿真

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\subfigure[$K_a=10$\label{fig:10:a}]{
\includegraphics[scale=0.3]{../figs/Df10a.pdf}}
\subfigure[$K_a=80$\label{fig:10:b}]{
\includegraphics[scale=0.3]{../figs/Df10b.pdf}}
\caption{$K_a=10$和$K_a=80$时的闭环系统响应}
\label{fig:10} 
\end{figure}
```

#### 幻灯片：磁盘读写系统的反馈控制

现在考察当$T_d(s)=1/s$，$R(s)=0$时的情况。我们期望将扰动的影响降至最低，使用图fig:9的系统，可以得到以$T_d(s)$为输入，$K_a=80$时的系统响应$Y(s)$：
使用下面的代码可得到系统响应曲线，如图fig:11所示。
verbatim
Ka=80;
nf=[5000]; df=[1 1000]; sysf=tf(nf,df);
ng=[1]; dg=[1 20 0];sysg=tf(ng,dg);
sys=feedback(sysg,Ka*sysf);
sys=-sys;
t=[0:0.01:2];
y=step(sys,t); plot(t,y)
ylabel('y(t)'), xlabel('Time (s)'), grid
verbatim

**原始公式代码**

```tex
\begin{equation}
Y(s)=\frac{G_2(s)}{1+K_aG_1(s)G_2(s)}T_d(s) 
\end{equation}
```

#### 幻灯片：磁盘读写系统的反馈控制

为了进一步减小扰动的影响，我们需要将$K_a$增大到80以上。但是，这将使系统对阶跃响应产生更强的震荡。接下来，我们尝试确定$K_a$的最佳值，使得系统响应迅速且无震荡。

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.3]{../figs/Df11.pdf}
\caption{$K_a=80$时的扰动阶跃响应}
\label{fig:11} 
\end{figure}
```

## 磁盘读写系统反馈控制的性能

### 性能指标

#### 幻灯片：磁盘读写系统反馈控制的性能：性能指标

下面给出明确的性能指标，并通过校正放大器增益$K_a$获得尽可能好的系统性能。
我们的目标是取得对于阶跃输入的最快速响应，同时：
-  限制超调和震荡
-  减小扰动对读写头位置的影响。
性能指标如下表：

**原始表格代码**

```tex
\begin{table}
\caption{动态响应的性能指标}
\begin{tabular}{ll}\toprule
性能指标&期望值\\ \midrule
超调量&小于5\
调节时间&小于250\,ms\\
对于单位阶跃输入的最大响应绝对值&小于$5\times 10^{-3}$\\\bottomrule 
\end{tabular}
\label{tab:2} 
\end{table}
```

#### 幻灯片：磁盘读写系统反馈控制的性能：性能指标

考察电机和摇臂的二阶模型，忽略线圈电感，可得到如下图的闭环系统
当$T_d(s)=0$时的输出为

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c1)at(t){};
	\path[line](c1.east)--++(1,0)coordinate(t);
	\node[block,label={above:{放大器}}](b1)at(t){$K_a$};
	\path[line](b1.east)--++(2,0)coordinate(t);	
	\node[block,text width=2em,label=above:{电机常数}](b2)at (t){$5$};
	\path[line](b2.east)--++(2em,0)coordinate(t);
	\node[cross,anchor=west](c2)at(t){};
	\node (d) at ($(c2.north)+(0,3em)$){扰动$T_d(s)$};
	\path[line](d.south)--node[left,at end]{$-$}(c2.north);
	\path[line](c2.east)--++(1em,0)coordinate(t);
	\node[block,text width=5em](b3)at (t){$\frac{1}{s(s+20)}$};
	\node[block,text width=5em,anchor=south]at(b3.north){负载};
	\path[line](b3.east)--++(1,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\path[line](o)--++(0,-2)-|node[right,at end]{$-$}(c1.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}

\caption{电机和负载二阶模型的控制系统}
\label{fig:12}
\end{figure}
```

**原始公式代码**

```tex
\begin{align}
Y(s)&\ =\frac{5K_a}{s(s+20)+5K_a}R(s)=\frac{5K_a}{s^2+20s+5K_a}R(s) \notag\\
&\ =\frac{\omega_n^2}{s^2+2\zeta\omega_ns+\omega_n^2}R(s) \label{eq6}
\end{align}
```

### 系统仿真

#### 幻灯片：磁盘读写系统反馈控制的性能：系统仿真

因此，$\omega_n^2=5K_a$，$2\zeta\omega_n=20$。使用下面的代码得到响应曲线，响应曲线如图fig:13所示。
verbatim
Ka=[30,60]; t=[0:0.01:1];
for i = 1:2
    nc=[Ka(i)*5]; dc=[1]; sysc=tf(nc,dc);
    ng=[1]; dg=[1 20 0]; sysg=tf(ng,dg);
    sys1=series(sysc,sysg); sys=feedback(sys1,[1]);
    y(:,i)=step(sys,t);
end
plot(t,y,'LineWidth',2);
set(gca,'FontSize',20,'FontName','Times');
ylabel('y(t)'), xlabel('Time (s)'), grid
verbatim

#### 幻灯片：磁盘读写系统反馈控制的性能：系统仿真

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.4]{../figs/Df13.pdf}
\caption{$K_a=30$和$60$时的单位阶跃输入响应}
\label{fig:13} 
\end{figure}
```

#### 幻灯片：磁盘读写系统反馈控制的性能：系统仿真

**原始表格代码**

```tex
\begin{table}
\caption{阶跃输入下的二阶系统响应指标}
\begin{tabular}{llllll}\toprule
$K_a$&20&30&40&60&80\\\midrule
超调量&0&1.2\
调节时间&0.55&0.40&0.40&0.40&0.40\\
阻尼比&1&0.82&0.707&0.58&0.50\\
对单位扰动的最大响应&-10E-3&-6.6E-3&-5.2E-3&-3.7E-3&-2.9E-4\\\bottomrule
\label{tab:3} 
\end{tabular}

\end{table}
```

#### 幻灯片：磁盘读写系统反馈控制的性能：系统仿真

当$K_a$增大到60，扰动的效应降低了一半，如图fig:14所示，所用代码如下：
verbatim
close all
Ka=[30,60]; t=[0:0.01:1];
for i = 1:2
    nc=[Ka(i)*5]; dc=[1]; sysc=tf(nc,dc);
    ng=[1]; dg=[1 20 0];sysg=tf(ng,dg);
    sys=feedback(sysg,sysc);
    sys=-sys; y(:,i)=step(sys,t);
end
plot(t,y,'LineWidth',2);
set(gca,'FontSize',20,'FontName','Times');
ylabel('y(t)'), xlabel('Time (s)'), grid
verbatim
显然，如果使该系统满足目标，必须选择适中的增益。这里，我们选择$K_a=40$作为最佳的折衷。这一选择无法满足所有的性能指标，因此，接下来需要再次进行设计，并改变控制系统的结构。

#### 幻灯片：磁盘读写系统反馈控制的性能：系统仿真

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.4]{../figs/Df14.pdf}
\caption{$K_a=30$和$60$时扰动$T_d(s)=1/s$的单位阶跃响应}
\label{fig:14} 
\end{figure}
```

## 磁盘读写控制系统的稳定性

### 串级控制

#### 幻灯片：磁盘读写控制系统的稳定性：串级控制

上一节考察了带可变增益$K_a$的磁盘读写控制系统，现在考察$K_a$变化时系统的稳定性并重新设计控制器。
考虑下面的系统，该系统除了增加的速度反馈传感器外，与之前系统别无二致。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c1)at(t){};
	\path[line](c1.east)--++(1,0)coordinate(t);
	\node[block,label={above:{放大器}}](b1)at(t){$K_a$};
	\path[line](b1.east)--++(2,0)coordinate(t);	
	\node[block,label=above:{电机线圈}](b2)at (t){$G_1(s)$};
	\path[line](b2.east)--++(2em,0)coordinate(t);
	\node[cross,anchor=west](c2)at(t){};
	\node (d) at ($(c2.north)+(0,3em)$){扰动$T_d(s)$};
	\path[line](d.south)--node[left,at end]{$-$}(c2.north);
	\path[line](c2.east)--++(1em,0)coordinate(t);
	\node[block](b3)at (t){$\frac{1}{s+20}$};
	\path[line](b3.east)--++(1,0)coordinate(o1)--node[above,near start]{速度}++(2,0)coordinate(t);
	\node[block](b4)at (t){$\frac{1}{s}$};
	\path[line](b4.east)--++(1,0)coordinate(o2)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\node[block,below of=b2,below=.1em,label=above:{速度传感器}](b5){$K_1$};
	\node[block,below of=b5,below=.1em,label=above:{位置传感器}](b6){$H(s)=1$};
	\path[line](o2)|-(b6.east);
	\path[line](b6.west)-|node[left,at end]{$-$}(c1.south);
	\path[line](o1)|-(b5.east);
	\path[draw,blue,thick](b5.west)--++(-1,0)coordinate(t);
	\node[draw,circle,anchor=east,inner sep=1](s1)at(t){};
	\path[draw,blue,thick](s1.north west)--++(-1.5,.5);
	\node[draw,circle,anchor=east,inner sep=1](s2)at($(t)+(-2,0)$){};
	\path[line](s2.west)--++(-2,0)--node[right,near end]{$-$}(c1.south east);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}

\caption{带可选速度反馈的磁盘驱动器闭环控制}
\label{fig:15}
\end{figure}
```

#### 幻灯片：磁盘读写控制系统的稳定性：串级控制

首先考虑速度传感器断开的情况。闭环传递函数为
其中
并且
特征方程为
或者

**原始公式代码**

```tex
$$G_1(s)=\frac{5000}{s+1000}$$
```

**原始公式代码**

```tex
$$G_2(s)=\frac{1}{s(s+20)}.$$
```

**原始公式代码**

```tex
\begin{equation}
\frac{Y(s)}{R(s)}=\frac{K_aG_1(s)G_2(s)}{1+K_aG_1(s)G_2(s)}, 
\end{equation}
```

**原始公式代码**

```tex
\begin{equation}
s(s+20)(s+1000)+5000K_a=0,
\end{equation}
```

**原始公式代码**

```tex
\begin{equation}
s^3+1020s^2+20000s+5000K_a=0. 
\end{equation}
```

### 劳斯判据

#### 幻灯片：磁盘读写控制系统的稳定性：劳斯判据

使用劳斯判据
其中
当$K_a=4080$时，$b_1=0$，此时临界稳定。使用辅助方程，有
表明在$j\omega$轴上的根为$s=\pm j141.4$。为了使系统稳定，应有$K_a<4080$。

**原始公式代码**

```tex
$$
\begin{array}{l|cc}
s^3&1&20000\\
s^2&1020&5000K_a\\
s^1&b_1&\\
s^0&5000K_a& 
\end{array},
$$
```

**原始公式代码**

```tex
$$b_1=\frac{(20000)1020-5000K_a}{1020}.$$
```

**原始公式代码**

```tex
$$1020s^2+5000(4080)=0,$$
```

#### 幻灯片：磁盘读写控制系统的稳定性：劳斯判据

现在闭合图fig:15速度反馈的开关，由于等效反馈系数等于$1+K_1s$，系统的闭环传递函数为：
如图fig:16所示。

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c1)at(t){};
	\path[line](c1.east)--++(1,0)coordinate(t);
	\node[block](b1)at(t){$K_a$};
	\path[line](b1.east)--++(2,0)coordinate(t);	
	\node[block](b2)at (t){$G_1(s)$};
	\path[line](b2.east)--++(2em,0)coordinate(t);
	\node[cross,anchor=west](c2)at(t){};
	\node (d) at ($(c2.north)+(0,3em)$){\alert{$T_d(s)$}};
	\path[line](d.south)--node[left,near end]{$-$}(c2.north);
	\path[line](c2.east)--++(1em,0)coordinate(t);
	\node[block](b3)at (t){$G_2(s)$};
	\path[line](b3.east)--++(1,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\node[block,below of=b2](b4){$1+K_1s$};
	\path[line](o)|-(b4.east);
	\path[line](b4.west)-|node[left,at end]{$-$}(c1.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}

\caption{速度反馈开关闭合的等效系统}
\label{fig:16}
\end{figure}
```

**原始公式代码**

```tex
\begin{equation}
\frac{Y(s)}{R(s)}=\frac{K_aG_1(s)G_2(s)}{1+[K_aG_1(s)G_2(s)](1+K_1s)}, 
\end{equation}
```

#### 幻灯片：磁盘读写控制系统的稳定性：劳斯判据

系统特征方程为
或者
因此，可得到
使用劳斯判据
其中

**原始公式代码**

```tex
$$1+[K_aG_1(s)G_2(s)](1+K_1s)=0,$$
```

**原始公式代码**

```tex
$$s(s+20)(s+1000)+5000K_a(1+K_1s)=0.$$
```

**原始公式代码**

```tex
$$s^3+1020s^2+[20000+5000K_aK_1]s+5000K_a=0.$$
```

**原始公式代码**

```tex
$$
\begin{array}{l|cc}
s^3&1&20000+5000K_aK_1\\
s^2&1020&5000K_a\\
s^1&b_1&\\
s^0&5000K_a& 
\end{array},
$$
```

**原始公式代码**

```tex
$$b_1=\frac{1020(20000+5000K_aK_1)-5000K_a}{1020}.$$
```

### 系统仿真

#### 幻灯片：磁盘读写控制系统的稳定性：系统仿真

为保证系统稳定，必须选择一对$K_a,K_1$使得$b_1>0$，并且$K_a>0$。当$K_1=0.05$，$K_a=100$，使用下面的代码得到系统的响应。
verbatim
Ka=100; K1=0.05;
ng1=[5000]; dg1=[1 1000]; sys1=tf(ng1,dg1);
ng2=[1]; dg2=[1 20 0]; sys2=tf(ng2,dg2);
nc=[K1 1]; dc=[0 1]; sysc=tf(nc,dc);
syso=series(Ka*sys1,sys2);
sys=feedback(syso,sync); sys=minreal(sys);
t=[0:0.001:0.5];
y=step(sys,t); plot(t,y)
ylabel('y(t)'), xlabel('Time (s)'), grid
verbatim

#### 幻灯片：磁盘读写控制系统的稳定性：系统仿真

调节时间（2\

**原始表格代码**

```tex
\begin{table}
\caption{磁盘驱动系统性能指标对比}
\begin{tabular}{lll}\toprule
性能指标&期望值&实际值\\\midrule
超调量&小于5\
调节时间&小于250ms&260ms\\
对扰动的最大响应&小于5E-3&2E-3\\\bottomrule 
\end{tabular}
\label{tab:4} 
\end{table}
```

#### 幻灯片：磁盘读写控制系统的稳定性：系统仿真

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.38]{../figs/Df17.pdf}
\caption{$K_a=100$和$K_1=0.05$时速度反馈系统的响应}
\label{fig:17} 
\end{figure}
```

## 磁盘读写系统PID控制-使用根轨迹法

### 使用根轨迹法

#### 幻灯片：磁盘读写系统PID控制：使用根轨迹法

**根轨迹的定义**
根轨迹是系统特征方程的根在s平面上随系统参数变化的路径。
反馈控制系统的性能可通过特征方程根在s平面上的位置进行描述。根轨迹图可以刻画特征方程的根如何随着某个系统参数变化而变化。根轨迹图是设计和分析反馈控制系统的有力工具。
PID控制器是非常受欢迎的控制结构，因为其实现方面，设计简单，仅仅三个可调参数。下面通过磁盘驱动控制系统介绍基于根轨迹的PID控制器设计。

#### 幻灯片：磁盘读写系统PID控制：使用根轨迹法

上一节介绍了引入速度反馈的控制结构，现在在同样的控制对象下，使用PID控制，以使系统响应达到期望的性能。
PID控制器的传递函数可以表示为如下：
因为控制对象中已经包含了积分项，我们令$K_I=0$。于是有了如下PD控制器：
我们的目标是选择合适的$K_P$和$K_D$使得系统满足性能指标。系统如图fig:18所示，其闭环传递函数为
其中$H(s)=1$。

**原始公式代码**

```tex
$$G_c(s)=K_P+\frac{K_I}{s}+K_Ds.$$
```

**原始公式代码**

```tex
$$G_c(s)=K_P+K_Ds.$$
```

**原始公式代码**

```tex
$$\frac{Y(s)}{R(s)}=T(s)=\frac{G_c(s)G_1(s)G_2(s)}{1+G_c(s)G_1(s)G_2(s)H(s)},$$
```

#### 幻灯片：磁盘读写系统PID控制：使用根轨迹法

为了得到根轨迹的参数方程，将$G_c(s)G_1(s)G_2(s)H(s)$写为
其中$z=K_P/K_D$。

**原始公式代码**

```tex
$$G_cG_1G_2H=\frac{5000(K_P+K_Ds)}{s(s+20)(s+1000)}=\frac{5000K_D(s+z)}{s(s+20)(s+1000)},$$
```

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\tikzstyle{line}=[draw=blue,-latex,thick]
	\tikzstyle{block}=[rectangle,draw,,anchor=west,thick,text centered]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c1)at(t){};
	\path[line](c1.east)--++(1,0)coordinate(t);
	\node[block,label=above:{PD控制器}](b1)at(t){$K_P+K_Ds$};
	\path[line](b1.east)--++(2,0)coordinate(t);	
	\node[block,label=above:{电机线圈}](b2)at (t){$\frac{5000}{s+1000}$};
	\path[line](b2.east)--++(2em,0)coordinate(t);
	\node[cross,anchor=west](c2)at(t){};
	\node (d) at ($(c2.north)+(0,3em)$){$T_d(s)$};
	\path[line](d.south)--node[left,near end]{$-$}(c2.north);
	\path[line](c2.east)--++(1em,0)coordinate(t);
	\node[block,label=above:{负载}](b3)at (t){$\frac{1}{s(s+20)}$};
	\path[line](b3.east)--++(1,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\path[line](o)--++(0,-2)-|node[left,at end]{$-$}(c1.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}

\caption{速度反馈开关闭合的等效系统}
\label{fig:18}
\end{figure}
```

#### 幻灯片：磁盘读写系统PID控制：使用根轨迹法

使用$K_P$的值选择零点$z$的位置，令$K_P=K_D$，绘制以$K_D$为参数的函数轨迹。
下面简要介绍根轨迹及其绘制方法。 对于如图fig:6的系统，其特征方程为
其中$K$是要考察的参数，其变化范围$0<K<\infty$。注意
-  一般情况下$K$为系统增益，此时的根轨迹为典型的根轨迹；
-  当$K$为其他参数时，根轨迹称为广义根轨迹。

**原始公式代码**

```tex
$$\Delta(s)=1+KG=1+K\frac{p(s)}{q(s)}=0,$$
```

**原始公式代码**

```tex
\begin{equation}
G_cG_1G_2H=\frac{5000K_D(s+1)}{s(s+20)(s+1000)}.
\label{eq:11}
\end{equation}
```

### 绘制根轨迹

#### 幻灯片：磁盘读写系统PID控制：绘制根轨迹

式eq:11系统的根轨迹可由下面代码得到：
verbatim
p=[-1]; q=[0 -20 -1000]; sys=zpk(p,q,5000); rlocus(sys)
verbatim

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.38]{../figs/LDp9.pdf}
\caption{\ref{eq:11}系统的根轨迹}
\label{fig:19} 
\end{figure}
```

#### 幻灯片：磁盘读写系统PID控制：绘制根轨迹

当使用没有返回值的rlocus函数时，Matlab给出根轨迹图，当使用下面的代码时
verbatim
p=[-1]; q=[0 -20 -1000]; sys=zpk(p,q,5000); [r,K]=rlocus(sys)
verbatim
rlocus函数将返回特征方程根与其对应的增益。
使用函数rlocfind(sys)在根轨迹图上选择极点。当输入命令后，会出现十字选择线，这时需要在已有的根轨迹图上选择极点位置，选择后的极点以十字标出，并且系统会返回该点的增益。

#### 幻灯片：磁盘读写系统PID控制-使用根轨迹法

verbatim
p=[-1]; q=[0 -20 -1000]; sys=zpk(p,q,5000);
rlocus(sys); rlocfind(sys)
verbatim

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.38]{../figs/LDp10.pdf}
\caption{在根轨迹上选择极点}
\label{fig:20} 
\end{figure}
```

### 系统仿真

#### 幻灯片：磁盘读写系统PID控制：系统仿真

系统输出为
verbatim
Select a point in the graphics window
selected_point =
  -5.0829e+02 + 5.0435e+02i
ans =
   98.9914
verbatim
选择$K_D=100$，并使用下面代码绘制系统单位阶跃响应和单位阶跃扰动响应：
verbatim
s = tf('s'); Kd = 100; Kp = Kd; Gc = Kp+Kd*s;
G1 = 5000/(s+1000); G2 = 1/(s*(s+20));
sysr = feedback(Gc*G1*G2,1);
step(sysr,5); sysn = feedback(G2,Gc*G1); sysn = -sysn;
figure
step(sysn);
verbatim

#### 幻灯片：磁盘读写系统PID控制：系统仿真

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\subfigure[前5秒\label{fig:21:a}]{
\includegraphics[scale=0.3]{../figs/Df21a.pdf}}
\subfigure[前120个数据点\label{fig:21:b}]{
\includegraphics[scale=0.3]{../figs/Df21b.pdf}}
\caption{输入阶跃响应}
\label{fig:21}
\end{figure}
```

#### 幻灯片：磁盘读写系统PID控制：系统仿真

**原始图示代码**

```tex
\begin{figure}[htbp]
\centering
\includegraphics[scale=0.38]{../figs/Df22.pdf}
\caption{扰动阶跃响应}
\label{fig:22}
\end{figure}
```

#### 幻灯片：磁盘读写系统PID控制：系统仿真

系统现在满足了所有的性能指标。系统需要近20ms时间“基本上”达到终值。但是实际中，系统首先快速达到终值的97\

**原始表格代码**

```tex
\begin{table}
\caption{磁盘驱动系统性能指标对比}
\begin{tabular}{lll}\toprule
性能指标&期望值&实际值\\\midrule
超调量&小于5\
调节时间&小于250ms&20ms\\
对扰动的最大响应&小于5E-3&2E-3\\\bottomrule 
\end{tabular}
\label{tab:5} 
\end{table}
```

## 磁盘读写系统模糊控制

### 概念

#### 幻灯片：磁盘读写系统模糊控制：概念

**模糊控制**
一种智能化的控制。它是利用模糊集理论、模糊逻辑和模糊推理方法把人的直觉、经验形式化、模型化，由计算机来实现有效控制。

**原始公式代码**

```tex
$$\left.\begin{matrix}\text{人类经验：模糊}\\ \text{计算机指令：精确}\end{matrix}\right\}\text{二者如何沟通？}$$
```

**原始图示代码**

```tex
\begin{figure}
\begin{center}
\tikz[x=1em,y=1em]{
\path[line](0,0)--node[at start,above]{\alert{检测信号}}++(4,0)coordinate(t);
\node[block,dashed,minimum width=12em,minimum height=6em,label=below:模糊控制器](b1)at (t){};
\path[line](b1.east)--node[at end,above]{\alert{控制信号}}++(4,0);
\path[line](b1.west)--++(1,0)coordinate(t);
\node[block,text width=1em](b2)at(t){模糊化};
\path[line](b2.east)--++(1,0)coordinate(t);
\node[block,text width=4em](b3)at(t){模糊规则人的经验};
\path[line](b3.east)--++(1,0)coordinate(t);
\node[block,text width=1em](b4)at(t){解模糊};
\path[line](b4.east)--(b1.east);
}
\end{center}
\end{figure}
```

### 建模

#### 幻灯片：磁盘读写系统模糊控制：建模

考虑上一节速度反馈开关闭和的等效系统，并将PD控制器替换为模糊控制器：

**原始绘图代码**

```tex
\begin{tikzpicture}[x=1em,y=1em]
	\path[line](0,0)--node[below,at start,text width=2em]{\alert{$R(s)$}}++(2,0)coordinate(t);
	\node[cross,anchor=west](c1)at(t){};
	\path[line](c1.east)--++(1,0)coordinate(t);
	\node[block](b1)at(t){模糊控制器};
	\path[line](b1.east)--++(2,0)coordinate(t);	
	\node[block,label=above:{电机线圈}](b2)at (t){$\frac{5000}{s+1000}$};
	\path[line](b2.east)--++(2em,0)coordinate(t);
	\node[cross,anchor=west](c2)at(t){};
	\node (d) at ($(c2.north)+(0,3em)$){$T_d(s)$};
	\path[line](d.south)--node[left,near end]{$-$}(c2.north);
	\path[line](c2.east)--++(1em,0)coordinate(t);
	\node[block,label=above:{负载}](b3)at (t){$\frac{1}{s(s+20)}$};
	\path[line](b3.east)--++(1,0)coordinate(o)--node[below,at end,text width=2em]{\alert{$Y(s)$}}++(2,0);
	\path[line](o)--++(0,-2)-|node[left,at end]{$-$}(c1.south);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}

\caption{模糊控制的磁盘读写系统}
\label{fig:23}
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：建模

首先确定误差信号的范围，考虑到超调，定义$E\in [-0.5,1]$
再考虑误差变化率的范围。上一节中PD控制器与控制对象构成的开环传递函数为：
在Simulink中建立如下框图：

**原始公式代码**

```tex
$$\frac{500000s+500000}{s^3+1020s^2+20000s}$$
```

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.35]{../figs/Df24.pdf}
\caption{PD控制器的Simulink框图}
\label{fig:24} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：建模

运行模型，并且绘制工作空间中变量DE的曲线

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.35]{../figs/Df25.pdf}
\caption{$\Delta E$的变化曲线}
\label{fig:25} 
\end{figure}
```

### 控制器设计

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

根据输出曲线的上下限，定义
类似的，可以定义控制量的变化范围
事实上，实际中对于$U$的定义往往根据控制器和执行器的具体情况进行调整，这里为了和上一节的PD控制器进行对比，将输出范围定为相同的。

**原始公式代码**

```tex
$$\Delta E\in [-350,50]$$
```

**原始公式代码**

```tex
$$U\in [-10,100]$$
```

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

确定误差输入的几个模糊语言值
分别表示零，小，中，大这几个模糊变量。
分别表示负大，负小，零和正。
分别表示零，小，中，大。

**原始公式代码**

```tex
$$E:\ Z,\ S,\ M,\ B$$
```

**原始公式代码**

```tex
$$DeltaE:\ NB,\ NS,\ Z,\ P$$
```

**原始公式代码**

```tex
$$U:\ Z,\ S,\ M,\ B$$
```

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

打开Matlab模糊控制工具箱Fuzzy Control Toolbox，将出现模糊控制器编辑界面，选择Edit$\rightarrow$Add Variable$\rightarrow$Input，增加一个输入变量，对默认变量名进行修改，得到如下界面：

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.3]{../figs/Df26.pdf}
\caption{模糊控制编辑器界面}
\label{fig:26} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

双击各个变量，对其成员函数（隶属度函数）进行编辑：

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.35]{../figs/Df27.pdf}
\caption{输入误差E成员函数编辑界面}
\label{fig:27} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.4]{../figs/Df28.pdf}
\caption{输入误差变化率DeltaE成员函数编辑界面}
\label{fig:28} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.4]{../figs/Df29.pdf}
\caption{控制量U成员函数编辑界面}
\label{fig:29} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.4]{../figs/Df30.pdf}
\caption{模糊控制规则编辑界面}
\label{fig:30} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

共有10条规则（也可以绘制为规则表供查询）：
-  If (E is B) then (U is B)
- <2-> If (E is M) and (DeltaE is NB) then (U is B)
- <4-> If (E is M) and (DeltaE is NS) then (U is S)
- <6-> If (E is M) and (DeltaE is Z) then (U is M)
- <8-> If (E is M) and (DeltaE is P) then (U is B)
- <10-> If (E is S) and (DeltaE is NB) then (U is S)
- <12-> If (E is S) and (DeltaE is NS) then (U is Z)
- <14-> If (E is S) and (DeltaE is Z) then (U is Z)
- <16-> If (E is S) and (DeltaE is P) then (U is Z)
- <18-> If (E is Z)  then (U is Z)

#### 幻灯片：磁盘读写系统模糊控制：控制器设计

绘制出控制规则的表面图如下

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.38]{../figs/Df31.pdf}
\caption{控制规则的表面图}
\label{fig:31} 
\end{figure}
```

### 系统仿真

#### 幻灯片：磁盘读写系统模糊控制：系统仿真

在模糊控制器编辑界面中选择File$\rightarrow$Export$\rightarrow$To Workspace，并且指定到处的控制其名称。在Simulink中组成仿真框图，双击模糊控制器，在FIS Matrix一栏填入刚才导出的控制器名称。

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.38]{../figs/Df34.pdf}
\caption{磁盘读写系统模糊控制仿真框图}
\label{fig:34} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：系统仿真

运行仿真，系统响应如下图：

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.38]{../figs/Df32.pdf}
\caption{模糊控制的磁盘读写系统阶跃响应}
\label{fig:32} 
\end{figure}
```

#### 幻灯片：磁盘读写系统模糊控制：系统仿真

控制信号如下图：

**原始图示代码**

```tex
\begin{figure}[t]
\centering
\includegraphics[scale=0.38]{../figs/Df33.pdf}
\caption{模糊控制的磁盘读写系统控制信号}
\label{fig:33} 
\end{figure}
```
