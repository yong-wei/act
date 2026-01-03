# chrome-devtools MCP 启动失败排查与修复记录

## 现象
- 启动 Codex 时提示：MCP client for `chrome-devtools` failed to start
- 伴随报错：handshaking with MCP server failed / connection closed / initialize response

## 结论（根因）
在 `~/.codex/log/codex-tui.log` 中发现，`chrome-devtools-mcp` 由 npx 自动安装时反复出现：
- `npm error ENOTEMPTY: directory not empty, rename .../node_modules/chrome-devtools-mcp -> .../.chrome-devtools-mcp-XXXX`
说明 npx 缓存目录 `_npx` 中的残留导致重命名失败，MCP 服务未能完成启动，最终在握手阶段断开连接。

## 已执行修复
- 将残留目录改名备份（保守处理，避免误删）：
  - 目标：`~/.npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp`
  - 改名为：`chrome-devtools-mcp.bak-<timestamp>`

## 建议的后续验证
1. 重新启动 Codex，确认 `chrome-devtools` MCP 正常上线。
2. 若仍失败，可进一步清理 npx 缓存：
   - `npm cache clean --force`

## 参考日志位置
- `~/.codex/log/codex-tui.log`

