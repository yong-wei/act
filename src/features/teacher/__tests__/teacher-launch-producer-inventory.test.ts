import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function filesWithSessionCreation(rootPath: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...filesWithSessionCreation(absolutePath));
    } else if (/\.(ts|tsx)$/u.test(entry.name)
      && fs.readFileSync(absolutePath, 'utf8').includes("fetch('/api/session'")) {
      result.push(path.relative(root, absolutePath));
    }
  }
  return result.sort();
}

describe('teacher launch producer inventory', () => {
  it('routes every teacher-facing launch producer through the shared class launcher', () => {
    const launcher = source('src/features/teacher/teacher-classroom-launcher.tsx');
    const lessonList = source('src/features/lesson-engine/lesson-plan-list.tsx');
    const playlist = source('src/features/knowledge/playlist-play-launcher.tsx');
    const classDetail = source('src/app/teacher/classes/[classId]/page.tsx');
    const courseEntry = source('src/features/interactive/shared/course-entry-shell.tsx');
    const premiumEntry = source('src/features/interactive/shared/premium-lesson-entry-page.tsx');
    const lessonPlansPage = source('src/app/teacher/lesson-plans/page.tsx');
    const playlistPage = source('src/app/playlists/[id]/play/page.tsx');

    expect(launcher).toContain("fetch('/api/session'");
    expect(launcher).toContain('classId: selectedClassId');
    expect(lessonPlansPage).toContain('launchActor="teacher"');
    expect(lessonList).toContain("if (launchActor === 'teacher')");
    expect(lessonList).toContain('teacherLauncher.launch');
    expect(lessonList).toContain("launchActor === 'admin' ? '开始临时课堂' : '开始上课'");
    expect(lessonList).toContain('不绑定班级的临时课堂');
    expect(playlistPage).toContain("launchActor={viewerRole === UserRole.TEACHER ? 'teacher' : 'admin'}");
    expect(playlist).toContain("if (launchActor === 'teacher')");
    expect(playlist).toContain('teacherLauncher.launch');
    expect(playlist).toContain("launchActor === 'admin' ? '开始临时课堂' : '开始上课'");
    expect(playlist).toContain('管理员将启动不绑定班级的临时课堂。');
    expect(classDetail).toContain('teacherLauncher.launch');
    expect(classDetail).not.toContain("fetch('/api/session'");
    for (const interactiveEntry of [courseEntry, premiumEntry]) {
      const teacherBranch = interactiveEntry.indexOf("if (userRole === 'TEACHER')");
      const directSessionRequest = interactiveEntry.indexOf("fetch('/api/session'");
      expect(teacherBranch).toBeGreaterThanOrEqual(0);
      expect(interactiveEntry.indexOf('teacherLauncher.launch')).toBeGreaterThan(teacherBranch);
      expect(directSessionRequest).toBeGreaterThan(teacherBranch);
      expect(interactiveEntry.slice(teacherBranch, directSessionRequest)).toContain('return;');
    }
  });

  it('keeps direct session creation constrained to the shared launcher and explicit administrator exceptions', () => {
    expect(filesWithSessionCreation(path.join(root, 'src', 'app'))).toEqual([]);
    expect(filesWithSessionCreation(path.join(root, 'src', 'features'))).toEqual([
      'src/features/interactive/shared/course-entry-shell.tsx',
      'src/features/interactive/shared/premium-lesson-entry-page.tsx',
      'src/features/knowledge/playlist-play-launcher.tsx',
      'src/features/lesson-engine/lesson-plan-list.tsx',
      'src/features/teacher/teacher-classroom-launcher.tsx',
    ]);
  });
});
