# 交付M5单机一键验证、压力扫描与同质量成本选型

基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。本轮为设计，性能/误差门限均待实际执行验证。[共同依据](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。

## 前提
`implement-marine-webgpu-parity`、`instrument-marine-stage-performance`、`automate-marine-visual-validation`
设计先决条件须登记为GitHub原生关系才参与调度，不以本文维护状态镜像。

## 入口与覆盖
演进现有collect-marine-fft-measurement.mjs / run-spectral-evaluation.ts，不新建第二套benchmark数据库。建议公开命令 npm run marine:verify -- --suite smoke|compare|extended（名称可按项目约定调整，但只有一个主入口）。启动/复用本机已有生产构建服务、等待ready、加载既有资源、运行/导出/清理，全程无需手点浏览器、拷JSON或录像。首次必要依赖/浏览器安装由代理使用已授权本机权限完成，不索取新设备或凭据。
compare核心：GL-Gerstner/GL-FFT/GPU-Gerstner/GPU-FFT，波场诊断+完整海面+高精055；扩展七船型/五布局/三档采用成对覆盖加特殊工况。主性能基准用实际加速Chromium/Chrome并记录版本、设备、实际backend，WebKit/Firefox在本机可运行时补兼容性，绝不称作Safari/iPhone真机。WebGPU必须实际申请/运行，不能仅navigator.gpu；意外软件回退标独立correctness样本，不纳入M5GPU性能排名。
## 可控压力与资源约束
CPU基线1x以及4x/6x CDP节流，自动记录范围并运行校准段；检查Worker是否同样受限，否则标主线程压力，Worker另计。伪装hardwareConcurrency并不减少CPU核心，不用它代表性能。
像素扫描720p/1080p/1440p/2160p，FFT采样128/256/512（能量/物理频带先匹配），船体LOD、反射尺寸/频率、泡沫网格和查询点数分开扫描。首先单因素，最后少量耦合压力；不得同时改变视觉门槛与硬件假设掩盖性能。
GPU不支持任意型号降速模拟：增加离屏工作量/像素是压力试验，不等价于低端芯片；资源预算及功能禁用是应用级约束，不冒充真实显存上限/带宽。不得通过sleep、录屏、恶意busy-loop或软件渲染把FPS做低就称模拟成功。能力注入显式测试降级，不绕过浏览器安全。
压力有上限、timeout和退出条件，禁止探测到OOM/watchdog后才停。无sudo、调GPU电压/频率、云真机或付费服务依赖。每轮串行用同GPU，检测前台/电源模式及基线漂移，必要时有限重测；不停止用户其他任务，仅标被干扰轮次。
## 统计、成本与结论
默认3轮配对随机顺序，接近噪声时有限增样。报告CPU/GPU/完成吞吐、查询质量/年龄、首个正确高精场景ready、资源估算与质量向量，median/p95/p99及批次离散度。time-query与整场吞吐互证；不同方法不拼成同一GPU耗时排名。
优先三种可解释比较：同统计海况与完整功能的固定参数成本；满足同质量门槛时最小成本；相同预算下最高质量的Pareto前沿。可附CPU/GPU分别2/4/8倍的预算敏感性模型，但它们是未校准假设，不命名成某低端设备，也不将CPU/GPU流水简单相加为帧耗。误差带覆盖的差异标无显著结论，不强行选赢家。
真实hardwareContext、feature实际状态与船包/编译/控制输入一起来自本轮实例，消除脚本写死null。implemented/validated/measured/eligible与adoption建议分开；路线缺核心功能必须非零退出，非参考浏览器不支持不能作废有效pair。完整实施且实测后保留Gerstner可以是合法结论；没实施不可以。
## 替代旧验收条件
本系列的必需设备覆盖就是已声明M5。此前#2103/#2104/#2120及报告中低端/移动真机“待人工”条目保留历史，增加明确更正/后续覆盖说明，不再阻塞本轮完成。所有核心数值/动态/成本测试必须自动跑过，不能再写探针就绪代替实测；也不因无法穷尽主观美感而无限挂起。自动检查保证约定品质，路线最终取舍保留建议/不采用分支。
默认生产后端不因benchmark胜出自动迁移。报告、配置、原始数据和关键截图指向同一run；大视频使用现有artifact渠道按需保留，不全量塞进Git，也不修改Runtime发布链。
