export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type Seat = 0 | 1 | 2 | 3;

export interface PlayedCard {
  seat: Seat;
  card: Card;
}

export interface HandWinner {
  team: 0 | 1;
  reason: "full-sweep" | "pick";
}

export type HandPhase =
  | "awaiting-redeal-decision"
  | "rung-selection"
  | "trick-play"
  | "hand-complete";

export interface LegalMoveInfo {
  card: Card;
  legal: boolean;
  reason?: "must-follow-suit" | "must-cut" | "not-your-turn" | "not-in-hand";
}

export interface PublicHandState {
  phase: HandPhase;
  dealerSeat: Seat;
  rungSelectorSeat: Seat;
  rungSuit: Suit | null;
  rungChosen: boolean;
  rungOpened: boolean;
  sarNumber: number;
  leaderSeat: Seat;
  currentTrick: PlayedCard[];
  heapTopCard: Card | null;
  heapSarCount: number;
  winner: HandWinner | null;
}

export interface SeatView {
  displayName: string;
  connected: boolean;
}

export interface PersonalizedRoomView {
  roomId: string;
  phase: "waiting-for-players" | "in-hand";
  seat: Seat;
  seats: (SeatView | null)[];
  dealerSeat: Seat | null;
  hand: (PublicHandState & { yourCards: Card[]; legalMoves: LegalMoveInfo[] }) | null;
  lastHandWinner: HandWinner | null;
}
