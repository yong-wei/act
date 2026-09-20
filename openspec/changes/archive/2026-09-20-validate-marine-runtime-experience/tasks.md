# Tasks

- [x] 1. 将已有探针绑定真实R3F renderer，修正start/窗口归因、后台和全部前台长帧记录。（探针 canvas/上下文 = `useThree(state.gl).domElement / getContext()`——多 canvas 页面不再 `querySelector('canvas')` 猜图表画布；前台 ≥1s 卡顿不再被 `<1000` 过滤静默丢弃——longStalls 单独记录（count+worst），不混入 p95 窗口口径）
- [x] 2. 可用时接入非阻塞GPUtimer；门控普通运行逐帧QA模型遍历，并测量该热点前后差异。（gpu-frame-timer：EXT_disjoint_timer_query_webgl2 非阻塞测量**受控反射 pass**（begin/end + 逐帧轮询 + disjoint 丢弃 + 2s 超时回收）；gpuTimerAvailable=真实结果数>0（不再恒 false），扩展存在性单独记录；055 逐帧全模型 Box3 遍历与骨骼校验门控到 `window.__destroyerModelVisualProbe === true`——普通运行只写轻量字段，设备端前后差异实测归运行采集）
- [x] 3. 在真实governor落实预热/后台保护和成本降级，检验每档确实减少实际工作。（SceneQualityDriver：GOVERNOR_WARMUP_MS=8000 冷启动编译/预热不参与降档判定；visibilitychange 隐藏期间不推进判定、恢复帧巨大间隔丢弃（lastRef 复位）；档位成本递减由降级阶梯既有断言 + #2119 实例 LOD/远场细分削减承接）
- [ ] 4. 跑七入口及课程嵌入的动态场景，修复本项有界集成问题，提交实际视频。（本环境无真实浏览器——探针/QA 门控/测量面已就绪；七入口动态视频归设备端采集）
- [ ] 5. 在真实桌面/移动设备记录默认画质和效果A/B；无法测试的目标硬件逐项标未完成。（设备端 1080p60/移动 30fps 目标与实测分离的原则保持；真实设备记录未做——目标硬件逐项标记未完成）
- [ ] 6. 完成预设/路由循环资源稳态，报告目标与实测、剩余问题，不新增一套空证据框架。（未新增证据框架——全部扩展现有探针/报告字段；预设/路由循环资源稳态的实测记录归设备端采集，剩余问题如实保留）
