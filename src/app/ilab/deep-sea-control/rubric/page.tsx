import { LabDocument } from '../lab-document';

export const dynamic = 'force-dynamic';

const ROWS = [
  ['工程伦理判断', '步骤 21、22', '故障后是否选择与现象相符的处置，残余偏差是否落在该船告警读数内。'],
  ['证据化表达', '步骤 7、12、24', '采样、稳定结论和报告是否能回指自己的记录，而不是只写结论。'],
  ['多目标权衡', '步骤 16', '航向误差是否进入允差，同时操舵或推力强度是否留在可用范围。'],
  ['团队协作', '步骤 23', '答辩反思是否写清本组分工和互评要核对的记录。教师分数另计。'],
];

export default function RubricPage() {
  return (
    <LabDocument kicker="四维量规" title="过程评价细则">
      <p>操作分由各步自动计算。下面四维用于教师评价报告，不替代步骤分数，也不生成学生名次。</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-400"><th className="py-2 pr-3">维度</th><th className="py-2 pr-3">主要步骤</th><th className="py-2">看什么</th></tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row[0]} className="border-t border-slate-800 align-top">
              <td className="py-2 pr-3">{row[0]}</td>
              <td className="py-2 pr-3">{row[1]}</td>
              <td className="py-2">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </LabDocument>
  );
}
