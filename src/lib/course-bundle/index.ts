// CourseBundle 唯一公共入口（#1785）：运行时课程读取、会话绑定与
// 内容寻址 blob 全部由此导出；消费者不得从子路径或旧聚合器导入。
// server-only 守卫由 runtime-reads 自身携带（契约/类型可在测试中导入）。
export * from './contract';
export * from './capture';
export * from './session-binding';
export * from './session-reader';
export * from './blob-reader';
export * from './runtime-reads';
// 教材运行时读取（structured-textbook-runtime）同样经由唯一公共入口
// 暴露（#1785 spec：所有生产教材运行时读取经 CourseBundle public
// surface）；实现模块保留为内部 owner。
export * from '../structured-textbook-runtime';
