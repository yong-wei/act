import { CRUISE_COURSE_TITLE } from '@/lib/cruise-course';
import { LSUM_COURSE_TITLE, LSUM_ROUTE_SEGMENT } from '@/lib/lsum-course';
import { UNIT_2_1_COURSE_TITLE, UNIT_2_1_ROUTE_SEGMENT } from '@/lib/unit-2-1-course';
import { UNIT_2_2_COURSE_TITLE, UNIT_2_2_ROUTE_SEGMENT } from '@/lib/unit-2-2-course';
import { UNIT_2_3_COURSE_TITLE, UNIT_2_3_ROUTE_SEGMENT } from '@/lib/unit-2-3-course';
import { UNIT_2_4_COURSE_TITLE, UNIT_2_4_ROUTE_SEGMENT } from '@/lib/unit-2-4-course';
import { UNIT_3_1_COURSE_TITLE, UNIT_3_1_ROUTE_SEGMENT } from '@/lib/unit-3-1-course';
import { UNIT_3_2_COURSE_TITLE, UNIT_3_2_ROUTE_SEGMENT } from '@/lib/unit-3-2-course';
import { UNIT_3_3_COURSE_TITLE, UNIT_3_3_ROUTE_SEGMENT } from '@/lib/unit-3-3-course';
import { UNIT_3_4_COURSE_TITLE, UNIT_3_4_ROUTE_SEGMENT } from '@/lib/unit-3-4-course';
import { UNIT_3_5_COURSE_TITLE, UNIT_3_5_ROUTE_SEGMENT } from '@/lib/unit-3-5-course';
import { UNIT_3_6_COURSE_TITLE, UNIT_3_6_ROUTE_SEGMENT } from '@/lib/unit-3-6-course';
import { UNIT_3_7_COURSE_TITLE, UNIT_3_7_ROUTE_SEGMENT } from '@/lib/unit-3-7-course';
import { UNIT_3_8_COURSE_TITLE, UNIT_3_8_ROUTE_SEGMENT } from '@/lib/unit-3-8-course';
import { UNIT_3_9_COURSE_TITLE, UNIT_3_9_ROUTE_SEGMENT } from '@/lib/unit-3-9-course';
import { UNIT_4_1_COURSE_TITLE, UNIT_4_1_ROUTE_SEGMENT } from '@/lib/unit-4-1-course';
import { UNIT_4_2_COURSE_TITLE, UNIT_4_2_ROUTE_SEGMENT } from '@/lib/unit-4-2-course';
import { UNIT_4_3_COURSE_TITLE, UNIT_4_3_ROUTE_SEGMENT } from '@/lib/unit-4-3-course';
import { UNIT_4_4_COURSE_TITLE, UNIT_4_4_ROUTE_SEGMENT } from '@/lib/unit-4-4-course';
import { UNIT_4_6_COURSE_TITLE, UNIT_4_6_ROUTE_SEGMENT } from '@/lib/unit-4-6-course';
import { UNIT_4_7_COURSE_TITLE, UNIT_4_7_ROUTE_SEGMENT } from '@/lib/unit-4-7-course';
import { UNIT_5_1_COURSE_TITLE, UNIT_5_1_ROUTE_SEGMENT } from '@/lib/unit-5-1-course';

const CRUISE_ROUTE_SEGMENT = 'cruise-comfort-boppps';
const UNIT_4_5_ROUTE_SEGMENT = 'unit-4-5-constraint-aware-parameter-optimization';
const UNIT_4_5_COURSE_TITLE =
  '4-5：约束下的优化设计实践：参数约束翻译与带约束参数优化';

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
  {
    routeSegment: UNIT_2_3_ROUTE_SEGMENT,
    aliases: [
      UNIT_2_3_COURSE_TITLE,
      '2-3：频率响应基础与 Bode 图初步——从时域现象到频域图形入口',
      '频率响应基础与 Bode 图初步——从时域现象到频域图形入口',
      '频率响应基础与 Bode 图初步',
    ],
  },
  {
    routeSegment: UNIT_2_4_ROUTE_SEGMENT,
    aliases: [
      UNIT_2_4_COURSE_TITLE,
      '2-4：Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别',
      'Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别',
      'Nyquist 图与频域指标入口',
    ],
  },
  {
    routeSegment: UNIT_3_1_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_1_COURSE_TITLE,
      '3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解',
      '纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解',
      '纯极点视角下的稳定、模态与双域近似',
    ],
  },
  {
    routeSegment: UNIT_3_2_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_2_COURSE_TITLE,
      '3-2：劳斯判据——从高阶系统稳定判定到参数可行域',
      '劳斯判据——从高阶系统稳定判定到参数可行域',
      '劳斯判据',
    ],
  },
  {
    routeSegment: UNIT_3_3_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_3_COURSE_TITLE,
      '3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移',
      '根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移',
      '根轨迹机制与完整法则',
    ],
  },
  {
    routeSegment: UNIT_3_4_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_4_COURSE_TITLE,
      '3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上',
      '根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上',
      '根轨迹读图与对象化验证',
    ],
  },
  {
    routeSegment: UNIT_3_5_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_5_COURSE_TITLE,
      '3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变',
      '零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变',
      '零点引入与动态改善',
    ],
  },
  {
    routeSegment: UNIT_3_6_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_6_COURSE_TITLE,
      '3-6：零点作用与动态改善实验——从性能目标到校正设计',
      '零点作用与动态改善实验——从性能目标到校正设计',
      '零点作用与动态改善实验',
    ],
  },
  {
    routeSegment: UNIT_3_7_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_7_COURSE_TITLE,
      '3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理',
      '型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理',
      '型别、积分环节与稳态改善',
    ],
  },
  {
    routeSegment: UNIT_3_8_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_8_COURSE_TITLE,
      '3-8：频域判别与跨域综合语言',
      '频域判别与跨域综合语言',
    ],
  },
  {
    routeSegment: UNIT_3_9_ROUTE_SEGMENT,
    aliases: [
      UNIT_3_9_COURSE_TITLE,
      '3-9：稳定—动态—稳态综合映射实验',
      '稳定—动态—稳态综合映射实验',
    ],
  },
  {
    routeSegment: UNIT_4_1_ROUTE_SEGMENT,
    aliases: [
      UNIT_4_1_COURSE_TITLE,
      '4-1：设计起点：性能指标体系、工程约束与可行域表达',
      '设计起点：性能指标体系、工程约束与可行域表达',
      '设计起点',
    ],
  },
  {
    routeSegment: UNIT_4_2_ROUTE_SEGMENT,
    aliases: [
      UNIT_4_2_COURSE_TITLE,
      '4-2：控制器选型原理：不同控制结构为何适合不同任务',
      '控制器选型原理：不同控制结构为何适合不同任务',
      '控制器选型原理',
    ],
  },
  {
    routeSegment: UNIT_4_3_ROUTE_SEGMENT,
    aliases: [
      UNIT_4_3_COURSE_TITLE,
      '4-3：初始方案落地实践：从对象分析到结构组合与首轮验证',
      '初始方案落地实践：从对象分析到结构组合与首轮验证',
      '初始方案落地实践',
    ],
  },
  {
    routeSegment: UNIT_4_4_ROUTE_SEGMENT,
    aliases: [
      UNIT_4_4_COURSE_TITLE,
      '4-4：多目标权衡与控制器优化设计',
      '多目标权衡与控制器优化设计',
    ],
  },
  {
    routeSegment: UNIT_4_5_ROUTE_SEGMENT,
    aliases: [
      UNIT_4_5_COURSE_TITLE,
      '4-5：约束下的优化设计实践',
      '约束下的优化设计实践',
    ],
  },
  {
    routeSegment: UNIT_4_6_ROUTE_SEGMENT,
    aliases: [
      UNIT_4_6_COURSE_TITLE,
      '4-6：场景迁移与方案比较',
      '固定结构优化边界与结构编码入口',
      '场景迁移与方案比较',
    ],
  },
  {
    routeSegment: UNIT_4_7_ROUTE_SEGMENT,
    aliases: [
      UNIT_4_7_COURSE_TITLE,
      '4-7：高保真辨识、设计验证与扰动边界',
      '高保真辨识、设计验证与扰动边界',
      '完整工程设计闭环实践',
    ],
  },
  {
    routeSegment: UNIT_5_1_ROUTE_SEGMENT,
    aliases: [
      UNIT_5_1_COURSE_TITLE,
      '5-1：线性主干的边界',
      '线性主干的边界',
      '饱和、死区、滞回、切换与模型失配',
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
