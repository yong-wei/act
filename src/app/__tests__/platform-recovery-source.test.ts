import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('platform recovery source wiring', () => {
  it('routes known missing-object pages through the shared product recovery panel', () => {
    const lessonPlanRecovery = readFileSync(join(repoRoot, 'src/features/lesson-engine/lesson-plan-missing-recovery.tsx'), 'utf8');
    const classDetail = readFileSync(join(repoRoot, 'src/app/teacher/classes/[classId]/page.tsx'), 'utf8');
    const resourceDetail = readFileSync(join(repoRoot, 'src/app/interactive-learning/resources/[id]/page.tsx'), 'utf8');
    const arenaChallenge = readFileSync(join(repoRoot, 'src/app/arena/challenges/[taskId]/page.tsx'), 'utf8');
    const arenaPublicationReport = readFileSync(join(repoRoot, 'src/app/teacher/arena/publications/[publicationId]/page.tsx'), 'utf8');
    const globalNotFound = readFileSync(join(repoRoot, 'src/app/not-found.tsx'), 'utf8');

    expect(lessonPlanRecovery).toContain('buildPlatformRecoveryState');
    expect(lessonPlanRecovery).toContain("kind: 'missing-object'");
    expect(lessonPlanRecovery).toContain('sourceRoute = listHref');
    expect(lessonPlanRecovery).toContain('<ActionStatusPanel');
    expect(classDetail).toContain("sourceRoute: '/teacher/classes/[classId]'");
    expect(classDetail).toContain('班级不存在或当前教师账号不可见。');
    expect(resourceDetail).toContain("sourceRoute: '/interactive-learning/resources/[id]'");
    expect(resourceDetail).toContain('<ActionStatusPanel');
    expect(arenaChallenge).toContain('<ArenaRouteRecovery');
    expect(arenaChallenge).toContain('surface="student-publication-access"');
    expect(arenaPublicationReport).toContain('<EmbeddedArenaRouteRecovery');
    expect(arenaPublicationReport).not.toContain('<ArenaRouteRecovery');
    expect(arenaPublicationReport).toContain('surface="teacher-publication-report"');
    expect(globalNotFound).toContain('data-platform-route-recovery="global-not-found"');
    expect(globalNotFound).toContain("kind: 'invalid-object-route'");
    expect(globalNotFound).toContain('<ActionStatusPanel');
  });

  it('keeps classroom-code errors, direct floating controls, and floating focus checks inspectable', () => {
    const joinPage = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');
    const floatingControls = readFileSync(join(repoRoot, 'src/components/shared/page-floating-controls.tsx'), 'utf8');
    const mobileA11y = readFileSync(join(repoRoot, 'tests/mobile-a11y-shell.spec.ts'), 'utf8');

    expect(joinPage).toContain("kind: 'classroom-code-error'");
    expect(joinPage).toContain('data-classroom-join-recovery-link="review-evidence"');
    expect(joinPage).toContain('classJoinState?.evidenceWriteback');
    expect(floatingControls).toContain('data-platform-floating-dock-direct-action');
    expect(floatingControls).not.toContain('主题已切换为');
    expect(floatingControls).toContain('data-platform-floating-dock-status');
    expect(mobileA11y).toContain('global-ai-sidebar-keyboard-320.json');
    expect(mobileA11y).toContain('dock trigger restored');
  });

  it('guards the previous P0 registration and prep-pack recovery closures', () => {
    const registerRoute = readFileSync(join(repoRoot, 'src/app/api/auth/register/route.ts'), 'utf8');
    const registerPage = readFileSync(join(repoRoot, 'src/app/(auth)/register/page.tsx'), 'utf8');
    const prepPackPageTest = readFileSync(join(repoRoot, 'src/app/__tests__/teacher-prep-packs-page.test.ts'), 'utf8');
    const prepPackPage = readFileSync(join(repoRoot, 'src/app/teacher/prep-packs/page.tsx'), 'utf8');

    expect(registerRoute).toContain("password: z.string().min(8, 'Password must be at least 8 characters.')");
    expect(registerPage).toContain('role="alert"');
    expect(registerPage).toContain('aria-live="assertive"');
    expect(prepPackPageTest).toContain('renders a recovery state instead of throwing when the prep-pack table is missing');
    expect(prepPackPage).toContain("recovery={{ reason: 'storage-missing' }}");
  });
});
