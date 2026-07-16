import { io, Socket } from "socket.io-client";
import { Card, PersonalizedRoomView } from "./types";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

export interface ServerToClientEvents {
  "room:state": (view: PersonalizedRoomView) => void;
  "room:error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "room:join": (payload: { roomId: string; displayName: string }) => void;
  "game:chooseTeam": (payload: { team: 0 | 1 }) => void;
  "game:requestRedeal": () => void;
  "game:selectRung": (payload: { card: Card }) => void;
  "game:playCard": (payload: { card: Card }) => void;
}

export type RungSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: RungSocket | null = null;

export function getSocket(): RungSocket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: true });
  }
  return socket;
}
