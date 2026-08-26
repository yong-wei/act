import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isLocalKnowledgeWorkspaceQaTarget,
  KNOWLEDGE_WORKSPACE_QA_ROLES,
  managedKnowledgeWorkspaceQaCredentials,
  provisionLocalKnowledgeWorkspaceQaAccounts,
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

test('non-local targets never initialize managed QA fixtures', async () => {
  const result = await provisionLocalKnowledgeWorkspaceQaAccounts('https://act.adapt-learn.online');

  assert.equal(result, null);
});

test('a non-loopback database rejects local managed QA provisioning before access', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://qa:qa@db.example.test:5432/act_obe';
  try {
    await assert.rejects(
      provisionLocalKnowledgeWorkspaceQaAccounts('http://localhost:3002'),
      /loopback DATABASE_URL/u,
    );
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});
