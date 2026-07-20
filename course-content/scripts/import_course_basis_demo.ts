import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const root = process.cwd();
  const baseUrl = process.env.COURSE_BASIS_API_BASE_URL ?? 'http://localhost:3000';
  const cookie = process.env.COURSE_BASIS_TEACHER_COOKIE;
  const restrictedPath = process.env.COURSE_BASIS_RESTRICTED_TEXTBOOK_PATH;
  if (!cookie) throw new Error('COURSE_BASIS_TEACHER_COOKIE is required');
  if (!restrictedPath) throw new Error('COURSE_BASIS_RESTRICTED_TEXTBOOK_PATH is required');

  const descriptor = JSON.parse(await readFile(resolve(root, 'course-content/demo/course-basis-root-locus/import-descriptor.json'), 'utf8'));
  const headers = { cookie };
  const request = async (path: string, init: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, init);
    const payload = await response.json();
    if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(payload)}`);
    return payload;
  };
  const basis = await request('/api/teacher/course-bases', {
  method: 'POST',
  headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify(descriptor.courseBasis),
});

  for (const entry of descriptor.documents) {
  const document = await request(`/api/teacher/course-bases/${basis.courseBasis.id}/documents`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ title: entry.title, kind: entry.kind }),
  });
    const sourcePath = entry.pathEnvironmentVariable
    ? restrictedPath as string
    : resolve(root, entry.path);
  const content = await readFile(sourcePath, 'utf8');
  const version = await request(`/api/teacher/course-bases/documents/${document.document.id}/versions`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ sourceType: entry.sourceType, sourceName: entry.title, mimeType: 'text/markdown', content }),
  });
  await request(`/api/teacher/course-bases/versions/${version.version.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'confirm' }),
  });
  }
}

void main();
