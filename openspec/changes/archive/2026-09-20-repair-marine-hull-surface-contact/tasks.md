# Tasks

- [x] 1. 沿七个实际船体挂载登记DOF所有权、水线、时间源和查询入口，复现055时钟旁路与邮轮基准路径。（七个 rig 统一接入 useNearFieldWaterHeight（见 simulation-hull-surface-contact.test.ts 登记）：055 的 state.clock 旁路与六船 getElapsedTime 查询路径全部清除；邮轮数值横摇（extraEuler z）与 LNG 晃荡通道只读保留）
- [x] 2. 接通同帧visualTime/epoch及表面输入，清除实际消费者的独立查询时钟，保留数值轴。（hook 时间源 = useMarineVisualTime（Provider 场景共享视觉时钟、暂停/倍速/seek 政策一致；无 Provider 回退 R3F 时钟——行为保持）；六船 VersionedFleetShip 挂载以 waterYSampler 提供共享波面水线参考，替代隐含 waterY=0；数值横摇不受影响）
- [x] 3. 将岸线、包络、水平位移与原点纳入同一CPU/GPU表面定义。（createNearFieldSurfaceQuery 新增 shoreSegments/shoreFadeBandMeters 选项：角点振幅 × shorelineAmplitudeAttenuation（与 GPU 顶点同一公式/输入）；包络/水平位移/原点既有同口径保持）
- [x] 4. 分离三类误差并按近场需求调整网格/频带；减少无波远场无效细分，修必要的壳体排水代理。（远场平基面细分 256/128/64 → 32/16/8（顶点预算让给近场 2048m/256² 档位无关基准）；半潜平台月池开口核验保留（四立柱+两浮筒框，域中心不排除）；CPU 查询 vs 解析带限场振幅口径测试）
- [ ] 5. 完成实际GPU表面误差、近岸、暂停/seek/重置、数值横摇和七船水线验收，提交动态证据。（CPU 侧行为与源契约测试已交付（8 项新测试）；离屏 GPU 深度/顶点 vs CPU 独立比较、真实浏览器 055 冷启动/seek/重置/邮轮横摇动态视频未做——归 #2120 运行验收；近场 0.05m 目标的实测以该比较为准）
