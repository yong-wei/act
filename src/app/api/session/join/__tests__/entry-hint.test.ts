import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), lookup: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/features/classroom/session/join-api', () => ({ joinClassroomSessionUseCase: mocks.lookup }));
import { GET } from '../route';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());
it.each([
  ['1', 'STUDENT', '/interactive-learning/courses/unit-1-2/student/room', true],
  ['0', 'STUDENT', '/interactive-learning/courses/unit-1-2/student/room', false],
  ['1', 'TEACHER', '/interactive-learning/courses/unit-1-2/student/room', false],
  ['1', 'STUDENT', '/classroom/student/room', false],
  ['1', 'STUDENT', '/interactive-learning/courses/unit-1-2/student/other', false],
])('limits the entry hint to an eligible student and matching route (%s, %s, %s)', async (flag, role, href, enabled) => {
  vi.stubEnv('INTERACTIVE_CLASSROOM_CAPACITY', String(flag));
  mocks.session.mockResolvedValue({ user: { id: 'viewer', role } });
  mocks.lookup.mockResolvedValue({ id: 'room', studentHref: href });
  const result = await GET(new Request('http://localhost/api/session/join?code=123456'));
  expect(result.status).toBe(200);
  const body = await result.json();
  expect(body.studentHref).toBe(href);
  expect(body.waitAtEntry).toBe(enabled ? true : undefined);
});
