export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const FACE_RANKS: ReadonlySet<Rank> = new Set(["J", "Q", "K", "A"]);

export type PlayerId = string;

/** Seats 0-3, crosswise partnerships: (0,2) vs (1,3). */
export type Seat = 0 | 1 | 2 | 3;

export function partnerSeat(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

export function teamOf(seat: Seat): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

export interface PlayedCard {
  seat: Seat;
  card: Card;
}

export type SarPhase = "cannot-pick" | "pickable";

export interface SarResult {
  sarNumber: number; // 1-13
  cardsPlayed: PlayedCard[];
  seniorSeat: Seat;
  seniorViaCut: boolean;
  wonWithAce: boolean;
}

export type HandPhase =
  | "awaiting-redeal-decision"
  | "rung-selection"
  | "trick-play"
  | "hand-complete";

export interface HandWinner {
  team: 0 | 1;
  reason: "full-sweep" | "pick";
}

export interface LegalMoveInfo {
  card: Card;
  legal: boolean;
  /** Reason a card is illegal, for UI messaging / debugging. */
  reason?: "must-follow-suit" | "must-cut" | "not-your-turn" | "not-in-hand";
}
