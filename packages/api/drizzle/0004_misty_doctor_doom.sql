DROP INDEX "grocery_lists_plan_idx";--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD COLUMN "merge_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD COLUMN "dismissed" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
-- One grocery list per plan (ADR 0010). A plan that already has several
-- snapshots keeps its newest, which is the one "Latest list" pointed at, and
-- is treated as saved: it was shopped from. The older snapshots go, with their
-- items by cascade. A plan with no list is still being planned.
DELETE FROM "grocery_lists" AS "older"
USING "grocery_lists" AS "newer"
WHERE "older"."meal_plan_id" = "newer"."meal_plan_id"
  AND "older"."id" < "newer"."id";--> statement-breakpoint
UPDATE "meal_plans"
SET "status" = 'confirmed', "confirmed_at" = "grocery_lists"."created_at"
FROM "grocery_lists"
WHERE "grocery_lists"."meal_plan_id" = "meal_plans"."id";--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_lists_plan_idx" ON "grocery_lists" USING btree ("meal_plan_id");--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plan_status_known" CHECK ("meal_plans"."status" in ('draft', 'confirmed', 'done'));