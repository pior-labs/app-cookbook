import { z } from 'zod';
import { categoryTagNameSchema, tagColorSchema } from './primitives.js';

// Categories and tags share the same name rule and case-insensitive uniqueness.
// Uniqueness itself is enforced by the database `normalized_name` constraint;
// these schemas validate the shape and length of the input.

export const createCategorySchema = z.object({ name: categoryTagNameSchema }).strict();
export const renameCategorySchema = z.object({ name: categoryTagNameSchema }).strict();

// A tag also carries a colour, so its write schemas are not the category ones
// under another name. Colour is optional on create - a tag is allowed to have
// none - and, being `.nullable()`, an explicit `null` on update is how a colour
// is taken back off.
export const createTagSchema = z
  .object({ name: categoryTagNameSchema, color: tagColorSchema })
  .strict();
export const updateTagSchema = z
  .object({ name: categoryTagNameSchema, color: tagColorSchema })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
