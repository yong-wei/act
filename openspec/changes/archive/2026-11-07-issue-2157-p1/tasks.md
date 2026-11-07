# Tasks: issue-2157-p1（阶段 A）

- [x] A1 参数包 schema 与 055/v1 五文件（provenance/geometry/maneuvering/actuators/manifest），全参数 P/B/D/T 标注
- [x] A2 `sixdof/model_pack.rs` 加载器：反序列化 + 规范化哈希 + 质量体积闭合 + 惯量回转半径界 + mass_basis 枚举 + Lpp/LOA 分立校验
- [x] A3 DestroyerSixDofConfig::from_model_pack（参数单一真源迁移；Default 委托包加载）
- [x] A4 sixdof_runtime parameterBundleHash 接参数包哈希（含版本）
- [x] A5 测试：加载/哈希稳定/闭合断言/惯量错写检出（0.25mL² 拒绝）/GT 冒充排水质量拒绝/runtime 哈希一致
- [x] A6 cargo 全绿 + wasm + typecheck + strict validate
