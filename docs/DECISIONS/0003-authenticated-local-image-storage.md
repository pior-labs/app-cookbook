# ADR 0003 — Authenticated local recipe image storage

**Status:** Accepted
**Date:** 2026-08-17

## Context

Phase 1 needs one primary photo per recipe in a private, self-hosted application. Adding object storage would introduce another service and operational boundary for a household-scale collection. Storing original uploads without processing would retain untrusted metadata, inconsistent formats, and unnecessarily large files. Public static delivery would bypass the Cookbook authorization boundary.

## Decision

Store processed image files in an app-owned persistent filesystem directory mounted only into the API container. Store one-to-one recipe image metadata in PostgreSQL.

The API verifies decoded JPEG, PNG, or WebP uploads, enforces byte and dimension limits, strips metadata, and generates `card` and `detail` WebP variants. Files use opaque generated keys and atomic writes. Images are delivered only through authenticated API endpoints with private cache headers.

Soft deletion retains images. Replacement writes new files before switching the database reference. Permanent deletion commits database removal before best-effort file cleanup, with a maintenance command available to reconcile orphans.

## Rationale

Local persistent storage is proportionate to the expected dataset and does not add infrastructure owned by another service. API delivery preserves private access. Normalizing to bounded WebP variants improves card/detail performance and removes risky metadata. The write ordering favors recoverability during partial failures.

## Consequences

- Production must provision and mount a persistent image directory.
- PostgreSQL and image storage form one backup and restore set.
- The API runtime requires an image-decoding/processing dependency.
- Filesystem and database updates cannot share one transaction, so orphan reconciliation is required.
- Moving to object storage later requires a storage adapter/migration but does not change recipe API semantics.
