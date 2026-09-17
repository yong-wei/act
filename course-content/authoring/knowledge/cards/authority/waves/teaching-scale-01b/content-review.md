# 8张子批次独立内容审核

范围：inventory.cards的8张作者卡。角色course-pedagogy-reviewer，独立初审与限定整改复核。

## 裁决

3项P1均ACCEPT并修复：

1. 线性定常系统的输入输出叠加和时移限于零状态比较；非零初值需与输入共同组合。补充固定非零初值反例及联合叠加检查。
2. 对象入口扰动在非单位反馈下的误差通道为−HPS Du。补充H=2例，并从原信号方程在3个频率点独立求解。
3. 单位斜坡下区分E与sE；从原闭环式、多项式根和不可消原点极点验证，删除0==0占位测试。

## 结论

3项独立复核均已关闭，8张作者内容全部接受；本轮复核未发现新的P0/P1。最终hash固定在review-acceptance.json。验证354项混合检查，其中39项数值检查，236个公式及8张临时runtime解析通过。内容通过不替代实际运行态验收，后者见consumption-verification.json、http-verification.json及browser-verification.json。
