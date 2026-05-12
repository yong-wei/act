# 2026-03-24 Homebrew 安装 Octave 后 Qt 平台插件缺失

状态: active
最后更新: 2026-03-24
摘要: 记录一次本地 macOS + Homebrew 环境下安装 `octave` 后图形版无法启动的排障结论。根因不是 `octave` 主程序损坏，而是为绕开旧版整包 `qt` 与新版拆分公式的链接冲突而执行 `brew unlink qt` 后，`/opt/homebrew/share/qt/plugins/platforms` 未被 `qtbase` 补回，导致 `octave` 找不到 `libqcocoa.dylib`。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [../30-operations/00-index.md](../30-operations/00-index.md)
- [../70-workflows/20-debug-playbook.md](../70-workflows/20-debug-playbook.md)

## 结论

- `brew install octave` 在本机失败的第一层原因，是旧版整包 `qt 6.8.2_1` 与新版拆分公式 `qtsvg/qttools/qtdeclarative/... 6.10.2` 的 `brew link` 冲突
- 安装 `octave` 的最小处理方式是先 `brew unlink qt`，再重新执行 `brew install octave`
- 图形版 `octave` 随后报 `Could not find the Qt platform plugin "cocoa"`，根因不是动态库缺失，而是标准插件目录 `/opt/homebrew/share/qt/plugins/platforms` 缺失
- 当前稳定修复是创建符号链接：
  - `/opt/homebrew/share/qt/plugins/platforms -> /opt/homebrew/opt/qtbase/share/qt/plugins/platforms`
- 修复后，`octave` 无需再手动设置 `QT_QPA_PLATFORM_PLUGIN_PATH`；`octave-cli` 与 `control` 包也都可正常使用

## 关键事实

- `octave-cli` 在插件目录缺失时仍可运行，但图形版 `octave` 直接启动失败
- 失败报错稳定为：
  - `qt.qpa.plugin: Could not find the Qt platform plugin "cocoa" in ""`
- `brew linkage octave` 显示 `octave` 运行期依赖的是 `qtbase`、`qt5compat`、`qttools` 等拆分公式，而不是旧整包 `qt`
- 实际插件文件存在于：
  - `/opt/homebrew/opt/qtbase/share/qt/plugins/platforms/libqcocoa.dylib`
- 当时 `/opt/homebrew/share/qt/plugins` 目录下只剩 `designer`、`help`、`qmllint`、`qmlls`、`qmltooling` 等子目录，没有 `platforms`

## 证据

- `brew install octave` 失败时明确提示 `qtsvg` 与旧版 `qt` 的 symlink 冲突
- `brew unlink qt` 后，`brew install octave` 可完成，`octave-cli --version` 返回 `11.1.0`
- 图形版失败时，手动设置：
  - `QT_QPA_PLATFORM_PLUGIN_PATH=/opt/homebrew/Cellar/qtbase/6.10.2/share/qt/plugins/platforms octave ...`
  可立即恢复启动，说明问题集中在平台插件查找路径
- 建立标准路径 symlink 后，以下命令无需环境变量即可通过：
  - `octave --quiet --eval "disp('octave-gui-ok')"`
  - `octave --quiet --eval "disp(available_graphics_toolkits())"`
  - `octave --quiet --eval "pkg load control; disp(exist('tf')); disp(exist('step')); disp(exist('rlocus')); disp(exist('bode'));"`

## 已落地修复

- 清理了无进程占用的 `octave.formula.lock`
- 执行 `brew unlink qt` 让 `octave` 与 Qt 6.10.2 拆分依赖顺利完成安装
- 创建标准插件路径符号链接：

```bash
python3 - <<'PY'
from pathlib import Path
platforms = Path('/opt/homebrew/share/qt/plugins/platforms')
target = Path('/opt/homebrew/opt/qtbase/share/qt/plugins/platforms')
if not platforms.exists() and not platforms.is_symlink():
    platforms.symlink_to(target)
PY
```

## 后续提醒

- 若未来再次升级或重新 `link/unlink` Qt 相关公式，优先复查 `/opt/homebrew/share/qt/plugins/platforms` 是否仍指向 `qtbase`
- 若 `octave-cli` 正常但图形版失败，先不要重装 `octave`，先检查标准 Qt 插件目录是否缺失
- 若再次出现 `brew install octave` 与 `qt/qtsvg` 冲突，不要直接强制覆盖大范围 Qt 链接；优先沿用本次的“`brew unlink qt` + 补插件目录 symlink”最小方案
