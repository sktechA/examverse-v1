-- SKTech Exam Portal V13
-- OPTIONAL ONE-TIME CLEAN START
-- Clears old imported question/review data so the Question dashboard starts empty.
-- Does NOT delete candidates, profiles, exams, vacancies, notifications, or system logs.

BEGIN;

-- Old imported questions, including pending/review/approved/rejected records.
DELETE FROM public.questions;

-- Old import history/counts, if present.
DELETE FROM public.question_imports;

COMMIT;

-- Expected result after running:
-- public.questions       = 0 rows
-- public.question_imports = 0 rows
