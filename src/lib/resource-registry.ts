/**
 * 资源注册表
 * Resource Registry
 *
 * 管理原子资源的注册、加载和检索
 */

import type {
  Resource,
  ResourceType,
  ResourcePool,
  LessonManifest,
  ConceptResource,
  WidgetResource,
  QuizResource,
  VideoResource,
} from '@/types/schema';

// ===== 资源池单例 =====

let resourcePool: ResourcePool = {
  resources: {},
  byType: {
    concept: [],
    widget: [],
    quiz: [],
    video: [],
  },
  byTag: {},
};

// ===== 注册函数 =====

/**
 * 注册单个资源
 */
export function registerResource(resource: Resource): void {
  const { id, type, tags } = resource;

  // 添加到主映射
  resourcePool.resources[id] = resource;

  // 添加到类型索引
  if (!resourcePool.byType[type].includes(id)) {
    resourcePool.byType[type].push(id);
  }

  // 添加到标签索引
  tags.forEach((tag) => {
    if (!resourcePool.byTag[tag]) {
      resourcePool.byTag[tag] = [];
    }
    if (!resourcePool.byTag[tag].includes(id)) {
      resourcePool.byTag[tag].push(id);
    }
  });
}

/**
 * 批量注册资源
 */
export function registerResources(resources: Resource[]): void {
  resources.forEach(registerResource);
}

/**
 * 注销资源
 */
export function unregisterResource(id: string): boolean {
  const resource = resourcePool.resources[id];
  if (!resource) return false;

  const { type, tags } = resource;

  // 从主映射删除
  delete resourcePool.resources[id];

  // 从类型索引删除
  resourcePool.byType[type] = resourcePool.byType[type].filter(
    (rid) => rid !== id
  );

  // 从标签索引删除
  tags.forEach((tag) => {
    if (resourcePool.byTag[tag]) {
      resourcePool.byTag[tag] = resourcePool.byTag[tag].filter(
        (rid) => rid !== id
      );
    }
  });

  return true;
}

// ===== 检索函数 =====

/**
 * 获取单个资源
 */
export function getResource(id: string): Resource | null {
  return resourcePool.resources[id] || null;
}

/**
 * 获取指定类型的资源
 */
export function getResourceById<T extends ResourceType>(
  id: string,
  expectedType: T
): (T extends 'concept'
  ? ConceptResource
  : T extends 'widget'
    ? WidgetResource
    : T extends 'quiz'
      ? QuizResource
      : T extends 'video'
        ? VideoResource
        : Resource) | null {
  const resource = resourcePool.resources[id];
  if (!resource || resource.type !== expectedType) return null;
  return resource as ReturnType<typeof getResourceById<T>>;
}

/**
 * 获取指定类型的所有资源
 */
export function getResourcesByType(type: ResourceType): Resource[] {
  return resourcePool.byType[type].map((id) => resourcePool.resources[id]);
}

/**
 * 获取指定标签的所有资源
 */
export function getResourcesByTag(tag: string): Resource[] {
  const ids = resourcePool.byTag[tag] || [];
  return ids.map((id) => resourcePool.resources[id]);
}

/**
 * 获取指定多个标签的资源（交集）
 */
export function getResourcesByTags(
  tags: string[],
  mode: 'and' | 'or' = 'or'
): Resource[] {
  if (tags.length === 0) return [];

  const tagSets = tags.map((tag) => new Set(resourcePool.byTag[tag] || []));

  let resultIds: Set<string>;

  if (mode === 'and') {
    // 交集：必须包含所有标签
    resultIds = tagSets.reduce((acc, set) => {
      return new Set(Array.from(acc).filter((id) => set.has(id)));
    });
  } else {
    // 并集：包含任一标签
    resultIds = tagSets.reduce((acc, set) => {
      const combined = Array.from(acc).concat(Array.from(set));
      return new Set(combined);
    });
  }

  return Array.from(resultIds).map((id) => resourcePool.resources[id]);
}

/**
 * 搜索资源
 */
export function searchResources(query: string): Resource[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(resourcePool.resources).filter((resource) => {
    return (
      resource.title.toLowerCase().includes(lowerQuery) ||
      resource.id.toLowerCase().includes(lowerQuery) ||
      resource.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  });
}

// ===== 课程相关函数 =====

/**
 * 获取课程所需的所有资源
 */
export function getResourcesForLesson(
  manifest: LessonManifest
): Record<string, Resource> {
  const resources: Record<string, Resource> = {};

  manifest.steps.forEach((step) => {
    const resource = resourcePool.resources[step.resourceId];
    if (resource) {
      resources[step.resourceId] = resource;
    }
  });

  return resources;
}

/**
 * 验证课程资源完整性
 */
export function validateLessonResources(
  manifest: LessonManifest
): { valid: boolean; missingIds: string[] } {
  const missingIds: string[] = [];

  manifest.steps.forEach((step) => {
    if (!resourcePool.resources[step.resourceId]) {
      missingIds.push(step.resourceId);
    }
  });

  return {
    valid: missingIds.length === 0,
    missingIds,
  };
}

// ===== 导出和导入 =====

/**
 * 获取完整资源池
 */
export function getResourcePool(): ResourcePool {
  return { ...resourcePool };
}

/**
 * 重置资源池
 */
export function resetResourcePool(): void {
  resourcePool = {
    resources: {},
    byType: {
      concept: [],
      widget: [],
      quiz: [],
      video: [],
    },
    byTag: {},
  };
}

/**
 * 从 JSON 导入资源
 */
export function importResourcesFromJSON(json: Resource[]): void {
  registerResources(json);
}

// ===== 预定义资源（示例数据） =====

/**
 * 初始化示例资源
 */
export function initializeSampleResources(): void {
  const sampleResources: Resource[] = [
    // 概念资源
    {
      id: 'concept-newton-laws',
      type: 'concept',
      title: '牛顿运动定律',
      tags: ['physics', 'modeling', 'fundamentals'],
      contentPath: '/content/concepts/newton-laws.mdx',
      estimatedReadTime: 10,
      difficulty: 2,
    } as ConceptResource,
    {
      id: 'concept-laplace-transform',
      type: 'concept',
      title: '拉普拉斯变换',
      tags: ['math', 'transform', 'frequency-domain'],
      contentPath: '/content/concepts/laplace-transform.mdx',
      estimatedReadTime: 15,
      difficulty: 3,
    } as ConceptResource,

    // 组件资源
    {
      id: 'widget-physics-builder',
      type: 'widget',
      title: '物理建模工坊',
      tags: ['interactive', 'modeling', 'simulation'],
      componentName: 'PhysicsBuilder',
      defaultProps: {
        mode: 'mechanical',
        showEquation: true,
      },
    } as WidgetResource,
    {
      id: 'widget-analogy-mapper',
      type: 'widget',
      title: '机电相似映射器',
      tags: ['interactive', 'analogy'],
      componentName: 'AnalogyMapper',
      defaultProps: {
        showMappingTable: true,
      },
    } as WidgetResource,
    {
      id: 'widget-equation-input',
      type: 'widget',
      title: '方程输入器',
      tags: ['interactive', 'practice'],
      componentName: 'EquationInput',
      defaultProps: {
        enableLatex: true,
        enableAIFeedback: true,
      },
    } as WidgetResource,

    // 测验资源
    {
      id: 'quiz-modeling-basics',
      type: 'quiz',
      title: '建模基础知识探针',
      tags: ['quiz', 'modeling', 'assessment'],
      passingScore: 60,
      shuffleQuestions: false,
      questions: [
        {
          id: 'q1',
          stem: '在弹簧-质量-阻尼系统中，哪个元件存储动能？',
          options: [
            '弹簧 (Spring)',
            '质量块 (Mass)',
            '阻尼器 (Damper)',
            '外力源 (Force)',
          ],
          correctIndex: 1,
          explanation:
            '质量块存储动能（½mv²），弹簧存储势能（½kx²），阻尼器消耗能量。',
          points: 10,
          difficulty: 2,
        },
        {
          id: 'q2',
          stem: '下列哪个是二阶系统的标准形式？',
          options: [
            'm·dx/dt + kx = F',
            'm·d²x/dt² + f·dx/dt + kx = F',
            'dx/dt = ax + bu',
            'x(s)/F(s) = 1/s',
          ],
          correctIndex: 1,
          explanation:
            '二阶系统包含二阶导数项（惯性）、一阶导数项（阻尼）和零阶项（弹性）。',
          points: 10,
          difficulty: 2,
        },
      ],
    } as QuizResource,
  ];

  registerResources(sampleResources);
}
