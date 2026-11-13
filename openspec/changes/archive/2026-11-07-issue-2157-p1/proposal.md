# Proposal: issue-2157-p1 — 参数包基础设施与 055 首包（阶段 A）

- Issue: #2157（P1，父项 #2146；配套 #2153（已闭环）/#2156（阶段 A 已交付））
- 类型: 参数包基础设施 + 首船结构化（多阶段；本 change 覆盖阶段 A）

## Why

#2153/#2156 的内核参数当前内嵌于 Rust 常量，无 provenance 分级、无版本哈希、无独立校验。#2157 要求参数包可复算：每参数标 P/B/D/T 级来源、质量与静水排水闭合、惯量定义防错、manifest 版本化并与 runtime 冻结哈希打通。

## What Changes（阶段 A）

1. **目录与 schema**：`rust/control-engine/model-data/<vessel>/v1/`（Rust include_str 加载，随镜像分发零运行时 IO）。每船必有 `provenance.json`（值/SI 单位/P-B-D-T 级/来源 URL-DOI/不确定范围）、`geometry.json`（LOA/Lpp/B/T/排水体积/重心/惯量）、`maneuvering.json`（无量纲定义+尺度+系数+有效域）、`actuators.json`、`manifest.json`（模型版本+来源文件+参数包哈希）。
2. **055 首包 v1**：现有 DestroyerSixDofConfig 的 T 级参数全部迁入结构化包（provenance 逐项标注教学标称与 hifi 迁移来源），A2.1 审查修正（iz=m(0.25L)²、area_r=c·L·T）入包固化。
3. **加载器与校验门禁（Rust `sixdof/model_pack.rs`）**：反序列化 + 哈希（参数包规范化 JSON → FNV）；门禁断言——质量-体积闭合 `|m−ρV|/m < 1e-3`（或显式加载说明）、惯量以 kg·m² 记录且回转半径界 0.15–0.35L（**防 `.25L` 半径错写 `.25mL²` 惯量**——A2.1 实际踩过的错）、GT/DWT 禁作排水质量（schema 枚举 mass_basis: displacement_volume|gt_volume_ineligible）、Lpp 与 LOA 分字段禁混用。
4. **runtime 打通**：sixdof_runtime 的 `parameter_bundle_hash` 改由参数包计算（含版本号），manifest 与 run 冻结联动。
5. **公开基准复现（阶段 B 声明）**：KVLCC2/S175/DTMB5415/B4-70/NEMOH 转录与双人核对、BEM 生成、黏性校准为后续批次——首版不开放且不宣称。

## Impact

- 新增 `rust/control-engine/model-data/destroyer-055/v1/*.json` + `src/sixdof/model_pack.rs` + 测试。
- sixdof_runtime 哈希源切换（行为兼容：哈希值改变属 run 身份升级，符合改参换 run 语义）。

## Non-Goals

- 不虚构实船参数（055 全 T 级，`model-fidelity: research-nominal`）。
- 不做 BEM/QTF/黏性校准（阶段 B，需离线求解与双人核对流程）。
- 不改前端界面呈现（随 #2147）。
