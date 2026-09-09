# 接收船队 Hero 整合包并默认走 OSS

## Why

3DModels 已发布 `act-ship-release/1` 整合包（雪龙2 / 爱达 1.0.0，其余商船与 981 1.1.0，055 2.2.0）。ACT 仍钉在上一轮单文件 LOD 包，且运行时只读应用镜像里的 `/assets/model-releases/`。大 GLB 应先走内容寻址 OSS，镜像只作回退。

## What Changes

- 按各包 `release.json` 接收 LOD 三档（爱达为 LOD1/2/3）及 055 辅助 GLB；旧版本目录保持不可变。
- 激活指针切到新版本；挂载使用包内行主序 `modelToSceneMatrix`，不再对整合包使用 act-forward 或 bbox 拉伸。
- 海报改用包内 `evidence/hero.png`。
- 版本化 GLB 默认请求 `https://static.adapt-learn.online/assets/<sha256>/<file>`，失败再回退同源 `/assets/model-releases/...`，最后回退旧单文件链。
- 不接入包内 Three r184 vendor，不替换 ACT Gerstner / 尾迹。

## Capabilities

### New Capabilities

- `fleet-model-oss-delivery`: 版本化船模默认 OSS、镜像回退。

### Modified Capabilities

- `versioned-simulation-model-package-integration`: 新整合包版本与坐标矩阵。
- `simulation-scene-visual-pipeline`: 候选链改为 OSS → 镜像 → 旧单文件。

## Impact

- 接收脚本、`public/assets/model-releases/`、描述符、激活指针、共享挂载、首页预览。
- 不改 Rust/WASM、SimulationClock、Arena、overlay、生产 selector。
