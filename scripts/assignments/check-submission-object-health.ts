import { createSubmissionGcObjectStore, createSubmissionObjectScanner, createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { createSubmissionContentScanner } from '../../src/lib/assignments/submission-scanner';

async function main() {
  const role = process.env.SUBMISSION_HEALTH_ROLE;
  if (role === 'app') await createSubmissionObjectStore().healthCheck();
  else if (role === 'scanner') await Promise.all([createSubmissionObjectScanner().healthCheck(), createSubmissionContentScanner().healthCheck()]);
  else if (role === 'gc') await createSubmissionGcObjectStore().healthCheck();
  else throw new Error('SUBMISSION_HEALTH_ROLE must be app, scanner, or gc');
  process.stdout.write(`${JSON.stringify({ submissionStorage: 'healthy', role })}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : 'submission-storage-unhealthy'}\n`); process.exitCode = 1; });
