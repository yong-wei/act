---
node_id: ctkg_v3e-object-27eb45a250307fcc571ac92c
authority_entity_id: "ctkg:v3e-object-27eb45a250307fcc571ac92c"
name: "采样率"
name_en: "Sample Rate"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4a9790f7808f39a6155a121466306aae3f06c156e50a946479fec57de271a6d2.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4a9790f7808f39a6155a121466306aae3f06c156e50a946479fec57de271a6d2.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-01a/previous/ctkg_v3e-object-27eb45a250307fcc571ac92c.md"
asset_refs: []
---

## 首页
# 采样率 | Sample Rate

一句话定义：均匀采样的采样率是每单位时间取得样值的次数，等于采样周期的倒数。

- $f_s=1/T_s$，通常以Hz或每秒样本数表示。
- 采样角频率为 $\omega_s=2\pi f_s$。
- 采样率不等于幅度分辨率，也不等于闭环带宽。

---
## 详情
### 完整解释

固定周期 $T_s$ 的采样时刻为 $t_k=kT_s$，每秒样本数为 $f_s$。连续角频率 $\omega$ 对应离散角频率 $\Omega=\omega T_s$，后者单位可写为弧度每样本。要避免混淆，计算中应明确普通频率Hz、连续角频率rad/s和离散角频率rad/sample。

同一个离散频率序列在不同采样率下可能对应不同物理频率。离散频率以 $2\pi$ 为周期等价，因此解释样值中的频率还需要采样时序和频谱先验，不能仅凭一个无单位数字判断连续振动速度。

### 教学计算/推理例

若 $T_s=0.1$ s，则 $f_s=10$ Hz，$\omega_s=20\pi$ rad/s。2 Hz信号的连续角频率为 $4\pi$ rad/s，离散角频率为 $0.4\pi$ rad/sample；相应每个周期有5个采样间隔。

若保持同一2 Hz物理信号，把采样率增加到20 Hz，周期变为0.05 s，离散角频率变为 $0.2\pi$，每周期采样间隔变为10。信号本身没有变慢，改变的是时间刻度上的离散表示。

控制计算中“一拍延迟”的实际时间等于一个采样周期。在目标角频率5 rad/s处，周期0.02 s对应延迟相位 $-0.1$ rad，约负5.73度；周期0.2 s对应 $-1$ rad，约负57.30度。相同一拍数量在不同采样率下产生不同物理相位影响，不能只数拍数而不看秒数。

### 适用条件与边界

这些公式针对均匀周期采样。若时刻不规则或存在显著抖动，应记录实际采样时间，平均采样率不足以表达全部时序。实际控制总延迟还可能包含转换、计算、通信和执行器更新，不一定恰为一拍。

提高采样率可以提供更密的时间信息，但不会自动减小固定量化器步长，也不保证控制器算力和通信满足时限。抗混叠滤波、传感器带宽、闭环动态和噪声会共同影响合理取值，不能仅凭采样率越高越好作判断。

采样器奈奎斯特频率为 $f_s/2$，这不是闭环带宽的定义。闭环带宽来自参考到输出通道的频率响应，且可能受控制器、保持器、延迟和对象共同影响。两个指标应分别计算。

### 常见误区

1. 把 $1/T_s$ 写成rad/s而遗漏 $2\pi$。
2. 将每拍延迟视为与采样周期无关的固定时间。
3. 提高采样率后就宣称幅度量化误差也同比降低。

### 自检

1. 周期0.05 s对应的采样率与采样角频率分别是多少？
2. 目标频率固定时，一拍实际延迟加倍，相位滞后如何变化？

**核对要点**：20 Hz与 $40\pi$ rad/s；纯延迟相位为 $-\omega T_s$，该频点滞后角加倍。

### 关联节点

- **采样周期**（出边，关系：推导自）
- **离散信号**（无向，关系：相关）
- **差分方程**（无向，关系：相关）
