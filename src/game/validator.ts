// src/game/validator.ts
import type { Card, MeldType, RoundRule, Suit } from "./types";
import { isWildRank } from "./rules";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateMeld(cards: Card[], type: MeldType, rule: RoundRule): ValidationResult {
    if (cards.length < 3) return { ok: false, reason: "Need at least 3 cards." };

    if (type === "BOOK") return validateBook(cards, rule);
    return validateRun(cards, rule);
}

function validateBook(cards: Card[], rule: RoundRule): ValidationResult {
    const nonWild = cards.filter((c) => !isWildRank(c.rank, rule));
    if (nonWild.length === 0) {
        // all wilds: allow as BOOK (common house rule); if you want stricter, reject here
        return { ok: true };
    }
    const target = nonWild[0].rank;
    for (const c of nonWild) {
        if (c.rank !== target) return { ok: false, reason: "BOOK must share the same rank." };
    }
    return { ok: true };
}

/**
 * RUN rules (Five Crowns style):
 * - Same suit for all NON-wild cards
 * - Sequence length >=3
 * - Wilds can fill gaps
 * - No duplicate ranks among non-wilds (within same suit)
 */
function validateRun(cards: Card[], rule: RoundRule): ValidationResult {
    const nonWild = cards.filter((c) => !isWildRank(c.rank, rule));
    if (nonWild.length === 0) {
        // all wilds: allow as RUN (house-friendly). If you want stricter, reject.
        return { ok: true };
    }

    // Suit must match among non-wilds
    const suit: Suit = nonWild[0].suit;
    for (const c of nonWild) {
        if (c.suit !== suit) return { ok: false, reason: "RUN must be a single suit (non-wild cards)." };
    }

    // Sort non-wild ranks
    const ranks = nonWild.map((c) => c.rank).sort((a, b) => (a as number) - (b as number));
    // No duplicates
    for (let i = 1; i < ranks.length; i++) {
        if (ranks[i] === ranks[i - 1]) return { ok: false, reason: "RUN cannot contain duplicate ranks." };
    }

    const wildCount = cards.length - nonWild.length;

    // Check if wilds can fill the gaps to make continuous sequence
    // We compute required wilds for gaps between sorted ranks:
    let needed = 0;
    for (let i = 1; i < ranks.length; i++) {
        const prev = ranks[i - 1] as number;
        const cur = ranks[i] as number;
        const gap = cur - prev - 1;
        if (gap < 0) return { ok: false, reason: "Invalid rank ordering." };
        needed += gap;
    }

    if (needed > wildCount) {
        return { ok: false, reason: "Not enough wild cards to complete the RUN sequence." };
    }

    // Also ensure length>=3 already guaranteed. No need to bound endpoints.
    return { ok: true };
}

/**
 * Validate laying off cards onto an existing meld.
 * Re-validates the combined meld (existing + added cards).
 */
export function validateLayoff(params: {
    meldType: MeldType;
    meldCards: Card[];
    addedCards: Card[];
    rule: RoundRule;
}): ValidationResult {
    const { meldType, meldCards, addedCards, rule } = params;
    if (addedCards.length === 0) return { ok: false, reason: "Select cards to lay off." };
    return validateMeld([...meldCards, ...addedCards], meldType, rule);
}
