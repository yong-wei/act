/**
 * Intro-video production-source processor (#1515, task family 3).
 *
 * The released intro videos already live in the ACT runtime media
 * directories and on OSS; the Videos project's generated caption cues are
 * the production script truth. One atom is materialized per caption cue on
 * the narration timeline (the wiring-level intro/outro frame offsets that
 * map narration time onto the rendered mp4 timeline stay an explicit
 * limitation until per-unit verification). The mp4 content hash is the
 * resource identity, so a re-render produces a new identity and an
 * incremental rebinding, exactly as the course owner ruled.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { FormalResourceRemediationError } from '../contracts';

/** One production caption cue from the Videos project. */
export interface ProductionCaptionCue {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** The generated caption module of one lesson (pure data exports). */
export interface GeneratedCaptionsModule {
  readonly captions?: readonly ProductionCaptionCue[];
  readonly narrationDurationSeconds?: number;
}

export interface IntroVideoInventoryEntry {
  readonly unit: string;
  readonly videoPath: string;
  readonly videoSha256: string;
  readonly durationSeconds: number;
}

export interface IntroVideoAtom {
  readonly atomId: string;
  readonly resourceId: string;
  readonly cueIndex: number;
  readonly text: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly timeline: 'narration';
  readonly disposition: 'BOUND';
}

export interface IntroVideoProcessingResult {
  readonly resourceId: string;
  readonly atoms: readonly IntroVideoAtom[];
  readonly excludedReason: string | null;
  readonly limitations: readonly string[];
  readonly outputManifestHash: string;
}

/**
 * Materialize one atom per production cue. A cue without text fails closed;
 * a unit without generated captions resolves to an explicit exclusion rather
 * than an ASR substitute (production script stays the transcript authority).
 */
export function processIntroVideoResource(input: {
  readonly unit: string;
  readonly video: IntroVideoInventoryEntry | null;
  readonly captions: GeneratedCaptionsModule | null;
}): IntroVideoProcessingResult {
  const resourceId = `intro-video-${input.unit}`;
  const limitations: string[] = [];
  if (!input.video) {
    return {
      resourceId,
      atoms: [],
      excludedReason: 'missing-video: no released intro video in the runtime media directory',
      limitations,
      outputManifestHash: projectionDigest({ resourceId, excluded: 'missing-video' }),
    };
  }
  if (!input.captions?.captions || input.captions.captions.length === 0) {
    return {
      resourceId,
      atoms: [],
      excludedReason: 'missing-production-script: no generated caption cues in the Videos project',
      limitations,
      outputManifestHash: projectionDigest({ resourceId, excluded: 'missing-production-script', video: input.video.videoSha256 }),
    };
  }
  const cues = [...input.captions.captions];
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    if (typeof cue.start !== 'number' || typeof cue.end !== 'number' || typeof cue.text !== 'string' || cue.text.length === 0) {
      throw new FormalResourceRemediationError(
        'processor-failure',
        `Intro video ${input.unit} cue ${index} is malformed; production cues need start/end/text.`,
      );
    }
    if (cue.end < cue.start) {
      throw new FormalResourceRemediationError(
        'processor-failure',
        `Intro video ${input.unit} cue ${index} ends before it starts.`,
      );
    }
  }
  const atoms: IntroVideoAtom[] = cues.map((cue, index) => ({
    atomId: `atom-${projectionDigest({
      resourceId,
      kind: 'intro-video-cue',
      videoSha256: input.video?.videoSha256,
      cueIndex: index,
      text: cue.text,
      start: cue.start,
      end: cue.end,
    }).slice(0, 24)}`,
    resourceId,
    cueIndex: index,
    text: cue.text,
    startSeconds: cue.start,
    endSeconds: cue.end,
    timeline: 'narration',
    disposition: 'BOUND',
  }));
  const narrationDuration = input.captions.narrationDurationSeconds ?? cues[cues.length - 1].end;
  limitations.push(
    `cue anchors are on the narration timeline; rendered mp4 duration ${input.video.durationSeconds.toFixed(2)}s vs narration ${narrationDuration.toFixed(2)}s — the per-unit intro/outro frame offset stays pending wiring verification`,
  );
  return {
    resourceId,
    atoms,
    excludedReason: null,
    limitations,
    outputManifestHash: projectionDigest({
      resourceId,
      videoSha256: input.video.videoSha256,
      atoms: atoms.map((atom) => atom.atomId),
      limitations,
    }),
  };
}
