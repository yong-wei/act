# 测量真实GPU/CPU分项成本、查询延迟与吞吐量

基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。本轮为设计，性能/误差门限均待实际执行验证。[共同依据](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。

## 前提
`repair-marine-comparison-foundation`
设计先决条件须登记为GitHub原生关系才参与调度，不以本文维护状态镜像。

## 测量层
复用 quality-state/performance-evidence、collect-marine-fft-measurement.mjs 与现有QA入口。采集实际R3F renderer/device，不按首个canvas猜测。CPU计时包含主线程更新/指令编码/提交；Worker分开记录内部计算、队列、往返和结果年龄。旧1.12ms探针是主线程直接调用fftOceanHeightAt的均值，不能标为Worker端到端延迟；保留历史raw并添加更正说明。
WebGL使用EXT_disjoint_timer_query_webgl2的TIME_ELAPSED，异步池读取、丢弃disjoint；完整帧与分段不能嵌套同类query，分别运行或用合法独立区间。WebGPU申请可选timestamp-query，在实际render/compute pass写时间戳、resolve/copy/map异步取回。记录量化精度与不支持状态，不默认关闭隐私/安全标志。有限批次累积短kernel，不能把小于计时粒度的0作为免费。
分项：波场生成、主水面、主体/环境、泡沫更新与上传、阴影、平面反射/折射、后处理、CPU/query。自然Gerstner波计算与顶点绘制融合时诚实标fused，不为凑独立生成项伪造耗时。多pass反复render的renderer.info须跨pass正确聚合，统计draws/triangles/dispatches/目标尺寸/上传字节；资源字节为预算估算，不叫真实显存峰值或硬件带宽。
## 避开vsync
专用性能模式将实际效果渲染到同尺寸离屏目标，每批K次真实更新或绘制，K有上限，使用多个t与可检查输出防缓存/无操作替代。记录每批成本/单位有效工作量、K和上下文，预热后多轮A/B；不要在同GPU并行跑多个候选。
纯GPU计时需与整场吞吐/交互长帧交叉验证，GPU跨pass优化可能改变排名。无timer时先排空旧队列，WebGL fenceSync+flush+异步clientWaitSync或WebGPU onSubmittedWorkDone量批次完成；明确是提交到完成墙钟/吞吐，含调度与CPU，不能填gpuMs。允许自动用同类fallback比较，不因计时扩展缺失卡整个项目。
没有gl.finish、每帧同步readPixels或忙等来生产计时；测试数值的读回放在独立运行。保持目标/viewport/scissor状态，记录测量开关自身成本。CPU与GPU流水重叠，分项不可简单相加宣称帧时间。
## 统计和运行
录像/截图与性能分轮；独立浏览器进程冷启动与同会话热切换分开，load事件不是ship+shader ready。每个场景条件不变窗口记录median/p95/p99、长帧、温升/负载漂移提示及原始批次；缺OS温度权限就用重复控制组检测漂移，不要求sudo。
先以三轮配对测量给出离散度，差异接近噪声/量化下限时标inconclusive再有限加测，不制造1%胜负。既有17.4ms报告只能保留为刷新率下的体验记录，不再当资源成本等价证据。
