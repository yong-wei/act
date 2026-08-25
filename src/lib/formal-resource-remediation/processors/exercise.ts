/**
 * Exercise processor (#1515, tasks 6.1–6.3, 6.6).
 *
 * One atom per exercise question/task over the complete stem, options,
 * answer, and explanation hashes. Answer and scoring payloads stay in the
 * private processing record: they are hashed into the atom identity but
 * never projected publicly. Formal bindings imply nothing about path
 * eligibility, assessment authority, mastery, or learning evidence.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { FormalResourceRemediationError } from '../contracts';

export interface ExerciseQuestionInput {
  readonly questionId: string;
  readonly stem: string;
  readonly options: readonly string[];
  readonly answer: string;
  readonly explanation: string;
  readonly scoringPayload?: string;
  readonly originLocator: string;
}

export interface ExerciseAtom {
  readonly atomId: string;
  readonly resourceId: string;
  readonly questionId: string;
  /** Hash over the complete stem/options/answer/explanation payload. */
  readonly contentSha256: string;
  readonly disposition: 'BOUND';
  readonly originLocator: string;
  /** Private answer digest: proof without exposure. */
  readonly answerDigest: string;
}

/**
 * Materialize one atom per question. A question without stem or answer
 * fails closed (ambiguous identity), and duplicate question ids are
 * rejected so logical exercise identity stays stable.
 */
export function processExerciseResource(input: {
  resourceId: string;
  questions: readonly ExerciseQuestionInput[];
}): { atoms: readonly ExerciseAtom[] } {
  if (input.questions.length === 0) {
    throw new FormalResourceRemediationError(
      'processor-failure',
      `Exercise resource ${input.resourceId} declares no questions; an explicit exclusion requires a structured failure record instead.`,
    );
  }
  const seen = new Set<string>();
  const atoms: ExerciseAtom[] = [];
  for (const question of input.questions) {
    if (!question.questionId || typeof question.questionId !== 'string') {
      throw new FormalResourceRemediationError(
        'ambiguous-mapping',
        `Exercise resource ${input.resourceId} has a question without a stable logical id.`,
      );
    }
    if (seen.has(question.questionId)) {
      throw new FormalResourceRemediationError(
        'ambiguous-mapping',
        `Question ${question.questionId} appears twice in ${input.resourceId}.`,
      );
    }
    seen.add(question.questionId);
    if (!question.stem?.trim() || !question.answer?.trim()) {
      throw new FormalResourceRemediationError(
        'ambiguous-mapping',
        `Question ${question.questionId} lacks a stem or answer; its atom identity cannot be sealed.`,
      );
    }
    if (!question.originLocator?.trim()) {
      throw new FormalResourceRemediationError(
        'missing-source',
        `Question ${question.questionId} has no origin locator (lesson step / assessment item / registry).`,
      );
    }
    const contentSha256 = projectionDigest({
      stem: question.stem,
      options: [...question.options],
      answer: question.answer,
      explanation: question.explanation,
      ...(question.scoringPayload ? { scoringPayload: question.scoringPayload } : {}),
    });
    const answerDigest = projectionDigest({ kind: 'answer', questionId: question.questionId, answer: question.answer });
    atoms.push({
      atomId: `exq-${projectionDigest({
        resourceId: input.resourceId,
        questionId: question.questionId,
        contentSha256,
      }).slice(0, 24)}`,
      resourceId: input.resourceId,
      questionId: question.questionId,
      contentSha256,
      disposition: 'BOUND',
      originLocator: question.originLocator,
      answerDigest,
    });
  }
  return { atoms };
}

/**
 * The public projection of an exercise atom exposes only identity, locator,
 * and hashes — never stems with embedded answers, options, explanations, or
 * scoring payloads.
 */
export function projectExerciseAtomPublic(atom: ExerciseAtom): Record<string, string> {
  return {
    atomId: atom.atomId,
    resourceId: atom.resourceId,
    questionId: atom.questionId,
    contentSha256: atom.contentSha256,
    originLocator: atom.originLocator,
  };
}
