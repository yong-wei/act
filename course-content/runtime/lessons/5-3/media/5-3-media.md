# 5-3-intro-video.mp4

- 一张单回路控制图逐步展开为感知、估计、规划、控制与执行链路，突出控制在 MASS 复杂自主系统中的真实位置。

# 5-3-slides.pdf

- 待登记：MASS 的感知、估计、规划与控制协同。

# 5-3-course.mp4

- 待登记：从单回路控制到复杂自主系统链路。

# 5-3-audio.m4a

- 待登记：复杂自主系统中的控制责任边界。

# handout.md

本讲义围绕 MASS 复杂自主系统链路展开，说明感知、估计、规划、控制、执行和监督之间的信息流与责任边界。讲义保留经典单回路控制的稳定、跟踪和抗扰职责，同时强调控制依赖上游状态质量、参考可行性和下游执行约束。通过避碰转向过急示例，讲义训练学生按链路定位偏差来源，而不是把复杂系统问题直接归因于控制器参数。

# 讲义图像证据

- `5-3-sensor-noise-filter-chain.png`：传感器噪声沿闭环链路传播，以及加入滤波后的对比。
- `5-3-sensor-delay-heading-track.png`：传感器测量延迟造成航向滞后和航迹偏移。
- `5-3-planning-path-control-comparison.png`：不同规划航迹对应的航向参考、控制器输出和实际舵角。
- `5-3-actuator-limits-response-track.png`：执行器饱和与速率限制对控制量、响应和航迹的影响。
- `5-3-diagnostic-sequence-infographic.png`：MASS 链路诊断顺序说明图。
- `5-3-autonomous-avoidance-scene.png`：自主避碰中感知、估计、规划与控制的传播场景。
- `5-3-turning-radius-saturation-comparison.png`：不同转弯半径下的舵角指令和实际航迹。
- `5-3-automation-levels-scene.png`：四类 MASS 自动化程度的场景对比。
