---
node_id: ctkg_v3e-canonical-7e46e083227dc119d597d82b
authority_entity_id: "ctkg:v3e-canonical-7e46e083227dc119d597d82b"
name: "频率响应"
name_en: "Frequency Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-af679057b50299f79747230130880d6471b5f4788916ba07302f8d5fec511fdc.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-af679057b50299f79747230130880d6471b5f4788916ba07302f8d5fec511fdc.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01e/previous/ctkg_v3e-canonical-7e46e083227dc119d597d82b.md"
asset_refs: []
---

## 首页

# 频率响应 | Frequency Response

**一句话定义**：稳定线性定常系统受正弦输入后，暂态衰减并进入稳态时，输出与输入在同一角频率上的复数幅相比。

**核心直觉**：把传递函数形式上取 $s=j\omega$，可得到该频率的复数增益；但算出复数不等于实验中必有稳态比值。

**关键公式**：
$$
G(j\omega)=\frac{Y_{\mathrm{ss}}(j\omega)}{U(j\omega)}=|G(j\omega)|e^{j\varphi(\omega)}
$$

**学习目标**：由模型计算指定频率的幅值和相位，并说明零初态、稳定与线性条件。

## 详情

### 完整解释

频率响应回答：输入角频率为 $\omega$ 的正弦在暂态消失后被放大多少、领先或滞后多少。对零初态传递函数 $G(s)=Y(s)/U(s)$，稳定 LTI 的输入 $u(t)=A\sin(\omega t)$ 产生 $y_{\mathrm{ss}}(t)=A|G(j\omega)|\sin(\omega t+\varphi(\omega))$。

把 $s$ 取为 $j\omega$ 是因为 $e^{st}$ 此时变成复正弦，系统作用表现为乘以复数。稳定性使暂态衰减，线性定常性使频率不改变且比例不随输入幅值改变；右半平面或虚轴极点、饱和会带来发散、持久振荡或谐波，不能因代入有结果就跳过稳态检查。

固定输入、零初态的算例取 $\dot y+y=u$、$y(0)=0$、$u(t)=2\sin t$。模型的传递函数为 $G(s)=1/(s+1)$，在 $\omega=1\ \mathrm{rad/s}$ 处 $G(j)=1/(1+j)=(1-j)/2$，所以幅值为 $1/\sqrt2$、相位为 $-\pi/4=-45^\circ$。由微分方程得 $y(t)=\sin t-\cos t+e^{-t}$；$e^{-t}$ 是暂态，衰减后留下 $y_{\mathrm{ss}}(t)=\sqrt2\sin(t-\pi/4)$。

从图谱关系看，频率响应连接正弦稳态响应、幅相频率特性、伯德图技术和实验频率响应测定。单个频率点只能支持局部判断。

### 教学计算/推理例

固定 $G(s)=1/(s+1)$、输入幅值 $2$、$\omega=1\ \mathrm{rad/s}$、零初态。由 $|G(j)|=0.7071$ 得输出幅值 $1.4142$、相位 $-45^\circ$；原方程的 $e^{-t}$ 只能在暂态足够小后舍去。

### 适用条件与边界

对象须近似稳定、线性、定常，输入输出通道和角频率单位须明确。对不稳定对象、持续外扰、强非线性或尚未衰减的暂态，$G(j\omega)$ 的形式代入不能单独证明存在可测稳态响应。

### 常见误区

1. 把 $G(j\omega)$ 的形式代入当成无条件结论，忘记稳定性决定暂态能否消失。应先检查极点和测试窗口。
2. 把相位的负号当成幅值为负，或把弧度数直接当作角度数。相位应标明单位，$-\pi/4$ 与 $-45^\circ$ 是同一滞后。

### 自检

1. 对 $G(s)=1/(s+1)$，$\omega=1$ 时输出是领先还是滞后？
2. 若输入幅值从 $2$ 改为 $4$，在线性稳态条件下幅值比会不会改变？

**核对要点**：相位为 $-45^\circ$，输出滞后；幅值比仍为 $1/\sqrt2$，只是在相同系统条件下输出幅值也加倍。

### 关联节点

- **实验频率响应测定**（入边，关系：用于分析）
- **幅相频率特性**（无向，关系：相关）
- **伯德图技术**（入边，关系：用于分析）
- **极坐标图**（出边，关系：有表示）
