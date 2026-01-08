// src/game/index.ts
// Barrel export for game module

export type { Suit, Rank, Card, MeldType, RoundRule } from "./types";

export {
    FiveCrownsCompat,
    getRoundRule,
    isJoker,
    isWildRank,
    rankLabel,
    scoreHand,
} from "./rules";

export type { Rng } from "./deck";
export {
    defaultRng,
    mulberry32,
    shuffle,
    createDecks,
    deal,
    drawOne,
    takeDiscardTop,
    discardOne,
    recycleDiscardIntoDraw,
} from "./deck";

export type { ValidationResult } from "./validator";
export { validateMeld } from "./validator";

export type { PlayerState, Meld, TurnPhase, GameState, NewGameOptions } from "./state";
export {
    newGame,
    endRound,
    nextRound,
    triggerOutIfNeeded,
    consumeOutTurnIfNeeded,
} from "./state";
