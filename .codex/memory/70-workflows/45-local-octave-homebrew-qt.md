# 本地 Homebrew Octave 与 Qt 插件修复流程

状态: active
最后更新: 2026-03-24
摘要: 记录在本地 macOS + Homebrew 环境下安装或修复 `octave` 时的最小执行闭环，重点覆盖 `brew install octave` 与旧整包 `qt` 的链接冲突，以及图形版 `octave` 缺少 `cocoa` 平台插件时的稳定修复步骤。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [../60-incidents/2026-03-24-homebrew-octave-qt-plugin.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-24-homebrew-octave-qt-plugin.md)
- [../30-operations/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/00-index.md)

## 适用场景

- 需要在本机安装 `octave`
- `brew install octave` 因 Qt 相关公式冲突失败
- `octave-cli` 正常、但图形版 `octave` 报 `Could not find the Qt platform plugin "cocoa"`

## 最小执行闭环

1. 先确认当前状态
   - `which octave`
   - `octave --quiet --eval "disp('probe')"`
   - `octave-cli --version | head -n 1`
2. 若 Homebrew 遗留无进程占用的 `octave.formula.lock`，先清理锁文件
3. 若 `brew install octave` 报 `qtsvg` 或其他 Qt 拆分公式与旧整包 `qt` 的 symlink 冲突，先执行 `brew unlink qt`
4. 重新执行 `brew install octave`
5. 若图形版 `octave` 报 `Qt platform plugin "cocoa"` 缺失，检查：
   - `/opt/homebrew/share/qt/plugins/platforms`
   - `/opt/homebrew/opt/qtbase/share/qt/plugins/platforms/libqcocoa.dylib`
6. 若标准插件目录缺失，则补符号链接：

```bash
python3 - <<'PY'
from pathlib import Path
platforms = Path('/opt/homebrew/share/qt/plugins/platforms')
target = Path('/opt/homebrew/opt/qtbase/share/qt/plugins/platforms')
if not platforms.exists() and not platforms.is_symlink():
    platforms.symlink_to(target)
PY
```

7. 重新验证图形版与控制包：
   - `octave --quiet --eval "disp(available_graphics_toolkits())"`
   - `octave --quiet --eval "pkg load control; disp(exist('tf')); disp(exist('step')); disp(exist('rlocus')); disp(exist('bode'));"`

## 当前稳定结论

- 当前本机的稳定状态是：
  - 旧整包 `qt` 保持 `unlink`
  - `octave` 由 Qt 6.10.2 拆分公式链提供运行时依赖
  - `/opt/homebrew/share/qt/plugins/platforms` 指向 `/opt/homebrew/opt/qtbase/share/qt/plugins/platforms`
- 在这组状态下，`octave` 无需额外设置 `QT_QPA_PLATFORM_PLUGIN_PATH`

## 不推荐的做法

- 不要先对整套 Qt 执行大范围 `brew link --overwrite`
- 不要在未确认根因前直接重装 `octave`
- 不要因为 `octave-cli` 可用就忽略图形版缺陷；如果需要出图，仍应补齐标准插件路径
