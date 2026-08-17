# ADR 0001 — Central SSO with application-local sessions

**Status:** Accepted
**Date:** 2026-08-16

## Context

Cookbook must use the Pior Labs `service-auth` identity provider and must not
create a separate password or registration system. Its domain model still needs
a stable local user key for created-by metadata, favorites, ratings, and recent
history. Browser requests also need an application session that can be checked
without sending central OAuth tokens from frontend code.

## Decision

Cookbook is a confidential OAuth/OIDC client of `service-auth` using
authorization code with PKCE. Better Auth handles the client callback and
stores an HTTP-only Cookbook session in PostgreSQL.

The application stores a local user row linked through an OAuth account whose
provider is `auth-pior` and whose account ID is the central subject. Domain
tables reference the local numeric user ID. Cookbook exposes no local password,
signup, or alternate identity provider.

Health and OAuth endpoints remain public. All other `/api/*` endpoints require
a valid local session.

## Rationale

This keeps authentication and household membership centralized while giving
Cookbook durable referential integrity for user-specific data. A same-origin,
HTTP-only session avoids exposing the client secret, access token, or refresh
token to the Vite application and follows the established Pior Labs client
pattern.

## Consequences

- `service-auth` and Cookbook must share the registered client ID, client
  secret, issuer, scopes, and exact callback URL.
- Local and production databases each require the Cookbook auth migration.
- The Cookbook API database contains session and OAuth token material and must
  be protected and backed up accordingly.
- Removing a household identity from the central provider prevents future
  authentication, while existing Cookbook sessions remain valid until they
  expire or are revoked locally.
- Future user-owned Cookbook data references `users.id`, not email or the raw
  central subject.
