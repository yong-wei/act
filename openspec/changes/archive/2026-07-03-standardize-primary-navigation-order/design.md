## Design Notes

The implementation should not create another route list. The canonical order should live in the central platform navigation layer and be consumed by homepage entry mapping, AppShell rail rendering, route inventory tests, and account/profile entry resolution.

The existing collapsed rail is product-correct: collapsed shows icons, expanded shows text. The change should keep that interaction and focus on order, labels, active state, accessible names, and parity across viewport breakpoints.

The canonical student-facing order is:

1. 首页
2. 知识资源
3. 互动学习
4. 学习路径
5. 竞技场
6. 虚拟仿真
7. 控制工作台
8. 个人中心

`个人中心` is part of the first-level account/learner-record reachability order, not a core product module. Homepage top navigation remains a public-entry variant and should omit 首页 and 个人中心 from the center links, but it must still use the same destination metadata and relative order.

Teacher and administrator local operation tabs are not removed in this change. They should be classified as secondary navigation and checked so they cannot replace or reorder the global first-level route family.
