# 各域未覆盖成员代表性概念清单（Issue #1515）


生成方式：覆盖判定用两层度量（zh-CN 标签/中文名子串命中；description 首子句 ≥6 字符中文片段命中）。每域列出未覆盖成员的代表样本（按出现序去重，名称缺失时以描述首句代替），供课程负责人逐域观察未覆盖内容的构成。

> 读取提示：样本中出现的三种典型模式——(A) 教材例题级细粒度条目（“示例系统××”“××传递函数”等公式/模型变体）；(B) 完整理论块缺失（如李雅普诺夫直接法体系）；(C) 域内超纲工程概念（教材案例中的传感器、电路等）。各域主导模式见域标题下注释。


## root-locus

未覆盖 75/103；类型分布：DomainConcept×58、Formula×15、KnowledgeStatement×1、SystemModel×1

- （DomainConcept）The value of the nth self-loop transmittance in Ma
- （DomainConcept）反馈路径根轨迹增益 — 反馈通路传递函数中分子多项式最高项系数归一化后的增益，记为K_H*。
- （DomainConcept）闭环系统特征方程式的根，即闭环传递函数的极点。 — 闭环系统特征方程式的根，即闭环传递函数的极点。
- （DomainConcept）埃文斯根轨迹构造法 — A set of rules to construct the root-locus graph, used for selecting p
- （DomainConcept）废气传感器 — A sensor that gives an indication of a rich or lean exhaust and compar
- （DomainConcept）虚轴穿越 — The points at which the root locus crosses the imaginary axis.
- （DomainConcept）A measure of the sensitivity of the system perform
- （DomainConcept）首一多项式 — A polynomial whose coefficient of the highest power of s is 1.
- （DomainConcept）等效单位反馈系统 — 在绘制参数根轨迹之前引入的概念，使得常规根轨迹的所有绘制法则均适用于参数根轨迹的绘制。
- （DomainConcept）集总参数电路 — A circuit with normal attenuation of 20n dB/decade, in contrast to dis
- （DomainConcept）The slope parameter characterizing the reaction cu
- （DomainConcept）图形增益计算方法 — Method to compute the gain K by measuring the lengths of vectors from 
- （DomainConcept）根轨迹分支 — The individual loci that make up the root locus; each branch correspon
- （DomainConcept）A network composed of distributed R and C elements
- （DomainConcept）The period of the sustained oscillations, denoted 
- （DomainConcept）回路传递函数 — The transfer function defined as L(s)=b(s)/a(s) used in the root-locus
- （DomainConcept）绘制根轨迹的七个步骤 — A seven-step procedure for sketching a root locus, including preparing
- （DomainConcept）A system whose transfer function has a zero in the
- …（其余同型省略）

## time-domain-analysis

未覆盖 461/572；类型分布：KnowledgeStatement×284、DomainConcept×87、Formula×74、SystemModel×16

- （Formula）开环系统单位阶跃稳态误差 — The steady-state error of the open-loop control system for a unit step
- （Formula）开环系统拉普拉斯域误差 — The error of the open-loop control system in the Laplace domain, given
- （Formula）闭环跟踪误差 — The tracking error of the closed-loop system in the Laplace domain whe
- （Formula）闭环系统单位阶跃稳态误差 — The steady-state error of the closed-loop system for a unit step input
- （DomainConcept）瞬态响应 — The response of a system as a function of time before steady-state.
- （Formula）示例系统开环稳态误差 — The steady-state error of the open-loop system for the example with G(
- （Formula）速度控制系统阶跃指令输入 — Step command input signal for the speed control system.
- （Formula）闭环速度控制系统传递函数 — Closed-loop transfer function of the speed control system with tachome
- （Formula）对Km变化的闭环灵敏度 — Sensitivity of the closed-loop system to a variation in the motor cons
- （Formula）闭环误差拉普拉斯表达式 — The closed-loop error in the Laplace domain expressed as the differenc
- （Formula）开环速度控制系统输出响应 — Output response of the open-loop speed control system in the s-domain.
- （DomainConcept）闭环瞬态响应指数参数p — Exponent parameter in the closed-loop transient response, defined as p
- （Formula）开环速度控制系统传递函数 — Transfer function of the open-loop speed control system relating outpu
- （Formula）示例系统控制器传递函数G_c(s) — The controller transfer function for the example system, given by G_c(
- （Formula）典型参数下闭环灵敏度 — Closed-loop sensitivity evaluated with typical parameter values.
- （SystemModel）开环速度控制系统 — A speed control system operated without feedback, consisting of an amp
- （Formula）增益漂移引起的开环稳态误差变化 — The magnitude of the open-loop steady-state error change when the proc
- （Formula）示例过程传递函数G(s) — The process transfer function for the example system, given by G(s) = 
- …（其余同型省略）

## frequency-domain-analysis

未覆盖 857/952；类型分布：KnowledgeStatement×440、Formula×314、DomainConcept×85、ModelRepresentation×13、SystemModel×5

- （KnowledgeStatement）相对稳定性临界段 — The Nyquist stability criterion is defined in terms of the (-1,0) poin
- （Formula）阻尼比与相位裕度近似关系 — Equation (9.58) is an approximate linear relationship between the damp
- （Formula）特征方程表达式 — Expression of F(s) as the characteristic equation, where L(s) is the l
- （Formula）奈奎斯特围线映射方程 — The net number of encirclements N of the origin of the F(s)-plane is Z
- （DomainConcept）奈奎斯特围线Γ_s — A contour Γ_s in the s-plane that encloses the entire right-hand s-pla
- （KnowledgeStatement）奈奎斯特稳定性判据 — The Nyquist criterion provides information concerning absolute stabili
- （Formula）阻尼比与相位裕度关系式 — Equation (9.57) provides the relationship between the damping ratio ζ 
- （DomainConcept）s 平面到 F(s) 平面的映射 — A contour or trajectory in one plane mapped or translated into another
- （Formula）二阶系统穿越频率方程 — Equation (9.55) sets the magnitude of the frequency response equal to 
- （KnowledgeStatement）s平面相对稳定性定义 — For the s-plane, the relative stability of a system is the property me
- （KnowledgeStatement）奈奎斯特图对称性结论 — The plot of the contour Γ_L for the range -∞<ω<0- will be the complex 
- （Formula）函数F(s)定义 — The function F(s) defined as 1 plus the loop transfer function L(s).
- （KnowledgeStatement）从伯德图评估增益裕度和相位裕度 — The gain and phase margins are easily evaluated from the Bode plot. Th
- （KnowledgeStatement）奈奎斯特稳定判据（一般形式） — A feedback control system is stable if and only if, for the contour Γ_
- （KnowledgeStatement）对数幅相图与稳定裕度 — The frequency response of a system can be graphically portrayed on the
- （Formula）回路传递函数有理分式 — The loop transfer function expressed as a ratio of numerator and denom
- （Formula）二阶系统闭环极点公式 — The closed-loop roots are s = -ζω_n ± jω_n √(1-ζ^2).
- （KnowledgeStatement）相位裕度定义 — An alternative measure of relative stability can be defined in terms o
- …（其余同型省略）

## classical-control-design

未覆盖 689/744；类型分布：KnowledgeStatement×496、Formula×103、DomainConcept×77、SystemModel×13

- （KnowledgeStatement）〔KnowledgeStatement·无名称占位〕
- （DomainConcept）〔DomainConcept·无名称占位〕
- （Formula）〔Formula·无名称占位〕
- （KnowledgeStatement）The steady-state error of a system depends on the 
- （DomainConcept）最大滞后角 — 滞后网络在最大滞后角频率处达到的最大滞后相角，φm=arcsin((1-b)/(1+b))。
- （Formula）PI compensator transfer function
- （KnowledgeStatement）K G(s) will yield Kv = 10 if K = 1. Therefore, the
- （KnowledgeStatement）In lead-compensation designs there are three prima
- （Formula）PID compensator transfer function
- （Formula）Differentiator Compensator Frequency Response
- （KnowledgeStatement）The typical objective of lag-compensation design i
- （DomainConcept）P控制器 — P控制器
- （KnowledgeStatement）Fix low-frequency gain to meet Kv=10, then use lag
- （KnowledgeStatement）It is usually wise to allow for some margin of err
- （KnowledgeStatement）The percent overshoot is P.O. = 34%, the settling 
- （KnowledgeStatement）The total magnitude gain for the compensator is 20
- （SystemModel）G0(s)=10/[s(s+1)]
- （Formula）Alpha from Maximum Phase Lead
- …（其余同型省略）

## system-modeling

未覆盖 603/641；类型分布：DomainConcept×236、Formula×205、KnowledgeStatement×162

- （DomainConcept）前向通路上各支路增益之乘积，一般用 p_k 表示。 — 前向通路上各支路增益之乘积，一般用 p_k 表示。
- （DomainConcept）In spacecraft attitude control, disturbances are t
- （DomainConcept）合同明确要求 composite/has_formula。现有 Canonical 是 Formula，权威来源成员锚定式 (2-73)，同一原始公式块还完整给出式 (2-74)；正文直接说明闭环传递函数的输入、输出和扰动语义。应补建 DomainConcept/representation_kind 伴随对象，不能把 Formula 误作无具体 SystemModel 的 ModelRepresentation。 — 合同明确要求 composite/has_formula。现有 Canonical 是 Formula，权威来源成员锚定式 (2-73)，同
- （DomainConcept）A mechanical system consisting of a mass suspended
- （DomainConcept）离散时间系统通常称为离散系统，可以是一类实际的离散时间问题的数学模型，如社会经济问题、生态问题等，也可以是一个连续系统因为采用数字计算机进行计算或控制的需要而人为地加以时间离散化而导出的模型。 — 离散时间系统通常称为离散系统，可以是一类实际的离散时间问题的数学模型，如社会经济问题、生态问题等，也可以是一个连续系统因为采用数字计算机进行
- （DomainConcept）The operation of converting a Laplace-domain funct
- （DomainConcept）信号流图的特征式，定义为 Δ = 1 - ΣL_a + ΣL_b L_c - ΣL_d L_e L_f + ...，其中 ΣL_a 为所有单独回路增益之和，ΣL_b L_c 为所有互不接触的单独回路中每次取两个回路的回路增益乘积之和，ΣL_d L_e L_f 为所有互不接触的单独回路中每次取三个回路的回路增益乘积之和。 — 信号流图的特征式，定义为 Δ = 1 - ΣL_a + ΣL_b L_c - ΣL_d L_e L_f + ...，其中 ΣL_a 为所有单
- （DomainConcept）离散系统状态方程中矩阵 G 的一种特殊形式，用于可控标准型。 — 离散系统状态方程中矩阵 G 的一种特殊形式，用于可控标准型。
- （DomainConcept）To find state-space equations, define a state vect
- （DomainConcept）A method to derive a state model from a transfer f
- （DomainConcept）A technique to determine partial-fraction coeffici
- （DomainConcept）零极点增益形式 — v3T accepted candidate for pole zero gain form.
- （DomainConcept）求解齐次状态方程的一种方法，假设解为 $t$ 的向量幂级数，通过比较系数得到状态转移矩阵的级数形式。 — 求解齐次状态方程的一种方法，假设解为 $t$ 的向量幂级数，通过比较系数得到状态转移矩阵的级数形式。
- （DomainConcept）Define convenient coordinates for position, veloci
- （DomainConcept）建立状态空间表达式的两种主要方法：一是根据系统机理建立微分或差分方程并选择状态变量；二是由已知的其他数学模型转化得到。 — 建立状态空间表达式的两种主要方法：一是根据系统机理建立微分或差分方程并选择状态变量；二是由已知的其他数学模型转化得到。
- （DomainConcept）v3T accepted candidate for state vector.
- （DomainConcept）先由系统原理图画出系统方框图，分别列写各元件的微分方程，然后消去中间变量。 — 先由系统原理图画出系统方框图，分别列写各元件的微分方程，然后消去中间变量。
- （DomainConcept）The matrix Φ(s) = (sI - A)^{-1}.
- …（其余同型省略）

## stability-analysis

未覆盖 224/243；类型分布：KnowledgeStatement×163、Formula×35、DomainConcept×25、SystemModel×1

- （KnowledgeStatement）Example: Case 4 with repeated jω-axis roots
- （KnowledgeStatement）例3-11变量替换后的特征方程 — 例3-11变量替换后的特征方程
- （KnowledgeStatement）A capacitor driven by a current source has impulse
- （KnowledgeStatement）The shifting of the s-plane axis to ascertain the 
- （Formula）脉冲响应极限为零的稳定性条件
- （KnowledgeStatement）Arrange coefficients of characteristic polynomial 
- （KnowledgeStatement）已知系统特征方程为 D（s）=s^6+s^5-2s^4-3s^3-7s^2-4s-4=0，试用劳斯稳定判据分析系统的稳定性。 — 已知系统特征方程为 D(s)=s^6+s^5-2s^4-3s^3-7s^2-4s-4=0，试用劳斯稳定判据分析系统的稳定性。
- （KnowledgeStatement）Quotient after dividing Example 6.4 polynomial by 
- （KnowledgeStatement）Capacitor impulse response integral
- （KnowledgeStatement）For K=10 and K_I=5, the closed-loop poles are at -
- （KnowledgeStatement）This criterion requires that there be no changes i
- （Formula）Third-order system characteristic polynomial
- （KnowledgeStatement）For K=1 and K_I=0, the closed-loop poles are at 0 
- （Formula）Expanded characteristic equation in terms of roots
- （KnowledgeStatement）For K=K_I=1, the poles and zeros are all at -1.
- （KnowledgeStatement）Stability condition for Case 3 example
- （KnowledgeStatement）The location in the s-plane of the poles of a syst
- （KnowledgeStatement）Example 3.34 characteristic equation
- …（其余同型省略）

## lyapunov-stability

未覆盖 134/141；类型分布：DomainConcept×38、Formula×36、Condition×26、KnowledgeStatement×13、StatementArgument×13、SystemModel×5、ModelRepresentation×3

- （Condition）〔Condition·无名称占位〕
- （Condition）A为非奇异矩阵
- （Condition）线性定常系统ẋ = Ax, x(0)=x₀, t≥0；对于任意给定的一个正定对称矩阵Q，有唯一的正定对称矩阵P使AᵀP + PA = -Q成立
- （Condition）定常系统ẋ = f(x), t≥0, f(0)=0；存在一个具有连续一阶导数的标量函数V(x), V(0)=0，并且对于状态空间X中的一切非零点x满足：1) V(x)为正定；2) V̇(x)为负定；3) 当||x||→∞时V(x)→∞
- （Condition）线性定常系统ẋ = Ax, x(0)=x₀, t≥0
- （Condition）系统为线性定常
- （Condition）定常系统ẋ = f(x), t≥0, f(0)=0；存在一个具有连续一阶导数的标量函数V(x)（其中V(0)=0），和围绕原点的域Ω，使得对于一切x∈Ω和一切t≥t₀满足：1) V(x)为正定；2) V̇(x)为正定
- （Condition）定常系统ẋ = f(x), t≥0, f(0)=0；存在一个具有连续一阶导数的标量函数V(x), V(0)=0，并且对状态空间X中的一切非零点x满足：1) V(x)为正定；2) V̇(x)为负半定；3) 对任意x∈X, V̇(x(t; x₀,0)) ≠ 0；4) 当||x||→∞时V(x)→∞
- （DomainConcept）正定性（标量函数）
- （DomainConcept）李雅普诺夫稳定性
- （DomainConcept）负半定性（标量函数）
- （DomainConcept）正定矩阵
- （DomainConcept）正半定性（标量函数）
- （DomainConcept）平衡状态
- （DomainConcept）稳定性矩阵
- （DomainConcept）能量函数（李雅普诺夫）
- （DomainConcept）负定性（标量函数）
- （DomainConcept）李雅普诺夫第一法（间接法）
- …（其余同型省略）

## discrete-time-control-analysis

未覆盖 587/619；类型分布：KnowledgeStatement×354、Formula×115、DomainConcept×114、SystemModel×4

- （KnowledgeStatement）Because physical systems often have more poles tha
- （KnowledgeStatement）Zero-order hold operation
- （KnowledgeStatement）z-transform of G(s)
- （Formula）First-order low-pass anti-alias prefilter transfer
- （Formula）z-transform inversion by long division
- （KnowledgeStatement）In a digital system, noise frequency can be aliase
- （KnowledgeStatement）Sampling frequency effect on reconstruction accura
- （Formula）保持器多项式外推公式
- （KnowledgeStatement）Given the z-transform Y(z)=N(z)/D_d(z), we simply 
- （KnowledgeStatement）Tustin's method assumes that the input to the cont
- （KnowledgeStatement）Aliasing example: 60 Hz signal sampled at 50 Hz pr
- （KnowledgeStatement）Placing lag in analog part and counteracting lead 
- （KnowledgeStatement）在离散系统中应用z变换，是为了把s的超越方程或者描述离散系统的差分方程转换为z的代数方程，然后写出离散系统的脉冲传递函数（z域传递函数），再用z反变换法求出离散系统的时间响应。 — 在离散系统中应用z变换，是为了把s的超越方程或者描述离散系统的差分方程转换为z的代数方程，然后写出离散系统的脉冲传递函数（z域传递函数），再
- （Formula）Magnitude of z in s-plane mapping
- （DomainConcept）奈奎斯特-香农采样定理 — A theorem stating that for a signal to be accurately reconstructed fro
- （KnowledgeStatement）Tustin's technique and the MPZ method show a notch
- （DomainConcept）异步采样 — As noted in the previous paragraphs, divorcing the prefilter design fr
- （KnowledgeStatement）The bandwidth ω_BW for Example 6.15 is approximate
- …（其余同型省略）

## discrete-time-control-design

未覆盖 429/441；类型分布：DomainConcept×106、Condition×105、Formula×74、KnowledgeStatement×70、StatementArgument×70、ModelRepresentation×2、SystemModel×2

- （Condition）〔Condition·无名称占位〕
- （Condition）系统为离散系统
- （Condition）最少拍系统调节时间与输入形式无关的论证
- （Condition）系统为线性时不变离散系统。
- （Condition）闭环离散系统如图 7-73 所示，采样周期 T 在 0 ≤ T ≤ 1.2s 范围内变化。
- （Condition）G(z) 无延迟且在 z 平面单位圆上及单位圆外无零极点
- （Condition）采样周期 T 足够小以保证离散化精度。
- （Condition）系统为单位反馈，期望一拍响应。
- （Condition）系统为离散控制系统，输入信号为典型信号（如单位阶跃、单位斜坡等）。
- （Condition）最少拍系统设计前提成立
- （Condition）无纹波最少拍系统增加拍数等于 G(z) 单位圆内零点数
- （Condition）针对单位斜坡输入设计的最少拍系统，选择 Φ(z)=2z^{-1}-z^{-2}
- （Condition）连续控制器为 G_c(s) = K*(s+a)/(s+b)，采样周期为 T。
- （Condition）典型输入形式为 R(z)=A(z)/(1-z^{-1})^m
- （Condition）已设计连续控制器 G_c(s)，采样周期 T 已知。
- （Condition）系统为二阶，特征多项式系数为实数。
- （Condition）系统为离散控制系统，输入信号为典型信号，且要求输出在采样点之间无纹波。
- （Condition）输入信号为 r(t)=R0+R1 t+1/2 R2 t^2+...+1/(q-1)! R_{q-1} t^{q-1}
- …（其余同型省略）

## state-space-control-analysis-and-design

未覆盖 1236/1282；类型分布：KnowledgeStatement×762、Formula×288、DomainConcept×140、SystemModel×46

- （KnowledgeStatement）Figure 7.47 shows two possibilities for introducin
- （KnowledgeStatement）打印机皮带驱动系统稳定性分析步骤 — 打印机皮带驱动系统稳定性分析步骤
- （KnowledgeStatement）Combined equations for t3
- （KnowledgeStatement）例9-21变换后矩阵 — 例9-21变换后矩阵
- （KnowledgeStatement）For the observer in Example 11.8, zeta = 0.8 and o
- （KnowledgeStatement）Simplified characteristic equation for K
- （KnowledgeStatement）可观测性规范分解与可控性规范分解有相类似的分析与结论 — 可观测性规范分解与可控性规范分解有相类似的分析与结论
- （KnowledgeStatement）秩判据充分性导出向量与可控性阵关系 — 秩判据充分性导出向量与可控性阵关系
- （KnowledgeStatement）Systems that are not completely observable but whe
- （KnowledgeStatement）若在有限时间间隔内，存在无约束分段连续控制函数，能使任意初始输出转移到任意最终输出，则称此系统输出完全可控。 — 若在有限时间间隔内，存在无约束分段连续控制函数，能使任意初始输出转移到任意最终输出，则称此系统输出完全可控。
- （Formula）Closed-loop transfer function with reference input
- （KnowledgeStatement）Use Ackermann's formula K = [0 0 ... 1] P_c^{-1} q
- （KnowledgeStatement）Derivation of discrete-time controllability condit
- （Formula）齐次状态方程
- （DomainConcept）左伴随矩阵 — The matrix Aₒ in observer canonical form, where the coefficients of th
- （Formula）Output equation for overall system
- （KnowledgeStatement）Estimator pole placed small compared to control dy
- （Formula）非奇异线性变换
- …（其余同型省略）

## nonlinear-system-analysis

未覆盖 294/347；类型分布：KnowledgeStatement×158、Formula×64、DomainConcept×59、SystemModel×13

- （DomainConcept）外部稳定性 — Stability analysis based on input-output behavior, as in frequency-res
- （KnowledgeStatement）相轨迹在某些特定情况下，也可以通过积分法，直接由微分方程获得ẋ（t）和x（t）的解析关系式。 — 相轨迹在某些特定情况下，也可以通过积分法，直接由微分方程获得ẋ(t)和x(t)的解析关系式。
- （SystemModel）ddot{theta} + (g/l) sin theta = T_c/(m l^2); state
- （DomainConcept）稳定焦点 — 当特征根为一对具有负实部的共轭复根时，奇点为稳定焦点。
- （DomainConcept）基于根轨迹的等效增益分析 — A technique to study the stability of systems with memoryless nonlinea
- （Formula）Characteristic Equation for Describing Function An
- （Formula）直流分量公式
- （KnowledgeStatement）相平面法适用于分析常见非线性特性和一阶、二阶线性环节组合而成的非线性系统。 — 相平面法适用于分析常见非线性特性和一阶、二阶线性环节组合而成的非线性系统。
- （KnowledgeStatement）First determine equilibrium values of x_o, u_o suc
- （KnowledgeStatement）非线性特性可视为变增益比例环节 — 非线性特性可视为变增益比例环节
- （Formula）线性二阶系统自由运动解（标准形式）
- （KnowledgeStatement）由初始点出发，按照该点所处等倾线的短直线方向作一条小线段，并与相邻一条等倾线相交；由该交点起，并按该交点所在等倾线的短直线方向作一条小线段，再与其相邻的一条等倾线相交；循此步骤依次进行，就可以获得一条从初始点出发，由各小线段组成的折线，最后对该折线作光滑处理，即得到所求系统的相轨迹。 — 由初始点出发，按照该点所处等倾线的短直线方向作一条小线段，并与相邻一条等倾线相交；由该交点起，并按该交点所在等倾线的短直线方向作一条小线段，
- （Formula）Describing Function for Saturation Nonlinearity
- （DomainConcept）极限环 — Limit Cycle
- （Formula）α与k关系式
- （DomainConcept）迟滞非线性 — Hysteresis Nonlinearity
- （KnowledgeStatement）饱和特性使系统开环增益在饱和区下降 — 饱和特性使系统开环增益在饱和区下降
- （KnowledgeStatement）Procedure for limit cycle analysis and design usin
- …（其余同型省略）

## robustness-sensitivity-analysis

未覆盖 188/209；类型分布：Formula×68、DomainConcept×59、KnowledgeStatement×56、ModelRepresentation×5

- （DomainConcept）测速发电机与无源网络的组合线路 — 用于实现输入信号一阶和二阶导数（即前馈补偿信号）的物理装置，由测速发电机和电阻电容网络组成。
- （DomainConcept）A feedforward control configuration where the refe
- （DomainConcept）灵敏度分析 — The method of evaluating how changes in system parameters affect the s
- （DomainConcept）统一反馈系统 — A feedback system where the feedback element H(s) is equal to 1, simpl
- （DomainConcept）前馈补偿设计方法 — 通过选择前馈补偿器传递函数 Gr(s) 的形式和参数，使复合控制系统等效为更高型别系统或实现误差全补偿的设计方法。
- （DomainConcept）测量组件（传感器）
- （DomainConcept）系统灵敏度 — The ratio of the percentage change in the system transfer function to 
- （DomainConcept）灵敏度函数S（s） — The function S(s) = 1/(1+G_c(s)G(s)) that quantifies the sensitivity o
- （DomainConcept）测量噪声衰减分析 — Method for analyzing the effect of measurement noise on a feedback con
- （DomainConcept）被控对象模型逆 — The technique of determining the inverse of the DC gain of the plant t
- （DomainConcept）稳态全补偿 — 在稳态时使系统输出完全不受扰动影响的前馈补偿方式，物理上更易于实现。
- （DomainConcept）跟踪误差E（s） — The difference between the reference input and the system output in a 
- （DomainConcept）闭环增益
- （DomainConcept）系统传递函数作为参数的分式
- （DomainConcept）反馈控制系统 — A closed-loop system with inputs R(s), T_d(s), N(s) and output Y(s) as
- （DomainConcept）前置滤波器 — 串接在系统输入端的滤波器，用于消除或补偿闭环传递函数中新增零点的不利影响，改善系统动态性能。
- （DomainConcept）复合校正 — 将前馈补偿与反馈控制相结合的控制结构，旨在同时利用反馈的稳定性和前馈的快速补偿能力。
- （DomainConcept）不变性原理 — 复合校正中前馈装置的设计原理，通过选择前馈补偿装置传递函数使扰动或输入对系统输出的影响被完全或部分补偿。
- …（其余同型省略）

## robust-control-analysis-and-design

未覆盖 698/702；类型分布：Formula×311、KnowledgeStatement×236、DomainConcept×101、SystemModel×29、ModelRepresentation×21

- （DomainConcept）〔DomainConcept·无名称占位〕
- （Formula）〔Formula·无名称占位〕
- （SystemModel）〔SystemModel·无名称占位〕
- （KnowledgeStatement）〔KnowledgeStatement·无名称占位〕
- （ModelRepresentation）〔ModelRepresentation·无名称占位〕
- （KnowledgeStatement）属性断言
- （KnowledgeStatement）知识命题
- （KnowledgeStatement）适用性

## optimal-control-foundations-and-linear-quadratic-design

未覆盖 200/200；类型分布：Formula×92、DomainConcept×68、KnowledgeStatement×35、SystemModel×4、ModelRepresentation×1

- （Formula）〔Formula·无名称占位〕
- （DomainConcept）〔DomainConcept·无名称占位〕
- （KnowledgeStatement）〔KnowledgeStatement·无名称占位〕
- （ModelRepresentation）〔ModelRepresentation·无名称占位〕
- （SystemModel）〔SystemModel·无名称占位〕
- （KnowledgeStatement）知识命题

## nonlinear-control-design

未覆盖 104/104；类型分布：Formula×59、KnowledgeStatement×19、SystemModel×14、DomainConcept×12

- （Formula）〔Formula·无名称占位〕
- （SystemModel）〔SystemModel·无名称占位〕
- （KnowledgeStatement）〔KnowledgeStatement·无名称占位〕
- （DomainConcept）〔DomainConcept·无名称占位〕
