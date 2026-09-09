# Design

## 接收

源树：`/Users/YW/.codex/worktrees/8440/3DModels` 的 `act-ship-release/1`。入口是 `release.json` 与 `shared/export/fleet-hero-releases.json` 的 manifest SHA。只复制 `models.lods` 的三档主舰（爱达无 LOD0，用 LOD1/2/3 映射 ship-lod0/1/2）以及 055 的 collision / payload / demo / interactive-systems。不复制 `runtime/vendor`。`evidence/hero.png` 覆盖对应 `public/assets/*.png`。

历史目录（如天鲸 v1.0.1、055 v2.1.3）不删除。

## 坐标

整合包舰艏为模型 +X。`modelToSceneMatrix` 为行主序，用 `Matrix4.set(...)` 作用在内层组一次。055 矩阵含 Y=−7.05，不再叠加旧 6.6 水线或 bbox 居中。外层航向仍是 `-heading + π/2`。缩放只用声明船长。

## OSS

对象键沿用 `assets/<sha256>/<basename>`，桶 `act-course-delivery`，主机 `static.adapt-learn.online`。`VersionedShipModel` 候选顺序：ESA URL、同源 `baseUrl`、既有 legacy。ESA 未开通或 CORS/404 时 FallbackGltfModel 进镜像。不把 Authority Bucket 当 origin。
