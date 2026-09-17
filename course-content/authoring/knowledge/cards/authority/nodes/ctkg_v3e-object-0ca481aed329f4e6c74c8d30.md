---
node_id: ctkg_v3e-object-0ca481aed329f4e6c74c8d30
authority_entity_id: "ctkg:v3e-object-0ca481aed329f4e6c74c8d30"
name: "实验频率响应测定"
name_en: "Experimental Frequency-Response Measurement"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-30f0a556a0058d1211bff4470a3c2b05896f06332ae053524bec5f086348b9e6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-30f0a556a0058d1211bff4470a3c2b05896f06332ae053524bec5f086348b9e6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01e/previous/ctkg_v3e-object-0ca481aed329f4e6c74c8d30.md"
asset_refs: []
---

## 首页

# 实验频率响应测定 | Experimental Frequency-Response Measurement

**一句话定义**：用一组不同频率的正弦激励，测量每个频率点的稳态输出与输入幅值比、相位差。

**核心直觉**：每个点都要“等稳态、配对输入输出、记录相位”，多个点按频率排列后才构成曲线。

**关键公式**：
$$
M(\omega_i)=\frac{A_y(\omega_i)}{A_u(\omega_i)},\qquad \varphi(\omega_i)=\varphi_y(\omega_i)-\varphi_u(\omega_i)
$$

**学习目标**：从一组原始正弦读数提取可靠的幅值和相位，并识别采样边界。

## 详情

### 完整解释

实验频率响应测定把理论复数比值变成观测量。在第 $i$ 个频率点施加 $u(t)=A_u\sin(\omega_i t+\varphi_u)$，等待暂态衰减后，用同一时钟记录输出同频幅值 $A_y$ 和相位 $\varphi_y$，再计算 $M(\omega_i)$ 与 $\varphi(\omega_i)$。输入和输出必须成对保存。

测试可按对数网格扫频；每点覆盖若干周期，待幅值、均值和相位相邻周期稳定后取平均。采样率须满足 Nyquist 条件，最高测试频率应低于 $f_s/2$，否则混叠会造成虚假峰和相位。传感器与采集链路的固定延迟也要校准或记录。

固定输入、零初态的教学例取稳定对象 $\dot y+y=u$，施加 $u(t)=\sin(2t)$。由 $G(j2)=1/(1+2j)$ 得幅值比 $1/\sqrt5\approx0.4472$、相位 $-\arctan2\approx-1.1071\ \mathrm{rad}$（约 $-63.435^\circ$）。因此稳态输出为 $y_{\mathrm{ss}}(t)=\sin(2t-\arctan2)/\sqrt5$，幅值比的分贝值为 $-6.9897\ \mathrm{dB}$。若实测为0.8和负30度，就与该模型不一致，需检查模型、工作点或测量链路，不能将其当作模型的预测值。零初态固定启动条件，但仍须等待自然响应衰减。

测量质量还受噪声、工作点和激励幅值影响：太小会被噪声淹没，太大可能饱和或改变工作点。结果是一组带条件的频率点，只有把稳定、同步、线性范围和采样边界记清，才适合与理论比较。

### 教学计算/推理例

对同一对象固定 $f_s=100\ \mathrm{Hz}$、$\omega=2\ \mathrm{rad/s}$，即 $f=1/\pi\approx0.3183\ \mathrm{Hz}$。零初态仿真后舍弃前20秒暂态，在后10个完整周期拟合正弦与余弦分量，应得到输入峰值1、输出峰值约0.4472、相位约负1.1071弧度。测试频率远低于50 Hz的奈奎斯特频率；这只是基本采样条件，仍须控制噪声及抗混叠。单点测量不能判断其他频率是否有共振。

### 适用条件与边界

须确认对象在测试窗口稳定，暂态已衰减，输入输出同步且未饱和。采样率、抗混叠滤波、噪声水平、工作点、激励幅值和传感器延迟都应随数据保存。

### 常见误区

1. 还没等待暂态就把首个周期的峰值当成稳态幅值。应比较连续周期并检查幅值和相位是否稳定。
2. 只扫一个频率点就宣称得到完整传递函数，或忽略 Nyquist/混叠边界。单点只支持局部结论。

### 自检

1. 输入峰值为 $1$、输出峰值约为 $0.4472$ 时幅值比是多少？
2. 测得相位差 $-63.435^\circ$ 是否表示输出频率变成了另一频率？

**核对要点**：幅值比约为 $0.4472$；不是，稳定 LTI 的稳态输出仍与输入同频，只是相位滞后。

### 关联节点

- **频率响应**（出边，关系：用于分析）
- **通过改变频率的正弦信号激励系统以实验测定频率响应幅值和相位的步骤。**（入边，关系：适用于）
