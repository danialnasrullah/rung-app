import { PersonalizedRoomView, Seat } from "../lib/types";
import { CardBack, PlayingCard } from "./PlayingCard";

interface TableProps {
  view: PersonalizedRoomView;
}

const HAND_SIZE = 13;

const SUIT_SYMBOL: Record<string, string> = {
  spades: "♠", diamonds: "♦", clubs: "♣", hearts: "♥",
};
const SUIT_COLOR: Record<string, string> = {
  spades: "text-slate-900", diamonds: "text-rose-600", clubs: "text-slate-900", hearts: "text-rose-600",
};

function relativeLabel(offset: number): string {
  if (offset === 2) return "Partner";
  if (offset === 1) return "Left";
  return "Right";
}

export function Table({ view }: TableProps) {
  const { seat: yourSeat, seats, dealerSeat, hand } = view;
  const opponents = [1, 2, 3].map((offset) => {
    const seat = ((yourSeat + offset) % 4) as Seat;
    return { seat, offset, occupant: seats[seat] };
  });

  const cardsRemaining = (seat: Seat): number => {
    const played = hand?.currentTrick.filter((pc) => pc.seat === seat).length ?? 0;
    // We don't know exact opponent hand sizes without leaking info beyond
    // count; approximate remaining-in-hand for display using sar progress.
    const sarsPlayed = hand?.sarNumber ?? 0;
    return Math.max(HAND_SIZE - sarsPlayed - played, 0);
  };

  const seatBadges = (seat: Seat) => (
    <div className="flex gap-1 text-[10px] uppercase tracking-wide text-gold-400/80">
      {dealerSeat === seat && <span className="rounded border border-gold-500/50 px-1">Dealer</span>}
      {hand?.rungSelectorSeat === seat && (
        <span className="rounded border border-gold-500/50 px-1">Rung Selector</span>
      )}
      {hand?.leaderSeat === seat && hand.currentTrick.length === 0 && (
        <span className="rounded border border-gold-500/50 px-1">Leads</span>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="grid grid-cols-3 items-center gap-2">
        {opponents.map(({ seat, offset, occupant }) => {
          const trickCard = hand?.currentTrick.find((pc) => pc.seat === seat)?.card;
          const gridColClass = offset === 2 ? "col-start-2" : offset === 1 ? "col-start-1" : "col-start-3";
          return (
            <div key={seat} className={`flex flex-col items-center gap-1 ${gridColClass}`}>
              <span className="text-xs text-slate-300">
                {occupant?.displayName ?? "Waiting..."} · {relativeLabel(offset)}
              </span>
              {seatBadges(seat)}
              <div className="flex -space-x-6">
                {Array.from({ length: Math.min(cardsRemaining(seat), 5) }).map((_, i) => (
                  <CardBack key={i} size="sm" />
                ))}
              </div>
              {trickCard && <PlayingCard card={trickCard} size="sm" />}
            </div>
          );
        })}
      </div>

      <div className="my-6 flex flex-col items-center gap-2 rounded-xl border border-gold-500/20 bg-felt/40 py-6">
        <span className="text-xs uppercase tracking-widest text-gold-400/70">
          Sar {Math.min((hand?.sarNumber ?? 0) + 1, HAND_SIZE)} of {HAND_SIZE} · Heap: {hand?.heapSarCount ?? 0}
        </span>
        {hand?.rungOpened && hand.rungSuit && (
          <span className={`text-sm font-semibold ${SUIT_COLOR[hand.rungSuit]}`}>
            Rung: {SUIT_SYMBOL[hand.rungSuit]} {hand.rungSuit.charAt(0).toUpperCase() + hand.rungSuit.slice(1)}
          </span>
        )}
        {hand?.rungChosen && !hand.rungOpened && (
          <span className="text-xs italic text-slate-500">Rung: hidden</span>
        )}
        <div className="flex gap-3">
          {hand?.currentTrick.map((pc) => (
            <PlayingCard key={pc.seat} card={pc.card} size="md" />
          ))}
          {(!hand || hand.currentTrick.length === 0) &&
            (hand?.heapTopCard ? (
              <PlayingCard card={hand.heapTopCard} size="md" />
            ) : (
              <span className="text-sm italic text-slate-400">No cards played yet</span>
            ))}
        </div>
      </div>
    </div>
  );
}
