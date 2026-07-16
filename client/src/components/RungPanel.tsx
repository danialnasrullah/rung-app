import { Card } from "../lib/types";
import { PlayingCard } from "./PlayingCard";

interface RungPanelProps {
  isYou: boolean;
  yourCards: Card[];
  onSelectRung: (card: Card) => void;
  onRequestRedeal: () => void;
  reshuffleMessage?: string | null;
}

export function RungPanel({
  isYou,
  yourCards,
  onSelectRung,
  onRequestRedeal,
  reshuffleMessage,
}: RungPanelProps) {
  if (!isYou) {
    return (
      <div className="mx-auto max-w-sm rounded-xl border border-gold-500/30 bg-royal-800 p-6 text-center text-slate-200">
        Waiting for the rung selector to choose a card or call a redeal.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-gold-500/30 bg-royal-800 p-6 text-center">
      {reshuffleMessage && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          {reshuffleMessage} — choose again.
        </div>
      )}
      <p className="text-sm text-slate-200">
        Click a card to set it as the <span className="text-gold-400 font-semibold">rung (trump)</span>.
        That card will be hidden until rung is opened. Or call a redeal if your first five has no face card.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {yourCards.map((card) => (
          <div key={`${card.suit}-${card.rank}`} className="flex flex-col items-center gap-1">
            <PlayingCard
              card={card}
              size="lg"
              onClick={() => onSelectRung(card)}
            />
          </div>
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
