// src/components/RulePanel.tsx
import type { RoundRule } from "../game/types";
import { FiveCrownsCompat, rankLabel } from "../game/rules";

type Props = {
    round: number;
    totalRounds: number;
    rule: RoundRule;
    phase: "NEED_DRAW" | "NEED_DISCARD";
    outInfo?: { outBy?: string; turnsLeft?: number };
};

export default function RulePanel({ round, totalRounds, rule, phase, outInfo }: Props) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-xs text-slate-400">Round Rule (Five Crowns Compat)</div>
                    <div className="text-lg font-semibold">
                        Round {round} / {totalRounds}
                    </div>
                </div>
                <div className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-950/30 text-slate-200">
                    {phase === "NEED_DRAW" ? "Phase: Draw" : "Phase: Discard"}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <div className="text-xs text-slate-400">Wild Rank</div>
                    <div className="text-xl font-semibold text-amber-200">{rankLabel(rule.wildRank)}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <div className="text-xs text-slate-400">Hand Size</div>
                    <div className="text-xl font-semibold">{rule.handSize}</div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs text-slate-400 mb-2">Turn Flow</div>
                <div className="flex items-center gap-2 text-sm">
                    <span className={`px-2 py-1 rounded-lg border ${phase === "NEED_DRAW" ? "border-slate-100" : "border-slate-800"} bg-slate-950/30`}>
                        1) Draw
                    </span>
                    <span className="text-slate-500">→</span>
                    <span className={`px-2 py-1 rounded-lg border ${phase === "NEED_DISCARD" ? "border-slate-100" : "border-slate-800"} bg-slate-950/30`}>
                        2) Meld (optional)
                    </span>
                    <span className="text-slate-500">→</span>
                    <span className={`px-2 py-1 rounded-lg border ${phase === "NEED_DISCARD" ? "border-slate-100" : "border-slate-800"} bg-slate-950/30`}>
                        3) Discard
                    </span>
                </div>

                <div className="text-xs text-slate-500 mt-2">
                    Scoring: Joker {FiveCrownsCompat.jokerPenalty}, Wild {FiveCrownsCompat.wildPenalty}, others = face value.
                </div>
            </div>

            {outInfo?.outBy && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-3">
                    <div className="text-sm text-amber-200 font-medium">Final Turns Active</div>
                    <div className="text-xs text-slate-300 mt-1">
                        Out by: <span className="font-semibold">{outInfo.outBy}</span> / Turns left:{" "}
                        <span className="font-semibold">{outInfo.turnsLeft ?? 0}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
