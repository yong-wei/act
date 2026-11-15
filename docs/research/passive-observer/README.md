# 被动观测器与常驻物理会话

`passive_observer.rs`独立实现波频六状态、低频位置/航向、世界坐标慢变偏置和船体速度估计。创新量为量测减去低频与波频估计之和，缺失轴继续预测。位置的N/E分量分别采样，航向创新按最短圆周角计算。公式依据Torsetnes、Jouffroy和Fossen的式29至34、51至53。[原始论文](https://fossen.biz/publications/2004%20Torsetnes%20et%20al%20CDC.pdf)

当前T级配置采用波频2π/8rad/s、波频模型阻尼比0.1、期望阻尼比1、截止频率比1.1、K4归一化增益0.04、K3归一化增益0.002和偏置衰减时间1000s。水平两轴的世界坐标增益相等，K3/K4=0.05rad/s。观测器质量使用物理模型的实际质量矩阵，线性阻尼采用60s时间尺度的T级先验。

`generate_reference.py`以SciPy连续矩阵指数独立生成固定航向的五状态阶跃响应。闭环误差矩阵最大实部约−0.05404，Rust在0.5、1、5、20、60s的逐状态误差小于1e−9。其余直接回归核验双轴分离、缺测预测、波频抑制、圆周角与失败恢复。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/passive-observer/generate_reference.py
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_passive_observer --test sixdof_sensor_chain --test sixdof_session
```

`FleetSimulation`常驻保存物理对象、全部传感器队列、随机状态、观测器、控制积分和保持命令。物理时钟120Hz，控制时钟20Hz。控制器可选合法原始航向量测或低频估计。观测器的已知控制载荷由测得的轴速/编码器、估计速度和同一执行器模型计算。当前载荷估计采用平衡浸没与水平运动的T级假设。

GNSS、计程仪、IMU及风传感器均使用实际安装点运动学。IMU比力包含转动坐标、切向、向心加速度并扣除重力。N0保留采样率并关闭噪声、偏置、时延和量化，N2将N1噪声、偏置、时延翻倍。风速与方向分开建模，低速时方向质量单独标记。缺测通过quality与空值传输。

WASM通过独立的`VesselSimulationSession`对象持有会话，浏览器从`createVesselSimulationSessionBrowser`进入。快照以原始字符串保存，包含64位随机状态和全部队列，恢复时核验模型、布局与时钟。浮点解析启用精确往返。暂停保持物理与随机时钟，重置重建原种子和初值。各对象独立持有内存。

当前常驻入口已接入055 v3的P0、W1、W2、C1、C2。入射波浪数据、其他六船、DP10Hz分配及七船正常页面由OpenSpec后续任务继续跟踪。旧运行请求沿既有入口处理。
