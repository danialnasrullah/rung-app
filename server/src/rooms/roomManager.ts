import { GameRoom } from "./room";

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  getOrCreate(roomId: string): GameRoom {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new GameRoom(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  findRoomBySocket(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.occupiedSeatSocketIds().includes(socketId)) {
        return room;
      }
    }
    return undefined;
  }
}
