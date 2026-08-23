import { z } from 'zod';
import { categoryTagNameSchema } from './primitives.js';

// Categories and tags share the same name rule and case-insensitive uniqueness.
// Uniqueness itself is enforced by the database `normalized_name` constraint;
// these schemas validate the shape and length of the input.

export const createCategorySchema = z.object({ name: categoryTagNameSchema }).strict();
export const renameCategorySchema = z.object({ name: categoryTagNameSchema }).strict();

export const createTagSchema = z.object({ name: categoryTagNameSchema }).strict();
export const renameTagSchema = z.object({ name: categoryTagNameSchema }).strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
