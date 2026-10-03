import { it, expect } from 'vitest';
import * as THREE from 'three';
import { captureSemanticAnimationState, restoreSemanticAnimationState } from '../model-packages/semantic-animation-state';

it('restores onto an already advanced mixer and survives repeated effect setup', () => {
  const a = new THREE.Object3D(), b = new THREE.Object3D();
  const clip = new THREE.AnimationClip('move', 2, [new THREE.NumberKeyframeTrack('.position[x]', [0, 2], [0, 2])]);
  const old = new THREE.AnimationMixer(a), target = new THREE.AnimationMixer(b);
  const action = old.clipAction(clip).play(); old.update(0.4); action.setEffectiveTimeScale(0);
  const snapshot = captureSemanticAnimationState(old, [clip], new Map([['move', 0.4]]));
  target.clipAction(clip).play(); target.update(3);
  for (let i = 0; i < 2; i++) {
    restoreSemanticAnimationState(target, [clip], snapshot);
    expect(b.position.x).toBeCloseTo(a.position.x, 6);
  }
});

it('preserves speed-coupled loops, pingpong direction and a clamped attainment action across model replacement', () => {
  const scene = () => { const root = new THREE.Group(); for (const name of ['radar', 'crew', 'gate']) { const node = new THREE.Group(); node.name = name; root.add(node); } return root; };
  const clips = ['radar', 'crew', 'gate'].map(name => new THREE.AnimationClip(name, 2, [new THREE.NumberKeyframeTrack(name + '.position[x]', [0, 2], [0, 20])]));
  const a = scene(), b = scene(), old = new THREE.AnimationMixer(a), next = new THREE.AnimationMixer(b);
  old.clipAction(clips[0]).setEffectiveTimeScale(1.5).play();
  old.clipAction(clips[1]).setLoop(THREE.LoopPingPong, Infinity).play();
  const gate = old.clipAction(clips[2]).setLoop(THREE.LoopOnce, 1); gate.clampWhenFinished = true; gate.play();
  old.update(3);
  const elapsed = new Map([['radar', 4.5], ['crew', 3], ['gate', 3]]);
  restoreSemanticAnimationState(next, clips, captureSemanticAnimationState(old, clips, elapsed));
  for (const name of ['radar', 'crew', 'gate']) expect(b.getObjectByName(name)!.position.x).toBeCloseTo(a.getObjectByName(name)!.position.x, 6);
  expect(next.clipAction(clips[2]).paused).toBe(true); expect(next.time).toBe(old.time);
  old.update(0.2); next.update(0.2);
  for (const name of ['radar', 'crew', 'gate']) expect(b.getObjectByName(name)!.position.x).toBeCloseTo(a.getObjectByName(name)!.position.x, 6);
});
