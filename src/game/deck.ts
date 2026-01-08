// src/game/deck.ts
import type { Card, Rank, Suit } from "./types";

export type Rng = () => number;

export const defaultRng: Rng = () => Math.random();

export function mulberry32(seed: number): Rng {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffle<T>(arr: T[], rng: Rng = defaultRng): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function createDecks(params: {
    suits: Suit[];
    ranks: Rank[];          // excluding Joker (0)
    decks: number;          // 2
    jokersPerDeck: number;  // 3 (=> total 6)
}): Card[] {
    const { suits, ranks, decks, jokersPerDeck } = params;
    const out: Card[] = [];

    for (let d = 1; d <= decks; d++) {
        // normal cards
        for (const suit of suits) {
            for (const rank of ranks) {
                const id = `D${d}-${suit}-${rank}-${out.length}`;
                out.push({ id, suit, rank, deckIndex: d });
            }
        }
        // jokers (use STARS as placeholder suit; suit irrelevant for jokers)
        for (let j = 1; j <= jokersPerDeck; j++) {
            const id = `D${d}-JOKER-0-${out.length}`;
            out.push({ id, suit: "STARS", rank: 0, deckIndex: d });
        }
    }

    return out;
}

export function deal(
    deck: Card[],
    playerCount: number,
    handSize: number,
    options?: { startDiscard?: boolean }
): { hands: Card[][]; drawPile: Card[]; discardPile: Card[] } {
    const startDiscard = options?.startDiscard ?? true;

    const hands: Card[][] = Array.from({ length: playerCount }, () => []);
    let index = 0;

    for (let c = 0; c < handSize; c++) {
        for (let p = 0; p < playerCount; p++) {
            hands[p].push(deck[index++]);
        }
    }

    const remaining = deck.slice(index);
    let discardPile: Card[] = [];
    let drawPile = remaining;

    if (startDiscard && drawPile.length > 0) {
        discardPile = [drawPile[0]];
        drawPile = drawPile.slice(1);
    }

    return { hands, drawPile, discardPile };
}

export function drawOne(drawPile: Card[]): { card: Card; drawPile: Card[] } {
    if (drawPile.length === 0) throw new Error("Draw pile empty");
    return { card: drawPile[0], drawPile: drawPile.slice(1) };
}

export function takeDiscardTop(discardPile: Card[]): { card: Card; discardPile: Card[] } {
    if (discardPile.length === 0) throw new Error("Discard pile empty");
    const card = discardPile[discardPile.length - 1];
    return { card, discardPile: discardPile.slice(0, -1) };
}

export function discardOne(discardPile: Card[], card: Card): Card[] {
    return [...discardPile, card];
}

/**
 * If draw pile is empty, recycle discard pile (except top) into draw pile.
 */
export function recycleDiscardIntoDraw(
    drawPile: Card[],
    discardPile: Card[],
    rng: Rng = defaultRng
): { drawPile: Card[]; discardPile: Card[] } {
    if (drawPile.length > 0) return { drawPile, discardPile };
    if (discardPile.length <= 1) return { drawPile, discardPile };

    const top = discardPile[discardPile.length - 1];
    const rest = discardPile.slice(0, -1);
    const newDraw = shuffle(rest, rng);

    return { drawPile: newDraw, discardPile: [top] };
}
