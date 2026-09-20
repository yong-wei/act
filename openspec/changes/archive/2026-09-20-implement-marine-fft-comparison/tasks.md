# Tasks

- [x] 1. 将已有QA场景接成Gerstner/WebGL FFT真实切换入口，固定船包/镜头/材质与像素负载。（实验路由 `/simulations/fft-ocean-comparison`：?backend=fft|gerstner 同镜头/海况/画布切换——FFT 侧为真实可运行的第二种海面运动（CPU 频谱演化+IFFT × GPU 位移渲染）；受控变量声明沿用 spectral-evaluation 的 controls；生产默认后端不变（registry 无本页引用，测试钉住））
- [ ] 2. 实现GPU频谱演化、二维IFFT和海面输出，并用小网格独立数值参照验证。（部分交付：频谱演化+2D IFFT 为**验证过的 CPU 路径**（radix-2 DIT 快速 IFFT 与独立逐点逆 DFT 双路径互证至 <1e-6，单 bin 纯余弦波长精确）；GPU 侧**蝶形 IFFT pass 未实现**（如实标注，CPU 12Hz 重建高度网格 + GPU 位移渲染为第一可运行切片）——GPU 2D IFFT 保持未勾选）
- [ ] 3. 在支持设备上实现并运行WebGPU候选，记录能力/失败行为和许可证；未实现不得勾选。（未实现：QA 探针记录 `navigator.gpu` 能力存在性；WebGPU 候选未实现——不勾选）
- [x] 4. 实际接入船体少量水高查询，测量延迟/误差，避免逐帧同步整纹理读回。（逐点逆 DFT 水高查询 fftOceanHeightAt（O(N²)/点，64²=4096 bin，无整纹理读回——契约钉住无 readPixels）；QA 探针 measurePointQueryMs 实测单点延迟；查询与网格快照一致性 <1e-6（测试））
- [ ] 5. 采集代表海况的同场景视频、首载/稳定性能/统计指标，脚本消费真实文件而非重写空模板。（脚本侧完成：run-spectral-evaluation 接受真实测量文件参数消费其字段（不重写空模板，契约钉住）；QA 探针提供 Hs/更新节拍/查询延迟/首载字段——真实浏览器视频与设备端首载/稳定帧率采集未做（归设备端），保持未勾选）
- [ ] 6. 输出有测量依据的采用/不采用/延期判断，标清未测项；不修改生产默认后端。（评估框架沿用 #2105（测量不齐备时 defer-more-evidence）；本切片的诚实结论：**GPU 2D IFFT 与 WebGPU 候选未实现、无设备实测——延期**（defer-more-evidence），生产默认后端未改（不变量测试钉住）；完整采用判断待 GPU IFFT 落地与真实测量后另行 change）
