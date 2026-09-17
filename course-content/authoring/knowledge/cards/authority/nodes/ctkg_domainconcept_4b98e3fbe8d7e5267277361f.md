---
node_id: ctkg_domainconcept_4b98e3fbe8d7e5267277361f
authority_entity_id: "ctkg:domainconcept:4b98e3fbe8d7e5267277361f"
name: "李雅普诺夫第一法（间接法）"
name_en: "Lyapunov Indirect Method"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
confifteent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-bd24d94d03356ef224e96dcf1b3a8e0263533150184ca5af865756be4eccac1d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-bd24d94d03356ef224e96dcf1b3a8e0263533150184ca5af865756be4eccac1d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_4b98e3fbe8d7e5267277361f.md"
asset_refs: []
---

## 首页
# 李雅普诺夫第一法（间接法） | Lyapunov Indirect Method

一句话定义：间接法通过平衡点处线性化矩阵的特征值判断非线性系统的局部稳定性，边界特征值情形通常需要进一步分析。

- 全部特征值严格位于左半平面，可证明局部渐近稳定。
- 存在正实部特征值，可证明不稳定。
- 其余特征值不在右半平面但有零实部时，线性化通常不能定论。

---
## 详情
### 完整解释

对自治系统 $\dot x=f(x)$，设原点为平衡点，且f在原点附近连续可微。记雅可比矩阵 $A=\partial f/\partial x|_0$，可写成 $\dot x=Ax+g(x)$，其中余项相对于状态范数是高阶小量。间接法研究线性部分的稳定特征能否在小邻域中抵抗高阶项的影响。

当A严格稳定时，原点局部渐近稳定，在这些光滑条件下还能得到局部指数稳定。若A存在正实部特征值，原点不稳定。若没有正实部却存在零实部特征值，单凭上述基本间接法不能确定非线性系统结论；不能把线性系统本身的边界分类不加检验地直接套到非线性对象。

### 教学计算/推理例

考虑 $\dot x=-x+x^3$。原点处导数为-1，因此线性化为 $\dot x=-x$，间接法给出原点局部渐近稳定。实际向量场在 $0<x<1$ 时为负，在 $-1<x<0$ 时为正，与局部回归趋势一致。

但是系统还有平衡点±1。若x大于1，则导数为正，状态远离原点；若x小于-1，则导数为负，状态向负方向远离。原点的吸引域是(-1,1)，所以线性化正确地给出了局部结论，却没有给出全局结论。

再比较 $\dot x=-x^3$ 与 $\dot x=x^3$，两者在原点的雅可比都为0，线性化都是 $\dot x=0$。第一种系统任意初值均向原点收敛；第二种系统对正初值满足 $x(t)=x_0/\sqrt{1-2x_0^2(t-t_0)}$，在解存在期间不断远离，并会有限时间发散。相同零线性化产生相反的稳定结论，证明高阶项在边界情形中不可忽略。

### 如何使用结论

先确定真正的平衡点，再对平移后的误差坐标求雅可比。随后检查全部特征值，而不是只看矩阵对角元素或某一个模态。严格左半平面结论只适用于足够小的状态偏差；如果需要吸引域，应进一步构造李雅普诺夫函数或做其他区域分析。

遇到零实部模态时，应明确记录间接法在此无法判定，再选择直接法、中心流形或其他适当分析。不能将“此方法没有结论”写成“系统一定不稳定”，也不能因为线性化轨迹不增长就承诺非线性系统稳定。

### 适用条件与边界

上述表述针对连续时间、自治、局部光滑系统。离散时间需要改用特征值是否在单位圆内的条件；不光滑、时变系统或含约束切换系统需核对相应理论，不能机械沿用连续自治定理。

雅可比依赖工作点。同一个非线性系统在不同平衡点的线性化不同，稳定性也可能不同。数值计算特征值接近虚轴时，应区分真正的数学边界与舍入误差，不用显示的小数正负替代可靠判断。

### 常见误区

1. 用局部线性化稳定声称全局稳定。
2. 线性化出现零特征值就直接判定非线性系统不稳定。
3. 没有验证平衡点就在线性化矩阵上讨论平衡稳定性。

### 自检

1. $\dot x=-x+x^3$ 的局部结论为何不能扩展到整个实数域？
2. $\dot x=\pm x^3$ 说明了什么限制？

**核对要点**：存在其他平衡点，且外侧轨迹远离原点；零特征值的线性化无法区分高阶项造成的稳定与不稳定。

### 关联节点

- **李雅普诺夫间接法**（无向，关系：相关）
- **李雅普诺夫直接法**（无向，关系：相关）
- **李雅普诺夫第一方法**（无向，关系：相关）
