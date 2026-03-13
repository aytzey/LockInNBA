# `src/app/api` Memory

This subtree defines all server endpoints. Keep route behavior explicit and stable.

## Route Design Rules

- Validate input close to the route boundary.
- Return narrow JSON objects; do not leak internal row shapes accidentally.
- Keep business-state transitions in `src/lib/store.ts` where possible.
- Preserve current status-code semantics unless a deliberate API change is requested.

## Important Status-Code Patterns

- `401` for missing/invalid auth
- `403` for wrong token type, expired access, or business-denied access
- `402` for payment-required or question-limit situations in chat flows
- `404` for missing sessions/resources
- `429` for rate-limited requests

## Sensitive Routes

- `admin/**`
- `auth/**`
- `chat/message`
- `payments/**`
- `internal/live-sync`

Double-check auth before changing these.

## Public Data Rules

- `games/today` is intentionally dynamic and no-store
- `bootstrap` exists to collapse homepage cold-start data into one public request
- `predictions/today` returns preview metadata, not full paid markdown
- `social-proof` returns only active public banner text
- `site-copy` returns public CTA, no-edge, header, and footer copy for the homepage

## Payment/Auth Reality

- `create-checkout` can return a Lemon Squeezy hosted URL or the `__mock__` sentinel
- `payments/status` exists so the frontend can poll a hosted checkout result
- `mock-complete` is still the local-development fallback
- `webhook` is now part of the Lemon Squeezy path, not just a placeholder
- magic-link issuance sends email when `LOCKIN_MAIL_FROM` is configured and falls back to a direct-link payload for local/dev use

## Internal Ops Route

- `internal/live-sync` is protected by bearer or query secret
- it is a manual/admin tool, not the normal freshness mechanism

## If You Add A New Route

Also consider whether to update:

- `docs/ai/project-map.md`
- `docs/ai/backend-and-data.md`
- `docs/ai/change-playbook.md`
