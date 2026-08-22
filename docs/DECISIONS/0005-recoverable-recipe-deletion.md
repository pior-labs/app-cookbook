# ADR 0005 — Recoverable recipe deletion

**Status:** Accepted
**Date:** 2026-08-17

## Context

Recipes are long-lived household data, and the PRD requires accidental deletion to be recoverable. Related ingredients, instructions, tags, images, favorites, ratings, and recent history should return intact after restoration. A hidden default query condition alone is easy for future repositories to omit.

## Decision

Soft-delete recipes with `deleted_at` and `deleted_by_user_id`. Normal repositories explicitly scope to active recipes; Trash uses separate repository methods that explicitly scope to deleted recipes.

Soft deletion retains all dependent rows and image files. Restoration clears the deletion metadata. Categories referenced by active or trashed recipes cannot be deleted, ensuring lossless restoration. Tags may be deleted because removing a tag association does not invalidate a recipe.

Permanent deletion is available only from Trash after explicit recipe-name confirmation. It removes dependent database rows through defined cascades and then cleans up image files. Phase 1 has no automatic retention policy.

## Rationale

Soft deletion provides immediate recovery with minimal domain complexity. Separate active and Trash query paths make deletion scope visible in code review. Retaining related state means restoration behaves as users expect rather than recreating an incomplete recipe.

## Consequences

- Every active recipe query must use the active repository path.
- Unique constraints must be evaluated deliberately when deleted records exist.
- Trashed recipes continue to prevent deletion of their category.
- Storage is not reclaimed until explicit permanent deletion.
- Permanent deletion and image cleanup require integration and recovery tests.
