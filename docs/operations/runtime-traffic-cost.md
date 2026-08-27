# Runtime 流量与 OSS 成本观测

本工具只做只读归因。它不改 DNS、Bucket、IAM、路由、发布、selector 或生产状态。OSS、ESA、Nginx、Publisher 与开发机挂载各自平衡，不把跨供应商边界加总成一个流量数字。

## 分母

冻结的路线类见 `src/lib/runtime-traffic-cost/taxonomy.ts`：

| routeClass | owner |
| --- | --- |
| public-assets | `public/assets` |
| course-runtime | `src/app/course-runtime/[...assetPath]/route.ts` |
| runtime-media-redirect | `src/app/api/course-runtime/assets/[...assetPath]/route.ts` |
| runtime-blob-view | `scripts/runtime-release` |
| runtime-blob-public-read | `scripts/runtime-release/developer-oss` |
| publisher-public-upload | publisher bridge PutObject |
| publisher-metadata-check | publisher bridge HeadObject |
| publisher-legacy-body-readback | publisher bridge legacy GetObject |

每个 source ledger 必须让 `observed + excluded + duplicate + delayed + unattributed` 等于自己的 denominator。无法归因的字节留在 `unattributed`。

## 采集

原始 OSS/ESA 导出与 access log 留在操作者控制的位置。仓库只收允许的聚合 receipt。

```bash
npm run traffic-cost:inventory
npm run traffic-cost:observe -- --input-dir <export-dir> --output-dir docs/operations/runtime-traffic-cost/baseline
```

`--input-dir` 下每个 `*.json` 必须是 `act-runtime-traffic-source-export/v1`。缺源、混窗口、未知时区或无法证明的 schema 会让观测为 `incomplete` 或 `blocked`，不会静默消失。

## 隐私

receipt 不得包含凭据、Authorization、签名查询、用户标识、客户端 IP 或本机绝对路径。归一化遇到受保护字段会在写仓库工件前失败。

## 资格

- `qualified`：五个源都覆盖同一 window/timezone，ledger 平衡且无冲突。
- `incomplete`：声明源或 window 缺失、或仅有 delayed/missing 证据。
- `blocked`：dirty/mixed worktree、taxonomy 冲突、重复 source 文件或不平衡。

迟到的账单必须写成新的 observation revision，不得改写历史 receipt。

当前基线见 `docs/operations/runtime-traffic-cost/baseline/`。它冻结了路线分母，但生产 OSS/ESA/Nginx 导出尚未提供，因此状态为 `incomplete`。后续 ESA 与开发机缓存对比使用新的不可变 revision。
