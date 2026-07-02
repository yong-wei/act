'use client';

import type { AuthoringApiTask } from '@/lib/authoring-api-task-consumption';
import { authoringApiTaskStatusLabel } from '@/lib/authoring-api-task-consumption';

export function AuthoringApiTaskStrip({
  surface,
  tasks,
  limit = 4,
}: {
  surface: AuthoringApiTask['objectType'];
  tasks: AuthoringApiTask[];
  limit?: number;
}) {
  return (
    <div
      className="mt-3 flex flex-wrap gap-1.5"
      data-authoring-api-task-surface={surface}
      data-authoring-api-task-count={tasks.length}
    >
      {tasks.slice(0, limit).map((task) => (
        <TaskBadge
          key={task.id}
          task={task}
        />
      ))}
    </div>
  );
}

function TaskBadge({ task }: { task: AuthoringApiTask }) {
  const className = "inline-flex max-w-full flex-col gap-0.5 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300";
  const commonProps = {
    className,
    title: `${task.label}：${task.recoveryAction}`,
    'data-authoring-api-task-type': task.taskType,
    'data-authoring-api-task-state': task.status,
    'data-authoring-api-task-reason': task.reason,
  };
  const content = (
    <>
      <span className="flex max-w-full items-center gap-1">
        <span className="truncate">{task.label}</span>
        <span className="shrink-0 text-slate-500">{authoringApiTaskStatusLabel(task.status)}</span>
      </span>
      <span className="max-w-[18rem] whitespace-normal text-slate-400">
        {task.reason}；{task.recoveryAction}
      </span>
    </>
  );
  return task.href ? (
    <a href={task.href} {...commonProps}>
      {content}
    </a>
  ) : (
    <span {...commonProps}>
      {content}
    </span>
  );
}
