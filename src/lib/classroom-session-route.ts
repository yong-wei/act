import { CRUISE_COURSE_TITLE } from '@/lib/cruise-course';
import { LSUM_COURSE_TITLE, LSUM_ROUTE_SEGMENT } from '@/lib/lsum-course';
import { UNIT_2_1_COURSE_TITLE, UNIT_2_1_ROUTE_SEGMENT } from '@/lib/unit-2-1-course';
import { UNIT_2_2_COURSE_TITLE, UNIT_2_2_ROUTE_SEGMENT } from '@/lib/unit-2-2-course';

const CRUISE_ROUTE_SEGMENT = 'cruise-comfort-boppps';

type SessionRole = 'teacher' | 'student';

interface PremiumRouteDescriptor {
  routeSegment: string;
  aliases: string[];
}

const PREMIUM_ROUTE_DESCRIPTORS: PremiumRouteDescriptor[] = [
  {
    routeSegment: CRUISE_ROUTE_SEGMENT,
    aliases: [
      CRUISE_COURSE_TITLE,
      '柔性之海——豪华邮轮的舒适度控制',
    ],
  },
  {
    routeSegment: LSUM_ROUTE_SEGMENT,
    aliases: [
      LSUM_COURSE_TITLE,
      'L-∑：设计可行域——让约束成为指南针',
      '设计可行域——让约束成为指南针',
    ],
  },
  {
    routeSegment: UNIT_2_1_ROUTE_SEGMENT,
    aliases: [
      UNIT_2_1_COURSE_TITLE,
      '2-1：建模与变换语言——从真实对象到统一分析对象',
      '建模与变换语言——从真实对象到统一分析对象',
      '建模与变换语言',
    ],
  },
  {
    routeSegment: UNIT_2_2_ROUTE_SEGMENT,
    aliases: [
      UNIT_2_2_COURSE_TITLE,
      '2-2：时域响应基础——从响应曲线到动态性能指标',
      '时域响应基础——从响应曲线到动态性能指标',
    ],
  },
];

function normalizePlanTitle(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[（(]副本[）)]$/, '')
    .replace(/[：:]/g, '：');
}

export function resolveSessionRouteFromPlanTitle(planTitle: string | null | undefined) {
  const normalizedTitle = normalizePlanTitle(planTitle);

  for (const descriptor of PREMIUM_ROUTE_DESCRIPTORS) {
    if (descriptor.aliases.some((alias) => normalizedTitle.startsWith(normalizePlanTitle(alias)))) {
      return {
        routeSegment: descriptor.routeSegment,
        isPremiumCourse: true,
      };
    }
  }

  return {
    routeSegment: null,
    isPremiumCourse: false,
  };
}

export function buildSessionParticipantHref({
  role,
  sessionId,
  planTitle,
}: {
  role: SessionRole;
  sessionId: string;
  planTitle: string | null | undefined;
}) {
  const { routeSegment } = resolveSessionRouteFromPlanTitle(planTitle);
  if (routeSegment) {
    return `/interactive-learning/courses/${routeSegment}/${role}/${sessionId}`;
  }
  return `/classroom/${role}/${sessionId}`;
}
