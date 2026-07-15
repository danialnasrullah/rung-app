# CLAUDE.md — Rung Web App

## 1. Project Context

Internal VF tool: a 4-player, 2-team web implementation of Rung (Closed Rung
variant, house rules). No client/PII involved — internal use only.

Specs, in order: `docs/specs/00-rulebook.md` (house rules), `01-requirements.md`,
`02-design.md`.

## 2. Stack (approved — do not add dependencies without flagging them first)

- **Server:** Node.js (TypeScript), Express, Socket.IO, Zod for message validation.
- **Client:** React + TypeScript, Vite, Tailwind CSS.
- **Testing:** Vitest for the rules engine (server-side, pure logic, no I/O).
- **Package manager:** npm.

Architecture: server-authoritative. The `RungHand` engine
(`server/src/engine/`) is the single source of truth for legality — it has no
I/O and is unit-tested directly. The Socket.IO layer only translates
client intents to engine calls and broadcasts resulting state; it must never
duplicate rule logic.

## 3. Conventions

- TypeScript everywhere, `strict: true`. No `any` without a comment explaining why.
- All engine methods that can fail throw `Error` with a clear message; callers
  (socket handlers) must catch and translate to an error event — never let an
  engine exception crash a room.
- No secrets/tokens in code or committed files.
- Feature branches only. Never commit directly to `main`/`master`. No force pushes.
- Hidden state (rung suit, cards under the top of the heap) must never be sent
  to a client that isn't entitled to see it — filter in `publicState(forSeat)`,
  not in the client.

## 4. Out of Scope (v1)

Open Rung variant (planned next phase), multi-hand match scoring, auth/accounts,
spectator mode, AI/bot players, monetization. See `01-requirements.md`.

## 5. Known Open Questions

- Hosting target for the Node server.
- Whether in-memory room state needs to survive a server restart (→ Redis).
- Redeal repeat-limit (currently unlimited — see `00-rulebook.md` §10).
