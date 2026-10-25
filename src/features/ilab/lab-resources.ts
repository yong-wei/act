export interface IlabResourceLink {
  title: string;
  href: string;
  note: string;
}

/** 申报知识库勾选项，加上本平台已经有、学生能从实验入口打开的资源。操作视频未列入。 */
export const ILAB_RESOURCE_LINKS: IlabResourceLink[] = [
  { title: '实验指导书', href: '/ilab/deep-sea-control/guide', note: '24 步怎么做、记录什么' },
  { title: '教学指导书', href: '/ilab/deep-sea-control/teaching-guide', note: '教师组织与复核' },
  { title: '实验任务书', href: '/ilab/deep-sea-control/task', note: '进入实验前的任务' },
  { title: '四维量规', href: '/ilab/deep-sea-control/rubric', note: '伦理、证据、权衡、协作' },
  { title: '预习', href: '/ilab/deep-sea-control/pretest', note: '预习成绩' },
  { title: '测试卷', href: '/ilab/deep-sea-control/paper', note: '阶段测验' },
  { title: '习题库', href: '/assessment/adaptive-practice', note: '平台已有练习' },
  { title: '电子教材', href: '/textbooks/hu-shousong-auto-control-8th/第八版/chapter-chapter-01', note: '自动控制原理教材' },
  { title: '课程教案', href: '/interactive-learning/courses', note: '平台课程' },
  { title: '课件与知识点', href: '/interactive-learning/chapter-components', note: '章节组件' },
  { title: '控制工作台', href: '/interactive-learning/control-workbench', note: '校正与频域工具' },
  { title: '知识图谱', href: '/knowledge', note: '选中节点后可问控灵' },
  { title: '船舶案例', href: '/simulations', note: '各船型仿真' },
  { title: '竞技场', href: '/arena', note: '另开挑战，不计入本实验排名' },
];
