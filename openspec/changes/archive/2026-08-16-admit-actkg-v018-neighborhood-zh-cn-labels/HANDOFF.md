# Handoff: admit-actkg-v018-neighborhood-zh-cn-labels

状态: **实现完成，未提交**  
日期: 2026-08-16  
工作树: `/Users/YW/.codex/worktrees/act-dev1`  
分支: `admit-actkg-v018-neighborhood-zh-cn-labels`（跟踪 `origin/integration`）

## 一句话

用户授权选项 1 后，25 条已审核短中文标签经 snapshot 绑定 overlay 进入解析器；正式 qualify CLI 写出真实 READY 密封报告。五个生产指针仍是 v0.9。不要认领 `#1412`，不要跑 `scripts/build.sh`。

## 密封资格

| 项 | 值 |
| --- | --- |
| 路径 | `course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json` |
| status | `READY` |
| blockers | `[]` |
| receiptDigest | `6b5393c5cabce980e70540142cd3dc56695319b9dc8782363faad9fefc258321` |
| 文件 sha256 | `1444318cc2a62b10bc1c5f358592da59d2c6706d0677c898c7bc54486c5cc3b1` |
| overlay sha256 | `41799cf9c45cbf0d3828991ba9baed217ae09b696c9a5d5f0d0da08afb520948` |
| 发布器 pin | `V018_SEALED_QUALIFICATION_SHA256` 已改到上述文件哈希 |
| 1909 行索引 | 未改写 |
| 生产指针 | 仍为 v0.9，冻结哈希一致 |

## Overlay 合并事实

密封索引对这 25 个 ID 不是“零行”：

- 7 条不安全 `canonical_preferred`：替换为已审核短中文
- 2 条不安全 alternative（`A/D转换器`、`G（s）=1/s²`）：省略，否则别名会把对象打成 unavailable
- 1 条安全 alternative（9581ae46）：保留
- 其余：补上缺失 preferred

分类器与 Formula pin 未改。

## 已验证

- overlay + shard-delivery：60/60
- qualify：4/4，`status=READY`，指针未动
- publish：5/5，pin 匹配，无 `qualification-not-ready`
- `openspec validate admit-actkg-v018-neighborhood-zh-cn-labels --type change --strict`
- `npm run typecheck`

## 不要做

- 不要手改密封 READY 报告
- 不要切换五个选择器或认领 `#1412`
- 不要把未跟踪的 `cutover/runtime-releases/`（旧 BLOCKED 发布回执）一并提交
- 不要在本 change 上跑镜像构建或远端部署

## 下一步

1. 用户明确说提交后再 commit / 开 PR。
2. `#1411` 镜像发布与 `#1412` 生产切换仍需单独授权。
