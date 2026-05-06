#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from typing import Any

from infograph_utils import (
    canonical_node_id,
    canonical_sequence,
    extract_section,
    lesson_manifest_path,
    load_all_authoring_nodes,
    load_authoring_relations,
    load_sequence,
    node_card_path,
    node_group_map,
    node_infograph_dir,
    now_iso,
    parse_frontmatter,
    read_json,
    repo_path,
    selected_infograph_ref,
    strip_frontmatter,
    write_json,
    write_text,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Prepare source package and prompt for one node infographic.')
    parser.add_argument('--lesson', required=True, help='Lesson id such as 3-8')
    parser.add_argument('--node', required=True, help='Knowledge node id')
    return parser.parse_args()


def compact_markdown(text: str, max_chars: int = 1800) -> str:
    normalized = re.sub(r'\n{3,}', '\n\n', text.strip())
    if len(normalized) <= max_chars:
        return normalized
    return normalized[:max_chars].rstrip() + '\n...'


def extract_bold_field(markdown: str, label: str) -> str:
    match = re.search(rf'\*\*{re.escape(label)}\*\*：\s*(.+)', markdown)
    return match.group(1).strip() if match else ''


def extract_first_display_formula(markdown: str) -> str:
    match = re.search(r'\$\$\s*([\s\S]*?)\s*\$\$', markdown)
    if not match:
        return ''
    return re.sub(r'\s+', ' ', match.group(1).strip())


def unique_strings(items: list[Any]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        value = str(item).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def formula_anchors(card_formula: str, node_formulas: list[Any]) -> list[str]:
    # Lesson cards can refine a reused node for the current design context.
    # Put the card formula first so the image tests the lesson-specific truth.
    if card_formula:
        return [card_formula]
    return unique_strings(list(node_formulas or []))


def relation_mentions_node(relation: dict[str, Any], node_id: str, node_name: str) -> bool:
    return (
        relation.get('source_id') == node_id
        or relation.get('target_id') == node_id
        or relation.get('source') == node_name
        or relation.get('target') == node_name
        or relation.get('source_name') == node_name
        or relation.get('target_name') == node_name
    )


def relation_summary(relation: dict[str, Any], node_id: str) -> dict[str, Any]:
    return {
        'source_id': relation.get('source_id'),
        'source': relation.get('source') or relation.get('source_name'),
        'target_id': relation.get('target_id'),
        'target': relation.get('target') or relation.get('target_name'),
        'relation': relation.get('relation') or relation.get('relation_type'),
        'strength': relation.get('strength'),
        'description': relation.get('description'),
        'direction_for_node': (
            'outgoing' if relation.get('source_id') == node_id else
            'incoming' if relation.get('target_id') == node_id else
            'by_name'
        ),
    }


def visual_focus_for_node(node_name: str, groups: list[str]) -> str:
    text = f'{node_name} {" ".join(groups)}'
    stable_platform_boundary = '这里的“稳定平台”指船载/设备稳定控制对象或中频响应控制台，不是海上油气平台、钻井平台或港口设施。'
    if '设计任务表达卡' in text:
        return f'用任务卡主板连接客船航向控制和稳定平台两类本课案例证据，表达“先把对象、目标、约束和证据写清，再进入结构筛选”；不要引入水箱、温控、电机等源材料之外的通用案例。{stable_platform_boundary}'
    if '结构工具箱最小语义' in text:
        return '用结构工具箱、频段职责和代价标签表达 PI、PD、超前、滞后、前馈等结构不是名称堆叠，而是作用点和代价来源不同的工具。'
    if '主矛盾到频段职责映射' in text:
        return f'用低频稳态、中频动态和高频噪声三段任务面板连接客船航向控制与稳定平台案例，表达主矛盾先落到频段职责再选结构。{stable_platform_boundary}'
    if '结构作用点与代价来源对照' in text:
        return '用同一闭环框图上的不同结构插入点、Bode 小窗和时域读回表达每种结构改变的位置不同，收益与代价也不同。'
    if '反馈保底与前馈补偿边界' in text:
        return '用反馈闭环作为保底主干，前馈作为可验证补偿支路，表达前馈不能替代反馈稳定性和扰动复核。'
    if '按输入补偿前馈' in text:
        return '用参考输入前馈支路、误差曲线和无差度提升小窗表达按输入补偿只针对给定输入通道，仍需反馈闭环兜底。'
    if '按扰动补偿前馈' in text:
        return '用可测扰动前馈支路、扰动进入点和对消条件小窗表达扰动补偿依赖扰动可测和模型路径匹配。'
    if '单结构首轮起步卡' in text:
        return '用六字段起步卡、客船低频起步和平台中频起步两个分支表达首轮只选择一个主结构，并记录理由、代价和验证指标。'
    if '目标驱动PD校正' in text:
        return f'用稳定平台中频动态需求、左半平面的目标极点区域、根轨迹零点反推和阶跃验收小窗表达 PD 是围绕目标点改善动态品质的结构，不是凭经验先猜微分时间；目标区域和设计点必须位于稳定左半平面。{stable_platform_boundary}'
    if '目标驱动超前校正' in text:
        return f'用稳定平台目标裕度与目标频带、补角窗口、超前网络参数和时域验收链表达超前校正服务中频相位储备与动态品质。{stable_platform_boundary}'
    if 'MASS协同链路' in text:
        return '用海上自主船舶任务链表达感知、估计、规划、控制、执行、监督的依赖关系，突出信息流、控制流和责任边界。'
    if '控制在自主系统链路中的位置' in text:
        return '用规划参考进入控制层、反馈状态回到控制器、执行器输出真实运动的闭环嵌入图表达控制层的接口位置。'
    if '上游信息质量' in text:
        return '用传感器噪声、测量延迟、时间同步和置信度小窗表达控制器看到的是处理后的反馈状态，不等于真实世界本身。'
    if '规划参考可实现性' in text:
        return '用规划路径、航向参考、转弯半径和舵角边界表达参考必须满足控制与执行可行域。'
    if '执行约束反馈' in text:
        return '用舵角饱和、舵速限制和执行器健康状态回传表达执行边界如何反向约束控制与规划。'
    if '链路责任诊断' in text:
        return '用从感知到监督的证据链诊断顺序表达偏差来源逐层定位，避免把复杂系统问题直接压给控制器参数。'
    if '避碰转弯半径可行域' in text:
        return '用避碰海图、障碍物安全圈、三种转弯半径和舵角可行域表达规划半径是否能被控制与执行层实现。'
    if 'MASS自动化等级责任边界' in text:
        return '用四类自动化运行形态与同一底层链路证据并列表达自动化等级不能替代工程链路诊断。'
    if '模型依赖松动' in text:
        return '用名义模型主干、数据补偿层、约束和安全边界共同表达模型不再独自承担全部预测关系，但工程责任仍保留。'
    if 'MPC再定位' in text:
        return '用预测窗口、滚动优化、显式约束和闭环反馈表达 MPC 位于模型驱动与数据驱动之间的中间位置。'
    if '数据驱动控制' in text:
        return '用运行数据集进入控制补偿模块，同时保留物理模型、约束和安全检查，表达数据是设计依据而不是黑箱替代。'
    if '数据覆盖与泛化边界' in text:
        return '用训练数据覆盖区、关键边界工况和未见相邻场景表达样本覆盖不足时的泛化风险。'
    if '在线辨识与模型更新' in text:
        return '用最近闭环数据窗口、参数估计、投影平滑和保守预测表达在线更新不能让模型短时跳变。'
    if '数据驱动进入条件' in node_name:
        return '用数据、算力、验证和泛化四项闸门表达数据驱动模块能否进入闭环控制。'
    if '模型数据责任分配' in text:
        return '用模型结构、数据补偿、约束优化和安全保护四个责任舱表达同一闭环内的证据分工。'
    if '三路线控制比较' in text:
        return '用固定控制、名义模型 MPC、数据驱动模型 MPC 三条路线在同一航向任务中的性能收益和新增风险对比。'
    if '非线性边界工具选择' in text:
        return '用“线性工具可用区 -> 局部线性化 -> 相平面 -> 描述函数 -> 边界观察”的选择台表达何时从线性方法切换到非线性边界工具。'
    if '局部线性化工作点' in text:
        return '用非线性曲面上一点的切平面、工作点邻域和小偏差坐标表达“只在该点附近有效”的局部近似。'
    if '非线性微分方程的线性化' in text:
        return '用非线性函数曲线、工作点切线、偏差变量和 Jacobian 小窗表达从非线性方程到线性近似模型的过程。'
    if '相平面图' in text:
        return '用 x1-x2 相平面、轨线箭头、平衡点和分界轨迹表达非线性系统状态运动的全局观察。'
    if '描述函数法' in text and '适用条件' not in text:
        return '用正弦输入、非线性环节输出、基波提取和频域闭环小窗表达“用等效增益看非线性”的近似思路。'
    if '描述函数适用条件' in text:
        return '用单一非线性、低通线性环节和高次谐波被滤除的小窗表达描述函数法的使用边界。'
    if '自振微小扰动判断' in text:
        return '用交点附近两侧微扰箭头表达振幅扰动后的收敛或发散方向，突出候选自振还需要稳定性判断。'
    if '负倒描述函数' in text:
        return '用复平面上 G(jω) 轨迹与 -1/N(A) 曲线的实际交点表达自振候选点，标出幅值 A 与频率 ω 的读数位置；不要把 Nyquist 的 -1 临界点画成候选交点。'
    if '舵机死区饱和自振风险' in text:
        return '用舵机死区/饱和非线性曲线、闭环舵角反馈和航向振荡波形表达工程自振风险。'
    if '超调量' in text:
        return (
            '用阶跃响应曲线的峰值、实际稳态值和超出部分表达过程接受度；'
            '同时画出单位阶跃参考信号 r(t)=1，用不同线型区分给定值和输出稳态值；'
            '绿色虚线 y_infty 必须穿过响应曲线最终水平尾段，y_infty 标注只能贴在这条稳态线上。'
        )
    if '幅角原理' in text:
        return '用复平面闭合曲线、原点绕行圈数、曲线内部零点和极点表达 N=Z-P 的计数关系。'
    if '统一判稳链' in text or ('奈奎斯特' in text and 'Bode' in text):
        return '左侧画 Nyquist 复平面与 -1 临界点，右侧画 Bode 的 0dB 与 -180° 两条读数线，中间用稳定边界连接。'
    if '主导极点' in text:
        return '用稳定闭环 s 平面极点图表达主导极点判断：所有闭环极点位于左半平面，靠近虚轴且衰减较慢的一组高亮，远离虚轴的极点弱化，并用阶跃响应小窗读回主要动态。'
    if '零点' in text and '右半平面' in text:
        return '用 s 平面左右半平面、根轨迹方向和响应代价提示表达“改善受限制、非最小相要谨慎”。'
    if '零点' in text:
        return '用根轨迹弯曲、阻尼区域和阶跃响应趋势表达结构变化如何改变动态性能。'
    if '低频' in text or '稳态' in text or '补偿' in text:
        return '用低频段增益抬升、误差下降和相位代价检查表达稳态改善路径。'
    if 'Bode' in text or '裕度' in text or '截止频率' in text or '穿越频率' in text:
        return '用 Bode 幅频/相频双图、穿越线和裕度标尺表达读图位置。'
    if '带宽' in text:
        return '用闭环幅频曲线、低频平台、-3 dB 下降线和 ω_b 入口表达“跟得多快”的频域边界。'
    if '超前' in text:
        return '用目标裕度、目标频带、补角窗口、超前网络参数和时域验收五步表达设计方向。'
    if '综合' in text or '统一' in text or '指纹' in text or '读回' in text:
        return '用“频域指纹 -> 判稳余量 -> 三频段任务 -> 闭环读回”的链条表达工程判断，不堆叠公式。'
    if '频率特性' in text or '带宽' in text or '三频段' in text:
        return '用低频-中频-高频三段横向分区表达稳态、快速性、抗噪声之间的分工。'
    if 'Nyquist' in text or '奈奎斯特' in text:
        return '用复平面围线、关键点 -1 和方向箭头表达判稳逻辑，避免画成普通波形图。'
    return '用概念核心、证据位置和判断边界三块表达该知识点，不添加源材料之外的对象。'


def visual_asset_brief_for_node(node_name: str, groups: list[str]) -> str:
    text = f'{node_name} {" ".join(groups)}'
    stable_platform_note = '稳定平台只能画成船载/设备稳定控制对象、姿态稳定台或中频响应控制台；不要画成海上油气平台、钻井平台、港口设施或大桥。'
    if '设计任务表达卡' in text:
        return (
            '主视觉对象：一张工程任务卡放在控制设计工作台中央，卡片上只用短标签显示对象、目标、硬约束、软目标、观察指标、证据来源。\n'
            f'工程场景：左侧小窗使用客船航向控制证据，右侧小窗使用稳定平台频带证据；不要出现水箱、温控、电机、化工管路等源材料之外的案例。{stable_platform_note}\n'
            '核心图示：任务表达卡公式、目标-约束-优先级箭头、证据来源标签，以及通向结构工具箱最小语义的下一步小箭头。\n'
            '构图方式：中央任务卡占主画面，左右两侧为案例证据小窗，右下角放“先写任务再筛结构”的边界面板。'
        )
    if '结构工具箱最小语义' in text:
        return (
            '主视觉对象：一个控制结构工具箱，抽屉分别标注 PI、PD、超前、滞后、前馈，每个抽屉连接到对应的作用频段或信号通道。\n'
            f'工程场景：客船航向控制偏低频稳态，稳定平台偏中频动态；只使用这两类本课案例，不引入新的工程对象。{stable_platform_note}\n'
            '核心图示：闭环框图、低频/中频/高频频段条、收益与代价两类短标签。\n'
            '构图方式：左侧任务卡输入，中间工具箱主视觉，右侧结构选择边界，避免画成纯图标表格。'
        )
    if '主矛盾到频段职责映射' in text:
        return (
            f'主视觉对象：一条低频-中频-高频职责带，客船航向控制证据落在低频稳态一侧，稳定平台证据落在中频响应一侧。{stable_platform_note}\n'
            '工程场景：Bode 幅频/相频小窗、阶跃响应小窗和任务标签共同说明主矛盾如何落到频段职责。\n'
            '核心图示：低频稳态、中频动态、高频噪声、主矛盾、结构入口五个元素。\n'
            '构图方式：频段职责带横贯画面，两个案例证据卡贴在对应频段，下方给“频段先行，结构随后”的判断条。'
        )
    if '结构作用点与代价来源对照' in text:
        return (
            '主视觉对象：同一个闭环控制框图上标出反馈通道、串联校正通道、前馈支路三个作用点。\n'
            '工程场景：旁边用 Bode 裕度、阶跃响应和控制量边界三个小窗读回收益与代价。\n'
            '核心图示：作用点、低频收益、中频储备、控制量代价、扰动复核五个短标签。\n'
            '构图方式：闭环框图为主图，右侧三联小窗显示不同代价来源，禁止使用源材料之外的设备案例。'
        )
    if '反馈保底与前馈补偿边界' in text:
        return (
            '主视觉对象：反馈闭环作为粗实线主干，前馈支路作为细线补偿通道叠加在同一控制框图上。\n'
            '工程场景：输入补偿和扰动补偿两个小窗并列，均回到反馈闭环保底检查。\n'
            '核心图示：反馈保底、前馈补偿、可测条件、模型路径、稳定复核五个元素。\n'
            '构图方式：中央闭环主图，左右分别为两类前馈路径，底部给“前馈不替代反馈”的边界面板。'
        )
    if '按输入补偿前馈' in text:
        return (
            '主视觉对象：参考输入 r(t) 分成反馈误差通道和输入前馈通道，前馈支路提前补偿给定变化。\n'
            '工程场景：用误差曲线趋近零、给定输入通道和反馈兜底小窗表达无差度提升边界。\n'
            '核心图示：r(t)、输入前馈、无差度提升、反馈兜底、模型匹配五个短标签。\n'
            '构图方式：左侧参考输入，中央双通道结构框图，右侧误差读回和适用边界。'
        )
    if '按扰动补偿前馈' in text:
        return (
            '主视觉对象：可测扰动 d(t) 在进入对象前被前馈支路估计并反向抵消，闭环反馈仍保留。\n'
            '工程场景：扰动进入点、补偿信号和残余误差曲线三联小窗表达对消条件。\n'
            '核心图示：d(t)、扰动可测、对消条件、路径匹配、残余误差五个短标签。\n'
            '构图方式：主图为扰动补偿框图，右侧为“可测且匹配才有效”的边界判断。'
        )
    if '单结构首轮起步卡' in text:
        return (
            '主视觉对象：六字段首轮起步卡，字段包括主矛盾、优先频段、候选结构、预期收益、主要代价、验证指标。\n'
            f'工程场景：客船低频起步和稳定平台中频起步作为两个分支案例，均只选一个主结构。{stable_platform_note}\n'
            '核心图示：单结构、首轮起步、收益、代价、验证指标五个短标签。\n'
            '构图方式：中央起步卡，左下客船分支，右下平台分支，上方从任务卡进入，下方收束到验证。'
        )
    if '目标驱动PD校正' in text:
        return (
            f'主视觉对象：稳定平台的中频响应控制台，旁边显示目标极点区域和根轨迹主图。{stable_platform_note}\n'
            '工程场景：平台案例需要改善动态品质，先在左半平面的目标区域内选稳定设计点，再由相角条件反推零点位置，由模值条件反推增益。\n'
            '核心图示：目标区域、根轨迹、PD 零点、阶跃验收、G_PD(s)=K(1+T_d s)。\n'
            '构图方式：左侧稳定控制对象剪影与响应曲线，中间 s 平面根轨迹，右侧公式与“先目标后参数”的边界面板；根轨迹设计点和目标区域必须画在虚轴左侧。'
        )
    if '目标驱动超前校正' in text:
        return (
            f'主视觉对象：稳定平台频域控制台，Bode 相频曲线上有目标裕度、补角窗口和目标频带。{stable_platform_note}\n'
            '工程场景：平台案例以中频动态品质和相位储备为主，超前网络用于提供局部相位提升，再回到时域验收。\n'
            '核心图示：目标裕度、目标频带、补角、超前参数、时域验收五步链。\n'
            '构图方式：左侧 Bode 双图为主图，中央补角/参数小窗，右侧阶跃响应验收，不画成普通三频段装饰图。'
        )
    if 'MASS协同链路' in text:
        return (
            '主视觉对象：一艘自主水面船在海图上航行，周围用六个链路舱位表示感知、估计、规划、控制、执行、监督。\n'
            '工程场景：目标船、航道和岸基监督台作为真实任务背景，显示任务不是单一控制器问题。\n'
            '核心图示：信息流、控制流、责任边界三个技术小窗；公式锚点只保留 MASS 链路分解式。\n'
            '构图方式：中央为船舶与海图，链路舱位沿读图方向环绕，右侧放“沿链路定位”边界面板。'
        )
    if '控制在自主系统链路中的位置' in text:
        return (
            '主视觉对象：控制层作为规划参考和执行器之间的嵌入式闭环模块，连接上游规划台和下游舵机/推进器。\n'
            '工程场景：海图上的期望航迹进入控制器，真实航迹和反馈状态返回控制器。\n'
            '核心图示：e(t)=r(t)-y(t)、u(t)=C(e(t))、反馈状态、执行约束四个短标签。\n'
            '构图方式：左侧规划参考，中间控制闭环，右侧执行器和船体运动，底部放“依赖上游、受限下游”判断条。'
        )
    if '上游信息质量' in text:
        return (
            '主视觉对象：自主船传感器阵列与状态估计面板，传感器束中带噪声点和延迟时间戳。\n'
            '工程场景：目标船观测经过滤波和估计后才进入控制器，真实位置与测量位置略有偏差。\n'
            '核心图示：y_m(t)=y(t-τ)+n(t)、噪声、延迟、同步、置信度五个技术元素。\n'
            '构图方式：左侧为感知场景，中间为估计/滤波小窗，右侧为控制器收到的反馈状态和风险边界。'
        )
    if '规划参考可实现性' in text:
        return (
            '主视觉对象：海图上两条规划路径对比，一条急折线触发舵角饱和，一条平滑路径留出转弯半径。\n'
            '工程场景：规划层输出航向参考，控制层把参考翻译为舵角，执行器边界限制实际动作。\n'
            '核心图示：R≥R_min、|δ(t)|≤δ_max、转弯半径、舵角边界、参考可执行五个标签。\n'
            '构图方式：左侧路径几何，中间航向参考小曲线，右侧舵角边界仪表，底部写“先可行再跟踪”。'
        )
    if '执行约束反馈' in text:
        return (
            '主视觉对象：舵机剖面和控制量限幅曲线，显示理想指令被幅值和速率边界截断。\n'
            '工程场景：执行器健康、能耗和带宽状态向控制层与规划层回传，迫使参考修正。\n'
            '核心图示：|u(t)|≤u_max、|du/dt|≤du_max、饱和、速率限制、健康状态五个元素。\n'
            '构图方式：中央为执行器，左侧理想控制量，右侧实际航迹变化，上方用反馈箭头回到规划和控制。'
        )
    if '链路责任诊断' in text:
        return (
            '主视觉对象：一张工程证据墙，六列依次为感知、估计、规划、控制、执行、监督，每列有一个日志或曲线证据。\n'
            '工程场景：同一轨迹偏差被拆成丢帧、估计滞后、急转参考、控制振荡、舵角饱和、降级接管证据。\n'
            '核心图示：诊断顺序箭头、证据链、责任边界、优先检查四个元素。\n'
            '构图方式：从左到右流程板，右下角放“不要直接调参”边界提示，但不写长段落。'
        )
    if '避碰转弯半径可行域' in text:
        return (
            '主视觉对象：避碰海图主图，障碍物安全圈旁并列三条候选转弯轨迹，只有满足最小半径的一条进入可行域。\n'
            '工程场景：等效船长、最大舵角和安全裕量共同决定最小可实现转弯半径。\n'
            '核心图示：R_min≈L/tanδ_max、δ_max、R=35m/65m/140m、可行域、安全裕量。\n'
            '构图方式：左侧海图主图，右侧舵角-半径换算小窗，底部给“规划半径必须吸收执行边界”。'
        )
    if 'MASS自动化等级责任边界' in text:
        return (
            '主视觉对象：四个并列运行形态场景：决策支持、有人远控、无人远控、全自主；每格下方共享同一条技术链路。\n'
            '工程场景：船上人员、岸基控制台、无人船和船载自主系统分别作为责任主体线索。\n'
            '核心图示：自动化等级、责任主体、降级接管、链路证据四个元素；不渲染法规日期或外部进度数字。\n'
            '构图方式：上半部四场景对比，下半部统一链路证据条，右侧放“等级不是诊断结论”边界面板。'
        )
    if '模型依赖松动' in text:
        return (
            '主视觉对象：一条船舶航向模型主干被放在透明框架中，旁边接入运行数据补偿层和安全约束护栏。\n'
            '工程场景：名义模型预测偏快，数据用于修正参数漂移和局部残差，但约束与安全边界仍由工程规则保留。\n'
            '核心图示：x_{k+1}=f(x_k,u_k,p_k)、模型主干、数据补偿、约束边界、验证后再用。\n'
            '构图方式：左侧模型主干，中间数据补偿贴片，右侧安全边界与预测误差读回，避免画成纯 AI 数据流。'
        )
    if 'MPC再定位' in text:
        return (
            '主视觉对象：MPC 控制台，显示预测窗口、滚动优化轨迹和舵角约束条。\n'
            '工程场景：航向保持任务中，名义模型预测未来，优化器在每个采样时刻重算控制序列，闭环只执行第一步。\n'
            '核心图示：预测窗口、滚动优化、显式约束、模型依赖、闭环反馈五个元素。\n'
            '构图方式：左侧预测时域轨迹，中间优化器，右侧舵角约束与反馈回路；底部标出“中间位置”。'
        )
    if '数据驱动控制' in text:
        return (
            '主视觉对象：运行数据集 D 进入控制补偿模块，旁边保留物理模型、舵角限制和安全检查三道护栏。\n'
            '工程场景：闭环航迹数据、控制输入和输出样本被用于更新短时扰动补偿，而不是替代全部控制结构。\n'
            '核心图示：D={x_k,u_k,y_k}、运行数据、样本规律、控制补偿、安全检查。\n'
            '构图方式：左侧数据流，中间补偿模块，右侧闭环航迹改善与风险提示。'
        )
    if '数据覆盖与泛化边界' in text:
        return (
            '主视觉对象：状态-扰动平面上的训练数据覆盖云，红色关键边界工况位于覆盖边缘或外侧。\n'
            '工程场景：晴天低流速样本覆盖中心区域，强横流、低能见度和大舵角场景作为泛化风险点。\n'
            '核心图示：D_train、B_critical、覆盖区、未见场景、故障注入。\n'
            '构图方式：左侧覆盖图主视觉，右侧三个边界工况小窗，底部给“覆盖不足限制职责”。'
        )
    if '在线辨识与模型更新' in text:
        return (
            '主视觉对象：滑动数据窗口进入在线辨识器，输出 a,b,c 参数后经过投影、平滑和保守预测。\n'
            '工程场景：最近一段闭环航向数据估计有效时间常数、增益和扰动偏置，再供 MPC 预测使用。\n'
            '核心图示：r_{j+1}=a r_j+bδ_j+c、参数投影、平滑、保守预测、模型更新。\n'
            '构图方式：从左到右“数据窗口 -> 估计 -> 保护 -> MPC 预测”，用红色标出禁止短时跳变。'
        )
    if '数据驱动进入条件' in node_name:
        return (
            '主视觉对象：四道进入闸门，依次为数据、算力、验证、泛化，只有四项同时通过才进入闭环控制区。\n'
            '工程场景：固定航道晴天数据被挡在泛化闸门外，强横流和拥挤水域作为未覆盖边界工况。\n'
            '核心图示：进入条件=数据+算力+验证+泛化、闭环部署、离线分析、风险拦截。\n'
            '构图方式：横向闸门流程板，右侧为闭环控制入口，底部显示“未覆盖不入闭环”。'
        )
    if '模型数据责任分配' in text:
        return (
            '主视觉对象：同一闭环控制系统被拆成四个责任舱：模型结构、数据补偿、约束优化、安全保护。\n'
            '工程场景：船体低速操纵动态由模型主干承担，风浪流扰动由数据补偿，舵角限制和安全距离由规则保护。\n'
            '核心图示：闭环证据=模型结构+数据补偿+约束优化+安全保护、责任边界、不可混成黑箱。\n'
            '构图方式：四舱并列连接同一船舶闭环，右侧放“谁负责什么”的判断面板。'
        )
    if '三路线控制比较' in text:
        return (
            '主视觉对象：三条并列航向控制路线：固定控制、名义模型 MPC、数据驱动模型 MPC，共用同一任务和扰动。\n'
            '工程场景：比较预测、约束、模型更新、IAE、舵角触边比例和新增风险。\n'
            '核心图示：IAE、触边比例、预测、约束、模型更新、收益/风险平衡。\n'
            '构图方式：三列对比板，每列包含航迹/误差小图和风险条；右侧收束为责任分配结论。'
        )
    if '非线性边界工具选择' in text:
        return (
            '主视觉对象：一块工程诊断工作台，左侧是线性模型曲线，右侧是非线性边界工具抽屉。\n'
            '工程场景：用船舶航向或舵机闭环作为背景线索，显示“线性近似够不够用”的判断。\n'
            '核心图示：局部线性化、相平面、描述函数三类工具以三个技术小窗呈现，每个小窗只放一个短标签。\n'
            '构图方式：中间用选择箭头连接“线性区、小偏差、全局轨线、近似自振”，底部放边界提醒。'
        )
    if '局部线性化工作点' in text:
        return (
            '主视觉对象：非线性曲面或弯曲输入输出曲线上标出工作点，切平面或切线贴在该点附近。\n'
            '工程场景：用控制台上的设定点和小扰动箭头表示工作点附近的偏差运动。\n'
            '核心图示：工作点、邻域、小偏差、切线近似四个视觉元素；远离工作点的位置用红色边界提示。\n'
            '构图方式：左侧大曲面，右侧为局部放大窗和线性模型小框图。'
        )
    if '非线性微分方程的线性化' in text:
        return (
            '主视觉对象：从弯曲的非线性函数面过渡到一张局部线性网格，工作点处有切线/切平面。\n'
            '工程场景：用小偏差坐标轴和控制输入扰动表示线性化只处理工作点附近变化。\n'
            '核心图示：非线性方程、Jacobian 矩阵 A/B、偏差变量、线性近似模型四个技术小窗。\n'
            '构图方式：从左到右呈现“原方程 -> 工作点 -> 一阶近似 -> 线性模型”。'
        )
    if '相平面图' in text:
        return (
            '主视觉对象：x1-x2 相平面上多条带箭头轨线，中心有平衡点，局部有分界轨迹或吸引区域。\n'
            '工程场景：用摆杆、航向角-角速度或舵角-角速度小图作为状态变量来源。\n'
            '核心图示：轨线方向、平衡点、吸引/发散区域、初值点四类标注。\n'
            '构图方式：相平面主图占画面大半，右侧用小窗读回时间响应和边界判断。'
        )
    if '描述函数法' in text and '适用条件' not in text:
        return (
            '主视觉对象：正弦信号穿过非线性环节，输出含谐波，滤出基波后进入频域判读。\n'
            '工程场景：用舵机或执行机构的非线性特性曲线作为非线性环节。\n'
            '核心图示：输入正弦、非线性输出、基波提取、N(A) 等效增益四个小窗。\n'
            '构图方式：左侧时域波形链，右侧频域等效与闭环候选点。'
        )
    if '描述函数适用条件' in text:
        return (
            '主视觉对象：一条闭环信号链，单一非线性后接低通线性环节，高次谐波在滤波窗口中被压低。\n'
            '工程场景：用执行机构非线性和船舶航向惯性低通特征表达适用边界。\n'
            '核心图示：单一非线性、近似正弦、低通滤波、高次谐波弱四个判断标签。\n'
            '构图方式：中间为信号链，右侧为可用/慎用边界面板。'
        )
    if '自振微小扰动判断' in text:
        return (
            '主视觉对象：复平面交点附近放大图，交点两侧有振幅微扰箭头，显示回到交点或远离交点。\n'
            '工程场景：用振荡波形的包络线增大/减小作为结果读回。\n'
            '核心图示：候选交点、微小扰动、收敛、发散四个短标签。\n'
            '构图方式：左侧为交点放大图，右侧上下两个波形小窗对比稳定自振与风险自振。'
        )
    if '负倒描述函数' in text:
        return (
            '主视觉对象：复平面上同时出现线性部分 G(jω) 轨迹和 -1/N(A) 曲线，交点被高亮。\n'
            '工程场景：用频域分析仪或控制台指针作为读数场景，不画成纯文字公式卡。\n'
            '核心图示：G(jω)、-1/N(A)、交点、A 与 ω 读数四个元素。\n'
            '构图方式：复平面主图占左侧，右侧小窗显示自振候选和边界提醒；交点必须位于黑色 G(jω) 曲线与红色 -1/N(A) 曲线相交处，不要单独标注 (-1,0) 临界点。'
        )
    if '舵机死区饱和自振风险' in text:
        return (
            '主视觉对象：舵机输入输出特性曲线，中央死区平段与两端饱和平台清晰可见。\n'
            '工程场景：船舶航向闭环与舵角执行器剖面，显示小误差不动作、大误差受限。\n'
            '核心图示：死区、饱和、闭环振荡、风险复核四个技术小窗。\n'
            '构图方式：左侧为舵机非线性曲线，右侧为闭环波形和自振风险提示。'
        )
    if '超调量' in text:
        return (
            '主视觉对象：一张放大的阶跃响应曲线，实际稳态线 y_infty、单位阶跃参考线 r(t)=1、输出峰值 y_max 和超出区域清楚可辨。\n'
            '工程场景：用客船航向控制或稳定平台的小型实物剪影作为应用线索，表达“过程能否接受”，不要画成泛用仪表海报。\n'
            '核心图示：标出 y_max、y_infty、r(t)=1 和 M_p 对应的超出比例；超出量只能画成从绿色 y_infty 稳态线到峰值线的 y_max - y_infty，不能画成 y_max 减参考给定值。\n'
            '读图一致性：输出曲线最终尾段必须与绿色 y_infty 稳态线重合；红色 r(t)=1 参考线可以高于 y_infty，用来显示给定值与稳态输出不是同一条线。\n'
            '构图方式：左侧为响应曲线主图，右侧为公式、过程接受度边界和一个小型工程场景读回。'
        )
    if '积分环节' in text:
        return (
            '主视觉对象：透明水箱液位上升和船舶航向罗盘二选一或并置，表达“输入被持续累积”。\n'
            '工程场景：流量进入水箱、角速度累积成航向角，不画人物讲课场景。\n'
            '核心图示：小型框图 u(t) -> 1/s -> y(t)，旁边标出原点极点 s=0。\n'
            '构图方式：左侧物理场景，中央积分器图标，右侧输出随时间累积曲线和公式锚点。'
        )
    if '根轨迹' in text:
        return (
            '主视觉对象：s 平面坐标网格上的根轨迹曲线，开环极点和零点清楚可辨。\n'
            '工程场景：把增益旋钮或参数滑杆作为视觉隐喻，表示参数变化驱动极点移动。\n'
            '核心图示：轨迹箭头、主导极点区域和简化阶跃响应小窗。\n'
            '构图方式：大图为复平面，右侧为响应读回，不做纯文字关系卡。'
        )
    if '主导极点' in text:
        return (
            '主视觉对象：稳定闭环的 s 平面极点图，所有闭环极点必须在左半平面，不要在右半平面画极点。\n'
            '工程场景：用船舶航向阶跃响应小窗表达主导极点决定主要响应画面。\n'
            '核心图示：靠近虚轴的一组稳定极点用橙色圈出，远离虚轴的极点用灰色弱化；虚轴和左半平面稳定区清楚标出。\n'
            '构图方式：左侧为全体闭环极点图，右侧为衰减较慢的响应曲线与“离虚轴近、衰减更慢”判断。'
        )
    if '零点' in text:
        return (
            '主视觉对象：s 平面中的左半平面零点和弯曲后的根轨迹。\n'
            '工程场景：用航向响应曲线或阻尼区域作为效果读回。\n'
            '核心图示：阻尼改善、实部左移、超调变化三个小型技术嵌图。\n'
            '构图方式：让零点改变路径成为视觉中心，文字只作为标注。'
        )
    if '低频' in text or '补偿' in text or '滞后' in text or '积分与滞后' in text:
        return (
            '主视觉对象：Bode 低频段被抬升的曲线和低频/中频/高频分区。\n'
            '工程场景：用航向控制仪表或误差指针回零表达稳态改善。\n'
            '核心图示：PI 与滞后两条路径并列，低频收益和相位/裕量代价分开标注。\n'
            '构图方式：左侧频段图，中央路径对照，右侧代价复核面板。'
        )
    if '相角裕度' in text:
        return (
            '主视觉对象：Bode 相频曲线在穿越频率处到 -180° 的角度标尺。\n'
            '工程场景：用安全余量仪表盘或临界边界指针表达“离失稳还有多远”。\n'
            '核心图示：0 dB 穿越线、-180° 基准线、相角裕度弧形标尺；正裕度示例中相位曲线在 ω_c 处必须位于 -180° 基准线上方。\n'
            '构图方式：大图为 Bode 双图，右侧为稳定边界提醒；裕度标尺从相位曲线在 ω_c 的读数向下量到 -180°，不要把读数点画在 -180° 线上。'
        )
    if '幅值裕度' in text:
        return (
            '主视觉对象：Bode 双图中相频曲线先读出 -180° 相位穿越频率 ω_g，再回到幅频图在同一频率处量到 0 dB 的增益余量。\n'
            '工程场景：用安全余量仪表盘或临界边界指针表达“相位已到危险边界时，增益还差多少才碰边”。\n'
            '核心图示：-180° 相位穿越线、ω_g 垂线、0 dB 基准线、幅值裕度竖向标尺、K_g=1/|G(jω_g)|。\n'
            '构图方式：上方幅频图显示 0 dB 基准和裕度竖尺，下方相频图显示 -180° 穿越点，两图用同一条 ω_g 垂线连接。'
        )
    if '带宽' in text:
        return (
            '主视觉对象：闭环幅频曲线和 -3 dB / ω_b 边界。\n'
            '工程场景：用跟踪速度仪表或信号通道宽窄隐喻响应快慢。\n'
            '核心图示：低频平台、下降边界、带宽标尺。\n'
            '构图方式：主图为曲线，辅图为“跟得多快”的工程读回。'
        )
    if '三频段' in text or '综合' in text or '映射' in text or '任务标签' in text or '模块4入口' in text:
        return (
            '主视觉对象：工程控制台或证据墙，把频域曲线、根轨迹、阶跃响应和任务标签放在同一工作面上。\n'
            '工程场景：船舶航向控制对象作为背景线索，不把场景画成装饰海报。\n'
            '核心图示：频域指纹、判稳余量、三频段任务、闭环读回四个技术嵌图。\n'
            '构图方式：杂志式信息图或工程评审板，强调比较、证据和判断。'
        )
    return (
        '主视觉对象：选取源材料中的具体对象或可观察现象作为画面中心。\n'
        '工程场景：把概念放入控制系统读图、仪表、曲线或物理对象中。\n'
        '核心图示：至少包含一个数学/工程小图，不只使用图标和文本框。\n'
        '构图方式：主视觉占画面一半以上，文字作为标注而不是正文。'
    )


def visual_archetype_for_node(node_name: str, groups: list[str]) -> dict[str, str]:
    text = f'{node_name} {" ".join(groups)}'
    if (
        'MASS协同链路' in text
        or '链路责任诊断' in text
        or 'MASS自动化等级责任边界' in text
    ):
        return {
            'id': 'engineering_review_board',
            'name': '工程评审板',
            'description': '把链路、证据窗口和责任边界组织成工程评审台，强调分层归因和边界判断。',
        }
    if (
        '控制在自主系统链路中的位置' in text
        or '上游信息质量' in text
        or '规划参考可实现性' in text
        or '执行约束反馈' in text
    ):
        return {
            'id': 'mechanism_cutaway',
            'name': '机制剖面图',
            'description': '用自主船舶任务链的局部剖面解释接口、状态、参考或执行边界如何影响控制。',
        }
    if '避碰转弯半径可行域' in text:
        return {
            'id': 'engineering_review_board',
            'name': '工程评审板',
            'description': '把海图、候选轨迹、舵角边界和可行域判据组织成工程评审台。',
        }
    if (
        '模型依赖松动' in text
        or '数据驱动控制' in text
        or '在线辨识与模型更新' in text
    ):
        return {
            'id': 'mechanism_cutaway',
            'name': '机制剖面图',
            'description': '用模型主干、数据通道、参数更新和安全边界的剖面解释方法迁移机制。',
        }
    if (
        'MPC再定位' in text
        or '数据驱动进入条件' in node_name
    ):
        return {
            'id': 'process_board',
            'name': '流程板',
            'description': '用预测、滚动优化或进入闸门表达从证据到闭环部署的条件链。',
        }
    if (
        '数据覆盖与泛化边界' in text
        or '模型数据责任分配' in text
        or '三路线控制比较' in text
    ):
        return {
            'id': 'engineering_review_board',
            'name': '工程评审板',
            'description': '把覆盖证据、路线对比、收益风险和责任分配组织成工程评审台。',
        }
    if '非线性边界工具选择' in text or '适用条件' in text:
        return {
            'id': 'process_board',
            'name': '流程板',
            'description': '用连续判断步骤表达何时选用某类非线性分析工具及其使用边界。',
        }
    if '局部线性化' in node_name or '线性化' in node_name or ('描述函数法' in node_name and '适用条件' not in node_name):
        return {
            'id': 'mechanism_cutaway',
            'name': '机制剖面图',
            'description': '用物理对象或信号通道的分层剖面解释近似模型的生成机制和边界。',
        }
    if '相平面' in text or '负倒描述函数' in text or '自振' in text:
        return {
            'id': 'engineering_review_board',
            'name': '工程评审板',
            'description': '把轨线、交点、微扰和工程波形组织成证据评审台。',
        }
    if '流程' in text or '路径' in text or '步骤' in text or '任务判断' in text:
        return {
            'id': 'process_board',
            'name': '流程板',
            'description': '用 4-6 个连续步骤表达从证据到判断或从目标到参数的过程。',
        }
    if '零点' in text or '极点' in text or '根轨迹' in text:
        return {
            'id': 's_plane_mechanism_board',
            'name': 's 平面机理板',
            'description': '以 s 平面主图为核心，辅以响应曲线或阻尼区域小窗解释动态机理。',
        }
    if 'Bode' in text or '裕度' in text or '带宽' in text or '频域' in text or '三频段' in text:
        return {
            'id': 'frequency_dashboard',
            'name': '频域仪表盘',
            'description': '以 Bode/闭环幅频/三频段读图为主图，配合裕度、边界和工程读回小窗。',
        }
    if '积分' in text or '滞后' in text or '补偿' in text or '低频' in text:
        return {
            'id': 'mechanism_cutaway',
            'name': '机制剖面图',
            'description': '用物理对象或信号通道的分层剖面解释结构如何改变稳态或动态表现。',
        }
    if '综合' in text or '映射' in text or '统一' in text or '标签' in text or '读回' in text:
        return {
            'id': 'engineering_review_board',
            'name': '工程评审板',
            'description': '把多个证据窗口组织成评审台，强调证据对照、任务匹配和结论读回。',
        }
    return {
        'id': 'science_encyclopedia_panel',
        'name': '科普百科图鉴',
        'description': '用一个主视觉和若干模块化信息区解释概念、特征、边界和应用语境。',
    }


def layout_contract_for_archetype(archetype_id: str) -> str:
    contracts = {
        'process_board': (
            '16:9 横版；上方一个短标题；中间 4-6 个编号步骤横向或 2x3 排列；'
            '每步只放一个图像动作或技术小窗；底部一条结论/边界条。'
        ),
        's_plane_mechanism_board': (
            '16:9 横版；左侧 55%-65% 为 s 平面或根轨迹主图；右侧上方为响应曲线小窗；'
            '右侧下方为判断边界或公式；极点/零点标签贴近图形。'
        ),
        'frequency_dashboard': (
            '16:9 横版；左侧或上方为 Bode/闭环幅频主图；2-3 个仪表式小窗显示裕度、带宽或三频段读回；'
            '用细线连接读图位置和判断面板。'
        ),
        'mechanism_cutaway': (
            '16:9 横版；一个真实质感的物理对象或信号通道剖面占主画面；'
            '旁边用 2-3 个放大局部解释低频收益、相位代价或累积机制。'
        ),
        'engineering_review_board': (
            '16:9 横版；采用工程评审台或证据墙布局；'
            '3-4 个证据窗口按当前节点的曲线、轨迹、交点、微扰或工程波形组织；右下角给边界判断。'
        ),
        'science_encyclopedia_panel': (
            '16:9 横版；一个清晰主视觉占画面约一半；'
            '其余空间为 3-5 个圆角模块，分别承载特征、机理、边界和公式。'
        ),
    }
    return contracts.get(archetype_id, contracts['science_encyclopedia_panel'])


def text_contract_for_node(node_name: str, keywords: list[str], formulas: list[str]) -> dict[str, Any]:
    allowed_labels = [node_name]
    for keyword in keywords:
        value = str(keyword).strip()
        if re.fullmatch(r'\d+-\d+', value):
            continue
        if re.fullmatch(r'层\d+.*', value) or '精化' in value:
            continue
        allowed_labels.append(value)
    return {
        'allowed_labels': allowed_labels[:10],
        'max_visible_labels': 12,
        'max_label_length': 'prefer_under_10_chinese_chars',
        'formula_anchors': formulas[:2],
        'body_text_policy': 'no_paragraphs_no_full_definition_copy',
    }


def visual_architecture_for_node(node_name: str, groups: list[str], keywords: list[str], formulas: list[str]) -> dict[str, Any]:
    archetype = visual_archetype_for_node(node_name, groups)
    return {
        'visual_archetype': archetype,
        'layout_contract': layout_contract_for_archetype(archetype['id']),
        'text_contract': text_contract_for_node(node_name, keywords, formulas),
        'technical_insets_contract': '1-3 个技术小窗，每个小窗必须承担读图、机理解释或边界判断功能。',
        'negative_constraints': [
            '不要生成电子讲义截图或白底多卡片堆叠。',
            '不要把长定义、长例题或整段说明塞进图面。',
            '不要用无关装饰替代工程对象、技术曲线或物理隐喻。',
            '不要渲染 visual_archetype、layout_contract、text_contract 等提示词字段名。',
        ],
    }


def build_prompt(source: dict[str, Any]) -> str:
    node = source['node']
    lesson = source['lesson']
    groups = [str(item) for item in lesson.get('groups') or []]
    relations = source['relations'][:6]
    relation_label_map = {
        'contains': '包含',
        'leads_to': '引出',
        'generalizes': '概括',
        'cross_domain': '跨域连接',
        'applies_to': '应用于',
        'instance_of': '实例',
        'prerequisite': '前置',
        'related': '相关',
        'opposite': '对照',
    }
    relation_lines = []
    for item in relations:
        relation = str(item.get('relation') or '')
        description = str(item.get('description') or '').strip()
        description_suffix = f': {description}' if description else ''
        relation_lines.append(
            f"- {item.get('source') or item.get('source_id')} --{relation_label_map.get(relation, relation)}--> "
            f"{item.get('target') or item.get('target_id')}{description_suffix}"
        )

    formulas = node.get('formulas') or []
    formula_line = '；'.join(str(item) for item in formulas[:2]) if formulas else '无公式，图中只放与主题直接相关的短符号。'
    formula_instruction = (
        f'请准确渲染这些公式本身，放在留白充足的位置；公式区标题只能写“公式”：{formula_line}'
        if formulas
        else '本节点没有公式，不要自行添加公式。'
    )
    keywords = [str(item) for item in (node.get('keywords') or [])[:8]]
    visual_focus = visual_focus_for_node(str(node['name']), groups)
    visual_asset_brief = visual_asset_brief_for_node(str(node['name']), groups)
    visual_architecture = source.get('visual_architecture') or visual_architecture_for_node(
        str(node['name']),
        groups,
        keywords,
        [str(item) for item in formulas],
    )
    text_contract = visual_architecture['text_contract']
    text_allowlist = [str(item) for item in text_contract.get('allowed_labels') or [node['name']]]

    return f"""请使用 GPT Image 2 / Codex 最新图片生成能力，制作一张横版中文教学信息图。

主题：{node['name']}
所属课程单元：{lesson['lesson_id']}《{lesson.get('title', '')}》
所属分组：{'、'.join(groups) if groups else '未分组'}
知识类型：{node.get('knowledge_type') or node.get('category') or '知识点'}

事实真源如下，禁止添加未出现的事实、公式、术语或工程案例：

一句话定义：
{node.get('definition') or source.get('card_overview', '')}

核心直觉：
{source.get('core_intuition', '')}

可用公式（内部依据，图面公式区标题只能写“公式”）：
{formula_line}

本课关系：
{chr(10).join(relation_lines) if relation_lines else '- 无显式关系，按知识卡片内容呈现。'}

建议视觉骨架：
{visual_focus}

视觉资产 brief：
{visual_asset_brief}

结构化视觉架构：
visual_archetype: {visual_architecture['visual_archetype']['name']}（{visual_architecture['visual_archetype']['description']}）
layout_contract: {visual_architecture['layout_contract']}
text_contract: 只允许围绕这些标签组织图面文字：{'、'.join(text_contract['allowed_labels']) if text_contract['allowed_labels'] else node['name']}；全图最多 {text_contract['max_visible_labels']} 个可见标签；不放正文段落。
technical_insets_contract: {visual_architecture['technical_insets_contract']}
negative_constraints:
{chr(10).join(f"- {item}" for item in visual_architecture['negative_constraints'])}

图像要求：
- 横版信息图，适合放在互动课程入口的知识点详情中；画面应像一张教学视觉资产，而不是电子知识卡片截图。
- 必须包含一个具体主视觉对象或工程场景，并包含一个数学/工程图示嵌图；不要只画卡片、图标和箭头。
- 主视觉对象、示意图、公式和短标签要共同解释机制；不要用无关装饰填充画面。
- 中文为主，不使用英文大标题；英文只允许作为小号副标题。
- 不要把“课程单元、所属分组、知识类型、事实真源、可用公式、图像要求、visual_archetype、layout_contract、text_contract”等元数据或提示词字段画进图面；公式区域如需标题，只能写“公式”。
- 不要整句复刻“一句话定义”；把定义压缩成 3-5 个短标签或短判断。
- 全图可见中文标签控制在 12 个以内；单个标签尽量不超过 10 个汉字，不放解释段落。
- 图中的关系标签统一使用中文，不要显示 contains、leads_to、cross_domain 等英文关系类型。
- 采用“核心直觉 -> 机理路径 -> 边界提醒”的三段式视觉结构。
- 只使用少量短中文标签，优先使用这些词：{'、'.join(text_allowlist[:10]) if text_allowlist else node['name']}。
- 右侧用简洁小面板表达判断结果或边界，不写长段落。
- {formula_instruction}
- 不要出现教师、课堂、流程说明、软件界面、二维码、水印。
- 字体清晰，文字少而准确，避免密集段落。
- 不要使用纯蓝或纯紫单色风格；使用白底、深墨色文字、青绿/橙色强调和少量红色边界提示。
"""


def main() -> None:
    args = parse_args()
    requested_node_id = args.node
    node_id = canonical_node_id(requested_node_id)
    selected = selected_infograph_ref(node_id)
    if selected:
        selected_dir = node_infograph_dir(selected['lesson_id'], selected['node_id'])
        review_path = selected_dir / 'review.json'
        image_path = selected_dir / 'infograph.png'
        if image_path.exists() and review_path.exists():
            try:
                review = read_json(review_path)
            except Exception:
                review = {}
            if str(review.get('status') or '').strip().lower() == 'accepted':
                print(f'canonical infograph already accepted: {repo_path(image_path)}')
                print(f'requested node {requested_node_id} maps to canonical node {node_id}')
                return

    sequence = canonical_sequence(load_sequence(args.lesson))
    card_order = [str(item) for item in sequence.get('card_order', [])]
    if node_id not in card_order:
        raise SystemExit(f'Node {requested_node_id} maps to {node_id}, which is not in {args.lesson} card_order')

    manifest = read_json(lesson_manifest_path(args.lesson)) if lesson_manifest_path(args.lesson).exists() else {}
    groups = node_group_map(sequence).get(node_id, [])
    card_path = node_card_path(node_id)
    card_markdown = card_path.read_text(encoding='utf-8') if card_path.exists() else ''
    frontmatter = parse_frontmatter(card_markdown)
    nodes = load_all_authoring_nodes(args.lesson)
    node = nodes.get(node_id)
    if not node:
        if not card_path.exists():
            raise SystemExit(f'Missing node data and card for {node_id}')
        node = {
            'id': node_id,
            'name': frontmatter.get('name') or node_id,
            'name_en': frontmatter.get('name_en'),
            'category': frontmatter.get('category'),
            'knowledge_type': frontmatter.get('knowledge_type'),
            'bloom_level': frontmatter.get('bloom_level'),
            'definition': frontmatter.get('definition'),
            'examples': frontmatter.get('examples') or [],
            'formulas': frontmatter.get('formulas') or [],
            'keywords': frontmatter.get('keywords') or [],
        }
    overview = extract_section(card_markdown, '首页')
    detail = extract_section(card_markdown, '详情')

    card_definition = extract_bold_field(overview, '一句话定义')
    core_intuition = extract_bold_field(overview, '核心直觉')
    card_formula = extract_first_display_formula(overview)

    node_name = str(node.get('name') or frontmatter.get('name') or node_id)
    node_formulas = formula_anchors(card_formula, node.get('formulas') or frontmatter.get('formulas') or [])
    node_keywords = unique_strings(
        list(node.get('keywords') or [])
        + [
            item
            for item in list(frontmatter.get('tags') or [])
            if str(item).strip() != args.lesson
        ]
    )
    related_relations = [
        relation_summary(relation, node_id)
        for relation in load_authoring_relations(args.lesson)
        if relation_mentions_node(relation, node_id, node_name)
    ][:12]

    source = {
        'schema_version': 1,
        'created_at': now_iso(),
        'lesson': {
            'lesson_id': args.lesson,
            'title': manifest.get('title'),
            'groups': groups,
            'card_order_index': card_order.index(node_id) + 1,
        },
        'node': {
            'id': node_id,
            'name': node_name,
            'name_en': node.get('name_en') or frontmatter.get('name_en'),
            'category': node.get('category') or frontmatter.get('category'),
            'knowledge_type': node.get('knowledge_type') or frontmatter.get('knowledge_type'),
            'bloom_level': node.get('bloom_level') or frontmatter.get('bloom_level'),
            'definition': card_definition or node.get('definition'),
            'examples': node.get('examples') or [],
            'formulas': node_formulas,
            'keywords': node_keywords,
        },
        'card_path': repo_path(card_path) if card_path.exists() else None,
        'card_frontmatter': frontmatter,
        'card_overview': compact_markdown(overview, 1400),
        'card_detail': compact_markdown(detail, 1600),
        'card_plain_excerpt': compact_markdown(strip_frontmatter(card_markdown), 2200),
        'core_intuition': core_intuition,
        'relations': related_relations,
        'visual_architecture': visual_architecture_for_node(
            node_name,
            groups,
            node_keywords,
            node_formulas,
        ),
        'constraints': {
            'facts_must_come_from_source': True,
            'formula_rendering_policy': 'render_key_formula_anchors_when_present_then_review_visually',
            'visual_asset_policy': 'combine_concrete_visual_scene_with_technical_insets_not_flat_note_card',
            'target_use': 'interactive lesson entry and global knowledge graph node detail',
        },
    }

    output_dir = node_infograph_dir(args.lesson, node_id)
    write_json(output_dir / 'source.json', source)
    write_text(output_dir / 'prompt.md', build_prompt(source))
    print(repo_path(output_dir / 'source.json'))
    print(repo_path(output_dir / 'prompt.md'))


if __name__ == '__main__':
    main()
