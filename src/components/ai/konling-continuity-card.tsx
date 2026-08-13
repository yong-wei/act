'use client';

import { useState } from 'react';
import type { KonlingContinuitySnapshot } from '@/lib/konling-learning-continuity';
import { Button } from '@/components/ui/button';

interface PracticeQuestion {
  id: string;
  text: string;
  options: Array<{ label: string; text: string }>;
}

export function KonlingContinuityCard(props: {
  snapshot: KonlingContinuitySnapshot;
  onDismiss: () => void;
  onReExplain: () => void;
  onGoalEntry: () => void;
}) {
  const { snapshot } = props;
  const [question, setQuestion] = useState<PracticeQuestion | null>(null);
  const [practiceStatus, setPracticeStatus] = useState<'idle' | 'loading' | 'unavailable' | 'failed' | 'submitting' | 'complete'>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function startReview() {
    if (!snapshot.recentMistake || (practiceStatus !== 'idle' && practiceStatus !== 'failed')) return;
    setPracticeStatus('loading');
    try {
      const response = await fetch('/api/assessment/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `konling-continuity:${snapshot.snapshotId}`,
          goalId: snapshot.recentMistake.knowledgeId,
          continuity: {
            origin: 'konling-companion-practice',
            snapshotId: snapshot.snapshotId,
            targetKnowledgeId: snapshot.recentMistake.knowledgeId,
            structuredCauseId: snapshot.recentMistake.structuredCauseId,
          },
        }),
      });
      if (!response.ok) {
        setPracticeStatus('unavailable');
        return;
      }
      const payload = await response.json() as { question?: PracticeQuestion };
      if (!payload.question) {
        setPracticeStatus('unavailable');
        return;
      }
      setQuestion(payload.question);
      setPracticeStatus('idle');
    } catch {
      setPracticeStatus('failed');
    }
  }

  async function submitReview(selectedOption: string) {
    if (!question || !snapshot.recentMistake || (practiceStatus !== 'idle' && practiceStatus !== 'failed')) return;
    setPracticeStatus('submitting');
    try {
      const response = await fetch('/api/assessment/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `konling-continuity:${snapshot.snapshotId}`,
          questionId: question.id,
          selectedOption,
          timeSpent: 0,
          continuity: {
            origin: 'konling-companion-practice',
            snapshotId: snapshot.snapshotId,
            targetKnowledgeId: snapshot.recentMistake.knowledgeId,
            structuredCauseId: snapshot.recentMistake.structuredCauseId,
          },
        }),
      });
      if (!response.ok) {
        setPracticeStatus('unavailable');
        return;
      }
      const result = await response.json() as { isCorrect?: boolean; recommendedFocus?: string[] };
      const instability = result.recommendedFocus?.[0];
      setFeedback(result.isCorrect
        ? `本题已正确${instability ? `；累计状态仍建议关注：${instability}` : '。单次正确不代表稳定掌握。'} 下一次可继续做一道陪伴练习。`
        : `本题尚未通过${instability ? `；仍需关注：${instability}` : '。'} 下一次可先重新讲解，再做陪伴练习。`);
      setPracticeStatus('complete');
    } catch {
      setPracticeStatus('failed');
    }
  }
  if (snapshot.state === 'unfinished_task' && snapshot.unfinishedTask) {
    return (
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4" data-konling-continuity-card={snapshot.state}>
        <p className="text-xs font-medium text-amber-300">继续上次学习</p>
        <h4 className="mt-1 text-sm font-semibold">{snapshot.unfinishedTask.title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">任务仍处于未完成状态。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" asChild><a href={snapshot.unfinishedTask.href}>继续学习</a></Button>
          <Button size="sm" variant="secondary" onClick={props.onReExplain}>重新讲解</Button>
          <Button size="sm" variant="ghost" onClick={props.onDismiss}>暂时跳过</Button>
        </div>
      </section>
    );
  }

  if (snapshot.state === 'recent_mistake' && snapshot.recentMistake) {
    return (
      <section className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4" data-konling-continuity-card={snapshot.state}>
        <p className="text-xs font-medium text-sky-300">复盘最近错题</p>
        <h4 className="mt-1 text-sm font-semibold">{snapshot.recentMistake.knowledgeLabel}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {snapshot.recentMistake.structuredCauseLabel
            ? `已有错因记录：${snapshot.recentMistake.structuredCauseLabel}`
            : '存在最近错题，但没有可引用的结构化错因。'}
        </p>
        {snapshot.feedback && (
          <div className="mt-3 rounded-lg border border-sky-500/20 bg-background/40 p-3 text-xs" data-konling-continuity-feedback>
            <p>{snapshot.feedback.message}</p>
            <p className="mt-1 font-medium">建议：{snapshot.feedback.nextAction}</p>
          </div>
        )}
        {question && practiceStatus !== 'complete' && (
          <div className="mt-3 space-y-2" data-konling-companion-practice>
            <p className="text-sm font-medium">{question.text}</p>
            <div className="grid gap-2">
              {question.options.map((option) => (
                <Button key={option.label} size="sm" variant="secondary" disabled={practiceStatus === 'submitting'} onClick={() => void submitReview(option.label)}>
                  {option.label}. {option.text}
                </Button>
              ))}
            </div>
          </div>
        )}
        {feedback && <p className="mt-3 text-xs" role="status">{feedback}</p>}
        {practiceStatus === 'unavailable' && <p className="mt-3 text-xs" role="alert">当前没有符合条件的正式检查题，可先选择重新讲解。</p>}
        {practiceStatus === 'failed' && <p className="mt-3 text-xs" role="alert">检查题请求失败，请重试或选择重新讲解。</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {!question && practiceStatus !== 'complete' && practiceStatus !== 'unavailable' && <Button size="sm" disabled={practiceStatus === 'loading'} onClick={() => void startReview()}>{practiceStatus === 'loading' ? '正在获取…' : practiceStatus === 'failed' ? '重新获取检查题' : '做一道检查题'}</Button>}
          <Button size="sm" variant="secondary" onClick={props.onReExplain}>重新讲解</Button>
          <Button size="sm" variant="ghost" onClick={props.onDismiss}>暂时跳过</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-muted/30 p-4" data-konling-continuity-card="cold_start">
      <p className="text-xs font-medium">从当前目标开始</p>
      <p className="mt-1 text-sm">目前没有可承接的学习记录。你现在想解决什么学习目标？</p>
      <Button className="mt-3" size="sm" onClick={props.onGoalEntry}>输入学习目标</Button>
    </section>
  );
}
