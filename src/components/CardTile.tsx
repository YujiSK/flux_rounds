// src/components/CardTile.tsx
import type { Card } from "../game/types";
import { rankLabel } from "../game/rules";

type Props = {
    card: Card;
    isWild: boolean;
    selected?: boolean;
    dimmed?: boolean;
    disabled?: boolean;
    highlight?: "book" | "run" | null;
    onClick: () => void;
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

export default function CardTile({ card, isWild, selected, dimmed, disabled, highlight, onClick }: Props) {
    const isJoker = card.rank === 0;

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={[
                "relative w-[92px] h-[120px] md:w-[102px] md:h-[132px]",
                "rounded-2xl border transition-all duration-300",
                "bg-slate-950/35 backdrop-blur-sm",
                "disabled:opacity-40",
                selected
                    ? (highlight === "book" ? "border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.3)]" :
                        highlight === "run" ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]" :
                            "border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]") + " -translate-y-1 z-10 scale-[1.02]"
                    : "border-slate-700/80",
                dimmed ? "opacity-60 scale-[0.98]" : "opacity-100",
                isWild ? "ring-1 ring-amber-400/50" : "",
                (selected && highlight === "book") ? "ring-2 ring-blue-400/20" :
                    (selected && highlight === "run") ? "ring-2 ring-emerald-400/20" : "",
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
