import * as THREE from 'three';

export function captureSemanticAnimationState(mixer: THREE.AnimationMixer, clips: readonly THREE.AnimationClip[], elapsed: ReadonlyMap<string, number>) {
  return { time: mixer.time, actions: clips.flatMap(clip => {
    const action = mixer.existingAction(clip);
    return action?.isScheduled() ? [{ name: clip.name, elapsed: elapsed.get(clip.name) ?? action.time,
      timeScale: action.timeScale, loop: action.loop, repetitions: action.repetitions,
      clamp: action.clampWhenFinished, paused: action.paused, enabled: action.enabled, weight: action.weight }] : [];
  }) };
}

/** 用公共 API 恢复整段进度，包含 pingpong 的反向半程；不读写 Three 私有计数器。 */
export function restoreSemanticAnimationState(mixer: THREE.AnimationMixer, clips: readonly THREE.AnimationClip[],
  snapshot: ReturnType<typeof captureSemanticAnimationState>) {
  const restored: { action: THREE.AnimationAction; saved: (typeof snapshot.actions)[number] }[] = [];
  for (const saved of snapshot.actions) {
    const clip = clips.find(clip => clip.name === saved.name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.reset().setLoop(saved.loop, saved.repetitions);
    action.setEffectiveTimeScale(1);
    action.clampWhenFinished = saved.clamp; action.weight = saved.weight;
    action.startAt(mixer.time - saved.elapsed).play(); restored.push({ action, saved });
  }
  // 正向的一次极小步消费 scheduled start，使 Three 自己重建循环方向和末帧。
  mixer.update(1e-9);
  for (const { action, saved } of restored) {
    action.timeScale = saved.timeScale; action.paused = saved.paused; action.enabled = saved.enabled;
  }
  mixer.time = snapshot.time; mixer.update(0);
}
