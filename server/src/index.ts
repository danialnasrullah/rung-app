import http from "node:http";
import express from "express";
import { Server, Socket } from "socket.io";
import { RoomManager } from "./rooms/roomManager";
import {
  chooseTeamSchema,
  joinRoomSchema,
  playCardSchema,
  selectRungSchema,
} from "./socket/schemas";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

/** Delay (ms) before starting the next hand so the last sar is visible. */
const NEW_HAND_DELAY_MS = 2500;

/** Grace period (ms) before an empty room is reaped. */
const ROOM_REAP_DELAY_MS = 30_000;

const app = express();
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

const rooms = new RoomManager();

function broadcastRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const socketId of room.occupiedSeatSocketIds()) {
    io.to(socketId).emit("room:state", room.viewFor(socketId));
  }
}

function handleAction(socket: Socket, roomId: string | undefined, action: () => void): void {
  if (!roomId) {
    socket.emit("room:error", { message: "You are not in a room" });
    return;
  }
  try {
    action();
    broadcastRoom(roomId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    socket.emit("room:error", { message });
  }
}

io.on("connection", (socket: Socket) => {
  let joinedRoomId: string | undefined;

  socket.on("room:join", (payload: unknown) => {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("room:error", { message: "Invalid join payload" });
      return;
    }
    try {
      const room = rooms.getOrCreate(parsed.data.roomId);
      room.addPlayer(socket.id, parsed.data.displayName);
      joinedRoomId = parsed.data.roomId;
      socket.join(parsed.data.roomId);
      broadcastRoom(parsed.data.roomId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      socket.emit("room:error", { message });
    }
  });

  socket.on("game:chooseTeam", (payload: unknown) => {
    const parsed = chooseTeamSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("room:error", { message: "Invalid team choice" });
      return;
    }
    handleAction(socket, joinedRoomId, () => {
      rooms.get(joinedRoomId!)!.chooseTeam(socket.id, parsed.data.team);
    });
  });

  socket.on("game:requestRedeal", () => {
    handleAction(socket, joinedRoomId, () => {
      rooms.get(joinedRoomId!)!.requestRedeal(socket.id);
    });
  });

  socket.on("game:selectRung", (payload: unknown) => {
    const parsed = selectRungSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("room:error", { message: "Invalid rung selection" });
      return;
    }
    handleAction(socket, joinedRoomId, () => {
      rooms.get(joinedRoomId!)!.selectRung(socket.id, parsed.data.card);
    });
  });

  socket.on("game:playCard", (payload: unknown) => {
    const parsed = playCardSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("room:error", { message: "Invalid card payload" });
      return;
    }
    if (!joinedRoomId) {
      socket.emit("room:error", { message: "You are not in a room" });
      return;
    }
    try {
      const room = rooms.get(joinedRoomId)!;
      const rid = joinedRoomId;
      const handComplete = room.playCard(socket.id, parsed.data.card);
      // Broadcast immediately so the completed trick (lastSarCards) is visible.
      broadcastRoom(rid);
      if (handComplete) {
        // Delay starting the new hand so players can see the final sar.
        setTimeout(() => {
          const r = rooms.get(rid);
          if (r) {
            r.startNewHand();
            broadcastRoom(rid);
          }
        }, NEW_HAND_DELAY_MS);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      socket.emit("room:error", { message });
    }
  });

  socket.on("disconnect", () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;
    const rid = joinedRoomId;
    room.removePlayer(socket.id);
    broadcastRoom(rid);

    // Schedule room cleanup if all players have disconnected.
    if (room.allDisconnected()) {
      setTimeout(() => {
        const r = rooms.get(rid);
        if (r?.allDisconnected()) {
          rooms.delete(rid);
        }
      }, ROOM_REAP_DELAY_MS);
    }
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Rung server listening on port ${PORT}`);
});
