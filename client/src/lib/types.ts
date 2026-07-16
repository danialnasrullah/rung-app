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
  /** True when the rung selector's card is hidden from opponents. */
  faceDown?: boolean;
}

export interface HandWinner {
  team: 0 | 1;
  /** court = rung team swept all 13; pick = opposing team picked. */
  reason: "court" | "pick";
}

export type HandPhase =
  | "awaiting-redeal-decision"
  | "rung-selection"
  | "trick-play"
  | "hand-complete";

export interface LegalMoveInfo {
  card: Card;
  legal: boolean;
  reason?: "must-follow-suit" | "must-cut" | "not-your-turn" | "not-in-hand" | "is-rung-card";
}

export interface PublicHandState {
  phase: HandPhase;
  dealerSeat: Seat;
  rungSelectorSeat: Seat;
  rungSuit: Suit | null;
  /** The card used to set the rung; visible to selector always, to all when rung is opened. */
  rungCard: Card | null;
  rungChosen: boolean;
  rungOpened: boolean;
  sarNumber: number;
  leaderSeat: Seat;
  currentTrick: PlayedCard[];
  /** Cards from the last completed sar (visible until first card of next sar). */
  lastSarCards: PlayedCard[] | null;
  heapTopCard: Card | null;
  heapSarCount: number;
  winner: HandWinner | null;
  lastReshuffleReason: string | null;
}

export interface SeatView {
  displayName: string;
  connected: boolean;
}

export interface TeamSelectionView {
  players: { displayName: string; team: 0 | 1 | null; isYou: boolean }[];
}

export type RoomPhase = "waiting-for-players" | "team-selection" | "in-hand";

export interface PersonalizedRoomView {
  roomId: string;
  phase: RoomPhase;
  /** null during team-selection phase. */
  seat: Seat | null;
  seats: (SeatView | null)[];
  dealerSeat: Seat | null;
  hand: (PublicHandState & { yourCards: Card[]; legalMoves: LegalMoveInfo[] }) | null;
  lastHandWinner: HandWinner | null;
  teamSelection: TeamSelectionView | null;
}
