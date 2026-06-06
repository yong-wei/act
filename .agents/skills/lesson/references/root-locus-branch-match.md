# 根轨迹分支匹配脚本约定

`root_locus_branch_match.py` 用于把 Octave `rlocus()` 导出的闭环极点样本整理为连续分支，并输出审计报告。

## 输入

- `--samples`：CSV，推荐长表头 `sample_idx,gain,re,im`。
- `--poles`：开环极点 CSV，表头 `re,im` 或 `real,imag`。
- `--zeros`：开环零点 CSV，表头 `re,im` 或 `real,imag`。

## 输出

- `--out-branches`：匹配后的分支 CSV。
- `--out-report`：JSON 审计报告，包含分支数、样本数、开环极点/零点数量和起点误差。

## 使用约束

根轨迹源数据必须来自 Octave/control 包的 `rlocus(sys)` 自动采样结果。Python 侧只负责分支连续匹配、审计与最终排版，不替代 Octave 的根轨迹计算主流程。
