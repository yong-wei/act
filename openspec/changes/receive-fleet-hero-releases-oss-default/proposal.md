# 接收船队 Hero 整合包并默认走 OSS

## Why

3DModels 已发布 `ACT_RUNTIME_ONLY` 包（雪龙2 / 爱达 1.0.1，其余商船与 981 1.1.1，055 2.2.1）。旧版本化包已被新版显式替换，不再作为回退链。服务回退只保留七模型 registry 单文件。公开对象放在 `act-course-models` 的 `model-releases/` 下，与包内 `../textures/` 相对路径一致；镜像只作回退。

## What Changes

- 按各包 `release.json` 接收 `models/` 三档 LOD（爱达为 LOD1/2/3）、055 辅助 GLB 与 `textures/`；旧版本目录与描述符退役删除。
- 激活指针切到新版本；挂载使用包内行主序 `modelToSceneMatrix`，不再对整合包使用 act-forward 或 bbox 拉伸。
- 海报改用包内 `poster.webp` 转 PNG。
- `ACT_RUNTIME_ONLY` LOD 的首选是 `https://static.adapt-learn.online/model-releases/...`。首帧挂同源 `/assets/model-releases/...`，短超时 HEAD 成功后再切到公开地址；公开域不可达时保持镜像，最后回退 registry 单文件链。
- 不接入包内 Three r184 vendor，不替换 ACT Gerstner / 尾迹。

## Capabilities

### New Capabilities

- `fleet-model-oss-delivery`: 运行时包公开存储优先、同源镜像次选、registry 单文件回退。

### Modified Capabilities

- `versioned-simulation-model-package-integration`: 新整合包版本与坐标矩阵。
- `simulation-scene-visual-pipeline`: 候选链改为公开存储 → 同源镜像 → registry 单文件。

## Impact

- 接收脚本、`public/assets/model-releases/`、描述符、激活指针、共享挂载、首页预览。
- 不改 Rust/WASM、SimulationClock、Arena、overlay、生产 selector。
