# Ballsfoot Context

## Project Shape

Ballsfoot is a local, browser-only football tactics simulator with a directly opened `index.html` entry point and plain JavaScript modules under `src/`. The app has no build step, package manager, backend, or persistence layer.

The current product surface is a live match simulator: two teams line up in a 4-4-2, the ball moves between players, the score and clock advance, and important actions are shown in a timeline with copyable hidden logs.

## Core Domain

- Match: a simulated football game with two periods, stoppage time, score, state transitions, and restarts.
- Team: one side of the match. Each team has identity, colors, venue, direction of attack, formation, players, and score.
- Player: a member of a team with a stable shirt number, overall rating, ordered preferred positions, and a current on-field role.
- Preferred position: a role a player is suited to occupy, ordered from strongest preference to weaker alternatives.
- Lineup assignment: the allocation of players to formation slots. Higher-overall players claim compatible preferred slots first; unassigned players fill the remaining slots.
- Formation: a set of tactical slots, each defined by an on-field role and base position. The only implemented formation is `4-4-2`.
- Possession: the current player carrying the ball. Many tactical calculations are centered on the possession holder.
- Ball state: the ball's current lifecycle state: controlled by a player, travelling toward a target, loose after a deflection, or out of play. A travelling or loose ball has no possession holder.
- Simulation time: continuous elapsed time advanced through fixed internal steps. Match-clock time is derived from simulation time, while playback speed controls how quickly simulation time is consumed.
- Tactical context: a derived snapshot for one team: phase, intent, pressure zone, ball side, line centers, mentality, and defensive line.
- Support option: a nearby teammate positioned to give the possession holder a safe short pass and form a small triangle around the ball.
- Cover shadow: a defender positioned between the possession holder and a likely receiver to close a passing lane without abandoning the team block.
- Fullback cover: the same-side center back's responsibility to protect the channel behind an advanced fullback.
- Pressure: a normalized measure of how strongly nearby opponents are affecting the player on the ball or a receiving option.
- Space score: a normalized measure of how useful or open a player's receiving position is.
- Event log: structured match events with fan-facing copy and analytics data. Key moments are rendered in the visible timeline; all events can be copied as text.
- Match event: one recorded football action or match-state change, with human copy, structured event data, tactical context, and export metadata.
- Telemetry export: machine-readable match log data used to inspect patterns across a simulated match.
- Realism signal: a derived metric from match events that points to possible simulation tuning, such as pass completion, shot volume, turnover volume, pressure, and pass directness.

## Match State

`MatchEngine.state` uses these states:

- `pre`: match is ready but not running.
- `playing`: action and movement loops are active.
- `paused`: match is paused by the user.
- `goalPause`: a goal modal is open and kickoff waits for confirmation.
- `halftime`: first period is complete and the second period can start.
- `finished`: full time is complete and reset is available.

The match clock is derived from continuous elapsed match time, the current period, and seeded stoppage time for each half. The visual clock shows first-half minutes as `00'` through `45+N'` and second-half minutes as `45'` through `90+N'`.

## Tactical Model

The simulator is rule-weighted rather than physics-accurate. It uses deterministic geometry, seeded random weighted choices, and fixed simulation steps to create plausible football sequences.

Important tactical concepts:

- Defensive line height and compactness keep the team shape coherent.
- Build-up rules prefer center backs, fullbacks, the holding midfielder, and playmaker options.
- Passing weights consider proximity, forward progress, lane safety, receiving pressure, space, switch options, combinations, counter state, and player overall.
- Final-third actions can become through balls or crosses before a shot.
- Offside is modeled using attacking progress, defensive line progress, ball position, and eligibility.
- Dribbles depend on role, pressure, marker distance, cooldown, and overall ratings.
- Shots depend on role, distance to goal, pressure, and player overall.
- Counter-attacks and post-loss press are temporary team states after possession changes.

## UI Model

The page has three main columns:

- Home team panel.
- Match panel with scorebar, field, controls, speed slider, status, and timeline.
- Away team panel.

The field uses percentage coordinates from `0` to `100`. Player tokens and the ball are positioned by CSS custom properties or direct percentage styles. The app exposes the live `BrowserGameAdapter` instance at `window.tacticsGame`; its headless motor is available at `window.tacticsGame.engine`.

## Code Organization

Runtime behavior is divided across two modules:

- `src/match-engine.js`: headless match state, fixed-step timing, formations, movement, tactical decisions, ball lifecycle, scoring, statistics, and domain events.
- `src/browser-game-adapter.js`: team configuration, DOM creation, controls, animation loop, rendering, timeline, modal, and exports.

The CSS and HTML remain inline in `index.html`, which loads the two plain scripts and continues to work when opened directly.

## Current Constraints

- Browser-only JavaScript; no dependencies are currently installed.
- Match randomness is generated from a seed, so headless simulations are reproducible.
- Automated tests use Node's built-in test runner and execute with `node --test`.
- The current repository has only one app context.
- The legacy inline simulation source remains embedded but inert while the extracted engine and adapter are validated.

## Development Notes

For local development, run `node --test`, then open `index.html` directly for visual verification. High-value automated targets are engine behavior through `command`, `advance`, `getSnapshot`, and `drainEvents`, plus browser-adapter smoke tests.
