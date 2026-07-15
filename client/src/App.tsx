import { useEffect, useState } from "react";
import { getSocket } from "./lib/socket";
import { Card, PersonalizedRoomView, Suit } from "./lib/types";
import { JoinScreen } from "./components/JoinScreen";
import { Table } from "./components/Table";
import { Hand } from "./components/Hand";
import { RungPanel } from "./components/RungPanel";

export default function App() {
  const [view, setView] = useState<PersonalizedRoomView | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onState = (next: PersonalizedRoomView) => {
      setView(next);
      setError(undefined);
    };
    const onError = (payload: { message: string }) => setError(payload.message);

    socket.on("room:state", onState);
    socket.on("room:error", onError);
    return () => {
      socket.off("room:state", onState);
      socket.off("room:error", onError);
    };
  }, []);

  const handleJoin = (roomId: string, displayName: string) => {
    getSocket().emit("room:join", { roomId, displayName });
    setJoined(true);
  };

  const handlePlay = (card: Card) => {
    getSocket().emit("game:playCard", { card });
  };

  const handleSelectRung = (suit: Suit) => {
    getSocket().emit("game:selectRung", { suit });
  };

  const handleRequestRedeal = () => {
    getSocket().emit("game:requestRedeal");
  };

  if (!joined || !view) {
    return <JoinScreen onJoin={handleJoin} error={error} />;
  }

  const { hand, seat } = view;

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-8">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-serif text-xl tracking-wide text-gold-400 sm:text-2xl">Rung</h1>
        <span className="text-xs text-slate-400">Room {view.roomId}</span>
      </header>

      {error && (
        <div className="mx-auto mb-4 max-w-xl rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-2 text-center text-sm text-rose-300">
          {error}
        </div>
      )}

      {view.phase === "waiting-for-players" && (
        <div className="mx-auto max-w-sm rounded-xl border border-gold-500/30 bg-royal-800 p-6 text-center text-slate-200">
          Waiting for {4 - view.seats.filter(Boolean).length} more player(s) to join room{" "}
          <span className="text-gold-400">{view.roomId}</span>...
        </div>
      )}

      {view.phase === "in-hand" && hand && (
        <>
          <Table view={view} />

          {view.lastHandWinner && (
            <div className="mx-auto mb-4 max-w-xl rounded-lg border border-gold-500/30 bg-royal-800 px-4 py-2 text-center text-sm text-gold-300">
              Team {view.lastHandWinner.team + 1} won the last hand ({view.lastHandWinner.reason}). New hand dealt.
            </div>
          )}

          {hand.phase === "awaiting-redeal-decision" && (
            <RungPanel
              isYou={seat === hand.rungSelectorSeat}
              onSelectRung={handleSelectRung}
              onRequestRedeal={handleRequestRedeal}
            />
          )}

          <div className="mt-6">
            <Hand
              cards={hand.yourCards}
              legalMoves={hand.legalMoves}
              onPlay={handlePlay}
              interactive={hand.phase === "trick-play"}
            />
          </div>
        </>
      )}
    </div>
  );
}
