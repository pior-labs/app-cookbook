# ADR 0002 — Exact ingredient quantities with application units

**Status:** Accepted
**Date:** 2026-08-17

## Context

Cookbook must scale ingredient quantities deterministically and display familiar fractions. Future grocery aggregation also depends on quantities remaining mathematically reliable. Floating-point values introduce rounding drift, formatted strings cannot be calculated safely, and a PostgreSQL unit enum would make normal unit additions require database migrations.

Recipes must also support unquantified ingredients, unitless counts, known convertible measures, and household labels such as `clove`, `can`, or `pinch`.

## Decision

Store each optional quantity as a reduced positive numerator/denominator integer pair. Store known units as text codes from a versioned TypeScript registry and custom/non-convertible units as a separate normalized text label. Both quantity columns may be null; known and custom unit fields are mutually exclusive.

Implement parsing, reduction, scaling, unit labeling, and display formatting in the pure `@cookbook/domain` package. Serving scaling uses exact fraction arithmetic:

```text
quantity × requested servings / base servings
```

Phase 1 preserves the saved unit and performs no automatic unit conversion.

## Rationale

Rational integers preserve values such as one third exactly, make scaling deterministic, and support human-readable mixed fractions without storing presentation text. Text-backed application units can evolve without PostgreSQL enum migrations while still giving known units stable codes. The pure domain boundary makes the same rules reusable by the API, web application, tests, and future MCP implementation.

## Consequences

- API and database checks must enforce valid paired quantities and mutually exclusive unit fields.
- Inputs must be reduced before persistence.
- Very large numerators/denominators and denominators above the validation limit are rejected.
- Display may use a rounded decimal for unwieldy fractions, but calculations retain the exact rational value.
- Compatible unit conversion and cross-recipe ingredient normalization remain deferred.
