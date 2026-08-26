import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isLocalKnowledgeWorkspaceQaTarget,
  KNOWLEDGE_WORKSPACE_QA_ROLES,
  managedKnowledgeWorkspaceQaCredentials,
} from './knowledge-workspace-product-qa-accounts.mjs';

test('managed knowledge workspace QA credentials cover the three required roles', () => {
  const credentials = managedKnowledgeWorkspaceQaCredentials();

  assert.deepEqual(KNOWLEDGE_WORKSPACE_QA_ROLES, ['student', 'teacher', 'admin']);
  assert.deepEqual(
    KNOWLEDGE_WORKSPACE_QA_ROLES.map((role) => credentials[role].expectedRole),
    ['STUDENT', 'TEACHER', 'ADMIN'],
  );
  assert.equal(KNOWLEDGE_WORKSPACE_QA_ROLES.every((role) => Boolean(credentials[role].email)), true);
  assert.equal(KNOWLEDGE_WORKSPACE_QA_ROLES.every((role) => Boolean(credentials[role].password)), true);
});

test('managed knowledge workspace QA provisioning is limited to loopback targets', () => {
  assert.equal(isLocalKnowledgeWorkspaceQaTarget('http://localhost:3002'), true);
  assert.equal(isLocalKnowledgeWorkspaceQaTarget('http://127.0.0.1:3002'), true);
  assert.equal(isLocalKnowledgeWorkspaceQaTarget('https://act.adapt-learn.online'), false);
  assert.equal(isLocalKnowledgeWorkspaceQaTarget('not a url'), false);
});
