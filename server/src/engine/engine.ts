import {
  Card,
  FACE_RANKS,
  HandPhase,
  HandWinner,
  LegalMoveInfo,
  PlayedCard,
  Rank,
  SarResult,
  Seat,
  Suit,
  partnerSeat,
  teamOf,
} from "./types";
import { buildDeck, dealBatches, firstFive, shuffle } from "./deck";

const RANK_ORDER: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function cardBeats(a: Card, b: Card): boolean {
  // Assumes same suit. Returns true if a outranks b.
  return rankValue(a.rank) > rankValue(b.rank);
}

const MIN_PICKABLE_SAR = 5;
const HAND_SIZE = 13;

export interface PublicHandState {
  phase: HandPhase;
  dealerSeat: Seat;
  rungSelectorSeat: Seat;
  /**
   * Revealed to the rung selector always; revealed to all players once
   * rungOpened is true. Null for non-selectors until opening.
   */
  rungSuit: Suit | null;
  /** True once rung has been chosen, so other seats know play has started. */
  rungChosen: boolean;
  /**
   * True once the first opposing-team player has been void in the led suit,
   * which reveals and activates rung for everyone.
   */
  rungOpened: boolean;
  sarNumber: number;
  leaderSeat: Seat;
  currentTrick: PlayedCard[];
  /** Only the top card of the heap is ever visible, per house rules. */
  heapTopCard: Card | null;
  heapSarCount: number;
  winner: HandWinner | null;
}

export class RungHand {
  readonly dealerSeat: Seat;
  readonly rungSelectorSeat: Seat;
  private rng: () => number;

  hands: Record<Seat, Card[]>;
  rungSuit: Suit | null = null;
  phase: HandPhase = "awaiting-redeal-decision";

  /**
   * Becomes true the first time an opposing-team player is void in the led
   * suit. Before this, rung cards have no trump power whatsoever.
   */
  rungOpened = false;

  /**
   * The index within currentTrick at which rung was opened during the opening
   * sar. Only rung cards played at this position or later carry trump power in
   * that sar; cards played earlier are treated as dead off-suit cards even if
   * they happen to be the rung suit.
   */
  private rungOpenedAtTrickPos: number | null = null;

  sarNumber = 0;
  currentTrick: PlayedCard[] = [];
  leaderSeat: Seat;

  heapSarCount = 0;
  heapTopCard: Card | null = null;
  lastSenior: { seat: Seat; wonWithAce: boolean } | null = null;
  history: SarResult[] = [];
  winner: HandWinner | null = null;

  constructor(dealerSeat: Seat, rng: () => number = Math.random) {
    this.dealerSeat = dealerSeat;
    this.rungSelectorSeat = ((dealerSeat + 1) % 4) as Seat;
    this.leaderSeat = this.rungSelectorSeat;
    this.rng = rng;
    this.hands = this.dealFirstFive();
  }

  private dealFirstFive(): Record<Seat, Card[]> {
    const deck = shuffle(buildDeck(), this.rng);
    const { hands } = dealBatches(deck, this.dealerSeat);
    // Only the first 5 cards of each hand exist at this point conceptually;
    // we deal the full batches now but only *reveal* the first five to the
    // rung selector via the API layer until rung is chosen.
    return {
      0: hands[0],
      1: hands[1],
      2: hands[2],
      3: hands[3],
    } as Record<Seat, Card[]>;
  }

  /** The rung selector may request a redeal only if their first 5 cards have no face card. */
  canRequestRedeal(): boolean {
    if (this.phase !== "awaiting-redeal-decision") return false;
    const selectorFirstFive = firstFive(this.hands[this.rungSelectorSeat]);
    return !selectorFirstFive.some((c) => FACE_RANKS.has(c.rank));
  }

  requestRedeal(seat: Seat): void {
    if (seat !== this.rungSelectorSeat) {
      throw new Error("Only the rung selector may request a redeal");
    }
    if (!this.canRequestRedeal()) {
      throw new Error("Redeal is not allowed: a face card is present or wrong phase");
    }
    this.hands = this.dealFirstFive();
  }

  selectRung(seat: Seat, suit: Suit): void {
    if (seat !== this.rungSelectorSeat) {
      throw new Error("Only the rung selector may select the rung");
    }
    if (this.phase !== "awaiting-redeal-decision") {
      throw new Error("Rung has already been selected for this hand");
    }
    this.rungSuit = suit;
    this.phase = "trick-play";
  }

  private ledSuit(): Suit | null {
    return this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null;
  }

  private seatHand(seat: Seat): Card[] {
    return this.hands[seat];
  }

  private hasSuit(seat: Seat, suit: Suit): boolean {
    return this.seatHand(seat).some((c) => c.suit === suit);
  }

  /** Provisional winner among the cards played so far in the current trick. */
  private provisionalWinner(cards: PlayedCard[]): { seat: Seat; viaCut: boolean } {
    if (cards.length === 0) throw new Error("No cards played yet");
    const led = cards[0].card.suit;
    const rung = this.rungSuit;

    // Rung has cutting power only after it has been opened, and only when rung
    // is not itself the led suit. In the opening sar, only cards played at or
    // after rungOpenedAtTrickPos carry trump power — earlier cards are dead.
    if (this.rungOpened && rung && led !== rung) {
      const trumpStartPos = this.rungOpenedAtTrickPos ?? 0;
      const cuts = cards.slice(trumpStartPos).filter((pc) => pc.card.suit === rung);
      if (cuts.length > 0) {
        const best = cuts.reduce((a, b) => (cardBeats(b.card, a.card) ? b : a));
        return { seat: best.seat, viaCut: true };
      }
    }

    // No effective cuts — highest card of the led suit wins.
    // Off-suit cards (including rung cards before opening) are inferior and cannot win.
    const followers = cards.filter((pc) => pc.card.suit === led);
    const best = followers.reduce((a, b) => (cardBeats(b.card, a.card) ? b : a));
    return { seat: best.seat, viaCut: false };
  }

  /**
   * Would the rung-selecting team complete a pick on the *current* trick if
   * the provisional winner (from cards played so far) ends up senior?
   * Used to decide whether the forced-cut rule applies to the last player.
   */
  private wouldCompletePick(provisionalSeat: Seat, provisionalCard: Card): boolean {
    const currentSarNumber = this.sarNumber + 1;
    if (currentSarNumber < MIN_PICKABLE_SAR) return false;
    if (provisionalCard.rank === "A") return false; // ace exception
    if (teamOf(provisionalSeat) !== teamOf(this.rungSelectorSeat)) return false;
    if (!this.lastSenior) return false;
    if (this.lastSenior.wonWithAce) return false;
    return this.lastSenior.seat === provisionalSeat;
  }

  getLegalMoves(seat: Seat): LegalMoveInfo[] {
    const hand = this.seatHand(seat);
    if (this.phase !== "trick-play") {
      return hand.map((card) => ({ card, legal: false, reason: "not-your-turn" }));
    }
    const turnSeat = ((this.leaderSeat + this.currentTrick.length) % 4) as Seat;
    if (seat !== turnSeat) {
      return hand.map((card) => ({ card, legal: false, reason: "not-your-turn" }));
    }

    const led = this.ledSuit();
    if (led === null) {
      // Leading the trick: any card is legal.
      return hand.map((card) => ({ card, legal: true }));
    }

    const hasLed = this.hasSuit(seat, led);
    if (hasLed) {
      // Must follow the led suit — always, regardless of whether rung is open.
      return hand.map((card) => ({
        card,
        legal: card.suit === led,
        reason: card.suit === led ? undefined : "must-follow-suit",
      }));
    }

    // Player is void in the led suit.

    if (!this.rungOpened) {
      // Rung is not yet open: rung cards have no trump power.
      // Opposing-team players must play rung to force it open (if they hold any).
      // Rung-team players void in led suit may play any card freely.
      const isOpposing = teamOf(seat) !== teamOf(this.rungSelectorSeat);
      if (isOpposing && this.rungSuit && this.hasSuit(seat, this.rungSuit)) {
        return hand.map((card) => ({
          card,
          legal: card.suit === this.rungSuit,
          reason: card.suit === this.rungSuit ? undefined : "must-cut",
        }));
      }
      return hand.map((card) => ({ card, legal: true }));
    }

    // Rung is open. Apply the forced-cut-for-pick rule for the last opposing player.
    const isLastToAct = this.currentTrick.length === 3;
    const isOpposingTeam = teamOf(seat) !== teamOf(this.rungSelectorSeat);
    if (isLastToAct && isOpposingTeam && this.rungSuit) {
      const provisional = this.provisionalWinner(this.currentTrick);
      const provisionalCard = this.currentTrick.find(
        (pc) => pc.seat === provisional.seat,
      )!.card;
      if (this.wouldCompletePick(provisional.seat, provisionalCard)) {
        const rungCardsInHand = hand.filter((c) => c.suit === this.rungSuit);
        if (rungCardsInHand.length > 0) {
          return hand.map((card) => ({
            card,
            legal: card.suit === this.rungSuit,
            reason: card.suit === this.rungSuit ? undefined : "must-cut",
          }));
        }
      }
    }

    // No restriction beyond void in led suit — any card is legal.
    return hand.map((card) => ({ card, legal: true }));
  }

  playCard(seat: Seat, card: Card): SarResult | null {
    const legalMoves = this.getLegalMoves(seat);
    const match = legalMoves.find(
      (m) => m.card.suit === card.suit && m.card.rank === card.rank,
    );
    if (!match) throw new Error("Card is not in hand");
    if (!match.legal) throw new Error(`Illegal move: ${match.reason ?? "unknown"}`);

    // Detect rung opening: triggered the first time an opposing-team player
    // plays while void in the led suit. Even if they have no rung to play,
    // the opening still occurs and rung is revealed to all.
    const led = this.ledSuit();
    if (
      !this.rungOpened &&
      led !== null &&
      !this.hasSuit(seat, led) &&
      teamOf(seat) !== teamOf(this.rungSelectorSeat)
    ) {
      this.rungOpened = true;
      this.rungOpenedAtTrickPos = this.currentTrick.length;
      // Reset the consecutive-win streak: sars won before opening cannot
      // contribute to a pick — the opening sar is the first eligible.
      this.lastSenior = null;
    }

    // Remove from hand, add to trick.
    this.hands[seat] = this.hands[seat].filter(
      (c) => !(c.suit === card.suit && c.rank === card.rank),
    );
    this.currentTrick.push({ seat, card });

    if (this.currentTrick.length < 4) {
      return null;
    }

    return this.completeTrick();
  }

  private completeTrick(): SarResult {
    const winner = this.provisionalWinner(this.currentTrick);
    const winningCard = this.currentTrick.find((pc) => pc.seat === winner.seat)!.card;
    const wonWithAce = winningCard.rank === "A";

    this.sarNumber += 1;
    const result: SarResult = {
      sarNumber: this.sarNumber,
      cardsPlayed: [...this.currentTrick],
      seniorSeat: winner.seat,
      seniorViaCut: winner.viaCut,
      wonWithAce,
    };
    this.history.push(result);
    this.heapSarCount += 1;
    this.heapTopCard = winningCard;

    // Clear the within-sar opening position; from the next sar onwards all
    // four card positions carry full trump power.
    this.rungOpenedAtTrickPos = null;

    // A pick requires: rung must be open, sar >= 5, no ace involved, and the
    // same player was senior on the immediately preceding sar (also non-ace).
    const completesPick =
      this.sarNumber >= MIN_PICKABLE_SAR &&
      this.rungOpened &&
      !wonWithAce &&
      this.lastSenior !== null &&
      !this.lastSenior.wonWithAce &&
      this.lastSenior.seat === winner.seat;

    if (completesPick) {
      const pickingTeam = teamOf(winner.seat);
      this.heapSarCount = 0;
      this.heapTopCard = null;
      this.lastSenior = null;

      if (pickingTeam === teamOf(this.rungSelectorSeat)) {
        if (this.sarNumber === HAND_SIZE) {
          this.winner = { team: pickingTeam, reason: "full-sweep" };
          this.phase = "hand-complete";
        }
        // Rung team must sweep all 13; a mid-hand pick just clears the heap
        // and the streak restarts from this trick's winner.
        this.lastSenior = { seat: winner.seat, wonWithAce };
      } else {
        this.winner = { team: pickingTeam, reason: "pick" };
        this.phase = "hand-complete";
      }
    } else {
      this.lastSenior = { seat: winner.seat, wonWithAce };
    }

    if (!this.winner) {
      if (this.sarNumber === HAND_SIZE) {
        // All 13 sar played without a decisive result — non-rung team wins by default.
        this.winner = { team: (1 - teamOf(this.rungSelectorSeat)) as 0 | 1, reason: "pick" };
        this.phase = "hand-complete";
      } else {
        this.leaderSeat = winner.seat;
        this.currentTrick = [];
      }
    }

    return result;
  }

  publicState(forSeat: Seat): PublicHandState {
    return {
      phase: this.phase,
      dealerSeat: this.dealerSeat,
      rungSelectorSeat: this.rungSelectorSeat,
      rungSuit: forSeat === this.rungSelectorSeat || this.rungOpened ? this.rungSuit : null,
      rungChosen: this.rungSuit !== null,
      rungOpened: this.rungOpened,
      sarNumber: this.sarNumber,
      leaderSeat: this.leaderSeat,
      currentTrick: this.currentTrick,
      heapTopCard: this.heapTopCard,
      heapSarCount: this.heapSarCount,
      winner: this.winner,
    };
  }
}
