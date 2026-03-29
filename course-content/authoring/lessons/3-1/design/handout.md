# 单元 3-1 | 纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解

- **层次**：模块3 理论主线 · 第一课
- **学时**：90分钟
- **知识类型**：[C] + [X]
- **前置**：已掌握一二阶系统的标准形式、典型动态性能指标、纯极点系统的基本时域对象与基础频域对象，能够从低阶响应曲线和基础 Bode 图中读出快慢、振荡趋势与主要频段特征
- **后续**：3-2（稳定边界可视化）、3-3（根轨迹机制与基本法则）、3-4（极点作用与根轨迹综合实验）、3-8（频域判别与跨域综合语言）
- **讲义定位**：这份讲义要解决一个比“主导极点是什么”更大的问题：为什么高阶系统常常还能用低阶模型理解，以及这种理解在时域和频域中各自凭什么成立、何时可信、何时会失真。

![封面漫画：单元导入](../media/processed/3-1-cover-comic.png){fig-pos="H"}

---

## 一、引入：高阶系统为什么没有把低阶直觉彻底作废

在 `2-2` 和 `2-4` 中，我们已经建立了两类基础直觉：

- 时域里，一阶和二阶对象可以用快慢、超调量、调节时间、振荡频率来描述；
- 频域里，典型环节和标准对象可以用基础 Bode 图看出主要频段和主要趋势。

可一旦进入真实工程，模型很快就会升到三阶、四阶，甚至更高。以船舶航向控制为例，执行机构、船体动力学、测量环节和扰动通道叠加后，系统结构通常已经不是一个干净的二阶对象。问题就来了：

1. 高阶系统明明有更多极点，为什么工程上还常常敢用低阶模型解释主要动态？
2. 这种“忽略某些极点”的做法，什么时候在时域中成立，什么时候在频域中也成立？

这节课的任务就是把这个问题讲透。我们只看纯极点系统，不引入零点、不改控制器结构。先回答“极点自己已经能说明什么”，再把这个解释从时域推进到频域。

这里有一个很重要的课程立场：
**高阶系统之所以常可近似成低阶系统，是因为某些模态退场更快、某些极点在关注频段内影响更小。**

## 二、从特征方程到一般自由响应：极点为什么能决定系统怎么动

### 2.1 闭环特征方程先给出稳定底线

设闭环传递函数为

$$
\Phi(s)=\frac{N(s)}{D(s)}
$$

其中分母多项式满足

$$
D(s)=0
$$

它的全部根就是闭环极点。对线性定常系统来说，稳定性的底线判断仍然先由这些极点决定：

- 全部极点实部小于 $0$，系统渐近稳定；
- 极点落在虚轴上但右半平面无极点，系统处于临界稳定；
- 只要出现右半平面极点，系统就包含会持续放大的模态。

![复平面中的稳定区、临界边界与失稳区示意](../media/processed/3-1-pp-01-stability-half-plane.svg){#fig:stability-half-plane}

如图~\ref{fig:stability-half-plane} 所示，这一步只回答“系统会不会失控”。但如果只停在这里，极点仍然只是复平面上的几个坐标点。要把高阶系统讲懂，还得继续问：这些坐标点为什么会变成具体的时间响应？

### 2.2 一般模态展开：极点会直接进入时域响应表达式

对严格真有理系统，如果它的极点为 $p_i$，每个极点的重数为 $q_i$，那么在部分分式展开后，系统可以写成

$$
G(s)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(s-p_i)^r}
$$

于是对应的脉冲响应为

$$
g(t)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(r-1)!}t^{r-1}e^{p_i t}, \qquad t \ge 0
$$

这条式子很关键。它把“极点决定响应”说得非常具体：

- 极点位置 $p_i$ 决定指数衰减或增长的节奏；
- 若极点有虚部，就会带来振荡项；
- 若极点重复，就会额外乘上 $t, t^2, \dots$ 这样的多项式因子；
- 系数 $A_{i,r}$ 决定每个模态叠加时的方向和权重。

所以，极点并不是静态坐标，它们对应的是**系统内部可被激发的运动模态**。

### 2.3 三类典型极点在时域中分别长什么样

下面把三类最常见极点类型和它们的时域响应并排放在一起：

![三类典型极点类型与对应响应的对照图](../media/processed/3-1-pp-02-poles-and-modes.svg){#fig:poles-and-modes}

如图~\ref{fig:poles-and-modes} 所示，读这张图时，要把“极点类型”和“响应形态”对应起来：

1. **单个负实极点**
   对应纯指数衰减。它告诉你系统会回去，而且回去过程是单调的。

2. **左半平面共轭复极点**
   对应振荡衰减。虚部控制振荡频率，实部控制包络线衰减速度。

3. **右半平面极点**
   对应发散模态。哪怕系统里其他模态都在衰减，只要还有一个右半平面极点，整体就谈不上稳定。

这里要注意一个常见误解：
共轭复极点对应的时域响应只有**一条实际输出曲线**。数学上我们写成成对复根，是为了保证时域合成后的输出仍然是实函数。图中现在把极点图和响应图分开，就是为了避免把“两个共轭根”误读成“两条不同的物理响应”。

### 2.4 重根为什么值得单独拿出来说

如果极点重复，例如出现二重极点 $p$，那么对应时域项会出现

$$
\frac{A_1}{s-p}+\frac{A_2}{(s-p)^2}
\quad \Longrightarrow \quad
A_1 e^{pt}+A_2 t e^{pt}
$$

这意味着：即便两个系统的极点实部相同，只要其中一个包含重根，它的时域包络也可能拖得更长、前段形态也会不同。
因此，高阶系统是否可被低阶近似，不能只看“极点大致在左半平面哪里”，还要看：

- 有没有离主导区很近的额外极点；
- 有没有接近主导区的重根；
- 这些附加模态的权重是否足以改写主要动态。

## 三、时域近似：为什么少数主导极点常常足以解释主要动态

### 3.1 主导极点并不是一句口号

当系统阶次升高时，响应是多个模态叠加的结果。按理说，模态一多，分析应该越来越难。但工程上经常出现另一件事：有些模态衰减特别快，前段露一下脸，很快就退场；真正长期留在曲线上的，往往是最靠近虚轴、衰减最慢的那一小部分。

这就是主导极点思想：

> 在闭环极点中，最靠近虚轴、衰减最慢的模态，往往决定主要动态品质。

这句话为什么有用？因为它把模块2建立的低阶指标语言重新接回来了。只要主导模态清楚，很多高阶系统的主要超调量、调节时间、振荡节奏，仍然可以借低阶对象语言做近似解释。

### 3.2 用三个同直流增益模型比较“近似何时可靠”

考虑下面三个单位直流增益模型：

$$
G_{\mathrm{ref}}(s)=\frac{3.2}{s^2+1.6s+3.2}
$$

$$
G_{\mathrm{A}}(s)=\frac{16}{(s+5)(s^2+1.6s+3.2)}
$$

$$
G_{\mathrm{B}}(s)=\frac{4.48}{(s+1.4)(s^2+1.6s+3.2)}
$$

它们有同一对主导共轭极点，但附加极点位置不同：

- `参考模型` 只保留主导二阶对；
- `系统 A` 的附加极点在 $-5$，明显更靠左；
- `系统 B` 的附加极点在 $-1.4$，离主导对已经不远。

为了把模型和图像逐一对应起来，先把三个模型的单位阶跃响应写成显式表达式。三者共同拥有主导极点对

\begin{equation}
p_{1,2}=-0.8 \pm j1.6
\label{eq:dominant-pair}
\end{equation}

因此都会带有同一个主导振荡模态 $e^{-0.8t}\cos 1.6t$ 与 $e^{-0.8t}\sin 1.6t$，区别只在于附加模态退场得有多快。

对参考二阶模型，有

\begin{equation}
\omega_n=\sqrt{3.2}\approx 1.789,\qquad \zeta=\frac{1.6}{2\sqrt{3.2}}\approx 0.447,\qquad \omega_d=\omega_n\sqrt{1-\zeta^2}=1.6
\label{eq:ref-params}
\end{equation}

所以它的阶跃响应是

\begin{equation}
y_{\mathrm{ref}}(t)=1-e^{-0.8t}\left(\cos 1.6t+0.5\sin 1.6t\right)
\label{eq:ref-step}
\end{equation}

对 `系统 A`，单位阶跃响应可展开为

\begin{equation}
y_{\mathrm{A}}(t)=1-0.1584e^{-5t}-0.8416e^{-0.8t}\cos 1.6t-0.9158e^{-0.8t}\sin 1.6t
\label{eq:far-step}
\end{equation}

对 `系统 B`，单位阶跃响应可展开为

\begin{equation}
y_{\mathrm{B}}(t)=1-1.0959e^{-1.4t}+0.0959e^{-0.8t}\cos 1.6t-0.9110e^{-0.8t}\sin 1.6t
\label{eq:near-step}
\end{equation}

现在就能把式~\ref{eq:ref-step}、式~\ref{eq:far-step} 与式~\ref{eq:near-step} 和图~\ref{fig:dominant-step} 的响应曲线一一对上：

- `参考模型` 只有一组衰减率为 $0.8$ 的主导振荡模态，因此它的主要节奏完全由该共轭极点对决定；
- `系统 A` 多出来的附加模态是 $e^{-5t}$，对应时间常数仅为 $0.2$ s，比主导模态的 $1/0.8=1.25$ s 快得多，所以它只在前段稍作修正，很快退场；
- `系统 B` 多出来的附加模态是 $e^{-1.4t}$，对应时间常数约为 $0.714$ s，已经落进主导动态的同一时间尺度，因此它会持续改写上升、超调和峰值出现时刻。

![主导极点近似何时可靠的时域对照图](../media/processed/3-1-pp-03-dominant-pole-response-families.svg){#fig:dominant-step}

如图~\ref{fig:dominant-step} 所示，右侧三条阶跃响应曲线的差别，正是由上面三种模态退场速度不同造成的。为了让“看图感受”进一步落到可计算结论上，再把几个常用时域指标列出来。

对参考二阶模型，标准公式由式~\ref{eq:second-order-mp} 到式~\ref{eq:second-order-ts} 给出

\begin{equation}
M_p=e^{-\frac{\pi\zeta}{\sqrt{1-\zeta^2}}}\times 100\% \approx 20.79\%
\label{eq:second-order-mp}
\end{equation}

\begin{equation}
t_p=\frac{\pi}{\omega_d}=\frac{\pi}{1.6}\approx 1.963\ \text{s}
\label{eq:second-order-tp}
\end{equation}

\begin{equation}
t_s(2\%)\approx \frac{4}{\zeta\omega_n}=\frac{4}{0.8}=5.00\ \text{s}
\label{eq:second-order-ts}
\end{equation}

把标准公式结果和 Octave 数值结果统一列出，可得到表~\ref{tbl:time-metrics}。

\begin{table}[H]
\centering
\caption{三组模型的主要时域性能指标对照}
\label{tbl:time-metrics}
\small
\begin{tabular}{>{\raggedright\arraybackslash}p{1.7cm} >{\raggedright\arraybackslash}p{1.4cm} >{\raggedright\arraybackslash}p{1.8cm} >{\raggedright\arraybackslash}p{1.6cm} >{\raggedright\arraybackslash}p{1.5cm} >{\raggedright\arraybackslash}p{1.8cm} >{\raggedright\arraybackslash}p{3.6cm}}
\toprule
模型 & 附加极点 & $t_r$（10\%~90\%）/ s & $t_p$ / s & $M_p$ / \% & $t_s$（2\%）/ s & 说明 \\
\midrule
参考模型 & 无 & 0.862（数值） & 1.963（公式 / 数值一致） & 20.79（公式 / 数值一致） & 5.00（公式），4.669（数值） & 标准二阶对象，作为比较基线 \\
系统 A & $-5$ & 0.934（数值） & 2.191（数值） & 19.28（数值） & 4.862（数值） & 快模态只轻微拖慢上升并略减小超调 \\
系统 B & $-1.4$ & 1.338（数值） & 2.829（数值） & 7.04（数值） & 4.828（数值） & 附加极点进入主要动态区，显著压低超调并拖慢响应 \\
\bottomrule
\end{tabular}
\end{table}

表~\ref{tbl:time-metrics} 说明的不是“高阶系统一定更慢”，而是“附加极点在主导区附近时，会重写主要动态指标”。于是可以得到两个非常实用的结论：

1. 若附加极点衰减很快，它对主要超调、振荡节奏和大部分调节时间的影响可以很小；
2. 若附加极点离主导对不够远，它就会显著改写前段上升速度、超调量甚至整体收敛节奏。

### 3.3 什么情况下时域忽略可以接受

在纯极点系统里，常用的经验判断有两条：

- 若被忽略极点的实部绝对值大约达到主导极点实部绝对值的 `3~5` 倍以上，时域近似常较可靠；
- 若额外极点靠近主导对，或者多个附加极点在主导区附近扎堆，即使系统稳定，低阶近似也很可能失真。

这里一定要记住：这是**工程经验**，不是永远成立的定理。它必须和具体曲线、具体权重一起判断。

## 四、频域近似：为什么有些极点在 Bode 图上也可以先忽略

### 4.1 时域近似若只停在曲线比较，还不够

如果只看时域，我们最多能说“这条曲线像不像二阶系统”。但工程上还会继续问：

- 这个近似模型在主要工作频段内，幅频和相频是否也接近？
- 如果我要根据频域直觉估计主要带宽、响应速度或主要相位滞后，它还可靠吗？

这时就需要把同一组模型放到频域里再看一遍。

### 4.2 用 Bode 图看“被忽略极点在关注频段内影响有多大”

仍然比较刚才那三组模型的 Bode 图：

\begin{equation}
\left|G_{\mathrm{ref}}(j\omega)\right|
=\frac{3.2}{\sqrt{(3.2-\omega^2)^2+(1.6\omega)^2}}
\label{eq:mag-ref}
\end{equation}

\begin{equation}
\left|G_{\mathrm{A}}(j\omega)\right|
=\frac{16}{\sqrt{\omega^2+5^2}\,\sqrt{(3.2-\omega^2)^2+(1.6\omega)^2}}
\label{eq:mag-far}
\end{equation}

\begin{equation}
\left|G_{\mathrm{B}}(j\omega)\right|
=\frac{4.48}{\sqrt{\omega^2+1.4^2}\,\sqrt{(3.2-\omega^2)^2+(1.6\omega)^2}}
\label{eq:mag-near}
\end{equation}

从式~\ref{eq:mag-ref} 到式~\ref{eq:mag-near} 这三个幅频特性表达式里，可以直接看出两个频率来源：

- 二阶公共因子 $s^2+1.6s+3.2$ 决定主导频率尺度，其中固有频率是

$$
\omega_n=\sqrt{3.2}\approx 1.79\ \text{rad/s}
$$

- 一阶附加因子 $(s+5)$ 与 $(s+1.4)$ 分别带来转折频率 $\omega=5$ rad/s 与 $\omega=1.4$ rad/s。

这就是图~\ref{fig:bode-reduction} 中几条彩色竖线的来源：蓝色标的是主导二阶对的固有频率，绿色和红色分别标出两个附加极点对应的转折频率，灰色竖线标出参考模型的数值带宽 $\omega_{\mathrm{bw}}\approx 2.39$ rad/s。

![高阶系统与近似低阶系统的 Bode 对比图](../media/processed/3-1-pp-05-bode-model-reduction.svg){#fig:bode-reduction}

图~\ref{fig:bode-reduction} 的重点不在于“如何手工绘制 Bode 图”，而在于观察**幅相偏差落在什么频段**，以及这些偏差是否已经落入系统主要带宽。

由于三个模型的直流增益都为 $1$，因此其带宽可以统一理解为“幅值首次降到 $-3$ dB 附近的频率”。Octave 数值结果见表~\ref{tbl:freq-metrics}。

\begin{table}[H]
\centering
\caption{三组模型的转折频率与带宽对照}
\label{tbl:freq-metrics}
\small
\begin{tabular}{>{\raggedright\arraybackslash}p{1.8cm} >{\raggedright\arraybackslash}p{2.7cm} >{\raggedright\arraybackslash}p{2.7cm} >{\raggedright\arraybackslash}p{2.6cm} >{\raggedright\arraybackslash}p{3.2cm}}
\toprule
模型 & 附加极点转折频率 / rad/s & 数值带宽 $\omega_{\mathrm{bw}}$ / rad/s & 相对参考模型的变化 & 频域解释 \\
\midrule
参考模型 & 无 & 2.390 & 基线 & 主导二阶对决定主要幅相骨架 \\
系统 A & 5.000 & 2.282 & 约下降 4.5\% & 转折频率落在参考带宽之外，主要频段内偏差较小 \\
系统 B & 1.400 & 1.763 & 约下降 26.2\% & 转折频率直接落入带宽范围内，主要频段骨架被明显改写 \\
\bottomrule
\end{tabular}
\end{table}

对这三组模型来说：

- 参考模型的主要带宽约为 $\omega_{\mathrm{bw}}\approx 2.39$ rad/s，因此这个频带内的幅相关系最值得关注；
- 若附加极点在 $-5$，它的转折频率落在参考带宽之外，图~\ref{fig:bode-reduction} 中绿色竖线位于灰色带宽线右侧，所以在主要频段里只引入温和偏差；
- 若附加极点在 $-1.4$，它的转折频率已经落到带宽内部，图~\ref{fig:bode-reduction} 中红色竖线穿进主要工作频带，所以幅值和相位都会提前被改写。

这也是本课程第一次显式引入**频域中的近似计算**。对附加一阶极点

\begin{equation}
\frac{1}{1+s/p}
\label{eq:extra-pole-factor}
\end{equation}

若关注频带满足 $\omega \ll p$，则在该频带内可以近似写成式~\ref{eq:extra-pole-approx}

\begin{equation}
\left|\frac{1}{1+j\omega/p}\right| \approx 1,\qquad \angle\frac{1}{1+j\omega/p}\approx 0^\circ
\label{eq:extra-pole-approx}
\end{equation}

也就是说，只要附加极点的转折频率远在主要带宽之外，它在关注频带里就近似“不起作用”；但一旦转折频率落入带宽范围，这个近似就会迅速失效。

于是频域里的判断和时域里的判断就接上了：

- **远离关注频段的附加极点**，在主要频段内只引入较小的幅相偏差；
- **靠近主导频段的附加极点**，会直接改写 Bode 图骨架，因此不能轻易忽略。

### 4.3 什么情况下频域忽略可以接受

在本课的纯极点范围内，可以先使用表~\ref{tbl:approx-criteria} 中的经验判断：

\begin{table}[H]
\centering
\caption{时域与频域近似何时可接受的经验判断}
\label{tbl:approx-criteria}
\small
\begin{tabular}{>{\raggedright\arraybackslash}p{1.6cm} >{\raggedright\arraybackslash}p{4.4cm} >{\raggedright\arraybackslash}p{4.4cm}}
\toprule
判断维度 & 经验上较可靠的情形 & 不可靠的情形 \\
\midrule
时域 & 被忽略极点明显更靠左，退场更快 & 被忽略极点离主导区不远，或重根贴近主导区 \\
频域 & 被忽略极点的折点频率高于关注频段上界若干倍 & 被忽略极点已经落入主要频段附近 \\
解释用途 & 粗估快慢、振荡趋势、主要带宽骨架 & 要精确算裕度、精确算误差或做判稳 \\
\bottomrule
\end{tabular}
\end{table}

这里再次强调边界：
这节课允许用 Bode 图为“高阶系统为何能近似成低阶系统”提供证据，但**不进入 Nyquist 判据、Bode 判稳和裕度设计语言**。这些内容留给后面的 `3-8`。

> **[AI融入点] 双域近似判断**
>
> 先自己判断：对上面的三组模型，如果只保留主导二阶对，哪一组在时域和频域上都更接近近似对象？
>
> 然后向 AI 提问：
> “比较 $G_{\mathrm{A}}(s)$、$G_{\mathrm{B}}(s)$ 与 $G_{\mathrm{ref}}(s)$ 的低阶近似可靠性，要求同时使用阶跃响应和 Bode 图说明理由。”
>
> 最后不要停在 AI 的口头描述上，而要回到本讲的 Octave 图里核对：
> 时域看 `3-1-pp-03-dominant-pole-response-families.m`，频域看 `3-1-pp-05-bode-model-reduction.m`。

## 五、卷积与模态叠加：输入为什么会激发出同一套极点语言

### 5.1 单位阶跃并不是“突然跳一下”这么简单

在模块2中你已经见过卷积。但到高阶系统这里，卷积必须再往前走一步：它要解释**为什么同一个系统在不同输入下，仍然表现出同一套极点主导的动态个性**。

对线性定常系统，输出满足

$$
y(t)=\int_0^t g(t-\tau)u(\tau)\,\mathrm{d}\tau
$$

其中 $g(t)$ 是系统的脉冲响应。若输入为单位阶跃 $u(t)=1(t)$，则有

$$
y_{\text{step}}(t)=\int_0^t g(t-\tau)\,\mathrm{d}\tau
$$

这说明阶跃响应可以理解为：
**把许多个延时后的脉冲响应沿时间轴连续叠加起来。**

### 5.2 数值实验：用延时脉冲响应叠加逼近阶跃响应

下面这张图用数值方式把刚才那句话做了出来。做法很简单：

1. 把单位阶跃近似写成许多延时冲激的 Riemann 和；
2. 每个冲激通过系统后，都会产生一条缩放后的延时脉冲响应；
3. 把这些响应加起来，就得到对阶跃响应的逼近。

![通过卷积把单位阶跃响应看成多个延时脉冲响应叠加的数值实验](../media/processed/3-1-pp-06-convolution-step-from-impulse.svg){#fig:convolution-step}

如图~\ref{fig:convolution-step} 所示，其中“延时脉冲响应分量”子图取了更多个分量，但时间轴仍控制在 $0\sim 8$ s。为了保留单个分量的细节，这个分量子图采用自适应纵轴；“阶跃响应比较”子图则继续固定在统一范围内，用来直接比较精确阶跃响应和 Riemann 叠加近似的整体接近程度。

这张图的意义不在于公式变长了，而在于你终于能看见：

- 脉冲响应本身已经由极点决定；
- 阶跃响应只是把这些“由极点决定的脉冲响应碎片”连续地加起来；
- 所以无论输入怎样激发，系统总是绕不开它自己的模态结构。

### 5.3 一个明确的高阶例子：模态叠加并不要求每个分量都从正值开始

下面考虑一个明确的三阶纯极点模型：

$$
G(s)=\frac{12}{(s+1)(s+2)(s+6)}
$$

它的部分分式展开为

$$
G(s)=\frac{2.4}{s+1}-\frac{3}{s+2}+\frac{0.6}{s+6}
$$

因此脉冲响应满足

$$
g(t)=2.4e^{-t}-3e^{-2t}+0.6e^{-6t}
$$

![显式系统模型下的模态分量、留数与总响应关系图](../media/processed/3-1-pp-04-modal-superposition-high-order.svg){#fig:modal-superposition}

如图~\ref{fig:modal-superposition} 所示，这个例子修正了此前容易引起误解的地方。这里三个极点都在左半平面，而且互不重复，但第二个模态分量依然是负的。原因不在极点位置，而在于它的**留数系数为负**。因此：

- 极点位置决定每个模态的衰减节奏；
- 留数符号和大小决定每个模态是向上加、向下减，还是权重很小；
- 总响应是所有模态共同叠加的结果。

所以，“某个模态分量初始值为负”并不表示图画错了；只要系统模型、部分分式展开和解析表达式写清楚，它就是可解释、可复现的。

## 六、本节小结与后续铺垫

1. 闭环特征方程的根就是闭环极点；稳定性底线首先由极点位置决定。
2. 极点之所以重要，是因为它们会直接进入一般自由响应表达式，形成系统的运动模态；重根还会带来额外的 $t^k e^{pt}$ 因子。
3. 高阶系统常能用低阶模型理解，是因为某些附加模态在时域退场更快，在关注频段内引入的 Bode 偏差也更小。
4. 主导极点近似必须双域检查：时域要看主要动态是否被改写，频域要看关注频段内的幅相偏差是否还可接受。
5. 卷积把“输入如何激发模态”讲闭环了：阶跃响应可以看成多个延时脉冲响应叠加，而这些脉冲响应本身仍由极点决定。
6. 下一课 `3-2` 会把“稳定边界”做成可见对象；再下一课 `3-3` 才进入“增益变化为什么推动闭环极点迁移”的根轨迹机制。

![本讲信息图总结](../media/processed/3-1-info.png)

## 附录 A｜本讲图示与复现文件

本讲正式使用的图示均由 Octave 脚本生成：

- `3-1-pp-01-stability-half-plane.m`
- `3-1-pp-02-poles-and-modes.m`
- `3-1-pp-03-dominant-pole-response-families.m`
- `3-1-pp-04-modal-superposition-high-order.m`
- `3-1-pp-05-bode-model-reduction.m`
- `3-1-pp-06-convolution-step-from-impulse.m`

运行前请先确认已经安装并加载 `control` 包。

## 附录 B｜通过卷积求单位阶跃响应的完整推导

### B.1 从卷积定义出发

对线性定常系统，输出满足

$$
y(t)=\int_0^t g(t-\tau)u(\tau)\,\mathrm{d}\tau
$$

这里 $g(t)$ 是脉冲响应，$u(\tau)$ 是输入。

### B.2 输入为单位阶跃时

若

$$
u(t)=1(t)
$$

那么在 $0 \le \tau \le t$ 上有 $u(\tau)=1$，因此

$$
y_{\text{step}}(t)=\int_0^t g(t-\tau)\,\mathrm{d}\tau
$$

做变量替换 $\lambda=t-\tau$，则

$$
\lambda=t-\tau, \qquad \mathrm{d}\lambda=-\mathrm{d}\tau
$$

当 $\tau=0$ 时，$\lambda=t$；当 $\tau=t$ 时，$\lambda=0$。于是

$$
y_{\text{step}}(t)=\int_t^0 g(\lambda)(-\mathrm{d}\lambda)
=\int_0^t g(\lambda)\,\mathrm{d}\lambda
$$

这说明单位阶跃响应就是脉冲响应从 $0$ 到 $t$ 的累积面积。

### B.3 写成延时脉冲响应叠加的离散近似

把区间 $[0,t]$ 等分为步长 $\Delta t$ 的若干小段，就有

$$
y_{\text{step}}(t)
\approx
\sum_{k=0}^{N} g(t-k\Delta t)\Delta t
$$

这就是数值实验里采用的 Riemann 叠加形式。它的物理含义是：

- 在每个时刻 $k\Delta t$ 放一个权重为 $\Delta t$ 的小冲激；
- 每个小冲激经过系统后，产生一条延时的脉冲响应；
- 把这些延时脉冲响应加起来，就逼近单位阶跃响应。

### B.4 为什么这件事和极点有关

如果脉冲响应本身满足

$$
g(t)=\sum_i C_i e^{p_i t}
$$

那么卷积叠加中的每一条延时响应仍然由同一组极点 $p_i$ 决定。
这就是“输入会激发模态，但不会改写系统固有模态结构”的含义。

## 附录 C｜全部 Octave 出图代码

### C.1 `3-1-pp-01-stability-half-plane.m`

```matlab
1;
pkg load control;

fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1100, 700]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1100, 700]);
set(fig, 'paperposition', [0, 0, 1100, 700]);
axes('position', [0.10, 0.12, 0.82, 0.76]);
hold on;
patch([-6 0 0 -6], [-4 -4 4 4], [0.86 0.96 0.90], 'edgecolor', 'none');
patch([0 6 6 0], [-4 -4 4 4], [1.00 0.91 0.91], 'edgecolor', 'none');
plot([-6 6], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.4);
plot([0 0], [-4 4], 'color', [0.28 0.34 0.40], 'linewidth', 1.4);
plot([-2.2, -1.3], [1.7, -1.7], 'x', 'markersize', 13, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
plot(-3.6, 0, 'x', 'markersize', 13, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
plot(0, 1.5, 'x', 'markersize', 13, 'linewidth', 2.2, 'color', [0.92 0.35 0.00]);
plot(1.2, 0.8, 'x', 'markersize', 13, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
text(-4.9, 3.1, '稳定区：所有极点实部 < 0', 'fontsize', 16, 'fontweight', 'bold', 'color', [0.06 0.46 0.43]);
text(1.1, 3.1, '失稳区：只要出现右半平面极点', 'fontsize', 16, 'fontweight', 'bold', 'color', [0.70 0.10 0.10]);
text(0.18, 1.8, '虚轴：临界边界', 'fontsize', 14, 'color', [0.92 0.35 0.00]);
text(-2.0, 2.2, '共轭复极点 -> 振荡衰减', 'fontsize', 13, 'color', [0.02 0.52 0.78]);
text(-4.5, 0.5, '负实极点 -> 单调衰减', 'fontsize', 13, 'color', [0.06 0.46 0.43]);
text(1.5, 1.3, '右半平面极点 -> 模态放大', 'fontsize', 13, 'color', [0.86 0.15 0.15]);
xlabel('Re(s)');
ylabel('Im(s)');
title('闭环极点在复平面中的位置先决定稳定底线', 'fontsize', 18, 'fontweight', 'bold');
xlim([-6 6]);
ylim([-4 4]);
grid on;
set(gca, 'fontsize', 12, 'fontname', 'Microsoft YaHei');
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-01-stability-half-plane.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-01-stability-half-plane.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
```

### C.2 `3-1-pp-02-poles-and-modes.m`

```matlab
1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 780]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 780]);
set(fig, 'paperposition', [0, 0, 1180, 780]);
t = 0:0.01:10;
t_unstable = 0:0.01:6;
s = tf('s');
sys_real = 1 / (s + 1.2);
sys_pair = 4 / (s^2 + 1.4 * s + 4);
sys_unstable = 1 / (s - 0.45);

[y_real, t_real] = step(sys_real, t);
[y_pair, t_pair] = step(sys_pair, t);
[y_unstable, t_unstable] = step(sys_unstable, t_unstable);

subplot(2,3,1);
hold on;
plot([-4 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-2.5 2.5], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot(-1.2, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
title('极点 A：单个负实极点');
text(-3.7, 1.7, 'p = -1.2', 'fontsize', 12, 'color', [0.06 0.46 0.43]);
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-4 1]); ylim([-2.5 2.5]); grid on;

subplot(2,3,2);
hold on;
plot([-4 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-2.5 2.5], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([-0.7, -0.7], [1.85, -1.85], 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
title('极点 B：左半平面共轭极点');
text(-3.8, 1.7, 'p = -0.7 ± j1.85', 'fontsize', 12, 'color', [0.02 0.52 0.78]);
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-4 1]); ylim([-2.5 2.5]); grid on;

subplot(2,3,3);
hold on;
plot([-1 2], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-2.5 2.5], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot(0.45, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
title('极点 C：右半平面极点');
text(-0.7, 1.7, 'p = +0.45', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-1 2]); ylim([-2.5 2.5]); grid on;

subplot(2,3,4);
plot(t_real, y_real, 'color', [0.06 0.46 0.43], 'linewidth', 2.2);
title('响应 A：单调贴近稳态');
xlabel('时间 t / s'); ylabel('输出');
grid on;

subplot(2,3,5);
plot(t_pair, y_pair, 'color', [0.02 0.52 0.78], 'linewidth', 2.2);
title('响应 B：振荡衰减');
xlabel('时间 t / s'); ylabel('输出');
grid on;

subplot(2,3,6);
plot(t_unstable, y_unstable, 'color', [0.86 0.15 0.15], 'linewidth', 2.2);
title('响应 C：持续发散');
xlabel('时间 t / s'); ylabel('输出');
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '极点不是抽象坐标点：每种极点类型都对应不同的响应形态', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-02-poles-and-modes.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-02-poles-and-modes.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
```

### C.3 `3-1-pp-03-dominant-pole-response-families.m`

```matlab
1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
s = tf('s');
t = 0:0.01:12;
sys_ref = 3.2 / (s^2 + 1.6 * s + 3.2);
sys_far = 16 / ((s + 5) * (s^2 + 1.6 * s + 3.2));
sys_near = 4.48 / ((s + 1.4) * (s^2 + 1.6 * s + 3.2));

[y_ref, t_ref] = step(sys_ref, t);
[y_far, t_far] = step(sys_far, t);
[y_near, t_near] = step(sys_near, t);

fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 720]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 720]);
set(fig, 'paperposition', [0, 0, 1180, 720]);
subplot(1,2,1);
hold on;
plot([-6 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-3 3], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([-0.8, -0.8], [1.6, -1.6], 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
plot(-5, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
plot(-1.4, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
text(-5.7, 2.2, '远离主导对的快速极点', 'fontsize', 12, 'color', [0.06 0.46 0.43]);
text(-2.3, 2.6, '离主导对不够远的非主导极点', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
title('三组极点位置对比');
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-6 1]); ylim([-3 3]); grid on;

subplot(1,2,2);
hold on;
plot(t_ref, y_ref, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
plot(t_far, y_far, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
plot(t_near, y_near, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
title('主导极点近似何时更可靠');
xlabel('时间 t / s'); ylabel('单位阶跃响应');
legend('只看主导对', '附加极点很靠左', '附加极点不够靠左', 'location', 'southeast');
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '非主导极点退场得越快，主导极点近似越可靠', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-03-dominant-pole-response-families.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-03-dominant-pole-response-families.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
```

### C.4 `3-1-pp-04-modal-superposition-high-order.m`

```matlab
1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
num = 12;
den = conv([1, 1], conv([1, 2], [1, 6]));
[r, p, ~] = residue(num, den);
t = linspace(0, 6, 900);
y_total = zeros(size(t));
colors = [
  0.02, 0.52, 0.78;
  0.06, 0.46, 0.43;
  0.86, 0.15, 0.15
];

fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 720]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 720]);
set(fig, 'paperposition', [0, 0, 1180, 720]);
subplot(1,2,1);
hold on;
for k = 1:numel(p)
  y_k = real(r(k) * exp(p(k) * t));
  y_total = y_total + y_k;
  plot(t, y_k, '--', 'linewidth', 2.0, 'color', colors(k, :));
end
plot(t, y_total, 'k', 'linewidth', 2.8);
title('G(s)=12/((s+1)(s+2)(s+6)) 的脉冲响应分量');
xlabel('时间 t / s'); ylabel('g(t)');
legend('2.4e^{-t}', '-3e^{-2t}', '0.6e^{-6t}', '总响应', 'location', 'northeast');
grid on;

subplot(1,2,2);
hold on;
plot(real(p), imag(p), 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
label_dx = [0.15, 0.15, -1.30];
label_dy = [0.12, 0.12, 0.18];
for k = 1:numel(p)
  text(real(p(k)) + label_dx(k), imag(p(k)) + label_dy(k), sprintf('p_%d = %.1f, A_%d = %.1f', k, real(p(k)), k, real(r(k))), 'fontsize', 11);
end
plot([-7 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-3 3], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
text(-6.7, 2.1, '负模态分量来自负留数', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
text(-6.7, 1.7, '不意味着出现右半平面极点', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
title('极点位置决定衰减节奏，留数符号决定模态叠加方向');
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-7 1]); ylim([-3 3]); grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '高阶响应可以看成多个模态叠加：极点给出节奏，留数决定每个模态如何加到总响应里', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-04-modal-superposition-high-order.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-04-modal-superposition-high-order.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
```

### C.5 `3-1-pp-05-bode-model-reduction.m`

```matlab
1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
s = tf('s');
w = logspace(-2, 2, 700);
w_nat = sqrt(3.2);
w_break_far = 5;
w_break_near = 1.4;

sys_ref = 3.2 / (s^2 + 1.6 * s + 3.2);
sys_far = 16 / ((s + 5) * (s^2 + 1.6 * s + 3.2));
sys_near = 4.48 / ((s + 1.4) * (s^2 + 1.6 * s + 3.2));

[mag_ref, phase_ref] = bode(sys_ref, w);
[mag_far, phase_far] = bode(sys_far, w);
[mag_near, phase_near] = bode(sys_near, w);

mag_ref = squeeze(mag_ref);
mag_far = squeeze(mag_far);
mag_near = squeeze(mag_near);
phase_ref = squeeze(phase_ref);
phase_far = squeeze(phase_far);
phase_near = squeeze(phase_near);

mag_db_ref = 20 * log10(mag_ref);
mag_db_far = 20 * log10(mag_far);
mag_db_near = 20 * log10(mag_near);
target_db = -3;
bw_idx = find(mag_db_ref <= target_db, 1);
if isempty(bw_idx)
  w_bw_ref = NaN;
else
  w_bw_ref = w(bw_idx);
endif

fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 760]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 760]);
set(fig, 'paperposition', [0, 0, 1180, 760]);

subplot(2, 1, 1);
hold on;
semilogx(w, mag_db_ref, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
semilogx(w, mag_db_far, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
semilogx(w, mag_db_near, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
plot([w_nat w_nat], [-50 20], ':', 'linewidth', 1.5, 'color', [0.02 0.52 0.78]);
plot([w_break_far w_break_far], [-50 20], '--', 'linewidth', 1.7, 'color', [0.06 0.46 0.43]);
plot([w_break_near w_break_near], [-50 20], '--', 'linewidth', 1.7, 'color', [0.86 0.15 0.15]);
plot([w_bw_ref w_bw_ref], [-50 20], '-.', 'linewidth', 1.7, 'color', [0.45 0.45 0.45]);
text(w_nat * 1.03, 6.0, '\omega_n \approx 1.79', 'fontsize', 11, 'color', [0.02 0.52 0.78]);
text(w_break_near * 1.03, -3.0, '\omega = 1.4', 'fontsize', 11, 'color', [0.86 0.15 0.15]);
text(w_break_far * 1.03, -11.0, '\omega = 5', 'fontsize', 11, 'color', [0.06 0.46 0.43]);
text(w_bw_ref * 1.03, 2.0, sprintf('\\omega_{bw} \\approx %.2f', w_bw_ref), 'fontsize', 11, 'color', [0.35 0.35 0.35]);
title('幅频对比：附加极点转折频率若落入带宽内，低阶近似会明显失真');
xlabel('角频率 \omega / rad·s^{-1}');
ylabel('幅值 / dB');
legend('仅主导二阶模型', '附加极点在 -5', '附加极点在 -1.4', 'location', 'southwest');
ylim([-40 10]);
grid on;

subplot(2, 1, 2);
hold on;
semilogx(w, phase_ref, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
semilogx(w, phase_far, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
semilogx(w, phase_near, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
plot([w_nat w_nat], [-270 10], ':', 'linewidth', 1.5, 'color', [0.02 0.52 0.78]);
plot([w_break_far w_break_far], [-270 10], '--', 'linewidth', 1.7, 'color', [0.06 0.46 0.43]);
plot([w_break_near w_break_near], [-270 10], '--', 'linewidth', 1.7, 'color', [0.86 0.15 0.15]);
plot([w_bw_ref w_bw_ref], [-270 10], '-.', 'linewidth', 1.7, 'color', [0.45 0.45 0.45]);
text(w_break_near * 1.03, -118, '\omega = 1.4 已进入主要带宽', 'fontsize', 10, 'color', [0.86 0.15 0.15]);
text(w_break_far * 1.03, -175, '\omega = 5 位于带宽外侧', 'fontsize', 10, 'color', [0.06 0.46 0.43]);
title('相频对比：附加极点越靠近带宽，相位提前下沉越明显');
xlabel('角频率 \omega / rad·s^{-1}');
ylabel('相位 / deg');
ylim([-250 10]);
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '高阶系统能否近似成低阶系统，要看附加极点的转折频率是否侵入主要带宽', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');

raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-05-bode-model-reduction.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-05-bode-model-reduction.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
```

### C.6 `3-1-pp-06-convolution-step-from-impulse.m`

```matlab
1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
s = tf('s');
sys = 12 / ((s + 1) * (s + 2) * (s + 6));
t = 0:0.01:8;
dt = 0.1;
taus = 0:dt:8;
y_limit = [0, 1.05];

[g, t_g] = impulse(sys, t);
[y_exact, t_step] = step(sys, t);
g = squeeze(g);
y_exact = squeeze(y_exact);

y_approx = zeros(size(t));
fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 760]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 760]);
set(fig, 'paperposition', [0, 0, 1180, 760]);

subplot(2, 1, 1);
hold on;
palette = [
  0.02, 0.52, 0.78;
  0.06, 0.46, 0.43;
  0.86, 0.15, 0.15;
  0.92, 0.35, 0.00;
  0.43, 0.32, 0.77;
  0.58, 0.47, 0.20;
  0.16, 0.55, 0.63;
  0.74, 0.29, 0.46;
  0.34, 0.39, 0.48
];

sample_ids = [1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81];

for k = 1:numel(taus)
  delayed = zeros(size(t));
  mask = t >= taus(k);
  delayed(mask) = dt * interp1(t_g, g, t(mask) - taus(k), 'linear', 0);
  y_approx = y_approx + delayed;
  color_id = mod(k - 1, rows(palette)) + 1;
  if any(sample_ids == k)
    plot(t, delayed, 'linewidth', 1.8, 'color', palette(color_id, :));
  endif
endfor

title('抽取更多个延时脉冲响应分量：每一条都来自同一个 g(t)，只是发生时刻不同');
xlabel('时间 t / s');
ylabel('\Delta t g(t-k\Delta t)');
xlim([0, 8]);
grid on;

subplot(2, 1, 2);
hold on;
plot(t_step, y_exact, 'linewidth', 2.6, 'color', [0.02 0.52 0.78]);
plot(t, y_approx, '--', 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
title('卷积数值实验：延时脉冲响应叠加逼近单位阶跃响应');
xlabel('时间 t / s');
ylabel('输出');
legend('精确阶跃响应 y(t)', 'Riemann 叠加近似', 'location', 'southeast');
xlim([0, 8]);
ylim(y_limit);
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '卷积不是抽象符号：许多小的延时脉冲响应连续叠加后，才形成完整阶跃响应', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');

raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-06-convolution-step-from-impulse.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-06-convolution-step-from-impulse.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
```

## 附录 D｜学生自查问题

1. 为什么“高阶系统可低阶近似”必须同时检查时域和频域，而不能只看阶跃响应？
2. 为什么同样都在左半平面，重根和单根对应的时域形态仍可能差很多？
3. 在纯极点系统中，为什么某个模态分量出现负号并不表示系统不稳定？
4. 为什么单位阶跃响应可以理解为多个延时脉冲响应的叠加？
