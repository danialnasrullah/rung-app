import { RungHand, PublicHandState } from "../engine/engine";
import { buildDeck, firstFive, shuffle } from "../engine/deck";
import { Card, HandWinner, LegalMoveInfo, Seat, Suit, teamOf } from "../engine/types";

export interface SeatOccupant {
  socketId: string;
  displayName: string;
  connected: boolean;
}

export interface PendingPlayer {
  socketId: string;
  displayName: string;
  /** null means not yet chosen. */
  team: 0 | 1 | null;
}

export interface TeamSelectionView {
  players: { displayName: string; team: 0 | 1 | null; isYou: boolean }[];
}

export type RoomPhase = "waiting-for-players" | "team-selection" | "in-hand";

export interface PersonalizedRoomView {
  roomId: string;
  phase: RoomPhase;
  /** null during team-selection phase (seat not yet assigned). */
  seat: Seat | null;
  seats: (Omit<SeatOccupant, "socketId"> | null)[];
  dealerSeat: Seat | null;
  hand: (PublicHandState & { yourCards: Card[]; legalMoves: LegalMoveInfo[] }) | null;
  lastHandWinner: HandWinner | null;
  teamSelection: TeamSelectionView | null;
}

const RANK_VALUE: Record<string, number> = Object.fromEntries(
  ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"].map((r, i) => [r, i]),
);

/** One table: 4 seats, a running sequence of hands, dealer rotation. */
export class GameRoom {
  readonly id: string;
  seats: (SeatOccupant | null)[] = [null, null, null, null];
  /** Holds players between joining and choosing their team. */
  pendingPlayers: PendingPlayer[] = [];
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

  /**
   * Adds a player to the room.
   *
   * If the room is in-hand and there is a disconnected occupant with the same
   * displayName, their seat is reclaimed (reconnect on refresh).
   *
   * If fewer than 4 players have joined, they go into the pending list.
   * When 4 are pending the room transitions to team-selection.
   */
  addPlayer(socketId: string, displayName: string): void {
    // ── Reconnect: in-hand player refreshes ──────────────────────────────
    if (this.phase === "in-hand") {
      const disconnectedSeat = this.seats.findIndex(
        (s) => s !== null && !s.connected && s.displayName === displayName,
      );
      if (disconnectedSeat !== -1) {
        this.seats[disconnectedSeat]!.socketId = socketId;
        this.seats[disconnectedSeat]!.connected = true;
        return;
      }
      throw new Error("Room is full");
    }

    // ── Reconnect: player was pending and refreshes ───────────────────────
    if (this.phase === "team-selection") {
      const existingPending = this.pendingPlayers.findIndex(
        (p) => p.displayName === displayName,
      );
      if (existingPending !== -1) {
        this.pendingPlayers[existingPending].socketId = socketId;
        return;
      }
      throw new Error("Room is full — team selection already in progress");
    }

    // ── Normal join (waiting-for-players) ────────────────────────────────
    const alreadyPending = this.pendingPlayers.some((p) => p.displayName === displayName);
    if (alreadyPending) {
      // Reconnect during waiting phase — update socketId.
      const idx = this.pendingPlayers.findIndex((p) => p.displayName === displayName);
      this.pendingPlayers[idx].socketId = socketId;
      return;
    }

    if (this.pendingPlayers.length >= 4) {
      throw new Error("Room is full");
    }

    this.pendingPlayers.push({ socketId, displayName, team: null });

    if (this.pendingPlayers.length === 4) {
      this.phase = "team-selection";
    }
  }

  /**
   * Records a team choice for a pending player.
   * Once 2 players are on each team, seats are assigned and the game begins.
   */
  chooseTeam(socketId: string, team: 0 | 1): void {
    if (this.phase !== "team-selection") {
      throw new Error("Team selection is not active");
    }

    const player = this.pendingPlayers.find((p) => p.socketId === socketId);
    if (!player) throw new Error("Player not found in pending list");

    player.team = team;

    const teamCounts = { 0: 0, 1: 0 } as Record<0 | 1, number>;
    for (const p of this.pendingPlayers) {
      if (p.team !== null) teamCounts[p.team] += 1;
    }

    if (teamCounts[0] > 2 || teamCounts[1] > 2) {
      // Revert to keep balance.
      player.team = null;
      throw new Error(
        `Team ${team === 0 ? "A" : "B"} is full — please join the other team`,
      );
    }

    // If all 4 have chosen and teams are balanced (2-2), start the game.
    if (
      this.pendingPlayers.every((p) => p.team !== null) &&
      teamCounts[0] === 2 &&
      teamCounts[1] === 2
    ) {
      this.assignSeatsAndStart();
    }
  }

  private assignSeatsAndStart(): void {
    // Team 0 → seats 0, 2 (partners); Team 1 → seats 1, 3 (partners).
    const teamSlots: Record<0 | 1, Seat[]> = { 0: [0, 2], 1: [1, 3] };
    const nextSlot: Record<0 | 1, number> = { 0: 0, 1: 0 };

    for (const pending of this.pendingPlayers) {
      const t = pending.team as 0 | 1;
      const seat = teamSlots[t][nextSlot[t]];
      nextSlot[t] += 1;
      this.seats[seat] = {
        socketId: pending.socketId,
        displayName: pending.displayName,
        connected: true,
      };
    }

    this.pendingPlayers = [];
    this.runPreMatchDrawAndStart();
  }

  removePlayer(socketId: string): void {
    if (this.phase === "team-selection" || this.phase === "waiting-for-players") {
      const idx = this.pendingPlayers.findIndex((p) => p.socketId === socketId);
      if (idx !== -1) {
        this.pendingPlayers.splice(idx, 1);
        if (this.phase === "team-selection") {
          // Fall back to waiting so a new player can join.
          this.phase = "waiting-for-players";
        }
        return;
      }
    }

    const seat = this.seats.findIndex((s) => s?.socketId === socketId);
    if (seat === -1) return;
    const occupant = this.seats[seat];
    if (occupant) occupant.connected = false;
  }

  /** True when every known player is disconnected (room can be reaped). */
  allDisconnected(): boolean {
    if (this.phase === "waiting-for-players") {
      return this.pendingPlayers.length === 0;
    }
    if (this.phase === "team-selection") {
      return this.pendingPlayers.length === 0;
    }
    return this.seats.every((s) => s === null || !s.connected);
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

  /** Called by the socket layer after a brief delay when a hand completes. */
  startNewHand(): void {
    if (!this.currentHand || this.currentHand.phase !== "hand-complete") return;
    this.startHand();
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

  selectRung(socketId: string, card: Card): void {
    const seat = this.seatBySocketId(socketId);
    if (!this.currentHand) throw new Error("No hand in progress");
    this.currentHand.selectRung(seat, card);
  }

  /**
   * Returns true if the hand just completed (caller should delay, then call startNewHand).
   */
  playCard(socketId: string, card: Card): boolean {
    const seat = this.seatBySocketId(socketId);
    if (!this.currentHand) throw new Error("No hand in progress");
    this.currentHand.playCard(seat, card);

    if (this.currentHand.winner) {
      this.lastHandWinner = this.currentHand.winner;
      this.rotateDealerToLosingTeam(this.currentHand.winner);
      return true;
    }
    return false;
  }

  viewFor(socketId: string): PersonalizedRoomView {
    // ── Team-selection view ──────────────────────────────────────────────
    if (this.phase === "team-selection") {
      const player = this.pendingPlayers.find((p) => p.socketId === socketId);
      if (!player) throw new Error("Player not found");
      return {
        roomId: this.id,
        phase: this.phase,
        seat: null,
        seats: [null, null, null, null],
        dealerSeat: null,
        hand: null,
        lastHandWinner: this.lastHandWinner,
        teamSelection: {
          players: this.pendingPlayers.map((p) => ({
            displayName: p.displayName,
            team: p.team,
            isYou: p.socketId === socketId,
          })),
        },
      };
    }

    // ── Waiting-for-players view ─────────────────────────────────────────
    if (this.phase === "waiting-for-players") {
      const player = this.pendingPlayers.find((p) => p.socketId === socketId);
      if (!player) throw new Error("Player not found");
      return {
        roomId: this.id,
        phase: this.phase,
        seat: null,
        seats: [null, null, null, null],
        dealerSeat: null,
        hand: null,
        lastHandWinner: null,
        teamSelection: null,
      };
    }

    // ── In-hand view ─────────────────────────────────────────────────────
    const seat = this.seatBySocketId(socketId);
    const hand = this.currentHand;
    return {
      roomId: this.id,
      phase: this.phase,
      seat,
      seats: this.seats.map((s) =>
        s ? { displayName: s.displayName, connected: s.connected } : null,
      ),
      dealerSeat: this.dealerSeat,
      hand: hand
        ? {
            ...hand.publicState(seat),
            yourCards:
              hand.phase === "awaiting-redeal-decision"
                ? firstFive(hand.hands[seat])
                : hand.hands[seat],
            legalMoves: hand.getLegalMoves(seat),
          }
        : null,
      lastHandWinner: this.lastHandWinner,
      teamSelection: null,
    };
  }

  occupiedSeatSocketIds(): string[] {
    if (this.phase === "waiting-for-players" || this.phase === "team-selection") {
      return this.pendingPlayers.map((p) => p.socketId);
    }
    return this.seats
      .filter((s): s is SeatOccupant => s !== null)
      .map((s) => s.socketId);
  }
}
