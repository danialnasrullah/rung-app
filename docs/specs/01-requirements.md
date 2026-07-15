# Requirements: Rung (Closed Variant) Web App — v1

Internal VF project. No client/PII involved.

## Functional Requirements

- **FR-01**: The system shall support one hand of Closed Rung for 4 players in 2 fixed, crosswise partnerships.
- **FR-02**: The system shall run a pre-match draw where the lowest card determines the first dealer.
- **FR-03**: The system shall deal cards to each player in batches of 5, then 4, then 4.
- **FR-04**: The system shall let the rung selector privately choose a trump suit from their first 5 cards without revealing it to others.
- **FR-05**: The system shall let the rung selector request a redeal if none of their first 5 cards is a face card (J/Q/K/A).
- **FR-06**: The system shall enforce follow-suit rules during each sar.
- **FR-07**: The system shall determine the senior (winner) of each sar using standard trick-taking rules, including trump cuts.
- **FR-08**: The system shall accumulate won sar into a shared heap until picked.
- **FR-09**: The system shall let a player pick the heap when they are senior on 2 consecutive sar.
- **FR-10**: The system shall block any heap pick before the 5th sar.
- **FR-11**: The system shall exclude an Ace-won sar from counting toward the 2-consecutive-senior streak, while still marking that player senior for the sar.
- **FR-12**: The system shall resolve cut hierarchy so a cut beats any non-rung card, and the highest rung card among multiple cuts in a sar wins.
- **FR-13**: The system shall force the last-acting opposing player to cut, if able, when the rung-selecting team is about to complete a pick.
- **FR-14**: The system shall declare the rung-selecting team the hand winner only after picking all 13 sar.
- **FR-15**: The system shall declare the non-rung team the hand winner upon their first successful pick.
- **FR-16**: The system shall rotate the dealer role to the losing team after each hand.
- **FR-17**: The UI shall be mobile-friendly and responsive across phone and tablet screen sizes.
- **FR-18**: The system shall show only the top card of the heap to all players; the rest of the heap remains hidden.
- **FR-19**: The UI shall disable (not just reject) any card the current player is not legally allowed to play — including cards blocked by follow-suit rules and the forced-cut rule — so illegal moves cannot be attempted.

## Non-Functional Requirements

- **NFR-01**: The UI shall be usable via touch input on mobile devices (card selection, play, redeal/pick actions).
- **NFR-02**: The rules engine shall be implemented separately from the UI so it can be unit-tested independently.
- **NFR-03**: Player actions shall be reflected to other players within a low-latency window suitable for real-time turn-based play.
- **NFR-04**: The rules engine shall be the single source of truth for legality (which cards are playable), and the UI shall reflect that state rather than duplicating rule logic.
- **NFR-05**: Visual design shall be clean, minimalistic, sober, and "royal" in tone; playing cards shall look like realistic playing cards, not abstract icons/symbols.

## Acceptance Criteria (key flows)

**FR-04** — Private rung selection
- Given the rung selector has received their first 5 cards, When they select a trump suit, Then no other player's client receives or displays that suit.

**FR-09** — Picking the heap
- Given a player was senior on the immediately preceding sar, When that same player is senior again on the next sar, Then the heap is awarded to their team and cleared.

**FR-11** — Ace exception
- Given a player wins a sar with an Ace, When checking pick eligibility, Then that win does not count toward the 2-consecutive-senior streak, but the player is still recorded as senior for that sar.

**FR-13** — Forced cut
- Given the rung-selecting team would complete a pick on the current sar, And the last-acting player is on the opposing team and holds a rung card but not the suit led, When it is their turn, Then the system requires them to play a rung card (non-rung cards are disabled).

**FR-16** — Dealer rotation
- Given a hand has concluded, When the next hand begins, Then the deal passes to a player on the losing team.

**FR-18** — Heap visibility
- Given sar have accumulated in the heap, When any player views the table, Then only the top card of the heap is visible; earlier cards in the heap are hidden.

**FR-19** — Illegal move prevention
- Given it is a player's turn, When the UI renders their hand, Then any card that would break follow-suit or forced-cut rules is shown as disabled/non-interactive.

## Ambiguities (still open — need clarification)

**Technical**
- Is this networked multiplayer (4 separate devices/browsers), or local pass-and-play on one device?
- Should the server authoritatively enforce legal plays, or is client-side-only enforcement acceptable given internal use?
- Is offline play or installable PWA behavior required?

## Assumptions

- Real-time multiplayer across up to 4 devices, for internal VF use only (no public-facing scale/auth concerns).
- No user accounts/auth for v1 — simple session/room-based joining is sufficient.
- Single-hand play only; no multi-hand match or persistent scoring in v1.
- No AI/bot players in v1.

## Out of Scope (v1)

- Open Rung variant (**planned for next phase**, not this build)
- Multi-hand match scoring / tournaments
- User accounts, authentication, persistent player profiles
- Spectator mode
- AI/bot players
- Monetization/payments
