---
node_id: ctkg_v3e-object-be9c82d423b46b7fc6937236
authority_entity_id: "ctkg:v3e-object-be9c82d423b46b7fc6937236"
name: "对数频率特性曲线"
name_en: "Logarithmic Frequency-Response Curves"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-7261d629fb2d59220fea9a6113222c048db86d43fc45a35a933e23839f6d73e4.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-7261d629fb2d59220fea9a6113222c048db86d43fc45a35a933e23839f6d73e4.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-24a/previous/ctkg_v3e-object-be9c82d423b46b7fc6937236.md"
asset_refs: []
---

## 首页
# 对数频率特性曲线 | Logarithmic Frequency-Response Curves

一句话定义：对数频率特性曲线由对数幅频曲线与对数相频曲线组成，以对数分度的正频率为共同横轴。

- 幅频曲线的纵坐标为分贝幅值，相频曲线为相位角。
- “对数相频”并不表示对相位数值取对数。
- 读图应注明频率单位、精确曲线与渐近线的区别。

---
## 详情
### 完整解释

对于 $G(j\omega)$，定义 $L(\omega)=20\log_{10}|G(j\omega)|$ 和 $\varphi(\omega)=\arg G(j\omega)$，分别随正频率作图。这组曲线即伯德表示。横轴采用对数分度，使跨越多个数量级的频率能在一张图中清晰排列；相位纵轴仍按角度线性分度，负相位也不需要任何对数运算。

若频率用角频率表示，单位为rad/s；若用普通频率，单位为Hz，二者满足 $\omega=2\pi f$。使用同一系统数据时，换频率单位会改变横轴数值标注，但不会改变该实际振动对应的幅值与相位。把1 Hz误当成1 rad/s会取到不同的频率响应点。

### 教学计算/推理例

取 $G=2/(s+1)$，在0.1、1、10 rad/s三个等对数间隔频点，分贝幅值依次约为5.9774、3.0103、$-14.0226$ dB，相位依次约为 $-5.7106^\circ$、$-45^\circ$、$-84.2894^\circ$。同一张横轴上的等距离跨越十倍频率，但相位变化量并不相同。

幅值的高频渐近线为

$$
L_a(\omega)=20\log_{10}2-20\log_{10}\omega.
$$

从10到100 rad/s，该渐近线下降20 dB。精确曲线在这两个频率约为 $-14.0226$ 与 $-33.9798$ dB，下降约19.9572 dB；有限频率下二者非常接近但不完全相同。精确相位继续趋向 $-90^\circ$，不会在转折频率1处瞬间跳到该极限。

若输入为单位幅值的 $\sin t$，频率1处的3.0103 dB对应幅值比 $10^{3.0103/20}\approx\sqrt2$，结合 $-45^\circ$ 相位得到稳态输出 $\sqrt2\sin(t-\pi/4)$。必须同时读取幅频与相频信息，单看分贝值不能恢复输出波形相对于输入的位置。

### 适用条件与边界

在本例中直流增益为2，可由低频极限得到；但对数横轴不能包含 $\omega=0$。积分环节等模型的低频幅值可能发散，不能一律套用水平低频段。绘制相位时应注明采用连续展开还是主值分支；否则跨越整周的显示跳变可能被误判为真实突变。频率响应的稳态解释还依赖暂态衰减，复数代入本身不能证明系统稳定。

### 常见误区

1. 对负相位尝试取对数，误解“对数相频”名称。
2. 将角频率与Hz直接使用同一数值，不做 $2\pi$ 换算。
3. 将渐近斜率当成任意有限频率区间精确的变化量。

### 自检

1. 本例转折频率1 rad/s换成Hz约为多少？
2. 幅值曲线为0 dB时，幅值比是0还是1？

**核对要点**：约为 $1/(2\pi)=0.1592$ Hz；0 dB对应幅值比1，相位仍须从另一幅曲线读取。

### 关联节点

- **期望的开环频率特性形状**（无向，关系：相关）
- **对数频率特性曲线绘制方法**（无向，关系：相关）
