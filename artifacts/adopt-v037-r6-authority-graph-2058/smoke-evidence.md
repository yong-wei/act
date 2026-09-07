# #2058 adopt-v037-r6-authority-graph 冒烟证据（2026-09-07，act-dev4）

## 浏览器（未登录壳层，localhost:3002）

- `/knowledge` 200：图谱壳、双语切换控件、目录/筛选/视图面板就绪（`browser-root-unauthenticated.png`）。
- API `api/knowledge/shards/active/*` 未登录正确 fail-closed（ACTIVE_GRAPH_UNAUTHORIZED）。
- 登录态像素冒烟受限（NextAuth Credentials + 生产库密码），未执行；作为残余风险记录。

## 服务端数据链（完整走运行时 loader/投影/资格代码，rtk tsx）

1. active identity：snap-b7c6992d / adc-7ab6a25f / overlay proj-3ec9c4a4
2. root 15 域呈现
3. system-modeling 概览 271 对象；teachingRelations 37 = teachingCoverage.relationCount 37（U6 账实一致；对比旧 root-locus「声称 1 实际 0」缺陷已消除）
4. 概览 177 对象携带治理别名（例：前向通路增益乘积 → 前向通路增益）
5. prerequisite-order 族分片 15 个；system-modeling 7 边 + 7 端点对象同交付（U1 闭包），direction 全部 source_to_target
6. resolveActiveLocaleQualification()：complete-locale、bilingualReady=true
7. en 投影：概览对象 en label 正常取值（uncovered 对象回退占位）

## 量化验收（对 ads-d9dfe50b 全量复核）

- U1：3150 条族关系 0 悬空（基线 ads-294a0616 为 2462 条受影响 / 80%）
- prerequisite：79 条唯一 DC-DC 边（= 上游 U2 发布量），跨 10 域呈现
- U6：15 域 teachingCoverage.relationCount 与最终 payload 全部一致
