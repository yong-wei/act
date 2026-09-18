# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 登记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. （提案任务 1：真实硬件预算记录）performance-evidence 纯模块：测量上下文（绘制缓冲/CSS/DPR/GPU 渲染器字符串/浏览器/核心数/船包/镜头/海况/画质档）+ nearest-rank p50/p95/p99/长帧/最差帧 + 目标（桌面 1080p60 p95≈18.2ms、移动 30fps）与实测分离（measuredAt 时间戳；目标恒在 targets 字段不得混写）；无 EXT_disjoint_timer_query_webgl2 时强制 method='frame-intervals' 且不出现 GPU 时长口径字段（不把帧间隔冒充 GPU 时长）。
- [x] 2. （提案任务 2：自适应画质与降级语义）degradation 纯模块：DEGRADATION_LADDER 显式裁剪序（medium：粒子×0.5/阴影 1024/水中档渲染 → low：关后处理/粒子×0.25/关阴影/DPR 上限 1/水低档）+ DEGRADATION_INVARIANTS（基础交互波场/姿态所有权/数值结果恒定——#2097/#2098 已建立，回归测试钉住近场网格与波组档位无关）；degradationPreservesSemantics 验证 SCENE_QUALITY_TIERS 单调只降附加开销；既有 governor（600ms 窗口/8s 冷却/手动覆盖优先）与 DPR cap 沿用。
- [x] 3. （提案任务 3：渐进加载与资源生命周期）resource-ledger 纯模块：注册/释放/共享所有（shared PMREM 由所有者管理不计泄漏）/估算字节（不冒充显存）/leaks() 稳态断言——十次预设切换回到稳态、路由循环泄漏可检（测试钉住）；#2099 已建立的 PMREM renderer 隔离/卸载释放/generator 复用为其运行时基础。
- [x] 4. （QA 采集入口）MarinePerformanceEvidenceProbe（?qa=marine-frame → window.__marinePerformanceEvidence.read()）：滚动 ~60s 帧样本环形缓冲 + 完整报告构建（含 GPU timer 可用性探测与 drawingBufferSize）；七包 Canvas 挂载。
- [x] 5. （定向验证）typecheck EXIT=0；44 测试文件 434 用例全绿（9 项新测试：分位/长帧/口径分离/上下文归因/阶梯序与不变量/真实档参数单调/近场档位无关契约/台账稳态与泄漏检测）；真实硬件（Windows 集显/Apple Silicon/Android/iOS）分级实测与 p95 达标情况为待办证据——targets 保持目标身份，失败时反馈默认参数而非改报告（本环境无浏览器，QA 探针已就绪待采集）。
