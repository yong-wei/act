import { spawn } from 'node:child_process';

import {
  KNOWLEDGE_WORKSPACE_QA_ROLES,
  provisionLocalKnowledgeWorkspaceQaAccounts,
  type KnowledgeWorkspaceQaCredentials,
} from './knowledge-workspace-product-qa-accounts';

const baseUrl = process.env.KNOWLEDGE_QA_BASE_URL ?? 'http://localhost:3002';

const roleEnvironment: Record<(typeof KNOWLEDGE_WORKSPACE_QA_ROLES)[number], {
  email: string;
  password: string;
}> = {
  student: {
    email: 'KNOWLEDGE_QA_STUDENT_EMAIL',
    password: 'KNOWLEDGE_QA_STUDENT_PASSWORD',
  },
  teacher: {
    email: 'KNOWLEDGE_QA_TEACHER_EMAIL',
    password: 'KNOWLEDGE_QA_TEACHER_PASSWORD',
  },
  admin: {
    email: 'KNOWLEDGE_QA_ADMIN_EMAIL',
    password: 'KNOWLEDGE_QA_ADMIN_PASSWORD',
  },
};

function configuredRoleCredentials() {
  const credentials = Object.fromEntries(KNOWLEDGE_WORKSPACE_QA_ROLES.map((role) => {
    const environment = roleEnvironment[role];
    return [role, {
      email: process.env[environment.email]?.trim() ?? '',
      password: process.env[environment.password] ?? '',
    }];
  })) as Record<(typeof KNOWLEDGE_WORKSPACE_QA_ROLES)[number], Pick<KnowledgeWorkspaceQaCredentials, 'email' | 'password'>>;
  const complete = (role: (typeof KNOWLEDGE_WORKSPACE_QA_ROLES)[number]) => (
    Boolean(credentials[role].email && credentials[role].password)
  );

  if (KNOWLEDGE_WORKSPACE_QA_ROLES.some((role) => Boolean(
    credentials[role].email || credentials[role].password,
  )) && !KNOWLEDGE_WORKSPACE_QA_ROLES.every(complete)) {
    throw new Error('knowledge workspace QA credentials must be configured for all three roles');
  }
  return KNOWLEDGE_WORKSPACE_QA_ROLES.every(complete) ? credentials : null;
}

async function main() {
  const configured = configuredRoleCredentials();
  const managed = configured ? null : await provisionLocalKnowledgeWorkspaceQaAccounts(baseUrl);
  const credentials = configured ?? managed;
  if (!credentials) {
    throw new Error('non-local knowledge workspace QA requires explicit credentials for student, teacher, and admin');
  }

  const childEnvironment = { ...process.env, KNOWLEDGE_QA_BASE_URL: baseUrl };
  for (const role of KNOWLEDGE_WORKSPACE_QA_ROLES) {
    const environment = roleEnvironment[role];
    childEnvironment[environment.email] = credentials[role].email;
    childEnvironment[environment.password] = credentials[role].password;
  }

  const child = spawn('npx', ['--yes', 'tsx', 'scripts/tests/capture-knowledge-workspace-product-qa.ts'], {
    env: childEnvironment,
    stdio: 'inherit',
  });
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`knowledge workspace QA capture exited ${signal ? `from ${signal}` : `with ${code ?? 1}`}`));
    });
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
