// src/game/state.ts
import type { Card, MeldType, RoundRule } from "./types";
import { FiveCrownsCompat, getRoundRule, scoreHand } from "./rules";
import { createDecks, shuffle, deal, mulberry32, defaultRng } from "./deck";

export type PlayerState = {
    id: string;
    name: string;
    hand: Card[];
    score: number;
};

export type Meld = {
    id: string;
    playerId: string;
    type: MeldType;
    cards: Card[];
    round: number;
};

export type TurnPhase = "NEED_DRAW" | "NEED_DISCARD";

export type GameState = {
    round: number;
    rule: RoundRule;

    players: PlayerState[];
    currentPlayerIndex: number;

    drawPile: Card[];
    discardPile: Card[];
    melds: Meld[];

    selectedCardIds: string[];
    turnPhase: TurnPhase;

    // Five Crowns feel: go out → others get one last turn
    outTriggeredByPlayerId?: string;
    turnsRemainingAfterOut?: number; // counts completed turns after out (discard completes a turn)

    status: "PLAYING" | "ROUND_END" | "GAME_OVER";
    message?: string;
};

export type NewGameOptions = {
    playerNames?: string[];
    seed?: number;
    startDiscard?: boolean;
};

export function newGame(options?: NewGameOptions): GameState {
    const round = 1;
    const rule = getRoundRule(round);

    const names = options?.playerNames ?? ["Player 1", "Player 2"];
    if (names.length < 2) throw new Error("Need at least 2 players");

    const deck = createDecks({
        suits: FiveCrownsCompat.suits,
        ranks: FiveCrownsCompat.ranks,
        decks: FiveCrownsCompat.decks,
        jokersPerDeck: FiveCrownsCompat.jokersPerDeck,
    });

    const rng = typeof options?.seed === "number" ? mulberry32(options.seed) : defaultRng;
    const shuffled = shuffle(deck, rng);

    const { hands, drawPile, discardPile } = deal(shuffled, names.length, rule.handSize, {
        startDiscard: options?.startDiscard ?? true,
    });

    const players: PlayerState[] = names.map((name, i) => ({
        id: `P${i + 1}`,
        name,
        hand: hands[i],
        score: 0,
    }));

    return {
        round,
        rule,
        players,
        currentPlayerIndex: 0,
        drawPile,
        discardPile,
        melds: [],
        selectedCardIds: [],
        turnPhase: "NEED_DRAW",
        status: "PLAYING",
        message: "Game started. Draw 1 card to begin your turn.",
    };
}

export function endRound(state: GameState): GameState {
    const updatedPlayers = state.players.map((p) => {
        const penalty = scoreHand(p.hand.map((c) => c.rank), state.rule);
        return { ...p, score: p.score + penalty };
    });

    const isGameOver = state.round >= FiveCrownsCompat.totalRounds;

    return {
        ...state,
        players: updatedPlayers,
        selectedCardIds: [],
        turnPhase: "NEED_DRAW",
        status: isGameOver ? "GAME_OVER" : "ROUND_END",
        message: isGameOver
            ? `Game over. Winner: ${computeWinnerName(updatedPlayers)}`
            : `Round ${state.round} ended.`,
        outTriggeredByPlayerId: undefined,
        turnsRemainingAfterOut: undefined,
    };
}

function computeWinnerName(players: PlayerState[]): string {
    const sorted = [...players].sort((a, b) => a.score - b.score);
    return sorted[0]?.name ?? "Unknown";
}

export function nextRound(state: GameState, options?: { seed?: number; startDiscard?: boolean }): GameState {
    if (state.round >= FiveCrownsCompat.totalRounds) {
        return {
            ...state,
            status: "GAME_OVER",
            message: `Game over. Winner: ${computeWinnerName(state.players)}`,
        };
    }

    const round = state.round + 1;
    const rule = getRoundRule(round);

    const deck = createDecks({
        suits: FiveCrownsCompat.suits,
        ranks: FiveCrownsCompat.ranks,
        decks: FiveCrownsCompat.decks,
        jokersPerDeck: FiveCrownsCompat.jokersPerDeck,
    });

    const rng = typeof options?.seed === "number" ? mulberry32(options.seed) : defaultRng;
    const shuffled = shuffle(deck, rng);

    const { hands, drawPile, discardPile } = deal(shuffled, state.players.length, rule.handSize, {
        startDiscard: options?.startDiscard ?? true,
    });

    const players = state.players.map((p, i) => ({ ...p, hand: hands[i] }));

    return {
        ...state,
        round,
        rule,
        players,
        drawPile,
        discardPile,
        melds: [],
        selectedCardIds: [],
        turnPhase: "NEED_DRAW",
        status: "PLAYING",
        outTriggeredByPlayerId: undefined,
        turnsRemainingAfterOut: undefined,
        message: `Round ${round} started. Wild Rank: ${rule.wildRank}`,
    };
}

/**
 * When someone goes out (hand becomes 0), do NOT end round immediately.
 * Give all other players exactly one last turn (Five Crowns feel).
 */
export function triggerOutIfNeeded(state: GameState, playerId: string): GameState {
    if (state.outTriggeredByPlayerId) return state; // already triggered
    const others = state.players.length - 1;
    return {
        ...state,
        outTriggeredByPlayerId: playerId,
        turnsRemainingAfterOut: others,
        message: `${playerId} went out! Others have one final turn each.`,
    };
}

/**
 * Decrement the remaining turns after out. When reaches 0 → endRound.
 * Call this after a NON-out player finishes their turn (discard).
 */
export function consumeOutTurnIfNeeded(state: GameState): GameState {
    if (!state.outTriggeredByPlayerId) return state;
    if (typeof state.turnsRemainingAfterOut !== "number") return state;

    const next = state.turnsRemainingAfterOut - 1;
    if (next <= 0) {
        return endRound({ ...state, message: `Final turns completed. Scoring round ${state.round}...` });
    }
    return { ...state, turnsRemainingAfterOut: next };
}

/**
 * Discard後の状態遷移を処理する。
 * 
 * Invariants:
 * - 初回Out判定: discardで手札0になった場合のみ発火
 * - Out済みなら上書きしない (triggerOutIfNeeded内で保証)
 * - Out後の最終ターン消化: Out本人以外がdiscardでターン終了したら必ず減らす
 * - turnsRemainingAfterOut === 0 でラウンド終了
 * 
 * @param state - Discard後の状態（手札・捨て札は既に更新済み）
 * @param playerId - Discardを行ったプレイヤーのID
 * @param newHandLength - Discard後の手札枚数
 */
export function afterDiscard(
    state: GameState,
    playerId: string,
    newHandLength: number
): GameState {
    let s = state;

    // A) 初回Out判定（discardで0になった場合のみ）
    if (newHandLength === 0 && !s.outTriggeredByPlayerId) {
        s = triggerOutIfNeeded(s, playerId);
    }

    // B) Out後の最終ターン消化（Out本人以外がdiscardでターン終了したら必ず減らす）
    if (s.outTriggeredByPlayerId && s.outTriggeredByPlayerId !== playerId) {
        s = consumeOutTurnIfNeeded(s);
        if (s.status !== "PLAYING") return s; // round ended
    }

    // C) 次プレイヤーへ遷移
    const nextPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;
    return {
        ...s,
        currentPlayerIndex: nextPlayerIndex,
        turnPhase: "NEED_DRAW",
    };
}
