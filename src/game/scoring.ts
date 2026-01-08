// src/game/scoring.ts
import type { Card, RoundRule } from "./types";
import { isWildRank } from "./rules";

/**
 * Player score for a single round
 */
export type RoundScore = {
    playerId: string;
    handCards: Card[];
    points: number;
    wentOut: boolean;
};

/**
 * Calculate score for remaining cards in hand at end of round
 * MVP: card rank = points, wild card = wildPenalty (default 20)
 */
export function calculateHandScore(
    hand: Card[],
    rule: RoundRule,
    wildPenalty = 20
): number {
    return hand.reduce((total, card) => {
        const points = isWildRank(card.rank, rule) ? wildPenalty : card.rank;
        return total + points;
    }, 0);
}

/**
 * Calculate scores for all players at end of round
 * The player who went out gets 0 points
 */
export function calculateRoundScores(
    playerHands: Map<string, Card[]>,
    winnerId: string,
    rule: RoundRule,
    wildPenalty = 20
): RoundScore[] {
    const scores: RoundScore[] = [];

    for (const [playerId, hand] of playerHands) {
        const wentOut = playerId === winnerId;
        const points = wentOut ? 0 : calculateHandScore(hand, rule, wildPenalty);

        scores.push({
            playerId,
            handCards: hand,
            points,
            wentOut,
        });
    }

    return scores;
}

/**
 * Cumulative score tracking across rounds
 */
export type GameScore = {
    playerId: string;
    roundScores: number[];
    totalScore: number;
};

/**
 * Create initial game score for a player
 */
export function createGameScore(playerId: string): GameScore {
    return {
        playerId,
        roundScores: [],
        totalScore: 0,
    };
}

/**
 * Add round score to game score
 */
export function addRoundScore(
    gameScore: GameScore,
    roundPoints: number
): GameScore {
    const newRoundScores = [...gameScore.roundScores, roundPoints];
    return {
        ...gameScore,
        roundScores: newRoundScores,
        totalScore: newRoundScores.reduce((a, b) => a + b, 0),
    };
}

/**
 * Determine winner(s) at end of game (lowest total score wins)
 * Returns array of player IDs in case of tie
 */
export function determineGameWinners(gameScores: GameScore[]): string[] {
    if (gameScores.length === 0) {
        return [];
    }

    const minScore = Math.min(...gameScores.map((s) => s.totalScore));
    return gameScores
        .filter((s) => s.totalScore === minScore)
        .map((s) => s.playerId);
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
    return score.toString();
}

/**
 * Get ranking of players by score (ascending - lower is better)
 */
export function getRankings(gameScores: GameScore[]): GameScore[] {
    return [...gameScores].sort((a, b) => a.totalScore - b.totalScore);
}
