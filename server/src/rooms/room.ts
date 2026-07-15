import { RungHand, PublicHandState } from "../engine/engine";
import { buildDeck, firstFive, shuffle } from "../engine/deck";
import { Card, HandWinner, LegalMoveInfo, Seat, Suit, teamOf } from "../engine/types";

export interface SeatOccupant {
  socketId: string;
  displayName: string;
  connected: boolean;
}

export type RoomPhase = "waiting-for-players" | "in-hand";

export interface PersonalizedRoomView {
  roomId: string;
  phase: RoomPhase;
  seat: Seat;
  seats: (Omit<SeatOccupant, "socketId"> | null)[];
  dealerSeat: Seat | null;
  hand: (PublicHandState & { yourCards: Card[]; legalMoves: LegalMoveInfo[] }) | null;
  lastHandWinner: HandWinner | null;
}

const RANK_VALUE: Record<string, number> = Object.fromEntries(
  ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"].map((r, i) => [r, i]),
);

/** One table: 4 seats, a running sequence of hands, dealer rotation. */
export class GameRoom {
  readonly id: string;
  seats: (SeatOccupant | null)[] = [null, null, null, null];
  dealerSeat: Seat | null = null;
  currentHand: RungHand | null = null;
  lastHandWinner: HandWinner | null = null;
  phase: RoomPhase = "waiting-for-players";

  constructor(id: string) {
    this.id = id;
  }

  private openSeats(): Seat[] {
    return [0, 1, 2, 3].filter((s) => this.seats[s] === null) as Seat[];
  }

  addPlayer(socketId: string, displayName: string): Seat {
    const open = this.openSeats();
    if (open.length === 0) {
      throw new Error("Room is full");
    }
    const seat = open[0];
    this.seats[seat] = { socketId, displayName, connected: true };
    if (this.openSeats().length === 0 && this.phase === "waiting-for-players") {
      this.runPreMatchDrawAndStart();
    }
    return seat;
  }

  removePlayer(socketId: string): void {
    const seat = this.seats.findIndex((s) => s?.socketId === socketId);
    if (seat === -1) return;
    const occupant = this.seats[seat];
    if (occupant) occupant.connected = false;
  }

  private runPreMatchDrawAndStart(): void {
    const deck = shuffle(buildDeck());
    let lowestSeat: Seat = 0;
    let lowestValue = Infinity;
    for (let seat = 0; seat < 4; seat += 1) {
      const card = deck[seat];
      const value = RANK_VALUE[card.rank];
      if (value < lowestValue) {
        lowestValue = value;
        lowestSeat = seat as Seat;
      }
    }
    this.dealerSeat = lowestSeat;
    this.startHand();
  }

  private startHand(): void {
    if (this.dealerSeat === null) {
      throw new Error("Cannot start a hand before the dealer is determined");
    }
    this.currentHand = new RungHand(this.dealerSeat);
    this.phase = "in-hand";
  }

  private rotateDealerToLosingTeam(winner: HandWinner): void {
    const losingTeam = winner.team === 0 ? 1 : 0;
    const current = this.dealerSeat ?? 0;
    for (let offset = 1; offset <= 4; offset += 1) {
      const candidate = ((current + offset) % 4) as Seat;
      if (teamOf(candidate) === losingTeam) {
        this.dealerSeat = candidate;
        return;
      }
    }
  }

  private seatBySocketId(socketId: string): Seat {
    const seat = this.seats.findIndex((s) => s?.socketId === socketId);
    if (seat === -1) throw new Error("Player is not seated in this room");
    return seat as Seat;
  }

  requestRedeal(socketId: string): void {
    const seat = this.seatBySocketId(socketId);
    if (!this.currentHand) throw new Error("No hand in progress");
    this.currentHand.requestRedeal(seat);
  }

  selectRung(socketId: string, suit: Suit): void {
    const seat = this.seatBySocketId(socketId);
    if (!this.currentHand) throw new Error("No hand in progress");
    this.currentHand.selectRung(seat, suit);
  }

  playCard(socketId: string, card: Card): void {
    const seat = this.seatBySocketId(socketId);
    if (!this.currentHand) throw new Error("No hand in progress");
    this.currentHand.playCard(seat, card);

    if (this.currentHand.winner) {
      this.lastHandWinner = this.currentHand.winner;
      this.rotateDealerToLosingTeam(this.currentHand.winner);
      this.startHand();
    }
  }

  viewFor(socketId: string): PersonalizedRoomView {
    const seat = this.seatBySocketId(socketId);
    const hand = this.currentHand;
    return {
      roomId: this.id,
      phase: this.phase,
      seat,
      seats: this.seats.map((s) => (s ? { displayName: s.displayName, connected: s.connected } : null)),
      dealerSeat: this.dealerSeat,
      hand: hand
        ? {
            ...hand.publicState(seat),
            // Only the first 5 cards are revealed until the rung is chosen —
            // the remaining 4+4 batches are conceptually dealt after that.
            yourCards:
              hand.phase === "awaiting-redeal-decision"
                ? firstFive(hand.hands[seat])
                : hand.hands[seat],
            legalMoves: hand.getLegalMoves(seat),
          }
        : null,
      lastHandWinner: this.lastHandWinner,
    };
  }

  occupiedSeatSocketIds(): string[] {
    return this.seats.filter((s): s is SeatOccupant => s !== null).map((s) => s.socketId);
  }
}
