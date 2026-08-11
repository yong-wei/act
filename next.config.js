const path = require('node:path');

const buildFilesystemRoot = process.env.ACT_NEXT_BUILD_FILESYSTEM_ROOT;

const runtimeCatalogTraceIncludes = [
  './course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
  './course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl',
];

const contentTraceExcludes = [
  './course-content/authoring/lessons/**/*',
  './course-content/authoring/knowledge/**/*',
  './course-content/authoring/shared/**/*',
  '!./course-content/authoring/shared/lesson-id-map.json',
  './course-content/runtime/**/*',
  ...runtimeCatalogTraceIncludes.map((entry) => `!${entry}`),
  './course-content/.codex/**/*',
  './course-content/docs/**/*',
  './course-content/notes/**/*',
  './course-content/questions/**/*',
  './course-content/resource-library/**/*',
  './course-content/scripts/**/*',
  './course-content/slides-ref/**/*',
  './course-content/syllabus-refactor/**/*',
  './course-content/tests/**/*',
  './course-content/AGENTS.override.md',
  './course-content/CLAUDE.md',
  './course-content/README.md',
  './docs/**/*',
  './generated-images/**/*',
  './openspec/**/*',
  './rust/**/*',
  './tests/**/*',
  './.codex/**/*',
  './.wolf/**/*',
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 2,
  },
  turbopack: {
    ...(buildFilesystemRoot ? { root: buildFilesystemRoot } : {}),
    resolveAlias: {
      three: './src/lib/three-runtime-compat.ts',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
  },
  output: 'standalone',
  serverExternalPackages: ['@alicloud/credentials', 'ali-oss'],
  ...(buildFilesystemRoot ? { outputFileTracingRoot: buildFilesystemRoot } : {}),
  outputFileTracingIncludes: {
    '/*': [
      './course-content/authoring/shared/lesson-id-map.json',
      ...runtimeCatalogTraceIncludes,
    ],
    '/api/content/mdx': [
      './content/**/*',
    ],
  },
  outputFileTracingExcludes: {
    '/*': contentTraceExcludes,
    '/api/*': contentTraceExcludes,
    '/api/content/*': contentTraceExcludes,
    '/api/content/mdx': contentTraceExcludes,
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      three$: path.resolve(__dirname, 'src/lib/three-runtime-compat.ts'),
    };
    return config;
  },
}

module.exports = nextConfig
