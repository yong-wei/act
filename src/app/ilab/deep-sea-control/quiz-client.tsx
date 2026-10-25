'use client';

import { useState } from 'react';

import { scoreQuiz, type IlabQuizQuestion } from '@/features/ilab/quizzes';

export function QuizClient({ storageKey, questions }: { storageKey: string; questions: IlabQuizQuestion[] }) {
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');

  function submit() {
    const result = scoreQuiz(questions, picks);
    const text = `得分 ${result.note}`;
    window.sessionStorage.setItem(storageKey, text);
    setNote(text);
  }

  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {questions.map((question, index) => (
        <fieldset key={question.id}>
          <legend className="font-medium">{index + 1}. {question.prompt}</legend>
          <div className="mt-2 space-y-1">
            {question.choices.map((choice, choiceIndex) => (
              <label key={choice} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={question.id}
                  checked={picks[question.id] === choiceIndex}
                  onChange={() => setPicks((current) => ({ ...current, [question.id]: choiceIndex }))}
                />
                {choice}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="submit" className="rounded bg-amber-200 px-3 py-2 font-medium text-slate-950">提交并计入实验报告</button>
      {note ? <p>已保存。回到实验完成时，报告会写上：{note}</p> : null}
    </form>
  );
}
