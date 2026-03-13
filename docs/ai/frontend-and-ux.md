# Frontend And UX Guide

The frontend is a conversion surface first and a data board second.

## 1. Main Page Responsibilities

`src/app/page.tsx` owns:

- initial data fetch
- prediction preview state
- live game board state
- daily unlock state
- selected chat game state
- share-card mode
- live polling cadence

It is the orchestration layer, not a dumb view.

## 2. Polling Behavior

The public board polls based on slate state:

- live games present: fastest interval
- active slate without live games: medium interval
- quiet/final slate: slow interval

Extra rules:

- polling pauses when the tab is hidden
- a visible-tab event triggers a fresh fetch
- selected chat game is kept in sync when scoreboard state changes

Do not replace this with unconditional rapid polling.

## 3. Component Ownership

### `TonightsEdge`

Owns:

- preview framing for the daily pick
- daily checkout initiation
- hosted checkout popup or redirect fallback
- unlock completion
- unlocked markdown view
- share button for the daily card

The card must support a first-class "No edge day" state.

### `GameCard`

Owns:

- matchup summary
- moneyline presentation
- live or final score presentation
- match-pulse teaser
- entrypoint into matchup chat

Live games should look visibly different from upcoming/final cards.

### `ChatModal`

Owns:

- chat session creation
- match-chat purchase flow
- extra-questions purchase flow
- hosted checkout popup/polling behavior
- paid token caching
- sending messages
- displaying remaining question capacity

Chat is intentionally modal and sales-aware. It is not a generic chat page.

### `RestoreAccess`

Owns:

- email entry for access restoration
- calling magic-link creation and verification callbacks

### `ShareCard`

Owns:

- hidden or staged render surface for exported images

## 4. localStorage Contracts

Daily access:

- stored under the constant from `DAILY_TOKEN_KEY`

Chat access:

- stored per session using `CHAT_TOKEN_PREFIX + sessionId`

Admin access:

- admin page stores a token under `lockin_admin_token`

If these keys change, update both writers and readers together.

## 5. UX Intent

The current UI tries to feel:

- premium
- fast
- sports-betting adjacent, but not sportsbook-cluttered
- bold without looking like a dashboard template

Implications:

- preserve strong visual contrast
- avoid flattening the homepage into plain cards on white
- preserve motion where it signals state change
- keep live games visually obvious

## 6. Data Truth In The UI

Important UI data truths:

- `teaserText` is preview copy, not the full pick
- unlocked daily markdown is the paid object
- the game board is public context and conversion fuel
- live score and status labels are not cosmetic; they are part of the product promise
- chat messages are bound to one game only

## 7. Failure Handling Expectations

Current UX usually fails soft:

- initial fetch errors should not hard-crash the page
- payment/network failures should show narrow local error messages
- LLM/provider failures should still leave a usable fallback output server-side
- game fetch failure should fall back to cached data when possible
- hosted checkout popup blocking should fall back to full-page redirect

## 8. When Editing Frontend

Do:

- preserve the unlock and restore flows
- keep EST labeling clear
- maintain chat modal focus, close, and backdrop behavior
- keep share export working against the hidden render surface
- verify mobile and desktop layouts if you touch structure

Do not:

- move payment or auth business rules into client-only logic
- assume scores exist for upcoming games
- assume moneylines are always non-zero
- break no-edge-day handling
- remove blur/preview framing unless the paywall model changes

## 9. Testing Focus For Frontend Changes

If you edit homepage or components, verify:

- page loads without console-breaking errors
- daily preview still renders
- no-edge-day UI still works
- live card scores still display
- chat modal opens and closes
- checkout initiation still works
- unlocked content still renders markdown
- restore access still accepts email flow
