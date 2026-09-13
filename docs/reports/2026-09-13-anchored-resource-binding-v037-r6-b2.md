# 锚定资源绑定发布 v0.37-r6-b2

本地激活指针：`course-content/runtime/knowledge/resource-bindings/current.json`  
发布：`control-theory-engineering-v0.37-r6-b2`  
bindingHash：`d0cea740f6762f7281d309b572eefaafbb2abbcd815910398fa5e75e7fc2a13e`  
Authority：`ctr:release:control-theory-engineering-v0.37` / `snap-0253d66d…`  
对照旧 B′：`proj-228afa64…`（4117 资源 / 21633 绑定 / 单节点最大 361）

未 restage 密封 `consumer-activation`，未 publish / activate / deploy。

## 规模

| 项 | 数量 |
| --- | --- |
| 资源 | 2462 |
| 绑定 | 9433 |
| 覆盖 canonical | 3356 |
| 课次 | 31 |
| 首次 / 复现 / 参考 | 1000 / 1932 / 6501 |
| 锚点 step / heading / time / section / whole | 783 / 1363 / 786 / 4551 / 1950 |
| 单节点绑定 p50 / p90 / max | 1 / 4 / 210 |
| ≥50 / ≥100 绑定的节点 | 19 / 4 |

相对 b1：课程视频时间锚点 669 → 786，绑定 9316 → 9433。门禁通过（error 0，warning 19 条均为 intro-video 相对现网 release 的字节漂移）。

## 已排除

31 个课次入口 `act:lesson:*` 与 3 本全书级教材。规划与抽屉不再把课次总览页当作资源。

## 仍待人工复核

- crosswalk 49/220，171 个课程节点仍为 `unmapped`
- 19 个 intro-video 与现网 active runtime 字节不一致，未发时间锚点
- 讲义扇出仍高（`act:handout:3-3` 100 条），来自章节术语匹配，不是整课喷涂
