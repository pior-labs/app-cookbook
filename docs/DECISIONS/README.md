# Architecture Decision Log

This directory records durable technical decisions for Pior Labs Cookbook.

Use a decision record when the rationale matters enough that a future contributor or coding agent may otherwise revisit the same question without context.

Examples include:

- Recipe image storage strategy
- Ingredient quantity/unit representation
- Search implementation
- Soft-deletion approach
- MCP boundary and permissions
- A deliberate deviation from the normal Pior Labs paved road

Do not create a decision record for routine implementation details that are obvious from the code or already established by platform conventions.

## File naming

Use sequential files:

```text
0001-short-decision-name.md
0002-next-decision.md
```

## Suggested format

```markdown
# ADR 0001 — Decision title

**Status:** Proposed | Accepted | Superseded
**Date:** YYYY-MM-DD

## Context

What problem or constraint requires a decision?

## Decision

What are we choosing?

## Rationale

Why is this the preferred option?

## Consequences

What tradeoffs, follow-up work, or constraints result from this decision?
```

If a decision is later replaced, retain the old record, mark it `Superseded`, and link to the replacement rather than deleting the historical rationale.