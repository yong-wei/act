import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const taxonomyPath = 'src/lib/classroom-analytics/event-taxonomy.ts';
const buildEventPath = 'src/features/interactive/session-framework/build-course-event.ts';
const trackingPath = 'src/features/interactive/hooks/useInteractiveTracking.ts';
const providerPath = 'src/features/interactive/InteractiveProvider.tsx';
const aiHookPath = 'src/features/interactive/hooks/useInteractiveAI.ts';
const courseTrackingPath = 'src/features/interactive/session-framework/use-course-event-tracking.ts';
const workspaceTelemetryPath = 'src/features/interactive/session-framework/workspace-parameter-telemetry.ts';

assert.equal(
  fs.existsSync(path.join(root, taxonomyPath)),
  true,
  '应新增课堂事件 taxonomy 文件'
);

assert.equal(
  fs.existsSync(path.join(root, buildEventPath)),
  true,
  '应新增 build-course-event.ts'
);

assert.equal(
  fs.existsSync(path.join(root, courseTrackingPath)),
  true,
  '应新增 use-course-event-tracking.ts'
);

assert.equal(
  fs.existsSync(path.join(root, workspaceTelemetryPath)),
  true,
  '应新增共享 workspace-parameter-telemetry.ts，参数滑块埋点不得散落在各课次'
);

const taxonomy = read(taxonomyPath);
const buildEvent = read(buildEventPath);
const tracking = read(trackingPath);
const provider = read(providerPath);
const aiHook = read(aiHookPath);
const courseTracking = read(courseTrackingPath);
const workspaceTelemetry = fs.existsSync(path.join(root, workspaceTelemetryPath))
  ? read(workspaceTelemetryPath)
  : '';

for (const eventName of [
  'lesson_step_view',
  'lesson_step_leave',
  'lesson_submit',
  'lesson_resubmit',
  'workspace_param_change',
  'ai_panel_open',
  'ai_query_submit',
  'sync_error',
  'session_finalize',
]) {
  assert.equal(
    taxonomy.includes(eventName),
    true,
    `taxonomy 应覆盖 ${eventName}`
  );
}

assert.equal(
  buildEvent.includes('sessionId') &&
    buildEvent.includes('lessonKey') &&
    buildEvent.includes('stepId') &&
    buildEvent.includes('actorRole') &&
    buildEvent.includes('resourceKey') &&
    buildEvent.includes('clientEventAt'),
  true,
  '事件 builder 应补齐 sessionId / lessonKey / stepId / actorRole / resourceKey / clientEventAt'
);

assert.equal(
  tracking.includes('resourceKey') &&
    tracking.includes('resourceId') &&
    tracking.includes('sessionId') &&
    tracking.includes('userId') &&
    tracking.includes('interactive_events_'),
  true,
  'useInteractiveTracking 应同时适配 resourceKey/resourceId，并在缓存键中包含 sessionId/userId'
);

assert.equal(
  tracking.includes('resourceKey ?? resourceId') ||
    tracking.includes('resourceKey || resourceId') ||
    tracking.includes('resolveTrackingResourceIdentity'),
  true,
  'useInteractiveTracking 应兼容旧链路，仅传 resourceId 时仍能工作'
);

assert.equal(
  aiHook.includes('onEvent') &&
    aiHook.includes('ai_query_submit'),
  true,
  'useInteractiveAI 应接受事件回调，并显式暴露 ai_query_submit 事件'
);

assert.equal(
  provider.includes('onEvent') &&
    provider.includes('ai_panel_open') &&
    provider.includes('useInteractiveTracking') &&
    !provider.includes("tracking.emit('ai_query', { question: message.content })"),
  true,
  'InteractiveProvider 应把 AI 面板事件和埋点链路接起来，并避免重复 ai_query 埋点'
);

assert.equal(
  courseTracking.includes('buildCourseEvent') &&
    courseTracking.includes('lesson_step_view') &&
    courseTracking.includes('lesson_submit') &&
    courseTracking.includes('sync_error') &&
    courseTracking.includes('trackStepLeave') &&
    courseTracking.includes('trackLessonResubmit') &&
    courseTracking.includes('trackWorkspaceParamChange') &&
    courseTracking.includes('trackSessionFinalize'),
  true,
  '课程页事件适配层应复用 buildCourseEvent，并补齐高频 helper'
);

assert.equal(
  workspaceTelemetry.includes('createWorkspaceParameterTelemetryBuffer') &&
    workspaceTelemetry.includes('flushReason') &&
    workspaceTelemetry.includes('changeCount') &&
    workspaceTelemetry.includes('WORKSPACE_PARAM_IDLE_FLUSH_MS'),
  true,
  '参数滑块埋点应由共享缓冲器合并、标注 flushReason/changeCount，并按空闲窗口消化'
);

assert.equal(
  courseTracking.includes('createWorkspaceParameterTelemetryBuffer') &&
    courseTracking.includes('flushWorkspaceParamChanges') &&
    courseTracking.includes('collectDueWorkspaceParamChanges'),
  true,
  'useCourseEventTracking 应复用共享参数埋点缓冲器，并在 step leave/submit/finalize 前 flush'
);

assert.equal(
  courseTracking.includes('eventType: eventType') ||
    courseTracking.includes('eventType,'),
  true,
  '课程语义事件名必须进入 payload 的 data.eventType'
);

console.log('course event tracking contract test passed');
