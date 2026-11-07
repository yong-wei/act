# Design: issue-2157-p1

## 结构

model-data 放 `rust/control-engine/model-data/<vessel>/v1/`，构建期 `include_str!` 嵌入（无运行时文件依赖、随 WASM 分发）。加载器 `sixdof/model_pack.rs`：

- `ModelPack { manifest, provenance, geometry, maneuvering, actuators }`，serde 反序列化。
- 规范化哈希：各文件按 key 排序的紧凑 JSON 重序列化 → FNV-1a 链式。
- 门禁（load 时 fail-closed）：`mass_basis ∈ {displacement_volume, stated_loading}`（GT/DWT 无字段可用）；`|m − ρ·V|/m < 1e-3`（stated_loading 需附说明）；各惯量回转半径 `sqrt(I/m) ∈ [0.15Lpp, 0.35Lpp]`（0.25mL² 形态的惯量会得到 ~0.5L 半径即被拒）；`lpp ≤ loa`。
- 055 包内容 = 现 DestroyerSixDofConfig 值平移（hifi 迁移 T 级 + A2.1 修正），provenance 每项记 `level: "T"`、来源（hifi-migration / textbook-typical / design-equilibrium）与不确定范围。

## runtime 联动

`parameter_bundle_hash()` → `format!("{}@{}", manifest.model_version, pack_hash)`；run manifest 的 `parameter_bundle_hash` 字段随之，改包即换 run（身份合同延续）。

## 验证

tests/sixdof_model_pack.rs：合法包全门禁通过；篡改包（惯量×L²、质量=GT、V 不闭合、lpp>loa）逐一拒绝；哈希跨平台稳定（同字节同哈希）；runtime 返回包哈希；Default config 与包值一致（防双真源漂移）。
