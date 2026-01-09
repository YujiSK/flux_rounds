// src/components/GameView.tsx
import React from "react";
import type { Card, MeldType, Suit, RoundRule } from "../game/types";
import type { GameState } from "../game/state";
import { FiveCrownsCompat, isWildRank, rankLabel } from "../game/rules";
import {
    drawOne,
    discardOne,
    takeDiscardTop,
    recycleDiscardIntoDraw,
    defaultRng,
} from "../game/deck";
import { nextRound, afterDiscard } from "../game/state";
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

function Btn(props: {
    kind?: "primary" | "secondary" | "ghost";
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
}) {
    const kind = props.kind ?? "secondary";
    const base =
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold " +
        "transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
    const cls =
        kind === "primary"
            ? base + " bg-slate-100 text-slate-900 hover:bg-white"
            : kind === "ghost"
                ? base + " bg-transparent text-slate-200 hover:bg-slate-800/50 border border-slate-700/60"
                : base + " bg-slate-800/70 text-slate-100 hover:bg-slate-800 border border-slate-700/60";
    return (
        <button className={`${cls} ${props.className ?? ""}`} disabled={props.disabled} onClick={props.onClick}>
            {props.children}
        </button>
    );
}

function Badge({ children, className, kind }: { children: React.ReactNode; className?: string; kind?: "default" | "highlight" }) {
    const isHighlight = kind === "highlight";
    const base = "rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
    const theme = isHighlight
        ? "border-white bg-white text-slate-900 shadow-sm"
        : "border-slate-700/60 bg-slate-900/50 text-slate-200";

    return (
        <span className={`${base} ${theme} ${className ?? ""}`}>
            {children}
        </span>
    );
}

/**
 * RUNの有効な両端（次に置けるランク）を計算する
 */
function getRunEdges(cards: Card[], rule: RoundRule): { min: number; max: number; suit: Suit } | null {
    const nonWild = cards.filter((c) => !isWildRank(c.rank, rule));
    if (nonWild.length === 0) return null; // オールワイルドの手は考慮外（基本起きない）

    const suit = nonWild[0].suit;
    const ranks = nonWild.map((c) => c.rank).sort((a, b) => a - b);
    // const wildCount = cards.length - nonWild.length;

    // Gaps between non-wilds
    // let gaps = 0;
    // for (let i = 1; i < ranks.length; i++) {
    //     gaps += ranks[i] - ranks[i - 1] - 1;
    // }

    // const remainingWilds = wildCount - gaps;
    // 五Crownsの場合、RUNは 3..13 の範囲
    // 最小ランクは ranks[0] - (左に振れるワイルド数)
    // 最大ランクは ranks[last] + (右に振れるワイルド数)
    // ただしワイルドは左右どちらにも振れるので、ガイドとしては「現在の連番のすぐ外側」を出すのが適切

    // 現在の「実質的な」最小と最大を求める（ワイルドを内側の埋め合わせに使った後の余りを考慮）
    // シンプルに：非ワイルドの最小-1 と 最大+1 が候補。
    // ワイルドが余っているなら、それを含ませたさらに外側もあり得るが、ガイドは「次の1枚」で良い。
    return {
        min: ranks[0],
        max: ranks[ranks.length - 1],
        suit
    };
}

/**
 * ターンフェーズとゲームステータスに応じたアクションガイドを生成
 */
function getActionGuide(state: GameState): { title: string; subtitle: string } {
    if (state.status === "ROUND_END") {
        return { title: "Round ended", subtitle: "Review scores, then proceed to next round." };
    }
    if (state.status === "GAME_OVER") {
        return { title: "Game over", subtitle: "Lowest total score wins." };
    }

    const isFinalTurns = !!state.outTriggeredByPlayerId;
    const finalLeft = state.turnsRemainingAfterOut ?? 0;

    if (state.turnPhase === "NEED_DRAW") {
        return {
            title: "Your turn: Draw 1 card",
            subtitle: isFinalTurns
                ? `Final turns mode. Choose Deck or Discard pile. (Remaining: ${finalLeft})`
                : "Choose Deck or Discard pile.",
        };
    }

    return {
        title: "Your turn: Discard 1 card",
        subtitle: isFinalTurns
            ? `Final turns mode. Meld/Lay Off optional → Discard required. (Remaining: ${finalLeft})`
            : "Meld/Lay Off are optional. Discard is required to end the turn.",
    };
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

    type MeldPreview = {
        canShow: boolean;
        count: number;
        book: { ok: boolean; reason?: string };
        run: { ok: boolean; reason?: string };
        hint?: string;
    };

    const meldPreview = React.useMemo<MeldPreview>(() => {
        const count = selectedCards.length;
        const canShow = state.status === "PLAYING" && state.turnPhase === "NEED_DISCARD";

        if (!canShow || count === 0) {
            return { canShow: false, count, book: { ok: false }, run: { ok: false } };
        }

        // 1-2枚はガイドを出す
        if (count < 3) {
            return {
                canShow: true,
                count,
                book: { ok: false, reason: "Need at least 3 cards." },
                run: { ok: false, reason: "Need at least 3 cards." },
                hint: `Must select ${3 - count} more card${3 - count === 1 ? "" : "s"} to Meld`,
            };
        }

        const bookRes = validateMeld(selectedCards, "BOOK", state.rule);
        const runRes = validateMeld(selectedCards, "RUN", state.rule);

        const book = bookRes.ok ? { ok: true } : { ok: false, reason: bookRes.reason };
        const run = runRes.ok ? { ok: true } : { ok: false, reason: runRes.reason };

        let hint: string | undefined;
        if (!book.ok && !run.ok) {
            hint = book.reason ?? run.reason ?? "Invalid meld.";
        }

        return { canShow: true, count, book, run, hint };
    }, [state.status, state.turnPhase, state.rule, selectedCards]);

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
                return { ...prev, message: "Must select exactly 1 card to discard" };
            }

            const cardId = prev.selectedCardIds[0];
            const card = me.hand.find((c) => c.id === cardId);
            if (!card) return { ...prev, message: "Card not found." };

            const newHand = me.hand.filter((c) => c.id !== cardId);
            const newDiscard = discardOne(prev.discardPile, card);

            const players = prev.players.map((p, idx) =>
                idx === prev.currentPlayerIndex ? { ...p, hand: newHand } : p
            );

            const base: GameState = {
                ...prev,
                players,
                discardPile: newDiscard,
                selectedCardIds: [],
            };

            // ドメインロジックに委譲
            const result = afterDiscard(base, me.id, newHand.length);

            // メッセージ補完
            if (!result.message) {
                const nextPlayer = result.players[result.currentPlayerIndex];
                return {
                    ...result,
                    message: `${me.name} discarded 1 card. Next: ${nextPlayer.name} (Draw 1).`,
                };
            }
            return result;
        });
    };
    const onNextRound = () => setState((prev) => nextRound(prev, { startDiscard: true }));

    const topDiscard = state.discardPile[state.discardPile.length - 1];

    const [shakeId, setShakeId] = React.useState(0);

    React.useEffect(() => {
        if (meldPreview.hint) {
            setShakeId(s => s + 1);
        }
    }, [meldPreview.hint]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans game-grid selection:bg-slate-700">
            <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
                <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Flux Rounds</h1>
                            <Badge className="bg-white/10 border-white/20 text-white/80">Alpha</Badge>
                        </div>
                        <p className="text-slate-400 text-sm mt-1">Five Crowns compatible deck-building experience.</p>
                    </div>
                    <div className="text-slate-300 flex items-center gap-2 bg-slate-900/40 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Current Turn</span>
                        <span className="font-bold text-slate-100">{currentPlayer.name}</span>
                    </div>
                </header>

                {/* Action Guide Bar */}
                {(() => {
                    const guide = getActionGuide(state);
                    return (
                        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="text-slate-100 text-lg font-semibold">{guide.title}</div>
                                    <div className="mt-1 text-slate-300 text-sm leading-relaxed">{guide.subtitle}</div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge>
                                        {state.status}
                                    </Badge>
                                    <Badge>
                                        {state.turnPhase}
                                    </Badge>
                                    {state.outTriggeredByPlayerId && (
                                        <Badge className="border-amber-500/50 bg-amber-500/10 text-amber-200">
                                            Final Turns: {state.turnsRemainingAfterOut ?? 0}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {state.message && (
                                <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-200">
                                    {state.message}
                                </div>
                            )}
                        </div>
                    );
                })()}

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
                                <Btn
                                    onClick={onDrawFromDeck}
                                    kind={canDraw ? "primary" : "secondary"}
                                    disabled={!canDraw}
                                >
                                    Draw (Deck)
                                </Btn>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-slate-300 text-sm">Discard Top</div>
                                    <div className="text-sm text-slate-200 truncate">
                                        {topDiscard ? `${topDiscard.suit}-${topDiscard.rank}${isWildRank(topDiscard.rank, state.rule) ? " (W)" : ""}` : "-"}
                                    </div>
                                </div>
                                <Btn
                                    onClick={onDrawFromDiscard}
                                    kind="secondary"
                                    disabled={!canDraw || state.discardPile.length === 0}
                                >
                                    Take
                                </Btn>
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
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-4">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Your Hand</span>
                                    <span className="text-xl font-bold text-white leading-none">{currentPlayer.hand.length}</span>
                                </div>

                                <div className="h-8 w-[1px] bg-white/10 mx-1" />

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <Badge kind={state.selectedCardIds.length > 0 ? "highlight" : "default"}>
                                            Selected: {state.selectedCardIds.length}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Btn onClick={onSortRank} disabled={!canAct} kind="ghost">
                                    Sort Rank
                                </Btn>
                                <Btn onClick={onSortSuit} disabled={!canAct} kind="ghost">
                                    Sort Suit
                                </Btn>

                                <Btn
                                    onClick={onSubmitMeld}
                                    disabled={!canMeld || !(meldPreview.book.ok || meldPreview.run.ok)}
                                    kind={(meldPreview.book.ok || meldPreview.run.ok) ? "primary" : "secondary"}
                                >
                                    Meld
                                </Btn>

                                <Btn
                                    onClick={onDiscardSelected}
                                    disabled={!canDiscard || state.selectedCardIds.length !== 1}
                                    kind={canDiscard && state.selectedCardIds.length === 1 ? "primary" : "secondary"}
                                >
                                    Discard Selected
                                </Btn>

                                <Btn
                                    onClick={onClearSelection}
                                    disabled={!canAct || state.selectedCardIds.length === 0}
                                    kind="ghost"
                                >
                                    Clear
                                </Btn>
                            </div>
                        </div>

                        {meldPreview.canShow && (
                            <div
                                key={shakeId}
                                className={`rounded-xl border border-slate-700/60 bg-slate-950/40 p-3 ${shakeId > 0 ? "animate-shake-x" : ""}`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-100">
                                        Meld Preview <span className="text-slate-400 font-medium">({meldPreview.count} selected)</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span
                                            className={
                                                "rounded-full px-3 py-1 text-xs font-semibold border transition-colors " +
                                                (meldPreview.book.ok
                                                    ? "border-white bg-white text-slate-900 shadow-sm"
                                                    : "border-slate-700/60 bg-slate-900/40 text-slate-400")
                                            }
                                            title={meldPreview.book.ok ? "BOOK is valid" : meldPreview.book.reason}
                                        >
                                            BOOK {meldPreview.book.ok ? "✓" : "✕"}
                                        </span>

                                        <span
                                            className={
                                                "rounded-full px-3 py-1 text-xs font-semibold border transition-colors " +
                                                (meldPreview.run.ok
                                                    ? "border-white bg-white text-slate-900 shadow-sm"
                                                    : "border-slate-700/60 bg-slate-900/40 text-slate-400")
                                            }
                                            title={meldPreview.run.ok ? "RUN is valid" : meldPreview.run.reason}
                                        >
                                            RUN {meldPreview.run.ok ? "✓" : "✕"}
                                        </span>
                                    </div>
                                </div>

                                {meldPreview.hint && (
                                    <div className="mt-2 text-[13px] text-slate-300 flex items-center gap-2">
                                        <span className="text-amber-400 text-xs text-rose-400">⚠</span>
                                        {meldPreview.hint}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4">
                            <div className="text-xs text-slate-400 mb-3">
                                Five Crowns compat: Joker is always wild. Round wild rank changes each round.
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {currentPlayer.hand.map((c) => {
                                    return (
                                        <CardTile
                                            key={c.id}
                                            card={c}
                                            isWild={isWildRank(c.rank, state.rule)}
                                            selected={state.selectedCardIds.includes(c.id)}
                                            dimmed={state.selectedCardIds.length > 0 && !state.selectedCardIds.includes(c.id)}
                                            disabled={!canAct}
                                            highlight={
                                                meldPreview.book.ok ? "book" :
                                                    meldPreview.run.ok ? "run" :
                                                        null
                                            }
                                            onClick={() => onToggleSelect(c.id)}
                                        />
                                    );
                                })}
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
                                                <div className="flex items-center gap-2">
                                                    <div className="text-slate-200 text-sm font-bold uppercase tracking-wide">
                                                        {m.type}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded uppercase font-bold">
                                                        {state.players.find(p => p.id === m.playerId)?.name ?? m.playerId}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs text-slate-500 font-medium">{m.cards.length} cards</div>
                                                    <Btn
                                                        onClick={() => onLayoffToMeld(m.id)}
                                                        disabled={!canMeld || state.selectedCardIds.length === 0}
                                                        kind="secondary"
                                                        className="px-2 py-1 h-7 text-xs"
                                                    >
                                                        Lay Off
                                                    </Btn>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                {/* RUN Ghost Hint (Left) */}
                                                {m.type === "RUN" && (() => {
                                                    const edges = getRunEdges(m.cards, state.rule);
                                                    if (!edges || edges.min <= 3) return null;
                                                    return (
                                                        <div className="flex items-center gap-1 opacity-20 hover:opacity-100 transition-opacity cursor-default group" title="Can extend left">
                                                            <span className="text-[10px] text-slate-500 font-bold">{rankLabel((edges.min - 1) as any)}</span>
                                                            <div className="w-6 h-8 rounded border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-600 font-bold group-hover:border-slate-400 group-hover:text-slate-300">
                                                                +
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {m.cards.map((c) => (
                                                    <span key={c.id} className={`text-xs px-2 py-1 rounded-lg border transition-all delay-150 ${isWildRank(c.rank, state.rule) ? "border-amber-500/30 bg-amber-500/5 text-amber-200" : "border-slate-800 bg-slate-900/50 text-slate-300"}`}>
                                                        {rankLabel(c.rank)}
                                                        <span className="ml-1 text-[8px] opacity-40">{c.suit.charAt(0)}</span>
                                                    </span>
                                                ))}

                                                {/* RUN Ghost Hint (Right) */}
                                                {m.type === "RUN" && (() => {
                                                    const edges = getRunEdges(m.cards, state.rule);
                                                    if (!edges || edges.max >= 13) return null;
                                                    return (
                                                        <div className="flex items-center gap-1 opacity-20 hover:opacity-100 transition-opacity cursor-default group" title="Can extend right">
                                                            <div className="w-6 h-8 rounded border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-600 font-bold group-hover:border-slate-400 group-hover:text-slate-300">
                                                                +
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold">{rankLabel((edges.max + 1) as any)}</span>
                                                        </div>
                                                    );
                                                })()}
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
                                    <Btn
                                        onClick={onNextRound}
                                        kind="primary"
                                        className="mt-2"
                                    >
                                        Next Round
                                    </Btn>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

