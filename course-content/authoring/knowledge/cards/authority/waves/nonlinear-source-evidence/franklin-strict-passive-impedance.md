

<!-- source_pdf_page: 707 -->
the resultant closed-loop system matrix $\mathbf{A}+k \mathbf{B C}$ is stable, then the nonlinear system having a memoryless nonlinear time-varying feedback term $f(t, y)$ in the sector $\left[k_{1}, k_{2}\right]$, shown in Fig. 9.50, is also stable. Unfortunately, this conjecture is not true as counterexamples exist. ${ }^{7}$ However, a variation of Aizermann's conjecture is true and is known as the circle criterion.

Rather than giving a rigorous proof of the criterion, we describe a heuristic argument that gives insight into the problem and motivates the proof. An electric circuit with a linear impedance, $Z(j \omega)=R(\omega)+j X(\omega)$, is described by Ohm's law as $V=I Z(s)$. We assume that $Z$ is composed of real components, which means that the real part $R$ is even and the imaginary part $X$ is odd; that is $R(-\omega)=R(\omega)$ and $X(-\omega)=-X(\omega)$. If $R(\omega)>\delta>0$ for all $\omega$, the impedance is called strictly passive. It will dissipate energy. The instantaneous power into the circuit is $p=v(t) i(t)$, and the total energy absorbed by the circuit is $e=\int_{0}^{\infty} v(t) i(t) d t$. Referring to the figure, Ohm's law is equivalent to the plant equation $Y=U G(s)$ with $Y$ as voltage, $U$ as current, and $G(s)=R+j X$ as the impedance. Applying the expression for energy to the plant equation and using the theorem by Parseval ${ }^{8}$ to convert this to the frequency domain yields

$$
\begin{align*}
\int_{0}^{\infty} y(t) u(t) d t & =\frac{1}{2 \pi} \int_{-\infty}^{\infty} U(j \omega) Y(-j \omega) d \omega  \tag{9.94}\\
& =\frac{1}{2 \pi} \int_{-\infty}^{\infty} U(j \omega) U(-j \omega) G(-j \omega) d \omega  \tag{9.95}\\
& =\frac{1}{2 \pi} \int_{-\infty}^{\infty}|U(j \omega)|^{2}(R-j X) d \omega  \tag{9.96}\\
& =\frac{1}{2 \pi} \int_{-\infty}^{\infty}|U(j \omega)|^{2} R(\omega) d \omega \tag{9.97}
\end{align*}
$$

