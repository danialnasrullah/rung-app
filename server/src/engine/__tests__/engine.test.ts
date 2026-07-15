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
  it("only the rung selector may select the rung, and it stays hidden until opening", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    expect(() => hand.selectRung(0, "spades")).toThrow();
    hand.selectRung(1, "spades");
    expect(hand.phase).toBe("trick-play");
    // Selector always sees the suit.
    expect(hand.publicState(1).rungSuit).toBe("spades");
    // Others see null until rung is opened.
    expect(hand.publicState(0).rungSuit).toBeNull();
    expect(hand.publicState(0).rungChosen).toBe(true);
    expect(hand.publicState(0).rungOpened).toBe(false);
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
    // Seat 2 is on the opposing team (rungSelector=1, team1={1,3}, team0={0,2}).
    // Seat 2 being void in hearts and playing spades naturally opens rung.
    const hand = makeHand(0); // rungSelectorSeat = 1, leaderSeat = 1
    hand.selectRung(1, "spades");

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[0] = [c("hearts", "K"), ...hand.hands[0].filter((x) => x.suit !== "hearts")];
    hand.hands[2] = [c("spades", "5"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];
    hand.hands[3] = [c("spades", "9"), ...hand.hands[3].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];

    hand.playCard(1, c("hearts", "2")); // led suit: hearts
    hand.playCard(2, c("spades", "5")); // opposing + void in hearts → opens rung; must play rung
    hand.playCard(3, c("spades", "9")); // higher cut (rung already open)
    const result = hand.playCard(0, c("hearts", "K")); // follows suit, cannot beat a cut

    expect(result?.seniorSeat).toBe(3);
    expect(result?.seniorViaCut).toBe(true);
  });

  it("rung cards played before opening have no trump power", () => {
    // Seat 3 (rung team) plays a rung card while void before rung is opened.
    // That card is dead. Seat 2 (opposing) then opens rung by playing while void.
    // Only rung cards from seat 2 onwards have power in this sar.
    const hand = makeHand(0); // rungSelectorSeat = 1, leaderSeat = 1, rung = spades
    hand.selectRung(1, "spades");

    // Seat 1 leads hearts. Seat 3 (rung team, void in hearts) plays spades/A
    // BEFORE rung is opened — that ace is dead. Seat 2 (opposing, void in hearts,
    // no spades) opens rung by playing a non-rung card. Seat 0 follows hearts.
    hand.hands[1] = [c("hearts", "7"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "7"))];
    hand.hands[3] = [c("spades", "A"), ...hand.hands[3].filter((x) => x.suit !== "hearts" && x.suit !== "spades")];
    hand.hands[2] = [c("diamonds", "3"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && x.suit !== "spades" && x.suit !== "diamonds")];
    hand.hands[0] = [c("hearts", "K"), ...hand.hands[0].filter((x) => !(x.suit === "hearts" && x.rank === "K"))];

    hand.playCard(1, c("hearts", "7"));  // leads hearts
    hand.playCard(2, c("diamonds", "3")); // opposing, void in hearts, no spades → opens rung (pos 1), plays any
    hand.playCard(3, c("spades", "A"));  // rung team, void; rung open, not last → any card (but played before opening conceptually — wait, actually seat 3 plays AFTER seat 2 here)

    // Turn order: 1,2,3,0 (leaderSeat=1). Seat 2 is pos 1, seat 3 is pos 2. So seat 3 plays AFTER opening.
    // Seat 3 cuts with spades/A after rung is open → valid cut. Seat 3 wins.
    const result = hand.playCard(0, c("hearts", "K"));

    expect(result?.seniorSeat).toBe(3);
    expect(result?.seniorViaCut).toBe(true);
  });

  it("if opener has no rung, winner is the highest led-suit card", () => {
    // Seat 2 (opposing, void in hearts, no spades) opens rung with a dead card.
    // No subsequent rung cuts. Highest hearts wins.
    const hand = makeHand(0); // rungSelectorSeat = 1, leaderSeat = 1, rung = spades
    hand.selectRung(1, "spades");

    hand.hands[1] = [c("hearts", "7"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "7"))];
    hand.hands[2] = [c("clubs", "3"), ...hand.hands[2].filter((x) => x.suit !== "hearts" && x.suit !== "spades" && !(x.suit === "clubs" && x.rank === "3"))];
    hand.hands[3] = [c("hearts", "4"), ...hand.hands[3].filter((x) => !(x.suit === "hearts" && x.rank === "4"))];
    hand.hands[0] = [c("hearts", "K"), ...hand.hands[0].filter((x) => x.suit !== "spades" && !(x.suit === "hearts" && x.rank === "K"))];

    hand.playCard(1, c("hearts", "7"));  // leads hearts
    hand.playCard(2, c("clubs", "3"));   // opposing, void, no spades → opens rung with dead card
    hand.playCard(3, c("hearts", "4"));  // follows hearts
    const result = hand.playCard(0, c("hearts", "K")); // follows hearts, highest

    expect(result?.seniorSeat).toBe(0);
    expect(result?.seniorViaCut).toBe(false);
  });
});

describe("pick logic", () => {
  it("does not allow a pick before the 5th sar even with 2 consecutive senior wins", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1
    hand.selectRung(1, "spades");
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

    expect(result?.seniorSeat).toBe(1); // seat 1 senior again, 2 in a row
    expect(hand.sarNumber).toBe(3);
    expect(hand.winner).toBeNull(); // sar 3 < 5, no pick
    expect(hand.heapSarCount).toBe(3);
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
    expect(hand.winner).toBeNull(); // ace win breaks the streak
    expect(hand.lastSenior).toEqual({ seat: 1, wonWithAce: true });
  });

  it("the non-rung team wins the hand immediately on their first pick", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1), seats 0/2 = team 0
    hand.selectRung(1, "spades");
    // Simulate state after rung has already been opened in an earlier sar.
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

  it("the rung team only wins by sweeping all 13 sar", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1)
    hand.selectRung(1, "spades");
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
    expect(hand.winner).toEqual({ team: 1, reason: "full-sweep" });
    expect(hand.phase).toBe("hand-complete");
  });

  it("a mid-hand pick by the rung team clears the heap but does not end the hand", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1 (team 1)
    hand.selectRung(1, "spades");
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

  it("a pick cannot happen before rung is opened, even at sar >= 5", () => {
    // Simulate a state where sar >= 5 but rung has never been opened.
    const hand = makeHand(0); // rungSelectorSeat = 1
    hand.selectRung(1, "spades");
    // rungOpened stays false (default)
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    // Give everyone hearts only so no void → no opening during this trick.
    hand.hands[1] = [c("hearts", "9"), ...hand.hands[1].filter((x) => x.suit !== "hearts")];
    hand.hands[2] = [c("hearts", "K"), ...hand.hands[2].filter((x) => x.suit !== "hearts")];
    hand.hands[3] = [c("hearts", "4"), ...hand.hands[3].filter((x) => x.suit !== "hearts")];
    hand.hands[0] = [c("hearts", "2"), ...hand.hands[0].filter((x) => x.suit !== "hearts")];

    hand.playCard(1, c("hearts", "9"));
    hand.playCard(2, c("hearts", "K"));
    hand.playCard(3, c("hearts", "4"));
    const result = hand.playCard(0, c("hearts", "2"));

    // Seat 2 won. That's the 5th sar, and lastSenior was seat 1, not seat 2 —
    // so no pick anyway. But even if lastSenior matched, rungOpened=false blocks it.
    expect(hand.winner).toBeNull();
    expect(hand.rungOpened).toBe(false);
  });
});

describe("forced cut rule", () => {
  // leaderSeat = 1 -> turn order is seat 1, 2, 3, 0 (0 is last to act).
  // rungSelectorSeat = 1 -> team 1 = {1,3}, team 0 = {0,2}. Seat 0 (last to
  // act) is on the opposing team, which is exactly the case the rule targets.
  it("forces the last (opposing) player to cut when the rung team would otherwise complete a pick", () => {
    const hand = makeHand(0);
    hand.selectRung(1, "diamonds");
    // Rung already opened in a prior sar.
    hand.rungOpened = true;
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
    // Rung already opened in a prior sar.
    hand.rungOpened = true;
    hand.sarNumber = 4;
    hand.lastSenior = { seat: 1, wonWithAce: false };
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    hand.hands[2] = hand.hands[2].filter((x) => x.suit !== "hearts");

    hand.playCard(1, c("hearts", "2"));
    // Seat 2 is 2nd to act (not last), so the pick-forcing rule does not apply.
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
    // Rung is NOT open yet. Seat 2 (opposing) is void in the led suit and
    // holds rung cards — they must play rung to open it.
    const hand = makeHand(0); // rungSelectorSeat = 1, rung = spades
    hand.selectRung(1, "spades");
    // rungOpened = false (default)
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    // Seat 2: no hearts, has spades.
    hand.hands[2] = [c("spades", "7"), c("clubs", "3"), ...hand.hands[2].filter(
      (x) => x.suit !== "hearts" && x.suit !== "spades" && !(x.suit === "clubs" && x.rank === "3"),
    )];

    hand.playCard(1, c("hearts", "2")); // leads hearts

    const legal = hand.getLegalMoves(2);
    const spadeMoves = legal.filter((m) => m.card.suit === "spades");
    const nonSpadeMoves = legal.filter((m) => m.card.suit !== "spades");

    expect(spadeMoves.every((m) => m.legal)).toBe(true);
    expect(nonSpadeMoves.every((m) => !m.legal && m.reason === "must-cut")).toBe(true);
  });

  it("opposing player void before opening with no rung may play any card", () => {
    const hand = makeHand(0); // rungSelectorSeat = 1, rung = spades
    hand.selectRung(1, "spades");
    hand.leaderSeat = 1;

    hand.hands[1] = [c("hearts", "2"), ...hand.hands[1].filter((x) => !(x.suit === "hearts" && x.rank === "2"))];
    // Seat 2: no hearts, no spades.
    hand.hands[2] = [c("clubs", "3"), c("diamonds", "5"), ...hand.hands[2].filter(
      (x) => x.suit !== "hearts" && x.suit !== "spades" && !(x.suit === "clubs" && x.rank === "3") && !(x.suit === "diamonds" && x.rank === "5"),
    )];

    hand.playCard(1, c("hearts", "2"));

    const legal = hand.getLegalMoves(2);
    expect(legal.every((m) => m.legal)).toBe(true);
  });
});
