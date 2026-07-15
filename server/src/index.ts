import http from "node:http";
import express from "express";
import { Server, Socket } from "socket.io";
import { RoomManager } from "./rooms/roomManager";
import { joinRoomSchema, playCardSchema, selectRungSchema } from "./socket/schemas";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

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
      rooms.get(joinedRoomId!)!.selectRung(socket.id, parsed.data.suit);
    });
  });

  socket.on("game:playCard", (payload: unknown) => {
    const parsed = playCardSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("room:error", { message: "Invalid card payload" });
      return;
    }
    handleAction(socket, joinedRoomId, () => {
      rooms.get(joinedRoomId!)!.playCard(socket.id, parsed.data.card);
    });
  });

  socket.on("disconnect", () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;
    room.removePlayer(socket.id);
    broadcastRoom(joinedRoomId);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Rung server listening on port ${PORT}`);
});
