# Flux Rounds — Five Crowns Compatible Card Game (SPA)

A round-based card game with **Five Crowns compatible rules**, built as a **pure front-end SPA** on **GitHub Pages**.

## Live Demo
**[https://YOUR_USERNAME.github.io/flux_rounds/](https://YOUR_USERNAME.github.io/flux_rounds/)**

## Key Features
- **Five Crowns Compatible**: 11 rounds, 5 suits, Jokers (6), round wilds
- **Lay Off**: Add cards to any existing meld
- **Go Out on Discard**: Must discard last card to trigger Out (others get 1 final turn)
- **Turn flow**: `Draw → Meld (optional) → Lay Off (optional) → Discard`
- **Validation-first**: Meld/Lay Off validated before commit
- **Deterministic shuffle**: Seedable PRNG for reproducibility
- **Unit-tested**: Core rule validation with Vitest (meld/layoff)
- **GitHub Pages–only**: No server, no database

### Rules Note
Go Out is **discard-only** (Five Crowns style): Meld/Lay Off cannot reduce hand to zero; Out triggers only when discard makes the hand empty.

---

## Design Decisions

### Why 2-phase turn gating (NEED_DRAW → NEED_DISCARD)
The UI enforces a strict two-phase state machine:
- NEED_DRAW: draw exactly one card (from deck or discard pile)
- NEED_DISCARD: optional meld/layoff actions, then exactly one discard

This eliminates illegal operations (double-draw, discard-before-draw) by construction and keeps the game flow deterministic and easy to review.

### Why validation-first for Meld / Lay Off
All meld and layoff operations are validated before committing state changes:
- `validateMeld()` verifies BOOK/RUN correctness
- `validateLayoff()` re-validates (existing meld + added cards)

This reduces UI-layer complexity and prevents inconsistent states from being created.

### Why "Go Out happens on discard only"
To match Five Crowns-style flow and avoid ambiguous end-of-turn states:
- Meld/Layoff must keep at least 1 card in hand for discard
- Go Out triggers only when a discard results in an empty hand

This makes "turn end" the single synchronization point and keeps final-turn handling reliable.

### Why deterministic shuffle (mulberry32)
Shuffling uses a deterministic PRNG so that a given seed can reproduce the same game state.
This is useful for debugging, validation, and future automated testing.

---

## Edge Cases Handled

- **Final turn consumption even if the player's hand becomes 0**
  After an Out is triggered, each non-Out player consumes exactly one final turn on discard.
  This consumption occurs regardless of whether their post-discard hand becomes 0.

- **Out is immutable once triggered**
  The first player who goes out remains the Out trigger for the round; subsequent empty hands do not overwrite `outTriggeredByPlayerId`.

- **Validation blocks illegal "empty hand via meld/layoff"**
  Meld/Layoff cannot reduce the hand to zero; at least one card must remain for discard.

- **Core rule logic is unit-tested**
  Meld and Layoff validation are covered with Vitest tests (`validateMeld`, `validateLayoff`).

---

## Tech Stack
- **Vite + React + TypeScript**
- Tailwind CSS
- GitHub Actions (build & deploy to Pages)

---

## Architecture Overview

### State Modeling (Core)
This project centers around explicit game state and deterministic transitions.

**Main state (`GameState`) includes:**
- `round`, `rule`
- `players[]` (hand + score)
- `drawPile`, `discardPile`
- `melds[]` (public table)
- `selectedCardIds[]` (UI selection)
- `turnPhase`: `"NEED_DRAW" | "NEED_DISCARD"`
- `status`: `"PLAYING" | "ROUND_END" | "GAME_OVER"`

### Turn Flow (Enforced)
The UI enables actions only when valid for the current phase:

- **NEED_DRAW**
  - Draw from deck OR take discard
- **NEED_DISCARD**
  - Submit meld(s) (optional)
  - Discard exactly one card (required) → next player → NEED_DRAW

This prevents common UI bugs like "double draw" or "discard before draw."

---

## Validation Strategy

### `validator.ts`
Meld rules are checked by a validator function before committing state:

- `validateMeld(cards, type, rule)`
  - Returns `{ ok: boolean, reason?: string }`
  - Keeps UI logic clean: UI only calls validator, then commits on success

### Wild Card Handling
Wild rank changes per round. Validation treats the wild as a flexible component:
- BOOK: wild can act as any rank
- RUN: wild can fill gaps inside a sequence

---

## Deterministic Shuffling (Testing-friendly)
The deck uses Fisher–Yates shuffle with an injectable RNG.

- Default: `Math.random()`
- Optional deterministic: `mulberry32(seed)`

This enables:
- reproducible bug reports
- consistent test runs
- replay-like verification

---

## Deployment (GitHub Pages)
This project is configured to deploy via **GitHub Actions**.

### Why Actions instead of local `npm run deploy`?
- Contributors don't need to run deployment commands locally
- Every push to `main` produces a consistent build output
- CI ensures reproducibility

### SPA 404 Fix
GitHub Pages serves `404.html` for unknown routes.  
We include a small redirect/restore mechanism so direct URL access won't break.

Files involved:
- `public/404.html` (redirect to index with encoded path)
- `index.html` (restores route with `history.replaceState`)

---

## Local Development
```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

---

## Project Structure (Relevant Files)

* `src/game/rules.ts`
  Round rules, wild rank logic, scoring helpers
* `src/game/deck.ts`
  Deck generation, shuffle, dealing, pile operations
* `src/game/state.ts`
  State modeling + round transitions (endRound / nextRound)
* `src/game/validator.ts`
  BOOK/RUN validation (wild-aware)
* `src/components/GameView.tsx`
  UI + phase-based action gating
* `src/components/CardTile.tsx`
  Card-like visual component
* `src/components/RulePanel.tsx`
  Rule card + turn guide UI

---

## IP / Legal Note

Flux Rounds is an **original implementation** with:

* Original naming and branding
* Original UI and card visuals
* Original codebase and documentation

It is **not an official digital version** of any commercial title, and it does not reuse any third-party artwork, logos, or rulebook text.
This project focuses on demonstrating software engineering skills (state modeling, validation, deployment) rather than replicating a specific copyrighted product.

---

## Next Enhancements (Optional Roadmap)

* ~~Lay off onto existing melds~~ ✅ Implemented
* ~~Unit tests for validator~~ ✅ Implemented (Vitest)
* AI opponent (single-player)
* Animation polish (Framer Motion)

---

## License

MIT
