# 液舱模态与船体耦合核验

矩形舱第一反对称模态采用公共合同的舱宽b、垂向舱长L、充液深h和液体密度ρ。以下推导中的q为舱壁自由液面高度，原点位于舱底中央，z向上。参考矩形舱机械模型的作用高度见Dodge更新版式(3.12)。[NASA SP-106](https://ntrs.nasa.gov/citations/19670006555)、[Dodge原始专著](https://www2.swri.org/www2/fluid-slosh/dodge-sp-106-update.pdf)

势函数形状与波数为

\[
\Phi=\frac{\dot q}{k}\frac{\cosh(kz)}{\sinh(kh)}\sin(ky),\qquad k=\pi/b.
\]

独立积分得到

\[
m_q=\rho L\int |\nabla(\Phi/\dot q)|^2\,dy\,dz
=\frac{\rho Lb}{2k\tanh(kh)},\quad
c=\rho L\int\partial_y(\Phi/\dot q)\,dy\,dz=\frac{2\rho L}{k^2}.
\]

以船体重心为参考，转动耦合包含横向与垂向速度两项

\[
C_\phi=\rho L\int\left[-(z+h_0-KG)\partial_y(\Phi/\dot q)
+y\partial_z(\Phi/\dot q)\right]dy\,dz
=c\left(KG-h_0-h+\frac{2\tanh(kh/2)}{k}\right).
\]

h₀为固定舱底龙骨高度1.5m。因此完整耦合的等效作用高度为h₀+h−2tanh(kh/2)/k。既有单模态函数中的tanh(kh/2)/k记录壁面压力合力的深度，完整转动耦合还需计入垂向流速和底面效应。

船体系FRD中，纵/横模态的平移耦合列为ce，转动部分为c(r×e)，r取上述等效作用点。模态势能包含船体姿态与自由液面的一致耦合，线性静倾极限对横摇恢复刚度的削减为

\[
\Delta C_{44}=\sum_j\frac{(c_jg)^2}{m_{q,j}\omega_j^2},\qquad
\omega_j^2=gk_j\tanh(k_jh_j).
\]

该第一模态承载完整平面自由液面修正的96/π⁴。基准四舱在当前研究几何下给出约3.06334m的GM修正，纯几何GM=2.5m对应有效值约−0.56334m，参数语义正在等待课程负责人审定。

`verify_sloshing_coupling.py`以80×80点Gauss–Legendre体积分独立核验平移耦合、转动耦合及模态质量，覆盖四个填充率和纵/横两方向。结果保存于`sloshing-coupling-integral-validation.json`。后续双向组装需同时验证总质量、正定性、广义动量、势能和耗散，当前证据范围为模态积分及静稳性分析。

## 广义动力学装配

M₀使用含冻结液货的船体总惯性和外部附加质量，C的每列取一个模态的平移与转动耦合，Mq为模态质量对角阵。以Γ=c/mq、等效质量ms=cΓ和位移ξ=q/Γ构成T级等效质量—弹簧系统，等效点为r(q)=r₀+ξe。空间惯性采用

\[
M(q)=M_0+\sum_jm_{s,j}\left[J(r_j(q))^TJ(r_j(q))-J(r_{0,j})^TJ(r_{0,j})\right],
\quad J(r)=[I,-S(r)].
\]

该差值保留基准总质量与惯量，随模态位移更新质量一阶矩和转动惯量。对应拉格朗日动能为

\[
T=\tfrac12\nu^TM(q)\nu+\nu^TC\dot q+\tfrac12\dot q^TM_q\dot q.
\]

质量账本从总刚体质量/惯量中解析液货和固定部分，并验证固定部分重心及惯量。模态质量采用q坐标的广义质量。体坐标动量中Cq̇的随动项使用完整余伴随算子

\[
\operatorname{ad}^*_{\nu}p=
\begin{bmatrix}\omega\times p_v\\v\times p_v+\omega\times p_\omega\end{bmatrix}.
\]

以d=RᵀeD表示体坐标中的向下方向，单模态附加势能为

\[
V_j=\tfrac12m_j\omega_j^2q_j^2-c_jgq_j e_j^Td.
\]

模态方程和船体方程共享C与该势能。模态激励包含½νᵀ(∂M/∂q)ν，船体保留Ṁν和相应的动量随动项，因此恒定转向中的向心加速度仍能激励液面。先解六维Schur补M(q)−CMq⁻¹Cᵀ，再恢复模态加速度。对原M₀组装时，实际反力还包含−[M(q)−M₀]ν̇，重组后得到相同船体加速度。静态自由液面效应由上述势能自然产生。

Rust实现已接入船体实际RK子阶段和完整状态保存。七项直接回归验证独立体积分系数、原质量矩阵的六维动量闭合、安装点真实转向加速度、全通道功率等于模态耗散、保守RK能量误差小于1e−7、平移动量闭合、船体反作用及恢复后的完整未来一致。小幅域采用T级斜率模长≤0.1、纵/横合成高度≤0.1h，同时核验合成液面触及顶盖，超域结果保留状态与诊断。LNG正式参数包及其实际WASM液舱路径继续等待基准GM审定与后续集成验证。
