// src/game/types.ts

export type Suit = "STARS" | "HEARTS" | "CLUBS" | "SPADES" | "DIAMONDS";

export type MeldType = "BOOK" | "RUN";

/**
 * Rank encoding:
 * - 0: Joker
 * - 3..13: 3..10, J(11), Q(12), K(13)
 */
export type Rank = 0 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  deckIndex: number; // 1..N
};

export type RoundRule = {
  round: number;      // 1..11
  handSize: number;   // 3..13
  wildRank: Rank;     // 3..13 (never Joker)
};
