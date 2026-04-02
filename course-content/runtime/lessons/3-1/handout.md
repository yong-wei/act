# 单元 3-1 | 纯极点视角下的稳定、模态与双域近似——高阶系统为何仍可用低阶模型理解

- **层次**：模块3 理论主线 · 第一课
- **学时**：90分钟
- **知识类型**：[C] + [X]
- **前置要求**：已掌握一、二阶系统的标准形式、典型动态性能指标、纯极点系统的基本时域特性与基础频域特性，能够从低阶响应曲线和基础 Bode 图中读出系统的快慢特征、振荡趋势与主要频段特性
- **后续课程**：3-2（稳定边界可视化）、3-3（根轨迹机制与基本法则）、3-4（极点作用与根轨迹综合实验）、3-8（频域判别与跨域综合语言）
- **讲义定位**：本讲义旨在解决一个比"主导极点是什么"更为根本的问题：为什么高阶系统常常仍能用低阶模型来理解，以及这种理解在时域和频域中各自凭什么成立、何时可信、何时会失真。

![封面漫画：单元导入](/course-runtime/lessons/3-1/media/3-1-cover-comic.png){fig-pos="H"}

---

## 一、引入：高阶系统为何没有彻底颠覆低阶直觉

在 `2-2` 和 `2-4` 单元中，我们已经构建了两类基础直觉：

- 时域中，一阶和二阶系统可以用快慢、超调量、调节时间、振荡频率等指标来描述；
- 频域中，典型环节和标准对象可以通过基础 Bode 图观察其主要频段和整体趋势。

然一旦进入实际工程应用，系统模型很快就会升至三阶、四阶甚至更高。以船舶航向控制为例，执行机构、船体动力学、测量环节和扰动通道叠加后，系统结构通常已不再是一个简洁的二阶对象。由此引发两个核心问题：

1. 高阶系统明明包含更多极点，为何工程实践中仍常常能够使用低阶模型来解释其主要动态特性？
2. 这种"忽略某些极点"的做法，何时在时域中成立，何时在频域中也同样成立？

本课的任务就是深入剖析这一问题。我们将重点考察纯极点系统，暂不涉及零点、不改变控制器结构。先回答"极点本身已能说明什么"，再将这一解释从时域扩展到频域。

本课程的一个重要立场是：
**高阶系统之所以常可近似为低阶系统，是因为某些模态衰减更快、某些极点在关注频段内的影响更小。**

## 二、从特征方程到一般自由响应：极点如何决定系统动态特性

### 2.1 闭环特征方程奠定稳定底线

设闭环传递函数为

$$
\Phi(s)=\frac{N(s)}{D(s)}
$$

其中分母多项式满足

$$
D(s)=0
$$

该方程的全部根即为闭环极点。对于线性定常系统，稳定性的底线判断仍然由这些极点决定：

- 全部极点实部小于 $0$：系统渐近稳定；
- 极点位于虚轴上且右半平面无极点：系统处于临界稳定状态；
- 只要出现右半平面极点：系统就包含会持续放大的模态。

![复平面中的稳定区、临界边界与失稳区示意](/course-runtime/lessons/3-1/media/3-1-pp-01-stability-half-plane.svg){#fig:stability-half-plane}

如图~\ref{fig:stability-half-plane} 所示，这一步骤仅回答了"系统是否会失控"。但如果理解到此为止，极点仍只是复平面上的几个坐标点。要真正理解高阶系统，还需进一步追问：这些坐标点如何转化为具体的时间响应？

### 2.2 一般模态展开：极点直接进入时域响应表达式

对于严格真有理系统，若其极点为 $p_i$，每个极点的重数为 $q_i$，则经过部分分式展开后，系统可表示为

$$
G(s)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(s-p_i)^r}
$$

相应的脉冲响应为

$$
g(t)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(r-1)!}t^{r-1}e^{p_i t}, \qquad t \ge 0
$$

这个方程至关重要，它将"极点决定响应"这一概念阐述得极为具体：

- 极点位置 $p_i$ 决定了指数衰减或增长的速率；
- 若极点包含虚部，则会产生振荡项；
- 若极点重复，则会额外乘以 $t, t^2, \dots$ 等多项式因子；
- 系数 $A_{i,r}$ 决定了每个模态在叠加时的方向和权重。

因此，极点并非静态坐标，它们对应的是**系统内部可被激发的运动模态**。

### 2.3 三类典型极点对应的时域响应形态

将三种最常见极点类型及其时域响应并列对比：

![三类典型极点类型与对应响应的对照图](/course-runtime/lessons/3-1/media/3-1-pp-02-poles-and-modes.svg){#fig:poles-and-modes}

如图~\ref{fig:poles-and-modes} 所示，阅读此图时，需将"极点类型"与"响应形态"对应起来：

1. **单个负实极点**
   对应纯指数衰减。它表明系统会收敛到稳态，且收敛过程是单调的。

2. **左半平面共轭复极点**
   对应振荡衰减。虚部控制振荡频率，实部控制包络线的衰减速率。

3. **右半平面极点**
   对应发散模态。即使系统中其他模态均在衰减，只要存在一个右半平面极点，整体系统就谈不上稳定。

这里需注意一个常见误解：
共轭复极点对应的时域响应实际只有**一条物理输出曲线**。数学上写成成对复根，是为了保证时域合成后的输出仍为实函数。图中将极点图和响应图分开，正是为了避免将"两个共轭根"误解为"两条不同的物理响应"。

### 2.4 重根为何需要特别关注

若极点重复，例如出现二重极点 $p$，则对应的时域项将包含

$$
\frac{A_1}{s-p}+\frac{A_2}{(s-p)^2}
\quad \Longrightarrow \quad
A_1 e^{pt}+A_2 t e^{pt}
$$

这意味着：即使两个系统具有相同的极点实部，只要其中一个系统包含重根，其时域包络也可能持续更长、前段形态也会不同。

因此，判断高阶系统能否被低阶系统近似，不能仅凭"极点大致位于左半平面的什么位置"，还需考虑：

- 是否存在与主导区非常接近的额外极点；
- 是否存在接近主导区的重根；
- 这些附加模态的权重是否足以改变系统的主要动态特性。

## 三、时域近似：为何常能用少数主导极点解释主要动态

### 3.1 主导极点并非一句空洞口号

当系统阶数升高时，响应是多个模态叠加的结果。从理论上讲，模态越多，分析应越困难。然而工程实践中却经常出现另一种情况：有些模态衰减极快，仅在初始瞬间显现，随后迅速退场；真正长期影响曲线形态的，往往是那些最靠近虚轴、衰减最缓慢的部分。

这就是主导极点的核心理念：

> 在闭环极点中，最靠近虚轴、衰减最慢的模态，往往决定了系统的主要动态品质。

这一理念之所以有用，是因为它将模块2建立的低阶指标语言重新连接到高阶系统中。只要主导模态清晰，许多高阶系统的主要超调量、调节时间、振荡节奏，仍然能够借用低阶对象的语言做近似解释。

### 3.2 通过三个同直流增益模型比较"近似何时可靠"

考虑以下三个单位直流增益模型：

$$
G_{\mathrm{ref}}(s)=\frac{3.2}{s^2+1.6s+3.2}
$$

$$
G_{\mathrm{A}}(s)=\frac{16}{(s+5)(s^2+1.6s+3.2)}
$$

$$
G_{\mathrm{B}}(s)=\frac{4.48}{(s+1.4)(s^2+1.6s+3.2)}
$$

它们具有同一对主导共轭极点，但附加极点的位置不同：

- **参考模型** 仅保留主导二阶对；
- **系统 A** 的附加极点位于 $-5$，明显更靠左；
- **系统 B** 的附加极点位于 $-1.4$，离主导对已不远。

为将模型与图像一一对应，先将三个模型的单位阶跃响应写成显式表达式。三者共同拥有的主导极点对为

\begin{equation}
p_{1,2}=-0.8 \pm j1.6
\label{eq:dominant-pair}
\end{equation}

因此都会包含同一个主导振荡模态 $e^{-0.8t}\cos 1.6t$ 与 $e^{-0.8t}\sin 1.6t$，区别仅在于附加模态衰减的快慢。

对于参考二阶模型，有

\begin{equation}
\omega_n=\sqrt{3.2}\approx 1.789,\qquad \zeta=\frac{1.6}{2\sqrt{3.2}}\approx 0.447,\qquad \omega_d=\omega_n\sqrt{1-\zeta^2}=1.6
\label{eq:ref-params}
\end{equation}

因此它的阶跃响应为

\begin{equation}
y_{\mathrm{ref}}(t)=1-e^{-0.8t}\left(\cos 1.6t+0.5\sin 1.6t\right)
\label{eq:ref-step}
\end{equation}

对于 **系统 A**，单位阶跃响应可展开为

\begin{equation}
y_{\mathrm{A}}(t)=1-0.1584e^{-5t}-0.8416e^{-0.8t}\cos 1.6t-0.9158e^{-0.8t}\sin 1.6t
\label{eq:far-step}
\end{equation}

对于 **系统 B**，单位阶跃响应可展开为

\begin{equation}
y_{\mathrm{B}}(t)=1-1.0959e^{-1.4t}+0.0959e^{-0.8t}\cos 1.6t-0.9110e^{-0.8t}\sin 1.6t
\label{eq:near-step}
\end{equation}

现在就能够将式~\ref{eq:ref-step}、式~\ref{eq:far-step} 与式~\ref{eq:near-step} 和图~\ref{fig:dominant-step} 的响应曲线一一对应：

- **参考模型** 仅有一组衰减率为 $0.8$ 的主导振荡模态，其响应的主要节奏完全由该共轭极点对决定；
- **系统 A** 多出的附加模态 $e^{-5t}$，对应的时间常数仅为 $0.2$ s，远小于主导模态的时间常数 $1/0.8=1.25$ s，因此它仅在前段轻微修正响应，很快退场；
- **系统 B** 多出的附加模态 $e^{-1.4t}$，对应的时间常数约为 $0.714$ s，已落入主导动态的同一时间尺度，因此它会持续影响上升过程、超调量和峰值出现时刻。

![主导极点近似何时可靠的时域对照图](/course-runtime/lessons/3-1/media/3-1-pp-03-dominant-pole-response-families.svg){#fig:dominant-step}

如图~\ref{fig:dominant-step} 所示，右侧三条阶跃响应曲线的差异，正是由上述三种模态衰减速率不同造成的。为使"视觉感受"进一步落实到可计算的结论，现将几个常用时域指标列出。

对于参考二阶模型，标准公式由式~\ref{eq:second-order-mp} 到式~\ref{eq:second-order-ts} 给出：

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

将标准公式结果与 Octave 数值结果统一列出，得到表~\ref{tbl:time-metrics}。

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
系统 A & $-5$ & 0.934（数值） & 2.191（数值） & 19.28（数值） & 4.862（数值） & 快速模态仅轻微拖慢上升并略减小超调 \\
系统 B & $-1.4$ & 1.338（数值） & 2.829（数值） & 7.04（数值） & 4.828（数值） & 附加极点进入主要动态区，显著压低超调并拖慢响应 \\
\bottomrule
\end{tabular}
\end{table}

表~\ref{tbl:time-metrics} 表明的并非"高阶系统一定更慢"，而是"当附加极点靠近主导区时，会重新定义主要动态指标"。由此可得两个实用的工程结论：

1. 若附加极点衰减速度足够快，它对主要超调量、振荡节奏和大部分调节时间的影响可以很小；
2. 若附加极点离主导对不够远，它会显著改变前段上升速度、超调量乃至整体收敛节奏。

### 3.3 时域忽略可接受的条件

在纯极点系统中，经验上常用两条判断准则：

- 若被忽略极点的实部绝对值大约是主导极点实部绝对值的 `3~5` 倍以上，时域近似通常较为可靠；
- 若额外极点靠近主导对，或存在多个附加极点在主导区附近聚集，即使系统稳定，低阶近似也很可能失真。

这里必须牢记：这是**工程经验准则**，而非永远成立的定理。必须结合具体曲线、具体权重进行综合判断。

## 四、频域近似：为何某些极点在 Bode 图上也可忽略

### 4.1 仅依靠时域曲线比较并不充分

如果仅观察时域特性，我们最多能说"这条曲线是否类似于二阶系统"。但工程实践中还会进一步追问：

- 这个近似模型在主要工作频段内，其幅频和相频特性是否也近似？
- 若要基于频域直觉估计主要带宽、响应速度或主要相位滞后，这种近似是否仍然可靠？

这就需要将同一组模型放入频域中重新审视。

### 4.2 通过 Bode 图考察"被忽略极点在关注频段内的影响范围"

继续比较刚才三组模型的 Bode 图：

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

从式~\ref{eq:mag-ref} 到式~\ref{eq:mag-near} 这三个幅频特性表达式中，可直接看出两个频率来源：

- 二阶公共因子 $s^2+1.6s+3.2$ 决定了主导频率尺度，其中固有频率为

$$
\omega_n=\sqrt{3.2}\approx 1.79\ \text{rad/s}
$$

- 一阶附加因子 $(s+5)$ 与 $(s+1.4)$ 分别带来转折频率 $\omega=5$ rad/s 与 $\omega=1.4$ rad/s。

这就是图~\ref{fig:bode-reduction} 中几条彩色竖线的来源：蓝色标记主导二阶对的固有频率，绿色和红色分别标记两个附加极点对应的转折频率，灰色竖线标记参考模型的数值带宽 $\omega_{\mathrm{bw}}\approx 2.39$ rad/s。

![高阶系统与近似低阶系统的 Bode 对比图](/course-runtime/lessons/3-1/media/3-1-pp-05-bode-model-reduction.svg){#fig:bode-reduction}

图~\ref{fig:bode-reduction} 的重点不在于"如何手工绘制 Bode 图"，而在于观察**幅相偏差出现在哪些频段**，以及这些偏差是否已进入系统的主要带宽。

由于三个模型的直流增益均为 $1$，可将带宽统一理解为"幅值首次降至 $-3$ dB 附近的频率"。Octave 数值结果见表~\ref{tbl:freq-metrics}。

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
系统 A & 5.000 & 2.282 & 约下降 4.5\% & 转折频率落在参考带宽外，主要频段内偏差较小 \\
系统 B & 1.400 & 1.763 & 约下降 26.2\% & 转折频率落入带宽内，主要频段骨架被明显改写 \\
\bottomrule
\end{tabular}
\end{table}

针对这三组模型：

- 参考模型的主要带宽约为 $\omega_{\mathrm{bw}}\approx 2.39$ rad/s，因此这个频带内的幅相关系最值得关注；
- 若附加极点在 $-5$，其转折频率位于参考带宽之外，图~\ref{fig:bode-reduction} 中绿色竖线位于灰色带宽线右侧，因此在主要频段中仅引起温和偏差；
- 若附加极点在 $-1.4$，其转折频率已落入带宽内部，图~\ref{fig:bode-reduction} 中红色竖线贯穿主要工作频带，因此幅值和相位都会提前被改写。

这也是本课程首次显式引入**频域中的近似计算**。对于附加的一阶极点

\begin{equation}
\frac{1}{1+s/p}
\label{eq:extra-pole-factor}
\end{equation}

若关注频带满足 $\omega \ll p$，则在该频带内可近似为式~\ref{eq:extra-pole-approx}

\begin{equation}
\left|\frac{1}{1+j\omega/p}\right| \approx 1,\qquad \angle\frac{1}{1+j\omega/p}\approx 0^\circ
\label{eq:extra-pole-approx}
\end{equation}

也就是说，只要附加极点的转折频率远在主要带宽之外，它在关注频带中就近似"无作用"；但一旦转折频率落入带宽范围，这个近似会迅速失效。

于是频域判断与时域判断就衔接起来：

- **远离关注频段的附加极点**，在主要频段内仅引入较小的幅相偏差；
- **靠近主导频段的附加极点**，会直接改写 Bode 图的整体骨架，因此不能轻易忽略。

### 4.3 频域忽略可接受的条件

在本课程的纯极点范围内，可先使用表~\ref{tbl:approx-criteria} 中的经验判断：

\begin{table}[H]
\centering
\caption{时域与频域近似何时可接受的经验判断}
\label{tbl:approx-criteria}
\small
\begin{tabular}{>{\raggedright\arraybackslash}p{1.6cm} >{\raggedright\arraybackslash}p{4.4cm} >{\raggedright\arraybackslash}p{4.4cm}}
\toprule
判断维度 & 经验上较可靠的情形 & 不可靠的情形 \\
\midrule
时域 & 被忽略极点明显更靠左，衰减更快 & 被忽略极点离主导区不远，或重根贴近主导区 \\
频域 & 被忽略极点的折点频率高于关注频段上界若干倍 & 被忽略极点已落入主要频段附近 \\
解释用途 & 粗略估算快慢、振荡趋势、主要带宽骨架 & 需要精确计算裕度、误差或进行稳定性判断 \\
\bottomrule
\end{tabular}
\end{table}

这里再次强调边界：
本课允许使用 Bode 图为"高阶系统为何能近似为低阶系统"提供证据，但**不涉及 Nyquist 判据、Bode 稳定判据和裕度设计语言**。这些内容将留待后续的 `3-8` 单元探讨。

> **[AI融入点] 双域近似判断**
>
> 先自行判断：对上述三组模型，若仅保留主导二阶对，哪一组在时域和频域上都更接近近似对象？
>
> 然后向 AI 提问：
> "比较 $G_{\mathrm{A}}(s)$、$G_{\mathrm{B}}(s)$ 与 $G_{\mathrm{ref}}(s)$ 的低阶近似可靠性，要求同时使用阶跃响应和 Bode 图说明理由。"
>
> 最后不要止于 AI 的口头描述，而要回到本讲的 Octave 图中核对：
> 时域参看 `3-1-pp-03-dominant-pole-response-families.m`，频域参看 `3-1-pp-05-bode-model-reduction.m`。

## 五、卷积与模态叠加：输入为何激发同一套极点语言

### 5.1 单位阶跃并非仅是"瞬时跳变"

在模块2中你已了解卷积。但在高阶系统背景下，卷积必须向前推进一步：它需要解释**为何同一个系统在不同输入激励下，仍表现出同一套由极点主导的动态特性**。

对于线性定常系统，输出满足

$$
y(t)=\int_0^t g(t-\tau)u(\tau)\,\mathrm{d}\tau
$$

其中 $g(t)$ 是系统的脉冲响应。若输入为单位阶跃 $u(t)=1(t)$，则有

$$
y_{\text{step}}(t)=\int_0^t g(t-\tau)\,\mathrm{d}\tau
$$

这表明阶跃响应可理解为：
**将许多延时后的脉冲响应沿时间轴连续叠加。**

### 5.2 数值实验：用延时脉冲响应叠加逼近阶跃响应

下图以数值方式实现了上述概念。实现方法很简单：

1. 将单位阶跃近似表示为多个延时冲激的 Riemann 和；
2. 每个冲激通过系统后，产生一条缩放后的延时脉冲响应；
3. 将这些响应累加，得到对阶跃响应的逼近。

![通过卷积把单位阶跃响应看成多个延时脉冲响应叠加的数值实验](/course-runtime/lessons/3-1/media/3-1-pp-06-convolution-step-from-impulse.svg){#fig:convolution-step}

如图~\ref{fig:convolution-step} 所示，其中"延时脉冲响应分量"子图取了更多个分量，但时间轴仍控制在 $0\sim 8$ s。为保留单个分量的细节，此分量子图采用自适应纵轴；"阶跃响应比较"子图则保持统一范围，用于直接比较精确阶跃响应与 Riemann 叠加近似的整体吻合程度。

此图的意义不在于公式变复杂了，而在于你终于能看到：

- 脉冲响应本身已由极点决定；
- 阶跃响应只是将这些"由极点决定的脉冲响应碎片"连续累加；
- 因此无论输入如何激发，系统总是遵循其固有的模态结构。

### 5.3 一个明确的高阶示例：模态叠加并不要求各分量均从正值开始

考虑以下明确的三阶纯极点模型：

$$
G(s)=\frac{12}{(s+1)(s+2)(s+6)}
$$

其部分分式展开为

$$
G(s)=\frac{2.4}{s+1}-\frac{3}{s+2}+\frac{0.6}{s+6}
$$

因此脉冲响应为

$$
g(t)=2.4e^{-t}-3e^{-2t}+0.6e^{-6t}
$$

![显式系统模型下的模态分量、留数与总响应关系图](/course-runtime/lessons/3-1/media/3-1-pp-04-modal-superposition-high-order.svg){#fig:modal-superposition}

如图~\ref{fig:modal-superposition} 所示，此示例修正了此前可能引起的误解。此处三个极点均在左半平面且互不重复，但第二个模态分量确实为负。原因不在于极点位置，而在于其**留数系数为负**。因此：

- 极点位置决定了每个模态的衰减节奏；
- 留数的符号和大小决定了每个模态是正向叠加、负向抵消，还是权重微小；
- 总响应是所有模态共同叠加的结果。

因此，"某个模态分量初始值为负"并不表示图解错误；只要系统模型、部分分式展开和解析表达式明确，这就是可解释、可复现的现象。

## 六、本节小结与后续铺垫

1. 闭环特征方程的根就是闭环极点；稳定性的底线首先由极点位置决定。
2. 极点之所以重要，是因为它们直接进入一般自由响应表达式，形成系统的运动模态；重根还会带来额外的 $t^k e^{pt}$ 因子。
3. 高阶系统常能用低阶模型理解，是因为某些附加模态在时域中衰减更快，在关注频段内引入的 Bode 偏差也更小。
4. 主导极点近似必须进行双域检查：时域上要考察主要动态是否被改变，频域上要检查关注频段内的幅相偏差是否可接受。
5. 卷积完整解释了"输入如何激发模态"：阶跃响应可视为多个延时脉冲响应的叠加，而这些脉冲响应本身仍由极点决定。
6. 下一课 `3-2` 将把"稳定边界"转化为可见对象；再下一课 `3-3` 进入"增益变化为何推动闭环极点迁移"的根轨迹机制。

![本讲信息图总结](/course-runtime/lessons/3-1/media/3-1-info.png)

## 附录 A｜本讲图示与复现文件

本讲正式使用的图示均由 Octave 脚本生成：

- `3-1-pp-01-stability-half-plane.m`
- `3-1-pp-02-poles-and-modes.m`
- `3-1-pp-03-dominant-pole-response-families.m`
- `3-1-pp-04-modal-superposition-high-order.m`
- `3-1-pp-05-bode-model-reduction.m`
- `3-1-pp-06-convolution-step-from-impulse.m`

运行前请确认已安装并加载 `control` 包。

## 附录 B｜通过卷积求单位阶跃响应的完整推导

### B.1 从卷积定义出发

对于线性定常系统，输出满足

$$
y(t)=\int_0^t g(t-\tau)u(\tau)\,\mathrm{d}\tau
$$

这里 $g(t)$ 是脉冲响应，$u(\tau)$ 是输入。

### B.2 输入为单位阶跃时

若

$$
u(t)=1(t)
$$

那么在 $0 \le \tau \le t$ 上 $u(\tau)=1$，因此

$$
y_{\text{step}}(t)=\int_0^t g(t-\tau)\,\mathrm{d}\tau
$$

作变量替换 $\lambda=t-\tau$，则

$$
\lambda=t-\tau, \qquad \mathrm{d}\lambda=-\mathrm{d}\tau
$$

当 $\tau=0$ 时，$\lambda=t$；当 $\tau=t$ 时，$\lambda=0$。于是

$$
y_{\text{step}}(t)=\int_t^0 g(\lambda)(-\mathrm{d}\lambda)
=\int_0^t g(\lambda)\,\mathrm{d}\lambda
$$

这说明单位阶跃响应就是脉冲响应从 $0$ 到 $t$ 的累积面积。

### B.3 写为延时脉冲响应叠加的离散近似

将区间 $[0,t]$ 等分为步长 $\Delta t$ 的若干小段，则有

$$
y_{\text{step}}(t)
\approx
\sum_{k=0}^{N} g(t-k\Delta t)\Delta t
$$

这就是数值实验采用的 Riemann 叠加形式。其物理含义是：

- 在每个时刻 $k\Delta t$ 施加一个权重为 $\Delta t$ 的小冲激；
- 每个小冲激通过系统后，产生一条延时的脉冲响应；
- 将这些延时脉冲响应叠加，就逼近了单位阶跃响应。

### B.4 为何这与极点有关

如果脉冲响应本身满足

$$
g(t)=\sum_i C_i e^{p_i t}
$$

那么卷积叠加中的每一条延时响应仍由同一组极点 $p_i$ 决定。
这就是"输入会激发模态，但不会改变系统固有模态结构"的含义。

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

1. 为何"高阶系统可低阶近似"必须同时检查时域和频域，而不能仅观察阶跃响应？
2. 为何同样位于左半平面，重根和单根对应的时域形态仍可能存在显著差异？
3. 在纯极点系统中，为何某个模态分量出现负号并不代表系统不稳定？
4. 为何单位阶跃响应可以理解为多个延时脉冲响应的叠加？