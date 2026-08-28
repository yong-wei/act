# 仿真 GLB 浏览器 Delivery

首批七个公开仿真 GLB 使用内容寻址 Delivery 合同。生产只有在 ESA PoC、流量基线、manifest 与发布收据全部合格时才会发出 ESA-first URL；否则保持现有同源 `models-opt` → original 顺序。本变更不发布视频、音频、PDF、WASM、Runtime、知识或评估对象，也不新增 GitHub PR CI。

## 命令

```bash
npm run browser-delivery:inventory
npm run browser-delivery:manifest
npm run browser-delivery:plan
npm run browser-delivery:qualify-routing
```

`plan` 只生成 `act-course-delivery` 的 `assets/<sha256>/<basename>.glb` 计划，默认 `applied: false`。没有合格 ESA/流量/上传证据时不得把应用 URL 切到 `static.adapt-learn.online`。

## 回退

回退是把解析器留在同源候选，不删除 Delivery 对象、镜像内 GLB 或 Runtime 选择器。
