## Why

浅色主题用户在冷启动、硬刷新、登录成功跳转和退出登录跳转等新文档渲染场景中，会先看到服务端固定的夜间首帧，再被客户端改成浅色，形成明显闪烁。提交 `c871d4c0b` 删除了水合前 `theme-init` 脚本，只留下 `useLayoutEffect`，无法阻止首次绘制。

## What Changes

- 恢复带安全约束的水合前主题初始化：在首次绘制前读取 `ai-obe-theme` 与系统偏好，同步设置根节点唯一主题 class 与 `style.colorScheme`。
- 让 `ThemeProvider` 在水合后继续以同一解析规则对齐根节点，且不得用 SSR 默认夜间主题覆盖已保存的浅色偏好。
- 补充主题初始化单元/源代码契约测试，并覆盖登录成功跳转与退出登录跳转的浏览器级回归。
- 不改登录、退出登录或既有页面导航行为；不引入 Cookie/SSR 主题；不用隐藏整页、延迟正文或全屏遮罩掩盖闪烁。

## Capabilities

### New Capabilities

- `theme-first-frame-initialization`: 文档首次绘制前的主题解析、根节点 class/`color-scheme` 对齐，以及登录/退出等新文档导航下的首帧一致性。

### Modified Capabilities

- `react-doctor-security-surface-safety`: 恢复并收紧根布局水合前主题脚本的允许清单，禁止用删掉 `#theme-init` 来“消除” React Doctor 警告。

## Impact

- `src/app/layout.tsx`、`src/lib/theme-config.ts`、`src/components/providers/theme-provider.tsx`
- `scripts/tests/test-theme-toggle.ts`、`tests/theme-init-script.spec.ts`，以及登录/退出路径的浏览器回归
- 所有走根布局的页面首帧；不改主题存储键、默认主题或认证流程
