import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Replace this starter table with the application's real domain schema before
// generating the first production migration.
export const exampleRecords = pgTable('example_records', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
