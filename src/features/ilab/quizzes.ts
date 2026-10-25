export interface IlabQuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
}

export const ILAB_PRETEST: IlabQuizQuestion[] = [
  { id: 'kt', prompt: '一阶航向模型里，K 和 T 分别表示什么？', choices: ['K 是回转性指数，T 是追随性指数', 'K 是排水量，T 是船长', 'K 是相位裕度，T 是调节时间'], answer: 0 },
  { id: 'pole', prompt: 'T 取正值时，开环转艏极点在哪里？', choices: ['在 -1/T，开环转艏模态稳定', '在右半平面，必然不稳定', '与 T 无关'], answer: 0 },
  { id: 'overshoot', prompt: '超调量用来描述什么？', choices: ['阶跃响应超出目标的程度', '舵角的机械上限', '海况等级'], answer: 0 },
  { id: 'nyquist', prompt: '闭环稳定时，奈奎斯特曲线与负一实点通常是什么关系？', choices: ['不包围负一实点', '必须包围负一实点', '与稳定性无关'], answer: 0 },
  { id: 'safe', prompt: '海洋石油981紧急解脱核对的残余偏差上限是多少？', choices: ['10 米', '1 米', '50 米'], answer: 0 },
];

export const ILAB_PAPER: IlabQuizQuestion[] = [
  { id: 'pid', prompt: '比例增益过大时，航向闭环常见的现象是？', choices: ['振荡甚至失稳', '响应一定变慢且没有超调', '船停止不动'], answer: 0 },
  { id: 'margin', prompt: '本实验接受的相位裕度大致范围是？', choices: ['30 度到 80 度', '0 度到 5 度', '180 度以上'], answer: 0 },
  { id: 'dp', prompt: '动力定位步骤对照的是哪一艘平台的读数？', choices: ['海洋石油981', '055 型驱逐舰的舵角', '任意学生的平均误差'], answer: 0 },
  { id: 'rank', prompt: '步骤 18 的分数依据是什么？', choices: ['该船已经发布的航向允差', '其他学生的名次', '教师临时排名'], answer: 0 },
  { id: 'review', prompt: '步骤 23 提交答辩反思后，实验空间里的这一步分数是？', choices: ['0 分，等待教师复核', '自动满分', '取互评平均分立即写入'], answer: 0 },
];

export function scoreQuiz(questions: IlabQuizQuestion[], picks: Record<string, number>): { score: number; total: number; note: string } {
  const total = questions.length;
  const score = questions.filter((question) => picks[question.id] === question.answer).length;
  const note = `${score}/${total}`;
  return { score, total, note };
}
