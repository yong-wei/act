# simulation-model-parameter-pack Specification

## ADDED Requirements

### Requirement: 参数包结构化与来源分级

每船物理参数 MUST 以结构化参数包交付（provenance/geometry/maneuvering/actuators/manifest），每个参数 MUST 标注 P/B/D/T 来源等级、SI 单位与来源（URL/DOI 或内部迁移记录）及不确定范围；manifest MUST 含模型版本与参数包内容哈希。

#### Scenario: 参数可追溯

- **WHEN** 检查参数包任一数值参数
- **THEN** provenance 中存在该参数的等级、单位、来源与不确定范围

### Requirement: 物理一致性门禁

参数包加载 MUST fail-closed 校验：质量与静水排水体积闭合（相对误差 <1e-3，或显式标注真实加载状态）；惯量以 kg·m² 记录且各轴回转半径落在 [0.15Lpp, 0.35Lpp]（拒绝把回转半径值误写为惯量）；总吨/载重吨 MUST NOT 作为排水质量来源；Lpp MUST NOT 大于 LOA。校验失败的包 MUST NOT 进入运行时。

#### Scenario: 惯量错写检出

- **WHEN** 包内惯量值为 k·m·Lpp² 量级（回转半径 ≈ 0.5·Lpp）
- **THEN** 加载器拒绝该包并报告回转半径越界

#### Scenario: GT 冒充排水质量检出

- **WHEN** 质量来源标注为总吨容积换算
- **THEN** schema 层拒绝（mass_basis 枚举无该项）

### Requirement: 运行时哈希联动

运行时 run manifest 的参数包哈希 MUST 由参数包内容计算（含模型版本），参数包任何数值变化 MUST 产生新哈希从而新 run 身份；同字节包 MUST 跨平台产生同一哈希。

#### Scenario: 改包换身份

- **WHEN** 参数包任一数值修改后重新运行
- **THEN** parameterBundleHash 改变且 manifestReset 为 true
