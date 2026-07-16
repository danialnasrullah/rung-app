import { PersonalizedRoomView, Seat } from "../lib/types";
import { CardBack, PlayingCard } from "./PlayingCard";

interface TableProps {
  view: PersonalizedRoomView;
}

const HAND_SIZE = 13;

const SUIT_SYMBOL: Record<string, string> = {
  spades: "♠", diamonds: "♦", clubs: "♣", hearts: "♥",
};

/** Suit colors that work on dark backgrounds (table felt area). */
const SUIT_COLOR_DARK: Record<string, string> = {
  spades: "text-slate-200",
  diamonds: "text-rose-400",
  clubs: "text-slate-200",
  hearts: "text-rose-400",
};

function relativeLabel(offset: number): string {
  if (offset === 2) return "Partner";
  if (offset === 1) return "Left";
  return "Right";
}

export function Table({ view }: TableProps) {
  const { seat: yourSeat, seats, dealerSeat, hand } = view;

  // yourSeat can be null during team-selection; Table is only rendered in-hand.
  const mySeat = yourSeat as Seat;

  const opponents = [1, 2, 3].map((offset) => {
    const seat = ((mySeat + offset) % 4) as Seat;
    return { seat, offset, occupant: seats[seat] };
  });

  const partnerSeat = ((mySeat + 2) % 4) as Seat;

  const cardsRemaining = (seat: Seat): number => {
    const played = hand?.currentTrick.filter((pc) => pc.seat === seat).length ?? 0;
    const sarsPlayed = hand?.sarNumber ?? 0;
    return Math.max(HAND_SIZE - sarsPlayed - played, 0);
  };

  /** Seat whose turn it currently is (null when trick is complete / no hand). */
  const currentTurnSeat: Seat | null =
    hand?.phase === "trick-play"
      ? (((hand.leaderSeat + hand.currentTrick.length) % 4) as Seat)
      : null;

  const isMyTurn = currentTurnSeat === mySeat;

  const seatBadges = (seat: Seat) => (
    <div className="flex flex-wrap justify-center gap-1 text-[10px] uppercase tracking-wide text-gold-400/80">
      {dealerSeat === seat && (
        <span className="rounded border border-gold-500/50 px-1">Dealer</span>
      )}
      {hand?.rungSelectorSeat === seat && (
        <span className="rounded border border-gold-500/50 px-1">Rung Selector</span>
      )}
      {hand?.leaderSeat === seat && hand.currentTrick.length === 0 && (
        <span className="rounded border border-gold-500/50 px-1">Leads</span>
      )}
      {currentTurnSeat === seat && hand?.phase === "trick-play" && (
        <span className="rounded border border-amber-400/70 bg-amber-400/10 px-1 text-amber-400">
          ▶ Turn
        </span>
      )}
    </div>
  );

  /** Name color: your partner = emerald, opponents = slate. */
  const nameColor = (seat: Seat) =>
    seat === partnerSeat ? "text-emerald-400 font-medium" : "text-slate-300";

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* ── Your name / turn indicator ────────────────────────────────── */}
      <div
        className={[
          "mb-2 flex justify-center items-center gap-2 rounded-lg px-3 py-1 text-sm transition-all",
          isMyTurn
            ? "border border-amber-400/50 bg-amber-400/10 text-amber-300"
            : "text-slate-400",
        ].join(" ")}
      >
        {seats[mySeat]?.displayName ?? "You"}
        {isMyTurn && <span className="text-xs font-semibold">▶ Your turn</span>}
      </div>

      {/* ── Opponent seats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 items-center gap-2">
        {opponents.map(({ seat, offset, occupant }) => {
          const trickCard = hand?.currentTrick.find((pc) => pc.seat === seat);
          const gridColClass =
            offset === 2 ? "col-start-2" : offset === 1 ? "col-start-1" : "col-start-3";
          const isTheirTurn = currentTurnSeat === seat;

          return (
            <div
              key={seat}
              className={[
                "flex flex-col items-center gap-1 rounded-lg p-2 transition-all",
                isTheirTurn
                  ? "border border-amber-400/40 bg-amber-400/5"
                  : "border border-transparent",
                gridColClass,
              ].join(" ")}
            >
              <span className={`text-xs ${nameColor(seat)}`}>
                {occupant?.displayName ?? "Waiting…"} · {relativeLabel(offset)}
                {!occupant?.connected && (
                  <span className="ml-1 text-rose-400">(disconnected)</span>
                )}
              </span>
              {seatBadges(seat)}
              <div className="flex -space-x-6">
                {Array.from({ length: Math.min(cardsRemaining(seat), 5) }).map((_, i) => (
                  <CardBack key={i} size="sm" />
                ))}
              </div>
              {trickCard &&
                (trickCard.faceDown ? (
                  <CardBack size="sm" />
                ) : (
                  <PlayingCard card={trickCard.card} size="sm" />
                ))}
            </div>
          );
        })}
      </div>

      {/* ── Central table area ────────────────────────────────────────── */}
      <div className="my-4 flex flex-col items-center gap-2 rounded-xl border border-gold-500/20 bg-felt/40 py-5">
        {/* Sar counter + heap */}
        <span className="text-xs uppercase tracking-widest text-gold-400/70">
          Sar {Math.min((hand?.sarNumber ?? 0) + 1, HAND_SIZE)} of {HAND_SIZE} · Heap:{" "}
          {hand?.heapSarCount ?? 0}
        </span>

        {/* Rung display */}
        {hand?.rungSuit ? (
          hand.rungOpened ? (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${SUIT_COLOR_DARK[hand.rungSuit]}`}>
                Rung: {SUIT_SYMBOL[hand.rungSuit]}{" "}
                {hand.rungSuit.charAt(0).toUpperCase() + hand.rungSuit.slice(1)}
              </span>
              {hand.rungCard && (
                <PlayingCard card={hand.rungCard} size="sm" />
              )}
            </div>
          ) : (
            <span className={`text-sm font-semibold ${SUIT_COLOR_DARK[hand.rungSuit]} opacity-80`}>
              Rung: {SUIT_SYMBOL[hand.rungSuit]}{" "}
              {hand.rungSuit.charAt(0).toUpperCase() + hand.rungSuit.slice(1)} (private)
            </span>
          )
        ) : hand?.rungChosen ? (
          <span className="text-xs italic text-slate-500">Rung: hidden</span>
        ) : null}

        {/* Cards in play */}
        <div className="flex flex-wrap justify-center gap-3">
          {hand?.currentTrick && hand.currentTrick.length > 0 ? (
            hand.currentTrick.map((pc) =>
              pc.faceDown ? (
                <CardBack key={pc.seat} size="md" />
              ) : (
                <PlayingCard key={pc.seat} card={pc.card} size="md" />
              ),
            )
          ) : hand?.lastSarCards && hand.lastSarCards.length > 0 ? (
            <>
              <div className="w-full text-center text-[10px] uppercase tracking-wider text-gold-400/50 mb-1">
                Last sar
              </div>
              {hand.lastSarCards.map((pc, i) =>
                pc.faceDown ? (
                  <CardBack key={i} size="md" />
                ) : (
                  <PlayingCard key={i} card={pc.card} size="md" />
                ),
              )}
            </>
          ) : hand?.heapTopCard ? (
            <PlayingCard card={hand.heapTopCard} size="md" />
          ) : (
            <span className="text-sm italic text-slate-400">No cards played yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
