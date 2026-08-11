import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import {
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  assertContentAddressedRuntimeReleaseId,
  type ActRuntimeReleaseManifest,
  parseRuntimeReleaseManifest,
  runtimeReleaseManifestObjectKey,
  runtimeReleaseObjectKey,
  serializeRuntimeReleaseManifest,
  verifyRuntimeReleaseDirectory,
} from '@/lib/runtime-release';

export interface RuntimeReleaseStoredObject {
  key: string;
  sizeBytes: number;
}

export interface RuntimeReleaseObjectStore {
  listObjects(prefix: string): Promise<RuntimeReleaseStoredObject[]>;
  putObject(key: string, content: Readable): Promise<void>;
  getObject(key: string): Promise<Readable>;
}

export interface RuntimeReleaseVerificationReceipt {
  schemaVersion: 'runtime-release-verification.v1';
  releaseId: string;
  manifestSha256: string;
  treeSha256: string;
  fileCount: number;
  totalBytes: number;
}

export class RuntimeReleaseStoreError extends Error {
  constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RuntimeReleaseStoreError';
  }
}

function releasePrefix(releaseId: string) {
  return `runtime/releases/${releaseId}/`;
}

async function readStream(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function hashRemoteObject(store: RuntimeReleaseObjectStore, key: string) {
  let content: Readable;
  try {
    content = await store.getObject(key);
  } catch (error) {
    throw new RuntimeReleaseStoreError('runtime-release-remote-object-missing', `Remote runtime object is unavailable: ${key}`, { cause: error });
  }
  const hash = createHash('sha256');
  let sizeBytes = 0;
  for await (const chunk of content) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    sizeBytes += bytes.byteLength;
  }
  return { sizeBytes, sha256: hash.digest('hex') };
}

function assertExactObjectSet(objects: readonly RuntimeReleaseStoredObject[], manifest: ActRuntimeReleaseManifest) {
  const expectedEntries: Array<[string, number]> = [
    [runtimeReleaseManifestObjectKey(manifest.releaseId), Buffer.byteLength(serializeRuntimeReleaseManifest(manifest))],
    ...manifest.files.map((file): [string, number] => [file.objectKey, file.sizeBytes]),
  ];
  const expected = new Map(expectedEntries);
  const actual = new Map(objects.map((object) => [object.key, object.sizeBytes]));
  if (actual.size !== objects.length || actual.size !== expected.size) {
    throw new RuntimeReleaseStoreError('runtime-release-remote-object-set-invalid', 'Remote runtime release has duplicate, missing, or unexpected objects.');
  }
  for (const [key, sizeBytes] of expected) {
    if (actual.get(key) !== sizeBytes) {
      throw new RuntimeReleaseStoreError('runtime-release-remote-object-set-invalid', `Remote runtime release object set differs at: ${key}`);
    }
  }
}

export async function inspectPublishedRuntimeRelease(store: RuntimeReleaseObjectStore, releaseId: string) {
  const manifestKey = runtimeReleaseManifestObjectKey(releaseId);
  let raw: Buffer;
  try {
    raw = await readStream(await store.getObject(manifestKey));
  } catch (error) {
    throw new RuntimeReleaseStoreError('runtime-release-remote-manifest-missing', `Remote runtime release manifest is unavailable: ${manifestKey}`, { cause: error });
  }
  let manifest: ActRuntimeReleaseManifest;
  try {
    manifest = parseRuntimeReleaseManifest(JSON.parse(raw.toString('utf8')));
  } catch (error) {
    throw new RuntimeReleaseStoreError('runtime-release-remote-manifest-invalid', 'Remote runtime release manifest is invalid.', { cause: error });
  }
  if (manifest.releaseId !== releaseId || !raw.equals(Buffer.from(serializeRuntimeReleaseManifest(manifest)))) {
    throw new RuntimeReleaseStoreError('runtime-release-remote-manifest-invalid', 'Remote runtime release manifest is not canonical or is release-mismatched.');
  }
  try {
    assertContentAddressedRuntimeReleaseId(manifest);
  } catch (error) {
    throw new RuntimeReleaseStoreError('runtime-release-remote-manifest-invalid', 'Remote runtime release manifest does not use a content-addressed release identity.', { cause: error });
  }
  return manifest;
}

export async function verifyPublishedRuntimeRelease(store: RuntimeReleaseObjectStore, releaseId: string): Promise<RuntimeReleaseVerificationReceipt> {
  const manifest = await inspectPublishedRuntimeRelease(store, releaseId);
  const objects = await store.listObjects(releasePrefix(releaseId));
  assertExactObjectSet(objects, manifest);
  for (const file of manifest.files) {
    const remote = await hashRemoteObject(store, file.objectKey);
    if (remote.sizeBytes !== file.sizeBytes || remote.sha256 !== file.sha256) {
      throw new RuntimeReleaseStoreError('runtime-release-remote-object-invalid', `Remote runtime object does not match manifest: ${file.path}`);
    }
  }
  return {
    schemaVersion: 'runtime-release-verification.v1',
    releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
  };
}

export async function publishRuntimeRelease(input: {
  store: RuntimeReleaseObjectStore;
  runtimeRoot: string;
  manifest: ActRuntimeReleaseManifest;
}) {
  const manifest = parseRuntimeReleaseManifest(input.manifest);
  try {
    assertContentAddressedRuntimeReleaseId(manifest);
  } catch (error) {
    throw new RuntimeReleaseStoreError('runtime-release-id-not-content-addressed', 'Runtime release id must bind source revision and tree identity before publishing.', { cause: error });
  }
  await verifyRuntimeReleaseDirectory(input.runtimeRoot, manifest);
  const prefix = releasePrefix(manifest.releaseId);
  if ((await input.store.listObjects(prefix)).length > 0) {
    throw new RuntimeReleaseStoreError('runtime-release-already-exists', `Remote runtime release prefix is already occupied: ${prefix}`);
  }
  try {
    for (const file of manifest.files) {
      const absolutePath = path.join(input.runtimeRoot, ...file.path.split('/'));
      await input.store.putObject(file.objectKey, createReadStream(absolutePath));
    }
    await input.store.putObject(
      runtimeReleaseManifestObjectKey(manifest.releaseId),
      Readable.from(Buffer.from(serializeRuntimeReleaseManifest(manifest))),
    );
  } catch (error) {
    throw new RuntimeReleaseStoreError('runtime-release-publish-incomplete', 'Runtime release upload did not complete; no selector may reference this release.', { cause: error });
  }
  const receipt = await verifyPublishedRuntimeRelease(input.store, manifest.releaseId);
  if (receipt.manifestSha256 !== manifest.manifestSha256 || receipt.treeSha256 !== manifest.treeSha256) {
    throw new RuntimeReleaseStoreError('runtime-release-remote-identity-mismatch', 'Remote release verification does not match the manifest submitted by this publisher.');
  }
  return receipt;
}

export type EcsRamRoleOssClient = {
  list(input: { prefix: string; marker?: string }): Promise<{ objects?: Array<{ name?: string; size?: number | string }>; nextMarker?: string }>;
  putStream(key: string, content: Readable): Promise<unknown>;
  getStream(key: string): Promise<{ stream: Readable }>;
  asyncSignatureUrl(key: string, options: { expires: number; method: 'GET' }): Promise<string>;
};

type AliCredentialClient = {
  getCredential(): Promise<{ accessKeyId: string; accessKeySecret: string; securityToken: string }>;
};

export function createEcsRamRoleOssClient(input: {
  bucket: string;
  region: string;
  roleName: string;
}): EcsRamRoleOssClient {
  if (!input.bucket || !input.region || !input.roleName) {
    throw new RuntimeReleaseStoreError('runtime-release-oss-config-invalid', 'OSS bucket, region, and ECS RAM role name are required.');
  }
  const credentialsModule = require('@alicloud/credentials') as {
    default: new (config: unknown) => AliCredentialClient;
    Config: new (config: unknown) => unknown;
  };
  const credentialClient = new credentialsModule.default(new credentialsModule.Config({
    type: 'ecs_ram_role',
    roleName: input.roleName,
    disableIMDSv1: true,
  }));
  const ossConstructor = require('ali-oss') as new (options: {
    bucket: string;
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    stsToken: string;
    refreshSTSTokenInterval: number;
    refreshSTSToken: () => Promise<{ accessKeyId: string; accessKeySecret: string; stsToken: string }>;
  }) => EcsRamRoleOssClient;
  let clientPromise: Promise<EcsRamRoleOssClient> | null = null;
  const client = async () => {
    if (!clientPromise) {
      clientPromise = credentialClient.getCredential().then((credential) => new ossConstructor({
        bucket: input.bucket,
        region: input.region,
        accessKeyId: credential.accessKeyId,
        accessKeySecret: credential.accessKeySecret,
        stsToken: credential.securityToken,
        refreshSTSTokenInterval: 5 * 60 * 1000,
        refreshSTSToken: async () => {
          const refreshed = await credentialClient.getCredential();
          return {
            accessKeyId: refreshed.accessKeyId,
            accessKeySecret: refreshed.accessKeySecret,
            stsToken: refreshed.securityToken,
          };
        },
      }));
    }
    return clientPromise;
  };
  return {
    list: async (input) => (await client()).list(input),
    putStream: async (key, content) => (await client()).putStream(key, content),
    getStream: async (key) => (await client()).getStream(key),
    asyncSignatureUrl: async (key, options) => (await client()).asyncSignatureUrl(key, options),
  };
}

export function createEcsRamRoleOssRuntimeReleaseStore(input: {
  bucket: string;
  region: string;
  roleName: string;
}): RuntimeReleaseObjectStore {
  const client = createEcsRamRoleOssClient(input);
  return {
    async listObjects(prefix) {
      const objects: RuntimeReleaseStoredObject[] = [];
      let marker: string | undefined;
      do {
        const page = await client.list({ prefix, marker });
        objects.push(...(page.objects ?? []).map((object) => ({
          key: String(object.name),
          sizeBytes: Number(object.size),
        })));
        marker = page.nextMarker || undefined;
      } while (marker);
      return objects;
    },
    async putObject(key, content) {
      await client.putStream(key, content);
    },
    async getObject(key) {
      return (await client.getStream(key)).stream;
    },
  };
}

export async function readRuntimeReleaseManifestFromFile(absolutePath: string) {
  return parseRuntimeReleaseManifest(JSON.parse(await readFile(absolutePath, 'utf8')));
}
