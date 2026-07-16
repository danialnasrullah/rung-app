import { TeamSelectionView } from "../lib/types";

interface TeamSelectionProps {
  roomId: string;
  teamSelection: TeamSelectionView;
  onChooseTeam: (team: 0 | 1) => void;
}

const TEAM_LABELS = ["Team A", "Team B"] as const;
const TEAM_COLORS = [
  "border-emerald-500/60 text-emerald-300",
  "border-violet-500/60 text-violet-300",
] as const;
const TEAM_BTN = [
  "border-emerald-500/60 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-800/40",
  "border-violet-500/60 bg-violet-900/30 text-violet-300 hover:bg-violet-800/40",
] as const;

export function TeamSelection({ roomId, teamSelection, onChooseTeam }: TeamSelectionProps) {
  const me = teamSelection.players.find((p) => p.isYou);
  const myTeam = me?.team ?? null;

  const teamA = teamSelection.players.filter((p) => p.team === 0);
  const teamB = teamSelection.players.filter((p) => p.team === 1);
  const unassigned = teamSelection.players.filter((p) => p.team === null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-gold-500/30 bg-royal-800 p-8 shadow-xl">
        <div className="text-center">
          <h1 className="font-serif text-2xl tracking-wide text-gold-400">Rung</h1>
          <p className="mt-1 text-sm text-slate-400">
            Room <span className="text-gold-400">{roomId}</span> · Choose your team
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {([0, 1] as const).map((t) => {
            const members = t === 0 ? teamA : teamB;
            const isFull = members.length >= 2;
            const isMyTeam = myTeam === t;
            return (
              <div
                key={t}
                className={`rounded-xl border p-4 space-y-3 ${TEAM_COLORS[t]}`}
              >
                <div className="font-semibold text-sm tracking-wide uppercase">
                  {TEAM_LABELS[t]}
                </div>
                <ul className="space-y-1 min-h-[3rem]">
                  {members.map((p) => (
                    <li key={p.displayName} className="text-sm flex items-center gap-1">
                      {p.isYou && <span className="text-[10px] opacity-60">(you)</span>}
                      {p.displayName}
                    </li>
                  ))}
                  {members.length < 2 && (
                    <li className="text-xs opacity-40 italic">
                      {members.length === 0 ? "No one yet" : "1 more needed"}
                    </li>
                  )}
                </ul>
                <button
                  type="button"
                  disabled={isFull || isMyTeam}
                  onClick={() => onChooseTeam(t)}
                  className={[
                    "w-full rounded-lg border py-2 text-sm font-medium transition",
                    TEAM_BTN[t],
                    isFull || isMyTeam ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {isMyTeam ? "Joined" : isFull ? "Full" : `Join ${TEAM_LABELS[t]}`}
                </button>
              </div>
            );
          })}
        </div>

        {unassigned.length > 0 && (
          <div className="text-center text-xs text-slate-500">
            Waiting for {unassigned.map((p) => p.displayName).join(", ")} to choose a team…
          </div>
        )}

        {myTeam !== null && unassigned.length === 0 && (
          <div className="text-center text-sm text-slate-300">
            All players ready — starting when teams are balanced (2 per side)…
          </div>
        )}
      </div>
    </div>
  );
}
