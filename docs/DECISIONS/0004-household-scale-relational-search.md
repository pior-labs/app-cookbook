# ADR 0004 — Household-scale relational search

**Status:** Proposed
**Date:** 2026-08-17

## Context

Phase 1 search must match recipe names, descriptions, ingredients, categories, and tags. The initial collection is household-scale. A separate search service, PostgreSQL extension, or denormalized search index would add write coordination and deployment complexity before measured need exists.

## Decision

Implement search with parameterized PostgreSQL queries over the normalized relational model. Normalize and bound query tokens, require every token to match at least one searchable field, and use escaped case-insensitive predicates with `EXISTS` subqueries for ingredients and tags.

Compose text search with category, tag, favorite, rating, and time filters. Exclude soft-deleted recipes from every normal search path. Keep search behavior behind the stable recipe collection API.

## Rationale

Relational search is simple, testable, and sufficient for the expected number of recipes. It avoids infrastructure and denormalized write paths while satisfying the PRD's discovery requirements. Keeping the HTTP contract independent of the implementation leaves room to optimize after measurement.

## Consequences

- Leading-wildcard searches will not use ordinary B-tree indexes efficiently.
- Query construction and wildcard escaping require dedicated integration tests.
- Search relevance is intentionally simple in Phase 1.
- If measurements show unacceptable latency, the API may later use a search document, `pg_trgm`, full-text search, or another backend without changing callers.
