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
  return rankValue(a.rank) > rankValue(b.rank);
}

const MIN_PICKABLE_SAR = 5;
/**
 * Opposing team may only pick on sars 5–11. Sar 12 is not a valid pick sar —
 * the hand must play to sar 13 (where the rung team can complete a court).
 */
const MAX_OPPOSING_PICK_SAR = 11;
const HAND_SIZE = 13;

/** Dummy card used in place of a face-down card in publicState output. */
const DUMMY_CARD: Card = { suit: "clubs", rank: "2" };

export interface PublicHandState {
  phase: HandPhase;
  dealerSeat: Seat;
  rungSelectorSeat: Seat;
  /**
   * Revealed to the rung selector always; revealed to all once rungOpened.
   * Null for non-selectors until opening.
   */
  rungSuit: Suit | null;
  /**
   * The specific card used to set the rung. Visible to the selector always;
   * revealed to all when rung is opened.
   */
  rungCard: Card | null;
  /** True once rung has been chosen. */
  rungChosen: boolean;
  /**
   * True once the first opposing-team player is void in the led suit,
   * revealing and activating rung for everyone.
   */
  rungOpened: boolean;
  sarNumber: number;
  leaderSeat: Seat;
  currentTrick: PlayedCard[];
  /** Cards from the most recently completed sar (cleared on first card of next sar). */
  lastSarCards: PlayedCard[] | null;
  /** Only the top card of the heap is ever visible, per house rules. */
  heapTopCard: Card | null;
  heapSarCount: number;
  winner: HandWinner | null;
  /** Set when a reshuffle occurs (e.g. 7+ rung-suit cards). Cleared when rung is chosen. */
  lastReshuffleReason: string | null;
}

export class RungHand {
  readonly dealerSeat: Seat;
  readonly rungSelectorSeat: Seat;
  private rng: () => number;

  hands: Record<Seat, Card[]>;
  rungSuit: Suit | null = null;
  /** The specific card chosen to set the rung; cannot be played until rung is opened. */
  rungCard: Card | null = null;
  phase: HandPhase = "awaiting-redeal-decision";

  rungOpened = false;

  /**
   * The index within currentTrick at which rung was opened during the opening
   * sar. Only rung cards at this position or later carry trump power.
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
  lastSarCards: PlayedCard[] | null = null;
  lastReshuffleReason: string | null = null;

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
    return {
      0: hands[0],
      1: hands[1],
      2: hands[2],
      3: hands[3],
    } as Record<Seat, Card[]>;
  }

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

  /**
   * The rung selector picks a card from their first five; the card's suit
   * becomes rung and the card itself is set aside (unplayable until rung opens).
   *
   * If the selector holds 7 or more cards of the chosen suit, the hand is
   * reshuffled automatically and the selector must choose again.
   */
  selectRung(seat: Seat, card: Card): void {
    if (seat !== this.rungSelectorSeat) {
      throw new Error("Only the rung selector may select the rung");
    }
    if (this.phase !== "awaiting-redeal-decision") {
      throw new Error("Rung has already been selected for this hand");
    }

    const cardInHand = this.hands[seat].some(
      (c) => c.suit === card.suit && c.rank === card.rank,
    );
    if (!cardInHand) throw new Error("Card is not in hand");

    const suitCount = this.hands[seat].filter((c) => c.suit === card.suit).length;
    if (suitCount >= 7) {
      // Rule: 7+ of the rung suit is a forced reshuffle.
      this.hands = this.dealFirstFive();
      this.lastReshuffleReason = "7 or more cards of the chosen suit — reshuffled";
      return; // Stay in awaiting-redeal-decision; selector must choose again.
    }

    this.rungSuit = card.suit;
    this.rungCard = card;
    this.lastReshuffleReason = null;
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

  private provisionalWinner(cards: PlayedCard[]): { seat: Seat; viaCut: boolean } {
    if (cards.length === 0) throw new Error("No cards played yet");
    const led = cards[0].card.suit;
    const rung = this.rungSuit;

    if (this.rungOpened && rung && led !== rung) {
      const trumpStartPos = this.rungOpenedAtTrickPos ?? 0;
      const cuts = cards.slice(trumpStartPos).filter((pc) => pc.card.suit === rung);
      if (cuts.length > 0) {
        const best = cuts.reduce((a, b) => (cardBeats(b.card, a.card) ? b : a));
        return { seat: best.seat, viaCut: true };
      }
    }

    const followers = cards.filter((pc) => pc.card.suit === led);
    const best = followers.reduce((a, b) => (cardBeats(b.card, a.card) ? b : a));
    return { seat: best.seat, viaCut: false };
  }

  private wouldCompletePick(provisionalSeat: Seat, provisionalCard: Card): boolean {
    const currentSarNumber = this.sarNumber + 1;
    if (currentSarNumber < MIN_PICKABLE_SAR) return false;
    if (provisionalCard.rank === "A") return false;
    if (teamOf(provisionalSeat) !== teamOf(this.rungSelectorSeat)) return false;
    if (!this.lastSenior) return false;
    if (this.lastSenior.wonWithAce) return false;
    return this.lastSenior.seat === provisionalSeat;
  }

  getLegalMoves(seat: Seat): LegalMoveInfo[] {
    const hand = this.seatHand(seat);
    if (this.phase !== "trick-play") {
      return hand.map((card) => ({ card, legal: false, reason: "not-your-turn" as const }));
    }
    const turnSeat = ((this.leaderSeat + this.currentTrick.length) % 4) as Seat;
    if (seat !== turnSeat) {
      return hand.map((card) => ({ card, legal: false, reason: "not-your-turn" as const }));
    }

    const led = this.ledSuit();
    if (led === null) {
      // Leading the trick — any card is legal, except the rung card before opening.
      return hand.map((card) => {
        if (this.isRungCardLocked(card)) {
          return { card, legal: false, reason: "is-rung-card" as const };
        }
        return { card, legal: true };
      });
    }

    const hasLed = this.hasSuit(seat, led);
    if (hasLed) {
      return hand.map((card) => ({
        card,
        legal: card.suit === led,
        reason: card.suit === led ? undefined : ("must-follow-suit" as const),
      }));
    }

    // Player is void in the led suit.
    if (!this.rungOpened) {
      const isOpposing = teamOf(seat) !== teamOf(this.rungSelectorSeat);
      if (isOpposing && this.rungSuit && this.hasSuit(seat, this.rungSuit)) {
        return hand.map((card) => ({
          card,
          legal: card.suit === this.rungSuit,
          reason: card.suit === this.rungSuit ? undefined : ("must-cut" as const),
        }));
      }
      // Rung-team player void: may play any card (except locked rung card).
      return hand.map((card) => {
        if (this.isRungCardLocked(card)) {
          return { card, legal: false, reason: "is-rung-card" as const };
        }
        return { card, legal: true };
      });
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
            reason: card.suit === this.rungSuit ? undefined : ("must-cut" as const),
          }));
        }
      }
    }

    return hand.map((card) => ({ card, legal: true }));
  }

  /** Returns true if the given card is the locked rung card (unplayable before opening). */
  private isRungCardLocked(card: Card): boolean {
    return (
      !this.rungOpened &&
      this.rungCard !== null &&
      card.suit === this.rungCard.suit &&
      card.rank === this.rungCard.rank
    );
  }

  playCard(seat: Seat, card: Card): SarResult | null {
    const legalMoves = this.getLegalMoves(seat);
    const match = legalMoves.find(
      (m) => m.card.suit === card.suit && m.card.rank === card.rank,
    );
    if (!match) throw new Error("Card is not in hand");
    if (!match.legal) throw new Error(`Illegal move: ${match.reason ?? "unknown"}`);

    // Clear lastSarCards when the first card of a new sar is played.
    if (this.currentTrick.length === 0) {
      this.lastSarCards = null;
    }

    const led = this.ledSuit();

    // Detect rung opening: first opposing-team player void in led suit.
    if (
      !this.rungOpened &&
      led !== null &&
      !this.hasSuit(seat, led) &&
      teamOf(seat) !== teamOf(this.rungSelectorSeat)
    ) {
      this.rungOpened = true;
      this.rungOpenedAtTrickPos = this.currentTrick.length;
      this.lastSenior = null;
    }

    // Detect whether this card should be shown face-down to opponents:
    // rung selector plays off-suit before rung is opened.
    const isFaceDown =
      seat === this.rungSelectorSeat &&
      !this.rungOpened &&
      led !== null &&
      !this.hasSuit(seat, led);

    this.hands[seat] = this.hands[seat].filter(
      (c) => !(c.suit === card.suit && c.rank === card.rank),
    );
    this.currentTrick.push({ seat, card, faceDown: isFaceDown || undefined });

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

    // Save the completed trick for display before clearing.
    this.lastSarCards = [...this.currentTrick];

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
    this.rungOpenedAtTrickPos = null;

    const isOpposingWinner = teamOf(winner.seat) !== teamOf(this.rungSelectorSeat);

    const consecutiveWin =
      this.rungOpened &&
      !wonWithAce &&
      this.lastSenior !== null &&
      !this.lastSenior.wonWithAce &&
      this.lastSenior.seat === winner.seat;

    // Opposing team can only pick on sars 5–11. Sar 12 cannot be a pick sar.
    const opposingTeamPicks =
      consecutiveWin &&
      isOpposingWinner &&
      this.sarNumber >= MIN_PICKABLE_SAR &&
      this.sarNumber <= MAX_OPPOSING_PICK_SAR;

    // Rung team consecutive win clears the heap on any sar >= 5; a court at sar 13.
    const rungTeamConsecutiveWin =
      consecutiveWin && !isOpposingWinner && this.sarNumber >= MIN_PICKABLE_SAR;

    const completesPick = opposingTeamPicks || rungTeamConsecutiveWin;

    if (completesPick) {
      const pickingTeam = teamOf(winner.seat);
      this.heapSarCount = 0;
      this.heapTopCard = null;
      this.lastSenior = null;

      if (pickingTeam === teamOf(this.rungSelectorSeat)) {
        if (this.sarNumber === HAND_SIZE) {
          this.winner = { team: pickingTeam, reason: "court" };
          this.phase = "hand-complete";
        } else {
          // Mid-hand: heap cleared, streak restarts.
          this.lastSenior = { seat: winner.seat, wonWithAce };
        }
      } else {
        this.winner = { team: pickingTeam, reason: "pick" };
        this.phase = "hand-complete";
      }
    } else {
      this.lastSenior = { seat: winner.seat, wonWithAce };
    }

    if (!this.winner) {
      if (this.sarNumber === HAND_SIZE) {
        // All 13 played, no decisive result — non-rung team wins by default.
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
    const canSeeRung = forSeat === this.rungSelectorSeat || this.rungOpened;

    // For non-selectors, obfuscate face-down cards in currentTrick and lastSarCards.
    const hideFaceDown = forSeat !== this.rungSelectorSeat;

    const currentTrick = this.currentTrick.map((pc) => {
      if (pc.faceDown && hideFaceDown) {
        return { seat: pc.seat, card: DUMMY_CARD, faceDown: true };
      }
      return pc;
    });

    const lastSarCards =
      this.lastSarCards?.map((pc) => {
        if (pc.faceDown && hideFaceDown) {
          return { seat: pc.seat, card: DUMMY_CARD, faceDown: true };
        }
        return pc;
      }) ?? null;

    return {
      phase: this.phase,
      dealerSeat: this.dealerSeat,
      rungSelectorSeat: this.rungSelectorSeat,
      rungSuit: canSeeRung ? this.rungSuit : null,
      rungCard: canSeeRung ? this.rungCard : null,
      rungChosen: this.rungSuit !== null,
      rungOpened: this.rungOpened,
      sarNumber: this.sarNumber,
      leaderSeat: this.leaderSeat,
      currentTrick,
      lastSarCards,
      heapTopCard: this.heapTopCard,
      heapSarCount: this.heapSarCount,
      winner: this.winner,
      lastReshuffleReason: this.lastReshuffleReason,
    };
  }
}
