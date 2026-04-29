import { CheckCircle2, Lock } from 'lucide-react';

export function SubmissionStatus({
  submitted,
  submittedText = '提交成功，已锁定本次作答。',
  idleText = '提交后会同步到教师端汇总。',
  showLock = true,
}: {
  submitted: boolean;
  submittedText?: string;
  idleText?: string;
  showLock?: boolean;
}) {
  if (submitted) {
    return (
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span>{submittedText}</span>
        {showLock ? <Lock className="ml-1 h-4 w-4" /> : null}
      </div>
    );
  }

  return <div className="premium-lesson-muted mt-4 text-sm">{idleText}</div>;
}
