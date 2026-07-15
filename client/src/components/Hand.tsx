import { useState } from "react";
import { Card, LegalMoveInfo } from "../lib/types";
import { PlayingCard } from "./PlayingCard";

const SUIT_ORDER: Record<Card["suit"], number> = {
  spades: 0,
  diamonds: 1,
  clubs: 2,
  hearts: 3,
};

const RANK_ORDER: Record<Card["rank"], number> = {
  "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5,
  "8": 6, "9": 7, "10": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
};

interface HandProps {
  cards: Card[];
  legalMoves: LegalMoveInfo[];
  onPlay: (card: Card) => void;
  interactive: boolean;
}

export function Hand({ cards, legalMoves, onPlay, interactive }: HandProps) {
  const [reversed, setReversed] = useState(false);

  const legalFor = (card: Card): LegalMoveInfo | undefined =>
    legalMoves.find((m) => m.card.suit === card.suit && m.card.rank === card.rank);

  const dir = reversed ? -1 : 1;
  const sorted = [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    if (suitDiff !== 0) return dir * suitDiff;
    return dir * (RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
  });

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setReversed((r) => !r)}
          title={reversed ? "Currently: ♥♣♦♠ A→2 — click to flip" : "Currently: ♠♦♣♥ 2→A — click to flip"}
          className="flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400 transition-colors hover:border-gold-500/50 hover:text-gold-400"
        >
          <span>{reversed ? "♥♣♦♠" : "♠♦♣♥"}</span>
          <span>⇄</span>
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {sorted.map((card) => {
          const move = legalFor(card);
          const disabled = !interactive || !move?.legal;
          return (
            <PlayingCard
              key={`${card.suit}-${card.rank}`}
              card={card}
              size="lg"
              disabled={disabled}
              onClick={disabled ? undefined : () => onPlay(card)}
            />
          );
        })}
      </div>
    </div>
  );
}
