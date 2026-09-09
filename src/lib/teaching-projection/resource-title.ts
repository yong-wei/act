/**
 * Learner-visible titles derived from Teaching Projection resource ids.
 * Kept out of the inspector projector so restage planning can import it
 * without pulling the knowledge-surface capture graph.
 */
export function humanTitleFromResourceId(resourceId: string): string | null {
  const match = resourceId.match(/^act:(audio|video|handout|exercise|card|infographic|simulation|lesson):(.+)$/);
  if (!match) return null;
  const kind = match[1];
  const rest = match[2];
  const unit = rest.match(/(\d+-\d+)/)?.[1];
  const labels: Record<string, string> = {
    audio: '音频',
    video: '视频',
    handout: '讲义',
    exercise: '练习',
    card: '知识卡',
    infographic: '信息图',
    simulation: '仿真',
    lesson: '课程',
  };
  if (kind === 'card') {
    const name = rest.replace(/_\d+_[0-9a-f]+$/i, '').replace(/_/g, ' ').trim();
    return name || labels.card;
  }
  if (unit) return `${unit} ${labels[kind] ?? '教学资源'}`;
  return `${rest} ${labels[kind] ?? '教学资源'}`;
}
