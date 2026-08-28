# 隔离 static ESA Delivery PoC

本工具验收 `static.adapt-learn.online` 上的单对象 PoC。它不改 ACT 应用 URL、Runtime selector、主域 DNS 或 `act-course-assets`。没有 owner 对 ESA 服务角色读范围的明确接受时，资格保持 `blocked`，不得授权 origin，也不得改 DNS。

## 固定身份

| 项 | 值 |
| --- | --- |
| 主机名 | `static.adapt-learn.online` |
| Delivery Bucket | `act-course-delivery`（禁止 `act-course-assets`） |
| 对象 | `assets/<lowercase-sha256>/destroyer.glb` |
| 默认源 | `public/assets/models-opt/destroyer.glb` |
| 缓存规则 | `/assets/*`，PoC TTL 30 天 |
| CORS | `https://act.adapt-learn.online` 的 GET/HEAD |
| 最后一步 | 只改 `static` CNAME，且目标必须是 ESA 分配的 `*.w.kunlunsl.com` 等官方 CNAME |
| 日志 | `logs.json` 只收访问/回源是否存在、指纹、观测时间和是否命中预期边缘/Delivery Bucket |

PoC 对象不得被 ACT 代码引用。私有 origin 授权不是浏览者鉴权。

## 命令

```bash
npm run esa-delivery:inventory
npm run esa-delivery:plan-object
npm run esa-delivery:preflight
npm run esa-delivery:qualify -- --input-dir <receipt-dir>
```

`--input-dir` 可放 `service-role.json`、`object.json`、`dns.json`、`transport.json`、`isolation.json`、`cost.json`、`logs.json`。缺项不会静默当成功。本地 `plan-object` 只有源哈希，不是上传收据；`etagFingerprint` 为空时保持 `incomplete`。默认写入 `docs/operations/static-esa-delivery/observations/<qualificationId>/`；已存在则失败关闭。Git dirty 与 commit/tree 漂移以探测结果为准。

## 操作顺序

1. 记录当前 `static` DNS/TTL、ESA 站点/套餐/配额、证书、Bucket、origin、缓存/Range/CORS 与回滚值。仓库只收脱敏 receipt。
2. 解析 ESA 服务角色与有效 OSS 读范围，写入 `policyIdentity`（策略 sha256）。范围未知或 owner 未接受则停止。
3. 创建或核对私有 `act-course-delivery`，禁止把 ESA 授权到 Runtime Authority Bucket。
4. 配置 CNAME 模式站点、精确主机名、OSS 私有 origin、证书、`/assets/*`、Range、CORS。
5. 条件复制一个权利清晰的公开 `destroyer.glb`。已有对象字节不一致则失败且不覆盖。
6. 非 DNS 检查全部通过后，才把 `static` 指向 ESA 分配的 CNAME。根域和 `act.adapt-learn.online` 不动。
7. 验收 HTTPS、对象哈希、`206`/`Content-Range`、MISS→HIT、CORS、负向路径、ESA 访问/回源日志、OSS `CdnOut`/`NetworkOut`、ESA 用量。把费用写成记账转移，不得写成免费。
8. 失败时只恢复或删除 `static` CNAME。站点、Bucket、不可变对象、先前 DNS 证据与日志保留到审计窗口结束。

## 资格

- `qualified`：角色已接受、远端对象带 ETag、只改了 static DNS 且 CNAME 等于 ESA 分配目标、请求 Range 与 `Content-Range` 一致、传输/隔离/访问与回源日志/两个计费面都证明。
- `incomplete`：证据缺失、账单 delayed、本地对象计划无 ETag、或 DNS 尚未观测到 ESA 分配目标。
- `blocked`：dirty/mixed worktree、Authority origin、未接受角色、覆盖对象、DNS 越界、非 ESA CNAME、隔离失败、日志与边缘/origin 不符，或拦截型 DNS 观测被当成已切换。

当前基线见 `docs/operations/static-esa-delivery/baseline/`。它冻结主机名、Bucket 与本地对象身份；生产 ESA/角色/传输/计费尚未提供时不得把 PoC 写成已合格。
