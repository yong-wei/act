# Cpt1

- 来源文件：`Cpt1.tex`
- 课程标题：自动控制原理
- 副标题：第一章 自动控制原理的一般概念

## 自动控制的基本概念

#### 幻灯片：自动控制的基本概念

**自动控制**
	在没有人直接参与的情况下，采用控制装置，使工作机械、或生产过程（被控对象）的某一个物理量（被控量）按预定的规律（给定量）运行。
	**你能想到哪些自动控制装置或者系统？**

#### 幻灯片：自动控制研究的内容：

5em

**原始表格代码**

```tex
\begin{table}[h]
\begin{center}
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{.9\textwidth}

{|X|X|X|X|X|}\hline 
&\alert{研究对象}&\alert{数学工具}&\alert{分析方法}&\alert{局限性}\\\hline
\alert{经典控制理论}&单I/O，线性定常系统&微分方程，传递函数&\parbox[t]{\cw}{时域法，\\频域法，\\根轨迹法}&对复杂多变量系统、时变和非线性系统无能为力\\\hline
\alert{现代控制理论}&多输入-多输出变系数，非线性等系统&线性代数、矩阵理论&状态空间法&比较繁琐（但由于计算机技术的迅速发展，已克服)\\\hline
\end{tabularx}
\end{center}
\end{table}
```

## 自动控制的基本方式

### 开环控制

#### 幻灯片：开环控制

控制装置与被控对象之间只有顺向作用而没有反向联系的控制。

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{dblock}=[draw,rectangle,dashed,very thick,text centered,anchor=west,rounded corners]
\tikz{
\draw[-latex,thick](0,0)--node[above]{输入量}node[below]{（电源）}++(5em,0) coordinate(t);
\node[block,fill=yellow] (b1) at(t) {开关};
\draw[-latex,thick](b1.east)--++(2em,0)coordinate(t);
\node[block,text width=3em,fill=red] (b2) at(t) {加热\\电阻丝};
\draw[-latex,thick](b2.east)--++(2em,0)coordinate(t);
\node[block,text width=3em,fill=cyan] (b3) at(t) {电炉\\恒温箱};
\draw[-latex,thick](b3.east)--node[above]{输出量}node[below]{（温度）}++(5em,0)coordinate(t);
\draw[-latex,thick]($(b3.north)+(0,3em)$)--node[right,pos=0.25]{扰动量}++(0,-3em);
\node[dblock,minimum width=9.7em,minimum height=6em] (b4) at($(b1.west)-(0.7em,0)$){};
\node[dblock,minimum width=5em,minimum height=6em] (b5) at($(b3.west)-(0.7em,0)$){};
\node at (9em,-2.2em){控制装置};
\node at (17.2em,-2.2em){受控对象};
}
\end{center}
\caption{炉温开环控制系统}
\end{figure}
```

#### 幻灯片：开环控制

<4->
**开环控制系统特点：**
-  信号从输入到输出无反馈,单向传递
-  结构简单
-  控制精度不高,无法抑制扰动

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{dblock}=[draw,ellipse,dashed,very thick,anchor=west]
\tikzstyle{ecallout}=[ellipse callout, draw,anchor=pointer,fill=cyan,very thick]
\tikzstyle{line}=[-latex,very thick]
\vspace{-0.5em}
\tikz{
\draw[line](0,0)--++(5em,0) coordinate(t);
\node[block,fill=yellow] (b1) at(t) {控制器};
\draw[line](b1.east)--++(2em,0)coordinate(t);
\node[block,text width=3em,fill=red] (b2) at(t) {被控\\对象};
\draw[line](b2.east)--++(5em,0)coordinate(t);
\draw[line]($(b2.north)+(0,3em)$)--node[right,pos=0.25]{扰动}++(0,-3em);
\node[dblock,minimum width=19em,minimum height=6em] (b3) at(0,0){};
\onslide<2->{
\node[ecallout,callout relative pointer=(45:.5cm)] at(1em,-0.5em){给定值};}
\onslide<3->{
\node[ecallout,callout relative pointer=(135:.5cm)] at(18em,-0.5em){输出量};}
}
\end{center}
\caption{典型开环控制的方框图}
\end{figure}
```

#### 幻灯片：直流电动机转速开环控制系统

-  输出量对输入量没有影响的系统称为开环系统

**原始绘图代码**

```tex
\begin{tikzpicture}[circuit ee IEC,every circuit symbol/.style={very thick},x=1em,y=1em]
\draw[line](0,0)--(1,0) node[right]{$+$}coordinate(t);
\draw[line](.5,0)--(.5,-1.5) coordinate(t);
\node[block,anchor=north,minimum height=2em,label=left:RP](b1)at(t){};
\draw[line](b1.south)--node[left,text width=1em]{给定电位器}++(0,-7) coordinate(t);
\draw[line]($(t)-(.5,0)$)--++(1,0) node[right]{$-$}coordinate(t);
\draw[line,latex-](b1.east)--node[above]{给定电压}++(5,0) coordinate(t);
\node[block,minimum height=3em,anchor=170](b2)at(t){功率放大器};
\draw[line](b2.190)-|++(-3,-2)coordinate(t);
\draw[line]($(t)-(.5,0)$)--++(1,0);
\draw[line](b2.10)-|++(2,4)-|++(4,-4)coordinate(t);
\node[draw,circle,very thick,anchor=north,inner sep=0](b3)at(t){M};
\draw[line](b2.350)-|++(2,-4)-|(b3.south);
\node[block,minimum height=2em](b4)at($(b3.east)+(3,0)$){生产机构};
\draw[line](b4.175)--++(-3.1,0);
\draw[line](b4.185)--++(-3.1,0);
\draw[line,-latex]($(b3.east)+(.2,1.2)$)arc(40:-40:2em)node[right=0.5em]{n};
\node[anchor=west] at($(b3.south)+(.5,-2)$){直流电动机};
\node[draw,very thick,circle,inner sep=0.2em,label=above:$+$](c1)at(16,-.5){};
\node[draw,very thick,circle,inner sep=0.2em,label=below:$-$](c2)at(16,-5.5){};
\draw[very thick] (c1.south) to [inductor](c2.north);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{dblock}=[draw,ellipse,dashed,very thick,anchor=west]
\tikzstyle{ecallout}=[ellipse callout, draw,anchor=pointer,fill=cyan,very thick]
\tikzstyle{line}=[very thick]

\end{center}
\end{figure}
```

### 闭环控制

#### 幻灯片：闭环控制

**原始绘图代码**

```tex
\begin{tikzpicture}[circuit ee IEC,every circuit symbol/.style={very thick},x=1em,y=1em]
\draw[line](0,0)--(1,0) node[right]{$+$}coordinate(t);
\draw[line](.5,0)--(.5,-1.5) coordinate(t);
\node[block,anchor=north,minimum height=2em,label=left:RP](b1)at(t){};
\draw[line](b1.south)--node[left,text width=1em]{给定电位器}++(0,-7) coordinate(t);
\draw[line]($(t)-(.5,0)$)--++(1,0) node[right]{$-$}coordinate(t);
\draw[line,latex-,dashed](b1.east)--node[above]{给定电压}++(5,0) coordinate(t);
\node[block,minimum height=3em,anchor=170](b2)at(t){功率放大器};
\draw[line](b2.190)-|++(-2,-2)coordinate(t);
\draw[line]($(t)-(.5,0)$)--++(1,0);
\draw[line](b2.10)-|++(2,4)-|++(4,-4)coordinate(t);
\node[draw,circle,very thick,anchor=north,inner sep=0](b3)at(t){M};
\draw[line](b2.350)-|++(2,-4)-|(b3.south);
\node[draw,circle,very thick,inner sep=.4em,label=below right:转速表](b4)at(22,-6){};
\draw[line,-latex]($(b3.east)+(1,1)$)arc(20:-60:2em)node[right=0.5em]{n};
\draw[line,-latex](21.7,-6.3)--(22.3,-5.7);
\draw[line](b3.east)--(b4.north west);
\node[draw,very thick,circle,inner sep=0.2em,label=above:$+$](c1)at(16,-.5){};
\node[draw,very thick,circle,inner sep=0.2em,label=below:$-$](c2)at(16,-5.5){};
\draw[very thick] (c1.south) to [inductor](c2.north);
\node[inner sep=0] (b5) at (10,-12){\includegraphics[width=4em]{../figs/engineer.png}};
\draw[line,dashed](b4.south west)--node[starburst, fill=yellow, draw=red, very thick,solid] {\bf Feedback}(b5.10);
\draw[line,dashed](b1.east)--(b5.170);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{dblock}=[draw,ellipse,dashed,very thick,anchor=west]
\tikzstyle{ecallout}=[ellipse callout, draw,anchor=pointer,fill=cyan,very thick]
\tikzstyle{line}=[very thick]

\end{center}
\caption{人工电动机转速闭环控制系统}
\end{figure}
```

#### 幻灯片：闭环控制

如果将人换成测速发电机……

**原始绘图代码**

```tex
\begin{tikzpicture}[circuit ee IEC,every circuit symbol/.style={very thick},x=1em,y=1em]
\draw[line](0,0)--(1,0) node[right]{$+$}coordinate(t);
\draw[line](.5,0)--(.5,-1.5) coordinate(t);
\node[block,anchor=north,minimum height=2em,label=left:RP](b1)at(t){};
\draw[line](b1.south)--node[left,text width=1em]{给定电位器}++(0,-7) coordinate(t);
\draw[line]($(t)-(.5,0)$)--++(1,0) node[right]{$-$}coordinate(t);
\draw[line,latex-,dashed](b1.east)--node[above]{给定电压}++(5,0) coordinate(t);
\node[block,minimum height=3em,minimum width=4em,anchor=170,label=below:控制器](b2)at(t){C};
\node[block,minimum height=3em,minimum width=4em,right of=b2,right=1em,label=below:功率放大器](b3){$>$};
\draw[line](b2.10)--(b3.170);
\draw[line](b2.350)--(b3.190);
\draw[line](b3.10)-|++(2,4)-|++(4,-4)coordinate(t);
\node[draw,circle,very thick,anchor=north,inner sep=0](b4)at(t){M}; 
\draw[line](b3.350)-|++(2,-4)-|(b4.south);
\node[draw,circle,very thick,inner sep=0](b5)at(26,-6){TG};
\draw[line,-latex]($(b4.east)+(1,1)$)arc(20:-60:2em)node[right=0.5em]{n};
\draw[line](b4.east)--(b5.north west);

\node[draw,very thick,circle,inner sep=0.2em,label=above:$+$](c1)at(20,-.5){};
\node[draw,very thick,circle,inner sep=0.2em,label=below:$-$](c2)at(20,-5.5){};
\draw[very thick] (c1.south) to [inductor](c2.north);
\draw[line](b5.south)|-++(-22,-2)|-(b2.190);
\draw[line](b5.north)|-++(2,2)--++(0,-2)coordinate(t);
\draw[line]($(t)-(.5,0)$)--++(1,0);
\end{tikzpicture}
```

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{dblock}=[draw,ellipse,dashed,very thick,anchor=west]
\tikzstyle{ecallout}=[ellipse callout, draw,anchor=pointer,fill=cyan,very thick]
\tikzstyle{line}=[very thick]

\end{center}
\caption{人工电动机转速闭环控制系统}
\end{figure}
```

#### 幻灯片：闭环控制

- **控制任务：** 保持工作机械恒速运行
- **控制过程：** $n\uparrow\quad\rightarrow\quad u_f\uparrow\quad\rightarrow\quad e\downarrow\quad\rightarrow\quad u_a\downarrow\quad\rightarrow\quad n\downarrow$
**闭环控制的特点**
-  控制器与控制对象之间既有顺向作用，又有反向联系，输出影响输入；
-  能减小偏差，抑制扰动；

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{line}=[-latex,very thick]
\tikz[x=1em,y=1em]{
\node[block,text width=2em](b1){给定装置};
\draw[line](b1.east)--node[above]{$r$}++(2,0)coordinate(t);
\node[cross,thick](c)at(t){};
\draw[line](c.east)--node[above]{$e$}++(2,0)coordinate(t);
\node[block](b2)at(t){控制器};
\draw[line](b2.east)--++(1em,0)coordinate(t);
\node[block,label=below:控制装置](b3)at(t){放大器};
\draw[line](b3.east)--node[above,pos=.6]{$u_a$}++(3,0)coordinate(t);
\node[block,label=below:受控对象](b4)at(t){电动机};
\draw[line](b4.east)--node[above,near end]{$n$}++(2,0)coordinate(t)--++(1,0);
\draw[line](t)|-++(-8,-4)coordinate(t);
\node[block,anchor=east,text width=3em](b5)at(t){转速反馈装置};
\draw[line](b5.west)-|node[right,pos=.8]{$u_f$}node[right,at end]{$-$}(c.south);
\node[block,dashed,minimum width=9.5em,minimum height=3.5em,anchor=172,draw=cyan]at($(c.east)+(1.5,0)$){};
\node[block,dashed,minimum width=4.5em,minimum height=3.5em,anchor=163,draw=cyan]at($(b3.east)+(2.5,0)$){};
}
\end{center}
\end{figure}
```

### 闭环控制系统的术语

#### 幻灯片：未命名页

- **反馈** 输出量送回至输入端并与输入信号比较的过程；
- **负反馈** 反馈的信号与输入信号相减而使偏差越来越小；闭环系统内部存在负反馈，又称反馈控制；
- **主反馈** 与输出成正比或某种函数关系，但量纲与给定信号相同；
- **偏差** 给定信号与主反馈信号之差的信号；
- **控制单元** 接受偏差信号，通过转换与运算，产生期望的控制量；
- **扰动** 对系统输出产生不利影响的信号；
- **反馈环节** 检测输出信号并转换与给定输入信号相同量纲的信号。

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{line}=[-latex,very thick]
\tikz[x=1em,y=1em]{
\draw[line](0,0)--node[above]{给定信号$r(t)$}++(5,0)coordinate(t);
\node[cross,thick](c)at(t){};
\draw[line](c.east)--node[above]{误差$e(t)$}++(4,0)coordinate(t);
\node[block,label=below:$C$](b1)at(t){控制单元};
\draw[line](b1.east)--node[above]{控制量$u(t)$}++(5,0)coordinate(t);
\node[block,label=below:$G$](b2)at(t){控制对象};
\draw[line](b2.east)--++(1,0)coordinate(t)--node[above,near end]{输出$y(t)$}++(3,0);
\draw[line](t)|-++(-8,-3)coordinate(t);
\node[block,anchor=east,label=below:$H$](b3)at(t){反馈单元};
\draw[line](b3.west)-|node[right,pos=.8]{主反馈$b(t)$}node[right,at end]{$-$}(c.south);
\draw[line]($(b2.north)+(0,2em)$)--node[right]{扰动$d(t)$}(b2.north);
}
\end{center}
\end{figure}
```

### 复合控制

#### 幻灯片：复合控制：按扰动补偿

把反馈控制与按扰动控制结合起来。对于主要扰动采用适当的补偿装置实现按扰动控制，同时再组成反馈控制系统，以消除其余扰动产生的偏差。

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text centered,anchor=west]
\tikzstyle{line}=[-latex,very thick]
\tikz[x=1em,y=1em]{
\draw[line](0,0)--node[above]{$u_o$}node[below]{输入信号}++(5,0)coordinate(t);
\node[cross,thick](c1)at(t){};
\draw[line](c1.east)--node[above]{$u_e$}++(2,0)coordinate(t);
\node[block,text width=3em](b1)at(t){电压放大器};
\draw[line](b1.east)--++(1,0)coordinate(t);
\node[cross,thick](c2)at(t){};
\draw[line](c2.east)--++(2,0)coordinate(t);
\node[block,text width=3em](b2)at(t){功率放大器};
\draw[line](b2.east)--++(3,0)coordinate(t);
\node[block](b3)at(t){电动机};
\draw[line](b3.east)--++(1,0)coordinate(t)node[above,at end]{$n$}--++(2,0);
\draw[line](t)|-++(-9,-4)coordinate(t);
\node[block,anchor=east,text width=3em](b4)at(t){测速发电机};
\draw[line](b4.west)-|node[right,pos=.8]{$u_f$}node[right,at end]{$-$}(c1.south);
\draw[line]($(b3.north)+(0,4em)$)--++(0,-1em)coordinate(t)--node[right]{扰动}(b3.north);
\draw[line](t)-++(-1,0)coordinate(t);
\node[block,anchor=east](b5)at(t){电阻$R$};
\draw[line](b5.west)--++(-1,0)coordinate(t);
\node[block,anchor=east,text width=3em](b6)at(t){电压放大器};
\draw[line](b6.west)-|(c2.north);
}
\end{center}
\caption{电动机速度复合控制系统方框图}
\end{figure}
```

#### 幻灯片：复合控制：按输入补偿

**原始图示代码**

```tex
\begin{figure}[h]
\begin{center}
\tikzstyle{block}=[draw,rectangle,very thick,text badly centered,anchor=west,text width=4em]
\tikzstyle{line}=[-latex,very thick]
\tikz[x=1em,y=1em]{
\node[block,text width=2em,fill=green!50](b1){给定元件};
\draw[line](b1.east)--node[above]{输入}++(2,0)coordinate(o1)--++(1,0)coordinate(t);
\node[cross,thick,label={[align=center,text width=2em]below left:比较元件},fill=blue!50](c1)at(t){};
\draw[line](c1.east)--node[above]{偏差}++(2,0)coordinate(t);
\node[block,fill=yellow!50](b2)at(t){串联校正元件};
\draw[line](b2.east)--++(1,0)coordinate(t);
\node[cross,thick,fill=blue!50](c2)at(t){};
\draw[line](c2.east)--++(1,0)coordinate(t);
\node[block,text width=2em,fill=green!50](b3)at(t){放大元件};
\draw[line](b3.east)--++(1,0)coordinate(t);
\node[block,text width=2em,fill=green!50](b4)at(t){执行元件};
\draw[line](b4.east)--++(1,0)coordinate(t);
\node[block,text width=2em,fill=cyan!50](b5)at(t){被控对象};
\draw[line](b5.east)--++(1,0)coordinate(t)node[above,at end]{输出}--++(2,0);
\draw[line](t)--++(0,-4)coordinate(o2)|-++(-9,-2)coordinate(t);
\node[block,anchor=east,fill=green!50](b7)at(t){测量元件};
\draw[line](b7.west)-|node[above,near start]{主反馈}node[right,at end]{$-$}(c1.south);
\draw[line](o2)--++(-3,0)coordinate(t);
\node[block,anchor=east,fill=yellow!50](b6)at(t){反馈校正元件};
\draw[line](b6.west)-|node[above,near start]{局部反馈}node[right,at end]{$-$}(c2.south);
\draw[line]($(b5.north)+(0,4em)$)--node[right]{扰动}++(0,-1em)coordinate(t)--(b5.north);
\draw[line](t)-++(-1,0)coordinate(t);
\node[block,anchor=east,label=above:按干扰补偿,fill=yellow!50](b8)at(t){前馈校正元件};
\draw[line](b8.west)--++(-1,0)--(c2.north east);
\draw[line](o1)|-++(2,4)coordinate(t);
\node[block,label=above:按输入补偿,fill=yellow!50](b9)at(t){前馈校正元件};
\draw[line](b9.east)--++(1,0)--(c2.north);
}
\end{center}
\end{figure}
```

## 控制系统的分类

#### 幻灯片：控制系统的分类

-  按系统是否满足叠加原理       线性系统     /   非线性系统
-  按系统参数是否随时间变化   定常系统     /   时变系统
-  按信号传递的形式                   连续系统     /   离散系统
-  按输入输出变量的多少           单变量系统 /   多变量系统
-  按给定信号的形式        恒值系统/随动系统/程序控制系统

#### 幻灯片：控制系统分类：按给定信号形式

**恒值系统**
也称镇定系统；
特点：给定值一般不变化或变化很缓慢，而输出量以一定的精度等于给定值；
例如：恒温系统，恒压系统。
**随动系统**
又称跟踪系统；
特点：系统的给定值变化规律事先不能确定，而输出量能以一定精度跟随给定值变化；
例如：火炮系统，卫星控制系统等。
**程序控制系统**
特点：系统的给定值（或被控量）根据预先编好的程序进行控制。
例如：炼钢炉中的微机控制系统，洲际弹道导弹的程序控制系统等。

## 对自动控制系统系统的要求

#### 幻灯片：对自动控制系统系统的要求

- **稳定性** 被控制信号能跟踪已变化的输入信号，从一种状态到另一种状态，如果能做到，我们就认为该系统是稳定的，这是对反馈控制系统提出的最基本要求。
- **快速性** 对过渡过程的形式和快慢提出要求，一般称为动态性能。
稳定高射炮射角随动系统，虽然炮身最终能跟踪目标，但如果目标变动迅速，而炮身行动迟缓，仍然抓不住目标。
- **准确性** 用稳态误差来表示。
在参考输入信号作用下，当系统达到稳态后，其稳态输出与参考输入所要求的期望输出之差叫做给定稳态误差。显然，这种误差越小，表示系统的输出跟随参考输入的精度越高。

#### 幻灯片：对自动控制系统的要求

- **稳定性：** 保证控制系统正常工作的先决条件。
- **快速性：** 动态性能，有指标。
- **准确性：** 稳态（过度结束后的）值应尽量与期望值一致。

**原始图示代码**

```tex
\begin{figure}[h]
\centering
\tikzstyle{dash}=[draw,dashed,gray]
\tikzstyle{curve}=[draw,thick,red]
\tikzstyle{line}=[draw,very thick,-latex]
\def\axis{\path[line](0,0)--node[below,at start]{$0$}node[below,at end]{$t$}(8,0);
\path[line](0,0)--node[left,pos=0.2]{$n_1$}node[left,at end]{$n$}(0,4);

}
\subfigure[非周期振荡]{
\tikz[x=1em,y=1em]{
\axis
\path[curve](0,.8)..controls(2,3)and(4,3)..(8,3);
}}
\subfigure[收敛振荡]{
\tikz[x=1em,y=1em]{
\clip(-1.5,-1.3)rectangle(9,5);
\axis
\path[curve](0,.8)..controls(1,.5)and(1.8,6)..(3.5,3)..controls(4.8,1.2)and(5,4.5)..(7,3)..controls(7.3,2.7)and(7.8,2.8)..(8,3);
}}
\subfigure[发散振荡]{
\tikz[x=1em,y=1em]{
\axis
\path[curve](0,.8)..controls(1,.5)and(1.8,3)..(2.5,3)
..controls(3,3)and(3,2.2)..(3.5,2.2)
..controls(4,2.2)and(4.5,3.5)..(5,3.5)
..controls(5.5,3.5)and(6,2)..(6.5,2)
..controls(7,2)and(7.5,4)..(8,4);
}}
\subfigure[等幅振荡]{
\tikz[x=1em,y=1em]{
\axis
\path[curve](0,.8)..controls(1,.5)and(1.7,4)..(2.5,4)
..controls(3.1,4)and(3.4,2)..(4,2)
..controls(4.6,2)and(4.9,4)..(5.5,4)
..controls(6.1,4)and(6.4,2)..(7,2)
..controls(7.4,2)and(7.6,3)..(8,3.5);
}}
\end{figure}
```

#### 幻灯片：本章小结

-  自动控制的一般概念
-  自动控制的基本方式
	-  开环控制
	-  闭环控制
	-  复合控制
-  控制系统分类
	-  恒值系统
	-  随动系统
	-  程序控制系统
-  对自动控制系统的要求
	-  稳定性
	-  快速性
	-  准确性
