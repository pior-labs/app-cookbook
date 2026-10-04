ALTER TABLE "recipe_ingredients" ADD COLUMN "original_text" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "import_method" text;