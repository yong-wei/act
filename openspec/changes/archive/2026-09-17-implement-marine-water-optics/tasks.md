# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 癠记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. （proposal 任务 1：微法线频段与采样接口）micro-optics 纯模块：风向对齐八分量按档 high 3/medium 2/low 0（λ 空间角频率 1.35–4.9 rad/m，属 #2098 几何带限裁掉的高频段）；microNormalSlope 纯函数（CPU 参照与 GPU 片元同公式，确定性可重放）；microNormalFootprintAttenuation 像素脚印衰减（近处 1 / 900m 外 0，C1 连续 smoothstep）；litFoamColor 受光泡沫因子。
- [x] 2. （微法线不改变运动）GPU 片元阶段接入：微法线只扰动着色法线（normal = normalize(normal + slope·footprint)），顶点/几何/姿态公式零引用（源码契约测试钉住：顶点着色器字符串不含 uMicroOctaves）；降档细节优雅退化（low 0 八分量 → 斜率恒 0，纯函数测试）。
- [x] 3. （可选 pass 有界显式消费者）深水默认 opaque 单面：不启用折射/平面反射 pass——水模块零 WebGLRenderTarget/Reflector/refraction 引用（源码契约测试）；默认环境反射沿用预设同源 horizon 色菲涅尔近似（#2099 已建立的预设一致性）；PMREM 水面采样（CubeUV 集成）记录为后续候选，未引入空渲染目标。
- [x] 4. （泡沫为受光表面）受光泡沫：泡沫颜色乘与基面一致照明因子（foamLit = uFoamColor × (light·0.65+0.35)），暗预设下泡沫整体变暗不改变色相（litFoamColor 纯函数测试钉住各通道同因子缩放）；本项自然泡沫为无状态场（crest×噪声调制），无持久泡沫状态——持久泡沫/衰减属 #2101 船体尾流范围。
- [x] 5. （定向验证）typecheck EXIT=0；41 测试文件 390 用例全绿（9 项新测试：八分量档位/风向对齐/确定性/低档退化/脚印衰减单调 C1/受光泡沫同因子/片元专用契约/零可选 pass 分配契约）。
