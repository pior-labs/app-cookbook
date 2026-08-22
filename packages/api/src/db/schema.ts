import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

// Cookbook keeps application-local users and sessions, while service-auth is
// the only authority allowed to create identities. The linked OAuth account
// records the stable central subject for each local user.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('accounts_user_id_idx').on(table.userId),
    index('accounts_provider_account_idx').on(table.providerId, table.accountId),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: serial('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Cookbook recipe domain
//
// Shared household data: recipes and their ordered ingredients, instructions,
// tags, and single image, plus shared categories/tags and per-user favorites,
// ratings, and recently viewed history. Normalized names back case-insensitive
// uniqueness and search. Soft deletion keeps rows and image files, so foreign
// keys cascade only on permanent (hard) deletion of a parent. See the technical
// design, sections 4-5, and ADRs 0002-0005.
// ---------------------------------------------------------------------------

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('categories_normalized_name_idx').on(table.normalizedName)],
);

export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('tags_normalized_name_idx').on(table.normalizedName)],
);

export const recipes = pgTable(
  'recipes',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    baseServings: integer('base_servings').notNull(),
    prepMinutes: integer('prep_minutes'),
    cookMinutes: integer('cook_minutes'),
    notes: text('notes'),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    sourceUrl: text('source_url'),
    sourceText: text('source_text'),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedByUserId: integer('deleted_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check('recipes_base_servings_positive', sql`${table.baseServings} > 0`),
    check('recipes_prep_minutes_nonneg', sql`${table.prepMinutes} >= 0`),
    check('recipes_cook_minutes_nonneg', sql`${table.cookMinutes} >= 0`),
    check(
      'recipes_source_mutually_exclusive',
      sql`not (${table.sourceUrl} is not null and ${table.sourceText} is not null)`,
    ),
    check(
      'recipes_soft_delete_consistent',
      sql`(${table.deletedAt} is null) = (${table.deletedByUserId} is null)`,
    ),
    index('recipes_active_created_idx').on(table.deletedAt, table.createdAt, table.id),
    index('recipes_active_updated_idx').on(table.deletedAt, table.updatedAt, table.id),
    index('recipes_category_id_idx').on(table.categoryId),
    index('recipes_created_by_idx').on(table.createdByUserId),
  ],
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: serial('id').primaryKey(),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    quantityNumerator: integer('quantity_numerator'),
    quantityDenominator: integer('quantity_denominator'),
    unitCode: text('unit_code'),
    unitText: text('unit_text'),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    preparation: text('preparation'),
  },
  (table) => [
    check('recipe_ingredients_position_nonneg', sql`${table.position} >= 0`),
    check(
      'recipe_ingredients_quantity_paired',
      sql`(${table.quantityNumerator} is null and ${table.quantityDenominator} is null) or (${table.quantityNumerator} > 0 and ${table.quantityDenominator} > 0)`,
    ),
    check(
      'recipe_ingredients_unit_mutually_exclusive',
      sql`not (${table.unitCode} is not null and ${table.unitText} is not null)`,
    ),
    uniqueIndex('recipe_ingredients_recipe_position_idx').on(table.recipeId, table.position),
  ],
);

export const recipeInstructions = pgTable(
  'recipe_instructions',
  {
    id: serial('id').primaryKey(),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    body: text('body').notNull(),
  },
  (table) => [
    check('recipe_instructions_position_nonneg', sql`${table.position} >= 0`),
    uniqueIndex('recipe_instructions_recipe_position_idx').on(table.recipeId, table.position),
  ],
);

export const recipeTags = pgTable(
  'recipe_tags',
  {
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.tagId] }),
    index('recipe_tags_tag_recipe_idx').on(table.tagId, table.recipeId),
  ],
);

export const recipeImages = pgTable(
  'recipe_images',
  {
    id: serial('id').primaryKey(),
    recipeId: integer('recipe_id')
      .notNull()
      .unique()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    cardStorageKey: text('card_storage_key').notNull(),
    detailStorageKey: text('detail_storage_key').notNull(),
    cardContentHash: text('card_content_hash').notNull(),
    detailContentHash: text('detail_content_hash').notNull(),
    sourceMediaType: text('source_media_type').notNull(),
    sourceByteSize: integer('source_byte_size').notNull(),
    cardWidth: integer('card_width').notNull(),
    cardHeight: integer('card_height').notNull(),
    detailWidth: integer('detail_width').notNull(),
    detailHeight: integer('detail_height').notNull(),
    uploadedByUserId: integer('uploaded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

export const userFavorites = pgTable(
  'user_favorites',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeId] }),
    index('user_favorites_recipe_idx').on(table.recipeId),
  ],
);

export const userRatings = pgTable(
  'user_ratings',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeId] }),
    check('user_ratings_range', sql`${table.rating} between 1 and 5`),
    index('user_ratings_recipe_idx').on(table.recipeId),
  ],
);

export const recentlyViewedRecipes = pgTable(
  'recently_viewed_recipes',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeId] }),
    index('recently_viewed_user_time_idx').on(
      table.userId,
      table.lastViewedAt,
      table.recipeId,
    ),
  ],
);
