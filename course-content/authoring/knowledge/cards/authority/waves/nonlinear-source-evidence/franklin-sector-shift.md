\begin{align*}
\delta\|u\|^{2}+\frac{\|u(t)\|^{2}}{K} & >0,  \tag{9.104}\\
{\left[\operatorname{Re}\{G(j \omega)\}+\frac{1}{K}\right]\|u(t)\|^{2} } & >0,  \tag{9.105}\\
\operatorname{Re}\{K G(j \omega)+1\} & >0 . \tag{9.106}
\end{align*}
$$

In deriving Eq. (9.106), the assumption was made that the nonlinearity was in a zero sector, $[0, K]$. If the function is actually in the sector $\left[k_{1}, k_{2}\right]$, it can be reduced to a zero sector by adding and subtracting $k_{1}$ in the block diagram as shown in Fig. 9.53. With this change, the dynamic system is replaced by $H=\frac{G}{1+k_{1} G}$ and the function by $f^{\prime}=f-k_{1}$, which is in the sector $\left[k_{2}-k_{1}, 0\right]$. With these changes, the stability criterion is transformed to

$$
\begin{equation*}
\operatorname{Re}\left\{1+\left(k_{2}-k_{1}\right) \frac{G}{1+k_{1} G}\right\}>0, \tag{9.107}
\end{equation*}
$$

Figure 9.53
Block diagram manipulation for sector
![](assets/fig-09-53.png)
