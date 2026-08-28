import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  captureCleanTextbookInputRevision,
  captureTextbookInputSnapshot,
  removePathSync,
  replaceRuntimeDirectories,
} from '../release/export-textbook-runtime-v2.mjs';
import { loadTextbookResourceSet, textbookBookIds } from '../release/textbook-resource-set.mjs';

const root = process.cwd();
const resourceSetId = loadTextbookResourceSet().resourceSetId;
const authoringInputRoot = path.join(root, 'course-content/authoring/resources');

{
  const calls = [];
  const revision = captureCleanTextbookInputRevision({
    repositoryRoot: root,
    authoringInputRoot,
    runGit(args) {
      calls.push(args);
      return args[0] === 'status' ? '' : 'a'.repeat(40);
    },
  });
  assert.equal(revision, 'a'.repeat(40));
  const gitInputs = calls[0].map((arg) => arg.replaceAll(path.sep, '/'));
  assert.equal(gitInputs.includes('course-content/authoring/resources'), true);
  assert.equal(gitInputs.includes('course-content/scripts/textbook_hybrid_retrieval.py'), true);
  assert.equal(gitInputs.includes('course-content/config/textbook-structure-v2'), true);
}

assert.throws(
  () => captureCleanTextbookInputRevision({
    repositoryRoot: root,
    authoringInputRoot,
    runGit(args) {
      return args[0] === 'status'
        ? ' M course-content/scripts/textbook_hybrid_retrieval.py'
        : 'a'.repeat(40);
    },
  }),
  /textbook-runtime-v2-dirty-inputs/u,
  '生产导出入口必须拒绝生成器、配置或教材输入的未提交改动',
);

for (const dirtyInput of [
  'course-content/scripts/validate_written_textbook_runtime_v2.py',
  'course-content/config/textbook-structure-v2/hu-shousong-auto-control-8th.json',
  'course-content/authoring/resources/textbooks/hu-shousong-auto-control-8th/chapter-03/assets/figure.png',
]) {
  assert.throws(
    () => captureCleanTextbookInputRevision({
      repositoryRoot: root,
      authoringInputRoot,
      runGit(args) {
        return args[0] === 'status' ? ` M ${dirtyInput}` : 'a'.repeat(40);
      },
    }),
    /textbook-runtime-v2-dirty-inputs/u,
    `生产导出入口必须拒绝脏输入 ${dirtyInput}`,
  );
}

assert.throws(
  () => captureCleanTextbookInputRevision({
    repositoryRoot: root,
    authoringInputRoot,
    expectedRevision: 'a'.repeat(40),
    runGit(args) {
      return args[0] === 'status' ? '' : 'b'.repeat(40);
    },
  }),
  /textbook-runtime-v2-input-revision-drift/u,
  '生产导出入口必须拒绝生成期间发生的 HEAD 漂移',
);

assert.throws(
  () => captureCleanTextbookInputRevision({
    repositoryRoot: root,
    authoringInputRoot: path.dirname(root),
    runGit() {
      return '';
    },
  }),
  /textbook-runtime-v2-input-outside-repository/u,
  '无法绑定当前 Git 修订的仓库外教材输入必须 fail closed',
);

{
  const snapshotRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'textbook-runtime-input-snapshot-'),
  );
  try {
    const repositoryRoot = path.join(snapshotRoot, 'repo');
    const authoringInputRoot = path.join(
      repositoryRoot,
      'course-content/authoring/resources',
    );
    fs.mkdirSync(authoringInputRoot, { recursive: true });
    for (const relativeInput of [
      'scripts/release/export-textbook-runtime-v2.mjs',
      'scripts/release/validate-textbook-runtime-v2.mjs',
      'scripts/release/textbook-runtime-v2-provenance.mjs',
      'scripts/release/textbook-runtime-input-provenance.mjs',
      'scripts/release/textbook-resource-set.mjs',
      'course-content/scripts/export_structured_textbook_runtime_v2.py',
      'course-content/scripts/structured_textbook_runtime.py',
      'course-content/scripts/textbook_resource_set.py',
      'course-content/scripts/textbook_runtime_input_provenance.py',
      'course-content/scripts/validate_structured_textbook_runtime_v2.mjs',
      'course-content/scripts/validate_written_textbook_runtime_v2.py',
      'course-content/scripts/textbook_hybrid_retrieval.py',
      'course-content/scripts/validate_textbook_hybrid_retrieval.mjs',
      'course-content/scripts/export_textbook_runtime_assets.py',
      'course-content/contracts/structured-textbook-runtime-v2.schema.json',
      'course-content/contracts/textbook-hybrid-retrieval-v1.schema.json',
      'course-content/config/textbook-hybrid-retrieval.json',
      'course-content/config/textbook-resource-set.json',
    ]) {
      const filePath = path.join(repositoryRoot, relativeInput);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, relativeInput);
    }
    fs.mkdirSync(
      path.join(repositoryRoot, 'course-content/config/textbook-structure-v2'),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(repositoryRoot, 'course-content/config/textbook-structure-v2/book.json'),
      '{}',
    );
    const ignoredAuthoringInput = path.join(
      authoringInputRoot,
      'textbooks/book/chapter-01/textbook.md',
    );
    fs.mkdirSync(path.dirname(ignoredAuthoringInput), { recursive: true });
    fs.writeFileSync(ignoredAuthoringInput, 'version one');
    const before = captureTextbookInputSnapshot({
      repositoryRoot,
      authoringInputRoot,
    });
    fs.writeFileSync(ignoredAuthoringInput, 'version two');
    const after = captureTextbookInputSnapshot({
      repositoryRoot,
      authoringInputRoot,
    });
    assert.notEqual(
      after.digest,
      before.digest,
      '输入内容指纹必须覆盖 Git 忽略且未跟踪的真实教材正文',
    );
    assert.equal(after.fileCount, before.fileCount);
  } finally {
    removePathSync(snapshotRoot);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const dockerignore = read('.dockerignore');
const dockerfile = read('Dockerfile');
const buildScript = read('scripts/build.sh').replaceAll('\r\n', '\n');
const textbookV2Preflight = read('scripts/release/validate-textbook-runtime-v2.mjs');
const textbookV2ProvenanceHelper = read(
  'scripts/release/textbook-runtime-v2-provenance.mjs',
);
const textbookV2ClosureValidator = read(
  'course-content/scripts/validate_written_textbook_runtime_v2.py',
);
const packageJson = JSON.parse(read('package.json'));
const serviceScript = read('deploy/podman/configure-service.sh');
const deployScript = read('deploy/podman/deploy.sh');
const remoteDeployScript = read('scripts/remote-deploy.sh');
const graphCenterSources = read('src/lib/data-governance/graph-center-sources.ts');
const learningGoalBaselineRuntime = read('src/lib/learning-goal-resource-baseline-runtime.ts');
const microTutoringRuntimeSources = [
  'src/features/assessment/micro-tutoring-goal-node-catalog.ts',
  'src/features/assessment/micro-tutoring-option-attribution.ts',
  'src/features/assessment/micro-tutoring-resource-registry.ts',
  'src/features/assessment/micro-tutoring-validation-registry.ts',
].map(read);

assert.equal(
  dockerignore.includes('course-content/runtime'),
  true,
  'Docker 构建上下文应排除 course-content/runtime，避免把运行时资源打进镜像',
);

assert.equal(
  /from ['"].*resource-field-completion-summary\.json['"]/.test(graphCenterSources) ||
    /from ['"].*learning-goal-resource-baseline-matrix\.json['"]/.test(learningGoalBaselineRuntime) ||
    microTutoringRuntimeSources.some((source) => /from ['"].*micro-tutoring-.*\.json['"]/.test(source)),
  false,
  '源码不得静态 import 外置 runtime governance JSON，否则 Docker 构建上下文排除 runtime 后会失败',
);

assert.equal(
  dockerignore.includes('!course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl') &&
    dockerignore.includes('!course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl'),
  true,
  'Docker 构建上下文应只放行自适应测评 catalog 运行态 JSONL，避免 path-owned 选题在 standalone 容器缺失真源',
);

assert.equal(
  buildScript.includes('course-content/runtime') && buildScript.includes('.dockerignore'),
  true,
  '构建脚本应显式校验 course-content/runtime 已被 .dockerignore 排除',
);

const textbookV2BookIds = textbookBookIds();
const textbookV2RequiredFiles = [
  'manifest.json',
  'navigation.json',
  'units.jsonl',
  'anchors.jsonl',
  'windows.jsonl',
  'anomalies.jsonl',
  'samples.jsonl',
];
const textbookRetrievalRequiredFiles = [
  'manifest.json',
  'windows.jsonl',
  'bodies.utf8',
  'vectors.f32',
  'lexical-terms.jsonl',
  'lexical-postings.bin',
  'build-report.json',
];

function createIndexFixture(indexRoot, revision) {
  fs.mkdirSync(indexRoot, { recursive: true });
  for (const fileName of textbookRetrievalRequiredFiles) {
    fs.writeFileSync(
      path.join(indexRoot, fileName),
      fileName === 'manifest.json'
        ? `${JSON.stringify({
          recordType: 'index-manifest',
          formatVersion: 'textbook-hybrid-retrieval.v1',
          sourceRevision: revision,
          resourceSetId,
        })}\n`
        : '',
    );
  }
}

for (const failAtInstall of [2, 3]) {
  const transactionRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), `textbook-runtime-transaction-${failAtInstall}-`),
  );
  try {
    const replacements = [
      ['textbooks-v2', 'runtime'],
      ['textbook-hybrid-retrieval/bge-m3', 'index'],
      ['textbooks', 'assets'],
    ].map(([directoryName, label]) => {
      const target = path.join(transactionRoot, 'current', directoryName);
      const staged = path.join(transactionRoot, 'staged', directoryName);
      fs.mkdirSync(target, { recursive: true });
      fs.mkdirSync(staged, { recursive: true });
      fs.writeFileSync(path.join(target, 'revision.txt'), `old-${label}`);
      fs.writeFileSync(path.join(staged, 'revision.txt'), `new-${label}`);
      return { target, staged, label };
    });
    let installCount = 0;
    assert.throws(
      () => replaceRuntimeDirectories(replacements, {
        renameSync(source, destination) {
          if (source.startsWith(path.join(transactionRoot, 'staged'))) {
            installCount += 1;
            if (installCount === failAtInstall) {
              throw new Error(`injected-install-rename-${failAtInstall}`);
            }
          }
          fs.renameSync(source, destination);
        },
      }),
      new RegExp(`injected-install-rename-${failAtInstall}`, 'u'),
      `第 ${failAtInstall} 个 staged 安装 rename 失败时必须向调用者报告失败`,
    );
    for (const replacement of replacements) {
      assert.equal(
        fs.readFileSync(path.join(replacement.target, 'revision.txt'), 'utf8'),
        `old-${replacement.label}`,
        `第 ${failAtInstall} 个安装失败后 ${replacement.label} 必须恢复旧修订`,
      );
      assert.equal(
        fs.existsSync(`${replacement.target}.previous-${process.pid}`),
        false,
        `第 ${failAtInstall} 个安装失败后不得遗留 ${replacement.label} previous 目录`,
      );
    }
  } finally {
    removePathSync(transactionRoot);
  }
}

{
  const nestedTargetRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'textbook-runtime-nested-target-'),
  );
  try {
    const staged = path.join(nestedTargetRoot, 'staged', 'bge-m3');
    const target = path.join(
      nestedTargetRoot,
      'current',
      'textbook-hybrid-retrieval',
      'bge-m3',
    );
    fs.mkdirSync(staged, { recursive: true });
    fs.writeFileSync(path.join(staged, 'manifest.json'), '{}\n');

    replaceRuntimeDirectories([{ staged, target }]);

    assert.equal(
      fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'),
      '{}\n',
      '嵌套索引目标的父目录不存在时仍应原子安装',
    );
  } finally {
    removePathSync(nestedTargetRoot);
  }
}

if (process.platform !== 'win32') {
  const danglingSymlinkRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'textbook-runtime-dangling-symlink-'),
  );
  try {
    const siblingTarget = path.join(danglingSymlinkRoot, '00-sibling-target');
    const danglingLink = path.join(danglingSymlinkRoot, '99-dangling-link');
    fs.mkdirSync(siblingTarget);
    fs.symlinkSync(siblingTarget, danglingLink, 'dir');

    removePathSync(danglingSymlinkRoot);

    assert.throws(
      () => fs.lstatSync(danglingSymlinkRoot),
      { code: 'ENOENT' },
      '递归清理必须删除其目标已先被删除的悬空符号链接',
    );
  } finally {
    removePathSync(danglingSymlinkRoot);
  }
}

{
  const permissionRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'textbook-runtime-permissions-'),
  );
  try {
    fs.mkdirSync(path.join(permissionRoot, 'current'), { recursive: true });
    const replacements = ['runtime', 'index', 'assets'].map((label) => {
      const staged = path.join(permissionRoot, 'staged', label);
      const nested = path.join(staged, 'nested', 'deeper');
      fs.mkdirSync(nested, { recursive: true });
      for (const directory of [staged, path.dirname(nested), nested]) {
        fs.chmodSync(directory, 0o700);
      }
      const filePath = path.join(nested, `${label}.txt`);
      fs.writeFileSync(filePath, `content-${label}`);
      fs.chmodSync(filePath, 0o600);
      return {
        staged,
        target: path.join(permissionRoot, 'current', label),
      };
    });

    replaceRuntimeDirectories(replacements);

    for (const replacement of replacements) {
      for (const directory of [
        replacement.target,
        path.join(replacement.target, 'nested'),
        path.join(replacement.target, 'nested', 'deeper'),
      ]) {
        if (process.platform !== 'win32') {
          const mode = fs.statSync(directory).mode & 0o777;
          assert.equal(mode & 0o055, 0o055, `${directory} 必须允许 group/other 读取和遍历`);
        }
      }
    }
    for (const replacement of replacements) {
      assert.equal(
        fs.readFileSync(path.join(replacement.target, 'nested', 'deeper', `${path.basename(replacement.target)}.txt`), 'utf8'),
        `content-${path.basename(replacement.target)}`,
        '目录权限规范化不得改变文件内容',
      );
      if (process.platform !== 'win32') {
        assert.equal(
          fs.statSync(path.join(replacement.target, 'nested', 'deeper', `${path.basename(replacement.target)}.txt`)).mode & 0o777,
          0o600,
          '目录权限规范化不得改变文件权限',
        );
      }
    }
  } finally {
    removePathSync(permissionRoot);
  }
}

assert.equal(
  textbookV2ProvenanceHelper.includes('textbookBookIds') &&
    textbookV2ProvenanceHelper.includes('textbookBookCount') &&
    textbookV2RequiredFiles.every((fileName) => textbookV2ProvenanceHelper.includes(`'${fileName}'`)) &&
    textbookV2Preflight.includes('validate_structured_textbook_runtime_v2.mjs') &&
    textbookV2Preflight.includes('validate_written_textbook_runtime_v2.py') &&
    textbookV2Preflight.includes('inspectTextbookRuntimeV2') &&
    textbookV2Preflight.includes('mediaFileCount') &&
    textbookV2Preflight.includes("'--expected-source-revision'") &&
    textbookV2Preflight.includes("'--runtime-dir'") &&
    textbookV2Preflight.includes('failures.slice(0, 20)') &&
    textbookV2Preflight.includes('failuresTruncated') &&
    textbookV2ClosureValidator.includes('validate_written_export'),
  true,
  '共享 release preflight 应校验七本教材的完整 v2 文件集、引用媒体、schema 与跨记录闭合',
);

const mismatchedRuntimeRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'textbook-v2-revision-mismatch-'),
);
try {
  const sharedRevision = '1111111111111111111111111111111111111111';
  const mismatchedRevision = '2222222222222222222222222222222222222222';
  for (const [index, bookId] of textbookV2BookIds.entries()) {
    const bookRoot = path.join(mismatchedRuntimeRoot, bookId);
    fs.mkdirSync(bookRoot, { recursive: true });
    for (const fileName of textbookV2RequiredFiles) {
      const content = fileName === 'manifest.json'
        ? `${JSON.stringify({
          recordType: 'export-manifest',
          schemaVersion: 'structured-textbook-runtime.v2',
          sourceRevision: index === textbookV2BookIds.length - 1
            ? mismatchedRevision
            : sharedRevision,
        })}\n`
        : '';
      fs.writeFileSync(path.join(bookRoot, fileName), content);
    }
  }
  const mismatchResult = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/release/validate-textbook-runtime-v2.mjs'),
      '--runtime-root',
      mismatchedRuntimeRoot,
      '--files-only',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(
    mismatchResult.status,
    0,
    'resourceSet sourceRevision 不一致时 release preflight 必须 fail closed',
  );
  assert.match(
    mismatchResult.stderr,
    /textbook-v2-source-revision-mismatch/u,
    'release preflight 应明确报告 sourceRevision 不一致',
  );
} finally {
  removePathSync(mismatchedRuntimeRoot);
}

const mediaFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-v2-media-'));
try {
  const runtimeRoot = path.join(mediaFixtureRoot, 'textbooks-v2');
  const indexRoot = path.join(mediaFixtureRoot, 'textbook-hybrid-retrieval', 'bge-m3');
  const assetsRoot = path.join(mediaFixtureRoot, 'textbooks');
  const revision = '1111111111111111111111111111111111111111';
  const appRevision = '2222222222222222222222222222222222222222';
  for (const [index, bookId] of textbookV2BookIds.entries()) {
    const bookRoot = path.join(runtimeRoot, bookId);
    fs.mkdirSync(bookRoot, { recursive: true });
    for (const fileName of textbookV2RequiredFiles) {
      let content = '';
      if (fileName === 'manifest.json') {
        content = `${JSON.stringify({
          recordType: 'export-manifest',
          schemaVersion: 'structured-textbook-runtime.v2',
          sourceRevision: revision,
        })}\n`;
      } else if (fileName === 'units.jsonl' && index === 0) {
        content = `${JSON.stringify({
          chapterId: 'chapter-01',
          markdown: '![fixture](assets/fixture.png)',
        })}\n`;
      }
      fs.writeFileSync(path.join(bookRoot, fileName), content);
    }
  }
  createIndexFixture(indexRoot, revision);
  const inputProvenancePath = path.join(runtimeRoot, 'input-provenance.json');
  const writeInputProvenance = () => fs.writeFileSync(
    inputProvenancePath,
    `${JSON.stringify({
      schemaVersion: 'act.textbook-runtime-input-provenance.v1',
      sourceRevision: revision,
      inputDigest: 'a'.repeat(64),
      inputFileCount: 1,
    })}\n`,
  );
  writeInputProvenance();
  const preflightArgs = [
    path.join(root, 'scripts/release/validate-textbook-runtime-v2.mjs'),
    '--runtime-root',
    runtimeRoot,
    '--assets-root',
    assetsRoot,
    '--files-only',
  ];
  const missingMediaResult = spawnSync(process.execPath, preflightArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(
    missingMediaResult.status,
    0,
    'units Markdown 引用的教材媒体缺失时必须 fail closed',
  );
  assert.match(
    missingMediaResult.stderr,
    /textbook-v2-media-file-missing:control-encyclopedia\/assets\/chapter-01\/fixture\.png/u,
    'preflight 应明确报告缺失的引用媒体相对路径',
  );

  const mediaPath = path.join(
    assetsRoot,
    'control-encyclopedia',
    'assets',
    'chapter-01',
    'fixture.png',
  );
  fs.mkdirSync(path.dirname(mediaPath), { recursive: true });
  fs.writeFileSync(mediaPath, 'fixture-v1');
  const initialInspect = spawnSync(process.execPath, preflightArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(initialInspect.status, 0, initialInspect.stderr);
  const initialSummary = JSON.parse(initialInspect.stdout);
  assert.equal(initialSummary.mediaFileCount, 1, 'preflight 应报告去重后的引用媒体文件数');
  fs.unlinkSync(inputProvenancePath);
  const missingInputProvenanceResult = spawnSync(process.execPath, preflightArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(
    missingInputProvenanceResult.status,
    0,
    '缺少输入溯源文件时 release preflight 必须 fail closed',
  );
  assert.match(
    missingInputProvenanceResult.stderr,
    /textbook-v2-input-provenance-missing/u,
    'preflight 应明确报告输入溯源文件缺失',
  );
  writeInputProvenance();

  const imageTar = path.join(mediaFixtureRoot, 'image.tar');
  const sidecar = `${imageTar}.provenance.json`;
  fs.writeFileSync(imageTar, 'image payload');
  const writeSidecarResult = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
      'write-sidecar',
      '--runtime-root',
      runtimeRoot,
      '--index-dir',
      indexRoot,
      '--assets-root',
      assetsRoot,
      '--image-tar',
      imageTar,
      '--app-revision',
      appRevision,
      '--output',
      sidecar,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(writeSidecarResult.status, 0, writeSidecarResult.stderr);
  const sidecarPayload = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  assert.equal(sidecarPayload.appRevision, appRevision);
  assert.equal(sidecarPayload.runtimeSourceRevision, revision);
  assert.equal(sidecarPayload.indexSourceRevision, revision);
  assert.notEqual(
    sidecarPayload.appRevision,
    sidecarPayload.runtimeSourceRevision,
    'application-only refresh 必须允许 appRevision 与外置教材 sourceRevision 独立记录',
  );
  assert.equal(sidecarPayload.runtimeInputDigest, 'a'.repeat(64), 'sidecar 必须绑定 runtime 输入摘要');

  const verifyRuntimeArgs = [
    path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
    'verify-runtime',
    '--runtime-root',
    runtimeRoot,
    '--index-dir',
    indexRoot,
    '--assets-root',
    assetsRoot,
    '--sidecar',
    sidecar,
  ];
  const initialVerifyRuntimeResult = spawnSync(
    process.execPath,
    verifyRuntimeArgs,
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(
    initialVerifyRuntimeResult.status,
    0,
    initialVerifyRuntimeResult.stderr,
    'verify-runtime 必须接受 appRevision 与冻结外置教材 sourceRevision 独立的 provenance',
  );

  fs.writeFileSync(mediaPath, 'fixture-v2-tampered');
  const tamperedInspect = spawnSync(process.execPath, preflightArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(tamperedInspect.status, 0, tamperedInspect.stderr);
  assert.notEqual(
    JSON.parse(tamperedInspect.stdout).runtimeDigest,
    initialSummary.runtimeDigest,
    '篡改被引用媒体必须改变 runtimeDigest',
  );
  const verifyTamperedResult = spawnSync(
    process.execPath,
    verifyRuntimeArgs,
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(
    verifyTamperedResult.status,
    0,
    'sidecar 生成后篡改引用媒体必须使 verify-runtime fail closed',
  );
  assert.match(
    verifyTamperedResult.stderr,
    /textbook-v2-runtime-digest-mismatch/u,
    'verify-runtime 应明确报告媒体篡改造成的 digest 不一致',
  );

  if (process.platform !== 'win32') {
    const chapterRoot = path.dirname(mediaPath);
    const externalChapterRoot = path.join(mediaFixtureRoot, 'external-chapter');
    removePathSync(chapterRoot);
    fs.mkdirSync(externalChapterRoot, { recursive: true });
    fs.writeFileSync(path.join(externalChapterRoot, 'fixture.png'), 'outside assets root');
    fs.symlinkSync(externalChapterRoot, chapterRoot, 'dir');
    const ancestorSymlinkResult = spawnSync(process.execPath, preflightArgs, {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(
      ancestorSymlinkResult.status,
      0,
      '媒体祖先目录 symlink 指向 assets root 外时必须 fail closed',
    );
    assert.match(
      ancestorSymlinkResult.stderr,
      /textbook-v2-media-file-escape:control-encyclopedia\/assets\/chapter-01\/fixture\.png/u,
      'preflight 应明确报告祖先 symlink 造成的媒体路径逃逸',
    );
  }
} finally {
  removePathSync(mediaFixtureRoot);
}

const appOnlyProvenanceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-only-provenance-'));
try {
  const imageTar = path.join(appOnlyProvenanceRoot, 'image.tar');
  const sidecar = `${imageTar}.provenance.json`;
  fs.writeFileSync(imageTar, 'app-only image payload');
  const writeAppOnlyResult = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
      'write-app-only-sidecar',
      '--image-tar',
      imageTar,
      '--app-revision',
      '4'.repeat(40),
      '--output',
      sidecar,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(writeAppOnlyResult.status, 0, writeAppOnlyResult.stderr);
  const appOnlySidecar = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  assert.equal(appOnlySidecar.deploymentScope, 'app-only');
  assert.equal('runtimeSourceRevision' in appOnlySidecar, false);
  const verifyAppOnlyImageResult = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
      'verify-image',
      '--image-tar',
      imageTar,
      '--sidecar',
      sidecar,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(verifyAppOnlyImageResult.status, 0, verifyAppOnlyImageResult.stderr);
  assert.equal(
    JSON.parse(verifyAppOnlyImageResult.stdout).deploymentScope,
    'app-only',
    'app-only sidecar 必须显式声明未绑定 runtime 的部署范围',
  );
  const appOnlyRuntimeVerifyResult = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
      'verify-runtime',
      '--runtime-root',
      appOnlyProvenanceRoot,
      '--index-dir',
      appOnlyProvenanceRoot,
      '--sidecar',
      sidecar,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(
    appOnlyRuntimeVerifyResult.status,
    0,
    'app-only sidecar 不得被误用于 runtime 完整性校验',
  );
  assert.match(
    appOnlyRuntimeVerifyResult.stderr,
    /textbook-v2-provenance-runtime-unavailable-for-app-only/u,
  );
} finally {
  removePathSync(appOnlyProvenanceRoot);
}

const tarMismatchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-v2-tar-mismatch-'));
try {
  const imageTar = path.join(tarMismatchRoot, 'image.tar');
  const sidecar = path.join(tarMismatchRoot, 'image.tar.provenance.json');
  fs.writeFileSync(imageTar, 'tampered image payload');
  fs.writeFileSync(sidecar, `${JSON.stringify({
    schemaVersion: 'act.textbook-runtime-release-provenance.v2',
    appRevision: '1111111111111111111111111111111111111111',
    imageTarSha256: '0'.repeat(64),
    resourceSetId,
    runtimeSourceRevision: '1111111111111111111111111111111111111111',
    runtimeDigest: '1'.repeat(64),
    runtimeInputDigest: '3'.repeat(64),
    indexSourceRevision: '1111111111111111111111111111111111111111',
    indexDigest: '2'.repeat(64),
  })}\n`);
  const tarMismatchResult = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
      'verify-image',
      '--image-tar',
      imageTar,
      '--sidecar',
      sidecar,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(
    tarMismatchResult.status,
    0,
    '镜像 tar 与 sidecar SHA256 不一致时必须 fail closed',
  );
  assert.match(
    tarMismatchResult.stderr,
    /textbook-v2-image-tar-sha256-mismatch/u,
    '镜像校验应明确报告 tar SHA256 不一致',
  );
  fs.writeFileSync(sidecar, `${JSON.stringify({
    schemaVersion: 'act.textbook-runtime-release-provenance.v2',
    appRevision: '3333333333333333333333333333333333333333',
    imageTarSha256: '0'.repeat(64),
    resourceSetId,
    runtimeSourceRevision: '2222222222222222222222222222222222222222',
    runtimeDigest: '1'.repeat(64),
    runtimeInputDigest: '3'.repeat(64),
    indexSourceRevision: '1111111111111111111111111111111111111111',
    indexDigest: '2'.repeat(64),
  })}\n`);
  const revisionMismatchResult = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
      'verify-image',
      '--image-tar',
      imageTar,
      '--sidecar',
      sidecar,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(
    revisionMismatchResult.status,
    0,
    'sidecar 的 runtime 与 retrieval index 修订不一致时必须 fail closed',
  );
  assert.match(
    revisionMismatchResult.stderr,
    /textbook-v2-provenance-runtime-index-revision-mismatch/u,
    'sidecar 校验应明确报告 runtime 与 retrieval index 修订不一致',
  );
} finally {
  removePathSync(tarMismatchRoot);
}

assert.equal(
  buildScript.indexOf('scripts/release/validate-textbook-runtime-v2.mjs') <
    buildScript.indexOf('\nSKIP_WASM_BUILD=1 npm run build\n'),
  true,
  'release build 必须在应用构建前执行 resourceSet 教材 v2 preflight',
);

assert.equal(
  buildScript.includes('git status --porcelain=v1 --untracked-files=normal') &&
    buildScript.includes('APP_REVISION="$(git rev-parse HEAD)"') &&
    !buildScript.includes('--expected-source-revision "${APP_REVISION}"') &&
    buildScript.includes('--label "org.opencontainers.image.revision=${APP_REVISION}"') &&
    buildScript.includes('textbook-runtime-v2-provenance.mjs" write-sidecar') &&
    textbookV2ProvenanceHelper.includes('fs.renameSync(temporary, output)') &&
    textbookV2ProvenanceHelper.includes("digest.update('\\0')"),
  true,
  'release build 必须绑定干净 HEAD、教材 runtime digest、镜像 revision label 与原子 provenance sidecar',
);

assert.equal(
  packageJson.scripts['db:export-textbook-resources'].includes('tools/content-knowledge-runtime-release/cli.ts')
    && packageJson.scripts['db:export-textbook-resources'].includes('scripts/release/export-textbook-runtime-v2.mjs'),
  true,
  'package.json 的生产教材导出入口必须经独立 apply-gated CLI 指向 v2 runtime/index/assets 原子导出器',
);

assert.equal(
  packageJson.scripts.build.includes('db:export-textbook-resources'),
  false,
  'Docker/Next build 不得在镜像构建上下文生成外置教材 runtime',
);

assert.equal(
  packageJson.scripts['db:textbook-media-grounding'].startsWith('npm run db:validate-textbook-runtime-v2 &&') &&
    packageJson.scripts['db:rag-citation-anchor-coverage'] ===
      'tsx ./tools/migration-backfill/cli.ts apply -- scripts/db/generate-rag-citation-anchor-coverage.ts',
  true,
  'v2 media grounding 必须验证当前 runtime，历史旧 coverage 不得覆盖 v2 unit 产物',
);

assert.equal(
  dockerfile.includes('FROM base AS builder') && dockerfile.includes('python3 python3-pip make g++'),
  true,
  'Docker builder 必须继承包含 python3 的基础镜像以执行教材 runtime 导出脚本',
);

assert.equal(
  dockerignore.includes('!scripts/knowledge/**') &&
    dockerfile.includes('COPY --from=builder /app/scripts/knowledge ./scripts/knowledge'),
  true,
  '生产镜像必须包含知识图谱同步使用的严格关系校验脚本',
);

assert.equal(
  deployScript.includes('-v "${RUNTIME_CONTENT_DIR}:/app/course-content/runtime:ro"'),
  true,
  'Podman 部署脚本应把外部 runtime 目录只读挂载到容器内 /app/course-content/runtime',
);

assert.equal(
  deployScript.includes('RUNTIME_CONTENT_DIR="${RUNTIME_CONTENT_DIR:-'),
  true,
  'Podman 部署脚本应允许通过 RUNTIME_CONTENT_DIR 配置外部 runtime 目录',
);

assert.equal(
  deployScript.includes('APP_IMAGE="${APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"') &&
    serviceScript.includes('APP_IMAGE="${APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"'),
  true,
  '部署脚本应默认使用 podman load 产生的 localhost 应用镜像，避免误选旧的 docker.io/library 标签',
);

assert.equal(
  deployScript.includes('run_detached_container()') &&
    deployScript.includes('podman start "$name"') &&
    deployScript.includes('WARNING: 容器 ${name} 当前状态为 ${state}，尝试重新启动') &&
    deployScript.includes('run_detached_container "$APP_CONTAINER" podman run -d') &&
    deployScript.includes('run_detached_container "$WORKER_CONTAINER" podman run -d'),
  true,
  'Podman 部署脚本应对 app/worker 创建后停留在 created/exited 的瞬时 runc 启动失败做有限重试',
);

assert.match(
  remoteDeployScript,
  /legacy-rsync 已退役/,
  'legacy-rsync 必须失败关闭，不得再同步本地 course-content/runtime',
);
assert.equal(
  remoteDeployScript.includes('rsync "${runtime_rsync_args[@]}"'),
  false,
  '远端部署不得再包含 course-content/runtime rsync',
);
assert.match(
  remoteDeployScript,
  /RUNTIME_DELIVERY_MODE="\$\{RUNTIME_DELIVERY_MODE:-ossfs-blob-view\}"/,
  '远端部署默认必须使用 ossfs-blob-view，不得默认 rsync runtime',
);

assert.equal(
  remoteDeployScript.includes('LOCAL_PROVENANCE_FILE="${LOCAL_PROVENANCE_FILE:-${LOCAL_IMAGE_TAR}.provenance.json}"') &&
    remoteDeployScript.includes('verify-image') &&
    remoteDeployScript.includes('verify-runtime') &&
    remoteDeployScript.includes('REMOTE_PROVENANCE_FILE') &&
    remoteDeployScript.includes('REMOTE_PROVENANCE_HELPER') &&
    remoteDeployScript.includes('podman image inspect') &&
    remoteDeployScript.includes('org.opencontainers.image.revision') &&
    remoteDeployScript.includes('loaded image revision mismatch'),
  true,
  '普通与 skip-build 部署必须验证并上传 sidecar，复核远端 runtime/tar，并在启动应用前核对镜像 revision label',
);

assert.equal(
  remoteDeployScript.includes('scripts/release/textbook-resource-set.mjs') &&
    remoteDeployScript.includes('TEXTBOOK_V2_BOOK_COUNT') &&
    textbookV2RequiredFiles.every((fileName) => remoteDeployScript.includes(fileName)) &&
    remoteDeployScript.includes('check_container_textbook_v2_files') &&
    remoteDeployScript.includes('/app/course-content/runtime/resources/textbooks-v2') &&
    remoteDeployScript.includes('/app/course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3') &&
    (remoteDeployScript.match(/-eq \\"\$\{TEXTBOOK_V2_BOOK_COUNT\}\\"/g)?.length ?? 0) >= 2,
  true,
  '远端宿主与已启动 app 容器必须校验 resourceSet v2 与固定检索索引',
);

assert.equal(
  remoteDeployScript.includes('deploy/podman/deploy.sh') &&
    remoteDeployScript.includes('${REMOTE_PROJECT_DIR}/scripts/4-deploy.sh'),
  true,
  '远端部署脚本应同步最新的 4-deploy.sh 到服务器，确保应用容器挂载外部 runtime 目录',
);

assert.equal(
  serviceScript.includes('pg_isready') &&
    serviceScript.includes('until') &&
    serviceScript.includes('ExecStart=/usr/bin/podman start ${DB_CONTAINER}') &&
    serviceScript.includes("ExecStart=/bin/sh -lc 'until /usr/bin/podman exec") &&
    serviceScript.includes('ExecStart=/bin/sh -lc \'APP_IMAGE=${APP_IMAGE} ACT_KNOWLEDGE_DEPLOYMENT_MODE=${ACT_KNOWLEDGE_DEPLOYMENT_MODE} "${APP_DEPLOY_SCRIPT}" --app-only\''),
    true,
  'systemd 配置脚本应先启动数据库并等待 pg_isready，再以冻结镜像部署应用与 worker，避免 Prisma 首次启动抢跑或回退默认镜像',
);

assert.equal(
  serviceScript.includes('if [[ "$MATH_DOCUMENT_GRADING_WORKER_REQUIRED" =~ ^(1|true|yes)$ ]]') &&
    serviceScript.includes('SUBMISSION_EXEC_STOP_LINES=""') &&
    serviceScript.includes('podman ps --format') &&
    serviceScript.includes('$SUBMISSION_SCANNER_CONTAINER') &&
    serviceScript.includes('$SUBMISSION_GC_CONTAINER'),
  true,
  'systemd 配置脚本仅在数学文档批改 worker 启用时要求并停止作业扫描与 GC 容器',
);

assert.equal(
  remoteDeployScript.includes('deploy/podman/configure-service.sh') &&
    remoteDeployScript.includes('${REMOTE_PROJECT_DIR}/scripts/5-configure-service.sh'),
  true,
  '远端部署脚本应同步最新的 5-configure-service.sh 到服务器，确保 systemd 启动顺序与仓库一致',
);

assert.equal(
  remoteDeployScript.includes("test -d '${REMOTE_RUNTIME_DIR}'"),
  true,
  '远端部署脚本应校验当前选择的 runtime 目录存在后再执行部署验证',
);

assert.equal(
  remoteDeployScript.includes('TEXTBOOK_RUNTIME_BOOK_ID') ||
    remoteDeployScript.includes('search-documents.jsonl') ||
    remoteDeployScript.includes('citation-map.json'),
  false,
  '远端生产部署不得保留旧教材 runtime 文件或单书特殊入口',
);

assert.equal(
  textbookRetrievalRequiredFiles.every((fileName) =>
    textbookV2ProvenanceHelper.includes(`'${fileName}'`)) &&
    buildScript.includes('--index-dir "${TEXTBOOK_RETRIEVAL_INDEX_DIR}"') &&
    remoteDeployScript.includes('--index-dir \'${REMOTE_TEXTBOOK_RETRIEVAL_INDEX_DIR}\''),
  true,
  'build 与远端 ossfs-release 验收必须把固定 index 纳入同一 revision/digest 合同',
);

console.log('runtime externalized deploy test passed');
