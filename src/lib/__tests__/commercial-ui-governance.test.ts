import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES,
  evaluateCommercialUiGovernance,
  type CommercialAccessibilityTextFitEvidence,
  type CommercialNavigationCoverageInput,
  type CommercialUiGovernanceInput,
  type CommercialVisualAcceptanceEvidence,
} from '@/lib/commercial-ui-governance';
import {
  COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS,
  PLATFORM_PROFILE_AND_COCKPIT_ACTIONS,
  STUDENT_CORE_ENTRY_IDS,
  STUDENT_LEARNING_INTENT_GROUPS,
} from '@/lib/platform-role-navigation';

const today = '2026-05-31';

const fullNavigationCoverage: CommercialNavigationCoverageInput = {
  intents: COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.map((group) => group.intent),
  coreEntryIds: STUDENT_CORE_ENTRY_IDS,
  hrefs: COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.flatMap((group) => group.hrefs),
  aliases: STUDENT_LEARNING_INTENT_GROUPS.flatMap((group) => group.compatibilityAliases),
  profileHref: PLATFORM_PROFILE_AND_COCKPIT_ACTIONS.find((action) => action.audience === 'student')?.profileHref,
  cockpitHref: PLATFORM_PROFILE_AND_COCKPIT_ACTIONS.find((action) => action.audience === 'student')?.cockpitHref,
};

function completeVisualEvidence(): CommercialVisualAcceptanceEvidence[] {
  return DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.map((route) => ({
    href: route.href,
    viewports: route.requiredWidths.map((width) => ({
      width,
      screenshot: `artifacts/commercial-ui/${route.href.replace(/[^a-z0-9]+/gi, '-')}-${width}.png`,
      firstViewportUseful: true,
      navigationReachable: true,
      noTextOverlap: true,
      stablePanelGeometry: true,
      coherentBrandApplication: true,
      taskControlsVisible: true,
    })),
  }));
}

function completeAccessibilityEvidence(): CommercialAccessibilityTextFitEvidence[] {
  return DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.map((route) => ({
    href: route.href,
    viewports: route.requiredWidths.map((width) => ({
      width,
      contrastChecked: true,
      visibleFocus: true,
      keyboardReachable: true,
      reducedMotionChecked: true,
      buttonTextFits: true,
      noMobileTextOverlap: true,
    })),
  }));
}

function baseInput(overrides: Partial<CommercialUiGovernanceInput> = {}): CommercialUiGovernanceInput {
  return {
    mode: 'blocking',
    today,
    navigationCoverage: fullNavigationCoverage,
    visualEvidence: completeVisualEvidence(),
    accessibilityEvidence: completeAccessibilityEvidence(),
    ...overrides,
  };
}

describe('commercial UI governance', () => {
  it('reports allowlisted legacy debt in advisory mode without failing the gate', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      sourceViolations: [{
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        message: 'Legacy entry page still uses a local amber palette.',
      }],
      allowlist: [{
        id: 'legacy-student-entry-palette',
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        owningIssue: '#228',
        expiresOn: '2026-07-01',
      }],
    }));

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.allowlistedViolations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: 'token.page-local-palette',
      allowedBy: 'legacy-student-entry-palette',
    });
  });

  it('rejects new palette, unregistered shell, and private module chrome in blocking mode', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      sourceViolations: [{
        path: 'src/app/interactive-learning/new-surface/page.tsx',
        rule: 'token.page-local-palette',
        message: 'New surface introduced raw teal and purple page-local tokens.',
        evidence: ['#14b8a6', 'from-purple-500'],
      }],
      shellInventory: [{
        path: 'src/app/interactive-learning/new-surface/page.tsx',
        route: '/interactive-learning/new-surface',
        usesRegisteredShell: false,
        shellName: 'NewSurfaceHeader',
      }],
      statusInventory: [{
        path: 'src/app/interactive-learning/new-surface/page.tsx',
        statusTerm: 'readyish',
        registeredStatusColor: false,
        duplicatesPlatformVocabulary: true,
      }],
      moduleChromeInventory: [{
        path: 'course-content/runtime/lessons/4-9/lesson.json',
        lessonId: '4-9',
        stepId: 'step-03',
        moduleId: 'private-card-sort',
        moduleKind: 'private-card-sort',
        registeredKind: false,
        usesCommercialChrome: false,
        privateChromeComponent: 'LessonPrivateCardSortChrome',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining([
        'token.page-local-palette',
        'shell.unregistered-route-frame',
        'token.unregistered-status-color',
        'status.duplicate-vocabulary',
        'module-chrome.unregistered-kind',
        'module-chrome.private-chrome',
      ]),
    );
  });

  it('fails when a required route lacks visual acceptance evidence', () => {
    const missingArenaEvidence = completeVisualEvidence().filter((evidence) => evidence.href !== '/arena');
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: missingArenaEvidence,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.missing-route-evidence',
          path: '/arena',
        }),
      ]),
    );
  });

  it('fails when accessibility and 320px text-fit evidence are incomplete', () => {
    const accessibilityEvidence = completeAccessibilityEvidence().map((entry) => {
      if (entry.href !== '/profile') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 320
            ? { ...viewport, buttonTextFits: false, noMobileTextOverlap: false }
            : viewport
        )),
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      accessibilityEvidence,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'accessibility-text-fit',
          rule: 'accessibility-text-fit.incomplete-evidence',
          path: '/profile',
          evidence: expect.arrayContaining(['width=320', 'buttonTextFits', 'noMobileTextOverlap']),
        }),
      ]),
    );
  });

  it('fails when student navigation coverage loses an intent, core destination, or alias', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      navigationCoverage: {
        ...fullNavigationCoverage,
        intents: fullNavigationCoverage.intents.filter((intent) => intent !== 'experiment'),
        coreEntryIds: fullNavigationCoverage.coreEntryIds.filter((id) => id !== 'student-control-workbench'),
        hrefs: fullNavigationCoverage.hrefs.filter((href) => href !== '/interactive-learning/control-workbench'),
        aliases: fullNavigationCoverage.aliases.filter((href) => !href.includes('control-workbench')),
      },
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining([
        'navigation.intent-coverage',
        'navigation.core-destination-coverage',
        'navigation.alias-coverage',
      ]),
    );
  });

  it('treats incomplete allowlist entries as governance violations', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      allowlist: [{
        path: 'src/app/legacy/page.tsx',
        rule: 'token.raw-decorative-gradient',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['missing owningIssue or owningChange', 'missing expiresOn or removalCondition']),
        }),
      ]),
    );
  });

  it('rejects expired allowlist entries instead of masking blocking violations', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      sourceViolations: [{
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        message: 'Legacy entry page still uses a local palette.',
      }],
      allowlist: [{
        id: 'expired-legacy-palette',
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        owningIssue: '#228',
        expiresOn: '2026-01-01',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.allowlistedViolations).toHaveLength(0);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['expired expiresOn']),
        }),
        expect.objectContaining({
          rule: 'token.page-local-palette',
          path: 'src/app/legacy-student-entry/page.tsx',
        }),
      ]),
    );
  });

  it('rejects allowlist entries with non-ISO expiration dates', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      allowlist: [{
        id: 'bad-date',
        path: 'src/app/legacy/page.tsx',
        rule: 'token.raw-decorative-gradient',
        owningIssue: '#228',
        expiresOn: 'July 1 2026',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['invalid expiresOn']),
        }),
      ]),
    );
  });

  it('rejects allowlist entries with impossible calendar dates', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      allowlist: [{
        id: 'bad-calendar-date',
        path: 'src/app/legacy/page.tsx',
        rule: 'token.raw-decorative-gradient',
        owningIssue: '#228',
        expiresOn: '2026-02-31',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['invalid expiresOn']),
        }),
      ]),
    );
  });

  it('rejects profile and cockpit hrefs with wrong or collapsed semantics', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      navigationCoverage: {
        ...fullNavigationCoverage,
        profileHref: '/wrong',
        cockpitHref: '/wrong',
      },
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'navigation',
          rule: 'navigation.profile-cockpit-semantics',
          evidence: expect.arrayContaining([
            'profileHref=/wrong',
            'cockpitHref=/wrong',
            'profileHref equals cockpitHref',
          ]),
        }),
      ]),
    );
  });
});
