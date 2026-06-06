# 根轨迹分支匹配与复绘流程

状态: active
最后更新: 2026-04-14
摘要: 记录 lesson 技能下根轨迹从 `Octave` 真值到 `Python/matplotlib` 复绘的统一流程，重点约束原始样本导出、通用分支匹配脚本调用、审计 JSON 检查，以及独立图与多联/四联图共用同一份匹配后分支数据的要求。
上游:
- [00-index.md](00-index.md)
- [35-lesson-content-review.md](35-lesson-content-review.md)
下游: []
相关:
- [/.agents/skills/lesson/SKILL.md](../../../.agents/skills/lesson/SKILL.md)
- [/.agents/skills/lesson/scripts/root_locus_branch_match.py](../../../.agents/skills/lesson/scripts/root_locus_branch_match.py)

## 结论

- lesson 技能下凡涉及根轨迹，若最终成图不是直接采用 `Octave rlocus()` 原生导出图，而是走“`Octave` 导出数据 + `Python/matplotlib` 复绘”，则必须调用通用脚本 `root_locus_branch_match.py`。
- 独立根轨迹图、局部放大插图、多联/四联图中的根轨迹子图，必须共用同一份匹配后分支 CSV 与同一次审计结果，只允许视图窗口不同，不允许各自再匹配一遍。
- 是否“轨迹完整、分支未串接、有限零点已覆盖”不再只靠人工目测，默认要读取脚本输出的审计 JSON。

## 标准顺序

1. 在 `Octave` 中优先使用 `rlocus()` 生成根轨迹真值，必要时只补充增益上界扩展和关键区间自适应加密，不手写整套替代计算。
2. 将原始根轨迹样本导出为 `sample_idx,gain,re,im` 格式 CSV；若能提供开环极点、开环零点，也同步导出 `re,im` 格式 CSV。
3. 调用：

```bash
python3 .agents/skills/lesson/scripts/root_locus_branch_match.py \
  --samples <raw-samples.csv> \
  --poles <open-loop-poles.csv> \
  --zeros <open-loop-zeros.csv> \
  --views-config <views.json> \
  --out-branches <matched-branches.csv> \
  --out-report <audit.json>
```

4. 在 `Python/matplotlib` 中只读取匹配后分支 CSV 出图，不再在课次脚本中临时重写分支重排逻辑。
5. 若一张图同时包含“全范围根轨迹”和“关键区域根轨迹”，或讲义与信息图共用同一根轨迹定义，则统一复用同一份匹配后 CSV，只通过 `views-config` 切换视图范围。

## 必查项

- `branch_count` 必须等于开环极点数。
- `finite_zero_coverage.all_matched_within_tolerance` 必须为 `true`。
- `jump_metrics` 若出现异常大跳变或异常符号翻转，先回查原始样本稀疏程度、增益上界和真值导出过程。
- 根轨迹图中开环极点与开环零点必须显式标出；若图中有局部放大图，主图与局部图的零极点定义必须一致。

## 已验证落地点

- `3-4` 已改为由 `generate_figures.m` 导出根轨迹原始样本，再由 `render_figures.py` 调用通用脚本生成：
  - `root_locus_points.csv`
  - `root_locus_audit.json`
  - `generalized_root_locus_points.csv`
  - `generalized_root_locus_audit.json`
- 该链路已覆盖独立根轨迹图与“主图 + 局部放大图”的共用数据场景，可作为后续课次复用模板。
