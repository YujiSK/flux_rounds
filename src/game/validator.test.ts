import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank, RoundRule } from "./types";
import { getRoundRule } from "./rules";
import { validateMeld, validateLayoff } from "./validator";

/**
 * Test helpers
 */
const c = (suit: Suit, rank: Rank, id?: string): Card => ({
    id: id ?? `${suit}-${rank}-${Math.random().toString(16).slice(2)}`,
    suit,
    rank,
    deckIndex: 1,
});

const rule = (round: number): RoundRule => getRoundRule(round);

describe("validator.validateMeld", () => {
    it("BOOK success: three of a kind", () => {
        const r = rule(1); // wild=3 (but we won't use wild here)
        const cards = [c("HEARTS", 5), c("CLUBS", 5), c("SPADES", 5)];
        const res = validateMeld(cards, "BOOK", r);
        expect(res.ok).toBe(true);
    });

    it("BOOK failure: mixed ranks", () => {
        const r = rule(1);
        const cards = [c("HEARTS", 5), c("CLUBS", 6), c("SPADES", 5)];
        const res = validateMeld(cards, "BOOK", r);
        expect(res.ok).toBe(false);
    });

    it("RUN success: same suit consecutive", () => {
        const r = rule(1);
        const cards = [c("HEARTS", 5), c("HEARTS", 6), c("HEARTS", 7)];
        const res = validateMeld(cards, "RUN", r);
        expect(res.ok).toBe(true);
    });

    it("RUN failure: different suits", () => {
        const r = rule(1);
        const cards = [c("HEARTS", 5), c("CLUBS", 6), c("HEARTS", 7)];
        const res = validateMeld(cards, "RUN", r);
        expect(res.ok).toBe(false);
    });

    it("RUN failure: non-consecutive ranks", () => {
        const r = rule(1);
        const cards = [c("HEARTS", 5), c("HEARTS", 7), c("HEARTS", 8)];
        const res = validateMeld(cards, "RUN", r);
        expect(res.ok).toBe(false);
    });

    it("RUN success: wildcard fills a gap (e.g., 5, WILD, 7)", () => {
        const r = rule(1); // wildRank=3
        // Use rank=3 as a "round wild" in round 1
        const cards = [c("HEARTS", 5), c("SPADES", 3), c("HEARTS", 7)];
        const res = validateMeld(cards, "RUN", r);
        expect(res.ok).toBe(true);
    });
});

describe("validator.validateLayoff", () => {
    it("Layoff success: extend a RUN (add 8 to 5-6-7 HEARTS)", () => {
        const r = rule(1);
        const meldCards = [c("HEARTS", 5), c("HEARTS", 6), c("HEARTS", 7)];
        const addedCards = [c("HEARTS", 8)];
        const res = validateLayoff({
            meldType: "RUN",
            meldCards,
            addedCards,
            rule: r,
        });
        expect(res.ok).toBe(true);
    });

    it("Layoff failure: invalid card for RUN (wrong suit / breaks sequence)", () => {
        const r = rule(1);
        const meldCards = [c("HEARTS", 5), c("HEARTS", 6), c("HEARTS", 7)];
        const addedCards = [c("CLUBS", 9)];
        const res = validateLayoff({
            meldType: "RUN",
            meldCards,
            addedCards,
            rule: r,
        });
        expect(res.ok).toBe(false);
    });

    it("Layoff success: add to BOOK (add another 5)", () => {
        const r = rule(1);
        const meldCards = [c("HEARTS", 5), c("CLUBS", 5), c("SPADES", 5)];
        const addedCards = [c("DIAMONDS", 5)];
        const res = validateLayoff({
            meldType: "BOOK",
            meldCards,
            addedCards,
            rule: r,
        });
        expect(res.ok).toBe(true);
    });
});
