import { FormEvent, useState } from "react";

interface JoinScreenProps {
  onJoin: (roomId: string, displayName: string) => void;
  error?: string;
}

export function JoinScreen({ onJoin, error }: JoinScreenProps) {
  const [roomId, setRoomId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !displayName.trim()) return;
    onJoin(roomId.trim(), displayName.trim());
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-gold-500/30 bg-royal-800 p-8 shadow-xl"
      >
        <h1 className="text-center font-serif text-3xl tracking-wide text-gold-400">Rung</h1>
        <p className="text-center text-sm text-slate-300">Closed Rung · 4 players</p>

        <div className="space-y-1">
          <label htmlFor="displayName" className="text-xs uppercase tracking-wide text-slate-400">
            Your name
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gold-500/30 bg-royal-900 px-3 py-2 text-slate-100 outline-none focus:border-gold-400"
            placeholder="e.g. Danial"
            maxLength={40}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="roomId" className="text-xs uppercase tracking-wide text-slate-400">
            Room code
          </label>
          <input
            id="roomId"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-lg border border-gold-500/30 bg-royal-900 px-3 py-2 text-slate-100 outline-none focus:border-gold-400"
            placeholder="e.g. table-1"
            maxLength={64}
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-gold-500 py-2 font-medium text-royal-900 transition hover:bg-gold-400"
        >
          Join Table
        </button>
      </form>
    </div>
  );
}
