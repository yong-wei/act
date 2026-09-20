# 将环境几何占位升级为可信海域和浅水场景

## Why

现有五类布局已经注册，但岛屿为锥体、岸桥为立柱，detail仅改变材质/阴影；缺少能与高精船模匹配的环境轮廓、材质、LOD与浅水光学。

## What Changes

- 复用现有布局配置，交付五类可辨识的环境资源与有尺度的近景。
- 真正的按距LOD/实例批处理和按布局加载，避免所有场景资源一次下载。
- 在至少一个浅水布局实现有深度依据的水体层次/受控折射与岸水接触，而不只颜色渐变。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `marine-scene-environments`: 环境资产质量与实际LOD/加载。
- `marine-water-optics`: 有实际浅水消费者的深度光学。

## Impact

scene-layouts、scene-layout-objects、既有资产清单/交付和水体必要扩展；基线fe951b7。详见[审计](../../../docs/research/2026-09-20-marine-series-completion-audit.md)。

## Non-goals

不增加新的港口/泥沙/破冰物理模型，不在航路暗添障碍，不替换现有模型发布体系，不复制某船专属Water/Sky/Renderer。
