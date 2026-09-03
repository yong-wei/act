DROP INDEX "TeacherAiGradingExperimentExecution_config_split_sample_questio";

CREATE UNIQUE INDEX "TeacherAiGradingExperimentExec_batch_sample_question_repeat_key"
ON "TeacherAiGradingExperimentExecution"("batchId", "sampleId", "questionId", "repetitionOrdinal");
