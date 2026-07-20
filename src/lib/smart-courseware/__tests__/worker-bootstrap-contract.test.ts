import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('smart courseware production worker bootstrap', () => {
  it('starts and closes the BullMQ consumer in the deployed restartable worker process', () => {
    const worker = readFileSync('scripts/workers/data-governance-worker.ts', 'utf8');
    const consumer = readFileSync('src/lib/smart-courseware/worker.ts', 'utf8');
    const queue = readFileSync('src/lib/smart-courseware/queue.ts', 'utf8');
    const wrapper = readFileSync('deploy/podman/container-start-wrapper.sh', 'utf8');
    const deploy = readFileSync('deploy/podman/deploy.sh', 'utf8');

    expect(worker).toContain('await ensureCoursewareGenerationWorker(redis);');
    expect(queue).not.toContain('ensureCoursewareGenerationWorker');
    expect(worker).toContain("console.log('[Worker] Smart courseware generation worker started');");
    expect(worker).toContain('cleanupTasks.push(closeCoursewareGenerationWorker());');
    expect(consumer).toContain('new Worker<{ jobId: string }>(');
    expect(consumer).toContain('COURSEWARE_GENERATION_QUEUE,');
    expect(consumer).toContain('processCoursewareGenerationJob(prisma, job.data.jobId)');
    expect(wrapper).toContain('scripts/workers/data-governance-worker.ts');
    expect(deploy).toContain('--restart unless-stopped');
    expect(deploy).toContain('/app-container-start-wrapper.sh worker');
  });
});
