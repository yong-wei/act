# 远端访问与主机入口

状态: active
最后更新: 2026-03-17
摘要: 记录当前项目已确认的远端服务器访问入口与使用边界，供后续线上排查、日志核对和部署验证复用。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/00-index.md)
下游: []
相关:
- [10-deployment-topology.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/10-deployment-topology.md)
- [40-observability.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/40-observability.md)

## 结论

- 当前已确认一套可直接排查的远端生产环境入口：`root@121.40.124.135`
- 当前开发机已具备 SSH key 免密登录能力，可直接执行远端日志、进程、容器和数据库排查命令
- 当用户提到“服务器上的系统”或“线上环境”而未额外说明时，优先先核对这台主机，再确认是否存在其他环境

## 使用边界

- 该记录只保存访问入口与默认假设，不保存短期口令、临时隧道命令或一次性排障输出
- 若未来新增预发/测试/镜像机，应在本目录补充区分，不覆盖当前生产主机入口

## 当前已知事实

- 用户在 2026-03-17 会话中明确说明：今天上午 10:00 到 12:00 的 `L-2c` 访问发生在部署于远端服务器上的系统，而不是本地开发环境
- 用户明确说明：本机可通过 SSH key 免密登录 `root@121.40.124.135`
