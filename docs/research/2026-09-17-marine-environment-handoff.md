# ACT 海洋环境系列：Issue 映射与 Propose 登记交接

日期：2026-09-17。
研究与九项提案提交：`8a130237e05504866603614ae1b9c8e56fb2f22c`，已在 `integration`。
总入口：[#2096](https://github.com/yong-wei/act/issues/2096)。
研究正文：[统一海洋环境研究与技术裁决](2026-09-17-marine-environment.md)。

本文只记录提案登记的交接信息，不复制实现任务。设计、任务和能力增量分别以各 change 的 `proposal.md`、`design.md`、`tasks.md`、`specs/` 为准。后续进度和依赖状态以 GitHub 原生关系为准，不维护另一份同步状态清单。

## 1. 已创建的唯一映射

| Issue | change_id | 交付边界 |
| --- | --- | --- |
| [#2097](https://github.com/yong-wei/act/issues/2097) | `unify-marine-scene-runtime` | 共享帧快照、世界坐标、时钟与姿态所有权 |
| [#2098](https://github.com/yong-wei/act/issues/2098) | `implement-bandlimited-marine-ocean` | 带限近场网格、远场 LOD 与一致水高采样 |
| [#2099](https://github.com/yong-wei/act/issues/2099) | `unify-marine-sky-lighting` | 同源天空/IBL/太阳、船体材质与稳定阴影 |
| [#2100](https://github.com/yong-wei/act/issues/2100) | `implement-marine-water-optics` | 微法线、深浅水光学、受光泡沫与分级反射 |
| [#2101](https://github.com/yong-wei/act/issues/2101) | `unify-marine-vessel-interactions` | 水线、尾流、推进器洗流、渲染排水与贴水线 |
| [#2102](https://github.com/yong-wei/act/issues/2102) | `add-marine-scene-environments` | 海域、港湾、施工区、作业区与极地布局 |
| [#2103](https://github.com/yong-wei/act/issues/2103) | `govern-marine-render-performance` | 真实硬件预算、自适应画质与资源生命周期 |
| [#2104](https://github.com/yong-wei/act/issues/2104) | `migrate-fleet-marine-scenes` | 七船型及有效课程嵌入入口统一迁移 |
| [#2105](https://github.com/yong-wei/act/issues/2105) | `evaluate-marine-spectral-backends` | 独立 FFT/WebGPU 实验，不切换生产默认 |

每个执行 Issue 包含一个且仅一个 `<!-- openspec-buddy change_id: ... -->` 标记，并带 `type:change`。父项不是可执行 change，不创建 claim branch 或实现 PR。当前无认领、无实现、无部署。

## 2. 本轮执行与未完成事项

本轮实际执行了仓库技能中的 driver 无参数入口，并为九项 change 执行 `--mode propose --change <id>`，均返回 `HANDOFF`。执行前将从连接器读取的三个脚本按原始内容恢复到临时目录，并核对 Git blob SHA；未修改用户技能：

- `buddy-driver.mjs`: `2e30320d443b6010c0e710d179dc38d2467d03c0`
- `check-config.sh`: `40f343d64c5b55362438a97f29d84e9ca669644d`
- `load-config.sh`: `70e3273a252d4287c6e681b6f7c044feab0d6e1b`

Propose 使用已知 base branch `integration`。临时执行目录不是完整 ACT 工作树；driver 的 HANDOFF 不代表 OpenSpec 工件已通过 CLI 校验。

本环境没有 OpenSpec CLI。尝试 `npm exec --offline --yes --package=@fission-ai/openspec@1.13.0 -- openspec --version` 返回 `ENOTCACHED`；容器无法解析外部域名，未能安装。因此本轮没有执行 `openspec validate ... --strict`，也没有运行应用/GPU 性能测试。

GitHub 连接器支持创建/读取 Issue 和提交文档，但未提供 `blockedBy` / `addSubIssue` 写入操作。下节列出的 12 条执行依赖和 9 条父子关系尚待登记。**九个执行 Issue 暂不标 `status:ready`；这表示登记待完成，不是实现工作被否决。** 不能向用户或自动领取器宣称完整 Propose 已闭环。

## 3. 登记代理的最小收尾

先按当前个人 Buddy 技能取得 propose HANDOFF，再只完成下列登记；不要重新创建研究报告、九项 change 或已有 Issue，不启动实现。

### 3.1 定向校验

从含上述提案的最新 `integration` 读取实际工件。用项目既有固定 OpenSpec 1.13.0 入口，对九项分别运行：

```bash
openspec validate <change_id> --type change --strict
```

如果校验发现本批工件问题，仅修本批提案并提交到 base branch；不要扩大到全仓历史 OpenSpec 债务、Runtime 全量导出、全量哈希或应用构建。

### 3.2 一次性关系登记申请

以下仅是待写入的期望边，不是已成立的 GitHub 关系，也不是后续要维护的依赖镜像。方向为左侧 Issue 被右侧阻塞：

| 被阻塞项 | 直接前提 |
| --- | --- |
| #2098 | #2097 |
| #2099 | #2097 |
| #2100 | #2098、#2099 |
| #2101 | #2100 |
| #2102 | #2100 |
| #2103 | #2097 |
| #2104 | #2101、#2102、#2103 |
| #2105 | #2100、#2103 |

#2097 无本系列执行前提。#2103 应与海面和天空并行推进，不按编号等到最后。#2105 不阻塞 #2104；八项生产能力可先交付，父项仍可继续跟踪独立实验。

优先调用已经核实存在的个人技能 helper，勿手写 GraphQL：

```bash
skill_dir="$(realpath .agents/skills/openspec-buddy)"

# 仅对当前尚未存在的关系执行；重跑前读取原生关系，不盲目重复写入。
for child in 2097 2098 2099 2100 2101 2102 2103 2104 2105; do
  "$skill_dir/scripts/link-issue-parent.sh" 2096 "$child"
done

"$skill_dir/scripts/link-issue-dependencies.sh" \
  2098 2097 \
  2099 2097 \
  2100 2098 \
  2100 2099 \
  2101 2100 \
  2102 2100 \
  2103 2097 \
  2104 2101 \
  2104 2102 \
  2104 2103 \
  2105 2100 \
  2105 2103

"$skill_dir/scripts/verify-issue-relationships.sh" --require-parent \
  2096 2097 2098 2099 2100 2101 2102 2103 2104 2105
```

上面的脚本参数顺序已经与 `references/issue-relationships.md` 和 `link-issue-dependencies.sh` 核对。不要把 Issue number 直接当 REST issue_id，helper 会解析正确 ID。

### 3.3 状态收尾

校验及关系登记完成后，为执行项补 `status:ready`，保留 `type:change`；父项保持 tracking。Ready 不代表其前提已完成，后续 claim 必须由原生 blockedBy 决定是否允许。

一次读取 Issue 状态及所有期望原生关系，再对开放和已关闭 Issue 做唯一映射搜索。识别轻量标记、旧隐藏 metadata 与 YAML front matter，复用已有唯一 Issue，不重复建号。将各 Issue 的 Registration handoff 改为实际完成结果；本次历史交接可保留并注明已被新的登记回读取代。完成后停止，不自动 claim/apply。

## 4. 研究来源复核说明

2026-09-17 在本轮使用在线一手资料核验了正文中的关键依据。技术取舍仍是面向 ACT 的设计判断，不是上游对 ACT 的性能保证。

- [Three.js WebGPURenderer](https://threejs.org/manual/zh/webgpurenderer.html)：明确 ShaderMaterial/onBeforeCompile 与传统 EffectComposer 的迁移边界。WebGL2 后端回退不等于任意 compute 程序自动兼容。
- [WebGL FFT ocean 作者实现](https://github.com/jbouny/fft-ocean)：已存在 WebGL FFT 与屏幕投影网格；FFT 和 WebGPU 不是绑定关系。
- [NVIDIA GPU Gems 水面章节](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)：几何/纹理频率分工、网格带限与 Gerstner 水平位移。正文的 4–8 波、约8间隔/周期、0.05m 是项目设计起点，不是该文给出的硬标准。
- [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html)、[Sky](https://threejs.org/docs/pages/Sky.html)、[Reflector](https://threejs.org/docs/pages/Reflector.html)、[CSM](https://threejs.org/docs/pages/CSM.html)：支持现有栈上的环境辐射、天空与阴影选型；实际 helper 和参数必须匹配 ACT lockfile。
- [Crest LOD](https://docs.crest.waveharmonic.com/Manual/Advanced/LevelOfDetail.html)、[泡沫](https://docs.crest.waveharmonic.com/Manual/Appearance/Foam.html)、[反射](https://docs.crest.waveharmonic.com/Manual/Appearance/Reflections.html)、[性能指南](https://docs.crest.waveharmonic.com/Manual/Guides/PerformanceGuide.html)：借鉴多尺度、持续泡沫和预算方法，不直接依赖 Unity 包。
- [Bruneton 大气散射](https://ebruneton.github.io/precomputed_atmospheric_scattering/)：作者有 WebGL2 实现；不能把 LUT 大气误解成 WebGPU 专属。
- [Takram WebGPU 大气说明](https://github.com/takram-design-engineering/three-geospatial/blob/main/packages/atmosphere/WEBGPU.md)：作者明确 work-in-progress；引用它作候选能力说明，不承诺直接接入 ACT。
- [Poseidon](https://github.com/owenyuwono/poseidon)：三尺度频谱和 Jacobian 累积泡沫可作实验参考；作者说明没有 WebGL fallback。本系列不沿用其 README 中浏览器版本的笼统兼容承诺。
- [GPUComputationRenderer](https://threejs.org/docs/pages/GPUComputationRenderer.html)、[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)：现有栈能力依据。
- 正文 R13 的 MDN 链接是通用 timer-query 背景。WebGL2 实施应以 [Khronos EXT_disjoint_timer_query_webgl2 规范](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/) 为准确依据，运行时能力探测，不能混用 WebGL1 EXT 方法。

## 5. 执行纪律

先完成场景基座，然后海面、天空和预算治理并行；水体光学就绪后开展互动与环境布局；最后全船型迁移。此顺序用于解释上述一次性登记申请，日后调度只读原生关系。

研究判断应通过真实镜头与高精船模验证。不要把单元测试、截图、空场 FPS 或当前所有 profile 已共用组件视为完整验收；也不要为了所谓高级感堆满全屏后处理。实施代理只需维护自己 change 的工件和足够的证据，不复制整套研究报告或创造新的流程门槛。
