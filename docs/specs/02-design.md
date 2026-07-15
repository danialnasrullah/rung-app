# Design: Rung (Closed Variant) Web App — v1

## Option 1: Node.js + Socket.IO (server-authoritative) — SELECTED

**Summary:** A small Node/Express server holds the canonical game engine per room and pushes state over WebSockets; React renders it.

**How it works:** Each match is a "room" on a Node server. A TypeScript `GameEngine` module (pure logic, no I/O) enforces dealing, rung selection, follow-suit, cut hierarchy, forced-cut, and pick rules. Clients send intents ("play card X", "select rung Y", "redeal", "pick") over Socket.IO; the server validates each against the engine before mutating state and broadcasting the new state to all 4 clients. React (mobile-responsive, Tailwind) renders hands, the heap's top card, and disables illegal cards based on server-provided legal-move data.

**Pros:**
- Rules engine is genuinely authoritative and testable in isolation (NFR-02/NFR-04) — no client can force an illegal state.
- No vendor lock-in; runs on any Node-capable host.
- Full control over reconnect/session behavior and forced-cut enforcement (FR-13, FR-19).

**Cons:**
- We own hosting/deployment of a stateful process (not scale-to-zero serverless).
- In-memory room state is lost on server restart unless backed by Redis.
- More plumbing to write (socket events, room lifecycle, reconnect handling) than a BaaS gives for free.

**Complexity:** Medium
**New dependencies:** `express`, `socket.io`, `react`, `tailwindcss`, `zod`.
**Failure modes:**
- Server crash/restart mid-hand → room state lost. Mitigate: accept re-deal for internal tool; add Redis later if needed.
- Player disconnects mid-hand → seat frozen. Mitigate: reconnect via session token, grace period before forfeiting.
- Simultaneous/out-of-turn plays → server rejects any action not matching current turn order.

## Option 2: Firebase (Firestore + Cloud Functions), BaaS — not selected

Considered and rejected due to vendor lock-in with no strong justification for an internal 4-player tool, plus cold-start latency and weaker local testability of the rules engine. See chat history for full writeup.

## Recommendation

**Option 1 (Node + Socket.IO).** Approved.

## Open Design Questions

- Where will this be hosted (VF internal infra / which environment)?
- Is losing in-memory state on server restart acceptable, or does a match need to survive a redeploy (→ would need Redis)?

## Existing Codebase Patterns to Match

None — new project. `CLAUDE.md` will be created to lock in stack/conventions for this and future phases (Open Rung, etc.).
