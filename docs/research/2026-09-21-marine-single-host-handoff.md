# M5海洋四路线系列：登记与实施接续

日期：2026-09-21。父项：[#2129](https://github.com/yong-wei/act/issues/2129)。
设计提交：`b2bf0ae2e015861a185bb2ec145cd3c4f137e0df`，基于 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。
[范围与测量方法裁决](2026-09-21-marine-single-host-comparison.md)。

本文件仅登记协调交接，不复制实现计划；proposal/design/tasks/spec delta是实现真源。GitHub原生关系是后续调度真源。

## 已创建唯一映射

| Issue | change_id |
| --- | --- |
| #2130 | repair-marine-comparison-foundation |
| #2131 | complete-marine-webgl-spectral-ocean |
| #2132 | complete-marine-shared-water-optics |
| #2133 | complete-marine-scene-response-quality |
| #2134 | implement-marine-webgpu-parity |
| #2135 | instrument-marine-stage-performance |
| #2136 | automate-marine-visual-validation |
| #2137 | automate-m5-marine-route-benchmark |

子项均有一个轻量Buddy change_id标记与type:change。父项type:series-parent/status:tracking，不是实现任务。未claim、未改实现、未部署。

## 本轮验证与限制

已读取本机实测报告及当前代码/规范；沿原版Buddy driver执行入口、facts explore、八项propose，均返回HANDOFF。原脚本与Git blob SHA一致：driver `2e30320d443b6010c0e710d179dc38d2467d03c0`，check-config `40f343d64c5b55362438a97f29d84e9ca669644d`，load-config `70e3273a252d4287c6e681b6f7c044feab0d6e1b`。没有修改个人技能。

44个提案/研究文件做了结构、必需标题、scenario语法和技术前提无环检查；所有tasks未勾选。容器没有OpenSpec CLI，离线安装1.13.0返回ENOTCACHED，因此**未运行CLI strict**。连接器没有原生父子/blockedBy写入动作。不要把HANDOFF/结构检查或Issue文本当成已完成strict/原生关系登记。

八项暂不标status:ready。本机代理可一次性完成下列登记，不需要用户补设备或再次解释任务。

## 最小登记

先读取最新integration与当前个人Buddy技能，执行其propose入口。保持既有Issue映射，不重新创建同名change或Issue；不在登记阶段实施。

仅对上述八项运行项目既有固定OpenSpec CLI：

```bash
changes=(
  repair-marine-comparison-foundation
  complete-marine-webgl-spectral-ocean
  complete-marine-shared-water-optics
  complete-marine-scene-response-quality
  implement-marine-webgpu-parity
  instrument-marine-stage-performance
  automate-marine-visual-validation
  automate-m5-marine-route-benchmark
)
for change in "${changes[@]}"; do
  openspec validate "$change" --type change --strict || exit 1
done
```

校验失败只修本批提案，按技能提交到base branch，不扩大到全仓历史规范或Runtime导出。随后读取GitHub当前原生关系，**仅写缺失边**；以下是一次性待登记申请，不是长期依赖镜像：

- #2131被#2130阻塞。
- #2132被#2131阻塞。
- #2133被#2130阻塞。
- #2134被#2132和#2133阻塞。
- #2135、#2136分别被#2130阻塞。
- #2137被#2134、#2135和#2136阻塞。

共10条依赖、8条父子边；#2130无本系列前提。使用已有helpers，不手写另一套调度器：

```bash
skill_dir="$(realpath .agents/skills/openspec-buddy)"
# 先确认缺失；已存在的关系不要重写。
for child in 2130 2131 2132 2133 2134 2135 2136 2137; do
  "$skill_dir/scripts/link-issue-parent.sh" 2129 "$child"
done
"$skill_dir/scripts/link-issue-dependencies.sh" \
  2131 2130 \
  2132 2131 \
  2133 2130 \
  2134 2132 \
  2134 2133 \
  2135 2130 \
  2136 2130 \
  2137 2134 \
  2137 2135 \
  2137 2136
"$skill_dir/scripts/verify-issue-relationships.sh" --require-parent \
  2129 2130 2131 2132 2133 2134 2135 2136 2137
```

按当前技能回读Issue和关系，检索open+closed确认唯一映射后给执行项加status:ready。ready不表示前提已完成，领取由blockedBy决定。以上helper命令须按实际缺失关系选择执行，不盲目整段重跑。

## 实施顺序与完成口径

#2130完成后，#2131谱海洋、#2133动态品质、#2135测量、#2136自动检查可以并行；#2131后接#2132共同光学；#2132/#2133后接#2134原生WebGPU；最后#2137在M5实际运行完整四组合。

#2135先在实际已有路径测成本并验证计时后端，#2136先在实际WebGL消费者上运行检查，不能只交接口。四组合最终报告由#2137汇合，避免把测试工作全部拖到最后。

本轮范围明确替代旧系列的低端/移动真机必要门槛：只需现有M5及本机可自动化浏览器；模拟条件标模拟，未测硬件标外部覆盖限制。核心四路线、完整效果和实际本机数值/图像/成本验证不能省略。缺计时扩展自动降级测量，缺实现不能伪装不支持。未实现命令、未运行测试、空数据或keep-current-path不得作为完成。

旧系列#2096/#2115–#2121保留历史成果；本系列承担新深度和改进后的单机验收。生产默认、评分和资产发布链不自动改变。
