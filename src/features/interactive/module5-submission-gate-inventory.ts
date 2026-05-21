import {
  COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY,
} from './course-submission-gate-inventory';

export const MODULE5_RESPONSE_PRODUCING_LESSON_INVENTORY = COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY
  .filter((lesson) => lesson.lessonId.startsWith('5-') && lesson.lessonId !== '5-1');

export const REQUIRED_MODULE5_GATE_LESSONS = MODULE5_RESPONSE_PRODUCING_LESSON_INVENTORY
  .map((lesson) => lesson.lessonId);
