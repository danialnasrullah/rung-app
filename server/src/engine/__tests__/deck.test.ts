import { describe, expect, it } from "vitest";
import { buildDeck, dealBatches, firstFive, shuffle } from "../deck";

describe("buildDeck", () => {
  it("has 52 unique cards", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
    expect(keys.size).toBe(52);
  });
});

describe("shuffle", () => {
  it("is deterministic given a fixed rng and preserves all cards", () => {
    const deck = buildDeck();
    const rng = () => 0.5;
    const shuffled = shuffle(deck, rng);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((c) => `${c.suit}-${c.rank}`)).size).toBe(52);
  });
});

describe("dealBatches", () => {
  it("deals 13 cards to each of 4 seats in 5-4-4 batches", () => {
    const deck = buildDeck();
    const { hands } = dealBatches(deck, 0);
    for (let seat = 0; seat < 4; seat += 1) {
      expect(hands[seat as 0 | 1 | 2 | 3]).toHaveLength(13);
    }
    const total = hands[0].length + hands[1].length + hands[2].length + hands[3].length;
    expect(total).toBe(52);
  });

  it("throws if the deck is not exactly 52 cards", () => {
    expect(() => dealBatches(buildDeck().slice(0, 10), 0)).toThrow();
  });

  it("firstFive returns exactly the first 5 cards dealt", () => {
    const deck = buildDeck();
    const { hands } = dealBatches(deck, 0);
    expect(firstFive(hands[0])).toHaveLength(5);
    expect(firstFive(hands[0])).toEqual(hands[0].slice(0, 5));
  });
});
