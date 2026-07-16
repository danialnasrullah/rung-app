import { z } from "zod";

export const suitSchema = z.enum(["clubs", "diamonds", "hearts", "spades"]);
export const rankSchema = z.enum([
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
]);

export const cardSchema = z.object({
  suit: suitSchema,
  rank: rankSchema,
});

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(40),
});

export const chooseTeamSchema = z.object({
  team: z.union([z.literal(0), z.literal(1)]),
});

/** Rung is now set by choosing a card, not a bare suit. */
export const selectRungSchema = z.object({
  card: cardSchema,
});

export const playCardSchema = z.object({
  card: cardSchema,
});
