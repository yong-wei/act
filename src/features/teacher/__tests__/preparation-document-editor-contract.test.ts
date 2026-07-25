import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const shell = source('src/features/teacher/preparation-document-editor/editor-shell.tsx');
const lesson = source('src/features/teacher/preparation-document-editor/lesson-document-editor.tsx');
const basis = source('src/features/teacher/preparation-document-editor/course-basis-document-editor.tsx');
const courseware = source('src/features/teacher/smart-courseware-editor.tsx');
const workspace = source('src/features/teacher/smart-lesson-plan-workspace.tsx');

describe('unified preparation document editor contract', () => {
  it('uses the shared full-screen shell for all three document domains', () => {
    expect(lesson).toContain('<PreparationDocumentEditorShell');
    expect(basis).toContain('<PreparationDocumentEditorShell');
    expect(courseware).toContain('<PreparationDocumentEditorShell');
    expect(shell).toContain('fixed inset-0');
    expect(shell).toContain('lg:grid-cols');
    expect(shell).toContain('打开文档结构');
    expect(shell).toContain('打开 AI 建议');
  });

  it('provides autosave, explicit save, conflict retention and safe exit', () => {
    expect(lesson).toContain("window.setTimeout(() => void save(), 1000)");
    expect(basis).toContain("window.setTimeout(() => void save(), 1200)");
    expect(shell).toContain("window.addEventListener('beforeunload'");
    expect(shell).toContain("saveState !== 'saved'");
    expect(lesson).toContain("setSaveState(conflict ? 'conflict' : 'failed')");
    expect(basis).toContain("response.status === 409 ? 'conflict' : 'failed'");
  });

  it('replaces outline, draft and courseware raw prompt editing', () => {
    expect(workspace).toContain('/editor/lesson/');
    expect(courseware).toContain('data-courseware-visual-editor');
    expect(courseware).not.toContain('window.prompt');
    expect(lesson).not.toContain('JSON.stringify(document');
  });
});
