---
node_id: ctkg_v3e-object-ee4c217b305b05786c0b89a9
authority_entity_id: "ctkg:v3e-object-ee4c217b305b05786c0b89a9"
name: "正弦稳态响应"
name_en: "Sinusoidal Steady-State Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-2becb76f6fe7e1a1ee39ae94a473272c4a06b5ddeb71ac58e4b855e6cad615a2.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-2becb76f6fe7e1a1ee39ae94a473272c4a06b5ddeb71ac58e4b855e6cad615a2.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01e/previous/ctkg_v3e-object-ee4c217b305b05786c0b89a9.md"
asset_refs: []
---

## 首页

# 正弦稳态响应 | Sinusoidal Steady-State Response

**一句话定义**：稳定线性系统在正弦激励下，暂态衰减后保留输入角频率的稳态输出。

**核心直觉**：系统可以改变幅值和相位，却不会在稳定 LTI 的正弦稳态中把频率变成另一个频率。

**关键公式**：
$$
u(t)=A\sin(\omega t)\Rightarrow y_{\mathrm{ss}}(t)=A|G(j\omega)|\sin(\omega t+\varphi(\omega))
$$

**学习目标**：由 $G(j\omega)$ 写出稳态输出，并判断“稳态”是否已经成立。

## 详情

### 完整解释

正弦稳态响应是输入持续足够久、自然响应消失后留下的同频正弦。稳定 LTI 对 $u(t)=A\sin(\omega t)$ 的稳态输出幅值为 $A|G(j\omega)|$，相位加上 $\varphi(\omega)=\arg G(j\omega)$；“稳态”强调时间窗口，“频率响应”强调幅相比值。

零初态是传递函数定义的起点，不是说输出从第一时刻就是稳态。初态激发的自然响应只有在对象稳定时才会衰减；右半平面或虚轴极点、饱和和死区会破坏简单的线性稳态结论。

固定输入、零初态算例取 $\dot y+y=u$、$y(0)=0$、$u(t)=2\sin t$。由 $G(s)=1/(s+1)$ 得 $|G(j)|=1/\sqrt2$、$\varphi=-\pi/4=-45^\circ$。原方程的完整解是 $y(t)=\sin t-\cos t+e^{-t}$，所以进入稳态后 $y_{\mathrm{ss}}(t)=\sqrt2\sin(t-\pi/4)$。输出仍以 $1\ \mathrm{rad/s}$ 振荡，幅值从 $2$ 变成 $1.4142$，相位滞后 $45^\circ$；$e^{-t}$ 不能在尚未衰减时被当成噪声删除。

判断是否稳态，不能只看波形“像正弦”，还要比较连续周期的幅值、相位和均值，并确认激励未改变工作点。自然无激励响应解释暂态来源，幅频和相频特性记录最终正弦。

### 教学计算/推理例

固定 $\omega=1\ \mathrm{rad/s}$、输入幅值 $2$、零初态。稳态输出峰值为 $2/\sqrt2=1.4142$，不是 $0.7071$；后者是幅值比。相位 $-45^\circ$ 写成弧度是 $-\pi/4$，故可写成 $\sqrt2\sin(t-\pi/4)$。

### 适用条件与边界

要求稳定 LTI、输入持续时间足够、输出未饱和并使用同一时间基准。短记录、强噪声、不稳定极点、持续初态或非线性谐波会破坏简单的稳态正弦表达。

### 常见误区

1. 把从 $t=0$ 开始的完整响应直接当成稳态响应，忽略自然响应。应先等待暂态衰减，再测幅值和相位。
2. 把相位滞后写成正号，或把输出幅值误写成幅值比。先写 $y_{\mathrm{ss}}=A|G|\sin(\omega t+\varphi)$ 再代入符号。

### 自检

1. 上例输出的角频率是 $1$ 还是 $1/\sqrt2\ \mathrm{rad/s}$？
2. 为什么 $G(j)$ 的模是 $0.7071$，输出峰值却是 $1.4142$？

**核对要点**：输出角频率仍是 $1\ \mathrm{rad/s}$；输出峰值还要乘输入峰值 $2$，所以为 $2\times0.7071$。

### 关联节点

- **稳态响应**（无向，关系：相关）
- **自然无激励响应**（无向，关系：相关）
- **在jω轴上计算G(s)有助于判定闭环稳定性，因为jω轴是稳定与不稳定的分界线。**（入边，关系：用于分析）
