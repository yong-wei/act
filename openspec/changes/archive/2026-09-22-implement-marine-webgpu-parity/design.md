# 完整实现WebGPU FFT与Gerstner控制组及等价场景

基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。本轮为设计，性能/误差门限均待实际执行验证。[共同依据](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。

## 前提
`complete-marine-shared-water-optics`、`complete-marine-scene-response-quality`
设计先决条件须登记为GitHub原生关系才参与调度，不以本文维护状态镜像。

## 实现范围
先匹配仓库lockfile的Three/R3F能力；必要升级只限有依据的兼容集合。WebGLRenderer ShaderMaterial不直接兼容WebGPURenderer，必须真正实现TSL/node材质和对应后处理。复用共同参数/数学定义，按后端拥有GPU资源，避免两份Three类混用、GL纹理冒充WebGPU纹理或隐藏CPU/GPU整图拷贝桥。
WebGPU FFT使用实际compute shader执行谱演化、2D IFFT、位移/斜率/压缩；与WebGL的种子、频谱、归一化、级联频带相同。GPU和CPU独立参考验证后接入实际高精船模与低延迟查询。只返回API存在/字符串标签、或WebGPU初始化失败后悄悄跑WebGL，均不得算完成。
实现WebGPU Gerstner，直接使用同一解析波组和等价材质；它是控制组，不另造第五种海面算法。四组合为 GL-Gerstner、GL-FFT、GPU-Gerstner、GPU-FFT。对同算法跨后端验证高度/法线和照明等价，比较时先排除着色语言/后处理变化。
## 完整功能
两条WebGPU组合都消费与WebGL同一份预声明功能矩阵：高精船模/LOD/动画、海况与接触、天空/云IBL/太阳阴影/雾、GGX与微法线、历史泡沫/推进器、低分辨率平面反射、浅水深度折射、抗锯齿/输出。算法不同允许表现差异，缺功能不能记为算法优势；高档完整，中低档采用相同降级政策。
实现可复用的声明式场景与窄后端装配，不在七船型复制私有材质栈。采用compute泡沫等独有优化只能在best-under-budget模式单独报告，先完成共同语义。生产默认与课程入口不自动切换；实验/QA可选真实后端。
## 能力与失败
M5上先实际requestAdapter/requestDevice并编译最小shader，检查声明features/limits。支持WebGPU的本机浏览器必须跑通两组合；代码未实现、编译失败不是“不支持”。缺timestamp-query仅改变计时方式，不影响WebGPU实现通过。强制能力缺失用应用边界注入测试，不篡改浏览器原型来伪造另一GPU。
## 验收
在本机实际WebGPU设备运行四组合对照。提交实际GPU小网格数值、完整效果开关、query延迟/误差、设备丢失/资源释放证据。缺少低性能设备不阻断；缺少WebGPU实现/实际可运行证据仍阻断此change。
