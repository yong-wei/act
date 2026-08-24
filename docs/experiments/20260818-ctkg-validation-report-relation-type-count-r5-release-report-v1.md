# CTKG validation-report relation_type_count r5 发布报告

## 发布结论

这是校验报告统计修复，不是知识语义变化。CTKG Schema 保持 0.3.0，Coverage
保持 v0.16，三个投影、label-index、metadata 与 crosswalk 字节不变。

source commit 为 `60b9000f44849fab4fcd6b8546c678ab49180461`，source tag 为
`control-theory-engineering-v0.22-source-r8`。r5 从已发布 r4 重放公开输入，只把
`validation-report.statistics.relation_type_count` 改成 act/domain/review
`links[].relation_type` 并集大小，并刷新 manifest、digest 与 `SHA256SUMS`。

r4 目录与 tag 保留且字节不变，状态为：

```text
NOT_ADMISSIBLE_FOR_VALIDATION_REPORT_RELATION_TYPE_COUNT
SUPERSEDED_BY_R5
```

这不否定 r4 的 runtime 绑定结论，只否定其校验报告谓词计数。

ACT 侧应继续激活 v0.18，按 r5 manifest Hash 做 shadow admission。本仓库未修改
ACT 适配器。

## 发布对象

| 角色 | 源 Bundle | 新 Bundle ID | relation_type_count | Bundle Digest |
| --- | --- | --- | ---: | --- |
| Aggregate | `control-theory-engineering-v0.22-r4` | `ctb:control-theory-engineering-v0.22:r5` | 9 | `98f2d5b183f9c0e632e3e020fe45111140f00b935450189edf0869375ef45854` |

三个投影谓词并集与 v0.18 相同：

`association`、`used_to_analyze`、`applies_to`、`is_a`、`has_formula`、
`derived_from`、`part_of`、`has_representation`、`has_component`。

其余报告成员数字与 r4 一致：`projection_links=2932`、`knowledge_nodes=7300`、
`rag_crosswalk_rows=13494`。

## 发布验证

- r5 双构建逐字节一致。
- `scripts/validate_current_public_bundle.py --full` 为 `PASS`。
- 导出验证器核对 `reported=9;expected=9`。
- 11 个语义工件相对 r4 字节未改。
- r4 目录相对 Git 字节未改。
- 未覆盖既有 r4 目录或 r4 tag。
