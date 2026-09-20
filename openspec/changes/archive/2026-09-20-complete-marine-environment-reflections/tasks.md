# Tasks

- [x] 1. 核对本机已认可效果与远端基线，冻结波光/曝光并分清直接光、IBL与平面反射现状。（基线=本 PR base；GGX 直接光/菲涅尔/曝光路径与断言未改——IBL 只替换菲涅尔项内的 horizon 纯色过渡，直接太阳能量责任不变；现状登记见 change 设计与测试）
- [x] 2. 将共同天空/云辐射和PMREM实际接入水shader，完成方向诊断与缓存复用。（renderer×preset 缓存条目新增 cubeUVHeight → scene.userData.marineEnvRadiance 跨兄弟共享；水片元经 three 0.184 内建 CubeUV chunk（envmap_common/physical + cube_uv_reflection）采样同一 PMREM，运行期绑定补 defines 重编译；`?qa=marine-env` 旋转 envMapRotation 方向诊断）
- [x] 3. 修天空相机相对表示、水/船/泡沫雾和单次色彩输出，校准主体光照及阴影。（天空组（球/地平线/云）随相机 x/z 平移=等效无限远，岸物世界锚定保留视差；水材质接入 fog chunk（fog:true，scene.fog 未设置时零成本）；tonemapping/colorspace 单次输出断言；主体跟随阴影/IBL 降权既有口径保持）
- [x] 4. 实现一个受控高档平面反射消费者，支持白名单/低LOD/运动更新/关闭释放。（MarinePlanarReflection：512² RT、镜像相机（位置/朝向/上向量按 y=planeY 反射）、隐藏水面自身与尾迹防递归、相机 1.5m/0.004rad 或主体 3m 运动触发（静止零成本）、禁用/卸载释放绑定与 RT；水片元纹理矩阵投影采样 + 120–900m 距离衰减 + 菲涅尔加权；`tier==='high' && ?qa-planar!=off`）
- [ ] 5. 提交真实页面天空倒影、船体倒影和波光保留的动态A/B及成本记录。（行为/契约测试已交付（9 项）；真实浏览器五天气片段、旋转环境倒影实拍、平面反射开/关动态 A/B 与设备端增量成本记录未做——本环境无真实浏览器/硬件采集，归 #2120 运行验收）
