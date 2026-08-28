export const TEACHING_PROJECTION_PUBLISHING_SCHEMA_VERSION =
  'act-teaching-projection-publishing-cli/v1' as const;

export const PUBLISHING_COMMAND_IDS = [
  'teaching-projection:inventory',
  'teaching-projection:qualify',
  'teaching-projection:rebase',
  'teaching-projection:publish',
  'teaching-projection:verify',
] as const;

export type PublishingCommandId = (typeof PUBLISHING_COMMAND_IDS)[number];

export interface PublishingReceipt {
  readonly schemaVersion: typeof TEACHING_PROJECTION_PUBLISHING_SCHEMA_VERSION;
  readonly commandId: PublishingCommandId | 'teaching-projection:check';
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly inputDigest: string;
  readonly outputDigest: string;
  readonly fileCount: number;
  readonly callerCount: number;
  readonly status: 'ok' | 'failed';
  readonly executed: false;
  readonly productionActivation: false;
}
