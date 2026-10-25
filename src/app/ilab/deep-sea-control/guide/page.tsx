import { LabDocument } from '../lab-document';
import { ILAB_STEPS } from '@/features/ilab/steps';

export const dynamic = 'force-dynamic';

export default function ExperimentGuidePage() {
  return (
    <LabDocument kicker="实验指导书" title="学生操作说明">
      <p>实验分四段：场景建模、系统分析、校正设计、拓展探究，共 24 步。中间是船舶场景，左侧是步骤，右侧填写本步记录并提交。</p>
      <p>航向船在场景里操舵。需要交采样的步骤，用右侧「写入航向采样」把固定步长模型的读数填进记录。海洋石油981的动力定位看平台位移，步骤 19 到 22 固定使用这艘平台的场景。</p>
      <p>控灵在步骤 8、12、16 给出提示。它只解释，不代填结论，也不改分数。步骤 23 的答辩反思记 0 分，等教师复核。步骤 18 只对照该船已经发布的航向允差，不和其他学生比名次。</p>
      <ol className="space-y-3">
        {ILAB_STEPS.map((step) => (
          <li key={step.seq}>
            <strong>{step.seq}. {step.title}</strong>
            <span className="text-slate-400"> · {step.stageName} · {step.minutes} 分钟 · 满分 {step.maxPoints}</span>
            <span className="block">{step.goal} {step.guidance}</span>
          </li>
        ))}
      </ol>
    </LabDocument>
  );
}
