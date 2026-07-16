import { useEffect, useState } from "react";
import { getSocket } from "./lib/socket";
import { Card, PersonalizedRoomView } from "./lib/types";
import { JoinScreen } from "./components/JoinScreen";
import { Table } from "./components/Table";
import { Hand } from "./components/Hand";
import { RungPanel } from "./components/RungPanel";
import { TeamSelection } from "./components/TeamSelection";

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

  const handleChooseTeam = (team: 0 | 1) => {
    getSocket().emit("game:chooseTeam", { team });
  };

  const handlePlay = (card: Card) => {
    getSocket().emit("game:playCard", { card });
  };

  const handleSelectRung = (card: Card) => {
    getSocket().emit("game:selectRung", { card });
  };

  const handleRequestRedeal = () => {
    getSocket().emit("game:requestRedeal");
  };

  if (!joined || !view) {
    return <JoinScreen onJoin={handleJoin} error={error} />;
  }

  // ── Team selection ────────────────────────────────────────────────────
  if (view.phase === "team-selection" && view.teamSelection) {
    return (
      <>
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-rose-500/40 bg-rose-950/90 px-4 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}
        <TeamSelection
          roomId={view.roomId}
          teamSelection={view.teamSelection}
          onChooseTeam={handleChooseTeam}
        />
      </>
    );
  }

  // ── Waiting for players ───────────────────────────────────────────────
  if (view.phase === "waiting-for-players") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gold-500/30 bg-royal-800 p-8 text-center shadow-xl">
          <h1 className="font-serif text-2xl tracking-wide text-gold-400 mb-2">Rung</h1>
          <p className="text-sm text-slate-400">
            Room <span className="text-gold-400">{view.roomId}</span>
          </p>
          <p className="mt-4 text-slate-200">
            Waiting for more players to join…
          </p>
        </div>
      </div>
    );
  }

  // ── In-hand ───────────────────────────────────────────────────────────
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

      {view.phase === "in-hand" && hand && (
        <>
          <Table view={view} />

          {view.lastHandWinner && (
            <div className="mx-auto mb-4 max-w-xl rounded-lg border border-gold-500/30 bg-royal-800 px-4 py-2 text-center text-sm text-gold-300">
              Team {view.lastHandWinner.team + 1} won the last hand (
              {view.lastHandWinner.reason === "court" ? "Court!" : "Pick"}
              ). New hand dealt.
            </div>
          )}

          {hand.lastReshuffleReason && (
            <div className="mx-auto mb-4 max-w-xl rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-300">
              Reshuffled: {hand.lastReshuffleReason}
            </div>
          )}

          {hand.phase === "awaiting-redeal-decision" && (
            <RungPanel
              isYou={seat === hand.rungSelectorSeat}
              yourCards={hand.yourCards}
              onSelectRung={handleSelectRung}
              onRequestRedeal={handleRequestRedeal}
              reshuffleMessage={hand.lastReshuffleReason}
            />
          )}

          {hand.winner && (
            <div className="mx-auto mb-4 max-w-xl rounded-lg border border-gold-500/50 bg-royal-800 px-6 py-4 text-center">
              <div className="text-lg font-semibold text-gold-400">
                Team {hand.winner.team + 1} wins!
              </div>
              <div className="text-sm text-slate-300 mt-1">
                {hand.winner.reason === "court" ? "Court — all 13 sar swept!" : "Pick!"}
              </div>
            </div>
          )}

          <div className="mt-6">
            <Hand
              cards={hand.yourCards}
              legalMoves={hand.legalMoves}
              onPlay={handlePlay}
              interactive={hand.phase === "trick-play"}
              rungCard={hand.rungCard}
              rungOpened={hand.rungOpened}
            />
          </div>
        </>
      )}
    </div>
  );
}
