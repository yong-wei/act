# Design

## 接收

源树：`/Users/YW/.codex/worktrees/8440/3DModels` 的 `ACT_RUNTIME_ONLY` 包。入口是 `release.json` 与 `shared/export/fleet-runtime-releases.json` 的 manifest SHA。复制 `models/` 三档主舰（爱达无 LOD0，用 LOD1/2/3 映射 ship-lod0/1/2）、055 的 collision / payload / demo / interactive-systems，以及 `textures/<sha>.png`。不复制 `runtime/vendor`。`poster.webp` 转成对应 `public/assets/*.png`。

每个 packageId 只保留当前激活版本。接收成功后删除同船旧目录与旧收据。服务回退只走七模型 registry 单文件链。

## 坐标

整合包舰艏为模型 +X。`modelToSceneMatrix` 为行主序，用 `Matrix4.set(...)` 作用在内层组一次。055 矩阵含 Y=−7.05，不再叠加旧 6.6 水线或 bbox 居中。外层航向仍是 `-heading + π/2`。缩放只用声明船长。

## OSS

对象键与本地包目录对齐：`model-releases/<packageId>/v<version>/...`，桶 `act-course-models`，主机 `static.adapt-learn.online`。发布身份只授该前缀的 List/Get/Put。`ACT_RUNTIME_ONLY` 的 GLB 在 `models/`，贴图走 `../textures/`，公开存储与镜像使用同一相对布局。候选顺序为公开存储 → 同源镜像 → registry 单文件。首帧只挂同源镜像；短超时 HEAD 成功后再切到公开地址。未接通公开域名时不得对 `static.adapt-learn.online` 调用 `useGLTF`。不把 `act-course-assets` 当 origin。ESA CORS 只放行 `https://act.adapt-learn.online` 的 GET/HEAD；本机开发源继续走镜像。
