import { describe, expect, it } from "vitest";
import { RungHand } from "../engine";
import { Card, Seat } from "../types";

function c(suit: Card["suit"], rank: Card["rank"]): Card {
  return { suit, rank };
}

function makeHand(dealerSeat: Seat = 0): RungHand {
  return new RungHand(dealerSeat, () => 0.42);
}

/**
 * Helper: injects one card of the given suit into the selector's hand (ensuring
 * fewer than 7 of that suit to avoid an auto-reshuffle), then calls selectRung.
 */
function selectRung(hand: RungHand, selectorSeat: Seat, suit: Card["suit"]): void {
  const rungCard = c(suit, "2");
  // Remove any existing suit-2 duplicate; cap same-suit cards at 6 to avoid reshuffle.
  let current = hand.hands[selectorSeat].filter(
    (x) => !(x.suit === suit && x.rank === "2"),
  );
  while (current.filter((x) => x.suit === suit).length >= 6) {
    const idx = current.findIndex((x) => x.suit === suit);
    current = [...current.slice(0, idx), ...current.slice(idx + 1)];
  }
  hand.hands[selectorSeat] = [rungCard, ...current].slice(0, 13);
  hand.selectRung(selectorSeat, rungCard);
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
  it("only the rung selector may select the rung, and it stays hidden until opening", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    const wrongCard = c("spades", "5");
    hand.hands[0] = [wrongCard, ...hand.hands[0].slice(1)];
    expect(() => hand.selectRung(0, wrongCard)).toThrow();

    selectRung(hand, 1, "spades");
    expect(hand.phase).toBe("trick-play");
    expect(hand.publicState(1).rungSuit).toBe("spades");
    expect(hand.publicState(0).rungSuit).toBeNull();
    expect(hand.publicState(0).rungChosen).toBe(true);
    expect(hand.publicState(0).rungOpened).toBe(false);
  });

  it("triggers a reshuffle when selector has 7+ of the chosen suit", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    const rungCard = c("clubs", "2");
    hand.hands[1] = [
      c("clubs", "2"), c("clubs", "3"), c("clubs", "4"), c("clubs", "5"),
      c("clubs", "6"), c("clubs", "7"), c("clubs", "8"),
      ...hand.hands[1].slice(7),
    ];
    hand.selectRung(1, rungCard);
    // Reshuffle: still in awaiting-redeal-decision, no rung chosen.
    expect(hand.phase).toBe("awaiting-redeal-decision");
    expect(hand.rungSuit).toBeNull();
    expect(hand.lastReshuffleReason).toBeTruthy();
  });

  it("rung card is set aside and marked illegal before rung opens", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    const rungCard = c("spades", "2");
    hand.hands[1] = [rungCard, ...hand.hands[1].filter((x) => !(x.suit === "spades" && x.rank === "2")).slice(0, 12)];
    hand.selectRung(1, rungCard);

    const moves = hand.getLegalMoves(1);
    const rungMove = moves.find((m) => m.card.suit === "spades" && m.card.rank === "2");
    expect(rungMove?.legal).toBe(false);
    expect(rungMove?.reason).toBe("is-rung-card");
  });
});

describe("trick resolution / cut hierarchy", () => {
  it("highest card of the led suit wins when no one cuts", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, leaderSeat = 1
    selectRung(hand, 1, "spades");
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
    selectRung(hand, 1, "spades");

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[0] = [c("hearts", "K"), ...hand.hands[0].filter((x) => x.suit !== "hearts")];
    hand.hands[2] = [c("spades", "5"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];
    hand.hands[3] = [c("spades", "9"), ...hand.hands[3].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];

    hand.playCard(1, c("hearts", "2"));
    hand.playCard(2, c("spades", "5")); // opposing + void in hearts → opens rung
    hand.playCard(3, c("spades", "9")); // higher cut
    const result = hand.playCard(0, c("hearts", "K"));

    expect(result?.seniorSeat).toBe(3);
    expect(result?.seniorViaCut).toBe(true);
  });

  it("rung cards played before opening have no trump power", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, rung = spades
    selectRung(hand, 1, "spades");

    hand.hands[1] = [c("hearts", "7"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "7"))];
    hand.hands[3] = [c("spades", "A"), ...hand.hands[3].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];
    hand.hands[2] = [c("diamonds", "3"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && x.suit !== "spades" && x.suit !== "diamonds")];
    hand.hands[0] = [c("hearts", "K"), ...hand.hands[0].filter((x) => !(x.suit === "hearts" && x.rank === "K"))];

    hand.playCard(1, c("hearts", "7"));
    hand.playCard(2, c("diamonds", "3")); // opposing, void, no spades → opens rung (pos 1)
    hand.playCard(3, c("spades", "A"));  // rung already open at pos 1; seat 3 is pos 2 → valid cut
    const result = hand.playCard(0, c("hearts", "K"));

    expect(result?.seniorSeat).toBe(3);
    expect(result?.seniorViaCut).toBe(true);
  });

  it("if opener has no rung, winner is the highest led-suit card", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, rung = spades
    selectRung(hand, 1, "spades");

    hand.hands[1] = [c("hearts", "7"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "7"))];
    hand.hands[2] = [c("clubs", "3"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && x.suit !== "spades" && !(x.suit === "clubs" && x.rank === "3"))];
    hand.hands[3] = [c("hearts", "4"), ...hand.hands[3].filter((x) => !(x.suit === "hearts" && x.rank === "4"))];
    hand.hands[0] = [c("hearts", "K"), ...hand.hands[0].filter((x) => x.suit !== "spades" && !(x.suit === "hearts" && x.rank === "K"))];

    hand.playCard(1, c("hearts", "7"));
    hand.playCard(2, c("clubs", "3"));  // opposing, void, no spades → opens rung with dead card
    hand.playCard(3, c("hearts", "4"));
    const result = hand.playCard(0, c("hearts", "K"));

    expect(result?.seniorSeat).toBe(0);
    expect(result?.seniorViaCut).toBe(false);
  });
});

describe("pick logic", () => {
  it("does not allow a pick before the 5th sar even with 2 consecutive senior wins", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    selectRung(hand, 1, "spades");
    hand.sarNumber = 2;
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
    const result = hand.playCard(0, hand.hands[0][0]);

    expect(result?.seniorSeat).toBe(1);
    expect(hand.sarNumber).toBe(3);
    expect(hand.winner).toBeNull();
    expect(hand.heapSarCount).toBe(3);
  });

  it("an ace win does not count toward completing a pick", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    selectRung(hand, 1, "spades");
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
    expect(hand.winner).toBeNull();
    expect(hand.lastSenior).toEqual({ seat: 1, wonWithAce: true });
  });

  it("the non-rung team wins the hand immediately on their first pick", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1), seats 0/2 = team 0
    selectRung(hand, 1, "spades");
    hand.rungOpened = true;
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

  it("the rung team only wins by sweeping all 13 sar (court)", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1)
    selectRung(hand, 1, "spades");
    hand.rungOpened = true;
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
    expect(hand.winner).toEqual({ team: 1, reason: "court" });
    expect(hand.phase).toBe("hand-complete");
  });

  it("a mid-hand pick by the rung team clears the heap but does not end the hand", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1)
    selectRung(hand, 1, "spades");
    hand.rungOpened = true;
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

  it("opposing team cannot pick on sar 12", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1), team 0 = {0,2}
    selectRung(hand, 1, "spades");
    hand.rungOpened = true;
    hand.sarNumber = 11; // about to play sar 12
    hand.lastSenior = { seat: 0, wonWithAce: false }; // team 0 won sar 11
    hand.leaderSeat = 0;

    hand.hands[0] = [c("clubs", "9"), ...hand.hands[0].filter((x) => !(x.suit === "clubs" && x.rank === "9"))];
    hand.hands[1] = hand.hands[1].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "clubs" && x.suit !== "spades");
    hand.hands[3] = hand.hands[3].filter((x) => x.suit !== "clubs" && x.suit !== "spades");

    hand.playCard(0, c("clubs", "9"));
    hand.playCard(1, hand.hands[1][0]);
    hand.playCard(2, hand.hands[2][0]);
    hand.playCard(3, hand.hands[3][0]);

    // Sar 12 completed; team 0 won consecutively, but sar 12 pick is blocked.
    expect(hand.sarNumber).toBe(12);
    expect(hand.winner).toBeNull(); // No pick at sar 12 for opposing team
    expect(hand.phase).toBe("trick-play");
  });

  it("a pick cannot happen before rung is opened, even at sar >= 5", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    selectRung(hand, 1, "spades");
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "9"), ...hand.hands[1].filter((x) => x.suit !== "hearts")];
    hand.hands[2] = [c("hearts", "K"), ...hand.hands[2].filter((x) => x.suit !== "hearts")];
    hand.hands[3] = [c("hearts", "4"), ...hand.hands[3].filter((x) => x.suit !== "hearts")];
    hand.hands[0] = [c("hearts", "2"), ...hand.hands[0].filter((x) => x.suit !== "hearts")];

    hand.playCard(1, c("hearts", "9"));
    hand.playCard(2, c("hearts", "K"));
    hand.playCard(3, c("hearts", "4"));
    hand.playCard(0, c("hearts", "2"));

    expect(hand.winner).toBeNull();
    expect(hand.rungOpened).toBe(false);
  });

  it("lastSarCards is populated after each completed trick", () => {
    const hand = makeHand(0);
    selectRung(hand, 1, "spades");
    hand.hands[1] = [c("hearts", "9"), ...hand.hands[1].filter((x) => x.suit !== "hearts")];
    hand.hands[2] = [c("hearts", "K"), ...hand.hands[2].filter((x) => x.suit !== "hearts")];
    hand.hands[3] = [c("hearts", "4"), ...hand.hands[3].filter((x) => x.suit !== "hearts")];
    hand.hands[0] = [c("hearts", "2"), ...hand.hands[0].filter((x) => x.suit !== "hearts")];

    hand.playCard(1, c("hearts", "9"));
    hand.playCard(2, c("hearts", "K"));
    hand.playCard(3, c("hearts", "4"));
    hand.playCard(0, c("hearts", "2"));

    expect(hand.lastSarCards).toHaveLength(4);
    expect(hand.currentTrick).toHaveLength(0);
  });
});

describe("forced cut rule", () => {
  it("forces the last (opposing) player to cut when the rung team would otherwise complete a pick", () => {
    const hand = makeHand(0);
    selectRung(hand, 1, "diamonds");
    hand.rungOpened = true;
    hand.sarNumber = 4;
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
    selectRung(hand, 1, "diamonds");
    hand.rungOpened = true;
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "hearts");

    hand.playCard(1, c("hearts", "2"));
    const legal = hand.getLegalMoves(2);
    expect(legal.some((m) => m.reason === "must-cut")).toBe(false);
  });

  it("does not force a cut for the last player if they are on the rung selector's team", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    selectRung(hand, 1, "diamonds");
    hand.rungOpened = true;
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

  it("opposing player void before opening must play rung if they hold it", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, rung = spades
    selectRung(hand, 1, "spades");
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[2] = [c("spades", "7"), c("clubs", "3"), ...hand.hands[2].filter(
      (x) => x.suit !== "hearts" && x.suit !== "spades" && !(x.suit === "clubs" && x.rank === "3"),
    )];

    hand.playCard(1, c("hearts", "2"));

    const legal = hand.getLegalMoves(2);
    const spadeMoves = legal.filter((m) => m.card.suit === "spades");
    const nonSpadeMoves = legal.filter((m) => m.card.suit !== "spades");

    expect(spadeMoves.every((m) => m.legal)).toBe(true);
    expect(nonSpadeMoves.every((m) => !m.legal && m.reason === "must-cut")).toBe(true);
  });

  it("opposing player void before opening with no rung may play any card", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, rung = spades
    selectRung(hand, 1, "spades");
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[2] = [c("clubs", "3"), c("diamonds", "5"), ...hand.hands[2].filter(
      (x) => x.suit !== "hearts" && x.suit !== "spades" && !(x.suit === "clubs" && x.rank === "3") && !(x.suit === "diamonds" && x.rank === "5"),
    )];

    hand.playCard(1, c("hearts", "2"));

    const legal = hand.getLegalMoves(2);
    expect(legal.every((m) => m.legal)).toBe(true);
  });
});
