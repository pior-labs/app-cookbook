CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recently_viewed_recipes" (
	"user_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recently_viewed_recipes_user_id_recipe_id_pk" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"card_storage_key" text NOT NULL,
	"detail_storage_key" text NOT NULL,
	"card_content_hash" text NOT NULL,
	"detail_content_hash" text NOT NULL,
	"source_media_type" text NOT NULL,
	"source_byte_size" integer NOT NULL,
	"card_width" integer NOT NULL,
	"card_height" integer NOT NULL,
	"detail_width" integer NOT NULL,
	"detail_height" integer NOT NULL,
	"uploaded_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_images_recipe_id_unique" UNIQUE("recipe_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"position" integer NOT NULL,
	"quantity_numerator" integer,
	"quantity_denominator" integer,
	"unit_code" text,
	"unit_text" text,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"preparation" text,
	CONSTRAINT "recipe_ingredients_position_nonneg" CHECK ("recipe_ingredients"."position" >= 0),
	CONSTRAINT "recipe_ingredients_quantity_paired" CHECK (("recipe_ingredients"."quantity_numerator" is null and "recipe_ingredients"."quantity_denominator" is null) or ("recipe_ingredients"."quantity_numerator" > 0 and "recipe_ingredients"."quantity_denominator" > 0)),
	CONSTRAINT "recipe_ingredients_unit_mutually_exclusive" CHECK (not ("recipe_ingredients"."unit_code" is not null and "recipe_ingredients"."unit_text" is not null))
);
--> statement-breakpoint
CREATE TABLE "recipe_instructions" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"position" integer NOT NULL,
	"body" text NOT NULL,
	CONSTRAINT "recipe_instructions_position_nonneg" CHECK ("recipe_instructions"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_tags" (
	"recipe_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "recipe_tags_recipe_id_tag_id_pk" PRIMARY KEY("recipe_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"base_servings" integer NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"notes" text,
	"category_id" integer NOT NULL,
	"source_url" text,
	"source_text" text,
	"created_by_user_id" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" integer,
	CONSTRAINT "recipes_base_servings_positive" CHECK ("recipes"."base_servings" > 0),
	CONSTRAINT "recipes_prep_minutes_nonneg" CHECK ("recipes"."prep_minutes" >= 0),
	CONSTRAINT "recipes_cook_minutes_nonneg" CHECK ("recipes"."cook_minutes" >= 0),
	CONSTRAINT "recipes_source_mutually_exclusive" CHECK (not ("recipes"."source_url" is not null and "recipes"."source_text" is not null)),
	CONSTRAINT "recipes_soft_delete_consistent" CHECK (("recipes"."deleted_at" is null) = ("recipes"."deleted_by_user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorites" (
	"user_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_favorites_user_id_recipe_id_pk" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "user_ratings" (
	"user_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ratings_user_id_recipe_id_pk" PRIMARY KEY("user_id","recipe_id"),
	CONSTRAINT "user_ratings_range" CHECK ("user_ratings"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "recently_viewed_recipes" ADD CONSTRAINT "recently_viewed_recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed_recipes" ADD CONSTRAINT "recently_viewed_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD CONSTRAINT "recipe_images_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD CONSTRAINT "recipe_images_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_instructions" ADD CONSTRAINT "recipe_instructions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_normalized_name_idx" ON "categories" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "recently_viewed_user_time_idx" ON "recently_viewed_recipes" USING btree ("user_id","last_viewed_at","recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_ingredients_recipe_position_idx" ON "recipe_ingredients" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_instructions_recipe_position_idx" ON "recipe_instructions" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE INDEX "recipe_tags_tag_recipe_idx" ON "recipe_tags" USING btree ("tag_id","recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_active_created_idx" ON "recipes" USING btree ("deleted_at","created_at","id");--> statement-breakpoint
CREATE INDEX "recipes_active_updated_idx" ON "recipes" USING btree ("deleted_at","updated_at","id");--> statement-breakpoint
CREATE INDEX "recipes_category_id_idx" ON "recipes" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "recipes_created_by_idx" ON "recipes" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_normalized_name_idx" ON "tags" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "user_favorites_recipe_idx" ON "user_favorites" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "user_ratings_recipe_idx" ON "user_ratings" USING btree ("recipe_id");--> statement-breakpoint
INSERT INTO "categories" ("name", "normalized_name") VALUES
	('Breakfast', 'breakfast'),
	('Lunch', 'lunch'),
	('Dinner', 'dinner'),
	('Dessert', 'dessert'),
	('Snack', 'snack'),
	('Drink', 'drink')
ON CONFLICT ("normalized_name") DO NOTHING;