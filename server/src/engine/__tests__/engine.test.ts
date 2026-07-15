import { describe, expect, it } from "vitest";
import { RungHand } from "../engine";
import { Card, Seat } from "../types";

function c(suit: Card["suit"], rank: Card["rank"]): Card {
  return { suit, rank };
}

function makeHand(dealerSeat: Seat = 0): RungHand {
  return new RungHand(dealerSeat, () => 0.42);
}

describe("redeal", () => {
  it("is allowed when the rung selector's first five has no face card", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    hand.hands[1] = [
      c("clubs", "2"), c("clubs", "3"), c("clubs", "4"), c("clubs", "5"), c("clubs", "6"),
      ...hand.hands[1].slice(5),
    ];
    expect(hand.canRequestRedeal()).toBe(true);
    expect(() => hand.requestRedeal(1)).not.toThrow();
  });

  it("is not allowed when a face card is present", () => {
    const hand = makeHand(0);
    hand.hands[1] = [
      c("clubs", "2"), c("clubs", "3"), c("clubs", "4"), c("clubs", "5"), c("clubs", "J"),
      ...hand.hands[1].slice(5),
    ];
    expect(hand.canRequestRedeal()).toBe(false);
    expect(() => hand.requestRedeal(1)).toThrow();
  });

  it("only the rung selector may request a redeal", () => {
    const hand = makeHand(0);
    expect(() => hand.requestRedeal(2)).toThrow();
  });
});

describe("rung selection", () => {
  it("only the rung selector may select the rung, and it stays hidden from others", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    expect(() => hand.selectRung(0, "spades")).toThrow();
    hand.selectRung(1, "spades");
    expect(hand.phase).toBe("trick-play");
    expect(hand.publicState(1).rungSuit).toBe("spades");
    expect(hand.publicState(0).rungSuit).toBeNull();
    expect(hand.publicState(0).rungChosen).toBe(true);
  });
});

describe("trick resolution / cut hierarchy", () => {
  it("highest card of the led suit wins when no one cuts", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, leaderSeat = 1
    hand.selectRung(1, "spades");
    hand.hands[1] = [c("hearts", "9"), ...hand.hands[1].slice(1)];
    hand.hands[2] = [c("hearts", "K"), ...hand.hands[2].slice(1)];
    hand.hands[3] = [c("hearts", "4"), ...hand.hands[3].slice(1)];
    hand.hands[0] = [c("hearts", "2"), ...hand.hands[0].slice(1)];

    hand.playCard(1, c("hearts", "9"));
    hand.playCard(2, c("hearts", "K"));
    hand.playCard(3, c("hearts", "4"));
    const result = hand.playCard(0, c("hearts", "2"));

    expect(result?.seniorSeat).toBe(2);
    expect(result?.seniorViaCut).toBe(false);
  });

  it("a cut beats any non-rung card, and the highest cut among cuts wins", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, leaderSeat = 1
    hand.selectRung(1, "spades");

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[0] = [c("hearts", "K"), ...hand.hands[0].filter((x) => x.suit !== "hearts")];
    hand.hands[2] = [c("spades", "5"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];
    hand.hands[3] = [c("spades", "9"), ...hand.hands[3].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];

    hand.playCard(1, c("hearts", "2")); // led suit: hearts
    hand.playCard(2, c("spades", "5")); // cut
    hand.playCard(3, c("spades", "9")); // higher cut
    const result = hand.playCard(0, c("hearts", "K")); // follows suit, cannot beat a cut

    expect(result?.seniorSeat).toBe(3);
    expect(result?.seniorViaCut).toBe(true);
  });
});

describe("pick logic", () => {
  it("does not allow a pick before the 5th sar even with 2 consecutive senior wins", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    hand.selectRung(1, "spades");
    hand.sarNumber = 2;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;
    hand.heapSarCount = 2; // 2 sar already piled up from the simulated prior tricks

    hand.hands[1] = [c("clubs", "9"), ...hand.hands[1].filter((x) => !(x.suit === "clubs" && x.rank === "9"))];
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[3] = hand.hands[3].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[0] = hand.hands[0].filter((x) => x.suit !== "clubs" && x.suit !== "spades");

    hand.playCard(1, c("clubs", "9"));
    hand.playCard(2, hand.hands[2][0]);
    hand.playCard(3, hand.hands[3][0]);
    const result = hand.playCard(0, hand.hands[0][0]);

    expect(result?.seniorSeat).toBe(1); // seat 1 senior again, 2 in a row
    expect(hand.sarNumber).toBe(3);
    expect(hand.winner).toBeNull(); // but sar 3 < 5, so no pick yet
    expect(hand.heapSarCount).toBe(3); // heap keeps accumulating
  });

  it("an ace win does not count toward completing a pick", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    hand.selectRung(1, "spades");
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    hand.hands[1] = [c("clubs", "A"), ...hand.hands[1].filter((x) => !(x.suit === "clubs" && x.rank === "A"))];
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[3] = hand.hands[3].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[0] = hand.hands[0].filter((x) => x.suit !== "clubs" && x.suit !== "spades");

    hand.playCard(1, c("clubs", "A"));
    hand.playCard(2, hand.hands[2][0]);
    hand.playCard(3, hand.hands[3][0]);
    const result = hand.playCard(0, hand.hands[0][0]);

    expect(result?.seniorSeat).toBe(1);
    expect(result?.wonWithAce).toBe(true);
    expect(hand.winner).toBeNull(); // ace win breaks the streak, no pick
    expect(hand.lastSenior).toEqual({ seat: 1, wonWithAce: true });
  });

  it("the non-rung team wins the hand immediately on their first pick", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1), seats 0/2 = team 0
    hand.selectRung(1, "spades");
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 0, wonWithAce: false };
    hand.leaderSeat = 0;

    hand.hands[0] = [c("clubs", "9"), ...hand.hands[0].filter((x) => !(x.suit === "clubs" && x.rank === "9"))];
    hand.hands[1] = hand.hands[1].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[3] = hand.hands[3].filter((x) => x.suit !== "clubs" && x.suit !== "spades");

    hand.playCard(0, c("clubs", "9"));
    hand.playCard(1, hand.hands[1][0]);
    hand.playCard(2, hand.hands[2][0]);
    hand.playCard(3, hand.hands[3][0]);

    expect(hand.winner).toEqual({ team: 0, reason: "pick" });
    expect(hand.phase).toBe("hand-complete");
  });

  it("the rung team only wins by sweeping all 13 sar", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1)
    hand.selectRung(1, "spades");
    hand.sarNumber = 12;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    hand.hands[1] = [c("clubs", "9"), ...hand.hands[1].filter((x) => !(x.suit === "clubs" && x.rank === "9"))];
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[3] = hand.hands[3].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[0] = hand.hands[0].filter((x) => x.suit !== "clubs" && x.suit !== "spades");

    hand.playCard(1, c("clubs", "9"));
    hand.playCard(2, hand.hands[2][0]);
    hand.playCard(3, hand.hands[3][0]);
    hand.playCard(0, hand.hands[0][0]);

    expect(hand.sarNumber).toBe(13);
    expect(hand.winner).toEqual({ team: 1, reason: "full-sweep" });
    expect(hand.phase).toBe("hand-complete");
  });

  it("a mid-hand pick by the rung team clears the heap but does not end the hand", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1)
    hand.selectRung(1, "spades");
    hand.sarNumber = 6;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;
    hand.heapSarCount = 2;

    hand.hands[1] = [c("clubs", "9"), ...hand.hands[1].filter((x) => !(x.suit === "clubs" && x.rank === "9"))];
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[3] = hand.hands[3].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[0] = hand.hands[0].filter((x) => x.suit !== "clubs" && x.suit !== "spades");

    hand.playCard(1, c("clubs", "9"));
    hand.playCard(2, hand.hands[2][0]);
    hand.playCard(3, hand.hands[3][0]);
    hand.playCard(0, hand.hands[0][0]);

    expect(hand.winner).toBeNull();
    expect(hand.phase).toBe("trick-play");
    expect(hand.heapSarCount).toBe(0);
  });
});

describe("forced cut rule", () => {
  // leaderSeat = 1 -> turn order is seat 1, 2, 3, 0 (0 is last to act).
  // rungSelectorSeat = 1 -> team 1 = {1,3}, team 0 = {0,2}. Seat 0 (last to
  // act) is on the opposing team, which is exactly the case the rule targets.
  it("forces the last (opposing) player to cut when the rung team would otherwise complete a pick", () => {
    const hand = makeHand(0);
    hand.selectRung(1, "diamonds");
    hand.sarNumber = 4; // next trick is the 5th sar, first pickable
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[2] = [c("clubs", "3"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && !(x.suit === "clubs" && x.rank === "3"))];
    hand.hands[3] = [c("clubs", "4"), ...hand.hands[3].filter((x) => x.suit !== "hearts" && !(x.suit === "clubs" && x.rank === "4"))];
    hand.hands[0] = [c("diamonds", "6"), ...hand.hands[0].filter((x) => x.suit !== "hearts" && !(x.suit === "diamonds" && x.rank === "6"))];

    hand.playCard(1, c("hearts", "2"));
    hand.playCard(2, c("clubs", "3"));
    hand.playCard(3, c("clubs", "4"));

    const legal = hand.getLegalMoves(0);
    const nonRungMoves = legal.filter((m) => m.card.suit !== "diamonds");
    const rungMoves = legal.filter((m) => m.card.suit === "diamonds");

    expect(nonRungMoves.every((m) => !m.legal && m.reason === "must-cut")).toBe(true);
    expect(rungMoves.length).toBeGreaterThan(0);
    expect(rungMoves.every((m) => m.legal)).toBe(true);
  });

  it("does not restrict a player who is not the last to act in the trick", () => {
    const hand = makeHand(0);
    hand.selectRung(1, "diamonds");
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "hearts");

    hand.playCard(1, c("hearts", "2"));
    // Seat 2 is 2nd to act (not last), so no forced-cut restriction applies
    // to it regardless of team.
    const legal = hand.getLegalMoves(2);
    expect(legal.some((m) => m.reason === "must-cut")).toBe(false);
  });

  it("does not force a cut for the last player if they are on the rung selector's team", () => {
    // rungSelectorSeat = 1 (team 1 = {1,3}). Leader is seat 2 (team 0) this
    // trick, so turn order is 2,3,0,1 -> seat 1 (team 1, same as rung
    // selector) is last to act. The forced-cut rule only ever targets the
    // opposing team, so seat 1 must remain unrestricted.
    const hand = makeHand(0); // rungSelectorSeat = 1
    hand.selectRung(1, "diamonds");
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 2, wonWithAce: false };
    hand.leaderSeat = 2;

    hand.hands[2] = [c("hearts", "2"), ...hand.hands[2].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[3] = [c("clubs", "3"), ...hand.hands[3].filter((x) => x.suit !== "hearts" && !(x.suit === "clubs" && x.rank === "3"))];
    hand.hands[0] = [c("clubs", "4"), ...hand.hands[0].filter((x) => x.suit !== "hearts" && !(x.suit === "clubs" && x.rank === "4"))];
    hand.hands[1] = [c("diamonds", "6"), c("spades", "7"), ...hand.hands[1].filter((x) => x.suit !== "hearts" && x.suit !== "diamonds" && x.suit !== "spades")];

    hand.playCard(2, c("hearts", "2"));
    hand.playCard(3, c("clubs", "3"));
    hand.playCard(0, c("clubs", "4"));

    const legal = hand.getLegalMoves(1);
    expect(legal.some((m) => m.reason === "must-cut")).toBe(false);
  });
});
