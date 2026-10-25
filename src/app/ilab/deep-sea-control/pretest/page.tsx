import { ILAB_PRETEST } from '@/features/ilab/quizzes';

import { LabDocument } from '../lab-document';
import { QuizClient } from '../quiz-client';

export const dynamic = 'force-dynamic';

export default function PretestPage() {
  return (
    <LabDocument kicker="预习成绩" title="实验前预习">
      <p>共 5 题。提交后分数保存在本次浏览器会话，生成实验报告时写入预习一节。</p>
      <QuizClient storageKey="ilab-deep-sea-pretest" questions={ILAB_PRETEST} />
    </LabDocument>
  );
}
