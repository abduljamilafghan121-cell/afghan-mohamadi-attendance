-- Add per-user visit-plan rotation cycle length (1 = weekly, 2 = bi-weekly, 4 = monthly).
ALTER TABLE "User" ADD COLUMN "planCycleWeeks" INTEGER NOT NULL DEFAULT 1;

-- Add weekIndex to WeeklyPlanTemplate (1-indexed week within the user's cycle).
ALTER TABLE "WeeklyPlanTemplate" ADD COLUMN "weekIndex" INTEGER NOT NULL DEFAULT 1;

-- Replace the old (userId, weekday) unique constraint with (userId, weekday, weekIndex).
DROP INDEX "WeeklyPlanTemplate_userId_weekday_key";
CREATE UNIQUE INDEX "WeeklyPlanTemplate_userId_weekday_weekIndex_key"
  ON "WeeklyPlanTemplate"("userId", "weekday", "weekIndex");

-- Replace the old (weekday) index with (weekday, weekIndex).
DROP INDEX "WeeklyPlanTemplate_weekday_idx";
CREATE INDEX "WeeklyPlanTemplate_weekday_weekIndex_idx"
  ON "WeeklyPlanTemplate"("weekday", "weekIndex");
