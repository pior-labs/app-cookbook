CREATE TABLE "grocery_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"grocery_list_id" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"plan_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"normalization" text NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"recipe_id" integer,
	"recipe_name" text NOT NULL,
	"servings" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "meal_plan_servings_range" CHECK ("meal_plan_items"."servings" between 1 and 100),
	CONSTRAINT "meal_plan_position_nonnegative" CHECK ("meal_plan_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_grocery_list_id_grocery_lists_id_fk" FOREIGN KEY ("grocery_list_id") REFERENCES "public"."grocery_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grocery_items_list_idx" ON "grocery_items" USING btree ("grocery_list_id");--> statement-breakpoint
CREATE INDEX "grocery_lists_plan_idx" ON "grocery_lists" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "meal_plan_items_plan_idx" ON "meal_plan_items" USING btree ("meal_plan_id");