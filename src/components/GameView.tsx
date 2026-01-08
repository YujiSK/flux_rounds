// src/components/GameView.tsx
import React from "react";
import type { Card, MeldType, Suit } from "../game/types";
import type { GameState } from "../game/state";
import { FiveCrownsCompat, isWildRank } from "../game/rules";
import {
    drawOne,
    discardOne,
    takeDiscardTop,
    recycleDiscardIntoDraw,
    defaultRng,
} from "../game/deck";
import { nextRound, triggerOutIfNeeded, consumeOutTurnIfNeeded } from "../game/state";
import { validateMeld, validateLayoff } from "../game/validator";

import CardTile from "./CardTile";
import RulePanel from "./RulePanel";

type Props = {
    state: GameState;
    setState: React.Dispatch<React.SetStateAction<GameState>>;
};

function suitOrderIndex(suit: Suit): number {
    return FiveCrownsCompat.suits.indexOf(suit);
}

function sortByRankThenSuit(hand: Card[]): Card[] {
    return [...hand].sort((a, b) => {
        if (a.rank !== b.rank) return (a.rank as number) - (b.rank as number);
        return suitOrderIndex(a.suit) - suitOrderIndex(b.suit);
    });
}

function sortBySuitThenRank(hand: Card[]): Card[] {
    return [...hand].sort((a, b) => {
        const sa = suitOrderIndex(a.suit);
        const sb = suitOrderIndex(b.suit);
        if (sa !== sb) return sa - sb;
        return (a.rank as number) - (b.rank as number);
    });
}

export default function GameView({ state, setState }: Props) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    const rng = React.useMemo(() => defaultRng, []);
    const canAct = state.status === "PLAYING";

    const canDraw = canAct && state.turnPhase === "NEED_DRAW";
    const canDiscard = canAct && state.turnPhase === "NEED_DISCARD";
    const canMeld = canAct && state.turnPhase === "NEED_DISCARD";

    const selectedCards = React.useMemo(() => {
        const map = new Map(currentPlayer.hand.map((c) => [c.id, c]));
        return state.selectedCardIds.map((id) => map.get(id)).filter(Boolean) as Card[];
    }, [currentPlayer.hand, state.selectedCardIds]);

    const onToggleSelect = (cardId: string) => {
        if (!canAct) return;
        setState((prev) => {
            const has = prev.selectedCardIds.includes(cardId);
            const selectedCardIds = has
                ? prev.selectedCardIds.filter((id) => id !== cardId)
                : [...prev.selectedCardIds, cardId];
            return { ...prev, selectedCardIds };
        });
    };

    const onClearSelection = () => setState((prev) => ({ ...prev, selectedCardIds: [] }));

    const onSortRank = () => {
        if (!canAct) return;
        setState((prev) => {
            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: sortByRankThenSuit(p.hand) } : p
            );
            return { ...prev, players, message: "Sorted hand: Rank → Suit" };
        });
    };

    const onSortSuit = () => {
        if (!canAct) return;
        setState((prev) => {
            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: sortBySuitThenRank(p.hand) } : p
            );
            return { ...prev, players, message: "Sorted hand: Suit → Rank" };
        });
    };

    const onDrawFromDeck = () => {
        if (!canDraw) return;

        setState((prev) => {
            let { drawPile, discardPile } = prev;

            if (drawPile.length === 0) {
                const recycled = recycleDiscardIntoDraw(drawPile, discardPile, rng);
                drawPile = recycled.drawPile;
                discardPile = recycled.discardPile;
            }

            const res = drawOne(drawPile);
            const card = res.card;
            drawPile = res.drawPile;

            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: [...p.hand, card] } : p
            );

            return {
                ...prev,
                players,
                drawPile,
                discardPile,
                turnPhase: "NEED_DISCARD",
                message: `${players[prev.currentPlayerIndex].name} drew a card. Now discard 1 card.`,
            };
        });
    };

    const onDrawFromDiscard = () => {
        if (!canDraw) return;

        setState((prev) => {
            if (prev.discardPile.length === 0) return { ...prev, message: "Discard pile is empty." };

            const res = takeDiscardTop(prev.discardPile);
            const card = res.card;

            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: [...p.hand, card] } : p
            );

            return {
                ...prev,
                players,
                discardPile: res.discardPile,
                turnPhase: "NEED_DISCARD",
                message: `${players[prev.currentPlayerIndex].name} took the top discard. Now discard 1 card.`,
            };
        });
    };

    const onSubmitMeld = () => {
        if (!canMeld) return;

        setState((prev) => {
            const me = prev.players[prev.currentPlayerIndex];

            const handMap = new Map(me.hand.map((c) => [c.id, c]));
            const cards = prev.selectedCardIds.map((id) => handMap.get(id)).filter(Boolean) as Card[];
            if (cards.length === 0) return { ...prev, message: "Select cards first." };

            // Auto-detect: try BOOK first, then RUN
            let type: MeldType = "BOOK";
            let result = validateMeld(cards, "BOOK", prev.rule);
            if (!result.ok) {
                result = validateMeld(cards, "RUN", prev.rule);
                type = "RUN";
            }
            if (!result.ok) return { ...prev, message: `Invalid meld: ${result.reason}` };

            const remove = new Set(cards.map((c) => c.id));
            const newHand = me.hand.filter((c) => !remove.has(c.id));

            // Must keep at least 1 card for discard (Go out happens on discard, not meld)
            if (newHand.length < 1) {
                return { ...prev, message: "Must keep 1 card to discard. (Go out happens on discard.)" };
            }

            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: newHand } : p
            );

            const meldId = `R${prev.round}-${me.id}-${Date.now()}`;
            const melds = [
                ...prev.melds,
                { id: meldId, playerId: me.id, type, cards, round: prev.round },
            ];

            return {
                ...prev,
                players,
                melds,
                selectedCardIds: [],
                message: `${me.name} submitted a ${type} (${cards.length}). Now discard 1 card.`,
            };
        });
    };

    const onLayoffToMeld = (meldId: string) => {
        if (!canAct || !canMeld) return;
        setState((prev) => {
            const me = prev.players[prev.currentPlayerIndex];

            if (prev.selectedCardIds.length === 0) {
                return { ...prev, message: "Select cards to lay off first." };
            }

            const handMap = new Map(me.hand.map((c) => [c.id, c]));
            const addedCards = prev.selectedCardIds.map((id) => handMap.get(id)).filter(Boolean) as Card[];
            if (addedCards.length === 0) return { ...prev, message: "Selected cards not found in hand." };

            // Must keep at least 1 card for discard (Go out happens on discard)
            if (me.hand.length - addedCards.length < 1) {
                return { ...prev, message: "Must keep 1 card to discard. (Go out happens on discard.)" };
            }

            const target = prev.melds.find((m) => m.id === meldId);
            if (!target) return { ...prev, message: "Target meld not found." };

            const result = validateLayoff({
                meldType: target.type,
                meldCards: target.cards,
                addedCards,
                rule: prev.rule,
            });
            if (!result.ok) return { ...prev, message: `Lay off failed: ${result.reason}` };

            const remove = new Set(addedCards.map((c) => c.id));
            const newHand = me.hand.filter((c) => !remove.has(c.id));

            const melds = prev.melds.map((m) =>
                m.id === meldId ? { ...m, cards: [...m.cards, ...addedCards] } : m
            );

            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: newHand } : p
            );

            return {
                ...prev,
                players,
                melds,
                selectedCardIds: [],
                message: `Laid off ${addedCards.length} card(s) onto ${target.type}. Now discard 1 card.`,
            };
        });
    };

    const onDiscardSelected = () => {
        if (!canDiscard) return;

        setState((prev) => {
            const me = prev.players[prev.currentPlayerIndex];

            if (prev.selectedCardIds.length !== 1) {
                return { ...prev, message: "To discard, select exactly 1 card." };
            }

            const cardId = prev.selectedCardIds[0];
            const card = me.hand.find((c) => c.id === cardId);
            if (!card) return { ...prev, message: "Card not found." };

            const newHand = me.hand.filter((c) => c.id !== cardId);
            const newDiscard = discardOne(prev.discardPile, card);

            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: newHand } : p
            );

            let base: GameState = {
                ...prev,
                players,
                discardPile: newDiscard,
                selectedCardIds: [],
            };

            // If current player empties hand on discard => out triggers (final turns)
            if (newHand.length === 0) {
                base = triggerOutIfNeeded(base, me.id);
            } else {
                // If out already triggered earlier by someone else, and THIS player just finished their turn,
                // decrement remaining final turns (exclude the out player's own "out" turn).
                if (base.outTriggeredByPlayerId && base.outTriggeredByPlayerId !== me.id) {
                    base = consumeOutTurnIfNeeded(base);
                    if (base.status !== "PLAYING") return base; // round ended
                }
            }

            // Next player
            const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
            return {
                ...base,
                currentPlayerIndex: nextPlayerIndex,
                turnPhase: "NEED_DRAW",
                message: base.message ?? `${me.name} discarded 1 card. Next: ${players[nextPlayerIndex].name} (Draw 1).`,
            };
        });
    };

    const onNextRound = () => setState((prev) => nextRound(prev, { startDiscard: true }));

    const topDiscard = state.discardPile[state.discardPile.length - 1];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
                <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-semibold">Flux Rounds</h1>
                        <p className="text-slate-300">Five Crowns compatible mode (original UI / original code).</p>
                    </div>
                    <div className="text-slate-300">
                        Turn: <span className="font-semibold text-slate-100">{currentPlayer.name}</span>
                    </div>
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 space-y-4">
                        <RulePanel
                            round={state.round}
                            totalRounds={FiveCrownsCompat.totalRounds}
                            rule={state.rule}
                            phase={state.turnPhase}
                            outInfo={{
                                outBy: state.outTriggeredByPlayerId,
                                turnsLeft: state.turnsRemainingAfterOut,
                            }}
                        />

                        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                            <div className="text-sm text-slate-300">Piles</div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-slate-300 text-sm">Draw</div>
                                    <div className="text-lg font-semibold">{state.drawPile.length}</div>
                                </div>
                                <button
                                    onClick={onDrawFromDeck}
                                    className="px-3 py-2 rounded-lg bg-slate-100 text-slate-900 font-medium disabled:opacity-40"
                                    disabled={!canDraw}
                                >
                                    Draw (Deck)
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-slate-300 text-sm">Discard Top</div>
                                    <div className="text-sm text-slate-200 truncate">
                                        {topDiscard ? `${topDiscard.suit}-${topDiscard.rank}${isWildRank(topDiscard.rank, state.rule) ? " (W)" : ""}` : "-"}
                                    </div>
                                </div>
                                <button
                                    onClick={onDrawFromDiscard}
                                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-medium disabled:opacity-40"
                                    disabled={!canDraw || state.discardPile.length === 0}
                                >
                                    Take
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                            <div className="text-sm text-slate-300 mb-2">Players</div>
                            <div className="space-y-2">
                                {state.players.map((p, idx) => (
                                    <div
                                        key={p.id}
                                        className={`rounded-xl border p-3 ${idx === state.currentPlayerIndex ? "border-slate-100" : "border-slate-700"
                                            } bg-slate-950/25`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="font-medium">{p.name}</div>
                                            <div className="text-slate-300 text-sm">Hand: {p.hand.length}</div>
                                        </div>
                                        <div className="text-slate-400 text-sm">Score: {p.score}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="text-sm text-slate-300">
                                Hand: <span className="text-slate-100 font-semibold">{currentPlayer.hand.length}</span>{" "}
                                / Selected: <span className="text-slate-100 font-semibold">{state.selectedCardIds.length}</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={onSortRank}
                                    disabled={!canAct}
                                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-medium disabled:opacity-40"
                                >
                                    Sort Rank→Suit
                                </button>
                                <button
                                    onClick={onSortSuit}
                                    disabled={!canAct}
                                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-medium disabled:opacity-40"
                                >
                                    Sort Suit→Rank
                                </button>

                                <button
                                    onClick={onSubmitMeld}
                                    disabled={!canMeld || selectedCards.length < 3}
                                    className="px-3 py-2 rounded-lg bg-slate-100 text-slate-900 font-medium disabled:opacity-40"
                                >
                                    Meld
                                </button>

                                <button
                                    onClick={onDiscardSelected}
                                    disabled={!canDiscard || state.selectedCardIds.length !== 1}
                                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-medium disabled:opacity-40"
                                >
                                    Discard Selected
                                </button>

                                <button
                                    onClick={onClearSelection}
                                    disabled={!canAct || state.selectedCardIds.length === 0}
                                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-medium disabled:opacity-40"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4">
                            <div className="text-xs text-slate-400 mb-3">
                                Five Crowns compat: Joker is always wild. Round wild rank changes each round.
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {currentPlayer.hand.map((c) => (
                                    <CardTile
                                        key={c.id}
                                        card={c}
                                        isWild={isWildRank(c.rank, state.rule)}
                                        selected={state.selectedCardIds.includes(c.id)}
                                        disabled={!canAct}
                                        onClick={() => onToggleSelect(c.id)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm text-slate-300">Melds (this round)</div>
                                <div className="text-xs text-slate-500">Public table</div>
                            </div>

                            {state.melds.length === 0 ? (
                                <div className="text-slate-400 text-sm">No melds yet.</div>
                            ) : (
                                <div className="space-y-3">
                                    {state.melds.map((m) => (
                                        <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-slate-200 text-sm font-medium">
                                                    {m.playerId} — {m.type}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs text-slate-500">{m.cards.length} cards</div>
                                                    <button
                                                        onClick={() => onLayoffToMeld(m.id)}
                                                        disabled={!canMeld || state.selectedCardIds.length === 0}
                                                        className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium disabled:opacity-40"
                                                    >
                                                        Lay Off
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {m.cards.map((c) => (
                                                    <span key={c.id} className="text-xs px-2 py-1 rounded-lg border border-slate-800 bg-slate-950/30">
                                                        {c.rank === 0 ? "JOKER" : `${c.suit}-${c.rank}`}
                                                        {isWildRank(c.rank, state.rule) ? " (W)" : ""}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {(state.status === "ROUND_END" || state.status === "GAME_OVER") && (
                            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4 space-y-2">
                                <div className="text-slate-200 font-medium">
                                    {state.status === "GAME_OVER" ? "Game Over" : "Round End"}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {state.players.map((p) => (
                                        <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                            <div className="flex items-center justify-between">
                                                <div>{p.name}</div>
                                                <div className="font-semibold">{p.score}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {state.status === "ROUND_END" && (
                                    <button
                                        onClick={onNextRound}
                                        className="mt-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-900 font-medium"
                                    >
                                        Next Round
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {state.message && <footer className="text-slate-300 text-sm">{state.message}</footer>}
            </div>
        </div>
    );
}
