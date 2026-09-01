import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveRegisteredAIContextFromPath } from '@/lib/ai-context-resolver';

const copilot = readFileSync(join(process.cwd(), 'src/app/ai/copilot/page.tsx'), 'utf8');
const chatRoute = readFileSync(join(process.cwd(), 'src/app/api/ai/chat/route.ts'), 'utf8');
const sessionsRoute = readFileSync(join(process.cwd(), 'src/app/api/ai/sessions/route.ts'), 'utf8');
const sessionDetailRoute = readFileSync(
  join(process.cwd(), 'src/app/api/ai/sessions/[id]/route.ts'),
  'utf8',
);
const libraryHook = readFileSync(
  join(process.cwd(), 'src/hooks/useKonlingConversationLibrary.ts'),
  'utf8',
);

describe('standalone Copilot conversation library', () => {
  it('reuses the owned Konling conversation library instead of a page-local store', () => {
    const registered = resolveRegisteredAIContextFromPath('/ai/copilot');
    expect(registered?.courseId).toBe('ai-assistant');
    expect(registered?.stepId).toBe('/ai/copilot');
    expect(copilot).toContain('useKonlingConversationLibrary');
    expect(copilot).toContain("const STANDALONE_COPILOT_COURSE_ID = 'ai-assistant'");
    expect(copilot).toContain("const STANDALONE_COPILOT_PAGE_ID = '/ai/copilot'");
    expect(copilot).toContain('courseId: STANDALONE_COPILOT_COURSE_ID');
    expect(copilot).toContain('pageId: STANDALONE_COPILOT_PAGE_ID');
    expect(copilot).toContain('ensureConversation');
    expect(copilot).toContain('visibleKonlingMessages');
    expect(copilot).not.toContain('localStorage');
    expect(copilot).not.toContain('indexedDB');
    expect(libraryHook).toContain("fetch('/api/ai/sessions'");
  });

  it('binds chat requests to a verified conversation id after create-or-select', () => {
    expect(copilot).toContain('conversationId: conversation.id');
    expect(copilot).toContain('conversationId: activeConversationId ?? undefined');
    expect(copilot).toContain('await ensureConversation()');
    expect(copilot.indexOf('await ensureConversation()'))
      .toBeLessThan(copilot.indexOf('conversationId: conversation.id'));
    expect(chatRoute).toContain('if (conversationId && !conversation)');
    expect(chatRoute).toContain("error: 'Conversation not found'");
    expect(chatRoute).toContain('userId: session.user.id');
    expect(sessionDetailRoute).toContain("error: 'Conversation not found'");
  });

  it('hydrates visible history, keeps task contracts current, and replaces local clear', () => {
    expect(copilot).toContain('setMessages(visibleKonlingMessages(activeConversation.messages))');
    expect(copilot).toContain('stop()');
    expect(copilot).toContain('selectConversation(conversationId)');
    expect(copilot).toContain('createConversation(null)');
    expect(copilot).toContain('window.confirm(');
    expect(copilot).toContain('deleteConversation(conversationId)');
    expect(copilot).not.toContain('clearLocalConversation');
    expect(copilot).toContain('auditTaskContext: portfolioReflectionTaskContext ?? evidenceTaskContext');
    expect(copilot).toContain("taskType: 'portfolio-reflection'");
    expect(copilot).toContain("taskType: 'evidence-copilot'");
    expect(copilot).toContain('data-copilot-conversation-status');
    expect(copilot).toContain('recovery-failed');
    expect(copilot).toContain('/login?callbackUrl=');
  });

  it('does not promote conversation use into formal learning records', () => {
    expect(copilot).not.toContain('LearningFact');
    expect(copilot).not.toContain('learningFact');
    expect(sessionsRoute).not.toContain('LearningFact');
    expect(sessionDetailRoute).not.toContain('LearningFact');
    expect(chatRoute).not.toContain('prisma.learningFact');
    expect(chatRoute).not.toContain('LearningFact.create');
  });
});
