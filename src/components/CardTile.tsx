// src/components/CardTile.tsx
import type { Card } from "../game/types";
import { rankLabel } from "../game/rules";

type Props = {
    card: Card;
    isWild: boolean;
    selected: boolean;
    disabled?: boolean;
    onClick?: () => void;
};

function suitAccent(suit: Card["suit"]) {
    switch (suit) {
        case "STARS":
            return "from-amber-400/25 to-amber-400/0";
        case "HEARTS":
            return "from-rose-400/25 to-rose-400/0";
        case "CLUBS":
            return "from-emerald-400/25 to-emerald-400/0";
        case "SPADES":
            return "from-indigo-400/25 to-indigo-400/0";
        case "DIAMONDS":
            return "from-sky-400/25 to-sky-400/0";
        default:
            return "from-slate-400/20 to-slate-400/0";
    }
}

function suitGlyph(suit: Card["suit"]) {
    switch (suit) {
        case "STARS":
            return "★";
        case "HEARTS":
            return "♥";
        case "CLUBS":
            return "♣";
        case "SPADES":
            return "♠";
        case "DIAMONDS":
            return "♦";
        default:
            return "•";
    }
}

export default function CardTile({ card, isWild, selected, disabled, onClick }: Props) {
    const isJoker = card.rank === 0;

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={[
                "relative w-[92px] h-[120px] md:w-[102px] md:h-[132px]",
                "rounded-2xl border transition",
                "bg-slate-950/35 backdrop-blur",
                "disabled:opacity-40",
                selected ? "border-slate-100 shadow-[0_0_0_2px_rgba(255,255,255,0.15)]" : "border-slate-700",
                isWild ? "ring-1 ring-amber-400/70" : "",
            ].join(" ")}
            title={card.id}
        >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${suitAccent(card.suit)}`} />

            {isWild && (
                <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full border border-amber-400/70 bg-amber-400/10 text-amber-200">
                    WILD
                </div>
            )}

            <div className="relative h-full w-full p-3 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                    <div className="text-lg font-semibold leading-none">{rankLabel(card.rank)}</div>
                    <div className="text-lg leading-none text-slate-200/90">
                        {isJoker ? "🃏" : suitGlyph(card.suit)}
                    </div>
                </div>

                <div className="flex items-end justify-between">
                    <div className="text-[11px] tracking-wide text-slate-300">
                        {isJoker ? "JOKER" : card.suit}
                    </div>
                    <div className="text-[10px] text-slate-500">D{card.deckIndex}</div>
                </div>
            </div>
        </button>
    );
}
