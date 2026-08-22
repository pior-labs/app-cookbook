// @cookbook/domain — pure business rules shared by trusted packages.
//
// This package must not import Hono, Drizzle, React, filesystem code, or
// environment configuration. It owns ingredient math, unit definitions,
// normalization, stable domain types, and request/response validation so the
// API, the web app, and future consumers (such as MCP) agree on one
// implementation. See technical design section 3.

export * from './ingredients/index.js';
export * from './text/normalize.js';
export * from './types/index.js';
export * from './schemas/index.js';
