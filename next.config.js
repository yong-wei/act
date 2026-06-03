const contentTraceExcludes = [
  './course-content/authoring/lessons/**/*',
  './course-content/authoring/knowledge/**/*',
  './course-content/authoring/shared/**/*',
  '!./course-content/authoring/shared/lesson-id-map.json',
  './course-content/runtime/**/*',
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
  outputFileTracingIncludes: {
    '/*': [
      './course-content/authoring/shared/lesson-id-map.json',
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
}

module.exports = nextConfig
