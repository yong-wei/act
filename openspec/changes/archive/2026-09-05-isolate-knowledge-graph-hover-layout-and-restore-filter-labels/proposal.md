## Why

新旧图谱共用 Force Graph 运行时。鼠标划过节点会把 hover 算进相机拟合并放大标签包围盒，整页看起来在自动缩放；力导向在首屏沉降后仍可被拖拽重新加热，松手会解开其他节点。新版关系过滤在顶栏面板，而不是旧版左下角标签；远景普通标签被字号闸藏掉；抽屉公式带无用的「复制公式」。

## What Changes

- Hover 可以单独放大被划过的节点字形；**画布相机、缩放和其他节点坐标 MUST 不受 hover 影响**。
- 力导向只在页面初始化（及显式 reflow / 新范围到达）时调整；沉降后钉死。用户拖动只移动被拖节点，不得牵动其他节点。
- 新版关系过滤完全改用旧版左下角标签方式；新旧版过滤标签都放到画布最左下角。
- 标签常显示；为性能设最大可见数，优先画面中心（选中/hover 仍优先）。
- 删除图谱抽屉与公式块上的「复制公式」「复制全文」产品按钮；保留无障碍 LaTeX，不提供可见复制控件。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `active-authority-legacy-force-runtime`：沉降后普通节点不再保持热力所有权；拖动隔离改为只钉被拖节点。
- `active-authority-semantic-graph-presentation`：hover 不得改 viewport；标签常显示加中心预算；去掉可见复制公式动作。
- `layered-authority-domain-workspace`：关系过滤改为旧版左下角标签，不再占用顶栏专用筛选面板。

## Impact

影响 `knowledge-graph-2d.tsx`、`knowledge-graph-canvas.tsx`、`viewport-fit.ts`、`label-policy.ts`、`layout-engine.ts`、`relation-family-control.tsx`、`active-authority-filter-panel.tsx`、`governed-rich-text.tsx` 及对应测试。不改 shard 数据、Teaching Projection 或生产 selector。
