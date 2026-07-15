import { Card, Rank, Suit } from "./types";

const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle. Accepts an injectable RNG for deterministic tests. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface DealBatches {
  /** hands[seat] accumulates across the 5-4-4 batches, in order. */
  hands: [Card[], Card[], Card[], Card[]];
}

const BATCH_SIZES = [5, 4, 4];

/**
 * Deals a shuffled 52-card deck to 4 seats in 5-4-4 batches, starting from
 * `startSeat` each batch (standard deal order, one card at a time per seat).
 */
export function dealBatches(
  deck: Card[],
  startSeat: 0 | 1 | 2 | 3 = 0,
): DealBatches {
  if (deck.length !== 52) {
    throw new Error(`Expected a 52-card deck, got ${deck.length}`);
  }
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  let cursor = 0;
  for (const batchSize of BATCH_SIZES) {
    for (let round = 0; round < batchSize; round += 1) {
      for (let i = 0; i < 4; i += 1) {
        const seat = ((startSeat + i) % 4) as 0 | 1 | 2 | 3;
        hands[seat].push(deck[cursor]);
        cursor += 1;
      }
    }
  }
  return { hands };
}

/** The first batch (first 5 cards) dealt to a seat, used for redeal checks. */
export function firstFive(hand: Card[]): Card[] {
  return hand.slice(0, 5);
}
