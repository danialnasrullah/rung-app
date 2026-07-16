import { Card } from "../lib/types";

const SUIT_SYMBOL: Record<Card["suit"], string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

const RED_SUITS = new Set<Card["suit"]>(["diamonds", "hearts"]);

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps["size"]>, string> = {
  sm: "w-10 h-14 text-xs",
  md: "w-14 h-20 text-sm",
  lg: "w-20 h-28 text-base",
};

export function PlayingCard({ card, selected, disabled, size = "md", onClick }: PlayingCardProps) {
  const isRed = RED_SUITS.has(card.suit);
  const colorClass = isRed ? "text-rose-700" : "text-slate-900";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={`${card.rank} of ${card.suit}${disabled ? " (not playable)" : ""}`}
      className={[
        "relative select-none rounded-md border bg-white shadow-sm transition-transform",
        SIZE_CLASSES[size],
        colorClass,
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:-translate-y-1",
        selected ? "-translate-y-2 ring-2 ring-gold-400" : "",
        onClick ? "" : "cursor-default",
      ].join(" ")}
    >
      <span className="absolute left-1 top-0.5 font-serif font-semibold leading-none">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-2xl">
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="absolute right-1 bottom-0.5 rotate-180 font-serif font-semibold leading-none">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
    </button>
  );
}

export function CardBack({ size = "md" }: { size?: PlayingCardProps["size"] }) {
  return (
    <div
      className={[
        "rounded-md border border-gold-500/60 shadow-sm",
        SIZE_CLASSES[size ?? "md"],
        "bg-royal-700 bg-[radial-gradient(circle_at_center,_theme(colors.royal.600)_0,_theme(colors.royal.700)_70%)]",
      ].join(" ")}
      aria-hidden
    />
  );
}
