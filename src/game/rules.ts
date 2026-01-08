// src/game/rules.ts
import type { Rank, RoundRule, Suit } from "./types";

export const FiveCrownsCompat = {
    suits: ["STARS", "HEARTS", "CLUBS", "SPADES", "DIAMONDS"] as Suit[],
    ranks: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as Rank[], // 3..10,J,Q,K (no Joker here)
    decks: 2,
    jokersPerDeck: 3,
    totalRounds: 11,
    // scoring
    jokerPenalty: 50,
    wildPenalty: 20,
};

export function getRoundRule(round: number): RoundRule {
    if (round < 1 || round > FiveCrownsCompat.totalRounds) {
        throw new Error(`Invalid round: ${round}`);
    }
    // round1 handSize=3 ... round11 handSize=13
    const handSize = round + 2; // 1->3, 11->13
    const wildRank = (handSize as Rank); // 3..13
    return { round, handSize, wildRank };
}

export function isJoker(rank: Rank): boolean {
    return rank === 0;
}

export function isWildRank(rank: Rank, rule: RoundRule): boolean {
    return isJoker(rank) || rank === rule.wildRank;
}

export function rankLabel(rank: Rank): string {
    if (rank === 0) return "JOKER";
    if (rank <= 10) return String(rank);
    if (rank === 11) return "J";
    if (rank === 12) return "Q";
    return "K";
}

/**
 * Score a remaining hand (penalty): lower is better.
 * - Joker: 50
 * - Round wild (e.g., 7s in round with handSize=7): 20
 * - Number cards: face value
 * - J/Q/K: 11/12/13
 */
export function scoreHand(ranks: Rank[], rule: RoundRule): number {
    let total = 0;
    for (const r of ranks) {
        if (r === 0) total += FiveCrownsCompat.jokerPenalty;
        else if (r === rule.wildRank) total += FiveCrownsCompat.wildPenalty;
        else total += r;
    }
    return total;
}
