import { Suit } from "../lib/types";

const SUITS: { suit: Suit; symbol: string; color: string }[] = [
  { suit: "clubs", symbol: "♣", color: "text-slate-900" },
  { suit: "diamonds", symbol: "♦", color: "text-rose-700" },
  { suit: "hearts", symbol: "♥", color: "text-rose-700" },
  { suit: "spades", symbol: "♠", color: "text-slate-900" },
];

interface RungPanelProps {
  isYou: boolean;
  onSelectRung: (suit: Suit) => void;
  onRequestRedeal: () => void;
}

export function RungPanel({ isYou, onSelectRung, onRequestRedeal }: RungPanelProps) {
  if (!isYou) {
    return (
      <div className="mx-auto max-w-sm rounded-xl border border-gold-500/30 bg-royal-800 p-6 text-center text-slate-200">
        Waiting for the rung selector to choose a suit or call a redeal.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border border-gold-500/30 bg-royal-800 p-6 text-center">
      <p className="text-sm text-slate-200">
        Choose the rung (trump suit) privately, or call a redeal if your first five hold no face card.
      </p>
      <div className="grid grid-cols-4 gap-2">
        {SUITS.map(({ suit, symbol, color }) => (
          <button
            key={suit}
            type="button"
            onClick={() => onSelectRung(suit)}
            className={`rounded-lg border border-gold-500/40 bg-white py-3 text-2xl ${color} transition hover:bg-gold-400/10`}
            aria-label={`Select ${suit} as rung`}
          >
            {symbol}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRequestRedeal}
        className="w-full rounded-lg border border-gold-500/40 py-2 text-sm text-gold-400 transition hover:bg-gold-400/10"
      >
        Request Redeal
      </button>
    </div>
  );
}
