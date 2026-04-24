'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  buildPerCardSubmissionAnswers,
  mergeSavedAnswersIntoDraft,
} from '@/features/interactive/shared/per-card-response-utils';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type {
  StudentInteractiveActivityRegistry,
  TeacherInteractiveActivityRegistry,
  InteractiveRuntimeStepManifest,
} from './interactive-manifest-renderer';

export interface ManifestStepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

type TeacherResponseItem = {
  studentName: string;
  response: ManifestStepResponse;
};

const REFERENCE_ANSWERS: Record<string, string> = {
  'task-change-card': '至少还包括任务语义、参考轨迹、动作筛选线和优先判断的变化。',
  'boundary-split-card': '峰值动作回答瞬时越界，控制能量回答持续动作代价，两者不能互相替代。',
  'trajectory-duty-card': '航迹偏离直接回答“船是否真正走到位”。',
  'action-duty-card': '峰值动作裁决执行机构瞬时边界，控制能量裁决持续动作代价。',
  'structure-first-card': '必须先根据 z0 判结构编号，再解释有效槽位。',
  'active-slots-card': '不同结构只启用部分槽位，忽略槽位不能被解释成真实参数。',
  'boundary-task': '总代价更低只说明目标函数下降，工程交付还取决于筛选线和硬约束是否成立。',
  'posttest-q1': '因为对象、任务和筛选线已经重排，原结构微调无法完整描述新问题。',
  'posttest-q2': '它多回答了切换段、全程跟踪、航迹偏离、峰值动作和控制能量的分层职责。',
  'posttest-q3': '结构编号决定哪些槽位生效；不先判结构，就会把无效槽位误读成参数。',
};

function cardsFor(stepManifest: InteractiveRuntimeStepManifest) {
  return stepManifest.interactionSpec.activityCards ?? [];
}

function cardTitle(cardId: string, index: number) {
  const labels: Record<string, string> = {
    'task-change-card': '对象变化与任务变化',
    'boundary-split-card': '动作边界为何要分开',
    'trajectory-duty-card': '船是否真正走到位',
    'action-duty-card': '峰值动作与控制能量',
    'structure-first-card': '先判结构编号',
    'active-slots-card': '有效槽位与忽略槽位',
    'boundary-task': '总代价与工程交付',
    'posttest-q1': '后测 1',
    'posttest-q2': '后测 2',
    'posttest-q3': '后测 3',
  };
  return labels[cardId] ?? `作答 ${index + 1}`;
}

function StudentCards({
  stepManifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  onSubmit,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const cards = useMemo(() => cardsFor(stepManifest), [stepManifest]);
  const cardKeys = useMemo(() => cards.map((card) => card.id), [cards]);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>(savedResponse?.answers ?? {});

  useEffect(() => {
    setDraftAnswers((currentDraft) =>
      mergeSavedAnswersIntoDraft({
        savedAnswers: savedResponse?.answers,
        currentDraft,
        keys: cardKeys,
      }),
    );
  }, [cardKeys, savedResponse]);

  if (!cards.length) return null;

  if (!released) {
    return (
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">本页作答</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未发放本页作答卡，请先阅读上方证据。</div>
      </div>
    );
  }

  if (!browseEnabled && stepManifest.interactionSpec.interactionKind === 'quiz_group') {
    return (
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">本页作答</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未开放浏览，请等待课堂推进。</div>
      </div>
    );
  }

  const submittedKeys = new Set(Object.keys(savedResponse?.answers ?? {}));

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${cards.every((card) => card.layoutSpan === 'half') ? 'md:grid-cols-2' : ''}`}>
        {cards.map((card, index) => (
          <div key={card.id} className="premium-lesson-panel">
            <div className="premium-lesson-kicker">{cardTitle(card.id, index)}</div>
            <p className="premium-lesson-title mt-2 text-sm leading-7">{card.prompt}</p>
            <textarea
              value={draftAnswers[card.id] ?? ''}
              onChange={(event) => setDraftAnswers((prev) => ({ ...prev, [card.id]: event.target.value }))}
              placeholder="写出判断依据。"
              className="premium-lesson-input mt-3 min-h-[120px] w-full"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  onSubmit({
                    stepId: stepManifest.id,
                    submittedAt: Date.now(),
                    answers: buildPerCardSubmissionAnswers({
                      savedAnswers: savedResponse?.answers,
                      currentDraft: draftAnswers,
                      targetKey: card.id,
                    }),
                  })
                }
                disabled={!draftAnswers[card.id]?.trim()}
                className="premium-lesson-action-primary disabled:opacity-40"
              >
                提交答案
              </button>
              <span className="premium-lesson-caption text-xs">
                {submittedKeys.has(card.id) ? '已提交，可修改后重提。' : '独立提交本卡。'}
              </span>
            </div>
            {answerVisible ? (
              <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm leading-7">
                <strong>参考解释：</strong>
                {REFERENCE_ANSWERS[card.id] ?? '围绕本页证据链作答。'}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">提交状态</div>
        <SubmissionStatus
          submitted={cards.every((card) => submittedKeys.has(card.id))}
          submittedText="本页作答卡已至少提交一次，可继续修改并逐卡重提。"
          idleText="各作答卡独立提交，教师端会按卡汇总。"
        />
      </div>
    </div>
  );
}

function TeacherControls({
  stepManifest,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const controls = stepManifest.teacherControls;
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">教师控制</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {controls.releaseActivity !== 'not_applicable' ? (
          <button
            type="button"
            onClick={onToggleRelease}
            className={`premium-lesson-action-tone ${released ? 'premium-tone-emerald' : 'premium-tone-slate'}`}
          >
            {released ? '已发放作答' : '发放作答'}
          </button>
        ) : null}
        {controls.openBrowse !== 'not_applicable' && controls.openBrowse !== 'page_load_open' ? (
          <button
            type="button"
            onClick={onToggleBrowse}
            className={`premium-lesson-action-tone ${browseEnabled ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
          >
            {browseEnabled ? '已开放浏览' : '开放浏览'}
          </button>
        ) : null}
        {controls.revealReferenceAnswer !== 'not_applicable' ? (
          <button
            type="button"
            onClick={onToggleAnswerVisible}
            className={`premium-lesson-action-tone ${answerVisible ? 'premium-tone-amber' : 'premium-tone-slate'}`}
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        ) : null}
        {controls.teacherStepReveal === 'teacher_only' ? (
          <>
            <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-tone premium-tone-cyan">
              推进显影
            </button>
            <button type="button" onClick={onResetReveal} className="premium-lesson-action-tone premium-tone-slate">
              重置显影
            </button>
          </>
        ) : null}
      </div>
      {controls.teacherStepReveal === 'teacher_only' ? (
        <p className="premium-lesson-muted mt-3 text-sm">当前教师显影层级：{revealProgress + 1}</p>
      ) : null}
    </div>
  );
}

function TeacherSummary({
  stepManifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  responses: TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const cards = cardsFor(stepManifest);
  return (
    <div className="space-y-4">
      <TeacherControls
        stepManifest={stepManifest}
        released={released}
        browseEnabled={browseEnabled}
        answerVisible={answerVisible}
        revealProgress={revealProgress}
        onToggleRelease={onToggleRelease}
        onToggleBrowse={onToggleBrowse}
        onToggleAnswerVisible={onToggleAnswerVisible}
        onAdvanceReveal={onAdvanceReveal}
        onResetReveal={onResetReveal}
      />
      {cards.length ? (
        <div className="premium-lesson-panel">
          <div className="premium-lesson-kicker">学生提交汇总</div>
          <div className="mt-3 space-y-3">
            {cards.map((card, index) => {
              const cardResponses = responses.filter((item) => item.response.answers?.[card.id]);
              return (
                <div key={card.id} className="premium-lesson-surface-elevated px-4 py-3">
                  <div className="premium-lesson-title text-sm font-semibold">{cardTitle(card.id, index)}</div>
                  <div className="premium-lesson-muted mt-1 text-xs">已提交 {cardResponses.length} 人</div>
                  {cardResponses.slice(0, 4).map((item) => (
                    <p key={`${card.id}-${item.studentName}`} className="premium-lesson-muted mt-2 text-sm leading-6">
                      <strong>{item.studentName}：</strong>
                      {item.response.answers[card.id]}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function createManifestStudentActivityRegistry<TStep>(): StudentInteractiveActivityRegistry<TStep, ManifestStepResponse> {
  return {
    activity_card_set: (props) => <StudentCards {...props} />,
    quiz_group: (props) => <StudentCards {...props} />,
    teacher_reveal_only: (props) => <StudentCards {...props} />,
  };
}

export function createManifestTeacherActivityRegistry<TStep>(): TeacherInteractiveActivityRegistry<TStep, TeacherResponseItem> {
  return {
    activity_card_set: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    quiz_group: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
    teacher_reveal_only: (props) => <TeacherSummary {...props} responses={props.responses as TeacherResponseItem[]} />,
  };
}
