# Development Status

**Last updated:** 2026-08-12  
**Current stage:** Pre-development / scaffolded from the Pior Labs app template  
**Current product phase:** Phase 1 — Core Cookbook

This file records the application's **actual implementation state**.

- [`PRD.md`](./PRD.md) describes the desired product behavior.
- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) describes approved implementation decisions once they are made.
- This file describes what currently exists.

Agents and contributors must not infer that a PRD requirement has been implemented simply because it is documented.

## Current state

The repository has been created from the Pior Labs web application template. Product requirements have been defined, but the Cookbook-specific technical design and Phase 1 feature implementation have not yet been completed.

## Completed

- Repository created from the Pior Labs app template.
- Product requirements captured for the Core Cookbook and future phases.
- Documentation hierarchy established.
- Existing Pior Labs application/platform conventions available through `AGENTS.md`.

## In progress

- Finalizing product documentation and agent context.

## Next

Before substantial Cookbook feature implementation:

1. Review and approve `docs/PRD.md` as the product source of truth.
2. Complete `docs/TECHNICAL_DESIGN.md` for Phase 1.
3. Record important architectural decisions in `docs/DECISIONS/` as needed.
4. Break Phase 1 into implementation epics/issues or incremental PRs.
5. Implement Phase 1 only unless scope is explicitly changed.

## Phase 1 — Core Cookbook

**Status:** Not started

Planned scope includes:

- Recipe CRUD
- One primary recipe photo
- Descriptions and optional source attribution
- Structured ingredients and serving scaling
- Ordered instructions and notes
- Prep/cook time
- Categories and custom tags
- Search and filtering
- Per-user favorites
- Per-user 1–5 star ratings
- Per-user recently viewed history
- Created-by metadata
- Recoverable deletion
- Responsive consumer-quality UI/UX
- Integration with existing Pior Labs authentication

### Phase 1.x candidate

- Dedicated Cooking Mode

Cooking Mode is desirable but is not required for the initial Phase 1 release.

## MCP v1

**Status:** Not started  
**Timing:** After Phase 1

MCP should begin once the Phase 1 recipe model and API are stable. Initial read-oriented capabilities are expected to cover recipe search, retrieval, favorites, ratings/tags, and serving scaling.

## Phase 2 — Meal Planning and Grocery Lists

**Status:** Future / not started

## Phase 3 — Smart Recipe Import

**Status:** Future / not started

## Phase 4 — Recipe Roulette

**Status:** Future / not started

## Deferred / backlog

See the PRD for the full backlog. Notable deferred ideas include:

- Nutrition tracking
- Pantry tracking
- Multiple recipe images
- Last-cooked history
- AI-assisted recipe creation
- Grocery-service integrations
- Expanded Cooking Mode features

## Updating this file

Update `STATUS.md` when a meaningful product capability changes state, a phase begins or completes, or an explicitly planned item is deferred.

Do not use this file as a changelog for every commit.