import { CRUISE_COURSE_TITLE } from '@/lib/cruise-course';
import { L2A_COURSE_TITLE, L2A_ROUTE_SEGMENT } from '@/lib/l2a-course';
import { L2B_COURSE_TITLE, L2B_ROUTE_SEGMENT } from '@/lib/l2b-course';
import { L2C_COURSE_TITLE, L2C_ROUTE_SEGMENT } from '@/lib/l2c-course';
import { L2D_COURSE_TITLE, L2D_ROUTE_SEGMENT } from '@/lib/l2d-course';
import { LSUM_COURSE_TITLE, LSUM_ROUTE_SEGMENT } from '@/lib/lsum-course';

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
    routeSegment: L2A_ROUTE_SEGMENT,
    aliases: [L2A_COURSE_TITLE],
  },
  {
    routeSegment: L2B_ROUTE_SEGMENT,
    aliases: [L2B_COURSE_TITLE],
  },
  {
    routeSegment: L2C_ROUTE_SEGMENT,
    aliases: [L2C_COURSE_TITLE],
  },
  {
    routeSegment: L2D_ROUTE_SEGMENT,
    aliases: [L2D_COURSE_TITLE],
  },
  {
    routeSegment: LSUM_ROUTE_SEGMENT,
    aliases: [
      LSUM_COURSE_TITLE,
      'L-∑：设计可行域——让约束成为指南针',
      '设计可行域——让约束成为指南针',
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
