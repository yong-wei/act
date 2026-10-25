import { ILAB_PAPER } from '@/features/ilab/quizzes';

import { LabDocument } from '../lab-document';
import { QuizClient } from '../quiz-client';

export const dynamic = 'force-dynamic';

export default function PaperPage() {
  return (
    <LabDocument kicker="测试卷" title="四阶段测验">
      <p>可以在实验过程中或结束前完成。分数写入实验报告，不改变 24 步的操作分。</p>
      <QuizClient storageKey="ilab-deep-sea-paper" questions={ILAB_PAPER} />
    </LabDocument>
  );
}
