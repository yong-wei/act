CREATE OR REPLACE FUNCTION enforce_teacher_ai_grading_hidden_acceptance_transition() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Teacher AI grading hidden acceptance rows cannot be deleted';
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."splitId" <> OLD."splitId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'Teacher AI grading hidden acceptance identity is immutable';
  END IF;

  IF OLD."state" = 'SEALED' AND NEW."state" = 'RUNNING' THEN
    RETURN NEW;
  END IF;

  IF OLD."state" = 'RUNNING' AND NEW."state" = 'RUNNING'
     AND OLD."batchId" IS NULL AND NEW."batchId" IS NOT NULL
     AND NEW."configId" = OLD."configId"
     AND NEW."startKey" = OLD."startKey"
     AND NEW."startRequestHash" = OLD."startRequestHash"
     AND NEW."startedAt" = OLD."startedAt"
     AND NEW."consumedAt" IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD."state" = 'RUNNING' AND NEW."state" = 'CONSUMED'
     AND NEW."configId" = OLD."configId"
     AND NEW."batchId" = OLD."batchId"
     AND NEW."startKey" = OLD."startKey"
     AND NEW."startRequestHash" = OLD."startRequestHash"
     AND NEW."startedAt" = OLD."startedAt" THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid teacher AI grading hidden acceptance transition';
END;
$$ LANGUAGE plpgsql;
