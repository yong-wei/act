import { spawn } from 'node:child_process';

const baseUrl = process.env.KNOWLEDGE_QA_BASE_URL ?? 'http://localhost:3002';
const roles = ['student', 'teacher', 'admin'];

const roleEnvironment = {
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
  const credentials = Object.fromEntries(roles.map((role) => {
    const environment = roleEnvironment[role];
    return [role, {
      email: process.env[environment.email]?.trim() ?? '',
      password: process.env[environment.password] ?? '',
    }];
  }));
  const complete = (role) => Boolean(credentials[role].email && credentials[role].password);

  if (roles.some((role) => Boolean(credentials[role].email || credentials[role].password)) && !roles.every(complete)) {
    throw new Error('knowledge workspace QA credentials must be configured for all three roles');
  }
  return roles.every(complete) ? credentials : null;
}

async function runCapture(environment) {
  const child = spawn('npx', ['--yes', 'tsx', 'scripts/tests/capture-knowledge-workspace-product-qa.ts'], {
    env: environment,
    stdio: 'inherit',
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`knowledge workspace QA capture exited ${signal ? `from ${signal}` : `with ${code ?? 1}`}`));
    });
  });
}

async function main() {
  const configured = configuredRoleCredentials();
  const [{ provisionLocalKnowledgeWorkspaceQaAccounts }, { accountByKey }] = await Promise.all([
    import('./knowledge-workspace-product-qa-accounts.ts'),
    import('../db/verified-test-accounts.mjs'),
  ]);
  const managed = configured ? null : await provisionLocalKnowledgeWorkspaceQaAccounts(baseUrl);
  const credentials = configured ?? (managed
    ? Object.fromEntries(roles.map((role) => {
      const account = accountByKey(role);
      return [role, { email: account.loginId, password: account.password }];
    }))
    : null);
  if (!credentials) {
    throw new Error('non-local knowledge workspace QA requires explicit credentials for student, teacher, and admin');
  }

  const childEnvironment = { ...process.env, KNOWLEDGE_QA_BASE_URL: baseUrl };
  for (const role of roles) {
    const environment = roleEnvironment[role];
    childEnvironment[environment.email] = credentials[role].email;
    childEnvironment[environment.password] = credentials[role].password;
  }
  await runCapture(childEnvironment);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
