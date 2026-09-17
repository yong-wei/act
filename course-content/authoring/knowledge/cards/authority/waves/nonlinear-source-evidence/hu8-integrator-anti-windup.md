
> Image description: This figure illustrates a feedback control system with actuator saturation. The input R feeds into a summing junction, generating error e. This error splits into two paths: one proportional to kp, and another integrated via kI/s. Both paths converge at a summing junction that subtracts the output uc from the system. The resulting control signal uc is then passed through a saturation block, depicted as a u-axis graph with limits umin and umax. The saturated output u is applied to the “被控对象” (controlled object), producing output C. The output C feeds back to the summing junction, completing the negative feedback loop. The diagram clearly shows how saturation limits the control action, preventing unrealistic actuator demands.
图8－72 带执行器饱和的反馈系统框图

考虑如图 8－72 所示的反馈系统。假定一个给定的参考阶跃信号比引起执行器达到饱和值 $u_{\text {max }}$ 的输人还大得多，由于积分器继续对误差 $e$ 做积分运算，使信号 $u_{c}$ 持续增大，从而被控对象的输入被锁定在其最大值，即 $u=u_{\text {max }}$ ，所以误差仍然很大，直到被控对象的输出超出参考值，误差值改变符号。而 $u_{c}$ 的增加是不利的，因为进人被控对象的输入没有变化，但如果饱和持续很长一段时间，$u_{c}$ 可能会变得非常大，这将导致一个相当大的负误差 $e$ ，而且产生的很差的动态响应将把积分器输出带回到控制不饱和的线性段。

如果在系统中加人一个积分器抗漂移电路，当执行器饱和时，它可以＂关掉＂积分作用。若控制器是用数字电路实现的，则用逻辑很容易实现这个功能，即通过包括一个像＂if $|\mathrm{u}|=\mathrm{u}_{\text {max }}, \mathrm{k}_{\mathrm{I}}=0$＂的语句。图 8－73（a）和图8－73（b）给出了一个 PI 控制器装置的两个等效的抗漂移方案。图8－73（a）所示的方法更容易理解一些，而图8－73（b）所示的方法更容易实现，因为它不需要一个独立的非线性项而只是利用饱和本身。在这些方案中，只要执行器饱和，积分器附近的反馈回路就开始激活，使得在 $e_{1}$ 处的积分器输入较小。这时，积分器本质上变成了一个快速的一阶超前装置。为了看出这一点，重画图8－73（a）中从 $e$ 到 $u_{c}$ 这部分的方框，如图8－73（c）所示，则利用结构图变换方法不难导出积分器变成了图 8－73（d）所示的一阶超前装置。抗偏移增益 $K_{a}$ 应选得足够大，以使得抗漂移电路在所有误差情况下保持进入积分器的输入都很小。

抗漂移的作用是在反馈系统中降低超调量和控制量。这种抗漂移方案的实现，在任何实际的积分控制应用中都是必需的，忽略这种方法可能导致系统响应的严重退化。从稳定性的角度来说，饱和作用是打开反馈回路，将留下的常量输人的开环对象和控制器当作系统误差为输人的开环系统。

抗漂移的目的是当主环被信号饱和打开时，提供一个局部的反馈使得控制器稳定。
现在，考虑一个对象，其针对小信号传递函数为


