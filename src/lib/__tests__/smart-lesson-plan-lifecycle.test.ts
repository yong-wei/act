import { describe, expect, it, vi } from 'vitest';

import { archiveSmartLessonTask, deleteSmartLessonTask } from '../smart-lesson-plan/lifecycle';

const teacher = { id: 'teacher-1', role: 'TEACHER' as const };

describe('smart lesson task lifecycle', () => {
  it('archives only a task owned by the current teacher', async () => {
    const findFirst = vi.fn(async () => ({ id: 'task-1' }));
    const update = vi.fn(async ({ data }) => ({ id: 'task-1', ...data }));
    const result = await archiveSmartLessonTask({
      smartLessonTask: { findFirst, update },
    } as never, {
      actor: teacher,
      taskId: 'task-1',
      archived: true,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'task-1', ownerId: teacher.id },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(result.archivedAt).toBeInstanceOf(Date);
  });

  it('blocks permanent deletion when a publication or classroom references the task', async () => {
    const taskDelete = vi.fn();
    const tx = {
      smartLessonTask: {
        findFirst: vi.fn(async () => ({
          id: 'task-1',
          coursewarePublicationSeries: {
            revisions: [
              { id: 'publication-1', _count: { classSessions: 2 } },
              { id: 'publication-2', _count: { classSessions: 0 } },
            ],
          },
        })),
        delete: taskDelete,
      },
    };
    const result = await deleteSmartLessonTask({
      $transaction: vi.fn(async (run) => run(tx)),
    } as never, {
      actor: teacher,
      taskId: 'task-1',
    });

    expect(result).toEqual({
      deleted: false,
      blockers: [
        { category: 'publication', count: 2, managementPath: '/teacher/preset-lessons' },
        { category: 'classroom', count: 2, managementPath: '/teacher/history' },
      ],
    });
    expect(taskDelete).not.toHaveBeenCalled();
  });

  it('atomically removes the unpublished graph before deleting the task', async () => {
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const taskDelete = vi.fn(async () => ({ id: 'task-1' }));
    const delegate = { deleteMany, updateMany };
    const tx = new Proxy({
      $executeRaw: vi.fn(async () => [{ set_config: 'task-1' }]),
      $queryRaw: vi.fn(async () => [{ taskId: 'task-1' }]),
      smartLessonTask: {
        findFirst: vi.fn(async () => ({
          id: 'task-1',
          coursewarePublicationSeries: { revisions: [] },
        })),
        delete: taskDelete,
      },
      smartLessonRevision: {
        findMany: vi.fn(async () => []),
        deleteMany,
      },
    } as Record<string, unknown>, {
      get(target, property) {
        return target[property as string] ?? delegate;
      },
    });
    const transaction = vi.fn(async (run, options) => {
      expect(options).toMatchObject({ isolationLevel: 'Serializable' });
      return run(tx);
    });
    const result = await deleteSmartLessonTask({ $transaction: transaction } as never, {
      actor: teacher,
      taskId: 'task-1',
    });

    expect(result).toEqual({ deleted: true, blockers: [] });
    expect(taskDelete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    expect(taskDelete.mock.invocationCallOrder[0]).toBeGreaterThan(deleteMany.mock.invocationCallOrder.at(-1)!);
    expect(updateMany).toHaveBeenCalledWith({
      where: { taskId: 'task-1' },
      data: { basedOnRevisionId: null },
    });
  });
});
