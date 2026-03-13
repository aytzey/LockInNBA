# `src/components` Memory

These components are not generic design-system atoms. They encode product behavior.

## Main Product Components

- `TonightsEdge.tsx`
  Daily pick preview, unlock, and unlocked markdown.

- `GameCard.tsx`
  Public matchup card with odds and live/final score treatment.

- `ChatModal.tsx`
  Match-chat payment, token restore, question flow, and transcript rendering.

- `RestoreAccess.tsx`
  Daily access recovery UX.

- `ShareCard.tsx`
  Export surface for image generation.

## UX Rules

- keep live games visually obvious
- keep no-edge-day as a first-class state
- keep payment errors local and understandable
- preserve EST labels on time displays
- do not remove the distinction between preview and unlocked content

## State Contracts

- daily access token is stored in localStorage
- chat access token is stored per session
- admin page uses a separate token key outside this subtree

## Polling And Sync

- homepage polling cadence depends on slate state
- hosted checkout polling may happen when the user returns with a checkout session id
- selected chat game should stay updated when live score data changes
- do not introduce constant aggressive polling for all states

## If You Change UI Contracts

Check whether the related route or helper also needs an update:

- `src/components/types.ts`
- `src/components/api.ts`
- `src/app/page.tsx`
- matching API route under `src/app/api`
