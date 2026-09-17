---
node_id: ctkg_domainconcept_cb7da716d9229f0af132e0c1
authority_entity_id: "ctkg:domainconcept:cb7da716d9229f0af132e0c1"
name: "开环系统"
name_en: "Open-Loop System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-91e0cc90a0118a711d0d04bc72c80bbeb97580cc189009aa31682c963d93bf0a.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-91e0cc90a0118a711d0d04bc72c80bbeb97580cc189009aa31682c963d93bf0a.json"
asset_refs: []
---

## 首页

# 开环系统 | Open-Loop System

**一句话定义**：开环系统的控制命令不利用被控输出反馈来修正当前控制作用。

**核心直觉**：预先给定命令可以驱动对象，但对象偏离预期后，开环命令不会因该输出偏差自动调整。

**关键公式**：本例 $u=r$，$\dot y=-y+2(u+d)$。

**学习目标**：识别控制命令是否依赖输出，并在同一扰动端口下比较开环与反馈响应。

---

## 详情

### 完整解释

开环描述控制结构，而不是对象内部完全没有任何相互作用。一个复杂物理对象可以有内部动态耦合，但如果控制命令没有使用被控输出进行修正，仍可按所选控制边界称为开环控制。反过来，界面上能够显示传感器读数，也不等于该读数已经进入控制律。

开环系统可以按照已知模型和参考命令完成任务，但模型偏差或扰动改变对象响应时，命令通常不会自动补偿。这并不意味着开环在所有场景都不可用；是否需要反馈，应结合任务、可预测性、测量条件和允许误差判断。比较不同结构时，应明确参考标定和扰动位置，避免只看两条不在同一条件下的曲线。

### 教学计算/推理例

取无量纲对象 $P=2/(s+1)$，控制命令为 $u=r$，无扰动、零初态时单位参考阶跃产生
$$
y(t)=2(1-e^{-t}).
$$
输出不进入命令方程，因此输出变化本身不会让 $u$ 改变。

为了单独考察抗扰，令参考为零，在对象输入处加入 $d=0.5$ 阶跃。开环原方程为 $\dot y=-y+2d$，所以
$$
y_{\mathrm{open}}(t)=1-e^{-t}.
$$
若同一对象改为单位负反馈 $u=r-y$，仍取 $r=0$、同样的输入扰动，则 $\dot y=-y+2(-y+d)$，得到
$$
y_{\mathrm{feedback}}(t)=\frac13(1-e^{-3t}).
$$
该扰动造成的最终输出偏移从 1 降到 $1/3$。这项结论只针对指定对象、指定扰动位置和控制律，不等于所有性能都同时改善，也不能拿参考增益不同的两系统直接宣称跟踪公平比较已经完成。

### 适用条件与边界

本例没有执行器限制、测量噪声或延迟，输入与时间均已归一化。真实开环系统可能另有前馈补偿，但前馈利用的是已知参考或可测扰动，不等于用输出误差反馈。若引入其他测量信号，需要依据它实际进入控制律的方式判断结构，而不是仅根据是否安装传感器命名。

### 常见误区

1. **误区**：装有传感器就一定是闭环控制。**纠正**：要看测量是否用于修正控制作用。
2. **误区**：开环对象内部不能有任何动态回路。**纠正**：控制边界与物理内部耦合不是同一个分类问题。

### 自检

1. 哪个方程最直接表明本例采用开环命令？
2. 抗扰比较为什么把参考设为零？

**核对要点**：$u=r$ 不含输出；令参考为零可隔离同一扰动通道的作用，避免参考响应混入比较。

### 关联节点

- **闭环系统**（无向，关系：相关）
- **开环系统极点**（无向，关系：相关）
